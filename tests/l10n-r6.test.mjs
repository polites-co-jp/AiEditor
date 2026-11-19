// r6 で足された日本語パックまわりの部品のテスト（蒙恬の引き継ぎ r6-1〜r6-9）。
//   - thirdPartyNotice（ThirdPartyNotices.txt の本文。下の層の出典も書く）と、できたファイル
//   - take-in.mjs の l10nPlan・summarizeL10nCount（取り込みのビルドの後に未訳を数える）。数えが失敗しても止めない（warnings に1行）
//   - 公式の訳の誤り5件の上書き（上書きは計14件）
// Run: node --test tests/l10n-r6.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, makeSandbox, removeSandbox, runNode, writeFile } from './build/helpers.mjs';
import { listMaterials } from '../scripts/lib/take-in/records.mjs';
import { thirdPartyNotice, placeholderMismatch, validateAdded } from '../scripts/lib/l10n-ja.mjs';
// AIED_TAKEIN_MODULE に別のファイルを渡すと、take-in.mjs の代わりにそちらを読む（直す前の版を確かめるとき用）
const TI = process.env.AIED_TAKEIN_MODULE ? await import(pathToFileURL(path.resolve(process.env.AIED_TAKEIN_MODULE)).href) : await import('../scripts/take-in.mjs');
const { l10nPlan, summarizeL10nCount } = TI;

const PACK = path.join(REPO, 'extensions-src', 'language-pack-ja');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
let sb;
before(() => { sb = makeSandbox('tests-l10nr6-'); });
after(() => removeSandbox(sb));

// ---- thirdPartyNotice ----------------------------------------------------------------------------------------
const SRC = [
  { kind: 'vscode-loc', name: 'a', repo: 'microsoft/vscode-loc', commit: 'a'.repeat(40), date: '2026-10-23' },
  { kind: 'vscode-loc', name: 'b', repo: 'microsoft/vscode-loc', commit: 'b'.repeat(40), date: '2026-10-19' },
  { kind: 'vsix', name: 'c', id: 'MS-CEINTL.vscode-language-pack-ja', version: '1.131.0', download: 'https://open-vsx.org/x.vsix', sha256: 'c'.repeat(64), license: 'SEE MIT LICENSE IN LICENSE.md', repository: 'https://github.com/Microsoft/vscode-loc' },
];
const MIT = 'MIT License\n\nCopyright (c) Microsoft Corporation.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy';

test('thirdPartyNotice: 訳の元を勝つ順に番号つきで出す（vscode-loc は repo・commit・日付、MIT の写しの案内）', () => {
  const t = thirdPartyNotice(SRC, [{ sha256: 'd'.repeat(64), text: MIT }]);
  const i1 = t.indexOf(`1. microsoft/vscode-loc (https://github.com/microsoft/vscode-loc), commit ${'a'.repeat(40)}, files dated 2026-10-23.`);
  const i2 = t.indexOf(`2. microsoft/vscode-loc`);
  const i3 = t.indexOf('3. MS-CEINTL.vscode-language-pack-ja 1.131.0');
  assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, '1・2・3 の順');
  assert.match(t, /License: MIT/);
  assert.ok(t.startsWith('Sukuna language-pack-ja - Third Party Notices'));
});
test('thirdPartyNotice: vsix は URL・SHA-256・repository・license の文と、VSIX に LICENSE.md が無い旨', () => {
  const t = thirdPartyNotice(SRC, []);
  assert.ok(t.includes('from Open VSX (https://open-vsx.org/x.vsix), SHA-256 ' + 'c'.repeat(64)));
  assert.ok(t.includes('https://github.com/Microsoft/vscode-loc'));
  assert.ok(t.includes('SEE MIT LICENSE IN LICENSE.md'));
  assert.match(t, /VSIX contains no LICENSE\.md/);
});
test('thirdPartyNotice: 同じ SHA-256 の licenses は1つにまとめて写す。違えば別々に写す。BOM は取る', () => {
  const one = thirdPartyNotice(SRC, [{ sha256: 'd'.repeat(64), text: MIT }, { sha256: 'd'.repeat(64), text: MIT }]);
  assert.equal(one.split('Permission is hereby granted').length - 1, 1);
  const two = thirdPartyNotice(SRC, [{ sha256: 'd'.repeat(64), text: MIT }, { sha256: 'e'.repeat(64), text: `﻿${MIT} (other)` }]);
  assert.equal(two.split('Permission is hereby granted').length - 1, 2);
  assert.ok(!two.includes('﻿'));
});
test('thirdPartyNotice: licenses が空なら許諾の文は出ない。足した訳の置き場所（added/*.json）を書く。記録の無い項目・知らない kind でも落ちない', () => {
  const t = thirdPartyNotice(SRC, []);
  assert.ok(!t.includes('Permission is hereby granted'));
  assert.match(t, /added\/\*\.json/);
  const odd = thirdPartyNotice([{ kind: 'vsix', sha256: 'c'.repeat(64) }, { kind: 'other', name: 'x' }, {}], undefined);
  assert.match(odd, /\(not recorded\)/);
  assert.match(odd, /2\. x\./);
  assert.match(odd, /3\. \(unnamed source\)\./);
  assert.ok(odd.endsWith('\n'));
});
test('ThirdPartyNotices.txt（今のパック）: sources.json の訳の元を全部、勝つ順に書く。main の commit と古い Open VSX のパックを含み、MIT の文を1回だけ写す', () => {
  const cfg = readJson(path.join(PACK, 'sources.json'));
  const t = fs.readFileSync(path.join(PACK, 'ThirdPartyNotices.txt'), 'utf8');
  let at = -1;
  for (const s of cfg.sources) {
    const needle = s.kind === 'vscode-loc' ? s.commit : `${s.id} ${s.version}`;
    const i = t.indexOf(needle);
    assert.ok(i > at, `${s.name}: ${needle} が順に出る`);
    at = i;
  }
  assert.ok(t.includes('62d5443b'));
  assert.ok(t.includes('MS-CEINTL.vscode-language-pack-ja 1.131.0'));
  assert.equal(t.split('Permission is hereby granted').length - 1, 1, 'LICENSE.md は同じ SHA-256 なので1つ');
});

