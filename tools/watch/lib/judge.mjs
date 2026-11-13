// 更新の検知の判断（純粋な関数）。前回の状態との比べ、「セキュリティ修正あり」の判定（docs/06 の2.2）、
// ToDo の中身（docs/06 の2.3 の表と本文）。取得と Notion への書き込みは watch.mjs と scripts/lib/notion-*.mjs が行う。
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節）:
//   labelToVersion(label)                                  → "1.146.0-1" → "1.146.0"（読めなければ null）
//   relevantAdvisories(advisories, current, target)        → current の版に無く、target までに直る修正の一覧
//   planCore({ current, releases, advisories, target, seenAdvisories }) → null か本体の候補
//   finishCore(candidate, { notes })                       → セキュリティの判定を足した候補
//   planExtension({ entry, meta, target, now })            → null か拡張の候補
//   priorityFor(candidate)                                 → "高" | "中" | "低"
//   buildCoreTodo(candidate, { now, timeZone, previous })  → upsertTodo に渡す todo
//   buildExtTodo(candidate, { now, timeZone, previous })   → 同上
//   buildFailureTodo({ failingSince, errors, now, timeZone }) → 同上
//   failingDays(failingSince, now, timeZone)               → 失敗が続いた日数（その日を含む）

import { compareVersions, parseVersion, isSoaked, SOAK_HOURS } from "../../../scripts/lib/lock.mjs";
import {
  bullet,
  dueDateFor,
  heading3,
  localDate,
  paragraph,
  titlePrefixFor,
  stateKeyFor,
} from "../../../scripts/lib/notion-todo.mjs";
import { inVersionRange, mentionsSecurity, openVsxPageUrl, releaseNotesUrl } from "./sources.mjs";

export const CLAUDE_CODE_ID = "anthropic.claude-code";
const SEVERITY_ORDER = ["critical", "high", "medium", "moderate", "low"];

// 版のラベル（本家のタグ-ビルドの番号。docs/02 の6節）から本家の版を取る。
export function labelToVersion(label) {
  const m = /^(\d+\.\d+\.\d+)(?:-\d+)?$/.exec(String(label ?? "").trim());
  return m ? m[1] : null;
}

function cmp(a, b) {
  const c = compareVersions(a, b);
  return c === null ? 0 : c;
}

// current の版に修正が入っておらず、target までの版で直るアドバイザリ（docs/06 の2.2 の (a)）。
//   直る版: patched のうち current < P <= target のものがある
//   影響の範囲（vulnerableRanges）が読めて、current がどれにも入らないときは外す（current はすでに直っている。
//   旧い版への修正の写し（バックポート）で patched が複数あるときの誤りを避ける）
export function relevantAdvisories(advisories, current, target) {
  if (!Array.isArray(advisories) || !parseVersion(current) || !parseVersion(target)) return [];
  return advisories.filter((a) => {
    const fixedInRange = (a.patched || []).some((p) => cmp(p, current) > 0 && cmp(p, target) <= 0);
    if (!fixedInRange) return false;
    const verdicts = (a.vulnerableRanges || []).map((r) => inVersionRange(current, r));
    if (verdicts.length && verdicts.every((v) => v === false)) return false;
    return true;
  });
}

