#!/usr/bin/env node
// ビルドの作業場所を移す（写すだけ）。裁定 2026-11-15「C: に置かない」「ビルドの置き場所と Phase 0 の残り」。
// 段取り: tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md の「2回目」の節。
//
// この台本は**写すだけで、何も消さない**。元（--from）には書かない。写し先にあるファイルを上書きしない。
// 消すのは、写した後の確かめが済んでから、許可の中で `rm -rf` の形で行う（この台本の外。チームの決まり）。
//
// 使い方:
//   node scripts/move-build-root.mjs --from <古い作業場所> [--to <新しい作業場所>] [--dry-run] [--out <json>] [--only <名前>,...]
//     --from     古い作業場所（必須。2026-11-15 の段取りでは C: の古い作業場所）
//     --to       新しい作業場所（既定 local.json の buildRoot、無ければ <リポジトリ>\tmp\b）
//     --dry-run  何も写さない。計画（項目ごとのファイルの数・大きさ・写し先の有無・長すぎるパス・前提）を出す
//     --out      結果の JSON を書く場所（標準出力にも出す）
//     --only     PLAN の name のうち、扱うもの（カンマ区切り）
// 終了コード: 0 = すべての項目が ok（dry-run では問題なし）、1 = 問題のある項目がある、2 = 引数の誤り
//
// 項目の種類（PLAN の kind）:
//   dir      フォルダをまるごと写す（リンク・ジャンクションがあれば写さずに止める）
//   git      常設の clone。dir と同じに写し、前に「付いている作業ツリーが無い」こと、後に refs がすべて同じこと・作業ツリーが
//            main だけであることを git で確かめる
//   file     1つのファイル
//   files    フォルダの直下のファイルのうち、pattern に合うものだけ
//   results  フォルダの直下の各フォルダ（スモークの実行など）の、直下のファイルだけ（user\・ws\・logs\ などの下は写さない）
// どの種類も、写し先のパスが 259 文字（フォルダは 247 文字）を超えるものがあれば、その項目を写さない（LongPathsEnabled が無効）。
// 照らし方（2026-11-16。裁定「数と大きさと SHA-256 を照らす」を全部の項目にかける。写した後に古い作業場所を消すため）:
//   どの種類も、写す全部のファイルが写し先にあり、大きさと SHA-256 が元と同じこと。かかった時間を項目ごとに記録に出す
//   （seconds = 写した時間、verifySeconds = 照らした時間、existing.seconds = 前からあった写し先を照らした時間）。
// 写し先が既にあるとき（2回目・途中で止まった後）は上書きしない。写し先のファイルを1つずつ元と照らし、
//   全部が同じ（大きさと SHA-256）なら already。
//   違うものが1つでもあれば problem（何も写さない。違うファイルを problems と existing.differentFiles に出す）。
//   違うものが無く、無いものだけがあれば、無いものだけを COPYFILE_EXCL で写して続ける（続きから写す。状態は copied で、
//   existing.same に飛ばした数が出る）。dry-run では写さずに planned と existing を出す。
//
// 書き出している関数（テストの入口）: PLAN, parseArgs, planItem, selectFiles, compareExisting, verifySame, FILE_LIMIT, DIR_LIMIT

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";

export const FILE_LIMIT = 259;
export const DIR_LIMIT = 247;

