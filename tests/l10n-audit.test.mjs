// tests/l10n-audit.mjs（日本語の未訳を数える網）のテスト。仕様: docs/04-bundled-extensions.md の7節。
// 模擬の本体と言語パックを tmp/tests/ に作って数えさせる。実物がある PC では、実物でも粗い範囲を確かめる。
// 実行: node --test tests/l10n-audit.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditL10n, looksEnglishOnly, loadExclusions } from './l10n-audit.mjs';
import { makeSandbox, removeSandbox, runNode } from './build/helpers.mjs';

let sb;
before(() => { sb = makeSandbox('tests-l10n-'); });
after(() => removeSandbox(sb));

const w = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)); };

// 模擬の本体: 2モジュール・5文言、拡張 2 つ（git は一部だけ訳あり、zzz はパックに無い）、nls を持たない拡張 1 つ。
function fixture(name, { pack } = {}) {
  const app = path.join(sb, name, 'app');
  const keys = [['vs/a/one', ['k1', 'k2', 'k3']], ['vs/b/two', ['k1', 'k4']]];
  const msgs = ['Open File', 'Save', '{0} items', 'Open File', 'Close Window'];
  w(path.join(app, 'out', 'nls.keys.json'), keys);
  w(path.join(app, 'out', 'nls.messages.json'), msgs);
  w(path.join(app, 'extensions', 'git', 'package.json'), { name: 'git', publisher: 'vscode' });
  w(path.join(app, 'extensions', 'git', 'package.nls.json'), { 'cmd.clone': 'Clone', 'cmd.pull': { message: 'Pull', comment: ['x'] }, displayName: 'Git' });
  w(path.join(app, 'extensions', 'zzz', 'package.json'), { name: 'zzz', publisher: 'sukuna' });
  w(path.join(app, 'extensions', 'zzz', 'package.nls.json'), { title: 'Zzz Title' });
  w(path.join(app, 'extensions', 'plain', 'package.json'), { name: 'plain', publisher: 'sukuna' });
  const root = path.join(sb, name, 'pack');
  w(path.join(root, 'translations', 'main.i18n.json'), pack ?? {
    version: '1.0.0',
    contents: {
      'vs/a/one': { k1: 'ファイルを開く', k3: '{0} 個の項目', k2: '' }, // k2 は空 = 未訳
      'vs/b/two': { k1: 'ファイルを開く' }, // k4 は無い
      'vs/unused/mod': { x: '使われない' },
    },
  });
  w(path.join(root, 'translations', 'extensions', 'vscode.git.i18n.json'), { version: '1.0.0', contents: { package: { 'cmd.clone': 'クローン', displayName: 'Git' }, bundle: { Hello: 'こんにちは' } } });
  w(path.join(root, 'package.json'), { contributes: { localizations: [{ languageId: 'ja', translations: [{ id: 'vscode', path: './translations/main.i18n.json' }, { id: 'vscode.git', path: './translations/extensions/vscode.git.i18n.json' }] }] } });
  return { app, root };
}

