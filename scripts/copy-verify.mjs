#!/usr/bin/env node
// 一覧に挙げたファイルだけを、元から写し先へバイトのまま写し、写した後に SHA-256 を元と照らす。
// ユーザーの裁定（2026-11-16「写し方」）: 写すのはコマンドか台本で行い、LLM の機能（Read で読んで Write で書く）で写さない。
// 最初の使い道は records/phase0/evidence/ の22ファイルを C:\b\p0 から写し直すこと（tasks/2026-11-16-before-delete-c/）。
//
// 使い方:
//   node scripts/copy-verify.mjs --list <json> [--dry-run] [--out <json>]
//     --list     写す一覧（下の形）。必須
//     --dry-run  写さない。元と写し先の SHA-256 を取り、写すと何が変わるかだけを出す
//     --out      結果の JSON を書く場所（標準出力にも出す）。リポジトリの tasks/ か tmp/tests/ の下に限る。元の柵（fromRoot）の下・
//                一覧の元や写し先や一覧のファイルと同じ場所は不可（終了コード 2。何も写さない）
//
// 一覧の形:
//   {
//     "fromRoot": "C:/b/p0",                       // 元はすべてこの下（絶対パス）。複数なら配列
//     "toRoot": "records/phase0/evidence",         // 写し先はすべてこの下（このリポジトリからの相対か絶対）。複数なら配列
//                                                  // 行ごとに、from がどれかの fromRoot の下、to がどれかの toRoot の下にあればよい
//     "entries": [
//       { "from": "C:/b/p0/vsix/verify-result.json",           // 元（絶対パス）
//         "to": "records/phase0/evidence/vsix/verify-result.json", // 写し先（このリポジトリからの相対か絶対）
//         "expectSha256": "02bc…" }                            // 任意。元がこの値でなければ、その行は写さない
//     ]
//   }
//
// 守り:
//   - 書くのは一覧の to だけ（上書きする。無ければフォルダごと作る）。一覧の外のファイルには触れない。何も消さない。
//   - 一覧の誤り（from が fromRoot の外・to が toRoot の外・to の重なり・元が無い・元がファイルでない・リンク）が
//     1つでもあれば、何も写さずに終了コード 2 で止める。
//   - 元と写し先の、柵の根から親までの途中のフォルダに、リンク（ジャンクションを含む）があっても誤りにする。
//     途中のフォルダの実体（realpath）が柵の根の実体の外でも誤り。写す直前にも同じことを見直す。
//   - expectSha256 が元と違う行は写さない（元が記録の後に変わった恐れ）。ほかの行は写す。
//   - 元は読むだけ。
//
// 出力: { checkedAt, list, dryRun, fromRoot, toRoot, entries: [{ from, to, bytes, sourceSha256, expectSha256,
//         expectMatch, destBefore: { exists, sha256, bytes }, changed, copied, destSha256, match, error }],
//         counts: { entries, copied, unchanged, match, mismatch, errors }, result, message }
//   changed  写す前の写し先が元と違った（無かったときも true）
//   match    写した後の写し先の SHA-256 が元と同じ（--dry-run では、写す前の写し先が元と同じか）
// 終了コード: 0 = 全部の行が元と一致した、1 = 一致しない行か写せない行がある、2 = 引数か一覧の誤り
//
// 書き出している関数（テストの入口）: ArgError, ListError, parseArgs, isInside, sha256File, linkInChain, validateList,
//   checkOut, copyVerify、定数 OUT_ROOTS

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

export class ArgError extends Error {}
export class ListError extends Error {}

export function parseArgs(argv) {
  const a = { list: null, dryRun: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const need = () => {
      if (i + 1 >= argv.length || String(argv[i + 1]).startsWith("--")) throw new ArgError(`${x} に値が無い`);
      return argv[++i];
    };
    if (x === "--list") a.list = need();
    else if (x === "--out") a.out = need();
    else if (x === "--dry-run") a.dryRun = true;
    else throw new ArgError(`知らない引数: ${x}`);
  }
  if (!a.list) throw new ArgError("--list（写す一覧）が無い");
  return a;
}

// child が root そのものか、その下か（Windows の大文字小文字を区別しない）。どちらも絶対パスで渡す。
export function isInside(child, root) {
  const c = path.resolve(child).toLowerCase();
  const r = path.resolve(root).toLowerCase().replace(/[\\/]+$/, "");
  return c === r || c.startsWith(r + path.sep);
}

