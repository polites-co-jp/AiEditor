// 更新の検知（tools/watch・scripts/lib/notion-*.mjs）の単体テスト。仕様は docs/06 の2.2・2.3・2.4。
// 入口の名前は tasks/2026-11-14-p4-watch/watch-design.md の3節。期待値は docs から書いた（実装から写していない）。
// Notion と GitHub・Open VSX は差し替える（このファイルの中の自前の Notion 代役）。本物には書かず、秘密の場所も開かない。
// Run: node --test tests/watch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  GITHUB_RELEASES_URL, GITHUB_ADVISORIES_URL, releaseNotesUrl, openVsxApiUrl, openVsxPageUrl,
  parseReleases, parseAdvisories, inVersionRange, releaseNotesSecurityLine, mentionsSecurity, parseOpenVsx,
} from '../tools/watch/lib/sources.mjs';
import {
  labelToVersion, relevantAdvisories, planCore, finishCore, planExtension, priorityFor,
  buildCoreTodo, buildExtTodo, buildFailureTodo, failingDays,
} from '../tools/watch/lib/judge.mjs';
import { normalizeState, nextFailingSince } from '../tools/watch/lib/state.mjs';
import { parseArgs, runWatch, currentCoreVersion } from '../tools/watch/watch.mjs';
import {
  titlePrefixFor, stateKeyFor, localDate, addDays, dueDateFor, higherPriority, earlierDate, text, paragraph,
  checkTodoSchema, upsertTodo, isOpenPage, watchFreshness, summarizeVerdict, writeBackTakeIn, TODO_DATA_SOURCE_ID,
} from '../scripts/lib/notion-todo.mjs';
import { createNotionClient, readNotionToken, retryAfterMs } from '../scripts/lib/notion-client.mjs';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const TZ = 'Asia/Tokyo';
const NOW = new Date('2026-11-14T03:00:00Z'); // 2026-11-14 12:00 JST

// ---- GitHub の形のデータ ----
const rel = (tag, extra = {}) => ({ tag_name: tag, published_at: '2026-11-10T00:00:00Z', html_url: `https://github.com/microsoft/vscode/releases/tag/${tag}`, body: 'See the release notes.', draft: false, prerelease: false, ...extra });
const adv = (id, patched, range = null, severity = 'high') => ({
  ghsa_id: id, cve_id: null, severity, summary: `要約 ${id}`, published_at: '2026-11-10T00:00:00Z', html_url: `https://github.com/microsoft/vscode/security/advisories/${id}`,
  vulnerabilities: [{ package: { ecosystem: 'other', name: 'vscode' }, vulnerable_version_range: range, patched_versions: patched }],
});
const NOTES_HTML = (...updates) => `<html><body><h2>Update ${updates.map((u) => u.join(': ')).join('</p><h2>Update ')}</body></html>`;

// ---- URL（docs/06 の2.2 の表）----
test('取得先: GitHub の releases・security-advisories・リリースノート・Open VSX の URL は docs/06 の2.2 のとおり', () => {
  assert.equal(GITHUB_RELEASES_URL, 'https://api.github.com/repos/microsoft/vscode/releases?per_page=10');
  assert.ok(GITHUB_ADVISORIES_URL.startsWith('https://api.github.com/repos/microsoft/vscode/security-advisories'));
  assert.equal(releaseNotesUrl('1.147.1'), 'https://code.visualstudio.com/updates/v1_147');
  assert.equal(openVsxApiUrl({ id: 'esbenp.prettier-vscode' }), 'https://open-vsx.org/api/esbenp/prettier-vscode');
  assert.equal(openVsxApiUrl({ id: 'detachhead.basedpyright', targetPlatform: 'win32-x64' }), 'https://open-vsx.org/api/detachhead/basedpyright/win32-x64');
  assert.equal(openVsxApiUrl({ id: 'a.b', targetPlatform: 'universal' }), 'https://open-vsx.org/api/a/b');
  assert.ok(openVsxPageUrl('a', 'b', '1.0.0').startsWith('https://open-vsx.org/'));
});
test('取得先: タグの一覧（/tags）と releases/latest は使わない（docs/06 の2.2）', () => {
  assert.ok(!/\/tags/.test(GITHUB_RELEASES_URL));
  assert.ok(!/releases\/latest/.test(GITHUB_RELEASES_URL));
});

// ---- 応答の読み方 ----
test('parseReleases: 下書き・プレリリース・x.y.z でないタグ（vsda-v...）を外し、版の昇順に並べる', () => {
  const r = parseReleases([rel('1.147.1'), rel('1.147.0', { draft: true }), rel('1.146.0'), rel('vsda-v1.2.3'), rel('1.148.0-insider'), rel('1.147.2', { prerelease: true }), rel('1.10.0'), rel('1.9.0')]);
  assert.deepEqual(r.map((x) => x.version), ['1.9.0', '1.10.0', '1.146.0', '1.147.1']);
});
test('parseReleases: 配列でなければ例外', () => assert.throws(() => parseReleases({})));
test('parseAdvisories: 修正版を x.y.z で拾い、影響の範囲も持つ', () => {
  const [a] = parseAdvisories([adv('GHSA-aaaa-bbbb-cccc', '1.145.3', '< 1.145.3')]);
  assert.equal(a.id, 'GHSA-aaaa-bbbb-cccc');
  assert.deepEqual(a.patched, ['1.145.3']);
  assert.deepEqual(a.vulnerableRanges, ['< 1.145.3']);
  assert.equal(a.severity, 'high');
});
test('parseAdvisories: 修正版が複数（1.146.3, 1.147.1）でも全部拾う', () => {
  assert.deepEqual(parseAdvisories([adv('GHSA-x', '1.146.3, 1.147.1')])[0].patched, ['1.146.3', '1.147.1']);
});
test('inVersionRange: < / >= , < / = を解く。読めない範囲は null', () => {
  assert.equal(inVersionRange('1.145.0', '< 1.145.3'), true);
  assert.equal(inVersionRange('1.145.3', '< 1.145.3'), false);
  assert.equal(inVersionRange('1.145.0', '>= 1.140.0, < 1.147.1'), true);
  assert.equal(inVersionRange('1.139.0', '>= 1.140.0, < 1.147.1'), false);
  assert.equal(inVersionRange('1.2.3', '= 1.2.3'), true);
  assert.equal(inVersionRange('1.10.0', '< 1.9.0'), false, '数として比べる');
  assert.equal(inVersionRange('1.2.3', 'all of them'), null);
  assert.equal(inVersionRange('1.2.3', null), null);
});
test('parseOpenVsx: version・timestamp・verified。version が無ければ例外', () => {
  const m = parseOpenVsx({ version: '2.1.330', timestamp: '2026-11-19T01:00:00.000000Z', verified: true, namespace: 'Anthropic', name: 'claude-code' });
  assert.equal(m.version, '2.1.330');
  assert.equal(m.verified, true);
  assert.throws(() => parseOpenVsx({ error: 'not found' }));
  assert.throws(() => parseOpenVsx({}));
});

// ---- リリースノートの security の記述 (docs/06 の2.2 の (b)) ----
test('releaseNotesSecurityLine: 1.145.3 の "these security issues" を見つける。1.145.1 の "these issues" には反応しない', () => {
  const html = NOTES_HTML(['1.145.3', 'The update addresses these security issues.'], ['1.145.2', 'The update addresses these issues.'], ['1.145.1', 'The update addresses these issues.']);
  assert.match(releaseNotesSecurityLine(html, '1.145.3') || '', /security/);
  assert.equal(releaseNotesSecurityLine(html, '1.145.2'), null);
  assert.equal(releaseNotesSecurityLine(html, '1.145.1'), null);
});
test('releaseNotesSecurityLine: 1.145.3 と 1.145.30 を取り違えない', () => {
  const html = NOTES_HTML(['1.145.30', 'The update addresses these security issues.']);
  assert.equal(releaseNotesSecurityLine(html, '1.145.3'), null);
  assert.match(releaseNotesSecurityLine(html, '1.145.30') || '', /security/);
});
test('releaseNotesSecurityLine: x.y.0（Update の文が無い）は null。ほかの版の文の security に釣られない', () => {
  const html = NOTES_HTML(['1.145.3', 'The update addresses these security issues.']);
  assert.equal(releaseNotesSecurityLine(html, '1.145.0'), null);
  const html2 = NOTES_HTML(['1.145.2', 'Fixed a crash.'], ['1.145.3', 'The update addresses these security issues.']);
  assert.equal(releaseNotesSecurityLine(html2, '1.145.2'), null);
});
test('releaseNotesSecurityLine: HTML でない・版が読めないものは null（落ちない）', () => {
  assert.equal(releaseNotesSecurityLine(null, '1.145.3'), null);
  assert.equal(releaseNotesSecurityLine('<p>x</p>', 'abc'), null);
});
test('mentionsSecurity: 大文字小文字を問わず security', () => {
  assert.equal(mentionsSecurity('Security fix'), true);
  assert.equal(mentionsSecurity('Improved terminal rendering.'), false);
  assert.equal(mentionsSecurity(null), false);
});

