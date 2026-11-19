// 日本語の言語パック（組み込み拡張 extensions-src/language-pack-ja）を作る・数えるための純粋な部品
// （docs/04 の7節、tasks/2026-11-17-l10n-ja/l10n-design.md）。入出力は scripts/l10n-ja.mjs が行う。
//
// 言葉:
//   文言の表（strings）: ビルドの英語の文言。
//     { core: { <moduleId>: { <key>: <英語> } },
//       extensions: { <拡張の ID>: { folder, own, package: { <key>: <英語> }, bundle: { <key>: <英語> } } } }
//     core は out/nls.keys.json と out/nls.messages.json から（本体の引き方 src/vs/base/node/nls.ts と同じ、モジュールと鍵）。
//     extensions の package は package.nls.json、bundle は vscode.l10n.t の文言（build/lib/i18n.ts の引き方）。
//   訳の層（layer）: { name, core: { <moduleId>: { <key>: <訳> } }, extensions: { <ID>: { package: {...}, bundle: {...} } } }
//     言語パックの translations/main.i18n.json の contents と translations/extensions/<ID>.i18n.json の contents と同じ形。
//   足した訳（added）: { version, core: { <moduleId>: { <key>: { en, ja, override? } } }, extensions: { <ID>: { package|bundle: { <key>: { en, ja, override? } } } } }
//     ふだんは公式の訳が勝つ（公式に入れば足した訳は使わず redundantAdded に出す）。override: true は、公式の訳が英語のまま
//     （日本語を含まない）の文言を日本語にするためのもので、公式の訳より先に使う。
//   除外（exclusions）: { reasons: { <理由の名前>: <説明> }, exclusions: [ 項目 ] }
//     項目: { module, key, en, reason, note? }（本体） / { extension: <ID>, section: "package"|"bundle", key, en, reason, note? }（拡張）
//     曹参の網（tests/l10n-audit.mjs）の除外の形（{ exclusions: [{ module|extension, key, reason }] }）とそろえ、同じファイルを読めるようにした。
//     英語（en）を記録し、版が上がって英語が変わったら除外を見直す（未訳に数える）。
//
// 未訳の定義: 文言の表の鍵のうち、パック（作った dist）に空でない訳が無く、除外にも無いもの。本体は訳が無いか空の文字列なら
// 英語に戻す（nls.ts の `moduleTranslations?.[nlsKey] || nlsDefaultMessages[nlsIndex]`）ので、空の訳も未訳に数える。

export const SECTIONS = Object.freeze(["package", "bundle"]);
// 除外に書ける拡張の場所（literal は自前の組み込み拡張の manifest の直書き）
export const EX_SECTIONS = Object.freeze(["package", "bundle", "literal"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);

// 日本語の文字（ひらがな・カタカナ・漢字・全角の記号）を含むか。数える表示の補い（未訳の定義には使わない）。
export function hasJapanese(s) {
  return /[぀-ヿ㐀-鿿！-｠　-〿]/.test(String(s));
}

// out/nls.keys.json（[[moduleId, [key...]]...]）と out/nls.messages.json（英語の平らな配列）から core の表を作る。
// 数が合わなければ例外（本体も同じ順で読む）。
export function coreFromNls(keys, messages) {
  if (!Array.isArray(keys) || !Array.isArray(messages)) throw new Error("nls.keys.json / nls.messages.json が配列でない");
  const core = {};
  let i = 0;
  for (const entry of keys) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Array.isArray(entry[1])) throw new Error(`nls.keys.json の形が違う: ${JSON.stringify(entry).slice(0, 120)}`);
    const [mod, ks] = entry;
    const m = (core[mod] ||= {});
    for (const k of ks) {
      if (i >= messages.length) throw new Error("nls.keys.json の鍵の数が nls.messages.json より多い");
      m[k] = messages[i++];
    }
  }
  if (i !== messages.length) throw new Error(`nls.messages.json の数（${messages.length}）が鍵の数（${i}）と違う`);
  return core;
}

