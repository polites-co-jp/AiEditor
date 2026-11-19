// 小さな直し3つのテスト(2026-11-16。tasks/2026-11-16-small-fixes/brief.md の「やること（曹参）」)。
// 判断の記録: docs/user-decisions.md「C:\b を消す前の確かめで出た点」「Team の返答で課に求められた点」(R22)。
//   1. extensions-src/notion-sync/dev/trial.mts の既定の置き場所が C:\b でない(<buildRoot> か tmp/ の下)
//   2. scripts/check-env.ps1 が本物の環境で起こす pnpm・npm の子の環境の、キャッシュの向け先が <buildRoot> の下(build-env.mjs と同じ向け先)
//   3. scripts/take-in.mjs の --records-dir が records/take-in/ の外を指したら止まる(判定役の狄仁傑は records/take-in/ しか読めない)
// 状態: 3つの直しは蒙恬が入れ、大岡越前守が検証して合格した(2026-11-16)。このテストは、直しを外す退行を捕まえる見張りとして残す。
//   入口: trial.mts の defaultTrialRoot・makeTrialRunDir、scripts/lib/child-cache-env.ps1 の Get-SukunaChildCacheEnv(build-env.mjs の cacheEnvVars の PowerShell 版)、
//         scripts/lib/take-in/records.mjs の recordsDirProblem(repoRoot・cwd を渡して、本物の records/ に触れずに直接呼べる)。
// 試しは <リポジトリ>\tmp\tests\ の下(tests/build/helpers.mjs の makeSandbox)。C:\b・本物の tmp\b・普段使いのデータには触れない。
// Run: node --test tests/small-fixes.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut } from './build/helpers.mjs';
import { cacheEnvVars, cacheLayout, IF_PRESENT_VARS } from '../scripts/lib/build-env.mjs';
import { recordsDirProblem } from '../scripts/lib/take-in/records.mjs';

const IF_PRESENT_NAMES = Object.keys(IF_PRESENT_VARS); // ELECTRON_CACHE・electron_config_cache・ELECTRON_BUILDER_CACHE・npm_config_devdir・PLAYWRIGHT_BROWSERS_PATH・COREPACK_HOME

const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };
/** ジャンクションを作れなければ null(許可が無い環境)。 */
function junction(target, link) {
  try { fs.symlinkSync(target, link, 'junction'); return link; } catch { return null; }
}
const dropLink = (p) => { try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* 無い */ } } };
/** フォルダの木を { 相対パス: 'sha256 か <dir>:サイズ' } にする。 */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { out[rel] = '<dir>'; walk(p); } else out[rel] = `${fs.statSync(p).size}:${fs.statSync(p).mtimeMs}`;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

let sb;
before(() => { sb = makeSandbox('tests-smallfix-'); });
after(() => removeSandbox(sb));

// ===========================================================================
// 1. trial.mts の既定の置き場所
//    想定した入口: 既定(NOTION_SYNC_TRIAL_DIR が無いとき)の場所が、C:\b の決め打ちでなく、<buildRoot>(local.json)か tmp/ の下の式になる。
//    本物の試し(trial.mts の main)は走らせない。台本が何かを消す行が無いことは静的に読み、defaultTrialRoot・makeTrialRunDir は関数で試す。
// ===========================================================================
const TRIAL = path.join(REPO, 'extensions-src', 'notion-sync', 'dev', 'trial.mts');
const trialSrc = fs.readFileSync(TRIAL, 'utf8');
const trialCode = trialSrc.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, ''));

