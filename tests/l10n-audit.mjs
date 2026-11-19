// 日本語の未訳を数える網（独立の数え方）。
// 仕様: docs/04-bundled-extensions.md の7節（合格の条件は「除外の外の未訳 0」。対象は本体と組み込み拡張）。
// 数え方は本家と同じ引き方に合わせる:
//   本体  : out/nls.keys.json の [moduleId, keys[]] を順に引き、言語パックの
//           translations/main.i18n.json の contents[moduleId][key] が空でなければ「訳がある」
//           （src/vs/base/node/nls.ts の resolveNLSConfiguration と同じ。無ければ英語のまま）。
//   拡張 package : extensions/<名前>/package.nls.json の鍵を、言語パックの contents.package[key] で引く。
//           拡張の ID は package.json の publisher.name。パックのどのファイルかは、パックの package.json の
//           contributes.localizations[ja].translations（id -> path）で引く（本体が実際に引く対応）。
//           パックの package.json が見つかれば、その一覧に無い拡張は「パックに無い」と数える（名前では探さない）。
//           パックの package.json が見つからないとき（translations/ だけを渡したとき）だけ、<ID>.i18n.json の名前で探す。
//   拡張 bundle  : 拡張のコードの vscode.l10n.t(...) の英語を、--worktree の拡張のソースから独立に拾う
//           （build/lib/i18n.ts の createL10nBundleForExtension と同じ範囲: {src,client,server}/**/*.{ts,tsx}、
//            依存の @vscode/*・vscode-* の JS、bundle.l10n.json。@vscode/l10n-dev の問い合わせと同じ形だけを拾う）。
//           パックの contents.bundle[鍵] で引く。鍵は英語の文言か「文言/コメントをつないだもの」。
//           蒙恬の台本（scripts/l10n-ja.mjs）の count・extract には頼らない。--worktree が無ければ bundle は数えない。
//   自前の拡張の直書き（literal）: mydist・notion-sync・language-pack-ja の package.json に直に書いた表示の文字列
//           （%key% でないもの）。日本語（かな・漢字・全角）を含めば訳がある、と数える。
// 蒙恬の台本・出力には頼らない。標準の部品だけで書く。
//
// 使い方:
//   node tests/l10n-audit.mjs [--app <resources/app>] [--pack <言語パック>] [--worktree <作業ツリー>]
//                             [--exclude <除外の一覧.json>] [--clp <clp/<id>.ja>] [--out <出力.json>]
//                             [--strict] [--require-bundle]
//   --app  既定: %LOCALAPPDATA%\Programs\Sukuna\versions\1.146.0-1\resources\app
//   --pack 既定: <リポジトリ>\extensions-src\language-pack-ja（拡張のルート。package.json の translations で引く）
//          拡張のルート（package.json がある）、translations/ そのもの、dist/translations のどれでもよい。
//   --worktree  bundle の英語を拾う作業ツリー（extensions/<名前>/ のソースがある所）。
//   --exclude  何度でも書ける（重ねて読む）。
//   --literals auto|app|src  自前の拡張の直書きを読む場所。auto（既定）は、出力に language-pack-ja がある版は出力の写し、無い古い版は extensions-src。
//   --clp  任意。本体が実際に作った nls.messages.json と、この台本が作った結果が同じかも確かめる。
//   --strict 除外の外の未訳が 1 件以上なら終了コード 1。
//   --require-bundle  bundle を数えられなかったとき（--worktree が無い）は不合格にする。
// 除外の一覧（JSON。配列か { "exclusions": [...] }）の要素:
//   { "module": "...", "key": "...", "en": "...", "reason": "..." }                  本体の鍵
//   { "extension": "vscode.git", "section": "package|bundle|literal", "key": "...", "en": "...", "reason": "..." }
//                                                                                   拡張の鍵（section を省くと package）
//   { "messageRegex": "^[A-Z0-9_ -]+$", "reason": "..." }       文言（英語）が正規表現に合うもの（本体・拡張とも。任意の scope: "core"|"extensions"）
//   "module#key" の文字列も可。reason は必須（無い要素は誤りとして数えず、invalidExclusions に出す）。
//   en があれば今の英語と比べ、違えば除外を効かせず staleExclusions に出す（英語が変わったら見直す）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
export const DEFAULT_PACK = path.join(REPO, 'extensions-src', 'language-pack-ja');
export const OWN_EXTENSION_FOLDERS = ['mydist', 'notion-sync', 'language-pack-ja'];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const JA_RE = /[぀-ヿ㐀-鿿！-｠　-〿]/;
export const hasJapaneseChar = (s) => JA_RE.test(String(s));

// 英字の並びで粗く数える（リーダーの数え方）: 日本語（かな・漢字・全角記号）を含まず、英字 3 字以上の並びがある。
export function looksEnglishOnly(msg) {
  if (typeof msg !== 'string') return false;
  if (/[　-ヿ㐀-鿿＀-￯]/.test(msg)) return false;
  return /[A-Za-z]{3,}/.test(msg);
}