// l10n の束（bundle.l10n.json の形。値は文字列か { message, comment }）を { 鍵: 英語 } にする（i18n.ts の getRecordFromL10nJsonFormat）。
export function recordFromL10nJson(json) {
  const out = {};
  if (!isObj(json)) return out;
  for (const k of Object.keys(json)) {
    const v = json[k];
    if (typeof v === "string") out[k] = v;
    else if (isObj(v) && typeof v.message === "string") out[k] = v.message;
  }
  return out;
}

// package.nls.json（値は文字列か { message, comment }）を { 鍵: 英語 } にする。
export function recordFromPackageNls(json) {
  return recordFromL10nJson(json);
}

// 表の件数。{ core, extensions: { <ID>: { package, bundle } }, total }
export function countStrings(strings) {
  let core = 0;
  for (const m of Object.values(strings.core || {})) core += Object.keys(m).length;
  const extensions = {};
  let ext = 0;
  for (const [id, e] of Object.entries(strings.extensions || {})) {
    const p = Object.keys(e.package || {}).length;
    const b = Object.keys(e.bundle || {}).length;
    const l = Object.keys(e.literal || {}).length;
    extensions[id] = l ? { package: p, bundle: b, literal: l } : { package: p, bundle: b };
    ext += p + b + l;
  }
  return { core, extensions: ext, total: core + ext, perExtension: extensions };
}

// 文言の表を、場所ごとの平らな一覧にする。{ area: "core"|"package"|"bundle"|"literal", owner: <moduleId か拡張の ID>, key, en }
//   literal: 自前の組み込み拡張（mydist・notion-sync・language-pack-ja）の package.json に直に書いた表示の文字列
//   （%key% を使わないので言語パックでは訳さない。日本語で書いてあれば訳がある、と数える）。
export function flattenStrings(strings) {
  const out = [];
  for (const [mod, m] of Object.entries(strings.core || {})) for (const [key, en] of Object.entries(m)) out.push({ area: "core", owner: mod, key, en });
  for (const [id, e] of Object.entries(strings.extensions || {})) {
    for (const sec of [...SECTIONS, "literal"]) for (const [key, en] of Object.entries(e[sec] || {})) out.push({ area: sec, owner: id, key, en });
  }
  return out;
}

// 自前の組み込み拡張の manifest の、画面に出る文字列（%key% でないもの）。{ <場所>: <文字列> }
export function manifestLiterals(m) {
  const out = {};
  const add = (where, v) => {
    if (typeof v === "string" && v !== "" && !/^%[^%]+%$/.test(v)) out[where] = v;
  };
  add("displayName", m.displayName);
  add("description", m.description);
  const c = isObj(m.contributes) ? m.contributes : {};
  (Array.isArray(c.commands) ? c.commands : []).forEach((x) => {
    add(`commands.${x.command}.title`, x.title);
    add(`commands.${x.command}.category`, x.category);
  });
  const confs = Array.isArray(c.configuration) ? c.configuration : isObj(c.configuration) ? [c.configuration] : [];
  confs.forEach((cf, i) => {
    add(`configuration[${i}].title`, cf.title);
    for (const [k, p] of Object.entries(isObj(cf.properties) ? cf.properties : {})) {
      add(`configuration.${k}.description`, p.description);
      add(`configuration.${k}.markdownDescription`, p.markdownDescription);
    }
  });
  (Array.isArray(c.localizations) ? c.localizations : []).forEach((l) => add(`localizations.${l.languageId}.localizedLanguageName`, l.localizedLanguageName));
  return out;
}

// 層・足した訳・除外の、ある場所の鍵の値を引く（無ければ undefined）。
export function lookup(tree, area, owner, key) {
  if (!isObj(tree)) return undefined;
  if (area === "core") return own(tree.core, owner) && own(tree.core[owner], key) ? tree.core[owner][key] : undefined;
  const e = own(tree.extensions, owner) ? tree.extensions[owner] : null;
  return e && own(e[area], key) ? e[area][key] : undefined;
}

function put(tree, area, owner, key, value) {
  if (area === "core") {
    ((tree.core ||= {})[owner] ||= {})[key] = value;
  } else {
    (((tree.extensions ||= {})[owner] ||= {})[area] ||= {})[key] = value;
  }
}

