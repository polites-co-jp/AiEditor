// scripts/copy-verify.mjs（一覧のファイルだけを、元から写し先へバイトのまま写し、SHA-256 で照らす台本）のテスト。
// 仕様: scripts/copy-verify.mjs の冒頭の説明、tasks/2026-11-16-before-delete-c/handoff-notes-meng-tian.md の6節と R2-1（柵を配列で渡す形）、
//       tasks/2026-11-16-before-delete-c/copy-verify-ooka.md の「記録として伝える点」2つ（途中のフォルダのジャンクション・--out に柵が無い）。
// 背景: ユーザーの裁定（2026-11-16「写し方」）。C:\b から写すのはコマンドで行い、LLM の Read・Write では写さない（Read・Write で写したら、タブが落ちた）。
// 試しは <リポジトリ>\tmp\tests\ の下だけ（tests/build/helpers.mjs の makeSandbox）。C:\b には触れない。
//
// 【落ちる状態でよい検査】名前に「（見張り）」と付けた3件は、大岡越前守の知らせの2点を見張るもの。
//   台本は今、途中のフォルダのジャンクションを辿って柵の外へ書き、--out には柵が無い。直る（蒙恬）まで、この3件は落ちる。落ちるのは仕様の穴で、テストの誤りではない。
//   どう直すかは決めない: 台本の側で途中のフォルダを lstat で見て断る、--out を元の下・一覧の元と写し先に置けなくする、などが考えられる。
//   ここでは「柵の外に書かない」「元を壊さない」という結果だけを見る。
// Run: node --test tests/copy-verify.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox } from './build/helpers.mjs';
import { ArgError, ListError, copyVerify, isInside, parseArgs, sha256File, validateList } from '../scripts/copy-verify.mjs';

const SCRIPT = path.join(REPO, 'scripts', 'copy-verify.mjs');
let sb;
before(() => { sb = makeSandbox('tests-copyverify-'); });
after(() => removeSandbox(sb));

let n = 0;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };

/** 試しの入れ物: <sb>\case-N\{ from\, to\ }。from・to の絶対パスを返す。 */
function mk() {
  const base = path.join(sb, `case-${++n}`);
  const from = path.join(base, 'from');
  const to = path.join(base, 'to');
  fs.mkdirSync(from, { recursive: true });
  fs.mkdirSync(to, { recursive: true });
  return { base, from, to };
}

/** フォルダの木を { 相対パス: 'sha256:サイズ:更新時刻' } にする(フォルダも '<dir>')。 */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { out[rel] = '<dir>'; walk(p); } else { const st = fs.statSync(p); out[rel] = `${sha256File(p)}:${st.size}:${st.mtimeMs}`; }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

const listOf = (from, to, entries, extra = {}) => ({ fromRoot: from, toRoot: to, entries, ...extra });
const writeList = (base, list) => { const f = path.join(base, 'list.json'); fs.writeFileSync(f, JSON.stringify(list, null, 2)); return f; };
function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* 誤りのときは JSON が出ない */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}
const dropLink = (p) => { try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* 無い */ } } };
/** ジャンクションを作れなければ null(許可が無い環境)。 */
function junction(target, link) {
  try { fs.symlinkSync(target, link, 'junction'); return link; } catch { return null; }
}

// ===========================================================================
// 引数・部品
// ===========================================================================
test('parseArgs: --list が必須。--out・--dry-run を読む。値の無い・知らない引数は ArgError', () => {
  assert.deepEqual(parseArgs(['--list', 'a.json']), { list: 'a.json', dryRun: false, out: null });
  assert.deepEqual(parseArgs(['--list', 'a.json', '--dry-run', '--out', 'o.json']), { list: 'a.json', dryRun: true, out: 'o.json' });
  assert.throws(() => parseArgs([]), ArgError);
  assert.throws(() => parseArgs(['--list']), ArgError);
  assert.throws(() => parseArgs(['--list', '--dry-run']), ArgError);
  assert.throws(() => parseArgs(['--list', 'a.json', '--bogus']), ArgError);
  assert.throws(() => parseArgs(['--list', 'a.json', '--out']), ArgError);
});