test('本体: 総数・訳あり・未訳を、モジュールと鍵で引いて数える（同じ鍵名が別モジュールにあっても混ざらない）', () => {
  const { app, root } = fixture('core');
  const r = auditL10n({ appDir: app, packDir: root });
  assert.equal(r.core.total, 5);
  assert.equal(r.core.translated, 3); // vs/a/one:k1, vs/a/one:k3, vs/b/two:k1
  assert.equal(r.core.untranslated, 2); // k2（空）と vs/b/two:k4
  assert.deepEqual(r.core.untranslatedKeys.map((k) => `${k.module}#${k.key}`).sort(), ['vs/a/one#k2', 'vs/b/two#k4']);
  assert.equal(r.core.untranslatedKeys.find((k) => k.key === 'k4').message, 'Close Window');
  assert.equal(r.core.total, r.core.translated + r.core.untranslated);
  assert.equal(r.core.keysVsMessagesMismatch, false);
});
test('本体: 鍵だけが同じで別モジュールの訳は使わない', () => {
  const { app, root } = fixture('crossmod', { pack: { contents: { 'vs/b/two': { k1: '訳', k2: '別モジュールの k2' } } } });
  const r = auditL10n({ appDir: app, packDir: root });
  assert.equal(r.core.translated, 1);
  assert.equal(r.core.untranslated, 4);
});
test('訳が原文と同じものは「訳がある」に数え、sameAsEnglish にも出す', () => {
  const { app, root } = fixture('same', { pack: { contents: { 'vs/a/one': { k1: 'Open File' } } } });
  const r = auditL10n({ appDir: app, packDir: root });
  assert.equal(r.core.translated, 1);
  assert.equal(r.core.sameAsEnglish, 1);
});
test('拡張: package.nls.json の鍵を、パックの contents.package で引く（{message, comment} 形も読む）。bundle は数えない', () => {
  const { app, root } = fixture('ext');
  const r = auditL10n({ appDir: app, packDir: root });
  const git = r.extensions['vscode.git'];
  assert.equal(git.total, 3);
  assert.equal(git.translated, 2);
  assert.deepEqual(git.untranslatedKeys, [{ key: 'cmd.pull', message: 'Pull' }]);
  assert.equal(git.hasPackFile, true);
  const zzz = r.extensions['sukuna.zzz'];
  assert.equal(zzz.hasPackFile, false);
  assert.equal(zzz.untranslated, 1);
  assert.equal(r.extensionsTotals.total, 4);
  assert.equal(r.extensionsTotals.untranslated, 2);
  assert.deepEqual(r.extensionsWithoutNlsFile.map((x) => x.id), ['sukuna.plain']);
});
test('拡張のファイルの場所は contributes.localizations で引く（名前の規則と違っても引ける）', () => {
  const { app, root } = fixture('extmap');
  fs.renameSync(path.join(root, 'translations', 'extensions', 'vscode.git.i18n.json'), path.join(root, 'translations', 'extensions', 'odd-name.json'));
  const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  pj.contributes.localizations[0].translations[1].path = './translations/extensions/odd-name.json';
  w(path.join(root, 'package.json'), pj);
  assert.equal(auditL10n({ appDir: app, packDir: root }).extensions['vscode.git'].translated, 2);
});
test('パックは translations/ そのものを渡してもよい（名前の規則で拡張を探す）', () => {
  const { app, root } = fixture('tdir');
  fs.rmSync(path.join(root, 'package.json'));
  const r = auditL10n({ appDir: app, packDir: path.join(root, 'translations') });
  assert.equal(r.core.translated, 3);
  assert.equal(r.extensions['vscode.git'].translated, 2);
});
test('除外: 理由つきの除外は未訳から外れて excluded に数える。除外の外が 0 のとき合格', () => {
  const { app, root } = fixture('excl');
  const ex = path.join(sb, 'excl', 'ex.json');
  w(ex, { exclusions: [
    { module: 'vs/a/one', key: 'k2', reason: '空の訳は意図' },
    { module: 'vs/b/two', key: 'k4', reason: 'テスト' },
    { extension: 'vscode.git', key: 'cmd.pull', reason: '固有名詞' },
    { messageRegex: '^Zzz ', scope: 'extensions', reason: '名前' },
  ] });
  const r = auditL10n({ appDir: app, packDir: root, excludeFile: ex });
  assert.equal(r.core.untranslated, 2);
  assert.equal(r.core.excluded, 2);
  assert.equal(r.core.untranslatedOutsideExclusions, 0);
  assert.equal(r.extensionsTotals.excluded, 2);
  assert.equal(r.totals.untranslatedOutsideExclusions, 0);
  assert.equal(r.pass, true);
});
test('除外: 部分だけ除外すると、残りが除外の外に出て不合格', () => {
  const { app, root } = fixture('exclpart');
  const ex = path.join(sb, 'exclpart', 'ex.json');
  w(ex, [{ module: 'vs/a/one', key: 'k2', reason: 'r' }]);
  const r = auditL10n({ appDir: app, packDir: root, excludeFile: ex });
  assert.equal(r.core.untranslatedOutsideExclusions, 1);
  assert.equal(r.pass, false);
});
test('除外: 理由の無い除外は効かず invalidExclusions に出る（理由なしの除外で合格にできない）', () => {
  const { app, root } = fixture('exclnoreason');
  const ex = path.join(sb, 'exclnoreason', 'ex.json');
  w(ex, [{ module: 'vs/a/one', key: 'k2' }, { module: 'vs/b/two', key: 'k4', reason: '' }]);
  const r = auditL10n({ appDir: app, packDir: root, excludeFile: ex });
  assert.equal(r.core.excluded, 0);
  assert.equal(r.invalidExclusions.length, 2);
  assert.equal(r.pass, false);
});
test('loadExclusions: ファイルが無指定なら空', () => {
  assert.deepEqual(loadExclusions(undefined), { items: [], invalid: [] });
});
test('全部訳せていれば合格。パックの余分な項目（使われない鍵）は数えない', () => {
  const full = { contents: { 'vs/a/one': { k1: 'あ', k2: 'い', k3: 'う' }, 'vs/b/two': { k1: 'え', k4: 'お' }, 'vs/zzz': { q: 'x' } } };
  const { app, root } = fixture('full', { pack: full });
  const gitPack = path.join(root, 'translations', 'extensions', 'vscode.git.i18n.json');
  w(gitPack, { contents: { package: { 'cmd.clone': 'a', 'cmd.pull': 'b', displayName: 'c' } } });
  const zzz = path.join(root, 'translations', 'extensions', 'sukuna.zzz.i18n.json');
  w(zzz, { contents: { package: { title: 'ズズ' } } });
  const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  pj.contributes.localizations[0].translations.push({ id: 'sukuna.zzz', path: './translations/extensions/sukuna.zzz.i18n.json' });
  w(path.join(root, 'package.json'), pj);
  const r = auditL10n({ appDir: app, packDir: root });
  assert.equal(r.core.total, 5);
  assert.equal(r.core.untranslated, 0);
  assert.equal(r.extensionsTotals.untranslated, 0);
  assert.equal(r.pass, true);
});
test('粗い数え: 日本語を含まず英字3字以上があるものを数える', () => {
  assert.equal(looksEnglishOnly('Text Diff Editor'), true);
  assert.equal(looksEnglishOnly('テキスト Diff'), false);
  assert.equal(looksEnglishOnly('{0}'), false);
  assert.equal(looksEnglishOnly('OK'), false);
  assert.equal(looksEnglishOnly('…'), false);
  const { app, root } = fixture('rough');
  const r = auditL10n({ appDir: app, packDir: root });
  assert.equal(r.roughEnglishOnly.defaultEnglishOnly, 5); // 5 件とも英字3字以上を含む
});
test('CLI: --out に JSON を書き、--strict は未訳があれば 1、無ければ 0。不明な引数・パック無しは 2', () => {
  const { app, root } = fixture('cli');
  const out = path.join(sb, 'cli', 'out.json');
  let r = runNode(['tests/l10n-audit.mjs', '--app', app, '--pack', root, '--out', out]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).core.total, 5);
  r = runNode(['tests/l10n-audit.mjs', '--app', app, '--pack', root, '--strict']);
  assert.equal(r.status, 1);
  r = runNode(['tests/l10n-audit.mjs', '--bogus']);
  assert.equal(r.status, 2);
  r = runNode(['tests/l10n-audit.mjs', '--app', app, '--pack', path.join(sb, 'nowhere')]);
  assert.equal(r.status, 2);
});

