// scripts/p1-launch-check.ps1 の -LogsFolder の入口(何も起動せず、ワークベンチが立ち上がったかをログだけで判定する)のテスト。
// 仕様: tasks/2026-11-16-p5-c1-product-keys/handoff-notes-meng-tian.md の5節の表(蒙恬の入口)と、brief の蒙恬の3。
// 偽のログのフォルダを一時の場所(<リポジトリ>\tmp\tests\)に作って渡す。本物のエディタは起動しない。PC の設定は変えない。
// Run: node --test tests/p1-launch-logs.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut } from './build/helpers.mjs';

const LAUNCH = path.join(REPO, 'scripts', 'p1-launch-check.ps1');
let sb;
before(() => { sb = makeSandbox('tests-p1logs-'); });
after(() => removeSandbox(sb));

const BR = () => path.join(sb, 'fake-build-root');
function run(args) {
  const la = path.join(sb, 'localappdata');
  writeFile(path.join(la, 'Shuko', 'local.json'), JSON.stringify({ buildRoot: BR() }));
  return runPs(LAUNCH, args, { timeout: 90000, env: { LOCALAPPDATA: la } });
}
let n = 0;
/** 偽のログのフォルダ。opts: renderer / exthost / eager(false で Eager の行を外す) / noExthostDir */
function makeLogs({ renderer = '2026-11-16 12:52:25.000 [info] Started local extension host with pid 123.\n', exthost = '2026-11-16 12:52:26.000 [info] Extension host with pid 123 started\n2026-11-16 12:52:27.000 [info] Eager extensions activated\n', noExthostDir = false } = {}) {
  const dir = path.join(sb, `logs-${++n}`);
  writeFile(path.join(dir, 'window1', 'renderer.log'), renderer);
  if (!noExthostDir) writeFile(path.join(dir, 'window1', 'exthost', 'exthost.log'), exthost);
  return dir;
}
const chromium = (text) => { const f = path.join(sb, `chromium-${++n}.log`); writeFile(f, text); return f; };
const go = (args) => { const r = run(args); return { r, j: r.stdout.trim() ? parseJsonOut(r.stdout) : null }; };

