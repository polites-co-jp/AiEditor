#!/usr/bin/env node
// ビルドの作業場所を移す前の調べ（裁定 2026-11-15「C: に置かない」。tasks/2026-11-15-move-off-c/）。読むだけで何も変えない。
//
//   1. 今の作業場所（--from。必須）の直下と2段目の大きさ（同じファイルは全体で1回だけ数える。pnpm の hard link のため）
//   2. ビルドが使う C: のキャッシュの大きさ（%LOCALAPPDATA%\pnpm など。無い所は exists: false）
//   3. パスの長さ: 木の中のいちばん長いパスと、置き場所を --to に変えたときに 259 文字（ファイル）・247 文字（フォルダ）を
//      超えるものの数（Win32 の MAX_PATH は終端を含めて 260。CreateDirectory は 248 未満）
//   4. 長いパスの設定（LongPathsEnabled のレジストリ、git の core.longpaths）と、キャッシュに関わる環境変数・pnpm の設定
//   5. --to の形（長さ・空白・ASCII 以外・ドライブの空き）
//   6. 常設の clone とこのリポジトリの git worktree の一覧（場所・HEAD・枝）
//
// 使い方:
//   node scripts/move-survey.mjs --from <dir> [--to <dir>] [--out <json>] [--no-sizes] [--no-caches] [--only <name>,...]
//     --from      今の作業場所（必須。2026-11-15 の調べでは C: の古い作業場所を渡した）
//     --to        移す先（既定 local-config の DEFAULT_BUILD_ROOT ＝ <このリポジトリ>\tmp\b）
//     --out       結果の JSON（標準出力にも出す）
//     --no-sizes  大きさとパスの長さを数えない（設定と worktree の一覧だけ。速い）
//     --no-caches キャッシュを数えない
//     --only      --from の直下のうち、数える名前（カンマ区切り。既定は全部）
// 終了コード: 0 = 調べた、2 = 引数の誤り
//
// 書き出している関数（テストの入口）: parseArgs, pathShape, lengthAfterMove, CACHE_CANDIDATES, expandCandidate, surveyTree

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig, DEFAULT_BUILD_ROOT } from "./lib/local-config.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

// 読み取りの中身: C: の上で触るのは stat と readdir と、reg.exe query・git config --get・git worktree list・
// git branch --contains・git tag --contains・pnpm --version・pnpm store path・npm config get cache だけ（どれも書き込まない）。

export class ArgError extends Error {}

export const FILE_LIMIT = 259;
export const DIR_LIMIT = 247;

export function parseArgs(argv) {
  const a = { from: null, to: DEFAULT_BUILD_ROOT, out: null, sizes: true, caches: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const need = () => {
      if (i + 1 >= argv.length || String(argv[i + 1]).startsWith("--")) throw new ArgError(`${x} に値が無い`);
      return argv[++i];
    };
    if (x === "--from") a.from = need();
    else if (x === "--to") a.to = need();
    else if (x === "--out") a.out = need();
    else if (x === "--no-sizes") a.sizes = false;
    else if (x === "--no-caches") a.caches = false;
    else if (x === "--only") a.only = need().split(",").map((s) => s.trim()).filter(Boolean);
    else throw new ArgError(`知らない引数: ${x}`);
  }
  if (!a.from) throw new ArgError("--from（今の作業場所）が無い");
  for (const k of ["from", "to"]) {
    if (!/^[A-Za-z]:[\\/]/.test(a[k])) throw new ArgError(`--${k} がドライブ文字の絶対パスでない: ${a[k]}`);
    a[k] = path.win32.normalize(a[k]).replace(/[\\/]+$/, "");
  }
  return a;
}

// 置き場所の形（本家の条件: 空白と ASCII 以外を入れない。docs/02 の2節）。
export function pathShape(p) {
  const s = String(p);
  return {
    path: s,
    length: s.length,
    hasSpace: /\s/.test(s),
    nonAscii: /[^\x20-\x7e]/.test(s),
    drive: /^[A-Za-z]:/.test(s) ? s.slice(0, 2).toUpperCase() : null,
  };
}

