// scripts/install-extensions.mjs を実際に流し、--portable の場所が無くても普段の場所に入らないことを確かめる。
// 仕様: brief tasks/2026-11-15-install-doc-fix/brief.md の「やること（蒙恬）」1、docs/04 の5節。
// 本物のエディタは起動しない。偽の CLI（node で動く .cmd）を使い、エディタの configurePortable
// （1.146.0 の src/bootstrap-node.ts）と同じ「場所が在るときだけポータブルとして扱い、無ければ黙って普段の場所に入れる」を真似る。
// 普段の場所の代わりに、サンドボックスの USERPROFILE の下の .sukuna を使う（本物の %USERPROFILE% には触れない）。
// Run: node --test tests/install-portable.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode, parseJsonOut, makeFakeEditor } from './build/helpers.mjs';
import { vsixCachePath } from '../scripts/install-extensions.mjs';

const SCRIPT = path.join(REPO, 'scripts', 'install-extensions.mjs');
let sb;
let n = 0;

before(() => {
  sb = makeSandbox('tests-instp-');
});
after(() => removeSandbox(sb));

const FAKE_CLI_MJS = `
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const env = process.env;
const home = path.join(env.USERPROFILE, env.FAKE_DATA_FOLDER);
// configurePortable の真似: VSCODE_PORTABLE があっても、その場所が無ければ黙って捨てる
const portable = env.VSCODE_PORTABLE && fs.existsSync(env.VSCODE_PORTABLE) ? env.VSCODE_PORTABLE : null;
const extDirIdx = args.indexOf('--extensions-dir');
const extDir = extDirIdx >= 0 ? args[extDirIdx + 1] : portable ? path.join(portable, 'extensions') : path.join(home, 'extensions');
fs.appendFileSync(env.FAKE_LOG, JSON.stringify({
  args,
  vscodePortable: env.VSCODE_PORTABLE ?? null,
  portableExistedAtCall: env.VSCODE_PORTABLE ? fs.existsSync(env.VSCODE_PORTABLE) : null,
  effectiveExtDir: extDir,
}) + '\\n');
if (args.includes('--install-extension')) {
  const file = args[args.indexOf('--install-extension') + 1];
  fs.mkdirSync(extDir, { recursive: true });
  fs.writeFileSync(path.join(extDir, path.basename(file)), 'installed');
  console.log('Extension installed');
} else if (args.includes('--list-extensions')) {
  process.stdout.write(fs.readFileSync(env.FAKE_LIST, 'utf8'));
}
`;

// 偽のエディタ（偽の CLI つき）、台帳 1 件、キャッシュ済みの VSIX を用意する。
function setup({ dataFolderName = '.sukuna' } = {}) {
  const root = path.join(sb, `t${++n}`);
  const editor = path.join(root, 'ed');
  makeFakeEditor(editor, { dataFolderName });
  const cli = path.join(editor, 'bin', 'sukuna.cmd');
  writeFile(path.join(editor, 'bin', 'fake-cli.mjs'), FAKE_CLI_MJS);
  writeFile(cli, `@echo off\r\n"${process.execPath}" "%~dp0fake-cli.mjs" %*\r\nexit /b %errorlevel%\r\n`);

  const cache = path.join(root, 'cache');
  const entry = {
    id: 'pub.ext',
    version: '1.0.0',
    source: 'open-vsx',
    download: 'https://open-vsx.org/api/pub/ext/1.0.0/file/pub.ext-1.0.0.vsix',
    sha256: '',
    publishedAt: '2026-01-01T00:00:00Z',
    verified: true,
    engines: '^1.94.0',
  };
  const vsix = vsixCachePath(cache, entry);
  writeFile(vsix, 'fake vsix');
  entry.sha256 = crypto.createHash('sha256').update('fake vsix').digest('hex');
  const lock = path.join(root, 'lock.json');
  writeFile(lock, JSON.stringify([entry]));
  const list = path.join(root, 'list.txt');
  writeFile(list, 'pub.ext@1.0.0\n');
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, '{}');
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const log = path.join(root, 'cli-log.jsonl');
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
  const run = (...extra) => {
    const r = runNode(
      [SCRIPT, '--cli', cli, '--lock', lock, '--cache', cache, '--no-download', '--install-root', path.join(root, 'inst'), '--build-root', path.join(root, 'bld'), '--config', cfg, ...extra],
      { env: { USERPROFILE: profile, APPDATA: path.join(root, 'appdata'), HOME: profile, FAKE_LOG: log, FAKE_LIST: list, FAKE_DATA_FOLDER: dataFolderName } },
    );
    let json = null;
    try {
      json = parseJsonOut(r.stdout);
    } catch {
      /* no JSON */
    }
    return { ...r, json };
  };
  return { root, profile, dataFolderName, daily: path.join(profile, dataFolderName), calls, run };
}

