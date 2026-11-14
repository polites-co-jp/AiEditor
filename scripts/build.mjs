#!/usr/bin/env node
// ビルドの一連（docs/02 の4節の1〜8）。どこで止まったかを records/builds/<label>.json に書く（docs/02 の7節）。
//
//   1 prepare     作業ツリーの用意（scripts/prepare.mjs を呼ぶ）
//   2 apply       上書き・削除の単位・パッチ・写しと、3 の適用後の検査（scripts/apply.mjs を呼ぶ。checks.json）
//   4 install     依存の導入（pnpm install --no-frozen-lockfile）
//     lockfile    ロックファイルの検査（docs/03 の5.4。scripts/apply.mjs --lockfile-check を呼ぶ）
//   5 typecheck   型検査（pnpm run typecheck-client）
//   6 package     パッケージ化（pnpm run gulp vscode-win32-x64-min。出力は作業ツリーの親の直下の VSCode-win32-x64）。
//                 signtool.exe が PATH に無ければ、最も新しい Windows Kits\10\bin\<版>\x64 をこの子の PATH の先に足す（無ければ止める）
//   7 postprocess 後処理の確かめ（resources\app の場所を決めつけない。消した拡張が残っていない、keep.json の拡張がそろう、
//                 LICENSE と ThirdPartyNotices がある、exe と CLI がある）
//   8 zip         %SystemRoot%\System32\tar.exe で <buildRoot>\dist\<label>.zip。中の最上位のフォルダは <nameShort>-win32-x64-<label>。
//                 gulp の出力は改名しない（<dist>\.stage-<label>\<最上位の名前> にジャンクションを置き、tar -H で包む）
//
// 使い方:
//   node scripts/build.mjs <tag> [--label <label>] [--commit <sha>] [--build-root <dir>] [--config <local.json>]
//                          [--record <json>] [--dry-run] [--from <step>] [--to <step>] [--fresh]
//                          [--worktree <dir>] [--package-dir <dir>] [--keep <file>] [--removals <dir>] [--take-in-dir <dir>]
//                          [--prev-tag <tag>] [--keep-conflict] [--patches <dir>] [--assets <dir>] [--overlay <file>]
//                          [--lock <file>] [--extensions-src <dir>]
//                          [--typecheck-script <name>] [--gulp-task <name>] [--force-zip] [--no-size] [--no-branch]
//     <tag>              本家のタグ（upstream.json の tag と違えば --commit が要る。prepare.mjs の規則）
//     --label            版のラベル。既定 <tag>-<n>（n は records/builds/<tag>-*.json の最大＋1）
//     --build-root       既定 local.json の buildRoot（scripts/lib/local-config.mjs の規則）
//     --config           local.json の場所（試し。既定 %LOCALAPPDATA%\Shuko\local.json）
//     --record           記録の場所（既定 records/builds/<label>.json）
//     --dry-run          何も走らせず、計画（手順ごとのコマンド・場所）を記録の形で出す。--record を渡したときだけ書く
//     --from / --to      この手順から / この手順まで（途中からの再開と試し）
//     --fresh            prepare の前に作業ツリーを消す（git worktree remove --force）。当てた後の作業ツリーは prepare が拒むため
//     --worktree         作業ツリー（既定 <buildRoot>\wt\<tag>）
//     --package-dir      gulp の出力（既定 <作業ツリーの親>\VSCode-win32-x64）。postprocess と zip はこれを読むだけで、動かさない
//     --keep / --removals  既定 builtin/keep.json / removals/
//     --take-in-dir      checks.json と lockfile.diff の置き場所（既定 records/take-in/<label>。試しでリポジトリの記録を汚さないため）
//     --prev-tag <tag> / --keep-conflict / --patches <dir> / --assets <dir> / --overlay <file> / --lock <file> / --extensions-src <dir>
//                        apply の手順で apply.mjs にそのまま渡す（取り込みのブランチの中身を当てるため。docs/06 の9節）。
//                        --removals は apply・lockfile・postprocess のすべてで同じ場所を使う
//     --force-zip        <label>.zip があれば上書きする（既定は止める）
//     --no-branch        版の commit に枝 builds/<label> を付けない（既定は付ける。下の「版の commit の枝」）
// 終了コード: 0 = result が ok か dry-run、1 = error、2 = 引数の誤り
//
// 出力の product.json の commit（2026-11-14、tasks/2026-11-14-build-commit-fix/）:
//   本家の build/lib/getVersion.ts は環境変数 BUILD_SOURCEVERSION（40桁）を先に見て、無ければ build/lib/git.ts で
//   <root>\.git\HEAD を読む。作業ツリー（git worktree）の .git はファイル（gitdir: ...）なので読めず、commit が入らない。
//   そこで typecheck・package の子のプロセスに BUILD_SOURCEVERSION=<作業ツリーの HEAD> を渡す（リーダーの判断: 単位を
//   当てた後の HEAD。本家の commit は upstream.commit に残る）。渡した値は記録の sourceVersion に書き、postprocess で
//   出力の resources\app\product.json の commit が40桁でその値と一致することを確かめる（一致しなければ失敗）。
//
// 版の commit の枝（2026-11-14、tasks/2026-11-14-fix-b1-and-build/）:
//   型検査・パッケージ化・後処理のうち最初に走る手順で、sourceVersion の値（作業ツリーの HEAD）に枝 builds/<label> を
//   付ける（git -C <作業ツリー> branch --force --no-track。refs は常設の clone と共有なので、作業ツリーをタグに戻しても
//   版のソースが gc で消えない）。後処理から始めたときは、出力の product.json の commit が一致したときだけ付ける。
//   結果は記録の branch。付けられなくても止めずに warnings に書く。同じラベルで作り直すと付け替える（warnings に書く）。
//
// 書き出している関数（テストの入口。tasks/2026-11-13-p2-build-switch/build-switch-design.md の3節）:
//   STEPS, parseArgs, selectSteps, nextLabel, findAppDir, resolveEditorLayout, childEnv, appliedUnitsFrom,
//   checkBuiltinExtensions, parseExcludedExtensions, zipFolderName, quoteCmdArg, toolchainWarnings, applyPassThrough,
//   findSignTool, prependPath,
//   SOURCE_VERSION_STEPS, isFullSha, stepEnv, headCommitOf, checkProductCommit, unitsRecordFrom, patchesRecordFrom
//   （tasks/2026-11-14-build-commit-fix/）、BUILD_BRANCH_PREFIX, buildBranchName, markBuildCommit（tasks/2026-11-14-fix-b1-and-build/）

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";
import { sha256File } from "./lib/http.mjs";
import { keepNamesOf, extensionsCoveredByUnits } from "./lib/apply/classify.mjs";
import { dirSize } from "./prepare.mjs";
import { git, head as gitHead, statusPorcelain } from "./lib/apply/git.mjs";
// gitHead は git -C <dir> rev-parse HEAD（失敗すると例外）。git は git -C <dir> <args>（失敗しても例外にしない）

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

export const STEPS = Object.freeze(["prepare", "apply", "install", "lockfile", "typecheck", "package", "postprocess", "zip"]);
export const OWN_EXTENSIONS = Object.freeze(["mydist", "notion-sync"]);

// ---------------------------------------------------------------------------
// 純粋な関数
// ---------------------------------------------------------------------------

export class ArgError extends Error {}