// パックを組む。
//   strings: 文言の表（あれば、その鍵だけを入れる。無ければ層の鍵を全部入れる）
//   layers:  公式の訳の層（優先の順。先の層が勝つ）
//   added:   足した訳（の配列。古い版から順でよい。後のものが勝つ）。公式の層に訳があれば、公式を使う
// 返り値: { pack: { core, extensions }, provenance: { <層の名前 か "added:<版>">: 件数 }, redundantAdded: [...], staleAdded: [...] }
//   redundantAdded: 足した訳のうち、公式の層にも訳があるもの（足した訳は使わない。消してよい）
//   staleAdded:     足した訳のうち、記録した英語が今の表の英語と違うもの（訳し直しが要る。パックには入れない）
export function buildPack({ strings = null, layers = [], added = [] }) {
  const pack = { core: {}, extensions: {} };
  const provenance = {};
  const redundantAdded = [];
  const staleAdded = [];
  const bump = (n) => (provenance[n] = (provenance[n] || 0) + 1);

  // 対象の鍵
  let targets;
  if (strings) {
    targets = flattenStrings(strings);
  } else {
    const seen = new Set();
    targets = [];
    const add = (area, owner, key) => {
      const id = `${area}\u0000${owner}\u0000${key}`;
      if (!seen.has(id)) {
        seen.add(id);
        targets.push({ area, owner, key, en: undefined });
      }
    };
    for (const t of [...layers, ...added]) {
      for (const [mod, m] of Object.entries(t.core || {})) for (const k of Object.keys(m)) add("core", mod, k);
      for (const [id, e] of Object.entries(t.extensions || {})) for (const sec of SECTIONS) for (const k of Object.keys(e[sec] || {})) add(sec, id, k);
    }
  }

  for (const t of targets) {
    let done = false;
    let fromLayer = null;
    // 上書きの印（override: true）のある足した訳は、公式の訳より先に見る（公式の訳が英語のままのものを日本語にする）
    let ov = null;
    for (const a of added) {
      const v = lookup(a, t.area, t.owner, t.key);
      if (isObj(v) && v.override === true && typeof v.ja === "string") ov = { v, version: a.version };
    }
    if (ov) {
      if (t.en !== undefined && ov.v.en !== t.en) {
        staleAdded.push({ area: t.area, owner: t.owner, key: t.key, version: ov.version, recordedEn: ov.v.en, en: t.en, override: true });
      } else {
        put(pack, t.area, t.owner, t.key, ov.v.ja);
        bump(`added:${ov.version}:override`);
        continue;
      }
    }
    for (const layer of layers) {
      const v = lookup(layer, t.area, t.owner, t.key);
      if (typeof v === "string" && v !== "") {
        put(pack, t.area, t.owner, t.key, v);
        bump(layer.name);
        fromLayer = layer.name;
        done = true;
        break;
      }
    }
    // 足した訳（後の版が勝つ）
    let hit = null;
    for (const a of added) {
      const v = lookup(a, t.area, t.owner, t.key);
      if (isObj(v) && typeof v.ja === "string" && v.override !== true) hit = { v, version: a.version };
    }
    if (!hit) continue;
    if (done) {
      redundantAdded.push({ area: t.area, owner: t.owner, key: t.key, version: hit.version, official: fromLayer });
      continue;
    }
    if (t.en !== undefined && hit.v.en !== t.en) {
      staleAdded.push({ area: t.area, owner: t.owner, key: t.key, version: hit.version, recordedEn: hit.v.en, en: t.en });
      continue;
    }
    if (hit.v.ja === "") continue;
    put(pack, t.area, t.owner, t.key, hit.v.ja);
    bump(`added:${hit.version}`);
  }
  return { pack, provenance, redundantAdded, staleAdded };
}

// 除外の一覧（{ exclusions: [...] }）を、lookup で引ける木（{ core, extensions }）にする。
export function exclusionTree(ex) {
  const tree = { core: {}, extensions: {} };
  for (const e of (isObj(ex) && Array.isArray(ex.exclusions) ? ex.exclusions : [])) {
    if (!isObj(e) || typeof e.key !== "string") continue;
    const v = { en: e.en, reason: e.reason, note: e.note };
    if (typeof e.module === "string") put(tree, "core", e.module, e.key, v);
    else if (typeof e.extension === "string") put(tree, EX_SECTIONS.includes(e.section) ? e.section : "package", e.extension, e.key, v);
  }
  return tree;
}