test('isInside: 根そのものと下は true。前方一致の偽装(evidence2)・外・大文字小文字の違いの扱い', () => {
  const r = path.join(sb, 'root');
  assert.equal(isInside(r, r), true);
  assert.equal(isInside(path.join(r, 'a', 'b.txt'), r), true);
  assert.equal(isInside(path.join(sb, 'root2', 'a.txt'), r), false);
  assert.equal(isInside(path.join(r, '..', 'x.txt'), r), false);
  assert.equal(isInside(path.join(r, 'A', 'B.TXT').toUpperCase(), r), true, 'Windows は大文字小文字を区別しない');
  assert.equal(isInside(r + path.sep, r), true, '末尾の区切りは無視する');
});

test('sha256File: ファイルのバイトの SHA-256', () => {
  const p = write(path.join(mk().base, 'x.bin'), Buffer.from([0, 1, 2, 255]));
  assert.equal(sha256File(p), sha(Buffer.from([0, 1, 2, 255])));
});

// ===========================================================================
// 3 バイトのまま写る
// ===========================================================================
const TRICKY = {
  'tabs.txt': Buffer.from('a\tb\t\tc\n\t\tindented\t\n'),
  'whitespace-only-lines.txt': Buffer.from('first\n   \n\t\n \t \n\nlast\n'),
  'crlf.txt': Buffer.from('one\r\ntwo\r\n\r\nthree\r\n'),
  'mixed-eol.txt': Buffer.from('lf\ncrlf\r\ncr\rlast'),
  'no-final-newline.txt': Buffer.from('line1\nline2 without newline at the end'),
  'trailing-spaces.txt': Buffer.from('trailing   \nspaces\t\n'),
  'bom-utf8.txt': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('bom\n')]),
  'japanese.txt': Buffer.from('日本語の行\tタブ\r\n最後の改行なし', 'utf8'),
  'binary.bin': Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256)),
  'empty.txt': Buffer.alloc(0),
  'json-with-tabs.json': Buffer.from('{\n\t"a": 1,\n\t"b": [\n\t\t2\n\t]\n}'),
};

test('バイトのまま写る: 空白だけの行・タブ・CRLF・最後の改行が無い・BOM・日本語・バイナリ・空ファイルが、1バイトも変わらない(Read・Write で写したらタブが落ちた)', () => {
  const { base, from, to } = mk();
  const entries = [];
  for (const [name, buf] of Object.entries(TRICKY)) {
    write(path.join(from, 'sub', name), buf);
    entries.push({ from: path.join(from, 'sub', name), to: path.join(to, 'sub', name), expectSha256: sha(buf) });
  }
  const r = cli(['--list', writeList(base, listOf(from, to, entries))]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.equal(r.json.counts.copied, entries.length);
  assert.equal(r.json.counts.match, entries.length);
  for (const [name, buf] of Object.entries(TRICKY)) {
    const got = fs.readFileSync(path.join(to, 'sub', name));
    assert.ok(Buffer.compare(got, buf) === 0, `${name}: バイトが変わった(元 ${buf.length} バイト・写し ${got.length} バイト)`);
  }
});

test('バイトのまま写る(関数): 写し先が元と違う内容で既にあれば、上書きして同じバイトになる。2回目は changed が偽', () => {
  const { from, to } = mk();
  const src = write(path.join(from, 'a.txt'), Buffer.from('new\tcontent\r\n'));
  const dst = write(path.join(to, 'a.txt'), Buffer.from('old content'));
  const checked = validateList(listOf(from, to, [{ from: src, to: dst }]));
  const r1 = copyVerify(checked);
  assert.equal(r1.result, 'ok');
  assert.equal(r1.entries[0].changed, true);
  assert.equal(r1.entries[0].destBefore.exists, true);
  assert.ok(Buffer.compare(fs.readFileSync(dst), fs.readFileSync(src)) === 0);
  const r2 = copyVerify(validateList(listOf(from, to, [{ from: src, to: dst }])));
  assert.equal(r2.entries[0].changed, false);
  assert.equal(r2.counts.unchanged, 1);
  assert.equal(r2.result, 'ok');
});

test('写し先のフォルダが無ければ作る(一覧の to の親だけ)', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'x');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: src, to: path.join(to, 'deep', 'er', 'a.txt') }]))]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(to, 'deep', 'er', 'a.txt'), 'utf8'), 'x');
});

