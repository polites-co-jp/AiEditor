// 日本語パック（組み込み拡張 language-pack-ja）まわりの、リポジトリの整合と、台本の部品のテスト。
//   - リポジトリの整合: extensions-src/language-pack-ja/ の package.json・dist・sources.json・exclusions.json・added/、台帳・上書き・keep の整合
//   - scripts/apply.mjs の languagePackMissingFiles と、language-pack-ja が無い・束が無いときに apply が止まること（検証の M1）
//   - scripts/install-extensions.mjs の retiredNotes
//   - classify・build の「自前の拡張」に language-pack-ja が入っていること
//   - scripts/l10n-ja.mjs の書き出している部品（loadSourcesConfig・translationsList・readBuiltPack・resolveInput・loadAdded・loadExclusions ほか）
// 仕様: docs/04-bundled-extensions.md の7節、tasks/2026-11-17-l10n-ja/l10n-design.md、蒙恬の引き継ぎ（l10n-ja の4節・5節）。
// 期待値は仕様と、蒙恬の引き継ぎの「テストが要る点」から書いた。
// Run: node --test tests/l10n-repo.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, runNode, writeFile } from './build/helpers.mjs';
import { mods } from './apply/api.mjs';
import { languagePackMissingFiles } from '../scripts/apply.mjs';
import { retiredNotes, RETIRED_EXTENSIONS } from '../scripts/install-extensions.mjs';
import { OWN_EXTENSIONS as BUILD_OWN } from '../scripts/build.mjs';
import {
  loadSourcesConfig, sourceCacheDir, layerFromPackFiles, l10nDependencyNames, loadAdded, loadExclusions, translationsList, readBuiltPack, resolveInput, PACK_ID,
} from '../scripts/l10n-ja.mjs';
import { validateAdded, validateExclusions, flattenStrings } from '../scripts/lib/l10n-ja.mjs';
import { loadExclusions as auditLoadExclusions } from './l10n-audit.mjs';

const PACK = path.join(REPO, 'extensions-src', 'language-pack-ja');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const w = (p, v) => writeFile(p, typeof v === 'string' ? v : JSON.stringify(v));
const OLD_PACK_ID = 'MS-CEINTL.vscode-language-pack-ja';

let sb;
before(() => { sb = makeSandbox('tests-l10nrepo-'); });
after(() => removeSandbox(sb));

// ---------------------------------------------------------------------------------------------------------------
// リポジトリの整合
// ---------------------------------------------------------------------------------------------------------------
const pj = readJson(path.join(PACK, 'package.json'));
const loc = pj.contributes.localizations.find((l) => l.languageId === 'ja');