export function parseArgs(argv) {
  const a = {
    tag: null, label: null, commit: null, buildRoot: null, config: null, record: null, dryRun: false,
    from: null, to: null, fresh: false, worktree: null, packageDir: null, keep: null, removals: null, takeInDir: null,
    // apply.mjs へそのまま渡すもの（取り込みのブランチの中身を当てるため。docs/06 の9節）
    prevTag: null, keepConflict: false, patches: null, assets: null, overlay: null, lock: null, extensionsSrc: null,
    typecheckScript: "typecheck-client", gulpTask: "vscode-win32-x64-min", forceZip: false, size: true, branch: true,
  };
  const need = (i, name) => {
    if (i >= argv.length || String(argv[i]).startsWith("--")) throw new ArgError(`${name} に値が無い`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    switch (x) {
      case "--label": a.label = need(++i, x); break;
      case "--commit": a.commit = need(++i, x); break;
      case "--build-root": a.buildRoot = need(++i, x); break;
      case "--config": a.config = need(++i, x); break;
      case "--record": a.record = need(++i, x); break;
      case "--dry-run": a.dryRun = true; break;
      case "--from": a.from = need(++i, x); break;
      case "--to": a.to = need(++i, x); break;
      case "--fresh": a.fresh = true; break;
      case "--worktree": a.worktree = need(++i, x); break;
      case "--package-dir": a.packageDir = need(++i, x); break;
      case "--keep": a.keep = need(++i, x); break;
      case "--removals": a.removals = need(++i, x); break;
      case "--take-in-dir": a.takeInDir = need(++i, x); break;
      case "--prev-tag": a.prevTag = need(++i, x); break;
      case "--keep-conflict": a.keepConflict = true; break;
      case "--patches": a.patches = need(++i, x); break;
      case "--assets": a.assets = need(++i, x); break;
      case "--overlay": a.overlay = need(++i, x); break;
      case "--lock": a.lock = need(++i, x); break;
      case "--extensions-src": a.extensionsSrc = need(++i, x); break;
      case "--typecheck-script": a.typecheckScript = need(++i, x); break;
      case "--gulp-task": a.gulpTask = need(++i, x); break;
      case "--force-zip": a.forceZip = true; break;
      case "--no-size": a.size = false; break;
      case "--no-branch": a.branch = false; break;
      default:
        if (x.startsWith("--")) throw new ArgError(`知らない引数: ${x}`);
        if (a.tag) throw new ArgError(`タグが2つある: ${a.tag} と ${x}`);
        a.tag = x;
    }
  }
  if (!a.tag) throw new ArgError("タグが無い（node scripts/build.mjs <tag>）");
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(a.tag)) throw new ArgError(`タグの形が違う: ${a.tag}`);
  if (a.label !== null && !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(a.label)) throw new ArgError(`ラベルの形が違う: ${a.label}`);
  if (a.prevTag !== null && !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(a.prevTag)) throw new ArgError(`--prev-tag の形が違う: ${a.prevTag}`);
  selectSteps(a.from, a.to); // 名前の確かめ
  return a;
}

// apply の手順で apply.mjs にそのまま渡す引数（parseArgs の結果から。指定の無いものは渡さない）。
// 順: --prev-tag、--keep-conflict、--patches、--assets、--overlay、--lock、--extensions-src。パスは絶対パスにする。
export function applyPassThrough(a) {
  const out = [];
  if (a.prevTag) out.push("--prev-tag", a.prevTag);
  if (a.keepConflict) out.push("--keep-conflict");
  for (const [key, flag] of [["patches", "--patches"], ["assets", "--assets"], ["overlay", "--overlay"], ["lock", "--lock"], ["extensionsSrc", "--extensions-src"]]) {
    if (a[key]) out.push(flag, path.resolve(a[key]));
  }
  return out;
}

// from〜to の手順の名前の配列（両端を含む）。知らない名前と、from が to より後ろは誤り。
export function selectSteps(from, to) {
  const i = from ? STEPS.indexOf(from) : 0;
  const j = to ? STEPS.indexOf(to) : STEPS.length - 1;
  if (i < 0) throw new ArgError(`知らない手順: ${from}（${STEPS.join(", ")}）`);
  if (j < 0) throw new ArgError(`知らない手順: ${to}（${STEPS.join(", ")}）`);
  if (i > j) throw new ArgError(`--from ${from} が --to ${to} より後ろ`);
  return STEPS.slice(i, j + 1);
}