// from の下のパス p を to の下へ移したときの長さ。
export function lengthAfterMove(p, from, to) {
  return String(p).length - String(from).length + String(to).length;
}

// ビルドが使いうる C: のキャッシュ。owner: build = このプロジェクトのビルドが作ったと言えるもの、
// shared = ほかの用途と共用（中身から切り分けられない）。how = 子の環境で向け先を変える方法（調べた事実）。
// base は環境変数の名前、sub はその下の区切り。
export const CACHE_CANDIDATES = Object.freeze([
  { name: "pnpm-store", base: "LOCALAPPDATA", sub: ["pnpm", "store"], owner: "shared", how: "pnpm_config_store_dir（pnpm 11 以降は pnpm_config_* だけを読む）" },
  { name: "pnpm-cache", base: "LOCALAPPDATA", sub: ["pnpm-cache"], owner: "shared", how: "pnpm_config_cache_dir" },
  { name: "pnpm-state", base: "LOCALAPPDATA", sub: ["pnpm-state"], owner: "shared", how: "LOCALAPPDATA（既定は <LOCALAPPDATA>\\pnpm-state）" },
  { name: "pnpm-home", base: "LOCALAPPDATA", sub: ["pnpm"], owner: "shared", how: "（store の親。pnpm の本体や global の置き場を含むことがある）" },
  { name: "electron-cache", base: "LOCALAPPDATA", sub: ["electron", "Cache"], owner: "shared", how: "@electron/get 5.0.0 は env-paths の LOCALAPPDATA だけを見る（専用の環境変数は無い）" },
  { name: "electron-builder", base: "LOCALAPPDATA", sub: ["electron-builder"], owner: "shared", how: "本家のビルドは使わない（ELECTRON_BUILDER_CACHE）" },
  { name: "node-gyp", base: "LOCALAPPDATA", sub: ["node-gyp"], owner: "shared", how: "本家の build/npm/nodeGypHeaders.ts が <LOCALAPPDATA>\\node-gyp\\Cache を決め打ちで読む" },
  { name: "npm-cache", base: "LOCALAPPDATA", sub: ["npm-cache"], owner: "shared", how: "npm_config_cache" },
  { name: "ms-playwright", base: "LOCALAPPDATA", sub: ["ms-playwright"], owner: "shared", how: "PLAYWRIGHT_BROWSERS_PATH（LOCALAPPDATA を向ければ付いてくる）" },
  { name: "corepack", base: "LOCALAPPDATA", sub: ["node", "corepack"], owner: "shared", how: "COREPACK_HOME" },
  { name: "electron-gyp", base: "USERPROFILE", sub: [".electron-gyp"], owner: "shared", how: "@electron/rebuild などの既定（本家の 1.146.0 は使わない見込み）" },
  { name: "node-gyp-home", base: "USERPROFILE", sub: [".node-gyp"], owner: "shared", how: "古い node-gyp の既定" },
  { name: "shuko-dotdir", base: "USERPROFILE", sub: [".shuko"], owner: "build", how: "手順書の試しで漏れた拡張（ユーザーが消す）" },
  { name: "shuko-appdata", base: "APPDATA", sub: ["Shuko"], owner: "build", how: "手順書の試しのログ（ユーザーが消す）" },
  { name: "os-temp", base: "TEMP", sub: [], owner: "shared", how: "TEMP/TMP（全体の大きさ。ビルドの分だけは切り分けられない）" },
  { name: "shuko-local", base: "LOCALAPPDATA", sub: ["Shuko"], owner: "build", how: "local.json と検知の状態・秘密（docs/06 の2.4。移さない）" },
  { name: "shuko-install", base: "LOCALAPPDATA", sub: ["Programs", "Shuko"], owner: "daily", how: "普段使いのエディタの版のフォルダ（installRoot。対象外）" },
]);

export function expandCandidate(c, env = process.env) {
  const k = Object.keys(env).find((x) => x.toLowerCase() === String(c.base).toLowerCase());
  if (!k || !env[k]) return { path: null, missing: c.base };
  return { path: path.win32.join(env[k], ...(c.sub || [])), missing: null };
}

