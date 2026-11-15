// compareLockfile（scripts/lib/apply/lockfile.mjs）の patchedDependencies の扱い。
// 仕様: docs/03 の5.4（2026-11-15 に足した最後の2文）と docs/user-decisions.md の 2026-11-15 の項。
//   単位が pnpm-workspace.yaml の patchedDependencies の行を消したとき、ロックファイルの patchedDependencies の節は
//   その名前の分だけ減る。検査はこの減り方だけを許す。ほかの名前が減る・増える、残る名前の中身が変わる、ほかの節が変わるのは止める。
// 入口（蒙恬の3回目で決まった形。最初は仕様だけから書き、キー名を複数試す形にしていた）:
//   compareLockfile(before, after, { removedPatches: [名前...] })。結果に removedPatches・unexpectedPatchChanges が載る。
//   expectedLockRemovals(lockDir, importers, units) は、単位の removeLines のうち pnpm-workspace.yaml の「名前: パス.patch」の行から removedPatches を作る。
// Run: node --test tests/lockfile-patched.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareLockfile, expectedLockRemovals, patchNameFromWorkspaceLine } from '../scripts/lib/apply/lockfile.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['removedPatches'];

const PATCHES = {
  'foundry-local-sdk': { hash: 'aaaaaaaa', path: 'build/npm/patches/foundry-local-sdk.patch' },
  'other-lib': { hash: 'bbbbbbbb', path: 'build/npm/patches/other-lib.patch' },
};

const LOCK = ({ patched = PATCHES, settings = 'autoInstallPeers: true', dep = '4.17.21' } = {}) => [
  "lockfileVersion: '9.0'",
  '',
  'settings:',
  `  ${settings}`,
  '',
  ...(Object.keys(patched).length
    ? ['patchedDependencies:', ...Object.entries(patched).flatMap(([n, v]) => [`  ${n}:`, `    hash: ${v.hash}`, `    path: ${v.path}`]), '']
    : []),
  'importers:',
  '',
  '  .:',
  '    dependencies:',
  '      lodash:',
  '        specifier: ^4.17.21',
  `        version: ${dep}`,
  '',
  'packages:',
  '',
  "  'lodash@4.17.21':",
  '    resolution: {integrity: sha512-x}',
  '',
  'snapshots:',
  '',
  "  'lodash@4.17.21': {}",
  '',
].join('\n');

const only = (names, obj = PATCHES) => Object.fromEntries(Object.entries(obj).filter(([n]) => names.includes(n)));

/** 候補のキー名のどれかで expected を渡して、判定が want になるキーがあるか。見つかったキー名を返す。 */
function acceptedKey(before, after, names, want) {
  for (const k of KEYS) {
    const r = compareLockfile(before, after, { [k]: names });
    if (r.ok === want && (want === false || r.changedSections.every((s) => s !== 'patchedDependencies'))) return k;
  }
  return null;
}

test('lockfile/patched: 単位が消したパッチ1つの分だけ節が減るのは許す（残る名前は同じ）', () => {
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']) });
  const k = acceptedKey(before, after, ['foundry-local-sdk'], true);
  assert.ok(k, '節が1つ減るのを許す expected のキーが見つからない（compareLockfile が patchedDependencies の減りを許していない）');
});

test('lockfile/patched: 節ごと無くなる（最後の1つを消した）のも、その名前なら許す', () => {
  const before = LOCK({ patched: only(['foundry-local-sdk']) });
  const after = LOCK({ patched: {} });
  assert.ok(acceptedKey(before, after, ['foundry-local-sdk'], true), '節が無くなるのを許していない');
});

test('lockfile/patched: 消したと宣言していない名前が減ったら止める', () => {
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']) });
  // 宣言なし
  assert.equal(compareLockfile(before, after, {}).ok, false);
  assert.ok(compareLockfile(before, after, {}).changedSections.includes('patchedDependencies'));
  // 別の名前を宣言
  for (const k of KEYS) assert.equal(compareLockfile(before, after, { [k]: ['other-lib'] }).ok, false, `${k}: 宣言と違う名前の減りを許した`);
});

