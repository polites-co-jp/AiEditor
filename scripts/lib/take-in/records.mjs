// 取り込みの記録（records/take-in/<label>/）と、判定役への依頼文。純粋な関数と、読むだけの関数。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の7節。

import fs from "node:fs";
import path from "node:path";

const toPosix = (p) => String(p).replace(/\\/g, "/");

// dir の下のファイルを、repoRoot からの相対パス（/ 区切り）で並べる（判定役の Read のため）。大きな物は大きさを添える。
export function listMaterials(dir, repoRoot, { skip = [/^judge-output\.json$/, /^verdict\.(json|md)$/] } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const rel = toPosix(path.relative(dir, p));
        if (skip.some((re) => re.test(rel))) continue;
        out.push({ path: toPosix(path.relative(repoRoot, p)), bytes: fs.statSync(p).size });
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

// 判定役（狄仁傑）への依頼文。材料はすべてビルドリポジトリの中（records/take-in/<label>/ と TAKE-IN.md など）の相対パス。
// ctx: { kind, label, tag?, prevTag?, extId?, extVersion?, prevExtVersion?, materials: [{path, bytes}], facts, issues: [path], notes: [string] }
export function buildJudgeRequest(ctx) {
  const L = [];
  const kindJa = ctx.kind === "ext" ? `拡張 ${ctx.extId} ${ctx.prevExtVersion || "?"} → ${ctx.extVersion}` : `本体 ${ctx.prevTag || "?"} → ${ctx.tag}`;
  L.push(`# 取り込みの判定の依頼: ${ctx.label}（${kindJa}）`, "");
  L.push("規約は `TAKE-IN.md`（判定の基準と形）。下の材料をすべて読み、判定を構造化出力で返せ。材料に無い事実を推測で補わない。足りない材料は missingMaterials に書き、そのときは pass にしない。", "");
  L.push(`- label: \`${ctx.label}\`、kind: \`${ctx.kind}\``);
  L.push("- 返す形: docs/06 の7.3 の項目に、reasons（理由の要点）・materialsRead（読んだ材料のパス）・missingMaterials・userChecksBeforeSwitch（入れ替えの前に見るべき点）・markdown（verdict.md の本文。日本語）を足したもの。", "");
  L.push("## 台本が記録した事実（判定と食い違えば、台本がその旨を verdict.md に添える）", "");
  for (const [k, v] of Object.entries(ctx.facts || {})) L.push(`- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  L.push("", "## 材料", "");
  for (const m of ctx.materials || []) L.push(`- \`${m.path}\`${m.bytes > 200000 ? `（${Math.round(m.bytes / 1024)} KB。必要な所だけ読む）` : ""}`);
  if (ctx.issues && ctx.issues.length) {
    L.push("", "## 前の取り込みで起きた不具合（ユーザーの記録）", "");
    for (const p of ctx.issues) L.push(`- \`${p}\``);
  }
  if (ctx.notes && ctx.notes.length) {
    L.push("", "## 注", "");
    for (const n of ctx.notes) L.push(`- ${n}`);
  }
  return L.join("\n") + "\n";
}

export const JUDGE_PROMPT = (requestPath) =>
  `${requestPath} を読み、そこに挙げた材料と TAKE-IN.md の規約に従って取り込みを判定し、構造化出力で返せ。`;

// records/take-in/*/issues.md（前の取り込みで起きた不具合。docs/06 の8節）の一覧。
export function listIssues(repoRoot) {
  const base = path.join(repoRoot, "records", "take-in");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(base, e.name, "issues.md")))
    .map((e) => `records/take-in/${e.name}/issues.md`)
    .sort();
}

// records/builds/<label>.json（docs/02 の7節）を、区切って走らせた build.mjs の記録と checks.json から組み立てる。
export function composeBuildRecord({ label, tag, commit, main, prepare, checks }) {
  const rec = { ...(main || {}) };
  rec.label = label;
  rec.upstream = { tag, commit: commit || (main && main.upstream && main.upstream.commit) || null };
  if (checks) {
    rec.units = (checks.units || []).map((u) => ({ id: u.id, enabled: u.enabled, applied: u.applied }));
    rec.patches = (checks.patches || []).map((p) => ({ file: p.file, applied: p.applied }));
    rec.applyResult = checks.result || null;
  }
  const prepSteps = prepare && Array.isArray(prepare.steps) ? prepare.steps : [];
  rec.steps = [...prepSteps, { name: "apply", status: checks ? (checks.result === "fail" ? "error" : "ok") : "unknown", by: "take-in.mjs（apply.mjs を直接）" }, ...((main && main.steps) || [])];
  rec.composedBy = "scripts/take-in.mjs（build.mjs を prepare と install 以降に分けて走らせた記録を合わせた）";
  return rec;
}

// 判定に添える「台本が知る事実」を、記録から作る。
export function factsFrom({ checks, buildMain, smoke, netaudit, kind }) {
  if (kind === "ext") {
    return { checks: "n/a", build: "n/a", smokeAuto: smoke ? smoke.status : "skipped", netaudit: "n/a", newHosts: [] };
  }
  const checksS = !checks ? "skipped" : checks.result === "ok" ? "ok" : checks.result === "hold" ? "hold" : "fail";
  const buildS = !buildMain ? "skipped" : buildMain.result === "ok" ? "ok" : "failed";
  return {
    checks: checksS,
    build: buildS,
    smokeAuto: smoke ? smoke.status : "skipped",
    netaudit: netaudit ? netaudit.status : "skipped",
    newHosts: netaudit && Array.isArray(netaudit.notAllowed) ? netaudit.notAllowed : [],
  };
}

// netaudit.ps1 の destinations.json（{ Meta, Destinations: [{ Group, HostKey, New, Allowed, ... }] }。
// records/network-audits/*/destinations.json で確かめた形）から、editor の組の許した宛先の外の接続先と、前の版から増えた接続先を拾う。
// 読めなければ null。返り値 { notAllowed: [HostKey], newHosts: [HostKey] }
export function auditHosts(destinations) {
  const rows = destinations && Array.isArray(destinations.Destinations) ? destinations.Destinations : Array.isArray(destinations) ? destinations : null;
  if (!rows) return null;
  const editor = rows.filter((r) => r && String(r.Group || "editor") === "editor");
  const key = (r) => String(r.HostKey || r.Names || "?");
  return {
    notAllowed: editor.filter((r) => r.Allowed === false).map(key),
    newHosts: editor.filter((r) => r.New === true).map(key),
  };
}
