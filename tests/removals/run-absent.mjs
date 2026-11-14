// 「消えている」の検査の台本（docs/03 の7節の3）。ビルドを1回起動し、試験専用の拡張で取った snapshot を単位の checks と照らす。
//
// 使い方:
//   node tests/removals/run-absent.mjs --build C:\b\p0\vscode-1.146.0 --expect present --cmd workbench.action.debug.start --setting debug.console.fontSize
//   node tests/removals/run-absent.mjs --build <自作のビルド> --units all --expect absent
// 主なオプション:
//   --build <root>     展開済みのビルド（既定 C:\b\p0\vscode-1.146.0 = 公式の zip）
//   --units <ids|all>  removals/<id>/unit.json の checks を使う（カンマ区切り）。enabled に関係なく読む
//   --cmd/--view/--setting/--proc <名前>  その場で足す項目（繰り返し可）
//   --expect absent|present  absent=消えていること（既定）。present=まだ在ること（公式の zip で網が空振りしないかの確認）
//   --strict           取れなかった項目（unknown）も失敗にする
//   --timeout <秒>     probe の待ち（既定 120）
// 網は2つ。runtime（起動後の commands.getCommands と設定の登録簿）と manifest（出力の組み込み拡張の package.json の
// contributes.commands・menus・keybindings・views・configuration）。どちらかに在れば「在る」。結果の net と absent-result.json の nets に出る。
// checks が網になっている条件: 公式の zip に --units <id> --expect present を流して全項目が pass（= 公式には在る）。fail の項目は網にならない。
//   例: node tests/absent-run.mjs --build C:\b\p0\vscode-1.146.0 --units A-1-copilot-extension --expect present
// 書き込みは C:\b\smoke\absent\ の下だけ。起動した PID の木だけを止める。普段使いのデータには触れない（VSCODE_PORTABLE を使う）。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BUILD, SMOKE_ROOT, assertSafeWritePath, cleanEditorEnv, listProcesses, readJson, resolveEditor, stopTree, treeFromProcesses,
} from '../smoke/lib/common.mjs';
import { collectManifest, collectTargets, evaluateAbsent, summarize, NOT_HANDLED } from './lib/absent.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const PROBE_DIR = join(HERE, 'probe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  const o = { build: DEFAULT_BUILD, units: [], expect: 'absent', strict: false, timeout: 120, adhoc: { absentCommands: [], absentViews: [], absentSettings: [], absentProcesses: [] }, label: 'absent' };
  const need = (i, n) => { if (i + 1 >= argv.length) throw new Error(`${n} に値が要る`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--build') o.build = need(i++, a);
    else if (a === '--units') o.units = need(i++, a).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--expect') o.expect = need(i++, a);
    else if (a === '--strict') o.strict = true;
    else if (a === '--timeout') o.timeout = Number(need(i++, a));
    else if (a === '--label') o.label = need(i++, a);
    else if (a === '--cmd') o.adhoc.absentCommands.push(need(i++, a));
    else if (a === '--view') o.adhoc.absentViews.push(need(i++, a));
    else if (a === '--setting') o.adhoc.absentSettings.push(need(i++, a));
    else if (a === '--proc') o.adhoc.absentProcesses.push(need(i++, a));
    else throw new Error(`知らないオプション: ${a}`);
  }
  if (!['absent', 'present'].includes(o.expect)) throw new Error('--expect は absent か present');
  if (!(o.timeout > 0)) throw new Error('--timeout が不正');
  return o;
}