test('trial.mts: 既定の置き場所に C:\\b を決め打ちで持たない(消した後に走らせても C: を作らない)', () => {
  const hits = trialSrc.split(/\r?\n/).map((l, i) => ({ l, i: i + 1 })).filter((x) => /C:\\\\b\b|C:\\b\b|C:\/b\b/i.test(x.l) && !/^\s*\/\//.test(x.l));
  assert.deepEqual(hits.map((x) => `${x.i}: ${x.l.trim()}`), [], 'C:\\b を決め打ちで持つ行が残っている');
});

test('trial.mts: NOTION_SYNC_TRIAL_DIR が無いときの既定は、<buildRoot> か tmp/ の下の式(ドライブ決め打ちの文字列でない)', () => {
  const i = trialCode.findIndex((l) => /NOTION_SYNC_TRIAL_DIR/.test(l));
  assert.ok(i >= 0, 'NOTION_SYNC_TRIAL_DIR を読む行が無い');
  // その行から数行(式が折り返されてもよい)に、buildRoot か tmp が出る。ドライブ文字で始まる決め打ちの文字列は無い
  const around = trialCode.slice(i, i + 6).join('\n');
  assert.match(around, /buildRoot|resolveLocalConfig|local-config|\btmp\b/i, `既定が <buildRoot>・tmp/ の下の式でない:\n${around}`);
  assert.doesNotMatch(around, /["'`][A-Za-z]:[\\/]/, `ドライブ文字の決め打ちが残っている:\n${around}`);
});

test('trial.mts: 試しの場所を台本で丸ごと消さない(前は fsp.rm(root, recursive) で消していた。NOTION_SYNC_TRIAL_DIR に任意の場所を渡されると、その場所を消してしまう)', () => {
  const hits = trialCode.map((l, i) => ({ l, i: i + 1 })).filter((x) => /\.rm\(|rmSync\(|rmdir/.test(x.l));
  assert.deepEqual(hits.map((x) => `${x.i}: ${x.l.trim()}`), [], '台本が何かを消す行がある');
});

// 蒙恬の入口(trial.mts の冒頭の注): defaultTrialRoot({ env, configPath }) と makeTrialRunDir(root)、定数 TRIAL_DIR_NAME・REPO_ROOT
let trialMod = null;
const loadTrial = async () => (trialMod ??= await import(new URL(`file:///${TRIAL.replace(/\\/g, '/')}`).href));

test('trial.mts(関数): 既定の置き場所は <buildRoot>\\trial-notion-sync。buildRoot は local.json から(C:\\b でない)', async () => {
  const t = await loadTrial();
  const cfg = path.join(sb, 'trial-cfg', 'local.json');
  const br = path.join(sb, 'trial-br');
  writeFile(cfg, JSON.stringify({ buildRoot: br }));
  const root = await t.defaultTrialRoot({ env: { LOCALAPPDATA: path.join(sb, 'no-la') }, configPath: cfg });
  assert.equal(root.toLowerCase(), path.join(br, t.TRIAL_DIR_NAME).toLowerCase());
  assert.doesNotMatch(root, /^[A-Za-z]:\\b(\\|$)/i);
  assert.equal(fs.existsSync(br), false, '既定を決めるだけで、フォルダを作らない');
});

test('trial.mts(関数): local.json が無ければ <リポジトリ>\\tmp\\b の下(C: のドライブ決め打ちでない)', async () => {
  const t = await loadTrial();
  const root = await t.defaultTrialRoot({ env: { LOCALAPPDATA: path.join(sb, 'no-la2') }, configPath: path.join(sb, 'nope', 'local.json') });
  assert.equal(root.toLowerCase(), path.join(REPO, 'tmp', 'b', t.TRIAL_DIR_NAME).toLowerCase());
});

test('trial.mts(関数): NOTION_SYNC_TRIAL_DIR があればそれを使う(前と同じ)。相対なら絶対にする', async () => {
  const t = await loadTrial();
  const given = path.join(sb, 'given-trial');
  assert.equal(await t.defaultTrialRoot({ env: { NOTION_SYNC_TRIAL_DIR: given } }), given);
  assert.equal(path.isAbsolute(await t.defaultTrialRoot({ env: { NOTION_SYNC_TRIAL_DIR: 'rel-trial' } })), true);
});

test('trial.mts(関数): makeTrialRunDir は root の下に新しい空の run-XXXXXX を作り、前からあるものを何も消さない。2回呼べば別のフォルダ', async () => {
  const t = await loadTrial();
  const root = path.join(sb, 'trial-root');
  writeFile(path.join(root, 'old-file.txt'), 'old');
  writeFile(path.join(root, 'run-OLD123', 'User', 'settings.json'), '{}');
  const a = await t.makeTrialRunDir(root);
  const b = await t.makeTrialRunDir(root);
  assert.notEqual(a, b);
  for (const d of [a, b]) {
    assert.equal(path.dirname(d).toLowerCase(), root.toLowerCase());
    assert.match(path.basename(d), /^run-/);
    assert.deepEqual(fs.readdirSync(d), [], '空のフォルダ');
  }
  assert.equal(fs.readFileSync(path.join(root, 'old-file.txt'), 'utf8'), 'old');
  assert.ok(fs.existsSync(path.join(root, 'run-OLD123', 'User', 'settings.json')), '前の run-* が消えた');
});

test('notion-sync の README・説明が、試しの置き場所を C:\\b と書いていない', () => {
  const readme = fs.readFileSync(path.join(REPO, 'extensions-src', 'notion-sync', 'README.md'), 'utf8');
  const bad = readme.split(/\r?\n/).map((l, i) => ({ l, i: i + 1 })).filter((x) => /notion-sync-trial/.test(x.l) && /C:\\b|C:\/b/i.test(x.l));
  assert.deepEqual(bad.map((x) => `${x.i}: ${x.l.trim()}`), []);
  const logLine = trialSrc.split(/\r?\n/).find((l) => /流れ16/.test(l)) ?? '';
  assert.doesNotMatch(logLine, /C:\\\\b|C:\\b/, `流れ16 の見出しの表示が C:\\b のまま: ${logLine.trim()}`);
});

// ===========================================================================
// 2. check-env.ps1 の子の環境(pnpm・npm のキャッシュ)
//    想定した入口: 台本が pnpm・npm を起こすとき(Invoke-Capture)、子の環境の pnpm_config_store_dir・pnpm_config_cache_dir・npm_config_cache を
//    <BuildRoot>\cache\… に向ける(scripts/lib/build-env.mjs の cacheLayout と同じ場所)。利用者の全体の環境は変えない(子だけ)。
//    試し方: PATH の先頭に、環境変数を書き出す偽の pnpm.cmd・npm.cmd を置いて、台本に起こさせる。本物の pnpm・npm は走らない。
// ===========================================================================
const CHECK_ENV = path.join(REPO, 'scripts', 'check-env.ps1');

function fakeTool(binDir, name, dumpFile) {
  // 子の環境の3つの変数(と TEMP)を、ファイルに足し書きする。--version には版を返す
  const lines = [
    '@echo off',
    `echo ${name}:pnpm_config_store_dir=%pnpm_config_store_dir%>>"${dumpFile}"`,
    `echo ${name}:pnpm_config_cache_dir=%pnpm_config_cache_dir%>>"${dumpFile}"`,
    `echo ${name}:npm_config_cache=%npm_config_cache%>>"${dumpFile}"`,
    // TEMP・TMP と、親にあるときだけ向け直される6つ(build-env.mjs の IF_PRESENT_VARS と同じ名前)
    ...['TEMP', 'TMP', ...IF_PRESENT_NAMES].map((v) => `echo ${name}:${v}=%${v}%>>"${dumpFile}"`),
    'echo 12.16.0',
  ];
  writeFile(path.join(binDir, `${name}.cmd`), lines.join('\r\n') + '\r\n');
}
function runCheckEnv(tag, parentEnv = {}) {
  const bin = path.join(sb, `${tag}-bin`);
  const dump = path.join(sb, `${tag}-dump.txt`);
  fakeTool(bin, 'pnpm', dump);
  fakeTool(bin, 'npm', dump);
  const br = path.join(sb, `${tag}-br`); // <buildRoot>(作らなくてよい)
  const out = path.join(sb, `${tag}-out.json`);
  const r = runPs(CHECK_ENV, ['-BuildRoot', br, '-OutFile', out], { timeout: 240000, env: { PATH: `${bin};${process.env.PATH}`, ...parentEnv } });
  const dumped = fs.existsSync(dump) ? fs.readFileSync(dump, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const vars = {};
  for (const l of dumped) { const m = /^(pnpm|npm):(\w+)=(.*)$/.exec(l); if (m) (vars[m[1]] ??= {})[m[2]] = m[3]; }
  return { r, br, vars, out };
}

test('check-env.ps1: 子の pnpm・npm の環境のキャッシュの向け先が <BuildRoot>\\cache\\… (build-env.mjs の cacheLayout と同じ)。親の環境に C: のキャッシュがあっても上書きする', () => {
  const parent = { pnpm_config_cache_dir: 'C:\\parent-junk\\pnpm-cache', npm_config_cache: 'C:\\parent-junk\\npm-cache', pnpm_config_store_dir: 'C:\\parent-junk\\store' };
  const { r, br, vars } = runCheckEnv('env1', parent);
  assert.ok(vars.pnpm && vars.npm, `偽の pnpm・npm が走っていない: ${JSON.stringify(vars)} / ${r.stderr.slice(0, 200)}`);
  const L = cacheLayout(br);
  for (const tool of ['pnpm', 'npm']) {
    assert.equal(vars[tool].pnpm_config_cache_dir?.toLowerCase(), L.pnpmCache.toLowerCase(), `${tool}: pnpm_config_cache_dir`);
    assert.equal(vars[tool].npm_config_cache?.toLowerCase(), L.npmCache.toLowerCase(), `${tool}: npm_config_cache`);
    assert.equal(vars[tool].pnpm_config_store_dir?.toLowerCase(), L.pnpmStore.toLowerCase(), `${tool}: pnpm_config_store_dir`);
    for (const v of Object.values(vars[tool])) assert.ok(!/parent-junk/i.test(v), `${tool}: 親の C: の向け先が残った: ${v}`);
  }
});

test('check-env.ps1: 親の環境に何も無くても、子の向け先は <BuildRoot> の下。%LOCALAPPDATA%\\pnpm-cache・npm-cache に向かない', () => {
  const { vars, br } = runCheckEnv('env2');
  assert.ok(vars.pnpm && vars.npm, `偽の pnpm・npm が走っていない: ${JSON.stringify(vars)}`);
  const L = cacheLayout(br);
  const local = (process.env.LOCALAPPDATA || '').toLowerCase();
  for (const tool of ['pnpm', 'npm']) {
    for (const k of ['pnpm_config_store_dir', 'pnpm_config_cache_dir', 'npm_config_cache', 'TEMP', 'TMP']) {
      const v = vars[tool][k];
      assert.ok(v && !v.startsWith('%'), `${tool}: ${k} が空(向けていない): ${v}`);
      assert.ok(v.toLowerCase().startsWith(L.root.toLowerCase() + '\\'), `${tool}: ${k} が <BuildRoot> の下でない: ${v}`);
      if (local) assert.ok(!v.toLowerCase().startsWith(local), `${tool}: ${k} が LOCALAPPDATA の下: ${v}`);
    }
  }
});

// 親に6つの変数(ELECTRON_CACHE など)があるときだけ向け直される。期待は build-env.mjs の cacheEnvVars から読む(PowerShell 版と同じに保つ決まり)
const JUNK6 = Object.fromEntries(IF_PRESENT_NAMES.map((n) => [n, `C:\\parent-junk\\${n}`]));

test('check-env.ps1: 子の TEMP・TMP と、親にある ELECTRON_CACHE など6つも、build-env.mjs の cacheEnvVars と同じ場所に向く', () => {
  const { r, br, vars } = runCheckEnv('env-six', { ...JUNK6, TEMP: 'C:\\parent-junk\\temp', TMP: 'C:\\parent-junk\\tmp' });
  assert.ok(vars.pnpm && vars.npm, `偽の pnpm・npm が走っていない: ${r.stderr.slice(0, 200)}`);
  const expected = cacheEnvVars(br, JUNK6); // 親にあるのでこの6つも向く
  for (const tool of ['pnpm', 'npm']) {
    for (const [name, want] of Object.entries(expected)) {
      assert.equal(vars[tool][name]?.toLowerCase(), want.toLowerCase(), `${tool}: ${name}`);
    }
    for (const v of Object.values(vars[tool])) assert.ok(!/parent-junk/i.test(v), `${tool}: 親の C: の向け先が残った: ${v}`);
  }
  assert.equal(Object.keys(expected).filter((k) => IF_PRESENT_NAMES.includes(k)).length, 6, '6つとも期待に入っている(読み方の退行)');
});

test('check-env.ps1: 親に6つの変数が無ければ、足さない(子の環境に値が無い)。TEMP・TMP は <BuildRoot>\\tmp', () => {
  // バッチの中では、未設定の %名% は空になる。この環境の親に元からある変数は向け直されて当然なので、飛ばす
  const { br, vars } = runCheckEnv('env-none');
  const L = cacheLayout(br);
  for (const tool of ['pnpm', 'npm']) {
    assert.equal(vars[tool].TEMP?.toLowerCase(), L.temp.toLowerCase(), `${tool}: TEMP`);
    assert.equal(vars[tool].TMP?.toLowerCase(), L.temp.toLowerCase(), `${tool}: TMP`);
    for (const n of IF_PRESENT_NAMES) {
      if (process.env[n] !== undefined || Object.keys(process.env).some((k) => k.toUpperCase() === n.toUpperCase())) continue; // この環境の親にある変数は、向け直されて当然
      assert.equal(vars[tool][n], '', `${tool}: ${n} を親に無いのに足した: ${vars[tool][n]}`);
    }
  }
});

test('check-env.ps1: 結果の JSON の childEnv.vars は、build-env.mjs の cacheEnvVars と同じ名前・同じ場所(PowerShell 版と mjs 版を同じに保つ)', () => {
  const { out, br } = runCheckEnv('env-json', JUNK6);
  const j = parseJsonOut(fs.readFileSync(out, 'utf8'));
  const expected = cacheEnvVars(br, JUNK6);
  const got = Object.fromEntries(Object.entries(j.childEnv.vars).map(([k, v]) => [k, String(v).toLowerCase()]));
  const want = Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v.toLowerCase()]));
  assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort(), '向け直す変数の名前の集まりが違う');
  assert.deepEqual(got, want);
});

test('child-cache-env.ps1: Get-SukunaChildCacheEnv(PowerShell)と cacheEnvVars(mjs)が、親の名前の大文字小文字が違っても同じ値を返す。絶対でない buildRoot は断る', () => {
  const ps1 = path.join(REPO, 'scripts', 'lib', 'child-cache-env.ps1');
  const br = path.join(sb, 'twin-br');
  const run = (cmd) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `. '${ps1.replace(/'/g, "''")}'; ${cmd}`], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  // 親の名前を小文字・大文字にずらして渡す(Windows の環境変数名は大文字小文字を区別しない)
  const lowered = IF_PRESENT_NAMES.map((n) => n.toLowerCase());
  for (const [label, names] of [['無し', []], ['6つとも(大文字小文字を変えて)', lowered], ['一部', ['COREPACK_HOME', 'electron_config_cache']]]) {
    const r = run(`Get-SukunaChildCacheEnv -BuildRoot '${br}' -BaseNames @(${names.map((n) => `'${n}'`).join(',')}) | ConvertTo-Json -Compress`);
    assert.equal(r.status, 0, `${label}: ${r.stderr}`);
    const got = JSON.parse(r.stdout);
    const expected = cacheEnvVars(br, Object.fromEntries(names.map((n) => [n, 'x'])));
    assert.deepEqual(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.toLowerCase()])), Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v.toLowerCase()])), label);
  }
  const bad = run(`Get-SukunaChildCacheEnv -BuildRoot 'relative\\dir'`);
  assert.notEqual(bad.status, 0, '絶対でない buildRoot を断らない');
});

