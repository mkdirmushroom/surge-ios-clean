import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const scriptForbidden = [
  [/\$httpClient\b/, "$httpClient"],
  [/\$task\.fetch\b/, "$task.fetch"],
  [/\$httpAPI\b/, "$httpAPI"],
  [/\$persistentStore\b/, "$persistentStore"],
  [/\$prefs\b/, "$prefs"],
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\b/, "new Function"],
  [/\bFunction\s*\(/, "Function constructor"],
  [/console\.(?:log|info|warn|error)\s*\([^)]*(?:\$response\.body|\$request\.(?:headers|body)|cookie|authorization)/i, "sensitive console logging"]
];

const activeForbidden = [
  [/skip-server-cert-verify/i, "skip-server-cert-verify"],
  [/max-size\s*=\s*(?:0|-1)(?:\D|$)/i, "unbounded max-size"],
  [/\bamdc\b/i, "AMDC infrastructure"],
  [/httpdns/i, "HTTPDNS infrastructure"],
  [/appupdates?/i, "application update endpoint"],
  [/myOrderInfo|orderTrackBusiness/i, "order endpoint"],
  [/friendships\/(?:create|destroy)|direct_messages|messageflow/i, "social or message endpoint"],
  [/routeInfo|routePlan|\/car\/order|sharedtrip\/taxi/i, "route or ride-order endpoint"],
  [/\/(?:login|auth|token|device|iot|bind|unbind|payment|trade)(?:\/|\?|$)/i, "sensitive business endpoint"]
];

async function listFiles(dir, suffix) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath, suffix));
    else if (entry.name.endsWith(suffix)) files.push(fullPath);
  }
  return files.sort();
}

function relative(filePath) {
  return path.relative(root, filePath);
}

for (const filePath of await listFiles(path.join(root, "scripts"), ".js")) {
  const content = await readFile(filePath, "utf8");
  for (const [pattern, label] of scriptForbidden) {
    if (pattern.test(content)) errors.push(`${relative(filePath)}: forbidden script capability: ${label}`);
  }
}

const sourceModules = await listFiles(path.join(root, "modules"), ".sgmodule");
if (sourceModules.length === 0) errors.push("No source modules found.");

for (const filePath of sourceModules) {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  if (!lines.some((line) => line.trim().toLowerCase() === "#!system=ios")) {
    errors.push(`${relative(filePath)}: missing #!system=ios`);
  }

  const activeLines = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(";") && !line.startsWith("["));

  for (const line of activeLines) {
    for (const [pattern, label] of activeForbidden) {
      if (pattern.test(line)) errors.push(`${relative(filePath)}: forbidden ${label}: ${line}`);
    }

    if (/^hostname\s*=/i.test(line)) {
      const hosts = line
        .replace(/^hostname\s*=\s*/i, "")
        .replace(/^%APPEND%\s*/i, "")
        .split(",")
        .map((host) => host.trim());
      for (const host of hosts) {
        if (host.includes("*")) errors.push(`${relative(filePath)}: wildcard MITM hostname: ${host}`);
      }
    }

    const scriptPath = line.match(/script-path=([^,\s]+)/i)?.[1];
    if (
      scriptPath?.startsWith("http") &&
      !scriptPath.startsWith("https://raw.githubusercontent.com/mkdirmushroom/surge-ios-clean/")
    ) {
      errors.push(`${relative(filePath)}: external script-path: ${scriptPath}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Audit failed with ${errors.length} finding(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Audit passed: ${sourceModules.length} module(s), no runtime JavaScript.`);
}
