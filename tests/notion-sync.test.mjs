// notion-sync（extensions-src/notion-sync/src/*.mts）の単体テスト。仕様は docs/05 の2・3・5・6・8・9節。
// 入口の名前は tasks/2026-11-14-p4-notion-sync/notion-sync-design.md の5節。期待値は docs から書いた。
// Notion は、このファイルの中の自前の代役（本物の上限の 2000 文字・100 要素・100 個を検査する）に差し替える。
// 置き場所: 許可の範囲では tests/ に置く（extensions-src/*/test/ にも書けるが、run-all.mjs に入るのでここにした）。
// Run: node --test tests/notion-sync.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalize, hashText, splitText, toRichText, fromRichText, detectEol, toLocalText, TooLargeError } from '../extensions-src/notion-sync/src/text.mts';
import { decide, decideAll } from '../extensions-src/notion-sync/src/decide.mts';
import { stripIgnored, mergeIgnored, pickIgnored, jsoncErrors, normalizeIgnoredKeys } from '../extensions-src/notion-sync/src/settings-filter.mts';
import { parseManifest, serializeManifest, nextManifest, emptyManifest, ManifestError } from '../extensions-src/notion-sync/src/manifest.mts';
import { isSyncableName, normalizePageId, compareNames } from '../extensions-src/notion-sync/src/names.mts';
import { createNotionClient, retryDelayMs, chunkForAppend, countElements, NetworkError, NotionApiError, PayloadTooLargeError } from '../extensions-src/notion-sync/src/notion-client.mts';
import { parsePage, headingBlock, codeBlock } from '../extensions-src/notion-sync/src/page.mts';
import { runSync, readDiffs, sharedForm } from '../extensions-src/notion-sync/src/sync.mts';
import { memoryFileStore, memoryBaseStore, userDirFromGlobalStorage, userDirFileStore } from '../extensions-src/notion-sync/src/stores.mts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const jsonOfLen = (n) => `{"k":"${'a'.repeat(n - 8)}"}`; // 長さがちょうど n の JSON

// ---- 2000 文字の境目での分割 (docs/05 の3節) ----
for (const n of [1, 1999, 2000]) {
  test(`splitText: ${n} 文字は1要素`, () => {
    const parts = splitText('a'.repeat(n));
    assert.deepEqual(parts.map((p) => p.length), [n]);
  });
}
test('splitText: 2001 文字は 2000 + 1 の2要素', () => assert.deepEqual(splitText('a'.repeat(2001)).map((p) => p.length), [2000, 1]));
test('splitText: 4000 文字は 2 要素、4001 文字は 3 要素（2000, 2000, 1）', () => {
  assert.deepEqual(splitText('a'.repeat(4000)).map((p) => p.length), [2000, 2000]);
  assert.deepEqual(splitText('a'.repeat(4001)).map((p) => p.length), [2000, 2000, 1]);
});
test('splitText: 空文字列は要素が無いか空の1要素（落ちない）', () => assert.ok(splitText('').every((p) => p === '') && splitText('').length <= 1));
test('splitText: つなぐと元に戻り、どの要素も 2000 文字以下（改行・日本語を含む）', () => {
  const text = Array.from({ length: 1500 }, (_, i) => `行${i}: 設定 "key${i}": ${i},\n`).join('');
  const parts = splitText(text);
  assert.equal(parts.join(''), text);
  assert.ok(parts.every((p) => p.length <= 2000));
});
test('splitText: 境目にサロゲートペアが来ても割らない', () => {
  const text = 'a'.repeat(1999) + '😀' + 'b'.repeat(10);
  const parts = splitText(text);
  assert.equal(parts.join(''), text);
  for (const p of parts) assert.ok(!/[\ud800-\udbff]$/.test(p) && !/^[\udc00-\udfff]/.test(p));
  assert.ok(parts.every((p) => p.length <= 2000));
});
test('splitText: max が小さすぎる・整数でないは RangeError', () => {
  assert.throws(() => splitText('abc', 1), RangeError);
  assert.throws(() => splitText('abc', 2.5), RangeError);
});
test('toRichText: {type:"text", text:{content}} の配列。各 2000 文字以下で、つなぐと元に戻る', () => {
  const rt = toRichText('x'.repeat(4500));
  assert.equal(rt.length, 3);
  for (const r of rt) {
    assert.equal(r.type, 'text');
    assert.ok(r.text.content.length <= 2000);
  }
  assert.equal(rt.map((r) => r.text.content).join(''), 'x'.repeat(4500));
});
test('toRichText: 200,000 文字は 100 要素で書ける。200,001 文字は TooLargeError', () => {
  assert.equal(toRichText('y'.repeat(200000)).length, 100);
  assert.throws(() => toRichText('y'.repeat(200001)), TooLargeError);
});
test('fromRichText: toRichText の逆。配列でなければ空', () => {
  const t = 'ab'.repeat(3000);
  assert.equal(fromRichText(toRichText(t)), t);
  assert.equal(fromRichText(null), '');
  assert.equal(fromRichText('x'), '');
});
test('canonicalize・hashText: BOM を外し、CRLF・CR を LF にし、末尾の空白と改行を落とす。CRLF と LF で同じ SHA-256', () => {
  assert.equal(canonicalize('\ufeffa\r\nb\rc\n\n  '), 'a\nb\nc');
  assert.equal(hashText('a\r\nb\r\n'), hashText('a\nb'));
  assert.equal(hashText('abc'), sha('abc'));
  assert.match(hashText(''), /^[0-9a-f]{64}$/);
});
test('detectEol・toLocalText: CRLF が1つでもあれば CRLF。手元に書くときは末尾に改行を1つ付ける', () => {
  assert.equal(detectEol('a\r\nb'), '\r\n');
  assert.equal(detectEol('a\nb'), '\n');
  assert.equal(detectEol(null), null);
  assert.equal(toLocalText('a\nb', '\r\n'), 'a\r\nb\r\n');
  assert.equal(toLocalText('', '\n'), '');
});

