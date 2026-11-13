// apply.mjs の部品（scripts/lib/apply/*.mjs）への入口を、このファイルだけに集める。
// 名前と入出力は tasks/2026-11-13-p2-apply/apply-design.md の3節。
// 実装は { ok, text, found, error } や { plan, errors } を返す。apply.test.mjs は「失敗は Error」「成功は値」の形で書いてあるので、
// ここで形を写すだけにする（判定は変えない）。api.<名前> を呼ぶ。実装が読めない名前は null で、テストは「実装なし」で飛ぶ。
// 環境変数 AIED_APPLY_DIR で別の場所を指せる（tests/apply-selfcheck.test.mjs が参照実装を指す。そのときは旧来の名前で探す）。
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
const DIR = process.env.AIED_APPLY_DIR || join(REPO, 'scripts', 'lib', 'apply');
export const selfcheck = Boolean(process.env.AIED_APPLY_DIR);

/** scripts/lib/apply/<name>.mjs の名前空間（無ければ null）。 */
export const mods = {};
if (existsSync(DIR)) {
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.mjs'))) {
    try { mods[f.replace(/\.mjs$/, '')] = await import(pathToFileURL(join(DIR, f)).href); } catch (e) { console.error(`# api.mjs: ${f} を読めない: ${e.message}`); }
  }
}
const fn = (mod, name) => (mods[mod] && typeof mods[mod][name] === 'function' ? mods[mod][name] : null);
const flat = Object.assign({}, ...Object.values(mods));

export const api = {};
if (selfcheck) {
  // 参照実装（tests/fixtures/ref-apply/ref.mjs）は旧来の形（失敗は Error）
  for (const k of ['removeLines', 'orderUnits', 'applyOverlay', 'findUnclassifiedExtensions', 'flagNewComponents']) api[k] = flat[k] ?? null;
} else {
  const rl = fn('lines', 'removeLinesFromText');
  api.removeLines = rl && ((text, { line, count = 1 }) => {
    const r = rl(text, line, count);
    if (!r.ok) throw new Error(r.error || 'removeLines');
    return { text: r.text, removed: r.found };
  });
  const pu = fn('units', 'planUnits');
  api.orderUnits = pu && ((units) => {
    const r = pu(units, {});
    if (r.errors.length) throw new Error(r.errors.join('; '));
    return r.plan;
  });
  const ao = fn('overlay', 'applyProductOverlay');
  api.applyOverlay = ao && ((product, overlay) => {
    const r = ao(product, overlay);
    if (r.errors.length) throw new Error(r.errors.join('; '));
    return { product: r.product, warnings: r.warnings };
  });
  const fu = fn('classify', 'findUnclassifiedExtensions');
  api.findUnclassifiedExtensions = fu && ((names, keep, units) => fu(names, keep, units).map((x) => x.name));
  const hw = fn('classify', 'highlightWords');
  api.flagNewComponents = hw && ((names) => names.map((name) => ({ name, highlight: hw(name).length > 0 })));
}

export const apiDir = DIR;
export const skipReason = (key) => (api[key] ? false : `実装なし: ${key}（${DIR}）`);
