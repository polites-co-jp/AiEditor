// extensions-src/notion-sync/builtin-l10n.mjs の単体テスト（組み込み拡張の翻訳の束）と、
// extensions-src/*/package.json に dependencies・optionalDependencies が無いこと（制約の網）。
// 仕様: tasks/2026-11-14-units-checks-revise/handoff-notes.md の 4 節と「テストの入口（曹参へ）」。
// Run: node --test tests/builtin-l10n.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extensionId, ownTranslations, emptyBundleText, checkBuiltinLocalizations, writeBuiltinTranslations } from '../extensions-src/notion-sync/builtin-l10n.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-l10n-');
});
after(() => removeSandbox(sb));

const REAL = JSON.parse(fs.readFileSync(path.join(REPO, 'extensions-src', 'notion-sync', 'package.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const GOOD_PATH = './dist/i18n/shuko.notion-sync.ja.i18n.json';
function manifest(localizations) {
  const m = { name: 'notion-sync', publisher: 'shuko', contributes: {} };
  if (localizations !== undefined) m.contributes.localizations = localizations;
  return m;
}
const good = () => manifest([{ languageId: 'ja', languageName: 'Japanese', localizedLanguageName: '日本語', translations: [{ id: 'shuko.notion-sync', path: GOOD_PATH }] }]);

// ---- extensionId / ownTranslations / emptyBundleText ---------------------------------------
test('extensionId: publisher.name', () => {
  assert.equal(extensionId(REAL), 'shuko.notion-sync');
  assert.equal(extensionId({ publisher: 'a', name: 'b' }), 'a.b');
});
test('ownTranslations: 実物の manifest は ja・自分の ID・./dist/i18n/ の下の path 1件', () => {
  assert.deepEqual(ownTranslations(REAL), [{ languageId: 'ja', id: 'shuko.notion-sync', path: GOOD_PATH }]);
});
test('ownTranslations: 他人の ID の項目は数えない。localizations が無くても落ちない', () => {
  const m = good();
  m.contributes.localizations[0].translations.push({ id: 'vscode.git', path: './dist/i18n/git.json' });
  assert.equal(ownTranslations(m).length, 1);
  assert.deepEqual(ownTranslations(manifest()), []);
  assert.deepEqual(ownTranslations({}), []);
});
test('emptyBundleText: JSON で contents.bundle と contents.package が空のオブジェクト。version がある', () => {
  const j = JSON.parse(emptyBundleText());
  assert.equal(typeof j.version, 'string');
  assert.deepEqual(j.contents.bundle, {});
  assert.deepEqual(j.contents.package, {});
});

// ---- checkBuiltinLocalizations（manifest だけ） --------------------------------------------
test('checkBuiltinLocalizations: 実物の manifest は誤り無し', () => {
  assert.deepEqual(checkBuiltinLocalizations(REAL), []);
});
test('checkBuiltinLocalizations: localizations が無い / 空配列 → 誤り', () => {
  assert.ok(checkBuiltinLocalizations(manifest()).length >= 1);
  assert.ok(checkBuiltinLocalizations(manifest([])).length >= 1);
  assert.ok(checkBuiltinLocalizations({}).length >= 1);
});
test('checkBuiltinLocalizations: 自分の ID の項目が無い → 誤り（他人の ID だけ）', () => {
  const m = good();
  m.contributes.localizations[0].translations[0].id = 'vscode.git';
  const e = checkBuiltinLocalizations(m);
  assert.ok(e.length >= 1);
  assert.ok(e.some((s) => s.includes('shuko.notion-sync')), e.join('\n'));
});
test('checkBuiltinLocalizations: path が dist/ の外 → 誤り（../ ・media/ ・拡張の直下・絶対パス・\\ 区切りの ..）', () => {
  for (const p of ['../x.json', './media/x.json', 'media/x.json', './x.json', './dist/../x.json', '.\\dist\\..\\x.json', '/dist/x.json']) {
    const m = good();
    m.contributes.localizations[0].translations[0].path = p;
    assert.ok(checkBuiltinLocalizations(m).length >= 1, `path ${p} は止める`);
  }
});
test('checkBuiltinLocalizations: path が dist/ の下なら通る（./ あり・なし・\\ 区切り）', () => {
  for (const p of ['./dist/a.json', 'dist/a.json', '.\\dist\\i18n\\a.json']) {
    const m = good();
    m.contributes.localizations[0].translations[0].path = p;
    assert.deepEqual(checkBuiltinLocalizations(m), [], p);
  }
});
test('checkBuiltinLocalizations: translations が空・id か path が文字列でない・languageId が文字列でない → 誤り', () => {
  let m = good();
  m.contributes.localizations[0].translations = [];
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
  m = good();
  m.contributes.localizations[0].translations[0].path = 5;
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
  m = good();
  m.contributes.localizations[0].translations[0].id = null;
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
  m = good();
  m.contributes.localizations[0].languageId = 1;
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
});
test('checkBuiltinLocalizations: languageName・localizedLanguageName が文字列でない → 誤り。無いのは良い', () => {
  let m = good();
  m.contributes.localizations[0].languageName = 3;
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
  m = good();
  m.contributes.localizations[0].localizedLanguageName = {};
  assert.ok(checkBuiltinLocalizations(m).length >= 1);
  m = good();
  delete m.contributes.localizations[0].languageName;
  delete m.contributes.localizations[0].localizedLanguageName;
  assert.deepEqual(checkBuiltinLocalizations(m), []);
});

// ---- checkBuiltinLocalizations（root あり：ファイルを見る） -------------------------------
test('checkBuiltinLocalizations(root): ファイルが無い → 誤り（path を含む）', () => {
  const root = path.join(sb, 'nofile');
  fs.mkdirSync(root, { recursive: true });
  const e = checkBuiltinLocalizations(good(), root);
  assert.ok(e.length >= 1);
  assert.ok(e.some((s) => s.includes(GOOD_PATH)), e.join('\n'));
});
test('checkBuiltinLocalizations(root): JSON でない → 誤り', () => {
  const root = path.join(sb, 'badjson');
  writeFile(path.join(root, 'dist', 'i18n', 'shuko.notion-sync.ja.i18n.json'), '{ not json');
  assert.ok(checkBuiltinLocalizations(good(), root).length >= 1);
});
test('checkBuiltinLocalizations(root): contents.bundle が無い・オブジェクトでない・null → 誤り', () => {
  for (const [i, body] of [{ version: '1.0.0', contents: { package: {} } }, { contents: { bundle: 'x' } }, { contents: { bundle: null } }, {}, []].entries()) {
    const root = path.join(sb, 'nobundle' + i);
    writeFile(path.join(root, 'dist', 'i18n', 'shuko.notion-sync.ja.i18n.json'), JSON.stringify(body));
    assert.ok(checkBuiltinLocalizations(good(), root).length >= 1, JSON.stringify(body));
  }
});
test('checkBuiltinLocalizations(root): contents.bundle が空のオブジェクトなら通る', () => {
  const root = path.join(sb, 'okbundle');
  writeFile(path.join(root, 'dist', 'i18n', 'shuko.notion-sync.ja.i18n.json'), emptyBundleText());
  assert.deepEqual(checkBuiltinLocalizations(good(), root), []);
});

// ---- writeBuiltinTranslations ---------------------------------------------------------------
test('writeBuiltinTranslations: 書いた相対パスを返し、中身は空の束。書いたあと root ありの確かめが通る', () => {
  const root = path.join(sb, 'write');
  const m = good();
  const written = writeBuiltinTranslations(m, root);
  assert.deepEqual(written, ['dist/i18n/shuko.notion-sync.ja.i18n.json']);
  const f = path.join(root, ...written[0].split('/'));
  assert.equal(fs.readFileSync(f, 'utf8'), emptyBundleText());
  assert.deepEqual(checkBuiltinLocalizations(m, root), []);
});
test('writeBuiltinTranslations: 自分の ID の項目が無ければ何も書かない', () => {
  const root = path.join(sb, 'write-none');
  fs.mkdirSync(root, { recursive: true });
  assert.deepEqual(writeBuiltinTranslations(manifest(), root), []);
  assert.deepEqual(fs.readdirSync(root), []);
});
test('writeBuiltinTranslations: 実物の manifest で書ける（./ と \\ の path 表記を正規化する）', () => {
  const root = path.join(sb, 'write-real');
  const m = clone(REAL);
  m.contributes.localizations[0].translations[0].path = '.\\dist\\i18n\\x.ja.json';
  assert.deepEqual(writeBuiltinTranslations(m, root), ['dist/i18n/x.ja.json']);
  assert.ok(fs.existsSync(path.join(root, 'dist', 'i18n', 'x.ja.json')));
});

// ---- 制約の網: extensions-src/*/package.json に dependencies・optionalDependencies が無い -------
// 組み込み拡張は dist/ と media/ だけを写す（apply.mjs）。実行時の依存は esbuild で束ねる。node_modules を持ち込まない。
test('extensions-src/*/package.json: dependencies・optionalDependencies・peerDependencies・bundledDependencies が無い（devDependencies だけ）', () => {
  const base = path.join(REPO, 'extensions-src');
  const dirs = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'package.json')));
  assert.ok(dirs.length >= 2, '拡張が見つかる');
  for (const d of dirs) {
    const pkg = JSON.parse(fs.readFileSync(path.join(base, d.name, 'package.json'), 'utf8'));
    for (const k of ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies', 'bundleDependencies']) {
      assert.ok(!(k in pkg), `${d.name}/package.json に ${k} がある`);
    }
  }
});
