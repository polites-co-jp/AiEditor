// CLI を子のプロセスで呼んで確かめるテスト: tools/watch/watch.mjs（--dry-run・--fixtures・--notion-fake）と、
// notion-sync の pnpm run build（dist ができ、activate がある）。
// 本物の Notion・GitHub・Open VSX・claude -p・タスクスケジューラ・普段使いのデータには触れない。
// watch は一時の builderRepo・installRoot・state-dir と、差し替えの応答（--fixtures）と、差し替えの Notion（--notion-fake）だけを使う。
// notion-sync の build は、拡張のフォルダを一時の場所へ写して行う（リポジトリに dist と node_modules を作らない）。
// 依存の導入（pnpm install）に npm のレジストリへの接続が要る。P34_SKIP_BUILD=1 で build の試しを飛ばせる。
// Run: node --test tests/cli-run.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile } from './build/helpers.mjs';
import { GITHUB_RELEASES_URL, GITHUB_ADVISORIES_URL, openVsxApiUrl } from '../tools/watch/lib/sources.mjs';

let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-cli-');
});
after(() => removeSandbox(sb));

const WATCH = path.join(REPO, 'tools', 'watch', 'watch.mjs');
const rel = (tag) => ({ tag_name: tag, published_at: '2026-11-10T00:00:00Z', html_url: `https://github.com/microsoft/vscode/releases/tag/${tag}`, body: 'See the release notes.', draft: false, prerelease: false });