// ---- 競合の3通り (docs/05 の6節) ----
test('decide: 手元が変わった・Notion は変わっていない → export（書き出す）', () => assert.equal(decide('L2', 'R1', { local: 'L1', remote: 'R1' }), 'export'));
test('decide: 手元は変わっていない・Notion が変わった → import（取り込む）', () => assert.equal(decide('L1', 'R2', { local: 'L1', remote: 'R1' }), 'import'));
test('decide: 両方変わって中身が違う → conflict（自動でマージしない）', () => assert.equal(decide('L2', 'R2', { local: 'L1', remote: 'R1' }), 'conflict'));
test('decide: どちらも変わっていない → none。両方変わって同じ中身 → converged', () => {
  assert.equal(decide('L1', 'R1', { local: 'L1', remote: 'R1' }), 'none');
  assert.equal(decide('X', 'X', { local: 'L1', remote: 'R1' }), 'converged');
});
test('decide: 基底が無い（初めて）: 手元だけ → export、Notion だけ → import、両方にあって違う → conflict', () => {
  assert.equal(decide('A', null, undefined), 'export');
  assert.equal(decide(null, 'B', undefined), 'import');
  assert.equal(decide('A', 'B', undefined), 'conflict');
});
test('decide: 手元で消した（null）・Notion は変わっていない → export（Notion からも消す）。Notion で消した → import', () => {
  assert.equal(decide(null, 'R1', { local: 'L1', remote: 'R1' }), 'export');
  assert.equal(decide('L1', null, { local: 'L1', remote: 'R1' }), 'import');
});
test('decideAll: 3つのどれかにある名前ごとに判断し、両方 null の名前は出さない', () => {
  const r = decideAll(new Map([['a', 'L']]), new Map([['b', 'R']]), { c: { local: null, remote: null } });
  assert.deepEqual(r.map((x) => x.name).sort(), ['a', 'b']);
  assert.equal(r.find((x) => x.name === 'a').decision, 'export');
  assert.equal(r.find((x) => x.name === 'b').decision, 'import');
});

// ---- ignoredSettings の保ち方 (docs/05 の5節) ----
const SETTINGS = `{
  // 手元のコメント
  "editor.fontSize": 14,
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "python.pythonPath": "C:\\\\py\\\\python.exe",
  "workbench.colorTheme": "Light Modern"
}
`;
const IGN = ['terminal.integrated.defaultProfile.windows', 'python.pythonPath'];
const parseJsonc = (t) => JSON.parse(t.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));

test('stripIgnored: ignoredSettings のキーを除き、残りのキー・値・コメントを保つ', () => {
  const out = stripIgnored(SETTINGS, IGN);
  assert.ok(!out.includes('terminal.integrated.defaultProfile.windows') && !out.includes('python.pythonPath'));
  assert.ok(out.includes('// 手元のコメント'));
  assert.deepEqual(parseJsonc(out), { 'editor.fontSize': 14, 'workbench.colorTheme': 'Light Modern' });
});
test('stripIgnored: keys が空・当てはまるキーが無いときは中身を変えない（canonicalize だけ）', () => {
  assert.equal(stripIgnored(SETTINGS, []), canonicalize(SETTINGS));
  assert.equal(stripIgnored(SETTINGS, ['no.such.key']), canonicalize(SETTINGS));
});
test('stripIgnored: 前方一致するだけの別のキーは除かない。入れ子の同名キーも除かない（最上位だけ）', () => {
  assert.deepEqual(parseJsonc(stripIgnored('{ "a.b": 1, "a.b.c": 2 }', ['a.b'])), { 'a.b.c': 2 });
  assert.deepEqual(parseJsonc(stripIgnored('{ "x": { "a.b": 1 }, "a.b": 2 }', ['a.b'])), { x: { 'a.b': 1 } });
});
test('stripIgnored: 末尾のカンマ・コメントがあるファイルでも壊さない。空の settings でも落ちない', () => {
  const t = '{\n  "a": 1, // 末尾コメント\n  "b": 2,\n}\n';
  assert.deepEqual(parseJsonc(stripIgnored(t, ['b'])), { a: 1 });
  assert.doesNotThrow(() => stripIgnored('', ['a']));
  assert.doesNotThrow(() => stripIgnored('{}', ['a']));
});
const REMOTE = '{\n  // Notion 側のコメント\n  "editor.fontSize": 18,\n  "workbench.colorTheme": "Dark Modern"\n}\n';
const LOCAL = '{\n  "editor.fontSize": 14,\n  "terminal.integrated.defaultProfile.windows": "Git Bash",\n  "python.pythonPath": "D:\\\\py\\\\python.exe"\n}\n';
test('mergeIgnored: ignoredSettings のキーは手元の値を残し、それ以外は Notion の値になる', () => {
  const out = parseJsonc(mergeIgnored(REMOTE, LOCAL, IGN));
  assert.equal(out['terminal.integrated.defaultProfile.windows'], 'Git Bash');
  assert.equal(out['python.pythonPath'], 'D:\\py\\python.exe');
  assert.equal(out['editor.fontSize'], 18);
  assert.equal(out['workbench.colorTheme'], 'Dark Modern');
});
test('mergeIgnored: Notion 側のコメントを保つ', () => assert.ok(mergeIgnored(REMOTE, LOCAL, IGN).includes('// Notion 側のコメント')));
test('mergeIgnored: Notion に ignored のキーがあっても（手で書かれた）、手元の値で置く。手元に無ければ入れない', () => {
  const remote = '{\n  "editor.fontSize": 18,\n  "python.pythonPath": "/remote/python"\n}\n';
  const local = '{\n  "editor.fontSize": 14\n}\n';
  const out = parseJsonc(mergeIgnored(remote, local, ['python.pythonPath']));
  assert.ok(!('python.pythonPath' in out));
});
test('mergeIgnored: localText が null なら除くだけ。Notion が空なら {} から作る', () => {
  assert.ok(!('python.pythonPath' in parseJsonc(mergeIgnored('{"python.pythonPath":"x","a":1}', null, ['python.pythonPath']))));
  assert.equal(parseJsonc(mergeIgnored('', '{"python.pythonPath":"y"}', ['python.pythonPath']))['python.pythonPath'], 'y');
});
test('往復: 書き出して（stripIgnored）取り込み直す（mergeIgnored）と、手元の ignored の値は変わらない', () => {
  assert.deepEqual(parseJsonc(mergeIgnored(stripIgnored(LOCAL, IGN), LOCAL, IGN)), parseJsonc(LOCAL));
});
test('pickIgnored・jsoncErrors・normalizeIgnoredKeys', () => {
  assert.deepEqual(pickIgnored(LOCAL, IGN).map((x) => x.key), ['terminal.integrated.defaultProfile.windows', 'python.pythonPath']);
  assert.equal(jsoncErrors('{ "a": 1, // c\n "b": 2, }').length, 0, '末尾のカンマとコメントは誤りにしない');
  assert.ok(jsoncErrors('{ "a": ').length > 0);
  assert.deepEqual(normalizeIgnoredKeys(['a', '', 'a', 3, 'b']), ['a', 'b']);
  assert.deepEqual(normalizeIgnoredKeys('a'), []);
});