// ---- 「セキュリティ修正あり」(docs/06 の2.2 の (a)(b)) ----
const R = (...v) => parseReleases(v.map((x) => rel(x)));
test('labelToVersion: 1.146.0-1 → 1.146.0。読めなければ null', () => {
  assert.equal(labelToVersion('1.146.0-1'), '1.146.0');
  assert.equal(labelToVersion('1.146.0'), '1.146.0');
  assert.equal(labelToVersion('ext-a.b-1.0.0'), null);
});
test('(a) relevantAdvisories: 修正版が 今の版 < P <= 最新の版 にあるものだけ', () => {
  const A = parseAdvisories([adv('in', '1.147.0'), adv('old', '1.140.0'), adv('future', '1.149.0'), adv('eq-current', '1.146.0')]);
  assert.deepEqual(relevantAdvisories(A, '1.146.0', '1.148.0').map((a) => a.id), ['in']);
});
test('(a) relevantAdvisories: 旧い版への修正の写し（今の版がすでに直っている）は外す', () => {
  const A = parseAdvisories([adv('backport', '1.145.3, 1.147.1', '>= 1.140.0, < 1.145.3')]);
  assert.deepEqual(relevantAdvisories(A, '1.146.0', '1.147.1').map((a) => a.id), [], '今の 1.146.0 は範囲に入らない');
  const B = parseAdvisories([adv('affects', '1.147.1', '< 1.147.1')]);
  assert.deepEqual(relevantAdvisories(B, '1.146.0', '1.147.1').map((a) => a.id), ['affects']);
});
test('(a) relevantAdvisories: 範囲が読めなくても（null）修正版が範囲内なら関係ありとする', () => {
  const A = parseAdvisories([adv('noRange', '1.147.0', null)]);
  assert.equal(relevantAdvisories(A, '1.146.0', '1.147.0').length, 1);
});
test('(a) planCore + finishCore: 修正版が最新の版以下のアドバイザリがあれば security', () => {
  const A = parseAdvisories([adv('GHSA-a', '1.147.0')]);
  const c = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: A }), { notes: {} });
  assert.equal(c.security, true);
  assert.equal(priorityFor(c), '高');
});
test('(a) 修正版が最新の版より上なら security にならない', () => {
  const A = parseAdvisories([adv('GHSA-a', '1.148.0')]);
  const c = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: A }), { notes: {} });
  assert.equal(c.security, false);
});
test('(a) 1週に複数出たとき: 最新のタグで1回。途中の版の修正も含む', () => {
  const A = parseAdvisories([adv('mid', '1.147.0')]);
  const c = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0', '1.147.1'), advisories: A }), { notes: {} });
  assert.equal(c.version, '1.147.1');
  assert.deepEqual(c.releases.map((r) => r.version), ['1.147.0', '1.147.1']);
  assert.equal(c.security, true);
});
test('(b) finishCore: リリースノートに security の文があれば security（アドバイザリが無くても）', () => {
  const c0 = planCore({ current: '1.145.0', releases: R('1.145.3'), advisories: [] });
  assert.equal(c0.security, false);
  const c = finishCore(c0, { notes: { '1.145.3': 'Update 1.145.3: The update addresses these security issues.' } });
  assert.equal(c.security, true);
});
test('(a)(b) どちらも無ければ security でない。notes が Map でもよい', () => {
  const c = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: [] }), { notes: new Map([['1.147.0', null]]) });
  assert.equal(c.security, false);
  assert.equal(priorityFor(c), '中');
});
test('(b) 判定: GitHub のリリースの本文に security があれば security', () => {
  const rels = parseReleases([rel('1.147.0', { body: 'Includes a security fix.' })]);
  assert.equal(finishCore(planCore({ current: '1.146.0', releases: rels, advisories: [] }), { notes: {} }).security, true);
});

// ---- 前回の状態との比べ ----
test('planCore: 今の版より新しい版が無ければ null', () => {
  assert.equal(planCore({ current: '1.146.0', releases: R('1.146.0', '1.145.0'), advisories: [] }), null);
});
test('planCore: 今の版が読めなければ例外', () => assert.throws(() => planCore({ current: 'x', releases: [], advisories: [] })));
test('planCore: 前回の通知の版と同じ版しか無ければ null（通知しない）', () => {
  assert.equal(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: [], target: { lastNotifiedVersion: '1.147.0' } }), null);
});
test('planCore: 前回の通知より新しい版が出たら、新しい版だけを newVersions にする', () => {
  const c = planCore({ current: '1.146.0', releases: R('1.147.0', '1.147.1'), advisories: [], target: { lastNotifiedVersion: '1.147.0' } });
  assert.deepEqual(c.newVersions, ['1.147.1']);
  assert.equal(c.version, '1.147.1');
});
test('planCore: 新しい版が無くても、まだ見ていないアドバイザリの修正が加われば通知し直す。見たものなら通知しない', () => {
  const A = parseAdvisories([adv('GHSA-new', '1.147.0')]);
  const target = { lastNotifiedVersion: '1.147.0' };
  assert.ok(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: A, target, seenAdvisories: [] }));
  assert.equal(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: A, target, seenAdvisories: ['GHSA-new'] }), null);
});
test('planCore: アドバイザリが取れなかった（null）ときも本体の ToDo は出し、「取れなかった」と書く', () => {
  const c = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: null }), { notes: {} });
  assert.ok(c);
  assert.match(buildCoreTodo(c, { now: NOW, timeZone: TZ }).detail, /取れなかった/);
});
test('planExtension: 台帳の版と前回の通知の版の両方より新しければ候補。同じ・古いは null', () => {
  const entry = { id: 'anthropic.claude-code', version: '2.1.322' };
  const meta = (v) => parseOpenVsx({ version: v, timestamp: '2026-11-19T01:00:00Z', verified: true });
  assert.ok(planExtension({ entry, meta: meta('2.1.330') }));
  assert.equal(planExtension({ entry, meta: meta('2.1.322') }), null);
  assert.equal(planExtension({ entry, meta: meta('2.1.321') }), null);
  assert.equal(planExtension({ entry, meta: meta('2.1.330'), target: { lastNotifiedVersion: '2.1.330' } }), null);
  assert.ok(planExtension({ entry, meta: meta('2.1.331'), target: { lastNotifiedVersion: '2.1.330' } }));
  assert.ok(planExtension({ entry: { id: 'a.b', version: '2.1.9' }, meta: meta('2.1.10') }), '数として比べる');
});
test('planExtension: 拡張は常にセキュリティ修正でない。入れてよい日時は公開の72時間後', () => {
  const c = planExtension({ entry: { id: 'a.b', version: '1.0.0' }, meta: parseOpenVsx({ version: '1.0.1', timestamp: '2026-11-10T00:00:00Z' }) });
  assert.equal(c.security, false);
  assert.equal(new Date(c.installableAt).toISOString(), '2026-11-13T00:00:00.000Z');
});

// ---- ToDo の中身 (docs/06 の2.3 の表) ----
const core = (o = {}) => finishCore(planCore({ current: '1.146.0', releases: R('1.147.0'), advisories: o.advisories ?? [] }), { notes: o.notes ?? {} });
const secCore = () => core({ advisories: parseAdvisories([adv('GHSA-aaaa', '1.147.0', null, 'critical')]) });
const ext = (id, v, ver = '2.1.322') => planExtension({ entry: { id, version: ver }, meta: parseOpenVsx({ version: v, timestamp: '2026-11-19T01:00:00Z', verified: true }) });