const SECTION_NAMES = ['package', 'bundle', 'literal'];

// file は 1 つのパスか、パスの配列（重ねて読む）。
export function loadExclusions(file) {
  const out = { items: [], invalid: [] };
  if (!file) return out;
  if (Array.isArray(file)) {
    for (const f of file) { const r = loadExclusions(f); out.items.push(...r.items); out.invalid.push(...r.invalid); }
    return out;
  }
  const raw = readJson(file);
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.exclusions) ? raw.exclusions : [];
  for (const e of list) {
    if (typeof e === 'string') {
      const i = e.indexOf('#');
      if (i > 0) out.items.push({ module: e.slice(0, i), key: e.slice(i + 1), reason: '(string form)' });
      else out.invalid.push(e);
      continue;
    }
    if (!e || typeof e !== 'object' || !nonEmpty(e.reason)) { out.invalid.push(e); continue; }
    const item = { ...e };
    if (nonEmpty(e.messageRegex)) {
      try { item.re = new RegExp(e.messageRegex); } catch { out.invalid.push(e); continue; }
    } else if (!(nonEmpty(e.key) && (nonEmpty(e.module) || nonEmpty(e.extension)))) { out.invalid.push(e); continue; }
    else if (nonEmpty(e.extension) && e.section !== undefined && !SECTION_NAMES.includes(e.section)) { out.invalid.push(e); continue; }
    else if (e.en !== undefined && typeof e.en !== 'string') { out.invalid.push(e); continue; }
    out.items.push(item);
  }
  return out;
}

// 除外を引く道具。鍵の除外は、記録した英語（en）が今の英語と同じときだけ効く（en が無い項目は英語を問わない）。
function makeExcluder(items) {
  const coreKeys = new Map();
  const extKeys = new Map();
  const regexes = [];
  for (const e of items) {
    if (e.re) regexes.push(e);
    else if (e.extension) extKeys.set(`${e.extension}\u0000${e.section ?? 'package'}\u0000${e.key}`, e);
    else coreKeys.set(`${e.module}\u0000${e.key}`, e);
  }
  const stale = [];
  const seen = new Set();
  const noteStale = (id, where, e, msg) => {
    if (seen.has(id)) return;
    seen.add(id);
    stale.push({ ...where, recordedEn: e.en, en: msg });
  };
  return {
    stale,
    core: (module, key, msg) => {
      const e = coreKeys.get(`${module}\u0000${key}`);
      if (e) {
        if (e.en === undefined || e.en === msg) return true;
        noteStale(`c\u0000${module}\u0000${key}`, { module, key }, e, msg);
      }
      return regexes.some((r) => (!r.scope || r.scope === 'core') && r.re.test(msg));
    },
    ext: (id, section, key, msg) => {
      const e = extKeys.get(`${id}\u0000${section}\u0000${key}`);
      if (e) {
        if (e.en === undefined || e.en === msg) return true;
        noteStale(`e\u0000${id}\u0000${section}\u0000${key}`, { extension: id, section, key }, e, msg);
      }
      return regexes.some((r) => (!r.scope || r.scope === 'extensions') && r.re.test(msg));
    },
  };
}

// ---- パックの場所 -------------------------------------------------------------------------------------------------
// packDir から translations/ の場所と、パックの package.json（あれば）を決める。
// package.json は packDir・その親・その親の親の順に探し、contributes.localizations を持つ最初のものを使う
// （拡張のルート、dist/translations、translations/ のどれを渡してもよい）。
export function resolvePack(packDir) {
  const cands = [packDir, path.dirname(packDir), path.dirname(path.dirname(packDir))];
  let manifest = null;
  let root = null;
  for (const c of cands) {
    const pj = path.join(c, 'package.json');
    if (!isFile(pj)) continue;
    let j;
    try { j = readJson(pj); } catch { continue; }
    if (Array.isArray(j?.contributes?.localizations) && j.contributes.localizations.length) { manifest = j; root = c; break; }
  }
  const out = { tdir: null, manifestPath: null, idToPath: null, missingTranslationFiles: [], languageId: null };
  if (manifest) {
    const locs = manifest.contributes.localizations;
    const loc = locs.find((l) => l.languageId === 'ja') ?? locs[0];
    out.manifestPath = path.join(root, 'package.json');
    out.languageId = loc.languageId ?? null;
    out.idToPath = {};
    for (const t of loc.translations ?? []) {
      if (!t.id || !t.path) continue;
      const p = path.resolve(root, t.path);
      out.idToPath[t.id] = p;
      if (!isFile(p)) out.missingTranslationFiles.push({ id: t.id, path: p });
    }
    const main = out.idToPath.vscode;
    if (!main) throw new Error(`言語パックの package.json に vscode の translations が無い: ${out.manifestPath}`);
    if (!isFile(main)) throw new Error(`言語パックの vscode の translations が指すファイルが無い: ${main}`);
    out.tdir = path.dirname(main);
    out.mainFile = main;
    return out;
  }
  // package.json が見つからない: translations/ の名前の決まりで探す
  if (isFile(path.join(packDir, 'main.i18n.json'))) out.tdir = packDir;
  else if (isFile(path.join(packDir, 'translations', 'main.i18n.json'))) out.tdir = path.join(packDir, 'translations');
  else throw new Error(`言語パックに main.i18n.json が見つかりません: ${packDir}`);
  out.mainFile = path.join(out.tdir, 'main.i18n.json');
  return out;
}

