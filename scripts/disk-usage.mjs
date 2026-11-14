#!/usr/bin/env node
// ディスクの使用量を数える（docs/07 の4節の3。作業ツリー・キャッシュ・出力）。読むだけで何も変えない。
//
// 使い方:
//   node scripts/disk-usage.mjs [--out <json>] [--drive <X:>] <name>=<dir> [<name>=<dir> ...]
//     <name>=<dir>  数える場所と、記録に書く名前。%LOCALAPPDATA% などの環境変数を展開する。無い場所は exists: false
//     --out         結果の JSON を書く場所（標準出力にも出す）
//     --drive       空きを数えるドライブ（既定 C:）
//
// 出力: { countedAt, seconds, drive: { root, freeBytes, freeGB }, entries: [{ name, path, exists, bytes, gb, files,
//         hardlinkedFiles, uniqueBytes }], uniqueTotal: { bytes, gb } }
//   bytes         その場所のファイルの大きさの和（シンボリックリンクとジャンクションはたどらない）
//   hardlinkedFiles  リンクの数（nlink）が 2 以上のファイルの数（pnpm の store からの hard link など）
//   uniqueBytes   その場所の中で、同じファイル（dev と ino が同じ）を1回だけ数えた和
//   uniqueTotal   全部の場所を通して、同じファイルを1回だけ数えた和（store と node_modules の重なりを除く）
// 終了コード: 0 = 数えた、2 = 引数の誤り
//
// 書き出している関数（テストの入口）: parseArgs, expandEnv, countDir

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class ArgError extends Error {}

export function expandEnv(s, env = process.env) {
  return String(s).replace(/%([^%]+)%/g, (m, name) => {
    const k = Object.keys(env).find((x) => x.toLowerCase() === name.toLowerCase());
    return k ? env[k] : m;
  });
}

export function parseArgs(argv, env = process.env) {
  const a = { out: null, drive: "C:", entries: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--out" || x === "--drive") {
      if (i + 1 >= argv.length || String(argv[i + 1]).startsWith("--")) throw new ArgError(`${x} に値が無い`);
      a[x.slice(2)] = argv[++i];
      continue;
    }
    if (x.startsWith("--")) throw new ArgError(`知らない引数: ${x}`);
    const m = /^([^=]+)=(.+)$/.exec(x);
    if (!m) throw new ArgError(`<name>=<dir> の形でない: ${x}`);
    a.entries.push({ name: m[1], path: path.resolve(expandEnv(m[2], env)) });
  }
  if (!a.entries.length) throw new ArgError("数える場所が無い（<name>=<dir>）");
  if (!/^[A-Za-z]:$/.test(a.drive)) throw new ArgError(`--drive の形が違う: ${a.drive}`);
  return a;
}

// seen: 全体で数えたファイルの集合（"dev:ino"）。null なら全体の重なりは数えない。
export function countDir(root, seen = null) {
  const local = new Set();
  let bytes = 0;
  let uniqueBytes = 0;
  let files = 0;
  let hardlinkedFiles = 0;
  let globalBytes = 0;
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!e.isFile()) continue;
      let st;
      try {
        st = fs.statSync(p, { bigint: true });
      } catch {
        continue;
      }
      const size = Number(st.size);
      bytes += size;
      files++;
      if (st.nlink > 1n) hardlinkedFiles++;
      const key = `${st.dev}:${st.ino}`;
      if (!local.has(key)) {
        local.add(key);
        uniqueBytes += size;
      }
      if (seen && !seen.has(key)) {
        seen.add(key);
        globalBytes += size;
      }
    }
  }
  return { bytes, gb: gb(bytes), files, hardlinkedFiles, uniqueBytes, uniqueGB: gb(uniqueBytes), globalBytes };
}

function gb(b) {
  return Math.round((b / 1024 ** 3) * 100) / 100;
}

function main() {
  let a;
  try {
    a = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[disk-usage] ${err.message}`);
    process.exit(2);
  }
  const t0 = Date.now();
  const seen = new Set();
  const entries = [];
  let total = 0;
  for (const e of a.entries) {
    if (!fs.existsSync(e.path)) {
      entries.push({ name: e.name, path: e.path, exists: false });
      continue;
    }
    const r = countDir(e.path, seen);
    total += r.globalBytes;
    const { globalBytes, ...rest } = r;
    entries.push({ name: e.name, path: e.path, exists: true, ...rest });
  }
  let drive = { root: `${a.drive}\\` };
  try {
    const s = fs.statfsSync(`${a.drive}\\`);
    const free = Number(s.bavail) * Number(s.bsize);
    drive = { root: `${a.drive}\\`, freeBytes: free, freeGB: gb(free) };
  } catch (err) {
    drive.error = err.message;
  }
  const out = { countedAt: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, drive, entries, uniqueTotal: { bytes: total, gb: gb(total) } };
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (a.out) {
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    fs.writeFileSync(a.out, text);
  }
  process.stdout.write(text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
