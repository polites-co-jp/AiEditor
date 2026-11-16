// 「C: から移す直し」の検証（tasks/2026-11-15-move-off-c-verify/verification-ooka.md）で出た点のテスト（2026-11-16）。
//   1. LOCALAPPDATA を <buildRoot> の下へ向けるのは install・typecheck・package の手順だけ（build.mjs の記録 envRedirectedForChildren）
//   2. take-in.mjs の子の TEMP（childTemp）と、通信の監査の作業場所 <buildRoot>\audit
//   3. applyEnvVars は大文字小文字だけ違う同じ変数（Temp・NPM_CONFIG_CACHE など）を消してから入れる
//   4. 取り込みの監査の名前（-Label take-in-<label>）が、長いラベルでも最長のパスを 259 文字以下に収める（縮めるか、止める）
//   5. テストが本物の作業場所（C:\b・<リポジトリ>\tmp\b・local.json の buildRoot）に書かないことの見張り（tests/build/guard-roots.mjs）
// 試しはすべて tmp\tests\ の下の入れ物。C:\b にも <リポジトリ>\tmp\b にも何も作らない。
// Run: node --test tests/move-off-c-fixes.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode } from './build/helpers.mjs';
import { NEW_DEFAULT } from './build/root.mjs';
import { snapshotRoot, snapshotAll, diffSnapshots, guardedRoots, IGNORED } from './build/guard-roots.mjs';
import { applyEnvVars, cacheEnvVars, toolchainEnvVars, tempEnvVars, TOOLCHAIN_STEPS } from '../scripts/lib/build-env.mjs';
import * as build from '../scripts/build.mjs';

let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-mocf-');
});
after(() => {
  removeSandbox(sb);
  // 蒙恬の試しの残り（tmp\tests\meng-tian-mbr\）。試しの入れ物の中だけを消す。
  const stray = path.join(path.dirname(sb), 'meng-tian-mbr');
  if (fs.existsSync(stray)) fs.rmSync(stray, { recursive: true, force: true });
});

