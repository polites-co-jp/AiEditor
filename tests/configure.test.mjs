// Runs scripts/configure.ps1 with arguments in a test location and checks stdout JSON, exit code and local.json.
// Spec: docs/02 section 6.1 ("場所を変える"); build-switch-design.md section 6.
// Every run passes -ConfigPath (a file in the test folder) and -NoShellIntegration, so the real
// %LOCALAPPDATA%\Shuko\local.json, the Start menu shortcuts and the user PATH are never touched.
// Run: node --test tests/configure.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut, isJunctionTo } from './build/helpers.mjs';

const CONFIGURE = path.join(REPO, 'scripts', 'configure.ps1');
let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-cf-');
});
after(() => removeSandbox(sb));

function setup(initialConfig = null) {
  const root = path.join(sb, `t${++n}`);
  const cfg = path.join(root, 'cfg', 'local.json');
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  if (initialConfig !== null) fs.writeFileSync(cfg, typeof initialConfig === 'string' ? initialConfig : JSON.stringify(initialConfig, null, 2) + '\n');
  const run = (...args) => {
    // -NoShellIntegration always: this suite must not look at or change shortcuts or PATH.
    const r = runPs(CONFIGURE, [...args, '-ConfigPath', cfg, '-NoShellIntegration'], { env: { SHUKO_TEST_BASE: root } });
    let json = null;
    try {
      json = parseJsonOut(r.stdout);
    } catch {
      /* no JSON */
    }
    return { ...r, json };
  };
  const read = () => (fs.existsSync(cfg) ? fs.readFileSync(cfg, 'utf8') : null);
  return { root, cfg, run, read };
}

// A fake install root with versions, history, backups and a current junction.
function makeInstall(dir, label = '1.146.0-1') {
  writeFile(path.join(dir, 'versions', label, 'Shuko.exe'), 'MZ');
  writeFile(path.join(dir, 'versions', label, 'resources', 'app', 'product.json'), '{}');
  writeFile(path.join(dir, 'history.txt'), `2026-11-14T00:00:00+09:00\t-\t${label}\n`);
  writeFile(path.join(dir, 'backups', '20261114-000000', 'User', 'settings.json'), '{"x":1}');
  fs.symlinkSync(path.join(dir, 'versions', label), path.join(dir, 'current'), 'junction');
}

test('no arguments and no file: creates local.json with defaults; builderRepo is the repository of the script', () => {
  const s = setup();
  const r = s.run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  const text = s.read();
  assert.ok(text !== null, 'file created');
  // format: key order, 2-space indent, LF, trailing newline, no BOM, UTF-8
  assert.ok(!text.startsWith('\uFEFF'));
  assert.ok(!text.includes('\r'), 'LF only');
  assert.ok(text.endsWith('}\n'));
  const keys = [...text.matchAll(/^ {2}"([A-Za-z]+)":/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['installRoot', 'keepVersions', 'builderRepo', 'buildRoot']);
  assert.ok(text.startsWith('{\n  "installRoot"'));
  const obj = JSON.parse(text);
  assert.equal(obj.installRoot, '%LOCALAPPDATA%\\Programs\\Shuko', 'written without expanding %LOCALAPPDATA%');
  assert.equal(obj.keepVersions, 3);
  assert.equal(obj.buildRoot, 'C:\\b');
  assert.equal(path.resolve(obj.builderRepo).toLowerCase(), REPO.toLowerCase());
  assert.ok(r.json.values && r.json.resolved && Array.isArray(r.json.actions));
  assert.ok(!fs.existsSync(path.join(path.dirname(s.cfg), 'local.json.tmp')), 'no temp file left');
});

test('no arguments and an existing file: only reports the resolved values; the file is not changed', () => {
  const text = '{\n  "installRoot": "D:\\\\x",\n  "keepVersions": 4\n}\n';
  const s = setup(text);
  const stat0 = fs.statSync(s.cfg);
  const r = s.run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(s.read(), text);
  assert.equal(fs.statSync(s.cfg).mtimeMs, stat0.mtimeMs);
  assert.equal(r.json.resolved.keepVersions, 4);
  assert.equal(r.json.resolved.installRoot, 'D:\\x');
});

test('an invalid existing file: exit 1, the file is left as it is', () => {
  for (const text of ['{"InstallRoot": "C:\\\\x"}', '{"keepVersions": "3"}', '{"keepVersions": 2,}', '{"installRoot": "%NO_SUCH_VAR_SHUKO%\\\\x"}']) {
    const s = setup(text);
    const r = s.run();
    assert.equal(r.status, 1, text + r.stderr + r.stdout);
    assert.equal(r.json.result, 'error', text);
    assert.equal(s.read(), text);
  }
});

test('-KeepVersions: changes only that value, keeps the others, rewrites in the standard format', () => {
  const s = setup({ installRoot: 'D:\\i', keepVersions: 3, buildRoot: 'E:\\bb' });
  const r = s.run('-KeepVersions', '5');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const obj = JSON.parse(s.read());
  assert.equal(obj.keepVersions, 5);
  assert.equal(obj.installRoot, 'D:\\i');
  assert.equal(obj.buildRoot, 'E:\\bb');
  assert.ok(s.read().endsWith('}\n'));
});

for (const v of ['0', '-2']) {
  test(`-KeepVersions ${v}: exit 1 (keepVersions is 1 or more), local.json unchanged`, () => {
    const s = setup({ keepVersions: 3 });
    const before = s.read();
    const r = s.run('-KeepVersions', v);
    assert.equal(r.status, 1, v + r.stderr + r.stdout);
    assert.equal(s.read(), before);
  });
}

test('-BuildRoot: written as given; a relative path is refused', () => {
  const s = setup({ keepVersions: 3 });
  const r = s.run('-BuildRoot', 'D:\\work');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(s.read()).buildRoot, 'D:\\work');
  const before = s.read();
  const bad = s.run('-BuildRoot', 'relative\\dir');
  assert.equal(bad.status, 1, bad.stderr + bad.stdout);
  assert.equal(s.read(), before);
});

