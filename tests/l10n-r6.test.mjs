// r6 で足された日本語パックまわりの部品のテスト（蒙恬の引き継ぎ r6-1〜r6-9）。
//   - thirdPartyNotice（ThirdPartyNotices.txt の本文。下の層の出典も書く）と、できたファイル
//   - take-in.mjs の l10nPlan・summarizeL10nCount（取り込みのビルドの後に未訳を数える）。数えが失敗しても止めない（warnings に1行）
//   - 公式の訳の誤り5件の上書き（上書きは計14件）
// Run: node --test tests/l10n-r6.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, runNode, writeFile } from './build/helpers.mjs';
import { thirdPartyNotice, placeholderMismatch, validateAdded } from '../scripts/lib/l10n-ja.mjs';
import { l10nPlan, summarizeL10nCount } from '../scripts/take-in.mjs';

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
  assert.ok(t.startsWith('Shuko language-pack-ja - Third Party Notices'));
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
test('summarizeL10nCount: 結果のファイルが無いときは failed と理由（終了コード 0 でも failed）', () => {
  assert.deepEqual(summarizeL10nCount(0, null), { status: 'failed', exitCode: 0, reason: 'l10n-count.json が無い' });
  assert.equal(summarizeL10nCount(1, undefined).status, 'failed');
  assert.equal(summarizeL10nCount(5, null).status, 'untranslated', '5 のとき out が無くても status は終了コードどおり（理由つき）');
  assert.equal(summarizeL10nCount(5, null).reason, 'l10n-count.json が無い');
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
test('take-in.mjs: runL10nCount は、新しい版の形を読めない・パックが無い・extract が失敗でも、例外にせず failed を返す（ソースの構造の確かめ）', () => {
  const a = takeInSrc.indexOf('async function runL10nCount');
  const b = takeInSrc.indexOf('function corePlan', a);
  const fn = takeInSrc.slice(a, b);
  assert.ok(!/throw |Stop\(/.test(fn));
  assert.equal((fn.match(/status: "failed"/g) || []).length >= 3, true);
  assert.match(fn, /l10n-extract\.log/);
  assert.match(fn, /l10n-count\.log/);
});
test('take-in.mjs: 数えるのはビルドが ok のときで、手順 5 を走らせた回か、l10n-count.json がまだ無いとき（続きからでも数え漏れない）', () => {
  assert.match(takeInSrc, /buildRec && buildRec\.result === "ok" && \(run\(5\) \|\| !fs\.existsSync\(path\.join\(ctx\.recDir, "l10n-count\.json"\)\)\)/);
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