// ---- 数える ------------------------------------------------------------------------------------------------------
function countBlock(entries, translatedOf, excluded) {
  // entries: [{ module?, key, message }]
  const r = {
    total: 0, translated: 0, untranslated: 0, sameAsEnglish: 0, excluded: 0, untranslatedOutsideExclusions: 0,
    untranslatedKeys: [], excludedKeys: [], sameAsEnglishKeys: [], englishOnlyKeys: [],
  };
  for (const e of entries) {
    r.total++;
    const t = translatedOf(e);
    const item = e.module !== undefined ? { module: e.module, key: e.key, message: e.message } : { key: e.key, message: e.message };
    if (nonEmpty(t)) {
      r.translated++;
      if (t === e.message) { r.sameAsEnglish++; r.sameAsEnglishKeys.push(item); }
      if (looksEnglishOnly(t)) r.englishOnlyKeys.push({ ...item, translation: t });
      continue;
    }
    r.untranslated++;
    if (excluded(e)) { r.excluded++; r.excludedKeys.push(item); } else { r.untranslatedOutsideExclusions++; r.untranslatedKeys.push(item); }
  }
  return r;
}

const BLOCK_FIELDS = ['total', 'translated', 'untranslated', 'sameAsEnglish', 'excluded', 'untranslatedOutsideExclusions'];
const sumBlocks = (blocks) => Object.fromEntries(BLOCK_FIELDS.map((f) => [f, blocks.reduce((a, r) => a + r[f], 0)]));

function walkFiles(dir, accept, out = [], { skipNodeModules = true } = {}) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of names) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || (skipNodeModules && e.name === 'node_modules')) continue;
      walkFiles(p, accept, out, { skipNodeModules });
    } else if (e.isFile() && accept(p)) out.push(p);
  }
  return out;
}

// ---- bundle: vscode.l10n.t(...) の英語を、ソースから独立に拾う ----------------------------------------------------
// @vscode/l10n-dev（getL10nJson）の問い合わせと同じ形だけを拾う:
//   l10n.t("文")  /  vscode.l10n.t('文', 引数)  /  l10n.t(`文 {0}`, 引数)  /  l10n.t`文${x}`（{0} に直す）
//   l10n.t({ message: "文", comment: ["…"] })（message と comment の両方があるものだけ。鍵は 文/コメントをつないだもの）
//   最初の引数が文字列の連結や変数のものは拾わない。テンプレートに ${} を埋めた l10n.t(`..${x}..`) は、本家は例外でファイルごと捨てる
//   （skippedFiles に出す）。
function unescapeString(text) {
  for (let i = text.indexOf('\\'); i !== -1; i = text.indexOf('\\', i)) {
    if (text[i] !== '\\') { i++; continue; }
    let replace;
    let end = i + 2;
    const next = text[i + 1];
    switch (next) {
      case 'n': replace = '\n'; break;
      case 'r': replace = '\r'; break;
      case 't': replace = '\t'; break;
      case 'x': end = i + 4; replace = String.fromCodePoint(parseInt(text.slice(i + 2, end), 16)); break;
      case 'u':
        if (text[i + 2] === '{') { end = text.indexOf('}', i) + 1; replace = String.fromCodePoint(parseInt(text.slice(i + 3, end - 1), 16)); }
        else { end = i + 6; replace = String.fromCodePoint(parseInt(text.slice(i + 2, end), 16)); }
        break;
      default: replace = next; break;
    }
    text = text.slice(0, i) + replace + text.slice(end);
    i += replace.length;
  }
  return text;
}

// src[i] が ' " ` のどれかのとき、その文字列を読む。{ end, raw（引用符の中）, subs（テンプレートの ${} の中身の始まりの位置の配列） }
function readQuoted(src, i) {
  const q = src[i];
  let j = i + 1;
  const subs = [];
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === q) return { end: j + 1, raw: src.slice(i + 1, j), subs };
    if (q === '`' && c === '$' && src[j + 1] === '{') {
      // 入れ子の {} を数えて飛ばす（中の文字列は読み飛ばす）
      let depth = 1;
      const startSub = j;
      j += 2;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === "'" || d === '"' || d === '`') { j = readQuoted(src, j).end; continue; }
        if (d === '{') depth++;
        else if (d === '}') depth--;
        j++;
      }
      subs.push({ start: startSub, end: j });
      continue;
    }
    if (q !== '`' && (c === '\n')) return null; // 閉じない文字列
    j++;
  }
  return null;
}

