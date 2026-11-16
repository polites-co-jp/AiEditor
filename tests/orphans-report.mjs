// 単位が消した部品の使い手が残っていないかの一覧を出す(読むだけ)。共通の部品は tests/gate-orphans.mjs。
// 使い方: node tests/orphans-report.mjs <単位の ID> [<単位の ID> ...]    例: node tests/orphans-report.mjs C-1-ai C-2-debug
// 終了コード 0 = 残りなし、1 = 残りあり、2 = 使い方の誤り。
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeFound, findOrphans, loadUnits, upstream } from './gate-orphans.mjs';
import { UPSTREAM_REPO } from './build/root.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --bare: 全単位の edits.patch を外した状態で見る(関門で出た穴を見つけられるかの確認用)。--out <ファイル>: 一覧をファイルにも書く
const argv = process.argv.slice(2);
const bare = argv.includes('--bare');
const oi = argv.indexOf('--out');
const outFile = oi >= 0 ? argv[oi + 1] : null;
const ids = argv.filter((a, i) => !a.startsWith('--') && !(oi >= 0 && i === oi + 1));
if (!ids.length) { console.error('使い方: node tests/orphans-report.mjs <単位の ID> ...'); process.exit(2); }
const up = upstream(UPSTREAM_REPO, process.env.AIED_UPSTREAM_TAG || '1.146.0');
const units = loadUnits(REPO).map((u) => (bare ? { ...u, sections: [] } : u));
let total = 0;
const outLines = [];
const say = (s) => { console.log(s); outLines.push(s); };
for (const by of ids) {
  const r = findOrphans({ up, units, by });
  const n = r.services.length + r.settings.length + r.commands.length;
  total += n;
  say(`${by}${bare ? '(patch なし)' : ''}: サービス ${r.services.length}・設定 ${r.settings.length}・コマンド ${r.commands.length}`);
  for (const f of [...r.services, ...r.settings, ...r.commands]) say('  ' + describeFound(f));
}
if (outFile) { const { writeFileSync } = await import('node:fs'); writeFileSync(outFile, outLines.join('\n') + '\n'); }
process.exit(total ? 1 : 0);
