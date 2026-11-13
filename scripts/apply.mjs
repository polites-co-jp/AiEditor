#!/usr/bin/env node
// 適用（docs/02 の4節の2・3、docs/03 の5・6節）: 本家のタグの作業ツリーに、product.json の上書き → 削除の単位（order の順。
// 単位ごとに ops と edits の2つのコミット）→ patches/ → assets/ の写し → 自前の組み込み拡張の写し、を当て、
// 適用後の検査の結果を checks.json に書く。
//
// 使い方（詳しくは tasks/2026-11-13-p2-apply/apply-design.md）:
//   node scripts/apply.mjs <作業ツリー> --label <label> [--only <id,...>] [--until <id>] [--dry-run]
//        [--checks-out <path>] [--prev-tag <tag>] [--removals <dir>] [--patches <dir>] [--assets <dir>]
//        [--overlay <file>] [--keep <file>] [--extensions-src <dir>] [--manifests <dir>] [--keep-conflict]
//   node scripts/apply.mjs <作業ツリー> --label <label> --lockfile-check [--base <ref>] [--checks-out <path>] [--diff-out <path>]
// 終了コード: 0 = result が ok か hold、1 = fail、2 = 引数の誤り

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { removeLinesFromText } from "./lib/apply/lines.mjs";
import { applyProductOverlay, removeProductKeys, stringifyLike } from "./lib/apply/overlay.mjs";
import { validateUnit, planUnits, checkAfter, normalizeRelPath } from "./lib/apply/units.mjs";
import { removeDependenciesFromText } from "./lib/apply/deps.mjs";
import { createTree, copyTree } from "./lib/apply/tree.mjs";
import { pruneConfigurationDefaults } from "./lib/apply/keys.mjs";
import { resolveLocalConfig } from "./lib/local-config.mjs";
import * as G from "./lib/apply/git.mjs";
import {
  checkRemnants,
  checkAbsentStrings,
  checkUnclassifiedExtensions,
  checkUpstreamAdditions,
  checkDependencies,
  checkToolchain,
  checkRegisteredKeys,
  checkLockfiles,
} from "./lib/apply/checks.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

class UsageError extends Error {}
class StopError extends Error {
  constructor(phase, id, message) {
    super(message);
    this.phase = phase;
    this.id = id;
  }
}

