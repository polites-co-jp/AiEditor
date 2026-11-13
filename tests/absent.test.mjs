// 「消えている」の検査の判定部分（tests/removals/lib/absent.mjs）と台本の引数（run-absent.mjs）の単体テスト。
// 仕様: docs/03 の3.1（checks）・7節の3。
// Run: node --test tests/absent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTargets, evaluateAbsent, isProcessPresent, isViewPresent, summarize } from './removals/lib/absent.mjs';
import { loadUnitChecks, parseArgs } from './removals/run-absent.mjs';

const SNAP = {
  commands: ['workbench.action.files.save', 'workbench.action.debug.start', 'workbench.view.debug', 'workbench.view.explorer.focus'],
  settings: { 'debug.console.fontSize': true, 'editor.fontSize': true, 'chat.agent.enabled': false },
  processes: [{ Name: 'Code.exe', CommandLine: '"Code.exe" --type=renderer' }, { Name: 'copilot-runtime.exe', CommandLine: 'copilot-runtime.exe' }],
};

test('absentCommands: 在るコマンドは absent では fail、present では pass', () => {
  const c = { absentCommands: ['workbench.action.debug.start'] };
  assert.equal(evaluateAbsent(c, SNAP)[0].status, 'fail');
  assert.equal(evaluateAbsent(c, SNAP, { expect: 'present' })[0].status, 'pass');
});

test('absentCommands: 無いコマンドは absent では pass、present では fail', () => {
  const c = { absentCommands: ['workbench.action.nothing'] };
  assert.equal(evaluateAbsent(c, SNAP)[0].status, 'pass');
  assert.equal(evaluateAbsent(c, SNAP, { expect: 'present' })[0].status, 'fail');
});

test('absentCommands: 前方一致・部分一致では在るとしない（完全一致）', () => {
  assert.equal(evaluateAbsent({ absentCommands: ['workbench.action.debug'] }, SNAP)[0].status, 'pass');
  assert.equal(evaluateAbsent({ absentCommands: ['workbench.action.debug.start.x'] }, SNAP)[0].status, 'pass');
});

test('absentViews: ビュー ID 自身か <id>.focus のコマンドがあれば在る', () => {
  assert.equal(isViewPresent('workbench.view.debug', SNAP.commands), true);
  assert.equal(isViewPresent('workbench.view.explorer', SNAP.commands), true);
  assert.equal(isViewPresent('workbench.view.outline', SNAP.commands), false);
  const r = evaluateAbsent({ absentViews: ['workbench.view.debug', 'workbench.view.outline'] }, SNAP);
  assert.deepEqual(r.map((x) => x.status), ['fail', 'pass']);
});

test('absentSettings: 登録されている設定は在る。調べていない設定は unknown（pass にしない）', () => {
  const r = evaluateAbsent({ absentSettings: ['debug.console.fontSize', 'chat.agent.enabled', 'never.asked'] }, SNAP);
  assert.deepEqual(r.map((x) => x.status), ['fail', 'pass', 'unknown']);
});

test('absentProcesses: 名前かコマンドラインの断片（大文字小文字を区別しない）', () => {
  assert.equal(isProcessPresent('COPILOT-runtime', SNAP.processes), true);
  assert.equal(isProcessPresent('js-debug', SNAP.processes), false);
  assert.equal(evaluateAbsent({ absentProcesses: ['copilot-runtime'] }, SNAP)[0].status, 'fail');
});

test('取れていない項目（snapshot に commands / processes が無い）は unknown', () => {
  const r = evaluateAbsent({ absentCommands: ['a'], absentViews: ['v'], absentProcesses: ['p'] }, {});
  assert.deepEqual(r.map((x) => x.status), ['unknown', 'unknown', 'unknown']);
});

test('absentStrings・absentHosts は、この検査の対象にしない（結果に出ない）', () => {
  const r = evaluateAbsent({ absentStrings: [{ in: ['src/vs'], text: 'x' }], absentHosts: ['example.com'] }, SNAP);
  assert.deepEqual(r, []);
});

test('空の checks は結果が空。expect が不正なら Error', () => {
  assert.deepEqual(evaluateAbsent({}, SNAP), []);
  assert.deepEqual(evaluateAbsent(undefined, SNAP), []);
  assert.throws(() => evaluateAbsent({}, SNAP, { expect: 'maybe' }));
});

test('summarize: fail があれば ok=false。unknown は strict のときだけ失敗', () => {
  const rs = (...st) => st.map((status) => ({ status }));
  assert.deepEqual(summarize(rs('pass', 'pass')), { pass: 2, fail: 0, unknown: 0, ok: true });
  assert.equal(summarize(rs('pass', 'fail')).ok, false);
  assert.equal(summarize(rs('pass', 'unknown')).ok, true);
  assert.equal(summarize(rs('pass', 'unknown'), { strict: true }).ok, false);
});

test('collectTargets: 単位をまたいで重複を除き、並べて返す', () => {
  const t = collectTargets([{ absentSettings: ['b', 'a'], absentCommands: ['x'] }, { absentSettings: ['a'], absentProcesses: ['p'] }, undefined]);
  assert.deepEqual(t, { commands: ['x'], views: [], settings: ['a', 'b'], processes: ['p'] });
});

test('parseArgs: 既定は公式の zip・absent。--cmd などは繰り返せる', () => {
  const o = parseArgs(['--cmd', 'a', '--cmd', 'b', '--setting', 's', '--expect', 'present', '--units', 'A-1-x,A-2-y']);
  assert.match(o.build, /vscode-1\.146\.0$/);
  assert.equal(o.expect, 'present');
  assert.deepEqual(o.adhoc.absentCommands, ['a', 'b']);
  assert.deepEqual(o.adhoc.absentSettings, ['s']);
  assert.deepEqual(o.units, ['A-1-x', 'A-2-y']);
});

test('parseArgs: 知らないオプション・値の欠け・不正な expect は Error', () => {
  assert.throws(() => parseArgs(['--nope']));
  assert.throws(() => parseArgs(['--cmd']));
  assert.throws(() => parseArgs(['--expect', 'x']));
  assert.throws(() => parseArgs(['--timeout', '0']));
});

test('loadUnitChecks: 単位が無ければ Error。ids が空なら []', () => {
  assert.deepEqual(loadUnitChecks([]), []);
  assert.throws(() => loadUnitChecks(['Z-9-none'], 'C:\\no\\such\\dir'));
});
