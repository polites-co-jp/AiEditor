#!/usr/bin/env node
// 拡張の2つの版の差（docs/04 の4節の5・6）: manifest（package.json）の見る項目の変化と、VSIX のファイルの一覧の差。
// lock-verify.mjs が版ごとの置き場所に書いた files.json と、lock-fetch.mjs が取った package.json を読む。
// JS の中身は開かない（ファイルの名前とサイズ、package.json だけを見る）。
//
// 使い方: node scripts/lock-diff.mjs --from <前の版の置き場所> --to <新しい版の置き場所> [--json]
//   置き場所の例: C:/b/cache/vsix/anthropic.claude-code-2.1.322@win32-x64
// 出力: 変わった manifest の項目、増えた・消えた・サイズが変わったファイル、新しい実行ファイル（.exe・.dll・.node）。
// 終わりの状態: manifest の見る項目が変わったか、新しい実行ファイルがあれば 2（目立たせるため）、無ければ 0。

import path from "node:path";
import fs from "node:fs";
import { compareFileLists, diffManifest } from "./lib/lock.mjs";

function parseArgs(argv) {
  const args = { from: null, to: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") args.from = argv[++i];
    else if (a === "--to") args.to = argv[++i];
    else if (a === "--json") args.json = true;
    else throw new Error(`知らない引数: ${a}`);
  }
  if (!args.from || !args.to) throw new Error("--from と --to を指定する");
  return args;
}

function readJson(dir, name) {
  const file = path.join(path.resolve(dir), name);
  if (!fs.existsSync(file)) throw new Error(`${file} が無い（lock-fetch.mjs と lock-verify.mjs を先に走らせる）`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestChanged = diffManifest(readJson(args.from, "package.json"), readJson(args.to, "package.json"));
  const files = compareFileLists(readJson(args.from, "files.json"), readJson(args.to, "files.json"));
  const out = { from: path.resolve(args.from), to: path.resolve(args.to), manifestChanged, ...files };
  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`manifest の見る項目の変化: ${manifestChanged.length ? manifestChanged.join(", ") : "なし"}`);
    console.log(`ファイル: 増えた ${files.added.length}、消えた ${files.removed.length}、サイズが変わった ${files.changed.length}`);
    for (const e of files.newExecutables) console.log(`  新しい実行ファイル: ${e.path}（${e.size} バイト）`);
    for (const e of files.changed.filter((c) => Math.abs(c.nextSize - c.prevSize) >= 1024 * 1024)) {
      console.log(`  大きな変化: ${e.path} ${e.prevSize} → ${e.nextSize}`);
    }
  }
  process.exitCode = manifestChanged.length || files.newExecutables.length ? 2 : 0;
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