test('-BuildRoot: does not move anything from the previous location', () => {
  const s = setup();
  const oldRoot = path.join(s.root, 'oldbuild');
  writeFile(path.join(oldRoot, 'marker.txt'), 'x');
  fs.writeFileSync(s.cfg, JSON.stringify({ buildRoot: oldRoot }));
  const r = s.run('-BuildRoot', path.join(s.root, 'newbuild'));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(path.join(oldRoot, 'marker.txt')));
});

test('-BuilderRepo: refused without extensions.lock.json in it; accepted with it', () => {
  const s = setup({ keepVersions: 3 });
  const repoNo = path.join(s.root, 'repo-no');
  fs.mkdirSync(repoNo, { recursive: true });
  const before = s.read();
  let r = s.run('-BuilderRepo', repoNo);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(s.read(), before);
  const repoYes = path.join(s.root, 'repo-yes');
  writeFile(path.join(repoYes, 'extensions.lock.json'), '[]');
  r = s.run('-BuilderRepo', repoYes);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(s.read()).builderRepo, repoYes);
});

test('-InstallRoot with -NoMove: only local.json changes; the old location is left as it is; no move', () => {
  const s = setup();
  const A = path.join(s.root, 'A');
  const B = path.join(s.root, 'B');
  makeInstall(A);
  fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A, keepVersions: 3 }));
  const r = s.run('-InstallRoot', B, '-NoMove');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(s.read()).installRoot, B);
  assert.ok(fs.existsSync(path.join(A, 'versions', '1.146.0-1', 'Shuko.exe')));
  assert.ok(fs.existsSync(path.join(A, 'history.txt')));
  assert.ok(isJunctionTo(path.join(A, 'current'), path.join(A, 'versions', '1.146.0-1')));
  assert.ok(!fs.existsSync(path.join(B, 'versions')), 'nothing is moved to B');
});

test('-InstallRoot: moves versions, history.txt and backups; current is recreated at the new place; local.json last', () => {
  const s = setup();
  const A = path.join(s.root, 'A');
  const B = path.join(s.root, 'B');
  makeInstall(A);
  fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A, keepVersions: 3 }));
  const r = s.run('-InstallRoot', B);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.ok(fs.existsSync(path.join(B, 'versions', '1.146.0-1', 'Shuko.exe')));
  assert.equal(fs.readFileSync(path.join(B, 'history.txt'), 'utf8'), '2026-11-14T00:00:00+09:00\t-\t1.146.0-1\n');
  assert.ok(fs.existsSync(path.join(B, 'backups', '20261114-000000', 'User', 'settings.json')));
  assert.ok(isJunctionTo(path.join(B, 'current'), path.join(B, 'versions', '1.146.0-1')), 'junction points into B');
  assert.ok(!fs.existsSync(path.join(A, 'versions')));
  assert.ok(!fs.existsSync(path.join(A, 'history.txt')));
  assert.ok(!fs.existsSync(path.join(A, 'backups')));
  assert.equal(JSON.parse(s.read()).installRoot, B);
  assert.equal(JSON.parse(s.read()).keepVersions, 3, 'other values kept');
});

