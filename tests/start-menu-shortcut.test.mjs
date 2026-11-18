// Tests scripts/start-menu-shortcut.ps1 (gives the Start menu shortcut an AppUserModelID).
// Spec: tasks/2026-11-18-start-menu-aumid/brief.md items 2 and 3; docs/user-decisions.md
// "裁定（2026-11-18、タスクバーの右クリックの「New Window」）".
// Everything runs on a fake installRoot and .lnk files in <repo>\tmp\tests\. The real Start menu, the desktop and
// %LOCALAPPDATA%\Programs\Shuko are never touched (-ShortcutPath is always passed).
// The ID is read by the test's own reader (Shell.Application ExtendedProperty), not by the script's -Read.
// Run: node --test tests/start-menu-shortcut.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs } from './build/helpers.mjs';

const SCRIPT = path.join(REPO, 'scripts', 'start-menu-shortcut.ps1');
const OVERLAY_ID = JSON.parse(fs.readFileSync(path.join(REPO, 'product.overlay.json'), 'utf8')).set.win32AppUserModelId; // the value lives under "set"
const PROP_ID = '{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5';
let sb;
let n = 0;

before(() => {
  sb = makeSandbox('tests-smenu-');
  // Independent reader: WScript.Shell for target/workdir, Shell.Application for System.AppUserModel.ID.
  writeFile(
    path.join(sb, 'read-lnk.ps1'),
    [
      'param([string]$Path)',
      '$ErrorActionPreference = "Stop"',
      '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($Path)',
      '$dir = Split-Path -Parent $Path',
      '$item = (New-Object -ComObject Shell.Application).NameSpace($dir).ParseName((Split-Path -Leaf $Path))',
      '$id = $item.ExtendedProperty("System.AppUserModel.ID")',
      '[pscustomobject]@{ target = $s.TargetPath; workdir = $s.WorkingDirectory; id = $(if ($null -eq $id) { $null } else { "$id" }) } | ConvertTo-Json -Compress',
      '',
    ].join('\r\n'),
  );
  // Creates a plain shortcut (no ID) for the overwrite / untouched cases.
  writeFile(
    path.join(sb, 'make-lnk.ps1'),
    [
      'param([string]$Path, [string]$Target, [string]$WorkDir)',
      '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($Path)',
      '$s.TargetPath = $Target',
      '$s.WorkingDirectory = $WorkDir',
      '$s.Save()',
      '',
    ].join('\r\n'),
  );
});
after(() => removeSandbox(sb));

function readLnk(p) {
  const r = runPs(path.join(sb, 'read-lnk.ps1'), ['-Path', p]);
  assert.equal(r.status, 0, 'reader failed: ' + r.stderr + r.stdout);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
}
function makePlainLnk(p, target, workdir) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const r = runPs(path.join(sb, 'make-lnk.ps1'), ['-Path', p, '-Target', target, '-WorkDir', workdir]);
  assert.equal(r.status, 0, 'make-lnk failed: ' + r.stderr + r.stdout);
}
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// A fake installRoot: current\Shuko.exe (empty) and current\resources\app\product.json (optional).
function setup({ productId = 'Test.FromProduct', exe = true, junction = false } = {}) {
  const root = path.join(sb, `r${++n}`);
  const real = junction ? path.join(root, 'versions', '1.0.0-1') : path.join(root, 'current');
  fs.mkdirSync(real, { recursive: true });
  if (exe) fs.writeFileSync(path.join(real, 'Shuko.exe'), '');
  if (productId !== null) writeFile(path.join(real, 'resources', 'app', 'product.json'), JSON.stringify({ nameShort: 'Shuko', win32AppUserModelId: productId }));
  else fs.mkdirSync(path.join(real, 'resources', 'app'), { recursive: true });
  if (junction) fs.symlinkSync(real, path.join(root, 'current'), 'junction');
  const lnk = path.join(root, 'menu', 'Shuko.lnk');
  fs.mkdirSync(path.dirname(lnk), { recursive: true });
  return { root, lnk, cur: path.join(root, 'current') };
}
const run = (s, ...extra) => runPs(SCRIPT, ['-InstallRoot', s.root, '-ShortcutPath', s.lnk, ...extra]);

test('writes target, working folder and the ID from product.json; prints the three lines', () => {
  const s = setup();
  const r = run(s);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(s.lnk));
  const v = readLnk(s.lnk);
  assert.ok(same(v.target, path.join(s.cur, 'Shuko.exe')), v.target);
  assert.ok(same(v.workdir, s.cur), v.workdir);
  assert.equal(v.id, 'Test.FromProduct');
  assert.match(r.stdout, /^TargetPath=.*Shuko\.exe\s*$/im);
  assert.match(r.stdout, /^WorkingDirectory=.*current\s*$/im);
  assert.match(r.stdout, /^AppUserModelId=Test\.FromProduct\s*$/im);
});

test('current as a junction: the shortcut points at current\\, never at versions\\<label>', () => {
  const s = setup({ junction: true });
  const r = run(s);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const v = readLnk(s.lnk);
  assert.ok(same(v.target, path.join(s.cur, 'Shuko.exe')), v.target);
  assert.ok(same(v.workdir, s.cur), v.workdir);
  assert.ok(!/versions/i.test(v.target + v.workdir));
  assert.equal(v.id, 'Test.FromProduct');
});

