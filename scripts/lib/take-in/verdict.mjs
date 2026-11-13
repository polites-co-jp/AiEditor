// 判定の形（docs/06 の7.3）: claude -p の --json-schema に渡す JSON Schema、受け取った判定の検査、
// 台本が知る事実との照らし合わせ、verdict.md の組み立て。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の5・7・11節。

export const VERDICTS = Object.freeze(["pass", "conditional", "fail"]);
export const RECOMMENDATIONS = Object.freeze({ pass: "入れ替えてよい", conditional: "条件を満たしてから", fail: "見送る" });
export const REQUIRED_KEYS = Object.freeze([
  "label", "verdict", "security", "patches", "checks", "build", "smoke", "network", "newUpstreamParts", "conditions", "recommendation",
]);
// 合格のときに許す値（拡張の取り込みではビルドと適用後の検査が無いので n/a）
const OK_LIKE = new Set(["ok", "n/a"]);
const PROPOSAL_RE = /^(keep|removal-unit:[A-Z]-\d+(-[A-Za-z0-9._-]+)?)$/;

const strArr = { type: "array", items: { type: "string" } };

// --json-schema に渡す schema。docs/06 の7.3 の11個に、判定役の定義（.claude/agents/di-renjie.md）の
// 「理由・確かめた材料・入れ替えの前に見るべき点」と、ユーザーが読む verdict.md の本文を足した。
export const VERDICT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [...REQUIRED_KEYS, "kind", "reasons", "materialsRead", "missingMaterials", "userChecksBeforeSwitch", "markdown"],
  properties: {
    label: { type: "string" },
    kind: { type: "string", enum: ["core", "ext"] },
    verdict: { type: "string", enum: [...VERDICTS] },
    security: {
      type: "object",
      additionalProperties: false,
      required: ["advisories", "relevantToThisBuild"],
      properties: {
        advisories: strArr,
        relevantToThisBuild: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "relevant", "why"],
            properties: { id: { type: "string" }, relevant: { type: "boolean" }, why: { type: "string" } },
          },
        },
      },
    },
    patches: {
      type: "object",
      additionalProperties: false,
      required: ["changed", "why"],
      properties: { changed: strArr, why: { type: "string" } },
    },
    checks: { type: "string", description: "ok / hold / fail / skipped / n/a" },
    build: { type: "string", description: "ok / failed / skipped / n/a" },
    smoke: {
      type: "object",
      additionalProperties: false,
      required: ["auto", "manualToDo"],
      properties: { auto: { type: "string", description: "ok / failed / skipped / n/a" }, manualToDo: strArr },
    },
    network: {
      type: "object",
      additionalProperties: false,
      required: ["newHosts"],
      properties: { newHosts: strArr },
    },
    newUpstreamParts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "proposal", "why"],
        properties: {
          path: { type: "string" },
          proposal: { type: "string", description: "keep か removal-unit:<単位の ID>" },
          why: { type: "string" },
        },
      },
    },
    conditions: strArr,
    recommendation: { type: "string", enum: Object.values(RECOMMENDATIONS) },
    reasons: { ...strArr, description: "判定の理由の要点（ToDo に写す）" },
    materialsRead: { ...strArr, description: "読んだ材料のパス" },
    missingMaterials: { ...strArr, description: "足りなかった材料。あれば pass にしない" },
    userChecksBeforeSwitch: { ...strArr, description: "ユーザーが入れ替えの前に見るべき点" },
    markdown: { type: "string", description: "verdict.md の本文（日本語。ユーザーが読む）" },
  },
});

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isStrArr = (x) => Array.isArray(x) && x.every((s) => typeof s === "string");

