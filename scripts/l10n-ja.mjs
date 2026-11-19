#!/usr/bin/env node
// 日本語の言語パック（組み込み拡張 extensions-src/language-pack-ja）を作る・数える（docs/04 の7節。
// 調べと作り方は tasks/2026-11-17-l10n-ja/l10n-design.md）。
//
// 使い方（リポジトリの直下で）:
//   node scripts/l10n-ja.mjs fetch [--update-lock] [--build-root <dir>]
//       sources.json の公式の訳（vscode-loc の固定の commit、Open VSX の VSIX）を <buildRoot>\cache\l10n\ に取り、
//       SHA-256 を sources.json の値と照合する（違えば止める）。--update-lock は照合せずに値を書き込む（版を上げるとき）。
//   node scripts/l10n-ja.mjs extract --app <resources\app> --worktree <作業ツリー> --out <file>
//       ビルドの英語の文言の表を作る。本体は <app>\out\nls.keys.json・nls.messages.json、組み込み拡張は
//       <app>\extensions\<名前>\package.nls.json と、作業ツリーのソースの vscode.l10n.t の文言（@vscode/l10n-dev の getL10nJson。
//       本家の build/lib/i18n.ts の createL10nBundleForExtension と同じ引き方）。ソースの \uXXXX は、渡す前に実行時と同じ文字に直す
//       （decodeUnicodeEscapes。l10n-dev 0.0.35 は4桁を3桁で読む）。直して鍵が変わったものは bundleDetail.<ID>.escapeFixes に出す。
//   node scripts/l10n-ja.mjs todo --strings <file> [--out <file>]
//       公式の訳にも足した訳にも除外にも無い文言の一覧（訳す仕事の一覧）。
//   node scripts/l10n-ja.mjs add --strings <file> --input <file> --version <本体の版>
//       訳と除外の入力（{ translate: { "<owner>#<key>": "<訳>" }, exclude: { "<owner>#<key>": { reason, note } } }）を、
//       文言の表の英語といっしょに added/<版>.json と exclusions.json に書く（英語を手で写さないため）。
//   node scripts/l10n-ja.mjs build [--strings <file>] [--out <file>]
//       extensions-src/language-pack-ja/dist/ に言語パックを書き、package.json の translations を合わせる。
//       --strings があれば、その鍵だけを入れ、数えた結果（count と同じ）も出す。
//   node scripts/l10n-ja.mjs count --strings <file> [--pack <dist の場所>] [--out <file>]
//       作ったパックの未訳を数える（除外の外の未訳が 0 なら終了コード 0、あれば 5）。
//       あわせて、リポジトリの added/*.json の印（{0}・&&・$(...)・Markdown のリンクの先。数まで）を英語と照らし、
//       合わないものを placeholderProblems に出す（1つでもあれば終了コード 1、result は "placeholder"）。
//
// 終了コード: 0 = ok、1 = 誤り（count では印の不一致も）、2 = SHA-256 の不一致、5 = 除外の外の未訳がある（count・build --strings）

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";
import { getJson, download, sha256File } from "./lib/http.mjs";
import { readEntry, listEntries } from "./lib/zip-read.mjs";
import {
  coreFromNls, recordFromL10nJson, recordFromPackageNls, countStrings, buildPack, coverage, manifestLiterals,
  validateExclusions, validateAdded, placeholderMismatch, i18nFile, extensionContents, flattenStrings, SECTIONS,
  decodeUnicodeEscapes, thirdPartyNotice,
} from "./lib/l10n-ja.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");
export const PACK_SRC = path.join(REPO, "extensions-src", "language-pack-ja");
export const PACK_ID = "sukuna.language-pack-ja";

