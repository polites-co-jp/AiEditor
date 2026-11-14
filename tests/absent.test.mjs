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

// ---- manifest の網（起動しない拡張のコマンドも見る）----
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { collectManifest, manifestOf } from './removals/lib/absent.mjs';

test('manifestOf: commands・menus・keybindings・views・viewsContainers・configuration（配列も）を集める', () => {
  const m = manifestOf({ contributes: {
    commands: [{ command: 'a.cmd' }],
    menus: { 'view/title': [{ command: 'a.menu' }], commandPalette: [{ command: 'a.cmd' }] },
    keybindings: [{ command: '-a.unbound' }, { command: 'a.key' }],
    views: { explorer: [{ id: 'a.view' }] },
    viewsContainers: { activitybar: [{ id: 'a.container' }] },
    configuration: [{ properties: { 'a.s1': {} } }, { properties: { 'a.s2': {} } }],
  } });
  assert.deepEqual([...m.commands].sort(), ['a.cmd', 'a.key', 'a.menu', 'a.unbound']);
  assert.deepEqual([...m.views].sort(), ['a.container', 'a.view']);
  assert.deepEqual([...m.settings].sort(), ['a.s1', 'a.s2']);
  const o = manifestOf({ contributes: { configuration: { properties: { 'b.s': {} } } } });
  assert.deepEqual([...o.settings], ['b.s']);
  assert.deepEqual([...manifestOf({}).commands], []);
});

test('collectManifest: 拡張のフォルダを読む。壊れた JSON・package.json の無いフォルダは読み飛ばし、BOM は許す', () => {
  const d = mkdtempSync(join(tmpdir(), 'absent-mf-'));
  try {
    mkdirSync(join(d, 'x')); writeFileSync(join(d, 'x', 'package.json'), '\uFEFF' + JSON.stringify({ contributes: { commands: [{ command: 'x.never.activated' }], configuration: { properties: { 'x.set': {} } } } }));
    mkdirSync(join(d, 'bad')); writeFileSync(join(d, 'bad', 'package.json'), '{oops');
    mkdirSync(join(d, 'empty'));
    assert.deepEqual(collectManifest(d), { commands: ['x.never.activated'], views: [], settings: ['x.set'], extensions: 1 });
    assert.deepEqual(collectManifest(join(d, 'none')).commands, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('evaluateAbsent: 実行時に無くても manifest に在れば「在る」（起動しない拡張のコマンド）。net に網が出る', () => {
  const snap = { commands: ['other'], settings: { 'x.set': false }, manifest: { commands: ['x.never.activated'], views: ['x.view'], settings: ['x.set'] } };
  const r = evaluateAbsent({ absentCommands: ['x.never.activated', 'gone'], absentViews: ['x.view', 'gone.view'], absentSettings: ['x.set'] }, snap);
  assert.deepEqual(r.map((x) => x.status), ['fail', 'pass', 'fail', 'pass', 'fail']);
  assert.deepEqual(r.map((x) => x.net), ['manifest', 'none', 'manifest', 'none', 'manifest']);
  const p = evaluateAbsent({ absentCommands: ['x.never.activated'] }, snap, { expect: 'present' });
  assert.equal(p[0].status, 'pass');
  assert.equal(p[0].net, 'manifest');
});

test('evaluateAbsent: runtime と manifest の両方に在れば net は runtime+manifest。manifest が無い snapshot は runtime だけ', () => {
  assert.equal(evaluateAbsent({ absentCommands: ['c'] }, { commands: ['c'], manifest: { commands: ['c'] } })[0].net, 'runtime+manifest');
  assert.equal(evaluateAbsent({ absentCommands: ['c'] }, { commands: ['c'] })[0].net, 'runtime');
  assert.match(evaluateAbsent({ absentCommands: ['z'] }, { commands: ['c'] })[0].detail, /runtime/);
});

// ---- probe（設定の見方）。本物の vscode の振る舞い（登録の無いキーでも inspect はオブジェクトを返す）を模した偽物で動かす ----
async function runProbe(settingKeys, { extensions = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'absent-probe-'));
  const req = createRequire(import.meta.url);
  const Module = req('node:module');
  const origLoad = Module._load;
  const REGISTERED = { 'editor.fontSize': 14, 'debug.console.fontSize': 14 };
  const fake = {
    commands: { getCommands: async () => ['a'] },
    workspace: { getConfiguration: () => ({ inspect: (key) => ({ key, defaultValue: REGISTERED[key], globalValue: undefined }) }) },
    extensions: { all: extensions },
  };
  const probePath = req.resolve('./removals/probe/extension.js');
  delete req.cache[probePath];
  Module._load = function (request, ...rest) { return request === 'vscode' ? fake : origLoad.call(this, request, ...rest); };
  const cfg = join(dir, 'cfg.json'); const out = join(dir, 'out.json');
  writeFileSync(cfg, JSON.stringify({ out, settings: settingKeys, settleMs: 0 }));
  const prev = process.env.AIED_ABSENT_CONFIG;
  process.env.AIED_ABSENT_CONFIG = cfg;
  try {
    await req(probePath).activate();
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    Module._load = origLoad; delete req.cache[probePath];
    if (prev === undefined) delete process.env.AIED_ABSENT_CONFIG; else process.env.AIED_ABSENT_CONFIG = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

test('probe: 登録の無い対照のキーは false、確かに在るキー（editor.fontSize）は true（inspect が常にオブジェクトを返しても）', async () => {
  const s = await runProbe(['zzzShukoControl.never.registered', 'editor.fontSize', 'debug.console.fontSize']);
  assert.equal(s.settings['zzzShukoControl.never.registered'], false);
  assert.equal(s.settings['editor.fontSize'], true);
  assert.equal(s.settings['debug.console.fontSize'], true);
  assert.equal(s.settingsVia['zzzShukoControl.never.registered'], 'none');
  assert.equal(s.done, true);
});

test('probe: 起動していない拡張の contributes.configuration にあるキーも「在る」（manifest 経由）', async () => {
  const s = await runProbe(['ext.only.in.manifest', 'ext.nope'], { extensions: [{ id: 'e', isActive: false, packageJSON: { contributes: { configuration: [{ properties: { 'ext.only.in.manifest': {} } }] } } }] });
  assert.equal(s.settings['ext.only.in.manifest'], true);
  assert.equal(s.settingsVia['ext.only.in.manifest'], 'manifest');
  assert.equal(s.settings['ext.nope'], false);
});