function watchEnv({ releases = ['1.147.0', '1.146.0'], advisories = [], ext = '2.1.330' } = {}) {
  const root = path.join(sb, `w${++n}`);
  const builder = path.join(root, 'builder');
  const lock = [{ id: 'anthropic.claude-code', version: '2.1.322', targetPlatform: 'win32-x64' }];
  writeFile(path.join(builder, 'upstream.json'), JSON.stringify({ tag: '1.146.0', commit: 'a'.repeat(40), repository: 'https://github.com/microsoft/vscode.git' }));
  writeFile(path.join(builder, 'extensions.lock.json'), JSON.stringify(lock));
  const fixtures = path.join(root, 'fixtures.json');
  const table = {
    [GITHUB_RELEASES_URL]: { status: 200, json: releases.map(rel) },
    [GITHUB_ADVISORIES_URL]: { status: 200, json: advisories },
    [openVsxApiUrl(lock[0])]: { status: 200, json: { version: ext, timestamp: '2026-11-13T00:00:00Z', verified: true } },
    'https://code.visualstudio.com/updates/v1_147': { status: 200, text: '<html><body><h2>Update 1.147.1</h2><p>The update addresses these security issues.</p></body></html>' },
  };
  writeFile(fixtures, JSON.stringify(table));
  const stateDir = path.join(root, 'state');
  const fake = path.join(root, 'fake-notion.json');
  const base = ['--builder-repo', builder, '--install-root', path.join(root, 'install'), '--state-dir', stateDir, '--fixtures', fixtures, '--quiet', '--now', '2026-11-14T03:00:00Z', '--time-zone', 'Asia/Tokyo'];
  const run = (...extra) => {
    const r = spawnSync(process.execPath, [WATCH, ...base, ...extra], { cwd: REPO, encoding: 'utf8', timeout: 60000, env: { ...process.env, LOCALAPPDATA: root } });
    let json = null;
    try {
      json = JSON.parse(r.stdout.slice(r.stdout.search(/^\{/m)));
    } catch {
      /* no JSON */
    }
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
  };
  const pages = () => (fs.existsSync(fake) ? Object.values(JSON.parse(fs.readFileSync(fake, 'utf8')).pages) : []);
  return { root, stateDir, fake, run, pages, fixtures, table };
}
const title = (p) => p.properties['タスク'].title.map((t) => t.text.content).join('');
const sel = (p, k) => (p.properties[k].select || p.properties[k].status || {}).name;

test('CLI watch --dry-run --fixtures: 計画（作る ToDo の題名・優先度・期限）を JSON で出して終了コード 0。Notion にも state.json・watch.log にも書かない', () => {
  const w = watchEnv();
  const r = w.run('--dry-run');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.dryRun, true);
  const core = r.json.plan.find((p) => p.key === 'core');
  assert.equal(core.title, '取り込みの検証: 本体 1.147.0');
  assert.equal(core.priority, '中');
  assert.equal(core.due, '2026-11-21');
  const ext = r.json.plan.find((p) => p.key === 'ext:anthropic.claude-code');
  assert.equal(ext.title, '取り込みの検証: 拡張 anthropic.claude-code 2.1.330');
  assert.ok(!fs.existsSync(w.stateDir), 'state-dir に何も作らない');
  assert.ok(!fs.existsSync(w.fake));
});
test('CLI watch --dry-run: リリースノートに security の文がある版は「セキュリティ修正あり」・高・翌日', () => {
  const w = watchEnv({ releases: ['1.147.1', '1.147.0', '1.146.0'] });
  const r = w.run('--dry-run');
  const core = r.json.plan.find((p) => p.key === 'core');
  assert.equal(core.title, '取り込みの検証: 本体 1.147.1（セキュリティ修正あり）');
  assert.equal(core.priority, '高');
  assert.equal(core.due, '2026-11-15');
  assert.equal(core.security, true);
});
test('CLI watch --dry-run: 取得が失敗する URL があれば終了コード 1（計画は出す）。書いていない URL は取得の失敗として数える', () => {
  const w = watchEnv();
  const t = { ...w.table };
  delete t[openVsxApiUrl({ id: 'anthropic.claude-code', targetPlatform: 'win32-x64' })];
  fs.writeFileSync(w.fixtures, JSON.stringify(t));
  const r = w.run('--dry-run');
  assert.equal(r.status, 1);
  assert.equal(r.json.fetchOk, false);
  assert.ok(r.json.plan.some((p) => p.key === 'core'), '取れたものの計画は出る');
});
test('CLI watch --notion-fake: 差し替えの Notion に ToDo を作り、state.json と watch.log を書く。2回流しても足さない（重複しない）', () => {
  const w = watchEnv();
  const r1 = w.run('--notion-fake', w.fake);
  assert.equal(r1.status, 0, r1.stderr + r1.stdout);
  assert.equal(w.pages().length, 2);
  assert.deepEqual(w.pages().map(title).sort(), ['取り込みの検証: 拡張 anthropic.claude-code 2.1.330', '取り込みの検証: 本体 1.147.0']);
  const core = w.pages().find((p) => title(p).includes('本体'));
  assert.equal(sel(core, '状態'), 'Not started');
  assert.equal(sel(core, '優先度'), '中');
  assert.equal(core.properties['期限'].date.start, '2026-11-21');
  assert.equal(sel(core, '期限の形式'), '終了日のみ');
  const state = JSON.parse(fs.readFileSync(path.join(w.stateDir, 'state.json'), 'utf8'));
  assert.equal(state.targets.core.lastNotifiedVersion, '1.147.0');
  assert.ok(state.lastSuccessAt);
  assert.ok(fs.existsSync(path.join(w.stateDir, 'watch.log')));
  const r2 = w.run('--notion-fake', w.fake);
  assert.equal(r2.status, 0);
  assert.equal(w.pages().length, 2, '2回目で足さない');
  assert.deepEqual(r2.json.plan, []);
});
test('CLI watch --notion-fake: state.json を消しても、検索で開いている ToDo を見つけて重複しない。新しい版は同じページを直す', () => {
  const w = watchEnv();
  w.run('--notion-fake', w.fake);
  fs.rmSync(path.join(w.stateDir, 'state.json'));
  fs.writeFileSync(w.fixtures, JSON.stringify({ ...w.table, [GITHUB_RELEASES_URL]: { status: 200, json: ['1.147.1', '1.147.0', '1.146.0'].map(rel) } }));
  const r = w.run('--notion-fake', w.fake);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(w.pages().length, 2);
  const core = w.pages().find((p) => title(p).includes('本体'));
  assert.equal(title(core), '取り込みの検証: 本体 1.147.1（セキュリティ修正あり）');
  assert.equal(sel(core, '優先度'), '高');
});
test('CLI watch --notion-fake: ページを Done にしたあとに新しい版が出たら、新しい ToDo を作る', () => {
  const w = watchEnv();
  w.run('--notion-fake', w.fake);
  const db = JSON.parse(fs.readFileSync(w.fake, 'utf8'));
  for (const p of Object.values(db.pages)) p.properties['状態'] = { status: { name: 'Done' } };
  fs.writeFileSync(w.fake, JSON.stringify(db));
  fs.writeFileSync(w.fixtures, JSON.stringify({ ...w.table, [GITHUB_RELEASES_URL]: { status: 200, json: ['1.148.0', '1.147.0', '1.146.0'].map(rel) } }));
  const r = w.run('--notion-fake', w.fake);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(w.pages().length, 3, '本体の新しい ToDo が足される');
});
test('CLI watch --check --notion-fake: ToDo のデータソースの項目を確かめる（書かない）。項目が違えば終了コード 1', () => {
  const w = watchEnv();
  const ok = w.run('--check', '--notion-fake', w.fake);
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.equal(ok.json.ok, true);
  const db = JSON.parse(fs.readFileSync(w.fake, 'utf8') || '{}');
  assert.equal(Object.keys(db.pages || {}).length, 0);
  delete db.dataSource.properties['優先度'];
  fs.writeFileSync(w.fake, JSON.stringify(db));
  const bad = w.run('--check', '--notion-fake', w.fake);
  assert.equal(bad.status, 1);
  assert.ok(bad.json.schemaErrors.some((e) => e.includes('優先度')));
});
test('CLI watch: データソースの項目が違うと、ToDo を書かずに終了コード 1', () => {
  const w = watchEnv();
  assert.equal(w.run('--check', '--notion-fake', w.fake).status, 0);
  const db = JSON.parse(fs.readFileSync(w.fake, 'utf8'));
  delete db.dataSource.properties['期限'];
  fs.writeFileSync(w.fake, JSON.stringify(db));
  const r = w.run('--notion-fake', w.fake);
  assert.equal(r.status, 1);
  assert.equal(w.pages().length, 0);
});
test('CLI watch --check-token: トークンのファイルが無ければ終了コード 1（値は出さない）。別の場所を渡して秘密の場所を開かない', () => {
  const w = watchEnv();
  const r = w.run('--check-token', '--token-file', path.join(w.root, 'none.dpapi'));
  assert.equal(r.status, 1);
  assert.ok(!(r.stdout + r.stderr).match(/ntn_|secret_/));
});
test('CLI watch: builderRepo の台帳が読めなければ終了コード 2。--write-back で verdict.json が無ければ止まる', () => {
  const w = watchEnv();
  const bad = spawnSync(process.execPath, [WATCH, '--builder-repo', path.join(w.root, 'none'), '--install-root', w.root, '--state-dir', w.stateDir, '--fixtures', w.fixtures, '--dry-run', '--quiet'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, LOCALAPPDATA: w.root } });
  assert.equal(bad.status, 2);
  const wb = w.run('--write-back', path.join(w.root, 'none.json'), '--target', 'core', '--notion-fake', w.fake);
  assert.notEqual(wb.status, 0);
});
test('CLI watch --write-back: 判定の要約を差し替えの Notion の ToDo に足し、In progress にする', () => {
  const w = watchEnv();
  w.run('--notion-fake', w.fake);
  const v = path.join(w.root, 'verdict.json');
  writeFile(v, JSON.stringify({ label: '1.147.0-1', verdict: 'conditional', recommendation: '条件を満たしてから', checks: 'ok', build: 'ok', smoke: { auto: 'ok', manualToDo: [] }, network: { newHosts: ['x.example.com'] }, conditions: ['宛先を決める'] }));
  const r = w.run('--write-back', v, '--target', 'core', '--notion-fake', w.fake);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const core = w.pages().find((p) => title(p).includes('本体'));
  assert.equal(sel(core, '状態'), 'In progress');
  assert.ok(JSON.stringify(core.children).includes('1.147.0-1'));
});

