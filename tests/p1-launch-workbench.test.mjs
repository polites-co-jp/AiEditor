// scripts/p1-launch-check.ps1 の新しい確かめ「ワークベンチが立ち上がったか」(プロセスが生きているだけで ok にしない)の、静的な検査。
// 仕様: tasks/2026-11-16-p5-c1-product-keys/brief.md の蒙恬の3、docs/user-decisions.md の「段階 C の版の関門で出た点」
//   (21単位の版でワークベンチが立ち上がらなかったのに、p1-launch-check は「生きている」だけで ok を出した。
//    ウィンドウは開き、renderer.log は空、chromium.log に Uncaught (in promise) TypeError の1行 — records/take-in/1.146.0-p5-c-all/gate-C-1-ai.md)。
// 状態: 蒙恬の handoff-notes がまだ無い時点で、仕様だけから書いた。蒙恬の実装が入るまで、下の「実装を要する」検査は落ちてよい(落ちるのは実装がまだ無いため)。
// 想定した入口(蒙恬の実装と違えば、この検査か実装のどちらかを、決めてから直す):
//   - 結果の JSON に `workbench` の欄がある(例: { ready, evidence, rendererLog, ... })
//   - ok の判定が「生きている」「普段使いのデータが変わっていない」に加えて、ワークベンチの準備を条件にする
//   - 準備ができていないとき、message がワークベンチ(workbench)に触れる
//   - 見る材料はログ(renderer.log か chromium.log)
// 本物のエディタは起動しない(この PC の設定も変えない)。偽のエディタで挙動まで確かめる検査は、入口(ログの置き場所を差し替える引数など)が決まってから足す。
// Run: node --test tests/p1-launch-workbench.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO } from './build/helpers.mjs';

const LAUNCH = path.join(REPO, 'scripts', 'p1-launch-check.ps1');
const src = fs.readFileSync(LAUNCH, 'utf8');
// コメントの行を除いた本文(コメントの文字が条件を満たしたことにしない)
const code = src.replace(/<#[\s\S]*?#>/g, '').split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');

// ---- 今ある決まり(退行を見張る。実装が入ったあとも通ること) ----------------------------------
test('p1-launch-check.ps1: 台本は ASCII だけ(Windows PowerShell 5.1 は BOM なしを ANSI で読む。台本の注に書いてある決まり)', () => {
  const bad = [];
  src.split(/\r?\n/).forEach((l, i) => { if (/[^\x00-\x7f]/.test(l)) bad.push(`${i + 1}: ${l.slice(0, 80)}`); });
  assert.deepEqual(bad, []);
});

test('p1-launch-check.ps1: 台本は PowerShell の構文として読める(ParseFile の誤りが 0)', () => {
  const ps = `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${LAUNCH.replace(/'/g, "''")}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`;
  // 構文の確認だけ。台本は走らせない
  const r = spawnPs(ps);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

function spawnPs(command) {
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 60000, windowsHide: true });
}

// ---- 実装を要する検査(蒙恬の実装が入るまで落ちてよい) ---------------------------------------------
test('p1-launch-check.ps1【実装を要する】: 結果の JSON に workbench の欄がある', () => {
  // `$result = [ordered]@{ ... }` の初期化の中、または $result.workbench への代入
  assert.ok(/\bworkbench\s*=|\$result\.workbench\b/i.test(code), '結果に workbench の欄が無い(想定した入口)');
});

test('p1-launch-check.ps1【実装を要する】: ok の判定が、生きている・普段使いのデータが変わっていない、に加えて、ワークベンチの準備を条件にする', () => {
  const m = /if\s*\(([^\n]*)\)\s*\{\s*\n\s*\$result\.result\s*=\s*'ok'/.exec(code);
  assert.ok(m, "`if (...) { $result.result = 'ok'` の形が見つからない");
  const cond = m[1];
  assert.match(cond, /\$alive\b/, 'ok の条件に生きていることが無い');
  assert.match(cond, /\$changed\b/, 'ok の条件に普段使いのデータの変化が無い');
  assert.match(cond, /workbench|ready|booted|started/i, `ok の条件がワークベンチの準備に触れていない: ${cond}`);
  // 「生きている」だけの ok の道が他に無い
  const oks = [...code.matchAll(/\$result\.result\s*=\s*'ok'/g)];
  assert.equal(oks.length, 1, "ok を入れる所が1つでない");
});

test('p1-launch-check.ps1【実装を要する】: 生きているのにワークベンチが準備できていないとき、message がワークベンチに触れる(原因が読める)', () => {
  const msgs = [...code.matchAll(/\$result\.message\s*=\s*"([^"]*)"|\$result\.message\s*=\s*'([^']*)'/g)].map((m) => m[1] ?? m[2]);
  assert.ok(msgs.some((t) => /workbench/i.test(t)), `message のどれもワークベンチに触れていない: ${JSON.stringify(msgs)}`);
});

test('p1-launch-check.ps1【実装を要する】: 見る材料はログ(renderer.log か chromium.log)で、ワークベンチが準備できたかを、プロセスの生き死に以外で見ている', () => {
  assert.ok(/renderer\.log|chromium\.log|enable-logging/i.test(code), 'ログを見る所が無い');
});

test('p1-launch-check.ps1【実装を要する】: コンソールの誤り(Uncaught・TypeError)が出ていれば ok にしない(今回は renderer.log が空で、誤りは chromium.log の INFO:CONSOLE の1行だけだった)', () => {
  // 注意: 単なる CONSOLE は [Console]::Error や ELECTRON_NO_ATTACH_CONSOLE に当たるので、条件にしない
  assert.ok(/Uncaught|TypeError|INFO:CONSOLE/.test(code), 'コンソールの誤り(Uncaught・TypeError・INFO:CONSOLE)を見る所が無い');
});

test('p1-launch-check.ps1: 台本の説明(.DESCRIPTION)が、ok の条件にワークベンチの準備が入ったことを書いている【実装を要する】', () => {
  const doc = /<#([\s\S]*?)#>/.exec(src)?.[1] ?? '';
  assert.ok(/workbench/i.test(doc), '説明に workbench が無い(ok の条件が変わったのに説明が古い)');
});