export function parseArgs(argv) {
  const a = {
    worktree: null,
    label: null,
    only: null,
    until: null,
    dryRun: false,
    checksOut: null,
    prevTag: null,
    removals: path.join(REPO, "removals"),
    patches: path.join(REPO, "patches"),
    assets: path.join(REPO, "assets"),
    overlay: path.join(REPO, "product.overlay.json"),
    keep: path.join(REPO, "builtin", "keep.json"),
    extensionsSrc: path.join(REPO, "extensions-src"),
    manifests: null, // 既定は <buildRoot>\cache\vsix（docs/02 の8節）。buildRoot は --build-root → local.json → C:\b
    buildRoot: null,
    lock: path.join(REPO, "extensions.lock.json"),
    keepConflict: false,
    lockfileCheck: false,
    base: null,
    diffOut: null,
  };
  const val = (i, name) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${name} の値が無い`);
    return v;
  };
  const p = (v) => path.resolve(process.cwd(), v);
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    switch (x) {
      case "--label": a.label = val(i++, x); break;
      case "--only": a.only = val(i++, x).split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--until": a.until = val(i++, x); break;
      case "--dry-run": a.dryRun = true; break;
      case "--checks-out": a.checksOut = p(val(i++, x)); break;
      case "--prev-tag": a.prevTag = val(i++, x); break;
      case "--removals": a.removals = p(val(i++, x)); break;
      case "--patches": a.patches = p(val(i++, x)); break;
      case "--assets": a.assets = p(val(i++, x)); break;
      case "--overlay": a.overlay = p(val(i++, x)); break;
      case "--keep": a.keep = p(val(i++, x)); break;
      case "--extensions-src": a.extensionsSrc = p(val(i++, x)); break;
      case "--manifests": a.manifests = p(val(i++, x)); break;
      case "--build-root": a.buildRoot = val(i++, x); break;
      case "--lock": a.lock = p(val(i++, x)); break;
      case "--keep-conflict": a.keepConflict = true; break;
      case "--lockfile-check": a.lockfileCheck = true; break;
      case "--base": a.base = val(i++, x); break;
      case "--diff-out": a.diffOut = p(val(i++, x)); break;
      default:
        if (x.startsWith("--")) throw new UsageError(`知らない引数: ${x}`);
        if (a.worktree) throw new UsageError(`作業ツリーが2つ渡された: ${a.worktree} と ${x}`);
        a.worktree = path.resolve(process.cwd(), x);
    }
  }
  if (!a.worktree) throw new UsageError("作業ツリーのパスが無い");
  if (!a.label) throw new UsageError("--label が無い");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(a.label)) throw new UsageError(`--label に使えない文字がある: ${a.label}`);
  if (!a.checksOut) a.checksOut = path.join(REPO, "records", "take-in", a.label, "checks.json");
  if (!a.diffOut) a.diffOut = path.join(path.dirname(a.checksOut), "lockfile.diff");
  if (!a.manifests) {
    // 台帳の拡張の manifest は VSIX のキャッシュ <buildRoot>\cache\vsix\<id>-<版>[@<target>]\package.json（docs/02 の8節）
    let cfg;
    try {
      cfg = resolveLocalConfig({ overrides: { buildRoot: a.buildRoot } });
    } catch (err) {
      throw new UsageError(`buildRoot を決められない: ${err.message}`);
    }
    a.manifests = path.join(cfg.buildRoot, "cache", "vsix");
  }
  return a;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

// removals/<id>/unit.json をすべて読む。形の誤りは errors に。
export function loadUnits(dir) {
  const units = [];
  const errors = [];
  if (!fs.existsSync(dir)) return { units, errors };
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dir, e.name, "unit.json");
    if (!fs.existsSync(f)) continue;
    let u;
    try {
      u = readJson(f);
    } catch (err) {
      errors.push(`${e.name}/unit.json: JSON として読めない: ${err.message}`);
      continue;
    }
    for (const m of validateUnit(u, e.name)) errors.push(`${e.name}/unit.json: ${m}`);
    units.push(u);
  }
  return { units, errors };
}

// patches/ の *.patch を、頭の番号の順に（番号が無いものは後ろに名前の順）。
export function listPatches(dir) {
  if (!fs.existsSync(dir)) return [];
  const num = (n) => {
    const m = /^(\d+)/.exec(n);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".patch"))
    .map((e) => e.name)
    .sort((a, b) => num(a) - num(b) || a.localeCompare(b));
}

// 自前の組み込み拡張から写すもの（apply-design.md の2.6）。
const EXT_FILES = [/^package\.json$/, /^package\.nls(\.[^/]+)?\.json$/, /^README\.md$/, /^ThirdPartyNotices\.txt$/, /^LICENSE/];
const EXT_DIRS = ["dist", "media"];
function extFilter(rel, dirent) {
  if (rel.includes("/")) return true; // 写すフォルダの中は全部
  return dirent.isDirectory() ? EXT_DIRS.includes(rel) : EXT_FILES.some((re) => re.test(rel));
}

export function summarizeResult(rec) {
  const statuses = Object.values(rec.checks || {}).map((c) => c && c.status);
  if (rec.stoppedAt || (rec.errors && rec.errors.length) || statuses.includes("fail")) return "fail";
  if (statuses.includes("hold")) return "hold";
  return "ok";
}

function writeRecord(file, rec) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rec, null, 2) + "\n");
}

const log = (m) => console.error(`[apply] ${m}`);

function runApply(a) {
  const rec = {
    label: a.label,
    worktree: a.worktree,
    tag: null,
    baseCommit: null,
    headCommit: null,
    prevTag: a.prevTag,
    dryRun: a.dryRun,
    options: { only: a.only, until: a.until, keepConflict: a.keepConflict },
    inputs: {
      removals: a.removals,
      patches: a.patches,
      assets: a.assets,
      overlay: a.overlay,
      keep: a.keep,
      extensionsSrc: a.extensionsSrc,
      manifests: a.manifests,
    },
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: "fail",
    stoppedAt: null,
    overlay: null,
    units: [],
    unitsSkipped: [],
    patches: [],
    assets: null,
    builtinExtensions: null,
    checks: {},
    warnings: [],
    errors: [],
  };
  const warn = (m) => {
    rec.warnings.push(m);
    log(`警告: ${m}`);
  };
  const wt = a.worktree;

  // 0. 入力と作業ツリー
  if (!fs.existsSync(path.join(wt, ".git"))) throw new UsageError(`git の作業ツリーでない: ${wt}`);
  rec.baseCommit = G.head(wt);
  try {
    rec.tag = readJson(path.join(wt, "package.json")).version || null;
  } catch {}
  if (a.prevTag && !G.resolveCommit(wt, a.prevTag)) throw new UsageError(`--prev-tag のタグが無い: ${a.prevTag}`);

  let overlay = null;
  if (fs.existsSync(a.overlay)) overlay = readJson(a.overlay);
  else rec.errors.push(`overlay が無い: ${a.overlay}`);
  let keepJson = null;
  if (fs.existsSync(a.keep)) keepJson = readJson(a.keep);
  else warn(`keep.json が無い: ${a.keep}（未分類の組み込み拡張の検査は単位だけで行う）`);
  const lock = fs.existsSync(a.lock) ? readJson(a.lock) : [];
  const mydistPkgPath = path.join(a.extensionsSrc, "mydist", "package.json");
  const mydistManifest = fs.existsSync(mydistPkgPath) ? readJson(mydistPkgPath) : null;

  const { units: allUnits, errors: unitErrors } = loadUnits(a.removals);
  rec.errors.push(...unitErrors);
  const { plan, skipped, errors: planErrors } = planUnits(allUnits, { only: a.only, until: a.until });
  rec.errors.push(...planErrors);
  rec.unitsSkipped = skipped;
  const baseProductText = fs.readFileSync(path.join(wt, "product.json"), "utf8");
  const baseProduct = JSON.parse(baseProductText);

  const appliedUnits = [];
  // 検査に使う mydist の manifest。写すときに当てた単位の absentSettings を外したもの（写す前に止まったら元のまま）
  let effectiveMydist = mydistManifest;
  try {
    if (rec.errors.length) throw new StopError("inputs", null, "入力に誤りがある（errors を見る）");
    const status = G.statusPorcelain(wt);
    if (status !== "") {
      if (a.dryRun) warn("作業ツリーに変更がある（dry-run なので続ける）");
      else throw new StopError("worktree", null, `作業ツリーに変更がある:\n${status.split(/\r?\n/).slice(0, 20).join("\n")}`);
    }
    if (G.amInProgress(wt)) throw new StopError("worktree", null, "git am の途中（git am --abort か --continue を先に）");
    if (!a.dryRun) G.enableRerere(wt);
    const tree = createTree(wt, { dryRun: a.dryRun });
    const commit = (msg) => (a.dryRun ? null : G.commitAll(wt, msg));

    // 1. product.json の上書き
    log("product.json の上書き");
    const ov = applyProductOverlay(baseProduct, overlay);
    rec.overlay = { applied: ov.errors.length ? "error" : "ok", set: ov.set, removed: ov.removed, removedIfPresent: ov.removedIfPresent, commit: null };
    ov.warnings.forEach(warn);
    if (ov.errors.length) {
      rec.errors.push(...ov.errors);
      throw new StopError("overlay", null, "overlay を当てられない");
    }
    tree.writeText("product.json", stringifyLike(ov.product, baseProductText));
    rec.overlay.commit = commit("apply: product.json overlay");

    // 2. 削除の単位
    const applied = new Set();
    for (const u of plan) {
      log(`単位 ${u.id}`);
      const ur = {
        id: u.id,
        order: u.order,
        enabled: u.enabled,
        applied: "error",
        ops: { commit: null, deleted: [], missingDeletes: [], removedDependencies: [], missingDependencies: [], removeLines: [], productRemoved: [], productMissing: [] },
        edits: { applied: u.patch ? "skipped" : "none", commit: null, subject: null, conflicts: [] },
        warnings: [],
      };
      rec.units.push(ur);
      const uwarn = (m) => {
        ur.warnings.push(m);
        warn(`${u.id}: ${m}`);
      };
      const stop = (m) => {
        throw new StopError("unit", u.id, `${u.id}: ${m}`);
      };

      const missingAfter = checkAfter(u, applied);
      if (missingAfter.length) stop(`after の単位が当たっていない: ${missingAfter.join(", ")}`);

      // ops: delete → removeDependencies → removeLines → productRemove
      for (const d of u.delete || []) {
        const n = normalizeRelPath(d);
        if (tree.exists(n)) {
          tree.remove(n);
          ur.ops.deleted.push(n);
        } else {
          ur.ops.missingDeletes.push(n);
          uwarn(`delete: ${n} が本家に無い（改名の恐れ）`);
        }
      }
      for (const [file, names] of Object.entries(u.removeDependencies || {})) {
        const f = normalizeRelPath(file);
        if (!names.length) continue;
        if (!tree.exists(f)) stop(`removeDependencies: ${f} が無い`);
        const r = removeDependenciesFromText(tree.readText(f), names);
        if (!r.ok) stop(`removeDependencies: ${f}: ${r.error}`);
        for (const x of r.removed) ur.ops.removedDependencies.push({ file: f, ...x });
        for (const m of r.missing) {
          ur.ops.missingDependencies.push({ file: f, name: m });
          uwarn(`removeDependencies: ${f} に ${m} が無い`);
        }
        if (r.removed.length) tree.writeText(f, r.text);
      }
      for (const rl of u.removeLines || []) {
        const f = normalizeRelPath(rl.file);
        const count = rl.count === undefined ? 1 : rl.count;
        const entry = { file: f, line: rl.line, count, found: 0, ok: false };
        ur.ops.removeLines.push(entry);
        if (!tree.exists(f)) stop(`removeLines: ${f} が無い`);
        const r = removeLinesFromText(tree.readText(f), rl.line, count);
        entry.found = r.found;
        entry.ok = r.ok;
        if (!r.ok) stop(`removeLines: ${f}: ${r.error}: ${rl.line.trim()}`);
        tree.writeText(f, r.text);
      }
      if ((u.productRemove || []).length) {
        const text = tree.readText("product.json");
        const r = removeProductKeys(JSON.parse(text), u.productRemove);
        ur.ops.productRemoved = r.removed;
        ur.ops.productMissing = r.missing;
        r.missing.forEach((k) => uwarn(`productRemove: ${k} が product.json に無い（改名の恐れ）`));
        if (r.removed.length) tree.writeText("product.json", stringifyLike(r.product, text));
      }
      ur.ops.commit = commit(`unit ${u.id}: ops`);

      // edits
      if (u.patch) {
        const pf = path.join(a.removals, u.id, u.patch);
        if (!fs.existsSync(pf)) stop(`patch が無い: ${pf}`);
        if (a.dryRun) ur.edits.applied = "skipped";
        else {
          const r = G.amApply(wt, pf, { keepConflict: a.keepConflict });
          ur.edits.applied = r.applied;
          ur.edits.conflicts = r.conflicts;
          if (r.applied !== "ok") {
            ur.edits.message = r.message;
            ur.edits.keptConflict = r.kept;
            stop(`edits.patch が当たらない${r.conflicts.length ? `（衝突: ${r.conflicts.join(", ")}）` : ""}`);
          }
          ur.edits.commit = r.commits[r.commits.length - 1] || null;
          ur.edits.subject = r.subjects[r.subjects.length - 1] || null;
          if (r.commits.length !== 1) uwarn(`edits.patch のコミットが ${r.commits.length} 個`);
          if (ur.edits.subject !== `unit ${u.id}: edits`) uwarn(`edits のコミットの件名が "unit ${u.id}: edits" でない: ${ur.edits.subject}`);
        }
      }
      ur.applied = "ok";
      applied.add(u.id);
      appliedUnits.push(u);
    }

    // 3. patches/
    for (const name of listPatches(a.patches)) {
      log(`パッチ ${name}`);
      const pr = { file: path.relative(REPO, path.join(a.patches, name)).replace(/\\/g, "/"), applied: "skipped", commit: null, subject: null, conflicts: [] };
      rec.patches.push(pr);
      if (a.dryRun) continue;
      const r = G.amApply(wt, path.join(a.patches, name), { keepConflict: a.keepConflict });
      pr.applied = r.applied;
      pr.conflicts = r.conflicts;
      if (r.applied !== "ok") {
        pr.message = r.message;
        pr.keptConflict = r.kept;
        throw new StopError("patch", name, `${name} が当たらない${r.conflicts.length ? `（衝突: ${r.conflicts.join(", ")}）` : ""}`);
      }
      pr.commit = r.commits[r.commits.length - 1] || null;
      pr.subject = r.subjects[r.subjects.length - 1] || null;
    }

    // 4. assets/
    if (fs.existsSync(a.assets)) {
      const copied = copyTree(a.assets, wt, {
        dryRun: a.dryRun,
        filter: (rel, e) => !(e.isFile() && !rel.includes("/") && rel.toLowerCase().endsWith(".md")),
      });
      rec.assets = { applied: copied.length ? "ok" : "none", copied, commit: copied.length ? commit("apply: assets") : null };
    } else {
      rec.assets = { applied: "none", copied: [], commit: null };
    }

    // 5. 自前の組み込み拡張
    const be = { applied: "ok", copied: [], commit: null };
    rec.builtinExtensions = be;
    for (const name of ["mydist", "notion-sync"]) {
      const src = path.join(a.extensionsSrc, name);
      if (!fs.existsSync(path.join(src, "package.json"))) {
        if (name === "mydist") throw new StopError("builtinExtensions", name, `${src}/package.json が無い`);
        continue;
      }
      if (name === "notion-sync" && !fs.existsSync(path.join(src, "dist", "extension.js"))) {
        warn(`notion-sync の dist/extension.js が無い（ビルドしていない）ので写さない`);
        continue;
      }
      const dest = path.join(wt, "extensions", name);
      if (!a.dryRun && fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
      const files = copyTree(src, dest, { filter: extFilter, dryRun: a.dryRun });
      const entry = { name, files: files.length, list: files };
      be.copied.push(entry);
      if (name === "mydist") {
        // 当てた単位が消した設定（checks.absentSettings）の既定を、写した package.json から外す（extensions-src は変えない）
        const srcText = fs.readFileSync(path.join(src, "package.json"), "utf8");
        const pr = pruneConfigurationDefaults(JSON.parse(srcText.replace(/^﻿/, "")), appliedUnits);
        entry.removedDefaults = pr.removed;
        effectiveMydist = pr.manifest;
        if (pr.removed.length) {
          for (const r of pr.removed) log(`mydist の既定から ${r.key} を外した（${r.unit} の absentSettings）`);
          if (!a.dryRun) fs.writeFileSync(path.join(dest, "package.json"), stringifyLike(pr.manifest, srcText));
        }
      }
    }
    be.removedDefaults = (be.copied.find((c) => c.name === "mydist") || {}).removedDefaults || [];
    be.commit = commit("apply: builtin extensions");
  } catch (err) {
    if (err instanceof StopError) {
      rec.stoppedAt = { phase: err.phase, id: err.id, message: err.message };
      log(`止めた: ${err.message}`);
    } else throw err;
  }

  // 6. 適用後の検査
  log("適用後の検査");
  const stoppedOrDry = rec.stoppedAt || a.dryRun;
  const skippedCheck = (reason) => ({ status: "skipped", reason });
  rec.checks.remnants = stoppedOrDry ? skippedCheck(a.dryRun ? "dry-run" : "途中で止めた") : checkRemnants(wt, appliedUnits);
  rec.checks.absentStrings = stoppedOrDry ? skippedCheck(a.dryRun ? "dry-run" : "途中で止めた") : checkAbsentStrings(wt, appliedUnits);
  rec.checks.unclassifiedExtensions = checkUnclassifiedExtensions(wt, rec.baseCommit, keepJson, allUnits);
  rec.checks.upstreamAdditions = checkUpstreamAdditions(wt, a.prevTag, rec.baseCommit);
  rec.checks.dependencies = checkDependencies(wt, a.prevTag, rec.baseCommit);
  rec.checks.toolchain = checkToolchain(wt, a.prevTag, rec.baseCommit);
  rec.checks.registeredKeys = rec.stoppedAt
    ? skippedCheck("途中で止めた")
    : checkRegisteredKeys({ worktree: wt, baseProduct, overlay, mydistManifest: effectiveMydist, lock, manifestsDir: a.manifests });
  if (a.dryRun && rec.checks.registeredKeys.status === "fail") {
    // dry-run は patches/ を当てないので、パッチが足すキー（shukoConfigurationDefaults など）は見つからない
    rec.checks.registeredKeys.status = "warn";
    rec.checks.registeredKeys.reason = "dry-run ではパッチを当てないので、パッチが足すキーは missing になる。本番の実行で確かめる";
  }
  const rk = rec.checks.registeredKeys;
  if (rk.status === "warn" && rk.reason) warn(`registeredKeys: ${rk.reason}`);
  if (Array.isArray(rk.settings) && rk.settings.some((s) => s.status === "unverified")) {
    warn(`登録を確かめられなかった設定のキーがある（manifest が無い拡張: ${rk.manifestsMissing.join(", ")}）`);
  }
  rec.checks.lockfile = { status: "pending", reason: "依存の導入の後に --lockfile-check（build.mjs は checkLockfiles）で埋める" };

  // コミットの名前（docs/03 の5.2）: apply.mjs が作ったコミットと、edits.patch・patches/ から入ったコミットの作者・コミッターが
  // shuko-apply <apply@shuko.invalid> か。違えば警告（パッチの From: を直す）
  if (a.dryRun) rec.checks.commitIdentity = skippedCheck("dry-run");
  else {
    rec.commits = G.listCommits(wt, rec.baseCommit);
    const items = rec.commits
      .filter((c) => c.author !== G.COMMIT_IDENT || c.committer !== G.COMMIT_IDENT)
      .map((c) => ({ sha: c.sha, subject: c.subject, author: c.author, committer: c.committer }));
    rec.checks.commitIdentity = { status: items.length ? "warn" : "ok", expected: G.COMMIT_IDENT, items };
    for (const c of items) warn(`コミットの名前が ${G.COMMIT_IDENT} でない: ${c.subject}（作者 ${c.author}、コミッター ${c.committer}）`);
  }

  rec.headCommit = G.head(wt);
  rec.finishedAt = new Date().toISOString();
  rec.result = summarizeResult(rec);
  writeRecord(a.checksOut, rec);
  log(`結果: ${rec.result}（${a.checksOut}）`);
  return rec;
}

function runLockfileCheck(a) {
  const hasRecord = fs.existsSync(a.checksOut);
  const rec = hasRecord ? readJson(a.checksOut) : { label: a.label, worktree: a.worktree, checks: {}, warnings: [], errors: [] };
  rec.warnings = rec.warnings || [];
  if (!hasRecord) rec.warnings.push(`checks.json が無い（${a.checksOut}）。当てた単位を知らないまま比べた（消した依存も「予期しない削除」になる）`);
  const baseRef = a.base || rec.baseCommit;
  if (!baseRef) throw new UsageError("--base が無く、checks.json にも baseCommit が無い");
  if (!G.resolveCommit(a.worktree, baseRef)) throw new UsageError(`base の commit が無い: ${baseRef}`);
  const { units: allUnits } = loadUnits(a.removals);
  const appliedIds = new Set((rec.units || []).filter((u) => u.applied === "ok").map((u) => u.id));
  const units = allUnits.filter((u) => appliedIds.has(u.id));
  const missing = [...appliedIds].filter((id) => !units.some((u) => u.id === id));
  if (missing.length) throw new UsageError(`checks.json の当てた単位の unit.json が ${a.removals} に無い: ${missing.join(", ")}`);
  rec.checks = rec.checks || {};
  rec.checks.lockfile = { ...checkLockfiles({ worktree: a.worktree, baseRef, units, diffOut: a.diffOut }), checkedAt: new Date().toISOString(), baseRef };
  rec.result = summarizeResult(rec);
  writeRecord(a.checksOut, rec);
  log(`ロックファイル: ${rec.checks.lockfile.status}、結果: ${rec.result}（${a.checksOut}）`);
  return rec;
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try {
    a = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`[apply] 引数の誤り: ${err.message}`);
      return 2;
    }
    throw err;
  }
  try {
    const rec = a.lockfileCheck ? runLockfileCheck(a) : runApply(a);
    return rec.result === "fail" ? 1 : 0;
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`[apply] 引数の誤り: ${err.message}`);
      return 2;
    }
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