// ---------------------------------------------------------------------------
// 小さな道具
// ---------------------------------------------------------------------------

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
}
function writeJsonFile(p, v, { tabs = false } = {}) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(v, null, tabs ? "\t" : 2)}\n`, "utf8");
}
function sha256Text(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function parseArgs(argv, spec) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (!x.startsWith("--")) { a._.push(x); continue; }
    const name = x.slice(2);
    if (!(name in spec)) throw new Error(`知らない引数: ${x}`);
    if (spec[name] === "flag") a[name] = true;
    else {
      if (i + 1 >= argv.length) throw new Error(`${x} に値が無い`);
      a[name] = argv[++i];
    }
  }
  return a;
}

export function loadSourcesConfig(file = path.join(PACK_SRC, "sources.json")) {
  const cfg = readJson(file);
  if (!Array.isArray(cfg.sources) || !cfg.sources.length) throw new Error(`${file}: sources が無い`);
  for (const s of cfg.sources) {
    if (!s.name || !/^[a-z0-9.-]+$/.test(s.name)) throw new Error(`sources の name の形が違う: ${s.name}`);
    if (s.kind === "vscode-loc") {
      if (!/^[0-9a-f]{40}$/.test(s.commit || "")) throw new Error(`${s.name}: commit が40桁でない`);
    } else if (s.kind === "vsix") {
      if (!s.download || !/^[0-9a-f]{64}$/.test(s.sha256 || "")) throw new Error(`${s.name}: download か sha256 が無い`);
    } else throw new Error(`${s.name}: kind ${s.kind} を知らない`);
  }
  return cfg;
}

function cacheRoot(a) {
  const cfg = resolveLocalConfig({ overrides: { buildRoot: a["build-root"] || undefined } });
  return path.join(cfg.buildRoot, "cache", "l10n");
}
// 短い名前にする（この PC は長いパスが無効。docs/02 の2節）
export function sourceCacheDir(root, s) {
  return path.join(root, s.kind === "vscode-loc" ? `vl-${s.commit.slice(0, 12)}` : `vsix-${s.sha256.slice(0, 12)}`);
}

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

const LOC_PREFIX = "i18n/vscode-language-pack-ja/";

async function fetchVscodeLoc(s, dir, update) {
  const tree = await getJson(`https://api.github.com/repos/${s.repo}/git/trees/${s.commit}?recursive=1`, { headers: { Accept: "application/vnd.github+json" } });
  if (tree.truncated) throw new Error(`${s.name}: tree が切れている`);
  const wanted = tree.tree
    .filter((e) => e.type === "blob" && (e.path === "LICENSE.md" || (e.path.startsWith(LOC_PREFIX) && (e.path.startsWith(`${LOC_PREFIX}translations/`) || e.path === `${LOC_PREFIX}package.json`))))
    .map((e) => e.path)
    .sort();
  if (!wanted.includes(`${LOC_PREFIX}translations/main.i18n.json`)) throw new Error(`${s.name}: main.i18n.json が無い`);
  const files = {};
  const problems = [];
  for (const p of wanted) {
    const rel = p.startsWith(LOC_PREFIX) ? p.slice(LOC_PREFIX.length) : p;
    const dest = path.join(dir, ...rel.split("/"));
    const got = await download(`https://raw.githubusercontent.com/${s.repo}/${s.commit}/${p}`, dest, { skipIfExists: true });
    files[rel] = got.sha256;
    if (!update) {
      const want = s.files && s.files[rel];
      if (!want) problems.push(`${rel}: sources.json に値が無い`);
      else if (want !== got.sha256) problems.push(`${rel}: SHA-256 が違う`);
    }
  }
  if (!update && s.files) for (const rel of Object.keys(s.files)) if (!(rel in files)) problems.push(`${rel}: commit に無い`);
  return { files, problems };
}

async function fetchVsix(s, dir) {
  const file = path.join(dir, path.basename(new URL(s.download).pathname));
  const got = await download(s.download, file, { skipIfExists: true });
  const problems = got.sha256 === s.sha256 ? [] : [`${path.basename(file)}: SHA-256 が違う（${got.sha256}）`];
  return { file, problems };
}

async function cmdFetch(argv) {
  const a = parseArgs(argv, { "update-lock": "flag", "build-root": "value" });
  const cfgPath = path.join(PACK_SRC, "sources.json");
  const cfg = loadSourcesConfig(cfgPath);
  const root = cacheRoot(a);
  const res = { cache: root, sources: [] };
  let bad = false;
  for (const s of cfg.sources) {
    const dir = sourceCacheDir(root, s);
    if (s.kind === "vscode-loc") {
      const r = await fetchVscodeLoc(s, dir, !!a["update-lock"]);
      if (a["update-lock"]) s.files = r.files;
      res.sources.push({ name: s.name, dir, files: Object.keys(r.files).length, problems: r.problems });
      if (r.problems.length) bad = true;
    } else {
      const r = await fetchVsix(s, dir);
      res.sources.push({ name: s.name, dir, file: r.file, problems: r.problems });
      if (r.problems.length) bad = true;
    }
  }
  if (a["update-lock"]) writeJsonFile(cfgPath, cfg);
  res.result = bad ? "sha256-mismatch" : "ok";
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  process.exit(bad ? 2 : 0);
}