test('ToDo: 題名（本体・セキュリティ修正あり）', () => {
  assert.equal(buildCoreTodo(secCore(), { now: NOW, timeZone: TZ }).title, '取り込みの検証: 本体 1.147.0（セキュリティ修正あり）');
});
test('ToDo: 題名（本体・修正なし）に「セキュリティ修正あり」を付けない', () => {
  assert.equal(buildCoreTodo(core(), { now: NOW, timeZone: TZ }).title, '取り込みの検証: 本体 1.147.0');
});
test('ToDo: 題名（拡張）', () => {
  assert.equal(buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ }).title, '取り込みの検証: 拡張 anthropic.claude-code 2.1.330');
});
test('ToDo: 優先度（本体 修正あり 高、本体 その他 中、Claude Code 拡張 中、ほかの拡張 低）', () => {
  assert.equal(buildCoreTodo(secCore(), { now: NOW, timeZone: TZ }).priority, '高');
  assert.equal(buildCoreTodo(core(), { now: NOW, timeZone: TZ }).priority, '中');
  assert.equal(buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ }).priority, '中');
  assert.equal(buildExtTodo(ext('esbenp.prettier-vscode', '11.0.1', '11.0.0'), { now: NOW, timeZone: TZ }).priority, '低');
});
test('ToDo: Claude Code 拡張の判定は ID の大文字小文字を問わない', () => {
  assert.equal(priorityFor(ext('Anthropic.Claude-Code', '2.1.330')), '中');
});
test('ToDo: 期限（修正あり 検知の翌日、それ以外 7日後。タイムゾーンの日付で数える）', () => {
  assert.equal(buildCoreTodo(secCore(), { now: NOW, timeZone: TZ }).due, '2026-11-15');
  assert.equal(buildCoreTodo(core(), { now: NOW, timeZone: TZ }).due, '2026-11-21');
  assert.equal(buildExtTodo(ext('a.b', '2.1.330'), { now: NOW, timeZone: TZ }).due, '2026-11-21');
});
test('期限: UTC と JST で日付が違う時刻（2026-11-14 16:00Z = JST 11-15 01:00）は timeZone の日付で数える', () => {
  const late = new Date('2026-11-14T16:00:00Z');
  assert.equal(dueDateFor({ security: true, now: late, timeZone: 'Asia/Tokyo' }), '2026-11-16');
  assert.equal(dueDateFor({ security: true, now: late, timeZone: 'UTC' }), '2026-11-15');
});
test('期限: 月・年をまたぐ。うるう日', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.throws(() => addDays('2026/11/30', 1));
  assert.equal(localDate(new Date('2026-12-31T20:00:00Z'), 'Asia/Tokyo'), '2027-01-01');
});
test('ToDo: 詳細・メモに 今の版 → 新しい版、件数と重さ、起動するコマンド（本体）', () => {
  const t = buildCoreTodo(secCore(), { now: NOW, timeZone: TZ });
  assert.ok(t.detail.includes('1.146.0') && t.detail.includes('1.147.0'));
  assert.match(t.detail, /1件/);
  assert.match(t.detail, /critical/);
  assert.ok(t.detail.includes('node scripts/take-in.mjs core 1.147.0'));
});
test('ToDo: 詳細・メモ（拡張）に 版・公開・入れてよい日時・起動コマンド（docs/06 の3節の形 ext <id> <version>）', () => {
  const t = buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ });
  assert.ok(t.detail.includes('2.1.322') && t.detail.includes('2.1.330'));
  assert.match(t.detail, /入れてよい日時: 2026-11-22T01:00:00/);
  assert.ok(t.detail.includes('node scripts/take-in.mjs ext anthropic.claude-code 2.1.330'));
});
test('ToDo: 本文にリリースノートのリンク・アドバイザリの一覧（本体）、公開日時・Open VSX のページ（拡張）', () => {
  const body = JSON.stringify(buildCoreTodo(secCore(), { now: NOW, timeZone: TZ }).bodyBlocks);
  assert.ok(body.includes('https://code.visualstudio.com/updates/v1_147'));
  assert.ok(body.includes('GHSA-aaaa'));
  const eb = JSON.stringify(buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ }).bodyBlocks);
  assert.ok(eb.includes('https://open-vsx.org/extension/anthropic/claude-code/2.1.330'));
  assert.ok(eb.includes('2026-11-19T01:00:00'));
});
test('ToDo: verified が false なら「要確認」と書く', () => {
  const c = planExtension({ entry: { id: 'a.b', version: '1.0.0' }, meta: parseOpenVsx({ version: '1.0.1', timestamp: '2026-11-10T00:00:00Z', verified: false }) });
  assert.match(buildExtTodo(c, { now: NOW, timeZone: TZ }).detail, /要確認/);
});
test('ToDo: 詳細・メモは 2000 文字までで、アドバイザリが 300 件あっても切れて作れる（本文のブロックも 100 要素以内）', async () => {
  const many = parseAdvisories(Array.from({ length: 300 }, (_, i) => ({ ...adv(`GHSA-${String(i).padStart(4, '0')}`, '1.147.0'), summary: 'x'.repeat(300) })));
  const t = buildCoreTodo(core({ advisories: many }), { now: NOW, timeZone: TZ });
  const notion = makeNotion(); // 代役は create のとき text.content 2000 文字・children 100 個を検査する
  const r = await upsertTodo({ notion, todo: t });
  assert.equal(r.action, 'created');
  assert.ok(plain(prop(notion.pages.get(r.pageId), '詳細・メモ').rich_text).length <= 2000);
});
test('text: 2000 文字までは切らない・2001 文字は 2000 文字以内に切って末尾に …・サロゲートペアを割らない', () => {
  assert.equal(text('a'.repeat(2000)).text.content.length, 2000);
  assert.equal(text('a'.repeat(2000)).text.content.endsWith('…'), false);
  const c = text('a'.repeat(2001)).text.content;
  assert.ok(c.length <= 2000);
  assert.ok(c.endsWith('…'));
  const e = text('a'.repeat(1998) + '😀' + 'b'.repeat(50)).text.content;
  assert.ok(e.length <= 2000);
  assert.ok(!/[\ud800-\udbff]…?$/.test(e.replace(/…$/, '')), '壊れた対');
});
test('paragraph: rich_text は 100 要素までに切る', () => {
  assert.equal(paragraph(Array.from({ length: 150 }, (_, i) => `p${i}`)).paragraph.rich_text.length, 100);
});
test('titlePrefixFor・stateKeyFor: 題名の前方一致の語と state.json のキー', () => {
  assert.equal(titlePrefixFor('core'), '取り込みの検証: 本体 ');
  assert.equal(titlePrefixFor('ext', 'anthropic.claude-code'), '取り込みの検証: 拡張 anthropic.claude-code ');
  assert.equal(stateKeyFor('core'), 'core');
  assert.equal(stateKeyFor('ext', 'Anthropic.Claude-Code'), 'ext:anthropic.claude-code');
  assert.throws(() => titlePrefixFor('x'));
});
test('higherPriority・earlierDate: 高い方・早い方。片方が無ければもう片方', () => {
  assert.equal(higherPriority('中', '高'), '高');
  assert.equal(higherPriority('高', '中'), '高');
  assert.equal(higherPriority('低', '中'), '中');
  assert.equal(earlierDate('2026-11-21', '2026-11-15'), '2026-11-15');
  assert.equal(earlierDate('2026-11-15', '2026-11-21'), '2026-11-15');
  assert.equal(earlierDate(null, '2026-11-15'), '2026-11-15');
  assert.equal(earlierDate('2026-11-15T09:00:00', '2026-11-16'), '2026-11-15');
});

