// 本文の正規化・ハッシュ・Notion の rich_text への分割と結合（docs/05 の3節）。
// vscode に依存しない純粋な部品。

import { createHash } from "node:crypto";

/** rich_text の1要素の text.content の上限（文字。JavaScript の文字列の長さ＝UTF-16 の単位で数える） */
export const RICH_TEXT_MAX_CHARS = 2000;
/** 1つのブロックの rich_text の配列の上限 */
export const RICH_TEXT_MAX_ITEMS = 100;
/** 1ファイルの上限（2000 × 100） */
export const FILE_MAX_CHARS = RICH_TEXT_MAX_CHARS * RICH_TEXT_MAX_ITEMS;

export class TooLargeError extends Error {
  readonly chars: number;
  readonly items: number;
  constructor(message: string, chars: number, items: number) {
    super(message);
    this.name = "TooLargeError";
    this.chars = chars;
    this.items = items;
  }
}

/**
 * 比べる・送るための正規の形にする。
 * - 先頭の BOM を外す
 * - 改行を LF にそろえる（CRLF・CR → LF）
 * - 末尾の空白と改行を落とす（Notion が末尾の改行を保つかは未確認のため、比べるときに差にしない）
 */
export function canonicalize(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  t = t.replace(/\r\n?/g, "\n");
  // 末尾の空白と改行（trimEnd は正規表現の後ろからの一致と違い、長い空白の並びで遅くならない）
  return t.trimEnd();
}

/** 正規の形の SHA-256（16進の小文字） */
export function hashText(text: string): string {
  return createHash("sha256").update(canonicalize(text), "utf8").digest("hex");
}

/** ファイルの改行の形（CRLF が1つでもあれば CRLF） */
export function detectEol(text: string | null | undefined): "\r\n" | "\n" | null {
  if (text == null) return null;
  return /\r\n/.test(text) ? "\r\n" : text.includes("\n") ? "\n" : null;
}

/** 正規の形の本文を、手元に書く形にする（改行の形をそろえ、末尾に改行を1つ付ける） */
export function toLocalText(canonical: string, eol: "\r\n" | "\n"): string {
  const body = canonicalize(canonical);
  const withEol = eol === "\r\n" ? body.replace(/\n/g, "\r\n") : body;
  return body.length === 0 ? "" : withEol + eol;
}

/**
 * 本文を max 文字ごとに分ける。サロゲートペア（絵文字など）の途中では切らない。
 * 空の本文は空の配列。
 */
export function splitText(text: string, max: number = RICH_TEXT_MAX_CHARS): string[] {
  if (!Number.isInteger(max) || max < 2) throw new RangeError(`max は2以上の整数: ${max}`);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      const prev = text.charCodeAt(end - 1);
      // 上位サロゲートで終わるなら、その手前で切る
      if (prev >= 0xd800 && prev <= 0xdbff) end -= 1;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

export interface RichTextItem {
  type: "text";
  text: { content: string };
}

/**
 * 本文を Notion の rich_text の配列にする。canonicalize した本文を分ける。
 * 100 要素を超えるときは TooLargeError（書き出さない。docs/05 の3節）。
 */
export function toRichText(text: string): RichTextItem[] {
  const canonical = canonicalize(text);
  const parts = splitText(canonical, RICH_TEXT_MAX_CHARS);
  if (parts.length > RICH_TEXT_MAX_ITEMS) {
    throw new TooLargeError(
      `本文が長すぎる（${canonical.length} 文字。1ファイル ${FILE_MAX_CHARS} 文字まで）`,
      canonical.length,
      parts.length,
    );
  }
  return parts.map((content) => ({ type: "text", text: { content } }));
}

/** Notion から読んだ rich_text の配列を本文に戻す（plain_text を優先し、無ければ text.content） */
export function fromRichText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  let s = "";
  for (const it of items) {
    if (it && typeof it === "object") {
      const o = it as { plain_text?: unknown; text?: { content?: unknown } };
      if (typeof o.plain_text === "string") s += o.plain_text;
      else if (o.text && typeof o.text.content === "string") s += o.text.content;
    }
  }
  return s;
}
