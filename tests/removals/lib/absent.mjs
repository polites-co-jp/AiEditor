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
 * checks を snapshot と照らす。
 * expect:
 *   'absent'  — 消した後のビルド向き。在ったら fail
 *   'present' — 公式の zip など、まだ消していないビルド向き。在れば pass（検査の網が空振りしていないことの確認）。無ければ fail
 * 返す: { kind, name, present, status: 'pass'|'fail'|'unknown', detail }[]
 *   unknown — snapshot にその項目が無い（settings を調べていない、など）。pass 扱いにしない
 */
export function evaluateAbsent(checks, snapshot, { expect = 'absent' } = {}) {
  if (expect !== 'absent' && expect !== 'present') throw new Error(`expect が不正: ${expect}`);
  const commands = new Set(snapshot?.commands ?? []);
  const results = [];
  const add = (kind, name, present) => {
    if (present === null) {
      results.push({ kind, name, present: null, status: 'unknown', detail: '取れていない' });
      return;
    }
    const ok = expect === 'absent' ? !present : present;
    results.push({ kind, name, present, status: ok ? 'pass' : 'fail', detail: present ? '在る' : '無い' });
  };
  for (const c of checks?.absentCommands ?? []) add('absentCommands', c, snapshot?.commands ? commands.has(c) : null);
  for (const v of checks?.absentViews ?? []) add('absentViews', v, snapshot?.commands ? isViewPresent(v, commands) : null);
  for (const s of checks?.absentSettings ?? []) {
    const known = snapshot?.settings && Object.prototype.hasOwnProperty.call(snapshot.settings, s);
    add('absentSettings', s, known ? Boolean(snapshot.settings[s]) : null);
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