const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };

// 引用符つきの文字列（テンプレートは ${} が無いものだけ）の値。${} があれば null。
function quotedValue(src, i) {
  const r = readQuoted(src, i);
  if (!r) return null;
  if (r.subs.length) return { end: r.end, value: null, hasSub: true };
  let raw = r.raw;
  if (src[i] === '`') raw = raw.replace(/\r\n/g, '\n');
  return { end: r.end, value: unescapeString(raw), hasSub: false };
}

// 式を、いちばん外側の , か閉じ括弧まで読み飛ばす。戻りは止まった位置。
function skipExpression(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { const r = readQuoted(src, i); if (!r) return i + 1; i = r.end; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return i; depth--; }
    else if (c === ',' && depth === 0) return i;
    i++;
  }
  return i;
}

// { message: "…", comment: "…" | ["…", …] } を読む。i は '{' の位置。
function readMessageObject(src, i) {
  let j = i + 1;
  let message;
  let comment;
  let hasSub = false;
  let last = -1;
  for (;;) {
    j = skipWs(src, j);
    if (j >= src.length) return null;
    if (src[j] === '}') break;
    if (src[j] === ',') { j++; continue; }
    if (j === last) { j++; continue; } // 進まないときは 1 字進める（閉じ括弧の食い違いなど）
    last = j;
    // キー
    let key;
    if (src[j] === "'" || src[j] === '"') { const r = readQuoted(src, j); if (!r) return null; key = r.raw; j = r.end; }
    else { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(j, j + 64)); if (!m) { j = skipExpression(src, j); continue; } key = m[0]; j += m[0].length; }
    j = skipWs(src, j);
    if (src[j] !== ':') { j = skipExpression(src, j); continue; } // 省略形 { message } など
    j = skipWs(src, j + 1);
    if (key === 'message' && (src[j] === "'" || src[j] === '"' || src[j] === '`')) {
      const v = quotedValue(src, j);
      if (!v) return null;
      if (v.hasSub) hasSub = true; else message = v.value;
      j = v.end;
    } else if (key === 'comment' && (src[j] === "'" || src[j] === '"' || src[j] === '`')) {
      const v = quotedValue(src, j);
      if (!v) return null;
      comment = v.hasSub ? [] : [v.value];
      j = v.end;
    } else if (key === 'comment' && src[j] === '[') {
      comment = [];
      j++;
      for (;;) {
        j = skipWs(src, j);
        if (j >= src.length) return null;
        if (src[j] === ']') { j++; break; }
        if (src[j] === ',') { j++; continue; }
        if (src[j] === "'" || src[j] === '"' || src[j] === '`') { const v = quotedValue(src, j); if (!v) return null; if (!v.hasSub) comment.push(v.value); j = v.end; }
        else j = skipExpression(src, j);
      }
    } else j = skipExpression(src, j);
  }
  if (hasSub) return { error: 'template-substitution' };
  if (message === undefined || comment === undefined) return { skip: true }; // 問い合わせは message と comment の両方を求める
  return { message, comment };
}

