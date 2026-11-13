// notion-sync のビルド（docs/02 の4.1、docs/05 の9節）。
//
//   pnpm --dir extensions-src/notion-sync run build            型検査 → dist/extension.js を1つにまとめる → 読み込みの確かめ
//   pnpm --dir extensions-src/notion-sync run build --no-check 型検査を飛ばす
//   pnpm --dir extensions-src/notion-sync run build --trial    上に加えて、差し替えた Notion API で同期の流れを試す（dev/trial.mts）
//
// 本体の道具（Build Tools・node-gyp）は使わない。依存の install スクリプトは走らせない（pnpm-workspace.yaml の allowBuilds）。

import { spawnSync } from "node:child_process";
import { createRequire, Module } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));

function step(name) {
  console.log(`[notion-sync] ${name}`);
}

function fail(message) {
  console.error(`[notion-sync] 失敗: ${message}`);
  process.exit(1);
}

// 1. 型検査（typescript の tsc。出力はしない）
if (!args.has("--no-check")) {
  step("型検査（tsc --noEmit）");
  const tsc = path.join(path.dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  const r = spawnSync(process.execPath, [tsc, "-p", path.join(HERE, "tsconfig.json")], { stdio: "inherit", cwd: HERE });
  if (r.status !== 0) fail(`型検査で誤り（終了コード ${r.status}）`);
}

// 2. esbuild で1ファイルにまとめる
step("dist/extension.js を作る（esbuild）");
const dist = path.join(HERE, "dist");
fs.rmSync(dist, { recursive: true, force: true });
const esbuild = await import("esbuild");
const result = await esbuild.build({
  entryPoints: [path.join(HERE, "src", "extension.mts")],
  outfile: path.join(dist, "extension.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  // 拡張ホストの Node.js（Electron 43）より古い版に合わせる
  target: "node22",
  external: ["vscode"],
  // jsonc-parser は main が UMD。ESM の側（module）を先に使う
  mainFields: ["module", "main"],
  minify: false,
  sourcemap: false,
  legalComments: "inline",
  logLevel: "warning",
  metafile: true,
});
if (result.errors.length) fail("esbuild の誤り");
const outBytes = fs.statSync(path.join(dist, "extension.js")).size;
const inputs = Object.keys(result.metafile.inputs);
console.log(`  dist/extension.js ${outBytes} バイト、入力 ${inputs.length} 個`);
for (const i of inputs) console.log(`    ${i}`);

// 3. 読み込みの確かめ（vscode を空の代わりに差し替えて require し、activate・deactivate があるか）
step("dist/extension.js を読み込んで確かめる");
{
  const origResolve = Module._resolveFilename;
  const stubPath = path.join(HERE, "dist", "__vscode_stub__.js");
  Module._resolveFilename = function (request, ...rest) {
    if (request === "vscode") return stubPath;
    return origResolve.call(this, request, ...rest);
  };
  require.cache[stubPath] = { id: stubPath, filename: stubPath, loaded: true, exports: {} };
  try {
    const ext = require(path.join(dist, "extension.js"));
    if (typeof ext.activate !== "function" || typeof ext.deactivate !== "function") fail("activate・deactivate が出ていない");
    console.log("  activate・deactivate がある");
  } finally {
    Module._resolveFilename = origResolve;
    delete require.cache[stubPath];
  }
}

// 4. 試し（差し替えた Notion API で同期の流れを動かす。本物の Notion には書かない）
if (args.has("--trial")) {
  step("試し（dev/trial.mts）");
  const trial = await import(pathToFileURL(path.join(HERE, "dev", "trial.mts")).href);
  const ok = await trial.main();
  if (!ok) fail("試しで期待と違う結果があった");
}

step("完了");
