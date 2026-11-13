// Notion の ToDo データベースに「取り込みの検証」を書く共通の部品（docs/06 の2.3・4節の10）。
// 更新の検知（tools/watch/watch.mjs）が ToDo を作り・直し、取り込み（scripts/take-in.mjs）が判定の要約を書き戻す。
// API の呼び出しは scripts/lib/notion-client.mjs。ここは中身の組み立てと、重複を避ける手順と、検知の状態の読み方。
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節）:
//   定数: TODO_DATA_SOURCE_ID, PROJECT_NAME, PROPS, TODO_SCHEMA, TITLE_PREFIX_CORE, RICH_TEXT_LIMIT, WATCH_STALE_MS
//   checkTodoSchema(dataSource)                   → 誤りの文字列の配列（正しければ空）
//   titlePrefixFor(kind, extId)                    → 題名の前方一致の語（"取り込みの検証: 本体 " など）
//   stateKeyFor(kind, extId)                       → state.json の targets のキー（"core" / "ext:<id の小文字>"）
//   localDate(now, timeZone) / addDays(ymd, n)     → "YYYY-MM-DD"
//   dueDateFor({ security, now, timeZone })        → 期限（セキュリティ修正あり: 翌日、ほか: 7日後）
//   higherPriority(a, b) / earlierDate(a, b)       → 高い方の優先度 / 早い方の日付
//   buildTodoProperties({ title, priority, due, detail }) → 作成のときの properties
//   text(content, url) / paragraph(parts) / heading3(parts) / bullet(parts) → ブロック（rich_text は 2000 文字で切る）
//   isOpenPage(page) / pageStatus(page) / pagePriority(page) / pageDue(page)
//   findOpenTodo(notion, dataSourceId, titlePrefix) → 開いているページか null
//   upsertTodo({ notion, dataSourceId, rememberedPageId, todo }) → { pageId, action: "created" | "updated", priority, due }
//   watchDir(env) / watchStatePath(env) / watchTokenPath(env) / readWatchState(file)
//   watchFreshness(state, now)                     → { lastSuccessAt, stale, message }（take-in・switch の表示用）
//   summarizeVerdict(verdictJson)                  → { label, verdict, recommendation, reasons, verdictPath }
//   buildTakeInBlocks({ label, verdict, reasons, verdictPath, recommendation, now }) → ブロックの配列
//   appendTakeInResult({ notion, pageId, ... })    → 本文に判定の要約を足し、状態を In progress にする
//   writeBackTakeIn({ kind, extId, label, verdict, ... }) → { ok, pageId, closedPageId, reason }（例外を投げない。
//                                                    開いている ToDo にだけ書く。Done・Archived には書かず In progress に戻さない）

import fs from "node:fs";
import path from "node:path";
import { createNotionClient, readNotionToken } from "./notion-client.mjs";

// docs/06 の2.3。ユーザーの今の ToDo データベースのデータソース ID（秘密ではない）。
export const TODO_DATA_SOURCE_ID = "7949c589-2ebd-4419-be83-30c123be7fec";
export const PROJECT_NAME = "Shuko";
export const RICH_TEXT_LIMIT = 2000;
export const WATCH_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export const PROPS = Object.freeze({
  title: "タスク",
  status: "状態",
  kind: "種別",
  priority: "優先度",
  due: "期限",
  dueFormat: "期限の形式",
  project: "プロジェクト",
  detail: "詳細・メモ",
});

export const STATUS = Object.freeze({ notStarted: "Not started", inProgress: "In progress", done: "Done", archived: "Archived" });
export const PRIORITIES = Object.freeze(["低", "中", "高"]);

// 名前・型・使う選択肢。選択肢はデータベースにあることだけを確かめる（ほかの選択肢があってもよい）。
// API は select に無い名前を書くと選択肢を作りうるので、使う名前が無ければ書かずに止める（項目を勝手に作らない）。
export const TODO_SCHEMA = Object.freeze([
  { name: PROPS.title, type: "title" },
  { name: PROPS.status, type: "status", options: [STATUS.notStarted, STATUS.inProgress, STATUS.done, STATUS.archived] },
  { name: PROPS.kind, type: "select", options: ["ToDo"] },
  { name: PROPS.priority, type: "select", options: ["高", "中", "低"] },
  { name: PROPS.due, type: "date" },
  { name: PROPS.dueFormat, type: "select", options: ["終了日のみ"] },
  { name: PROPS.project, type: "rich_text" },
  { name: PROPS.detail, type: "rich_text" },
]);