// ソース 1 つから { 鍵: 英語 } を作る。本家の呼び出しの形に合うものだけ。例外にあたる形は { error } を返す。
export function extractL10nStrings(source) {
  const out = {};
  if (!source.includes('l10n') || !source.includes('vscode')) return { record: out };
  // 別名: import * as L from '@vscode/l10n' / import { t as T } from '@vscode/l10n' / import { l10n as X } from 'vscode' / require の形
  const heads = new Set(['(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?l10n\\s*\\.\\s*t']);
  for (const m of source.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]@vscode\/l10n['"]/g)) heads.add(`${m[1]}\\s*\\.\\s*t`);
  for (const m of source.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]@vscode\/l10n['"]\s*\)/g)) heads.add(`${m[1]}\\s*\\.\\s*t`);
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:vscode|@vscode\/l10n)['"]/g)) {
    for (const part of m[1].split(',')) {
      const mm = /^\s*(l10n|t)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(part);
      if (!mm) continue;
      const local = mm[2] ?? mm[1];
      heads.add(mm[1] === 'l10n' ? `${local}\\s*\\.\\s*t` : local);
    }
  }
  const re = new RegExp(`(?<![\\w$.])(?:${[...heads].join('|')})(?![\\w$])\\s*(?=[(\`])`, 'g');
  const put = (message, comment) => {
    if (comment && comment.length) out[`${message}/${comment.join('')}`] = message;
    else out[message] = message;
  };
  let m;
  while ((m = re.exec(source))) {
    let j = m.index + m[0].length;
    if (source[j] === '`') {
      // タグ付きテンプレート: ${} を {0} {1} … に直す
      const r = readQuoted(source, j);
      if (!r) continue;
      let text = source.slice(j + 1, r.end - 1);
      const base = j + 1;
      for (let k = r.subs.length - 1; k >= 0; k--) text = text.slice(0, r.subs[k].start - base) + `{${k}}` + text.slice(r.subs[k].end - base);
      put(unescapeString(text.replace(/\r\n/g, '\n')), null);
      re.lastIndex = r.end;
      continue;
    }
    j = skipWs(source, j + 1); // '(' の次
    const c = source[j];
    if (c === "'" || c === '"' || c === '`') {
      const v = quotedValue(source, j);
      if (!v) continue;
      if (v.hasSub) return { record: {}, error: `テンプレートに \${} がある: ${source.slice(j, j + 60)}` };
      const k = skipWs(source, v.end);
      if (source[k] === ',' || source[k] === ')') put(v.value, null); // 連結（+）などは拾わない
    } else if (c === '{') {
      const o = readMessageObject(source, j);
      if (!o) continue;
      if (o.error) return { record: {}, error: `message のテンプレートに \${} がある` };
      if (o.skip) continue;
      put(o.message, o.comment);
    }
  }
  return { record: out };
}

function bundleRecordFromJson(json) {
  const out = {};
  if (!isObj(json)) return out;
  for (const [k, v] of Object.entries(json)) {
    if (typeof v === 'string') out[k] = v;
    else if (isObj(v) && typeof v.message === 'string') out[k] = v.message;
  }
  return out;
}

// 拡張 1 つの bundle の英語を作業ツリーから拾う。{ record, files, depFiles, deps, bundleFiles, skippedFiles }
export function extensionBundleStrings(wtExtRoot, folder) {
  const extDir = path.join(wtExtRoot, folder);
  const record = {};
  const skippedFiles = [];
  const files = [];
  for (const sub of ['src', 'client', 'server']) walkFiles(path.join(extDir, sub), (p) => /\.tsx?$/.test(p), files);
  const manifests = [path.join(extDir, 'package.json'), path.join(extDir, 'client', 'package.json'), path.join(extDir, 'server', 'package.json')]
    .filter(isFile).map((p) => { try { return readJson(p); } catch { return {}; } });
  // 本家の範囲は「拡張の下のどこかの node_modules/{@vscode,vscode-*}」。ここでは、拡張の dependencies・devDependencies のうち
  // @vscode/*・vscode-* を引き、見つけた依存の dependencies のうち同じ名前のものも順にたどる（pnpm の入れ子の置き方に合わせる）。
  const isL10nDep = (n) => /^(@vscode\/|vscode-)/.test(n);
  const deps = new Set();
  const queue = [];
  for (const mf of manifests) for (const sec of ['dependencies', 'devDependencies']) for (const n of Object.keys(mf[sec] ?? {})) if (isL10nDep(n) && !deps.has(n)) { deps.add(n); queue.push({ name: n, from: null }); }
  const depFiles = [];
  const bundleFiles = [];
  const seenReal = new Set();
  while (queue.length) {
    const { name: d, from } = queue.shift();
    const parts = d.split('/');
    const cands = [
      path.join(extDir, 'node_modules', ...parts), path.join(extDir, 'server', 'node_modules', ...parts), path.join(extDir, 'client', 'node_modules', ...parts),
      path.join(wtExtRoot, 'node_modules', ...parts),
    ];
    if (from) cands.unshift(path.join(from, 'node_modules', ...parts), path.join(path.dirname(from), ...parts), path.join(path.dirname(path.dirname(from)), ...parts));
    const dir = cands.find(isDir);
    if (!dir) continue;
    const real = fs.realpathSync(dir);
    if (seenReal.has(real)) continue;
    seenReal.add(real);
    walkFiles(real, (p) => /\.jsx?$/.test(p), depFiles);
    walkFiles(real, (p) => path.basename(p) === 'bundle.l10n.json', bundleFiles);
    let pj = {};
    try { pj = readJson(path.join(real, 'package.json')); } catch { /* 読めない依存は子をたどらない */ }
    for (const n of Object.keys(pj.dependencies ?? {})) if (isL10nDep(n) && !deps.has(n)) { deps.add(n); queue.push({ name: n, from: real }); }
  }
  // 拡張自身の bundle.l10n.json（l10n/ の下など。node_modules は除く）
  walkFiles(extDir, (p) => path.basename(p) === 'bundle.l10n.json', bundleFiles);
  for (const f of [...files, ...depFiles]) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!text.includes('l10n')) continue;
    const r = extractL10nStrings(text);
    if (r.error) { skippedFiles.push({ file: path.relative(extDir, f).replace(/\\/g, '/'), reason: r.error }); continue; }
    Object.assign(record, r.record);
  }
  for (const b of new Set(bundleFiles)) { try { Object.assign(record, bundleRecordFromJson(readJson(b))); } catch { /* 読めない束は無いものとする */ } }
  return { record, files: files.length, depFiles: depFiles.length, deps: [...deps].sort(), bundleFiles: new Set(bundleFiles).size, skippedFiles };
}

