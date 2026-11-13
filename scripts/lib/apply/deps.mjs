// removeDependencies（docs/03 の3.1）: package.json の依存の区分から、名前の行を消す。純粋な関数。
// 整形は変えず、その行だけを消す（最後の要素を消したら、前の要素の行の末尾の "," を外す）。
// 結果を JSON として読み直し、消した名前のほかが変わっていないことを確かめる。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   DEPENDENCY_SECTIONS
//   removeDependenciesFromText(text, names) → { ok, text, removed: [{ name, section }], missing: [name], error }

import { splitLinesKeepEol } from "./lines.mjs";

export const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// 行の頭の JSON のキー（"name": ...）を読む。読めなければ null。
function keyOfLine(body) {
  const m = /^\s*"((?:[^"\\]|\\.)*)"\s*:/.exec(body);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return null;
  }
}

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isPlainObject(v)) return `{${Object.keys(v).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export function removeDependenciesFromText(text, names) {
  const fail = (error) => ({ ok: false, text, removed: [], missing: [], error });
  if (typeof text !== "string") return fail("中身が文字列でない");
  let json;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch (err) {
    return fail(`JSON として読めない: ${err.message}`);
  }
  if (!isPlainObject(json)) return fail("package.json がオブジェクトでない");
  const wanted = Array.isArray(names) ? [...new Set(names)] : [];

  // 消すもの（区分と名前）を JSON から決める
  const targets = [];
  const missing = [];
  for (const name of wanted) {
    const secs = DEPENDENCY_SECTIONS.filter((s) => isPlainObject(json[s]) && Object.prototype.hasOwnProperty.call(json[s], name));
    if (!secs.length) missing.push(name);
    for (const s of secs) targets.push({ name, section: s });
  }
  if (!targets.length) return { ok: true, text, removed: [], missing, error: null };

  const lines = splitLinesKeepEol(text);
  // トップレベルの区分の範囲を探す: `"<section>": {` の行から、同じ字下げの `}` の行まで
  const drop = new Set();
  const fixComma = new Set();
  for (const sec of new Set(targets.map((t) => t.section))) {
    const start = lines.findIndex((l) => keyOfLine(l.body) === sec && /\{\s*$/.test(l.body) && /^\s*/.exec(l.body)[0].length <= 2);
    if (start === -1) return fail(`区分 ${sec} の行が見つからない（1行1要素の形でない）`);
    const indent = /^\s*/.exec(lines[start].body)[0];
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].body.startsWith(indent + "}") && /^\s*\},?\s*$/.test(lines[i].body) && /^\s*/.exec(lines[i].body)[0] === indent) {
        end = i;
        break;
      }
    }
    if (end === -1) return fail(`区分 ${sec} の終わりが見つからない`);
    const names = new Set(targets.filter((t) => t.section === sec).map((t) => t.name));
    const entries = [];
    for (let i = start + 1; i < end; i++) {
      const k = keyOfLine(lines[i].body);
      if (k !== null) entries.push({ i, k });
    }
    for (const n of names) if (entries.filter((e) => e.k === n).length !== 1) return fail(`区分 ${sec} の ${n} の行がちょうど1行でない`);
    const remaining = entries.filter((e) => !names.has(e.k));
    for (const e of entries) if (names.has(e.k)) drop.add(e.i);
    // 残る最後の要素の行は "," で終わってはいけない
    if (remaining.length) {
      const last = remaining[remaining.length - 1];
      const lastOriginal = entries[entries.length - 1];
      if (names.has(lastOriginal.k)) fixComma.add(last.i);
    }
  }
  const out = [];
  lines.forEach((l, i) => {
    if (drop.has(i)) return;
    if (fixComma.has(i)) out.push({ body: l.body.replace(/,\s*$/, ""), eol: l.eol });
    else out.push(l);
  });
  const newText = out.map((l) => l.body + l.eol).join("");

  // 確かめ: 読み直して、消した名前のほかが同じか
  let after;
  try {
    after = JSON.parse(newText.replace(/^﻿/, ""));
  } catch (err) {
    return fail(`消した後の JSON が読めない: ${err.message}`);
  }
  const expected = JSON.parse(JSON.stringify(json));
  for (const t of targets) delete expected[t.section][t.name];
  if (canonical(after) !== canonical(expected)) return fail("消した後の JSON が、名前を消しただけの形と違う");
  return { ok: true, text: newText, removed: targets, missing, error: null };
}