export const TITLE_PREFIX_CORE = "取り込みの検証: 本体 ";

export function titlePrefixFor(kind, extId) {
  if (kind === "core") return TITLE_PREFIX_CORE;
  if (kind === "ext") return `取り込みの検証: 拡張 ${extId} `;
  if (kind === "failure") return "更新の検知が失敗しています";
  throw new Error(`知らない種類: ${kind}`);
}

export function stateKeyFor(kind, extId) {
  if (kind === "core") return "core";
  if (kind === "ext") return `ext:${String(extId).toLowerCase()}`;
  throw new Error(`知らない種類: ${kind}`);
}

// データソース（GET /v1/data_sources/{id} の応答）の項目を、TODO_SCHEMA に照らす。
// properties のキーが名前でも ID でも読めるよう、値の name で探す。
export function checkTodoSchema(dataSource) {
  const props = dataSource && typeof dataSource === "object" ? dataSource.properties : null;
  if (!props || typeof props !== "object") return ["データソースに properties が無い"];
  const byName = new Map();
  for (const [key, value] of Object.entries(props)) {
    if (value && typeof value === "object") byName.set(typeof value.name === "string" ? value.name : key, value);
  }
  const errors = [];
  for (const want of TODO_SCHEMA) {
    const got = byName.get(want.name);
    if (!got) {
      errors.push(`項目「${want.name}」が無い`);
      continue;
    }
    if (got.type !== want.type) {
      errors.push(`項目「${want.name}」の型が ${got.type}（${want.type} であるはず）`);
      continue;
    }
    if (want.options) {
      const conf = got[want.type] && typeof got[want.type] === "object" ? got[want.type] : {};
      const names = new Set((Array.isArray(conf.options) ? conf.options : []).map((o) => o && o.name));
      const missing = want.options.filter((o) => !names.has(o));
      if (missing.length) errors.push(`項目「${want.name}」に選択肢 ${missing.join("・")} が無い`);
    }
  }
  return errors;
}

// ---- 日付と優先度 ----

function toDate(now) {
  if (now instanceof Date) return now;
  if (now === undefined || now === null) return new Date();
  const d = new Date(now);
  if (Number.isNaN(d.getTime())) throw new Error(`日時として読めない: ${now}`);
  return d;
}

export function defaultTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// now の、timeZone での日付（YYYY-MM-DD）。
export function localDate(now, timeZone = defaultTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(toDate(now));
}