// ---- 自前の拡張の直書き（literal） ---------------------------------------------------------------------------------
// package.json の中の、画面に出る文字列（%key% でないもの）を、鍵の名前で拾う。{ <JSON の場所>: <文字列> }
const DISPLAY_KEYS = new Set(['displayName', 'description', 'markdownDescription', 'title', 'category', 'shortTitle', 'tooltip', 'label', 'localizedLanguageName', 'deprecationMessage', 'markdownDeprecationMessage', 'enumDescriptions', 'markdownEnumDescriptions', 'enumItemLabels']);
const SKIP_KEYS = new Set(['default', 'enum', 'when', 'command', 'scope', 'id', 'icon', 'repository', 'bugs', 'engines', 'dependencies', 'devDependencies', 'scripts', 'keybindings', 'activationEvents', 'extensionDependencies', 'languageId', 'languageName']);
export function manifestDisplayStrings(manifest) {
  const out = {};
  const isMsg = (v) => typeof v === 'string' && v !== '' && !/^%[^%]+%$/.test(v);
  const visit = (v, where, underProperties) => {
    if (Array.isArray(v)) { v.forEach((x, i) => visit(x, `${where}[${i}]`, false)); return; }
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const here = where ? `${where}.${k}` : k;
      if (!underProperties && SKIP_KEYS.has(k)) continue;
      if (!underProperties && DISPLAY_KEYS.has(k)) {
        if (isMsg(x)) out[here] = x;
        else if (Array.isArray(x)) x.forEach((y, i) => { if (isMsg(y)) out[`${here}[${i}]`] = y; });
        else if (isObj(x) && isMsg(x.value)) out[here] = x.value; // { value, original }
        continue;
      }
      // properties の下の名前は設定の鍵（description などと同じ名前でも表示の文字列ではない）
      visit(x, here, !underProperties && k === 'properties');
    }
  };
  // properties の中身（設定 1 件ごとのオブジェクト）は、通常の訪問に戻す
  const walkProps = (obj, where) => { for (const [k, x] of Object.entries(obj)) visit(x, `${where}.${k}`, false); };
  const c = manifest?.contributes;
  const rest = { ...manifest };
  delete rest.contributes;
  visit(rest, '', false);
  if (isObj(c)) {
    for (const [k, v] of Object.entries(c)) {
      if (k === 'configuration') {
        for (const [i, cf] of (Array.isArray(v) ? v : [v]).entries()) {
          if (!isObj(cf)) continue;
          const w = `contributes.configuration[${i}]`;
          const { properties, ...other } = cf;
          visit(other, w, false);
          if (isObj(properties)) walkProps(properties, `${w}.properties`);
        }
      } else visit({ [k]: v }, 'contributes', false);
    }
  }
  return out;
}

