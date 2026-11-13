// removeLines の規則（docs/03 の3.1）: 前後の空白を除いて完全に一致する行を探し、ちょうど count 行（既定 1）なら消す。
// 0 行や数が違うときは消さずに止める。正規表現は使わない。純粋な関数（ファイルを触らない）。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   matchesLine(candidate, target)            → 真偽
//   removeLinesFromText(text, line, count = 1) → { ok, text, found, error }

const BOM = "﻿";

// 前後の空白を除いて等しいか。
export function matchesLine(candidate, target) {
  if (typeof candidate !== "string" || typeof target !== "string") return false;
  return candidate.trim() === target.trim();
}

// 中身を行に分ける。各要素は { body, eol }（eol は "\r\n"・"\n"・""）。最後の行に改行が無ければ eol は ""。
export function splitLinesKeepEol(text) {
  const out = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf("\n", start);
    if (nl === -1) {
      out.push({ body: text.slice(start), eol: "" });
      break;
    }
    const crlf = nl > start && text[nl - 1] === "\r";
    out.push({ body: text.slice(start, crlf ? nl - 1 : nl), eol: crlf ? "\r\n" : "\n" });
    start = nl + 1;
  }
  return out;
}

export function removeLinesFromText(text, line, count = 1) {
  if (typeof text !== "string") return { ok: false, text, found: 0, error: "中身が文字列でない" };
  if (typeof line !== "string" || line.trim() === "") return { ok: false, text, found: 0, error: "line が空か文字列でない" };
  if (!Number.isInteger(count) || count < 1) return { ok: false, text, found: 0, error: `count が1以上の整数でない: ${JSON.stringify(count)}` };

  const hasBom = text.startsWith(BOM);
  const body = hasBom ? text.slice(1) : text;
  const lines = splitLinesKeepEol(body);
  const hits = [];
  lines.forEach((l, i) => {
    if (matchesLine(l.body, line)) hits.push(i);
  });
  if (hits.length !== count) {
    return {
      ok: false,
      text,
      found: hits.length,
      error: hits.length === 0 ? "一致する行が無い" : `一致する行が ${hits.length} 行（期待 ${count} 行）`,
    };
  }
  const drop = new Set(hits);
  // 残る行の行末は行ごとに保つ。消す行が最後の行（改行なし）でも、前の行の改行は消さない
  // （'a\n<消す行>' → 'a\n'。2026-11-14 リーダーの判断）。
  const kept = lines.filter((_, i) => !drop.has(i));
  const out = kept.map((l) => l.body + l.eol).join("");
  return { ok: true, text: (hasBom ? BOM : "") + out, found: hits.length, error: null };
}