// ===========================================================================
// 1 誤りのある一覧では何も書かない(写し先にも --out にも)。終了コード 2
// ===========================================================================
test('誤りのある一覧(1行だけ柵の外)では、正しい行も写さず、写し先・--out に何も作らない。終了コード 2', () => {
  const { base, from, to } = mk();
  const ok = write(path.join(from, 'ok.txt'), 'ok');
  const outside = write(path.join(base, 'outside-src', 'x.txt'), 'x');
  const before = snapshot(to);
  const outFile = path.join(base, 'result', 'out.json');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: ok, to: path.join(to, 'ok.txt') }, { from: outside, to: path.join(to, 'x.txt') }])), '--out', outFile]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /一覧の誤り/);
  assert.deepEqual(snapshot(to), before, '写し先に何かできた');
  assert.ok(!fs.existsSync(outFile), '--out ができた');
  assert.ok(!fs.existsSync(path.dirname(outFile)), '--out のフォルダができた');
});

const BAD_LISTS = [
  ['to が toRoot の外', (c) => [{ from: c.ok, to: path.join(c.base, 'elsewhere', 'a.txt') }], /toRoot の外/],
  ['from が fromRoot の外', (c) => [{ from: c.outsideSrc, to: path.join(c.to, 'a.txt') }], /fromRoot の外/],
  ['元が無い', (c) => [{ from: path.join(c.from, 'missing.txt'), to: path.join(c.to, 'a.txt') }], /元が無い/],
  ['元がフォルダ', (c) => [{ from: c.from, to: path.join(c.to, 'a.txt') }], /fromRoot の外|ファイルでない/],
  ['元がフォルダ(柵の下)', (c) => [{ from: c.subdir, to: path.join(c.to, 'a.txt') }], /ファイルでない/],
  ['to が同じ行が2つ', (c) => [{ from: c.ok, to: path.join(c.to, 'a.txt') }, { from: c.ok2, to: path.join(c.to, 'A.TXT') }], /同じ/],
  ['写し先がフォルダ', (c) => [{ from: c.ok, to: c.toSubdir }], /ファイルでない/],
  ['expectSha256 の形が違う', (c) => [{ from: c.ok, to: path.join(c.to, 'a.txt'), expectSha256: 'ABC' }], /64桁/],
  ['from が相対パス', (c) => [{ from: 'relative/a.txt', to: path.join(c.to, 'a.txt') }], /絶対パスでない/],
  ['from と to が文字列でない', () => [{ from: 1, to: null }], /文字列でない/],
];
for (const [name, entriesOf, re] of BAD_LISTS) {
  test(`誤りの一覧: ${name} → ListError(関数)・終了コード 2(コマンド)。何も書かない`, () => {
    const { base, from, to } = mk();
    const c = {
      base, from, to,
      ok: write(path.join(from, 'ok.txt'), 'ok'),
      ok2: write(path.join(from, 'ok2.txt'), 'ok2'),
      outsideSrc: write(path.join(base, 'outside-src', 'x.txt'), 'x'),
      subdir: path.join(from, 'adir'),
      toSubdir: path.join(to, 'adir'),
    };
    fs.mkdirSync(c.subdir);
    fs.mkdirSync(c.toSubdir);
    const list = listOf(from, to, entriesOf(c));
    assert.throws(() => validateList(list), (e) => e instanceof ListError && re.test(e.message), `${name}`);
    const before = snapshot(to);
    const outFile = path.join(base, 'out.json');
    const r = cli(['--list', writeList(base, list), '--out', outFile]);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.deepEqual(snapshot(to), before);
    assert.ok(!fs.existsSync(outFile));
  });
}