// ---- 全体 --------------------------------------------------------------------------------------------------------
export function auditL10n({ appDir, packDir = DEFAULT_PACK, excludeFile, clpDir, worktree, ownSrcDir = path.join(REPO, 'extensions-src'), requireBundle = false, literalsFrom = 'auto' }) {
  const out = path.join(appDir, 'out');
  const keysFile = readJson(path.join(out, 'nls.keys.json'));
  const messages = readJson(path.join(out, 'nls.messages.json'));
  const pack = resolvePack(packDir);
  const main = readJson(pack.mainFile);
  const contents = main.contents ?? {};
  const ex = loadExclusions(excludeFile);
  const excl = makeExcluder(ex.items);

  // 本体
  const entries = [];
  let idx = 0;
  for (const [moduleId, keys] of keysFile) {
    for (const key of keys) entries.push({ module: moduleId, key: typeof key === 'string' ? key : key.key, message: messages[idx++] });
  }
  const sizeMismatch = idx !== messages.length;
  const core = countBlock(entries, (e) => contents[e.module]?.[e.key], (e) => excl.core(e.module, e.key, e.message));
  core.keysVsMessagesMismatch = sizeMismatch;
  const effective = entries.map((e) => contents[e.module]?.[e.key] || e.message);
  const rough = {
    effectiveEnglishOnly: effective.filter(looksEnglishOnly).length,
    defaultEnglishOnly: messages.filter(looksEnglishOnly).length,
    note: '日本語（かな・漢字・全角記号）を含まず、英字3字以上の並びを持つ文言の数（リーダーの粗い数えと同じ）。English が正しい文言も含む。',
  };
  const clp = clpDir ? compareClp(clpDir, effective) : null;

  // 組み込み拡張
  const extRoot = path.join(appDir, 'extensions');
  const extensions = {};
  const bundleExt = {};
  const noNls = [];
  const bundleNotes = { skippedFiles: {}, sources: {} };
  const wtExtRoot = worktree ? path.join(worktree, 'extensions') : null;
  if (worktree && !isDir(wtExtRoot)) throw new Error(`--worktree に extensions/ が無い: ${worktree}`);
  const packFileOf = (id) => {
    if (pack.idToPath) return pack.idToPath[id] ?? null; // パックの package.json に載っている拡張だけ（本体が実際に引く対応）
    return path.join(pack.tdir, 'extensions', `${id}.i18n.json`);
  };
  const readPackExt = (id) => {
    const file = packFileOf(id);
    if (file && isFile(file)) { const j = readJson(file); return { has: true, pkg: j.contents?.package ?? {}, bundle: j.contents?.bundle ?? {} }; }
    return { has: false, pkg: {}, bundle: {} };
  };
  const idOf = (dir, d) => { const pj = readJson(path.join(dir, 'package.json')); return `${pj.publisher ?? ''}.${pj.name ?? d}`; };
  for (const d of fs.readdirSync(extRoot).sort()) {
    const dir = path.join(extRoot, d);
    if (!isDir(dir) || !isFile(path.join(dir, 'package.json'))) continue;
    let id;
    try { id = idOf(dir, d); } catch { continue; }
    const own = OWN_EXTENSION_FOLDERS.includes(d);
    const pk = readPackExt(id);
    const nlsFile = path.join(dir, 'package.nls.json');
    if (isFile(nlsFile)) {
      const nls = readJson(nlsFile);
      const items = Object.entries(nls).map(([key, v]) => ({ key, message: typeof v === 'string' ? v : v?.message ?? '' }));
      const r = countBlock(items, (e) => pk.pkg[e.key], (e) => excl.ext(id, 'package', e.key, e.message));
      r.dir = d;
      r.hasPackFile = pk.has;
      extensions[id] = r;
    } else noNls.push({ id, dir: d });
    // bundle（自前の拡張は直書きで数える）
    if (wtExtRoot && !own && isDir(path.join(wtExtRoot, d))) {
      const b = extensionBundleStrings(wtExtRoot, d);
      const items = Object.entries(b.record).map(([key, message]) => ({ key, message }));
      if (items.length) {
        const r = countBlock(items, (e) => pk.bundle[e.key], (e) => excl.ext(id, 'bundle', e.key, e.message));
        r.dir = d;
        r.hasPackFile = pk.has;
        r.source = { files: b.files, depFiles: b.depFiles, deps: b.deps, bundleFiles: b.bundleFiles };
        // 拾い漏れの目安: パックの bundle にあって、この台本が拾わなかった鍵の数（多いときは拾い方を疑う）
        r.packOnlyKeys = Object.keys(pk.bundle).filter((k) => !(k in b.record)).length;
        if (r.packOnlyKeys) r.packOnlyKeysSample = Object.keys(pk.bundle).filter((k) => !(k in b.record)).slice(0, 10);
        bundleExt[id] = r;
      }
      if (b.skippedFiles.length) bundleNotes.skippedFiles[id] = b.skippedFiles;
    }
  }
  const extTotals = sumBlocks(Object.values(extensions));
  const bundleCounted = Boolean(wtExtRoot);
  const bundleTotals = sumBlocks(Object.values(bundleExt));

  // 自前の拡張の直書き
  const literals = { counted: true, perExtension: {}, totals: null };
  const litBlocks = [];
  for (const d of OWN_EXTENSION_FOLDERS) {
    const inApp = path.join(extRoot, d, 'package.json');
    const inSrc = path.join(ownSrcDir, d, 'package.json');
    // literals: 'auto'（既定）= 出力に language-pack-ja がある版（日本語パック入りのビルド）は出力の写しを、無い古い版は extensions-src を読む。
    // 'app' = 出力の写し、'src' = extensions-src（次のビルドが写すもの）。
    const useApp = literalsFrom === 'app' || (literalsFrom === 'auto' && isFile(path.join(extRoot, 'language-pack-ja', 'package.json')));
    const file = useApp ? (isFile(inApp) ? inApp : null) : isFile(inSrc) ? inSrc : isFile(inApp) ? inApp : null;
    if (!file) continue;
    const mf = readJson(file);
    const id = `${mf.publisher ?? ''}.${mf.name ?? d}`;
    const items = Object.entries(manifestDisplayStrings(mf)).map(([key, message]) => ({ key, message }));
    const r = countBlock(items, (e) => (hasJapaneseChar(e.message) ? e.message : undefined), (e) => excl.ext(id, 'literal', e.key, e.message));
    r.dir = d;
    r.manifest = file === inApp ? 'app' : 'extensions-src';
    literals.perExtension[id] = r;
    litBlocks.push(r);
  }
  literals.totals = sumBlocks(litBlocks);

  const outside = core.untranslatedOutsideExclusions + extTotals.untranslatedOutsideExclusions + bundleTotals.untranslatedOutsideExclusions + literals.totals.untranslatedOutsideExclusions;
  const bundleOk = !requireBundle || bundleCounted;
  return {
    tool: 'tests/l10n-audit.mjs',
    inputs: {
      appDir, packDir, packManifest: pack.manifestPath, packTranslationsDir: pack.tdir, worktree: worktree ?? null,
      excludeFile: excludeFile ?? null, clpDir: clpDir ?? null, packVersion: main.version ?? null,
    },
    counting: '本家と同じ引き方: 本体は contents[moduleId][key]、拡張は contents.package[key]・contents.bundle[key]。空・無しは未訳（英語のまま）。直書きは日本語を含めば訳あり。',
    core,
    roughEnglishOnly: rough,
    clpCrossCheck: clp,
    extensions,
    extensionsTotals: extTotals,
    extensionsWithoutNlsFile: noNls,
    bundle: { counted: bundleCounted, perExtension: bundleExt, totals: bundleTotals, skippedFiles: bundleNotes.skippedFiles },
    literals,
    packMissingTranslationFiles: pack.missingTranslationFiles,
    invalidExclusions: ex.invalid,
    staleExclusions: excl.stale,
    totals: {
      untranslatedOutsideExclusions: outside,
      untranslated: core.untranslated + extTotals.untranslated + bundleTotals.untranslated + literals.totals.untranslated,
      excluded: core.excluded + extTotals.excluded + bundleTotals.excluded + literals.totals.excluded,
      sameAsEnglish: core.sameAsEnglish + extTotals.sameAsEnglish + bundleTotals.sameAsEnglish,
    },
    pass: outside === 0 && ex.invalid.length === 0 && !sizeMismatch && bundleOk && pack.missingTranslationFiles.length === 0,
  };
}

