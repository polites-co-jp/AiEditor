// 同期するファイルの名前の規則と、ページの ID の読み方（docs/05 の2節・3節・7節）。純粋な部品。

/** 決まった名前のファイル（User フォルダの直下） */
export const FIXED_FILES = Object.freeze(["settings.json", "keybindings.json", "tasks.json"]);

/** 見出しに使う manifest の名前 */
export const MANIFEST_HEADING = "manifest";

// Windows のファイル名に使えない文字と制御文字
const BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * 同期してよい名前か。Notion の見出しから来た名前で User フォルダの外へ書かないための守りも兼ねる。
 * - settings.json / keybindings.json / tasks.json
 * - snippets/<名前>.json / snippets/<名前>.code-snippets（サブフォルダは無し）
 */
export function isSyncableName(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0 || name.length > 200) return false;
  if ((FIXED_FILES as readonly string[]).includes(name)) return true;
  const m = /^snippets\/(.+)$/.exec(name);
  if (!m) return false;
  const base = m[1];
  if (BAD_CHARS.test(base)) return false;
  if (base.startsWith(".") || base.endsWith(".") || base.endsWith(" ")) return false;
  if (RESERVED.test(base)) return false;
  return /\.json$/i.test(base) || /\.code-snippets$/i.test(base);
}

/** 並べる順: settings → keybindings → snippets（名前順） → tasks（docs/05 の3節の図の順） */
export function compareNames(a: string, b: string): number {
  const rank = (n: string) =>
    n === "settings.json" ? 0 : n === "keybindings.json" ? 1 : n.startsWith("snippets/") ? 2 : n === "tasks.json" ? 3 : 4;
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * notionSync.pageId の値から、ページの ID（ハイフン付きの 8-4-4-4-12 の形）を取り出す。
 * URL（https://www.notion.so/Title-<32桁>?pvs=4 など）、32 桁、ハイフン付きのどれでもよい。読めなければ null。
 */
export function normalizePageId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  // URL ならクエリと断片を落とし、最後の区切りを見る
  s = s.replace(/[?#].*$/, "");
  const last = s.split("/").pop() ?? s;
  const dashed = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(last);
  let hex: string | null = null;
  if (dashed) hex = dashed[1].replace(/-/g, "");
  else {
    const plain = /([0-9a-f]{32})$/i.exec(last);
    if (plain) hex = plain[1];
  }
  if (!hex) return null;
  hex = hex.toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
