#!/usr/bin/env node
// Phase 0 の材料の取得（docs/07 の2.1）: 本家 VS Code の zip（Windows x64）と VSCodium の zip（Windows x64 の最新）。
// 取って SHA-256 を公開の値と照らし、scripts/p0-expand.ps1 で展開する。
//
// 使い方:
//   node scripts/p0-fetch.mjs [--root C:/b/p0] [--vscode 1.146.0] [--vscodium <版>] [--no-expand] [--force]
//     --root      置き場所（既定 C:/b/p0）。zip は <root>/downloads/ に、展開は <root>/vscode-<版>/・<root>/vscodium-<版>/
//     --vscode    本家の版（既定 1.146.0。新しい安定版が出ていても変えない。最新は記録に書く）
//     --vscodium  VSCodium の版（既定は GitHub の最新のリリース）
//     --no-expand 展開しない
//     --force     展開先があっても消して展開し直す
// 出力: <root>/p0-fetch.json（版・URL・SHA-256・照合の結果・置き場所）

import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { download, getJson, getText, writeJson, USER_AGENT } from "./lib/http.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { root: "C:/b/p0", vscode: "1.146.0", vscodium: null, expand: true, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") args.root = argv[++i];
    else if (a === "--vscode") args.vscode = argv[++i];
    else if (a === "--vscodium") args.vscodium = argv[++i];
    else if (a === "--no-expand") args.expand = false;
    else if (a === "--force") args.force = true;
    else throw new Error(`知らない引数: ${a}`);
  }
  return args;
}

// 版を指す URL が、どこへ転送されるか（自動では追わず、Location を読む）。
async function redirectTarget(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "manual", headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, location: res.headers.get("location") };
}

async function fetchVscode(root, version) {
  const quality = "stable";
  const platform = "win32-x64-archive";
  const versionUrl = `https://update.code.visualstudio.com/${version}/${platform}/${quality}`;
  const apiUrl = `https://update.code.visualstudio.com/api/versions/${version}/${platform}/${quality}`;
  const api = await getJson(apiUrl);
  const releases = await getJson(`https://update.code.visualstudio.com/api/releases/${quality}`);
  const latest = await getJson(`https://update.code.visualstudio.com/api/update/${platform}/${quality}/latest`);
  const redirect = await redirectTarget(versionUrl);
  const fileName = decodeURIComponent(new URL(api.url).pathname.split("/").pop());
  const dest = path.join(root, "downloads", fileName);
  console.log(`[vscode] ${version} を取得: ${versionUrl}`);
  const got = await download(versionUrl, dest, { skipIfExists: true });
  const expected = String(api.sha256hash || "").toLowerCase();
  return {
    name: "vscode",
    version,
    commit: api.version,
    timestamp: api.timestamp ? new Date(api.timestamp).toISOString() : null,
    versionUrl,
    versionUrlRedirect: redirect,
    apiUrl,
    apiDownloadUrl: api.url,
    redirectMatchesApi: redirect.location === api.url,
    file: dest,
    bytes: got.bytes,
    sha256: got.sha256,
    sha256Published: expected,
    sha256Matches: got.sha256 === expected,
    latestStable: { version: latest.productVersion, commit: latest.version, list: releases.slice(0, 5) },
    extractTo: path.join(root, `vscode-${version}`),
  };
}

async function fetchVscodium(root, wanted) {
  const api = wanted
    ? await getJson(`https://api.github.com/repos/VSCodium/vscodium/releases/tags/${wanted}`)
    : await getJson("https://api.github.com/repos/VSCodium/vscodium/releases/latest");
  const version = api.tag_name;
  const zipName = `VSCodium-win32-x64-${version}.zip`;
  const zipAsset = api.assets.find((a) => a.name === zipName);
  const shaAsset = api.assets.find((a) => a.name === `${zipName}.sha256`);
  if (!zipAsset) throw new Error(`VSCodium ${version} に ${zipName} が無い`);
  const dest = path.join(root, "downloads", zipName);
  console.log(`[vscodium] ${version} を取得: ${zipAsset.browser_download_url}`);
  const got = await download(zipAsset.browser_download_url, dest, { skipIfExists: true });
  let sha256File = null;
  if (shaAsset) {
    const text = await getText(shaAsset.browser_download_url);
    sha256File = (text.trim().split(/\s+/)[0] || "").toLowerCase();
  }
  const digest = typeof zipAsset.digest === "string" && zipAsset.digest.startsWith("sha256:") ? zipAsset.digest.slice(7) : null;
  return {
    name: "vscodium",
    version,
    publishedAt: api.published_at,
    releaseUrl: api.html_url,
    download: zipAsset.browser_download_url,
    sha256Url: shaAsset ? shaAsset.browser_download_url : null,
    file: dest,
    bytes: got.bytes,
    sha256: got.sha256,
    sha256Published: sha256File,
    sha256Matches: sha256File === got.sha256,
    githubAssetDigest: digest,
    githubAssetDigestMatches: digest ? digest === got.sha256 : null,
    extractTo: path.join(root, `vscodium-${version}`),
  };
}

function expand(zip, dest, force) {
  const ps1 = path.join(SCRIPT_DIR, "p0-expand.ps1");
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Zip", zip, "-Dest", dest];
  if (force) args.push("-Force");
  const r = spawnSync("powershell.exe", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  await fs.promises.mkdir(path.join(root, "downloads"), { recursive: true });
  const result = { fetchedAt: new Date().toISOString(), root, items: [] };
  for (const job of [() => fetchVscode(root, args.vscode), () => fetchVscodium(root, args.vscodium)]) {
    const item = await job();
    const ok = item.sha256Matches;
    console.log(`[${item.name}] ${item.version} sha256=${item.sha256} 公開の値と${ok ? "一致" : "不一致"}`);
    if (ok && args.expand) item.expanded = expand(item.file, item.extractTo, args.force);
    else item.expanded = false;
    result.items.push(item);
  }
  await writeJson(path.join(root, "p0-fetch.json"), result);
  console.log(`記録: ${path.join(root, "p0-fetch.json")}`);
  if (result.items.some((i) => !i.sha256Matches || (args.expand && !i.expanded))) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