// 木を1回たどって、大きさ（全体の seen で重なりを除いた分も）と、パスの長さを数える。
//   seen: 全体で数えたファイルの集合（"dev:ino"）。lengths: { from, to } を渡すと、移した後の長さで数える。
export function surveyTree(root, { seen = new Set(), lengths = null, sample = 5 } = {}) {
  const r = { bytes: 0, files: 0, dirs: 0, hardlinkedFiles: 0, globalBytes: 0, longestFile: null, longestDir: null, overFile: 0, overDir: 0, overFileSamples: [], overDirSamples: [], unreadable: 0, linkCount: 0, links: [] };
  const len = (p) => (lengths ? lengthAfterMove(p, lengths.from, lengths.to) : p.length);
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      r.unreadable++;
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) {
        // ジャンクションとシンボリックリンク（たどらない）。移すと切れ、消すときに先をたどる道具があるので一覧に残す
        let target = null;
        try {
          target = fs.readlinkSync(p);
        } catch {}
        r.linkCount++;
        if (r.links.length < 50) r.links.push({ path: p, target });
        continue;
      }
      if (e.isDirectory()) {
        r.dirs++;
        const L = len(p);
        if (!r.longestDir || p.length > r.longestDir.length) r.longestDir = { path: p, length: p.length, after: L };
        if (L > DIR_LIMIT) {
          r.overDir++;
          if (r.overDirSamples.length < sample) r.overDirSamples.push(p);
        }
        stack.push(p);
        continue;
      }
      if (!e.isFile()) continue;
      const L = len(p);
      if (!r.longestFile || p.length > r.longestFile.length) r.longestFile = { path: p, length: p.length, after: L };
      if (L > FILE_LIMIT) {
        r.overFile++;
        if (r.overFileSamples.length < sample) r.overFileSamples.push(p);
      }
      let st;
      try {
        st = fs.statSync(p, { bigint: true });
      } catch {
        r.unreadable++;
        continue;
      }
      const size = Number(st.size);
      r.bytes += size;
      r.files++;
      if (st.nlink > 1n) r.hardlinkedFiles++;
      const key = `${st.dev}:${st.ino}`;
      if (!seen.has(key)) {
        seen.add(key);
        r.globalBytes += size;
      }
    }
  }
  r.gb = gb(r.bytes);
  r.globalGB = gb(r.globalBytes);
  return r;
}

function gb(b) {
  return Math.round((b / 1024 ** 3) * 100) / 100;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...opts });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), error: r.error ? r.error.message : null };
}

function regValue(key, name) {
  const r = run("reg.exe", ["query", key, "/v", name]);
  if (r.status !== 0) return { key, name, found: false, raw: r.stderr || r.stdout };
  const m = new RegExp(`${name}\\s+(REG_\\w+)\\s+(\\S+)`, "i").exec(r.stdout);
  return { key, name, found: !!m, type: m ? m[1] : null, value: m ? m[2] : null };
}

// 値が秘密になりうる名前（TOKEN・KEY・SECRET・PASSWORD・AUTH を含む）は名前だけ残す。
function cacheEnv(env = process.env) {
  const pick = /^(TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|HOME|PNPM_HOME|XDG_\w+|COREPACK_HOME|PLAYWRIGHT_BROWSERS_PATH|ELECTRON_\w+|electron_config_\w+|npm_config_\w+|pnpm_config_\w+|NODE_OPTIONS|PYTHON)$/i;
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (!pick.test(k)) continue;
    out[k] = /TOKEN|KEY|SECRET|PASSWORD|AUTH/i.test(k) ? "<値は書かない>" : v;
  }
  return out;
}