// 写すもの（tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md の「2回目」の表）。src・dst は作業場所からの相対。
// Phase 0 のデータ（p0\data・testbed・vscodium・vsix・sublime・netlog など）は写さない（裁定: 消す）。公式の zip とその展開だけを
// official\ へ、計測が読む ws-info.json を measure\ へ写す。
export const PLAN = Object.freeze([
  { name: "clone", kind: "git", src: "vscode", dst: "vscode" },
  { name: "dist-p2-all", kind: "file", src: "dist/1.146.0-p2-all.zip", dst: "dist/1.146.0-p2-all.zip" },
  { name: "dist-p1-a1-r3", kind: "file", src: "dist/1.146.0-p1-a1-r3.zip", dst: "dist/1.146.0-p1-a1-r3.zip" },
  { name: "p2-all", kind: "dir", src: "p2/1.146.0-p2-all", dst: "p2/1.146.0-p2-all" },
  { name: "p1-a1-r3", kind: "dir", src: "p1/1.146.0-p1-a1-r3", dst: "p1/1.146.0-p1-a1-r3" },
  { name: "smoke-ext", kind: "dir", src: "smoke/ext", dst: "smoke/ext" },
  { name: "smoke-baselines", kind: "files", src: "smoke", dst: "smoke", pattern: "^baseline-.+\\.json$" },
  { name: "smoke-runs", kind: "results", src: "smoke/runs", dst: "smoke/archive/runs" },
  { name: "smoke-absent", kind: "results", src: "smoke/absent", dst: "smoke/archive/absent" },
  { name: "vsix-cache", kind: "dir", src: "cache/vsix", dst: "cache/vsix" },
  { name: "logs", kind: "dir", src: "logs", dst: "logs" },
  { name: "work-b", kind: "dir", src: "work-b", dst: "work-b" },
  { name: "official-1.146.0", kind: "dir", src: "p0/vscode-1.146.0", dst: "official/vscode-1.146.0" },
  { name: "official-zip", kind: "file", src: "p0/downloads/VSCode-win32-x64-1.146.0.zip", dst: "official/downloads/VSCode-win32-x64-1.146.0.zip" },
  { name: "official-fetch-record", kind: "file", src: "p0/p0-fetch.json", dst: "official/downloads/p0-fetch.json" },
  { name: "ws-info", kind: "file", src: "p0/ws-info.json", dst: "measure/ws-info.json" },
]);

const KINDS = ["dir", "git", "file", "files", "results"];

export class ArgError extends Error {}

export function parseArgs(argv) {
  const a = { from: null, to: null, dryRun: false, out: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const need = () => {
      if (i + 1 >= argv.length || String(argv[i + 1]).startsWith("--")) throw new ArgError(`${x} に値が無い`);
      return argv[++i];
    };
    if (x === "--from") a.from = need();
    else if (x === "--to") a.to = need();
    else if (x === "--dry-run") a.dryRun = true;
    else if (x === "--out") a.out = need();
    else if (x === "--only") a.only = need().split(",").map((s) => s.trim()).filter(Boolean);
    else throw new ArgError(`知らない引数: ${x}`);
  }
  if (!a.from) throw new ArgError("--from（古い作業場所）が無い");
  for (const k of ["from", "to"]) {
    if (a[k] === null) continue;
    if (!/^[A-Za-z]:[\\/]/.test(a[k])) throw new ArgError(`--${k} がドライブ文字の絶対パスでない: ${a[k]}`);
    a[k] = path.win32.normalize(a[k]).replace(/[\\/]+$/, "");
  }
  if (a.only) {
    const unknown = a.only.filter((n) => !PLAN.some((p) => p.name === n));
    if (unknown.length) throw new ArgError(`PLAN に無い名前: ${unknown.join(", ")}`);
  }
  return a;
}

function inside(child, parent) {
  const c = child.toLowerCase();
  const p = parent.toLowerCase().replace(/\\+$/, "");
  return c === p || c.startsWith(`${p}\\`);
}