test('-AppUserModelId overrides the value in product.json', () => {
  const s = setup();
  const r = run(s, '-AppUserModelId', 'Test.Explicit');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(readLnk(s.lnk).id, 'Test.Explicit');
  assert.match(r.stdout, /^AppUserModelId=Test\.Explicit\s*$/im);
});

test('no product.json: the value of product.overlay.json is used', () => {
  const s = setup({ productId: null });
  const r = run(s);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(readLnk(s.lnk).id, OVERLAY_ID);
  assert.equal(OVERLAY_ID, 'Shuko.Editor');
});

test('-Read does not write: bytes and mtime of the .lnk are unchanged, and the three values are printed', () => {
  const s = setup();
  assert.equal(run(s).status, 0);
  const bytes0 = fs.readFileSync(s.lnk);
  const m0 = fs.statSync(s.lnk).mtimeMs;
  const r = run(s, '-Read');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.readFileSync(s.lnk).equals(bytes0), 'content changed');
  assert.equal(fs.statSync(s.lnk).mtimeMs, m0, 'mtime changed');
  assert.match(r.stdout, /Shuko\.exe/i);
  assert.match(r.stdout, /Test\.FromProduct/);
});

test('-Read on a plain shortcut does not add an ID (nothing is written)', () => {
  const s = setup();
  makePlainLnk(s.lnk, path.join(s.cur, 'Shuko.exe'), s.cur);
  const bytes0 = fs.readFileSync(s.lnk);
  const m0 = fs.statSync(s.lnk).mtimeMs;
  run(s, '-Read'); // exit code is not specified for a shortcut without an ID
  assert.ok(fs.readFileSync(s.lnk).equals(bytes0));
  assert.equal(fs.statSync(s.lnk).mtimeMs, m0);
  assert.ok(!readLnk(s.lnk).id);
});

test('-Read with no .lnk: does not create one', () => {
  const s = setup();
  run(s, '-Read');
  assert.ok(!fs.existsSync(s.lnk));
});

test('current\\Shuko.exe missing: exit non-zero and no .lnk is created', () => {
  const s = setup({ exe: false });
  const r = run(s);
  assert.notEqual(r.status, 0, r.stdout);
  assert.ok(!fs.existsSync(s.lnk));
});

test('current\\Shuko.exe missing: an existing .lnk is left as it is', () => {
  const s = setup({ exe: false });
  makePlainLnk(s.lnk, path.join(sb, 'old', 'x.exe'), path.join(sb, 'old'));
  const bytes0 = fs.readFileSync(s.lnk);
  const r = run(s);
  assert.notEqual(r.status, 0);
  assert.ok(fs.readFileSync(s.lnk).equals(bytes0));
});

test('overwrites an existing .lnk of the same name; other .lnk files in the folder are not touched', () => {
  const s = setup();
  const dir = path.dirname(s.lnk);
  const other1 = path.join(dir, 'Other.lnk');
  const other2 = path.join(dir, 'Shuko Old.lnk');
  makePlainLnk(s.lnk, path.join(sb, 'old', 'x.exe'), path.join(sb, 'old'));
  makePlainLnk(other1, path.join(sb, 'o1', 'a.exe'), path.join(sb, 'o1'));
  makePlainLnk(other2, path.join(s.cur, 'Shuko.exe'), s.cur);
  const snap = (p) => ({ b: fs.readFileSync(p), m: fs.statSync(p).mtimeMs });
  const a1 = snap(other1);
  const a2 = snap(other2);
  const r = run(s);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const v = readLnk(s.lnk);
  assert.ok(same(v.target, path.join(s.cur, 'Shuko.exe')), v.target);
  assert.equal(v.id, 'Test.FromProduct');
  for (const [p, a] of [[other1, a1], [other2, a2]]) {
    const b = snap(p);
    assert.ok(b.b.equals(a.b), p + ' content changed');
    assert.equal(b.m, a.m, p + ' mtime changed');
  }
  assert.ok(!readLnk(other2).id, 'other shortcut got an ID');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['Other.lnk', 'Shuko Old.lnk', 'Shuko.lnk']);
});

test('running twice gives the same values (idempotent)', () => {
  const s = setup();
  assert.equal(run(s).status, 0);
  const v1 = readLnk(s.lnk);
  assert.equal(run(s).status, 0);
  assert.deepEqual(readLnk(s.lnk), v1);
});

test('property key used is System.AppUserModel.ID ' + PROP_ID + ' (reader and script agree on a fresh .lnk)', () => {
  // The reader asks the shell for the canonical name, so a wrong PKEY in the script would read back as empty.
  const s = setup();
  assert.equal(run(s).status, 0);
  assert.ok(readLnk(s.lnk).id, 'ID not readable through System.AppUserModel.ID');
});

// configure.ps1 step 5 (re-pointing) keeping the ID is tested in tests/configure.test.mjs (via -ProgramsDir).