test('誤りの一覧: fromRoot が相対・toRoot が無い・entries が空・一覧が配列 → ListError', () => {
  const { from, to } = mk();
  const e = [{ from: path.join(from, 'a'), to: path.join(to, 'a') }];
  assert.throws(() => validateList({ fromRoot: 'rel/from', toRoot: to, entries: e }), ListError);
  assert.throws(() => validateList({ fromRoot: from, entries: e }), ListError);
  assert.throws(() => validateList({ fromRoot: from, toRoot: to, entries: [] }), ListError);
  assert.throws(() => validateList({ fromRoot: from, toRoot: to }), ListError);
  assert.throws(() => validateList([]), ListError);
  assert.throws(() => validateList(null), ListError);
});

test('誤りは全部まとめて message に並べる(1つ目だけで止まらない)', () => {
  const { from, to } = mk();
  const list = listOf(from, to, [{ from: path.join(from, 'm1'), to: path.join(to, 'a') }, { from: path.join(from, 'm2'), to: path.join(to, 'b') }]);
  try { validateList(list); assert.fail('投げない'); } catch (e) {
    assert.ok(e instanceof ListError);
    assert.match(e.message, /entries\[0\]/);
    assert.match(e.message, /entries\[1\]/);
  }
});

test('一覧のファイルが壊れた JSON・無い → 終了コード 2。引数が無い → 2', () => {
  const { base } = mk();
  const bad = path.join(base, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  assert.equal(cli(['--list', bad]).status, 2);
  assert.equal(cli(['--list', path.join(base, 'nope.json')]).status, 2);
  assert.equal(cli([]).status, 2);
  assert.equal(cli(['--bogus']).status, 2);
});

test('一覧の BOM は読み飛ばす(PowerShell で書いた JSON)', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const f = path.join(base, 'bom-list.json');
  fs.writeFileSync(f, '\uFEFF' + JSON.stringify(listOf(from, to, [{ from: src, to: path.join(to, 'a.txt') }])));
  assert.equal(cli(['--list', f]).status, 0);
});

// ===========================================================================
// 2 一覧の外のファイルが変わらない / 6 何も消さない
// ===========================================================================
test('一覧の外のファイルは変わらない(内容・更新時刻)。写し先の同じフォルダの別のファイル・別のフォルダ・元の別のファイル', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'listed.txt'), 'listed\t');
  write(path.join(from, 'unlisted-src.txt'), 'unlisted source');
  write(path.join(to, 'unlisted-dst.txt'), 'unlisted destination');
  write(path.join(to, 'sub', 'unlisted-deep.txt'), 'deep');
  const beforeTo = snapshot(to);
  const beforeFrom = snapshot(from);
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: src, to: path.join(to, 'listed.txt') }]))]);
  assert.equal(r.status, 0, r.stderr);
  const afterTo = snapshot(to);
  for (const [k, v] of Object.entries(beforeTo)) assert.equal(afterTo[k], v, `一覧の外が変わった: ${k}`);
  assert.deepEqual(Object.keys(afterTo).sort(), [...Object.keys(beforeTo), 'listed.txt'].sort(), '一覧の to のほかに増えた');
  assert.deepEqual(snapshot(from), beforeFrom, '元が変わった');
});

test('何も消さない: 元・一覧の外の写し先・一覧のファイルが、写した後も全部ある。一覧の to の同じ名前の別のフォルダも消えない', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'a');
  const b = write(path.join(from, 'b.txt'), 'b');
  write(path.join(to, 'stale-not-in-list.txt'), 'stale');
  write(path.join(to, 'old', 'x.txt'), 'x');
  const listFile = writeList(base, listOf(from, to, [{ from: a, to: path.join(to, 'a.txt') }, { from: b, to: path.join(to, 'b.txt') }]));
  const listBefore = fs.readFileSync(listFile);
  const r = cli(['--list', listFile]);
  assert.equal(r.status, 0, r.stderr);
  for (const p of [a, b, path.join(to, 'a.txt'), path.join(to, 'b.txt'), path.join(to, 'stale-not-in-list.txt'), path.join(to, 'old', 'x.txt'), listFile]) assert.ok(fs.existsSync(p), `消えた: ${p}`);
  assert.ok(Buffer.compare(fs.readFileSync(listFile), listBefore) === 0, '一覧のファイルが変わった');
});

