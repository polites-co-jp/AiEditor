#!/usr/bin/env node
// 作業ツリーの用意（docs/02 の4節の1）: 本家の常設の clone（無ければ作る）で fetch --tags し、
// タグの作業ツリーを git worktree で作り、タグの commit が upstream.json の SHA と一致するかを確かめる。
// 各手順の所要時間と、clone・作業ツリーのディスクの大きさを JSON に書く。本家のコードは変えない。
//
// 使い方:
//   node scripts/prepare.mjs [--tag <tag>] [--commit <sha>] [--build-root C:/b] [--config <local.json>]
//                            [--worktree <dir>] [--out <json>] [--no-size]
//     --tag / --commit  既定は upstream.json の tag / commit
//     --build-root      既定は local.json の buildRoot、無ければ C:\b（docs/02 の6.1。共通の部品 scripts/lib/local-config.mjs の規則）
//     --config          local.json の場所（試し。既定 %LOCALAPPDATA%\Shuko\local.json）
//     --worktree        作業ツリーの場所（既定 <build-root>/wt/<tag>）。build.mjs --worktree はこれを渡す
//     --out             記録の JSON の書き出し先（既定 <作業ツリー>.prepare.json。既定の作業ツリーなら <build-root>/wt/<tag>.prepare.json）
//     --no-size         ディスクの大きさを数えない
// 終了コード: 0 = 一致、1 = 誤り（git の失敗、SHA の不一致、照合する SHA が無いなど）
// upstream.json に commit が無く --commit も無いときは、clone・fetch・worktree に進まずに止める（照合しないまま ok にしない）。
// 作業ツリーが既にあるときは作り直さず、HEAD の SHA だけを確かめる。

import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv) {
  const args = { tag: null, commit: null, buildRoot: null, config: null, worktree: null, out: null, size: true };
  const need = (i, name) => {
    if (i >= argv.length || String(argv[i]).startsWith("--")) throw new Error(`${name} に値が無い`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tag") args.tag = need(++i, a);
    else if (a === "--commit") args.commit = need(++i, a);
    else if (a === "--build-root") args.buildRoot = need(++i, a);
    else if (a === "--config") args.config = need(++i, a);
    else if (a === "--worktree") args.worktree = need(++i, a);
    else if (a === "--out") args.out = need(++i, a);
    else if (a === "--no-size") args.size = false;
    else throw new Error(`知らない引数: ${a}`);
  }
  return args;
}

// docs/02 の6.1: オプション → local.json → 既定値（C:\b）。規則は共通の部品（scripts/lib/local-config.mjs）に任せる
// （読めない・知らないキー・型の違い・相対パスは止める）。configPath を省くと %LOCALAPPDATA%\Shuko\local.json。
export function resolveBuildRoot(cliValue, { configPath } = {}) {
  return resolveLocalConfig({ configPath: configPath || undefined, overrides: { buildRoot: cliValue || undefined } }).buildRoot;
}

// 作業ツリーの場所: --worktree があればそれ、無ければ <buildRoot>\wt\<tag>。
export function resolveWorktree(buildRoot, tag, cliValue) {
  return cliValue ? path.resolve(cliValue) : path.join(buildRoot, "wt", tag);
}

function git(args, { inherit = false } = {}) {
  const t0 = Date.now();
  const r = spawnSync("git", args, {
    encoding: "utf8",
    stdio: inherit ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = (Date.now() - t0) / 1000;
  if (r.error) throw r.error;
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), seconds };
}

// フォルダの大きさ（バイト）とファイルの数。シンボリックリンクとジャンクションはたどらない。
export function dirSize(root, { skip = [] } = {}) {
  let bytes = 0;
  let files = 0;
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
      if (skip.includes(p)) continue;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try {
          bytes += fs.statSync(p).size;
          files++;
        } catch {}
      }
    }
  }
  return { bytes, gb: Math.round((bytes / 1024 ** 3) * 100) / 100, files };
}

