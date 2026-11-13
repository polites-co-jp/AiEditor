// product.json の上書き（docs/02 の3節）。純粋な関数。
//
// product.overlay.json の形:
//   set              キーの値を入れる・置き換える（トップレベルのキー単位。値は丸ごと置き換える）
//   remove           キーを消す。本家に無ければ警告（本家の改名を見つけるため）
//   removeIfPresent  「本家が足したら remove」。本家に無ければ何もしない。あれば消して警告
//   $ で始まるキー   説明。読まない
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   validateOverlay(overlay)                → 誤りの文字列の配列
//   applyProductOverlay(product, overlay)   → { product, set, removed, removedIfPresent, warnings, errors }
//   removeProductKeys(product, keys)        → { product, removed, missing }
//   detectIndent(text)                      → "\t" か空白の文字列
//   stringifyLike(value, originalText)      → 元の字下げと末尾の改行に合わせた JSON

export const OVERLAY_KEYS = ["set", "remove", "removeIfPresent"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function validateOverlay(overlay) {
  if (!isPlainObject(overlay)) return ["overlay: オブジェクトでない"];
  const errors = [];
  for (const k of Object.keys(overlay)) {
    if (k.startsWith("$")) continue;
    if (!OVERLAY_KEYS.includes(k)) errors.push(`overlay: 知らない項目 ${JSON.stringify(k)}（set・remove・removeIfPresent だけ）`);
  }
  if (overlay.set !== undefined && !isPlainObject(overlay.set)) errors.push("overlay.set: オブジェクトでない");
  for (const k of ["remove", "removeIfPresent"]) {
    if (overlay[k] === undefined) continue;
    if (!Array.isArray(overlay[k]) || overlay[k].some((x) => typeof x !== "string" || x === "")) {
      errors.push(`overlay.${k}: 空でない文字列の配列でない`);
    }
  }
  if (errors.length) return errors;
  const setKeys = new Set(Object.keys(overlay.set || {}));
  const removeKeys = new Set(overlay.remove || []);
  for (const k of overlay.remove || []) if (setKeys.has(k)) errors.push(`overlay: ${k} が set と remove の両方にある`);
  for (const k of overlay.removeIfPresent || []) {
    if (setKeys.has(k)) errors.push(`overlay: ${k} が set と removeIfPresent の両方にある`);
    if (removeKeys.has(k)) errors.push(`overlay: ${k} が remove と removeIfPresent の両方にある`);
  }
  return errors;
}

export function applyProductOverlay(product, overlay) {
  const result = { product: isPlainObject(product) ? clone(product) : {}, set: [], removed: [], removedIfPresent: [], warnings: [], errors: [] };
  if (!isPlainObject(product)) result.errors.push("product.json: オブジェクトでない");
  result.errors.push(...validateOverlay(overlay));
  if (result.errors.length) return result;

  const out = clone(product);
  for (const [k, v] of Object.entries(overlay.set || {})) {
    out[k] = clone(v); // 既にあるキーは位置を保つ。新しいキーは末尾に入る
    result.set.push(k);
  }
  for (const k of overlay.remove || []) {
    if (has(out, k)) {
      delete out[k];
      result.removed.push(k);
    } else {
      result.warnings.push(`overlay.remove: ${k} が本家の product.json に無い（改名の恐れ）`);
    }
  }
  for (const k of overlay.removeIfPresent || []) {
    if (has(out, k)) {
      delete out[k];
      result.removedIfPresent.push(k);
      result.warnings.push(`overlay.removeIfPresent: 本家の product.json に ${k} がある（本家が足した）。外した`);
    }
  }
  result.product = out;
  return result;
}

export function removeProductKeys(product, keys) {
  const out = isPlainObject(product) ? clone(product) : {};
  const removed = [];
  const missing = [];
  for (const k of Array.isArray(keys) ? keys : []) {
    if (has(out, k)) {
      delete out[k];
      removed.push(k);
    } else {
      missing.push(k);
    }
  }
  return { product: out, removed, missing };
}

// JSON の文字列の字下げ。最初の字下げされた行から決める。見つからなければ空白2つ。
export function detectIndent(text) {
  if (typeof text !== "string") return "  ";
  const m = /\r?\n([ \t]+)\S/.exec(text);
  if (!m) return "  ";
  return m[1].startsWith("\t") ? "\t" : m[1];
}

export function stringifyLike(value, originalText) {
  const indent = detectIndent(originalText);
  const eol = typeof originalText === "string" && originalText.includes("\r\n") ? "\r\n" : "\n";
  let s = JSON.stringify(value, null, indent);
  if (eol === "\r\n") s = s.replace(/\n/g, "\r\n");
  const trailing = typeof originalText === "string" ? /\r?\n$/.test(originalText) : true;
  return trailing ? s + eol : s;
}
