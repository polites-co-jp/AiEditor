// 台本が途中で落ちて、起動したエディタが残ったときの後始末。
// 実行: node tests/smoke-stop.mjs <実行の置き場所>   例: node tests/smoke-stop.mjs C:/b/smoke/runs/official-20261113T124359
// その置き場所の名前をコマンドラインに持つエディタの本体と、その子孫だけを止める（ほかのエディタには触れない）。
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_BUILD, SMOKE_ROOT, isRunDirPath, markKeep, resolveEditor, stopByRunDir } from './smoke/lib/common.mjs';

// 別の入口: node tests/smoke-stop.mjs --mark-keep <runs の直下の置き場所の名前>
//   例: node tests/smoke-stop.mjs --mark-keep official-20261113T143803
// C:\b\smoke\runs\ の直下の、名前が <label>-<時刻> の既存のフォルダにだけ、空の .keep を書く（--keep-runs が消さなくなる）。
// 記録の根拠にする実行に、書き込み先を持たない検証役が印を置くための入口。それ以外のパス・名前は拒む。エディタは止めない。
if (process.argv[2] === '--mark-keep') {
  try {
    const name = process.argv[3];
    if (!name) throw new Error('置き場所の名前を渡す（例: official-20261113T143803）');
    const mark = markKeep(name);
    console.log(`印を置いた: ${mark}`);
  } catch (e) {
    console.error(`smoke-stop --mark-keep: ${e.message}`);
    process.exit(2);
  }
  process.exit(0);
}

try {
  const runDir = process.argv[2];
  if (!runDir) throw new Error('実行の置き場所を渡す（例: C:/b/smoke/runs/official-20261113T124359）');
  const full = resolve(runDir);
  const runsRoot = join(SMOKE_ROOT, 'runs');
  if (!isRunDirPath(full, runsRoot)) {
    throw new Error(`${runsRoot} の下の、実行ごとの置き場所を渡す（runs そのものは受け付けない）: ${full}`);
  }
  let build = DEFAULT_BUILD;
  const cfg = join(full, 'build.json');
  if (existsSync(cfg)) build = JSON.parse(readFileSync(cfg, 'utf8')).root ?? build;
  const exe = resolveEditor(process.argv[3] ?? build).exe;
  const roots = stopByRunDir(full, exe);
  console.log(roots.length ? `止めた本体プロセス: ${roots.join(', ')}（とその子孫）` : '該当するプロセスは無い');
} catch (e) {
  console.error(`smoke-stop: ${e.message}`);
  console.error(String(e.stack ?? '').split('\n').slice(1, 5).join('\n'));
  process.exit(2);
}