// ---------------------------------------------------------------------------
// 公式の訳の層を読む
// ---------------------------------------------------------------------------

// 言語パックの形（translations/main.i18n.json と translations/extensions/<ID>.i18n.json）から層を作る。
// readFile(rel) は translations の下の相対パスの中身（文字列）か null を返す。
export function layerFromPackFiles(name, relFiles, readFile) {
  const layer = { name, core: {}, extensions: {} };
  const main = readFile("translations/main.i18n.json");
  if (main === null) throw new Error(`${name}: main.i18n.json が無い`);
  layer.core = JSON.parse(main.replace(/^﻿/, "")).contents || {};
  for (const rel of relFiles) {
    const m = /^translations\/extensions\/(.+)\.i18n\.json$/.exec(rel);
    if (!m) continue;
    const c = JSON.parse(readFile(rel).replace(/^﻿/, "")).contents || {};
    layer.extensions[m[1]] = { package: c.package || {}, bundle: c.bundle || {} };
  }
  return layer;
}

export function loadLayers(root, cfg) {
  const layers = [];
  for (const s of cfg.sources) {
    const dir = sourceCacheDir(root, s);
    if (s.kind === "vscode-loc") {
      const rels = Object.keys(s.files || {});
      if (!fs.existsSync(path.join(dir, "translations", "main.i18n.json"))) throw new Error(`${s.name} を取っていない（node scripts/l10n-ja.mjs fetch）`);
      layers.push(layerFromPackFiles(s.name, rels, (rel) => {
        const p = path.join(dir, ...rel.split("/"));
        return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      }));
    } else {
      const file = path.join(dir, path.basename(new URL(s.download).pathname));
      if (!fs.existsSync(file)) throw new Error(`${s.name} を取っていない（node scripts/l10n-ja.mjs fetch）`);
      const buf = fs.readFileSync(file);
      const rels = listEntries(buf).map((e) => e.name).filter((n) => n.startsWith("extension/translations/")).map((n) => n.slice("extension/".length));
      layers.push(layerFromPackFiles(s.name, rels, (rel) => {
        const b = readEntry(buf, `extension/${rel}`);
        return b ? b.toString("utf8") : null;
      }));
    }
  }
  return layers;
}

// ---------------------------------------------------------------------------
// extract（ビルドの英語の文言の表）
// ---------------------------------------------------------------------------

function walk(dir, pred, out = [], { skipNodeModules = false } = {}) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipNodeModules && e.name === "node_modules") continue;
      walk(p, pred, out, { skipNodeModules });
    } else if (e.isFile() && pred(p)) out.push(p);
  }
  return out;
}

// 拡張の依存のうち、本家が束に含める名前（@vscode/* と vscode-*。i18n.ts の node_modules/{@vscode,vscode-*}）。
export function l10nDependencyNames(manifests) {
  const names = new Set();
  for (const m of manifests) {
    for (const sec of ["dependencies"]) {
      for (const n of Object.keys((m && m[sec]) || {})) if (/^(@vscode\/|vscode-)/.test(n)) names.add(n);
    }
  }
  return [...names].sort();
}

