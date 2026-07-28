import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateSource = path.join(root, "modules", "candidate");
const releaseConfigPath = path.join(root, "release", "stable.json");
const distRoot = path.join(root, "dist");

const moduleNames = (await readdir(candidateSource))
  .filter((name) => name.endsWith(".sgmodule"))
  .sort();

const releaseConfig = JSON.parse(await readFile(releaseConfigPath, "utf8"));
const stableNames = [...releaseConfig.modules].sort();
const unknownStable = stableNames.filter((name) => !moduleNames.includes(name));

if (unknownStable.length > 0) {
  throw new Error(`Stable release references unknown modules: ${unknownStable.join(", ")}`);
}

async function hashFile(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function buildChannel(channel, names) {
  const channelDir = path.join(distRoot, channel);
  await rm(channelDir, { recursive: true, force: true });
  await mkdir(channelDir, { recursive: true });

  const modules = [];
  for (const name of names) {
    const sourcePath = path.join(candidateSource, name);
    const targetPath = path.join(channelDir, name);
    await copyFile(sourcePath, targetPath);
    modules.push({
      name,
      sha256: await hashFile(targetPath)
    });
  }

  const manifest = {
    schemaVersion: 1,
    channel,
    compatibility: {
      surgeIOS: "5.20.0",
      iOS: "26.5.2"
    },
    modules
  };

  await writeFile(
    path.join(channelDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

await mkdir(distRoot, { recursive: true });
await buildChannel("candidate", moduleNames);
await buildChannel("stable", stableNames);

console.log(`Built ${moduleNames.length} candidate module(s) and ${stableNames.length} stable module(s).`);