// 既にあるラベル（例 ["1.146.0-1", "1.146.0-3", "1.145.0-2"]）から、タグの次の番号のラベル。
export function nextLabel(tag, existing) {
  let max = 0;
  const prefix = `${tag}-`;
  for (const l of Array.isArray(existing) ? existing : []) {
    if (typeof l !== "string" || !l.startsWith(prefix)) continue;
    const rest = l.slice(prefix.length);
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return `${tag}-${max + 1}`;
}

// 子のプロセスに渡す環境変数。ELECTRON_RUN_AS_NODE・ELECTRON_NO_ATTACH_CONSOLE・VSCODE_* を外し（docs/07 の3.2 の1）、
// 外から来た BUILD_SOURCEVERSION（名前の大文字小文字を問わない）も外す（prepare・apply・install・lockfile・zip に漏らさない。
// 型検査・パッケージ化には stepEnv が作業ツリーの HEAD を足す。2026-11-14 検証の軽微な点、tasks/2026-11-14-fix-b1-and-build/）。
// extra を足す（extra の BUILD_SOURCEVERSION は残る）。返り値 { env, removed }（removed は外した名前。値は持たない）。
export function childEnv(base = process.env, extra = {}) {
  const env = {};
  const removed = [];
  for (const [k, v] of Object.entries(base)) {
    if (/^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|BUILD_SOURCEVERSION)$/i.test(k) || /^VSCODE_/i.test(k)) removed.push(k);
    else env[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null) env[k] = v;
  return { env, removed: removed.sort() };
}

// checks.json（apply.mjs の出力）から当てた単位を返す。applied が "ok" の単位の id。
// removalsUnits（removals/*/unit.json の中身の配列）から、その id の単位の定義を返す。
// checks.json が無いときは、enabled: true の単位を返す（fallback を記録に書く）。
export function appliedUnitsFrom(checks, removalsUnits) {
  const units = Array.isArray(removalsUnits) ? removalsUnits : [];
  if (checks && Array.isArray(checks.units)) {
    const ids = new Set(checks.units.filter((u) => u && u.applied === "ok").map((u) => u.id));
    return { source: "checks.json", units: units.filter((u) => ids.has(u.id)), ids: [...ids].sort() };
  }
  const en = units.filter((u) => u && u.enabled === true);
  return { source: "removals (enabled)", units: en, ids: en.map((u) => u.id).sort() };
}

// checks.json（apply.mjs の出力）から、記録の units（[{ id, enabled, applied }]）を作る。apply の手順を走らせたときも、
// --from install などで走らせないときも同じ形にする（検証の気づいた点の1。tasks/2026-11-14-p1-verify-a1/handoff-notes.md）。
// checks が null・オブジェクトでない・units が配列でないときは []（例外にしない）。
export function unitsRecordFrom(checks) {
  if (!checks || typeof checks !== "object" || !Array.isArray(checks.units)) return [];
  return checks.units.filter((u) => u && typeof u === "object").map((u) => ({ id: u.id, enabled: u.enabled, applied: u.applied }));
}

// 記録の patches（[{ file, applied }]）。unitsRecordFrom と同じ規則。
export function patchesRecordFrom(checks) {
  if (!checks || typeof checks !== "object" || !Array.isArray(checks.patches)) return [];
  return checks.patches.filter((p) => p && typeof p === "object").map((p) => ({ file: p.file, applied: p.applied }));
}

// 作業ツリーの HEAD の40桁（小文字）。.git がファイル（git worktree）でも読める（git rev-parse HEAD に任せる）。
// リポジトリでない・40桁でないときは例外（空の値を黙って渡さない）。
export function headCommitOf(worktree) {
  const v = gitHead(worktree);
  if (!isFullSha(v)) throw new Error(`作業ツリーの HEAD が40桁の16進でない: ${v}`);
  return v.trim().toLowerCase();
}

// BUILD_SOURCEVERSION を渡す手順（本家が getVersion で commit を読むもの。型検査とパッケージ化）。
export const SOURCE_VERSION_STEPS = Object.freeze(["typecheck", "package"]);

// 40桁の16進か（本家の build/lib/getVersion.ts と同じ規則: /^[0-9a-f]{40}$/i を trim した値に当てる）。
export function isFullSha(v) {
  return typeof v === "string" && /^[0-9a-f]{40}$/i.test(v.trim());
}

// 手順 name の子のプロセスの環境。env の写しに、name が SOURCE_VERSION_STEPS のときだけ BUILD_SOURCEVERSION を足す。
// sourceVersion が40桁でなければ例外（渡しても本家が捨て、.git\HEAD を読みに行くため）。元の env は変えない。
// 外の BUILD_SOURCEVERSION（env にあるもの）は、どの手順でも上書きか削除する（取り違えを防ぐ）。
export function stepEnv(name, env, sourceVersion) {
  const out = {};
  for (const [k, v] of Object.entries(env || {})) if (k.toUpperCase() !== "BUILD_SOURCEVERSION") out[k] = v;
  if (!SOURCE_VERSION_STEPS.includes(name)) return out;
  if (!isFullSha(sourceVersion)) throw new Error(`BUILD_SOURCEVERSION に渡す値が40桁の16進でない: ${sourceVersion}`);
  out.BUILD_SOURCEVERSION = sourceVersion.trim().toLowerCase();
  return out;
}

// 出力の product.json の commit の確かめ（docs/02 の4節の7）。product は出力の product.json の中身、expected は渡した値。
//   返り値 { ok, commit, expected, problems }（problems は文の配列。ok のとき []）。product は変えない
//   - commit が無い（キーごと・undefined・null・空）・文字列でない・40桁の16進でない → ok: false
//   - expected が40桁でない（渡した値が分からない）→ ok: false
//   - 大文字小文字を問わずに比べ、違えば ok: false（文に両方の値を入れる）
export function checkProductCommit(product, expected) {
  const raw = product && typeof product === "object" ? product.commit : undefined;
  const commit = raw === undefined || raw === null || raw === "" ? null : raw;
  const exp = typeof expected === "string" ? expected : expected == null ? null : expected;
  const problems = [];
  if (commit === null) problems.push("出力の product.json に commit が無い");
  else if (!isFullSha(commit)) problems.push(`出力の product.json の commit が40桁の16進でない: ${commit}`);
  if (!isFullSha(exp)) problems.push(`比べる値（BUILD_SOURCEVERSION に渡した値）が40桁でない: ${exp}`);
  if (!problems.length && commit.trim().toLowerCase() !== exp.trim().toLowerCase()) problems.push(`出力の product.json の commit ${commit} が渡した値 ${exp} と違う`);
  return { ok: problems.length === 0, commit, expected: exp, problems };
}

// 版の commit に付ける枝（常設の clone の refs/heads。作業ツリーと共有）。版ごとに作業ツリーをタグに戻して当て直すと、
// 前の版の commit はどの枝からもたどれず、git の gc で消える（tasks/2026-11-14-p2-builds/handoff-notes.md の未解決の2）。
// その印。名前は builds/<label>。label が版のラベルの形（parseArgs と同じ規則）でなければ例外。
export const BUILD_BRANCH_PREFIX = "builds/";
export function buildBranchName(label) {
  if (typeof label !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(label)) throw new Error(`ラベルの形が違う: ${label}`);
  // git の ref の名前の規則のうち、ラベルの形で起こりうるもの（.. を含む・.lock か . で終わる）
  if (label.includes("..") || /\.lock$/i.test(label) || label.endsWith(".")) throw new Error(`枝の名前に使えないラベル: ${label}`);
  return `${BUILD_BRANCH_PREFIX}${label}`;
}

// 版の commit（作業ツリーの HEAD。product.json の commit に入る値）に枝 builds/<label> を付ける（あれば付け替える）。
//   runGit(args) は git -C <worktree> <args> を走らせ { status, stdout, stderr } を返す（試しのために差し替えられる）。
//   返り値 { name, commit, previous, action: "created" | "moved" | "unchanged" | null, ok, error }
//   - previous: 付ける前の枝の commit（無ければ null）
//   - 付けた後に refs/heads/<name> を読み直し、commit と同じでなければ ok: false
//   失敗しても例外にしない（呼ぶ側が警告にする）。commit が40桁でなければ何もせず ok: false
export function markBuildCommit({ worktree, label, commit, runGit = (args) => git(worktree, args) }) {
  const out = { name: null, commit: isFullSha(commit) ? commit.trim().toLowerCase() : commit ?? null, previous: null, action: null, ok: false, error: null };
  try {
    out.name = buildBranchName(label);
  } catch (err) {
    out.error = err.message;
    return out;
  }
  if (!isFullSha(commit)) {
    out.error = `枝を付ける commit が40桁の16進でない: ${commit}`;
    return out;
  }
  const ref = `refs/heads/${out.name}`;
  const readRef = () => {
    const r = runGit(["rev-parse", "--verify", "--quiet", ref]);
    return r && r.status === 0 && isFullSha(String(r.stdout)) ? String(r.stdout).trim().toLowerCase() : null;
  };
  try {
    out.previous = readRef();
    if (out.previous === out.commit) {
      out.action = "unchanged";
      out.ok = true;
      return out;
    }
    const r = runGit(["branch", "--force", "--no-track", out.name, out.commit]);
    if (!r || r.status !== 0) {
      out.error = `git branch が ${r ? r.status : "?"} で終わった: ${String((r && (r.stderr || r.stdout)) || "").trim().slice(-500)}`;
      return out;
    }
    const after = readRef();
    if (after !== out.commit) {
      out.error = `付けた後の ${ref} が ${after} で、${out.commit} でない`;
      return out;
    }
    out.action = out.previous ? "moved" : "created";
    out.ok = true;
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

// build/lib/extensions.ts の excludedExtensions の名前（同梱されない拡張）。見つからなければ null。
export function parseExcludedExtensions(tsText) {
  const m = /const\s+excludedExtensions\s*=\s*\[([\s\S]*?)\]/.exec(String(tsText || ""));
  if (!m) return null;
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

// 出力の組み込み拡張の確かめ（docs/02 の4節の7）。
//   present:  出力の resources/app/extensions の下のフォルダの名前
//   removed:  当てた単位が消した拡張の名前（extensions/<名前>）
//   keep:     keep.json の名前
//   excluded: 本家が同梱しない名前（build/lib/extensions.ts の excludedExtensions。無ければ []）
//   own:      自前の組み込み拡張（mydist は必須、notion-sync は任意）
// 返り値: { ok, residual, missingKeep, notShipped, missingOwn, unexpected }
//   residual    = removed のうち出力に残っているもの（誤り）
//   missingKeep = keep のうち出力に無く、excluded でもないもの（誤り）
//   notShipped  = keep のうち出力に無く、excluded にあるもの（情報）
//   missingOwn  = mydist が出力に無いとき ["mydist"]（誤り）
//   unexpected  = 出力にあるが keep・own のどれにも無いもの（情報。本家の builtInExtensions や copilot など）
export function checkBuiltinExtensions({ present = [], removed = [], keep = [], excluded = [], own = OWN_EXTENSIONS } = {}) {
  const P = new Set(present);
  const K = new Set(keep);
  const E = new Set(excluded || []);
  const O = new Set(own);
  const residual = [...new Set(removed)].filter((n) => P.has(n)).sort();
  const missingKeep = [...K].filter((n) => !P.has(n) && !E.has(n)).sort();
  const notShipped = [...K].filter((n) => !P.has(n) && E.has(n)).sort();
  const missingOwn = O.has("mydist") && !P.has("mydist") ? ["mydist"] : [];
  const unexpected = [...P].filter((n) => !K.has(n) && !O.has(n)).sort();
  return { ok: residual.length === 0 && missingKeep.length === 0 && missingOwn.length === 0, residual, missingKeep, notShipped, missingOwn, unexpected };
}

// zip の中の最上位のフォルダの名前。nameShort の空白などは - にする（"Code - OSS" → "Code-OSS"）。
export function zipFolderName(nameShort, label) {
  const n = String(nameShort || "Shuko").replace(/[^A-Za-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return `${n}-win32-x64-${label}`;
}

// 道具の版がタグの求めに合うか（check-env.ps1 の Compare-SemVer・本家の preinstall.ts と同じ規則: メジャーが同じで、求める版以上）。
// toolchain は toolchainOf の結果。返り値は警告の文字列の配列（合っていれば空。読めない値は「確かめられない」と警告する）。
export function toolchainWarnings(toolchain) {
  const t = toolchain || {};
  const parse = (v) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || "").trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const ok = (have, need) => have[0] === need[0] && (have[1] > need[1] || (have[1] === need[1] && have[2] >= need[2]));
  const out = [];
  const check = (name, haveRaw, needRaw, source) => {
    if (!needRaw) return;
    const need = parse(needRaw);
    const have = parse(haveRaw);
    if (!need) out.push(`${name}: 求める版 ${needRaw}（${source}）を読めない`);
    else if (!have) out.push(`${name}: 入っている版を確かめられない（求める版 ${needRaw}、${source}）`);
    else if (!ok(have, need)) out.push(`${name}: 入っている ${have.join(".")} が ${source} の ${need.join(".")} に合わない（メジャーが同じで、それ以上が要る）`);
  };
  check("node", t.node, t.nvmrc, ".nvmrc");
  const pmDeclared = /^pnpm@(.+)$/.exec(String(t.packageManagerDeclared || ""));
  const pmHave = /^pnpm\s+(.+)$/.exec(String(t.packageManager || ""));
  if (t.packageManagerDeclared && !pmDeclared) out.push(`packageManager: pnpm 以外（${t.packageManagerDeclared}）`);
  else if (pmDeclared) check("pnpm", pmHave ? pmHave[1] : null, pmDeclared[1], "package.json の packageManager");
  return out;
}

// signtool.exe を探す（1.146.0 の patchWin32DependenciesTask が PATH から 'signtool.exe verify /pa' を呼び、
// 起動できないとパッケージ化が落ちる。build/gulpfile.vscode.ts の483行）。check-env.ps1 と同じ規則:
// PATH の上にあればそれ、無ければ <ProgramFiles(x86)>\Windows Kits\10\bin\<x.y.z.w>\x64\signtool.exe の最も新しい版。
// 本家の CI は bin\10.0.26100.0\x64 を固定で PATH の先に足す（build/azure-pipelines/win32/steps/product-build-win32-compile.yml）。
// exists・listDirs は試しのために差し替えられる。返り値 { found, path, dir, source: "PATH" | "WindowsKits" | null, candidates }
export function findSignTool({ env = process.env, exists = fs.existsSync, listDirs } = {}) {
  const get = (name) => {
    const k = Object.keys(env).find((x) => x.toLowerCase() === name.toLowerCase());
    return k ? env[k] : undefined;
  };
  for (const d of String(get("PATH") || "").split(";").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean)) {
    const p = path.win32.join(d, "signtool.exe");
    if (exists(p)) return { found: true, path: p, dir: d, source: "PATH", candidates: [] };
  }
  const pf86 = get("ProgramFiles(x86)") || "C:\\Program Files (x86)";
  const bin = path.win32.join(pf86, "Windows Kits", "10", "bin");
  const list = listDirs || ((dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []));
  const ver = (s) => s.split(".").map(Number);
  const cmp = (a, b) => {
    const x = ver(a);
    const y = ver(b);
    for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const candidates = list(bin)
    .filter((n) => /^\d+\.\d+\.\d+\.\d+$/.test(n))
    .sort((a, b) => cmp(b, a))
    .map((n) => path.win32.join(bin, n, "x64", "signtool.exe"))
    .filter((p) => exists(p));
  if (candidates.length) return { found: true, path: candidates[0], dir: path.win32.dirname(candidates[0]), source: "WindowsKits", candidates };
  return { found: false, path: null, dir: null, source: null, candidates: [] };
}

// env の PATH の先頭に dir を足した写しを返す（元の env は変えない。PATH のキーの大文字小文字は元のまま）。
export function prependPath(env, dir) {
  const out = { ...env };
  const k = Object.keys(out).find((x) => x.toLowerCase() === "path") || "Path";
  out[k] = out[k] ? `${dir};${out[k]}` : dir;
  return out;
}

// cmd.exe に渡す1つの引数を " で囲む（中の " は許さない）。
export function quoteCmdArg(s) {
  const v = String(s);
  if (v.includes('"')) throw new Error(`引数に " がある: ${v}`);
  return /^[A-Za-z0-9_\-.:\\/=@]+$/.test(v) ? v : `"${v}"`;
}

// ---------------------------------------------------------------------------
// 出力の形（resources\app を決めつけない。docs/02 の4節の7）
// ---------------------------------------------------------------------------

// root の下の resources/app（直下か、<commit10> のような1段下のフォルダの下）を探す。
export function findAppDir(root) {
  const direct = path.join(root, "resources", "app");
  if (fs.existsSync(path.join(direct, "product.json"))) return { appDir: direct, versionedFolder: null };
  if (!fs.existsSync(root)) throw new Error(`フォルダが無い: ${root}`);
  const cands = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, "resources", "app", "product.json")))
    .map((e) => e.name);
  if (cands.length !== 1) throw new Error(`resources/app/product.json が ${root} の直下にも1段下にも1つだけ見つからない（${cands.length} 件）`);
  return { appDir: path.join(root, cands[0], "resources", "app"), versionedFolder: cands[0] };
}

function readJson(p) {
  let t = fs.readFileSync(p, "utf8");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return JSON.parse(t);
}

// 展開した版（または gulp の出力）の形: exe は <nameShort>.exe、CLI は bin/<applicationName>.cmd（1.146.0 の
// build/gulpfile.vscode.ts。exe の名前は resources/win32/bin/code.cmd の @@NAME@@ に nameShort が入る）。
export function resolveEditorLayout(root) {
  const { appDir, versionedFolder } = findAppDir(root);
  const product = readJson(path.join(appDir, "product.json"));
  let version = null;
  const pkg = path.join(appDir, "package.json");
  if (fs.existsSync(pkg)) version = readJson(pkg).version || null;
  if (!version) version = product.version || null;
  return {
    root,
    appDir,
    versionedFolder,
    product,
    version,
    commit: product.commit || null,
    nameShort: product.nameShort,
    applicationName: product.applicationName,
    dataFolderName: product.dataFolderName,
    exe: path.join(root, `${product.nameShort}.exe`),
    cli: path.join(root, "bin", `${product.applicationName}.cmd`),
  };
}

// ---------------------------------------------------------------------------
// 入出力
// ---------------------------------------------------------------------------

function readUnits(removalsDir) {
  if (!fs.existsSync(removalsDir)) return [];
  const out = [];
  for (const e of fs.readdirSync(removalsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(removalsDir, e.name, "unit.json");
    if (fs.existsSync(p)) out.push(readJson(p));
  }
  return out.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function existingLabels(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), error: r.error ? r.error.message : null };
}

// 長い手順を走らせる。出力は画面とログのファイルの両方に流し、末尾の 8 KB を返す。
// useShell: pnpm のように .cmd のことがあるコマンド（cmd.exe 経由。引数は quoteCmdArg で囲む）。
function runLogged({ cmd, args, cwd, env, logFile, useShell = false }) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.createWriteStream(logFile);
    const t0 = Date.now();
    const line = useShell ? [cmd, ...args].map(quoteCmdArg).join(" ") : null;
    const child = useShell
      ? spawn(line, { cwd, env, shell: true, windowsHide: true })
      : spawn(cmd, args, { cwd, env, windowsHide: true });
    let tail = "";
    const onData = (stream) => (chunk) => {
      stream.write(chunk);
      log.write(chunk);
      tail = (tail + chunk.toString("utf8")).slice(-8192);
    };
    child.stdout.on("data", onData(process.stdout));
    child.stderr.on("data", onData(process.stderr));
    child.on("error", (err) => {
      log.end();
      resolve({ exitCode: null, seconds: (Date.now() - t0) / 1000, tail: `${tail}\n${err.message}` });
    });
    child.on("close", (code) => {
      log.end();
      resolve({ exitCode: code, seconds: (Date.now() - t0) / 1000, tail });
    });
  });
}