// ---- notion-sync の build（dist ができ、activate がある）----
const skipBuild = process.env.P34_SKIP_BUILD === '1' ? 'P34_SKIP_BUILD=1' : false;
test('notion-sync: pnpm run build で dist/extension.js ができ、activate・deactivate を書き出す（vscode を差し替えて読み込む）。package.json の宣言も満たす', { skip: skipBuild, timeout: 600000 }, () => {
  const src = path.join(REPO, 'extensions-src', 'notion-sync');
  const dst = path.join(sb, 'notion-sync');
  fs.cpSync(src, dst, { recursive: true, filter: (p) => !/[\\/](node_modules|dist)([\\/]|$)/.test(p) });
  const pnpm = (args) => spawnSync('pnpm', ['--dir', dst, ...args], { cwd: sb, encoding: 'utf8', shell: true, timeout: 540000, env: { ...process.env, CI: 'true' } });
  const inst = pnpm(['install', '--frozen-lockfile', '--ignore-scripts']);
  assert.equal(inst.status, 0, `pnpm install: ${(inst.stdout + inst.stderr).slice(-1500)}`);
  const b = pnpm(['run', 'build']);
  assert.equal(b.status, 0, `pnpm run build: ${(b.stdout + b.stderr).slice(-1500)}`);
  const out = path.join(dst, 'dist', 'extension.js');
  assert.ok(fs.existsSync(out), 'dist/extension.js');
  assert.ok(fs.statSync(out).size > 10000, '1つにまとめられている');
  const text = fs.readFileSync(out, 'utf8');
  assert.ok(!/require\(["']jsonc-parser["']\)/.test(text), 'jsonc-parser が dist に入っている（外に残さない）');
  const probe = `
    const Module = require('module');
    const orig = Module._load;
    const stub = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : new Proxy(function () {}, { get: () => () => ({}), apply: () => ({}) })) });
    Module._load = function (r, ...a) { return r === 'vscode' ? stub : orig.call(this, r, ...a); };
    const m = require(process.argv[1]);
    console.log(JSON.stringify({ activate: typeof m.activate, deactivate: typeof m.deactivate }));
  `;
  const r = spawnSync(process.execPath, ['-e', probe, out], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.equal(got.activate, 'function');
  assert.ok(['function', 'undefined'].includes(got.deactivate));
});
test('notion-sync の package.json: main は dist/extension.js、onStartupFinished、設定3つ（enabled の既定は false）、コマンド5つ（docs/05 の9節）', () => {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'extensions-src', 'notion-sync', 'package.json'), 'utf8'));
  assert.equal(p.main, './dist/extension.js');
  assert.deepEqual(p.activationEvents, ['onStartupFinished']);
  const props = p.contributes.configuration.properties;
  assert.deepEqual(Object.keys(props).sort(), ['notionSync.enabled', 'notionSync.ignoredSettings', 'notionSync.pageId']);
  assert.equal(props['notionSync.enabled'].default, false);
  assert.deepEqual(props['notionSync.ignoredSettings'].default, []);
  assert.equal(p.contributes.commands.length, 5);
  assert.deepEqual(p.contributes.commands.map((c) => c.command).sort(), ['notionSync.clearToken', 'notionSync.export', 'notionSync.import', 'notionSync.setToken', 'notionSync.showDiff']);
});
test('notion-sync の package.json: 依存の版は固定（範囲の ^ ~ を使わない）。トークンを設定に置く項目が無い', () => {
  const p = JSON.parse(fs.readFileSync(path.join(REPO, 'extensions-src', 'notion-sync', 'package.json'), 'utf8'));
  for (const [k, v] of Object.entries({ ...p.dependencies, ...p.devDependencies })) assert.match(v, /^\d+\.\d+\.\d+$/, `${k}: ${v}`);
  assert.ok(!Object.keys(p.contributes.configuration.properties).some((k) => /token/i.test(k)));
});