// ---- 公式の訳の誤り5件の上書き -------------------------------------------------------------------------------
const FIXES = [
  ['vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint', 'emptyTextEditorHintWithInlineChat'],
  ['vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint', 'emptyTextEditorHintWithoutInlineChat'],
  ['vs/workbench/contrib/files/browser/files.contribution', 'fileNestingPatterns'],
  ['vs/workbench/contrib/search/browser/anythingQuickAccess', 'openLinkToSide'],
  ['vs/workbench/contrib/workspace/browser/workspaceTrustEditor', 'workspaceTrustEditorHeaderActions'],
];
const added = readJson(path.join(PACK, 'added', '1.146.0.json'));
test('added/1.146.0.json: 上書き（override: true）は計14件。形は正しい', () => {
  assert.deepEqual(validateAdded(added), []);
  let n = 0;
  const walk = (o) => { for (const v of Object.values(o)) { if (v && typeof v === 'object') { if (v.override === true) n++; else if (!('en' in v)) walk(v); } } };
  walk(added.core);
  for (const e of Object.values(added.extensions ?? {})) for (const sec of ['package', 'bundle']) walk(e[sec] ?? {});
  assert.equal(n, 14);
});
test('公式の訳の誤り5件: 上書きで入っていて、印は英語と合い（強めた照らしでも null）、パックの束にその訳が入っている', () => {
  const main = readJson(path.join(PACK, 'dist', 'translations', 'main.i18n.json')).contents;
  for (const [mod, key] of FIXES) {
    const v = added.core[mod]?.[key];
    assert.ok(v, `${key}: 足した訳に無い`);
    assert.equal(v.override, true, `${key}: override`);
    assert.equal(placeholderMismatch(v.en, v.ja), null, `${key}: 印が合わない`);
    assert.equal(main[mod][key], v.ja, `${key}: 束の訳が上書きと違う`);
    assert.ok(/[぀-ヿ㐀-鿿]/.test(v.ja), `${key}: 日本語`);
  }
});
test('公式の訳の誤り5件: 直した所（空白・${capture}・LF・{0}）', () => {
  const g = (i) => added.core[FIXES[i][0]][FIXES[i][1]].ja;
  assert.match(g(0), /\]\] \(\{0\}\)/, '[[…]] の後に空白');
  assert.match(g(1), /\]\] \(\{0\}\)/);
  assert.ok(g(2).includes('${capture}') && !g(2).includes('$(capture)'), 'capture は設定の書き方のまま');
  assert.ok(!g(2).includes('\r'), 'CRLF を LF に');
  assert.ok(g(3).includes('({0})'), 'キーの表示 {0}');
  assert.match(g(4), /\]\(\{0\}\)/, 'リンクが切れていない（空白なし）');
});