export function loadUnitChecks(ids, removalsDir = join(REPO, 'removals')) {
  if (ids.length === 0) return [];
  if (!existsSync(removalsDir)) throw new Error(`removals/ が無い: ${removalsDir}`);
  const all = readdirSync(removalsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const pick = ids.includes('all') ? all : ids;
  return pick.map((id) => {
    const f = join(removalsDir, id, 'unit.json');
    if (!existsSync(f)) throw new Error(`単位が無い: ${id}`);
    return { id, checks: readJson(f).checks ?? {} };
  });
}

export async function main() {
  const o = parseArgs(process.argv.slice(2));
  const editor = resolveEditor(o.build);
  const unitChecks = loadUnitChecks(o.units);
  const groups = [...unitChecks.map((u) => ({ id: u.id, checks: u.checks })), { id: '(adhoc)', checks: o.adhoc }];
  const targets = collectTargets(groups.map((g) => g.checks));
  const total = Object.values(targets).reduce((n, a) => n + a.length, 0);
  if (total === 0) throw new Error('検査する項目が無い（--units か --cmd/--view/--setting/--proc を渡す）');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  const runDir = assertSafeWritePath(join(SMOKE_ROOT, 'absent', `${o.label}-${stamp}`), SMOKE_ROOT);
  const portable = join(runDir, 'user');
  const userData = join(portable, 'user-data');
  const extDir = join(runDir, 'extensions-dir');
  const ws = join(runDir, 'ws');
  const logs = join(runDir, 'logs');
  for (const d of [join(userData, 'User'), extDir, ws, logs]) mkdirSync(d, { recursive: true });
  writeFileSync(join(portable, 'argv.json'), JSON.stringify({ 'disable-hardware-acceleration': true }), 'utf8');
  writeFileSync(join(userData, 'User', 'settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoUpdate': false, 'workbench.startupEditor': 'none' }, null, 2), 'utf8');
  const out = join(runDir, 'snapshot.json');
  const cfgPath = join(runDir, 'absent-config.json');
  writeFileSync(cfgPath, JSON.stringify({ out, settings: targets.settings, settleMs: 5000 }), 'utf8');

  const args = [ws, '--user-data-dir', userData, '--extensions-dir', extDir, `--logsPath=${logs}`, `--extensionDevelopmentPath=${PROBE_DIR}`,
    '--skip-release-notes', '--skip-welcome', '--disable-updates', '--disable-telemetry', '--disable-experiments'];
  const env = cleanEditorEnv(process.env, portable, { AIED_ABSENT_CONFIG: cfgPath });
  console.log(`起動: ${editor.exe}（${runDir}）`);
  const child = spawn(editor.exe, args, { env, stdio: 'ignore' });
  let exited = null;
  child.on('exit', (code) => { exited = { code }; });
  child.on('error', (e) => { exited = { error: String(e) }; });
  await sleep(500);
  if (!child.pid) throw new Error('エディタを起動できなかった');

  let snap = null;
  let status = 'ok';
  try {
    const end = Date.now() + o.timeout * 1000;
    for (;;) {
      if (existsSync(out)) { try { snap = JSON.parse(readFileSync(out, 'utf8')); } catch { /* 書きかけ */ } if (snap?.done) break; }
      if (exited) { status = 'exited'; break; }
      if (Date.now() > end) { status = 'timeout'; break; }
      await sleep(500);
    }
    if (snap?.done) {
      await sleep(1500);
      snap.processes = treeFromProcesses(listProcesses(), child.pid).map((p) => ({ Name: p.Name, CommandLine: p.CommandLine }));
    }
  } finally {
    const stopped = stopTree(child.pid, editor.exe); // 起動した PID の木だけ
    console.log(`止めたプロセス: ${stopped}`);
  }
  if (!snap?.done) {
    console.error(`snapshot が取れなかった（${status}）`);
    process.exitCode = 2;
    return;
  }
  // 2つの網: runtime（起動した拡張が登録したもの・設定の登録簿）と manifest（出力の組み込み拡張の package.json の contributes）
  snap.manifest = collectManifest(editor.builtinExtDir);
  const nets = { runtime: { commands: (snap.commands ?? []).length, settingsAsked: Object.keys(snap.settings ?? {}).length }, manifest: { dir: editor.builtinExtDir, extensions: snap.manifest.extensions, commands: snap.manifest.commands.length, views: snap.manifest.views.length, settings: snap.manifest.settings.length } };
  console.log(`網: runtime（コマンド ${nets.runtime.commands} 件・設定 ${nets.runtime.settingsAsked} 件を照会）+ manifest（拡張 ${nets.manifest.extensions} 件の package.json: コマンド ${nets.manifest.commands}・ビュー ${nets.manifest.views}・設定 ${nets.manifest.settings}）`);
  let failed = false;
  const report = [];
  for (const g of groups) {
    const results = evaluateAbsent(g.checks, snap, { expect: o.expect });
    if (results.length === 0) continue;
    const s = summarize(results, { strict: o.strict });
    if (!s.ok) failed = true;
    report.push({ unit: g.id, summary: s, results, notHandled: NOT_HANDLED.filter((k) => (g.checks[k] ?? []).length > 0) });
    console.log(`${g.id}: pass ${s.pass} / fail ${s.fail} / unknown ${s.unknown}`);
    for (const r of results.filter((x) => x.status !== 'pass')) console.log(`  ${r.status}  ${r.kind}  ${r.name}  (${r.detail})`);
    if (o.expect === 'present') for (const r of results.filter((x) => x.status === 'pass')) console.log(`  pass  ${r.kind}  ${r.name}  (${r.net})`);
  }
  writeFileSync(join(runDir, 'absent-result.json'), JSON.stringify({ build: editor.root, version: editor.version, expect: o.expect, nets, report }, null, 2), 'utf8');
  console.log(`結果: ${join(runDir, 'absent-result.json')}`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exitCode = 2; });
}