const lc = (p) => path.win32.normalize(String(p)).toLowerCase();
const under = (child, parent) => lc(child).startsWith(lc(parent).replace(/\\+$/, '') + '\\');
const jsonOf = (stdout) => JSON.parse(stdout.slice(stdout.search(/^\{/m)));

// ---- 1. build.mjs: LOCALAPPDATA は道具の手順だけ --------------------------------------------------

function buildDry(extra = []) {
  const root = path.join(sb, `br${++n}`);
  const cfg = path.join(sb, `cfg${n}.json`);
  writeFile(cfg, JSON.stringify({ buildRoot: root }));
  const r = runNode(['scripts/build.mjs', '1.146.0', '--dry-run', '--config', cfg, '--build-root', root, ...extra], { env: { LOCALAPPDATA: path.join(sb, 'LocalAppData') } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return { root, j: jsonOf(r.stdout), r };
}

test('build.mjs --dry-run: 道具の手順は install・typecheck・package だけ（記録 toolchainSteps と TOOLCHAIN_STEPS が同じ）', () => {
  const { j } = buildDry();
  assert.deepEqual([...TOOLCHAIN_STEPS], ['install', 'typecheck', 'package']);
  assert.deepEqual(j.envRedirectedForChildren.toolchainSteps, ['install', 'typecheck', 'package']);
});

test('build.mjs --dry-run: all（全部の手順）に LOCALAPPDATA は無い。toolchain には LOCALAPPDATA があり、all を全部含む。すべて <buildRoot> の下', () => {
  const { root, j } = buildDry();
  const { all, toolchain } = j.envRedirectedForChildren;
  assert.ok(!Object.keys(all).some((k) => k.toUpperCase() === 'LOCALAPPDATA'), 'all に LOCALAPPDATA が入っている');
  assert.ok(toolchain.LOCALAPPDATA, 'toolchain に LOCALAPPDATA が無い');
  for (const k of Object.keys(all)) assert.equal(toolchain[k], all[k], `toolchain は all の ${k} を含む`);
  for (const [k, v] of Object.entries({ ...all, ...toolchain })) assert.ok(under(v, root), `${k} が <buildRoot> の下でない: ${v}`);
  assert.equal(lc(all.TEMP), lc(path.join(root, 'tmp')));
  assert.equal(lc(all.TEMP), lc(all.TMP));
  assert.equal(lc(toolchain.LOCALAPPDATA), lc(path.join(root, 'cache', 'localappdata')));
});

test('build.mjs --dry-run: 実際の LOCALAPPDATA（試しの偽の場所）は all に写らず、本物の LOCALAPPDATA を向け先にしない', () => {
  const { j } = buildDry();
  const text = JSON.stringify(j.envRedirectedForChildren);
  assert.ok(!text.toLowerCase().includes('localappdata\\\\localappdata'), '偽の場所を向け先にしていない');
  assert.ok(!/AppData\\\\Local\\\\Temp/i.test(text), '利用者の Temp を向け先にしていない');
});

test('childEnv: toolchain: true のときだけ LOCALAPPDATA を向ける（省けば元のまま）。toolchain でも base と extra は書き換えない', () => {
  const base = { PATH: 'D:\\x', LOCALAPPDATA: 'D:\\users\\u\\AppData\\Local', Temp: 'D:\\old' };
  const copy = { ...base };
  const root = 'D:\\bt\\root';
  const plain = build.childEnv(base, {}, { buildRoot: root }).env;
  const tool = build.childEnv(base, {}, { buildRoot: root, toolchain: true }).env;
  assert.equal(plain.LOCALAPPDATA, base.LOCALAPPDATA);
  assert.ok(under(tool.LOCALAPPDATA, root));
  assert.deepEqual(base, copy);
});

test('build.mjs のソース: 手順の環境は envOf(name) で決める（TOOLCHAIN_STEPS に入る手順だけ toolEnv）。toolEnv を直接渡すのは導入と packaging の所だけ', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'build.mjs'), 'utf8').split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.match(src, /const envOf = \(name\) => \(TOOLCHAIN_STEPS\.includes\(name\) \? toolEnv : env\);/);
  assert.match(src, /stepEnv = envOf\(name\)/, 'runPlanned の既定は envOf(name)');
  assert.match(src, /base = envOf\(name\)/, 'envForStep の既定は envOf(name)');
  const direct = src.split('\n').filter((l) => /\btoolEnv\b/.test(l) && !/const envOf|const \{ env: toolEnv/.test(l));
  assert.ok(direct.length <= 3, `toolEnv を直接使う行が増えた（導入の toolchainOf、package の PATH だけのはず）: \n${direct.join('\n')}`);
});

// ---- 3. applyEnvVars: 大文字小文字だけ違う同じ変数 -------------------------------------------------

test('applyEnvVars: 名前の大文字小文字だけ違う同じ変数を消してから入れる（Windows では1つの変数）。base は書き換えない。置き換えた名前を返す', () => {
  const base = { Path: 'D:\\x', Temp: 'C:\\old', tmp: 'C:\\old', NPM_CONFIG_CACHE: 'C:\\npm', Pnpm_Config_Store_Dir: 'C:\\store', KEEP: '1' };
  const copy = { ...base };
  const { env, replaced } = applyEnvVars(base, { TEMP: 'D:\\n\\tmp', TMP: 'D:\\n\\tmp', npm_config_cache: 'D:\\n\\npm', pnpm_config_store_dir: 'D:\\n\\store' });
  assert.deepEqual(base, copy, 'base を書き換えない');
  for (const name of ['TEMP', 'TMP', 'NPM_CONFIG_CACHE', 'PNPM_CONFIG_STORE_DIR']) {
    const keys = Object.keys(env).filter((k) => k.toUpperCase() === name);
    assert.equal(keys.length, 1, `${name} が複数ある: ${keys.join(',')}`);
  }
  assert.equal(env.TEMP, 'D:\\n\\tmp');
  assert.equal(env.Temp, undefined);
  assert.equal(env.tmp, undefined);
  assert.equal(env.TMP, 'D:\\n\\tmp');
  assert.equal(env.npm_config_cache, 'D:\\n\\npm');
  assert.equal(env.NPM_CONFIG_CACHE, undefined);
  assert.equal(env.pnpm_config_store_dir, 'D:\\n\\store');
  assert.equal(env.Pnpm_Config_Store_Dir, undefined);
  assert.equal(env.KEEP, '1');
  assert.equal(env.Path, 'D:\\x', '関係の無い変数は残す');
  assert.deepEqual(replaced, ['NPM_CONFIG_CACHE', 'Pnpm_Config_Store_Dir', 'Temp', 'tmp']);
});

test('applyEnvVars: 値が undefined / null の変数は入れない（元も消さない）。vars が空なら元の写しをそのまま返す', () => {
  const base = { Temp: 'C:\\old' };
  const { env, replaced } = applyEnvVars(base, { TEMP: undefined, TMP: null });
  assert.deepEqual(env, base);
  assert.deepEqual(replaced, []);
  assert.deepEqual(applyEnvVars(base, {}).env, base);
  assert.notEqual(applyEnvVars(base, {}).env, base, '写しである');
});

test('childEnv（build.mjs）と tempEnvVars（取り込み）は、小文字・混在の名前の元の変数が残らず、向け先が1つだけになる', () => {
  const root = 'D:\\bt\\root';
  const base = { Temp: 'C:\\Users\\x\\Temp', tmp: 'C:\\Users\\x\\Temp', NPM_CONFIG_CACHE: 'C:\\npm', Pnpm_Config_Cache_Dir: 'C:\\pc', LocalAppData: 'C:\\Users\\x\\AppData\\Local' };
  const e1 = build.childEnv(base, {}, { buildRoot: root, toolchain: true }).env;
  for (const name of ['TEMP', 'TMP', 'NPM_CONFIG_CACHE', 'PNPM_CONFIG_CACHE_DIR', 'LOCALAPPDATA']) {
    const keys = Object.keys(e1).filter((k) => k.toUpperCase() === name);
    assert.equal(keys.length, 1, `${name}: ${keys.join(',')}`);
    assert.ok(under(e1[keys[0]], root), `${name} が <buildRoot> の下でない: ${e1[keys[0]]}`);
  }
  const e2 = applyEnvVars(base, tempEnvVars(root)).env;
  assert.deepEqual(Object.keys(e2).filter((k) => /^(temp|tmp)$/i.test(k)).sort(), ['TEMP', 'TMP']);
  assert.equal(e2.TEMP, path.win32.join(root, 'tmp'));
  assert.equal(e2.LocalAppData, base.LocalAppData, '取り込みの子は LOCALAPPDATA を変えない');
  // 部品どうしの食い違い: cacheEnvVars は toolchainEnvVars の部分集合
  const c = cacheEnvVars(root, base);
  const t = toolchainEnvVars(root, base);
  for (const k of Object.keys(c)) assert.equal(t[k], c[k]);
  assert.ok(!('LOCALAPPDATA' in c));
});

// ---- 2・4. take-in.mjs --dry-run: 子の TEMP・監査の作業場所・監査の名前の長さ ------------------------

function takeInDry(label, { buildRoot } = {}) {
  const root = path.join(sb, `t${++n}`);
  const b = buildRoot ?? path.join(root, 'b');
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, JSON.stringify({ buildRoot: b, installRoot: path.join(root, 'i') }));
  const args = [path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--prev-tag', '1.146.0', '--config', cfg, '--build-root', b, '--install-root', path.join(root, 'i'),
    '--watch-state', path.join(root, 'no-state.json'), '--claude', process.execPath];
  if (label !== undefined) args.push('--label', label);
  const r = runNode(args);
  return { root, b, r, o: r.status === 0 ? jsonOf(r.stdout) : null };
}
const argAfter = (args, flag) => args[args.indexOf(flag) + 1];

