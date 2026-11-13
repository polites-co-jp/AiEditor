#!/usr/bin/env node
// 毎週の取り込み（docs/06 の3・4・6・7節）。本体の新しいタグ、または同梱する拡張の新しい版を、今使っている版に触らずに
// ブランチ take-in/<label> と記録 records/take-in/<label>/ に取り込み、claude -p（判定役 狄仁傑）に判定させる。
// 入れ替えはユーザーが行う（adopt.mjs → switch.ps1）。
//
// 使い方（詳しくは tasks/2026-11-14-p3-take-in/take-in-design.md）:
//   node scripts/take-in.mjs core <tag> [--label <label>] [--commit <sha>] [--prev-tag <tag>] [--from <手順>] [--to <手順>]
//        [--net-env <dir>] [--net-previous <path>] [--net-duration <秒>] [--smoke-baseline <json>] [--repair-model <model>]
//   node scripts/take-in.mjs ext <id> [<version>] [--security] [--now <ISO 8601>]
//   node scripts/take-in.mjs probe-claude [--claude <path>] [--out <dir>]
//   共通: --dry-run --config <local.json> --build-root <dir> --install-root <dir> --claude <path> --no-repair --max-repair <n>
//         --skip-judge --no-writeback --watch-state <path>
// 終了コード: 0 = 判定まで済んだ（dry-run も）、1 = 途中で止まった、2 = 引数の誤り、3 = 取り込む新しい版が無い（ext）

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { resolveLocalConfig } from "./lib/local-config.mjs";
import { nextLabel, resolveEditorLayout } from "./build.mjs";
import * as G from "./lib/apply/git.mjs";
import { ArgError, USAGE, parseTakeInArgs, extLabel, branchFor } from "./lib/take-in/args.mjs";
import { CORE_STEPS, selectCoreSteps, nextAction, checksOutcome } from "./lib/take-in/steps.mjs";
import { validateVerdict, guardVerdict, renderVerdictMarkdown, todoSummary } from "./lib/take-in/verdict.mjs";
import { buildClaudeInvocation, describeInvocation, parseClaudeOutput, findClaude, claudeCandidates, resolveClaudeCommand, claudeVersion, runClaude, PROBE_SCHEMA } from "./lib/take-in/claude.mjs";
import { classifyApplyFailure, findConflictMarkers, outsideAllowed, normalizeRepoPath, groupFixes, buildRepairRequest, REPAIR_PROMPT } from "./lib/take-in/repair.mjs";
import { fetchUpstreamInfo, parseLsRemote } from "./lib/take-in/upstream-info.mjs";
import { findPrevFetchDir, prevFetchCandidates, pickFetchedItem, seedFor, decideExtVersion, setLedgerVerdict } from "./lib/take-in/ext.mjs";
import { writeBack, readWatchStatus } from "./lib/take-in/writeback.mjs";
import { smokeRunArgs, newBaselinePath, summarizeSmoke, NETAUDIT_SETTINGS, netEnvLayout, netEnvInstallArgs, netauditArgs } from "./lib/take-in/smoke-net.mjs";
import { listMaterials, buildJudgeRequest, JUDGE_PROMPT, listIssues, composeBuildRecord, factsFrom, auditHosts } from "./lib/take-in/records.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");
const NODE = process.execPath;

class Stop extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const log = (m) => console.error(`[take-in] ${m}`);
const posix = (p) => String(p).replace(/\\/g, "/");
const rel = (p) => posix(path.relative(REPO, p));
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}
function readJsonOrNull(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}
function writeJson(file, v) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(v, null, 2) + "\n");
}
function writeText(file, t) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, t);
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true, ...opts });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error ? r.error.message : null };
}
function git(cwd, args, opts = {}) {
  return sh("git", ["-C", cwd, ...args], opts);
}
function gitOk(cwd, args, opts = {}) {
  const r = git(cwd, args, opts);
  if (r.status !== 0) throw new Stop(`git ${args.join(" ")} が失敗: ${(r.stderr || r.stdout).trim().slice(0, 1000)}`);
  return r.stdout;
}

// 長い手順を走らせる。出力は画面とログに流し、末尾を返す。
function runLogged({ cmd, args, cwd, logFile, env = process.env }) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const out = fs.createWriteStream(logFile);
    const t0 = Date.now();
    const child = spawn(cmd, args, { cwd, env, windowsHide: true });
    let tail = "";
    let all = "";
    const on = (stream) => (c) => {
      stream.write(c);
      out.write(c);
      const s = c.toString("utf8");
      tail = (tail + s).slice(-16384);
      if (all.length < 4 * 1024 * 1024) all += s;
    };
    child.stdout.on("data", on(process.stderr));
    child.stderr.on("data", on(process.stderr));
    child.on("error", (err) => {
      out.end();
      resolve({ exitCode: null, seconds: (Date.now() - t0) / 1000, tail: `${tail}\n${err.message}`, output: all });
    });
    child.on("close", (code) => {
      out.end();
      resolve({ exitCode: code, seconds: (Date.now() - t0) / 1000, tail, output: all });
    });
  });
}

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

function existingLabels() {
  const out = [];
  const b = path.join(REPO, "records", "builds");
  if (fs.existsSync(b)) for (const f of fs.readdirSync(b)) if (f.endsWith(".json")) out.push(f.slice(0, -5));
  const t = path.join(REPO, "records", "take-in");
  if (fs.existsSync(t)) for (const e of fs.readdirSync(t, { withFileTypes: true })) if (e.isDirectory()) out.push(e.name);
  return out;
}

// main の upstream.json（作業中の変更に左右されないよう git show で読む。無ければ作業のファイル）。
function mainUpstream() {
  const r = git(REPO, ["show", "main:upstream.json"]);
  if (r.status === 0) {
    try {
      return JSON.parse(r.stdout);
    } catch {}
  }
  return readJsonOrNull(path.join(REPO, "upstream.json")) || {};
}

function currentLabel(installRoot) {
  const cur = path.join(installRoot, "current");
  try {
    return path.basename(fs.readlinkSync(cur));
  } catch {
    return null;
  }
}

// claude の起動のしかた（{ cmd, prefixArgs, via } か null）。--claude に .cmd を渡されたら中身を読む。
function resolveClaudePath(a) {
  if (a.claude) return resolveClaudeCommand([path.resolve(a.claude)]) || { cmd: path.resolve(a.claude), prefixArgs: [], via: a.claude };
  return findClaude(process.env);
}

// 今の実行の ctx（止まったときに take-in.json に結果を書くため）
let CURRENT = null;

function newRecord(kind, a) {
  return { kind, label: null, startedAt: new Date().toISOString(), finishedAt: null, args: a, steps: [], repairs: [], claude: [], warnings: [], result: "running" };
}

// ビルドリポジトリの取り込みのブランチの作業ツリー（main から）。既にあれば使う。
function ensureBuilderWorktree(ctx) {
  const { bwt, branch } = ctx;
  if (fs.existsSync(path.join(bwt, ".git"))) return { created: false };
  if (ctx.args.builderWorktree) throw new Stop(`--builder-worktree ${bwt} が git の作業ツリーでない`);
  const hasBranch = git(REPO, ["rev-parse", "--verify", "-q", `refs/heads/${branch}`]).status === 0;
  fs.mkdirSync(path.dirname(bwt), { recursive: true });
  if (hasBranch) gitOk(REPO, ["worktree", "add", bwt, branch]);
  else gitOk(REPO, ["worktree", "add", "-b", branch, bwt, "main"]);
  return { created: true, fromExistingBranch: hasBranch };
}

function commitBuilder(ctx, paths, message) {
  const present = paths.filter((p) => fs.existsSync(path.join(ctx.bwt, p)));
  if (!present.length) return null;
  gitOk(ctx.bwt, ["add", "-A", "--", ...present]);
  const staged = git(ctx.bwt, ["diff", "--cached", "--quiet"]);
  if (staged.status === 0) return null;
  gitOk(ctx.bwt, [...G.COMMIT_IDENTITY, "commit", "--no-verify", "-q", "-m", message]);
  return gitOk(ctx.bwt, ["rev-parse", "HEAD"]).trim();
}

// ブランチの main からの差を判定の材料にする（取れなくても止めない）。
function writeBranchDiff(ctx, paths) {
  const stat = git(ctx.bwt, ["diff", "--stat", "main...HEAD"]);
  const full = git(ctx.bwt, ["diff", "main...HEAD", "--", ...paths]);
  const text = stat.status === 0 && full.status === 0
    ? `${stat.stdout}\n${full.stdout.slice(0, 400000)}`
    : `ブランチの差を取れない: ${(stat.stderr || full.stderr).trim()}\n`;
  writeText(path.join(ctx.recDir, "branch-diff.txt"), text);
}

function step(ctx, n, name, extra = {}) {
  const s = { n, name, status: "running", startedAt: new Date().toISOString(), ...extra };
  ctx.rec.steps.push(s);
  save(ctx);
  log(`手順 ${n} ${name}`);
  return s;
}
function finishStep(ctx, s, status, extra = {}) {
  Object.assign(s, extra, { status, finishedAt: new Date().toISOString() });
  save(ctx);
}
function save(ctx) {
  if (ctx.dryRun || !ctx.recDir) return;
  writeJson(path.join(ctx.recDir, "take-in.json"), ctx.rec);
}

