// 「消えている」の検査（docs/03 の7節の3）の判定部分。純粋な関数だけ。起動は tests/removals/run-absent.mjs。
//
// snapshot（試験専用の拡張 tests/removals/probe が書く）:
//   { commands: string[],                 // vscode.commands.getCommands(true)
//     settings: { [key]: boolean },       // 探した設定キーが登録されているか（inspect が undefined でなければ true）
//     processes: [{ Name, CommandLine }] } // 起動した木のプロセス（run-absent.mjs が足す）
// 単位の checks:
//   absentCommands: コマンド ID。snapshot.commands に無いこと
//   absentViews:    ビューの ID。ビューは登録されると <id>.focus のコマンドができる。<id> 自身や <id>.focus が commands に無いこと
//   absentSettings: 設定キー。登録されていないこと
//   absentProcesses: プロセス名かコマンドラインの断片。起動した木に無いこと
//   absentStrings / absentHosts: ここでは見ない（前者は apply.mjs の適用後の検査、後者は scripts/netaudit.ps1）

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const KINDS = ['absentCommands', 'absentViews', 'absentSettings', 'absentProcesses'];
export const NOT_HANDLED = ['absentStrings', 'absentHosts'];

export function isViewPresent(view, commands) {
  const set = commands instanceof Set ? commands : new Set(commands);
  return set.has(view) || set.has(`${view}.focus`);
}

export function isProcessPresent(needle, processes) {
  const n = String(needle).toLowerCase();
  return (processes ?? []).some((p) => `${p.Name ?? ''}\n${p.CommandLine ?? ''}`.toLowerCase().includes(n));
}

/** 集める対象（probe に渡す設定キーの一覧など）を、単位の checks の並びから作る。 */
export function collectTargets(checksList) {
  const out = { commands: new Set(), views: new Set(), settings: new Set(), processes: new Set() };
  for (const c of checksList) {
    for (const x of c?.absentCommands ?? []) out.commands.add(x);
    for (const x of c?.absentViews ?? []) out.views.add(x);
    for (const x of c?.absentSettings ?? []) out.settings.add(x);
    for (const x of c?.absentProcesses ?? []) out.processes.add(x);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

/**
 * manifest の網。出力の組み込み拡張の package.json にある contributes を集める（起動しない拡張のコマンドも見える）。
 * 返す: { commands: string[], views: string[], settings: string[], extensions: number }
 *   commands: contributes.commands[].command、menus の各項目の command、keybindings の command
 *   views:    contributes.views の各 id、viewsContainers の各 id
 *   settings: contributes.configuration（オブジェクトか配列）の properties のキー
 */
export function manifestOf(pkg) {
  const c = pkg?.contributes ?? {};
  const commands = new Set();
  const views = new Set();
  const settings = new Set();
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  for (const x of list(c.commands)) if (x?.command) commands.add(x.command);
  for (const group of Object.values(c.menus ?? {})) for (const x of list(group)) if (x?.command) commands.add(x.command);
  for (const x of list(c.keybindings)) if (x?.command) commands.add(String(x.command).replace(/^-/, ''));
  for (const group of Object.values(c.views ?? {})) for (const x of list(group)) if (x?.id) views.add(x.id);
  for (const group of Object.values(c.viewsContainers ?? {})) for (const x of list(group)) if (x?.id) views.add(x.id);
  for (const conf of list(c.configuration)) for (const k of Object.keys(conf?.properties ?? {})) settings.add(k);
  return { commands, views, settings };
}

/** extensionsDir（resources/app/extensions）の直下の各拡張の package.json を読んで manifestOf を足し合わせる。 */
export function collectManifest(extensionsDir) {
  const out = { commands: new Set(), views: new Set(), settings: new Set(), extensions: 0 };
  if (!existsSync(extensionsDir)) return { commands: [], views: [], settings: [], extensions: 0 };
  for (const d of readdirSync(extensionsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const f = join(extensionsDir, d.name, 'package.json');
    if (!existsSync(f)) continue;
    let pkg;
    try { pkg = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { continue; }
    const m = manifestOf(pkg);
    for (const k of ['commands', 'views', 'settings']) for (const x of m[k]) out[k].add(x);
    out.extensions++;
  }
  return { commands: [...out.commands].sort(), views: [...out.views].sort(), settings: [...out.settings].sort(), extensions: out.extensions };
}

/**
 * checks を snapshot と照らす。
 * snapshot.manifest（collectManifest の結果）があれば、実行時の網（runtime）に加えて manifest の網でも見る。
 * どちらかで在れば「在る」。各結果の net は 'runtime' | 'manifest' | 'runtime+manifest' | 'none'（在った網。無ければ none）。
 * manifest が無い snapshot では runtime だけ（結果の nets に 'runtime' だけが入る）。
 * expect:
 *   'absent'  — 消した後のビルド向き。在ったら fail
 *   'present' — 公式の zip など、まだ消していないビルド向き。在れば pass（検査の網が空振りしていないことの確認）。無ければ fail
 * 返す: { kind, name, present, status: 'pass'|'fail'|'unknown', detail }[]
 *   unknown — snapshot にその項目が無い（settings を調べていない、など）。pass 扱いにしない
 */
export function evaluateAbsent(checks, snapshot, { expect = 'absent' } = {}) {
  if (expect !== 'absent' && expect !== 'present') throw new Error(`expect が不正: ${expect}`);
  const commands = new Set(snapshot?.commands ?? []);
  const mf = snapshot?.manifest;
  const mfCommands = new Set(mf?.commands ?? []);
  const mfViews = new Set(mf?.views ?? []);
  const mfSettings = new Set(mf?.settings ?? []);
  const results = [];
  const add = (kind, name, rt, mn = false) => {
    if (rt === null && !mn) {
      results.push({ kind, name, present: null, net: 'none', status: 'unknown', detail: '取れていない' });
      return;
    }
    const present = Boolean(rt) || mn;
    const net = rt && mn ? 'runtime+manifest' : rt ? 'runtime' : mn ? 'manifest' : 'none';
    const ok = expect === 'absent' ? !present : present;
    results.push({ kind, name, present, net, status: ok ? 'pass' : 'fail', detail: present ? `在る（${net}）` : `無い（${mf ? 'runtime+manifest' : 'runtime'} のどちらにも）` });
  };
  for (const c of checks?.absentCommands ?? []) add('absentCommands', c, snapshot?.commands ? commands.has(c) : null, mfCommands.has(c));
  for (const v of checks?.absentViews ?? []) {
    add('absentViews', v, snapshot?.commands ? isViewPresent(v, commands) : null, mfViews.has(v) || mfCommands.has(v) || mfCommands.has(`${v}.focus`));
  }
  for (const s of checks?.absentSettings ?? []) {
    const known = snapshot?.settings && Object.prototype.hasOwnProperty.call(snapshot.settings, s);
    add('absentSettings', s, known ? Boolean(snapshot.settings[s]) : null, mfSettings.has(s));
  }
  for (const p of checks?.absentProcesses ?? []) add('absentProcesses', p, snapshot?.processes ? isProcessPresent(p, snapshot.processes) : null);
  return results;
}

/** 結果の集計。fail が1つでもあれば ok=false。unknown は strict のときだけ ok=false。 */
export function summarize(results, { strict = false } = {}) {
  const n = { pass: 0, fail: 0, unknown: 0 };
  for (const r of results) n[r.status]++;
  return { ...n, ok: n.fail === 0 && (!strict || n.unknown === 0) };
}