export function addDays(ymd, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd));
  if (!m) throw new Error(`YYYY-MM-DD でない: ${ymd}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

// 期限（docs/06 の2.3。裁定）: セキュリティ修正あり → 検知の翌日、それ以外 → 検知の7日後。
export function dueDateFor({ security, now, timeZone } = {}) {
  return addDays(localDate(now, timeZone), security ? 1 : 7);
}

// 優先度の高い方（知らない値は低いものとみなす）。
export function higherPriority(a, b) {
  const ia = PRIORITIES.indexOf(a);
  const ib = PRIORITIES.indexOf(b);
  if (ia < 0 && ib < 0) return b ?? a ?? null;
  return ia >= ib ? a : b;
}

// 早い方の日付（YYYY-MM-DD の先頭10文字で比べる。片方が無ければもう片方）。
export function earlierDate(a, b) {
  const da = typeof a === "string" && /^\d{4}-\d{2}-\d{2}/.test(a) ? a.slice(0, 10) : null;
  const db = typeof b === "string" && /^\d{4}-\d{2}-\d{2}/.test(b) ? b.slice(0, 10) : null;
  if (!da) return db;
  if (!db) return da;
  return da <= db ? da : db;
}

// ---- rich_text とブロック ----

function clip(s, limit = RICH_TEXT_LIMIT) {
  const str = String(s ?? "");
  // 長さは UTF-16 の単位で数え（少なめに見積もる側）、サロゲートペアは割らない
  if (str.length <= limit) return str;
  let out = "";
  for (const cp of str) {
    if (out.length + cp.length > limit - 1) break;
    out += cp;
  }
  return `${out}…`;
}

export function text(content, url = null) {
  const t = { type: "text", text: { content: clip(content) } };
  if (url) t.text.link = { url };
  return t;
}

function richText(parts) {
  const list = Array.isArray(parts) ? parts : [parts];
  return list
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map((p) => (typeof p === "string" ? text(p) : p && p.type === "text" ? p : text(p.text, p.url)))
    .slice(0, 100);
}

export function paragraph(parts) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(parts) } };
}
export function heading3(parts) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: richText(parts) } };
}
export function bullet(parts) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(parts) } };
}

// 作成のときの properties（docs/06 の2.3 の表。開始日時・終了日時は書かない）。
export function buildTodoProperties({ title, priority, due, detail, status = STATUS.notStarted }) {
  return {
    [PROPS.title]: { title: [text(title)] },
    [PROPS.status]: { status: { name: status } },
    [PROPS.kind]: { select: { name: "ToDo" } },
    [PROPS.priority]: { select: { name: priority } },
    [PROPS.due]: { date: { start: due } },
    [PROPS.dueFormat]: { select: { name: "終了日のみ" } },
    [PROPS.project]: { rich_text: [text(PROJECT_NAME)] },
    [PROPS.detail]: { rich_text: [text(detail)] },
  };
}

// ---- ページの読み方 ----

function prop(page, name) {
  return page && page.properties && typeof page.properties === "object" ? page.properties[name] : undefined;
}
export function pageStatus(page) {
  const p = prop(page, PROPS.status);
  return p && p.status && typeof p.status.name === "string" ? p.status.name : null;
}
export function pagePriority(page) {
  const p = prop(page, PROPS.priority);
  return p && p.select && typeof p.select.name === "string" ? p.select.name : null;
}
export function pageDue(page) {
  const p = prop(page, PROPS.due);
  return p && p.date && typeof p.date.start === "string" ? p.date.start : null;
}
// 開いている = ページがあり、ごみ箱・アーカイブに無く、状態が Done・Archived でない。
export function isOpenPage(page) {
  if (!page || typeof page !== "object") return false;
  if (page.archived === true || page.in_trash === true) return false;
  const s = pageStatus(page);
  return s !== STATUS.done && s !== STATUS.archived;
}

// データソースを、プロジェクト・題名の前方一致・状態で探す（docs/06 の2.3 の「重複を避ける」の3）。新しいものを返す。
export async function findOpenTodo(notion, dataSourceId, titlePrefix) {
  const res = await notion.queryDataSource(dataSourceId, {
    filter: {
      and: [
        { property: PROPS.project, rich_text: { equals: PROJECT_NAME } },
        { property: PROPS.title, title: { starts_with: titlePrefix } },
        { property: PROPS.status, status: { does_not_equal: STATUS.done } },
        { property: PROPS.status, status: { does_not_equal: STATUS.archived } },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: 10,
  });
  const results = res && Array.isArray(res.results) ? res.results : [];
  return results.find((p) => isOpenPage(p)) || null;
}

// ToDo を作るか、開いているものを直す（docs/06 の2.3 の「重複を避ける」）。
//   todo: { titlePrefix, title, priority, due, detail, bodyBlocks, updateBlocks }
//     bodyBlocks:   作るときの本文
//     updateBlocks: 直すときに本文の後ろに足すもの（「更新: 1.147.1 も出た」など）
//   開いているページを直すとき、優先度は高い方、期限は早い方にする（下げない）。題名と詳細・メモは新しいものにする。
//   rememberedPageId（state.json の開いている ToDo）が開いていればそれを直す。無い・閉じている・消えているときは
//   データソースを探し、見つからなければ作る。
export async function upsertTodo({ notion, dataSourceId = TODO_DATA_SOURCE_ID, rememberedPageId = null, todo }) {
  let page = null;
  if (rememberedPageId) {
    const got = await notion.retrievePage(rememberedPageId);
    if (isOpenPage(got)) page = got;
  }
  if (!page && todo.titlePrefix) page = await findOpenTodo(notion, dataSourceId, todo.titlePrefix);

  if (page) {
    const priority = higherPriority(pagePriority(page), todo.priority);
    const due = earlierDate(pageDue(page), todo.due);
    await notion.updatePage(page.id, {
      properties: {
        [PROPS.title]: { title: [text(todo.title)] },
        [PROPS.detail]: { rich_text: [text(todo.detail)] },
        [PROPS.priority]: { select: { name: priority } },
        [PROPS.due]: { date: { start: due } },
      },
    });
    const blocks = (todo.updateBlocks || []).slice(0, 100);
    if (blocks.length) await notion.appendBlockChildren(page.id, blocks);
    return { pageId: page.id, action: "updated", priority, due };
  }

  const created = await notion.createPage({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: buildTodoProperties(todo),
    children: (todo.bodyBlocks || []).slice(0, 100),
  });
  return { pageId: created.id, action: "created", priority: todo.priority, due: todo.due };
}

// ---- 検知の状態（%LOCALAPPDATA%\Shuko\watch\。docs/06 の2.1。設定にしない固定の場所） ----

export function watchDir(env = process.env) {
  if (!env.LOCALAPPDATA) throw new Error("環境変数 LOCALAPPDATA が無い");
  return path.win32.join(env.LOCALAPPDATA, "Shuko", "watch");
}
export function watchStatePath(env = process.env) {
  return path.win32.join(watchDir(env), "state.json");
}
export function watchTokenPath(env = process.env) {
  return path.win32.join(watchDir(env), "notion-token.dpapi");
}

// state.json を読む。無ければ null。JSON として読めなければ例外。
export function readWatchState(file) {
  if (!fs.existsSync(file)) return null;
  let t = fs.readFileSync(file, "utf8");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  try {
    return JSON.parse(t);
  } catch (err) {
    throw new Error(`${file} が JSON として読めない: ${err.message}`);
  }
}

// 「最後に検知が成功した日時」と、3日より古いか（docs/06 の2.3 の「失敗したとき」。take-in.mjs・switch.ps1 が表示する）。
export function watchFreshness(state, now = new Date()) {
  const last = state && typeof state.lastSuccessAt === "string" ? state.lastSuccessAt : null;
  const t = last ? Date.parse(last) : NaN;
  if (!last || Number.isNaN(t)) {
    return { lastSuccessAt: null, stale: true, message: "更新の検知が成功した記録が無い（未登録か、一度も成功していない）" };
  }
  const stale = toDate(now).getTime() - t > WATCH_STALE_MS;
  return {
    lastSuccessAt: last,
    stale,
    message: stale
      ? `警告: 更新の検知が最後に成功したのは ${last}（3日より前）。トークンの失効やタスクの停止を確かめること`
      : `更新の検知が最後に成功した日時: ${last}`,
  };
}

// ---- 取り込みの書き戻し（docs/06 の4節の10・6節の4） ----

const VERDICT_LABEL = { pass: "合格", conditional: "条件付き", fail: "不合格" };

export function buildTakeInBlocks({ label, verdict, reasons = [], verdictPath, recommendation, now = new Date() }) {
  const blocks = [
    heading3(`取り込みの判定: ${label}（${toDate(now).toISOString()}）`),
    paragraph(`判定: ${VERDICT_LABEL[verdict] || verdict}${recommendation ? `　推奨: ${recommendation}` : ""}`),
  ];
  for (const r of (Array.isArray(reasons) ? reasons : []).slice(0, 20)) blocks.push(bullet(String(r)));
  if (verdictPath) blocks.push(paragraph(`verdict.md: ${verdictPath}`));
  return blocks;
}

// verdict.json（docs/06 の7.3）から、書き戻す要約（label・verdict・recommendation・reasons）を作る。
// reasons は「検査・ビルド・スモーク・新しい宛先・セキュリティ・条件」の短い行。verdictPath は records/take-in/<label>/verdict.md。
export function summarizeVerdict(v) {
  const o = v && typeof v === "object" ? v : {};
  const reasons = [];
  if (o.checks !== undefined) reasons.push(`適用後の検査: ${typeof o.checks === "string" ? o.checks : JSON.stringify(o.checks)}`);
  if (o.build !== undefined) reasons.push(`ビルド: ${typeof o.build === "string" ? o.build : JSON.stringify(o.build)}`);
  if (o.smoke && typeof o.smoke === "object") {
    const manual = Array.isArray(o.smoke.manualToDo) ? o.smoke.manualToDo : [];
    reasons.push(`スモーク（自動）: ${o.smoke.auto ?? "不明"}${manual.length ? `、手で確かめる項目 ${manual.length}件` : ""}`);
  }
  if (o.network && Array.isArray(o.network.newHosts)) {
    reasons.push(`新しい接続先: ${o.network.newHosts.length ? o.network.newHosts.join(", ") : "なし"}`);
  }
  if (o.security && Array.isArray(o.security.advisories) && o.security.advisories.length) {
    const rel = Array.isArray(o.security.relevantToThisBuild) ? o.security.relevantToThisBuild.filter((x) => x && x.relevant).length : 0;
    reasons.push(`アドバイザリ: ${o.security.advisories.length}件（この構成に関係するもの ${rel}件）`);
  }
  for (const c of Array.isArray(o.conditions) ? o.conditions : []) reasons.push(`条件: ${typeof c === "string" ? c : JSON.stringify(c)}`);
  return {
    label: typeof o.label === "string" ? o.label : null,
    verdict: typeof o.verdict === "string" ? o.verdict : null,
    recommendation: typeof o.recommendation === "string" ? o.recommendation : null,
    reasons,
    verdictPath: typeof o.label === "string" ? `records/take-in/${o.label}/verdict.md` : null,
  };
}

export async function appendTakeInResult({ notion, pageId, ...rest }) {
  await notion.appendBlockChildren(pageId, buildTakeInBlocks(rest));
  await notion.updatePage(pageId, { properties: { [PROPS.status]: { status: { name: STATUS.inProgress } } } });
}

// 取り込みから呼ぶ入口。例外を投げず、書けなければ { ok: false, reason } を返す（取り込みは止めない。判定に書く）。
//   kind: "core" | "ext"、extId: 拡張の ID（ext のとき）
//   stateFile・tokenFile: 既定は %LOCALAPPDATA%\Shuko\watch\ の state.json・notion-token.dpapi
//   notion: 差し替えのクライアント（試し・テスト）。無ければトークンを読んで作る
//   readToken: トークンを読む関数の差し替え（既定 readNotionToken）
export async function writeBackTakeIn({
  kind,
  extId,
  label,
  verdict,
  reasons,
  verdictPath,
  recommendation,
  stateFile,
  tokenFile,
  notion,
  readToken = readNotionToken,
  dataSourceId = TODO_DATA_SOURCE_ID,
  now = new Date(),
  env = process.env,
} = {}) {
  try {
    const sf = stateFile || watchStatePath(env);
    const state = readWatchState(sf);
    const key = stateKeyFor(kind, extId);
    const remembered = state && state.targets && state.targets[key] ? state.targets[key].openPageId : null;
    const client = notion || createNotionClient({ token: readToken({ tokenFile: tokenFile || watchTokenPath(env) }) });
    // 書くのは開いている ToDo だけ（isOpenPage）。Done・Archived・ごみ箱のページには書かず、In progress に戻さない
    // （ユーザーが閉じたものを台本が開き直さない。p3-take-in の検証 M-3。take-in-design.md の9節）。
    let pageId = null;
    let closedPageId = null;
    if (remembered) {
      const page = await client.retrievePage(remembered);
      if (page && isOpenPage(page)) pageId = page.id || remembered;
      else if (page) closedPageId = page.id || remembered;
    }
    if (!pageId) {
      const found = await findOpenTodo(client, dataSourceId, titlePrefixFor(kind, extId));
      if (found) pageId = found.id;
    }
    if (!pageId) {
      return {
        ok: false,
        pageId: null,
        closedPageId,
        reason: closedPageId
          ? `覚えていた ToDo（${closedPageId}）は閉じている（Done・Archived など）ので書かない。開いている ToDo も見つからない`
          : "開いている ToDo が見つからない（state.json にも、データソースの検索にも無い）",
      };
    }
    await appendTakeInResult({ notion: client, pageId, label, verdict, reasons, verdictPath, recommendation, now });
    return { ok: true, pageId, closedPageId, reason: null };
  } catch (err) {
    return { ok: false, pageId: null, reason: `ToDo に書けない: ${err && err.message}` };
  }
}