// 判定の検査。誤りの文字列の配列を返す（空なら正しい）。docs/06 の7.3 の11個だけを必須にする
// （schema の残りの項目は claude -p の側で強制され、ここでは形が正しいときだけ見る）。
export function validateVerdict(v, { label } = {}) {
  if (!isObj(v)) return ["判定が JSON のオブジェクトでない"];
  const e = [];
  for (const k of REQUIRED_KEYS) if (!(k in v)) e.push(`${k} が無い`);
  if ("label" in v && (typeof v.label !== "string" || !v.label)) e.push("label が空でない文字列でない");
  if (label && typeof v.label === "string" && v.label !== label) e.push(`label が ${label} でない: ${v.label}`);
  if ("verdict" in v && !VERDICTS.includes(v.verdict)) e.push(`verdict が ${VERDICTS.join("・")} のどれでもない: ${JSON.stringify(v.verdict)}`);
  if ("kind" in v && !["core", "ext"].includes(v.kind)) e.push(`kind が core・ext のどちらでもない: ${JSON.stringify(v.kind)}`);

  if ("security" in v) {
    const s = v.security;
    if (!isObj(s)) e.push("security がオブジェクトでない");
    else {
      if (!isStrArr(s.advisories)) e.push("security.advisories が文字列の配列でない");
      if (!Array.isArray(s.relevantToThisBuild)) e.push("security.relevantToThisBuild が配列でない");
      else
        s.relevantToThisBuild.forEach((r, i) => {
          if (!isObj(r)) return e.push(`security.relevantToThisBuild[${i}] がオブジェクトでない`);
          if (typeof r.id !== "string" || !r.id) e.push(`security.relevantToThisBuild[${i}].id が無い`);
          if (typeof r.relevant !== "boolean") e.push(`security.relevantToThisBuild[${i}].relevant が真偽値でない`);
          if (typeof r.why !== "string") e.push(`security.relevantToThisBuild[${i}].why が文字列でない`);
        });
    }
  }
  if ("patches" in v) {
    if (!isObj(v.patches)) e.push("patches がオブジェクトでない");
    else {
      if (!isStrArr(v.patches.changed)) e.push("patches.changed が文字列の配列でない");
      if (typeof v.patches.why !== "string") e.push("patches.why が文字列でない");
    }
  }
  for (const k of ["checks", "build"]) if (k in v && (typeof v[k] !== "string" || !v[k])) e.push(`${k} が空でない文字列でない`);
  if ("smoke" in v) {
    if (!isObj(v.smoke)) e.push("smoke がオブジェクトでない");
    else {
      if (typeof v.smoke.auto !== "string" || !v.smoke.auto) e.push("smoke.auto が空でない文字列でない");
      if (!isStrArr(v.smoke.manualToDo)) e.push("smoke.manualToDo が文字列の配列でない");
    }
  }
  if ("network" in v) {
    if (!isObj(v.network)) e.push("network がオブジェクトでない");
    else if (!isStrArr(v.network.newHosts)) e.push("network.newHosts が文字列の配列でない");
  }
  if ("newUpstreamParts" in v) {
    if (!Array.isArray(v.newUpstreamParts)) e.push("newUpstreamParts が配列でない");
    else
      v.newUpstreamParts.forEach((p, i) => {
        if (!isObj(p)) return e.push(`newUpstreamParts[${i}] がオブジェクトでない`);
        if (typeof p.path !== "string" || !p.path) e.push(`newUpstreamParts[${i}].path が無い`);
        if (typeof p.proposal !== "string" || !PROPOSAL_RE.test(p.proposal)) e.push(`newUpstreamParts[${i}].proposal が keep か removal-unit:<ID> でない: ${JSON.stringify(p.proposal)}`);
        if (typeof p.why !== "string") e.push(`newUpstreamParts[${i}].why が文字列でない`);
      });
  }
  if ("conditions" in v && !isStrArr(v.conditions)) e.push("conditions が文字列の配列でない");
  if ("recommendation" in v && (typeof v.recommendation !== "string" || !v.recommendation)) e.push("recommendation が空でない文字列でない");
  for (const k of ["reasons", "materialsRead", "missingMaterials", "userChecksBeforeSwitch"]) if (k in v && !isStrArr(v[k])) e.push(`${k} が文字列の配列でない`);
  if ("markdown" in v && typeof v.markdown !== "string") e.push("markdown が文字列でない");

  // 合格の条件（docs/06 の7.3）との矛盾
  if (v.verdict === "pass") {
    if (typeof v.build === "string" && !OK_LIKE.has(v.build)) e.push(`合格なのに build が ok でない: ${v.build}`);
    if (typeof v.checks === "string" && !OK_LIKE.has(v.checks)) e.push(`合格なのに checks が ok でない: ${v.checks}`);
    if (isObj(v.smoke) && typeof v.smoke.auto === "string" && !OK_LIKE.has(v.smoke.auto)) e.push(`合格なのに smoke.auto が ok でない: ${v.smoke.auto}`);
    if (isObj(v.network) && Array.isArray(v.network.newHosts) && v.network.newHosts.length) e.push("合格なのに network.newHosts がある（新しい宛先はユーザーが決める。条件付き）");
    if (Array.isArray(v.missingMaterials) && v.missingMaterials.length) e.push("合格なのに missingMaterials がある");
    if (Array.isArray(v.conditions) && v.conditions.length) e.push("合格なのに conditions がある（条件付きにする）");
  }
  return e;
}