test('何も消さない(失敗のとき): expectSha256 が違って写さなかった行でも、写し先の元のファイルは消えず変わらない', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'source');
  const dst = write(path.join(to, 'a.txt'), 'previous destination');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: a, to: dst, expectSha256: sha('something else') }]))]);
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(dst, 'utf8'), 'previous destination');
  assert.equal(fs.readFileSync(a, 'utf8'), 'source');
});

test('--dry-run は何も書かない(写し先も --out 以外も)。写すと何が変わるかだけを出す', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'new');
  const b = write(path.join(from, 'b.txt'), 'same');
  write(path.join(to, 'b.txt'), 'same');
  write(path.join(to, 'a.txt'), 'old');
  const before = snapshot(to);
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: a, to: path.join(to, 'a.txt') }, { from: b, to: path.join(to, 'b.txt') }])), '--dry-run']);
  assert.deepEqual(snapshot(to), before, 'dry-run が書いた');
  assert.equal(r.status, 1, '写し先が元と違うので、dry-run は 1');
  assert.equal(r.json.dryRun, true);
  assert.equal(r.json.entries[0].changed, true);
  assert.equal(r.json.entries[0].copied, false);
  assert.equal(r.json.entries[0].match, false);
  assert.equal(r.json.entries[1].changed, false);
  assert.equal(r.json.entries[1].match, true);
  assert.match(r.json.message, /dry run/);
});

test('--dry-run: 写し先が全部元と同じなら終了コード 0', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'same');
  write(path.join(to, 'a.txt'), 'same');
  assert.equal(cli(['--list', writeList(base, listOf(from, to, [{ from: a, to: path.join(to, 'a.txt') }])), '--dry-run']).status, 0);
});

test('--out: 結果の JSON を書く(標準出力と同じ)。entries の形(from・to・bytes・sourceSha256・destSha256・match)', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'abc\t');
  const out = path.join(base, 'res', 'out.json');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: a, to: path.join(to, 'a.txt') }])), '--out', out]);
  assert.equal(r.status, 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(j.counts, { entries: 1, copied: 1, unchanged: 0, match: 1, mismatch: 0, errors: 0 });
  const e = j.entries[0];
  assert.equal(e.bytes, 4);
  assert.equal(e.sourceSha256, sha('abc\t'));
  assert.equal(e.destSha256, sha('abc\t'));
  assert.equal(e.match, true);
  assert.equal(e.copied, true);
  assert.equal(j.result, 'ok');
  assert.deepEqual(JSON.parse(r.stdout).entries, j.entries);
});

// ===========================================================================
// 4 柵: .. で外へ出る・柵そのもの・重なり
// ===========================================================================
test('.. で柵の外へ出る to・from は外と数える(正規化してから照らす)。終了コード 2。何も書かない', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const outsideDst = path.join(base, 'escaped.txt');
  const viaDotDot = path.join(to, '..', 'escaped.txt');
  assert.throws(() => validateList(listOf(from, to, [{ from: src, to: viaDotDot }])), /toRoot の外/);
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: src, to: viaDotDot }]))]);
  assert.equal(r.status, 2);
  assert.ok(!fs.existsSync(outsideDst), '柵の外にファイルができた');
  const secret = write(path.join(base, 'secret.txt'), 's');
  assert.throws(() => validateList(listOf(from, to, [{ from: path.join(from, '..', 'secret.txt'), to: path.join(to, 's.txt') }])), /fromRoot の外/);
  assert.ok(fs.existsSync(secret));
});