// ---- l10nPlan -----------------------------------------------------------------------------------------------
const CTX = { buildRoot: path.join(sb ?? 'B', 'x'), label: '1.147.0-r1', recDir: path.join('R', 'take-in', '1.147.0-r1'), wt: path.join('W', 'wt') };
test('l10nPlan: 表は <buildRoot>\\take-in\\<label>\\l10n-strings.json、結果は <recDir>\\l10n-count.json', () => {
  const p = l10nPlan(CTX);
  assert.equal(p.strings, path.join(CTX.buildRoot, 'take-in', CTX.label, 'l10n-strings.json'));
  assert.equal(p.out, path.join(CTX.recDir, 'l10n-count.json'));
});
test('l10nPlan: extract は l10n-ja.mjs extract --app --worktree --label --out、cwd はリポジトリ。node で走らせる', () => {
  const p = l10nPlan(CTX, 'APP');
  assert.equal(p.extract.cmd, process.execPath);
  assert.equal(p.extract.cwd, REPO);
  assert.equal(path.basename(p.extract.args[0]), 'l10n-ja.mjs');
  assert.deepEqual(p.extract.args.slice(1), ['extract', '--app', 'APP', '--worktree', CTX.wt, '--label', CTX.label, '--out', p.strings]);
});
test('l10nPlan: count は --strings に同じ表、--pack に <app>\\extensions\\language-pack-ja（出力の中のパック）、--out に l10n-count.json', () => {
  const p = l10nPlan(CTX, 'APP');
  assert.equal(p.count.cmd, process.execPath);
  assert.equal(p.count.cwd, REPO);
  assert.deepEqual(p.count.args.slice(1), ['count', '--strings', p.strings, '--pack', path.join('APP', 'extensions', 'language-pack-ja'), '--out', p.out]);
});
test('l10nPlan: appDir を省くと <app> の見本の書き方（--dry-run の計画用）', () => {
  const p = l10nPlan(CTX);
  assert.equal(p.extract.args[p.extract.args.indexOf('--app') + 1], '<app>');
  assert.equal(p.count.args[p.count.args.indexOf('--pack') + 1], '<app>\\extensions\\language-pack-ja');
});

// ---- summarizeL10nCount ---------------------------------------------------------------------------------------
const OUT = (o = {}) => ({ result: 'ok', untranslated: 0, total: 15159, excluded: 5, byArea: { core: { total: 12334 } }, placeholderProblems: [], ...o });
test('summarizeL10nCount: 終了コード 0 は ok。件数・除外・byArea・placeholderProblems の数を写す', () => {
  const s = summarizeL10nCount(0, OUT());
  assert.deepEqual(s, { status: 'ok', exitCode: 0, result: 'ok', untranslated: 0, total: 15159, excluded: 5, byArea: { core: { total: 12334 } }, placeholderProblems: 0 });
});
test('summarizeL10nCount: 終了コード 5 は untranslated（未訳の数を残す）', () => {
  const s = summarizeL10nCount(5, OUT({ result: 'untranslated', untranslated: 7 }));
  assert.equal(s.status, 'untranslated');
  assert.equal(s.untranslated, 7);
  assert.equal(s.exitCode, 5);
});
test('summarizeL10nCount: result が placeholder なら、終了コードに関わらず failed。placeholderProblems は数', () => {
  const s = summarizeL10nCount(1, OUT({ result: 'placeholder', placeholderProblems: [{}, {}] }));
  assert.equal(s.status, 'failed');
  assert.equal(s.placeholderProblems, 2);
  assert.equal(summarizeL10nCount(0, OUT({ result: 'placeholder' })).status, 'failed');
  assert.equal(summarizeL10nCount(5, OUT({ result: 'placeholder' })).status, 'failed');
});
test('summarizeL10nCount: 0・5 以外の終了コードは failed', () => {
  for (const c of [1, 2, 3, 127, null]) assert.equal(summarizeL10nCount(c, OUT()).status, 'failed', String(c));
});
test('summarizeL10nCount: 結果のファイルが無いときは、終了コードによらず failed と理由（L2。5 でも failed）', () => {
  assert.deepEqual(summarizeL10nCount(0, null), { status: 'failed', exitCode: 0, reason: 'l10n-count.json が無い' });
  for (const c of [0, 1, 2, 5, 127, null]) {
    for (const o of [null, undefined]) {
      const s = summarizeL10nCount(c, o);
      assert.equal(s.status, 'failed', `exit ${c}`);
      assert.equal(s.exitCode, c);
      assert.equal(s.reason, 'l10n-count.json が無い');
      assert.ok(s.untranslated == null, '数を持たない');
    }
  }
});
test('summarizeL10nCount: 項目が欠けていても落ちない（null にする）', () => {
  const s = summarizeL10nCount(0, { });
  assert.equal(s.status, 'ok');
  assert.equal(s.untranslated, null);
  assert.equal(s.placeholderProblems, null);
  assert.equal(s.result, null);
});

