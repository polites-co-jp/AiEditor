// tests/apply.test.mjs 自体が矛盾していないことの確認。参照実装（tests/fixtures/ref-apply/）に向けて同じテストを走らせる。
// 蒙恬の実装の合否ではない（実装の合否は tests/apply.test.mjs）。
// Run: node --test tests/apply-selfcheck.test.mjs
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.AIED_APPLY_DIR = join(resolve(dirname(fileURLToPath(import.meta.url))), 'fixtures', 'ref-apply');
await import('./apply.test.mjs?selfcheck');