function main() {
  let args;
  let buildRoot;
  try {
    args = parseArgs(process.argv.slice(2));
    buildRoot = resolveBuildRoot(args.buildRoot, { configPath: args.config });
  } catch (err) {
    console.error(`[prepare] ${err.message}`);
    process.exit(1);
  }
  const upstream = JSON.parse(fs.readFileSync(path.join(REPO, "upstream.json"), "utf8"));
  const tag = args.tag || upstream.tag;
  const expected = (args.commit || upstream.commit || "").toLowerCase();
  const remote = upstream.repository || "https://github.com/microsoft/vscode.git";
  const clone = path.join(buildRoot, "vscode");
  const wt = resolveWorktree(buildRoot, tag, args.worktree);
  const out = args.out ? path.resolve(args.out) : `${wt}.prepare.json`;

  const rec = {
    tag,
    expectedCommit: expected,
    buildRoot,
    clone,
    worktree: wt,
    startedAt: new Date().toISOString(),
    git: git(["--version"]).stdout,
    steps: [],
    result: "error",
  };
  const step = (name, r, extra = {}) => {
    const s = { name, seconds: r.seconds, status: r.status, ...extra };
    if (r.status !== 0) s.stderr = r.stderr.slice(-4000);
    rec.steps.push(s);
    console.error(`[prepare] ${name}: status ${r.status}, ${r.seconds.toFixed(1)} s`);
    return r.status === 0;
  };
  const finish = (result, message) => {
    rec.result = result;
    if (message) rec.message = message;
    rec.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rec, null, 2) + "\n");
    console.log(JSON.stringify(rec, null, 2));
    process.exit(result === "ok" ? 0 : 1);
  };

  // 照合の相手が無ければ、何もせずに止める（照合しないまま ok にしない）
  if (!expected) finish("error", "upstream.json に commit が無く、--commit も無い。タグの commit を照合できない");

  // 作業ツリーの親（既定は <buildRoot>\wt）。作業ツリーそのものは git worktree add が作る
  if (path.resolve(wt) === path.resolve(clone) || path.resolve(wt).toLowerCase().startsWith(path.resolve(clone).toLowerCase() + path.sep)) {
    finish("error", `作業ツリー ${wt} が常設の clone ${clone} と同じか、その中にある`);
  }
  fs.mkdirSync(path.dirname(wt), { recursive: true });

  // 1. 常設の clone
  if (!fs.existsSync(path.join(clone, ".git"))) {
    if (fs.existsSync(clone) && fs.readdirSync(clone).length > 0) finish("error", `${clone} があるが git の clone でない`);
    if (!step("clone", git(["clone", remote, clone], { inherit: true }))) finish("error", "clone に失敗");
  } else {
    rec.steps.push({ name: "clone", skipped: "already exists" });
  }

  // 2. fetch --tags
  if (!step("fetch --tags", git(["-C", clone, "fetch", "--tags"], { inherit: true }))) finish("error", "fetch に失敗");

  // 3. タグの commit
  const tagCommit = git(["-C", clone, "rev-parse", `refs/tags/${tag}^{commit}`]);
  step("rev-parse tag", tagCommit, { value: tagCommit.stdout });
  if (tagCommit.status !== 0) finish("error", `タグ ${tag} が無い`);
  rec.tagCommit = tagCommit.stdout.toLowerCase();
  if (rec.tagCommit !== expected) finish("error", `タグの commit ${rec.tagCommit} が upstream.json の ${expected} と違う`);

  // 4. 作業ツリー
  if (!fs.existsSync(wt)) {
    if (!step("worktree add", git(["-C", clone, "worktree", "add", "--detach", wt, `refs/tags/${tag}`], { inherit: true })))
      finish("error", "worktree add に失敗");
  } else {
    rec.steps.push({ name: "worktree add", skipped: "already exists" });
  }

  // 5. 作業ツリーの HEAD と、変更が無いこと
  const head = git(["-C", wt, "rev-parse", "HEAD"]);
  step("rev-parse worktree HEAD", head, { value: head.stdout });
  rec.worktreeHead = head.stdout.toLowerCase();
  const st = git(["-C", wt, "status", "--porcelain"]);
  step("status --porcelain", st);
  rec.worktreeClean = st.status === 0 && st.stdout === "";
  if (!rec.worktreeClean) rec.worktreeStatus = st.stdout.split("\n").slice(0, 50);

  // 6. ディスク
  if (args.size) {
    const t0 = Date.now();
    rec.disk = {
      cloneGitDir: dirSize(path.join(clone, ".git")),
      cloneCheckout: dirSize(clone, { skip: [path.join(clone, ".git")] }),
      worktree: dirSize(wt, { skip: [path.join(wt, ".git")] }),
      countedSeconds: (Date.now() - t0) / 1000,
    };
  }

  if (rec.worktreeHead !== rec.tagCommit) finish("error", `作業ツリーの HEAD ${rec.worktreeHead} がタグの commit と違う`);
  if (!rec.worktreeClean) finish("error", "作業ツリーに変更がある");
  finish("ok");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
