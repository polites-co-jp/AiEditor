// 改名（旧の名前 → Sukuna）の入口の期待（tasks/2026-11-18-rename-sukuna-survey/rename-plan.md の 5節・2節の表）。
// 仕様（2026-11-18 の裁定「エディタの名前」）から起こした。実装の中身は見ずに、入口の値だけを照らす。
// 本物の %LOCALAPPDATA% などには触れない（環境は引数・環境変数で模擬に替える）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, runPs, cleanEnv } from './build/helpers.mjs';
import { localConfigPath, DEFAULTS } from '../scripts/lib/local-config.mjs';
import { PROJECT_NAME, watchDir, watchStatePath, watchTokenPath } from '../scripts/lib/notion-todo.mjs';
import { COMMIT_NAME, COMMIT_EMAIL } from '../scripts/lib/apply/git.mjs';
import { PACK_ID } from '../scripts/l10n-ja.mjs';

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const lsFiles = (...args) => spawnSync('git', ['ls-files', ...args], { cwd: REPO, encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);

test('local-config.mjs: local.json の置き場所は %LOCALAPPDATA%\\Sukuna\\local.json', () => {
  assert.equal(localConfigPath({ LOCALAPPDATA: 'C:\\L' }), 'C:\\L\\Sukuna\\local.json');
});
test('local-config.mjs: DEFAULTS.installRoot は %LOCALAPPDATA%\\Programs\\Sukuna', () => {
  assert.equal(DEFAULTS.installRoot, '%LOCALAPPDATA%\\Programs\\Sukuna');
});

test('local-config.ps1: Get-SukunaLocalConfigPath と Resolve-SukunaLocalConfig の既定の installRoot（PowerShell 版）', () => {
  const lib = path.join(REPO, 'scripts', 'lib', 'local-config.ps1');
  const cmd = `. '${lib}'; Write-Output (Get-SukunaLocalConfigPath); $r = Resolve-SukunaLocalConfig -ConfigPath (Join-Path $env:LOCALAPPDATA 'nowhere\\local.json'); Write-Output $r.installRoot`;
  const la = path.join(REPO, 'tmp', 'tests', 'entries-la');
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { env: cleanEnv({ LOCALAPPDATA: la }), encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.stdout.split(/\r?\n/).filter(Boolean);
  assert.equal(lines[0], path.win32.join(la, 'Sukuna', 'local.json'));
  assert.equal(lines[1], path.win32.join(la, 'Programs', 'Sukuna'), '既定の installRoot は展開済み');
});

test('notion-todo.mjs: PROJECT_NAME は Sukuna、検知の状態の場所は <LOCALAPPDATA>\\Sukuna\\watch', () => {
  assert.equal(PROJECT_NAME, 'Sukuna');
  const env = { LOCALAPPDATA: 'C:\\L' };
  assert.equal(watchDir(env), 'C:\\L\\Sukuna\\watch');
  assert.equal(watchStatePath(env), 'C:\\L\\Sukuna\\watch\\state.json');
  assert.equal(watchTokenPath(env), 'C:\\L\\Sukuna\\watch\\notion-token.dpapi');
});

test('apply/git.mjs: コミットの作者は sukuna-apply <apply@sukuna.invalid>', () => {
  assert.equal(COMMIT_NAME, 'sukuna-apply');
  assert.equal(COMMIT_EMAIL, 'apply@sukuna.invalid');
});

test('l10n-ja.mjs: PACK_ID は sukuna.language-pack-ja', () => {
  assert.equal(PACK_ID, 'sukuna.language-pack-ja');
});

test('product.overlay.json: set の名前の12キーと独自キー（2節の表）。GUID 4つは変えない', () => {
  const o = JSON.parse(read('product.overlay.json'));
  const s = o.set;
  const want = {
    nameShort: 'Sukuna', nameLong: 'Sukuna', applicationName: 'sukuna', dataFolderName: '.sukuna', sharedDataFolderName: '.sukuna-shared',
    urlProtocol: 'sukuna', win32MutexName: 'sukuna', win32DirName: 'Sukuna', win32NameVersion: 'Sukuna', win32RegValueName: 'Sukuna',
    win32AppUserModelId: 'Sukuna.Editor', win32ShellNameShort: '&Sukuna',
  };
  for (const [k, v] of Object.entries(want)) assert.equal(s[k], v, k);
  assert.equal(s.win32x64AppId, '{{5B8E2C47-9A1D-4F36-B0E2-7C4D91A3F658}');
  assert.equal(s.win32arm64AppId, '{{A3F17D92-46C8-4E0B-9D25-1B6E8F40C7A3}');
  assert.equal(s.win32x64UserAppId, '{{C9042E6B-7F3A-4D81-A5E9-62B0D8F1347C}');
  assert.equal(s.win32arm64UserAppId, '{{0E7B5A18-D2C4-49F7-8B36-F5A1C09E2D84}');
  const OLD_KEY = 'shu' + 'koConfigurationDefaults';
  assert.ok(!(OLD_KEY in s), '古い独自キーが残っていない');
  assert.deepEqual(s.sukunaConfigurationDefaults, {
    'extensions.allowed': { '*': false, 'anthropic.claude-code': true, 'detachhead.basedpyright': true, 'ms-vscode.powershell': true, 'mads-hartmann.bash-ide-vscode': true, 'mechatroner.rainbow-csv': true, 'weixu.wx-vsce-dotenv': true, 'tomoki1207.pdf': true },
    'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'workbench.enableExperiments': false, 'extensions.autoUpdate': 'off', 'extensions.autoCheckUpdates': false,
  }, '中身は改名の前と同じ');
});

test('removals/*/edits.patch と patches/*.patch: 作者は sukuna-apply <apply@sukuna.invalid>、古い作者は無い', () => {
  const patches = lsFiles('removals', 'patches').filter((f) => f.endsWith('.patch'));
  assert.ok(patches.length >= 13, `パッチの数 ${patches.length}`);
  const OLD_FROM = new RegExp('^From: shu' + 'ko-apply', 'm');
  const edits = patches.filter((f) => /\/edits\.patch$/.test(f));
  assert.ok(edits.length >= 13, `edits.patch の数 ${edits.length}`);
  for (const f of edits) {
    const t = read(f);
    assert.ok(/^From: sukuna-apply <apply@sukuna\.invalid>/m.test(t), `${f}: From: が sukuna-apply`);
    assert.ok(!OLD_FROM.test(t), `${f}: 古い From: が残っている`);
  }
});

test('tools/watch/register-task.ps1 -DryRun: タスクは \\Sukuna\\watch', () => {
  const r = runPs(path.join(REPO, 'tools', 'watch', 'register-task.ps1'), ['-DryRun', '-BuilderRepo', REPO], { env: { LOCALAPPDATA: path.join(REPO, 'tmp', 'tests', 'entries-la') } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /register-task: task\s+\\Sukuna\\watch/);
  assert.ok(!new RegExp('\\\\Shu' + 'ko\\\\', 'i').test(r.stdout), '古いタスクの場所が出ていない');
});

test('start-menu-shortcut.ps1: 実行ファイルとショートカットの名前は版の product.json の nameShort から（Sukuna.exe・Sukuna.lnk・Sukuna.Editor）', () => {
  // 詳細は tests/start-menu-shortcut.test.mjs。ここでは台本に古い名前の決め打ちが無いことだけを見る。
  const t = read('scripts/start-menu-shortcut.ps1');
  assert.ok(!/shu[k]o/i.test(t), '古い名前が台本に残っていない');
  assert.ok(/Sukuna\.Editor/.test(t) || /nameShort/.test(t), 'AppUserModelID と実行ファイルの名前が新しい名前から決まる');
});