// ---- manifest・名前 (docs/05 の3節・2節) ----
test('parseManifest: docs/05 の3節の形を読む。schema が 1 でない・rev が負か小数・JSON でない・files がオブジェクトでないは ManifestError', () => {
  const ok = parseManifest('{"schema":1,"rev":42,"files":{"settings.json":{"sha256":"ab","updatedAt":"2026-11-12T09:00:00Z","machine":"DESKTOP-A"}}}');
  assert.equal(ok.rev, 42);
  for (const bad of ['{"schema":2,"rev":1,"files":{}}', '{"schema":1,"rev":-1,"files":{}}', '{"schema":1,"rev":1.5,"files":{}}', 'nope', '{"schema":1,"rev":1,"files":[]}']) {
    assert.throws(() => parseManifest(bad), ManifestError, bad);
  }
});
test('parseManifest: files の中の対象でない名前（../x.json など）は捨てる', () => {
  const m = parseManifest('{"schema":1,"rev":0,"files":{"../x.json":{"sha256":"a"},"settings.json":{"sha256":"b"}}}');
  assert.deepEqual(Object.keys(m.files), ['settings.json']);
});
test('nextManifest: rev を1つ上げ、書いたファイルの sha256・machine を置き換え、消したものを除き、ほかは前のまま', () => {
  const prev = { schema: 1, rev: 7, files: { 'settings.json': { sha256: 'old', updatedAt: '2026-01-01T00:00:00Z', machine: 'A' }, 'tasks.json': { sha256: 't', updatedAt: '2026-01-01T00:00:00Z', machine: 'A' } } };
  const m = nextManifest(prev, { written: [{ name: 'keybindings.json', sha256: 'k' }, { name: 'settings.json', sha256: 'new' }], deleted: ['tasks.json'] }, 'PC-B', new Date('2026-11-14T09:00:11.123Z'));
  assert.equal(m.rev, 8);
  assert.equal(m.files['settings.json'].sha256, 'new');
  assert.equal(m.files['settings.json'].machine, 'PC-B');
  assert.equal(m.files['keybindings.json'].updatedAt, '2026-11-14T09:00:11Z');
  assert.ok(!('tasks.json' in m.files));
  assert.equal(prev.rev, 7, '元を書き換えない');
});
test('serializeManifest: 字下げした JSON で、parseManifest で戻せる。files は settings → keybindings → snippets → tasks の順', () => {
  const m = nextManifest(emptyManifest(), { written: [{ name: 'tasks.json', sha256: 't' }, { name: 'snippets/b.json', sha256: 'b' }, { name: 'settings.json', sha256: 's' }, { name: 'keybindings.json', sha256: 'k' }, { name: 'snippets/a.json', sha256: 'a' }], deleted: [] }, 'PC', new Date());
  const t = serializeManifest(m);
  assert.ok(t.includes('\n'));
  assert.deepEqual(Object.keys(parseManifest(t).files), ['settings.json', 'keybindings.json', 'snippets/a.json', 'snippets/b.json', 'tasks.json']);
});
for (const p of ['settings.json', 'keybindings.json', 'tasks.json', 'snippets/python.json', 'snippets/my.code-snippets']) {
  test(`同期する: ${p}`, () => assert.equal(isSyncableName(p), true));
}
for (const p of ['extensions.json', 'argv.json', 'globalStorage/state.vscdb', '.vscode/settings.json', 'snippets/README.md', 'snippets/sub/a.json', 'snippets/a:b.json', 'snippets/.hidden.json', 'snippets/con.json', 'snippets/nul.json', 'snippets/com1.json', 'snippets/a.json ', 'snippets/a.json.', '../settings.json', 'snippets/../settings.json', '', 'History/a/entries.json', `snippets/${'a'.repeat(200)}.json`, 3, null]) {
  test(`同期しない: ${JSON.stringify(p)}`, () => assert.equal(isSyncableName(p), false));
}
test('同期しない: 区切りが \\ のものは同期の対象の名前として受け付けない（名前の区切りは /）', () => assert.equal(isSyncableName('snippets\\win.json'), false));
test('normalizePageId: 32 桁・ハイフン付き・URL（クエリと # を含む）→ 小文字のハイフン付き。読めなければ null', () => {
  const want = '0123abcd-4567-89ab-cdef-0123456789ab';
  assert.equal(normalizePageId('0123ABCD456789ABCDEF0123456789AB'), want);
  assert.equal(normalizePageId(want), want);
  assert.equal(normalizePageId('https://www.notion.so/Shuko-0123abcd456789abcdef0123456789ab?pvs=4#abc'), want);
  assert.equal(normalizePageId('not an id'), null);
  assert.equal(normalizePageId(''), null);
});
test('compareNames: settings → keybindings → snippets（名前順）→ tasks', () => {
  assert.deepEqual(['tasks.json', 'snippets/b.json', 'keybindings.json', 'snippets/a.json', 'settings.json'].sort(compareNames), ['settings.json', 'keybindings.json', 'snippets/a.json', 'snippets/b.json', 'tasks.json']);
});

