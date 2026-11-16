// 読み込まれた時点で、このプロセスの TEMP・TMP を <リポジトリ>\tmp\tests-temp に向け、フォルダを作る（2026-11-16 の裁定: C: に一時ファイルを置かない）。
// os.tmpdir() を使うテストの冒頭で `import './build/temp-root.mjs';` と書く。node --test を直接走らせても C: に出ない。
// 環境変数 AIED_TEST_TEMP で場所を変えられる（tests/run-all.mjs と同じ）。このプロセスと子のプロセスだけで、利用者の全体の環境変数は変えない。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_TEMP = path.resolve(process.env.AIED_TEST_TEMP || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'tmp', 'tests-temp'));
fs.mkdirSync(TEST_TEMP, { recursive: true });
process.env.TEMP = TEST_TEMP;
process.env.TMP = TEST_TEMP;
