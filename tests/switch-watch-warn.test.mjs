// scripts/switch.ps1 が起動時に「最後に検知が成功した日時」を表示し、3日より古ければ警告する（止めない）ことの試し。
// 仕様: docs/06 の2.3「失敗したとき」、docs/02 の6節の0。読み方は take-in.mjs の readWatchStatus（lastSuccessAt を見る、3日を超えたら警告）。
// 状態のファイルは、サンドボックスの LOCALAPPDATA の下（<LOCALAPPDATA>\Shuko\watch\state.json。既定の場所と同じ形）に置く。
// 本物の %LOCALAPPDATA%\Shuko\watch\ は読まない・書かない。
// 想定した入口（蒙恬の入口が分かれば合わせる）: 状態の場所は環境変数 LOCALAPPDATA の既定の形。
//   警告の判定は標準出力の JSON の watch.warn か、標準エラー・標準出力の文章に warn を含むこと。
//   表示は JSON の watch.lastSuccessAt か、文章に日時（日付）を含むこと。
// Run: node --test tests/switch-watch-warn.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut, makeFakeEditor, isJunctionTo } from './build/helpers.mjs';

const SWITCH = path.join(REPO, 'scripts', 'switch.ps1');
const DAY = 86400000;
let sb;
let n = 0;

before(() => {
  sb = makeSandbox('tests-swwatch-');
});
after(() => removeSandbox(sb));

function setup({ state } = {}) {
  const root = path.join(sb, `t${++n}`);
  const installRoot = path.join(root, 'install');
  const cfg = path.join(root, 'local.json');
  const ledger = path.join(root, 'ledger.json');
  const localAppData = path.join(root, 'localappdata');
  const userDataDir = path.join(root, 'userdata');
  writeFile(cfg, JSON.stringify({}));
  writeFile(ledger, JSON.stringify([{ id: 'pub.ext', version: '1.0.0', engines: '^1.94.0' }]));
  makeFakeEditor(path.join(installRoot, 'versions', '1.146.0-1'), { version: '1.146.0' });
  fs.mkdirSync(userDataDir, { recursive: true });
  const statePath = path.join(localAppData, 'Shuko', 'watch', 'state.json');
  fs.mkdirSync(localAppData, { recursive: true });
  if (state !== undefined) writeFile(statePath, typeof state === 'string' ? state : JSON.stringify(state));
  const r = runPs(SWITCH, ['1.146.0-1', '-InstallRoot', installRoot, '-ConfigPath', cfg, '-UserDataDir', userDataDir, '-LedgerPath', ledger], {
    env: { LOCALAPPDATA: localAppData },
  });
  let json = null;
  try {
    json = parseJsonOut(r.stdout);
  } catch {
    /* no JSON */
  }
  const text = `${r.stderr}\n${r.stdout}`;
  return {
    ...r,
    json,
    text,
    switched: isJunctionTo(path.join(installRoot, 'current'), path.join(installRoot, 'versions', '1.146.0-1')),
    warned: (json && json.watch && json.watch.warn === true) || /warn/i.test(r.stderr),
    realStateUntouched: !fs.existsSync(path.join(root, 'install', 'watch')),
  };
}

