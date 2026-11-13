// 未分類の組み込み拡張の検出と、本家が足した部品の比べ（docs/03 の4節・6節、docs/06 の4節の4）。純粋な関数。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   HIGHLIGHT_WORDS
//   highlightWords(name)                                         → 含まれていた語の配列
//   keepNamesOf(keepJson)                                        → 名前の配列
//   extensionsCoveredByUnits(units)                              → 名前の配列
//   findUnclassifiedExtensions(upstreamNames, keepJson, units, own) → [{ name, highlight }]
//   diffNameLists(prev, next)                                    → { added, removed }
//   addedImportLines(prevText, nextText)                         → 増えた import の行
//   addedDependencies(prevPkg, nextPkg)                          → [{ name, section, version }]

import { normalizeRelPath } from "./units.mjs";

// 名前に含まれていたら目立たせる語（docs/03 の6節の「chat・agent・copilot・mcp・telemetry・experiment・survey など」に、
// AI・テレメトリの SDK と実験の名前を足した）。小文字。部分一致。
export const HIGHLIGHT_WORDS = [
  "chat",
  "agent",
  "copilot",
  "mcp",
  "telemetry",
  "experiment",
  "survey",
  "languagemodel",
  "lm-",
  "openai",
  "anthropic",
  "claude",
  "codex",
  "1ds",
  "appinsights",
  "applicationinsights",
  "assignment",
  "tas-",
];

export const OWN_EXTENSIONS = ["mydist", "notion-sync"];
const DEP_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function highlightWords(name) {
  if (typeof name !== "string") return [];
  const s = name.toLowerCase();
  return HIGHLIGHT_WORDS.filter((w) => s.includes(w));
}

// builtin/keep.json の名前（apply-design.md の2.3 の形をどれでも読む）。
export function keepNamesOf(keepJson) {
  const fromArray = (arr) =>
    arr
      .map((x) => (typeof x === "string" ? x : isPlainObject(x) ? (typeof x.name === "string" ? x.name : x.id) : null))
      .filter((x) => typeof x === "string" && x !== "");
  if (Array.isArray(keepJson)) return fromArray(keepJson);
  if (isPlainObject(keepJson)) {
    if (Array.isArray(keepJson.keep)) return fromArray(keepJson.keep);
    if (Array.isArray(keepJson.extensions)) return fromArray(keepJson.extensions);
    if (isPlainObject(keepJson.keep)) return Object.keys(keepJson.keep);
    if (isPlainObject(keepJson.extensions)) return Object.keys(keepJson.extensions);
    return Object.keys(keepJson).filter((k) => !k.startsWith("$"));
  }
  return [];
}

// 単位の delete のうち extensions/<名前>（ちょうど2段）の名前。enabled を問わない。
export function extensionsCoveredByUnits(units) {
  const out = new Set();
  for (const u of Array.isArray(units) ? units : []) {
    if (!isPlainObject(u) || !Array.isArray(u.delete)) continue;
    for (const p of u.delete) {
      const n = normalizeRelPath(p);
      if (!n) continue;
      const parts = n.split("/");
      if (parts.length === 2 && parts[0] === "extensions") out.add(parts[1]);
    }
  }
  return [...out].sort();
}

export function findUnclassifiedExtensions(upstreamNames, keepJson, units, own = OWN_EXTENSIONS) {
  const known = new Set([...keepNamesOf(keepJson), ...extensionsCoveredByUnits(units), ...(Array.isArray(own) ? own : [])]);
  return [...new Set(Array.isArray(upstreamNames) ? upstreamNames : [])]
    .filter((n) => typeof n === "string" && !known.has(n))
    .sort()
    .map((name) => ({ name, highlight: highlightWords(name) }));
}

export function diffNameLists(prev, next) {
  const p = new Set(Array.isArray(prev) ? prev : []);
  const n = new Set(Array.isArray(next) ? next : []);
  return {
    added: [...n].filter((x) => !p.has(x)).sort(),
    removed: [...p].filter((x) => !n.has(x)).sort(),
  };
}

function importLines(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("import "));
}

export function addedImportLines(prevText, nextText) {
  const before = new Set(importLines(prevText));
  const seen = new Set();
  const out = [];
  for (const l of importLines(nextText)) {
    if (before.has(l) || seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out;
}

export function addedDependencies(prevPkg, nextPkg) {
  const p = isPlainObject(prevPkg) ? prevPkg : {};
  const n = isPlainObject(nextPkg) ? nextPkg : {};
  const before = new Set();
  for (const s of DEP_SECTIONS) if (isPlainObject(p[s])) for (const k of Object.keys(p[s])) before.add(k);
  const out = [];
  for (const s of DEP_SECTIONS) {
    if (!isPlainObject(n[s])) continue;
    for (const [name, version] of Object.entries(n[s])) {
      if (!before.has(name)) out.push({ name, section: s, version });
    }
  }
  return out;
}
