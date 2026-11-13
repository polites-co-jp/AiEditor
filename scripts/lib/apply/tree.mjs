// 作業ツリーの読み書き。--dry-run のときは書き込みをメモリに持ち、実物を変えない。
// パスはリポジトリのルートからの相対（"/" 区切り）。

import fs from "node:fs";
import path from "node:path";
import { normalizeRelPath, isUnderPath } from "./units.mjs";

export function createTree(root, { dryRun = false } = {}) {
  const written = new Map(); // 相対パス → 中身（dry-run のとき）
  const deleted = []; // 消した相対パス（dry-run のとき）
  const abs = (rel) => {
    const n = normalizeRelPath(rel);
    if (!n) throw new Error(`相対パスでない: ${rel}`);
    return path.join(root, ...n.split("/"));
  };
  const isDeleted = (n) => deleted.some((d) => isUnderPath(n, d));

  return {
    root,
    dryRun,
    abs,
    exists(rel) {
      const n = normalizeRelPath(rel);
      if (!n) return false;
      if (written.has(n)) return true;
      if (isDeleted(n)) return false;
      return fs.existsSync(abs(n));
    },
    readText(rel) {
      const n = normalizeRelPath(rel);
      if (written.has(n)) return written.get(n);
      if (isDeleted(n)) throw new Error(`消したファイル: ${rel}`);
      return fs.readFileSync(abs(n), "utf8");
    },
    writeText(rel, text) {
      const n = normalizeRelPath(rel);
      if (dryRun) {
        written.set(n, text);
        return;
      }
      fs.mkdirSync(path.dirname(abs(n)), { recursive: true });
      fs.writeFileSync(abs(n), text);
    },
    remove(rel) {
      const n = normalizeRelPath(rel);
      if (dryRun) {
        deleted.push(n);
        for (const k of [...written.keys()]) if (isUnderPath(k, n)) written.delete(k);
        return;
      }
      fs.rmSync(abs(n), { recursive: true, force: true, maxRetries: 3 });
    },
  };
}

// dir（絶対パス）の下のファイルを順に返す（相対パスは root から）。skipDirs の名前のフォルダは下りない。
export function* walkFiles(root, relDir, { skipDirs = ["node_modules", ".git"] } = {}) {
  const start = path.join(root, ...relDir.split("/"));
  if (!fs.existsSync(start)) return;
  const st = fs.statSync(start);
  if (st.isFile()) {
    yield relDir;
    return;
  }
  const stack = [relDir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, ...d.split("/")), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const rel = `${d}/${e.name}`;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!skipDirs.includes(e.name)) stack.push(rel);
      } else if (e.isFile()) yield rel;
    }
  }
}

// 中身を文字列で探さないファイル（画像・フォント・実行ファイルなど）。
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".icns", ".bmp", ".webp", ".svgz",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".exe", ".dll", ".node", ".so", ".dylib", ".pdb", ".lib", ".obj",
  ".zip", ".gz", ".tgz", ".7z", ".vsix", ".wasm", ".mp3", ".mp4", ".wav", ".pdf",
]);
export const isTextLike = (rel) => !BINARY_EXT.has(path.extname(rel).toLowerCase());

// フォルダを丸ごと写す（dest は無ければ作る）。写したファイルの相対パス（src から）を返す。
// filter(相対パス, Dirent) が偽の項目は写さない（フォルダなら下りない）。dryRun なら写さずに一覧だけを返す。
export function copyTree(src, dest, { filter = () => true, dryRun = false } = {}) {
  const copied = [];
  const stack = [""];
  while (stack.length) {
    const rel = stack.pop();
    const from = path.join(src, rel);
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (!filter(r, e)) continue;
      if (e.isDirectory()) stack.push(r);
      else if (e.isFile()) {
        if (!dryRun) {
          const to = path.join(dest, ...r.split("/"));
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.copyFileSync(path.join(src, ...r.split("/")), to);
        }
        copied.push(r);
      }
    }
  }
  return copied.sort();
}