function compareClp(dir, effective) {
  let file = path.join(dir, 'nls.messages.json');
  if (!isFile(file) && isDir(dir)) {
    for (const d of fs.readdirSync(dir)) if (isFile(path.join(dir, d, 'nls.messages.json'))) { file = path.join(dir, d, 'nls.messages.json'); break; }
  }
  if (!isFile(file)) return { found: false };
  const actual = readJson(file);
  let diff = 0;
  const firstDiffs = [];
  for (let i = 0; i < Math.max(actual.length, effective.length); i++) {
    if (actual[i] !== effective[i]) { diff++; if (firstDiffs.length < 5) firstDiffs.push(i); }
  }
  return { found: true, file, actualLength: actual.length, ourLength: effective.length, differing: diff, firstDifferingIndexes: firstDiffs, roughEnglishOnlyInActual: actual.filter(looksEnglishOnly).length };
}

function main(argv) {
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') opt.strict = true;
    else if (a === '--require-bundle') opt.requireBundle = true;
    else if (a === '--exclude' && i + 1 < argv.length) (opt.exclude ||= []).push(argv[++i]);
    else if (a === '--literals' && i + 1 < argv.length) { opt.literals = argv[++i]; if (!['auto', 'app', 'src'].includes(opt.literals)) { console.error(`--literals は auto・app・src のどれか: ${opt.literals}`); return 2; } }
    else if (['--app', '--pack', '--clp', '--out', '--worktree'].includes(a) && i + 1 < argv.length) opt[a.slice(2)] = argv[++i];
    else { console.error(`不明な引数: ${a}`); return 2; }
  }
  const local = process.env.LOCALAPPDATA ?? '';
  const appDir = opt.app ?? path.join(local, 'Programs', 'Sukuna', 'versions', '1.146.0-1', 'resources', 'app');
  const packDir = opt.pack ?? DEFAULT_PACK;
  let res;
  try {
    res = auditL10n({ appDir, packDir, excludeFile: opt.exclude, clpDir: opt.clp, worktree: opt.worktree, requireBundle: opt.requireBundle, literalsFrom: opt.literals ?? 'auto' });
  } catch (e) { console.error(String(e.message ?? e)); return 2; }
  const json = JSON.stringify(res, null, 2) + '\n';
  if (opt.out) { fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(opt.out, json); }
  const line = (label, c) => console.log(`${label}: 総数 ${c.total} / 訳あり ${c.translated} / 未訳 ${c.untranslated}（除外 ${c.excluded}、除外の外 ${c.untranslatedOutsideExclusions}）、原文と同じ訳 ${c.sameAsEnglish}`);
  line('本体', res.core);
  line('拡張 package', res.extensionsTotals);
  if (res.bundle.counted) line('拡張 bundle', res.bundle.totals); else console.log('拡張 bundle: 数えていない（--worktree が無い）');
  line('自前の直書き', res.literals.totals);
  console.log(`粗い数え（英字のみの文言）: 本体の結果 ${res.roughEnglishOnly.effectiveEnglishOnly} / 元の英語 ${res.roughEnglishOnly.defaultEnglishOnly}`);
  if (res.staleExclusions.length) console.log(`英語が変わった除外: ${res.staleExclusions.length} 件（効かせていない）`);
  if (res.clpCrossCheck) console.log(`clp との照合: ${JSON.stringify(res.clpCrossCheck)}`);
  console.log(res.pass ? '合格（除外の外の未訳 0）' : `不合格: 除外の外の未訳 ${res.totals.untranslatedOutsideExclusions}`);
  if (!opt.out) console.log('（--out で詳しい JSON を書き出す）');
  return opt.strict && !res.pass ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
