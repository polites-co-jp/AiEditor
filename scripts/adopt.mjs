#!/usr/bin/env node
// 採ると決めた版の確定（docs/06 の8節の2、docs/02 の2・7節）: 取り込みのブランチ take-in/<label> を main に取り込み、
// upstream.json（core）・台帳（ext）を確定し、記録をコミットし、タグ <label> を打つ。プッシュはしない。
// 入れ替えそのもの（switch.ps1）と拡張の入れ直し（install-extensions.mjs）はユーザーが行う。
//
// 使い方: node scripts/adopt.mjs <label> [--force] [--no-records] [--keep-branch] [--dry-run] [--config <local.json>] [--build-root <dir>]
//   --force       判定が不合格（fail）でも採る
//   --no-records  records/take-in/<label>/ と records/builds/<label>.json をコミットしない
//   --keep-branch ブランチ take-in/<label> を消さない
//   --dry-run     確かめだけをして、計画を出す
// 終了コード: 0 = 済んだ（dry-run も）、1 = 誤り、2 = 引数の誤り、4 = 判定が fail で --force が無い
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の10節。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";
import { planAdopt, labelKind } from "./lib/take-in/adopt.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

const USAGE = "使い方: node scripts/adopt.mjs <label> [--force] [--no-records] [--keep-branch] [--dry-run] [--config <local.json>] [--build-root <dir>]";

export function parseAdoptArgs(argv) {
  const a = { label: null, force: false, records: true, keepBranch: false, dryRun: false, config: null, buildRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--force") a.force = true;
    else if (x === "--no-records") a.records = false;
    else if (x === "--keep-branch") a.keepBranch = true;
    else if (x === "--dry-run") a.dryRun = true;
    else if (x === "--config" || x === "--build-root") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${x} に値が無い`);
      a[x === "--config" ? "config" : "buildRoot"] = v;
    } else if (x.startsWith("--")) throw new Error(`知らない引数: ${x}`);
    else if (a.label) throw new Error(`ラベルが2つある: ${a.label} と ${x}`);
    else a.label = x;
  }
  if (!a.label) throw new Error("ラベルが無い");
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(a.label)) throw new Error(`ラベルの形が違う: ${a.label}`);
  return a;
}

function git(args) {
  const r = spawnSync("git", ["-C", REPO, ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

function readJsonOrNull(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try {
    a = parseAdoptArgs(argv);
  } catch (err) {
    console.error(`[adopt] 引数の誤り: ${err.message}\n${USAGE}`);
    return 2;
  }
  let buildRoot;
  try {
    buildRoot = resolveLocalConfig({ configPath: a.config || undefined, overrides: { buildRoot: a.buildRoot || undefined } }).buildRoot;
  } catch (err) {
    console.error(`[adopt] local.json: ${err.message}`);
    return 1;
  }
  const label = a.label;
  const branch = `take-in/${label}`;
  const recDir = path.join(REPO, "records", "take-in", label);
  const verdict = readJsonOrNull(path.join(recDir, "verdict.json"));
  const bwt = path.join(buildRoot, "take-in", label, "repo");
  const status = git(["status", "--porcelain", "--untracked-files=no"]);
  const plan = planAdopt({
    label,
    verdict,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout,
    clean: status.status === 0 && status.stdout === "",
    branchExists: git(["rev-parse", "--verify", "-q", `refs/heads/${branch}`]).status === 0,
    tagExists: git(["rev-parse", "--verify", "-q", `refs/tags/${label}`]).status === 0,
    force: a.force,
    records: a.records,
    keepBranch: a.keepBranch,
    builderWorktree: fs.existsSync(bwt) ? bwt : null,
  });
  const out = { label, kind: labelKind(label), dryRun: a.dryRun, ok: plan.ok, errors: plan.errors, warnings: plan.warnings, steps: plan.steps, done: [] };
  for (const w of plan.warnings) console.error(`[adopt] 注意: ${w}`);
  if (!plan.ok) {
    out.result = "refused";
    console.log(JSON.stringify(out, null, 2));
    for (const e of plan.errors) console.error(`[adopt] ${e}`);
    return plan.code || 1;
  }
  if (a.dryRun) {
    out.result = "dry-run";
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }
  const fail = (m) => {
    out.result = "error";
    out.message = m;
    console.log(JSON.stringify(out, null, 2));
    console.error(`[adopt] ${m}`);
    return 1;
  };
  for (const s of plan.steps) {
    if (s.name === "confirm-upstream") {
      const up = readJsonOrNull(path.join(REPO, "upstream.json")) || {};
      const tag = label.replace(/-\d+$/, "");
      if (up.tag !== tag) return fail(`upstream.json の tag が ${tag} でない（${up.tag}）。マージを確かめる`);
      out.done.push({ name: s.name, upstream: up });
      continue;
    }
    if (s.name === "next") {
      out.next = s.note;
      continue;
    }
    if (s.name === "commit-records") {
      const paths = s.git.slice(2).filter((p) => fs.existsSync(path.join(REPO, p)));
      if (!paths.length) {
        out.done.push({ name: s.name, skipped: "記録が無い" });
        continue;
      }
      const r = git(["add", "--", ...paths]);
      if (r.status !== 0) return fail(`git add が失敗: ${r.stderr}`);
      out.done.push({ name: s.name, paths });
      continue;
    }
    if (s.name === "commit-records-commit") {
      if (git(["diff", "--cached", "--quiet"]).status === 0) {
        out.done.push({ name: s.name, skipped: "記録に変わりが無い" });
        continue;
      }
      const r = git(["commit", "-m", s.git[2]]);
      if (r.status !== 0) return fail(`記録のコミットが失敗: ${r.stderr}`);
      out.done.push({ name: s.name });
      continue;
    }
    const r = git(s.git);
    if (r.status !== 0) {
      if (s.name === "merge") git(["merge", "--abort"]);
      return fail(`git ${s.git.join(" ")} が失敗: ${r.stderr || r.stdout}`);
    }
    out.done.push({ name: s.name, git: s.git });
  }
  if (out.kind === "core") {
    const rec = readJsonOrNull(path.join(REPO, "records", "builds", `${label}.json`));
    const zip = rec && rec.zip;
    const expanded = readJsonOrNull(path.join(recDir, "take-in.json"));
    const exp = expanded && (expanded.steps || []).filter((x) => x.name === "build").pop();
    const didExpand = exp && exp.expand && exp.expand.status === 0;
    out.next = didExpand || !zip
      ? `エディタを閉じ、powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 ${label}`
      : `エディタを閉じ、powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 ${label} -Zip ${zip.path} -Sha256 ${zip.sha256}`;
  }
  out.result = "ok";
  console.log(JSON.stringify(out, null, 2));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