// 数える。strings の鍵ごとに、パックの訳・除外を見る。exclusions は { exclusions: [...] } の形（exclusionTree で木にする）。
// 返り値: { total, translated, excluded, untranslated, untranslatedList, staleExclusions, byArea, perOwner, notJapanese }
//   staleExclusions: 除外のうち、記録した英語が今の表の英語と違うもの（除外の見直しが要る。未訳にも数える）
//   notJapanese:     訳はあるが日本語の文字を含まないもの（情報。公式の訳でも "Git" などは英字のまま）
export function coverage({ strings, pack, exclusions = null }) {
  const res = {
    total: 0, translated: 0, excluded: 0, untranslated: 0,
    untranslatedList: [], staleExclusions: [], notJapanese: 0,
    byArea: Object.fromEntries(["core", "package", "bundle", "literal"].map((k) => [k, { total: 0, translated: 0, excluded: 0, untranslated: 0 }])),
    perOwner: {},
  };
  const exTree = exclusionTree(exclusions);
  for (const t of flattenStrings(strings)) {
    const ownerKey = t.area === "core" ? "vscode" : t.owner;
    const po = (res.perOwner[ownerKey] ||= { total: 0, translated: 0, excluded: 0, untranslated: 0 });
    const ba = res.byArea[t.area];
    res.total++; po.total++; ba.total++;
    const v = t.area === "literal" ? (hasJapanese(t.en) ? t.en : undefined) : lookup(pack, t.area, t.owner, t.key);
    if (typeof v === "string" && v !== "") {
      res.translated++; po.translated++; ba.translated++;
      if (!hasJapanese(v)) res.notJapanese++;
      continue;
    }
    const ex = lookup(exTree, t.area, t.owner, t.key);
    if (isObj(ex) && ex.en === t.en && typeof ex.reason === "string" && ex.reason) {
      res.excluded++; po.excluded++; ba.excluded++;
      continue;
    }
    if (isObj(ex)) res.staleExclusions.push({ area: t.area, owner: t.owner, key: t.key, recordedEn: ex.en, en: t.en });
    res.untranslated++; po.untranslated++; ba.untranslated++;
    res.untranslatedList.push(t);
  }
  return res;
}

// 除外の形の誤り（理由が reasons に無い・en が無いなど）。返り値は文の配列。
export function validateExclusions(ex) {
  const errors = [];
  if (!isObj(ex)) return ["除外の一覧がオブジェクトでない"];
  const reasons = isObj(ex.reasons) ? ex.reasons : {};
  if (!Array.isArray(ex.exclusions)) return ["exclusions が配列でない"];
  const seen = new Set();
  ex.exclusions.forEach((v, i) => {
    const where = `#${i}`;
    if (!isObj(v)) return errors.push(`${where}: 値がオブジェクトでない`);
    const isCore = typeof v.module === "string";
    const isExt = typeof v.extension === "string";
    if (isCore === isExt) errors.push(`${where}: module か extension のどちらか1つが要る`);
    if (isExt && !EX_SECTIONS.includes(v.section)) errors.push(`${where}: section は package・bundle・literal のどれか`);
    if (typeof v.key !== "string") errors.push(`${where}: key が無い`);
    if (typeof v.en !== "string") errors.push(`${where}: en が無い`);
    if (typeof v.reason !== "string" || !own(reasons, v.reason)) errors.push(`${where}: 理由 ${JSON.stringify(v.reason)} が reasons に無い`);
    const id = isCore ? `core\u0000${v.module}\u0000${v.key}` : `${v.section}\u0000${v.extension}\u0000${v.key}`;
    if (seen.has(id)) errors.push(`${where}: 同じ鍵が2度ある`);
    seen.add(id);
  });
  return errors;
}

