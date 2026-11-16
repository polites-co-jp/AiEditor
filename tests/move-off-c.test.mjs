// 「C: に置かない」（ユーザーの裁定 2026-11-15、docs/user-decisions.md）の直しのテスト。
// 仕様の出どころ: tasks/2026-11-15-move-off-c/brief.md の2節、docs/02 の6.1。
// 実装より先に仕様から書いた（蒙恬の handoff-notes が出る前）。落ちる状態でよい。想定した入口:
//   1. scripts/lib/local-config.mjs の DEFAULTS.buildRoot / resolveLocalConfig → 既定は <repo>\tmp\b（候補。別に決まったら tests/build/root.mjs の NEW_DEFAULT を直す）
//   2. scripts/build.mjs の childEnv(base, extra, { buildRoot })  … 第3引数に buildRoot（文字列で渡す形も受ける）。
//      子の環境の TEMP・TMP・キャッシュ類を <buildRoot> の下へ向ける。向け先の名前は決めていないので、「<buildRoot> の下であること」だけを確かめる。
//   3. scripts/ と tools/ のコード行（コメント以外）に C:\b を文字で持たない。
// 利用者の全体の設定・実際の local.json・環境変数・レジストリは変えない（一時のフォルダの local.json だけを使う）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, NEW_DEFAULT } from './build/root.mjs';
import { makeSandbox, removeSandbox, writeFile, runPs } from './build/helpers.mjs';
import { DEFAULTS, resolveLocalConfig } from '../scripts/lib/local-config.mjs';
import * as build from '../scripts/build.mjs';

const lc = (p) => path.win32.normalize(p).toLowerCase();
const under = (child, parent) => lc(child).startsWith(lc(parent).replace(/\\+$/, '') + '\\');
const FAKE_LOCALAPPDATA = 'D:\\fake\\LocalAppData';

// ---- 1. buildRoot の既定 ----

