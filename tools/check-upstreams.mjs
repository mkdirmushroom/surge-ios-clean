import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "provenance", "sources.json");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? path.resolve(root, process.argv[outputIndex + 1]) : null;
const provenance = JSON.parse(await readFile(sourcePath, "utf8"));
const token = process.env.GITHUB_TOKEN;
const results = [];

for (const source of provenance.sources.filter((item) => item.expectedCommit)) {
  const url = `https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(source.ref)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "surge-ios-clean-upstream-watch",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data = await response.json();
    results.push({
      repository: source.repository,
      ref: source.ref,
      expectedCommit: source.expectedCommit,
      currentCommit: data.sha,
      changed: data.sha !== source.expectedCommit
    });
  } catch (error) {
    results.push({
      repository: source.repository,
      ref: source.ref,
      expectedCommit: source.expectedCommit,
      error: error.message,
      changed: false
    });
  }
}

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  changed: results.some((item) => item.changed),
  failed: results.some((item) => item.error),
  results
};

if (outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${report.changed}\nfailed=${report.failed}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