// 本体の候補。
//   current:        今の版（current の指す版。無ければ upstream.json のタグ）
//   releases:       parseReleases の結果（正式版）
//   advisories:     parseAdvisories の結果（取れなかったときは null）
//   target:         state.json の targets.core（{ lastNotifiedVersion, ... }）か null
//   seenAdvisories: これまでに見たアドバイザリの ID の配列
// 通知するのは、(1) 前回の通知（無ければ今の版）より新しい版が出た、または (2) 今の版から最新の版までの範囲に、
// まだ見ていないアドバイザリの修正が入った、のどちらか。通知しないときは null。
export function planCore({ current, releases, advisories, target = null, seenAdvisories = [] }) {
  if (!parseVersion(current)) throw new Error(`今の本体の版が読めない: ${current}`);
  const list = Array.isArray(releases) ? releases : [];
  const newer = list.filter((r) => cmp(r.version, current) > 0);
  if (newer.length === 0) return null;
  const latest = newer[newer.length - 1];
  const last = target && parseVersion(target.lastNotifiedVersion) ? target.lastNotifiedVersion : null;
  const base = last && cmp(last, current) > 0 ? last : current;
  const newVersions = newer.filter((r) => cmp(r.version, base) > 0);
  const relevant = Array.isArray(advisories) ? relevantAdvisories(advisories, current, latest.version) : [];
  const seen = new Set(Array.isArray(seenAdvisories) ? seenAdvisories : []);
  const unseen = relevant.filter((a) => !seen.has(a.id));
  if (newVersions.length === 0 && unseen.length === 0) return null;
  return {
    kind: "core",
    key: stateKeyFor("core"),
    current,
    version: latest.version,
    previousNotified: last,
    releases: newer,
    newVersions: newVersions.map((r) => r.version),
    advisories: relevant,
    newAdvisories: unseen.map((a) => a.id),
    advisoriesUnavailable: !Array.isArray(advisories),
    notesSecurity: [],
    bodySecurity: [],
    security: relevant.length > 0,
  };
}

// リリースノートと GitHub のリリースの本文から (b) を足す。
//   notes: Map か オブジェクト { "<版>": "<その版の security の文>" | null }（取れなかった版は undefined）
export function finishCore(candidate, { notes = {} } = {}) {
  if (!candidate) return candidate;
  const get = (v) => (notes instanceof Map ? notes.get(v) : notes[v]);
  const notesSecurity = [];
  const bodySecurity = [];
  for (const r of candidate.releases) {
    const line = get(r.version);
    if (typeof line === "string" && line) notesSecurity.push({ version: r.version, line });
    if (mentionsSecurity(r.body)) bodySecurity.push(r.version);
  }
  return {
    ...candidate,
    notesSecurity,
    bodySecurity,
    security: candidate.advisories.length > 0 || notesSecurity.length > 0 || bodySecurity.length > 0,
  };
}

// 拡張の候補。台帳の版と、前回の通知の版より新しい版が Open VSX に出ていれば返す。
//   entry: 台帳の1件、meta: parseOpenVsx の結果、target: state.json の targets["ext:<id>"]
export function planExtension({ entry, meta, target = null }) {
  if (!entry || !meta) return null;
  if (cmp(meta.version, entry.version) <= 0) return null;
  const last = target && parseVersion(target.lastNotifiedVersion) ? target.lastNotifiedVersion : null;
  if (last && cmp(meta.version, last) <= 0) return null;
  const dot = entry.id.indexOf(".");
  const namespace = meta.namespace || entry.id.slice(0, dot);
  const name = meta.name || entry.id.slice(dot + 1);
  const publishedMs = meta.timestamp ? Date.parse(meta.timestamp) : NaN;
  return {
    kind: "ext",
    key: stateKeyFor("ext", entry.id),
    id: entry.id,
    current: entry.version,
    version: meta.version,
    previousNotified: last,
    publishedAt: meta.timestamp,
    // 入れてよい日時: 公開の72時間後（セキュリティ修正なら公開の時点。docs/04 の4節の4。Open VSX には
    // セキュリティ修正の印が無いので、拡張は常に「セキュリティ修正でない」として扱う）
    installableAt: Number.isNaN(publishedMs) ? null : new Date(publishedMs + SOAK_HOURS * 3600 * 1000).toISOString(),
    verified: meta.verified,
    preRelease: meta.preRelease,
    namespace,
    name,
    security: false,
    isClaudeCode: entry.id.toLowerCase() === CLAUDE_CODE_ID,
  };
}

// 優先度（docs/06 の2.3。裁定）: セキュリティ修正あり → 高。本体のその他と Claude Code 拡張 → 中。ほかの拡張 → 低。
export function priorityFor(candidate) {
  if (candidate.security) return "高";
  if (candidate.kind === "core" || candidate.isClaudeCode) return "中";
  return "低";
}

