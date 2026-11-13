// overlay のキーと mydist の既定の設定のキーが、本家の新しい版でも登録されているかの検査（docs/06 の4節の4）の純粋な部品。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   settingKeysToCheck(mydistManifest, overlay) → [{ key, from }]
//   configurationPropertyKeys(manifest)         → 設定のキーの配列
//   literalIncluded(text, key)                  → 真偽

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// 言語の上書き（"[python]" など）は設定のキーでないので外す。
const isLanguageOverride = (k) => /^\[.*\]$/.test(k);

export function settingKeysToCheck(mydistManifest, overlay) {
  const out = [];
  const seen = new Set();
  const push = (key, from) => {
    if (typeof key !== "string" || key === "" || isLanguageOverride(key) || seen.has(key)) return;
    seen.add(key);
    out.push({ key, from });
  };
  const defaults = isPlainObject(mydistManifest) && isPlainObject(mydistManifest.contributes) ? mydistManifest.contributes.configurationDefaults : null;
  if (isPlainObject(defaults)) for (const k of Object.keys(defaults)) push(k, "mydist");
  const scd = isPlainObject(overlay) && isPlainObject(overlay.set) ? overlay.set.shukoConfigurationDefaults : null;
  if (isPlainObject(scd)) for (const k of Object.keys(scd)) push(k, "shukoConfigurationDefaults");
  return out;
}

// 当てた単位が消した設定（checks.absentSettings）を、mydist の configurationDefaults から外す（2026-11-14 リーダーの判断）。
// 単位を有効にすると、その設定の登録が無くなり、既定だけが残る（registeredKeys が fail になる）ため。
// 入力を書き換えない。返り値 { manifest, removed: [{ key, unit }] }（removed は configurationDefaults の順）。
// "[python]" のような言語の上書きの中は見ない（トップレベルのキーだけ）。
export function pruneConfigurationDefaults(manifest, units) {
  const m = isPlainObject(manifest) ? JSON.parse(JSON.stringify(manifest)) : {};
  const defaults = isPlainObject(m.contributes) && isPlainObject(m.contributes.configurationDefaults) ? m.contributes.configurationDefaults : null;
  const removed = [];
  if (!defaults) return { manifest: m, removed };
  const owner = new Map();
  for (const u of Array.isArray(units) ? units : []) {
    const list = isPlainObject(u) && isPlainObject(u.checks) && Array.isArray(u.checks.absentSettings) ? u.checks.absentSettings : [];
    for (const k of list) if (typeof k === "string" && !owner.has(k)) owner.set(k, u.id);
  }
  for (const k of Object.keys(defaults)) {
    if (owner.has(k)) {
      delete defaults[k];
      removed.push({ key: k, unit: owner.get(k) });
    }
  }
  return { manifest: m, removed };
}

export function configurationPropertyKeys(manifest) {
  const c = isPlainObject(manifest) && isPlainObject(manifest.contributes) ? manifest.contributes.configuration : null;
  const blocks = Array.isArray(c) ? c : isPlainObject(c) ? [c] : [];
  const out = [];
  for (const b of blocks) if (isPlainObject(b) && isPlainObject(b.properties)) out.push(...Object.keys(b.properties));
  return out;
}

export function literalIncluded(text, key) {
  if (typeof text !== "string" || typeof key !== "string" || key === "") return false;
  return text.includes(`'${key}'`) || text.includes(`"${key}"`) || text.includes("`" + key + "`");
}

// ---- 設定の登録の形で見つける（2026-11-14 リーダーの指示。文字列の有無だけでは、登録を消した後に残った読み手の文字列で
// 「在る」と誤る。例 B-7 の後の terminal.integrated.suggest.enabled） ----
//
// 本家の設定の登録は、registerConfiguration などに渡す properties のオブジェクトのキーで書かれる。キーの書き方は3通り:
//   'key': { ... }                       文字列のキー
//   [CONST]: ... / [Enum.Member]: ...    計算されたキー（CONST・Enum.Member が 'key' に定まる）
// ここでは、設定の登録の型・関数の名前を含むファイル（isConfigurationFile）の中のこの形のキーだけを「登録」とみなす。
// 計算されたキーは、同じ src の中の const・enum のメンバー・static readonly の定義をたどって（別名も5段まで）文字列に直す。
//
// テストの入口:
//   isConfigurationFile(text)            → 真偽
//   extractSettingDefinitions(text)      → [{ name, literal } | { name, ref }]
//   extractRegistrationKeys(text)        → [{ literal } | { ref }]（isConfigurationFile が偽なら空）
//   resolveRegisteredSettingKeys(files)  → Map<キー, 登録のあるファイルの配列>（files は [{ file, definitions, registrations }]）

const CONFIG_FILE_HINTS = /registerConfiguration|IConfigurationPropertySchema|IConfigurationNode\b|ConfigurationScope\./;
export function isConfigurationFile(text) {
  return typeof text === "string" && CONFIG_FILE_HINTS.test(text);
}