test('パックの package.json: shuko.language-pack-ja（組み込みの拡張）。ja の localizations があり、vscode の項目がある', () => {
  assert.equal(`${pj.publisher}.${pj.name}`, PACK_ID);
  assert.equal(PACK_ID, 'shuko.language-pack-ja');
  assert.ok(loc, 'ja の localizations');
  assert.ok(loc.translations.some((t) => t.id === 'vscode'), 'vscode の項目');
  assert.equal(loc.localizedLanguageName, '日本語');
  assert.ok(pj.engines?.vscode, 'engines.vscode');
  assert.ok(pj.categories.includes('Language Packs'));
});
test('パックの package.json: translations が指すファイルが全部あり、dist/translations のファイルと1対1に合う', () => {
  const listed = new Set();
  for (const t of loc.translations) {
    assert.ok(/^\.\/dist\/translations\//.test(t.path), `${t.id}: ${t.path}`);
    const f = path.join(PACK, t.path);
    assert.ok(fs.existsSync(f), `${t.id} の束が無い: ${t.path}`);
    listed.add(path.resolve(f).toLowerCase());
  }
  assert.equal(new Set(loc.translations.map((t) => t.id)).size, loc.translations.length, 'id の重複');
  const onDisk = [path.join(PACK, 'dist', 'translations', 'main.i18n.json')];
  const extDir = path.join(PACK, 'dist', 'translations', 'extensions');
  for (const n of fs.readdirSync(extDir)) onDisk.push(path.join(extDir, n));
  assert.deepEqual([...listed].sort(), onDisk.map((p) => path.resolve(p).toLowerCase()).sort(), 'translations と dist が1対1');
});
test('パックの束: 拡張の ID とファイル名が合い、main は contents、拡張は contents.package と contents.bundle の両方を持つ', () => {
  for (const t of loc.translations) {
    const j = readJson(path.join(PACK, t.path));
    assert.equal(j.version, '1.0.0', t.id);
    assert.ok(j.contents && typeof j.contents === 'object', t.id);
    if (t.id === 'vscode') {
      assert.equal(path.basename(t.path), 'main.i18n.json');
      assert.ok(Object.keys(j.contents).length > 1000, '本体の束が小さすぎる');
    } else {
      assert.equal(path.basename(t.path), `${t.id}.i18n.json`);
      assert.ok(j.contents.package && typeof j.contents.package === 'object', `${t.id} に contents.package`);
      assert.ok(j.contents.bundle && typeof j.contents.bundle === 'object', `${t.id} に contents.bundle`);
      assert.ok(Object.keys(j.contents.package).length + Object.keys(j.contents.bundle).length > 0, `${t.id} が空の束`);
    }
  }
});
test('パックの束: 値はすべて文字列（空でない）。本体の束に使われない型が混じらない', () => {
  const bad = [];
  const j = readJson(path.join(PACK, 'dist', 'translations', 'main.i18n.json'));
  for (const [m, keys] of Object.entries(j.contents)) for (const [k, v] of Object.entries(keys)) if (typeof v !== 'string' || v === '') bad.push(`${m}#${k}`);
  for (const t of loc.translations.filter((x) => x.id !== 'vscode')) {
    const c = readJson(path.join(PACK, t.path)).contents;
    for (const sec of ['package', 'bundle']) for (const [k, v] of Object.entries(c[sec])) if (typeof v !== 'string' || v === '') bad.push(`${t.id} ${sec} ${k}`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});
test('パックの README・ThirdPartyNotices.txt がある（apply が写す）。ThirdPartyNotices は MIT の表示と出典の commit を含む', () => {
  assert.ok(fs.existsSync(path.join(PACK, 'README.md')));
  const notices = fs.readFileSync(path.join(PACK, 'ThirdPartyNotices.txt'), 'utf8');
  assert.match(notices, /MIT/);
  assert.match(notices, /Permission is hereby granted/);
  assert.match(notices, /microsoft\/vscode-loc/);
  const cfg = readJson(path.join(PACK, 'sources.json'));
  const first = cfg.sources.find((s) => s.kind === 'vscode-loc');
  assert.ok(notices.includes(first.commit.slice(0, 8)), '出典の commit が ThirdPartyNotices に書かれている');
});

test('sources.json: 形（loadSourcesConfig が通る）。vscode-loc の commit は40桁で、files のどの値も SHA-256（64桁の16進）', () => {
  const cfg = loadSourcesConfig(path.join(PACK, 'sources.json'));
  assert.equal(cfg.language, 'ja');
  const names = cfg.sources.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, 'name の重複');
  for (const s of cfg.sources) {
    if (s.kind === 'vscode-loc') {
      assert.match(s.commit, /^[0-9a-f]{40}$/, s.name);
      assert.ok(s.files && Object.keys(s.files).length > 0, `${s.name}: files`);
      for (const [rel, h] of Object.entries(s.files)) assert.match(h, /^[0-9a-f]{64}$/, `${s.name}: ${rel}`);
      assert.ok(s.files['LICENSE.md'], `${s.name}: LICENSE.md の SHA-256（MIT の表示のため）`);
      assert.ok(s.license, `${s.name}: license`);
    } else if (s.kind === 'vsix') {
      assert.match(s.sha256, /^[0-9a-f]{64}$/, s.name);
      assert.match(s.download, /^https:\/\//, s.name);
    }
  }
});
test('sources.json: 先頭の訳の元の files は、パックの束（dist）の拡張の ID の訳を全部含む（取ってきた束から dist を作る前提）', () => {
  const cfg = readJson(path.join(PACK, 'sources.json'));
  const first = cfg.sources[0];
  assert.equal(first.kind, 'vscode-loc');
  const rels = Object.keys(first.files).filter((r) => /^translations\/extensions\//.test(r));
  assert.ok(rels.length >= 90, `${rels.length} 件`);
  assert.ok(rels.every((r) => r.endsWith('.i18n.json')));
});

test('exclusions.json: validateExclusions が誤り 0。網の loadExclusions でも invalid にならず、件数が同じ', () => {
  const file = path.join(PACK, 'exclusions.json');
  const ex = readJson(file);
  assert.deepEqual(validateExclusions(ex), []);
  assert.deepEqual(loadExclusions(file), ex, 'scripts の loadExclusions は同じ中身を返す');
  const a = auditLoadExclusions(file);
  assert.deepEqual(a.invalid, []);
  assert.equal(a.items.length, ex.exclusions.length);
  for (const e of ex.exclusions) assert.ok(e.en && e.reason, '英語と理由の記録');
});
test('added/*.json: validateAdded が誤り 0。ファイル名は <version>.json。loadAdded が版の順に読める', () => {
  const dir = path.join(PACK, 'added');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 1);
  for (const f of files) {
    const a = readJson(path.join(dir, f));
    assert.deepEqual(validateAdded(a), [], f);
    assert.equal(`${a.version}.json`, f);
  }
  const loaded = loadAdded(dir);
  assert.equal(loaded.length, files.length);
  assert.deepEqual(loaded.map((a) => a.version), [...loaded.map((a) => a.version)].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })));
});
test('除外と足した訳の英語は、パックの束と矛盾しない（除外した鍵に、パックの訳が入っていない）', () => {
  const ex = readJson(path.join(PACK, 'exclusions.json'));
  const main = readJson(path.join(PACK, 'dist', 'translations', 'main.i18n.json')).contents;
  for (const e of ex.exclusions.filter((x) => x.module)) {
    const v = main[e.module]?.[e.key];
    assert.ok(v === undefined || v === '', `除外 ${e.module}#${e.key} にパックの訳 ${JSON.stringify(v)} が入っている（除外が不要なはず）`);
  }
});