async function invokeClaude(ctx, inv, dir) {
  const d = describeInvocation(inv);
  writeJson(path.join(dir, "claude-args.json"), d);
  if (inv.input) writeText(path.join(dir, "request.md"), inv.input);
  const r = await runClaude(inv);
  writeText(path.join(dir, "claude-output.json"), r.stdout);
  if (r.stderr.trim()) writeText(path.join(dir, "claude-stderr.txt"), r.stderr);
  const parsed = parseClaudeOutput(r.stdout);
  ctx.rec.claude.push({ ...d, exitCode: r.exitCode, seconds: r.seconds, ok: parsed.ok, error: parsed.error, costUsd: parsed.costUsd, numTurns: parsed.numTurns, dir: rel(dir) });
  save(ctx);
  return { run: r, parsed };
}

// ---------------------------------------------------------------------------
// 本家の作業ツリー
// ---------------------------------------------------------------------------

function resetWorktree(wt, commit) {
  if (G.amInProgress(wt)) git(wt, ["am", "--abort"]);
  gitOk(wt, ["reset", "-q", "--hard", commit]);
  gitOk(wt, ["clean", "-q", "-fd"]);
}

function worktreePristine(wt, commit) {
  if (!fs.existsSync(path.join(wt, ".git"))) return false;
  if (G.amInProgress(wt)) return false;
  const head = git(wt, ["rev-parse", "HEAD"]).stdout.trim();
  return head === commit && git(wt, ["status", "--porcelain"]).stdout.trim() === "";
}

// ---------------------------------------------------------------------------
// 修理
// ---------------------------------------------------------------------------

// 修理の後、ビルドリポジトリの変更が removals/・patches/ の中だけかを確かめ、外の変更を戻す。
// before は修理の前の git status --porcelain（前からあった変更は修理のせいにしない）。
// removals/ と patches/ の中身の印（修理で何か変わったかを見る。追跡しているかを問わない）。
function builderSnapshot(ctx) {
  const h = createHash("sha256");
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) h.update(p).update("\0").update(fs.readFileSync(p)).update("\0");
    }
  };
  walk(path.join(ctx.bwt, "removals"));
  walk(path.join(ctx.bwt, "patches"));
  return h.digest("hex");
}
function builderStatus(ctx) {
  return git(ctx.bwt, ["status", "--porcelain", "--untracked-files=all"]).stdout;
}
function guardBuilder(ctx, dir, before = "") {
  const st = builderStatus(ctx);
  const had = new Set(String(before).split(/\r?\n/).filter(Boolean));
  const outside = outsideAllowed(st.split(/\r?\n/).filter((l) => l && !had.has(l)).join("\n"));
  if (outside.length) {
    // 規約の外の変更を戻す（追跡しているものは checkout、新しいものは消す）
    for (const p of outside) {
      // 戻すのはビルドリポジトリの作業ツリーの中のものだけ（正規化して外へ出るパスには触らない）
      const n = normalizeRepoPath(p);
      if (!n) continue;
      const full = path.resolve(ctx.bwt, n);
      if (!full.toLowerCase().startsWith(path.resolve(ctx.bwt).toLowerCase() + path.sep)) continue;
      const tracked = git(ctx.bwt, ["ls-files", "--error-unmatch", "--", n]).status === 0;
      if (tracked) git(ctx.bwt, ["checkout", "--", n]);
      else fs.rmSync(full, { recursive: true, force: true });
    }
  }
  writeText(path.join(dir, "changes.diff"), git(ctx.bwt, ["diff"]).stdout);
  return outside;
}

// 修理の依頼文と claude -p の起動の形を、起動せずに repair-preview/ に残す（--no-repair のとき）。
function previewRepair(ctx, failure) {
  const dir = path.join(ctx.recDir, "repair-preview");
  const unitDir = failure.unitId ? path.join(ctx.bwt, "removals", failure.unitId) : null;
  const unit = unitDir ? readJsonOrNull(path.join(unitDir, "unit.json")) : null;
  const readme = unitDir && fs.existsSync(path.join(unitDir, "README.md")) ? fs.readFileSync(path.join(unitDir, "README.md"), "utf8") : null;
  const input = buildRepairRequest({
    label: ctx.label, tag: ctx.tag, prevTag: ctx.prevTag, attempt: 1, max: ctx.args.maxRepair, failure, unit, unitReadme: readme,
    builderWorktree: ctx.bwt, worktree: ctx.wt, gitStatus: git(ctx.wt, ["status", "--porcelain"]).stdout, gitDiff: git(ctx.wt, ["diff"]).stdout.slice(0, 60000),
  });
  const inv = buildClaudeInvocation({ kind: "repair", repoRoot: REPO, worktree: ctx.wt, builderWorktree: ctx.bwt, prompt: REPAIR_PROMPT, input, claudePath: ctx.claudePath, model: ctx.args.repairModel, rulesFile: path.join(REPO, "TAKE-IN.md") });
  writeText(path.join(dir, "request.md"), input);
  writeJson(path.join(dir, "claude-args.json"), describeInvocation(inv));
  ctx.rec.repairPreview = rel(dir);
  save(ctx);
}

async function repairApply(ctx, failure, attempt) {
  const dir = path.join(ctx.recDir, `repair-${ctx.rec.repairs.length + 1}`);
  const res = { n: ctx.rec.repairs.length + 1, mode: "apply", attempt, failure, ok: false, dir: rel(dir) };
  ctx.rec.repairs.push(res);
  const unitDir = failure.unitId ? path.join(ctx.bwt, "removals", failure.unitId) : null;
  const unit = unitDir ? readJsonOrNull(path.join(unitDir, "unit.json")) : null;
  const readme = unitDir && fs.existsSync(path.join(unitDir, "README.md")) ? fs.readFileSync(path.join(unitDir, "README.md"), "utf8") : null;
  let patchText = null;
  if (failure.kind === "editsConflict" && unit) patchText = fs.readFileSync(path.join(unitDir, unit.patch || "edits.patch"), "utf8");
  if (failure.kind === "patchConflict") patchText = fs.readFileSync(path.join(ctx.bwt, "patches", failure.patchName), "utf8");
  const gitDiff = git(ctx.wt, ["diff"]).stdout;
  const input = buildRepairRequest({
    label: ctx.label, tag: ctx.tag, prevTag: ctx.prevTag, attempt, max: ctx.args.maxRepair, failure, unit, unitReadme: readme,
    builderWorktree: ctx.bwt, worktree: ctx.wt, gitStatus: git(ctx.wt, ["status", "--porcelain"]).stdout,
    gitDiff: gitDiff.length > 60000 ? gitDiff.slice(0, 60000) + "\n…（以下略）" : gitDiff, patchText: patchText && patchText.length > 60000 ? patchText.slice(0, 60000) : patchText,
  });
  const inv = buildClaudeInvocation({ kind: "repair", repoRoot: REPO, worktree: ctx.wt, builderWorktree: ctx.bwt, prompt: REPAIR_PROMPT, input, claudePath: ctx.claudePath, model: ctx.args.repairModel, rulesFile: path.join(REPO, "TAKE-IN.md") });
  const beforeStatus = builderStatus(ctx);
  const beforeSnap = builderSnapshot(ctx);
  const { parsed } = await invokeClaude(ctx, inv, dir);
  const finish = (ok, message, extra = {}) => {
    Object.assign(res, { ok, message, ...extra });
    writeJson(path.join(dir, "result.json"), res);
    save(ctx);
    return res;
  };
  if (!parsed.ok) return finish(false, `claude -p の結果を読めない: ${parsed.error}`);
  const out = parsed.structured;
  res.claude = { status: out.status, summary: out.summary, fixes: out.fixes, needsJudgment: out.needsJudgment };
  if (Array.isArray(out.needsJudgment) && out.needsJudgment.length) return finish(false, `要判断: ${out.needsJudgment.join(" / ")}`, { needsJudgment: true });
  if (out.status === "gave-up") return finish(false, "claude -p が直せなかった");

  if (failure.kind === "editsConflict" || failure.kind === "patchConflict") {
    if (!G.amInProgress(ctx.wt)) return finish(false, "git am の途中でない（衝突が残されていない）");
    const changed = git(ctx.wt, ["diff", "--name-only"]).stdout.split(/\r?\n/).filter(Boolean);
    const files = [...new Set([...(failure.conflicts || []), ...changed])];
    const marked = files.filter((f) => fs.existsSync(path.join(ctx.wt, f)) && findConflictMarkers(fs.readFileSync(path.join(ctx.wt, f), "utf8")).length);
    if (marked.length) return finish(false, `衝突の印が残っている: ${marked.join(", ")}`);
    gitOk(ctx.wt, ["add", "-A"]);
    const c = git(ctx.wt, [...G.COMMIT_IDENTITY, "am", "--continue"]);
    if (c.status !== 0) return finish(false, `git am --continue が失敗: ${(c.stderr || c.stdout).trim().slice(0, 1000)}`);
    const patch = gitOk(ctx.wt, ["format-patch", "-1", "HEAD", "--stdout"]);
    const dest = failure.kind === "editsConflict" ? path.join(ctx.bwt, "removals", failure.unitId, (unit && unit.patch) || "edits.patch") : path.join(ctx.bwt, "patches", failure.patchName);
    fs.writeFileSync(dest, patch);
    res.wrote = rel(dest);
  }
  const outside = guardBuilder(ctx, dir, beforeStatus);
  if (outside.length) return finish(false, `removals/・patches/ の外を変えた（戻した）: ${outside.join(", ")}`);
  if (builderSnapshot(ctx) === beforeSnap) return finish(false, "removals/・patches/ に何も変わっていない");
  return finish(true, out.summary || "直した");
}