test('無い --portable の場所: 作られ、CLI の環境の VSCODE_PORTABLE がその場所を指し、拡張はそこに入る', () => {
  const s = setup();
  const portable = path.join(s.root, 'p', 'new-portable');
  assert.equal(fs.existsSync(portable), false);
  const r = s.run('--portable', portable);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.ok(fs.statSync(portable).isDirectory(), 'portable folder is created');
  const calls = s.calls();
  assert.ok(calls.length >= 2, 'install + list');
  for (const c of calls) {
    assert.equal(path.resolve(c.vscodePortable).toLowerCase(), path.resolve(portable).toLowerCase());
    assert.equal(c.portableExistedAtCall, true, 'the folder exists before the CLI runs');
  }
  // 拡張は <portable>\extensions に入る
  assert.ok(fs.existsSync(path.join(portable, 'extensions', 'pub.ext-1.0.0.vsix')));
  // 普段の場所には何も出来ない
  assert.equal(fs.existsSync(s.daily), false, 'daily data folder must not appear');
  // argv.json も <portable> に書かれる
  const argv = fs.readFileSync(path.join(portable, 'argv.json'), 'utf8');
  assert.match(argv, /"locale":\s*"ja"/);
  assert.equal(fs.readdirSync(s.profile).length, 0, 'nothing in USERPROFILE');
});

test('入れ子の無い場所（親も無い）でも作られる（mkdir -p）', () => {
  const s = setup();
  const portable = path.join(s.root, 'a', 'b', 'c', 'portable');
  const r = s.run('--portable', portable);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(path.join(portable, 'extensions', 'pub.ext-1.0.0.vsix')));
  assert.equal(fs.existsSync(s.daily), false);
});

test('在る --portable の場所: そのまま使う（中身は消さない）', () => {
  const s = setup();
  const portable = path.join(s.root, 'portable');
  writeFile(path.join(portable, 'keep.txt'), 'keep');
  const r = s.run('--portable', portable);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(fs.readFileSync(path.join(portable, 'keep.txt'), 'utf8'), 'keep');
  assert.ok(fs.existsSync(path.join(portable, 'extensions', 'pub.ext-1.0.0.vsix')));
  assert.equal(fs.existsSync(s.daily), false);
});

test('相対パスの --portable: 絶対パスにして渡す（cwd に依らず同じ場所を指す）', () => {
  const s = setup();
  const portable = path.join(s.root, 'rel-portable');
  const r = s.run('--portable', path.relative(REPO, portable));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const c of s.calls()) assert.equal(path.resolve(c.vscodePortable).toLowerCase(), portable.toLowerCase());
  assert.ok(path.isAbsolute(s.calls()[0].vscodePortable));
  assert.ok(fs.existsSync(path.join(portable, 'extensions')));
});

test('守り: 本家の dataFolderName（.vscode）で --portable も --extensions-dir も無ければ止まる。CLI は走らず、何も作らない', () => {
  const s = setup({ dataFolderName: '.vscode' });
  const r = s.run();
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
  assert.match(r.json.message, /--portable/);
  assert.equal(s.calls().length, 0);
  assert.equal(fs.existsSync(s.daily), false);
});