test('.. を含んでいても、正規化した結果が柵の下なら通る(柵の中で行き来するだけ)', () => {
  const { from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const checked = validateList(listOf(from, to, [{ from: path.join(from, 'x', '..', 'a.txt'), to: path.join(to, 'y', '..', 'a.txt') }]));
  assert.equal(checked.entries[0].toAbs, path.join(to, 'a.txt'));
  assert.equal(checked.entries[0].fromAbs, src);
});

test('柵そのもの(根)は、元にも写し先にもできない', () => {
  const { from, to } = mk();
  write(path.join(from, 'a.txt'), 'a');
  assert.throws(() => validateList(listOf(from, to, [{ from: from, to: path.join(to, 'a.txt') }])), ListError);
  assert.throws(() => validateList(listOf(from, to, [{ from: path.join(from, 'a.txt'), to: to }])), /toRoot の外/);
});

test('前方一致の偽装(to-evil・from2)は外と数える', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const evilFrom = write(path.join(base, 'from2', 'a.txt'), 'evil');
  assert.throws(() => validateList(listOf(from, to, [{ from: src, to: path.join(base, 'to-evil', 'a.txt') }])), /toRoot の外/);
  assert.throws(() => validateList(listOf(from, to, [{ from: evilFrom, to: path.join(to, 'a.txt') }])), /fromRoot の外/);
});

test('fromRoot と toRoot の重なりで止まる: 同じ・to が from の下・from が to の下。何も書かない', () => {
  const { base, from } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const cases = [
    ['同じ', from, from],
    ['to が from の下', from, path.join(from, 'copies')],
    ['from が to の下', path.join(base, 'outer', 'inner'), path.join(base, 'outer')],
  ];
  for (const [name, f, t] of cases) {
    const fileUnder = path.join(f, 'a.txt');
    if (name === 'from が to の下') write(fileUnder, 'a');
    const list = listOf(f, t, [{ from: fileUnder, to: path.join(t, 'copy', 'a.txt') }]);
    assert.throws(() => validateList(list), (e) => e instanceof ListError && /重なる/.test(e.message), name);
    const r = cli(['--list', writeList(base, list)]);
    assert.equal(r.status, 2, `${name}: ${r.stdout}${r.stderr}`);
    assert.ok(!fs.existsSync(path.join(t, 'copy')), `${name}: 写し先ができた`);
  }
  assert.ok(fs.existsSync(src));
});

test('柵を配列で渡せる(R2-1): 行ごとに、from がどれかの fromRoot の下、to がどれかの toRoot の下にあればよい。どの柵の外でも誤り', () => {
  const { base } = mk();
  const f1 = path.join(base, 'f1');
  const f2 = path.join(base, 'f2');
  const t1 = path.join(base, 't1');
  const t2 = path.join(base, 't2');
  const a = write(path.join(f1, 'a.txt'), 'a');
  const b = write(path.join(f2, 'b.txt'), 'b');
  const stray = write(path.join(base, 'stray', 's.txt'), 's');
  const list = { fromRoot: [f1, f2], toRoot: [t1, t2], entries: [{ from: a, to: path.join(t1, 'a.txt') }, { from: b, to: path.join(t2, 'b.txt') }, { from: a, to: path.join(t2, 'a-again.txt') }] };
  const checked = validateList(list);
  assert.equal(checked.fromRoot.length, 2);
  assert.equal(checked.toRoot.length, 2);
  const r = cli(['--list', writeList(base, list)]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(t1, 'a.txt'), 'utf8'), 'a');
  assert.equal(fs.readFileSync(path.join(t2, 'b.txt'), 'utf8'), 'b');
  assert.equal(fs.readFileSync(path.join(t2, 'a-again.txt'), 'utf8'), 'a');
  assert.throws(() => validateList({ ...list, entries: [{ from: stray, to: path.join(t1, 's.txt') }] }), /fromRoot の外/);
  assert.throws(() => validateList({ ...list, entries: [{ from: a, to: path.join(base, 'stray', 'x.txt') }] }), /toRoot の外/);
  // 柵が1つなら、結果の fromRoot・toRoot は文字列のまま(1回目の出力の形)
  const one = validateList(listOf(f1, t1, [{ from: a, to: path.join(t1, 'o.txt') }]));
  assert.equal(typeof one.fromRoot, 'string');
  assert.equal(typeof one.toRoot, 'string');
});

