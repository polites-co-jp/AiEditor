// tests/l10n-audit.mjs の広げた部分のテスト（2026-11-17 の検証 C4 の a〜e と、bundle・直書きの独立の数え）。
//   - bundle（vscode.l10n.t）を、作業ツリーの拡張のソースから独立に拾って、パックの contents.bundle で引く
//   - 自前の拡張の直書き（literal）
//   - 除外の en を今の英語と比べる（変わったら効かせない）
//   - --pack に拡張のルート・dist/translations を渡したとき、package.json の translations で引く（載っていない拡張はパックに無い）
//   - --pack の既定は extensions-src/language-pack-ja
//   - sameAsEnglish・英字だけの訳の鍵の一覧
//   - 実物（r4 の出力と作業ツリー、新しいパック）で pass: true
// 仕様: docs/04-bundled-extensions.md の7節、検証 tasks/2026-11-17-l10n-ja-verify/verification-l10n-ja.md の6節。
// Run: node --test tests/l10n-audit-more.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, runNode, writeFile } from './build/helpers.mjs';
import { auditL10n, extractL10nStrings, extensionBundleStrings, manifestDisplayStrings, resolvePack, loadExclusions, DEFAULT_PACK } from './l10n-audit.mjs';

let sb;
before(() => { sb = makeSandbox('tests-l10n2-'); });
after(() => removeSandbox(sb));
const w = (p, v) => writeFile(p, typeof v === 'string' ? v : JSON.stringify(v));

// ---------------------------------------------------------------------------------------------------------------
// extractL10nStrings（本家の @vscode/l10n-dev の問い合わせと同じ形だけを拾う）
// ---------------------------------------------------------------------------------------------------------------
const ex = (src) => extractL10nStrings(`import * as vscode from 'vscode';\n${src}`);

test('extract: l10n.t("文")・vscode.l10n.t(\'文\', 引数)・テンプレート（引数つき）を拾う。鍵は英語の文言そのもの', () => {
  const r = ex(`
    vscode.window.showInformationMessage(vscode.l10n.t('Hello {0}', name));
    const a = l10n.t("Double quoted");
    const b = vscode.l10n.t(\`Template {0} here\`, x);
    foo.l10n.t('Prefixed object');
  `);
  assert.deepEqual(r.record, { 'Hello {0}': 'Hello {0}', 'Double quoted': 'Double quoted', 'Template {0} here': 'Template {0} here', 'Prefixed object': 'Prefixed object' });
});
test('extract: エスケープを戻す（\\n・\\\'・\\xNN・\\u{…}）', () => {
  const r = ex(`l10n.t('It\\'s\\nnew \\x41 \\u{1F600}');`);
  assert.deepEqual(Object.keys(r.record), ["It's\nnew A \u{1F600}"]);
});
test('extract: \\uXXXX（4桁）は実行時の文字（↔）の鍵にする。@vscode/l10n-dev 0.0.35 は ș（U+0219）にしてしまう（パックの鍵と食い違う既知の誤り）', () => {
  const r = ex(`l10n.t('{0} \\u2194 {1}', a, b);`);
  assert.deepEqual(Object.keys(r.record), ['{0} \u2194 {1}']);
});
test('extract: タグ付きテンプレート l10n.t`…${x}…` は ${} を {0} {1} に直す', () => {
  const r = ex('const m = l10n.t`Open ${a} in ${b}`;');
  assert.deepEqual(Object.keys(r.record), ['Open {0} in {1}']);
});
test('extract: { message, comment } は message と comment の両方があるときだけ拾う。鍵は 文/コメントをつないだもの。コメントの配列は ""で連結', () => {
  const r = ex(`
    l10n.t({ message: 'Push', comment: ['git verb', ' (short)'] });
    l10n.t({ message: 'Pull', comment: 'one comment' });
    l10n.t({ message: 'No comment' });
    l10n.t({ comment: ['only comment'] });
  `);
  assert.deepEqual(r.record, { 'Push/git verb (short)': 'Push', 'Pull/one comment': 'Pull' });
});
test('extract: 最初の引数が文字列の連結・変数・数のものは拾わない', () => {
  const r = ex(`
    l10n.t('A' + 'B');
    l10n.t(variable);
    l10n.t(42);
    l10n.t('kept');
  `);
  assert.deepEqual(Object.keys(r.record), ['kept']);
});
test('extract: テンプレートに ${} を埋めた l10n.t(`..${x}..`) は、本家は例外でファイルごと捨てる（error を返す）', () => {
  const r = ex('l10n.t(`bad ${x}`);\nl10n.t("good");');
  assert.ok(r.error);
  assert.deepEqual(r.record, {});
});
test('extract: l10n と vscode の語を含まないソースは拾わない（本家は読み飛ばす）', () => {
  assert.deepEqual(extractL10nStrings(`foo.l10n.t('x')`).record, {}); // 'vscode' の語が無い
  assert.deepEqual(extractL10nStrings(`import 'vscode'; log('l10n');`).record, {});
});
test('extract: 別名の import（import { l10n as L }・import { t } from @vscode/l10n・import * as NS from @vscode/l10n・require）も拾う', () => {
  assert.deepEqual(Object.keys(extractL10nStrings(`import { l10n as L } from 'vscode';\nL.t('via alias');`).record), ['via alias']);
  assert.deepEqual(Object.keys(extractL10nStrings(`import { t } from '@vscode/l10n';\nconst x = t('bare t', 1); // vscode`).record), ['bare t']);
  assert.deepEqual(Object.keys(extractL10nStrings(`import * as NS from '@vscode/l10n';\nNS.t('namespace');`).record), ['namespace']);
  assert.deepEqual(Object.keys(extractL10nStrings(`const l10n_1 = require('@vscode/l10n');\nl10n_1.t("required");`).record), ['required']);
  assert.deepEqual(Object.keys(extractL10nStrings(`const vscode_1 = require("vscode");\nvscode_1.l10n.t("compiled");`).record), ['compiled']);
});
test('extract: l10n.t を呼ぶ名前の一部だけが同じ別の関数（mil10n.t・l10n.tx）は拾わない', () => {
  const r = ex(`foo_l10n.t('nope'); l10n.tx('nope2'); l10n.t('yes');`);
  assert.deepEqual(Object.keys(r.record), ['yes']);
});
test('extract: 文字列の中の ) や ${} やエスケープした引用符でも、文字列の終わりを間違えない', () => {
  const r = ex(`l10n.t('a ) b \\' c', 1);\nl10n.t("d \${not} e");`);
  assert.deepEqual(Object.keys(r.record), ["a ) b ' c", 'd ${not} e']);
});