async function extensionBundle(getL10nJson, wtExtDir, folder) {
  const extDir = path.join(wtExtDir, folder);
  const files = [];
  for (const sub of ["src", "client", "server"]) {
    walk(path.join(extDir, sub), (p) => /\.tsx?$/.test(p) && !/\.d\.ts$/.test(p), files, { skipNodeModules: true });
  }
  // 依存（pnpm で extensions/node_modules に持ち上げられている。1.146.0 の形）
  const manifests = [path.join(extDir, "package.json"), path.join(extDir, "client", "package.json"), path.join(extDir, "server", "package.json")]
    .filter((p) => fs.existsSync(p))
    .map(readJson);
  const deps = l10nDependencyNames(manifests);
  const depFiles = [];
  const bundles = [];
  for (const d of deps) {
    const cands = [path.join(extDir, "node_modules", ...d.split("/")), path.join(extDir, "server", "node_modules", ...d.split("/")), path.join(wtExtDir, "node_modules", ...d.split("/"))];
    const dir = cands.find((c) => fs.existsSync(c));
    if (!dir) continue;
    const real = fs.realpathSync(dir);
    walk(real, (p) => /\.jsx?$/.test(p), depFiles, { skipNodeModules: true });
    walk(real, (p) => path.basename(p) === "bundle.l10n.json", bundles, { skipNodeModules: true });
  }
  const record = {};
  const inputs = [];
  for (const f of [...files, ...depFiles]) {
    const raw = fs.readFileSync(f, "utf8");
    inputs.push({ file: f, raw, contents: decodeUnicodeEscapes(raw), extension: path.extname(f) });
  }
  // \uXXXX を実行時と同じ文字に直したことで鍵が変わったもの（l10n-dev がそのまま読んだときの鍵 → 実行時の鍵）
  const escapeFixes = [];
  // 1ファイルずつ（本家も1ファイルずつ渡してから JSON を合わせる）
  for (const inp of inputs) {
    let json;
    try {
      json = await getL10nJson([{ contents: inp.contents, extension: inp.extension }]);
    } catch {
      continue; // 読めないファイル（本家は止めるが、依存の JS の一部は tree-sitter が読めないことがある）
    }
    const rec = recordFromL10nJson(json);
    Object.assign(record, rec);
    if (inp.contents !== inp.raw) {
      let rawRec = null;
      try {
        rawRec = recordFromL10nJson(await getL10nJson([{ contents: inp.raw, extension: inp.extension }]));
      } catch {
        rawRec = null;
      }
      if (rawRec) {
        const asRead = Object.keys(rawRec).filter((k) => !Object.hasOwn(rec, k));
        const runtime = Object.keys(rec).filter((k) => !Object.hasOwn(rawRec, k));
        if (asRead.length || runtime.length) escapeFixes.push({ file: path.relative(wtExtDir, inp.file).split(path.sep).join("/"), asRead, runtime });
      }
    }
  }
  for (const b of bundles) Object.assign(record, recordFromL10nJson(readJson(b)));
  return { record, files: files.length, depFiles: depFiles.length, deps, bundles: bundles.length, escapeFixes };
}

const OWN_FOLDERS = new Set(["mydist", "notion-sync", "language-pack-ja"]);