test('柵の配列の中の重なりも止める: fromRoot のどれかと toRoot のどれかが重なれば誤り', () => {
  const { base } = mk();
  const f1 = path.join(base, 'f1');
  const t1 = path.join(base, 't1');
  const a = write(path.join(f1, 'a.txt'), 'a');
  const list = { fromRoot: [f1, path.join(base, 'f2')], toRoot: [t1, path.join(f1, 'inside')], entries: [{ from: a, to: path.join(t1, 'a.txt') }] };
  assert.throws(() => validateList(list), (e) => e instanceof ListError && /重なる/.test(e.message));
});

test('toRoot は相対パスでもよい(リポジトリの直下から)。baseDir で基準を変えられる', () => {
  const { base, from } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const checked = validateList({ fromRoot: from, toRoot: 'rel-to', entries: [{ from: src, to: 'rel-to/a.txt' }] }, { baseDir: base });
  assert.equal(checked.entries[0].toAbs, path.join(base, 'rel-to', 'a.txt'));
});

// ===========================================================================
// 5 expectSha256
// ===========================================================================
test('expectSha256 が元と違う行は写さず、終了コード 1。ほかの行は写す。error に理由', () => {
  const { base, from, to } = mk();
  const good = write(path.join(from, 'good.txt'), 'good\t');
  const bad = write(path.join(from, 'bad.txt'), 'bad');
  const r = cli(['--list', writeList(base, listOf(from, to, [
    { from: good, to: path.join(to, 'good.txt'), expectSha256: sha('good\t') },
    { from: bad, to: path.join(to, 'bad.txt'), expectSha256: sha('not the content') },
  ]))]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.json.result, 'error');
  assert.ok(fs.existsSync(path.join(to, 'good.txt')), '合う行は写す');
  assert.ok(!fs.existsSync(path.join(to, 'bad.txt')), '違う行は写さない');
  const [g, b] = r.json.entries;
  assert.equal(g.expectMatch, true);
  assert.equal(g.copied, true);
  assert.equal(b.expectMatch, false);
  assert.equal(b.copied, false);
  assert.match(b.error, /expectSha256/);
  assert.equal(r.json.counts.errors, 1);
  assert.equal(r.json.counts.copied, 1);
});

test('expectSha256 が全部合えば 0。指定しない行は照らさない(expectMatch が null)', () => {
  const { base, from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'a');
  const b = write(path.join(from, 'b.txt'), 'b');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: a, to: path.join(to, 'a.txt'), expectSha256: sha('a') }, { from: b, to: path.join(to, 'b.txt') }]))]);
  assert.equal(r.status, 0);
  assert.equal(r.json.entries[0].expectMatch, true);
  assert.equal(r.json.entries[1].expectMatch, null);
});

test('写した後に元が変わったら、一致にしない(copyVerify の元の取り直し)。元が読めなくなっても error にして、ほかの行は続ける', () => {
  const { from, to } = mk();
  const a = write(path.join(from, 'a.txt'), 'a');
  const b = write(path.join(from, 'b.txt'), 'b');
  const checked = validateList(listOf(from, to, [{ from: a, to: path.join(to, 'a.txt') }, { from: b, to: path.join(to, 'b.txt') }]));
  fs.rmSync(a); // 確かめた後で元が消えた
  const r = copyVerify(checked);
  assert.equal(r.result, 'error');
  assert.ok(r.entries[0].error);
  assert.equal(r.entries[1].match, true);
  assert.ok(fs.existsSync(path.join(to, 'b.txt')));
});

// ===========================================================================
// 7 大岡越前守の知らせの2点(見張り。今の台本では落ちる)
// ===========================================================================
test('（見張り）途中のフォルダがジャンクションなら、柵の外へ書かない: toRoot の下のジャンクションを通る to は断る(終了コード 2)。柵の外にファイルができない', (t) => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'payload');
  const outside = path.join(base, 'outside-target');
  fs.mkdirSync(outside);
  const link = junction(outside, path.join(to, 'jn'));
  if (!link) { t.skip('ジャンクションを作れない環境'); return; }
  try {
    const r = cli(['--list', writeList(base, listOf(from, to, [{ from: src, to: path.join(to, 'jn', 'a.txt') }]))]);
    assert.ok(!fs.existsSync(path.join(outside, 'a.txt')), `ジャンクションを辿って柵の外に書いた: ${path.join(outside, 'a.txt')}`);
    assert.equal(r.status, 2, `柵の外へ出る to を断らない(終了 ${r.status})`);
  } finally { dropLink(link); }
});