// ---- 失敗 (docs/06 の2.3「失敗したとき」) ----
test('failingDays: 起点の日から今日まで、その日を含めて数える', () => {
  assert.equal(failingDays('2026-11-12T03:00:00Z', new Date('2026-11-12T20:00:00Z'), 'UTC'), 1);
  assert.equal(failingDays('2026-11-12T03:00:00Z', new Date('2026-11-14T03:00:00Z'), 'UTC'), 3);
  assert.equal(failingDays(null, NOW, TZ), 0);
});
test('nextFailingSince: 成功なら null、失敗なら前の起点を保つ（無ければ今）', () => {
  assert.equal(nextFailingSince('2026-11-12T00:00:00.000Z', true, NOW), null);
  assert.equal(nextFailingSince('2026-11-12T00:00:00.000Z', false, NOW), '2026-11-12T00:00:00.000Z');
  assert.equal(nextFailingSince(null, false, NOW), NOW.toISOString());
});
test('buildFailureTodo: 題名は「更新の検知が失敗しています」。誤りの文を詳細に入れる', () => {
  const t = buildFailureTodo({ failingSince: '2026-11-12T00:00:00Z', errors: ['GitHub releases: HTTP 403'], now: NOW, timeZone: TZ });
  assert.ok(t.title.startsWith('更新の検知が失敗しています'));
  assert.match(t.detail, /HTTP 403/);
});
test('watchFreshness: 最後の成功が3日以内なら stale でない。3日を超える・記録が無いは stale', () => {
  const at = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();
  assert.equal(watchFreshness({ lastSuccessAt: at(71) }, NOW).stale, false);
  assert.equal(watchFreshness({ lastSuccessAt: at(73) }, NOW).stale, true);
  assert.equal(watchFreshness(null, NOW).stale, true);
  assert.equal(watchFreshness({}, NOW).stale, true);
  assert.equal(watchFreshness({ lastSuccessAt: 'garbage' }, NOW).stale, true);
});
test('normalizeState: null・壊れた値から空の状態を作る', () => {
  for (const x of [null, undefined, 'x', [], { targets: 5, seenAdvisories: 'a' }]) {
    const s = normalizeState(x);
    assert.equal(s.version, 1);
    assert.deepEqual(s.targets, {});
    assert.deepEqual(s.seenAdvisories, []);
  }
  assert.deepEqual(normalizeState({ seenAdvisories: ['a', 3, 'b'] }).seenAdvisories, ['a', 'b']);
});

// ---- Notion の代役（docs/06 の2.3 の表と API から書いた。実装の fake-notion.mjs は使わない）----
const DS_PROPS = {
  タスク: { type: 'title' },
  状態: { type: 'status', options: ['Not started', 'In progress', 'Done', 'Archived'] },
  種別: { type: 'select', options: ['ToDo', '予定', '期間タスク'] },
  優先度: { type: 'select', options: ['高', '中', '低'] },
  期限: { type: 'date' },
  期限の形式: { type: 'select', options: ['From-To', '終了日のみ'] },
  プロジェクト: { type: 'rich_text' },
  '詳細・メモ': { type: 'rich_text' },
  開始日時: { type: 'date' },
  終了日時: { type: 'date' },
};
function dataSource(props = DS_PROPS) {
  const out = {};
  for (const [name, p] of Object.entries(props)) {
    out[name] = { id: name, name, type: p.type };
    if (p.options) out[name][p.type] = { options: p.options.map((n) => ({ name: n })) };
    else out[name][p.type] = {};
  }
  return { object: 'data_source', id: TODO_DATA_SOURCE_ID, properties: out };
}
const plain = (rt) => (rt || []).map((t) => t.text.content).join('');
function makeNotion({ props = DS_PROPS, failWith = null } = {}) {
  const pages = new Map();
  const calls = [];
  let n = 0;
  const guard = () => { if (failWith) throw failWith; };
  const api = {
    pages, calls,
    async retrieveDataSource() { calls.push('ds'); guard(); return dataSource(props); },
    async queryDataSource(id, body) {
      calls.push('query'); guard();
      const conds = body.filter.and;
      const results = [...pages.values()].filter((p) => conds.every((c) => {
        if (c.property === 'プロジェクト') return plain(p.properties['プロジェクト'].rich_text) === c.rich_text.equals;
        if (c.property === 'タスク') return plain(p.properties['タスク'].title).startsWith(c.title.starts_with);
        if (c.property === '状態') return p.properties['状態'].status.name !== c.status.does_not_equal;
        throw new Error('代役の知らない条件: ' + c.property);
      }));
      return { results: results.reverse() };
    },
    async retrievePage(id) { calls.push('get'); guard(); return pages.get(id) || null; },
    async createPage(body) {
      calls.push('create'); guard();
      assert.equal(body.parent.type, 'data_source_id');
      assert.equal(body.parent.data_source_id, TODO_DATA_SOURCE_ID);
      for (const [k, v] of Object.entries(body.properties)) assert.ok(k in props, `データソースに無い項目 ${k}`);
      for (const rt of Object.values(body.properties).flatMap((p) => p.rich_text || p.title || [])) assert.ok(rt.text.content.length <= 2000);
      assert.ok((body.children || []).length <= 100);
      const id = `page-${++n}`;
      pages.set(id, { id, archived: false, properties: structuredClone(body.properties), children: structuredClone(body.children || []) });
      return { id };
    },
    async updatePage(id, body) { calls.push('update'); guard(); Object.assign(pages.get(id).properties, structuredClone(body.properties)); return { id }; },
    async appendBlockChildren(id, children) { calls.push('append'); guard(); assert.ok(children.length <= 100); pages.get(id).children.push(...children); return {}; },
  };
  return api;
}
const prop = (page, k) => page.properties[k];
const done = (page) => { page.properties['状態'] = { status: { name: 'Done' } }; };

test('Notion の代役: checkTodoSchema は docs/06 の2.3 の項目を満たすデータソースを通す', () => {
  assert.deepEqual(checkTodoSchema(dataSource()), []);
});
test('checkTodoSchema: 項目の欠け・型違い・選択肢の欠けを見つけて止められる（項目を勝手に作らない）', () => {
  const missing = { ...DS_PROPS };
  delete missing.優先度;
  assert.ok(checkTodoSchema(dataSource(missing)).some((e) => e.includes('優先度')));
  assert.ok(checkTodoSchema(dataSource({ ...DS_PROPS, 期限: { type: 'rich_text' } })).some((e) => e.includes('期限')));
  assert.ok(checkTodoSchema(dataSource({ ...DS_PROPS, 状態: { type: 'status', options: ['Not started'] } })).length > 0);
  assert.ok(checkTodoSchema(dataSource({ ...DS_PROPS, 優先度: { type: 'select', options: ['高', '中'] } })).length > 0);
  assert.ok(checkTodoSchema(null).length > 0);
  assert.ok(checkTodoSchema({}).length > 0);
});

