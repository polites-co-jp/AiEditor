// ビルドの作業場所（buildRoot）の、テストでの置き場所の決め方。docs/02 の6.1、2026-11-15 の裁定（C: に置かない）。
//   NEW_DEFAULT : 新しい既定。プロジェクトの下の tmp\b（候補。蒙恬が別に決めたら、ここ1か所と tests/move-off-c.test.mjs の EXPECTED を直す）
//   LEGACY      : 古い置き場所 C:\b。移す段取り（tasks/2026-11-15-move-off-c/）が終わるまで、本物の clone と作業ツリーがここにある
// 本物の clone・作業ツリーを読むテストは BUILD_ROOT を使う。環境変数 AIED_BUILD_ROOT が最優先、次に <root>\vscode（常設の clone）がある方
// （新しい既定 → 古い置き場所の順）、どちらにも無ければ新しい既定。移した前も後も同じテストが動くようにするため。
// 「既定の値」を確かめるテストは、BUILD_ROOT ではなく NEW_DEFAULT を使う（そこに clone があるかどうかで答えを変えない）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const NEW_DEFAULT = path.win32.join(REPO, 'tmp', 'b');
export const LEGACY = 'C:\\b';

function pick() {
  if (process.env.AIED_BUILD_ROOT) return path.win32.normalize(process.env.AIED_BUILD_ROOT);
  for (const c of [NEW_DEFAULT, LEGACY]) if (fs.existsSync(path.join(c, 'vscode'))) return c;
  return NEW_DEFAULT;
}

export const BUILD_ROOT = pick();
// 常設の clone。AIED_UPSTREAM_REPO が優先（これまでと同じ）。スラッシュ区切り（git に渡す形）。
export const UPSTREAM_REPO = process.env.AIED_UPSTREAM_REPO || path.join(BUILD_ROOT, 'vscode').replace(/\\/g, '/');
export const WT_DIR = path.join(BUILD_ROOT, 'wt');
export const SMOKE_DIR = path.join(BUILD_ROOT, 'smoke');