// ---- ページの形 (docs/05 の3節) ----
const blk = (type, text, id) => ({ id, type, [type]: { rich_text: [{ type: 'text', text: { content: text } }], language: 'json' } });
test('parsePage: 見出しの文字列で manifest とファイルを見つける（見出し1〜3 のどれでもよい）。対象でない見出しは無視', () => {
  const p = parsePage([
    blk('heading_2', 'manifest', 'h0'), blk('code', '{"schema":1,"rev":3,"files":{}}', 'c0'),
    blk('heading_3', 'settings.json', 'h1'), blk('code', '{"a":1}', 'c1'),
    blk('heading_2', '自分のメモ', 'h2'), blk('code', 'x', 'c2'),
  ]);
  assert.equal(p.manifest.rev, 3);
  assert.equal(p.manifestCodeId, 'c0');
  assert.deepEqual([...p.files.keys()], ['settings.json']);
  assert.equal(p.files.get('settings.json').text, '{"a":1}');
  assert.equal(p.files.get('settings.json').codeId, 'c1');
});
test('parsePage: 見出しの直後がコードでなければ読み飛ばして警告。同じ名前が2つなら先を採って警告', () => {
  const p = parsePage([
    blk('heading_2', 'manifest', 'h0'), blk('code', '{"schema":1,"rev":0,"files":{}}', 'c0'),
    blk('heading_2', 'tasks.json', 'h1'), blk('paragraph', 'x', 'p1'),
    blk('heading_2', 'settings.json', 'h2'), blk('code', 'first', 'c2'),
    blk('heading_2', 'settings.json', 'h3'), blk('code', 'second', 'c3'),
  ]);
  assert.ok(!p.files.has('tasks.json'));
  assert.equal(p.files.get('settings.json').text, 'first');
  assert.equal(p.warnings.length, 2);
});
test('parsePage: manifest が壊れていれば ManifestError（ほかの PC の書いたものを壊さないため止める）', () => {
  assert.throws(() => parsePage([blk('heading_2', 'manifest', 'h0'), blk('code', 'broken', 'c0')]), ManifestError);
});
test('codeBlock: 言語は json、本文は 2000 文字ごとの rich_text。20 万文字を超えれば TooLargeError', () => {
  const b = codeBlock('a'.repeat(4001));
  assert.equal(b.type, 'code');
  assert.equal(b.code.language, 'json');
  assert.equal(b.code.rich_text.length, 3);
  assert.throws(() => codeBlock('a'.repeat(200001)), TooLargeError);
  assert.equal(headingBlock('settings.json').type, 'heading_2');
});

// ---- Notion API の呼び出し (docs/05 の8節・9節) ----
const resp = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const scripted = (list) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); const r = list.shift(); if (r instanceof Error) throw r; return r; }; f.calls = calls; return f; };
const mk = (f, sleeps = []) => createNotionClient({ token: 'secret-abc', fetch: f, sleep: async (ms) => sleeps.push(ms), minIntervalMs: 0 });