export function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function resolveFrom(p, baseDir) {
  return path.isAbsolute(p) ? path.resolve(p) : path.resolve(baseDir, p);
}

// --out を置いてよい場所（リポジトリからの相対）
export const OUT_ROOTS = Object.freeze(["tasks", "tmp/tests"]);

const sameName = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// p（ファイルのパス）の、柵の根 root から p の親までのフォルダを1つずつ lstat で見る。
// リンク（ジャンクションを含む。Node は Windows のジャンクションも isSymbolicLink で返す）か、フォルダでないものがあれば、
// その理由を返す。無いフォルダから先は見ない（写し先は mkdir で本物のフォルダを作る）。
// さらに、在るフォルダのうちいちばん深いものの実体（realpath）が、根の実体の下にあることも見る。問題が無ければ null。
export function linkInChain(p, root) {
  const rootAbs = path.resolve(root);
  const abs = path.resolve(p);
  if (!isInside(abs, rootAbs)) return `柵の外: ${abs}`;
  const rel = path.relative(rootAbs, path.dirname(abs));
  const parts = rel ? rel.split(path.sep).filter(Boolean) : [];
  let cur = rootAbs;
  let deepest = null;
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) cur = path.join(cur, parts[i]);
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch {
      break;
    }
    if (st.isSymbolicLink()) return `途中のフォルダがリンクかジャンクション: ${cur}`;
    if (!st.isDirectory()) return `途中がフォルダでない: ${cur}`;
    deepest = cur;
  }
  if (deepest) {
    let rr, rd;
    try {
      rr = fs.realpathSync.native(rootAbs);
      rd = fs.realpathSync.native(deepest);
    } catch (err) {
      return `途中のフォルダの実体を確かめられない: ${deepest}（${err.message}）`;
    }
    if (!isInside(rd, rr)) return `途中のフォルダの実体が柵の外: ${deepest} -> ${rd}`;
  }
  return null;
}

// 結果の JSON を書く場所（--out）の柵。誤りがあれば ListError（全部を並べる）。戻り値は絶対パス。
//   - リポジトリの tasks/ の下か tmp/tests/ の下に限る（OUT_ROOTS。根そのものは不可。途中のフォルダにリンクがあっても不可）
//   - 元の柵（fromRoot）の下に置かない
//   - 一覧のどの元とも、どの写し先とも、一覧のファイルとも同じにしない
//   - 既にあるものがリンクかフォルダなら不可
//   cwd: --out の相対パスの基準（既定は今の作業場所）。repo: tasks/ を探すリポジトリ（既定はこのリポジトリ）
export function checkOut(out, checked, { cwd = process.cwd(), repo = REPO, listPath = null } = {}) {
  const errors = [];
  const abs = path.resolve(cwd, out);
  // 置いてよい場所は2つだけ（2026-11-16 リーダーの判断）: tasks/ の下と、テストの作業場所 tmp/tests/ の下。
  // tmp/b（ビルドの置き場所）の下と tmp/ の直下には置けない。根そのものも不可
  const outRoots = OUT_ROOTS.map((r) => path.join(path.resolve(repo), ...r.split("/")));
  const outRoot = outRoots.find((r) => isInside(abs, r) && !sameName(abs, r));
  if (!outRoot) errors.push(`--out がリポジトリの ${OUT_ROOTS.map((r) => `${r}/`).join(" か ")} の下でない: ${out}`);
  else {
    const why = linkInChain(abs, outRoot);
    if (why) errors.push(`--out の ${why}`);
  }
  const fromRoots = Array.isArray(checked.fromRoot) ? checked.fromRoot : [checked.fromRoot];
  for (const r of fromRoots) if (isInside(abs, r)) errors.push(`--out が元の柵（fromRoot）の下: ${out}`);
  checked.entries.forEach((e, i) => {
    if (sameName(abs, e.fromAbs)) errors.push(`--out が entries[${i}] の元と同じ: ${out}`);
    if (sameName(abs, e.toAbs)) errors.push(`--out が entries[${i}] の写し先と同じ: ${out}`);
  });
  if (listPath && sameName(abs, listPath)) errors.push(`--out が一覧のファイルと同じ: ${out}`);
  try {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) errors.push(`--out がリンク: ${out}`);
    else if (!st.isFile()) errors.push(`--out がファイルでない: ${out}`);
  } catch {}
  if (errors.length) throw new ListError(errors.join("; "));
  return abs;
}