function typecheckTail(ctx, buildRec) {
  const logFile = path.join(ctx.buildRoot, "logs", ctx.label, "typecheck.log");
  let text = "";
  if (fs.existsSync(logFile)) {
    const all = fs.readFileSync(logFile, "utf8");
    const errs = all.split(/\r?\n/).filter((l) => /error TS\d+|: error /.test(l));
    text = (errs.length ? errs.slice(0, 400).join("\n") + "\n\n--- 末尾 ---\n" : "") + all.slice(-20000);
  } else {
    const s = buildRec && (buildRec.steps || []).find((x) => x.name === "typecheck");
    text = (s && s.tail) || "";
  }
  writeText(path.join(ctx.recDir, "typecheck-tail.txt"), text);
  return text;
}

async function repairTypecheck(ctx, buildRec, attempt) {
  const dir = path.join(ctx.recDir, `repair-${ctx.rec.repairs.length + 1}`);
  const res = { n: ctx.rec.repairs.length + 1, mode: "typecheck", attempt, ok: false, dir: rel(dir) };
  ctx.rec.repairs.push(res);
  const finish = (ok, message, extra = {}) => {
    Object.assign(res, { ok, message, ...extra });
    writeJson(path.join(dir, "result.json"), res);
    save(ctx);
    return res;
  };
  const checks = readJsonOrNull(path.join(ctx.recDir, "checks.json"));
  if (!checks) return finish(false, "checks.json が無い");
  const appliedUnits = (checks.units || []).filter((u) => u.applied === "ok").map((u) => ({ id: u.id, intent: (readJsonOrNull(path.join(ctx.bwt, "removals", u.id, "unit.json")) || {}).intent }));
  const head = gitOk(ctx.wt, ["rev-parse", "HEAD"]).trim();
  const beforeStatus = builderStatus(ctx);
  const input = buildRepairRequest({
    mode: "typecheck", label: ctx.label, tag: ctx.tag, prevTag: ctx.prevTag, attempt, max: ctx.args.maxRepair,
    builderWorktree: ctx.bwt, worktree: ctx.wt, typecheckTail: typecheckTail(ctx, buildRec), appliedUnits, gitStatus: git(ctx.wt, ["status", "--porcelain"]).stdout,
  });
  const inv = buildClaudeInvocation({ kind: "repair", repoRoot: REPO, worktree: ctx.wt, builderWorktree: ctx.bwt, prompt: REPAIR_PROMPT, input, claudePath: ctx.claudePath, model: ctx.args.repairModel, rulesFile: path.join(REPO, "TAKE-IN.md") });
  const { parsed } = await invokeClaude(ctx, inv, dir);
  if (!parsed.ok) return finish(false, `claude -p の結果を読めない: ${parsed.error}`);
  const out = parsed.structured;
  res.claude = { status: out.status, summary: out.summary, fixes: out.fixes, needsJudgment: out.needsJudgment };
  if (Array.isArray(out.needsJudgment) && out.needsJudgment.length) return finish(false, `要判断: ${out.needsJudgment.join(" / ")}`, { needsJudgment: true });
  const { groups, unknown } = groupFixes(out.fixes);
  const changed = git(ctx.wt, ["diff", "--name-only", "HEAD"]).stdout.split(/\r?\n/).filter(Boolean).map(posix);
  const claimed = new Set(Object.values(groups).flat());
  const unclaimed = changed.filter((f) => !claimed.has(f));
  if (unknown.length || unclaimed.length) return finish(false, `持ち主の分からない直しがある: ${[...unknown, ...unclaimed].join(", ")}`, { needsJudgment: true });
  if (!changed.length) return finish(false, "作業ツリーに何も変わっていない");
  // 持ち主ごとの差分を保存してから、持ち主のコミットに戻して当て、edits を作り直す
  const diffs = {};
  for (const [owner, files] of Object.entries(groups)) {
    const d = gitOk(ctx.wt, ["diff", "--binary", "HEAD", "--", ...files]);
    const f = path.join(dir, `fix-${owner.replace(/[:/\\]/g, "_")}.diff`);
    writeText(f, d);
    diffs[owner] = f;
  }
  res.wrote = [];
  for (const [owner, diffFile] of Object.entries(diffs)) {
    let base;
    let dest;
    let unitJsonPath = null;
    let amend;
    if (owner.startsWith("unit:")) {
      const id = owner.slice(5);
      const u = (checks.units || []).find((x) => x.id === id && x.applied === "ok");
      if (!u) return finish(false, `当てていない単位への直し: ${id}`);
      amend = !!(u.edits && u.edits.commit);
      base = amend ? u.edits.commit : u.ops.commit;
      unitJsonPath = path.join(ctx.bwt, "removals", id, "unit.json");
      const uj = readJson(unitJsonPath);
      dest = path.join(ctx.bwt, "removals", id, uj.patch || "edits.patch");
      if (!uj.patch) {
        uj.patch = "edits.patch";
        writeJson(unitJsonPath, uj);
      }
    } else {
      const name = owner.slice(6);
      const p = (checks.patches || []).find((x) => x.file && x.file.split("/").pop() === name);
      if (!p || !p.commit) return finish(false, `当てていないパッチへの直し: ${name}`);
      amend = true;
      base = p.commit;
      dest = path.join(ctx.bwt, "patches", name);
    }
    gitOk(ctx.wt, ["checkout", "-q", "-f", "--detach", base]);
    const ap = git(ctx.wt, ["apply", "--3way", diffFile]);
    if (ap.status !== 0) return finish(false, `${owner} の直しが ${base.slice(0, 10)} に当たらない: ${(ap.stderr || ap.stdout).trim().slice(0, 800)}`);
    gitOk(ctx.wt, ["add", "-A"]);
    if (amend) gitOk(ctx.wt, [...G.COMMIT_IDENTITY, "commit", "--no-verify", "-q", "--amend", "--no-edit"]);
    else gitOk(ctx.wt, [...G.COMMIT_IDENTITY, "commit", "--no-verify", "-q", "-m", `unit ${owner.slice(5)}: edits`]);
    fs.writeFileSync(dest, gitOk(ctx.wt, ["format-patch", "-1", "HEAD", "--stdout"]));
    res.wrote.push(rel(dest));
  }
  gitOk(ctx.wt, ["checkout", "-q", "-f", "--detach", head]);
  const outside = guardBuilder(ctx, dir, beforeStatus);
  if (outside.length) return finish(false, `removals/・patches/ の外を変えた（戻した）: ${outside.join(", ")}`);
  return finish(true, out.summary || "直した");
}

// ---------------------------------------------------------------------------
// 判定（手順 9）
// ---------------------------------------------------------------------------

async function judge(ctx, { facts, notes = [], extra = {} }) {
  const reqPath = path.join(ctx.recDir, "judge-request.md");
  const materials = [{ path: "TAKE-IN.md", bytes: fs.existsSync(path.join(REPO, "TAKE-IN.md")) ? fs.statSync(path.join(REPO, "TAKE-IN.md")).size : 0 }, ...listMaterials(ctx.recDir, REPO).filter((m) => !m.path.endsWith("judge-request.md"))];
  const request = buildJudgeRequest({ kind: ctx.kind, label: ctx.label, tag: ctx.tag, prevTag: ctx.prevTag, materials, facts, issues: listIssues(REPO), notes, ...extra });
  writeText(reqPath, request);
  const inv = buildClaudeInvocation({ kind: "verdict", repoRoot: REPO, prompt: JUDGE_PROMPT(rel(reqPath)), claudePath: ctx.claudePath });
  const dir = path.join(ctx.recDir, "judge");
  const { parsed } = await invokeClaude(ctx, inv, dir);
  fs.copyFileSync(path.join(dir, "claude-output.json"), path.join(ctx.recDir, "judge-output.json"));
  return finalizeVerdict(ctx, parsed, facts);
}