test('take-in.mjs --dry-run: 子の TEMP・TMP（childTemp）は <buildRoot>\\tmp。LOCALAPPDATA や pnpm・npm の変数は向けない', () => {
  const { b, o, r } = takeInDry('mocf-1');
  assert.ok(o, r.stderr + r.stdout);
  assert.deepEqual(Object.keys(o.childTemp).sort(), ['TEMP', 'TMP']);
  assert.equal(lc(o.childTemp.TEMP), lc(path.join(b, 'tmp')));
  assert.equal(lc(o.childTemp.TMP), lc(path.join(b, 'tmp')));
});

test('take-in.mjs --dry-run: 通信の監査の作業場所 -WorkRoot は <buildRoot>\\audit（作業ツリーや取り込みの記録の下でない）', () => {
  const { b, o, r } = takeInDry('mocf-2');
  assert.ok(o, r.stderr + r.stdout);
  const a = o.plan.netaudit.args.map(String);
  assert.equal(lc(argAfter(a, '-WorkRoot')), lc(path.join(b, 'audit')));
  assert.equal(argAfter(a, '-Label'), 'take-in-mocf-2');
});

test('take-in.mjs のソース: 子のプロセス（runLogged）の既定の環境は TEMP・TMP を向けた CHILD_ENV。作業場所は ctx.buildRoot の下', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'take-in.mjs'), 'utf8').split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.match(src, /CHILD_TEMP_VARS = tempEnvVars\(ctx\.buildRoot\)/);
  assert.match(src, /CHILD_ENV = applyEnvVars\(process\.env, CHILD_TEMP_VARS\)\.env/);
  assert.match(src, /env = CHILD_ENV \|\| process\.env/);
  assert.match(src, /function netauditWorkRoot\(ctx\)\s*\{\s*return path\.join\(ctx\.buildRoot, "audit"\);/);
});