// ---- 重複を避ける (docs/06 の2.3) ----
const todoCore = (c) => buildCoreTodo(c, { now: NOW, timeZone: TZ });
test('upsertTodo: 無ければ作る。作った ToDo は 状態 Not started・種別 ToDo・期限の形式 終了日のみ・プロジェクト Shuko、開始日時・終了日時は書かない', async () => {
  const notion = makeNotion();
  const r = await upsertTodo({ notion, todo: todoCore(core()) });
  assert.equal(r.action, 'created');
  const p = notion.pages.get(r.pageId);
  assert.equal(prop(p, '状態').status.name, 'Not started');
  assert.equal(prop(p, '種別').select.name, 'ToDo');
  assert.equal(prop(p, '期限の形式').select.name, '終了日のみ');
  assert.equal(plain(prop(p, 'プロジェクト').rich_text), 'Shuko');
  assert.equal(plain(prop(p, 'タスク').title), '取り込みの検証: 本体 1.147.0');
  assert.ok(!('開始日時' in p.properties) && !('終了日時' in p.properties));
});
test('upsertTodo: 開いている ToDo（覚えたページ ID）があれば足さず直す。本文に「更新: 1.147.1 も出た」を足す', async () => {
  const notion = makeNotion();
  const first = await upsertTodo({ notion, todo: todoCore(core()) });
  const c2 = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0', '1.147.1'), advisories: [], target: { lastNotifiedVersion: '1.147.0' } }), { notes: {} });
  const r = await upsertTodo({ notion, rememberedPageId: first.pageId, todo: todoCore(c2) });
  assert.equal(r.action, 'updated');
  assert.equal(r.pageId, first.pageId);
  assert.equal(notion.pages.size, 1);
  const p = notion.pages.get(first.pageId);
  assert.equal(plain(prop(p, 'タスク').title), '取り込みの検証: 本体 1.147.1');
  assert.match(JSON.stringify(p.children), /1\.147\.1 も出た/);
});
test('upsertTodo: セキュリティ修正が加わったら 優先度と期限を上げる（高・翌日）', async () => {
  const notion = makeNotion();
  const first = await upsertTodo({ notion, todo: todoCore(core()) });
  assert.equal(prop(notion.pages.get(first.pageId), '優先度').select.name, '中');
  const A = parseAdvisories([adv('GHSA-new', '1.147.1')]);
  const c2 = finishCore(planCore({ current: '1.146.0', releases: R('1.147.0', '1.147.1'), advisories: A, target: { lastNotifiedVersion: '1.147.0' } }), { notes: {} });
  const r = await upsertTodo({ notion, rememberedPageId: first.pageId, todo: todoCore(c2) });
  const p = notion.pages.get(r.pageId);
  assert.equal(prop(p, '優先度').select.name, '高');
  assert.equal(prop(p, '期限').date.start, '2026-11-15');
  assert.match(plain(prop(p, 'タスク').title), /セキュリティ修正あり/);
});
test('upsertTodo: 後から出た通常の版は 優先度・期限を下げず延ばさない', async () => {
  const notion = makeNotion();
  const A = parseAdvisories([adv('GHSA-a', '1.147.0')]);
  const first = await upsertTodo({ notion, todo: todoCore(core({ advisories: A })) });
  const later = buildCoreTodo(core(), { now: new Date('2026-11-16T03:00:00Z'), timeZone: TZ });
  await upsertTodo({ notion, rememberedPageId: first.pageId, todo: later });
  const p = notion.pages.get(first.pageId);
  assert.equal(prop(p, '優先度').select.name, '高');
  assert.equal(prop(p, '期限').date.start, '2026-11-15');
});
test('upsertTodo: 覚えたページが Done・Archived・ごみ箱・消えているときは、データソースを検索し、見つからなければ新しく作る', async () => {
  const notion = makeNotion();
  const first = await upsertTodo({ notion, todo: todoCore(core()) });
  done(notion.pages.get(first.pageId));
  const r = await upsertTodo({ notion, rememberedPageId: first.pageId, todo: todoCore(core()) });
  assert.equal(r.action, 'created');
  assert.notEqual(r.pageId, first.pageId);
  assert.equal(notion.pages.size, 2);
  const r2 = await upsertTodo({ notion, rememberedPageId: 'page-gone', todo: todoCore(core()) });
  assert.equal(r2.action, 'updated', '消えた ID でも、開いているものを検索で見つける');
  assert.equal(r2.pageId, r.pageId);
});
test('upsertTodo: state.json が無い（覚えたページ ID が無い）ときは、題名の前方一致・プロジェクト・状態で見つける（重複しない）', async () => {
  const notion = makeNotion();
  await upsertTodo({ notion, todo: todoCore(core()) });
  const r = await upsertTodo({ notion, rememberedPageId: null, todo: todoCore(core()) });
  assert.equal(r.action, 'updated');
  assert.equal(notion.pages.size, 1);
});
test('upsertTodo: 本体と拡張は別の ToDo（題名の前方一致が混ざらない）。拡張どうしも別', async () => {
  const notion = makeNotion();
  await upsertTodo({ notion, todo: todoCore(core()) });
  await upsertTodo({ notion, todo: buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ }) });
  await upsertTodo({ notion, todo: buildExtTodo(ext('esbenp.prettier-vscode', '11.0.1', '11.0.0'), { now: NOW, timeZone: TZ }) });
  assert.equal(notion.pages.size, 3);
});
test('isOpenPage: Done・Archived・archived・in_trash・null は開いていない', () => {
  const pg = (s, extra = {}) => ({ properties: { 状態: { status: { name: s } } }, ...extra });
  assert.equal(isOpenPage(pg('Not started')), true);
  assert.equal(isOpenPage(pg('In progress')), true);
  assert.equal(isOpenPage(pg('Done')), false);
  assert.equal(isOpenPage(pg('Archived')), false);
  assert.equal(isOpenPage(pg('Not started', { archived: true })), false);
  assert.equal(isOpenPage(pg('Not started', { in_trash: true })), false);
  assert.equal(isOpenPage(null), false);
});

// ---- 取り込みの書き戻し (docs/06 の4節の10) ----
const VERDICT = {
  label: '1.147.0-1', verdict: 'conditional', recommendation: '条件を満たしてから', checks: 'ok', build: 'ok',
  smoke: { auto: 'ok', manualToDo: ['a'] }, network: { newHosts: ['x.example.com'] },
  security: { advisories: ['GHSA-a'], relevantToThisBuild: [{ id: 'GHSA-a', relevant: false, why: '' }] }, conditions: ['宛先を決める'],
};
test('summarizeVerdict: 判定・推奨・理由の要点・verdict.md のパス', () => {
  const s = summarizeVerdict(VERDICT);
  assert.equal(s.verdict, 'conditional');
  assert.equal(s.verdictPath, 'records/take-in/1.147.0-1/verdict.md');
  assert.ok(s.reasons.some((r) => r.includes('x.example.com')));
  assert.ok(s.reasons.some((r) => r.includes('宛先を決める')));
  assert.equal(summarizeVerdict(null).verdict, null);
});
test('writeBackTakeIn: ToDo の本文に判定の要約を足し、状態を In progress にする（覚えたページ ID を state.json から読む）', async () => {
  const notion = makeNotion();
  const first = await upsertTodo({ notion, todo: todoCore(core()) });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ targets: { core: { openPageId: first.pageId } } }));
  const r = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.pageId, first.pageId);
  const p = notion.pages.get(first.pageId);
  assert.equal(prop(p, '状態').status.name, 'In progress');
  const body = JSON.stringify(p.children);
  assert.ok(body.includes('条件付き') && body.includes('records/take-in/1.147.0-1/verdict.md'));
});
test('writeBackTakeIn: state.json が無いときは検索で見つける。拡張は拡張の ToDo に書く', async () => {
  const notion = makeNotion();
  await upsertTodo({ notion, todo: todoCore(core()) });
  const e = await upsertTodo({ notion, todo: buildExtTodo(ext('anthropic.claude-code', '2.1.330'), { now: NOW, timeZone: TZ }) });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
  const r = await writeBackTakeIn({ kind: 'ext', extId: 'anthropic.claude-code', ...summarizeVerdict(VERDICT), stateFile: path.join(dir, 'none.json'), notion, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.pageId, e.pageId);
});
test('writeBackTakeIn: ToDo が見つからない・Notion が失敗・トークンを読めないときは、例外にせず ok:false と理由（取り込みを止めない）', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
  const stateFile = path.join(dir, 'none.json');
  const r1 = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion: makeNotion(), now: NOW });
  assert.equal(r1.ok, false);
  assert.ok(r1.reason);
  const err = Object.assign(new Error('HTTP 401 unauthorized'), { status: 401 });
  const r2 = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion: makeNotion({ failWith: err }), now: NOW });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /401/);
  const r3 = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, tokenFile: path.join(dir, 'no.dpapi'), readToken: () => { throw new Error('トークンを読めない'); }, now: NOW });
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /トークン/);
});