// 写すファイルの一覧 [{ rel, size, src, dst }] と、写さずに止める理由（リンク）・長すぎるパス。読むだけ。
export function selectFiles(item, from, to) {
  const srcRoot = path.win32.join(from, ...item.src.split("/"));
  const dstRoot = path.win32.join(to, ...item.dst.split("/"));
  const out = { srcRoot, dstRoot, exists: fs.existsSync(srcRoot), files: [], dirs: [], links: [], tooLong: [], bytes: 0 };
  if (!out.exists) return out;
  const add = (srcFile, rel) => {
    let st;
    try {
      st = fs.statSync(srcFile);
    } catch {
      return;
    }
    const dst = path.win32.join(dstRoot, rel);
    out.files.push({ rel, size: st.size, src: srcFile, dst });
    out.bytes += st.size;
    if (dst.length > FILE_LIMIT && out.tooLong.length < 20) out.tooLong.push(dst);
  };
  const addDir = (rel) => {
    const dst = path.win32.join(dstRoot, rel);
    out.dirs.push(rel);
    if (dst.length > DIR_LIMIT && out.tooLong.length < 20) out.tooLong.push(dst);
  };
  if (item.kind === "file") {
    const st = fs.lstatSync(srcRoot);
    if (st.isSymbolicLink()) out.links.push(srcRoot);
    else if (st.isFile()) {
      out.files.push({ rel: "", size: st.size, src: srcRoot, dst: dstRoot });
      out.bytes += st.size;
      if (dstRoot.length > FILE_LIMIT) out.tooLong.push(dstRoot);
    }
    return out;
  }
  if (item.kind === "files") {
    const re = new RegExp(item.pattern);
    for (const e of fs.readdirSync(srcRoot, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      if (e.isFile() && re.test(e.name)) add(path.win32.join(srcRoot, e.name), e.name);
    }
    return out;
  }
  if (item.kind === "results") {
    for (const d of fs.readdirSync(srcRoot, { withFileTypes: true })) {
      if (d.isSymbolicLink()) {
        out.links.push(path.win32.join(srcRoot, d.name));
        continue;
      }
      if (!d.isDirectory()) continue;
      const runDir = path.win32.join(srcRoot, d.name);
      addDir(d.name);
      for (const e of fs.readdirSync(runDir, { withFileTypes: true })) {
        if (e.isFile()) add(path.win32.join(runDir, e.name), path.win32.join(d.name, e.name));
      }
    }
    return out;
  }
  // dir・git: まるごと
  const stack = [""];
  while (stack.length) {
    const rel = stack.pop();
    const abs = rel ? path.win32.join(srcRoot, rel) : srcRoot;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? path.win32.join(rel, e.name) : e.name;
      if (e.isSymbolicLink()) {
        out.links.push(path.win32.join(srcRoot, r));
        continue;
      }
      if (e.isDirectory()) {
        addDir(r);
        stack.push(r);
      } else if (e.isFile()) add(path.win32.join(srcRoot, r), r);
    }
  }
  return out;
}

function sha256(file) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}

// 写し先が元と同じか（数・大きさ・SHA-256。どの種類の項目も。2026-11-16 から dir・git・files・results も SHA-256 を照らす）。
// sel は selectFiles の結果。毎回すべてのファイルの SHA-256 を計算し直す（前の結果を使わない。消す前の最後の照らしなので）。
// item は呼び出しの形を保つために受ける（今は使わない）。
export function verifySame(item, sel) {
  const problems = [];
  let checked = 0;
  for (const f of sel.files) {
    let st;
    try {
      st = fs.statSync(f.dst);
    } catch {
      problems.push(`写し先に無い: ${f.dst}`);
      if (problems.length > 20) break;
      continue;
    }
    if (st.size !== f.size) problems.push(`大きさが違う: ${f.dst}（元 ${f.size}、写し先 ${st.size}）`);
    else {
      const a = sha256(f.src);
      const b = sha256(f.dst);
      if (a !== b) problems.push(`SHA-256 が違う: ${f.dst}`);
      else f.sha256 = a;
    }
    checked++;
    if (problems.length > 20) break;
  }
  return { ok: problems.length === 0, checked, problems };
}