test('check-env.ps1: 台本の結果(JSON)は、pnpm・npm の版を今までどおり読む(環境を向けても結果の形が変わらない)', () => {
  const { r, out } = runCheckEnv('env3');
  assert.ok(fs.existsSync(out), `結果の JSON が無い: ${r.stderr.slice(0, 200)}`);
  const j = parseJsonOut(fs.readFileSync(out, 'utf8'));
  assert.equal(j.pnpm.found, true);
  assert.equal(j.pnpm.version.split(/\r?\n/).pop(), '12.16.0');
  assert.equal(j.npm.found, true);
});

test('check-env.ps1: 台本は利用者の全体の環境(プロセスの環境変数)を書き換えたまま残さない: 台本の後の親は変わらない(子の環境だけ)', () => {
  // 台本は別プロセス(powershell)なので、親(このテスト)の環境は元々変わらない。台本の中で $env: を直接書き換える形になっていないこと(子だけに渡す)を、ソースで見る
  const src = fs.readFileSync(CHECK_ENV, 'utf8');
  const code = src.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  // 子の環境を向ける仕組みがある(Start-Process の環境でも、呼ぶ間だけ設定して戻す形でも)。env の設定だけ残して戻さない形は避ける
  if (/\$env:(pnpm_config_cache_dir|npm_config_cache|pnpm_config_store_dir)\s*=/i.test(code)) {
    assert.match(code, /finally\s*\{[^}]*Remove-Item|finally\s*\{[^}]*\$env:[^}]*=\s*\$saved|finally\s*\{[^}]*Set-Item/i, '環境変数を直接設定するなら、呼んだ後に戻す(finally)');
  }
});

