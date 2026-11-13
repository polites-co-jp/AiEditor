// Runs scripts/switch.ps1 with arguments in a test location and checks the JSON on stdout and the exit code.
// Spec: docs/02 section 6, 6.1; build-switch-design.md section 5.
// Only test locations are used (-InstallRoot, -ConfigPath, -UserDataDir, -LedgerPath under a fresh folder).
// The real %LOCALAPPDATA%\Shuko\local.json, the Start menu and PATH are not touched.
// Run: node --test tests/switch.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut, makeFakeEditor, isJunctionTo } from './build/helpers.mjs';

const SWITCH = path.join(REPO, 'scripts', 'switch.ps1');
let sb;
let n = 0;

before(() => {
  sb = makeSandbox('tests-sw-');
});
after(() => removeSandbox(sb));

// A fresh install root with the given version folders. Returns paths and a runner.
function setup({ labels = [], keepVersions = 3, engines = ['^1.94.0', '>=1.100.0'], version = '1.146.0', userData = true } = {}) {
  const root = path.join(sb, `t${++n}`);
  const installRoot = path.join(root, 'install');
  const cfg = path.join(root, 'local.json');
  const ledger = path.join(root, 'ledger.json');
  const userDataDir = path.join(root, 'userdata');
  writeFile(cfg, JSON.stringify({ keepVersions }));
  writeFile(ledger, JSON.stringify(engines.map((e, i) => ({ id: `pub.ext${i}`, version: '1.0.0', engines: e }))));
  for (const l of labels) makeFakeEditor(path.join(installRoot, 'versions', l), { version });
  if (userData) {
    writeFile(path.join(userDataDir, 'User', 'settings.json'), '{"a": 1}');
    writeFile(path.join(userDataDir, 'User', 'snippets', 's.code-snippets'), '{}');
  }
  const base = ['-InstallRoot', installRoot, '-ConfigPath', cfg, '-UserDataDir', userDataDir, '-LedgerPath', ledger];
  const run = (...args) => {
    const r = runPs(SWITCH, [...args, ...base]);
    let json = null;
    try {
      json = parseJsonOut(r.stdout);
    } catch {
      /* no JSON */
    }
    return { ...r, json };
  };
  const history = () => {
    const f = path.join(installRoot, 'history.txt');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  };
  return { root, installRoot, cfg, ledger, userDataDir, run, history, current: path.join(installRoot, 'current'), ver: (l) => path.join(installRoot, 'versions', l) };
}

const isNoPrev = (v) => v == null || v === '' || v === '-';

test('first switch: current is a junction to the version, history gets "<ISO>\\t-\\t<label>"', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  const r = s.run('1.146.0-1');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.ok(isNoPrev(r.json.from));
  assert.equal(r.json.to, '1.146.0-1');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')));
  const h = s.history();
  assert.equal(h.length, 1);
  const [time, from, to] = h[0].split('\t');
  assert.ok(!Number.isNaN(Date.parse(time)), 'ISO 8601 time: ' + time);
  assert.match(time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(from, '-');
  assert.equal(to, '1.146.0-1');
  assert.ok(!/[\\/]/.test(h[0].replace(/^[^\t]*/, '')), 'no paths in history');
  assert.equal(r.json.target.version, '1.146.0');
  assert.ok(r.json.target.exe && r.json.target.cli);
});

test('second switch: from is the previous label; history gets a second line; the old folder stays', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'] });
  s.run('1.146.0-1');
  const r = s.run('1.146.0-2');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.from, '1.146.0-1');
  assert.equal(r.json.to, '1.146.0-2');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-2')));
  assert.ok(fs.existsSync(s.ver('1.146.0-1')), 'nothing is deleted');
  const h = s.history().map((l) => l.split('\t'));
  assert.deepEqual(h.map((x) => [x[1], x[2]]), [['-', '1.146.0-1'], ['1.146.0-1', '1.146.0-2']]);
});