const IDENT = "[A-Za-z_$][\\w$]*";
const DOTTED = `${IDENT}(?:\\.${IDENT})*`;

// 'x' か "x"（${} の無い `x` も）の文字列なら中身、そうでなければ null。
function stringLiteral(expr) {
  const m = /^(['"`])([^'"`\\\n]*)\1$/.exec(expr.trim());
  if (!m || (m[1] === "`" && m[2].includes("${"))) return null;
  return m[2];
}

// 値の式を定義に直す。文字列なら literal、識別子（ドット区切り）なら ref、ほかは null。
function toDefinition(name, expr) {
  const lit = stringLiteral(expr);
  if (lit !== null) return { name, literal: lit };
  const e = expr.trim();
  if (new RegExp(`^${DOTTED}$`).test(e)) return { name, ref: e };
  return null;
}

// 開きの { の位置から、対応する } の位置（見つからなければ文字列の終わり）。文字列とコメントは簡単に飛ばす。
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") {
      const q = c;
      i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return text.length;
}

export function extractSettingDefinitions(text) {
  if (typeof text !== "string") return [];
  const out = [];
  // const NAME = 'x'; / const NAME: T = Other.Member;
  const constRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*(?::[^=;\\n]+)?=\\s*([^;\\n]+?)\\s*;`, "g");
  for (const m of text.matchAll(constRe)) {
    const d = toDefinition(m[1], m[2]);
    if (d) out.push(d);
  }
  // enum Name { A = 'x', B = Other.Member }
  const enumRe = new RegExp(`\\benum\\s+(${IDENT})\\s*\\{`, "g");
  for (const m of text.matchAll(enumRe)) {
    const open = m.index + m[0].length - 1;
    const body = text.slice(open + 1, matchBrace(text, open));
    for (const line of body.split(/\r?\n/)) {
      const mm = new RegExp(`^\\s*(${IDENT})\\s*=\\s*(.+?)\\s*,?\\s*(?://.*)?$`).exec(line);
      if (!mm) continue;
      const d = toDefinition(`${m[1]}.${mm[1]}`, mm[2]);
      if (d) out.push(d);
    }
  }
  // class Name { static readonly A = 'x' }
  const classRe = new RegExp(`\\bclass\\s+(${IDENT})[^{]*\\{`, "g");
  for (const m of text.matchAll(classRe)) {
    const open = m.index + m[0].length - 1;
    const body = text.slice(open + 1, matchBrace(text, open));
    const sr = new RegExp(`static\\s+readonly\\s+(${IDENT})\\s*(?::[^=;\\n]+)?=\\s*([^;\\n]+?)\\s*;`, "g");
    for (const mm of body.matchAll(sr)) {
      const d = toDefinition(`${m[1]}.${mm[1]}`, mm[2]);
      if (d) out.push(d);
    }
  }
  return out;
}

// 値が文字列・数・真偽・null で始まるキーは、登録でなく既定の値の表（configurationDefaults など）とみなして数えない。
const NOT_SCHEMA_VALUE = /^\s*(?:['"`\d-]|true\b|false\b|null\b|undefined\b)/;

export function extractRegistrationKeys(text) {
  if (!isConfigurationFile(text)) return [];
  const out = [];
  const litRe = /(['"])([A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+)+)\1\s*:/g;
  for (const m of text.matchAll(litRe)) {
    if (NOT_SCHEMA_VALUE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 20))) continue;
    out.push({ literal: m[2] });
  }
  const refRe = new RegExp(`\\[\\s*(${DOTTED})\\s*\\]\\s*:`, "g");
  for (const m of text.matchAll(refRe)) {
    if (NOT_SCHEMA_VALUE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 20))) continue;
    out.push({ ref: m[1] });
  }
  return out;
}

export function resolveRegisteredSettingKeys(files) {
  const defs = new Map();
  for (const f of Array.isArray(files) ? files : []) {
    for (const d of f.definitions || []) {
      if (!defs.has(d.name)) defs.set(d.name, []);
      defs.get(d.name).push(d);
    }
  }
  const resolve = (name, depth = 0, seen = new Set()) => {
    if (depth > 5 || seen.has(name)) return [];
    seen.add(name);
    const out = [];
    for (const d of defs.get(name) || []) {
      if (d.literal !== undefined) out.push(d.literal);
      else if (d.ref) out.push(...resolve(d.ref, depth + 1, seen));
    }
    return out;
  };
  const registered = new Map();
  const add = (key, file) => {
    if (!registered.has(key)) registered.set(key, []);
    if (!registered.get(key).includes(file)) registered.get(key).push(file);
  };
  for (const f of Array.isArray(files) ? files : []) {
    for (const r of f.registrations || []) {
      if (r.literal !== undefined) add(r.literal, f.file);
      else for (const k of resolve(r.ref)) add(k, f.file);
    }
  }
  return registered;
}
