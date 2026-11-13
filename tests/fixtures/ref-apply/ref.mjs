// tests/apply.test.mjs 自体が矛盾していないことの確認用の参照実装（AIED_APPLY_DIR でこの場所を指して走らせる）。
// 本物の実装ではない。仕様の文言を最も素直に書いたもの。蒙恬の scripts/lib/apply/ の代わりにはしない。
export function removeLines(text, { line, count = 1 }) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const parts = text.split(eol);
  const want = line.trim();
  const keep = parts.filter((l) => !(want !== '' && l.trim() === want));
  const removed = parts.length - keep.length;
  if (removed !== count) throw new Error(`found ${removed}`);
  return { text: keep.join(eol), removed };
}
export function orderUnits(units) {
  const ids = units.map((u) => u.id);
  if (new Set(ids).size !== ids.length) throw new Error('dup');
  const en = units.filter((u) => u.enabled).sort((a, b) => a.order - b.order);
  for (const u of en) for (const a of u.after ?? []) {
    const t = en.find((x) => x.id === a);
    if (!t || t.order >= u.order) throw new Error('after');
  }
  return en;
}
export function applyOverlay(product, o) {
  const p = structuredClone(product); const w = [];
  for (const k of o.remove ?? []) if (k in (o.set ?? {})) throw new Error('both');
  Object.assign(p, structuredClone(o.set ?? {}));
  for (const k of o.remove ?? []) { if (!(k in product)) w.push(`missing ${k}`); delete p[k]; }
  for (const k of o.removeIfPresent ?? []) if (k in p) { delete p[k]; w.push(`upstream added ${k}`); }
  return { product: p, warnings: w };
}
export function findUnclassifiedExtensions(names, keep, units) {
  const c = new Set((keep.keep ?? keep).map((e) => e.name));
  for (const u of units) for (const d of u.delete ?? []) c.add(d.replace(/^extensions\//, ''));
  return names.filter((n) => !c.has(n)).sort();
}
export function flagNewComponents(names) {
  return names.map((name) => ({ name, highlight: /chat|agent|copilot|mcp|telemetry|experiment|survey/i.test(name) }));
}