function toolchainOf(worktree, env) {
  const out = { node: null, electron: null, packageManager: null, packageManagerDeclared: null, nvmrc: null };
  const n = sh(process.execPath, ["--version"]);
  out.nodeOfBuildScript = n.stdout || null;
  // PATH の node と pnpm（pnpm が使うもの）。.cmd のことがあるので cmd.exe 経由（引数を配列で渡さない）
  const nodeOnPath = sh("node --version", [], { env, shell: true });
  out.node = nodeOnPath.status === 0 ? nodeOnPath.stdout.replace(/^v/, "") : null;
  const pnpm = sh("pnpm --version", [], { env, shell: true });
  out.packageManager = pnpm.status === 0 ? `pnpm ${pnpm.stdout}` : null;
  try {
    const pkg = readJson(path.join(worktree, "package.json"));
    out.packageManagerDeclared = pkg.packageManager || null;
    out.electron = (pkg.nativeBuild && pkg.nativeBuild.target) || null;
  } catch {}
  try {
    out.nvmrc = fs.readFileSync(path.join(worktree, ".nvmrc"), "utf8").trim();
  } catch {}
  return out;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[build] ${err.message}`);
    process.exit(2);
  }

  let cfg;
  try {
    cfg = resolveLocalConfig({ configPath: args.config || undefined, overrides: { buildRoot: args.buildRoot || undefined } });
  } catch (err) {
    console.error(`[build] local.json: ${err.message}`);
    process.exit(1);
  }
  const buildRoot = cfg.buildRoot;
  const recordsDir = path.join(REPO, "records", "builds");
  const label = args.label || nextLabel(args.tag, existingLabels(recordsDir));
  const worktree = args.worktree ? path.resolve(args.worktree) : path.join(buildRoot, "wt", args.tag);
  const prepareRecord = `${worktree}.prepare.json`; // prepare.mjs の既定と同じ（既定の作業ツリーなら <buildRoot>\wt\<tag>.prepare.json）
  const packageDir = args.packageDir ? path.resolve(args.packageDir) : path.join(path.dirname(worktree), "VSCode-win32-x64");
  const takeInDir = args.takeInDir ? path.resolve(args.takeInDir) : path.join(REPO, "records", "take-in", label);
  const checksPath = path.join(takeInDir, "checks.json");
  const lockfileDiff = path.join(takeInDir, "lockfile.diff");
  const recordPath = args.record ? path.resolve(args.record) : args.dryRun ? null : path.join(recordsDir, `${label}.json`);
  const keepPath = args.keep ? path.resolve(args.keep) : path.join(REPO, "builtin", "keep.json");
  const removalsDir = args.removals ? path.resolve(args.removals) : path.join(REPO, "removals");
  const distDir = path.join(buildRoot, "dist");
  const zipPath = path.join(distDir, `${label}.zip`);
  const logDir = path.join(buildRoot, "logs", label);
  const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  const steps = selectSteps(args.from, args.to);
  const { env, removed: envRemoved } = childEnv(process.env);
  const signtool = findSignTool({ env });
  let upstream = {};
  try {
    upstream = readJson(path.join(REPO, "upstream.json"));
  } catch {}

  const rec = {
    label,
    upstream: { tag: args.tag, commit: args.commit || (upstream.tag === args.tag ? upstream.commit : null) || null },
    units: [],
    patches: [],
    lockfileDiff: path.relative(REPO, lockfileDiff).split(path.sep).join("/"),
    toolchain: null,
    durations: {},
    zip: null,
    extensionsLockSha256: null,
    result: "error",
    stoppedAt: null,
    dryRun: args.dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    paths: { buildRoot, worktree, packageDir, checks: checksPath, keep: keepPath, removals: removalsDir, dist: distDir, logs: logDir },
    config: { path: cfg.configPath, exists: cfg.configExists, buildRootFrom: cfg.sources.buildRoot },
    stepsSelected: steps,
    envRemovedForChildren: envRemoved,
    // 型検査・パッケージ化の子に渡す BUILD_SOURCEVERSION（作業ツリーの HEAD）。読んだときに埋める
    sourceVersion: null,
    // 版の commit（sourceVersion の値）に付けた枝 builds/<label>（markBuildCommit の結果。--no-branch なら null）
    branch: null,
    steps: [],
    warnings: [],
  };
  const lockFile = path.join(REPO, "extensions.lock.json");
  if (fs.existsSync(lockFile)) rec.extensionsLockSha256 = (await sha256File(lockFile)).sha256;

  const save = () => {
    if (!recordPath) return;
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, `${JSON.stringify(rec, null, 2)}\n`);
  };
  const finish = (result, message) => {
    rec.result = result;
    if (message) rec.message = message;
    rec.finishedAt = new Date().toISOString();
    save();
    console.log(JSON.stringify(rec, null, 2));
    process.exit(result === "ok" || result === "dry-run" ? 0 : 1);
  };
  const stepRec = (name, extra = {}) => {
    const s = { name, status: "running", startedAt: new Date().toISOString(), ...extra };
    rec.steps.push(s);
    save();
    return s;
  };
  const fail = (s, message) => {
    s.status = "error";
    s.message = message;
    rec.stoppedAt = s.name;
    finish("error", `${s.name} で止まった: ${message}`);
  };
  const done = (s, extra = {}) => {
    Object.assign(s, extra);
    if (s.status === "running") s.status = "ok";
    save();
  };

  // 単位の定義（記録と後処理のため）
  let removalsUnits = [];
  try {
    removalsUnits = readUnits(removalsDir);
  } catch (err) {
    rec.warnings.push(`removals を読めない: ${err.message}`);
  }

  const node = process.execPath;
  // apply.mjs に渡す場所の設定。buildRoot は build.mjs が決めた値（オプション → local.json → 既定）、local.json は同じファイル
  const applyConfigArgs = ["--build-root", buildRoot, "--config", cfg.configPath];
  // apply の手順にだけ渡す引数（指定があったものだけ。パスは絶対にする）
  const applyPassArgs = applyPassThrough(args);
  const pnpmCmd = (scriptArgs) => ({ cmd: "pnpm", args: scriptArgs, cwd: worktree, useShell: true });
  const plan = {
    // --worktree を prepare まで通す（--fresh・apply 以降と同じ場所を見る。検証 D1）
    prepare: { cmd: node, args: [path.join(SCRIPT_DIR, "prepare.mjs"), "--tag", args.tag, "--build-root", buildRoot, "--worktree", worktree, ...(args.commit ? ["--commit", args.commit] : []), "--out", prepareRecord], cwd: REPO },
    // --build-root・--config を渡し、apply.mjs の --manifests の既定（<buildRoot>\cache\vsix）を build.mjs と同じ場所にそろえる
    apply: { cmd: node, args: [path.join(SCRIPT_DIR, "apply.mjs"), worktree, "--label", label, "--checks-out", checksPath, "--removals", removalsDir, "--keep", keepPath, ...applyPassArgs, ...applyConfigArgs], cwd: REPO },
    install: pnpmCmd(["install", "--no-frozen-lockfile"]),
    // --removals: 取り込みのブランチの removals/ でロックファイルを検査する（docs/06 の9節）
    lockfile: { cmd: node, args: [path.join(SCRIPT_DIR, "apply.mjs"), worktree, "--label", label, "--lockfile-check", "--checks-out", checksPath, "--diff-out", lockfileDiff, "--removals", removalsDir, ...applyConfigArgs], cwd: REPO },
    typecheck: pnpmCmd(["run", args.typecheckScript]),
    package: pnpmCmd(["run", "gulp", args.gulpTask]),
  };

  let checks = null;
  const readChecks = () => {
    try {
      checks = readJson(checksPath);
    } catch {
      checks = null;
    }
    return checks;
  };
  // 記録の units・patches・applyResult を checks.json から埋める（apply を走らせないときも。検証の気づいた点の1）
  const fillUnits = (applyRan) => {
    if (!checks || !Array.isArray(checks.units)) return false;
    rec.units = unitsRecordFrom(checks);
    rec.patches = patchesRecordFrom(checks);
    rec.applyResult = checks.result || null;
    rec.unitsFrom = { checks: checksPath, applyRan };
    return true;
  };

  // 作業ツリーの HEAD を読み、記録の sourceVersion に書く（1回だけ読む。型検査・パッケージ化・後処理で同じ値を使う）。
  // 読めなければ value: null と error。checks.json の headCommit（apply の直後の HEAD）と違えば警告する。
  const readSourceVersion = (when) => {
    if (rec.sourceVersion && rec.sourceVersion.value) return rec.sourceVersion.value;
    let value = null;
    let error = null;
    if (!fs.existsSync(worktree)) error = `作業ツリーが無い: ${worktree}`;
    else {
      try {
        value = headCommitOf(worktree);
      } catch (err) {
        error = err.message;
      }
    }
    const sv = { name: "BUILD_SOURCEVERSION", value, source: "worktree HEAD", worktree, readAt: when, steps: [...SOURCE_VERSION_STEPS], error };
    if (sv.value) {
      try {
        sv.uncommittedEntries = statusPorcelain(worktree).split(/\r?\n/).filter(Boolean).length;
      } catch (err) {
        sv.uncommittedEntries = null;
      }
      const c = readChecks();
      sv.checksHeadCommit = c && typeof c.headCommit === "string" ? c.headCommit : null;
      sv.matchesChecksHead = sv.checksHeadCommit ? sv.checksHeadCommit.toLowerCase() === sv.value : null;
      if (sv.matchesChecksHead === false) rec.warnings.push(`作業ツリーの HEAD ${sv.value} が checks.json の headCommit ${sv.checksHeadCommit} と違う（apply の後に作業ツリーが動いた恐れ）`);
    }
    rec.sourceVersion = sv;
    save();
    return sv.value;
  };

  // 版の commit（sourceVersion の値）に常設の clone の枝 builds/<label> を付ける（1回だけ。dry-run と --no-branch では付けない）。
  // 付けられなくてもビルドは止めない（警告に書く）。型検査・パッケージ化・後処理のうち最初に走る手順で付ける
  const markBranch = (when) => {
    if (!args.branch || args.dryRun || rec.branch) return;
    const v = rec.sourceVersion && rec.sourceVersion.value;
    if (!v) return;
    const b = markBuildCommit({ worktree, label, commit: v });
    rec.branch = { ...b, at: when };
    if (!b.ok) rec.warnings.push(`版の commit に枝 ${b.name || `builds/${label}`} を付けられない: ${b.error}`);
    else if (b.action === "moved") rec.warnings.push(`枝 ${b.name} を ${b.previous} から ${b.commit} へ付け替えた（同じラベルで作り直した）`);
    save();
  };

  if (args.dryRun) {
    rec.plan = {};
    for (const name of steps) {
      if (plan[name]) rec.plan[name] = { command: [plan[name].cmd, ...plan[name].args].join(" "), cwd: plan[name].cwd };
    }
    // 型検査・パッケージ化に渡す BUILD_SOURCEVERSION（作業ツリーがあれば今の HEAD。apply の前なら当てた後に変わる）
    const svSteps = steps.filter((n) => SOURCE_VERSION_STEPS.includes(n) || n === "postprocess");
    if (svSteps.length) {
      const v = readSourceVersion("dry-run");
      for (const name of SOURCE_VERSION_STEPS) {
        if (rec.plan[name]) rec.plan[name].env = { BUILD_SOURCEVERSION: v || "<作業ツリーの HEAD（実行の時に読む）>" };
      }
      if (steps.includes("apply") && v) rec.warnings.push("dry-run の sourceVersion は apply の前の HEAD。実際に渡すのは apply の後の HEAD");
      if (args.branch) {
        let name;
        try {
          name = buildBranchName(label);
        } catch (err) {
          name = null;
          rec.warnings.push(`枝の名前を作れない: ${err.message}`);
        }
        if (name) rec.plan.branch = { name, command: `git -C ${worktree} branch --force --no-track ${name} ${v || "<作業ツリーの HEAD（実行の時に読む）>"}` };
      }
    }
    if (!steps.includes("apply")) {
      readChecks();
      fillUnits(false);
    }
    if (steps.includes("prepare") && args.fresh) rec.plan.fresh = `git -C ${path.join(buildRoot, "vscode")} worktree remove --force ${worktree}`;
    if (steps.includes("postprocess")) rec.plan.postprocess = { packageDir, keep: keepPath, removals: removalsDir };
    if (steps.includes("zip")) rec.plan.zip = { tar, zip: zipPath };
    if (rec.plan.package) rec.plan.package.pathPrepended = signtool.source === "WindowsKits" ? signtool.dir : null;
    if (steps.includes("package") && !signtool.found) rec.warnings.push("signtool.exe が見つからない（PATH にも Windows Kits\\10\\bin\\<版>\\x64 にも無い）。package の手順で止まる");
    rec.checksBeforeRun = {
      signtool: { found: signtool.found, path: signtool.path, source: signtool.source },
      applyMjs: fs.existsSync(path.join(SCRIPT_DIR, "apply.mjs")),
      keepJson: fs.existsSync(keepPath),
      worktree: fs.existsSync(worktree),
      packageDir: fs.existsSync(packageDir),
      tarExe: fs.existsSync(tar),
      zipExists: fs.existsSync(zipPath),
      unitsEnabled: removalsUnits.filter((u) => u.enabled === true).map((u) => u.id),
      unitsTotal: removalsUnits.length,
    };
    if (fs.existsSync(worktree)) {
      rec.toolchain = toolchainOf(worktree, env);
      // 版の違いは止めずに警告する（本番の install では preinstall.ts が止める）。検証 4節の8の提案
      for (const w of toolchainWarnings(rec.toolchain)) rec.warnings.push(`道具の版: ${w}`);
    }
    finish("dry-run");
  }

  const runPlanned = async (name, s, stepEnv = env) => {
    const p = plan[name];
    s.command = [p.cmd, ...p.args].join(" ");
    s.cwd = p.cwd;
    s.log = path.join(logDir, `${name}.log`);
    save();
    const r = await runLogged({ ...p, env: stepEnv, logFile: s.log });
    s.seconds = r.seconds;
    s.exitCode = r.exitCode;
    if (r.exitCode !== 0) s.tail = r.tail.slice(-4000);
    return r;
  };

  // apply を走らせないとき（--from install など）も、記録の units を checks.json から埋める
  if (!steps.includes("apply")) {
    readChecks();
    if (!fillUnits(false) && steps.includes("postprocess")) rec.warnings.push(`checks.json を読めない（${checksPath}）。記録の units は空`);
  }

  // 型検査・パッケージ化の子の環境（BUILD_SOURCEVERSION を足す）。HEAD を読めなければその手順で止める
  const envForStep = (name, s, base = env) => {
    const v = readSourceVersion(name);
    if (!v) fail(s, `作業ツリーの HEAD を読めない（BUILD_SOURCEVERSION に渡す値が無い）: ${rec.sourceVersion && rec.sourceVersion.error}`);
    markBranch(name);
    s.env = { BUILD_SOURCEVERSION: v };
    return stepEnv(name, base, v);
  };

  for (const name of steps) {
    const s = stepRec(name);
    if (name === "prepare") {
      if (args.fresh && fs.existsSync(worktree)) {
        const r = sh("git", ["-C", path.join(buildRoot, "vscode"), "worktree", "remove", "--force", worktree]);
        s.fresh = { status: r.status, stderr: r.stderr.slice(-2000) };
        if (r.status !== 0) fail(s, `作業ツリーを消せない: ${r.stderr}`);
      }
      const r = await runPlanned(name, s);
      try {
        const p = readJson(prepareRecord);
        s.prepare = { result: p.result, message: p.message, worktree: p.worktree, tagCommit: p.tagCommit, worktreeHead: p.worktreeHead, worktreeClean: p.worktreeClean, disk: p.disk, record: prepareRecord };
        rec.upstream.commit = p.tagCommit || rec.upstream.commit;
      } catch {}
      if (r.exitCode !== 0) fail(s, `prepare.mjs が ${r.exitCode} で終わった`);
      done(s);
    } else if (name === "apply") {
      if (!fs.existsSync(path.join(SCRIPT_DIR, "apply.mjs"))) fail(s, "scripts/apply.mjs が無い");
      const r = await runPlanned(name, s);
      readChecks();
      if (checks) {
        s.checksResult = checks.result || null;
        fillUnits(true);
        if (checks.result === "hold") rec.warnings.push("適用後の検査が hold（未分類の組み込み拡張など）。checks.json を見る");
      }
      if (r.exitCode !== 0) fail(s, `apply.mjs が ${r.exitCode} で終わった（checks.json の result: ${checks ? checks.result : "読めない"}）`);
      done(s);
    } else if (name === "install") {
      rec.toolchain = toolchainOf(worktree, env);
      for (const w of toolchainWarnings(rec.toolchain)) rec.warnings.push(`道具の版: ${w}`);
      const r = await runPlanned(name, s);
      rec.durations.install = r.seconds;
      if (r.exitCode !== 0) fail(s, `pnpm install が ${r.exitCode} で終わった`);
      done(s);
    } else if (name === "lockfile") {
      const r = await runPlanned(name, s);
      readChecks();
      s.lockfile = checks && checks.checks ? checks.checks.lockfile || null : null;
      if (r.exitCode !== 0) fail(s, `ロックファイルの検査が通らない（apply.mjs --lockfile-check が ${r.exitCode}）`);
      done(s, { diff: lockfileDiff });
    } else if (name === "typecheck") {
      let scripts = {};
      try {
        scripts = readJson(path.join(worktree, "package.json")).scripts || {};
      } catch {}
      if (!scripts[args.typecheckScript]) fail(s, `作業ツリーの package.json に script ${args.typecheckScript} が無い（本家が名前を変えた恐れ）`);
      const r = await runPlanned(name, s, envForStep(name, s));
      rec.durations.typecheck = r.seconds;
      if (r.exitCode !== 0) fail(s, `型検査が ${r.exitCode} で終わった`);
      done(s);
    } else if (name === "package") {
      // signtool.exe（patchWin32DependenciesTask が PATH から呼ぶ）。PATH に無ければ Windows Kits のフォルダを
      // この子のプロセスの PATH にだけ足す（ユーザーの PATH は書き換えない）
      s.signtool = { path: signtool.path, source: signtool.source, pathPrepended: signtool.source === "WindowsKits" ? signtool.dir : null };
      if (!signtool.found) fail(s, "signtool.exe が見つからない（PATH にも Windows Kits\\10\\bin\\<版>\\x64 にも無い）。Windows SDK を入れ、scripts/check-env.ps1 で確かめる");
      const r = await runPlanned(name, s, envForStep(name, s, signtool.source === "WindowsKits" ? prependPath(env, signtool.dir) : env));
      rec.durations.package = r.seconds;
      if (r.exitCode !== 0) fail(s, `パッケージ化が ${r.exitCode} で終わった`);
      if (!fs.existsSync(packageDir)) fail(s, `出力 ${packageDir} が無い`);
      done(s);
    } else if (name === "postprocess") {
      const t0 = Date.now();
      let layout;
      try {
        layout = resolveEditorLayout(packageDir);
      } catch (err) {
        fail(s, err.message);
      }
      s.layout = { appDir: layout.appDir, versionedFolder: layout.versionedFolder, exe: path.basename(layout.exe), cli: path.relative(packageDir, layout.cli), version: layout.version, commit: layout.commit, nameShort: layout.nameShort };
      const problems = [];
      // product.json の commit が40桁で、型検査・パッケージ化に渡した値（作業ツリーの HEAD）と一致すること
      const pc = checkProductCommit(layout.product, readSourceVersion(name));
      // --from postprocess のときは、出力の commit が作業ツリーの HEAD と一致したときだけ枝を付ける（違う版に付けない）
      if (pc.ok) markBranch(name);
      s.productCommit = pc;
      problems.push(...pc.problems);
      if (!fs.existsSync(layout.exe)) problems.push(`exe が無い: ${layout.exe}`);
      if (!fs.existsSync(layout.cli)) problems.push(`CLI が無い: ${layout.cli}`);
      const lic = layout.product.licenseFileName || "LICENSE.txt";
      s.license = { [lic]: fs.existsSync(path.join(layout.appDir, lic)), "ThirdPartyNotices.txt": fs.existsSync(path.join(layout.appDir, "ThirdPartyNotices.txt")) };
      for (const [f, ok] of Object.entries(s.license)) if (!ok) problems.push(`${f} が resources/app に無い`);

      if (!fs.existsSync(keepPath)) problems.push(`keep.json が無い: ${keepPath}`);
      const keep = fs.existsSync(keepPath) ? keepNamesOf(readJson(keepPath)) : [];
      readChecks();
      const applied = appliedUnitsFrom(checks, removalsUnits);
      const removed = extensionsCoveredByUnits(applied.units);
      let excluded = [];
      const extTs = path.join(worktree, "build", "lib", "extensions.ts");
      if (fs.existsSync(extTs)) excluded = parseExcludedExtensions(fs.readFileSync(extTs, "utf8")) || [];
      else rec.warnings.push(`${extTs} が無い。同梱されない拡張（excludedExtensions）を数えない`);
      const extDir = path.join(layout.appDir, "extensions");
      // 拡張として数えるのは package.json のあるフォルダだけ（1.146.0 の出力には extensions\node_modules がある）
      const dirs = fs.existsSync(extDir) ? fs.readdirSync(extDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
      const present = dirs.filter((n) => fs.existsSync(path.join(extDir, n, "package.json")));
      const nonExtensionDirs = dirs.filter((n) => !present.includes(n));
      const res = checkBuiltinExtensions({ present, removed, keep, excluded });
      s.extensions = { unitsFrom: applied.source, unitIds: applied.ids, removed, presentCount: present.length, nonExtensionDirs, ...res };
      if (res.residual.length) problems.push(`消した拡張が残っている: ${res.residual.join(", ")}`);
      if (res.missingKeep.length) problems.push(`keep.json の拡張が無い: ${res.missingKeep.join(", ")}`);
      if (res.missingOwn.length) problems.push(`自前の拡張が無い: ${res.missingOwn.join(", ")}`);
      if (res.unexpected.length) rec.warnings.push(`keep.json に無い拡張が出力にある（情報）: ${res.unexpected.join(", ")}`);
      s.seconds = (Date.now() - t0) / 1000;
      if (problems.length) {
        s.problems = problems;
        fail(s, problems.join(" / "));
      }
      done(s);
    } else if (name === "zip") {
      const t0 = Date.now();
      if (!fs.existsSync(tar)) fail(s, `tar.exe が無い: ${tar}`);
      let layout;
      try {
        layout = resolveEditorLayout(packageDir);
      } catch (err) {
        fail(s, err.message);
      }
      const top = zipFolderName(layout.nameShort, label);
      if (fs.existsSync(zipPath)) {
        if (!args.forceZip) fail(s, `${zipPath} が既にある（上書きは --force-zip）`);
        fs.rmSync(zipPath);
      }
      fs.mkdirSync(distDir, { recursive: true });
      // Windows の bsdtar には名前の置き換え（-s）が無い（2026-11-14 の試し: "-s is not supported by this version of bsdtar"）。
      // gulp の出力を動かさずに最上位の名前を変えるため、<dist>\.stage-<label>\<top> にジャンクションを置き、
      // コマンドラインの名前だけジャンクションをたどる -H で包む。
      const stage = path.join(distDir, `.stage-${label}`);
      const link = path.join(stage, top);
      if (fs.existsSync(stage)) {
        // 前の回の残り。ジャンクション（lstat でリンク）だけを消す。ほかの物があれば止める（先の中身を消さないため）
        for (const e of fs.readdirSync(stage)) {
          const p = path.join(stage, e);
          if (fs.lstatSync(p).isSymbolicLink()) fs.unlinkSync(p);
          else fail(s, `${stage} にジャンクションでない ${e} がある。手で確かめて消す`);
        }
        fs.rmdirSync(stage);
      }
      fs.mkdirSync(stage, { recursive: true });
      fs.symlinkSync(packageDir, link, "junction");
      const tarArgs = ["-a", "-c", "-H", "-f", zipPath, "-C", stage, top];
      s.command = [tar, ...tarArgs].join(" ");
      s.log = path.join(logDir, "zip.log");
      save();
      const r = await runLogged({ cmd: tar, args: tarArgs, cwd: stage, env, logFile: s.log });
      try {
        fs.unlinkSync(link); // ジャンクションだけを消す（先は消さない）
        fs.rmdirSync(stage);
      } catch (err) {
        rec.warnings.push(`段の置き場所 ${stage} を消せない: ${err.message}`);
      }
      s.exitCode = r.exitCode;
      if (r.exitCode !== 0) {
        s.tail = r.tail.slice(-4000);
        fail(s, `tar.exe が ${r.exitCode} で終わった`);
      }
      // 中の最上位の名前を確かめる（最初の数件）
      const list = sh(tar, ["-t", "-f", zipPath]);
      const names = list.stdout.split(/\r?\n/).filter(Boolean);
      const tops = [...new Set(names.map((n) => n.split("/")[0]))];
      s.topFolders = tops.slice(0, 5);
      s.entries = names.length;
      if (tops.length !== 1 || tops[0] !== top) fail(s, `zip の最上位が ${top} だけでない: ${tops.slice(0, 5).join(", ")}`);
      const h = await sha256File(zipPath);
      rec.zip = { path: zipPath, sha256: h.sha256, bytes: h.bytes, topFolder: top };
      s.seconds = (Date.now() - t0) / 1000;
      rec.durations.zip = s.seconds;
      done(s);
    }
  }

  if (args.size) {
    const t0 = Date.now();
    rec.disk = {};
    if (fs.existsSync(worktree)) rec.disk.worktree = dirSize(worktree, { skip: [path.join(worktree, ".git")] });
    if (fs.existsSync(packageDir)) rec.disk.package = dirSize(packageDir);
    if (rec.zip) rec.disk.zipBytes = rec.zip.bytes;
    rec.disk.countedSeconds = (Date.now() - t0) / 1000;
  }
  finish("ok");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