async function cmdExtract(argv) {
  const a = parseArgs(argv, { app: "value", worktree: "value", out: "value", label: "value" });
  if (!a.app || !a.out) throw new Error("--app と --out が要る");
  const app = path.resolve(a.app);
  const keys = readJson(path.join(app, "out", "nls.keys.json"));
  const messages = readJson(path.join(app, "out", "nls.messages.json"));
  const strings = { label: a.label || null, app, worktree: a.worktree ? path.resolve(a.worktree) : null, createdAt: new Date().toISOString(), core: coreFromNls(keys, messages), extensions: {} };
  let getL10nJson = null;
  if (a.worktree) {
    const req = createRequire(path.join(path.resolve(a.worktree), "package.json"));
    const mod = await import(pathToFileURL(req.resolve("@vscode/l10n-dev")).href);
    getL10nJson = mod.getL10nJson || (mod.default && mod.default.getL10nJson);
    if (typeof getL10nJson !== "function") throw new Error("@vscode/l10n-dev の getL10nJson が見つからない");
  }
  const extRoot = path.join(app, "extensions");
  const detail = {};
  // 自前の組み込み拡張は extensions-src の今の中身（次のビルドで apply.mjs が写すもの）を読む。ビルドの中の写しは見ない
  const ownSrc = path.join(REPO, "extensions-src");
  const folders = [
    ...fs.readdirSync(extRoot).filter((f) => !OWN_FOLDERS.has(f)).map((f) => ({ folder: f, dir: path.join(extRoot, f), own: false })),
    ...[...OWN_FOLDERS].filter((f) => fs.existsSync(path.join(ownSrc, f, "package.json"))).map((f) => ({ folder: f, dir: path.join(ownSrc, f), own: true })),
  ].sort((x, y) => (x.folder < y.folder ? -1 : x.folder > y.folder ? 1 : 0));
  for (const { folder, dir, own } of folders) {
    const pj = path.join(dir, "package.json");
    if (!fs.existsSync(pj)) continue;
    const m = readJson(pj);
    const id = `${m.publisher}.${m.name}`;
    const e = { folder, own, package: {}, bundle: {} };
    const nls = path.join(dir, "package.nls.json");
    if (fs.existsSync(nls)) e.package = recordFromPackageNls(readJson(nls));
    if (own) e.literal = manifestLiterals(m);
    if (getL10nJson && !e.own) {
      const wtExt = path.join(path.resolve(a.worktree), "extensions");
      if (fs.existsSync(path.join(wtExt, folder))) {
        const b = await extensionBundle(getL10nJson, wtExt, folder);
        e.bundle = b.record;
        detail[id] = { files: b.files, depFiles: b.depFiles, deps: b.deps, bundles: b.bundles, bundleKeys: Object.keys(b.record).length };
        if (b.escapeFixes.length) detail[id].escapeFixes = b.escapeFixes;
      }
    }
    strings.extensions[id] = e;
  }
  strings.count = countStrings(strings);
  strings.bundleDetail = detail;
  writeJsonFile(path.resolve(a.out), strings);
  const { perExtension, ...countHead } = strings.count;
  process.stdout.write(`${JSON.stringify({ out: path.resolve(a.out), count: countHead }, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// 足した訳と除外を読む
// ---------------------------------------------------------------------------

export function loadAdded(dir = path.join(PACK_SRC, "added")) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => /^\d+\.\d+\.\d+\.json$/.test(f));
  const cmp = (x, y) => {
    const p = (s) => s.replace(/\.json$/, "").split(".").map(Number);
    const [a1, b1] = [p(x), p(y)];
    for (let i = 0; i < 3; i++) if (a1[i] !== b1[i]) return a1[i] - b1[i];
    return 0;
  };
  const out = [];
  for (const f of files.sort(cmp)) {
    const v = readJson(path.join(dir, f));
    const errs = validateAdded(v);
    if (errs.length) throw new Error(`${f}: ${errs.slice(0, 5).join(" / ")}`);
    if (`${v.version}.json` !== f) throw new Error(`${f}: version ${v.version} がファイルの名前と違う`);
    out.push(v);
  }
  return out;
}

export function loadExclusions(file = path.join(PACK_SRC, "exclusions.json")) {
  if (!fs.existsSync(file)) return { reasons: {}, exclusions: [] };
  const v = readJson(file);
  const errs = validateExclusions(v);
  if (errs.length) throw new Error(`exclusions.json: ${errs.slice(0, 5).join(" / ")}`);
  return v;
}

// 足した訳の置き換えの印の検査
function addedPlaceholderProblems(added) {
  const out = [];
  for (const a of added) {
    for (const [mod, m] of Object.entries(a.core || {})) for (const [k, v] of Object.entries(m)) {
      const mm = placeholderMismatch(v.en, v.ja);
      if (mm) out.push({ version: a.version, area: "core", owner: mod, key: k, ...mm });
    }
    for (const [id, e] of Object.entries(a.extensions || {})) for (const sec of SECTIONS) for (const [k, v] of Object.entries(e[sec] || {})) {
      const mm = placeholderMismatch(v.en, v.ja);
      if (mm) out.push({ version: a.version, area: sec, owner: id, key: k, ...mm });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// todo / build / count
// ---------------------------------------------------------------------------

async function cmdTodo(argv) {
  const a = parseArgs(argv, { strings: "value", out: "value", "build-root": "value" });
  if (!a.strings) throw new Error("--strings が要る");
  const strings = readJson(path.resolve(a.strings));
  const cfg = loadSourcesConfig();
  const layers = loadLayers(cacheRoot(a), cfg);
  const added = loadAdded();
  const ex = loadExclusions();
  const { pack, provenance, staleAdded, redundantAdded } = buildPack({ strings, layers, added });
  const cov = coverage({ strings, pack, exclusions: ex });
  // 訳の元ごとに、それだけで何件を訳しているか（ほかの層と重なる分も数える）
  const perSource = {};
  for (const layer of layers) {
    const c = coverage({ strings, pack: buildPack({ strings, layers: [layer] }).pack });
    perSource[layer.name] = { translated: c.translated, core: c.byArea.core.translated, package: c.byArea.package.translated, bundle: c.byArea.bundle.translated };
  }
  const { perExtension, ...countHead } = countStrings(strings);
  const res = {
    count: countHead,
    perSource,
    byArea: cov.byArea,
    provenance,
    excluded: cov.excluded,
    untranslated: cov.untranslated,
    staleAdded,
    redundantAdded: redundantAdded.length,
    staleExclusions: cov.staleExclusions,
    todo: cov.untranslatedList,
  };
  if (a.out) writeJsonFile(path.resolve(a.out), res);
  const { todo, ...head } = res;
  process.stdout.write(`${JSON.stringify(head, null, 2)}\n`);
}

// package.json の translations（vscode と、パックに訳のある拡張の ID）
export function translationsList(pack) {
  const ids = Object.keys(pack.extensions || {}).filter((id) => {
    const e = pack.extensions[id];
    return Object.keys(e.package || {}).length + Object.keys(e.bundle || {}).length > 0;
  }).sort();
  return [
    { id: "vscode", path: "./dist/translations/main.i18n.json" },
    ...ids.map((id) => ({ id, path: `./dist/translations/extensions/${id}.i18n.json` })),
  ];
}

function writePack(pack, distDir) {
  if (fs.existsSync(distDir)) fs.rmSync(path.join(distDir, "translations"), { recursive: true, force: true });
  const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const coreSorted = sortObj(Object.fromEntries(Object.entries(pack.core).map(([m, v]) => [m, sortObj(v)])));
  writeJsonFile(path.join(distDir, "translations", "main.i18n.json"), i18nFile(coreSorted), { tabs: true });
  for (const [id, e] of Object.entries(pack.extensions)) {
    const c = extensionContents(e);
    if (!Object.keys(c.package).length && !Object.keys(c.bundle).length) continue;
    writeJsonFile(path.join(distDir, "translations", "extensions", `${id}.i18n.json`), i18nFile({ package: sortObj(c.package), bundle: sortObj(c.bundle) }), { tabs: true });
  }
}

function summarizeCoverage(cov) {
  return {
    total: cov.total, translated: cov.translated, excluded: cov.excluded, untranslated: cov.untranslated,
    notJapanese: cov.notJapanese, byArea: cov.byArea, staleExclusions: cov.staleExclusions,
    untranslatedSample: cov.untranslatedList.slice(0, 50),
    perOwner: cov.perOwner,
  };
}

async function cmdBuild(argv) {
  const a = parseArgs(argv, { strings: "value", out: "value", "build-root": "value" });
  const strings = a.strings ? readJson(path.resolve(a.strings)) : null;
  const cfg = loadSourcesConfig();
  const layers = loadLayers(cacheRoot(a), cfg);
  const added = loadAdded();
  const ex = loadExclusions();
  const ph = addedPlaceholderProblems(added);
  if (ph.length) throw new Error(`足した訳の置き換えの印が英語と合わない: ${ph.slice(0, 5).map((x) => `${x.owner} ${x.key}`).join(" / ")}`);
  // パックの中身は、公式の層の鍵を全部と足した訳（文言の表には頼らない。dist は sources.json と added/ だけで決まる）。
  // 表に無い鍵（消した機能の文言など）は本体が引かないだけで害は無く、bundle の読み落としがあっても公式の訳が残る。
  const { pack, provenance } = buildPack({ strings: null, layers, added });
  // 表があれば、表の鍵で、足した訳の英語の変化（staleAdded）と、公式と重なる足した訳（redundantAdded）を見る
  const chk = strings ? buildPack({ strings, layers, added }) : { staleAdded: [], redundantAdded: [], provenance: null };
  const staleAdded = chk.staleAdded;
  const redundantAdded = chk.redundantAdded;
  // 英語が変わった足した訳はパックに入れない（訳し直すまで英語に戻す）
  for (const s of staleAdded) {
    if (s.area === "core") delete pack.core[s.owner]?.[s.key];
    else delete pack.extensions[s.owner]?.[s.area]?.[s.key];
  }
  const distDir = path.join(PACK_SRC, "dist");
  writePack(pack, distDir);
  // 第三者の表示。訳の元をすべて（下の層も）出典に書き、vscode-loc の LICENSE.md（MIT）をそのまま写す（thirdPartyNotice）
  const licenses = cfg.sources.filter((s) => s.kind === "vscode-loc").map((s) => {
    const buf = fs.readFileSync(path.join(sourceCacheDir(cacheRoot(a), s), "LICENSE.md"));
    return { sha256: createHash("sha256").update(buf).digest("hex"), text: buf.toString("utf8") };
  });
  if (licenses.length) fs.writeFileSync(path.join(PACK_SRC, "ThirdPartyNotices.txt"), thirdPartyNotice(cfg.sources, licenses), "utf8");
  // package.json の translations と版を合わせる
  const pjPath = path.join(PACK_SRC, "package.json");
  const pj = readJson(pjPath);
  pj.contributes.localizations[0].translations = translationsList(pack);
  writeJsonFile(pjPath, pj);
  const res = {
    dist: distDir,
    packKeys: provenance,
    provenanceForStrings: chk.provenance,
    staleAdded,
    redundantAdded: redundantAdded.length,
    translations: pj.contributes.localizations[0].translations.length,
  };
  let code = 0;
  if (strings) {
    const cov = coverage({ strings, pack, exclusions: ex });
    res.coverage = summarizeCoverage(cov);
    if (cov.untranslated > 0 || staleAdded.length) code = 5;
  }
  res.result = code === 0 ? "ok" : "untranslated";
  if (a.out) writeJsonFile(path.resolve(a.out), res);
  const { coverage: c, ...head } = res;
  process.stdout.write(`${JSON.stringify(c ? { ...head, coverage: { ...c, perOwner: undefined } } : head, null, 2)}\n`);
  process.exit(code);
}

// 作ったパック（dist）を読む。package.json の translations の場所から読む（本体と同じ引き方）。
export function readBuiltPack(extDir) {
  const pj = readJson(path.join(extDir, "package.json"));
  const loc = (pj.contributes?.localizations || []).find((l) => l.languageId === "ja");
  if (!loc) throw new Error(`${extDir}: ja の localizations が無い`);
  const pack = { core: {}, extensions: {} };
  for (const t of loc.translations) {
    const c = readJson(path.join(extDir, t.path)).contents || {};
    if (t.id === "vscode") pack.core = c;
    else pack.extensions[t.id] = { package: c.package || {}, bundle: c.bundle || {} };
  }
  return pack;
}

async function cmdCount(argv) {
  const a = parseArgs(argv, { strings: "value", pack: "value", out: "value" });
  if (!a.strings) throw new Error("--strings が要る");
  const strings = readJson(path.resolve(a.strings));
  const pack = readBuiltPack(a.pack ? path.resolve(a.pack) : PACK_SRC);
  const ex = loadExclusions();
  const cov = coverage({ strings, pack, exclusions: ex });
  // リポジトリの足した訳（added/*.json）の印の照らし（build と同じ。パックを作り直さずに確かめるため）
  const placeholderProblems = addedPlaceholderProblems(loadAdded());
  const res = { strings: path.resolve(a.strings), pack: a.pack ? path.resolve(a.pack) : PACK_SRC, ...summarizeCoverage(cov), placeholderProblems, untranslatedList: cov.untranslatedList };
  res.result = placeholderProblems.length ? "placeholder" : cov.untranslated === 0 ? "ok" : "untranslated";
  if (a.out) writeJsonFile(path.resolve(a.out), res);
  const { untranslatedList, perOwner, ...head } = res;
  process.stdout.write(`${JSON.stringify(head, null, 2)}\n`);
  process.exit(placeholderProblems.length ? 1 : cov.untranslated === 0 ? 0 : 5);
}

// ---------------------------------------------------------------------------
// add（訳と除外を、文言の表の英語といっしょにリポジトリに書く）
// ---------------------------------------------------------------------------

// 入力 { translate: { "<owner>#<key>": "<訳>" }, exclude: { "<owner>#<key>": { reason, note? } } } を、文言の表で引いて
// 場所（area）と英語を決める。owner は本体なら moduleId、拡張なら ID。見つからない・2つ以上に当たるなら誤り。
export function resolveInput(strings, input) {
  const index = new Map();
  for (const t of flattenStrings(strings)) {
    const id = `${t.owner}#${t.key}`;
    (index.get(id) || index.set(id, []).get(id)).push(t);
  }
  const errors = [];
  const pick = (id) => {
    const hits = index.get(id) || [];
    if (hits.length !== 1) errors.push(`${id}: 文言の表で ${hits.length} 件に当たる`);
    return hits.length === 1 ? hits[0] : null;
  };
  const translate = [];
  for (const [kind, list] of [["translate", input.translate], ["override", input.override]]) {
    for (const [id, ja] of Object.entries(list || {})) {
      const t = pick(id);
      if (!t) continue;
      if (t.area === "literal") { errors.push(`${id}: 自前の拡張の直書きは訳を足せない（package.json を日本語で書く）`); continue; }
      if (typeof ja !== "string" || ja === "") { errors.push(`${id}: 訳が空`); continue; }
      const mm = placeholderMismatch(t.en, ja);
      if (mm) errors.push(`${id}: 置き換えの印が合わない（無い ${mm.missing.join(",")} / 余分 ${mm.extra.join(",")}）`);
      translate.push({ ...t, ja, override: kind === "override" });
    }
  }
  const exclude = [];
  for (const [id, v] of Object.entries(input.exclude || {})) {
    const t = pick(id);
    if (!t) continue;
    exclude.push({ ...t, reason: v.reason, note: v.note });
  }
  return { translate, exclude, errors };
}

