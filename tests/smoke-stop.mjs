// 台本が途中で落ちて、起動したエディタが残ったときの後始末。
// 実行: node tests/smoke-stop.mjs <実行の置き場所>   例: node tests/smoke-stop.mjs C:/b/smoke/runs/official-20261113T124359
// その置き場所の名前をコマンドラインに持つエディタの本体と、その子孫だけを止める（ほかのエディタには触れない）。
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_BUILD, SMOKE_ROOT, isRunDirPath, resolveEditor, stopByRunDir } from './smoke/lib/common.mjs';

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