function finalizeVerdict(ctx, parsed, facts, writeback = null) {
  const v = parsed && parsed.ok ? parsed.structured : null;
  const invalid = v ? validateVerdict(v, { label: ctx.label }) : [`判定役の結果を読めない: ${parsed ? parsed.error : "起動していない"}`];
  const guard = v ? guardVerdict(v, facts) : [];
  const verdictMd = path.join(ctx.recDir, "verdict.md");
  if (invalid.length) {
    writeJson(path.join(ctx.recDir, "verdict-invalid.json"), { errors: invalid, structured: v });
    if (fs.existsSync(path.join(ctx.recDir, "verdict.json"))) fs.rmSync(path.join(ctx.recDir, "verdict.json"));
  } else {
    writeJson(path.join(ctx.recDir, "verdict.json"), { ...v, scriptGuard: { violations: guard, facts }, ...(writeback ? { writeback } : {}) });
  }
  writeText(verdictMd, renderVerdictMarkdown(v, { guard, label: ctx.label, verdictInvalid: invalid, writeback }));
  ctx.rec.verdict = { valid: !invalid.length, verdict: v ? v.verdict : null, recommendation: v ? v.recommendation : null, errors: invalid, guard };
  save(ctx);
  return { v: invalid.length ? null : v, parsed, invalid, guard, facts };
}

async function recordAndWriteBack(ctx, judged, target) {
  const verdictPath = `records/take-in/${ctx.label}/verdict.md`;
  let wb = { ok: false, attempted: false, message: ctx.args.noWriteback ? "--no-writeback" : "判定していない（--skip-judge か手順 9 を走らせていない）" };
  if (!ctx.args.noWriteback && judged) {
    const v = judged ? judged.v : null;
    wb = await writeBack(REPO, {
      target,
      label: ctx.label,
      verdict: v ? v.verdict : "fail",
      recommendation: v ? v.recommendation : "見送る",
      reasons: v ? v.reasons || [] : ["判定を受け取れなかった"],
      summary: todoSummary(v, verdictPath),
      verdictPath,
      status: "In progress",
      stateFile: ctx.args.watchState ? path.resolve(ctx.args.watchState) : undefined,
    });
  }
  writeJson(path.join(ctx.recDir, "writeback.json"), wb);
  if (judged && judged.parsed) finalizeVerdict(ctx, judged.parsed, judged.facts, { ok: wb.ok, message: wb.message });
  if (!wb.ok) ctx.rec.warnings.push(`ToDo に書き戻せなかった: ${wb.message}`);
  return wb;
}

// ---------------------------------------------------------------------------
// 本体（core）
// ---------------------------------------------------------------------------

// スモークの実行の置き場所（C:\b\smoke\runs\...）から、判定に要る結果を records に写す（リーダーの判断 2026-11-14）。
function copySmokeResult(runDir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ["smoke-result.json", "smoke-result.md"]) if (fs.existsSync(path.join(runDir, f))) fs.copyFileSync(path.join(runDir, f), path.join(dest, f));
  writeText(path.join(dest, "run-dir.txt"), runDir + "\n");
}

// 通信の監査の一時の環境を作る（docs/06 の9節）。<buildRoot>\take-in\<label>\netaudit-env を作り直し、
// 新しい版の CLI で install-extensions.mjs --portable を走らせ、計測と監査が要る設定を書く。
// 返り値 { ok, envDir, message, install }
async function buildNetEnv(ctx, layout) {
  const envDir = path.join(ctx.buildRoot, "take-in", ctx.label, "netaudit-env");
  const L = netEnvLayout(envDir);
  fs.rmSync(envDir, { recursive: true, force: true });
  fs.mkdirSync(L.user, { recursive: true });
  fs.mkdirSync(L.ext, { recursive: true });
  const out = path.join(ctx.recDir, "netaudit-env", "install-extensions.json");
  const args = netEnvInstallArgs({ cli: layout.cli, envDir, lock: path.join(ctx.bwt, "extensions.lock.json"), out, buildRoot: ctx.buildRoot, config: ctx.args.config });
  const r = await runLogged({ cmd: NODE, args: [path.join(SCRIPT_DIR, "install-extensions.mjs"), ...args], cwd: REPO, logFile: path.join(ctx.recDir, "logs", "netaudit-env.log") });
  const install = readJsonOrNull(out);
  if (r.exitCode !== 0) return { ok: false, envDir, message: `install-extensions.mjs が ${r.exitCode}（${install ? install.message || install.result : "結果なし"}）`, install: install && { result: install.result, message: install.message } };
  writeJson(L.settings, NETAUDIT_SETTINGS);
  writeJson(L.record, { createdBy: "scripts/take-in.mjs", label: ctx.label, createdAt: new Date().toISOString(), editor: { root: layout.root, exe: layout.exe, cli: layout.cli, version: layout.version }, ledger: path.join(ctx.bwt, "extensions.lock.json"), settings: NETAUDIT_SETTINGS, installed: install ? install.installed : null });
  return { ok: true, envDir, message: null, install: install && { result: install.result, count: Array.isArray(install.installed) ? install.installed.length : null } };
}

function switchSupportsExpandOnly() {
  const p = path.join(SCRIPT_DIR, "switch.ps1");
  return fs.existsSync(p) && /\$ExpandOnly\b/.test(fs.readFileSync(p, "utf8"));
}

function smokeBaselineFor(ctx) {
  if (ctx.args.smokeBaseline) return path.resolve(ctx.args.smokeBaseline);
  const cands = [];
  if (ctx.currentLabel) cands.push(path.join(ctx.buildRoot, "smoke", `baseline-${ctx.currentLabel}.json`));
  if (ctx.prevTag) cands.push(path.join(ctx.buildRoot, "smoke", `baseline-official-${ctx.prevTag}.json`));
  return cands.find((c) => fs.existsSync(c)) || null;
}