test('（見張り）元の途中のフォルダがジャンクションで柵の外を指すなら、読まない(終了コード 2)。柵の外のファイルを写し先に写さない', (t) => {
  const { base, from, to } = mk();
  const outsideSrc = path.join(base, 'outside-src');
  write(path.join(outsideSrc, 'secret.txt'), 'outside content');
  const link = junction(outsideSrc, path.join(from, 'jn'));
  if (!link) { t.skip('ジャンクションを作れない環境'); return; }
  try {
    const r = cli(['--list', writeList(base, listOf(from, to, [{ from: path.join(from, 'jn', 'secret.txt'), to: path.join(to, 'secret.txt') }]))]);
    assert.ok(!fs.existsSync(path.join(to, 'secret.txt')), '柵の外のファイルを写した');
    assert.equal(r.status, 2, `柵の外を指す元を断らない(終了 ${r.status})`);
  } finally { dropLink(link); }
});

test('（見張り）--out にも柵がある: 元の下・一覧の元や写し先と同じ場所は断る(終了コード 2)。元のファイルを結果の JSON で上書きしない', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'precious source');
  const list = listOf(from, to, [{ from: src, to: path.join(to, 'a.txt') }]);
  // --out が一覧の元と同じ場所 → 元が結果の JSON で上書きされる
  const r1 = cli(['--list', writeList(base, list), '--out', src]);
  assert.equal(fs.readFileSync(src, 'utf8'), 'precious source', `--out が元のファイルを上書きした(終了 ${r1.status})`);
  assert.equal(r1.status, 2, '--out が一覧の元を指すのを断らない');
  // --out が fromRoot の下(元のフォルダに新しいファイルを作る)
  const outInFrom = path.join(from, 'new-result.json');
  const r2 = cli(['--list', writeList(base, list), '--out', outInFrom]);
  assert.ok(!fs.existsSync(outInFrom), '--out が元のフォルダの下にファイルを作った');
  assert.equal(r2.status, 2, '--out が元の柵の下を指すのを断らない');
});

test('--out は元の柵の外・写し先と別の場所なら書ける(柵を付けても、ふつうの使い方は通る)', () => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const out = path.join(base, 'results', 'ok.json');
  const r = cli(['--list', writeList(base, listOf(from, to, [{ from: src, to: path.join(to, 'a.txt') }])), '--out', out]);
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(out));
});

// ===========================================================================
// リンク
// ===========================================================================
test('元がシンボリックリンクなら誤り(リンクを写さない)。作れない環境では飛ばす', (t) => {
  const { from, to } = mk();
  const real = write(path.join(from, 'real.txt'), 'real');
  const link = path.join(from, 'link.txt');
  try { fs.symlinkSync(real, link, 'file'); } catch { t.skip('シンボリックリンクを作れない環境'); return; }
  assert.throws(() => validateList(listOf(from, to, [{ from: link, to: path.join(to, 'link.txt') }])), /元がリンク/);
});

test('写し先のファイルがシンボリックリンクなら誤り(リンクの先を上書きしない)。作れない環境では飛ばす', (t) => {
  const { base, from, to } = mk();
  const src = write(path.join(from, 'a.txt'), 'a');
  const target = write(path.join(base, 'link-target.txt'), 'target content');
  const link = path.join(to, 'a.txt');
  try { fs.symlinkSync(target, link, 'file'); } catch { t.skip('シンボリックリンクを作れない環境'); return; }
  assert.throws(() => validateList(listOf(from, to, [{ from: src, to: link }])), /写し先がリンク/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'target content');
});