test('lockfile/patched: 宣言した名前のほかにも減っていたら止める', () => {
  const before = LOCK();
  const after = LOCK({ patched: {} });
  for (const k of KEYS) assert.equal(compareLockfile(before, after, { [k]: ['foundry-local-sdk'] }).ok, false, `${k}: 2つ減ったのに1つの宣言で許した`);
});

test('lockfile/patched: 名前が増えたら、宣言があっても止める', () => {
  const before = LOCK({ patched: only(['other-lib']) });
  const after = LOCK();
  for (const k of KEYS) assert.equal(compareLockfile(before, after, { [k]: ['foundry-local-sdk'] }).ok, false, `${k}: 増えるのを許した`);
  assert.equal(compareLockfile(before, after, {}).ok, false);
});

test('lockfile/patched: 残る名前の中身（hash・path）が変わったら止める', () => {
  const before = LOCK();
  const changed = { ...only(['other-lib']), 'other-lib': { hash: 'cccccccc', path: PATCHES['other-lib'].path } };
  const after = LOCK({ patched: changed });
  for (const k of KEYS) assert.equal(compareLockfile(before, after, { [k]: ['foundry-local-sdk'] }).ok, false, `${k}: 残る名前の hash の変更を許した`);
  const movedPath = { 'other-lib': { hash: PATCHES['other-lib'].hash, path: 'build/npm/patches/moved.patch' } };
  for (const k of KEYS) assert.equal(compareLockfile(before, LOCK({ patched: movedPath }), { [k]: ['foundry-local-sdk'] }).ok, false, `${k}: path の変更を許した`);
});

test('lockfile/patched: 宣言があっても、ほかの節（settings）が変われば止める。changedSections に出る', () => {
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']), settings: 'autoInstallPeers: false' });
  for (const k of KEYS) {
    const r = compareLockfile(before, after, { [k]: ['foundry-local-sdk'] });
    assert.equal(r.ok, false, `${k}: settings の変更を許した`);
    assert.ok(r.changedSections.includes('settings'), `${k}: changedSections に settings が無い`);
  }
});

test('lockfile/patched: 宣言があっても、残る依存の版が変われば止める（今までどおり）', () => {
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']), dep: '4.17.22' });
  for (const k of KEYS) {
    const r = compareLockfile(before, after, { [k]: ['foundry-local-sdk'] });
    assert.equal(r.ok, false);
    assert.equal(r.changedDeps.length, 1);
  }
});

test('lockfile/patched: 宣言があっても何も減っていなければ ok（宣言は許可で、要求ではない）', () => {
  const before = LOCK();
  const hit = KEYS.filter((k) => compareLockfile(before, LOCK(), { [k]: ['foundry-local-sdk'] }).ok);
  assert.ok(hit.length >= 1, '同じ内容なのに、宣言つきで ok にならない');
});

test('lockfile/patched: 宣言が無く何も変わらなければ、今までどおり ok', () => {
  assert.equal(compareLockfile(LOCK(), LOCK(), {}).ok, true);
  assert.equal(compareLockfile(LOCK(), LOCK(), undefined).ok, true);
});

test('lockfile/patched: 節が減ったのを許しても、パッケージ・スナップショットの増加は止める', () => {
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']) }).replace("  'lodash@4.17.21': {}\n", "  'lodash@4.17.21': {}\n\n  'new@1.0.0': {}\n");
  for (const k of KEYS) assert.equal(compareLockfile(before, after, { [k]: ['foundry-local-sdk'] }).ok, false);
});