// 写し先が既にあるとき（2回目・途中で止まった後）に、写すファイルを1つずつ写し先と照らす。読むだけ。
// 返り値 { same, missing, different, sameBytes, missingBytes, differentFiles: [...最大 20], seconds }
//   same      写し先にあり、大きさと SHA-256 が元と同じ（f.existingSame = true、f.sha256 を書く。copyFiles はこのファイルを飛ばす）
//   missing   写し先に無い（続きで写す）
//   different 写し先にあるが、大きさか SHA-256 が違う（上書きしないので、その項目は problem）。途中で写すのが止まったファイルもここに入る
// 写し先にあって元に無いファイルは数えない（消さないし、照らさない）。
export function compareExisting(sel) {
  const t0 = Date.now();
  const out = { same: 0, missing: 0, different: 0, sameBytes: 0, missingBytes: 0, differentFiles: [], seconds: 0 };
  for (const f of sel.files) {
    let st;
    try {
      st = fs.statSync(f.dst);
    } catch {
      out.missing++;
      out.missingBytes += f.size;
      continue;
    }
    let why = null;
    if (!st.isFile()) why = "ファイルでない";
    else if (st.size !== f.size) why = `大きさが違う（元 ${f.size}、写し先 ${st.size}）`;
    else {
      const a = sha256(f.src);
      const b = sha256(f.dst);
      if (a !== b) why = "SHA-256 が違う";
      else {
        f.sha256 = a;
        f.existingSame = true;
      }
    }
    if (why) {
      out.different++;
      if (out.differentFiles.length < 20) out.differentFiles.push(`${why}: ${f.dst}`);
    } else {
      out.same++;
      out.sameBytes += f.size;
    }
  }
  out.seconds = (Date.now() - t0) / 1000;
  return out;
}

function git(dir, args) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

function worktreeCount(dir) {
  const r = git(dir, ["worktree", "list", "--porcelain"]);
  if (r.status !== 0) return { count: null, error: r.stderr };
  return { count: r.stdout.split(/\r?\n/).filter((l) => l.startsWith("worktree ")).length, paths: r.stdout.split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)) };
}

function refsOf(dir) {
  const r = git(dir, ["for-each-ref", "--format=%(objectname) %(refname)"]);
  return r.status === 0 ? r.stdout : null;
}

// 1つの項目の計画（読むだけ）。返り値 { name, kind, src, dst, sel, problems, already }
export function planItem(item, from, to) {
  const res = { name: item.name, kind: item.kind, problems: [] };
  if (!KINDS.includes(item.kind)) {
    res.problems.push(`知らない種類: ${item.kind}`);
    return res;
  }
  const sel = selectFiles(item, from, to);
  res.src = sel.srcRoot;
  res.dst = sel.dstRoot;
  res.files = sel.files.length;
  res.bytes = sel.bytes;
  res.gb = Math.round((sel.bytes / 1024 ** 3) * 100) / 100;
  res.sel = sel;
  if (!sel.exists) res.problems.push(`元が無い: ${sel.srcRoot}`);
  if (sel.links.length) res.problems.push(`リンク・ジャンクションがある（写さない）: ${sel.links.slice(0, 5).join(", ")}`);
  if (sel.tooLong.length) res.problems.push(`写し先のパスが長すぎる（${FILE_LIMIT}/${DIR_LIMIT} 文字）: ${sel.tooLong.slice(0, 3).join(", ")}`);
  if (item.kind === "git" && sel.exists) {
    const w = worktreeCount(sel.srcRoot);
    res.sourceWorktrees = w;
    if (w.count !== 1) res.problems.push(`元の clone に作業ツリーが付いている（${w.count} 個。先に外す）: ${(w.paths || []).slice(1, 4).join(", ")}`);
  }
  res.destExists = fs.existsSync(sel.dstRoot);
  return res;
}

// 写す。f.existingSame のファイル（compareExisting で、写し先に元と同じものがあると分かった）は飛ばす。
// ほかは COPYFILE_EXCL で写す（写し先にあれば失敗する。上書きしない）。
function copyFiles(sel) {
  const made = new Set();
  const mk = (d) => {
    if (made.has(d)) return;
    fs.mkdirSync(d, { recursive: true });
    made.add(d);
  };
  for (const rel of sel.dirs) mk(path.win32.join(sel.dstRoot, rel));
  let copied = 0;
  for (const f of sel.files) {
    if (f.existingSame) continue;
    mk(path.win32.dirname(f.dst));
    // COPYFILE_EXCL: 写し先にあれば失敗する（上書きしない）
    fs.copyFileSync(f.src, f.dst, fs.constants.COPYFILE_EXCL);
    const st = fs.statSync(f.src);
    fs.utimesSync(f.dst, st.atime, st.mtime);
    copied++;
  }
  return copied;
}

