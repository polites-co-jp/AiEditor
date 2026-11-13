// notionSync.ignoredSettings の扱い（docs/05 の5節）。
// settings.json は JSONC なので、jsonc-parser の編集の関数でキーを足し引きし、コメントと並びを保つ。純粋な部品。

import * as jsoncNs from "jsonc-parser";
import type { FormattingOptions, Node as JsonNode, ParseError } from "jsonc-parser";
import { canonicalize } from "./text.mts";

// jsonc-parser 3.3.1 の main は UMD。esbuild は module（ESM）を、Node.js の直接の読み込みは main（CJS）を使う。
// どちらでも同じ関数を取れるようにする（CJS の名前の取り出しが効かない場合の default の側も見る）。
type JsoncApi = typeof jsoncNs;
const jsonc: JsoncApi =
  typeof (jsoncNs as { modify?: unknown }).modify === "function"
    ? jsoncNs
    : (Reflect.get(jsoncNs, "default") as JsoncApi);

/** 書式の推定（最初に字下げされた行を見る。無ければ空白4つ） */
export function detectFormatting(text: string): FormattingOptions {
  const m = /\n([ \t]+)\S/.exec(text);
  if (m && m[1].startsWith("\t")) return { insertSpaces: false, tabSize: 4, eol: "\n" };
  if (m) return { insertSpaces: true, tabSize: m[1].length, eol: "\n" };
  return { insertSpaces: true, tabSize: 4, eol: "\n" };
}

/** ignoredSettings の値を、文字列の重複の無い配列にそろえる（文字列以外と空文字は捨てる） */
export function normalizeIgnoredKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && v.length > 0 && !out.includes(v)) out.push(v);
  }
  return out;
}

/** JSONC としての構文の誤り（末尾のカンマとコメントは許す）。誤りが無ければ空の配列 */
export function jsoncErrors(text: string): ParseError[] {
  const errors: ParseError[] = [];
  jsonc.parse(canonicalize(text), errors, { allowTrailingComma: true, disallowComments: false });
  return errors;
}

function topLevelProperty(root: JsonNode | undefined, key: string): JsonNode | undefined {
  if (!root || root.type !== "object" || !root.children) return undefined;
  for (const prop of root.children) {
    const k = prop.children?.[0];
    if (k && k.value === key) return prop;
  }
  return undefined;
}

/**
 * 書き出す形: settings.json の本文から、最上位の keys を除く。コメントと並びは保つ。
 * 結果は canonicalize した形（LF・末尾の空白なし）。同じキーが2回あれば両方とも除く。
 */
export function stripIgnored(text: string, keys: readonly string[]): string {
  let t = canonicalize(text);
  if (keys.length === 0) return t;
  const fo = detectFormatting(t);
  for (const key of keys) {
    for (let guard = 0; guard < 1000; guard++) {
      const root = jsonc.parseTree(t, [], { allowTrailingComma: true, disallowComments: false });
      if (!topLevelProperty(root, key)) break;
      const edits = jsonc.modify(t, [key], undefined, { formattingOptions: fo });
      if (edits.length === 0) break;
      t = jsonc.applyEdits(t, edits);
    }
  }
  return canonicalize(t);
}

/** 本文の最上位から keys の値を取り出す（あるものだけ）。順は keys の順 */
export function pickIgnored(text: string, keys: readonly string[]): Array<{ key: string; value: unknown }> {
  const root = jsonc.parseTree(canonicalize(text), [], { allowTrailingComma: true, disallowComments: false });
  const out: Array<{ key: string; value: unknown }> = [];
  for (const key of keys) {
    const prop = topLevelProperty(root, key);
    const valueNode = prop?.children?.[1];
    if (valueNode) out.push({ key, value: jsonc.getNodeValue(valueNode) });
  }
  return out;
}

/**
 * 取り込む形: Notion の本文（remoteText）から keys を除き、手元（localText）にある keys の値を足す。
 * 手元に無いキーは足さない（Notion 側にあっても除く）。結果は canonicalize した形。
 * 手元の値に付いていたコメントは保たない（値だけを写す）。
 */
export function mergeIgnored(remoteText: string, localText: string | null, keys: readonly string[]): string {
  let t = stripIgnored(remoteText, keys);
  if (keys.length === 0 || localText == null) return t;
  const picked = pickIgnored(localText, keys);
  if (picked.length === 0) return t;
  if (t.trim().length === 0) t = "{}";
  const fo = detectFormatting(t.includes("\n") ? t : canonicalize(localText));
  for (const { key, value } of picked) {
    const edits = jsonc.modify(t, [key], value, { formattingOptions: fo });
    t = jsonc.applyEdits(t, edits);
  }
  return canonicalize(t);
}