function worktreeList(repo) {
  const r = run("git", ["-C", repo, "worktree", "list", "--porcelain"]);
  if (r.status !== 0) return { repo, error: r.stderr || r.error };
  const items = [];
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      cur = { path: line.slice(9) };
      items.push(cur);
    } else if (cur && line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7);
    else if (cur && line === "detached") cur.detached = true;
    else if (cur && line === "bare") cur.bare = true;
    else if (cur && line.startsWith("prunable")) cur.prunable = line.slice(8).trim() || true;
    else if (cur && line.startsWith("locked")) cur.locked = line.slice(6).trim() || true;
  }
  // 枝からたどれない HEAD（作業ツリーを消すと reflog ごと消え、gc の対象になる）
  for (const w of items) {
    if (!w.head || w.bare) continue;
    const c = run("git", ["-C", repo, "branch", "--all", "--contains", w.head, "--format=%(refname)"]);
    const t = run("git", ["-C", repo, "tag", "--contains", w.head]);
    const refs = c.status === 0 ? c.stdout.split(/\r?\n/).filter(Boolean) : null;
    const tags = t.status === 0 ? t.stdout.split(/\r?\n/).filter(Boolean) : null;
    w.reachableFrom = { branches: refs ? refs.length : null, tags: tags ? tags.length : null, sampleBranches: refs ? refs.slice(0, 3) : null };
    w.reachable = (refs && refs.length > 0) || (tags && tags.length > 0);
  }
  return { repo, items };
}

