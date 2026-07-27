import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleDir = path.join(root, "modules", "candidate");
const surgeCli = process.env.SURGE_CLI || "/Applications/Surge.app/Contents/Applications/surge-cli";
const tempDir = await mkdtemp(path.join(os.tmpdir(), "surge-ios-clean-"));
const moduleNames = (await readdir(moduleDir))
  .filter((name) => name.endsWith(".sgmodule"))
  .sort();

function asCompleteProfile(content) {
  const lines = content.trimEnd().split(/\r?\n/);
  const ruleStart = lines.findIndex((line) => line.trim().toLowerCase() === "[rule]");

  if (ruleStart === -1) {
    lines.push("", "[Rule]", "FINAL,DIRECT");
    return `${lines.join("\n")}\n`;
  }

  let ruleEnd = lines.length;
  for (let index = ruleStart + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      ruleEnd = index;
      break;
    }
  }
  lines.splice(ruleEnd, 0, "FINAL,DIRECT", "");
  return `${lines.join("\n")}\n`;
}

let failed = false;
try {
  for (const name of moduleNames) {
    const source = await readFile(path.join(moduleDir, name), "utf8");
    const tempProfile = path.join(tempDir, `${name}.conf`);
    await writeFile(tempProfile, asCompleteProfile(source), "utf8");
    const result = spawnSync(surgeCli, ["--check", tempProfile], {
      cwd: root,
      encoding: "utf8"
    });

    if (result.status !== 0) {
      failed = true;
      console.error(`${name}: ${result.stdout || result.stderr}`.trim());
    } else {
      console.log(`${name}: OK`);
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