const CC_TAIL = '\\user\\user-data\\Code Cache\\electron-preload\\' + 'A'.repeat(64) + '-' + 'B'.repeat(64) + '.cache';
const WIN_MAX = 259;

// <WorkRoot>\<-Label>-netaudit\<CC_TAIL> の長さを、既定の <buildRoot>（tmp\b、45 文字）に置き換えて数える。
function auditPathLen(o, buildRoot) {
  const a = o.plan.netaudit.args.map(String);
  const p = `${argAfter(a, '-WorkRoot')}\\${argAfter(a, '-Label')}-netaudit${CC_TAIL}`;
  return p.length - buildRoot.length + NEW_DEFAULT.length;
}

test('取り込みの監査の名前: ラベルが11文字以下なら今までどおり通り、最長のパスは259文字以下', () => {
  for (const label of ['1.147.0-1', '1.147.0-12', 'x']) {
    const { b, o, r } = takeInDry(label);
    assert.ok(o, `${label}: ${r.stderr}${r.stdout}`);
    assert.ok(auditPathLen(o, b) <= WIN_MAX, `${label}: ${auditPathLen(o, b)} 文字`);
  }
});

test('取り込みの監査の名前: 長いラベル（12文字以上）は、縮めて259文字以下にするか、止める（259 を超えたまま通さない）', () => {
  for (const label of ['1.146.0-p2-A-1', '1.147.0-trial-official-long', 'take-in-trial-official-1.146.0-3', 'L'.repeat(60)]) {
    const { b, o, r } = takeInDry(label);
    if (r.status === 0) {
      assert.ok(auditPathLen(o, b) <= WIN_MAX, `${label}: 縮めていない。${auditPathLen(o, b)} 文字（上限 ${WIN_MAX}）`);
    } else {
      // 止めた: 計画を出していない。ラベルか長さの理由が誤りの文に出る
      assert.notEqual(r.status, 0);
      assert.ok(!/"result":\s*"dry-run"/.test(r.stdout), `${label}: 止めたなら計画を出さない`);
      assert.ok(`${r.stderr}${r.stdout}`.length > 0, `${label}: 理由を出す`);
    }
  }
});

test('取り込みの監査の名前: 縮めるなら、同じラベルはいつも同じ名前、先頭が同じ別のラベルは別の名前（止める場合はこの試しを飛ばす）', () => {
  const nameOf = (label) => {
    const { o, r } = takeInDry(label);
    return r.status === 0 ? argAfter(o.plan.netaudit.args.map(String), '-Label') : null;
  };
  const a1 = nameOf('take-in-trial-official-1.146.0-2');
  const a2 = nameOf('take-in-trial-official-1.146.0-2');
  const b1 = nameOf('take-in-trial-official-1.146.0-3');
  if (a1 === null) return; // 止める方針（縮めない）
  assert.equal(a1, a2, '同じラベルは同じ名前');
  assert.notEqual(a1, b1, '先頭が同じ別のラベルは別の名前');
});