function main() {
  let a;
  try {
    a = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[move-survey] ${err.message}`);
    process.exit(2);
  }
  const t0 = Date.now();
  const out = { countedAt: new Date().toISOString(), from: a.from, to: pathShape(a.to), delta: a.to.length - a.from.length, limits: { file: FILE_LIMIT, dir: DIR_LIMIT } };

  // local.json（読むだけ。値と出どころ）
  try {
    const c = resolveLocalConfig();
    out.localConfig = { configPath: c.configPath, configExists: c.configExists, buildRoot: c.buildRoot, installRoot: c.installRoot, builderRepo: c.builderRepo, sources: c.sources };
  } catch (err) {
    out.localConfig = { error: err.message };
  }

  // 長いパスの設定
  out.longPaths = {
    registry: regValue("HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", "LongPathsEnabled"),
    gitCoreLongpaths: run("git", ["config", "--show-origin", "--get-all", "core.longpaths"]),
    gitVersion: run("git", ["--version"]).stdout,
    nodeVersion: process.version,
  };
  out.tools = {
    pnpmVersion: run("pnpm --version", [], { shell: true }),
    pnpmStorePathAtTo: fs.existsSync(path.dirname(a.to)) ? run("pnpm store path", [], { shell: true, cwd: path.dirname(a.to) }) : null,
    pnpmStorePathAtFrom: fs.existsSync(a.from) ? run("pnpm store path", [], { shell: true, cwd: a.from }) : null,
    npmCache: run("npm config get cache", [], { shell: true }),
    pnpmGlobalConfig: (() => {
      const la = process.env.LOCALAPPDATA;
      const p = la ? path.join(la, "pnpm", "config", "rc") : null;
      return { path: p, exists: p ? fs.existsSync(p) : false };
    })(),
    userNpmrc: (() => {
      const h = process.env.USERPROFILE;
      const p = h ? path.join(h, ".npmrc") : null;
      return { path: p, exists: p ? fs.existsSync(p) : false };
    })(),
  };
  out.env = cacheEnv();

  // 移す先のドライブの空き
  try {
    const s = fs.statfsSync(`${out.to.drive}\\`);
    out.to.freeGB = gb(Number(s.bavail) * Number(s.bsize));
  } catch (err) {
    out.to.freeError = err.message;
  }
  try {
    const s = fs.statfsSync("C:\\");
    out.cFreeGB = gb(Number(s.bavail) * Number(s.bsize));
  } catch {}
  out.toExists = fs.existsSync(a.to);
  out.repoTmpExists = fs.existsSync(path.join(REPO, "tmp"));

  // git worktree の一覧
  out.worktrees = {
    clone: fs.existsSync(path.join(a.from, "vscode")) ? worktreeList(path.join(a.from, "vscode")) : null,
    builderRepo: worktreeList(REPO),
  };

  const seen = new Set();
  if (a.sizes && fs.existsSync(a.from)) {
    out.tree = [];
    const top = fs.readdirSync(a.from, { withFileTypes: true });
    for (const e of top) {
      if (a.only && !a.only.includes(e.name)) continue;
      const p = path.join(a.from, e.name);
      if (e.isSymbolicLink()) {
        let target = null;
        try {
          target = fs.readlinkSync(p);
        } catch {}
        out.tree.push({ name: e.name, path: p, link: true, target });
        continue;
      }
      if (!e.isDirectory()) {
        let st = null;
        try {
          st = fs.statSync(p);
        } catch {}
        out.tree.push({ name: e.name, path: p, file: true, bytes: st ? st.size : null, after: lengthAfterMove(p, a.from, a.to) });
        continue;
      }
      // 2段目ごとに数える（どれを移し、どれを消すかを決めるため）
      const entry = { name: e.name, path: p, children: [] };
      let kids = [];
      try {
        kids = fs.readdirSync(p, { withFileTypes: true });
      } catch {}
      const lengths = { from: a.from, to: a.to };
      const tot = { bytes: 0, globalBytes: 0, files: 0, overFile: 0, overDir: 0, longestFile: null, linkCount: 0 };
      for (const k of kids) {
        const kp = path.join(p, k.name);
        if (k.isSymbolicLink()) {
          let target = null;
          try {
            target = fs.readlinkSync(kp);
          } catch {}
          entry.children.push({ name: k.name, link: true, target });
          continue;
        }
        if (!k.isDirectory()) {
          let st = null;
          try {
            st = fs.statSync(kp);
          } catch {}
          const sz = st ? st.size : 0;
          tot.bytes += sz;
          tot.globalBytes += sz;
          tot.files++;
          entry.children.push({ name: k.name, file: true, bytes: sz, mtime: st ? st.mtime.toISOString() : null });
          continue;
        }
        const s = surveyTree(kp, { seen, lengths });
        let mtime = null;
        try {
          mtime = fs.statSync(kp).mtime.toISOString();
        } catch {}
        entry.children.push({ name: k.name, gb: s.gb, globalGB: s.globalGB, files: s.files, hardlinkedFiles: s.hardlinkedFiles, mtime, longestFile: s.longestFile, overFile: s.overFile, overDir: s.overDir, overFileSamples: s.overFileSamples, overDirSamples: s.overDirSamples, linkCount: s.linkCount, links: s.links });
        tot.bytes += s.bytes;
        tot.globalBytes += s.globalBytes;
        tot.files += s.files;
        tot.overFile += s.overFile;
        tot.overDir += s.overDir;
        tot.linkCount += s.linkCount;
        if (s.longestFile && (!tot.longestFile || s.longestFile.length > tot.longestFile.length)) tot.longestFile = s.longestFile;
      }
      Object.assign(entry, { gb: gb(tot.bytes), globalGB: gb(tot.globalBytes), files: tot.files, overFile: tot.overFile, overDir: tot.overDir, longestFile: tot.longestFile, linkCount: tot.linkCount + entry.children.filter((c) => c.link).length });
      out.tree.push(entry);
      process.stderr.write(`[move-survey] ${p}: ${entry.gb} GB（重なりを除いて ${entry.globalGB} GB）\n`);
    }
  }

  if (a.sizes && a.caches) {
    out.caches = [];
    for (const c of CACHE_CANDIDATES) {
      const x = expandCandidate(c);
      const base = { name: c.name, dir: `<${c.base}>${c.sub.length ? `\\${c.sub.join("\\")}` : ""}`, path: x.path, owner: c.owner, how: c.how };
      if (x.missing) {
        out.caches.push({ ...base, exists: false, note: `環境変数 ${x.missing} が無い` });
        continue;
      }
      if (!fs.existsSync(x.path)) {
        out.caches.push({ ...base, exists: false });
        continue;
      }
      // 大きさだけ（store と作業ツリーの重なりも seen で分かる。globalGB は木で数えなかった分）
      const s = surveyTree(x.path, { seen });
      out.caches.push({ ...base, exists: true, gb: s.gb, globalGB: s.globalGB, files: s.files, hardlinkedFiles: s.hardlinkedFiles, unreadable: s.unreadable });
      process.stderr.write(`[move-survey] ${x.path}: ${s.gb} GB\n`);
    }
  }

  out.seconds = (Date.now() - t0) / 1000;
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (a.out) {
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    fs.writeFileSync(a.out, text);
  }
  process.stdout.write(text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