test('createNotionClient: ヘッダは Authorization・Notion-Version 2025-09-03。宛先は api.notion.com だけ', async () => {
  const f = scripted([resp(200, { results: [], has_more: false })]);
  await mk(f).listChildren('page-1');
  const c = f.calls[0];
  assert.equal(new URL(c.url).host, 'api.notion.com');
  assert.equal(c.init.headers['Notion-Version'], '2025-09-03');
  assert.equal(c.init.headers.Authorization, 'Bearer secret-abc');
  assert.equal(c.init.method, 'GET');
  assert.ok(!c.url.includes('secret-abc'));
});
test('createNotionClient: listChildren は has_more の間ページ送りをたどって全部返す', async () => {
  const f = scripted([resp(200, { results: [{ id: 'a' }], has_more: true, next_cursor: 'cur1' }), resp(200, { results: [{ id: 'b' }], has_more: false })]);
  const r = await mk(f).listChildren('p');
  assert.deepEqual(r.map((b) => b.id), ['a', 'b']);
  assert.match(f.calls[1].url, /start_cursor=cur1/);
});
test('createNotionClient: updateCode は PATCH /blocks/{id} に code の rich_text と language を送る。appendChildren は PATCH /blocks/{id}/children', async () => {
  const f = scripted([resp(200, { id: 'b1', type: 'code' }), resp(200, { results: [{ id: 'n1', type: 'code' }] })]);
  const api = mk(f);
  await api.updateCode('b1', [{ type: 'text', text: { content: 'x' } }]);
  assert.equal(f.calls[0].init.method, 'PATCH');
  assert.match(f.calls[0].url, /\/v1\/blocks\/b1$/);
  assert.deepEqual(JSON.parse(f.calls[0].init.body).code.language, 'json');
  const out = await api.appendChildren('p', [headingBlock('x')]);
  assert.match(f.calls[1].url, /\/v1\/blocks\/p\/children$/);
  assert.equal(out[0].id, 'n1');
});
test('createNotionClient: 429 は Retry-After の秒数だけ待ってやり直す。529 も同じ', async () => {
  for (const status of [429, 529]) {
    const f = scripted([resp(status, { code: 'rate_limited' }, { 'Retry-After': '2' }), resp(200, { id: 'b' })]);
    const sleeps = [];
    const r = await mk(f, sleeps).getBlock('b');
    assert.equal(r.id, 'b');
    assert.deepEqual(sleeps, [2000], String(status));
    assert.equal(f.calls.length, 2);
  }
});
test('createNotionClient: 429 が続けば回数の上限（maxRetries）で諦めて NotionApiError。無限に待たない', async () => {
  const f = scripted(Array.from({ length: 50 }, () => resp(429, { code: 'rate_limited', message: 'slow' }, { 'Retry-After': '1' })));
  await assert.rejects(createNotionClient({ token: 't', fetch: f, sleep: async () => {}, minIntervalMs: 0, maxRetries: 3 }).getBlock('b'), (e) => e instanceof NotionApiError && e.status === 429);
  assert.ok(f.calls.length <= 5, `${f.calls.length} 回`);
});
test('createNotionClient: 400・404 は再試行しない（NotionApiError。文にトークンを入れない）', async () => {
  for (const s of [400, 404]) {
    const f = scripted([resp(s, { code: 'x', message: 'm' }), resp(200, {})]);
    await assert.rejects(mk(f).getBlock('b'), (e) => e instanceof NotionApiError && e.status === s && !e.message.includes('secret-abc'));
    assert.equal(f.calls.length, 1, String(s));
  }
});
test('createNotionClient: fetch の失敗は NetworkError（トークンを入れない）', async () => {
  await assert.rejects(mk(scripted([new Error('ECONNRESET')])).getBlock('b'), (e) => e instanceof NetworkError && !e.message.includes('secret-abc'));
});
test('createNotionClient: appendChildren は 100 個を超えれば送らずに例外。500,000 バイトを超える本文は PayloadTooLargeError', async () => {
  const f = scripted([resp(200, { results: [] })]);
  await assert.rejects(mk(f).appendChildren('p', Array.from({ length: 101 }, () => headingBlock('settings.json'))));
  assert.equal(f.calls.length, 0);
  const big = [{ type: 'code', code: { rich_text: [{ type: 'text', text: { content: 'x'.repeat(600000) } }], language: 'json' } }];
  await assert.rejects(mk(scripted([resp(200, {})])).updateCode('b', big[0].code.rich_text), PayloadTooLargeError);
});
test('createNotionClient: トークンが空なら作れない', () => assert.throws(() => createNotionClient({ token: '', fetch: async () => resp(200) })));
test('createNotionClient: 呼び出しの間を minIntervalMs 以上空ける（平均 3 回/秒）', async () => {
  let t = 0;
  const sleeps = [];
  const f = scripted([resp(200, { id: 'a' }), resp(200, { id: 'b' }), resp(200, { id: 'c' })]);
  const api = createNotionClient({ token: 't', fetch: f, sleep: async (ms) => { sleeps.push(ms); t += ms; }, now: () => t, minIntervalMs: 350 });
  await api.getBlock('a');
  await api.getBlock('b');
  await api.getBlock('c');
  assert.ok(sleeps.length >= 2 && sleeps.every((s) => s > 0 && s <= 350), JSON.stringify(sleeps));
});
test('retryDelayMs: ("2",0)→2000、(null,0)→1000、(null,3)→8000、("120",0)→60000 に頭打ち', () => {
  assert.equal(retryDelayMs('2', 0), 2000);
  assert.equal(retryDelayMs(null, 0), 1000);
  assert.equal(retryDelayMs(null, 3), 8000);
  assert.equal(retryDelayMs('120', 0), 60000);
  assert.ok(retryDelayMs(null, 20) <= 30000);
});
test('chunkForAppend: 見出しとコードの組を離さず、100 個・要素 1000 に収まるよう分ける', () => {
  const g = (n) => [headingBlock(`snippets/${n}.json`), codeBlock('{}')];
  const groups = Array.from({ length: 70 }, (_, i) => g(i));
  const chunks = chunkForAppend(groups);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 100 && countElements(c) <= 1000);
    assert.equal(c.length % 2, 0);
    for (let i = 0; i < c.length; i += 2) assert.equal(c[i].type, 'heading_2'), assert.equal(c[i + 1].type, 'code');
  }
  assert.equal(chunks.flat().length, 140);
});

// ---- 同期の流れ（2台の PC と、自前の Notion の代役）----
class NotionPage {
  constructor() { this.blocks = []; this.n = 0; this.calls = []; this.hooks = {}; }
  check(rt, where) {
    assert.ok(Array.isArray(rt) && rt.length <= 100, `${where}: rich_text が 100 要素を超える`);
    for (const t of rt) assert.ok(t.text.content.length <= 2000, `${where}: text.content が 2000 文字を超える`);
  }
  api() {
    const self = this;
    const find = (id) => { const b = self.blocks.find((x) => x.id === id); if (!b) throw new NotionApiError(404, 'object_not_found', 'no', 'GET', id); return b; };
    return {
      async listChildren() { self.calls.push('list'); if (self.hooks.offline) throw new NetworkError('offline'); return structuredClone(self.blocks); },
      async getBlock(id) { self.calls.push('get'); self.hooks.onGet?.(self); return structuredClone(find(id)); },
      async updateCode(id, rt, lang = 'json') { self.calls.push('update'); self.check(rt, 'updateCode'); find(id).code = { rich_text: structuredClone(rt), language: lang }; return find(id); },
      async appendChildren(parent, children) {
        self.calls.push('append');
        assert.ok(children.length <= 100);
        const out = children.map((c) => { self.check(c[c.type].rich_text, 'append'); const b = structuredClone(c); b.id = `b${++self.n}`; self.blocks.push(b); return structuredClone(b); });
        return out;
      },
      async deleteBlock(id) { self.calls.push('delete'); const i = self.blocks.findIndex((x) => x.id === id); if (i >= 0) self.blocks.splice(i, 1); },
    };
  }
  text(name) {
    const i = this.blocks.findIndex((b) => b.type.startsWith('heading') && fromRichText(b[b.type].rich_text).trim() === name);
    return i < 0 ? null : fromRichText(this.blocks[i + 1].code.rich_text);
  }
  codeSizes(name) {
    const i = this.blocks.findIndex((b) => b.type.startsWith('heading') && fromRichText(b[b.type].rich_text).trim() === name);
    return this.blocks[i + 1].code.rich_text.map((t) => t.text.content.length);
  }
  setText(name, text) {
    const i = this.blocks.findIndex((b) => b.type.startsWith('heading') && fromRichText(b[b.type].rich_text).trim() === name);
    this.blocks[i + 1].code.rich_text = toRichText(text);
  }
  manifest() { return parseManifest(this.text('manifest')); }
}
const PAGE_ID = '0123abcd-4567-89ab-cdef-0123456789ab';
let clock = Date.parse('2026-11-14T09:00:00Z');
function pc(page, machine, files = {}, ignored = []) {
  const store = memoryFileStore(files);
  const baseStore = memoryBaseStore();
  const deps = { api: page.api(), store, baseStore, pageId: PAGE_ID, ignoredSettings: ignored, machine, now: () => new Date((clock += 1000)), defaultEol: '\r\n' };
  return { store, baseStore, deps, sync: (opts) => runSync(deps, opts), put: (n, t) => store.files.set(n, t) };
}