function sortTree(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = k === "en" || k === "ja" || k === "override" ? o[k] : sortTree(o[k]);
  return out;
}

async function cmdAdd(argv) {
  const a = parseArgs(argv, { strings: "value", input: "value", version: "value" });
  if (!a.strings || !a.input || !a.version) throw new Error("--strings・--input・--version が要る");
  if (!/^\d+\.\d+\.\d+$/.test(a.version)) throw new Error(`--version の形が違う: ${a.version}`);
  const strings = readJson(path.resolve(a.strings));
  const input = readJson(path.resolve(a.input));
  const r = resolveInput(strings, input);
  if (r.errors.length) throw new Error(`入力の誤り:\n  ${r.errors.join("\n  ")}`);
  // 足した訳
  const addedPath = path.join(PACK_SRC, "added", `${a.version}.json`);
  const added = fs.existsSync(addedPath) ? readJson(addedPath) : { version: a.version, core: {}, extensions: {} };
  added.$comment = `課が足した訳（本体 ${a.version} で、公式の訳に無い文言と、override: true は公式の訳が英語のままの文言）。鍵はモジュールと鍵（本体）か拡張の ID と package・bundle の鍵。en は訳したときの英語（変われば訳し直す）。作るのは node scripts/l10n-ja.mjs add`;
  for (const t of r.translate) {
    const v = t.override ? { en: t.en, ja: t.ja, override: true } : { en: t.en, ja: t.ja };
    if (t.area === "core") ((added.core ||= {})[t.owner] ||= {})[t.key] = v;
    else (((added.extensions ||= {})[t.owner] ||= {})[t.area] ||= {})[t.key] = v;
  }
  const { $comment, version, ...rest } = added;
  writeJsonFile(addedPath, { $comment, version, ...sortTree(rest) });
  // 除外
  const exPath = path.join(PACK_SRC, "exclusions.json");
  const ex = readJson(exPath);
  const keyOf = (e) => (typeof e.module === "string" ? `core\u0000${e.module}\u0000${e.key}` : `${e.section}\u0000${e.extension}\u0000${e.key}`);
  const map = new Map(ex.exclusions.map((e) => [keyOf(e), e]));
  for (const t of r.exclude) {
    const e = t.area === "core"
      ? { module: t.owner, key: t.key, en: t.en, reason: t.reason, since: a.version }
      : { extension: t.owner, section: t.area, key: t.key, en: t.en, reason: t.reason, since: a.version };
    if (t.note) e.note = t.note;
    map.set(keyOf(e), e);
  }
  ex.exclusions = [...map.values()].sort((x, y) => (keyOf(x) < keyOf(y) ? -1 : keyOf(x) > keyOf(y) ? 1 : 0));
  const errs = validateExclusions(ex);
  if (errs.length) throw new Error(`除外の誤り: ${errs.slice(0, 5).join(" / ")}`);
  writeJsonFile(exPath, ex);
  process.stdout.write(`${JSON.stringify({ added: addedPath, translated: r.translate.length, exclusions: exPath, excluded: r.exclude.length, exclusionsTotal: ex.exclusions.length }, null, 2)}\n`);
}

// ---------------------------------------------------------------------------

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "fetch": return cmdFetch(rest);
    case "extract": return cmdExtract(rest);
    case "todo": return cmdTodo(rest);
    case "build": return cmdBuild(rest);
    case "count": return cmdCount(rest);
    case "add": return cmdAdd(rest);
    default:
      throw new Error("使い方: node scripts/l10n-ja.mjs fetch|extract|todo|build|count ...（先頭の説明）");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
