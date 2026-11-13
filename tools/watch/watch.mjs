#!/usr/bin/env node
// 更新の検知（docs/06 の2節）。タスクスケジューラが毎日1回動かす（tools/watch/register-task.ps1 で登録）。LLM は使わない。
//   1. local.json（scripts/lib/local-config.mjs）から builderRepo・installRoot を読む
//   2. 台帳（extensions.lock.json）・upstream.json・今の版（<installRoot>\current の指す版）を読む
//   3. GitHub の releases・security-advisories、Open VSX の拡張ごとのメタデータを取る（2.2）
//   4. 前回の状態（state.json）と比べ、新しい版があれば「セキュリティ修正あり」を判定し（リリースノートも見る）、
//      Notion の ToDo を作るか、開いている ToDo を直す（2.3。重複しない）
//   5. state.json と watch.log を書く。取得が3日続けて失敗したら「更新の検知が失敗しています」の ToDo を足す
//
// 使い方:
//   node tools/watch/watch.mjs                      本番（タスクスケジューラから）
//   node tools/watch/watch.mjs --dry-run            取得と判定まで。Notion に書かず、state も log も書かない。計画を JSON で出す
//   node tools/watch/watch.mjs --check              トークンを読み、ToDo のデータソースの項目を確かめるだけ（書かない）
//   node tools/watch/watch.mjs --check-token        トークンを読めるかだけ（Notion に接続しない。長さと先頭の種類だけを出す）
//   node tools/watch/watch.mjs --write-back <verdict.json> --target core|ext:<拡張の ID>
//                                                   取り込みの判定の要約を ToDo に書き戻す（取り込みの時に書けなかったときの手直し）
// オプション:
//   --config <local.json>  --builder-repo <dir>  --install-root <dir>   場所の設定（docs/02 の6.1。オプションが優先）
//   --state-dir <dir>      state.json・watch.log の場所（既定 %LOCALAPPDATA%\Shuko\watch。試しでは必ず別の場所を渡す）
//   --token-file <file>    DPAPI のトークン（既定 <state-dir>\notion-token.dpapi）
//   --data-source <id>     ToDo のデータソース ID（既定 docs/06 の2.3 の ID）
//   --fixtures <file>      GitHub・Open VSX・リリースノートの応答を差し替える JSON（{ "<url>": { status, json | text } | { error } }）
//   --record <file>        本物の取得の応答を、--fixtures の形で書き出す（試しの入力を作るため）
//   --notion-fake <file>   Notion を差し替える（tools/watch/lib/fake-notion.mjs。中身をこのファイルに保つ）
//   --now <ISO 8601>       今の日時（試し）    --time-zone <IANA>   期限の日付を数えるタイムゾーン（既定はこの PC）
//   --quiet                ログを標準エラーに出さない
// 終了コード: 0 = 取得も Notion も成功、1 = どこかが失敗（ログを見る）、2 = 設定などの誤りで動けない
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節）:
//   parseArgs(argv) / currentCoreVersion(installRoot, upstreamTag) / runWatch(opts, deps) / runCheck(opts, deps)
//   runCheckToken(opts, deps) / runWriteBack(opts, deps)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "../../scripts/lib/local-config.mjs";
import { createNotionClient, readNotionToken } from "../../scripts/lib/notion-client.mjs";
import {
  TODO_DATA_SOURCE_ID,
  checkTodoSchema,
  defaultTimeZone,
  readWatchState,
  summarizeVerdict,
  upsertTodo,
  watchDir,
  writeBackTakeIn,
} from "../../scripts/lib/notion-todo.mjs";
import {
  GITHUB_ADVISORIES_URL,
  GITHUB_RELEASES_URL,
  createFixtureFetcher,
  createHttpFetcher,
  openVsxApiUrl,
  parseAdvisories,
  parseOpenVsx,
  parseReleases,
  releaseNotesSecurityLine,
  releaseNotesUrl,
} from "./lib/sources.mjs";
import {
  buildCoreTodo,
  buildExtTodo,
  buildFailureTodo,
  failingDays,
  finishCore,
  labelToVersion,
  planCore,
  planExtension,
} from "./lib/judge.mjs";
import { createLogger, nextFailingSince, normalizeState, saveState } from "./lib/state.mjs";
import { createFakeNotion } from "./lib/fake-notion.mjs";

const FAILURE_DAYS = 3;