function severityCounts(advisories) {
  const counts = new Map();
  for (const a of advisories) {
    const s = a.severity || "unknown";
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((x, y) => {
      const ix = SEVERITY_ORDER.indexOf(x[0]);
      const iy = SEVERITY_ORDER.indexOf(y[0]);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
    })
    .map(([s, n]) => `${s} ${n}`)
    .join("、");
}

function iso(now) {
  return (now instanceof Date ? now : new Date(now ?? Date.now())).toISOString();
}

function coreTitle(c) {
  return `${titlePrefixFor("core")}${c.version}${c.security ? "（セキュリティ修正あり）" : ""}`;
}

function coreDetail(c) {
  const lines = [];
  lines.push(`今の版: ${c.current} → 新しい版: ${c.version}`);
  lines.push(`今の版から後の版: ${c.releases.map((r) => r.version).join(", ")}`);
  if (c.advisories.length) {
    lines.push(`セキュリティ修正（アドバイザリ）: ${c.advisories.length}件（${severityCounts(c.advisories)}）`);
  } else {
    lines.push(`セキュリティ修正（アドバイザリ）: なし${c.advisoriesUnavailable ? "（アドバイザリを取れなかった。要確認）" : ""}`);
  }
  const notesVersions = [...new Set([...c.notesSecurity.map((n) => n.version), ...c.bodySecurity])];
  if (notesVersions.length) lines.push(`リリースノートに security の記述: ${notesVersions.join(", ")}`);
  lines.push(`起動するコマンド: node scripts/take-in.mjs core ${c.version}`);
  return lines.join("\n");
}

function releaseBullets(c, versions) {
  const out = [];
  for (const r of c.releases.filter((x) => versions.includes(x.version))) {
    let notes = null;
    try {
      notes = releaseNotesUrl(r.version);
    } catch {
      notes = null;
    }
    const sec = c.notesSecurity.find((n) => n.version === r.version);
    const parts = [`${r.version}（公開 ${r.publishedAt || "不明"}）: `];
    if (notes) parts.push({ text: "リリースノート", url: notes }, "　");
    parts.push({ text: "GitHub のリリース", url: r.url });
    if (sec) parts.push(`　security の記述: ${sec.line}`);
    else if (c.bodySecurity.includes(r.version)) parts.push("　GitHub のリリースの本文に security の記述あり");
    out.push(bullet(parts));
  }
  return out;
}

function advisoryBullets(advisories) {
  return advisories.map((a) =>
    bullet([
      { text: a.id, url: a.url },
      `（${a.severity || "重さ不明"}）: ${a.summary} — 修正版 ${a.patched.join(", ") || "不明"}${a.publishedAt ? `、公開 ${a.publishedAt}` : ""}`,
    ]),
  );
}

// 本体の ToDo（docs/06 の2.3）。previous は前回の通知（state.json の targets.core）。
export function buildCoreTodo(c, { now = new Date(), timeZone } = {}) {
  const priority = priorityFor(c);
  const due = dueDateFor({ security: c.security, now, timeZone });
  const allVersions = c.releases.map((r) => r.version);
  const bodyBlocks = [
    paragraph(`更新の検知が ${iso(now)} に見つけた。今の版 ${c.current} → ${c.version}`),
    heading3("リリースノート"),
    ...releaseBullets(c, allVersions),
    heading3("セキュリティ修正（アドバイザリ）"),
    ...(c.advisories.length ? advisoryBullets(c.advisories) : [paragraph(c.advisoriesUnavailable ? "アドバイザリを取れなかった（要確認）" : "なし")]),
    paragraph(`起動するコマンド: node scripts/take-in.mjs core ${c.version}`),
  ];
  const addedAdvisories = c.advisories.filter((a) => c.newAdvisories.includes(a.id));
  const updateBlocks = [
    heading3(
      c.newVersions.length
        ? `更新（${iso(now)}）: ${c.newVersions.join(", ")} も出た`
        : `更新（${iso(now)}）: セキュリティ修正が加わった`,
    ),
    ...releaseBullets(c, c.newVersions),
    ...(addedAdvisories.length ? [paragraph("加わったセキュリティ修正:"), ...advisoryBullets(addedAdvisories)] : []),
    paragraph(`起動するコマンド: node scripts/take-in.mjs core ${c.version}`),
  ];
  return {
    kind: "core",
    key: c.key,
    titlePrefix: titlePrefixFor("core"),
    title: coreTitle(c),
    priority,
    due,
    detail: coreDetail(c),
    bodyBlocks,
    updateBlocks,
  };
}

function extDetail(c) {
  const lines = [];
  lines.push(`今の版（台帳）: ${c.current} → 新しい版: ${c.version}`);
  lines.push(`公開: ${c.publishedAt || "不明"} ／ 入れてよい日時: ${c.installableAt || "不明"}（公開の${SOAK_HOURS}時間後）`);
  lines.push(`Open VSX の verified: ${c.verified ? "true" : "false（要確認）"}${c.preRelease ? " ／ プレリリース" : ""}`);
  lines.push(`起動するコマンド: node scripts/take-in.mjs ext ${c.id} ${c.version}`);
  return lines.join("\n");
}

// 拡張の ToDo（docs/06 の2.3。本文に公開日時・入れてよい日時・Open VSX のページ）。
export function buildExtTodo(c, { now = new Date(), timeZone } = {}) {
  const priority = priorityFor(c);
  const due = dueDateFor({ security: c.security, now, timeZone });
  const soakedNow = isSoaked(c.publishedAt, now, { security: c.security });
  const page = openVsxPageUrl(c.namespace, c.name, c.version);
  const info = [
    bullet(`公開日時: ${c.publishedAt || "不明"}`),
    bullet(`入れてよい日時: ${c.installableAt || "不明"}（公開の${SOAK_HOURS}時間後${soakedNow ? "。もう過ぎている" : ""}）`),
    bullet(["Open VSX のページ: ", { text: page, url: page }]),
    bullet(`Open VSX の verified: ${c.verified ? "true" : "false（要確認）"}`),
  ];
  return {
    kind: "ext",
    key: c.key,
    titlePrefix: titlePrefixFor("ext", c.id),
    title: `${titlePrefixFor("ext", c.id)}${c.version}`,
    priority,
    due,
    detail: extDetail(c),
    bodyBlocks: [
      paragraph(`更新の検知が ${iso(now)} に見つけた。台帳の版 ${c.current} → ${c.version}`),
      ...info,
      paragraph(`起動するコマンド: node scripts/take-in.mjs ext ${c.id} ${c.version}`),
    ],
    updateBlocks: [
      heading3(`更新（${iso(now)}）: ${c.version} も出た`),
      ...info,
      paragraph(`起動するコマンド: node scripts/take-in.mjs ext ${c.id} ${c.version}`),
    ],
  };
}

// 失敗が続いた日数（failingSince の日からその日まで。両端を含む。日付は timeZone で数える）。
export function failingDays(failingSince, now = new Date(), timeZone) {
  if (!failingSince) return 0;
  const a = localDate(failingSince, timeZone);
  const b = localDate(now, timeZone);
  const days = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  return days + 1;
}

// 「更新の検知が失敗しています」の ToDo（docs/06 の2.3 の「失敗したとき」）。優先度と期限は表に無いので、
// 見逃すとセキュリティ修正の通知が止まることから「高」・翌日にした（watch-design.md の5節。リーダーの確認待ち）。
export function buildFailureTodo({ failingSince, errors = [], now = new Date(), timeZone } = {}) {
  const prefix = titlePrefixFor("failure");
  const detail = [
    `GitHub・Open VSX の取得が ${failingSince} から失敗している（${failingDays(failingSince, now, timeZone)}日目）。`,
    `直近の誤り: ${errors.slice(0, 5).join(" / ") || "不明"}`,
    "ログ: %LOCALAPPDATA%\\Shuko\\watch\\watch.log",
  ].join("\n");
  return {
    kind: "failure",
    key: "failure",
    titlePrefix: prefix,
    title: prefix,
    priority: "高",
    due: dueDateFor({ security: true, now, timeZone }),
    detail,
    bodyBlocks: [paragraph(detail), ...errors.slice(0, 20).map((e) => bullet(String(e)))],
    updateBlocks: [paragraph(`まだ失敗している（${iso(now)}）`), ...errors.slice(0, 5).map((e) => bullet(String(e)))],
  };
}