// 一覧を読んで確かめる。誤りがあれば ListError（1つ目の誤りだけでなく、全部を message に並べる）。
//   baseDir: to と toRoot の相対パスの基準（既定はこのリポジトリの直下）
export function validateList(list, { baseDir = REPO } = {}) {
  const errors = [];
  if (!list || typeof list !== "object" || Array.isArray(list)) throw new ListError("一覧が JSON のオブジェクトでない");
  const { entries } = list;
  // fromRoot・toRoot は文字列か、文字列の配列（柵を複数置くとき）
  const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const fromRoots = asList(list.fromRoot);
  const toRoots = asList(list.toRoot);
  if (fromRoots.length === 0 || fromRoots.some((r) => typeof r !== "string" || !path.isAbsolute(r))) errors.push("fromRoot が絶対パス（かその配列）でない");
  if (toRoots.length === 0 || toRoots.some((r) => typeof r !== "string" || !r)) errors.push("toRoot が無い");
  if (!Array.isArray(entries) || entries.length === 0) errors.push("entries が空か配列でない");
  if (errors.length) throw new ListError(errors.join("; "));

  const fromRootsAbs = fromRoots.map((r) => path.resolve(r));
  const toRootsAbs = toRoots.map((r) => resolveFrom(r, baseDir));
  for (const f of fromRootsAbs) for (const t of toRootsAbs) if (isInside(t, f) || isInside(f, t)) errors.push(`fromRoot と toRoot が重なる: ${f} / ${t}`);
  // 柵そのものは写す先・元にしない（柵の下だけ）
  const under = (p, roots) => roots.some((r) => isInside(p, r) && p.toLowerCase() !== r.toLowerCase());

  const seenTo = new Map();
  const out = [];
  entries.forEach((e, i) => {
    const tag = `entries[${i}]`;
    if (!e || typeof e.from !== "string" || typeof e.to !== "string") {
      errors.push(`${tag}: from と to が文字列でない`);
      return;
    }
    if (!path.isAbsolute(e.from)) errors.push(`${tag}: from が絶対パスでない: ${e.from}`);
    const fromAbs = path.resolve(e.from);
    const toAbs = resolveFrom(e.to, baseDir);
    const fromFence = fromRootsAbs.find((r) => under(fromAbs, [r]));
    const toFence = toRootsAbs.find((r) => under(toAbs, [r]));
    if (!fromFence) errors.push(`${tag}: from が fromRoot の外: ${e.from}`);
    if (!toFence) errors.push(`${tag}: to が toRoot の外: ${e.to}`);
    // 途中のフォルダのリンク・ジャンクション（たどると柵の外を読む・書く恐れ）
    if (fromFence) {
      const why = linkInChain(fromAbs, fromFence);
      if (why) errors.push(`${tag}: 元の${why}`);
    }
    if (toFence) {
      const why = linkInChain(toAbs, toFence);
      if (why) errors.push(`${tag}: 写し先の${why}`);
    }
    const key = toAbs.toLowerCase();
    if (seenTo.has(key)) errors.push(`${tag}: to が entries[${seenTo.get(key)}] と同じ: ${e.to}`);
    else seenTo.set(key, i);
    if (e.expectSha256 != null && !/^[0-9a-f]{64}$/.test(String(e.expectSha256))) errors.push(`${tag}: expectSha256 が64桁の小文字の16進でない`);
    let st = null;
    try {
      st = fs.lstatSync(fromAbs);
    } catch {
      errors.push(`${tag}: 元が無い: ${e.from}`);
    }
    if (st && st.isSymbolicLink()) errors.push(`${tag}: 元がリンク: ${e.from}`);
    else if (st && !st.isFile()) errors.push(`${tag}: 元がファイルでない: ${e.from}`);
    try {
      const d = fs.lstatSync(toAbs);
      if (d.isSymbolicLink()) errors.push(`${tag}: 写し先がリンク: ${e.to}`);
      else if (!d.isFile()) errors.push(`${tag}: 写し先がファイルでない: ${e.to}`);
    } catch {}
    out.push({ from: e.from, to: e.to, fromAbs, toAbs, fromFence: fromFence ?? null, toFence: toFence ?? null, expectSha256: e.expectSha256 ?? null });
  });
  if (errors.length) throw new ListError(errors.join("; "));
  // 柵が1つなら文字列のまま返す（1回目の出力の形と同じ）
  const one = (xs) => (xs.length === 1 ? xs[0] : xs);
  return { fromRoot: one(fromRootsAbs), toRoot: one(toRootsAbs), entries: out };
}