export function parseArgs(argv) {
  const o = {
    config: null,
    builderRepo: null,
    installRoot: null,
    stateDir: null,
    tokenFile: null,
    dataSourceId: TODO_DATA_SOURCE_ID,
    fixtures: null,
    record: null,
    notionFake: null,
    now: null,
    timeZone: null,
    dryRun: false,
    check: false,
    quiet: false,
  };
  const need = (i, a) => {
    if (i >= argv.length || String(argv[i]).startsWith("--")) throw new Error(`${a} に値が無い`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") o.config = need(++i, a);
    else if (a === "--builder-repo") o.builderRepo = need(++i, a);
    else if (a === "--install-root") o.installRoot = need(++i, a);
    else if (a === "--state-dir") o.stateDir = need(++i, a);
    else if (a === "--token-file") o.tokenFile = need(++i, a);
    else if (a === "--data-source") o.dataSourceId = need(++i, a);
    else if (a === "--fixtures") o.fixtures = need(++i, a);
    else if (a === "--record") o.record = need(++i, a);
    else if (a === "--notion-fake") o.notionFake = need(++i, a);
    else if (a === "--now") o.now = need(++i, a);
    else if (a === "--time-zone") o.timeZone = need(++i, a);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--check") o.check = true;
    else if (a === "--check-token") o.checkToken = true;
    else if (a === "--write-back") o.writeBack = need(++i, a);
    else if (a === "--target") o.target = need(++i, a);
    else if (a === "--quiet") o.quiet = true;
    else throw new Error(`知らない引数: ${a}`);
  }
  if (o.fixtures && o.record) throw new Error("--fixtures と --record は一緒に使えない");
  if (o.writeBack && !/^(core|ext:[^\s]+)$/.test(o.target || "")) throw new Error("--write-back には --target core か --target ext:<拡張の ID> が要る");
  if (o.now && Number.isNaN(Date.parse(o.now))) throw new Error(`--now が日時として読めない: ${o.now}`);
  return o;
}

// 今の本体の版。<installRoot>\current（ジャンクション）の指す版のフォルダの名前（ラベル）から取る。
// current が無い（まだ入れていない）ときは upstream.json のタグ。
export function currentCoreVersion(installRoot, upstreamTag, { realpath = fs.realpathSync } = {}) {
  if (installRoot) {
    try {
      const real = realpath(path.join(installRoot, "current"));
      const label = path.basename(real);
      const v = labelToVersion(label);
      if (v) return { version: v, label, source: "current" };
    } catch {
      // current が無い
    }
  }
  const v = labelToVersion(upstreamTag);
  if (!v) throw new Error(`今の版を決められない（current が無く、upstream.json の tag も読めない: ${upstreamTag}）`);
  return { version: v, label: null, source: "upstream.json" };
}

function readJsonFile(file, what) {
  let t;
  try {
    t = fs.readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(`${what}（${file}）を読めない: ${err.message}`);
  }
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  try {
    return JSON.parse(t);
  } catch (err) {
    throw new Error(`${what}（${file}）が JSON として読めない: ${err.message}`);
  }
}

function resolvePlaces(opts, env) {
  const stateDir = opts.stateDir ? path.resolve(opts.stateDir) : watchDir(env);
  return {
    stateDir,
    stateFile: path.join(stateDir, "state.json"),
    logFile: path.join(stateDir, "watch.log"),
    tokenFile: opts.tokenFile ? path.resolve(opts.tokenFile) : path.join(stateDir, "notion-token.dpapi"),
  };
}

function makeNotion(opts, places, deps) {
  if (deps.notion) return deps.notion;
  if (opts.notionFake) return createFakeNotion({ file: path.resolve(opts.notionFake), dataSourceId: opts.dataSourceId });
  const readToken = deps.readToken || readNotionToken;
  return createNotionClient({ token: readToken({ tokenFile: places.tokenFile }) });
}

// トークンを読めるかだけを確かめる（Notion に接続しない）。値は出さず、長さと先頭の種類（ntn_ / secret_）だけを返す。
export function runCheckToken(opts, deps = {}) {
  const env = deps.env || process.env;
  const places = resolvePlaces(opts, env);
  const readToken = deps.readToken || readNotionToken;
  try {
    const token = readToken({ tokenFile: places.tokenFile });
    const kind = token.startsWith("ntn_") ? "ntn_" : token.startsWith("secret_") ? "secret_" : "その他";
    return { ok: true, tokenFile: places.tokenFile, length: token.length, prefix: kind };
  } catch (err) {
    return { ok: false, tokenFile: places.tokenFile, error: err.message };
  }
}

// 取り込みの判定（verdict.json）の要約を、対応する ToDo に書き戻す（docs/06 の4節の10）。取り込み（take-in.mjs）は
// scripts/lib/notion-todo.mjs の writeBackTakeIn を直接呼ぶ。これは、取り込みの時に Notion に書けなかったときに
// 後から手で書き戻すための入口（と、試しの入口）。
export async function runWriteBack(opts, deps = {}) {
  const env = deps.env || process.env;
  const places = resolvePlaces(opts, env);
  const summary = summarizeVerdict(readJsonFile(opts.writeBack, "verdict.json"));
  const [kind, ...rest] = opts.target.split(":");
  const extId = kind === "ext" ? rest.join(":") : undefined;
  let notion = deps.notion || null;
  if (!notion && opts.notionFake) notion = createFakeNotion({ file: path.resolve(opts.notionFake), dataSourceId: opts.dataSourceId });
  return writeBackTakeIn({
    kind,
    extId,
    ...summary,
    stateFile: places.stateFile,
    tokenFile: places.tokenFile,
    notion: notion || undefined,
    readToken: deps.readToken,
    dataSourceId: opts.dataSourceId,
    now: deps.now || (opts.now ? new Date(opts.now) : new Date()),
    env,
  });
}

// トークンとデータソースの項目を確かめる（書かない）。
export async function runCheck(opts, deps = {}) {
  const env = deps.env || process.env;
  const places = resolvePlaces(opts, env);
  const notion = makeNotion(opts, places, deps);
  const ds = await notion.retrieveDataSource(opts.dataSourceId);
  const errors = checkTodoSchema(ds);
  return { ok: errors.length === 0, dataSourceId: opts.dataSourceId, schemaErrors: errors };
}

function loadState(stateFile, log, { dryRun = false } = {}) {
  try {
    return normalizeState(readWatchState(stateFile));
  } catch (err) {
    if (dryRun) {
      log.warn(`state.json が読めない（${err.message}）。--dry-run なので空から始めたとして判定する（ファイルは動かさない）`);
      return normalizeState(null);
    }
    // 壊れた state.json は残して脇へ寄せ、無いときと同じに扱う（ToDo はデータソースの検索で見つける。docs/06 の2.3 の3）
    const aside = `${stateFile}.broken-${Date.now()}`;
    try {
      fs.renameSync(stateFile, aside);
    } catch {
      // 寄せられなくても続ける
    }
    log.warn(`state.json が読めないので空から始める（${err.message}）。元のファイル: ${aside}`);
    return normalizeState(null);
  }
}

async function fetchAll({ fetcher, lock, log }) {
  const errors = [];
  let releases = null;
  let advisories = null;
  try {
    releases = parseReleases(await fetcher.getJson(GITHUB_RELEASES_URL));
  } catch (err) {
    errors.push(`GitHub releases: ${err.message}`);
  }
  try {
    const json = await fetcher.getJson(GITHUB_ADVISORIES_URL);
    advisories = parseAdvisories(json === null ? [] : json);
  } catch (err) {
    errors.push(`GitHub security-advisories: ${err.message}`);
  }
  const metas = new Map();
  for (const entry of lock) {
    try {
      const json = await fetcher.getJson(openVsxApiUrl(entry));
      if (json === null) throw new Error("Open VSX に無い（404）");
      metas.set(entry.id, parseOpenVsx(json));
    } catch (err) {
      errors.push(`Open VSX ${entry.id}: ${err.message}`);
    }
  }
  for (const e of errors) log.warn(`取得に失敗: ${e}`);
  return { releases, advisories, metas, errors };
}

// リリースノートのページ（版の minor ごとに1回）を取り、版ごとの security の文を返す。取れなくても止めない。
async function fetchNotes({ fetcher, versions, log }) {
  const notes = new Map();
  const pages = new Map();
  for (const v of versions) {
    let url;
    try {
      url = releaseNotesUrl(v);
    } catch {
      continue;
    }
    if (!pages.has(url)) {
      try {
        pages.set(url, await fetcher.getText(url));
      } catch (err) {
        log.warn(`リリースノートを取れない（判定の (b) を飛ばす）: ${url}: ${err.message}`);
        pages.set(url, undefined);
      }
    }
    const html = pages.get(url);
    if (html === undefined) continue;
    notes.set(v, html === null ? null : releaseNotesSecurityLine(html, v));
  }
  return notes;
}

// 検知の本体。deps: { fetcher, notion, readToken, now, timeZone, env, echo }
// 返り値: { exitCode, current, plan: [...], results: [...], errors, fetchOk, notionOk, state }
export async function runWatch(opts, deps = {}) {
  const env = deps.env || process.env;
  const now = deps.now || (opts.now ? new Date(opts.now) : new Date());
  const timeZone = deps.timeZone || opts.timeZone || defaultTimeZone();
  const places = resolvePlaces(opts, env);
  const log = createLogger(opts.dryRun ? null : places.logFile, { echo: deps.echo ?? !opts.quiet });
  const nowIso = now.toISOString();

  // 1・2. 設定と台帳
  const cfg = resolveLocalConfig({
    configPath: opts.config || undefined,
    overrides: { builderRepo: opts.builderRepo || undefined, installRoot: opts.installRoot || undefined },
    env,
  });
  if (!cfg.builderRepo) {
    throw new Error("builderRepo が未設定（local.json）。ビルドリポジトリで scripts/configure.ps1 を実行するか、--builder-repo を渡す");
  }
  const lock = readJsonFile(path.join(cfg.builderRepo, "extensions.lock.json"), "台帳");
  if (!Array.isArray(lock)) throw new Error("台帳（extensions.lock.json）が配列でない");
  const upstream = readJsonFile(path.join(cfg.builderRepo, "upstream.json"), "upstream.json");
  const current = currentCoreVersion(cfg.installRoot, upstream.tag, deps);
  log.info(`開始。今の本体 ${current.version}（${current.source}${current.label ? ` ${current.label}` : ""}）、台帳の拡張 ${lock.length}件`);

  const state = loadState(places.stateFile, log, { dryRun: opts.dryRun });

  // 3. 取得
  const fetcher = deps.fetcher || (opts.fixtures ? createFixtureFetcher(readJsonFile(opts.fixtures, "差し替えの応答")) : createHttpFetcher({ record: deps.record || null }));
  const fetched = await fetchAll({ fetcher, lock, log });
  const fetchOk = fetched.errors.length === 0;

  // 4. 判定
  const todos = [];
  let coreCandidate = null;
  if (fetched.releases) {
    coreCandidate = planCore({
      current: current.version,
      releases: fetched.releases,
      advisories: fetched.advisories,
      target: state.targets.core || null,
      seenAdvisories: state.seenAdvisories,
    });
    if (coreCandidate) {
      const notes = await fetchNotes({ fetcher, versions: coreCandidate.releases.map((r) => r.version), log });
      coreCandidate = finishCore(coreCandidate, { notes });
      todos.push({ candidate: coreCandidate, todo: buildCoreTodo(coreCandidate, { now, timeZone }) });
    }
  }
  for (const entry of lock) {
    const meta = fetched.metas.get(entry.id);
    if (!meta) continue;
    const c = planExtension({ entry, meta, target: state.targets[`ext:${entry.id.toLowerCase()}`] || null });
    if (c) todos.push({ candidate: c, todo: buildExtTodo(c, { now, timeZone }) });
  }

  const failingSince = nextFailingSince(state.failingSince, fetchOk, now);
  const days = failingDays(failingSince, now, timeZone);
  const failureTodo = !fetchOk && days >= FAILURE_DAYS ? buildFailureTodo({ failingSince, errors: fetched.errors, now, timeZone }) : null;

  const plan = todos.map(({ candidate, todo }) => ({
    key: todo.key,
    title: todo.title,
    priority: todo.priority,
    due: todo.due,
    security: candidate.security,
    from: candidate.current,
    to: candidate.version,
    newVersions: candidate.newVersions,
    newAdvisories: candidate.newAdvisories,
    detail: todo.detail,
  }));
  if (failureTodo) plan.push({ key: "failure", title: failureTodo.title, priority: failureTodo.priority, due: failureTodo.due, detail: failureTodo.detail });
  for (const p of plan) log.info(`ToDo の候補: ${p.title}（優先度 ${p.priority}、期限 ${p.due}）`);
  if (plan.length === 0) log.info("新しい版は無い");

  if (opts.dryRun) {
    return {
      exitCode: fetchOk ? 0 : 1,
      dryRun: true,
      current,
      plan,
      todos: todos.map((t) => t.todo).concat(failureTodo ? [failureTodo] : []),
      errors: fetched.errors,
      fetchOk,
      failingDays: days,
      log: log.lines,
    };
  }

  // 4（続き）. Notion
  let notionOk = true;
  const results = [];
  let notion = null;
  try {
    notion = makeNotion(opts, places, deps);
    const ds = await notion.retrieveDataSource(opts.dataSourceId);
    const schemaErrors = checkTodoSchema(ds);
    if (schemaErrors.length) {
      notionOk = false;
      notion = null;
      log.error(`ToDo のデータソースの項目が設計と違うので書かない: ${schemaErrors.join(" / ")}`);
    }
  } catch (err) {
    notionOk = false;
    notion = null;
    log.error(`Notion を使えない: ${err.message}`);
  }

  if (notion) {
    for (const { candidate, todo } of todos) {
      const prev = state.targets[todo.key] || null;
      try {
        const r = await upsertTodo({ notion, dataSourceId: opts.dataSourceId, rememberedPageId: prev ? prev.openPageId : null, todo });
        state.targets[todo.key] = {
          kind: candidate.kind,
          id: candidate.id || null,
          lastNotifiedVersion: candidate.version,
          openPageId: r.pageId,
          title: todo.title,
          priority: r.priority,
          due: r.due,
          security: candidate.security,
          advisories: candidate.kind === "core" ? candidate.advisories.map((a) => a.id) : [],
          notifiedAt: nowIso,
        };
        results.push({ key: todo.key, action: r.action, pageId: r.pageId, title: todo.title, priority: r.priority, due: r.due });
        log.info(`ToDo を${r.action === "created" ? "作った" : "直した"}: ${todo.title}（${r.pageId}、優先度 ${r.priority}、期限 ${r.due}）`);
        if (candidate.kind === "core" && fetched.advisories) {
          state.seenAdvisories = [...new Set([...state.seenAdvisories, ...fetched.advisories.map((a) => a.id)])];
        }
      } catch (err) {
        notionOk = false;
        results.push({ key: todo.key, action: "failed", error: err.message });
        log.error(`ToDo に書けない（${todo.title}）: ${err.message}`);
      }
    }
    if (failureTodo) {
      try {
        const r = await upsertTodo({
          notion,
          dataSourceId: opts.dataSourceId,
          rememberedPageId: state.failureTodo ? state.failureTodo.pageId : null,
          todo: failureTodo,
        });
        state.failureTodo = { pageId: r.pageId, at: nowIso };
        results.push({ key: "failure", action: r.action, pageId: r.pageId, title: failureTodo.title });
        log.warn(`「${failureTodo.title}」の ToDo を${r.action === "created" ? "作った" : "直した"}（${r.pageId}）`);
      } catch (err) {
        notionOk = false;
        log.error(`失敗の ToDo に書けない: ${err.message}`);
      }
    }
  }
  // 本体の候補が無かったときも、見たアドバイザリは覚える（候補があって書けなかったときは覚えない。次に通知し直すため）
  if (!coreCandidate && fetched.advisories) {
    state.seenAdvisories = [...new Set([...state.seenAdvisories, ...fetched.advisories.map((a) => a.id)])];
  }

  // 5. 状態
  state.lastRunAt = nowIso;
  if (fetchOk) state.lastFetchOkAt = nowIso;
  state.failingSince = failingSince;
  state.lastErrors = fetched.errors.slice(0, 20);
  if (fetchOk && notionOk) state.lastSuccessAt = nowIso;
  saveState(places.stateFile, state);
  log.info(`終わり。取得 ${fetchOk ? "成功" : `失敗 ${fetched.errors.length}件（${days}日目）`}、Notion ${notionOk ? "成功" : "失敗"}`);

  return { exitCode: fetchOk && notionOk ? 0 : 1, dryRun: false, current, plan, results, errors: fetched.errors, fetchOk, notionOk, failingDays: days, state, log: log.lines };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[watch] ${err.message}`);
    process.exit(2);
  }
  try {
    if (opts.writeBack) {
      const r = await runWriteBack(opts);
      console.log(JSON.stringify(r, null, 2));
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    if (opts.checkToken) {
      const r = runCheckToken(opts);
      console.log(JSON.stringify(r, null, 2));
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    if (opts.check) {
      const r = await runCheck(opts);
      console.log(JSON.stringify(r, null, 2));
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    const record = opts.record ? new Map() : null;
    const r = await runWatch(opts, { record });
    if (record) {
      fs.mkdirSync(path.dirname(path.resolve(opts.record)), { recursive: true });
      fs.writeFileSync(path.resolve(opts.record), `${JSON.stringify(Object.fromEntries(record), null, 2)}\n`, "utf8");
    }
    const out = { ...r };
    delete out.log;
    delete out.state;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = r.exitCode;
  } catch (err) {
    console.error(`[watch] ${err.message}`);
    // 本番では、動けなかったこともログに残す（state-dir が決まるときだけ）
    try {
      if (!opts.dryRun && !opts.check) {
        const places = resolvePlaces(opts, process.env);
        createLogger(places.logFile).error(`動けない: ${err.message}`);
      }
    } catch {
      // ログにも書けない
    }
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
