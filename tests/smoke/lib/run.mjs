// スモークの台本の本体。入口は tests/smoke-run.mjs。
//   1. エディタ（--build の zip 展開先、または自作のビルドの出力）を見つける
//   2. 台帳の拡張を入れた拡張フォルダを用意する（使い回す）
//   3. 実行ごとの置き場所（portable・logs・ws）を作り、起動する（VSCODE_PORTABLE だけを足した環境で）
//   4. 試験専用の拡張（tests/smoke/probe）が中から確かめた結果を待ち、ログ・.lock・プロセスを外から確かめる
//   5. 起動した PID の木だけを止め、増えた .lock のうち自分のものだけを消す
// 計測と通信の監査はしない（裁定 2026-11-13）。

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BUILD, KEEP_MARK, SMOKE_ROOT, assertSafeWritePath, claudeIdeDir, cleanEditorEnv, collectLogErrors, resolveVsixRoot, errorKeys, extractChromiumErrors,
  findOnPath, listProcesses, lockBelongsTo, newErrors, newLocks, normalizeError, readLock, resolveEditor, selectPrune, snapshotLocks, splitByCutoff, stopByRunDir, stopTree, treeFromProcesses,
} from './common.mjs';
import { buildUserSettings, defaultExtensionIds, findVsix, prepareExtensions, prepareRunDir, readLedger } from './env.mjs';
import { COMPLETION_POSITIONS, createWorkspace, diffFixtures } from './fixtures.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const PROBE_DIR = resolve(HERE, '..', 'probe');
export const REPO_ROOT = resolve(HERE, '..', '..', '..');
export const ALL_GROUPS = ['base', 'claude-code', 'languages'];

// ---------------------------------------------------------------------------
// 引数
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const o = {
    build: DEFAULT_BUILD, label: 'official', mode: 'upstream', groups: [...ALL_GROUPS], ext: null,
    lock: join(REPO_ROOT, 'extensions.lock.json'), root: SMOKE_ROOT, timeout: 600, baseline: null, saveBaseline: null,
    rebuildExt: false, secondWindow: true, keepLocks: false, locale: 'ja', help: false,
    mergeBaseline: false, keepRuns: 10, prime: false, reuseExt: false, vsixRoot: null,
  };
  const takes = new Set(['build', 'label', 'mode', 'groups', 'ext', 'lock', 'root', 'timeout', 'baseline', 'save-baseline', 'locale', 'keep-runs', 'vsix-root']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`知らない引数: ${a}`);
    const k = a.slice(2);
    if (k === 'help') { o.help = true; continue; }
    if (k === 'rebuild-ext') { o.rebuildExt = true; continue; }
    if (k === 'no-second-window') { o.secondWindow = false; continue; }
    if (k === 'keep-locks') { o.keepLocks = true; continue; }
    if (k === 'merge-baseline') { o.mergeBaseline = true; continue; }
    if (k === 'prime') { o.prime = true; continue; }
    if (k === 'reuse-ext') { o.reuseExt = true; continue; }
    if (!takes.has(k)) throw new Error(`知らない引数: ${a}`);
    const v = argv[++i];
    if (v === undefined) throw new Error(`${a} に値が要る`);
    if (k === 'groups') o.groups = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'ext') o.ext = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'timeout') o.timeout = Number(v);
    else if (k === 'keep-runs') o.keepRuns = Number(v);
    else if (k === 'vsix-root') o.vsixRoot = v;
    else if (k === 'save-baseline') o.saveBaseline = v;
    else o[k] = v;
  }
  for (const g of o.groups) if (!ALL_GROUPS.includes(g)) throw new Error(`知らない組: ${g}（${ALL_GROUPS.join(', ')}）`);
  if (!['upstream', 'built'].includes(o.mode)) throw new Error(`--mode は upstream か built: ${o.mode}`);
  if (!Number.isFinite(o.timeout) || o.timeout <= 0) throw new Error(`--timeout が数でない: ${o.timeout}`);
  if (!Number.isInteger(o.keepRuns) || o.keepRuns < 0) throw new Error(`--keep-runs が0以上の整数でない: ${o.keepRuns}`);
  if (o.mergeBaseline && !o.saveBaseline) throw new Error('--merge-baseline は --save-baseline と一緒に使う');
  return o;
}