test('台帳と extensions.allowed に MS-CEINTL.vscode-language-pack-ja が無い（組み込みに置き換えた）。台帳の ID と allowed の ID が一致する', () => {
  const lock = readJson(path.join(REPO, 'extensions.lock.json'));
  const ids = lock.map((e) => e.id);
  assert.ok(!ids.some((i) => i.toLowerCase() === OLD_PACK_ID.toLowerCase()), '台帳に古いパックが残っている');
  const overlay = readJson(path.join(REPO, 'product.overlay.json'));
  // extensions.allowed は set の中の、設定の既定のオブジェクトの下にある
  const text = fs.readFileSync(path.join(REPO, 'product.overlay.json'), 'utf8');
  assert.ok(!/ms-ceintl/i.test(text), 'product.overlay.json に ms-ceintl が残っている');
  const cd = Object.values(overlay.set).find((v) => v && typeof v === 'object' && v['extensions.allowed']);
  assert.ok(cd, 'extensions.allowed');
  const allowedIds = Object.keys(cd['extensions.allowed']).filter((k) => k !== '*').map((k) => k.toLowerCase()).sort();
  assert.deepEqual(allowedIds, ids.map((i) => i.toLowerCase()).sort());
  assert.equal(cd['extensions.allowed']['*'], false);
});
test('台帳（extensions.lock.json）に言語パックの項目が無いので、台帳の拡張はすべて言語パックでない', () => {
  const lock = readJson(path.join(REPO, 'extensions.lock.json'));
  assert.equal(lock.length, 7);
  for (const e of lock) assert.ok(!/language-pack/i.test(e.id), e.id);
});
test('builtin/keep.json の own に mydist・notion-sync・language-pack-ja。build と classify の自前の拡張の一覧も同じ', () => {
  const keep = readJson(path.join(REPO, 'builtin', 'keep.json'));
  const own = keep.own.map((o) => o.name).sort();
  assert.deepEqual(own, ['language-pack-ja', 'mydist', 'notion-sync']);
  assert.deepEqual([...BUILD_OWN].sort(), own);
  assert.deepEqual([...(mods.classify?.OWN_EXTENSIONS ?? [])].sort(), own);
  for (const o of keep.own) assert.ok(o.reason && o.reason.length > 10, `${o.name} の理由`);
  assert.ok(keep.own.every((o) => fs.existsSync(path.join(REPO, 'extensions-src', o.name, 'package.json'))), 'extensions-src に各 package.json');
});

