// 小さな直し3つのテスト(2026-11-16。tasks/2026-11-16-small-fixes/brief.md の「やること（曹参）」)。
// 判断の記録: docs/user-decisions.md「C:\b を消す前の確かめで出た点」「Team の返答で課に求められた点」(R22)。
//   1. extensions-src/notion-sync/dev/trial.mts の既定の置き場所が C:\b でない(<buildRoot> か tmp/ の下)
//   2. scripts/check-env.ps1 が本物の環境で起こす pnpm・npm の子の環境の、キャッシュの向け先が <buildRoot> の下(build-env.mjs と同じ向け先)
//   3. scripts/take-in.mjs の --records-dir が records/take-in/ の外を指したら止まる(判定役の狄仁傑は records/take-in/ しか読めない)
// 状態: 蒙恬の handoff-notes がまだ無い時点で、仕様から先に書いた。蒙恬の直しが入るまで、直しを要する検査は落ちてよい(落ちるのは直しがまだ無いため)。
//   想定した入口は、各節の頭に書いた。蒙恬の入口と違えば、どちらを直すかを決めてから直す(ここでは決めない)。
// 試しは <リポジトリ>\tmp\tests\ の下(tests/build/helpers.mjs の makeSandbox)。C:\b・本物の tmp\b・普段使いのデータには触れない。
// Run: node --test tests/small-fixes.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, parseJsonOut } from './build/helpers.mjs';
import { cacheLayout } from '../scripts/lib/build-env.mjs';

let sb;
before(() => { sb = makeSandbox('tests-smallfix-'); });
after(() => removeSandbox(sb));

// ===========================================================================
// 1. trial.mts の既定の置き場所
//    想定した入口: 既定(NOTION_SYNC_TRIAL_DIR が無いとき)の場所が、C:\b の決め打ちでなく、<buildRoot>(local.json)か tmp/ の下の式になる。
//    本物の試し(trial.mts)は走らせない(root を rm -r するため。試しの場所を消す)。静的に読む。
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
    for (const [k, v] of Object.entries(vars[tool])) {
      assert.ok(v && !v.startsWith('%'), `${tool}: ${k} が空(向けていない): ${v}`);
      assert.ok(v.toLowerCase().startsWith(L.root.toLowerCase() + '\\'), `${tool}: ${k} が <BuildRoot> の下でない: ${v}`);
      if (local) assert.ok(!v.toLowerCase().startsWith(local), `${tool}: ${k} が LOCALAPPDATA の下: ${v}`);
    }
  }
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
    assert.ok(!fs.existsSync(path.resolve(dir)) || name.startsWith('..'), `${name}: 置き場所を作った`);
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

test('take-in.mjs: 前の「警告だけで続ける」形(startsWith(REPO) の文字列比較)が残っていない', () => {
  const src = fs.readFileSync(TAKE_IN, 'utf8');
  assert.doesNotMatch(src, /--records-dir がビルドリポジトリの外。判定役は読めない/, '警告だけで続ける古い文が残っている');
  assert.doesNotMatch(src, /startsWith\(REPO\.toLowerCase\(\)\)/, '前方一致(<repo>-evil に当たる)の比べが残っている');
});