test('同期: 空のページに初めて書き出すと、manifest（rev 1）とファイルの見出し・コードができ、manifest の sha256 は本文の SHA-256', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'settings.json': '{\n  "editor.fontSize": 14\n}\n', 'tasks.json': '{"version":"2.0.0"}' });
  const r = await a.sync();
  assert.equal(r.status, 'synced');
  assert.deepEqual(r.exported.sort(), ['settings.json', 'tasks.json']);
  const m = page.manifest();
  assert.equal(m.rev, 1);
  assert.equal(m.files['settings.json'].sha256, sha(page.text('settings.json')));
  assert.equal(m.files['settings.json'].machine, 'PC-A');
  assert.equal(page.text('settings.json'), '{\n  "editor.fontSize": 14\n}', '本文は正規の形（末尾の改行なし）');
});
test('同期: 書き出しの順は ファイルのコードブロック → 最後に manifest（manifest が「書き終わった」印）', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'settings.json': '{"a":1}' });
  await a.sync();
  a.put('settings.json', '{"a":2}');
  const order = [];
  const api = page.api();
  const headingOf = (id) => {
    const i = page.blocks.findIndex((x) => x.id === id);
    const h = page.blocks[i - 1];
    return fromRichText(h[h.type].rich_text).trim();
  };
  const wrap = { ...api, async updateCode(id, rt, l) { order.push(headingOf(id)); return api.updateCode(id, rt, l); } };
  await runSync({ ...a.deps, api: wrap });
  assert.deepEqual(order, ['settings.json', 'manifest']);
});
test('同期: 2台目の PC が取り込む。手元の ignored の値は残り、改行は新しいファイルなら CRLF', async () => {
  const page = new NotionPage();
  const IGN2 = ['terminal.integrated.defaultProfile.windows'];
  const a = pc(page, 'PC-A', { 'settings.json': '{\n  "editor.fontSize": 14,\n  "terminal.integrated.defaultProfile.windows": "PowerShell"\n}\n', 'keybindings.json': '[]' }, IGN2);
  await a.sync();
  assert.ok(!page.text('settings.json').includes('terminal.integrated'), 'Notion には PC ごとの設定を書かない');
  const b = pc(page, 'PC-B', { 'settings.json': '{\n  "terminal.integrated.defaultProfile.windows": "Git Bash"\n}\n' }, IGN2);
  const r = await b.sync();
  assert.equal(r.status, 'conflict', '2台目の最初は settings.json が競合として見える（docs/05 6節。基底が無く、中身が違う）');
  const r2 = await b.sync({ force: { 'settings.json': 'remote' } });
  assert.equal(r2.status, 'synced');
  const s = parseJsonc(b.store.files.get('settings.json'));
  assert.equal(s['editor.fontSize'], 14);
  assert.equal(s['terminal.integrated.defaultProfile.windows'], 'Git Bash');
  assert.equal(b.store.files.get('keybindings.json'), '[]\r\n', '新しいファイルは CRLF');
});
test('同期: 競合の3通り（実際の流れ）。手元だけ変わった → 書き出す、Notion だけ変わった → 取り込む、両方変わった → 競合で何も書かない', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  const b = pc(page, 'PC-B');
  await b.sync();
  assert.equal(b.store.files.get('tasks.json'), '{"v":1}\r\n');
  // 手元だけ変わった
  a.put('tasks.json', '{"v":2}');
  assert.deepEqual((await a.sync()).exported, ['tasks.json']);
  assert.equal(page.text('tasks.json'), '{"v":2}');
  // Notion だけ変わった（B から見て）
  const rb = await b.sync();
  assert.deepEqual(rb.imported, ['tasks.json']);
  assert.equal(b.store.files.get('tasks.json'), '{"v":2}\r\n');
  // 両方変わった
  a.put('tasks.json', '{"v":3}');
  await a.sync();
  b.put('tasks.json', '{"v":"B"}');
  const before = JSON.stringify(page.blocks);
  const rc = await b.sync();
  assert.equal(rc.status, 'conflict');
  assert.equal(rc.conflicts[0].name, 'tasks.json');
  assert.equal(JSON.stringify(page.blocks), before, '競合では Notion に書かない');
  assert.equal(b.store.files.get('tasks.json'), '{"v":"B"}', '競合では手元を書き換えない');
  assert.deepEqual(rc.conflicts[0].local, '{"v":"B"}');
  assert.deepEqual(rc.conflicts[0].remote, '{"v":3}');
});
test('同期: 競合を「手元を採る」で解くと Notion が手元になり、「Notion を採る」で解くと手元が Notion になる', async () => {
  for (const choice of ['local', 'remote']) {
    const page = new NotionPage();
    const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
    await a.sync();
    const b = pc(page, 'PC-B');
    await b.sync();
    a.put('tasks.json', '{"v":"A"}');
    await a.sync();
    b.put('tasks.json', '{"v":"B"}');
    assert.equal((await b.sync()).status, 'conflict');
    const r = await b.sync({ force: { 'tasks.json': choice } });
    assert.equal(r.status, 'synced');
    if (choice === 'local') assert.equal(page.text('tasks.json'), '{"v":"B"}');
    else assert.equal(b.store.files.get('tasks.json').trim(), '{"v":"A"}');
    assert.equal((await b.sync()).status, 'synced', '解いたあとは競合が残らない');
  }
});
test('同期: 書き出すときは rev を1つ上げる。書き出す直前に rev が変わっていれば（ほかの PC が書いた）読み直してやり直し、最後は synced', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  assert.equal(page.manifest().rev, 1);
  a.put('tasks.json', '{"v":2}');
  let bumped = false;
  page.hooks.onGet = (p) => {
    if (bumped) return;
    bumped = true;
    const m = p.manifest();
    m.rev += 1;
    p.setText('manifest', serializeManifest(m));
  };
  const r = await a.sync();
  assert.equal(r.status, 'synced');
  assert.equal(page.manifest().rev, 3, 'ほかの PC の rev 2 のうえに 3 を書く');
  assert.equal(page.text('tasks.json'), '{"v":2}');
});
test('同期: export は、手元が基底から変わっていなければ Notion を呼ばない（保存のたびに呼ばない）', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  const n = page.calls.length;
  const r = await a.sync({ mode: 'export' });
  assert.equal(r.contacted, false);
  assert.equal(page.calls.length, n);
});
test('同期: mode が import のときは書き出さず pending に入れ、export のときは取り込まない', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  const b = pc(page, 'PC-B');
  await b.sync();
  a.put('tasks.json', '{"v":2}');
  await a.sync();
  b.put('keybindings.json', '[1]');
  const ri = await b.sync({ mode: 'import' });
  assert.deepEqual(ri.imported, ['tasks.json']);
  assert.deepEqual(ri.pending, [{ name: 'keybindings.json', decision: 'export' }]);
  assert.ok(!page.text('keybindings.json'));
  a.put('tasks.json', '{"v":3}');
  await a.sync();
  const re = await b.sync({ mode: 'export' });
  assert.deepEqual(re.exported, ['keybindings.json']);
  assert.deepEqual(re.pending, [{ name: 'tasks.json', decision: 'import' }]);
  assert.equal(b.store.files.get('tasks.json'), '{"v":2}\r\n', 'export では取り込まない');
});
test('同期: 2000 文字の境目。ちょうど 2000 文字は1要素、2001 文字は 2000 + 1、4001 文字は 3 要素で書かれ、本文はそのまま戻る', async () => {
  for (const [n, sizes] of [[1999, [1999]], [2000, [2000]], [2001, [2000, 1]], [4001, [2000, 2000, 1]]]) {
    const page = new NotionPage();
    const text = jsonOfLen(n);
    const a = pc(page, 'PC-A', { 'tasks.json': text });
    const r = await a.sync();
    assert.equal(r.status, 'synced', `${n}: ${r.error}`);
    assert.deepEqual(page.codeSizes('tasks.json'), sizes, String(n));
    assert.equal(page.text('tasks.json'), text);
    const b = pc(page, 'PC-B');
    await b.sync();
    assert.equal(b.store.files.get('tasks.json').trim(), text, `${n} の往復`);
  }
});
test('同期: 1ファイルが 200,000 文字を超えれば何も書かずに error（ほかのファイルも書かない）', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': jsonOfLen(200001), 'keybindings.json': '[]' });
  const r = await a.sync();
  assert.equal(r.status, 'error');
  assert.match(r.error, /tasks\.json/);
  assert.equal(page.blocks.length, 0);
  const ok = pc(new NotionPage(), 'PC-A', { 'tasks.json': jsonOfLen(200000) });
  assert.equal((await ok.sync()).status, 'synced', '200,000 文字ちょうどは書ける');
});
test('同期: ignored のキーは Notion に書かれず、手元の値のまま変わらない。ignored の値だけが変わっても書き出さない', async () => {
  const page = new NotionPage();
  const IGN2 = ['python.pythonPath'];
  const a = pc(page, 'PC-A', { 'settings.json': '{\n  "a": 1,\n  "python.pythonPath": "x"\n}\n' }, IGN2);
  await a.sync();
  const before = page.manifest().rev;
  a.put('settings.json', '{\n  "a": 1,\n  "python.pythonPath": "changed"\n}\n');
  const r = await a.sync({ mode: 'export' });
  assert.equal(r.contacted, false);
  assert.equal(page.manifest().rev, before);
});
test('同期: JSONC の構文の誤りがあるファイルは扱わず（skipped）、Notion を壊さない', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'settings.json': '{ "a": ', 'tasks.json': '{"v":1}' });
  const r = await a.sync();
  assert.deepEqual(r.skipped.map((s) => s.name), ['settings.json']);
  assert.deepEqual(r.exported, ['tasks.json']);
  assert.ok(!page.text('settings.json'));
});
test('同期: 手元で消したファイルは Notion から消え、Notion で消されたファイルは手元から消える', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}', 'keybindings.json': '[]' });
  await a.sync();
  const b = pc(page, 'PC-B');
  await b.sync();
  a.store.files.delete('keybindings.json');
  const ra = await a.sync();
  assert.deepEqual(ra.deletedRemote, ['keybindings.json']);
  assert.ok(!page.text('keybindings.json'));
  assert.ok(!('keybindings.json' in page.manifest().files));
  const rb = await b.sync();
  assert.deepEqual(rb.deletedLocal, ['keybindings.json']);
  assert.ok(!b.store.files.has('keybindings.json'));
});
test('同期: Notion で本文を手で直すと「Notion だけが変わった」として取り込み、manifest との不一致を警告する', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  page.setText('tasks.json', '{"v":"hand-edited"}');
  const r = await a.sync();
  assert.deepEqual(r.imported, ['tasks.json']);
  assert.ok(r.warnings.some((w) => /manifest/.test(w)));
  assert.equal(a.store.files.get('tasks.json').trim(), '{"v":"hand-edited"}');
});
test('同期: ネットワークが使えなければ offline（例外にせず、手元を壊さない）', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  page.hooks.offline = true;
  const r = await a.sync();
  assert.equal(r.status, 'offline');
  assert.equal(a.store.files.get('tasks.json'), '{"v":1}');
  page.hooks.offline = false;
  assert.equal((await a.sync()).status, 'synced', '次のきっかけでやり直せる');
});
test('同期: manifest が壊れたページには書かない（error）。ファイルの見出しがあって manifest が無いときも止める', async () => {
  const page = new NotionPage();
  page.blocks.push({ id: 'h', type: 'heading_2', heading_2: { rich_text: toRichText('manifest') } }, { id: 'c', type: 'code', code: { rich_text: toRichText('broken'), language: 'json' } });
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  const n = page.blocks.length;
  assert.equal((await a.sync()).status, 'error');
  assert.equal(page.blocks.length, n);
  const page2 = new NotionPage();
  page2.blocks.push({ id: 'h', type: 'heading_2', heading_2: { rich_text: toRichText('tasks.json') } }, { id: 'c', type: 'code', code: { rich_text: toRichText('{}'), language: 'json' } });
  assert.equal((await pc(page2, 'PC-A', { 'tasks.json': '{"v":1}' }).sync()).status, 'error');
});
test('同期: ページを変えたら基底は使わない（別のページの基底で判断しない）', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  await a.sync();
  const other = new NotionPage();
  const a2 = { ...a.deps, api: other.api(), pageId: 'ffffabcd-4567-89ab-cdef-0123456789ab' };
  const r = await runSync(a2);
  assert.deepEqual(r.exported, ['tasks.json']);
});
test('同期: トークンの値は結果・ログ・基底に出ない（トークンは API 側だけが持つ）', async () => {
  const page = new NotionPage();
  const logs = [];
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}' });
  a.deps.log = (m) => logs.push(m);
  const f = scripted([new Error('ECONNRESET')]);
  const api = createNotionClient({ token: 'tok-SECRET-123', fetch: f, sleep: async () => {}, minIntervalMs: 0 });
  const r = await runSync({ ...a.deps, api });
  assert.equal(r.status, 'offline');
  const dump = JSON.stringify([r, logs, a.baseStore.state]);
  assert.ok(!dump.includes('tok-SECRET-123'));
});
test('readDiffs: 手元と Notion で違うファイルだけを返し、何も書かない', async () => {
  const page = new NotionPage();
  const a = pc(page, 'PC-A', { 'tasks.json': '{"v":1}', 'keybindings.json': '[]' });
  await a.sync();
  a.put('tasks.json', '{"v":2}');
  const n = page.calls.filter((c) => c !== 'list' && c !== 'get').length;
  const d = await readDiffs(a.deps);
  assert.deepEqual(d.map((x) => x.name), ['tasks.json']);
  assert.equal(page.calls.filter((c) => c !== 'list' && c !== 'get').length, n);
});
test('sharedForm: settings.json だけ ignored を除く。ほかは canonicalize', () => {
  assert.ok(!sharedForm('settings.json', '{"a":1,"python.pythonPath":"x"}', ['python.pythonPath']).includes('pythonPath'));
  assert.equal(sharedForm('tasks.json', '{"python.pythonPath":"x"}\r\n', ['python.pythonPath']), '{"python.pythonPath":"x"}');
});

