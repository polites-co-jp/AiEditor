// 修理（docs/06 の4節の手順 3・5、7節）の部品。当たらなかった理由の分類、衝突の印の検出、修理の依頼文、修理の結果の検査。
// 純粋な関数だけ。git を動かすのは scripts/take-in.mjs。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の4節。

// checks.json（apply.mjs の出力）の stoppedAt から、修理できるかと、何を直すかを決める。
// 返り値 { kind, unitId, patchName, file, conflicts, message, repairable }
//   kind: 'removeLines' | 'missing' | 'removeDependencies' | 'editsConflict' | 'patchConflict' | 'notRepairable' | 'none'
export function classifyApplyFailure(checks) {
  const none = { kind: "none", unitId: null, patchName: null, file: null, conflicts: [], message: null, repairable: false };
  if (!checks || typeof checks !== "object") return { ...none, kind: "notRepairable", message: "checks.json が無い" };
  const st = checks.stoppedAt;
  if (!st) return none;
  const message = String(st.message || "");
  const base = { ...none, message };
  if (st.phase === "unit") {
    const unitId = st.id || null;
    const ur = (checks.units || []).find((u) => u && u.id === unitId) || null;
    if (/after の単位が当たっていない/.test(message)) return { ...base, kind: "notRepairable", unitId };
    if (/edits\.patch が当たらない|patch が当たらない/.test(message)) {
      return {
        ...base,
        kind: "editsConflict",
        unitId,
        conflicts: (ur && ur.edits && ur.edits.conflicts) || [],
        kept: !!(ur && ur.edits && ur.edits.keptConflict),
        repairable: true,
      };
    }
    if (/patch が無い/.test(message)) return { ...base, kind: "notRepairable", unitId };
    // apply.mjs の文: "<id>: removeLines: <file> が無い"（ファイルが消えた）/ "<id>: removeLines: <file>: <誤り>: <行>"（行が合わない）
    const gone = /(removeLines|removeDependencies): (\S+) が無い$/.exec(message);
    if (gone) return { ...base, kind: "missing", unitId, file: gone[2], repairable: true };
    const m = /(removeLines|removeDependencies): ([^:\s]+): /.exec(message);
    if (m && m[1] === "removeLines") return { ...base, kind: "removeLines", unitId, file: m[2], repairable: true };
    if (m) return { ...base, kind: "removeDependencies", unitId, file: m[2], repairable: true };
    return { ...base, kind: "notRepairable", unitId };
  }
  if (st.phase === "patch") {
    const pr = (checks.patches || []).find((p) => p && p.file && p.file.split("/").pop() === st.id) || null;
    return { ...base, kind: "patchConflict", patchName: st.id, conflicts: (pr && pr.conflicts) || [], kept: !!(pr && pr.keptConflict), repairable: true };
  }
  return { ...base, kind: "notRepairable" };
}

// 衝突の印（<<<<<<< / ======= / >>>>>>> / |||||||）の行番号（1 始まり）。
export function findConflictMarkers(text) {
  const out = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((l, i) => {
      if (/^(<{7}|>{7})( |$)/.test(l) || /^={7}$/.test(l) || /^\|{7}( |$)/.test(l)) out.push(i + 1);
    });
  return out;
}

// リポジトリの中の相対パスを正規化する（"/" 区切り、"." と空の区切りを除き、".." を畳む）。
// 絶対パス（/ や \ で始まる、UNC）・ドライブ文字（C: など）・".." で根の外へ出るものは null。
export function normalizeRepoPath(p) {
  let s = String(p == null ? "" : p).trim().replace(/\\/g, "/");
  if (!s || s.startsWith("/") || /^[A-Za-z]:/.test(s)) return null;
  const parts = [];
  for (const seg of s.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    if (/^[A-Za-z]:/.test(seg)) return null;
    parts.push(seg);
  }
  return parts.length ? parts.join("/") : null;
}

// path が allowed のフォルダ（"removals/" など）の中に留まるか。正規化してから比べる（"removals/../src/x.ts" は外）。
// フォルダそのもの（"removals/" や "removals"）は中とみなす（git status が未追跡のフォルダを1行で出すため）。
export function isInsideAllowed(p, allowed = ["removals/", "patches/"]) {
  const n = normalizeRepoPath(p);
  if (!n) return false;
  return allowed.some((a) => {
    const base = normalizeRepoPath(a);
    return !!base && (n === base || n.startsWith(base + "/"));
  });
}