// ===========================================================================
// 3. take-in.mjs の --records-dir
//    想定した入口: 記録の置き場所(--records-dir)が <リポジトリ>/records/take-in/ の下でなければ、台本が止まる(終了コードは 0 でない。
//    メッセージに --records-dir)。前は、外のときは警告を出すだけで続けた(判定役が読めないまま)。
//    試し方: --dry-run(記録も枝も作らない)と、試しの local.json(buildRoot を入れ物の中に向ける)。ext でも core でも同じ守り。
// ===========================================================================
const TAKE_IN = path.join(REPO, 'scripts', 'take-in.mjs');
const REC_ROOT = path.join(REPO, 'records', 'take-in');
let cfgFile;
function takeIn(args) {
  if (!cfgFile) {
    cfgFile = path.join(sb, 'cfg', 'local.json');
    writeFile(cfgFile, JSON.stringify({ buildRoot: path.join(sb, 'take-in-br'), installRoot: path.join(sb, 'take-in-ir') }));
  }
  const r = spawnSync(process.execPath, [TAKE_IN, ...args, '--config', cfgFile], { cwd: REPO, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, text: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}
let k = 0;
const coreArgs = (rec) => ['core', '1.999.0', '--dry-run', '--label', `smallfix-${process.pid}-${++k}`, '--records-dir', rec];

test('take-in.mjs --records-dir: records/take-in/ の外(別の場所・リポジトリの外・tmp)を指すと、止まる(終了コードが 0 でない・メッセージに --records-dir)。何も作らない', () => {
  const outsides = [
    ['入れ物の中(リポジトリの外)', path.join(sb, 'rec-outside')],
    ['records の直下の別のフォルダ', path.join(REPO, 'records', 'phase0', 'smallfix-x')],
    ['tmp の下', path.join(REPO, 'tmp', 'tests', 'smallfix-rec')],
    ['tasks の下(判定役が読めない場所)', path.join(REPO, 'tasks', 'smallfix-rec')],
  ];
  for (const [name, dir] of outsides) {
    const r = takeIn(coreArgs(dir));
    assert.notEqual(r.status, 0, `${name}: 止まらない(終了 ${r.status})\n${r.text.slice(0, 400)}`);
    assert.match(r.text, /--records-dir/, `${name}: メッセージに --records-dir が無い\n${r.text.slice(0, 400)}`);
    assert.ok(!fs.existsSync(dir), `${name}: 置き場所を作った: ${dir}`);
  }
});

test('take-in.mjs --records-dir: 外へ出る形(.. で records/take-in/ から抜ける・records/take-in-x の前方一致の偽装・リポジトリの前方一致の偽装)も止まる', () => {
  const forms = [
    ['.. で抜ける', path.join(REC_ROOT, '..', '..', 'tmp', 'tests', 'smallfix-dotdot')],
    ['.. で抜ける(records 直下へ)', path.join(REC_ROOT, '..', 'smallfix-up')],
    ['records/take-in-evil', path.join(REPO, 'records', 'take-in-evil', 'x')],
    ['リポジトリの前方一致(<repo>-evil)', `${REPO}-evil${path.sep}records${path.sep}take-in${path.sep}x`],
  ];
  for (const [name, dir] of forms) {
    const r = takeIn(coreArgs(dir));
    assert.notEqual(r.status, 0, `${name}: 止まらない(終了 ${r.status})\n${r.text.slice(0, 300)}`);
    assert.match(r.text, /--records-dir/, `${name}: メッセージに --records-dir が無い`);
    // .. の2件も、正規化した先(tmp\tests\smallfix-dotdot・records\smallfix-up)は前から無い場所。止まる前に作っていないことを、全部で見る
    assert.ok(!fs.existsSync(path.resolve(dir)), `${name}: 置き場所を作った: ${path.resolve(dir)}`);
  }
});

test('take-in.mjs --records-dir: records/take-in/ の下なら止めない(--dry-run なので何も書かない)。大文字小文字が違っても Windows では同じ場所', () => {
  for (const dir of [path.join(REC_ROOT, `smallfix-ok-${process.pid}`), path.join(REC_ROOT, `smallfix-ok-${process.pid}`).toUpperCase(), path.join('records', 'take-in', `smallfix-rel-${process.pid}`)]) {
    const r = takeIn(coreArgs(dir));
    assert.doesNotMatch(r.text, /--records-dir[^\n]*(外|outside|must|止)/i, `${dir}: 内側なのに止めた\n${r.text.slice(0, 400)}`);
    assert.ok(!fs.existsSync(path.resolve(REPO, dir)), `--dry-run が記録を作った: ${dir}`);
  }
});

test('take-in.mjs --records-dir: ext でも同じ守り(外を指すと止まる)', () => {
  const dir = path.join(sb, 'rec-outside-ext');
  const r = takeIn(['ext', 'detachhead.basedpyright', '--dry-run', '--records-dir', dir]); // 台帳(extensions.lock.json)にある id
  assert.notEqual(r.status, 0, `止まらない(終了 ${r.status})\n${r.text.slice(0, 400)}`);
  assert.match(r.text, /--records-dir/, r.text.slice(0, 400));
  assert.ok(!fs.existsSync(dir));
});

test('take-in.mjs --records-dir: --skip-judge を付けても、外は止まる(判定役を使わなくても、records/take-in/ の外に記録を置かない)', () => {
  const dir = path.join(sb, 'rec-outside-skip');
  const r = takeIn([...coreArgs(dir), '--skip-judge']);
  assert.notEqual(r.status, 0, `止まらない(終了 ${r.status})\n${r.text.slice(0, 300)}`);
  assert.ok(!fs.existsSync(dir));
});

// recordsDirProblem を、試しの入れ物を repoRoot・cwd に渡して直接呼ぶ(本物の records/ には触れない)。
// 戻り値: 問題の文(止める)か null(通す)。
function recRepo(tag) {
  const repoRoot = path.join(sb, `recrepo-${tag}`);
  const cwd = path.join(sb, `reccwd-${tag}`);
  fs.mkdirSync(path.join(repoRoot, 'records', 'take-in'), { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  return { repoRoot, cwd, root: path.join(repoRoot, 'records', 'take-in') };
}

test('recordsDirProblem: records/take-in そのもの(根)は止める。下の新しい場所・前からある下のフォルダは通す', () => {
  const { repoRoot, cwd, root } = recRepo('basic');
  fs.mkdirSync(path.join(root, 'existing', 'deep'), { recursive: true });
  assert.match(recordsDirProblem(root, { repoRoot, cwd }) ?? '', /records\/take-in\/ の下でない/, '根そのものを通した');
  assert.match(recordsDirProblem(root + path.sep, { repoRoot, cwd }) ?? '', /下でない/, '末尾の区切りつきの根を通した');
  assert.equal(recordsDirProblem(path.join(root, 'new-label'), { repoRoot, cwd }), null);
  assert.equal(recordsDirProblem(path.join(root, 'existing'), { repoRoot, cwd }), null);
  assert.equal(recordsDirProblem(path.join(root, 'existing', 'deep', 'x', 'y'), { repoRoot, cwd }), null);
});

test('recordsDirProblem: 外(別の場所・records の直下・リポジトリの外・.. で抜ける・前方一致の偽装)は止める', () => {
  const { repoRoot, cwd, root } = recRepo('outside');
  const bad = [
    path.join(sb, 'elsewhere'),
    path.join(repoRoot, 'records', 'other'),
    path.join(repoRoot, 'tmp', 'x'),
    path.join(root, '..', 'x'),
    path.join(root, 'a', '..', '..', 'x'),
    `${root}-evil${path.sep}x`,
    path.join(`${repoRoot}-evil`, 'records', 'take-in', 'x'),
    repoRoot,
  ];
  for (const d of bad) assert.ok(recordsDirProblem(d, { repoRoot, cwd }), `通した: ${d}`);
});

test('recordsDirProblem: 大文字小文字は区別しない(Windows)。相対パスは cwd から数える(cwd がリポジトリなら records/take-in/x は通る。別の場所なら外)', () => {
  const { repoRoot, cwd, root } = recRepo('case');
  assert.equal(recordsDirProblem(root.toUpperCase() + path.sep + 'X', { repoRoot, cwd }), null);
  assert.equal(recordsDirProblem(path.join('records', 'take-in', 'rel'), { repoRoot, cwd: repoRoot }), null);
  assert.ok(recordsDirProblem(path.join('records', 'take-in', 'rel'), { repoRoot, cwd }), 'cwd が別の場所なら外');
  assert.equal(recordsDirProblem(path.join('..', 'recrepo-case', 'records', 'take-in', 'rel2'), { repoRoot, cwd }), null, '相対で .. を通って入る形も、正規化した先が中なら通す');
});

test('recordsDirProblem: 空・文字列でない・repoRoot が無い', () => {
  const { repoRoot, cwd } = recRepo('empty');
  assert.match(recordsDirProblem('', { repoRoot, cwd }) ?? '', /空/);
  assert.ok(recordsDirProblem(undefined, { repoRoot, cwd }));
  assert.ok(recordsDirProblem(null, { repoRoot, cwd }));
  assert.throws(() => recordsDirProblem(path.join(sb, 'x'), { cwd }), /repoRoot/);
});

test('recordsDirProblem: 途中がジャンクションなら止める(records/take-in の下のジャンクションを通る形も、ジャンクションそのものも)。ジャンクションの先に何もできない。作れない環境では飛ばす', (t) => {
  const { repoRoot, cwd, root } = recRepo('junction');
  const target = path.join(sb, 'recjunction-target');
  fs.mkdirSync(target, { recursive: true });
  const linkPath = path.join(root, 'jn');
  const link = junction(target, linkPath);
  if (!link) { t.skip('ジャンクションを作れない環境'); return; }
  try {
    const through = recordsDirProblem(path.join(linkPath, 'label'), { repoRoot, cwd });
    assert.match(through ?? '', /リンクかジャンクション/, 'ジャンクションを通る形を通した');
    assert.match(recordsDirProblem(linkPath, { repoRoot, cwd }) ?? '', /リンクかジャンクション/, 'ジャンクションそのものを通した');
    assert.match(recordsDirProblem(path.join(linkPath, 'a', 'b', 'c'), { repoRoot, cwd }) ?? '', /リンクかジャンクション/, '深い下を通した');
    assert.deepEqual(fs.readdirSync(target), [], '関数が行き先に何か作った(読むだけのはず)');
    // 対照: ふつうのフォルダの兄弟は通る
    assert.equal(recordsDirProblem(path.join(root, 'plain', 'label'), { repoRoot, cwd }), null);
  } finally { dropLink(linkPath); }
});

test('recordsDirProblem: 途中のジャンクションが records/take-in の中を指していても止める(リンクは一律に外。行き先を信用しない)。作れない環境では飛ばす', (t) => {
  const { repoRoot, cwd, root } = recRepo('junction-in');
  fs.mkdirSync(path.join(root, 'real'), { recursive: true });
  const linkPath = path.join(root, 'alias');
  const link = junction(path.join(root, 'real'), linkPath);
  if (!link) { t.skip('ジャンクションを作れない環境'); return; }
  try {
    assert.match(recordsDirProblem(path.join(linkPath, 'x'), { repoRoot, cwd }) ?? '', /リンクかジャンクション/);
  } finally { dropLink(linkPath); }
});

test('recordsDirProblem: 途中がフォルダでない(ファイル)なら止める', () => {
  const { repoRoot, cwd, root } = recRepo('file');
  write(path.join(root, 'afile'), 'x');
  assert.match(recordsDirProblem(path.join(root, 'afile', 'label'), { repoRoot, cwd }) ?? '', /フォルダでない/);
});

test('recordsDirProblem: 呼んでも何も作らない・消さない(読むだけ)', () => {
  const { repoRoot, cwd, root } = recRepo('readonly');
  fs.mkdirSync(path.join(root, 'keep'), { recursive: true });
  write(path.join(root, 'keep', 'f.txt'), 'f');
  const before = snapshot(repoRoot);
  recordsDirProblem(path.join(root, 'new', 'deep'), { repoRoot, cwd });
  recordsDirProblem(path.join(sb, 'outside'), { repoRoot, cwd });
  recordsDirProblem(path.join(root, 'keep'), { repoRoot, cwd });
  assert.deepEqual(snapshot(repoRoot), before);
  assert.ok(!fs.existsSync(path.join(root, 'new')));
});

test('take-in.mjs: 前の「警告だけで続ける」形(startsWith(REPO) の文字列比較)が残っていない', () => {
  const src = fs.readFileSync(TAKE_IN, 'utf8');
  assert.doesNotMatch(src, /--records-dir がビルドリポジトリの外。判定役は読めない/, '警告だけで続ける古い文が残っている');
  assert.doesNotMatch(src, /startsWith\(REPO\.toLowerCase\(\)\)/, '前方一致(<repo>-evil に当たる)の比べが残っている');
});