function gb(b) {
  return Math.round((b / 1024 ** 3) * 100) / 100;
}

function main() {
  let a;
  try {
    a = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[move-build-root] ${err.message}`);
    process.exit(2);
  }
  let to = a.to;
  if (!to) {
    try {
      to = resolveLocalConfig().buildRoot;
    } catch (err) {
      console.error(`[move-build-root] local.json: ${err.message}`);
      process.exit(2);
    }
  }
  if (inside(to, a.from) || inside(a.from, to)) {
    console.error(`[move-build-root] --from と --to が重なっている: ${a.from} / ${to}`);
    process.exit(2);
  }
  const t00 = Date.now();
  const out = { startedAt: new Date().toISOString(), from: a.from, to, dryRun: a.dryRun, items: [], result: "ok" };
  const items = PLAN.filter((p) => !a.only || a.only.includes(p.name));
  for (const item of items) {
    const p = planItem(item, a.from, to);
    const sel = p.sel;
    delete p.sel;
    out.items.push(p);
    if (p.problems.length) {
      p.status = "problem";
      continue;
    }
    if (p.destExists) {
      // 上書きしない。写し先のファイルを1つずつ元と照らす（大きさと SHA-256）。
      //   全部が同じ → already。違うものがある → problem（何も写さない）。無いものだけ → 続きから写す（下へ）
      const ex = compareExisting(sel);
      p.existing = ex;
      if (ex.different) {
        p.status = "problem";
        p.problems.push(`写し先が既にあり、元と違う（上書きしない）: ${ex.different} ファイル`, ...ex.differentFiles.slice(0, 5));
        continue;
      }
      if (!ex.missing) {
        p.verify = { ok: true, checked: ex.same, problems: [] };
        p.verifySeconds = ex.seconds;
        p.status = "already";
        continue;
      }
      p.resume = true;
    }
    if (a.dryRun) {
      p.status = "planned";
      continue;
    }
    const t0 = Date.now();
    try {
      p.copied = copyFiles(sel);
    } catch (err) {
      p.status = "problem";
      p.problems.push(`写せない: ${err.message}`);
      continue;
    }
    p.seconds = (Date.now() - t0) / 1000;
    const t1 = Date.now();
    const v = verifySame(item, sel);
    p.verifySeconds = (Date.now() - t1) / 1000;
    p.verify = v;
    if (item.kind === "git") {
      const refsA = refsOf(sel.srcRoot);
      const refsB = refsOf(sel.dstRoot);
      const w = worktreeCount(sel.dstRoot);
      p.git = { refsSame: refsA !== null && refsA === refsB, refCount: refsA ? refsA.split(/\r?\n/).length : null, worktrees: w.count };
      if (!p.git.refsSame) v.problems.push("写し先の refs が元と違う");
      if (w.count !== 1) v.problems.push(`写し先の作業ツリーが ${w.count} 個`);
      v.ok = v.problems.length === 0;
    }
    p.status = v.ok ? "copied" : "problem";
    if (!v.ok) p.problems.push(...v.problems.slice(0, 5));
    process.stderr.write(`[move-build-root] ${item.name}: ${p.status}（${p.files} ファイル、${gb(p.bytes)} GB${p.resume ? `、続きから。前からあった同じもの ${p.existing.same} ファイル` : ""}。写す ${p.seconds} 秒、照らす ${p.verifySeconds} 秒）\n`);
  }
  if (out.items.some((p) => p.status === "problem")) out.result = "problem";
  out.totalGB = gb(out.items.reduce((s, p) => s + (p.bytes || 0), 0));
  out.seconds = (Date.now() - t00) / 1000;
  out.finishedAt = new Date().toISOString();
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (a.out) {
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    fs.writeFileSync(a.out, text);
  }
  process.stdout.write(text);
  process.exit(out.result === "ok" ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