test('the same label again: ok, nothing changes (history unchanged)', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  s.run('1.146.0-1');
  const before = s.history();
  const r = s.run('1.146.0-1');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.deepEqual(s.history(), before);
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')));
});

test('-Previous: goes back, and two in a row go back and forth', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'] });
  s.run('1.146.0-1');
  s.run('1.146.0-2');
  let r = s.run('-Previous');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.from, '1.146.0-2');
  assert.equal(r.json.to, '1.146.0-1');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')));
  r = s.run('-Previous');
  assert.equal(r.json.to, '1.146.0-2');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-2')));
  r = s.run('-Previous');
  assert.equal(r.json.to, '1.146.0-1');
});

test('-Previous: goes to the "from" of the first line (from the end) that switched to the current label', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2', '1.146.0-3'] });
  s.run('1.146.0-1');
  s.run('1.146.0-2');
  s.run('1.146.0-3');
  // current = 3; the last line that has to = 3 has from = 2
  assert.equal(s.run('-Previous').json.to, '1.146.0-2');
});

test('-Previous without any history stops with an error', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  const r = s.run('-Previous');
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
});

test('a label with no folder stops with exit 1 and result "error"; current is unchanged', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  s.run('1.146.0-1');
  const r = s.run('1.146.0-9');
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')));
  assert.equal(s.history().length, 1);
});

test('engines: all ledger engines are satisfied -> ok; one unsatisfied -> exit 4, "engines-unsatisfied", current unchanged', () => {
  const ok = setup({ labels: ['1.146.0-1'], engines: ['^1.94.0', '>=1.100.0', '^1.146.0'] });
  assert.equal(ok.run('1.146.0-1').status, 0);

  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'], engines: ['^1.94.0'] });
  s.run('1.146.0-1');
  // a ledger needing a newer editor than the folder offers
  fs.writeFileSync(s.ledger, JSON.stringify([{ id: 'a.b', version: '1.0.0', engines: '^1.94.0' }, { id: 'c.d', version: '2.0.0', engines: '^1.200.0' }]));
  const r = s.run('1.146.0-2');
  assert.equal(r.status, 4, r.stderr + r.stdout);
  assert.equal(r.json.result, 'engines-unsatisfied');
  assert.equal(r.json.engines.unsatisfied.length, 1);
  assert.match(JSON.stringify(r.json.engines.unsatisfied), /c\.d/);
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')), 'current is unchanged');
  assert.equal(s.history().length, 1);
});

test('engines: ^ means same major (^1.94.0 does not accept 2.0.0), >= accepts newer', () => {
  const s = setup({ labels: ['2.0.0-1'], engines: ['^1.94.0'], version: '2.0.0' });
  assert.equal(s.run('2.0.0-1').status, 4, '^1.94.0 vs 2.0.0');
  const t = setup({ labels: ['2.0.0-1'], engines: ['>=1.94.0'], version: '2.0.0' });
  assert.equal(t.run('2.0.0-1').status, 0, '>=1.94.0 vs 2.0.0');
  const u = setup({ labels: ['1.93.9-1'], engines: ['^1.94.0'], version: '1.93.9' });
  assert.equal(u.run('1.93.9-1').status, 4, '^1.94.0 vs 1.93.9');
  const v = setup({ labels: ['1.94.0-1'], engines: ['^1.94.0'], version: '1.94.0' });
  assert.equal(v.run('1.94.0-1').status, 0, '^1.94.0 vs 1.94.0 (equal is satisfied)');
});