// ---- 実物（1.146.0 の本体と 1.131.0 のパック）。日常の場所（%LOCALAPPDATA%\Programs\…・~\.…）は読まない（2026-11-18 の改名で模擬に替えた）。
// 場所は環境変数 AIED_AUDIT_REAL_APP（…\resources\app）と AIED_AUDIT_REAL_PACK（1.131.0 のパックのフォルダ）で渡す。渡さなければ飛ばす ----
const realApp = process.env.AIED_AUDIT_REAL_APP ?? '';
const realPack = process.env.AIED_AUDIT_REAL_PACK ?? '';
const haveReal = !!realApp && !!realPack && fs.existsSync(path.join(realApp, 'out', 'nls.keys.json')) && fs.existsSync(path.join(realPack, 'translations', 'main.i18n.json'));
test('実物: 1.146.0 の本体 12,355 件を、1.131.0 のパックで数える。リーダーの粗い数え（約650）と大きく食い違わない', { skip: !haveReal && '実物が無い' }, () => {
  const r = auditL10n({ appDir: realApp, packDir: realPack });
  assert.equal(r.core.total, 12355);
  assert.equal(r.core.total, r.core.translated + r.core.untranslated);
  assert.ok(r.core.untranslated >= 500 && r.core.untranslated <= 900, `未訳 ${r.core.untranslated}`);
  assert.ok(r.roughEnglishOnly.effectiveEnglishOnly >= 500 && r.roughEnglishOnly.effectiveEnglishOnly <= 1000);
  assert.equal(r.pass, false);
  assert.ok(r.extensionsTotals.total > 1000);
});