// 足した訳の形の誤り。
export function validateAdded(a) {
  const errors = [];
  if (!isObj(a)) return ["足した訳がオブジェクトでない"];
  if (typeof a.version !== "string" || !/^\d+\.\d+\.\d+$/.test(a.version)) errors.push(`version の形が違う: ${JSON.stringify(a.version)}`);
  const check = (where, v) => {
    if (!isObj(v)) return errors.push(`${where}: 値がオブジェクトでない`);
    if (typeof v.en !== "string") errors.push(`${where}: en が無い`);
    if (typeof v.ja !== "string" || v.ja === "") errors.push(`${where}: ja が無いか空`);
  };
  for (const [mod, m] of Object.entries(a.core || {})) for (const [k, v] of Object.entries(m)) check(`core ${mod} ${k}`, v);
  for (const [id, e] of Object.entries(a.extensions || {})) for (const sec of SECTIONS) for (const [k, v] of Object.entries(e[sec] || {})) check(`${id} ${sec} ${k}`, v);
  return errors;
}

// ソースの文字列の \uXXXX・\u{X...} の書き方を、実行時（JS のエンジン）と同じ文字に直す（extract が @vscode/l10n-dev に渡す前）。
// @vscode/l10n-dev 0.0.35 の unescapeString は \uXXXX の4桁のうち3桁しか読まず（\u2194「↔」が U+0219「ș」になり、4桁目を捨てる）、
// \u{...} も文字列の先頭から } を探す。そのため束の鍵が実行時の鍵と合わなくなる（tasks/2026-11-17-icon-ja-tests の「食い違った所」1）。
// 直し方: 前に置いた \ が奇数個の \u の書き方だけを、U+0100 以上は文字そのものに、U+00FF 以下は \xHH（l10n-dev が正しく読む形）にする。
// 対になったサロゲート（\uD83D\uDE00）は1文字にまとめる。対にならないサロゲートと U+2028・U+2029 は書き方のまま残す。
// \\u2194（\ そのもの + u2194）は書き方ではないので変えない。文字列の外（正規表現・識別子・注釈）も同じ規則で変わるが、意味は変わらない。
export function decodeUnicodeEscapes(src) {
  const s = String(src ?? "");
  if (!s.includes("\\u")) return s;
  const readU = (i) => {
    if (s[i] !== "\\" || s[i + 1] !== "u") return null;
    if (s[i + 2] === "{") {
      const close = s.indexOf("}", i + 3);
      if (close < 0) return null;
      const hex = s.slice(i + 3, close);
      if (!/^[0-9A-Fa-f]{1,6}$/.test(hex)) return null;
      const cp = parseInt(hex, 16);
      return cp > 0x10ffff ? null : { cp, end: close + 1 };
    }
    const hex = s.slice(i + 2, i + 6);
    return /^[0-9A-Fa-f]{4}$/.test(hex) ? { cp: parseInt(hex, 16), end: i + 6 } : null;
  };
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "\\") {
      out += s[i++];
      continue;
    }
    const esc = s[i + 1] === "u" ? readU(i) : null;
    if (!esc) {
      // \ とその次の1文字はそのまま（\\ の対を先に読むので、\\u2194 の u は書き方として読まない）
      out += s.slice(i, i + 2);
      i += 2;
      continue;
    }
    let { cp, end } = esc;
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const lo = readU(end);
      if (lo && lo.cp >= 0xdc00 && lo.cp <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo.cp - 0xdc00);
        end = lo.end;
      }
    }
    if ((cp >= 0xd800 && cp <= 0xdfff) || cp === 0x2028 || cp === 0x2029) out += s.slice(i, end);
    else if (cp < 0x100) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else out += String.fromCodePoint(cp);
    i = end;
  }
  return out;
}

