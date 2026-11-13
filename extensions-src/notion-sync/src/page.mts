// 設定ページの形（docs/05 の3節）の読み書き。純粋な部品。
//
//   見出し2 manifest        → コード（json） manifest の本文
//   見出し2 settings.json   → コード（json） ファイルの本文
//   ...
// 見出しの文字列でファイルを見つける。見出しの直後のコードブロックが本文。

import { MANIFEST_HEADING, isSyncableName } from "./names.mts";
import { parseManifest, ManifestError, type Manifest } from "./manifest.mts";
import { fromRichText, toRichText } from "./text.mts";
import type { NotionBlock } from "./notion-client.mts";

export interface PageFile {
  name: string;
  headingId: string;
  codeId: string;
  /** コードブロックの本文（rich_text をつないだもの。正規化はしていない） */
  text: string;
}

export interface PageState {
  /** manifest の中身。manifest の見出しが無ければ null */
  manifest: Manifest | null;
  manifestHeadingId: string | null;
  manifestCodeId: string | null;
  files: Map<string, PageFile>;
  /** 読み飛ばしたものの説明（重複した見出し、本文の無い見出しなど） */
  warnings: string[];
}

const HEADINGS = ["heading_1", "heading_2", "heading_3"];

function headingText(b: NotionBlock): string | null {
  if (!HEADINGS.includes(b.type)) return null;
  const body = b[b.type] as { rich_text?: unknown } | undefined;
  return fromRichText(body?.rich_text).trim();
}

function codeText(b: NotionBlock | undefined): string | null {
  if (!b || b.type !== "code") return null;
  const body = b.code as { rich_text?: unknown } | undefined;
  return fromRichText(body?.rich_text);
}

/**
 * ページの子のブロックの並びを読む。
 * - 見出し（1〜3 のどれでも。書くときは2）の文字列が manifest か同期の対象の名前なら、直後のコードブロックを本文とする
 * - 同じ名前の見出しが2つあれば、先のものを採り、警告を残す
 * - manifest の本文が読めなければ ManifestError（ほかの PC の書いたものを壊さないため止める）
 */
export function parsePage(blocks: NotionBlock[]): PageState {
  const st: PageState = { manifest: null, manifestHeadingId: null, manifestCodeId: null, files: new Map(), warnings: [] };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const title = headingText(b);
    if (title === null || !b.id) continue;
    if (title !== MANIFEST_HEADING && !isSyncableName(title)) continue;
    const next = blocks[i + 1];
    const body = codeText(next);
    if (body === null || !next?.id) {
      st.warnings.push(`見出し「${title}」の直後にコードブロックが無いので読み飛ばした`);
      continue;
    }
    if (title === MANIFEST_HEADING) {
      if (st.manifestCodeId) {
        st.warnings.push("manifest の見出しが2つある。先のものを使う");
        continue;
      }
      try {
        st.manifest = parseManifest(body);
      } catch (e) {
        if (e instanceof ManifestError) throw e;
        throw new ManifestError(String(e));
      }
      st.manifestHeadingId = b.id;
      st.manifestCodeId = next.id;
    } else {
      if (st.files.has(title)) {
        st.warnings.push(`見出し「${title}」が2つある。先のものを使う`);
        continue;
      }
      st.files.set(title, { name: title, headingId: b.id, codeId: next.id, text: body });
    }
    i++; // コードブロックは読んだ
  }
  return st;
}

export function headingBlock(name: string): NotionBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: name } }] },
  };
}

/** 本文のコードブロック（言語 json）。長すぎれば TooLargeError */
export function codeBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "code",
    code: { language: "json", rich_text: toRichText(text) },
  };
}