// ---- 手元のファイルの置き場所 (docs/05 の2節) ----
test('userDirFromGlobalStorage: globalStorageUri の2つ上が User フォルダ', () => {
  assert.equal(userDirFromGlobalStorage(path.join('C:', 'u', 'User', 'globalStorage', 'shuko.notion-sync')), path.join('C:', 'u', 'User'));
});
test('userDirFileStore: 同期の対象だけを list し、対象でない名前・User の外へ出る名前の書き込みは例外。write は途中のファイルを残さない', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p34-user-'));
  fs.mkdirSync(path.join(dir, 'snippets'));
  fs.mkdirSync(path.join(dir, 'globalStorage'));
  for (const f of ['settings.json', 'keybindings.json', 'argv.json', 'snippets/a.json', 'snippets/b.code-snippets', 'snippets/README.md', 'globalStorage/state.vscdb']) fs.writeFileSync(path.join(dir, f), 'x');
  const s = userDirFileStore(dir);
  assert.deepEqual((await s.list()).sort(), ['keybindings.json', 'settings.json', 'snippets/a.json', 'snippets/b.code-snippets']);
  assert.equal(await s.read('tasks.json'), null);
  await s.write('tasks.json', '{}');
  assert.equal(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8'), '{}');
  assert.ok(!fs.existsSync(path.join(dir, 'tasks.json.notion-sync.tmp')));
  await assert.rejects(s.write('argv.json', 'x'));
  await assert.rejects(s.write('../evil.json', 'x'));
  await assert.rejects(s.read('snippets/../../x.json'));
  await s.remove('tasks.json');
  await s.remove('tasks.json');
  assert.ok(!fs.existsSync(path.join(dir, 'tasks.json')));
});