// ---- take-in.mjs の流れ ----------------------------------------------------------------------------------------
const takeInSrc = fs.readFileSync(path.join(REPO, 'scripts', 'take-in.mjs'), 'utf8');
test('take-in.mjs: 数えが ok でなくても Stop しない。warnings に1行足し、採否は止めないと書く（ソースの構造の確かめ）', () => {
  const a = takeInSrc.indexOf('日本語パックの未訳を数える（手順 5 の後');
  const b = takeInSrc.indexOf('手順 6', a);
  assert.ok(a > 0 && b > a);
  const block = takeInSrc.slice(a, b);
  assert.ok(!/\bStop\b|throw /.test(block), '数えの失敗で止めない');
  assert.match(block, /ctx\.rec\.warnings\.push\(`日本語パック: \$\{l10n\.status\}/);
  assert.match(block, /l10n\.status !== "ok"/);
  assert.match(block, /採否は止めない/);
  assert.match(block, /ctx\.rec\.l10n = l10n/);
});
// ---- runL10nCount を実際に走らせる（模擬の版・模擬の記録。tmp\tests\ の下） -------------------------------------
// 本物の l10n-ja.mjs extract → count を、小さな模擬の版（out\nls.*.json と extensions\language-pack-ja だけ）に当てる。
const run = (...a) => {
  assert.equal(typeof TI.runL10nCount, 'function', 'take-in.mjs は runL10nCount を export する（テストから走らせるため）');
  return TI.runL10nCount(...a);
};
let seq = 0;
// 模擬の版。pack: 'ok' = ja の localizations あり（束は空）、'broken' = localizations 無し（count が出力の前に落ちる）、'none' = パック無し、
// nls: false = extract が落ちる
function fakeCtx({ pack = 'ok', nls = true } = {}) {
  const root = path.join(sb, `rc${++seq}`);
  const editorDir = path.join(root, 'VSCode');
  const app = path.join(editorDir, 'resources', 'app');
  writeFile(path.join(app, 'product.json'), JSON.stringify({ nameShort: 'Fake', applicationName: 'fake', version: '1.0.0' }));
  writeFile(path.join(app, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  if (nls) {
    writeFile(path.join(app, 'out', 'nls.keys.json'), JSON.stringify([['vs/fake/mod', ['k1', 'k2']]]));
    writeFile(path.join(app, 'out', 'nls.messages.json'), JSON.stringify(['One', 'Two']));
  }
  const pk = path.join(app, 'extensions', 'language-pack-ja');
  if (pack !== 'none') {
    const locs = pack === 'ok' ? [{ languageId: 'ja', translations: [{ id: 'vscode', path: './t.json' }] }] : [];
    writeFile(path.join(pk, 'package.json'), JSON.stringify({ name: 'language-pack-ja', publisher: 'x', contributes: { localizations: locs } }));
    writeFile(path.join(pk, 't.json'), JSON.stringify({ contents: {} }));
  }
  fs.mkdirSync(path.join(app, 'extensions'), { recursive: true });
  const recDir = path.join(root, 'rec');
  fs.mkdirSync(recDir, { recursive: true });
  return { ctx: { editorDir, buildRoot: path.join(root, 'b'), label: 'fake-r1', recDir, wt: '' }, outFile: path.join(recDir, 'l10n-count.json') };
}
const STALE = { result: 'ok', untranslated: 0, total: 99999, excluded: 0, byArea: { stale: true }, placeholderProblems: [] };

test('runL10nCount（走らせる）: 数えが終わると、その回の結果を返し、l10n-count.json に書く（模擬の版は未訳あり = 終了コード 5）', async () => {
  const { ctx, outFile } = fakeCtx();
  const r = await run(ctx);
  assert.equal(r.status, 'untranslated', JSON.stringify(r));
  assert.equal(r.exitCode, 5);
  assert.ok(r.untranslated >= 2, '模擬の 2 件は未訳');
  assert.ok(fs.existsSync(outFile));
  assert.equal(readJson(outFile).untranslated, r.untranslated, '返した数と書いた数が同じ');
  assert.ok(r.out.endsWith('l10n-count.json') && !path.isAbsolute(r.out));
  assert.ok(fs.existsSync(path.join(ctx.recDir, 'logs', 'l10n-extract.log')));
  assert.ok(fs.existsSync(path.join(ctx.recDir, 'logs', 'l10n-count.log')));
  assert.ok(fs.existsSync(path.join(ctx.buildRoot, 'take-in', ctx.label, 'l10n-strings.json')), '表は buildRoot の下');
});
test('runL10nCount（走らせる）: 前の回の l10n-count.json があっても、今回の数えの結果で置き換わる', async () => {
  const { ctx, outFile } = fakeCtx();
  writeFile(outFile, JSON.stringify(STALE));
  const r = await run(ctx);
  assert.equal(r.status, 'untranslated');
  assert.notEqual(r.total, 99999);
  assert.notEqual(readJson(outFile).total, 99999);
});
test('runL10nCount（走らせる）: 新しい版の形を読めない・パックが無い・extract が失敗でも、例外にせず failed を返す', async () => {
  const none = fakeCtx({ pack: 'none' });
  const r1 = await run(none.ctx);
  assert.equal(r1.status, 'failed');
  assert.match(r1.reason, /language-pack-ja が無い/);
  const noLayout = fakeCtx();
  const r2 = await run({ ...noLayout.ctx, editorDir: path.join(sb, 'no-such-editor') });
  assert.equal(r2.status, 'failed');
  assert.match(r2.reason, /新しい版の形を読めない/);
  const noNls = fakeCtx({ nls: false });
  const r3 = await run(noNls.ctx);
  assert.equal(r3.status, 'failed');
  assert.equal(r3.step, 'extract');
  assert.notEqual(r3.exitCode, 0);
  assert.ok(fs.existsSync(path.join(noNls.ctx.recDir, 'logs', 'l10n-extract.log')));
  assert.ok(!fs.existsSync(noNls.outFile), 'extract が落ちたら count は走らない');
});
test('runL10nCount（走らせる）: L1 count が出力を書く前に落ちても、前の回の l10n-count.json の古い数を写さない', async () => {
  const { ctx, outFile } = fakeCtx({ pack: 'broken' });
  writeFile(outFile, JSON.stringify(STALE));
  const r = await run(ctx);
  assert.equal(r.status, 'failed', JSON.stringify(r));
  assert.notEqual(r.exitCode, 0);
  assert.match(r.reason, /l10n-count\.json/, '理由を書く（言い回しは実装に任せる）');
  for (const k of ['result', 'untranslated', 'total', 'excluded', 'byArea', 'placeholderProblems']) assert.ok(r[k] == null, `${k} に古い値を写さない: ${JSON.stringify(r[k])}`);
  // 前の回のファイルは消さない（2026-11-17 の裁定）。残っていることを staleOutput で知らせる
  assert.equal(r.staleOutput, true, '前の回のファイルが残っている印');
  assert.ok(fs.existsSync(outFile), '前の回のファイルは消さない');
  assert.equal(readJson(outFile).total, 99999, '前の回のファイルは書き換えない');
});
test('runL10nCount（走らせる）: L1 古い出力が無く count が落ちたときも failed。staleOutput は付かない', async () => {
  const { ctx } = fakeCtx({ pack: 'broken' });
  const r = await run(ctx);
  assert.equal(r.status, 'failed');
  assert.match(r.reason, /l10n-count\.json/);
  assert.ok(!r.staleOutput);
});
test('runL10nCount（runner を模擬）: count が何も書かなければ、終了コード 0 でも古い出力を読まず failed（staleOutput）。書き換えれば読む', async () => {
  const { ctx, outFile } = fakeCtx();
  writeFile(outFile, JSON.stringify(STALE));
  const calls = [];
  const quiet = async (spec) => { calls.push(spec.args[1]); return { exitCode: 0, output: '' }; };
  const r = await TI.runL10nCount(ctx, { runner: quiet });
  assert.deepEqual(calls, ['extract', 'count'], 'extract → count の順に runner で走らせる');
  assert.equal(r.status, 'failed');
  assert.equal(r.staleOutput, true);
  assert.ok(r.untranslated == null && r.total == null && r.result == null, '古い数を写さない');
  // 同じ runner が、count のときにだけ出力を書き換える
  const writes = async (spec) => {
    if (spec.args[1] === 'count') writeFile(outFile, JSON.stringify({ result: 'ok', untranslated: 0, total: 12, excluded: 1, byArea: {}, placeholderProblems: [] }));
    return { exitCode: spec.args[1] === 'count' ? 0 : 0, output: '' };
  };
  const r2 = await TI.runL10nCount(ctx, { runner: writes });
  assert.equal(r2.status, 'ok');
  assert.equal(r2.total, 12);
  assert.ok(!r2.staleOutput);
});
test('fileMark・writtenSince: 無い→ある・時刻か大きさが変わった = 書かれた。同じ印・無いまま・消えた = 書かれていない', () => {
  assert.equal(typeof TI.fileMark, 'function');
  assert.equal(typeof TI.writtenSince, 'function');
  const f = path.join(sb, 'mark', 'x.json');
  const none = TI.fileMark(f);
  assert.equal(none.exists, false);
  assert.equal(TI.writtenSince(none, TI.fileMark(f)), false, '無いまま');
  writeFile(f, '{"a":1}');
  const m1 = TI.fileMark(f);
  assert.equal(TI.writtenSince(none, m1), true, '無い → ある');
  assert.equal(TI.writtenSince(m1, TI.fileMark(f)), false, '同じ印');
  writeFile(f, '{"a":12345}');
  assert.equal(TI.writtenSince(m1, TI.fileMark(f)), true, '大きさが変わった');
  fs.rmSync(f);
  assert.equal(TI.writtenSince(m1, TI.fileMark(f)), false, '消えた');
});

// ---- 続きからの数え直しと、判定役の材料（2026-11-17 の裁定。蒙恬が export する関数を想定して書いた） ----------------
// 想定した入口（実装が違う名前なら、曹参がテストの呼び方を合わせる）:
//   shouldCountL10n({ buildRec, ranBuild, recDir, prevL10n }) => boolean
//     buildRec.result === "ok" が前提。ranBuild（手順 5 を走らせた）か、recDir に l10n-count.json が無いか、prevL10n.status === "failed" のとき true
//   l10nMaterialSkip(l10n) => RegExp[]（listMaterials の skip に渡す。l10n.staleOutput が true のとき l10n-count.json を含む。ほかの除外は変えない）
test('shouldCountL10n: ビルドが ok のときだけ。手順 5 を走らせた回・出力が無い・前の記録が failed のときは数える。続きで前が ok・untranslated なら数えない', () => {
  assert.equal(typeof TI.shouldCountL10n, 'function', 'take-in.mjs は shouldCountL10n を export する（条件を振る舞いで見るため）');
  const withFile = path.join(sb, 'sc-with');
  const withoutFile = path.join(sb, 'sc-without');
  writeFile(path.join(withFile, 'l10n-count.json'), JSON.stringify(STALE));
  fs.mkdirSync(withoutFile, { recursive: true });
  const ok = { result: 'ok' };
  const f = (o) => TI.shouldCountL10n({ buildRec: ok, ranBuild: false, recDir: withFile, prevL10n: null, ...o });
  assert.equal(f({ buildRec: null }), false, 'ビルドの記録が無い');
  assert.equal(f({ buildRec: { result: 'failed' }, ranBuild: true }), false, 'ビルドが ok でない');
  assert.equal(f({ ranBuild: true }), true, '手順 5 を走らせた回');
  assert.equal(f({ recDir: withoutFile }), true, '出力がまだ無い');
  assert.equal(f({ prevL10n: { status: 'failed' } }), true, '前の記録が failed（古い出力が残っていても数え直す）');
  assert.equal(f({ prevL10n: { status: 'failed', staleOutput: true } }), true);
  assert.equal(f({ prevL10n: { status: 'ok' } }), false, '続きで、前が ok');
  assert.equal(f({ prevL10n: { status: 'untranslated' } }), false, '続きで、前が untranslated');
  assert.equal(f({ prevL10n: null }), false, '続きで、前の記録に l10n が無い');
});
test('l10nMaterialSkip + listMaterials: staleOutput のときだけ l10n-count.json を判定役の材料から外す。ほかの材料と既定の除外は変えない', () => {
  assert.equal(typeof TI.l10nMaterialSkip, 'function', 'take-in.mjs は l10nMaterialSkip を export する');
  const dir = path.join(sb, 'mat');
  for (const f of ['l10n-count.json', 'build-main.json', 'checks.json', 'judge-output.json', 'verdict.json', 'verdict.md', path.join('logs', 'l10n-count.log')]) writeFile(path.join(dir, f), '{}');
  const names = (l10n) => listMaterials(dir, dir, { skip: TI.l10nMaterialSkip(l10n) }).map((m) => m.path).sort();
  const normal = names(null);
  assert.deepEqual(normal, ['build-main.json', 'checks.json', 'l10n-count.json', 'logs/l10n-count.log'], '既定の除外（judge-output・verdict）は残る');
  for (const l of [undefined, { status: 'ok' }, { status: 'failed' }, { status: 'failed', staleOutput: false }]) assert.deepEqual(names(l), normal, JSON.stringify(l));
  assert.deepEqual(names({ status: 'failed', staleOutput: true }), ['build-main.json', 'checks.json', 'logs/l10n-count.log'], 'l10n-count.json だけ外れる（ログは別）');
});
test('CLI: take-in.mjs core --dry-run の plan.l10n に extract と count が出る。何も書かない', () => {
  const root = path.join(sb, 'dry');
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, JSON.stringify({ buildRoot: path.join(root, 'b'), installRoot: path.join(root, 'i') }));
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-l10n', '--prev-tag', '1.146.0',
    '--config', cfg, '--build-root', path.join(root, 'b'), '--install-root', path.join(root, 'i'), '--watch-state', path.join(root, 'no-state.json'), '--claude', process.execPath]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = JSON.parse(r.stdout.slice(r.stdout.search(/^\{/m)));
  const l = o.plan.l10n;
  assert.ok(l, 'plan.l10n');
  assert.equal(path.basename(l.strings), 'l10n-strings.json');
  assert.equal(l.extract.args[1], 'extract');
  assert.equal(l.count.args[1], 'count');
  assert.equal(path.basename(l.out), 'l10n-count.json');
  assert.ok(l.strings.includes(path.join('take-in', 'dry-l10n')));
  assert.equal(o.recordDirExists, false);
  assert.ok(!fs.existsSync(path.join(root, 'b')), '何も作らない');
});

// ---- 網の穴の補い（G1〜G3。2026-11-17。tasks/2026-11-17-r6-test-gaps/） ---------------------------------------------
// G1: count の前（版の形・パック・extract）で落ちたときも、前の回の l10n-count.json が残っていれば staleOutput: true（追加の直し 5.1）
test('runL10nCount（走らせる）: G1 count の前（版の形・パック無し・extract）で落ちたときも、前の回のファイルが残っていれば staleOutput。数は写さず、ファイルは消さない', async () => {
  const none = fakeCtx({ pack: 'none' });
  const noLayout = fakeCtx();
  const noNls = fakeCtx({ nls: false });
  const cases = [
    ['パック無し', none.ctx, none.outFile, /language-pack-ja が無い/],
    ['版の形を読めない', { ...noLayout.ctx, editorDir: path.join(sb, 'no-such-editor-g1') }, noLayout.outFile, /新しい版の形を読めない/],
    ['extract が落ちる', noNls.ctx, noNls.outFile, null],
  ];
  for (const [name, ctx, outFile, re] of cases) {
    writeFile(outFile, JSON.stringify(STALE));
    const r = await run(ctx);
    assert.equal(r.status, 'failed', `${name}: ${JSON.stringify(r)}`);
    assert.equal(r.staleOutput, true, `${name}: 前の回のファイルが残っている印`);
    if (re) assert.match(r.reason, re, `${name}: reason は元の理由のまま`);
    else assert.equal(r.step, 'extract', name);
    for (const k of ['result', 'untranslated', 'total', 'excluded', 'byArea', 'placeholderProblems']) assert.ok(r[k] == null, `${name}: ${k} に古い値を写さない`);
    assert.equal(readJson(outFile).total, 99999, `${name}: 前の回のファイルは消さず、書き換えない`);
  }
});
test('runL10nCount（走らせる）: G1 前の回のファイルが無ければ、count の前で落ちても staleOutput は付かない', async () => {
  const none = fakeCtx({ pack: 'none' });
  const noLayout = fakeCtx();
  const noNls = fakeCtx({ nls: false });
  for (const ctx of [none.ctx, { ...noLayout.ctx, editorDir: path.join(sb, 'no-such-editor-g1b') }, noNls.ctx]) {
    const r = await run(ctx);
    assert.equal(r.status, 'failed');
    assert.ok(!r.staleOutput, JSON.stringify(r));
  }
});

// G2: 配線。judge・runCore を走らせるには作業ツリー・ビルド・claude が要るので、ソースの構造で確かめる。
//   - 振る舞いで見る件（上）: shouldCountL10n の真偽、l10nMaterialSkip + listMaterials の外れ方
//   - 構造で見る件（この下の3件）: judge が listMaterials に l10nMaterialSkip(ctx.rec.l10n) を渡す、runCore が shouldCountL10n に
//     ranBuild: run(5) と prevL10n: ctx.rec.l10n を渡す、続きの回で前の回の take-in.json の l10n を ctx.rec.l10n に写してから save する
const bodyOf = (head, until) => {
  const a = takeInSrc.indexOf(head);
  assert.ok(a >= 0, `${head} がソースに無い`);
  const b = takeInSrc.indexOf(until, a);
  assert.ok(b > a, `${head} の終わり（${until}）が見つからない`);
  return takeInSrc.slice(a, b);
};
test('take-in.mjs（構造）: G2 judge は listMaterials に l10nMaterialSkip(ctx.rec.l10n) を skip として渡す', () => {
  const body = bodyOf('async function judge(', '\n// ------');
  assert.match(body, /listMaterials\(\s*ctx\.recDir\s*,\s*REPO\s*,\s*\{\s*skip:\s*l10nMaterialSkip\(\s*ctx\.rec\.l10n\s*\)\s*\}\s*\)/);
});
test('take-in.mjs（構造）: G2 runCore は shouldCountL10n に buildRec・ranBuild: run(5)・recDir・prevL10n: ctx.rec.l10n を渡し、その結果で数える', () => {
  const body = bodyOf('async function runCore(', '\n// ------');
  const m = body.match(/if\s*\(\s*shouldCountL10n\(\s*\{([^}]*)\}\s*\)\s*\)\s*\{\s*const l10n = await runL10nCount\(ctx\)/);
  assert.ok(m, 'if (shouldCountL10n({...})) { const l10n = await runL10nCount(ctx) の形');
  assert.match(m[1], /\bbuildRec\b/);
  assert.match(m[1], /ranBuild:\s*run\(5\)/);
  assert.match(m[1], /recDir:\s*ctx\.recDir/);
  assert.match(m[1], /prevL10n:\s*ctx\.rec\.l10n/);
  assert.ok(!/run\(5\)\s*\|\|\s*!fs\.existsSync/.test(body), '元の条件（run(5) || !exists）に戻していない');
});
test('take-in.mjs（構造）: G2 続きの回は、前の回の take-in.json の l10n を ctx.rec.l10n に写してから save する', () => {
  const body = bodyOf('async function runCore(', '\n// ------');
  const read = body.search(/const prevRec = readJsonOrNull\(path\.join\(ctx\.recDir, "take-in\.json"\)\)/);
  const copy = body.search(/if \(prevRec && prevRec\.l10n\) ctx\.rec\.l10n = prevRec\.l10n;/);
  assert.ok(read >= 0, '前の回の take-in.json を読む');
  assert.ok(copy > read, 'prevRec を読んだ後に写す');
  const save = body.indexOf('save(ctx);', read);
  assert.ok(save > copy, '写した後に save する（先に save すると前の回の l10n が消える）');
});

// G3: 照らす基準は「記録のフォルダ（dir）からの相対」。dir と repoRoot が違うフォルダ（本番は dir = records/take-in/<label>、repoRoot = リポジトリ）でも、
//     dir 直下の l10n-count.json だけが外れる。repoRoot からの相対で照らすと records/take-in/<label>/l10n-count.json になり、外れない
test('l10nMaterialSkip + listMaterials: G3 dir と repoRoot が違うフォルダでも、dir 直下の l10n-count.json だけが外れる（返す path は repoRoot からの相対）', () => {
  const repo = path.join(sb, 'mat-repo');
  const dir = path.join(repo, 'records', 'take-in', 'lbl');
  for (const f of ['l10n-count.json', 'build-main.json', 'judge-output.json', 'verdict.md', path.join('logs', 'l10n-count.log'), path.join('sub', 'l10n-count.json')]) writeFile(path.join(dir, f), '{}');
  const P = 'records/take-in/lbl/';
  const names = (l10n) => listMaterials(dir, repo, { skip: TI.l10nMaterialSkip(l10n) }).map((m) => m.path).sort();
  assert.deepEqual(names(null), [P + 'build-main.json', P + 'l10n-count.json', P + 'logs/l10n-count.log', P + 'sub/l10n-count.json'], '既定。repoRoot からの相対で返る。judge-output・verdict は外れる');
  assert.deepEqual(names({ status: 'failed', staleOutput: true }), [P + 'build-main.json', P + 'logs/l10n-count.log', P + 'sub/l10n-count.json'], 'dir 直下の l10n-count.json だけ外れる。logs と sub の下は残る');
});