// M-3: 覚えたページが閉じている（Done・Archived・ごみ箱）ときは、そのページに書かず（In progress に戻さず）、検索に回る
test('writeBackTakeIn（M-3）: 覚えたページが Done なら書かない・状態を In progress に戻さない。開いている別の ToDo が検索で見つかればそちらに書く', async () => {
  const notion = makeNotion();
  const old = await upsertTodo({ notion, todo: todoCore(core()) });
  done(notion.pages.get(old.pageId));
  const fresh = await upsertTodo({ notion, rememberedPageId: old.pageId, todo: todoCore(core()) });
  assert.notEqual(fresh.pageId, old.pageId);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ targets: { core: { openPageId: old.pageId } } }));
  const r = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion, now: NOW });
  assert.equal(prop(notion.pages.get(old.pageId), '状態').status.name, 'Done', '閉じたページは変えない');
  assert.equal(notion.pages.get(old.pageId).children.length, todoCore(core()).bodyBlocks.length, '閉じたページに本文を足さない');
  assert.equal(r.ok, true);
  assert.equal(r.pageId, fresh.pageId);
  assert.equal(prop(notion.pages.get(fresh.pageId), '状態').status.name, 'In progress');
});
test('writeBackTakeIn（M-3）: 覚えたページが Done・Archived で、ほかに開いている ToDo が無ければ ok:false と理由（どこにも書かない）', async () => {
  for (const status of ['Done', 'Archived']) {
    const notion = makeNotion();
    const only = await upsertTodo({ notion, todo: todoCore(core()) });
    notion.pages.get(only.pageId).properties['状態'] = { status: { name: status } };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
    const stateFile = path.join(dir, 'state.json');
    fs.writeFileSync(stateFile, JSON.stringify({ targets: { core: { openPageId: only.pageId } } }));
    const before = JSON.stringify([...notion.pages.values()]);
    const r = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion, now: NOW });
    assert.equal(r.ok, false, status);
    assert.ok(r.reason, status);
    assert.equal(JSON.stringify([...notion.pages.values()]), before, `${status}: 何も書かない`);
  }
});
test('writeBackTakeIn（M-3）: 覚えたページがごみ箱（in_trash・archived）でも書かない', async () => {
  for (const flag of ['in_trash', 'archived']) {
    const notion = makeNotion();
    const only = await upsertTodo({ notion, todo: todoCore(core()) });
    notion.pages.get(only.pageId)[flag] = true;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
    const stateFile = path.join(dir, 'state.json');
    fs.writeFileSync(stateFile, JSON.stringify({ targets: { core: { openPageId: only.pageId } } }));
    const r = await writeBackTakeIn({ kind: 'core', ...summarizeVerdict(VERDICT), stateFile, notion, now: NOW });
    assert.equal(r.ok, false, flag);
    assert.equal(notion.pages.get(only.pageId).children.length, todoCore(core()).bodyBlocks.length, flag);
  }
});
// M-2: 大文字を含む拡張の ID（台帳の ID）で ToDo を作り、同じ ID で書き戻す（state.json が無くても見つかる）
test('writeBackTakeIn（M-2）: 大文字を含む ID（MS-CEINTL.vscode-language-pack-ja）の ToDo を、台帳の ID で state.json 無しに見つけて書く', async () => {
  const notion = makeNotion();
  const id = 'MS-CEINTL.vscode-language-pack-ja';
  const c = planExtension({ entry: { id, version: '1.146.0' }, meta: parseOpenVsx({ version: '1.147.0', timestamp: '2026-11-10T00:00:00Z', verified: true }) });
  const made = await upsertTodo({ notion, todo: buildExtTodo(c, { now: NOW, timeZone: TZ }) });
  assert.ok(plain(prop(notion.pages.get(made.pageId), 'タスク').title).includes(id), '題名は台帳の ID のまま');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-wb-'));
  const r = await writeBackTakeIn({ kind: 'ext', extId: id, ...summarizeVerdict(VERDICT), stateFile: path.join(dir, 'none.json'), notion, now: NOW });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.pageId, made.pageId);
});
test('state のキーは ID を小文字にする（stateKeyFor）。覚えたページ ID は大文字小文字の違う ID でも同じキーで引ける', () => {
  assert.equal(stateKeyFor('ext', 'MS-CEINTL.vscode-language-pack-ja'), stateKeyFor('ext', 'ms-ceintl.vscode-language-pack-ja'));
});

// ---- 通しの流れ（runWatch）。GitHub・Open VSX・Notion を差し替える ----
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-watch-'));
  const builder = path.join(dir, 'builder');
  const installRoot = path.join(dir, 'install');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(builder, { recursive: true });
  fs.mkdirSync(installRoot, { recursive: true });
  fs.writeFileSync(path.join(builder, 'upstream.json'), JSON.stringify({ tag: '1.146.0', commit: 'a'.repeat(40), repository: 'https://github.com/microsoft/vscode.git' }));
  const lock = [{ id: 'anthropic.claude-code', version: '2.1.322', targetPlatform: 'win32-x64' }, { id: 'esbenp.prettier-vscode', version: '11.0.0' }];
  fs.writeFileSync(path.join(builder, 'extensions.lock.json'), JSON.stringify(lock));
  const web = new Map();
  const set = (url, v) => web.set(url, v);
  const fetcher = {
    async getJson(url) { const v = web.get(url); if (v === undefined) throw new Error(`HTTP 500: ${url}`); if (v instanceof Error) throw v; return v; },
    async getText(url) { const v = web.get(url); if (v === undefined) return null; return v; },
  };
  const base = () => {
    set(GITHUB_RELEASES_URL, [rel('1.146.0')]);
    set(GITHUB_ADVISORIES_URL, []);
    set(openVsxApiUrl(lock[0]), { version: '2.1.322', timestamp: '2026-11-01T00:00:00Z', verified: true });
    set(openVsxApiUrl(lock[1]), { version: '11.0.0', timestamp: '2026-11-01T00:00:00Z', verified: true });
  };
  base();
  const opts = (extra = []) => parseArgs(['--builder-repo', builder, '--install-root', installRoot, '--state-dir', stateDir, '--quiet', '--time-zone', TZ, ...extra]);
  const run = (notion, now = NOW, extra = []) => runWatch(opts(extra), { fetcher, notion, now, timeZone: TZ, env: { LOCALAPPDATA: dir }, echo: false });
  const stateFile = path.join(stateDir, 'state.json');
  return { dir, lock, set, run, stateFile, stateDir, base, opts, fetcher, notion: null };
}
const open = (notion) => [...notion.pages.values()].filter((p) => prop(p, '状態').status.name !== 'Done');