test('既定の buildRoot: プロジェクトの tmp\\b（絶対パス・C: でない）', () => {
  const sb = makeSandbox('moc-');
  try {
    const r = resolveLocalConfig({ configPath: path.join(sb, 'none.json'), env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
    assert.equal(r.sources.buildRoot, 'default');
    assert.equal(lc(r.buildRoot), lc(NEW_DEFAULT));
    assert.ok(path.win32.isAbsolute(r.buildRoot));
    assert.ok(!/^c:/i.test(r.buildRoot), `C: の下にある: ${r.buildRoot}`);
    assert.ok(under(r.buildRoot, path.join(REPO, 'tmp')), 'プロジェクトの tmp\\ の下でない');
  } finally {
    removeSandbox(sb);
  }
});

test('既定の buildRoot: 本家の条件（空白と ASCII 以外を含まない）', () => {
  const sb = makeSandbox('moc-');
  try {
    const r = resolveLocalConfig({ configPath: path.join(sb, 'none.json'), env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
    assert.match(r.buildRoot, /^[\x21-\x7e]+$/, `空白か ASCII 以外が入っている: ${r.buildRoot}`);
  } finally {
    removeSandbox(sb);
  }
});

test('DEFAULTS.buildRoot は古い C:\\b のままでない', () => {
  assert.doesNotMatch(String(DEFAULTS.buildRoot), /^C:[\\/]+b[\\/]*$/i);
});

test('local.json の buildRoot が既定に勝つ（%NAME% も展開）', () => {
  const sb = makeSandbox('moc-');
  try {
    const p = path.join(sb, 'local.json');
    writeFile(p, JSON.stringify({ buildRoot: 'D:\\mybuild' }));
    const r = resolveLocalConfig({ configPath: p, env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
    assert.equal(r.buildRoot, 'D:\\mybuild');
    assert.equal(r.sources.buildRoot, 'local.json');
    writeFile(p, JSON.stringify({ buildRoot: '%LOCALAPPDATA%\\bb' }));
    const r2 = resolveLocalConfig({ configPath: p, env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
    assert.equal(r2.buildRoot, 'D:\\fake\\LocalAppData\\bb');
  } finally {
    removeSandbox(sb);
  }
});

test('local.json に C:\\b と書いてあれば、それが勝つ（古い値を黙って書き換えない）', () => {
  const sb = makeSandbox('moc-');
  try {
    const p = path.join(sb, 'local.json');
    writeFile(p, JSON.stringify({ buildRoot: 'C:\\b' }));
    assert.equal(resolveLocalConfig({ configPath: p, env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } }).buildRoot, 'C:\\b');
  } finally {
    removeSandbox(sb);
  }
});

test('オプションが local.json にも勝つ', () => {
  const sb = makeSandbox('moc-');
  try {
    const p = path.join(sb, 'local.json');
    writeFile(p, JSON.stringify({ buildRoot: 'D:\\mybuild' }));
    const r = resolveLocalConfig({ configPath: p, overrides: { buildRoot: 'E:\\opt' }, env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
    assert.equal(r.buildRoot, 'E:\\opt');
    assert.equal(r.sources.buildRoot, 'option');
  } finally {
    removeSandbox(sb);
  }
});

test('PowerShell 側の部品（local-config.ps1）の既定も同じ（configure.ps1 の出力）', () => {
  const sb = makeSandbox('moc-');
  try {
    const cfg = path.join(sb, 'local.json');
    const r = runPs(path.join(REPO, 'scripts', 'configure.ps1'), ['-ConfigPath', cfg, '-InstallRoot', path.join(sb, 'inst'), '-NoShellIntegration']);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const obj = JSON.parse(fs.readFileSync(cfg, 'utf8'));
    assert.equal(lc(obj.buildRoot), lc(NEW_DEFAULT));
  } finally {
    removeSandbox(sb);
  }
});

// ---- 2. 子の環境のキャッシュと TEMP ----

const BASE = {
  PATH: 'D:\\tools;D:\\bin',
  TEMP: 'C:\\Users\\x\\AppData\\Local\\Temp',
  TMP: 'C:\\Users\\x\\AppData\\Local\\Temp',
  LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local',
  VSCODE_PID: '1',
  ELECTRON_RUN_AS_NODE: '1',
  KEEP_ME: 'yes',
};
const ROOT = 'D:\\bt\\root';
// 子の環境で <buildRoot> の下に向ける変数。TEMP・TMP と、ビルドの導入・パッケージ化が使うキャッシュ（brief の2・1の3）。
// 必ず向ける: TEMP・TMP・npm のキャッシュ・pnpm の store。
// electron・electron-builder・node-gyp などは、環境変数で向けられないものがある（蒙恬の調べ: @electron/get 5.0.0 は LOCALAPPDATA だけを見る、
// 本家の nodeGypHeaders.ts は決め打ち）ので必須にしない。向けてあるなら <buildRoot> の下であることだけを確かめる（OPTIONAL）。
// （pnpm 11 以降は pnpm_config_* だけを読む。scripts/lib/build-env.mjs）
const REDIRECTED = ['TEMP', 'TMP', 'npm_config_cache', 'pnpm_config_store_dir', 'pnpm_config_cache_dir'];
const OPTIONAL = ['ELECTRON_CACHE', 'ELECTRON_BUILDER_CACHE', 'npm_config_devdir', 'electron_config_cache', 'COREPACK_HOME', 'PLAYWRIGHT_BROWSERS_PATH'];

function callChildEnv(base, extra = {}, root = ROOT) {
  let r = build.childEnv(base, extra, { buildRoot: root });
  if (r.env.TEMP && under(r.env.TEMP, root)) return r;
  r = build.childEnv(base, extra, root);
  return r;
}

test('childEnv: TEMP・TMP とキャッシュ類が <buildRoot> の下を向く', () => {
  const { env } = callChildEnv(BASE);
  for (const k of REDIRECTED) {
    assert.ok(env[k], `${k} が無い`);
    assert.ok(under(env[k], ROOT), `${k} が <buildRoot> の下でない: ${env[k]}`);
  }
});

test('childEnv: 向けられるキャッシュの変数（あれば）も <buildRoot> の下', () => {
  const { env } = callChildEnv({ ...BASE, ELECTRON_CACHE: 'C:\\Users\\x\\AppData\\Local\\electron\\Cache' });
  for (const k of OPTIONAL) if (env[k] !== undefined && env[k] !== '') assert.ok(under(env[k], ROOT), `${k} が <buildRoot> の下でない: ${env[k]}`);
});

test('childEnv: <buildRoot> を変えれば向け先も変わる（C: のパスを持たない）', () => {
  for (const root of ['D:\\a', 'E:\\x\\y']) {
    const { env } = callChildEnv(BASE, {}, root);
    for (const k of REDIRECTED) assert.ok(under(env[k], root), `${k}: ${env[k]}`);
  }
  const { env } = callChildEnv(BASE);
  for (const [k, v] of Object.entries(env)) {
    if (REDIRECTED.includes(k) || OPTIONAL.includes(k)) assert.ok(!/^c:/i.test(v), `${k} が C: を指す: ${v}`);
  }
});

test('childEnv: 向け先の名前はぶつからない（TEMP と各キャッシュは別のフォルダ）', () => {
  const { env } = callChildEnv(BASE);
  const dirs = REDIRECTED.filter((k) => k !== 'TMP').map((k) => lc(env[k]));
  assert.equal(new Set(dirs).size, dirs.length);
  assert.equal(lc(env.TEMP), lc(env.TMP));
});

test('childEnv: これまでの外す変数・残す変数は変わらない', () => {
  const { env, removed } = callChildEnv(BASE);
  assert.equal(env.VSCODE_PID, undefined);
  assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
  assert.deepEqual(removed, ['ELECTRON_RUN_AS_NODE', 'VSCODE_PID']);
  assert.equal(env.KEEP_ME, 'yes');
  assert.equal(env.PATH, BASE.PATH);
  assert.equal(env.LOCALAPPDATA, BASE.LOCALAPPDATA, 'LOCALAPPDATA は変えない（秘密と普段使いのデータの場所）');
});

test('childEnv: 元の環境（base）を書き換えない', () => {
  const base = { ...BASE };
  callChildEnv(base);
  assert.deepEqual(base, BASE);
});

test('childEnv: toolchain: true のときは LOCALAPPDATA も <buildRoot> の下（道具の子だけ。省けば元のまま）', () => {
  const t = build.childEnv(BASE, {}, { buildRoot: ROOT, toolchain: true }).env;
  assert.ok(under(t.LOCALAPPDATA, ROOT), t.LOCALAPPDATA);
  for (const k of REDIRECTED) assert.ok(under(t[k], ROOT), `${k}: ${t[k]}`);
  assert.equal(callChildEnv(BASE).env.LOCALAPPDATA, BASE.LOCALAPPDATA);
  assert.deepEqual(build.childEnv(BASE).env.TEMP, BASE.TEMP, 'buildRoot を渡さなければ何も向けない（前と同じ）');
});

test('childEnv: 呼び出し側の extra が向け先に勝つ', () => {
  const { env } = callChildEnv(BASE, { TEMP: 'D:\\mine', VSCODE_PORTABLE: 'D:\\p' });
  assert.equal(env.TEMP, 'D:\\mine');
  assert.equal(env.VSCODE_PORTABLE, 'D:\\p');
});

// ---- 2b. 実行の置き場所の名前の長さ（LongPathsEnabled=0 の PC で 260 文字を超えない。2026-11-16） ----

import { runDirName, shortLabel, runStamp, isRunDirName, selectPrune, RUN_DIR_NAME_MAX, ABSENT_DIR_NAME_MAX } from './smoke/lib/common.mjs';
import { prepareRunDir } from './smoke/lib/env.mjs';

// Electron が書く最も長いファイル（実測: Code Cache\electron-preload\<64桁>-<64桁>.cache。C:\b\smoke\runs の 28 ファイル）
const CC_TAIL = '\\user\\user-data\\Code Cache\\electron-preload\\' + 'A'.repeat(64) + '-' + 'B'.repeat(64) + '.cache';
const WIN_MAX_PATH_CHARS = 259; // MAX_PATH 260 から終端の NUL を引く
const NOW = new Date('2026-11-16T01:02:03Z');

test('名前の形: <短いラベル>-<YYMMDDThhmmss>。runs は 22 文字以下、absent は 20 文字以下', () => {
  assert.equal(runStamp(NOW), '261116T010203');
  assert.equal(runDirName('official', NOW), 'official-261116T010203');
  assert.equal(runDirName('official', NOW).length, 22);
  assert.ok(runDirName('official', NOW).length <= RUN_DIR_NAME_MAX);
  const labels = ['a', 'official', 'p2-B-7-r2', 'take-in-trial-official-1.146.0-3', 'x'.repeat(200), 'ラベル', '', 'a b/c\\d'];
  for (const l of labels) {
    const n = runDirName(l, NOW);
    assert.ok(n.length <= RUN_DIR_NAME_MAX, `${l}: ${n}`);
    assert.match(n, /^[A-Za-z0-9._-]+-\d{6}T\d{6}$/);
    assert.ok(isRunDirName(n), n);
    const a = runDirName(l, NOW, ABSENT_DIR_NAME_MAX);
    assert.ok(a.length <= ABSENT_DIR_NAME_MAX, `${l}: ${a}`);
    assert.ok(isRunDirName(a), a);
  }
});

test('名前の形: 長いラベルは先頭 + sha1 の 3 桁に縮む。同じラベルは同じ名前、先頭が同じ別のラベルは分かれる', () => {
  const a = shortLabel('take-in-trial-official-1.146.0-3', 8);
  assert.equal(a.length, 8);
  assert.equal(a, shortLabel('take-in-trial-official-1.146.0-3', 8));
  assert.notEqual(a, shortLabel('take-in-trial-official-1.146.0-2', 8));
  assert.equal(shortLabel('official', 8), 'official', '収まるラベルはそのまま');
  assert.equal(shortLabel('a b', 8), 'a_b', '使えない文字は _');
});

test('名前の形: 前の記録の名前（YYYYMMDDThhmmss）も名前として読め、selectPrune は新旧を時刻順にそろえて比べる', () => {
  assert.ok(isRunDirName('official-20261113T124359'));
  assert.ok(isRunDirName('official-261113T124359'));
  assert.ok(!isRunDirName('official-1113T124359'));
  assert.ok(!isRunDirName('..\\x-261113T124359'));
  // 新しい 261116 は前の形の 20261113 より新しい。最新の 1 つだけ残す
  assert.deepEqual(selectPrune(['official-20261113T124359', 'a-261116T000001', 'b-261114T000001'], 1).sort(), ['b-261114T000001', 'official-20261113T124359'].sort());
});

test('prepareRunDir: 長いラベルでも置き場所の名前は 22 文字以下（runs の直下）', () => {
  const root = makeSandbox('moc-run-'); // <リポジトリ>\tmp\tests\ の下（tmp\b には作らない）
  try {
    const r = prepareRunDir({ label: 'take-in-trial-official-1.146.0-3', mode: 'upstream', argv: {}, settings: {}, root, now: NOW });
    assert.equal(path.dirname(r.runDir).toLowerCase(), path.join(root, 'runs').toLowerCase());
    assert.ok(path.basename(r.runDir).length <= RUN_DIR_NAME_MAX, r.runDir);
  } finally {
    removeSandbox(root);
  }
});

test('パスの長さ: 既定の <buildRoot>（<リポジトリ>\\tmp\\b）での最も長いファイルが 259 文字以下（スモークの runs）', () => {
  const worst = NEW_DEFAULT + '\\smoke\\runs\\' + 'N'.repeat(RUN_DIR_NAME_MAX) + CC_TAIL;
  assert.ok(worst.length <= WIN_MAX_PATH_CHARS, `最長の見積もり ${worst.length} 文字（上限 ${WIN_MAX_PATH_CHARS}）`);
  // 実際に作る名前で
  const real = NEW_DEFAULT + '\\smoke\\runs\\' + runDirName('take-in-trial-official-1.146.0-3', NOW) + CC_TAIL;
  assert.ok(real.length <= WIN_MAX_PATH_CHARS, `${real.length} 文字`);
});

test('パスの長さ: 「消えている」の検査（absent）も 259 文字以下', () => {
  const worst = NEW_DEFAULT + '\\smoke\\absent\\' + 'N'.repeat(ABSENT_DIR_NAME_MAX) + CC_TAIL;
  assert.ok(worst.length <= WIN_MAX_PATH_CHARS, `最長の見積もり ${worst.length} 文字（上限 ${WIN_MAX_PATH_CHARS}）`);
  const real = NEW_DEFAULT + '\\smoke\\absent\\' + runDirName('absent-A-1-copilot-extension', NOW, ABSENT_DIR_NAME_MAX) + CC_TAIL;
  assert.ok(real.length <= WIN_MAX_PATH_CHARS, `${real.length} 文字`);
});

test('パスの長さ: <buildRoot> が 1 文字でも長くなる（リポジトリの場所が深くなる）と余裕が足りるか見えるように、余裕の文字数を出す', () => {
  const slackRuns = WIN_MAX_PATH_CHARS - (NEW_DEFAULT + '\\smoke\\runs\\' + 'N'.repeat(RUN_DIR_NAME_MAX) + CC_TAIL).length;
  const slackAbsent = WIN_MAX_PATH_CHARS - (NEW_DEFAULT + '\\smoke\\absent\\' + 'N'.repeat(ABSENT_DIR_NAME_MAX) + CC_TAIL).length;
  assert.ok(slackRuns >= 0 && slackAbsent >= 0, `runs 余裕 ${slackRuns}、absent 余裕 ${slackAbsent}`);
});

test('スモークの台本は置き場所の名前を runDirName で作る（<label>-<15 文字の時刻> を直接作らない）', () => {
  for (const f of ['tests/smoke/lib/env.mjs', 'tests/removals/run-absent.mjs']) {
    const t = fs.readFileSync(path.join(REPO, f), 'utf8');
    assert.match(t, /runDirName\(/, f);
    assert.doesNotMatch(t, /\$\{[^}]*label[^}]*\}-\$\{stamp\}/, f);
  }
});

// ---- 3. 台本に C:\b を文字で持たない ----

function codeLines(file) {
  const out = [];
  const ext = path.extname(file);
  let block = false;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (ext === '.ps1') {
      if (block) {
        if (t.includes('#>')) block = false;
        return;
      }
      if (t.startsWith('<#')) {
        if (!t.includes('#>')) block = true;
        return;
      }
      if (t.startsWith('#')) return;
    } else {
      if (block) {
        if (t.includes('*/')) block = false;
        return;
      }
      if (t.startsWith('/*')) {
        if (!t.includes('*/')) block = true;
        return;
      }
      if (t.startsWith('//') || t.startsWith('*')) return;
    }
    out.push({ line: i + 1, text: line });
  });
  return out;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(mjs|js|ps1|cmd)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

// 例外: 移す調べの道具 scripts/move-survey.mjs は、古い置き場所 C:\b と OS の一時フォルダを読むのが仕事（読むだけ。tasks/2026-11-15-move-off-c/）。
// 例外2（ユーザーの裁定 2026-11-15「C: から移す直しの範囲」）: Phase 0 だけの道具（scripts/p0-*.ps1・p0-*.mjs・lib/p0-common.ps1）は直さない。
// 理由: Phase 0 は閉じ、今は走らせない。
const SURVEY = /[\\/]scripts[\\/]move-survey\.mjs$/i;
const PHASE0 = /[\\/]scripts[\\/](p0-[^\\/]*\.(ps1|mjs)|lib[\\/]p0-common\.ps1)$/i;
const scanFiles = () => [...walk(path.join(REPO, 'scripts')), ...walk(path.join(REPO, 'tools'))].filter((f) => !SURVEY.test(f) && !PHASE0.test(f));

test('パスの長さ: 取り込みの監査（<buildRoot>\\audit\\take-in-<縮めたラベル>-netaudit）の最長のファイルが、どんなラベルでも 259 文字以下', async () => {
  const net = await import('../scripts/lib/take-in/smoke-net.mjs');
  const worstLabel = 'N'.repeat(net.NETAUDIT_LABEL_MAX);
  const worst = NEW_DEFAULT + '\\audit\\' + net.netauditLabel(worstLabel) + '-netaudit' + CC_TAIL;
  assert.ok(worst.length <= WIN_MAX_PATH_CHARS, `最長の見積もり ${worst.length} 文字`);
  for (const label of ['1.147.0-1', '1.146.0-p2-A-1', 'take-in-trial-official-1.146.0-3', 'L'.repeat(100)]) {
    const p = NEW_DEFAULT + '\\audit\\' + net.netauditLabel(label) + '-netaudit' + CC_TAIL;
    assert.ok(p.length <= WIN_MAX_PATH_CHARS, `${label}: ${p.length} 文字`);
  }
  assert.ok(WIN_MAX_PATH_CHARS - worst.length >= 1, '余裕は 1 文字以上');
});

test('scripts/ と tools/ のコード行（コメント以外）に C:\\b を文字で持たない', () => {
  const hits = [];
  for (const f of scanFiles()) {
    for (const { line, text } of codeLines(f)) {
      if (/C:(\\\\|\\|\/)+b\b/i.test(text)) hits.push(`${path.relative(REPO, f)}:${line}: ${text.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('scripts/ と tools/ は OS の一時フォルダ（os.tmpdir・GetTempPath・$env:TEMP）を使わない', () => {
  const hits = [];
  for (const f of scanFiles()) {
    for (const { line, text } of codeLines(f)) {
      if (/os\.tmpdir\s*\(|tmpdir\s*\(\)|GetTempPath|GetTempFileName|New-TemporaryFile|\$env:TEMP|\$env:TMP|%TEMP%/i.test(text)) hits.push(`${path.relative(REPO, f)}:${line}`);
    }
  }
  assert.deepEqual(hits, []);
});