function netPreviousFor(ctx) {
  if (ctx.args.netPrevious) return path.resolve(ctx.args.netPrevious);
  if (ctx.currentLabel) {
    const p = path.join(REPO, "records", "take-in", ctx.currentLabel, "netaudit", "destinations.json");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function corePlan(ctx) {
  const a = ctx.args;
  const common = [...(a.config ? ["--config", a.config] : []), "--build-root", ctx.buildRoot];
  return {
    builderWorktree: { cmd: "git", args: ["-C", REPO, "worktree", "add", "-b", ctx.branch, ctx.bwt, "main"] },
    prepare: { cmd: NODE, args: [path.join(SCRIPT_DIR, "build.mjs"), ctx.tag, "--label", ctx.label, "--commit", ctx.commit || "<ls-remote>", "--to", "prepare", "--record", path.join(ctx.recDir, "build-prepare.json"), "--no-size", ...common], cwd: REPO },
    apply: {
      cmd: NODE,
      args: [path.join(SCRIPT_DIR, "apply.mjs"), ctx.wt, "--label", ctx.label, "--keep-conflict", "--checks-out", path.join(ctx.recDir, "checks.json"),
        ...(ctx.prevTag ? ["--prev-tag", ctx.prevTag] : []),
        "--removals", path.join(ctx.bwt, "removals"), "--patches", path.join(ctx.bwt, "patches"), "--assets", path.join(ctx.bwt, "assets"),
        "--overlay", path.join(ctx.bwt, "product.overlay.json"), "--keep", path.join(ctx.bwt, "builtin", "keep.json"),
        "--lock", path.join(ctx.bwt, "extensions.lock.json"), "--extensions-src", path.join(REPO, "extensions-src"),
        // --manifests の既定（<buildRoot>\cache\vsix）を take-in と同じ buildRoot・local.json で決めさせる（検証 M-1）
        ...common],
      cwd: REPO,
    },
    build: { cmd: NODE, args: [path.join(SCRIPT_DIR, "build.mjs"), ctx.tag, "--label", ctx.label, "--commit", ctx.commit || "<ls-remote>", "--from", "install", "--force-zip", "--record", path.join(ctx.recDir, "build-main.json"), "--removals", path.join(ctx.bwt, "removals"), "--keep", path.join(ctx.bwt, "builtin", "keep.json"), "--take-in-dir", ctx.recDir, "--worktree", ctx.wt, ...common], cwd: REPO },
    expand: { cmd: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(SCRIPT_DIR, "switch.ps1"), ctx.label, "-Zip", path.join(ctx.buildRoot, "dist", `${ctx.label}.zip`), "-Sha256", "<build の sha256>", "-ExpandOnly", ...(a.config ? ["-ConfigPath", a.config] : []), ...(a.installRoot ? ["-InstallRoot", a.installRoot] : [])], supported: switchSupportsExpandOnly() },
    smoke: smokeRunArgs({ editorDir: "<editor>", label: ctx.label, currentBaseline: smokeBaselineFor(ctx), newBaseline: newBaselinePath(path.join(ctx.buildRoot, "smoke"), ctx.label) })
      .map((r) => ({ n: r.n, cmd: NODE, args: [path.join(REPO, "tests", "smoke-run.mjs"), ...r.args], cwd: REPO })),
    absent: { cmd: NODE, args: [path.join(REPO, "tests", "absent-run.mjs"), "--build", "<editor>", "--units", "<当てた単位>", "--expect", "absent", "--label", `take-in-${ctx.label}`], cwd: REPO },
    netEnv: a.netEnv
      ? { given: path.resolve(a.netEnv) }
      : { cmd: NODE, args: [path.join(SCRIPT_DIR, "install-extensions.mjs"), ...netEnvInstallArgs({ cli: "<新しい版の bin\\<applicationName>.cmd>", envDir: path.join(ctx.buildRoot, "take-in", ctx.label, "netaudit-env"), lock: path.join(ctx.bwt, "extensions.lock.json"), out: path.join(ctx.recDir, "netaudit-env", "install-extensions.json"), buildRoot: ctx.buildRoot, config: a.config })], cwd: REPO, thenWrites: { settings: NETAUDIT_SETTINGS } },
    netaudit: { cmd: "powershell", args: netauditArgs({ script: path.join(SCRIPT_DIR, "netaudit.ps1"), exe: "<editor の exe>", envDir: a.netEnv ? path.resolve(a.netEnv) : path.join(ctx.buildRoot, "take-in", ctx.label, "netaudit-env"), label: ctx.label, duration: a.netDuration, outDir: path.join(ctx.recDir, "netaudit"), previous: netPreviousFor(ctx), workRoot: path.join(ctx.buildRoot, "take-in", ctx.label, "netaudit-run") }), cwd: REPO },
  };
}

async function runCore(a) {
  const cfg = resolveLocalConfig({ configPath: a.config || undefined, overrides: { buildRoot: a.buildRoot || undefined, installRoot: a.installRoot || undefined } });
  const up = mainUpstream();
  const ctx = { kind: "core", args: a, dryRun: a.dryRun, buildRoot: cfg.buildRoot, installRoot: cfg.installRoot, tag: a.tag, rec: newRecord("core", a) };
  CURRENT = ctx;
  ctx.prevTag = a.prevTag || up.tag || null;
  ctx.repository = up.repository || "https://github.com/microsoft/vscode.git";
  ctx.label = a.label || nextLabel(a.tag, existingLabels());
  ctx.recDir = a.recordsDir ? path.resolve(a.recordsDir) : path.join(REPO, "records", "take-in", ctx.label);
  ctx.branch = branchFor(ctx.label);
  ctx.bwt = a.builderWorktree ? path.resolve(a.builderWorktree) : path.join(ctx.buildRoot, "take-in", ctx.label, "repo");
  ctx.wt = path.join(ctx.buildRoot, "wt", a.tag);
  if (a.recordsDir && !path.resolve(a.recordsDir).toLowerCase().startsWith(REPO.toLowerCase()) && !a.skipJudge) {
    ctx.rec.warnings.push("--records-dir がビルドリポジトリの外。判定役は読めない");
  }
  ctx.commit = a.commit ? a.commit.toLowerCase() : null;
  ctx.currentLabel = currentLabel(ctx.installRoot);
  ctx.claudePath = resolveClaudePath(a) || "claude";
  ctx.rec.label = ctx.label;
  Object.assign(ctx.rec, { tag: a.tag, prevTag: ctx.prevTag, branch: ctx.branch, paths: { recDir: rel(ctx.recDir), builderWorktree: ctx.bwt, worktree: ctx.wt, buildRoot: ctx.buildRoot, installRoot: ctx.installRoot }, currentLabel: ctx.currentLabel, claudePath: ctx.claudePath });
  const watch = readWatchStatus({ statePath: a.watchState || path.join(process.env.LOCALAPPDATA || "", "Shuko", "watch", "state.json") });
  ctx.rec.watch = watch;
  if (watch.warn) log(`警告: ${watch.message}`);
  if (ctx.prevTag === a.tag) throw new Stop(`タグ ${a.tag} は main の upstream.json と同じ（取り込むものが無い）`, 3);
  const steps = selectCoreSteps(a.from, a.to).map((s) => s.n);
  const run = (n) => steps.includes(n);

  if (a.dryRun) {
    const plan = corePlan(ctx);
    const inv = {
      repair: describeInvocation(buildClaudeInvocation({ kind: "repair", repoRoot: REPO, worktree: ctx.wt, builderWorktree: ctx.bwt, prompt: REPAIR_PROMPT, input: "(修理の依頼の本文)", claudePath: ctx.claudePath, model: a.repairModel, rulesFile: path.join(REPO, "TAKE-IN.md") })),
      verdict: describeInvocation(buildClaudeInvocation({ kind: "verdict", repoRoot: REPO, prompt: JUDGE_PROMPT(`records/take-in/${ctx.label}/judge-request.md`), claudePath: ctx.claudePath })),
    };
    const out = { result: "dry-run", label: ctx.label, tag: a.tag, prevTag: ctx.prevTag, commit: ctx.commit || "(git ls-remote で取る)", branch: ctx.branch, steps: CORE_STEPS.filter((s) => run(s.n)), paths: ctx.rec.paths, currentLabel: ctx.currentLabel, watch, plan, claude: inv, recordDirExists: fs.existsSync(ctx.recDir), expandOnlySupported: plan.expand.supported };
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }
  if (fs.existsSync(path.join(ctx.recDir, "take-in.json")) && (!a.from || a.from === "prepare" || a.from === "1")) {
    throw new Stop(`${rel(ctx.recDir)} が既にある（続きからは --label ${ctx.label} --from <手順>、やり直しは別のラベル）`);
  }
  if (a.from && a.from !== "prepare" && a.from !== "1" && !fs.existsSync(path.join(ctx.bwt, a.builderWorktree ? "" : ".git"))) throw new Stop(`--from ${a.from} にはブランチの作業ツリー ${ctx.bwt} が要る`);
  fs.mkdirSync(ctx.recDir, { recursive: true });
  const prevRec = readJsonOrNull(path.join(ctx.recDir, "take-in.json"));
  if (prevRec && prevRec.commit && !ctx.commit) ctx.commit = prevRec.commit;
  if (prevRec) ctx.rec.repairs = prevRec.repairs || [];
  save(ctx);
  const plan = corePlan(ctx);

  // 手順 1
  if (run(1)) {
    const s = step(ctx, 1, "prepare");
    if (!ctx.commit) {
      const r = sh("git", ["ls-remote", ctx.repository, `refs/tags/${a.tag}`, `refs/tags/${a.tag}^{}`]);
      ctx.commit = r.status === 0 ? parseLsRemote(r.stdout, a.tag) : null;
      s.lsRemote = { status: r.status, commit: ctx.commit };
    }
    if (nextAction(1, { ok: !!ctx.commit }) === "stop") {
      finishStep(ctx, s, "error", { message: `タグ ${a.tag} が ${ctx.repository} に無い` });
      throw new Stop(`タグ ${a.tag} が無い`);
    }
    ctx.rec.commit = ctx.commit;
    const bw = ensureBuilderWorktree(ctx);
    const upPath = path.join(ctx.bwt, "upstream.json");
    const cur = readJsonOrNull(upPath) || {};
    const next = { ...cur, tag: a.tag, commit: ctx.commit, repository: cur.repository || ctx.repository };
    writeJson(upPath, next);
    const upCommit = commitBuilder(ctx, ["upstream.json"], `取り込み ${ctx.label}: upstream.json を ${a.tag} に`);
    // 同じタグの作業ツリーが前の取り込みで当てた後のまま残っていれば、タグの commit に戻す（使い捨ての作業ツリー。prepare.mjs は当てた後を拒む）
    if (fs.existsSync(path.join(ctx.wt, ".git")) && !worktreePristine(ctx.wt, ctx.commit)) {
      resetWorktree(ctx.wt, ctx.commit);
      s.worktreeReset = true;
    }
    const p = corePlan(ctx).prepare;
    const r = await runLogged({ ...p, logFile: path.join(ctx.recDir, "logs", "prepare.log") });
    const info = await fetchUpstreamInfo({ prevTag: ctx.prevTag, newTag: a.tag, outDir: path.join(ctx.recDir, "upstream") });
    if (info.errors.length) ctx.rec.warnings.push(...info.errors);
    finishStep(ctx, s, r.exitCode === 0 ? "ok" : "error", { builderWorktree: bw, upstreamCommit: upCommit, exitCode: r.exitCode, upstreamInfo: { releases: info.releases, advisories: info.advisories, errors: info.errors } });
    if (nextAction(1, { ok: r.exitCode === 0 }) === "stop") throw new Stop(`本家の作業ツリーを用意できない（build.mjs --to prepare が ${r.exitCode}）`);
  }
  if (!ctx.commit) throw new Stop("タグの commit が分からない（--commit を渡すか、手順 1 から）");
  ctx.rec.commit = ctx.commit;

  // 手順 2〜5（修理で手順 2 に戻る）
  let applyRepairs = 0;
  let typeRepairs = 0;
  let buildRec = null;
  let checks = null;
  let loopGuard = 0;
  const stepsBuild = run(5);
  if (run(2) || run(3) || run(4) || run(5)) {
    for (;;) {
      if (loopGuard++ > 2 * a.maxRepair + 3) throw new Stop("やり直しの回数が多すぎる");
      if (run(2)) {
        const s = step(ctx, 2, "apply", { round: loopGuard });
        if (!worktreePristine(ctx.wt, ctx.commit)) resetWorktree(ctx.wt, ctx.commit);
        const r = await runLogged({ ...plan.apply, logFile: path.join(ctx.recDir, "logs", `apply-${loopGuard}.log`) });
        checks = readJsonOrNull(path.join(ctx.recDir, "checks.json"));
        const failure = classifyApplyFailure(checks);
        const ok = !!checks && !checks.stoppedAt;
        finishStep(ctx, s, ok ? "ok" : "error", { command: [plan.apply.cmd, ...plan.apply.args].join(" "), exitCode: r.exitCode, result: checks && checks.result, stoppedAt: checks && checks.stoppedAt, failure: ok ? undefined : failure });
        const act = nextAction(2, { ok, repairable: failure.repairable, noRepair: a.noRepair || !run(3) });
        if (act === "stop") {
          // 修理しない指定のときは、修理の依頼文と起動の引数だけを残す（ユーザーが手で直すときの材料）
          if (!ok && failure.repairable) previewRepair(ctx, failure);
          throw new Stop(`当て直しが止まった: ${checks && checks.stoppedAt ? checks.stoppedAt.message : "checks.json が無い"}`);
        }
        if (act === "repair") {
          if (applyRepairs >= a.maxRepair) throw new Stop(`修理を ${applyRepairs} 回しても当たらない: ${failure.message}`);
          applyRepairs++;
          const s3 = step(ctx, 3, "repair", { attempt: applyRepairs, mode: "apply", failure });
          const rr = await repairApply(ctx, failure, applyRepairs);
          finishStep(ctx, s3, rr.ok ? "ok" : "error", { message: rr.message });
          if (rr.needsJudgment) throw new Stop(`修理に要判断がある: ${rr.message}`);
          const act3 = nextAction(3, { ok: rr.ok, attempt: applyRepairs, max: a.maxRepair });
          if (act3 === "stop") throw new Stop(`修理が ${applyRepairs} 回で直らない: ${rr.message}`);
          continue; // retry / repair: どちらも手順 2 から（衝突の状態を作り直す）
        }
      } else checks = readJsonOrNull(path.join(ctx.recDir, "checks.json"));

      if (run(4)) {
        const s = step(ctx, 4, "checks");
        const o = checksOutcome(checks);
        const act = nextAction(4, o);
        finishStep(ctx, s, act === "next" ? "ok" : act === "hold" ? "hold" : "error", { outcome: o });
        if (act === "stop") throw new Stop(`適用後の検査を満たさない: ${o.reason}`);
      }

      if (stepsBuild) {
        const s = step(ctx, 5, "build", { round: loopGuard });
        const r = await runLogged({ ...plan.build, logFile: path.join(ctx.recDir, "logs", `build-${loopGuard}.log`) });
        buildRec = readJsonOrNull(path.join(ctx.recDir, "build-main.json"));
        const ok = r.exitCode === 0 && buildRec && buildRec.result === "ok";
        const typecheck = !!buildRec && buildRec.stoppedAt === "typecheck";
        finishStep(ctx, s, ok ? "ok" : "error", { exitCode: r.exitCode, stoppedAt: buildRec && buildRec.stoppedAt, zip: buildRec && buildRec.zip });
        const act = nextAction(5, { ok, typecheck, attempt: typeRepairs, max: a.maxRepair, noRepair: a.noRepair || !run(3) });
        if (act === "stop") throw new Stop(`ビルドが通らない（${buildRec ? buildRec.message || buildRec.stoppedAt : `build.mjs が ${r.exitCode}`}）`);
        if (act === "repair") {
          typeRepairs++;
          const s3 = step(ctx, 3, "repair", { attempt: typeRepairs, mode: "typecheck" });
          const rr = await repairTypecheck(ctx, buildRec, typeRepairs);
          finishStep(ctx, s3, rr.ok ? "ok" : "error", { message: rr.message });
          if (rr.needsJudgment) throw new Stop(`型検査の修理に要判断がある: ${rr.message}`);
          if (!run(2)) throw new Stop("型検査を直したが、--from が手順 2 より後ろなので当て直せない");
          continue; // 手順 2 から
        }
        // 版のフォルダへの展開（take-in-design.md の6節）
        const zip = buildRec.zip;
        if (switchSupportsExpandOnly() && zip) {
          const e = corePlan(ctx).expand;
          e.args[e.args.indexOf("<build の sha256>")] = zip.sha256;
          // 版のフォルダが既にある（やり直し）ときは、-Zip を外して確かめだけを行う（-Zip は既にあるラベルを拒む）
          if (fs.existsSync(path.join(ctx.installRoot, "versions", ctx.label))) {
            const zi = e.args.indexOf("-Zip");
            e.args.splice(zi, 4);
            ctx.rec.warnings.push(`版のフォルダ versions\\${ctx.label} が前からあった。展開し直さず確かめだけをした（新しい zip と違うなら、そのフォルダを消してやり直す）`);
          }
          const er = sh(e.cmd, e.args, { cwd: REPO });
          s.expand = { status: er.status, stdout: er.stdout.slice(-4000) };
          ctx.editorDir = er.status === 0 ? path.join(ctx.installRoot, "versions", ctx.label) : null;
        } else {
          s.expand = { status: "blocked", message: "switch.ps1 に -ExpandOnly が無い。版のフォルダに展開せず、gulp の出力でスモークと監査を行う（take-in-design.md の6節）" };
          ctx.rec.warnings.push(s.expand.message);
        }
        save(ctx);
      }
      break;
    }
  }
  if (!buildRec) buildRec = readJsonOrNull(path.join(ctx.recDir, "build-main.json"));
  if (!checks) checks = readJsonOrNull(path.join(ctx.recDir, "checks.json"));
  if (a.editorDir) ctx.editorDir = path.resolve(a.editorDir);
  if (!ctx.editorDir) {
    const prevExpand = path.join(ctx.installRoot, "versions", ctx.label);
    ctx.editorDir = fs.existsSync(prevExpand) ? prevExpand : buildRec && buildRec.paths ? buildRec.paths.packageDir : path.join(path.dirname(ctx.wt), "VSCode-win32-x64");
  }

  // 手順 6（docs/06 の9節: 今の版の基準と比べたうえで、--prime の3回の和を新しい版の基準として残す）
  let smoke = null;
  if (run(6)) {
    const s = step(ctx, 6, "smoke", { editor: ctx.editorDir });
    const currentBaseline = smokeBaselineFor(ctx);
    const newBaseline = newBaselinePath(path.join(ctx.buildRoot, "smoke"), ctx.label);
    const runs = [];
    for (const r0 of smokeRunArgs({ editorDir: ctx.editorDir, label: ctx.label, currentBaseline, newBaseline })) {
      const r = await runLogged({ cmd: NODE, args: [path.join(REPO, "tests", "smoke-run.mjs"), ...r0.args], cwd: REPO, logFile: path.join(ctx.recDir, "logs", `smoke-${r0.n}.log`) });
      const m = /結果: (.+)\\smoke-result\.md/.exec(r.output || "");
      if (m) copySmokeResult(m[1].trim(), path.join(ctx.recDir, "smoke", `run-${r0.n}`));
      runs.push({ n: r0.n, exitCode: r.exitCode, runDir: m ? m[1].trim() : null });
      s.runs = runs;
      save(ctx);
    }
    const baselineSaved = fs.existsSync(newBaseline);
    if (baselineSaved) fs.copyFileSync(newBaseline, path.join(ctx.recDir, "smoke", path.basename(newBaseline)));
    const ids = (checks && checks.units ? checks.units.filter((u) => u.applied === "ok").map((u) => u.id) : []);
    let absent = { status: "skipped", reason: "当てた単位が無い" };
    if (ids.length) {
      const pa = corePlan(ctx).absent;
      pa.args[pa.args.indexOf("<editor>")] = ctx.editorDir;
      pa.args[pa.args.indexOf("<当てた単位>")] = ids.join(",");
      const ar = await runLogged({ ...pa, logFile: path.join(ctx.recDir, "logs", "absent.log") });
      const am = /結果: (.+absent-result\.json)/.exec(ar.output || "");
      if (am && fs.existsSync(am[1].trim())) {
        fs.mkdirSync(path.join(ctx.recDir, "absent"), { recursive: true });
        fs.copyFileSync(am[1].trim(), path.join(ctx.recDir, "absent", "absent-result.json"));
      }
      absent = { status: ar.exitCode === 0 ? "ok" : "failed", exitCode: ar.exitCode };
    }
    smoke = { ...summarizeSmoke(runs, { absent, baselineSaved, currentBaseline }), newBaseline: baselineSaved ? newBaseline : null, runDetails: runs };
    if (!currentBaseline) ctx.rec.warnings.push("今の版のスモークの基準が無い。新しい誤りを比べていない");
    finishStep(ctx, s, smoke.status, smoke);
    nextAction(6, { ok: smoke.status === "ok" });
  }

  // 手順 7（docs/06 の9節: 新しい版の CLI で、台帳の拡張を入れた一時の環境を作って netaudit.ps1 -EnvDir に渡す）
  let net = null;
  if (run(7)) {
    const s = step(ctx, 7, "netaudit");
    let layout = null;
    try {
      layout = resolveEditorLayout(ctx.editorDir);
    } catch (err) {
      net = { status: "failed", reason: `新しい版の形を読めない: ${err.message}` };
    }
    let envDir = a.netEnv ? path.resolve(a.netEnv) : null;
    if (layout && !envDir) {
      const env = await buildNetEnv(ctx, layout);
      s.env = env;
      if (env.ok) envDir = env.envDir;
      else net = { status: "failed", reason: `通信の監査の環境を作れない: ${env.message}`, env };
    }
    if (layout && envDir) {
      const args = netauditArgs({
        script: path.join(SCRIPT_DIR, "netaudit.ps1"), exe: layout.exe, envDir, label: ctx.label, duration: a.netDuration,
        outDir: path.join(ctx.recDir, "netaudit"), previous: netPreviousFor(ctx), workRoot: path.join(ctx.buildRoot, "take-in", ctx.label, "netaudit-run"),
      });
      s.command = ["powershell", ...args].join(" ");
      const r = await runLogged({ cmd: "powershell", args, cwd: REPO, logFile: path.join(ctx.recDir, "logs", "netaudit.log") });
      const hosts = auditHosts(readJsonOrNull(path.join(ctx.recDir, "netaudit", "destinations.json")));
      net = r.exitCode !== 0 || !hosts
        ? { status: "failed", exitCode: r.exitCode, envDir }
        : { status: hosts.notAllowed.length ? "attention" : "ok", notAllowed: hosts.notAllowed, newHosts: hosts.newHosts, previous: netPreviousFor(ctx), envDir };
    }
    finishStep(ctx, s, net.status, net);
  }

  // 手順 9
  let judged = null;
  if (run(9)) {
    const s = step(ctx, 9, "judge");
    // 修理したパッチをブランチにコミットし、main からの差を材料にする
    const repaired = commitBuilder(ctx, ["removals", "patches"], `取り込み ${ctx.label}: 当て直しの修理`);
    writeBranchDiff(ctx, ["removals", "patches"]);
    if (buildRec && buildRec.stoppedAt === "typecheck") typecheckTail(ctx, buildRec);
    const facts = factsFrom({ kind: "core", checks, buildMain: buildRec, smoke, netaudit: net ? { status: net.status === "attention" ? "ok" : net.status, notAllowed: net.notAllowed || [] } : null });
    if (a.skipJudge) {
      finishStep(ctx, s, "skipped", { repairedCommit: repaired, facts });
    } else {
      judged = await judge(ctx, { facts, notes: ctx.rec.warnings.slice() });
      finishStep(ctx, s, judged.v ? "ok" : "error", { repairedCommit: repaired, verdict: judged.v ? judged.v.verdict : null, invalid: judged.invalid, guard: judged.guard });
    }
  }

  // 手順 10
  if (run(10)) {
    const s = step(ctx, 10, "record");
    if (buildRec) {
      const prep = readJsonOrNull(path.join(ctx.recDir, "build-prepare.json"));
      writeJson(path.join(REPO, "records", "builds", `${ctx.label}.json`), composeBuildRecord({ label: ctx.label, tag: a.tag, commit: ctx.commit, main: buildRec, prepare: prep, checks }));
    }
    const wb = await recordAndWriteBack(ctx, judged, { kind: "core" });
    finishStep(ctx, s, wb.ok ? "ok" : "warn", { writeback: wb });
  }
  ctx.rec.result = judged && judged.v ? "judged" : run(9) && !a.skipJudge ? "judge-failed" : "partial";
  ctx.rec.finishedAt = new Date().toISOString();
  save(ctx);
  printSummary(ctx);
  return ctx.rec.result === "judge-failed" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 拡張（ext）
// ---------------------------------------------------------------------------

async function runExt(a) {
  const cfg = resolveLocalConfig({ configPath: a.config || undefined, overrides: { buildRoot: a.buildRoot || undefined, installRoot: a.installRoot || undefined } });
  const ctx = { kind: "ext", args: a, dryRun: a.dryRun, buildRoot: cfg.buildRoot, installRoot: cfg.installRoot, rec: newRecord("ext", a) };
  CURRENT = ctx;
  ctx.claudePath = resolveClaudePath(a) || "claude";
  ctx.currentLabel = currentLabel(ctx.installRoot);
  const ledgerPath = path.join(REPO, "extensions.lock.json");
  const ledger = readJsonOrNull(ledgerPath) || [];
  const entry = ledger.find((e) => e && String(e.id).toLowerCase() === a.id);
  if (!entry) throw new Stop(`${a.id} は台帳に無い（取り込みは台帳の拡張の版を上げるだけ。新しく載せるのは docs/04 の手順）`);
  const runDir = path.join(ctx.buildRoot, "take-in", "ext", a.id, stamp());
  const fetchArgs = [path.join(SCRIPT_DIR, "lock-fetch.mjs"), "--lock", ledgerPath, "--only", a.id, "--out", runDir, ...(a.security ? ["--security", a.id] : []), ...(a.now ? ["--now", a.now] : [])];
  if (a.version) fetchArgs.push("--seed", path.join(runDir, "seed.json"));
  const watch = readWatchStatus({ statePath: a.watchState || path.join(process.env.LOCALAPPDATA || "", "Shuko", "watch", "state.json") });
  ctx.rec.watch = watch;
  if (watch.warn) log(`警告: ${watch.message}`);
  let editorVersion = null;
  try {
    editorVersion = resolveEditorLayout(path.join(ctx.installRoot, "current")).version;
  } catch {
    editorVersion = mainUpstream().tag || null;
  }
  if (a.dryRun) {
    const label = a.version ? extLabel(a.id, a.version) : extLabel(a.id, "<lock-fetch が選ぶ版>");
    const out = {
      result: "dry-run", id: a.id, ledgerVersion: entry.version, requested: a.version, label, branch: `take-in/${label}`, runDir, editorVersion, watch,
      plan: {
        fetch: { cmd: NODE, args: fetchArgs },
        verify: { cmd: NODE, args: [path.join(SCRIPT_DIR, "lock-verify.mjs"), "--dir", runDir, "--only", a.id, "--vscode", editorVersion || "?", "--prev-lock", ledgerPath, "--prev-dir", "<前の版の取得場所>", "--write-lock", path.join(ctx.buildRoot, "take-in", label, "repo", "extensions.lock.json"), "--result", path.join(REPO, "records", "take-in", label, "verify-result.json")] },
        diff: { cmd: NODE, args: [path.join(SCRIPT_DIR, "lock-diff.mjs"), "--from", "<前>", "--to", "<新>", "--json"] },
        smoke: { cmd: NODE, args: [path.join(REPO, "tests", "smoke-run.mjs"), "--build", path.join(ctx.installRoot, "current"), "--label", `take-in-${label}`, "--mode", "built", "--lock", "<ブランチの台帳>", "--prime"] },
      },
      claude: { verdict: describeInvocation(buildClaudeInvocation({ kind: "verdict", repoRoot: REPO, prompt: JUDGE_PROMPT(`records/take-in/${label}/judge-request.md`), claudePath: ctx.claudePath })) },
      prevFetchCandidates: prevFetchCandidates({ buildRoot: ctx.buildRoot, id: a.id }),
    };
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  // 1 取得
  fs.mkdirSync(runDir, { recursive: true });
  if (a.version) writeJson(path.join(runDir, "seed.json"), seedFor(ledger, a.id, a.version));
  const fr = await runLogged({ cmd: NODE, args: fetchArgs, cwd: REPO, logFile: path.join(runDir, "lock-fetch.log") });
  const fetched = readJsonOrNull(path.join(runDir, "fetch-result.json"));
  const item = pickFetchedItem(fetched, a.id);
  const d = decideExtVersion(item, { requested: a.version, ledgerVersion: entry.version });
  if (!d.ok) {
    console.log(JSON.stringify({ result: d.noNewVersion ? "no-new-version" : "stopped", id: a.id, reason: d.reason, fetchExit: fr.exitCode, runDir }, null, 2));
    return d.noNewVersion ? 3 : 1;
  }
  ctx.label = a.label || extLabel(a.id, d.version);
  ctx.rec.label = ctx.label;
  ctx.recDir = a.recordsDir ? path.resolve(a.recordsDir) : path.join(REPO, "records", "take-in", ctx.label);
  if (fs.existsSync(path.join(ctx.recDir, "take-in.json"))) throw new Stop(`${rel(ctx.recDir)} が既にある`);
  ctx.branch = branchFor(ctx.label);
  ctx.bwt = a.builderWorktree ? path.resolve(a.builderWorktree) : path.join(ctx.buildRoot, "take-in", ctx.label, "repo");
  Object.assign(ctx.rec, { id: a.id, version: d.version, ledgerVersion: entry.version, branch: ctx.branch, runDir, editorVersion, paths: { recDir: rel(ctx.recDir), builderWorktree: ctx.bwt } });
  fs.mkdirSync(ctx.recDir, { recursive: true });
  const s1 = step(ctx, 1, "fetch");
  fs.copyFileSync(path.join(runDir, "fetch-result.json"), path.join(ctx.recDir, "fetch-result.json"));
  finishStep(ctx, s1, "ok", { exitCode: fr.exitCode, version: d.version, reason: d.reason, runDir });

  // 2 検証と台帳（ブランチの作業ツリーに書く）
  const s2 = step(ctx, 2, "verify");
  ensureBuilderWorktree(ctx);
  const prev = findPrevFetchDir(prevFetchCandidates({ buildRoot: ctx.buildRoot, id: a.id }).filter((c) => path.resolve(c) !== path.resolve(runDir)), a.id, entry.version);
  const verifyArgs = [path.join(SCRIPT_DIR, "lock-verify.mjs"), "--dir", runDir, "--only", a.id, "--vscode", editorVersion || "1.146.0", "--prev-lock", ledgerPath, ...(prev ? ["--prev-dir", prev.dir] : []), "--write-lock", path.join(ctx.bwt, "extensions.lock.json"), "--result", path.join(ctx.recDir, "verify-result.json")];
  const vr = await runLogged({ cmd: NODE, args: verifyArgs, cwd: REPO, logFile: path.join(ctx.recDir, "logs", "lock-verify.log") });
  const bl = readJsonOrNull(path.join(ctx.bwt, "extensions.lock.json")) || [];
  const sv = setLedgerVerdict(bl, item.id, d.version, `records/take-in/${ctx.label}/verdict.md`);
  if (sv.hit) writeJson(path.join(ctx.bwt, "extensions.lock.json"), sv.lock);
  finishStep(ctx, s2, vr.exitCode === 0 ? "ok" : "failed", { exitCode: vr.exitCode, prevFetch: prev, ledgerRowWritten: sv.hit });
  if (!prev) ctx.rec.warnings.push(`前の版 ${entry.version} の取得場所（files.json）が見つからない。manifest とファイル一覧の差は見られない`);

  // 3 差
  const s3 = step(ctx, 3, "diff");
  if (prev) {
    const dr = sh(NODE, [path.join(SCRIPT_DIR, "lock-diff.mjs"), "--from", prev.itemDir, "--to", item.dir, "--json"], { cwd: REPO });
    writeText(path.join(ctx.recDir, "lock-diff.json"), dr.stdout);
    finishStep(ctx, s3, dr.status === 0 ? "ok" : dr.status === 2 ? "attention" : "failed", { exitCode: dr.status });
  } else finishStep(ctx, s3, "skipped", { reason: "前の版の取得場所が無い" });

  // 4 スモーク（台帳の新しい版を入れた一時的な拡張の置き場所。docs/04 の4節の10）
  const s4 = step(ctx, 4, "smoke");
  let smoke = null;
  const editorDir = a.editorDir ? path.resolve(a.editorDir) : path.join(ctx.installRoot, "current");
  if (fs.existsSync(editorDir)) {
    const base = a.smokeBaseline || (ctx.currentLabel ? path.join(ctx.buildRoot, "smoke", `baseline-${ctx.currentLabel}.json`) : null);
    const args = [path.join(REPO, "tests", "smoke-run.mjs"), "--build", editorDir, "--label", `take-in-${ctx.label}`, "--mode", "built", "--lock", path.join(ctx.bwt, "extensions.lock.json"), "--prime", "--timeout", "600", ...(base && fs.existsSync(base) ? ["--baseline", base] : [])];
    const r = await runLogged({ cmd: NODE, args, cwd: REPO, logFile: path.join(ctx.recDir, "logs", "smoke.log") });
    const m = /結果: (.+)\\smoke-result\.md/.exec(r.output || "");
    if (m) copySmokeResult(m[1].trim(), path.join(ctx.recDir, "smoke"));
    smoke = { status: r.exitCode === 0 ? "ok" : "failed", exitCode: r.exitCode };
  } else smoke = { status: "skipped", reason: `${editorDir} が無い（今の版が無い）` };
  finishStep(ctx, s4, smoke.status, smoke);

  // 5 判定
  const s5 = step(ctx, 5, "judge");
  commitBuilder(ctx, ["extensions.lock.json"], `取り込み ${ctx.label}: 台帳`);
  writeBranchDiff(ctx, ["extensions.lock.json"]);
  const facts = factsFrom({ kind: "ext", smoke });
  let judged = null;
  if (!a.skipJudge) {
    judged = await judge(ctx, { facts, notes: ctx.rec.warnings.slice(), extra: { extId: a.id, extVersion: d.version, prevExtVersion: entry.version } });
    finishStep(ctx, s5, judged.v ? "ok" : "error", { verdict: judged.v ? judged.v.verdict : null, invalid: judged.invalid, guard: judged.guard });
  } else finishStep(ctx, s5, "skipped");

  // 6 記録と書き戻し
  const s6 = step(ctx, 6, "record");
  // 台帳の ID を大文字小文字のまま渡す（検知が ToDo の題名に書く ID と同じにする。検証 M-2）
  const wb = await recordAndWriteBack(ctx, judged, { kind: "ext", id: entry.id });
  finishStep(ctx, s6, wb.ok ? "ok" : "warn", { writeback: wb });
  ctx.rec.result = judged && judged.v ? "judged" : a.skipJudge ? "partial" : "judge-failed";
  ctx.rec.finishedAt = new Date().toISOString();
  save(ctx);
  printSummary(ctx);
  return ctx.rec.result === "judge-failed" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 起動の試し（probe-claude）
// ---------------------------------------------------------------------------

async function runProbe(a) {
  const cfg = resolveLocalConfig({ configPath: a.config || undefined, overrides: { buildRoot: a.buildRoot || undefined } });
  const out = a.out ? path.resolve(a.out) : path.join(cfg.buildRoot, "take-in", "probe", stamp());
  fs.mkdirSync(out, { recursive: true });
  const claudePath = resolveClaudePath(a);
  const res = { claudePath, version: null, invocation: null, exitCode: null, parsed: null };
  if (!claudePath) throw new Stop(`claude.exe が見つからない（--claude で渡す）。候補: ${claudeCandidates(process.env).join(", ") || "なし"}`);
  res.version = claudeVersion(claudePath);
  const inv = buildClaudeInvocation({
    kind: "probe",
    repoRoot: REPO,
    prompt: "これは take-in.mjs の起動の試しである。ファイルを読まず、ほかの道具も使わず、ok に true、agent にあなたの名前（定義の name）を入れて構造化出力で返せ。",
    claudePath,
    schema: PROBE_SCHEMA,
  });
  res.invocation = describeInvocation(inv);
  if (a.dryRun) {
    console.log(JSON.stringify({ result: "dry-run", ...res }, null, 2));
    return 0;
  }
  const r = await runClaude(inv, { timeoutMs: 10 * 60 * 1000 });
  res.exitCode = r.exitCode;
  res.seconds = r.seconds;
  writeText(path.join(out, "claude-output.json"), r.stdout);
  if (r.stderr.trim()) writeText(path.join(out, "claude-stderr.txt"), r.stderr);
  res.parsed = parseClaudeOutput(r.stdout);
  writeJson(path.join(out, "probe.json"), res);
  console.log(JSON.stringify({ result: res.parsed.ok ? "ok" : "error", out, ...res }, null, 2));
  return res.parsed.ok ? 0 : 1;
}

function printSummary(ctx) {
  const v = ctx.rec.verdict;
  console.log(JSON.stringify({ result: ctx.rec.result, label: ctx.label, branch: ctx.branch, verdict: v ? v.verdict : null, recommendation: v ? v.recommendation : null, verdictMd: `records/take-in/${ctx.label}/verdict.md`, warnings: ctx.rec.warnings, next: v && v.verdict ? `読む: records/take-in/${ctx.label}/verdict.md → 採るなら node scripts/adopt.mjs ${ctx.label}` : null }, null, 2));
}

export async function main(argv = process.argv.slice(2)) {
  let a;
  try {
    a = parseTakeInArgs(argv);
  } catch (err) {
    if (err instanceof ArgError) {
      console.error(`[take-in] 引数の誤り: ${err.message}\n${USAGE}`);
      return 2;
    }
    throw err;
  }
  try {
    if (a.command === "core") return await runCore(a);
    if (a.command === "ext") return await runExt(a);
    return await runProbe(a);
  } catch (err) {
    const ctx = CURRENT;
    if (ctx && !ctx.dryRun && ctx.recDir && fs.existsSync(ctx.recDir)) {
      for (const s of ctx.rec.steps) if (s.status === "running") Object.assign(s, { status: "error", finishedAt: new Date().toISOString() });
      Object.assign(ctx.rec, { result: err instanceof Stop ? "stopped" : "crashed", message: err.message, finishedAt: new Date().toISOString() });
      save(ctx);
    }
    if (err instanceof Stop) {
      console.error(`[take-in] 止めた: ${err.message}`);
      return err.code;
    }
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err.stack || String(err));
      process.exitCode = 1;
    },
  );
}