test('通し: 新しい版が無ければ何も書かない（ToDo も作らない）。state.json は書く', async () => {
  const w = setup();
  const notion = makeNotion();
  const r = await w.run(notion);
  assert.equal(r.exitCode, 0);
  assert.equal(notion.pages.size, 0);
  assert.ok(JSON.parse(fs.readFileSync(w.stateFile, 'utf8')).lastSuccessAt);
});
test('通し: 本体と拡張の新版で ToDo を作り、state.json に最後に通知した版とページ ID を残す。同じ入力を2回流しても足さない', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  w.set(openVsxApiUrl(w.lock[0]), { version: '2.1.330', timestamp: '2026-11-13T00:00:00Z', verified: true });
  const notion = makeNotion();
  const r1 = await w.run(notion);
  assert.equal(r1.exitCode, 0);
  assert.equal(notion.pages.size, 2);
  const s = JSON.parse(fs.readFileSync(w.stateFile, 'utf8'));
  assert.equal(s.targets.core.lastNotifiedVersion, '1.147.0');
  assert.ok(s.targets.core.openPageId);
  assert.equal(s.targets['ext:anthropic.claude-code'].lastNotifiedVersion, '2.1.330');
  const r2 = await w.run(notion, new Date(NOW.getTime() + 86400e3));
  assert.equal(notion.pages.size, 2, '重複して足さない');
  assert.equal(notion.calls.filter((c) => c === 'create').length, 2, '作成は最初の2件だけ');
  assert.deepEqual(r2.plan, []);
});
test('通し: セキュリティ修正のある版が加わると、開いている ToDo を高・翌日に直し、題名に（セキュリティ修正あり）を付ける。重複しない', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  await w.run(notion);
  w.set(GITHUB_RELEASES_URL, [rel('1.147.1'), rel('1.147.0'), rel('1.146.0')]);
  w.set(GITHUB_ADVISORIES_URL, [adv('GHSA-zzzz', '1.147.1', '< 1.147.1', 'high')]);
  const later = new Date('2026-11-16T03:00:00Z');
  await w.run(notion, later);
  assert.equal(notion.pages.size, 1);
  const p = [...notion.pages.values()][0];
  assert.equal(plain(prop(p, 'タスク').title), '取り込みの検証: 本体 1.147.1（セキュリティ修正あり）');
  assert.equal(prop(p, '優先度').select.name, '高');
  assert.equal(prop(p, '期限').date.start, '2026-11-17');
});
test('通し: ToDo を Done にしたあとに新しい版が出たら、新しい ToDo を作る', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  await w.run(notion);
  done([...notion.pages.values()][0]);
  w.set(GITHUB_RELEASES_URL, [rel('1.148.0'), rel('1.147.0'), rel('1.146.0')]);
  await w.run(notion, new Date('2026-11-21T03:00:00Z'));
  assert.equal(notion.pages.size, 2);
  assert.equal(open(notion).length, 1);
});
test('通し: state.json が無くなっても、データソースの検索で開いている ToDo を見つけ、重複しない', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  await w.run(notion);
  fs.rmSync(w.stateFile);
  w.set(GITHUB_RELEASES_URL, [rel('1.147.1'), rel('1.147.0'), rel('1.146.0')]);
  await w.run(notion, new Date('2026-11-15T03:00:00Z'));
  assert.equal(notion.pages.size, 1);
});
test('通し: 壊れた state.json は脇へ寄せ、空から始める（落ちない）', async () => {
  const w = setup();
  fs.mkdirSync(w.stateDir, { recursive: true });
  fs.writeFileSync(w.stateFile, '{broken');
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  const r = await w.run(notion);
  assert.equal(r.exitCode, 0);
  assert.equal(notion.pages.size, 1);
  assert.ok(fs.readdirSync(w.stateDir).some((f) => f.startsWith('state.json.broken')));
});
test('通し: --dry-run は Notion に書かず、state.json も watch.log も作らない。計画（作る ToDo の中身）を返す', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  const r = await w.run(notion, NOW, ['--dry-run']);
  assert.equal(notion.calls.length, 0);
  assert.ok(!fs.existsSync(w.stateFile));
  assert.ok(!fs.existsSync(path.join(w.stateDir, 'watch.log')));
  assert.equal(r.plan[0].title, '取り込みの検証: 本体 1.147.0');
});
test('通し: 今の版は <installRoot>\\current の行き先のフォルダ名（ラベル）から取る。無ければ upstream.json の tag', () => {
  const w = setup();
  assert.equal(currentCoreVersion(w.opts().installRoot, '1.146.0').version, '1.146.0');
  const rp = (p) => p.replace(/\\$/, '');
  const r = currentCoreVersion('C:\\i', '1.146.0', { realpath: (p) => (rp(p).endsWith('current') ? 'C:\\i\\versions\\1.147.0-2' : p) });
  assert.equal(r.version, '1.147.0');
  assert.equal(r.label, '1.147.0-2');
});
test('通し: 今の版が 1.147.0 なら、1.147.0 の ToDo は作らない（今の版より新しいものだけ）', async () => {
  const w = setup();
  fs.mkdirSync(path.join(w.dir, 'install', 'versions', '1.147.0-1'), { recursive: true });
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion();
  const env = { LOCALAPPDATA: w.dir };
  const opts = parseArgs(['--builder-repo', path.join(w.dir, 'builder'), '--install-root', path.join(w.dir, 'install'), '--state-dir', w.stateDir, '--quiet']);
  const r = await runWatch(opts, { fetcher: w.fetcher, notion, now: NOW, timeZone: TZ, env, echo: false, realpath: (p) => (/current$/.test(p) ? path.join(w.dir, 'install', 'versions', '1.147.0-1') : p) });
  assert.equal(r.current.version, '1.147.0');
  assert.equal(notion.pages.size, 0);
});

// ---- 失敗 ----
test('通し: GitHub の取得が3日続けて失敗したら「更新の検知が失敗しています」を足す（2日目までは足さない）。重複しない', async () => {
  const w = setup();
  const notion = makeNotion();
  w.set(GITHUB_RELEASES_URL, new Error('HTTP 403'));
  const day = (n) => new Date(NOW.getTime() + n * 86400e3);
  const r1 = await w.run(notion, day(0));
  assert.equal(r1.exitCode, 1);
  await w.run(notion, day(1));
  assert.equal(notion.pages.size, 0, '2日目まで足さない');
  await w.run(notion, day(2));
  assert.equal(notion.pages.size, 1);
  assert.match(plain(prop([...notion.pages.values()][0], 'タスク').title), /更新の検知が失敗しています/);
  await w.run(notion, day(3));
  assert.equal(notion.pages.size, 1, '4日目に重複して足さない');
});
test('通し: 取得が成功に戻れば failingSince を消す', async () => {
  const w = setup();
  const notion = makeNotion();
  w.set(GITHUB_RELEASES_URL, new Error('HTTP 403'));
  await w.run(notion);
  assert.ok(JSON.parse(fs.readFileSync(w.stateFile, 'utf8')).failingSince);
  w.base();
  await w.run(notion, new Date(NOW.getTime() + 86400e3));
  assert.equal(JSON.parse(fs.readFileSync(w.stateFile, 'utf8')).failingSince, null);
});
test('通し: アドバイザリだけ取れなくても本体の ToDo は出す（取得の失敗として数える）', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  w.set(GITHUB_ADVISORIES_URL, new Error('HTTP 403'));
  const notion = makeNotion();
  const r = await w.run(notion);
  assert.equal(notion.pages.size, 1);
  assert.equal(r.fetchOk, false);
  assert.equal(r.exitCode, 1);
});
test('通し: Notion のトークンが失効（401）したら 終了コード 1。lastSuccessAt を進めず、state の通知済みの版も進めない（次に通知し直す）', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const notion = makeNotion({ failWith: Object.assign(new Error('HTTP 401 unauthorized'), { status: 401 }) });
  const r = await w.run(notion);
  assert.equal(r.exitCode, 1);
  assert.equal(r.notionOk, false);
  const s = JSON.parse(fs.readFileSync(w.stateFile, 'utf8'));
  assert.equal(s.lastSuccessAt, null);
  assert.ok(!s.targets.core);
});
test('通し: データソースの項目が設計と違えば何も書かずに 終了コード 1（項目を勝手に作らない）', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const props = { ...DS_PROPS };
  delete props.優先度;
  const notion = makeNotion({ props });
  const r = await w.run(notion);
  assert.equal(r.exitCode, 1);
  assert.equal(notion.pages.size, 0);
  assert.ok(!notion.calls.includes('create'));
});
test('通し: トークンはログにも state.json にも出ない（差し替えたトークンの値で確かめる）', async () => {
  const w = setup();
  w.set(GITHUB_RELEASES_URL, [rel('1.147.0'), rel('1.146.0')]);
  const SECRET = 'ntn_SECRETVALUE0123456789';
  const f401 = async () => jres(401, { code: 'unauthorized', message: 'API token is invalid.' });
  const notion = createNotionClient({ token: SECRET, fetchImpl: f401, sleep: async () => {} });
  const r = await w.run(notion);
  assert.equal(r.exitCode, 1);
  assert.ok(!JSON.stringify(r).includes(SECRET));
  const all = fs.readdirSync(w.stateDir).map((f) => fs.readFileSync(path.join(w.stateDir, f), 'utf8')).join('\n');
  assert.ok(!all.includes(SECRET));
});

// ---- Notion の呼び出し (docs/06 の2.3 の API) ----
const jres = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const seq = (responses) => { const calls = []; const f = async (url, init) => { calls.push({ url: String(url), init }); const r = responses.shift(); if (r instanceof Error) throw r; return r; }; f.calls = calls; return f; };
const client = (fetchImpl, sleeps = [], extra = {}) => createNotionClient({ token: 'secret-abc', fetchImpl, sleep: async (ms) => sleeps.push(ms), ...extra });