// git status --porcelain の出力のうち、removals/ と patches/ の外のパス（修理の守り。TAKE-IN.md の規約）。
// 名前を変えた行（"R  a -> b"）は両方を見て、どちらかが外なら外とする。引用（"..."）は外す。
export function outsideAllowed(porcelain, allowed = ["removals/", "patches/"]) {
  const out = [];
  const unquote = (x) => x.trim().replace(/^"(.*)"$/, "$1");
  for (const raw of String(porcelain || "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const body = raw.length > 3 ? raw.slice(3) : raw.trim();
    const paths = body.includes(" -> ") ? body.split(" -> ").map(unquote) : [unquote(body)];
    for (const p of paths) if (!isInsideAllowed(p, allowed)) out.push(p.replace(/\\/g, "/"));
  }
  return [...new Set(out)];
}

// 修理の構造化出力の fixes を、持ち主（unit:<id> / patch:<name>）ごとに分ける。unknown や形の違うものは unknown へ。
export function groupFixes(fixes) {
  const groups = {};
  const unknown = [];
  for (const f of Array.isArray(fixes) ? fixes : []) {
    if (!f || typeof f.file !== "string" || !f.file) continue;
    const file = f.file.replace(/\\/g, "/").replace(/^\.\//, "");
    const owner = typeof f.owner === "string" ? f.owner.trim() : "";
    if (/^unit:[A-Z]-\d+(-[A-Za-z0-9._-]+)?$/.test(owner) || /^patch:[^/\\]+\.patch$/.test(owner)) {
      (groups[owner] = groups[owner] || []).push(file);
    } else unknown.push(file);
  }
  for (const k of Object.keys(groups)) groups[k] = [...new Set(groups[k])].sort();
  return { groups, unknown: [...new Set(unknown)].sort() };
}

const fence = (s) => "```\n" + String(s || "").replace(/```/g, "ʼʼʼ") + "\n```";

// 修理の依頼文（標準入力で渡す本文）。規約は TAKE-IN.md（--append-system-prompt-file で渡す）。
// ctx: { label, tag, prevTag, attempt, max, failure（classifyApplyFailure の返り値）, unit（unit.json）, unitReadme,
//        builderWorktree, worktree, gitStatus, gitDiff, typecheckTail, patchText }
export function buildRepairRequest(ctx) {
  const L = [];
  const f = ctx.failure || {};
  L.push(`# 取り込み ${ctx.label} の修理（${ctx.attempt}/${ctx.max} 回目）`, "");
  L.push(`本家 ${ctx.prevTag || "?"} → ${ctx.tag}。規約はシステムプロンプトの TAKE-IN.md。守れない直し（単位の意図を変える、消す範囲を変える）は行わず needsJudgment に書く。`, "");
  L.push("## 場所", "");
  L.push(`- 本家の作業ツリー（今の作業場所）: ${ctx.worktree}`);
  L.push(`- ビルドリポジトリ（取り込みのブランチの作業ツリー。直してよいのは removals/ と patches/ の中だけ）: ${ctx.builderWorktree}`, "");
  if (ctx.mode === "typecheck") {
    L.push("## 何が起きたか: 型検査の誤り", "");
    L.push("すべての単位とパッチを当てた後の型検査が通らない。作業ツリーのファイルを直す。直したファイルごとに、どの単位（unit:<ID>）の都合か、どのパッチ（patch:<ファイル名>）の都合かを fixes の owner に書く。どれか分からなければ unknown と書く（台本は止まる）。", "");
    L.push("### 型検査のログの末尾", "", fence(ctx.typecheckTail), "");
    if (ctx.appliedUnits) L.push("### 当てた単位", "", ctx.appliedUnits.map((u) => `- ${u.id}: ${u.intent || ""}`).join("\n"), "");
  } else if (f.kind === "removeLines" || f.kind === "missing" || f.kind === "removeDependencies") {
    L.push(`## 何が起きたか: 単位 ${f.unitId} の宣言が本家の新しい版に合わない`, "");
    L.push(`apply.mjs のメッセージ: ${f.message}`, "");
    L.push(`直すもの: ${ctx.builderWorktree}\\removals\\${f.unitId}\\unit.json の removeLines（または removeDependencies・delete）。本家のファイルの今の行を読み、同じ参照を消す行に書き換える。参照が本家から無くなったなら、その要素を消してよい（意図は変わらない）。作業ツリーのファイルは直さない（台本が作業ツリーを戻して当て直す）。fixes の owner は unit:${f.unitId}。`, "");
  } else if (f.kind === "editsConflict" || f.kind === "patchConflict") {
    const what = f.kind === "editsConflict" ? `単位 ${f.unitId} の edits.patch` : `パッチ patches/${f.patchName}`;
    L.push(`## 何が起きたか: ${what} が 3-way で当たらず、作業ツリーに衝突が残っている（git am の途中）`, "");
    L.push(`apply.mjs のメッセージ: ${f.message}`, "");
    L.push(`衝突のファイル: ${(f.conflicts || []).join(", ") || "（無し。パッチが当たる場所が見つからない）"}`, "");
    L.push("直すもの: 作業ツリーの衝突のファイル。本家側の変更を採り、そのうえでパッチの意図どおりに直す。衝突の印（<<<<<<< ======= >>>>>>>）を残さない。衝突のファイルが無いときは、パッチの意図を作業ツリーに手で当てる。git の操作（add・am --continue・format-patch）は台本が行うので、しない。", "");
    L.push(`fixes の owner は ${f.kind === "editsConflict" ? `unit:${f.unitId}` : `patch:${f.patchName}`}。`, "");
    if (ctx.patchText) L.push("### 当てようとしたパッチ", "", fence(ctx.patchText), "");
  }
  if (ctx.unit) L.push("### unit.json", "", fence(JSON.stringify(ctx.unit, null, 2)), "");
  if (ctx.unitReadme) L.push("### 単位の README.md", "", fence(ctx.unitReadme), "");
  if (ctx.gitStatus !== undefined) L.push("### 作業ツリーの git status --porcelain", "", fence(ctx.gitStatus), "");
  if (ctx.gitDiff) L.push("### 作業ツリーの git diff（衝突を含む。長いときは先頭だけ）", "", fence(ctx.gitDiff), "");
  L.push("## 返すもの", "", "構造化出力（status・summary・fixes・needsJudgment）。");
  return L.join("\n") + "\n";
}

// 修理の短い依頼文（引数で渡す）。
export const REPAIR_PROMPT = "標準入力で渡した修理の依頼に従い、規約（TAKE-IN.md）を守って直し、構造化出力で結果を返せ。";
