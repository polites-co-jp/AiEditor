// インストールの手順書（tasks/2026-11-15-install-doc/install-draft.md）が頼る台本のふるまいのテスト。
// 仕様: tasks/2026-11-15-install-doc/handoff-notes.md の「曹参へ（テストが要る点）」、docs/02 の6節・6.1。
//  - configure.ps1 の手順5: 「プログラム」フォルダの直下の .lnk を向け直す。サブフォルダは見ない。PATH の %LOCALAPPDATA% の形も一致する。
//  - labelToVersion('1.146.0-p2-all') は null。currentCoreVersion は upstream.json のタグに戻る。
// 本物のスタートメニュー・PATH・レジストリには触れない（一時の場所と偽の入力だけ）。
// Run: node --test tests/install-doc.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { labelToVersion } from '../tools/watch/lib/judge.mjs';
import { currentCoreVersion } from '../tools/watch/watch.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-installdoc-');
});
after(() => removeSandbox(sb));

const CONFIGURE = path.join(REPO, 'scripts', 'configure.ps1');
const PATH_PROBE = path.join(REPO, 'tests', 'build', 'path-entries-probe.ps1');
const LNK_PROBE = path.join(REPO, 'tests', 'build', 'shortcut-probe.ps1');

// ---- PATH: %LOCALAPPDATA% の形 --------------------------------------------------------------
test('Update-PathEntries: %LOCALAPPDATA%\\Programs\\Shuko\\current\\bin の形の項目を、展開した前の bin と一致させて置き換える', () => {
  const fakeLocal = path.join(sb, 'LocalAppData');
  const oldBin = path.join(fakeLocal, 'Programs', 'Shuko', 'current', 'bin');
  const cases = [
    { raw: '%LOCALAPPDATA%\\Programs\\Shuko\\current\\bin;C:\\x', old: oldBin, new: 'D:\\S\\current\\bin', env: { LOCALAPPDATA: fakeLocal } },
    // 大文字小文字違いの変数名と、末尾の \ でも一致する
    { raw: 'C:\\x;%localappdata%\\Programs\\Shuko\\current\\bin\\', old: oldBin, new: 'D:\\S\\current\\bin', env: { LOCALAPPDATA: fakeLocal } },
    // 別の場所の LOCALAPPDATA なら一致しない（null）
    { raw: '%LOCALAPPDATA%\\Programs\\Shuko\\current\\bin;C:\\x', old: oldBin, new: 'D:\\S\\current\\bin', env: { LOCALAPPDATA: path.join(sb, 'Other') } },
  ];
  const file = path.join(sb, 'path-local-cases.json');
  writeFile(file, JSON.stringify(cases));
  const r = runPs(PATH_PROBE, ['-ScriptPath', CONFIGURE, '-CasesPath', file]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.equal(out[0].result, 'D:\\S\\current\\bin;C:\\x');
  assert.equal(out[1].result, 'C:\\x;D:\\S\\current\\bin');
  assert.equal(out[2].result, null);
});

// ---- ショートカットの向け直し（手順5）--------------------------------------------------------
test('configure.ps1 手順5: 「プログラム」の直下の .lnk だけを向け直す。サブフォルダの .lnk と、前の current の外を指す .lnk は変えない', () => {
  const programs = path.join(sb, 'trial-programs');
  const oldRoot = path.join(sb, 'old');
  const newRoot = path.join(sb, 'new');
  const oc = path.join(oldRoot, 'current');
  const spec = [
    { rel: 'Shuko.lnk', target: path.join(oc, 'Shuko.exe'), workdir: oc },
    { rel: 'Shuko Bin.lnk', target: path.join(oc, 'bin', 'shuko.cmd') },
    { rel: path.join('Sub', 'Shuko in Sub.lnk'), target: path.join(oc, 'Shuko.exe') },
    { rel: 'Other.lnk', target: path.join(sb, 'elsewhere', 'Other.exe') },
    { rel: 'Similar.lnk', target: path.join(oldRoot, 'current2', 'Shuko.exe') },
  ];
  const specFile = path.join(sb, 'lnk-spec.json');
  writeFile(specFile, JSON.stringify(spec));
  const r = runPs(LNK_PROBE, ['-ScriptPath', CONFIGURE, '-ProgramsDir', programs, '-SpecPath', specFile, '-OldRoot', oldRoot, '-NewRoot', newRoot]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  const by = Object.fromEntries(out.shortcuts.map((s) => [s.rel, s]));
  const nc = path.join(newRoot, 'current');
  const eq = (a, b) => assert.equal(String(a).toLowerCase(), String(b).toLowerCase());
  eq(by['Shuko.lnk'].target, path.join(nc, 'Shuko.exe'));
  eq(by['Shuko.lnk'].workdir, nc);
  eq(by['Shuko Bin.lnk'].target, path.join(nc, 'bin', 'shuko.cmd'));
  eq(by[path.join('Sub', 'Shuko in Sub.lnk')].target, path.join(oc, 'Shuko.exe'));
  eq(by['Other.lnk'].target, path.join(sb, 'elsewhere', 'Other.exe'));
  eq(by['Similar.lnk'].target, path.join(oldRoot, 'current2', 'Shuko.exe'));
  const shortcutUndo = out.undo.filter((u) => u.kind === 'shortcut');
  assert.equal(shortcutUndo.length, 2, '戻しの記録は向け直した2つだけ');
  assert.equal(out.actions.filter((a) => a.startsWith('shortcut ')).length, 2);
});

// ---- ラベルの形 ------------------------------------------------------------------------------
test("labelToVersion('1.146.0-p2-all') は null（x.y.z か x.y.z-N の形だけ読む）", () => {
  assert.equal(labelToVersion('1.146.0-p2-all'), null);
  assert.equal(labelToVersion('1.146.0-1'), '1.146.0');
  assert.equal(labelToVersion('1.146.0-'), null);
  assert.equal(labelToVersion('v1.146.0'), null);
});

test("currentCoreVersion: current の指す先が '1.146.0-p2-all' なら読めず、upstream.json のタグに戻る", () => {
  const seen = [];
  const realpath = (p) => {
    seen.push(p);
    return 'C:\\i\\versions\\1.146.0-p2-all';
  };
  const r = currentCoreVersion('C:\\i', '1.146.0', { realpath });
  assert.deepEqual(r, { version: '1.146.0', label: null, source: 'upstream.json' });
  assert.equal(seen.length, 1, 'current は読みに行った');
  // 読めるラベルなら current から
  const ok = currentCoreVersion('C:\\i', '1.146.0', { realpath: () => 'C:\\i\\versions\\1.146.0-1' });
  assert.deepEqual(ok, { version: '1.146.0', label: '1.146.0-1', source: 'current' });
  // 両方読めなければ投げる
  assert.throws(() => currentCoreVersion('C:\\i', 'weird', { realpath }), /今の版を決められない/);
});