test('backup: user settings are copied to backups\\<yyyyMMdd-HHmmss>\\User\\ with backup.json (copied / missing)', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'] });
  s.run('1.146.0-1');
  const r = s.run('1.146.0-2');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const bdir = path.join(s.installRoot, 'backups');
  const dirs = fs.readdirSync(bdir);
  assert.ok(dirs.length >= 1);
  for (const d of dirs) assert.match(d, /^\d{8}-\d{6}/);
  const latest = path.join(bdir, dirs.sort().pop());
  assert.equal(fs.readFileSync(path.join(latest, 'User', 'settings.json'), 'utf8'), '{"a": 1}');
  assert.ok(fs.existsSync(path.join(latest, 'User', 'snippets', 's.code-snippets')));
  const meta = JSON.parse(fs.readFileSync(path.join(latest, 'backup.json'), 'utf8'));
  assert.ok('copied' in meta && 'missing' in meta);
  assert.match(JSON.stringify(meta.copied), /settings\.json/);
  // keybindings.json, tasks.json, globalStorage\state.vscdb do not exist: listed as missing, not an error
  assert.match(JSON.stringify(meta.missing), /keybindings\.json/);
  assert.match(JSON.stringify(meta.missing), /tasks\.json/);
  assert.match(JSON.stringify(meta.missing), /state\.vscdb/);
  assert.ok(!JSON.stringify(meta.copied).includes('keybindings.json'));
});

test('backup: a user data folder with nothing in it is not an error', () => {
  const s = setup({ labels: ['1.146.0-1'], userData: false });
  const r = s.run('1.146.0-1');
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('-List: versions, current, history, removable by keepVersions (current is counted and always kept)', () => {
  const labels = ['1.146.0-1', '1.146.0-2', '1.146.0-3', '1.146.0-4'];
  const s = setup({ labels, keepVersions: 2 });
  s.run('1.146.0-4');
  const r = s.run('-List');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.json.removable, ['1.146.0-1', '1.146.0-2']);
  assert.ok(labels.every((l) => fs.existsSync(s.ver(l))), '-List deletes nothing');
});

test('removable: labels sort by numeric version then build number; odd names count as older, by name', () => {
  const s = setup({ labels: ['1.9.0-1', '1.10.0-1', '1.10.0-2', 'old-trial', 'a-trial'], keepVersions: 3 });
  s.run('1.10.0-2');
  assert.deepEqual(s.run('-List').json.removable, ['a-trial', 'old-trial']);
  const t = setup({ labels: ['1.9.0-1', '1.10.0-1', '1.10.0-2', 'old-trial'], keepVersions: 1 });
  t.run('1.10.0-2');
  assert.deepEqual(t.run('-List').json.removable, ['old-trial', '1.9.0-1', '1.10.0-1']);
});

test('removable: the current version is never removable, even when it is the oldest', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2', '1.146.0-3'], keepVersions: 1 });
  s.run('1.146.0-1');
  const rem = s.run('-List').json.removable;
  assert.ok(!rem.includes('1.146.0-1'));
  assert.deepEqual([...rem].sort(), ['1.146.0-2', '1.146.0-3']);
});

test('removable: nothing over keepVersions gives an empty list', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'], keepVersions: 3 });
  s.run('1.146.0-2');
  assert.deepEqual(s.run('-List').json.removable, []);
});

test('switching reports removable versions too (stdout JSON), and deletes nothing', () => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2', '1.146.0-3'], keepVersions: 2 });
  s.run('1.146.0-1');
  s.run('1.146.0-2');
  const r = s.run('1.146.0-3');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.json.removable, ['1.146.0-1']);
  assert.ok(fs.existsSync(s.ver('1.146.0-1')));
});

test('layout: official nested layout (resources\\app under the commit-prefix folder) is accepted', () => {
  const s = setup({});
  makeFakeEditor(s.ver('1.146.0-n'), { nested: true });
  const r = s.run('1.146.0-n');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.target.version, '1.146.0');
  assert.ok(r.json.target.versionedFolder, 'versionedFolder is reported');
});

test('a folder without exe / cli stops with exit 1', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  fs.rmSync(path.join(s.ver('1.146.0-1'), 'Shuko.exe'));
  const r = s.run('1.146.0-1');
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
  assert.ok(!fs.existsSync(s.current));
});