test('lockfile/patched: 宣言が無いままの節の減りは fail で、理由は changedSections の patchedDependencies だけ', () => {
  // 蒙恬の2回目の記録（round2-lockfile.diff）と同じ形。単位が消したと宣言して初めて ok になる。
  const before = LOCK();
  const after = LOCK({ patched: only(['other-lib']) });
  const r = compareLockfile(before, after, {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.changedSections, ['patchedDependencies']);
  assert.deepEqual(r.unexpectedRemovedDeps, []);
  assert.deepEqual(r.addedDeps, []);
  assert.deepEqual(r.changedDeps, []);
  assert.deepEqual(r.addedPackages, []);
});

test('lockfile/patched: expectedLockRemovals は引き続き removedImporters・removedDeps を返す（形を壊さない）', () => {
  const r = expectedLockRemovals('', ['.'], [{ delete: [], removeDependencies: { 'package.json': ['x'] } }]);
  assert.deepEqual(r.removedImporters, []);
  assert.deepEqual(r.removedDeps, { '.': ['x'] });
});

test('lockfile/patched: 結果に removedPatches（減った名前）と unexpectedPatchChanges（許さない変化）が載る', () => {
  const r = compareLockfile(LOCK(), LOCK({ patched: only(['other-lib']) }), { removedPatches: ['foundry-local-sdk'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.removedPatches, ['foundry-local-sdk']);
  assert.deepEqual(r.unexpectedPatchChanges, []);
  const ng = compareLockfile(LOCK(), LOCK({ patched: only(['other-lib']) }), {});
  assert.deepEqual(ng.unexpectedPatchChanges, [{ name: 'foundry-local-sdk', change: 'removed' }]);
});

test('lockfile/patched: patchNameFromWorkspaceLine は「名前: パス.patch」の行から名前を返し、見出しや別の行は null', () => {
  assert.equal(patchNameFromWorkspaceLine('foundry-local-sdk: build/npm/patches/foundry-local-sdk.patch'), 'foundry-local-sdk');
  assert.equal(patchNameFromWorkspaceLine('  foundry-local-sdk: build/npm/patches/foundry-local-sdk.patch'), 'foundry-local-sdk');
  assert.equal(patchNameFromWorkspaceLine("'@scope/pkg': build/npm/patches/pkg.patch"), '@scope/pkg');
  assert.equal(patchNameFromWorkspaceLine('patchedDependencies:'), null);
  assert.equal(patchNameFromWorkspaceLine('- src/vs/sessions/test/e2e'), null);
  assert.equal(patchNameFromWorkspaceLine(undefined), null);
});

test('lockfile/patched: expectedLockRemovals は pnpm-workspace.yaml の removeLines から removedPatches を作る（そのフォルダの分だけ）', () => {
  const units = [{ delete: [], removeLines: [
    { file: 'pnpm-workspace.yaml', line: 'patchedDependencies:' },
    { file: 'pnpm-workspace.yaml', line: '  foundry-local-sdk: build/npm/patches/foundry-local-sdk.patch' },
    { file: 'remote/pnpm-workspace.yaml', line: '  remote-only: x/remote-only.patch' },
    { file: 'package.json', line: '"a": "b.patch",' },
  ] }];
  assert.deepEqual(expectedLockRemovals('', ['.'], units).removedPatches, ['foundry-local-sdk']);
  assert.deepEqual(expectedLockRemovals('remote', ['.'], units).removedPatches, ['remote-only']);
  assert.deepEqual(expectedLockRemovals('', ['.'], [{ delete: [] }]).removedPatches, []);
});

test('lockfile/patched: 実際の C-1 の unit.json から、removedPatches が foundry-local-sdk だけになる。パッチのファイルも delete にある', () => {
  const f = join(REPO, 'removals', 'C-1-ai', 'unit.json');
  if (!existsSync(f)) return;
  const unit = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
  assert.deepEqual(expectedLockRemovals('', ['.'], [unit]).removedPatches, ['foundry-local-sdk']);
  assert.ok((unit.delete ?? []).includes('build/npm/patches/foundry-local-sdk.patch'));
});