test('-LogsFolder: 3つのしるしがあり、Chromium のログが無ければ 0・ok・ready', () => {
  const { r, j } = go(['-LogsFolder', makeLogs()]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(j.result, 'ok');
  assert.equal(j.workbench.ready, true);
  assert.deepEqual(j.workbench.missing, []);
  assert.equal(j.workbench.chromiumLog.exists, false);
});

test('-LogsFolder: しるしを1つ欠くと 1・error。missing にその名前、message に the workbench did not come up', () => {
  const { r, j } = go(['-LogsFolder', makeLogs({ exthost: '2026-11-16 12:52:26.000 [info] Extension host with pid 123 started\n' })]);
  assert.equal(r.status, 1);
  assert.equal(j.result, 'error');
  assert.deepEqual(j.workbench.missing, ['eagerExtensionsActivated']);
  assert.match(j.message, /the workbench did not come up/);
  for (const [log, name] of [[{ renderer: '' }, 'rendererStartedExtHost'], [{ exthost: '2026-11-16 12:52:27.000 [info] Eager extensions activated\n' }, 'extHostStarted']]) {
    const x = go(['-LogsFolder', makeLogs(log)]);
    assert.equal(x.r.status, 1);
    assert.ok(x.j.workbench.missing.includes(name), `${name}: ${JSON.stringify(x.j.workbench.missing)}`);
  }
});

test('-LogsFolder: 壊れた起動の形(renderer.log が空で exthost のフォルダが無い)は 1。missing が3つ', () => {
  const { r, j } = go(['-LogsFolder', makeLogs({ renderer: '', noExthostDir: true })]);
  assert.equal(r.status, 1);
  assert.equal(j.workbench.missing.length, 3);
  assert.equal(j.workbench.rendererLog.bytes, 0);
  assert.equal(j.workbench.exthostLog.exists, false);
});

const REAL = '[1:1116/115143.357:INFO:CONSOLE:1847] "Uncaught (in promise) TypeError: x", source: vscode-file://vscode-app/c:/a/workbench.desktop.main.js (1847)';
test('-LogsFolder: しるしが3つあっても、ワークベンチの Uncaught(vscode-file://)が chromium のログにあれば 1', () => {
  const { r, j } = go(['-LogsFolder', makeLogs(), '-ChromiumLog', chromium(REAL + '\n')]);
  assert.equal(r.status, 1);
  assert.equal(j.workbench.consoleUncaught.workbenchCount, 1);
});

test('-LogsFolder: Webview(vscode-webview://)の中の Uncaught は数えるだけで落とさない。古い形 INFO:CONSOLE(1847) も拾う。Uncaught でない誤りは落とさない', () => {
  const web = go(['-LogsFolder', makeLogs(), '-ChromiumLog', chromium('[1:1116/115143.357:INFO:CONSOLE:9] "Uncaught TypeError: y", source: vscode-webview://abc/index.html?id=1 (9)\n')]);
  assert.equal(web.r.status, 0);
  assert.equal(web.j.workbench.consoleUncaught.othersCount, 1);
  assert.equal(web.j.workbench.consoleUncaught.workbenchCount, 0);
  const old = go(['-LogsFolder', makeLogs(), '-ChromiumLog', chromium(REAL.replace('CONSOLE:1847', 'CONSOLE(1847)') + '\n')]);
  assert.equal(old.r.status, 1);
  const err = go(['-LogsFolder', makeLogs(), '-ChromiumLog', chromium('[1:1116/115143.357:INFO:CONSOLE:7] "%c  ERR something", source: vscode-file://a/b.js (7)\n')]);
  assert.equal(err.r.status, 0);
});

test('-LogsFolder: 400文字を超える Uncaught の行は 400文字+... に切る', () => {
  const long = `[1:1116/115143.357:INFO:CONSOLE:1] "Uncaught TypeError: ${'x'.repeat(600)}", source: vscode-file://a/b.js (1)`;
  const { j } = go(['-LogsFolder', makeLogs(), '-ChromiumLog', chromium(long + '\n')]);
  const line = JSON.stringify(j.workbench.consoleUncaught);
  assert.ok(!line.includes('x'.repeat(401)), '切っていない');
  assert.ok(line.includes('...'));
});

test('-LogsFolder: 引数の誤りは 2(無いフォルダ・無い chromium ログ・-Zip との併用・-InstallExtension との併用・引数なし)', () => {
  assert.equal(run(['-LogsFolder', path.join(sb, 'nope')]).status, 2);
  assert.equal(run(['-LogsFolder', makeLogs(), '-ChromiumLog', path.join(sb, 'nope.log')]).status, 2);
  const zip = path.join(sb, 'a.zip'); writeFile(zip, 'PK');
  assert.equal(run(['-LogsFolder', makeLogs(), '-Zip', zip]).status, 2);
  assert.equal(run(['-LogsFolder', makeLogs(), '-InstallExtension', sb]).status, 2);
  const none = run([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /exactly one/);
});

test('-LogsFolder: 何も作らない・何も起動しない(判定だけ。-OutFile を渡したときだけそのファイルを書く)', () => {
  const dir = makeLogs();
  const before = fs.readdirSync(dir, { recursive: true }).sort();
  const out = path.join(sb, 'o', 'r.json');
  const { r } = go(['-LogsFolder', dir, '-OutFile', out]);
  assert.equal(r.status, 0);
  assert.deepEqual(fs.readdirSync(dir, { recursive: true }).sort(), before);
  assert.ok(fs.existsSync(out));
  assert.ok(!fs.existsSync(BR()), '<buildRoot> を作らない');
});