export const USAGE = `使い方: node tests/smoke-run.mjs [オプション]
  --build <dir>          試す相手（展開した zip の場所。既定 ${DEFAULT_BUILD}）
  --label <名前>         実行の名前（置き場所の名前に入る。既定 official）
  --mode upstream|built  upstream: 本家の zip（basedpyright.importStrategy をユーザー設定に入れる）
                         built: 自作のビルド（mydist の既定が効くことを確かめる。入れない）
  --groups a,b           base,claude-code,languages のうち走らせる組（既定は全部）
  --ext id,id            入れる拡張（既定: 台帳のとおり全部。台帳に無い拡張を試すときだけ明示する。拡張フォルダは別に作られる）
  --lock <path>          台帳（既定 extensions.lock.json）
  --vsix-root <dir>      VSIX のキャッシュ（既定 <buildRoot>\\cache\\vsix。buildRoot は local.json、既定 C:\\b）
  --timeout <秒>         probe の完了を待つ上限（既定 600）
  --baseline <json>      前の版の誤りの鍵。これに無い誤りを「新しい誤り」として落とす
  --save-baseline <json> 今回の誤りの鍵を書き出す（既存のファイルは上書き）
  --merge-baseline       --save-baseline と一緒に使う。既存の鍵との和を取る（揺れる誤りがあるので、基準は3回の和にする）
  --keep-runs <N>        実行の置き場所を、最新の N 個だけ残して古いものを消す（既定 10。0 で今回以外を全部消す。消すのは runs\\ の下だけ）。
                         置き場所に印のファイル .keep があれば、消さず、N にも数えない（記録の根拠にする実行に置く）
  --reuse-ext            拡張フォルダが既にあれば、台帳や VSIX の印が変わっていても入れ直さず使う（台帳を直している最中に走らせるとき）
  --prime                一度起動して言語パックを登録してから起動し直す（表示が日本語になることを base.ui-language で確かめる）
  --rebuild-ext          拡張のフォルダを作り直す
  --no-second-window     2つめのウィンドウを試さない
  --keep-locks           増えた ~/.claude/ide/*.lock を消さない
  --locale <ja|none>     argv.json の locale（既定 ja。none で入れない）
  置き場所は ${SMOKE_ROOT}\\runs\\<label>-<時刻>\\。結果は smoke-result.json / smoke-result.md。`;

// ---------------------------------------------------------------------------
// 結果の集計（純粋）
// ---------------------------------------------------------------------------

export function countStatuses(checks) {
  const c = { pass: 0, fail: 0, skip: 0, info: 0 };
  for (const k of checks) c[k.status] = (c[k.status] ?? 0) + 1;
  return c;
}

/** 終了コード: fail が1つでもあれば 1。 */
export function exitCodeFor(checks) {
  return checks.some((c) => c.status === 'fail') ? 1 : 0;
}

/**
 * 基準（baseline）の和を取る。existing は前に保存した { runs, keys, seen } か null、newKeys は今回の鍵の配列。
 * 揺れる誤りがあるので、基準は3回分の和にする（docs/06 の5節）。seen は鍵ごとに何回の実行で見えたか。
 */
export function mergeBaseline(existing, newKeys, meta = {}) {
  const seen = { ...(existing?.seen ?? {}) };
  if (existing && !existing.seen) for (const k of existing.keys ?? []) seen[k] = existing.runs ?? 1;
  for (const k of new Set(newKeys)) seen[k] = (seen[k] ?? 0) + 1;
  return { ...meta, runs: existing ? (existing.runs ?? 1) + 1 : 1, keys: Object.keys(seen).sort(), seen };
}

/** 同じプロセスか（PID が使い回されていないか）。名前と親が同じなら同じとみなす。 */
export function sameProc(a, b) {
  return String(a.Name).toLowerCase() === String(b.Name).toLowerCase() && Number(a.ParentProcessId) === Number(b.ParentProcessId);
}

// 印のファイル名は common.mjs（markKeep と共有）。ここからも使えるようにしておく
export { KEEP_MARK };

/** runs\ の下から、最新の keep 個（と current）を残して古い置き場所を消す。.keep のある置き場所は消さない。消した名前を返す。 */
export function pruneRuns(root, keep, current = null) {
  const runsDir = join(root, 'runs');
  if (!existsSync(runsDir)) return [];
  // 印のファイル（.keep）がある置き場所は、消さず、残す数にも数えない。検証の根拠にする実行に置く（大岡越前守の運用）
  const names = readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !existsSync(join(runsDir, d.name, KEEP_MARK)))
    .map((d) => d.name);
  const victims = selectPrune(names, keep).filter((n) => join(runsDir, n).toLowerCase() !== String(current).toLowerCase());
  const removed = [];
  for (const n of victims) {
    const p = assertSafeWritePath(join(runsDir, n), root); // runs\ の下の、SMOKE_ROOT の中だけ
    try { rmSync(p, { recursive: true, force: true }); removed.push(n); } catch { /* 使用中 */ }
  }
  return removed;
}