test('Notion の呼び出し: Notion-Version 2025-09-03、Authorization、宛先は api.notion.com/v1（データソース ID を parent に使う）', async () => {
  const f = seq([jres(200, { id: 'p' })]);
  await client(f).createPage({ parent: { type: 'data_source_id', data_source_id: 'x' }, properties: {} });
  const c = f.calls[0];
  assert.equal(c.url, 'https://api.notion.com/v1/pages');
  assert.equal(c.init.headers['Notion-Version'], '2025-09-03');
  assert.equal(c.init.headers.Authorization, 'Bearer secret-abc');
  assert.equal(c.init.method, 'POST');
});
test('Notion の呼び出し: データソースの検索は POST /v1/data_sources/{id}/query', async () => {
  const f = seq([jres(200, { results: [] })]);
  await client(f).queryDataSource('ds-1', { page_size: 1 });
  assert.equal(f.calls[0].url, 'https://api.notion.com/v1/data_sources/ds-1/query');
  assert.equal(f.calls[0].init.method, 'POST');
});
test('Notion の呼び出し: 429 は Retry-After の秒数だけ待ってやり直す。529 も同じ', async () => {
  for (const status of [429, 529]) {
    const f = seq([jres(status, { code: 'rate_limited' }, { 'Retry-After': '2' }), jres(200, { id: 'p' })]);
    const sleeps = [];
    const r = await client(f, sleeps).retrievePage('p');
    assert.equal(r.id, 'p');
    assert.deepEqual(sleeps, [2000], String(status));
  }
});
test('Notion の呼び出し: 429 が続くと回数の上限で諦めて例外（トークンを含まない）', async () => {
  const f = seq(Array.from({ length: 20 }, () => jres(429, { code: 'rate_limited', message: 'slow' }, { 'Retry-After': '1' })));
  await assert.rejects(client(f).retrievePage('p'), (e) => e.status === 429 && !e.message.includes('secret-abc'));
  assert.ok(f.calls.length < 20);
});
test('Notion の呼び出し: Retry-After が無いときも待つ。極端に長い値には上限がある', () => {
  assert.ok(retryAfterMs(null, 1) >= 1000);
  assert.equal(retryAfterMs('2', 1), 2000);
  assert.ok(retryAfterMs('99999', 1) <= 120000);
});
test('Notion の呼び出し: 書き込み（POST /pages・PATCH）は 503 でやり直さない。読み出し（GET）はやり直す', async () => {
  const w = seq([jres(503, { code: 'service_unavailable' }), jres(200, { id: 'p' })]);
  await assert.rejects(client(w).createPage({}), (e) => e.status === 503);
  assert.equal(w.calls.length, 1);
  const w2 = seq([jres(503, {}), jres(200, { id: 'p' })]);
  assert.equal((await client(w2).retrievePage('p')).id, 'p');
  assert.equal(w2.calls.length, 2);
});
test('Notion の呼び出し: 400・401・404（ページ取得以外）は再試行しない。ページの 404 は null', async () => {
  for (const s of [400, 401, 403]) {
    const f = seq([jres(s, { code: 'x', message: 'm' }), jres(200, {})]);
    await assert.rejects(client(f).updatePage('p', {}), (e) => e.status === s);
    assert.equal(f.calls.length, 1, String(s));
  }
  assert.equal(await client(seq([jres(404, { code: 'object_not_found' })])).retrievePage('gone'), null);
});
test('Notion の呼び出し: トークンが空なら作れない。通信の誤りの文にトークンを入れない', async () => {
  assert.throws(() => createNotionClient({ token: '  ' }));
  const f = seq([new Error('ECONNRESET')]);
  await assert.rejects(client(f).createPage({}), (e) => /ECONNRESET/.test(e.message) && !e.message.includes('secret-abc'));
});

// ---- トークンの読み出し (docs/06 の2.4) ----
test('readNotionToken: powershell を -NoProfile -NonInteractive -File read-secret.ps1 で呼び、標準出力の前後の空白を落とす', () => {
  let got;
  const t = readNotionToken({ tokenFile: 'X:\\t.dpapi', spawnSyncImpl: (exe, args) => { got = { exe, args }; return { status: 0, stdout: '  ntn_abc\r\n', stderr: '' }; } });
  assert.equal(t, 'ntn_abc');
  assert.ok(got.args.includes('-NoProfile') && got.args.includes('-NonInteractive') && got.args.includes('-File'));
  // T-4: 実行ポリシーで止まらないよう -ExecutionPolicy Bypass を付ける（-File の前）
  assert.equal(got.args[got.args.indexOf('-ExecutionPolicy') + 1], 'Bypass');
  assert.ok(got.args.indexOf('-ExecutionPolicy') < got.args.indexOf('-File'));
  assert.equal(got.exe, 'powershell.exe');
  assert.ok(got.args.some((a) => /read-secret\.ps1$/.test(a)));
  assert.equal(got.args[got.args.indexOf('-Path') + 1], 'X:\\t.dpapi');
});
test('readNotionToken: 終了コード≠0・空の出力・起動できないは例外。誤りの文に標準出力（値）を入れない', () => {
  assert.throws(() => readNotionToken({ tokenFile: 'x', spawnSyncImpl: () => ({ status: 4, stdout: 'ntn_LEAK', stderr: 'decrypt failed' }) }), (e) => /4/.test(e.message) && !e.message.includes('ntn_LEAK'));
  assert.throws(() => readNotionToken({ tokenFile: 'x', spawnSyncImpl: () => ({ status: 0, stdout: '  \n', stderr: '' }) }));
  assert.throws(() => readNotionToken({ tokenFile: 'x', spawnSyncImpl: () => ({ error: new Error('ENOENT') }) }));
  assert.throws(() => readNotionToken({ spawnSyncImpl: () => ({ status: 0, stdout: 'x' }) }));
});
test('read-secret.ps1: ファイルが無ければ終了コード 2（別の場所を引数で渡す。秘密の場所は開かない）', () => {
  const missing = path.join(os.tmpdir(), 'p34-no-such-token.dpapi');
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(REPO, 'scripts', 'lib', 'read-secret.ps1'), '-Path', missing], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2);
  assert.equal((r.stdout || '').trim(), '');
});
test('read-secret.ps1: DPAPI の出力でないファイルは終了コード 4（復号できない）。値は出さない', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'p34-rs-')), 'bad.dpapi');
  fs.writeFileSync(f, 'this is not a dpapi blob');
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(REPO, 'scripts', 'lib', 'read-secret.ps1'), '-Path', f], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 4);
  assert.ok(!(r.stdout + r.stderr).includes('this is not a dpapi blob'));
});
test('read-secret.ps1: 空のファイルは終了コード 3', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'p34-rs-')), 'empty.dpapi');
  fs.writeFileSync(f, '');
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(REPO, 'scripts', 'lib', 'read-secret.ps1'), '-Path', f], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 3);
});
test('read-secret.ps1: 保存して読み戻す（ConvertFrom-SecureString で保存 → 値が戻る。この PC・このユーザー。試しの別の場所）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-rs-'));
  const f = path.join(dir, 'ok.dpapi');
  const mk = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `$s = ConvertTo-SecureString 'dummy-not-a-real-token-123' -AsPlainText -Force; ConvertFrom-SecureString $s | Set-Content -LiteralPath '${f}'`], { encoding: 'utf8', timeout: 60000 });
  assert.equal(mk.status, 0, mk.stderr);
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(REPO, 'scripts', 'lib', 'read-secret.ps1'), '-Path', f], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'dummy-not-a-real-token-123');
});

// ---- 引数・CLI ----
test('parseArgs: 既定のデータソースは docs/06 の2.3 の ID。--dry-run・--check・--state-dir', () => {
  const o = parseArgs(['--dry-run', '--state-dir', 'X:\\s']);
  assert.equal(o.dryRun, true);
  assert.equal(o.dataSourceId, '7949c589-2ebd-4419-be83-30c123be7fec');
  assert.throws(() => parseArgs(['--no-such-option']));
});
test('watch.mjs: 知らない引数は終了コード 2', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'watch', 'watch.mjs'), '--no-such-option'], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 2);
});
test('watch.mjs: builderRepo が未設定・台帳が読めなければ終了コード 2（動けない）。差し替えの場所を渡して本物の LOCALAPPDATA を開かない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-cli-'));
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'watch', 'watch.mjs'), '--builder-repo', path.join(dir, 'nope'), '--state-dir', path.join(dir, 's'), '--install-root', dir, '--dry-run', '--quiet'], { cwd: REPO, encoding: 'utf8', timeout: 30000, env: { ...process.env, LOCALAPPDATA: dir } });
  assert.equal(r.status, 2);
});