test('取り込みの監査の名前: 縮める部品があれば、スモークの shortLabel と同じ形（同じ入力は同じ名前、使えない文字は _）。無ければ飛ばす（止める方針）', async () => {
  const mod = await import('../scripts/lib/take-in/smoke-net.mjs');
  const smoke = await import('./smoke/lib/common.mjs');
  if (typeof mod.shortLabel !== 'function') return;
  for (const label of ['1.147.0-1', '1.146.0-p2-A-1', 'take-in-trial-official-1.146.0-2', 'take-in-trial-official-1.146.0-3', 'a b/c:d*e?f', 'L'.repeat(60)]) {
    for (const max of [6, 8, 10, 12]) {
      assert.equal(mod.shortLabel(label, max), smoke.shortLabel(label, max), `${label} / ${max}`);
      assert.ok(mod.shortLabel(label, max).length <= Math.max(max, label.length > max ? max : label.length));
      assert.doesNotMatch(mod.shortLabel(label, max), /[ /:*?]/);
    }
  }
});

test('取り込みの監査の名前: 縮める部品の定数と最長のパス（どんなラベルでも既定の <buildRoot>\\audit で 259 文字以下）', async () => {
  const mod = await import('../scripts/lib/take-in/smoke-net.mjs');
  if (typeof mod.netauditPathCheck !== 'function') return; // 止める方針（縮めない）なら飛ばす
  assert.equal(mod.NETAUDIT_FILE_LIMIT, WIN_MAX);
  assert.equal(mod.NETAUDIT_CC_TAIL_LENGTH, CC_TAIL.length, '最長のファイルの尾（実測の Code Cache の名前）');
  assert.ok(mod.NETAUDIT_LABEL_MAX <= 11, 'ラベルは 11 文字まで入る');
  const work = NEW_DEFAULT + '\\audit';
  for (const label of ['1.147.0-1', '1.147.0-12', '1.146.0-p2-A-1', 'take-in-trial-official-1.146.0-3', 'L'.repeat(80), 'あ-日本語-ラベル']) {
    const c = mod.netauditPathCheck(work, label);
    const expect = (work + '\\' + mod.netauditLabel(label) + '-netaudit' + CC_TAIL).length;
    assert.equal(c.longest, expect, `${label}: longest は実際のパスの長さ`);
    assert.equal(c.ok, c.longest <= WIN_MAX);
    assert.ok(c.ok, `${label}: 既定の buildRoot で収まらない ${c.longest}`);
    assert.doesNotMatch(mod.netauditLabel(label), /[^A-Za-z0-9._-]/, '使えない文字を残さない');
  }
});

test('take-in.mjs --dry-run: <buildRoot> が深くて縮めても収まらないときは、止めずに計画の netauditRun に ok:false と文字数を出す', () => {
  const deep = path.join(sb, 'deep-build-root-' + 'x'.repeat(90));
  const { o, r } = takeInDry('deep-1', { buildRoot: deep });
  assert.ok(o, r.stderr + r.stdout);
  if (!o.netauditRun) return; // 止める方針（縮めない）の実装なら、この欄は無い
  assert.equal(o.netauditRun.ok, false);
  assert.ok(o.netauditRun.longest > WIN_MAX);
  assert.equal(o.netauditRun.limit, WIN_MAX);
  assert.ok(!fs.existsSync(deep), '何も作らない');
});

test('take-in.mjs（dry-run でない）: 手順 7 を含み監査のパスが収まらないなら、手順 1 の前に終了コード 1 で止まる。記録も buildRoot も作らない', () => {
  const deep = path.join(sb, 'deep-build-root-' + 'y'.repeat(90));
  const label = `mocf-stop-${process.pid}`;
  const cfg = path.join(sb, `cfg-stop-${++n}.json`);
  writeFile(cfg, JSON.stringify({ buildRoot: deep, installRoot: path.join(sb, 'i-stop') }));
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--from', '7', '--to', '7', '--label', label, '--prev-tag', '1.146.0', '--skip-judge', '--no-writeback',
    '--config', cfg, '--build-root', deep, '--install-root', path.join(sb, 'i-stop'), '--watch-state', path.join(sb, 'no-state.json'), '--claude', process.execPath]);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.match(r.stderr + r.stdout, /長すぎる|too long/i);
  assert.ok(!fs.existsSync(deep), 'buildRoot を作らない');
  assert.ok(!fs.existsSync(path.join(REPO, 'records', 'take-in', label)), '取り込みの記録を作らない');
});

