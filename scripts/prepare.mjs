#!/usr/bin/env node
// 作業ツリーの用意（docs/02 の4節の1）: 本家の常設の clone（無ければ作る）で fetch --tags し、
// タグの作業ツリーを git worktree で作り、タグの commit が upstream.json の SHA と一致するかを確かめる。
// 各手順の所要時間と、clone・作業ツリーのディスクの大きさを JSON に書く。本家のコードは変えない。
//
// 使い方:
//   node scripts/prepare.mjs [--tag <tag>] [--commit <sha>] [--build-root C:/b] [--out <json>] [--no-size]
//     --tag / --commit  既定は upstream.json の tag / commit
//     --build-root      既定は %LOCALAPPDATA%\Shuko\local.json の buildRoot、無ければ C:\b（docs/02 の6.1）
//     --out             記録の JSON の書き出し先（既定 <build-root>/wt/<tag>.prepare.json）
//     --no-size         ディスクの大きさを数えない
// 終了コード: 0 = 一致、1 = 誤り（git の失敗、SHA の不一致など）
// 作業ツリーが既にあるときは作り直さず、HEAD の SHA だけを確かめる。

import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv) {
  const args = { tag: null, commit: null, buildRoot: null, out: null, size: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tag") args.tag = argv[++i];
    else if (a === "--commit") args.commit = argv[++i];
    else if (a === "--build-root") args.buildRoot = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--no-size") args.size = false;
    else throw new Error(`知らない引数: ${a}`);
  }
  return args;
}

function expandEnv(s) {
  return s.replace(/%([^%]+)%/g, (m, name) => (process.env[name] !== undefined ? process.env[name] : m));
}

// docs/02 の6.1: ファイルやキーが無ければ既定値。読めない・型が違うときは止める。
// （共通の部品 scripts/lib/local-config.mjs ができたら、そちらに置き換える）
export function resolveBuildRoot(cliValue) {
  if (cliValue) return path.resolve(expandEnv(cliValue));
  const la = process.env.LOCALAPPDATA;
  if (la) {
    const p = path.join(la, "Shuko", "local.json");
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.buildRoot !== undefined) {
        if (typeof j.buildRoot !== "string") throw new Error(`${p} の buildRoot が文字列でない`);
        return path.resolve(expandEnv(j.buildRoot));
      }
    }
  }
  return path.resolve("C:\\b");
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
  const args = parseArgs(process.argv.slice(2));
  const upstream = JSON.parse(fs.readFileSync(path.join(REPO, "upstream.json"), "utf8"));
  const tag = args.tag || upstream.tag;
  const expected = (args.commit || upstream.commit || "").toLowerCase();
  const remote = upstream.repository || "https://github.com/microsoft/vscode.git";
  const buildRoot = resolveBuildRoot(args.buildRoot);
  const clone = path.join(buildRoot, "vscode");
  const wt = path.join(buildRoot, "wt", tag);
  const out = args.out ? path.resolve(args.out) : path.join(buildRoot, "wt", `${tag}.prepare.json`);

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

  fs.mkdirSync(path.join(buildRoot, "wt"), { recursive: true });

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
  if (expected && rec.tagCommit !== expected) finish("error", `タグの commit ${rec.tagCommit} が upstream.json の ${expected} と違う`);

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
