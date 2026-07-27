import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  return spawnSync(process.execPath, [path.join(root, "tools", script)], {
    cwd: root,
    encoding: "utf8"
  });
}

test("build is deterministic", async () => {
  const first = run("build.mjs");
  assert.equal(first.status, 0, first.stderr);
  const firstManifest = await readFile(path.join(root, "dist", "candidate", "manifest.json"), "utf8");

  const second = run("build.mjs");
  assert.equal(second.status, 0, second.stderr);
  const secondManifest = await readFile(path.join(root, "dist", "candidate", "manifest.json"), "utf8");
  assert.equal(secondManifest, firstManifest);
});

test("static audit passes", () => {
  const result = run("audit.mjs");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("candidate manifest matches generated modules", async () => {
  const manifestPath = path.join(root, "dist", "candidate", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = (await readdir(path.dirname(manifestPath)))
    .filter((name) => name.endsWith(".sgmodule"))
    .sort();

  assert.equal(manifest.compatibility.surgeIOS, "5.20.0");
  assert.equal(manifest.compatibility.iOS, "26.5.2");
  assert.deepEqual(manifest.modules.map((item) => item.name), files);
  assert.equal(files.length, 9);

  for (const item of manifest.modules) {
    const data = await readFile(path.join(path.dirname(manifestPath), item.name));
    const sha256 = createHash("sha256").update(data).digest("hex");
    assert.equal(item.sha256, sha256);
  }
});

test("stable channel is empty until canary approval", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "dist", "stable", "manifest.json"), "utf8")
  );
  assert.deepEqual(manifest.modules, []);
});