// 言語パックの第三者の表示（ThirdPartyNotices.txt）の本文。sources は sources.json の sources（先に書いたものが勝つ順）。
// licenses は [{ sha256, text }]（vscode-loc の LICENSE.md。同じ SHA-256 は1つにまとめて写す）。
// 下の層（vscode-loc の main、Open VSX の VSIX）も、束に鍵が入るので出典に書く（2026-11-17 のリーダーの判断）。
export function thirdPartyNotice(sources, licenses) {
  const lines = [
    "Sukuna language-pack-ja - Third Party Notices",
    "",
    "This extension contains Japanese translations taken from the following sources. When two sources translate",
    "the same string, the earlier one in this list is used.",
    "",
  ];
  (sources || []).forEach((s, i) => {
    const n = `${i + 1}.`;
    if (s.kind === "vscode-loc") {
      lines.push(`${n} ${s.repo} (https://github.com/${s.repo}), commit ${s.commit}, files dated ${s.date || "?"}.`);
      lines.push(`   License: MIT (LICENSE.md of the repository, reproduced below).`);
    } else if (s.kind === "vsix") {
      lines.push(`${n} ${s.id} ${s.version} from Open VSX (${s.download}), SHA-256 ${s.sha256}.`);
      lines.push(`   Its manifest names the repository ${s.repository || "(not recorded)"} and the license "${s.license || "(not recorded)"}".`);
      lines.push("   The VSIX contains no LICENSE.md; the LICENSE.md of that repository is reproduced below.");
    } else {
      lines.push(`${n} ${s.name || "(unnamed source)"}.`);
    }
  });
  lines.push(
    "",
    "Translations added by the Sukuna builders (strings that the sources above do not translate, and overrides of",
    "source translations) are in extensions-src/language-pack-ja/added/*.json of the build repository.",
  );
  const seen = new Set();
  for (const l of licenses || []) {
    if (!l || typeof l.text !== "string" || seen.has(l.sha256)) continue;
    seen.add(l.sha256);
    lines.push("", "---------------------------------------------------------", "", `microsoft/vscode-loc LICENSE.md (SHA-256 ${l.sha256}):`, "", l.text.replace(/^﻿/, "").trim());
  }
  lines.push("");
  return lines.join("\n");
}

// 訳と英語でそろっていなければならない印（足した訳の検査。tasks/2026-11-17-l10n-ja-verify の M2）。
// 次の形の印を返す（同じ印が2度出れば2つ返す）。並びは、上の3つを出てくる順に、その後にリンクの先を出てくる順に。
//   {0}・{name}    置き換えの印
//   &&            ニーモニックの印（訳では「ファイル(&&F)」のように後ろへ回すので、数だけを見る）
//   $(name)       codicon の印（$(gear)・$(sync~spin) など）
//   [](<先>)      Markdown のリンクの行き先（表示の文字は訳すので見ない。先は英語と同じでなければならない）
export function placeholderMarks(s) {
  const text = String(s ?? "");
  // リンクの表示の文字の中の {0} なども数えるため、リンクの先とほかの印は別々に拾う
  const simple = text.match(/\{\d+\}|\{[A-Za-z_][A-Za-z0-9_]*\}|&&|\$\([A-Za-z0-9~_-]+\)/g) || [];
  const links = [...text.matchAll(/\[(?:[^\[\]]|\[[^\[\]]*\])*\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+"[^"]*")?\s*\)/g)].map((m) => `[](${m[1]})`);
  return [...simple, ...links];
}

// 訳の中の印（placeholderMarks）が英語と合っているか。数まで見る（英語に {0} が2つなら訳にも2つ）。
// 英語にあって訳に足りない印を missing、訳に余分な印を extra に、並べ替えて返す。合っていれば null。
export function placeholderMismatch(en, ja) {
  const count = (list) => list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const a = count(placeholderMarks(en));
  const b = count(placeholderMarks(ja));
  const missing = [];
  const extra = [];
  for (const [x, n] of a) for (let i = b.get(x) || 0; i < n; i++) missing.push(x);
  for (const [x, n] of b) for (let i = a.get(x) || 0; i < n; i++) extra.push(x);
  missing.sort();
  extra.sort();
  return missing.length || extra.length ? { missing, extra } : null;
}

// 言語パックの 1 つの拡張の i18n.json の中身（contents）を作る。i18n.ts の prepareI18nPackFiles の形（version "1.0.0"）。
export function i18nFile(contents) {
  return { version: "1.0.0", contents };
}

// パックの拡張の部分を、拡張ごとの i18n.json の contents にする。package と bundle の両方を必ず持たせる
// （extensions-src/notion-sync/builtin-l10n.mjs の説明: 組み込みは contents.bundle と contents.package を読む）。
export function extensionContents(packExtension) {
  return { package: { ...(packExtension?.package || {}) }, bundle: { ...(packExtension?.bundle || {}) } };
}