test('自前の拡張の package.json の表示の文字列（displayName・description）は日本語（直書きは言語パックで訳さない）', () => {
  for (const name of ['mydist', 'notion-sync', 'language-pack-ja']) {
    const m = readJson(path.join(REPO, 'extensions-src', name, 'package.json'));
    for (const k of ['displayName', 'description']) {
      if (typeof m[k] !== 'string' || /^%.+%$/.test(m[k])) continue;
      assert.match(m[k], /[぀-ヿ㐀-鿿]/, `${name} の ${k}: ${m[k]}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// classify（自前の拡張は未分類に数えない）
// ---------------------------------------------------------------------------------------------------------------
const needClassify = { skip: mods.classify?.findUnclassifiedExtensions ? false : '実装なし: classify.findUnclassifiedExtensions' };
test('classify: mydist・notion-sync・language-pack-ja は未分類に数えない（own）。ほかは数える', needClassify, () => {
  const r = mods.classify.findUnclassifiedExtensions(['mydist', 'notion-sync', 'language-pack-ja', 'newone'], { keep: [] }, []);
  assert.deepEqual(r.map((x) => x.name), ['newone']);
});
test('classify: language-pack-ja に似た名前（language-pack-fr）は own でない', needClassify, () => {
  const r = mods.classify.findUnclassifiedExtensions(['language-pack-fr', 'language-pack-ja'], { keep: [] }, []);
  assert.deepEqual(r.map((x) => x.name), ['language-pack-fr']);
});
test('classify: OWN_EXTENSIONS に language-pack-ja が入っている', { skip: mods.classify?.OWN_EXTENSIONS ? false : '実装なし' }, () => {
  assert.ok(mods.classify.OWN_EXTENSIONS.includes('language-pack-ja'));
  assert.ok(mods.classify.OWN_EXTENSIONS.includes('mydist'));
  assert.ok(mods.classify.OWN_EXTENSIONS.includes('notion-sync'));
});

// ---------------------------------------------------------------------------------------------------------------
// languagePackMissingFiles
// ---------------------------------------------------------------------------------------------------------------
function makePack(name, { manifest, files = [] } = {}) {
  const dir = path.join(sb, name);
  fs.mkdirSync(dir, { recursive: true });
  if (manifest !== undefined) w(path.join(dir, 'package.json'), manifest);
  for (const f of files) w(path.join(dir, f), '{}');
  return dir;
}
const manifestOf = (paths) => ({ contributes: { localizations: [{ languageId: 'ja', translations: paths.map((p, i) => ({ id: i === 0 ? 'vscode' : `x.e${i}`, path: p })) }] } });

test('languagePackMissingFiles: 今のリポジトリのパックは []（束がそろっている）', () => {
  assert.deepEqual(languagePackMissingFiles(PACK), []);
});
test('languagePackMissingFiles: 束が全部あれば []', () => {
  const d = makePack('lp-ok', { manifest: manifestOf(['./dist/m.json', './dist/e/a.json']), files: ['dist/m.json', 'dist/e/a.json'] });
  assert.deepEqual(languagePackMissingFiles(d), []);
});
test('languagePackMissingFiles: 無い束のファイルを、パッケージの中の相対パスのまま返す（あるものは返さない）', () => {
  const d = makePack('lp-missing', { manifest: manifestOf(['./dist/m.json', './dist/e/a.json', './dist/e/b.json']), files: ['dist/m.json'] });
  assert.deepEqual(languagePackMissingFiles(d), ['./dist/e/a.json', './dist/e/b.json']);
});
test('languagePackMissingFiles: package.json が無い・読めない（壊れた JSON）なら ["package.json"]', () => {
  assert.deepEqual(languagePackMissingFiles(makePack('lp-nopj', {})), ['package.json']);
  const d = makePack('lp-badjson', {});
  w(path.join(d, 'package.json'), '{ not json');
  assert.deepEqual(languagePackMissingFiles(d), ['package.json']);
  assert.deepEqual(languagePackMissingFiles(path.join(sb, 'no-such-folder')), ['package.json']);
});
test('languagePackMissingFiles: localizations が無い・translations が空なら "contributes.localizations の translations"', () => {
  const want = ['contributes.localizations の translations'];
  assert.deepEqual(languagePackMissingFiles(makePack('lp-noloc', { manifest: { name: 'x' } })), want);
  assert.deepEqual(languagePackMissingFiles(makePack('lp-emptyloc', { manifest: { contributes: { localizations: [] } } })), want);
  assert.deepEqual(languagePackMissingFiles(makePack('lp-notrans', { manifest: { contributes: { localizations: [{ languageId: 'ja' }] } } })), want);
  assert.deepEqual(languagePackMissingFiles(makePack('lp-badtrans', { manifest: { contributes: { localizations: [{ languageId: 'ja', translations: [{ id: 'vscode' }] }] } } })), want);
});

// ---------------------------------------------------------------------------------------------------------------
// apply.mjs: language-pack-ja が無い・束が無いと止まる（検証の M1。mydist と同じ）
// ---------------------------------------------------------------------------------------------------------------
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
let repoSeq = 0;
let sharedWt = null;
// 作業ツリーは 1 つを使い回す（--dry-run は作業ツリーを変えない。git の起動が遅い PC でも間に合うように）
function sharedWorktree() {
  if (sharedWt) return sharedWt;
  const wt = path.join(sb, 'apply-wt');
  w(path.join(wt, 'product.json'), '{"nameShort":"X","version":"1.0.0"}\n');
  w(path.join(wt, 'package.json'), '{"name":"code-oss-dev","version":"1.0.0"}\n');
  w(path.join(wt, 'extensions', 'dummy', 'package.json'), '{"name":"dummy"}\n');
  git(wt, 'init', '-q');
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', 'base');
  sharedWt = wt;
  return wt;
}
function runApplyOn({ withMydist = true, langPack }) {
  const base = path.join(sb, `apply-${++repoSeq}`);
  const wt = sharedWorktree();
  const ext = path.join(base, 'ext');
  if (withMydist) w(path.join(ext, 'mydist', 'package.json'), '{"name":"mydist","publisher":"shuko","version":"0.0.1","displayName":"Shuko の既定"}\n');
  if (langPack) langPack(ext);
  for (const d of ['removals', 'patches', 'manifests']) fs.mkdirSync(path.join(base, d), { recursive: true });
  w(path.join(base, 'overlay.json'), '{}');
  w(path.join(base, 'lock.json'), '[]');
  const out = path.join(base, 'checks.json');
  const r = runNode(['scripts/apply.mjs', wt, '--label', 'l10n-m1', '--dry-run', '--removals', path.join(base, 'removals'), '--patches', path.join(base, 'patches'),
    '--assets', path.join(base, 'no-assets'), '--overlay', path.join(base, 'overlay.json'), '--keep', path.join(base, 'no-keep.json'), '--extensions-src', ext,
    '--lock', path.join(base, 'lock.json'), '--manifests', path.join(base, 'manifests'), '--checks-out', out]);
  const rec = fs.existsSync(out) ? readJson(out) : null;
  return { r, rec };
}
const completePack = (ext) => {
  w(path.join(ext, 'language-pack-ja', 'package.json'), manifestOf(['./dist/translations/main.i18n.json', './dist/translations/extensions/x.e1.i18n.json']));
  w(path.join(ext, 'language-pack-ja', 'dist', 'translations', 'main.i18n.json'), '{"version":"1.0.0","contents":{}}');
  w(path.join(ext, 'language-pack-ja', 'dist', 'translations', 'extensions', 'x.e1.i18n.json'), '{"version":"1.0.0","contents":{"package":{},"bundle":{}}}');
};

test('apply（M1）: language-pack-ja のフォルダが無いと、黙って飛ばさず builtinExtensions で止まる（終了コード 1）', () => {
  const { r, rec } = runApplyOn({});
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.ok(rec, 'checks.json が書かれる');
  assert.equal(rec.stoppedAt?.phase, 'builtinExtensions');
  assert.equal(rec.stoppedAt?.id, 'language-pack-ja');
  assert.match(rec.stoppedAt.message, /package\.json/);
  assert.equal(rec.result, 'fail');
});
test('apply（M1）: language-pack-ja に package.json が無い（フォルダだけある）ときも止まる', () => {
  const { r, rec } = runApplyOn({ langPack: (ext) => w(path.join(ext, 'language-pack-ja', 'README.md'), 'x') });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(rec?.stoppedAt?.id, 'language-pack-ja');
});
test('apply: package.json はあるが訳の束が無ければ、無いファイルの名前つきで止まる', () => {
  const { r, rec } = runApplyOn({ langPack: (ext) => w(path.join(ext, 'language-pack-ja', 'package.json'), manifestOf(['./dist/translations/main.i18n.json'])) });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(rec?.stoppedAt?.id, 'language-pack-ja');
  assert.match(rec.stoppedAt.message, /main\.i18n\.json/);
  assert.match(rec.stoppedAt.message, /訳の束/);
});
test('apply: mydist が無いと止まる（既存の動作。language-pack-ja より先に見る）', () => {
  const { r, rec } = runApplyOn({ withMydist: false, langPack: completePack });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(rec?.stoppedAt?.id, 'mydist');
});
test('apply: 束がそろった language-pack-ja は止まらず、写す一覧（dry-run）に入る。notion-sync が無くても止まらない', () => {
  const { r, rec } = runApplyOn({ langPack: completePack });
  assert.ok(rec, r.stderr);
  assert.equal(rec.stoppedAt, null, JSON.stringify(rec.stoppedAt));
  const copied = rec.builtinExtensions.copied.map((c) => c.name);
  assert.ok(copied.includes('mydist'));
  assert.ok(copied.includes('language-pack-ja'));
  assert.ok(!copied.includes('notion-sync'), 'notion-sync は package.json が無いので写さない');
  const lp = rec.builtinExtensions.copied.find((c) => c.name === 'language-pack-ja');
  assert.ok(lp.list.some((f) => /dist\/translations\/main\.i18n\.json$/.test(String(f.rel ?? f.path ?? f).replace(/\\/g, '/'))), JSON.stringify(lp.list).slice(0, 300));
});

// ---------------------------------------------------------------------------------------------------------------
// retiredNotes（置き換えた拡張の説明）
// ---------------------------------------------------------------------------------------------------------------
test('retiredNotes: 古い日本語パックの ID（大文字小文字を問わない）にだけ説明が付く。id と version は元のまま', () => {
  for (const id of ['MS-CEINTL.vscode-language-pack-ja', 'ms-ceintl.vscode-language-pack-ja', 'Ms-CeIntl.VSCode-Language-Pack-JA']) {
    const r = retiredNotes([{ id, version: '1.131.0' }]);
    assert.equal(r.length, 1, id);
    assert.equal(r[0].id, id);
    assert.equal(r[0].version, '1.131.0');
    assert.match(r[0].note, /shuko\.language-pack-ja/);
    assert.match(r[0].note, /--uninstall-extension MS-CEINTL\.vscode-language-pack-ja/);
  }
});
test('retiredNotes: ほかの拡張の ID には付かない（似た名前・別の言語のパック・サフィックスつきも付けない）', () => {
  const extra = [
    { id: 'anthropic.claude-code', version: '1' }, { id: 'ms-ceintl.vscode-language-pack-fr', version: '1' },
    { id: 'ms-ceintl.vscode-language-pack-ja.extra', version: '1' }, { id: 'x.language-pack-ja', version: '1' }, { id: 'shuko.language-pack-ja', version: '1' },
  ];
  assert.deepEqual(retiredNotes(extra), []);
});
test('retiredNotes: 混ざった一覧から該当だけを、順を保って返す。配列でない・null・id の無い項目は読み飛ばす', () => {
  const r = retiredNotes([{ id: 'a.b', version: '1' }, null, { version: '2' }, { id: 'MS-CEINTL.vscode-language-pack-ja', version: '1.131.0' }, undefined]);
  assert.deepEqual(r.map((x) => x.id), ['MS-CEINTL.vscode-language-pack-ja']);
  assert.deepEqual(retiredNotes(undefined), []);
  assert.deepEqual(retiredNotes(null), []);
  assert.deepEqual(retiredNotes({}), []);
  assert.deepEqual(retiredNotes([]), []);
});
test('RETIRED_EXTENSIONS: 鍵は小文字の ID。消す操作は説明の文にあるだけ（この道具は消さない）', () => {
  for (const k of Object.keys(RETIRED_EXTENSIONS)) assert.equal(k, k.toLowerCase());
  assert.ok(Object.isFrozen(RETIRED_EXTENSIONS));
  assert.ok(RETIRED_EXTENSIONS['ms-ceintl.vscode-language-pack-ja']);
});

// ---------------------------------------------------------------------------------------------------------------
// scripts/l10n-ja.mjs の部品
// ---------------------------------------------------------------------------------------------------------------
function cfgFile(name, cfg) { const f = path.join(sb, `${name}.json`); w(f, cfg); return f; }
const goodSrc = (over = {}) => ({ name: 'vl-a', kind: 'vscode-loc', commit: 'a'.repeat(40), files: { 'LICENSE.md': 'b'.repeat(64) }, ...over });

test('loadSourcesConfig: 今の sources.json が読める', () => {
  assert.ok(loadSourcesConfig(path.join(PACK, 'sources.json')).sources.length >= 1);
});
test('loadSourcesConfig: vscode-loc の commit が40桁でなければ誤り（短縮・大文字・長すぎ）', () => {
  for (const [i, commit] of ['e0407b9e', 'A'.repeat(40), 'a'.repeat(41), '', undefined].entries()) {
    assert.throws(() => loadSourcesConfig(cfgFile(`src-c${i}`, { sources: [goodSrc({ commit })] })), /40桁/, String(commit));
  }
  assert.ok(loadSourcesConfig(cfgFile('src-ok', { sources: [goodSrc()] })));
});
test('loadSourcesConfig: sources が無い・空、name の形が違う、vsix の sha256 と download が無い、知らない kind は誤り', () => {
  assert.throws(() => loadSourcesConfig(cfgFile('src-none', {})), /sources/);
  assert.throws(() => loadSourcesConfig(cfgFile('src-empty', { sources: [] })), /sources/);
  assert.throws(() => loadSourcesConfig(cfgFile('src-name', { sources: [goodSrc({ name: 'Bad Name' })] })), /name/);
  assert.throws(() => loadSourcesConfig(cfgFile('src-vsix', { sources: [{ name: 'v', kind: 'vsix', download: 'https://x/y.vsix', sha256: 'zz' }] })), /sha256/);
  assert.throws(() => loadSourcesConfig(cfgFile('src-vsix2', { sources: [{ name: 'v', kind: 'vsix', sha256: 'c'.repeat(64) }] })), /download/);
  assert.throws(() => loadSourcesConfig(cfgFile('src-kind', { sources: [goodSrc({ kind: 'ftp' })] })), /kind/);
  assert.ok(loadSourcesConfig(cfgFile('src-vsix-ok', { sources: [{ name: 'v', kind: 'vsix', download: 'https://x/y.vsix', sha256: 'c'.repeat(64) }] })));
});
test('sourceCacheDir: vscode-loc は vl-<commit の先頭12>、vsix は vsix-<sha256 の先頭12>（短い名前。長いパスが無効な PC のため）', () => {
  assert.equal(sourceCacheDir('R', goodSrc()), path.join('R', `vl-${'a'.repeat(12)}`));
  assert.equal(sourceCacheDir('R', { kind: 'vsix', sha256: 'c'.repeat(64) }), path.join('R', `vsix-${'c'.repeat(12)}`));
});
test('layerFromPackFiles: main.i18n.json と translations/extensions/<ID>.i18n.json から層を作る。package・bundle が無ければ空', () => {
  const files = {
    'translations/main.i18n.json': '{"contents":{"vs/a":{"k":"あ"}}}',
    'translations/extensions/vscode.git.i18n.json': '{"contents":{"package":{"p":"ぱ"}}}',
    'translations/extensions/vscode.x.i18n.json': '{"contents":{"bundle":{"b":"び"}}}',
  };
  const layer = layerFromPackFiles('L', ['LICENSE.md', ...Object.keys(files).filter((f) => f !== 'translations/main.i18n.json'), 'translations/other.json'], (rel) => files[rel] ?? null);
  assert.equal(layer.name, 'L');
  assert.deepEqual(layer.core, { 'vs/a': { k: 'あ' } });
  assert.deepEqual(layer.extensions, { 'vscode.git': { package: { p: 'ぱ' }, bundle: {} }, 'vscode.x': { package: {}, bundle: { b: 'び' } } });
});
test('layerFromPackFiles: main.i18n.json が無ければ誤り。BOM つきの JSON も読める', () => {
  assert.throws(() => layerFromPackFiles('L', [], () => null), /main\.i18n\.json/);
  const layer = layerFromPackFiles('L', [], (rel) => (rel === 'translations/main.i18n.json' ? '﻿{"contents":{"m":{"k":"v"}}}' : null));
  assert.equal(layer.core.m.k, 'v');
});
test('l10nDependencyNames: @vscode/* と vscode-* の dependencies だけを、重複なく名前の順に返す（devDependencies は見ない）', () => {
  const r = l10nDependencyNames([
    { dependencies: { '@vscode/extension-telemetry': '1', 'vscode-uri': '1', lodash: '1', 'vscodex-no': '1' }, devDependencies: { 'vscode-dev': '1' } },
    { dependencies: { 'vscode-uri': '2', '@vscode/l10n': '1' } },
    {}, null,
  ]);
  assert.deepEqual(r, ['@vscode/extension-telemetry', '@vscode/l10n', 'vscode-uri']);
});
test('translationsList: vscode を先頭に、訳のある拡張だけを ID の順に並べる（束が空の拡張は載せない）。path は ./dist/translations/…', () => {
  const pack = { core: {}, extensions: { 'b.x': { package: { a: '1' }, bundle: {} }, 'a.y': { package: {}, bundle: { k: 'v' } }, 'c.empty': { package: {}, bundle: {} } } };
  assert.deepEqual(translationsList(pack), [
    { id: 'vscode', path: './dist/translations/main.i18n.json' },
    { id: 'a.y', path: './dist/translations/extensions/a.y.i18n.json' },
    { id: 'b.x', path: './dist/translations/extensions/b.x.i18n.json' },
  ]);
});
test('translationsList: 今のパックの package.json の translations と同じ（作り直しても package.json が変わらない）', () => {
  const pack = readBuiltPack(PACK);
  assert.deepEqual(translationsList(pack), loc.translations);
});
test('readBuiltPack: package.json の translations が指す所から読む。ja の localizations が無ければ誤り', () => {
  const pack = readBuiltPack(PACK);
  assert.ok(Object.keys(pack.core).length > 1000);
  assert.ok(pack.extensions['vscode.git']?.package && pack.extensions['vscode.git']?.bundle);
  const d = makePack('rb-noja', { manifest: { contributes: { localizations: [{ languageId: 'fr', translations: [] }] } } });
  assert.throws(() => readBuiltPack(d), /ja の localizations/);
});

// resolveInput
const STR = () => ({
  core: { 'vs/a': { k1: 'Open', 'dup': 'Same' }, 'vs/b': { dup: 'Same' } },
  extensions: { 'vscode.git': { package: { p: 'Pull {0}' }, bundle: { 'Fetch': 'Fetch' } }, 'shuko.mydist': { package: {}, bundle: {}, literal: { displayName: 'Shuko' } } },
});
test('resolveInput: owner#key を文言の表で引き、場所（area）と英語を決める。override は override: true になる', () => {
  const r = resolveInput(STR(), { translate: { 'vs/a#k1': '開く', 'vscode.git#p': '{0} を取得' }, override: { 'vscode.git#Fetch': 'フェッチ' }, exclude: { 'vs/b#dup': { reason: 'format', note: 'n' } } });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.translate.map((t) => [t.area, t.owner, t.key, t.en, t.ja, t.override]), [
    ['core', 'vs/a', 'k1', 'Open', '開く', false],
    ['package', 'vscode.git', 'p', 'Pull {0}', '{0} を取得', false],
    ['bundle', 'vscode.git', 'Fetch', 'Fetch', 'フェッチ', true],
  ]);
  assert.deepEqual(r.exclude.map((t) => [t.area, t.owner, t.key, t.en, t.reason, t.note]), [['core', 'vs/b', 'dup', 'Same', 'format', 'n']]);
});
test('resolveInput: 当たる行が0件なら誤り', () => {
  const r = resolveInput(STR(), { translate: { 'vs/a#nosuch': '訳' } });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /0 件/);
  assert.deepEqual(r.translate, []);
});
test('resolveInput: 当たる行が2件以上（owner#key が同じ別の area）なら誤り', () => {
  const s = { core: {}, extensions: { 'x.y': { package: { same: 'A' }, bundle: { same: 'A' } } } };
  const r = resolveInput(s, { translate: { 'x.y#same': '訳' } });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /2 件/);
});
test('resolveInput: 自前の拡張の直書き（literal）には訳を足せない', () => {
  const r = resolveInput(STR(), { translate: { 'shuko.mydist#displayName': '日本語' } });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /直書き/);
  assert.deepEqual(r.translate, []);
});
test('resolveInput: 訳が空・文字列でない、置き換えの印が合わないものは誤り（印が合う訳は通る）', () => {
  const r1 = resolveInput(STR(), { translate: { 'vs/a#k1': '' } });
  assert.match(r1.errors.join(), /空/);
  const r2 = resolveInput(STR(), { translate: { 'vscode.git#p': '取得' } });
  assert.match(r2.errors.join(), /印/);
  assert.match(r2.errors.join(), /\{0\}/);
  const r3 = resolveInput(STR(), { translate: { 'vscode.git#p': '{0} と {1} を取得' } });
  assert.match(r3.errors.join(), /印/);
  assert.deepEqual(resolveInput(STR(), { translate: { 'vscode.git#p': '{0} を取得' } }).errors, []);
});
test('resolveInput: 入力が空でも例外にならない', () => {
  assert.deepEqual(resolveInput(STR(), {}), { translate: [], exclude: [], errors: [] });
});
test('resolveInput: 文言の表の flattenStrings と同じ area を使う（本体は core）', () => {
  const flat = flattenStrings(STR());
  const r = resolveInput(STR(), { exclude: { 'vs/a#k1': { reason: 'r' } } });
  assert.equal(r.exclude[0].area, flat.find((t) => t.owner === 'vs/a' && t.key === 'k1').area);
});

// count（CLI。パックを作り直さずに数える。added/*.json の印の照らしも出す）
function runCount(strings, name) {
  const f = path.join(sb, `${name}.json`);
  w(f, strings);
  const r = runNode(['scripts/l10n-ja.mjs', 'count', '--strings', f]);
  const i = r.stdout.search(/^\{/m);
  return { status: r.status, out: i >= 0 ? JSON.parse(r.stdout.slice(i)) : null, stderr: r.stderr };
}
test('count（CLI）: パックに訳のある文言だけの表なら終了コード 0・result ok。足した訳の印の問題（placeholderProblems）は []', () => {
  const pack = readBuiltPack(PACK);
  const [mod, keys] = Object.entries(pack.core)[0];
  const [k] = Object.keys(keys);
  const r = runCount({ core: { [mod]: { [k]: 'English of this one' } }, extensions: {} }, 'count-ok');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.out.result, 'ok');
  assert.equal(r.out.untranslated, 0);
  assert.deepEqual(r.out.placeholderProblems, []);
});
test('count（CLI）: パックにも除外にも無い文言があれば終了コード 5・result untranslated', () => {
  const r = runCount({ core: { 'vs/test/only-in-test': { someKey: 'A string nobody translated' } }, extensions: {} }, 'count-untr');
  assert.equal(r.status, 5, r.stderr);
  assert.equal(r.out.result, 'untranslated');
  assert.equal(r.out.untranslated, 1);
});
test('count（CLI）: 除外（exclusions.json）にある文言は、英語が同じなら除外に数えて終了コード 0。英語が違えば未訳で 5', () => {
  const ex = readJson(path.join(PACK, 'exclusions.json')).exclusions.find((e) => e.module);
  const same = runCount({ core: { [ex.module]: { [ex.key]: ex.en } }, extensions: {} }, 'count-ex-same');
  assert.equal(same.status, 0, same.stderr);
  assert.equal(same.out.excluded, 1);
  const changed = runCount({ core: { [ex.module]: { [ex.key]: `${ex.en} (new wording)` } }, extensions: {} }, 'count-ex-changed');
  assert.equal(changed.status, 5, changed.stderr);
  assert.equal(changed.out.untranslated, 1);
});
test('count（CLI）: added/ に置き換えの印の合わない訳があれば、終了コード 1・result placeholder・placeholderProblems に出る（未訳が 0 でも）', () => {
  // scripts と language-pack-ja の写しを入れ物に作り、そこへ悪い足した訳を置く（リポジトリは変えない）
  const clone = path.join(sb, 'count-clone');
  fs.cpSync(path.join(REPO, 'scripts'), path.join(clone, 'scripts'), { recursive: true });
  fs.cpSync(PACK, path.join(clone, 'extensions-src', 'language-pack-ja'), { recursive: true });
  w(path.join(clone, 'extensions-src', 'language-pack-ja', 'added', '9.9.9.json'), {
    version: '9.9.9', core: { 'vs/test/m': { k: { en: 'Open {0} and {0}', ja: '{0} を開く' } } }, extensions: {},
  });
  const strings = path.join(sb, 'count-clone-strings.json');
  w(strings, { core: {}, extensions: {} });
  const r = runNode([path.join(clone, 'scripts', 'l10n-ja.mjs'), 'count', '--strings', strings], { cwd: clone });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout.slice(r.stdout.search(/^\{/m)));
  assert.equal(out.result, 'placeholder');
  assert.equal(out.untranslated, 0);
  assert.equal(out.placeholderProblems.length, 1);
  assert.equal(out.placeholderProblems[0].version, '9.9.9');
  assert.equal(out.placeholderProblems[0].key, 'k');
  assert.deepEqual(out.placeholderProblems[0].missing, ['{0}']);
});
test('count（CLI）: --strings が無ければ誤り（終了コード 1）', () => {
  const r = runNode(['scripts/l10n-ja.mjs', 'count']);
  assert.equal(r.status, 1);
});

// loadAdded
test('loadAdded: 版の数値の順に読む（1.9.0 < 1.10.0）。ファイル名と version が違う・形が誤りなら誤り。無い入れ物は空', () => {
  const dir = path.join(sb, 'added-ok');
  const mk = (v) => ({ version: v, core: { m: { k: { en: 'E', ja: '訳' } } } });
  for (const v of ['1.10.0', '1.9.0', '1.146.0']) w(path.join(dir, `${v}.json`), mk(v));
  w(path.join(dir, 'README.json'), '{}'); // 版の名前でないファイルは読まない
  assert.deepEqual(loadAdded(dir).map((a) => a.version), ['1.9.0', '1.10.0', '1.146.0']);
  assert.deepEqual(loadAdded(path.join(sb, 'no-added-dir')), []);
  const bad1 = path.join(sb, 'added-name');
  w(path.join(bad1, '1.0.0.json'), mk('1.0.1'));
  assert.throws(() => loadAdded(bad1), /ファイルの名前/);
  const bad2 = path.join(sb, 'added-shape');
  w(path.join(bad2, '1.0.0.json'), { version: '1.0.0', core: { m: { k: { en: 'E', ja: '' } } } });
  assert.throws(() => loadAdded(bad2), /ja/);
});
test('loadExclusions（scripts）: 無いファイルは空。理由が reasons に無ければ誤り', () => {
  assert.deepEqual(loadExclusions(path.join(sb, 'nowhere.json')), { reasons: {}, exclusions: [] });
  const f = cfgFile('ex-bad', { reasons: { r: 'x' }, exclusions: [{ module: 'm', key: 'k', en: 'E', reason: 'nope' }] });
  assert.throws(() => loadExclusions(f), /reasons/);
});