const ago = (days) => new Date(Date.now() - days * DAY);
const shows = (r, d) => {
  const iso = d.toISOString();
  const dates = [iso.slice(0, 10), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`];
  return !!(r.json && r.json.watch && r.json.watch.lastSuccessAt) || dates.some((x) => r.text.includes(x));
};

test('3日より古い（5日前）: 警告が出る。止まらず、切り替えは済み、終了コードは 0', () => {
  const d = ago(5);
  const r = setup({ state: { lastSuccessAt: d.toISOString() } });
  assert.equal(r.status, 0, r.text);
  assert.equal(r.json.result, 'ok');
  assert.ok(r.switched, 'the switch is carried out');
  assert.ok(r.warned, '警告が出ていない:\n' + r.text);
  assert.ok(shows(r, d), '最後の成功の日時が表示されていない:\n' + r.text);
});

test('3日より古い（30日前）: 警告が出て、止まらない', () => {
  const r = setup({ state: { lastSuccessAt: ago(30).toISOString() } });
  assert.equal(r.status, 0, r.text);
  assert.ok(r.warned, r.text);
  assert.ok(r.switched);
});

test('3日より新しい（1日前）: 警告は出ないが、最後の成功の日時は表示される', () => {
  const d = ago(1);
  const r = setup({ state: { lastSuccessAt: d.toISOString() } });
  assert.equal(r.status, 0, r.text);
  assert.ok(r.switched);
  assert.ok(!r.warned, '新しいのに警告が出た:\n' + r.text);
  assert.ok(shows(r, d), '最後の成功の日時が表示されていない:\n' + r.text);
});

test('3日より新しい（たった今）: 警告は出ない', () => {
  const r = setup({ state: { lastSuccessAt: new Date().toISOString() } });
  assert.equal(r.status, 0, r.text);
  assert.ok(!r.warned, r.text);
});

test('境目: 2日前は警告なし、4日前は警告あり', () => {
  assert.ok(!setup({ state: { lastSuccessAt: ago(2).toISOString() } }).warned);
  assert.ok(setup({ state: { lastSuccessAt: ago(4).toISOString() } }).warned);
});

test('状態のファイルが無い: 警告は出るが止まらない（終了コード 0、切り替えは済む。take-in.mjs と同じ扱い）', () => {
  const r = setup();
  assert.equal(r.status, 0, r.text);
  assert.equal(r.json.result, 'ok');
  assert.ok(r.switched);
  assert.ok(r.warned, r.text);
  assert.equal(r.json.watch.found, false);
  assert.match(r.stderr, /no update watch record/);
});

test('状態のファイルが壊れている・lastSuccessAt が無い・日時でない: 警告は出るが止まらない', () => {
  for (const state of ['{ not json', JSON.stringify({}), JSON.stringify({ lastSuccessAt: 'yesterday' })]) {
    const r = setup({ state });
    assert.equal(r.status, 0, `${state}: ${r.text}`);
    assert.ok(r.switched, state);
    assert.ok(r.warned, state);
    assert.equal(r.json.watch.lastSuccessAt === null || typeof r.json.watch.lastSuccessAt === 'string', true);
  }
});

test('-WatchState: 状態の場所を指定できる（既定の LOCALAPPDATA の場所は見ない）', () => {
  const root = path.join(sb, `w${++n}`);
  const installRoot = path.join(root, 'install');
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, '{}');
  const state = path.join(root, 'elsewhere', 'state.json');
  writeFile(state, JSON.stringify({ lastSuccessAt: ago(10).toISOString() }));
  // 既定の場所には新しい状態を置く。-WatchState が効いていれば古い方が読まれて警告が出る
  const lad = path.join(root, 'lad');
  writeFile(path.join(lad, 'Shuko', 'watch', 'state.json'), JSON.stringify({ lastSuccessAt: new Date().toISOString() }));
  const r = runPs(SWITCH, ['-List', '-InstallRoot', installRoot, '-ConfigPath', cfg, '-WatchState', state], { env: { LOCALAPPDATA: lad } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = parseJsonOut(r.stdout);
  assert.equal(j.watch.warn, true);
  assert.equal(path.resolve(j.watch.statePath).toLowerCase(), path.resolve(state).toLowerCase());
  assert.match(r.stderr, /WARNING/);
});

test('-List でも表示する（どの動作でも最初に出る）', () => {
  const root = path.join(sb, `l${++n}`);
  const lad = path.join(root, 'lad');
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, '{}');
  writeFile(path.join(lad, 'Shuko', 'watch', 'state.json'), JSON.stringify({ lastSuccessAt: ago(1).toISOString() }));
  const r = runPs(SWITCH, ['-List', '-InstallRoot', path.join(root, 'install'), '-ConfigPath', cfg], { env: { LOCALAPPDATA: lad } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(parseJsonOut(r.stdout).watch.warn, false);
  assert.match(r.stderr, /update watch last succeeded/);
  assert.doesNotMatch(r.stderr, /WARNING/);
});

test('警告があっても、エンジンの不一致（終了コード 4）などほかの結果は変わらない', () => {
  const root = path.join(sb, `e${++n}`);
  const installRoot = path.join(root, 'install');
  const cfg = path.join(root, 'local.json');
  const ledger = path.join(root, 'ledger.json');
  writeFile(cfg, '{}');
  writeFile(ledger, JSON.stringify([{ id: 'a.b', version: '1.0.0', engines: '^1.200.0' }]));
  makeFakeEditor(path.join(installRoot, 'versions', '1.146.0-1'), { version: '1.146.0' });
  const r = runPs(SWITCH, ['1.146.0-1', '-InstallRoot', installRoot, '-ConfigPath', cfg, '-LedgerPath', ledger, '-UserDataDir', path.join(root, 'ud')], { env: { LOCALAPPDATA: path.join(root, 'lad') } });
  assert.equal(r.status, 4, r.stderr + r.stdout);
  assert.equal(parseJsonOut(r.stdout).result, 'engines-unsatisfied');
  assert.match(r.stderr, /WARNING/);
});
