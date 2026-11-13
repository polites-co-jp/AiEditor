// スモークテストの入口（自動の部分）。docs/06 の5節、docs/03 の7節の4「壊れていない」。
// 実行: node tests/smoke-run.mjs [オプション]（オプションは --help）
//   公式の zip:  node tests/smoke-run.mjs
//   自作のビルド: node tests/smoke-run.mjs --build C:/b/wt/1.146.0/<出力> --label built --mode built
// 終了コード: 0 = FAIL なし、1 = FAIL あり、2 = 台本自体の誤り。
import { USAGE, emergencyStop, parseArgs, runSmoke } from './smoke/lib/run.mjs';

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const { summary, exitCode } = await runSmoke(opts);
  for (const c of summary.checks) console.log(`${c.status.toUpperCase().padEnd(4)} ${c.id}  ${c.title}  ${String(c.detail ?? '').slice(0, 200)}`);
  const n = summary.counts;
  console.log(`\nPASS ${n.pass} / FAIL ${n.fail} / SKIP ${n.skip} / INFO ${n.info}`);
  console.log(`結果: ${summary.runDir}\\smoke-result.md`);
  process.exit(exitCode);
} catch (e) {
  const stopped = emergencyStop(); // 落ちても、起動したエディタを残さない
  console.error(`smoke-run: ${e.message}`);
  console.error(String(e.stack ?? '').split('\n').slice(1, 6).join('\n'));
  if (stopped.length) console.error(`起動していたエディタ（本体 ${stopped.join(', ')}）を止めた`);
  process.exit(2);
}