function destState(p) {
  try {
    const st = fs.statSync(p);
    return { exists: true, sha256: sha256File(p), bytes: st.size };
  } catch {
    return { exists: false, sha256: null, bytes: null };
  }
}

// 確かめ済みの一覧（validateList の戻り値）で写して照らす。消すことはしない。
export function copyVerify(checked, { dryRun = false } = {}) {
  const rows = [];
  for (const e of checked.entries) {
    const r = { from: e.from, to: e.to, bytes: null, sourceSha256: null, expectSha256: e.expectSha256, expectMatch: null, destBefore: null, changed: null, copied: false, destSha256: null, match: false, error: null };
    try {
      // 確かめてから写すまでの間に、途中のフォルダがリンクに変わっていないかを見直す（validateList と同じ確かめ）
      const why = (e.fromFence && linkInChain(e.fromAbs, e.fromFence)) || (e.toFence && linkInChain(e.toAbs, e.toFence));
      if (why) throw new Error(`写す前の見直しで止めた: ${why}`);
      r.bytes = fs.statSync(e.fromAbs).size;
      r.sourceSha256 = sha256File(e.fromAbs);
      if (e.expectSha256) r.expectMatch = r.sourceSha256 === e.expectSha256;
      r.destBefore = destState(e.toAbs);
      r.changed = r.destBefore.sha256 !== r.sourceSha256;
      if (r.expectMatch === false) {
        r.error = "元の SHA-256 が一覧の expectSha256 と違う（写していない）";
      } else if (dryRun) {
        r.destSha256 = r.destBefore.sha256;
        r.match = r.destBefore.sha256 === r.sourceSha256;
      } else {
        fs.mkdirSync(path.dirname(e.toAbs), { recursive: true });
        fs.copyFileSync(e.fromAbs, e.toAbs);
        r.copied = true;
        r.destSha256 = sha256File(e.toAbs);
        // 写している間に元が変わっていないことも見る
        const again = sha256File(e.fromAbs);
        r.match = r.destSha256 === r.sourceSha256 && again === r.sourceSha256;
        if (again !== r.sourceSha256) r.error = "写している間に元が変わった";
      }
    } catch (err) {
      r.error = err.message;
    }
    rows.push(r);
  }
  const counts = {
    entries: rows.length,
    copied: rows.filter((r) => r.copied).length,
    unchanged: rows.filter((r) => r.changed === false).length,
    match: rows.filter((r) => r.match).length,
    mismatch: rows.filter((r) => !r.match && !r.error).length,
    errors: rows.filter((r) => r.error).length,
  };
  const ok = counts.match === counts.entries && counts.errors === 0;
  let message;
  if (dryRun) message = ok ? `dry run: all ${counts.entries} destinations already match the sources` : `dry run: ${counts.entries - counts.match} of ${counts.entries} destinations differ from the sources (nothing written)`;
  else message = ok ? `copied ${counts.copied} files; all ${counts.entries} match the sources` : `${counts.entries - counts.match} of ${counts.entries} entries do not match the sources (errors: ${counts.errors})`;
  return { entries: rows, counts, result: ok ? "ok" : "error", message };
}

function main() {
  let a;
  try {
    a = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[copy-verify] ${err.message}`);
    process.exit(2);
  }
  let checked;
  let outAbs = null;
  const listPath = path.resolve(a.list);
  try {
    const raw = fs.readFileSync(listPath, "utf8").replace(/^\uFEFF/, "");
    checked = validateList(JSON.parse(raw));
  } catch (err) {
    console.error(`[copy-verify] 一覧の誤り（何も写していない）: ${err.message}`);
    process.exit(2);
  }
  if (a.out) {
    try {
      outAbs = checkOut(a.out, checked, { listPath });
    } catch (err) {
      console.error(`[copy-verify] --out の誤り（何も写していない）: ${err.message}`);
      process.exit(2);
    }
  }
  const r = copyVerify(checked, { dryRun: a.dryRun });
  const out = { checkedAt: new Date().toISOString(), list: a.list, dryRun: a.dryRun, fromRoot: checked.fromRoot, toRoot: checked.toRoot, ...r };
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (outAbs) {
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, text);
  }
  process.stdout.write(text);
  process.exit(out.result === "ok" ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