test('守り: 本家の dataFolderName（.vscode）でも、--portable だけで（場所が無くても）本家の場所に入らない', () => {
  for (const dataFolderName of ['.vscode', '.vscode-oss', '.vscode-insiders']) {
    const s = setup({ dataFolderName });
    const portable = path.join(s.root, 'portable');
    const r = s.run('--portable', portable);
    assert.equal(r.status, 0, `${dataFolderName}: ${r.stderr}${r.stdout}`);
    for (const c of s.calls()) assert.equal(c.portableExistedAtCall, true);
    assert.ok(fs.existsSync(path.join(portable, 'extensions', 'pub.ext-1.0.0.vsix')), dataFolderName);
    assert.equal(fs.existsSync(s.daily), false, `${dataFolderName}: daily folder must not appear`);
  }
});

test('守り: 本家の dataFolderName で --extensions-dir だけなら通り、その場所に入る', () => {
  const s = setup({ dataFolderName: '.vscode' });
  const ext = path.join(s.root, 'ext');
  const r = s.run('--extensions-dir', ext, '--argv', path.join(s.root, 'argv.json'));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(path.join(ext, 'pub.ext-1.0.0.vsix')));
  assert.equal(fs.existsSync(s.daily), false);
});

test('--dry-run: CLI を走らせず、argv.json を書かず、普段の場所に何も作らない', () => {
  const s = setup();
  const portable = path.join(s.root, 'portable-dry');
  const r = s.run('--portable', portable, '--dry-run');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'dry-run');
  assert.equal(s.calls().length, 0);
  assert.equal(fs.existsSync(path.join(portable, 'argv.json')), false);
  assert.equal(fs.existsSync(s.daily), false);
});

test('--dry-run は --portable の場所を作らない', () => {
  const s = setup();
  const portable = path.join(s.root, 'portable-dry2');
  const r = s.run('--portable', portable, '--dry-run');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(fs.existsSync(portable), false);
});

test('product.json に target がある版（インストーラーの版）: --portable は効かないので、何も入れずに止まる', () => {
  const s = setup();
  const pj = path.join(s.root, 'ed', 'resources', 'app', 'product.json');
  const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
  p.target = 'user';
  fs.writeFileSync(pj, JSON.stringify(p));
  const portable = path.join(s.root, 'portable-target');
  const r = s.run('--portable', portable);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.match(r.json.message, /target/);
  assert.equal(s.calls().length, 0);
  assert.equal(fs.existsSync(s.daily), false);
});

test('CLI が --portable を黙って捨てて普段の場所に入れた場合: 成功にしない（終了コード 1）', () => {
  const s = setup();
  const portable = path.join(s.root, 'portable-ignored');
  // 偽の CLI が VSCODE_PORTABLE を無視する版
  const mjs = path.join(s.root, 'ed', 'bin', 'fake-cli.mjs');
  fs.writeFileSync(mjs, fs.readFileSync(mjs, 'utf8').replace('env.VSCODE_PORTABLE && fs.existsSync(env.VSCODE_PORTABLE)', 'false'));
  const r = s.run('--portable', portable);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'error');
  assert.match(r.json.message, /普段の場所/);
});

test('出力の JSON: portable に場所・作ったか・拡張の場所が入る', () => {
  const s = setup();
  const portable = path.join(s.root, 'portable-json');
  const r = s.run('--portable', portable);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(path.resolve(r.json.portable.path).toLowerCase(), portable.toLowerCase());
  assert.equal(r.json.portable.created, true);
  assert.equal(path.resolve(r.json.portable.extensionsDir).toLowerCase(), path.join(portable, 'extensions').toLowerCase());
  assert.equal(r.json.portable.extensionsDirExists, true);
});

test('SHA-256 の不一致: 何も入れず、場所も作らない', () => {
  const s = setup();
  const lock = JSON.parse(fs.readFileSync(path.join(s.root, 'lock.json'), 'utf8'));
  lock[0].sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(s.root, 'lock.json'), JSON.stringify(lock));
  const portable = path.join(s.root, 'portable-bad');
  const r = s.run('--portable', portable);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  assert.equal(s.calls().length, 0);
  assert.equal(fs.existsSync(s.daily), false);
});