// 台本が知る事実と判定の食い違い（判定役の判定は書き換えず、違反として verdict.json と verdict.md に添える）。
// facts: { kind, checks: 'ok'|'hold'|'fail'|'n/a', build: 'ok'|'failed'|'skipped'|'n/a', smokeAuto, netaudit: 'ok'|'skipped'|'failed'|'n/a',
//          newHosts: [...], writeback }
export function guardVerdict(v, facts = {}) {
  const out = [];
  if (!isObj(v)) return ["判定が無い"];
  const notOk = (x) => x !== undefined && x !== null && !OK_LIKE.has(x);
  if (v.verdict === "pass") {
    if (notOk(facts.checks)) out.push(`台本の記録では適用後の検査が ${facts.checks} なのに合格`);
    if (notOk(facts.build)) out.push(`台本の記録ではビルドが ${facts.build} なのに合格`);
    if (notOk(facts.smokeAuto)) out.push(`台本の記録では自動のスモークが ${facts.smokeAuto} なのに合格`);
    if (notOk(facts.netaudit)) out.push(`台本の記録では通信の監査が ${facts.netaudit} なのに合格`);
    if (Array.isArray(facts.newHosts) && facts.newHosts.length) out.push(`台本の記録では許した宛先の外の接続先がある（${facts.newHosts.join(", ")}）のに合格`);
  }
  if (facts.build && v.build && facts.build !== v.build && !(facts.build === "n/a")) out.push(`build の値が台本の記録（${facts.build}）と違う: ${v.build}`);
  if (facts.checks && v.checks && facts.checks !== v.checks && !(facts.checks === "n/a")) out.push(`checks の値が台本の記録（${facts.checks}）と違う: ${v.checks}`);
  const rec = RECOMMENDATIONS[v.verdict];
  if (rec && v.recommendation && v.recommendation !== rec) out.push(`recommendation が判定（${v.verdict}）の言い方（${rec}）と違う: ${v.recommendation}`);
  return out;
}

// verdict.md の本文。判定役の markdown を本文にし、頭に要約と台本の照らし合わせを置く。
export function renderVerdictMarkdown(v, { guard = [], label, verdictInvalid = [], writeback = null } = {}) {
  const lines = [];
  const lbl = (isObj(v) && v.label) || label || "?";
  lines.push(`# 取り込みの判定: ${lbl}`, "");
  if (!isObj(v) || verdictInvalid.length) {
    lines.push("**判定を受け取れなかった（形が正しくない）。この取り込みは採らないこと。**", "");
    for (const m of verdictInvalid) lines.push(`- ${m}`);
    lines.push("", "判定役の出力そのものは `judge-output.json` にある。");
    return lines.join("\n") + "\n";
  }
  const ja = { pass: "合格", conditional: "条件付き", fail: "不合格" }[v.verdict] || v.verdict;
  lines.push(`- 判定: **${ja}**（${v.verdict}）`, `- 推奨: ${v.recommendation}`);
  if (Array.isArray(v.reasons) && v.reasons.length) lines.push(`- 理由: ${v.reasons.join(" / ")}`);
  if (Array.isArray(v.conditions) && v.conditions.length) lines.push(`- 条件: ${v.conditions.join(" / ")}`);
  if (writeback) lines.push(`- ToDo への書き戻し: ${writeback.ok ? "済み" : `できなかった（${writeback.message || "理由不明"}）`}`);
  lines.push("");
  if (guard.length) {
    lines.push("> **台本の照らし合わせで食い違いがあった。判定をそのまま信じずに材料を確かめること。**");
    for (const g of guard) lines.push(`> - ${g}`);
    lines.push("");
  }
  lines.push(typeof v.markdown === "string" && v.markdown.trim() ? v.markdown.trim() : "（判定役が本文を書かなかった）");
  return lines.join("\n") + "\n";
}

// ToDo に書く要約（判定、理由の要点、verdict.md のパス）。docs/06 の4節の10。
export function todoSummary(v, verdictPath) {
  if (!isObj(v)) return `判定を受け取れなかった（${verdictPath}）`;
  const ja = { pass: "合格", conditional: "条件付き", fail: "不合格" }[v.verdict] || v.verdict;
  const reasons = Array.isArray(v.reasons) ? v.reasons.slice(0, 3).join(" / ") : "";
  return `判定: ${ja}（${v.recommendation}）。${reasons ? `理由: ${reasons}。` : ""}詳しくは ${verdictPath}`;
}