test('-InstallRoot: the value is written as the user gave it (a %NAME% is not expanded)', () => {
  const s = setup();
  const r = s.run('-InstallRoot', '%SHUKO_TEST_BASE%\\Pct', '-NoMove');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(s.read()).installRoot, '%SHUKO_TEST_BASE%\\Pct');
  assert.equal(r.json.resolved.installRoot.toLowerCase(), path.join(s.root, 'Pct').toLowerCase());
});

test('-InstallRoot: a new location inside the old one, or the old inside the new, is refused; nothing moves', () => {
  for (const [oldName, newName] of [['A', 'A\\inner'], ['A\\inner', 'A']]) {
    const s = setup();
    const A = path.join(s.root, oldName);
    makeInstall(A);
    fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A }));
    const before = s.read();
    const r = s.run('-InstallRoot', path.join(s.root, newName));
    assert.equal(r.status, 1, `${oldName} -> ${newName}: ` + r.stderr + r.stdout);
    assert.equal(s.read(), before);
    assert.ok(fs.existsSync(path.join(A, 'versions', '1.146.0-1', 'Shuko.exe')), 'old location is intact');
    assert.ok(isJunctionTo(path.join(A, 'current'), path.join(A, 'versions', '1.146.0-1')));
  }
});

test('-InstallRoot: a UNC path is refused; so is a relative path', () => {
  for (const bad of ['\\\\localhost\\c$\\shuko-tests-unc', '//localhost/c$/shuko-tests-unc', 'relative\\x']) {
    const s = setup();
    const A = path.join(s.root, 'A');
    makeInstall(A);
    fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A }));
    const before = s.read();
    const r = s.run('-InstallRoot', bad);
    assert.equal(r.status, 1, bad + r.stderr + r.stdout);
    assert.equal(s.read(), before);
    assert.ok(fs.existsSync(path.join(A, 'versions')), 'nothing moved');
  }
});

test('-InstallRoot: a same-named item already in the new location stops the move; the old location is intact', () => {
  const s = setup();
  const A = path.join(s.root, 'A');
  const B = path.join(s.root, 'B');
  makeInstall(A);
  writeFile(path.join(B, 'versions', 'other', 'x.txt'), 'x');
  fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A }));
  const before = s.read();
  const r = s.run('-InstallRoot', B);
  assert.notEqual(r.status, 0, r.stderr + r.stdout);
  assert.equal(s.read(), before, 'local.json is as before');
  assert.ok(fs.existsSync(path.join(A, 'versions', '1.146.0-1', 'Shuko.exe')), 'old versions are intact');
  assert.ok(fs.existsSync(path.join(A, 'history.txt')));
  assert.ok(fs.existsSync(path.join(B, 'versions', 'other', 'x.txt')), 'the existing item is untouched');
});

test('-InstallRoot: a process running from the old location stops it (exit 3); nothing is changed', async (t) => {
  const s = setup();
  const A = path.join(s.root, 'A');
  const B = path.join(s.root, 'B');
  makeInstall(A);
  fs.copyFileSync(process.execPath, path.join(A, 'versions', '1.146.0-1', 'Shuko.exe'));
  fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A }));
  const child = spawn(path.join(A, 'current', 'Shuko.exe'), ['-e', 'setTimeout(()=>{}, 60000)'], { stdio: 'ignore', windowsHide: true });
  t.after(() => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  });
  await new Promise((res) => setTimeout(res, 1500));
  const before = s.read();
  const r = s.run('-InstallRoot', B);
  assert.equal(r.status, 3, r.stderr + r.stdout);
  assert.equal(s.read(), before);
  assert.ok(fs.existsSync(path.join(A, 'versions', '1.146.0-1')));
  assert.ok(!fs.existsSync(path.join(B, 'versions')));
  assert.equal(child.exitCode, null, 'the process is not closed');
  child.kill();
});

test('-InstallRoot twice (A -> B -> A): history survives both moves', () => {
  const s = setup();
  const A = path.join(s.root, 'A');
  const B = path.join(s.root, 'B');
  makeInstall(A);
  fs.writeFileSync(s.cfg, JSON.stringify({ installRoot: A }));
  assert.equal(s.run('-InstallRoot', B).status, 0);
  assert.equal(s.run('-InstallRoot', A).status, 0);
  assert.equal(fs.readFileSync(path.join(A, 'history.txt'), 'utf8'), '2026-11-14T00:00:00+09:00\t-\t1.146.0-1\n');
  assert.ok(isJunctionTo(path.join(A, 'current'), path.join(A, 'versions', '1.146.0-1')));
  assert.equal(JSON.parse(s.read()).installRoot, A);
});