// ---------------------------------------------------------------------------------------------------------------
// extensionBundleStrings
// ---------------------------------------------------------------------------------------------------------------
test('extensionBundleStrings: {src,client,server}/**/*.ts(x) を読む。.d.ts・node_modules の中・ほかのフォルダは読まない。bundle.l10n.json も読む', () => {
  const wt = path.join(sb, 'ebs');
  const e = path.join(wt, 'extensions', 'demo');
  w(path.join(e, 'package.json'), { name: 'demo', publisher: 'vscode', dependencies: {} });
  w(path.join(e, 'src', 'a.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from src');`);
  w(path.join(e, 'src', 'deep', 'b.tsx'), `import { l10n } from 'vscode';\nl10n.t('from tsx');`);
  w(path.join(e, 'client', 'c.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from client');`);
  w(path.join(e, 'server', 'd.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from server');`);
  w(path.join(e, 'src', 'e.d.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from dts');`);
  w(path.join(e, 'src', 'node_modules', 'x', 'f.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from node_modules');`);
  w(path.join(e, 'other', 'g.ts'), `import * as vscode from 'vscode';\nvscode.l10n.t('from other');`);
  w(path.join(e, 'l10n', 'bundle.l10n.json'), { 'from json': 'from json', 'with comment/c': { message: 'with comment', comment: ['c'] } });
  const r = extensionBundleStrings(path.join(wt, 'extensions'), 'demo');
  assert.deepEqual(Object.keys(r.record).sort(), ['from client', 'from dts', 'from json', 'from server', 'from src', 'from tsx', 'with comment/c'].sort());
  assert.equal(r.record['with comment/c'], 'with comment');
  assert.equal(r.files, 5);
  assert.equal(r.bundleFiles, 1);
});
test('extensionBundleStrings: dependencies・devDependencies の @vscode/*・vscode-* の JS と、その依存の同じ名前の依存（推移）も読む', () => {
  const wt = path.join(sb, 'ebs2');
  const root = path.join(wt, 'extensions');
  const e = path.join(root, 'demo');
  w(path.join(e, 'package.json'), { name: 'demo', dependencies: { 'vscode-top': '1', lodash: '1' }, devDependencies: { '@vscode/dev-only': '1' } });
  w(path.join(root, 'node_modules', 'vscode-top', 'package.json'), { name: 'vscode-top', dependencies: { 'vscode-nested': '1' } });
  w(path.join(root, 'node_modules', 'vscode-top', 'index.js'), `const vscode = require('vscode');\nvscode.l10n.t('top dep');`);
  w(path.join(root, 'node_modules', 'vscode-nested', 'package.json'), { name: 'vscode-nested' });
  w(path.join(root, 'node_modules', 'vscode-nested', 'lib.js'), `const vscode = require('vscode');\nvscode.l10n.t('nested dep');`);
  w(path.join(root, 'node_modules', '@vscode', 'dev-only', 'package.json'), { name: '@vscode/dev-only' });
  w(path.join(root, 'node_modules', '@vscode', 'dev-only', 'x.js'), `const vscode = require('vscode');\nvscode.l10n.t('dev dep');`);
  w(path.join(root, 'node_modules', 'lodash', 'package.json'), { name: 'lodash' });
  w(path.join(root, 'node_modules', 'lodash', 'x.js'), `const vscode = require('vscode');\nvscode.l10n.t('lodash is not a vscode dep');`);
  const r = extensionBundleStrings(root, 'demo');
  assert.deepEqual(Object.keys(r.record).sort(), ['dev dep', 'nested dep', 'top dep']);
  assert.deepEqual(r.deps, ['@vscode/dev-only', 'vscode-nested', 'vscode-top']);
});
test('extensionBundleStrings: l10n.t(`..${}..`) のあるファイルは捨てて skippedFiles に出す（ほかのファイルは読む）', () => {
  const wt = path.join(sb, 'ebs3');
  const e = path.join(wt, 'extensions', 'demo');
  w(path.join(e, 'package.json'), { name: 'demo' });
  w(path.join(e, 'src', 'bad.ts'), 'import * as vscode from "vscode";\nvscode.l10n.t(`x ${y}`);\nvscode.l10n.t("lost with the file");');
  w(path.join(e, 'src', 'good.ts'), 'import * as vscode from "vscode";\nvscode.l10n.t("kept");');
  const r = extensionBundleStrings(path.join(wt, 'extensions'), 'demo');
  assert.deepEqual(Object.keys(r.record), ['kept']);
  assert.equal(r.skippedFiles.length, 1);
  assert.equal(r.skippedFiles[0].file, 'src/bad.ts');
});

// ---------------------------------------------------------------------------------------------------------------
// auditL10n（模擬の本体・作業ツリー・パック）
// ---------------------------------------------------------------------------------------------------------------
// 模擬: 本体 2 文言、拡張 vscode.git（package 2・bundle 3）、自前の拡張 shuko.mydist（直書き）
function fixture(name, { bundleTr, pack, own } = {}) {
  const base = path.join(sb, name);
  const app = path.join(base, 'app');
  const wt = path.join(base, 'wt');
  w(path.join(app, 'out', 'nls.keys.json'), [['vs/a', ['k1', 'k2']]]);
  w(path.join(app, 'out', 'nls.messages.json'), ['Open', 'Save']);
  w(path.join(app, 'extensions', 'git', 'package.json'), { name: 'git', publisher: 'vscode' });
  w(path.join(app, 'extensions', 'git', 'package.nls.json'), { 'cmd.clone': 'Clone', displayName: 'Git' });
  w(path.join(wt, 'extensions', 'git', 'package.json'), { name: 'git', publisher: 'vscode' });
  w(path.join(wt, 'extensions', 'git', 'src', 'a.ts'), `import * as vscode from 'vscode';
    vscode.l10n.t('Pull from {0}', x);
    vscode.l10n.t('Fetch');
    vscode.l10n.t({ message: 'Push', comment: ['verb'] });`);
  const root = path.join(base, 'pack');
  w(path.join(root, 'dist', 'translations', 'main.i18n.json'), { version: '1.0.0', contents: { 'vs/a': { k1: '開く', k2: '保存' } } });
  w(path.join(root, 'dist', 'translations', 'extensions', 'vscode.git.i18n.json'), {
    version: '1.0.0',
    contents: { package: { 'cmd.clone': 'クローン', displayName: 'Git' }, bundle: bundleTr ?? { 'Pull from {0}': '{0} から取得', Fetch: 'フェッチ', 'Push/verb': 'プッシュ' } },
  });
  w(path.join(root, 'package.json'), pack ?? { contributes: { localizations: [{ languageId: 'ja', translations: [
    { id: 'vscode', path: './dist/translations/main.i18n.json' }, { id: 'vscode.git', path: './dist/translations/extensions/vscode.git.i18n.json' },
  ] }] } });
  const ownSrc = path.join(base, 'own');
  fs.mkdirSync(ownSrc, { recursive: true });
  if (own) w(path.join(ownSrc, 'mydist', 'package.json'), own);
  return { app, wt, root, ownSrc, base };
}
const audit = (f, extra = {}) => auditL10n({ appDir: f.app, packDir: f.root, worktree: f.wt, ownSrcDir: f.ownSrc, ...extra });

test('bundle: 拡張のソースの l10n.t を、パックの contents.bundle で引いて数える（鍵は英語。コメントつきは 文/コメント）', () => {
  const r = audit(fixture('b1'));
  assert.equal(r.bundle.counted, true);
  const g = r.bundle.perExtension['vscode.git'];
  assert.equal(g.total, 3);
  assert.equal(g.translated, 3);
  assert.equal(r.bundle.totals.untranslated, 0);
  assert.equal(r.pass, true);
});
test('bundle: パックに無い鍵・空の訳は未訳。除外の外に出て不合格', () => {
  const r = audit(fixture('b2', { bundleTr: { 'Pull from {0}': '{0} から取得', Fetch: '' } }));
  const g = r.bundle.perExtension['vscode.git'];
  assert.equal(g.untranslated, 2);
  assert.deepEqual(g.untranslatedKeys.map((k) => k.key).sort(), ['Fetch', 'Push/verb']);
  assert.equal(r.totals.untranslatedOutsideExclusions, 2);
  assert.equal(r.pass, false);
});
test('bundle: 拡張のパックのファイルが無ければ、bundle も全部未訳（hasPackFile: false）', () => {
  const f = fixture('b3');
  fs.rmSync(path.join(f.root, 'dist', 'translations', 'extensions', 'vscode.git.i18n.json'));
  const r = audit(f);
  assert.equal(r.bundle.perExtension['vscode.git'].hasPackFile, false);
  assert.equal(r.bundle.perExtension['vscode.git'].untranslated, 3);
  assert.equal(r.packMissingTranslationFiles.length, 1, 'package.json が指すファイルが無い');
  assert.equal(r.pass, false);
});
test('bundle: 英語と同じ訳は sameAsEnglish に数え、鍵を出す。パックだけにある鍵は packOnlyKeys に数える（拾い漏れの目安）', () => {
  const r = audit(fixture('b4', { bundleTr: { 'Pull from {0}': 'Pull from {0}', Fetch: 'フェッチ', 'Push/verb': 'プッシュ', 'Only in pack': '余分' } }));
  const g = r.bundle.perExtension['vscode.git'];
  assert.equal(g.sameAsEnglish, 1);
  assert.deepEqual(g.sameAsEnglishKeys.map((k) => k.key), ['Pull from {0}']);
  assert.deepEqual(g.englishOnlyKeys.map((k) => k.key), ['Pull from {0}']);
  assert.equal(g.packOnlyKeys, 1);
  assert.deepEqual(g.packOnlyKeysSample, ['Only in pack']);
});
test('bundle: 除外（section: bundle）が効く。section が違う（package）除外は bundle に効かない', () => {
  const f = fixture('b5', { bundleTr: { 'Pull from {0}': '{0} から取得' } });
  const okEx = path.join(f.base, 'ex-ok.json');
  w(okEx, { exclusions: [
    { extension: 'vscode.git', section: 'bundle', key: 'Fetch', en: 'Fetch', reason: 'format' },
    { extension: 'vscode.git', section: 'bundle', key: 'Push/verb', en: 'Push', reason: 'format' },
  ] });
  const r = audit(f, { excludeFile: okEx });
  assert.equal(r.bundle.totals.excluded, 2);
  assert.equal(r.pass, true);
  const wrong = path.join(f.base, 'ex-wrong.json');
  w(wrong, { exclusions: [{ extension: 'vscode.git', key: 'Fetch', en: 'Fetch', reason: 'r' }, { extension: 'vscode.git', section: 'package', key: 'Push/verb', reason: 'r' }] });
  const r2 = audit(f, { excludeFile: wrong });
  assert.equal(r2.bundle.totals.excluded, 0);
  assert.equal(r2.pass, false);
});
test('bundle: --worktree が無ければ数えない（counted: false）。--require-bundle のときは不合格', () => {
  const f = fixture('b6');
  const r = auditL10n({ appDir: f.app, packDir: f.root, ownSrcDir: f.ownSrc });
  assert.equal(r.bundle.counted, false);
  assert.equal(r.bundle.totals.total, 0);
  assert.equal(r.pass, true);
  const r2 = auditL10n({ appDir: f.app, packDir: f.root, ownSrcDir: f.ownSrc, requireBundle: true });
  assert.equal(r2.pass, false);
});
test('bundle: --worktree に extensions/ が無ければ例外（CLI は終了コード 2）', () => {
  const f = fixture('b7');
  assert.throws(() => audit(f, { worktree: path.join(f.base, 'nowhere') }), /extensions/);
  const r = runNode(['tests/l10n-audit.mjs', '--app', f.app, '--pack', f.root, '--worktree', path.join(f.base, 'nowhere')]);
  assert.equal(r.status, 2);
});

// ---- 除外の en ------------------------------------------------------------------------------------------------
test('除外の en: 今の英語と同じときだけ効く。違えば効かせず staleExclusions に出し、未訳は除外の外に残る', () => {
  const f = fixture('en1', { pack: undefined });
  w(path.join(f.root, 'dist', 'translations', 'main.i18n.json'), { contents: { 'vs/a': { k1: '開く' } } }); // k2 は未訳
  const same = path.join(f.base, 'ex-same.json');
  w(same, { exclusions: [{ module: 'vs/a', key: 'k2', en: 'Save', reason: 'format' }] });
  let r = audit(f, { excludeFile: same });
  assert.equal(r.core.excluded, 1);
  assert.equal(r.core.untranslatedOutsideExclusions, 0);
  assert.deepEqual(r.staleExclusions, []);
  const changed = path.join(f.base, 'ex-changed.json');
  w(changed, { exclusions: [{ module: 'vs/a', key: 'k2', en: 'Save (old wording)', reason: 'format' }] });
  r = audit(f, { excludeFile: changed });
  assert.equal(r.core.excluded, 0);
  assert.equal(r.core.untranslatedOutsideExclusions, 1);
  assert.deepEqual(r.staleExclusions, [{ module: 'vs/a', key: 'k2', recordedEn: 'Save (old wording)', en: 'Save' }]);
  assert.equal(r.pass, false);
});
test('除外の en: en の無い除外は英語を問わず効く（従来の形）。拡張・bundle の除外も同じ規則', () => {
  const f = fixture('en2', { bundleTr: {} });
  const file = path.join(f.base, 'ex.json');
  w(file, { exclusions: [
    { extension: 'vscode.git', section: 'bundle', key: 'Fetch', reason: 'r' }, // en なし: 効く
    { extension: 'vscode.git', section: 'bundle', key: 'Pull from {0}', en: 'Pull from {0} (old)', reason: 'r' }, // 変わった: 効かない
    { extension: 'vscode.git', section: 'bundle', key: 'Push/verb', en: 'Push', reason: 'r' }, // 同じ: 効く
  ] });
  const r = audit(f, { excludeFile: file });
  assert.equal(r.bundle.totals.excluded, 2);
  assert.deepEqual(r.bundle.perExtension['vscode.git'].untranslatedKeys.map((k) => k.key), ['Pull from {0}']);
  assert.deepEqual(r.staleExclusions.map((s) => `${s.extension}/${s.section}/${s.key}`), ['vscode.git/bundle/Pull from {0}']);
});
test('除外の形: section が package・bundle・literal 以外、en が文字列でないものは invalidExclusions に出る', () => {
  const f = fixture('en3');
  const file = path.join(f.base, 'ex.json');
  w(file, [{ extension: 'x.y', section: 'nowhere', key: 'k', reason: 'r' }, { module: 'm', key: 'k', en: 5, reason: 'r' }, { module: 'm', key: 'k', en: 'E', reason: 'r' }]);
  const e = loadExclusions(file);
  assert.equal(e.invalid.length, 2);
  assert.equal(e.items.length, 1);
  assert.equal(audit(f, { excludeFile: file }).pass, false, '誤りのある除外は不合格');
});
test('除外ファイルを複数重ねられる（配列で渡す）', () => {
  const f = fixture('en4', { bundleTr: {} });
  const a = path.join(f.base, 'a.json');
  const b = path.join(f.base, 'b.json');
  w(a, { exclusions: [{ extension: 'vscode.git', section: 'bundle', key: 'Fetch', en: 'Fetch', reason: 'r' }, { extension: 'vscode.git', section: 'bundle', key: 'Pull from {0}', en: 'Pull from {0}', reason: 'r' }] });
  w(b, { exclusions: [{ extension: 'vscode.git', section: 'bundle', key: 'Push/verb', en: 'Push', reason: 'r' }] });
  assert.equal(audit(f, { excludeFile: [a] }).bundle.totals.untranslatedOutsideExclusions, 1);
  assert.equal(audit(f, { excludeFile: [a, b] }).bundle.totals.untranslatedOutsideExclusions, 0);
});

// ---- パックの場所（拡張のルート・dist/translations・translations/）------------------------------------------------------
test('--pack に拡張のルートを渡すと、package.json の translations（./dist/translations/…）で引く', () => {
  const f = fixture('pk1');
  const r = audit(f);
  assert.equal(r.inputs.packManifest, path.join(f.root, 'package.json'));
  assert.equal(r.inputs.packTranslationsDir, path.join(f.root, 'dist', 'translations'));
  assert.equal(r.core.translated, 2);
  assert.equal(r.extensions['vscode.git'].translated, 2);
});
test('--pack に dist/translations を渡しても、上の package.json を見つけて同じ結果になる', () => {
  const f = fixture('pk2');
  const r = audit(f, { packDir: path.join(f.root, 'dist', 'translations') });
  assert.equal(r.inputs.packManifest, path.join(f.root, 'package.json'));
  assert.equal(r.extensions['vscode.git'].translated, 2);
  assert.equal(r.bundle.perExtension['vscode.git'].translated, 3);
});
test('package.json の translations に載っていない拡張は、名前が合うファイルがあっても「パックに無い」（本体が実際に引く対応）', () => {
  const f = fixture('pk3', { pack: { contributes: { localizations: [{ languageId: 'ja', translations: [{ id: 'vscode', path: './dist/translations/main.i18n.json' }] }] } } });
  const r = audit(f);
  assert.equal(r.extensions['vscode.git'].hasPackFile, false);
  assert.equal(r.extensions['vscode.git'].untranslated, 2);
  assert.equal(r.bundle.perExtension['vscode.git'].untranslated, 3);
  assert.equal(r.pass, false);
});
test('package.json が指すファイルが無い（packMissingTranslationFiles）と不合格。vscode の項目が無い・本体の束が無いときは例外', () => {
  const f = fixture('pk4');
  fs.rmSync(path.join(f.root, 'dist', 'translations', 'extensions', 'vscode.git.i18n.json'));
  const r = audit(f);
  assert.deepEqual(r.packMissingTranslationFiles.map((m) => m.id), ['vscode.git']);
  assert.equal(r.pass, false);
  const f2 = fixture('pk5', { pack: { contributes: { localizations: [{ languageId: 'ja', translations: [{ id: 'vscode.git', path: './dist/translations/extensions/vscode.git.i18n.json' }] }] } } });
  assert.throws(() => audit(f2), /vscode の translations/);
  const f3 = fixture('pk6');
  fs.rmSync(path.join(f3.root, 'dist', 'translations', 'main.i18n.json'));
  assert.throws(() => audit(f3), /指すファイルが無い/);
});
test('package.json が無いときだけ、<ID>.i18n.json の名前で探す。ja の localizations があれば ja を選ぶ', () => {
  const f = fixture('pk7');
  fs.rmSync(path.join(f.root, 'package.json'));
  const r = resolvePack(path.join(f.root, 'dist', 'translations'));
  assert.equal(r.manifestPath, null);
  assert.equal(r.idToPath, null);
  assert.equal(audit(f, { packDir: path.join(f.root, 'dist', 'translations') }).extensions['vscode.git'].hasPackFile, true);
  const f2 = fixture('pk8', { pack: { contributes: { localizations: [
    { languageId: 'fr', translations: [{ id: 'vscode', path: './nope.json' }] },
    { languageId: 'ja', translations: [{ id: 'vscode', path: './dist/translations/main.i18n.json' }] },
  ] } } });
  assert.equal(resolvePack(f2.root).languageId, 'ja');
});
test('--pack の既定は、古い 1.131.0 でなく、リポジトリの extensions-src/language-pack-ja', () => {
  assert.equal(DEFAULT_PACK, path.join(REPO, 'extensions-src', 'language-pack-ja'));
  const f = fixture('pk9');
  const out = path.join(f.base, 'out.json');
  const r = runNode(['tests/l10n-audit.mjs', '--app', f.app, '--out', out]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.inputs.packDir, DEFAULT_PACK);
  assert.equal(j.inputs.packManifest, path.join(DEFAULT_PACK, 'package.json'));
  assert.ok(!/ms-ceintl|1\.131\.0/i.test(j.inputs.packDir));
});

// ---- 一覧 -----------------------------------------------------------------------------------------------------
test('sameAsEnglishKeys・englishOnlyKeys: 本体と拡張の package に、英語と同じ訳の鍵と、英字だけの訳の鍵の一覧を出す', () => {
  const f = fixture('ls1');
  w(path.join(f.root, 'dist', 'translations', 'main.i18n.json'), { contents: { 'vs/a': { k1: 'Open', k2: '保存' } } });
  const r = audit(f);
  assert.deepEqual(r.core.sameAsEnglishKeys, [{ module: 'vs/a', key: 'k1', message: 'Open' }]);
  assert.deepEqual(r.core.englishOnlyKeys, [{ module: 'vs/a', key: 'k1', message: 'Open', translation: 'Open' }]);
  assert.equal(r.core.sameAsEnglish, 1);
  assert.deepEqual(r.extensions['vscode.git'].sameAsEnglishKeys, [{ key: 'displayName', message: 'Git' }]);
  assert.equal(r.totals.sameAsEnglish, 1 + 1);
});
test('englishOnlyKeys: 訳が日本語を含めば入らない。英字3字未満（OK）も入らない', () => {
  const f = fixture('ls2');
  w(path.join(f.root, 'dist', 'translations', 'main.i18n.json'), { contents: { 'vs/a': { k1: 'Git の設定', k2: 'OK' } } });
  const r = audit(f);
  assert.deepEqual(r.core.englishOnlyKeys, []);
});

// ---- 自前の直書き（literal）----------------------------------------------------------------------------------------
test('manifestDisplayStrings: displayName・description・コマンド・設定の表示の文字列を拾い、%key%・id・コマンド名・設定の鍵は拾わない', () => {
  const r = manifestDisplayStrings({
    name: 'mydist', displayName: 'Shuko defaults', description: '%d%', publisher: 'shuko',
    contributes: {
      commands: [{ command: 'x.y', title: 'Open', category: 'Shuko' }],
      configuration: { title: 'Shuko', properties: { description: { type: 'string', description: 'The description property', default: 'not a label', enum: ['a'], enumDescriptions: ['A one'] } } },
      keybindings: [{ command: 'x.y', key: 'ctrl+x', when: 'editorFocus' }],
    },
  });
  assert.deepEqual(r, {
    displayName: 'Shuko defaults',
    'contributes.commands[0].title': 'Open',
    'contributes.commands[0].category': 'Shuko',
    'contributes.configuration[0].title': 'Shuko',
    'contributes.configuration[0].properties.description.description': 'The description property',
    'contributes.configuration[0].properties.description.enumDescriptions[0]': 'A one',
  });
});
test('直書き（literal）: 日本語を含めば訳あり、英語だけなら未訳で不合格。言語パック自身の表示も数える', () => {
  const f = fixture('lit1', { own: { name: 'mydist', publisher: 'shuko', displayName: 'Shuko の既定', description: 'Only English here' } });
  const r = audit(f);
  const lit = r.literals.perExtension['shuko.mydist'];
  assert.equal(lit.total, 2);
  assert.equal(lit.translated, 1);
  assert.deepEqual(lit.untranslatedKeys, [{ key: 'description', message: 'Only English here' }]);
  assert.equal(r.pass, false);
  const f2 = fixture('lit2', { own: { name: 'mydist', publisher: 'shuko', displayName: 'Shuko の既定', description: '%d%' } });
  assert.equal(audit(f2).pass, true);
});
test('直書き（literal）の除外（section: literal）が効く', () => {
  const f = fixture('lit3', { own: { name: 'mydist', publisher: 'shuko', displayName: 'Shuko の既定', description: 'Only English here' } });
  const file = path.join(f.base, 'ex.json');
  w(file, { exclusions: [{ extension: 'shuko.mydist', section: 'literal', key: 'description', en: 'Only English here', reason: 'r' }] });
  const r = audit(f, { excludeFile: file });
  assert.equal(r.literals.totals.excluded, 1);
  assert.equal(r.pass, true);
});
test('直書き（literal）: 出力に language-pack-ja がある版（auto）は出力の写しを読む。無い版は extensions-src を読む。literalsFrom で選べる', () => {
  const f = fixture('lit4', { own: { name: 'mydist', publisher: 'shuko', displayName: '日本語の src', description: '日本語の src の説明' } });
  w(path.join(f.app, 'extensions', 'mydist', 'package.json'), { name: 'mydist', publisher: 'shuko', displayName: 'English in app' });
  let r = audit(f); // app に language-pack-ja が無い → src
  assert.equal(r.literals.perExtension['shuko.mydist'].manifest, 'extensions-src');
  assert.equal(r.literals.perExtension['shuko.mydist'].untranslated, 0);
  r = audit(f, { literalsFrom: 'app' });
  assert.equal(r.literals.perExtension['shuko.mydist'].manifest, 'app');
  assert.equal(r.literals.perExtension['shuko.mydist'].untranslated, 1);
  w(path.join(f.app, 'extensions', 'language-pack-ja', 'package.json'), { name: 'language-pack-ja', publisher: 'shuko', displayName: '日本語' });
  r = audit(f); // app に language-pack-ja がある → app
  assert.equal(r.literals.perExtension['shuko.mydist'].manifest, 'app');
  assert.equal(r.literals.perExtension['shuko.mydist'].untranslated, 1);
});

// ---- CLI --------------------------------------------------------------------------------------------------------
test('CLI: --worktree・--exclude（複数）・--require-bundle・--literals を受ける。--strict は未訳があれば 1。不明な --literals は 2', () => {
  const f = fixture('cli1', { bundleTr: {} });
  const e1 = path.join(f.base, 'e1.json');
  const e2 = path.join(f.base, 'e2.json');
  w(e1, { exclusions: [{ extension: 'vscode.git', section: 'bundle', key: 'Fetch', en: 'Fetch', reason: 'r' }, { extension: 'vscode.git', section: 'bundle', key: 'Pull from {0}', en: 'Pull from {0}', reason: 'r' }] });
  w(e2, { exclusions: [{ extension: 'vscode.git', section: 'bundle', key: 'Push/verb', en: 'Push', reason: 'r' }] });
  const base = ['tests/l10n-audit.mjs', '--app', f.app, '--pack', f.root, '--worktree', f.wt];
  assert.equal(runNode([...base, '--exclude', e1, '--strict']).status, 1);
  assert.equal(runNode([...base, '--exclude', e1, '--exclude', e2, '--strict', '--require-bundle']).status, 0);
  assert.equal(runNode(['tests/l10n-audit.mjs', '--app', f.app, '--pack', f.root, '--require-bundle', '--strict']).status, 1, 'worktree が無いと bundle を数えられず不合格');
  assert.equal(runNode([...base, '--literals', 'bogus']).status, 2);
  const out = path.join(f.base, 'cli.json');
  assert.equal(runNode([...base, '--exclude', e1, '--exclude', e2, '--out', out]).status, 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.bundle.counted, true);
  assert.equal(j.pass, true);
});

// ---------------------------------------------------------------------------------------------------------------
// 実物（日常の版 r4 の出力と作業ツリー、新しいパック）。無ければ飛ばす
// ---------------------------------------------------------------------------------------------------------------
const R4 = path.join(REPO, 'tmp', 'b', 'p2', '1.146.0-p5-c-all-r4', 'Shuko-win32-x64-1.146.0-p5-c-all-r4', 'resources', 'app');
const realApp = process.env.AIED_AUDIT_APP || R4;
const realWt = process.env.AIED_AUDIT_WT || path.join(REPO, 'tmp', 'b', 'wt', 'r4');
const haveReal = fs.existsSync(path.join(realApp, 'out', 'nls.keys.json')) && fs.existsSync(path.join(realWt, 'extensions'));
const realExclusions = path.join(DEFAULT_PACK, 'exclusions.json');

test('実物: 新しいパックと r4 の文言（本体・package・bundle・直書き）で、除外の外の未訳が本体・package・直書きは 0。bundle の件数は 1,500 件以上', { skip: !haveReal && '実物（r4 の出力と作業ツリー）が無い' }, () => {
  const r = auditL10n({ appDir: realApp, packDir: DEFAULT_PACK, excludeFile: realExclusions, worktree: realWt });
  assert.equal(r.core.total, 12355);
  assert.equal(r.core.untranslatedOutsideExclusions, 0, JSON.stringify(r.core.untranslatedKeys.slice(0, 5)));
  assert.equal(r.core.excluded, 5);
  assert.equal(r.core.keysVsMessagesMismatch, false);
  assert.equal(r.extensionsTotals.total, 1258);
  assert.equal(r.extensionsTotals.untranslatedOutsideExclusions, 0);
  assert.equal(r.literals.totals.untranslatedOutsideExclusions, 0);
  assert.ok(r.literals.totals.total >= 22, `直書き ${r.literals.totals.total}`);
  assert.ok(r.bundle.totals.total >= 1500, `bundle ${r.bundle.totals.total}`);
  assert.deepEqual(r.invalidExclusions, []);
  assert.deepEqual(r.packMissingTranslationFiles, []);
  assert.deepEqual(r.staleExclusions, []);
  // 拾い漏れの目安: パックの bundle にあって、この台本が拾わなかった鍵（ș の2件を含めて）は全体の 3% 未満
  const packOnly = Object.values(r.bundle.perExtension).reduce((a, b) => a + (b.packOnlyKeys ?? 0), 0);
  assert.ok(packOnly < r.bundle.totals.total * 0.03, `パックだけにある鍵 ${packOnly}`);
});
test('実物: リポジトリのパックで pass: true（除外は exclusions.json のみ。--require-bundle つき）', { skip: !haveReal && '実物が無い' }, () => {
  const r = auditL10n({ appDir: realApp, packDir: DEFAULT_PACK, excludeFile: realExclusions, worktree: realWt, requireBundle: true });
  assert.equal(r.totals.untranslatedOutsideExclusions, 0, JSON.stringify(Object.values(r.bundle.perExtension).flatMap((b) => b.untranslatedKeys).slice(0, 5)));
  assert.equal(r.pass, true);
});
test('実物: git の「↔」の2件（\\u2194 の鍵）は、除外でなく訳として入っている（鍵は実行時の文字）', { skip: !haveReal && '実物が無い' }, () => {
  const r = auditL10n({ appDir: realApp, packDir: DEFAULT_PACK, excludeFile: realExclusions, worktree: realWt, requireBundle: true });
  const g = r.bundle.perExtension['vscode.git'];
  assert.equal(r.bundle.totals.excluded, 0, 'bundle に除外は無い');
  assert.ok(!g.untranslatedKeys.some((k) => k.key.includes('↔')));
  assert.ok(!(g.excludedKeys ?? []).some((k) => k.key.includes('↔')));
  const pack = JSON.parse(fs.readFileSync(path.join(DEFAULT_PACK, 'dist', 'translations', 'extensions', 'vscode.git.i18n.json'), 'utf8')).contents.bundle;
  for (const k of ['{0} ↔ {1}', '{0} ({1}) ↔ {0} ({2})']) assert.ok(typeof pack[k] === 'string' && pack[k], k);
});
test('実物: 古い 1.131.0 のパックでは、bundle を含めて未訳が残り不合格（網が落ちるべきときに落ちる）', {
  skip: (() => {
    const p = path.join(process.env.USERPROFILE ?? '', '.shuko', 'extensions', 'ms-ceintl.vscode-language-pack-ja-1.131.0');
    return !(haveReal && fs.existsSync(path.join(p, 'translations', 'main.i18n.json'))) && '古いパック・実物が無い';
  })(),
}, () => {
  const p = path.join(process.env.USERPROFILE ?? '', '.shuko', 'extensions', 'ms-ceintl.vscode-language-pack-ja-1.131.0');
  const r = auditL10n({ appDir: realApp, packDir: p, worktree: realWt });
  assert.equal(r.pass, false);
  assert.ok(r.core.untranslatedOutsideExclusions >= 500);
});
