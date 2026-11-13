// 「消えている」の検査の台本の入口（許可された形 node tests/*.mjs で呼べるように置いた薄い包み）。
// 中身と使い方は tests/removals/run-absent.mjs。
import { main } from './removals/run-absent.mjs';

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