// ---- -Zip -------------------------------------------------------------------------------
function makeZip(zipPath, srcParent, topName) {
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  const r = spawnSync(tar, ['-a', '-c', '-f', zipPath, '-C', srcParent, topName], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
function sha256(f) {
  return spawnSync('powershell', ['-NoProfile', '-Command', `(Get-FileHash -Algorithm SHA256 -LiteralPath '${f}').Hash`], { encoding: 'utf8' }).stdout.trim().toLowerCase();
}

test('-Zip: expands into versions\\<label> (single top folder is stripped), checks -Sha256, then switches', () => {
  const s = setup({});
  const src = path.join(s.root, 'src');
  makeFakeEditor(path.join(src, 'Shuko-win32-x64-1.146.0-5'));
  const zip = path.join(s.root, 'a.zip');
  makeZip(zip, src, 'Shuko-win32-x64-1.146.0-5');
  const r = s.run('1.146.0-5', '-Zip', zip, '-Sha256', sha256(zip));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.ok(fs.existsSync(path.join(s.ver('1.146.0-5'), 'Shuko.exe')), 'content of the top folder is the version folder');
  assert.ok(fs.existsSync(path.join(s.ver('1.146.0-5'), 'bin', 'shuko.cmd')));
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-5')));
});

test('-Zip: a wrong -Sha256 stops before expanding anything', () => {
  const s = setup({});
  const src = path.join(s.root, 'src');
  makeFakeEditor(path.join(src, 'Shuko-win32-x64-1.146.0-5'));
  const zip = path.join(s.root, 'a.zip');
  makeZip(zip, src, 'Shuko-win32-x64-1.146.0-5');
  const r = s.run('1.146.0-5', '-Zip', zip, '-Sha256', '0'.repeat(64));
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
  assert.ok(!fs.existsSync(s.ver('1.146.0-5')));
  assert.ok(!fs.existsSync(s.current));
});

test('-Zip: a version folder that already exists stops (nothing overwritten)', () => {
  const s = setup({ labels: ['1.146.0-5'] });
  writeFile(path.join(s.ver('1.146.0-5'), 'marker.txt'), 'keep');
  const src = path.join(s.root, 'src');
  makeFakeEditor(path.join(src, 'Shuko-win32-x64-1.146.0-5'));
  const zip = path.join(s.root, 'a.zip');
  makeZip(zip, src, 'Shuko-win32-x64-1.146.0-5');
  const r = s.run('1.146.0-5', '-Zip', zip);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(fs.readFileSync(path.join(s.ver('1.146.0-5'), 'marker.txt'), 'utf8'), 'keep');
});

// ---- a running editor -------------------------------------------------------------------
test('a process running from current\\ stops the switch (exit 3, "editor-running"); nothing is closed or changed', async (t) => {
  const s = setup({ labels: ['1.146.0-1', '1.146.0-2'] });
  s.run('1.146.0-1');
  // a harmless "editor": a copy of node.exe named like the exe of the version, started through the junction
  const exe = path.join(s.ver('1.146.0-1'), 'Shuko.exe');
  fs.copyFileSync(process.execPath, exe);
  const child = spawn(path.join(s.current, 'Shuko.exe'), ['-e', 'setTimeout(()=>{}, 60000)'], { stdio: 'ignore', windowsHide: true });
  t.after(() => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  });
  await new Promise((res) => setTimeout(res, 1500));
  const r = s.run('1.146.0-2');
  assert.equal(r.status, 3, r.stderr + r.stdout);
  assert.equal(r.json.result, 'editor-running');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')), 'current is unchanged');
  assert.equal(s.history().length, 1);
  assert.equal(child.exitCode, null, 'the process was not closed');
  child.kill();
  await new Promise((res) => child.once('exit', res));
  const r2 = s.run('1.146.0-2');
  assert.equal(r2.status, 0, 'after the process ended the switch goes through: ' + r2.stderr + r2.stdout);
});