/** 同じ文面（正規化した後）の誤りをまとめる。最初の1件の出どころ・時刻・本文と件数を返す。 */
export function uniqueErrors(errors) {
  const map = new Map();
  for (const e of errors) {
    const k = `${e.group}|${normalizeError(e.message)}`;
    const cur = map.get(k);
    if (cur) cur.count += 1;
    else map.set(k, { group: e.group, source: e.source, first: e.time, message: e.message, count: 1 });
  }
  return [...map.values()];
}

export function groupErrors(errors) {
  const g = {};
  for (const e of errors) g[e.group] = (g[e.group] ?? 0) + 1;
  return g;
}

const ICON = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', info: 'INFO' };

export function formatMarkdown(s) {
  const L = [];
  L.push(`# スモークの結果: ${s.label}`);
  L.push('');
  L.push(`- 試した相手: ${s.build.root}（${s.build.nameShort} ${s.build.version} / ${String(s.build.commit).slice(0, 10)}）`);
  L.push(`- 形態: ${s.mode}。開始 ${s.startedAt}、置き場所 ${s.runDir}`);
  const c = s.counts;
  L.push(`- 結果: PASS ${c.pass} / FAIL ${c.fail} / SKIP ${c.skip} / INFO ${c.info}`);
  L.push('');
  for (const g of ['base', 'claude-code', 'languages', 'absence']) {
    const rows = s.checks.filter((k) => k.group === g);
    if (!rows.length) continue;
    L.push(`## ${g}`);
    L.push('');
    L.push('| 結果 | id | 項目 | 詳細 |');
    L.push('|---|---|---|---|');
    for (const k of rows) L.push(`| ${ICON[k.status] ?? k.status} | ${k.id} | ${k.title} | ${String(k.detail ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} |`);
    L.push('');
  }
  L.push('## 誤りの一覧（前の版との比べは --baseline で行う）');
  L.push('');
  L.push(`種類ごとの件数: ${JSON.stringify(s.errorCounts)}`);
  L.push('');
  const uniq = uniqueErrors(s.errors);
  L.push(`同じ文面（時刻・パスなどを除く）をまとめると ${uniq.length} 種類。`);
  L.push('');
  for (const u of uniq.slice(0, 100)) L.push(`- [${u.group}] ${u.source} ×${u.count} ${u.first}: ${String(u.message).slice(0, 300)}`);
  if (uniq.length > 100) L.push(`- ...ほか ${uniq.length - 100} 種類（smoke-result.json に全部ある）`);
  L.push('');
  L.push('## 起動したプロセスの木');
  L.push('');
  L.push(`- 止める直前の木: ${s.tree.count} 個（${s.tree.summary}）`);
  L.push(`- 止めた後に残ったもの: ${s.tree.leftover}`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 補助
// ---------------------------------------------------------------------------

function statOrNull(p) {
  try { const s = statSync(p); return { exists: true, mtimeMs: s.mtimeMs }; } catch { return { exists: false, mtimeMs: 0 }; }
}

function dailyArgvState(home = homedir()) {
  return { vscode: statOrNull(join(home, '.vscode', 'argv.json')), vscodeOss: statOrNull(join(home, '.vscode-oss', 'argv.json')) };
}

export function dailyArgvChanged(a, b) {
  const diff = [];
  for (const k of Object.keys(a)) {
    if (a[k].exists !== b[k].exists || a[k].mtimeMs !== b[k].mtimeMs) diff.push(k);
  }
  return diff;
}

function readTextOrEmpty(p) {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

/**
 * 本体の ripgrep（rg.exe）を探す。1.146.0 では node_modules.asar.unpacked\@vscode\ripgrep-universal\bin\win32-x64\rg.exe。
 * 版で場所が変わるので、@vscode の下を深さ4まで探す（Copilot の SDK が持つ rg.exe は @github の下なので対象外）。
 */
export function findRg(editor) {
  const base = join(editor.appDir, 'node_modules.asar.unpacked', '@vscode');
  const walk = (d, depth) => {
    let ents;
    try { ents = readdirSync(d, { withFileTypes: true }); } catch { return null; }
    for (const e of ents) {
      const p = join(d, e.name);
      if (e.isFile() && e.name.toLowerCase() === 'rg.exe') return p;
    }
    if (depth <= 0) return null;
    for (const e of ents) {
      if (e.isDirectory()) { const r = walk(join(d, e.name), depth - 1); if (r) return r; }
    }
    return null;
  };
  return walk(base, 4);
}

/** User/History の下の保存された版の本文に needle があるか（entries.json は終了時にしか書かれないので本文で見る）。 */
export function historyHas(historyDir, needle) {
  if (!existsSync(historyDir)) return false;
  for (const d of readdirSync(historyDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of readdirSync(join(historyDir, d.name), { withFileTypes: true })) {
      if (f.isFile() && f.name !== 'entries.json' && readTextOrEmpty(join(historyDir, d.name, f.name)).includes(needle)) return true;
    }
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

// 台本が途中で落ちても、起動したエディタを残さないための記録
const live = { runDir: null, exe: null };

/** 台本が落ちたときに呼ぶ。起動した置き場所のエディタの木だけを止める。 */
export function emergencyStop() {
  if (!live.runDir || !live.exe) return [];
  try { return stopByRunDir(live.runDir, live.exe); } catch { return []; }
}

export async function runSmoke(opts, log = console.log) {
  const startedAt = new Date();
  const editor = resolveEditor(opts.build);
  if (!editor.portableOk) throw new Error('product.json に "target" がある（ポータブルにできない）。普段使いのデータを避けられないので止める');
  log(`相手: ${editor.exe}（${editor.version}）`);

  // ---- 拡張 ----
  const ledger = readLedger(opts.lock);
  const ids = opts.ext ?? defaultExtensionIds(ledger);
  // VSIX のキャッシュ: --vsix-root、無ければ <buildRoot>\cache\vsix（buildRoot は local.json。既定 C:\b）
  const vsixRoot = resolveVsixRoot({ vsixRoot: opts.vsixRoot });
  log(`VSIX のキャッシュ: ${vsixRoot}`);
  const vsix = ids.map((id) => {
    const want = ledger.find((e) => e.id.toLowerCase() === id.toLowerCase())?.version;
    const f = findVsix(id, want, vsixRoot);
    return { id, version: f.version, path: f.path };
  });
  const profile = `${editor.version}-${opts.label.replace(/[^A-Za-z0-9._-]/g, '_')}${opts.ext ? '-custom' : ''}`;
  const ext = prepareExtensions({ editor, vsix, profile, rebuild: opts.rebuildExt, reuse: opts.reuseExt, root: opts.root, log });
  const notInstalled = ext.installed.filter((i) => !i.ok);

  // ---- 実行の置き場所 ----
  const argv = opts.locale === 'none' ? {} : { locale: opts.locale };
  const settings = buildUserSettings(opts.mode);
  const run = prepareRunDir({ label: opts.label, mode: opts.mode, argv, settings, root: opts.root, now: startedAt });
  const wsRoot = join(run.runDir, 'ws');
  const gitStep = createWorkspace(wsRoot);
  const resultFile = join(run.runDir, 'probe-result.json');
  const commandsFile = join(run.runDir, 'commands.json');
  const chromiumLog = join(run.runDir, 'chromium.log');
  const probeConfig = {
    out: resultFile, commandsOut: commandsFile, ws: wsRoot, mode: opts.mode, groups: opts.groups,
    gitOk: gitStep.git.ok, gitReason: gitStep.git.reason ?? '',
    hasShellcheck: Boolean(findOnPath(['shellcheck'])), hasPwsh: Boolean(findOnPath(['pwsh'])),
    dotenvIds: ids.filter((i) => /dotenv/i.test(i)), // 入れた dotenv の拡張（台帳は weixu.wx-vsce-dotenv）
    openSecondWindow: opts.secondWindow, completion: COMPLETION_POSITIONS, listBuiltins: false,
  };
  const configPath = join(run.runDir, 'probe-config.json');
  writeFileSync(configPath, JSON.stringify(probeConfig, null, 2), 'utf8');
  writeFileSync(join(run.runDir, 'build.json'), JSON.stringify({ root: editor.root, exe: editor.exe }, null, 2), 'utf8');
  live.runDir = run.runDir;
  live.exe = editor.exe;

  // ---- 起動の前の状態 ----
  const locksBefore = snapshotLocks();
  const argvBefore = dailyArgvState();

  const args = [
    wsRoot,
    '--user-data-dir', run.userData,
    '--extensions-dir', ext.extDir,
    `--logsPath=${run.logs}`,
    `--extensionDevelopmentPath=${PROBE_DIR}`,
    '--skip-release-notes', '--skip-welcome', '--disable-updates', '--disable-telemetry', '--disable-experiments',
    '--enable-logging=file', `--log-file=${chromiumLog}`,
  ];
  const env = cleanEditorEnv(process.env, run.portable, { AIED_SMOKE_CONFIG: configPath });
  // 新しいユーザーデータの初回の起動は、言語パックが未登録で表示が英語になる。--prime は、一度起動して
  // languagepacks.json ができたら止め、起動し直してから本番にする（probe は動かさない。ログは別の場所）
  let primed = null;
  if (opts.prime && opts.locale !== 'none') {
    const primeLogs = join(run.runDir, 'prime-logs');
    mkdirSync(primeLogs, { recursive: true });
    const primeEnv = cleanEditorEnv(process.env, run.portable);
    const pc = spawn(editor.exe, [wsRoot, '--user-data-dir', run.userData, '--extensions-dir', ext.extDir, `--logsPath=${primeLogs}`,
      '--skip-release-notes', '--skip-welcome', '--disable-updates', '--disable-telemetry', '--disable-experiments'], { env: primeEnv, stdio: 'ignore' });
    const packs = join(run.userData, 'languagepacks.json');
    const pend = Date.now() + 90000;
    while (Date.now() < pend && !existsSync(packs)) await sleep(1000);
    await sleep(5000);
    stopTree(pc.pid, editor.exe);
    await sleep(4000);
    primed = existsSync(packs);
    log(primed ? '言語パックが登録された。起動し直す。' : '言語パックが登録されなかった（90秒）。そのまま本番を起動する。');
  }
  log(`起動: ${editor.exe} ${args.join(' ')}`);
  const child = spawn(editor.exe, args, { env, stdio: 'ignore', windowsHide: false });
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal }; });
  child.on('error', (e) => { exited = { code: null, error: String(e) }; });
  await sleep(500);
  if (!child.pid) throw new Error('エディタを起動できなかった');

  // ---- 待つ ----
  const deadline = Date.now() + opts.timeout * 1000;
  let probe = null;
  let waited = 'done';
  for (;;) {
    if (existsSync(resultFile)) {
      try { probe = JSON.parse(readFileSync(resultFile, 'utf8')); } catch { /* 書きかけ。次で読む */ }
      if (probe?.done) break;
    }
    if (exited) { waited = 'exited'; break; }
    if (Date.now() > deadline) { waited = 'timeout'; break; }
    await sleep(1000);
  }
  log(`probe: ${waited}（チェック ${probe?.checks?.length ?? 0} 件）`);

  // 2つめのウィンドウ（ログに window2 ができるのを待つ）
  let window2 = null;
  if (opts.secondWindow && opts.groups.includes('base') && waited === 'done') {
    window2 = Boolean(await (async () => {
      const end = Date.now() + 40000;
      while (Date.now() < end) {
        if (existsSync(join(run.logs, 'window2'))) return true;
        await sleep(1000);
      }
      return false;
    })());
  }
  await sleep(2000);

  // ---- 外から確かめる ----
  const rows = listProcesses();
  const tree = treeFromProcesses(rows, child.pid);
  const treePids = tree.map((p) => Number(p.ProcessId));
  const treeNames = {};
  for (const p of tree) treeNames[p.Name] = (treeNames[p.Name] ?? 0) + 1;
  const treeSummary = Object.entries(treeNames).map(([n, c]) => `${n} x${c}`).join(', ');

  const locksAfter = snapshotLocks();
  const addedLocks = newLocks(locksBefore, locksAfter).map((n) => readLock(join(claudeIdeDir(), n)));
  const mine = addedLocks.filter((l) => lockBelongsTo(l, treePids, [wsRoot]));
  const notMine = addedLocks.filter((l) => !mine.includes(l));

  const argvAfter = dailyArgvState();

  // ---- 止める（起動した PID の木だけ） ----
  const stopAt = new Date(Date.now() - 300);
  const stopped = exited ? 0 : stopTree(child.pid, editor.exe);
  // 木が消えるのを最大15秒待つ（言語サーバーなどが遅れて終わることがある）
  let after = [];
  let leftover = [];
  const treeById = new Map(tree.map((p) => [Number(p.ProcessId), p]));
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    after = listProcesses();
    // 木にいた PID が、同じ名前・同じ親のままで残っているものだけを「残り」とする（PID の使い回しで別のプロセスを数えない）
    leftover = after.filter((p) => treeById.has(Number(p.ProcessId)) && sameProc(treeById.get(Number(p.ProcessId)), p));
    if (i >= 2 && leftover.length === 0) break;
  }
  const orphans = after.filter((p) => p.ExecutablePath && resolve(p.ExecutablePath).toLowerCase() === resolve(editor.exe).toLowerCase()
    && p.CommandLine && p.CommandLine.toLowerCase().includes(run.runDir.toLowerCase()));
  for (const o of orphans) spawnSync('taskkill.exe', ['/PID', String(o.ProcessId), '/T', '/F'], { windowsHide: true }); // 自分の置き場所の名前を持つものだけ
  await sleep(1000);

  // ---- .lock の後始末（自分のものだけ） ----
  const removedLocks = [];
  if (!opts.keepLocks) {
    for (const l of mine) {
      try { unlinkSync(l.file); removedLocks.push(l.file); } catch { /* 消えていた */ }
    }
  }

  // ---- 検査を組み立てる ----
  const checks = [];
  const add = (id, group, title, status, detail = '') => checks.push({ id, group, title, status, detail });

  add('base.launch', 'base', 'エディタが起動し、probe が動く', waited === 'done' ? 'pass' : 'fail',
    waited === 'done' ? `probe の完了まで ${probe.checks.length} 項目` : `待ちの結果: ${waited}${exited ? `（終了コード ${exited.code}）` : ''}。probe の項目 ${probe?.checks?.length ?? 0} 件`);
  if (probe?.fatal) add('base.probe-fatal', 'base', 'probe が途中で落ちていない', 'fail', probe.fatal.split('\n')[0]);
  if (notInstalled.length) add('base.ext-install', 'base', '台帳の拡張が入った', 'fail', notInstalled.map((i) => `${i.id}: ${i.output.slice(-2).join(' / ')}`).join('; '));
  else add('base.ext-install', 'base', '台帳の拡張が入った', 'pass', `${ext.installed.length} 件${ext.reused ? '（使い回し）' : ''}`);

  for (const k of probe?.checks ?? []) checks.push(k);

  // probe の最後の一覧（動作中の拡張・登録済みコマンド）。Phase 2 の absentCommands がこの commands.json に頼る。
  // 以前は packageUri の誤りで毎回失敗し、snapshotError に残るだけで何も落ちなかった（検証 2 の G）
  if (waited === 'done' && probe) {
    const problems = [];
    if (probe.snapshotError) problems.push(`snapshotError: ${probe.snapshotError}`);
    if (!Array.isArray(probe.extensions) || probe.extensions.length === 0) problems.push('動作中の拡張の一覧が空');
    if (!(probe.commandCount > 0)) problems.push('登録済みコマンドが 0 件');
    if (!existsSync(commandsFile)) problems.push('commands.json ができていない');
    add('probe.snapshot', 'base', 'probe の最後の一覧（拡張・コマンド・診断）が取れ、commands.json ができる', problems.length ? 'fail' : 'pass',
      problems.length ? problems.join('; ') : `拡張 ${probe.extensions.length} 件（動作中 ${probe.extensions.filter((e) => e.isActive).length}）、コマンド ${probe.commandCount} 件（commands.json）、診断 ${probe.diagnosticsTotal} 件`);
  }

  // 外から見るもの
  if (opts.prime) {
    const lang = probe?.uiLanguage;
    add('base.ui-language', 'base', '表示が日本語になる（言語パックを入れて locale=ja で起動し直した後）', lang === 'ja' ? 'pass' : 'fail',
      `vscode.env.language = ${lang ?? '不明'}、起動し直し前の languagepacks.json: ${primed === null ? '待たなかった' : primed ? 'できた' : 'できなかった'}`);
  } else if (probe?.uiLanguage) {
    add('base.ui-language', 'base', '表示の言語（--prime なしの初回は英語になる）', 'info', `vscode.env.language = ${probe.uiLanguage}`);
  }
  if (opts.groups.includes('base')) {
    // 置換などが別のファイルに効いていないこと（過去に readme.md を書き換えた事故がある）。意図した3つ以外が変わったら FAIL
    const fx = diffFixtures(wsRoot);
    add('base.fixtures-intact', 'base', '試験用ワークスペースの、意図した3ファイル以外が変わっていない', fx.unexpected.length || fx.missing.length ? 'fail' : 'pass',
      fx.unexpected.length || fx.missing.length
        ? `意図しない変更: ${fx.unexpected.join(', ') || 'なし'}、無くなった: ${fx.missing.join(', ') || 'なし'}`
        : `変わったのは意図した ${fx.changedAsExpected.length} 個（${fx.changedAsExpected.join(', ')}）だけ`);
    add('base.window1', 'base', 'ウィンドウのログができる', existsSync(join(run.logs, 'window1')) ? 'pass' : 'fail', existsSync(join(run.logs, 'window1')) ? 'logs/window1 がある' : 'logs/window1 が無い');
    if (opts.secondWindow) add('base.window2', 'base', '2つめのウィンドウが開く', window2 ? 'pass' : 'fail', window2 ? 'logs/window2 ができた' : 'newWindow から 40 秒待っても logs/window2 ができない');
    const rg = findRg(editor);
    if (!rg) add('base.ripgrep', 'base', '全文検索の ripgrep が実行できる', 'fail', '@vscode/ripgrep の rg.exe が見つからない');
    else {
      const r = spawnSync(rg, ['-n', 'smoke_needle', wsRoot], { encoding: 'utf8', windowsHide: true });
      add('base.ripgrep', 'base', '全文検索の ripgrep が実行できる', r.status === 0 && /readme\.md/i.test(r.stdout) ? 'pass' : 'fail', `終了コード ${r.status}、${(r.stdout || r.stderr || '').trim().split(/\r?\n/)[0]}`);
    }
    const histOk = historyHas(join(run.userData, 'User', 'History'), 'smoke-edit-before');
    add('base.localhistory', 'base', 'ローカル履歴に保存した版が残る', histOk ? 'pass' : 'fail', histOk ? 'User/History に保存した版の本文がある' : 'User/History に保存した版が無い');
    const dc = dailyArgvChanged(argvBefore, argvAfter);
    add('safety.daily-argv', 'base', '普段使いの argv.json が作られていない・変わっていない', dc.length ? 'fail' : 'pass', dc.length ? `変わったもの: ${dc.join(', ')}（普段使いのエディタが同時に動いていないかも見る）` : '~/.vscode と ~/.vscode-oss の argv.json は前後で同じ');
    add('safety.process-tree', 'base', '止めた後にプロセスが残らない', leftover.length || orphans.length ? 'fail' : 'pass', `木 ${tree.length} 個を止めた（PID ${child.pid} と子孫のみ）。残り ${leftover.length}${leftover.length ? `（${leftover.map((p) => `${p.Name} pid ${p.ProcessId}`).join(', ')}）` : ''}、置き場所の名前を持つ孤児 ${orphans.length}`);
  }

  if (opts.groups.includes('claude-code')) {
    const claudeLog = readTextOrEmpty(join(run.logs, 'window1', 'exthost', 'Anthropic.claude-code', 'Claude VSCode.log'));
    const portInLog = /MCP Server running on port (\d+)/.exec(claudeLog)?.[1];
    const exthostLog = readTextOrEmpty(join(run.logs, 'window1', 'exthost', 'exthost.log'));
    const activated = /_doActivateExtension Anthropic\.claude-code/i.test(exthostLog);
    add('claude.exthost-log', 'claude-code', '拡張ホストのログに Claude Code の起動が出る', activated ? 'pass' : 'fail', activated ? '_doActivateExtension Anthropic.claude-code' : 'exthost.log に起動の行が無い');
    if (mine.length === 0) {
      add('claude.lock', 'claude-code', '~/.claude/ide/<port>.lock ができる', 'fail', `増えた .lock のうち、起動した木のものが無い（増えた ${addedLocks.length} 個、他人の ${notMine.length} 個）。ログの port: ${portInLog ?? 'なし'}`);
    } else {
      // .lock は1個とは限らない（1.146.0 + Claude Code 2.1.322 では起動1回で2個できた）。木の PID か開いたフォルダで「自分のもの」と決めた全部を見る
      const desc = mine.map((l) => `${l.port}.lock（pid ${l.pid}、${l.ideName}、${l.transport}、authToken ${l.hasAuthToken ? 'あり' : 'なし'}）`).join('、');
      add('claude.lock', 'claude-code', '~/.claude/ide/<port>.lock ができる', 'pass',
        `${mine.length} 個: ${desc}。ログの MCP port ${portInLog ?? 'なし'}${portInLog && mine.some((l) => String(l.port) === portInLog) ? '（.lock の port と一致）' : '（.lock の port とは別）'}。` +
        (opts.keepLocks ? '消していない' : `後始末で消した ${removedLocks.length} 個（自分のものだけ）`));
    }
    if (notMine.length) add('claude.lock-foreign', 'claude-code', '他人の .lock には触れていない', 'info', `増えたが木のものでない .lock: ${notMine.map((l) => l.port).join(', ')}（消していない）`);
  }

  if (opts.groups.includes('languages')) {
    const hasPwshProc = tree.some((p) => /^pwsh\.exe$/i.test(p.Name));
    add('lang.ps1.pwsh7', 'languages', 'PowerShell 7（pwsh.exe）のセッションが木にある', hasPwshProc ? 'pass' : 'info',
      hasPwshProc ? 'pwsh.exe が起動した木の中にある（拡張のセッション）' : 'pwsh.exe が木に無い（PowerShell 7 が入っていない、または Windows PowerShell で動いた）');
  }

  // 誤りの一覧
  const logScan = collectLogErrors(run.logs);
  const chromiumText = readTextOrEmpty(chromiumLog);
  const chromiumErrors = extractChromiumErrors(chromiumText);
  // 止め始めた後に出た誤り（強制終了で子が落ちた記録）は数えない。別に件数だけ残す
  const split = splitByCutoff([...logScan.errors, ...chromiumErrors], stopAt);
  const errors = split.kept;
  const errorCounts = groupErrors(errors);
  if (split.teardown.length) add('errors.teardown', 'base', '止めた後に出た誤り（数えない）', 'info', `${split.teardown.length} 件: ${[...new Set(split.teardown.map((e) => String(e.message).slice(0, 80)))].slice(0, 3).join(' | ')}`);
  add('base.logs.files', 'base', 'ログのファイルが残っている', logScan.files.length ? 'pass' : 'fail', `${logScan.files.length} 個（main.log: ${logScan.files.includes('main.log') ? 'あり' : 'なし'}）`);
  add('base.logs.devtools', 'base', '開発者ツールのコンソールの記録が取れている（Chromium のログ）', chromiumText ? 'pass' : 'info', chromiumText ? `chromium.log ${chromiumText.length} 文字` : 'chromium.log ができなかった（--enable-logging=file が効かない場合。renderer.log の [error] だけを見る）');
  for (const g of ['exthost', 'renderer', 'main', 'sharedprocess', 'devtools-console', 'chromium', 'other']) {
    const n = errorCounts[g] ?? 0;
    add(`errors.${g}`, 'base', `誤りの一覧: ${g}`, 'info', `${n} 件`);
  }
  if (opts.baseline) {
    const baseKeys = JSON.parse(readFileSync(opts.baseline, 'utf8')).keys ?? [];
    const fresh = newErrors(errors, baseKeys);
    add('errors.new', 'base', '前の版に無かった誤りが無い', fresh.length ? 'fail' : 'pass', fresh.length ? `${fresh.length} 件: ${fresh.slice(0, 3).map((e) => `[${e.group}] ${String(e.message).slice(0, 120)}`).join(' | ')}` : '新しい誤りなし');
  }
  if (opts.saveBaseline && (waited !== 'done' || probe?.fatal)) {
    add('errors.baseline-not-saved', 'base', '誤りの鍵を保存する', 'fail', '最後まで走り切らなかった実行の鍵は保存しない（次の比べを狂わせるため）');
  } else if (opts.saveBaseline) {
    mkdirSync(resolve(opts.saveBaseline, '..'), { recursive: true });
    const keys = [...errorKeys(errors)].sort();
    let existing = null;
    if (opts.mergeBaseline && existsSync(opts.saveBaseline)) existing = JSON.parse(readFileSync(opts.saveBaseline, 'utf8'));
    const body = mergeBaseline(existing, keys, { label: opts.label, version: editor.version });
    writeFileSync(opts.saveBaseline, JSON.stringify(body, null, 2), 'utf8');
    add('errors.baseline-saved', 'base', '誤りの鍵を保存する', 'info', `${opts.saveBaseline}: ${body.runs} 回分の和、鍵 ${body.keys.length} 個${opts.mergeBaseline ? '' : '（上書き）'}`);
  }

  const summary = {
    label: opts.label, mode: opts.mode, startedAt: startedAt.toISOString(), runDir: run.runDir,
    build: { root: editor.root, nameShort: editor.nameShort, version: editor.version, commit: editor.commit },
    extensions: ext.installed.map((i) => ({ id: i.id, version: i.version, ok: i.ok })),
    probe: { extensions: probe?.extensions ?? [], uiLanguage: probe?.uiLanguage, commandCount: probe?.commandCount, diagnosticsTotal: probe?.diagnosticsTotal },
    checks,
    counts: countStatuses(checks),
    errorCounts,
    errors: errors.map((e) => ({ group: e.group, source: e.source, time: e.time, message: e.message, stack: e.stack })),
    locks: { added: addedLocks.map((l) => ({ port: l.port, pid: l.pid, ideName: l.ideName, mine: mine.includes(l) })), removed: removedLocks },
    tree: { count: tree.length, summary: treeSummary, leftover: leftover.length + orphans.length, stopped },
  };
  // 古い置き場所の後始末（最新 N 個を残す。消すのは runs\ の下だけ）
  const pruned = pruneRuns(opts.root, opts.keepRuns, run.runDir);
  if (pruned.length) summary.pruned = pruned;
  writeFileSync(join(run.runDir, 'smoke-result.json'), JSON.stringify(summary, null, 2), 'utf8');
  writeFileSync(join(run.runDir, 'smoke-result.md'), formatMarkdown(summary), 'utf8');
  return { summary, exitCode: exitCodeFor(checks) };
}

export { rmSync, assertSafeWritePath };