test('取り込みの監査の名前: 既定の buildRoot（45 文字）で、11文字のラベルが最長のパスの見積もりに収まる（余裕の確かめ）', () => {
  const p = `${NEW_DEFAULT}\\audit\\take-in-${'x'.repeat(11)}-netaudit${CC_TAIL}`;
  assert.ok(p.length <= WIN_MAX, `${p.length} 文字`);
  const over = `${NEW_DEFAULT}\\audit\\take-in-${'x'.repeat(12)}-netaudit${CC_TAIL}`;
  assert.ok(over.length > WIN_MAX, '12文字になると超える（縮め・止めの検査が要る理由）');
});

// ---- 5. 見張りの部品（tests/build/guard-roots.mjs）----------------------------------------------

function makeRoot(name) {
  const root = path.join(sb, name);
  writeFile(path.join(root, 'vscode', 'src', 'a.txt'), 'a');
  writeFile(path.join(root, 'vscode', '.git', 'index'), 'i');
  writeFile(path.join(root, 'wt', 'dev-apply', 'x.txt'), 'x');
  writeFile(path.join(root, 'smoke', 'baseline-1.json'), '{}');
  return root;
}

test('guard: 何も変わらなければ差は空', () => {
  const root = makeRoot('g1');
  const s1 = snapshotAll([root]);
  const s2 = snapshotAll([root]);
  assert.deepEqual(diffSnapshots(s1, s2), []);
});

test('guard: ファイル・フォルダを作ると増えた、消すと消えた、書き換えると変わった、として見つかる', () => {
  const root = makeRoot('g2');
  const s0 = snapshotAll([root]);
  writeFile(path.join(root, 'wt', 'tests-ac-1', 'f.txt'), 'f');
  let d = diffSnapshots(s0, snapshotAll([root]));
  assert.ok(d.some((l) => /増えた wt\\tests-ac-1/.test(l)), d.join('\n'));
  const s1 = snapshotAll([root]);
  fs.rmSync(path.join(root, 'wt', 'tests-ac-1'), { recursive: true });
  d = diffSnapshots(s1, snapshotAll([root]));
  assert.ok(d.some((l) => /消えた wt\\tests-ac-1/.test(l)), d.join('\n'));
  // 作って消しただけでも、親フォルダの更新時刻が動くので変わったと分かる
  const t = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(root, 'wt'), t, t);
  const s3 = snapshotAll([root]);
  fs.mkdirSync(path.join(root, 'wt', 'tmpdir'));
  fs.rmdirSync(path.join(root, 'wt', 'tmpdir'));
  d = diffSnapshots(s3, snapshotAll([root]));
  assert.ok(d.some((l) => /変わった wt$/.test(l)), '作って消した跡が見つかる: ' + d.join('\n'));
  const s4 = snapshotAll([root]);
  fs.appendFileSync(path.join(root, 'smoke', 'baseline-1.json'), 'more');
  d = diffSnapshots(s4, snapshotAll([root]));
  assert.ok(d.some((l) => /変わった smoke\\baseline-1\.json/.test(l)), d.join('\n'));
});

test('guard: 根の直下に作って消しただけでも（根そのものの更新時刻が動くので）見つかる。中身が空の根でも', () => {
  const root = makeRoot('g-top');
  const t = new Date(Date.now() - 60000);
  fs.utimesSync(root, t, t);
  const s0 = snapshotAll([root]);
  assert.ok('.' in s0[root], '根そのものを記録する');
  fs.mkdirSync(path.join(root, 'tests-l10n-fake-root-1'));
  fs.rmdirSync(path.join(root, 'tests-l10n-fake-root-1'));
  const d = diffSnapshots(s0, snapshotAll([root]));
  assert.ok(d.some((l) => /変わった \.$/.test(l)), d.join('\n'));
  // 空の根（移した直後の tmp\b）
  const empty = path.join(sb, 'g-top-empty');
  fs.mkdirSync(empty);
  fs.utimesSync(empty, t, t);
  const e0 = snapshotAll([empty]);
  fs.mkdirSync(path.join(empty, 'x'));
  fs.rmdirSync(path.join(empty, 'x'));
  assert.ok(diffSnapshots(e0, snapshotAll([empty])).length > 0);
});

test('guard: 根が無ければ null（差なし）。根が作られた・消えたも見つかる', () => {
  const root = path.join(sb, 'g-missing');
  const none = snapshotAll([root]);
  assert.equal(none[root], null);
  assert.deepEqual(diffSnapshots(none, snapshotAll([root])), []);
  writeFile(path.join(root, 'x'), '1');
  assert.ok(diffSnapshots(none, snapshotAll([root])).some((l) => /根が作られた/.test(l)));
  const made = snapshotAll([root]);
  fs.rmSync(root, { recursive: true });
  assert.ok(diffSnapshots(made, snapshotAll([root])).some((l) => /根が消えた/.test(l)));
});

test('guard: 常設の clone の .git の中は見張りに入れない（git が読むだけでも動く）。clone のほかの所は見張る', () => {
  const root = makeRoot('g3');
  assert.deepEqual(IGNORED, ['vscode\\.git']);
  const s0 = snapshotAll([root]);
  writeFile(path.join(root, 'vscode', '.git', 'worktrees', 'w1', 'HEAD'), 'h');
  fs.writeFileSync(path.join(root, 'vscode', '.git', 'index'), 'changed');
  assert.deepEqual(diffSnapshots(s0, snapshotAll([root])), [], '.git の中の変化は差にしない');
  writeFile(path.join(root, 'vscode', 'src', 'new.txt'), 'n');
  assert.ok(diffSnapshots(s0, snapshotAll([root])).some((l) => /vscode\\src\\new\.txt|vscode\\src/.test(l)));
});

test('guard: 深さの上限（既定3）より下は見ない', () => {
  const root = makeRoot('g4');
  writeFile(path.join(root, 'a', 'b', 'c', 'd', 'deep.txt'), '1');
  const s = snapshotRoot(root, 3);
  assert.ok('a\\b\\c' in s);
  assert.ok(!('a\\b\\c\\d' in s));
});

test('guard: 見張る根は C:\\b・既定の <リポジトリ>\\tmp\\b を必ず含み、同じ場所を2回持たない。local.json が壊れていても落ちない', () => {
  const la = path.join(sb, 'la-broken');
  writeFile(path.join(la, 'Shuko', 'local.json'), '{broken');
  const saved = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = la;
  try {
    const roots = guardedRoots(['c:\\B\\', NEW_DEFAULT]);
    const l = roots.map((r) => r.toLowerCase());
    assert.ok(l.includes('c:\\b'));
    assert.ok(l.includes(NEW_DEFAULT.toLowerCase()));
    assert.equal(new Set(l).size, l.length, '重ならない');
  } finally {
    if (saved === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = saved;
  }
  // local.json の buildRoot も見張る
  const la2 = path.join(sb, 'la-ok');
  writeFile(path.join(la2, 'Shuko', 'local.json'), JSON.stringify({ buildRoot: 'D:\\my-guard-root' }));
  process.env.LOCALAPPDATA = la2;
  try {
    assert.ok(guardedRoots().some((r) => r.toLowerCase() === 'd:\\my-guard-root'));
  } finally {
    if (saved === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = saved;
  }
});

test('run-all は、ファイルごとに見張りの前後を比べる（--no-guard で外せる）', () => {
  const src = fs.readFileSync(path.join(REPO, 'tests', 'run-all.mjs'), 'utf8');
  assert.match(src, /guard-roots\.mjs/);
  assert.match(src, /--no-guard/);
  assert.equal((src.match(/guardBefore\(\)/g) || []).length, 2, 'node のテストと ps1 のテストの両方で前を取る');
  assert.equal((src.match(/guardAfter\(/g) || []).length, 3, '定義 + 2 か所で後を比べる');
});

// ---- 5b. テストの書き込み先の静的な検査 ---------------------------------------------------------------

test('テストのコード: <buildRoot>・C:\\b・本物の tmp\\b を指す定数（BUILD_ROOT・WT_DIR・SMOKE_DIR・NEW_DEFAULT・LEGACY・SMOKE_ROOT）を書き込みの関数に渡さない', () => {
  const dir = path.join(REPO, 'tests');
  const files = fs.readdirSync(dir).filter((f) => /\.(mjs)$/.test(f) && f !== 'move-off-c-fixes.test.mjs');
  const writers = /\b(mkdirSync|writeFileSync|appendFileSync|rmSync|rmdirSync|unlinkSync|renameSync|copyFileSync|cpSync|mkdtempSync|writeFile|removeSandbox|makeSandbox)\s*\(/;
  const roots = /\b(BUILD_ROOT|WT_DIR|SMOKE_DIR|NEW_DEFAULT|LEGACY|SMOKE_ROOT|DEFAULT_BUILD)\b/;
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    lines.forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;
      if (writers.test(l) && roots.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(hits, [], '本物の作業場所に書く恐れ:\n' + hits.join('\n'));
});

test('テストのコード: C:\\b・C:/b に書く形（リテラルのパスを書き込みの関数に渡す）が無い', () => {
  const dir = path.join(REPO, 'tests');
  const files = fs.readdirSync(dir).filter((f) => /\.mjs$/.test(f) && f !== 'move-off-c-fixes.test.mjs');
  const writers = /\b(mkdirSync|writeFileSync|appendFileSync|rmSync|rmdirSync|unlinkSync|renameSync|copyFileSync|cpSync|mkdtempSync|writeFile)\s*\(/;
  const lit = /['"`]C:[\\/]{1,2}b\b/i;
  const hits = [];
  for (const f of files) {
    fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;
      if (/buildRoot:/.test(l)) return; // 試しの local.json の中身として 'C:\b' を書くだけ（書き込み先は試しの入れ物）
      if (writers.test(l) && lit.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('os.tmpdir() を使う tests の .test.mjs は、全部 tests/build/temp-root.mjs を読み込んでいる（node --test を直接走らせても C: に出ない）', () => {
  const dir = path.join(REPO, 'tests');
  const missing = [];
  let users = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const code = text.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
    if (!/\btmpdir\s*\(/.test(code) || f === 'move-off-c-fixes.test.mjs' || f === 'move-off-c.test.mjs') continue;
    users++;
    const lines = text.split(/\r?\n/);
    const imp = lines.findIndex((l) => /^import\s+['"]\.\/build\/temp-root\.mjs['"]/.test(l));
    const firstCall = lines.findIndex((l) => /\btmpdir\s*\(/.test(l) && !/^\s*\/\//.test(l));
    // import は巻き上げられるが、読み込み順は書いた順。tmpdir() を呼ぶ行より前にある（ほかの import が読み込み時に呼ぶ場合に備え、最初の import の群の中にあること）
    const lastImport = lines.reduce((a, l, i) => (/^import\s/.test(l) ? i : a), -1);
    if (imp < 0 || imp > lastImport || imp > firstCall) missing.push(f);
  }
  assert.ok(users >= 20, `tmpdir() を使う tests が ${users} 個しか見つからない`);
  assert.deepEqual(missing, [], 'temp-root.mjs を読み込んでいない: ' + missing.join(', '));
});

test('temp-root.mjs: 読み込むと TEMP・TMP が tmp\\tests-temp に向き、os.tmpdir() がそこを返す（元が C: でも）。フォルダを作る', () => {
  const r = runNode(['--input-type=module', '-e', "import './tests/build/temp-root.mjs'; import os from 'node:os'; console.log(os.tmpdir() + '|' + process.env.TEMP + '|' + process.env.TMP);"], { env: { TEMP: 'C:\\Windows\\Temp', TMP: 'C:\\Windows\\Temp' } });
  assert.equal(r.status, 0, r.stderr);
  const [t, a, b] = r.stdout.trim().split('|');
  const want = path.join(REPO, 'tmp', 'tests-temp');
  assert.equal(lc(t), lc(want));
  assert.equal(lc(a), lc(want));
  assert.equal(lc(b), lc(want));
  assert.ok(fs.existsSync(want));
});

test('apply-commits・apply-cli・p1-scripts は、本物の <buildRoot> でなく試しの入れ物（tmp\\tests\\）に書く', () => {
  const read = (f) => fs.readFileSync(path.join(REPO, 'tests', f), 'utf8');
  const ac = read('apply-commits.test.mjs');
  assert.match(ac, /const WT_BASE = sandboxBase\(\);/);
  assert.doesNotMatch(ac, /import \{[^}]*\bWT_DIR\b[^}]*\} from '\.\/build\/root\.mjs'/, 'WT_DIR を作業ツリーの置き場所にしない');
  const cli = read('apply-cli.test.mjs');
  assert.match(cli, /const OUT = makeSandbox\(/);
  assert.doesNotMatch(cli, /SMOKE_DIR/);
  const p1 = read('p1-scripts.test.mjs');
  assert.match(p1, /const BR = path\.join\(sb, 'fake-build-root'\);/);
  assert.doesNotMatch(p1, /NEW_DEFAULT/);
});
