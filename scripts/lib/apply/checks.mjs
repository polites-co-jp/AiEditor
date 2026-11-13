// 適用後の検査（docs/03 の6節、docs/06 の4節の4）。作業ツリーと git を読む。書き込むのは checkLockfiles の差分のファイルだけ。
// 判定の規則は純粋な部品（classify.mjs・keys.mjs・lockfile.mjs）に置き、ここは集めて当てはめる。
//
// 入口（build.mjs などから呼ぶ）:
//   checkRemnants(worktree, appliedUnits)
//   checkAbsentStrings(worktree, appliedUnits)
//   checkUnclassifiedExtensions(worktree, baseRef, keepJson, allUnits)
//   checkUpstreamAdditions(worktree, prevRef, baseRef)
//   checkDependencies(worktree, prevRef, baseRef)
//   checkToolchain(worktree, prevRef, baseRef)
//   checkRegisteredKeys({ worktree, baseProduct, overlay, mydistManifest, lock, manifestsDir })
//   checkLockfiles({ worktree, baseRef, units, diffOut })   ← 依存の導入の後に build.mjs が呼ぶ（docs/03 の5.4）

import fs from "node:fs";
import path from "node:path";
import { git, showFile, listTree } from "./git.mjs";
import { walkFiles, isTextLike } from "./tree.mjs";
import { normalizeRelPath, isUnderPath } from "./units.mjs";
import { findUnclassifiedExtensions, diffNameLists, addedImportLines, addedDependencies, highlightWords } from "./classify.mjs";
import {
  settingKeysToCheck,
  configurationPropertyKeys,
  literalIncluded,
  extractSettingDefinitions,
  extractRegistrationKeys,
  resolveRegisteredSettingKeys,
} from "./keys.mjs";
import { parsePnpmLock, compareLockfile, expectedLockRemovals } from "./lockfile.mjs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_HITS = 20;

function readIfText(root, rel) {
  if (!isTextLike(rel)) return null;
  const p = path.join(root, ...rel.split("/"));
  try {
    if (fs.statSync(p).size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// 消え残り: 当てた単位の delete のパスがまだあるか。
export function checkRemnants(worktree, appliedUnits) {
  const items = [];
  for (const u of appliedUnits) {
    for (const d of u.delete || []) {
      const n = normalizeRelPath(d);
      if (n && fs.existsSync(path.join(worktree, ...n.split("/")))) items.push({ unit: u.id, path: n });
    }
  }
  return { status: items.length ? "fail" : "ok", items };
}

// 参照の残り: 当てた単位の checks.absentStrings の text が、in（既定 src・build）の下にあるか。kept のパスの下は除く。
export function checkAbsentStrings(worktree, appliedUnits) {
  const needles = [];
  for (const u of appliedUnits) {
    const kept = (u.kept || []).map((k) => normalizeRelPath(k && k.path)).filter(Boolean);
    for (const a of (u.checks && u.checks.absentStrings) || []) {
      const dirs = (Array.isArray(a.in) && a.in.length ? a.in : ["src", "build"]).map(normalizeRelPath).filter(Boolean);
      needles.push({ unit: u.id, text: a.text, in: dirs, kept, hits: [], hitCount: 0 });
    }
  }
  if (!needles.length) return { status: "ok", items: [] };
  const dirs = [...new Set(needles.flatMap((n) => n.in))];
  // 重なったフォルダは上のほうだけを歩く
  const roots = dirs.filter((d) => !dirs.some((o) => o !== d && isUnderPath(d, o)));
  for (const r of roots) {
    for (const rel of walkFiles(worktree, r)) {
      const relevant = needles.filter((n) => n.in.some((d) => isUnderPath(rel, d)) && !n.kept.some((k) => isUnderPath(rel, k)));
      if (!relevant.length) continue;
      const text = readIfText(worktree, rel);
      if (text === null) continue;
      for (const n of relevant) {
        if (!text.includes(n.text)) continue;
        const lines = text.split(/\r?\n/);
        lines.forEach((l, i) => {
          if (l.includes(n.text)) {
            n.hitCount++;
            if (n.hits.length < MAX_HITS) n.hits.push({ file: rel, line: i + 1 });
          }
        });
      }
    }
  }
  const items = needles.map(({ unit, text, in: inDirs, hits, hitCount }) => ({ unit, text, in: inDirs, hitCount, hits }));
  return { status: items.some((i) => i.hitCount > 0) ? "fail" : "ok", items };
}

// baseRef の時点の extensions/* のうち package.json のあるフォルダの名前と、無いフォルダの名前。
export function upstreamExtensionNames(worktree, baseRef) {
  const r = git(worktree, ["ls-tree", "-r", "--name-only", baseRef, "extensions/"]);
  if (r.status !== 0) throw new Error(`git ls-tree ${baseRef} extensions/ が失敗: ${r.stderr.trim()}`);
  const names = new Set();
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = /^extensions\/([^/]+)\/package\.json$/.exec(line);
    if (m) names.add(m[1]);
  }
  const dirs = listTree(worktree, baseRef, "extensions", { dirsOnly: true }) || [];
  return { names: [...names].sort(), nonExtensionDirs: dirs.filter((d) => !names.has(d)).sort() };
}

// 未分類の組み込み拡張（止めずに保留。docs/06 の4節の4）。
export function checkUnclassifiedExtensions(worktree, baseRef, keepJson, allUnits) {
  const { names, nonExtensionDirs } = upstreamExtensionNames(worktree, baseRef);
  const items = findUnclassifiedExtensions(names, keepJson, allUnits);
  return { status: items.length ? "hold" : "ok", upstreamCount: names.length, items, nonExtensionDirs };
}

export const MAIN_FILES = [
  ["src/vs/workbench", /^workbench\..+\.main\.ts$/],
  ["src/vs/sessions", /^sessions\..+\.main\.ts$/],
];

const ADDITION_DIRS = ["src/vs/workbench/contrib", "src/vs/workbench/services", "src/vs/platform", "extensions"];

// 本家が足した部品（前のタグとの比べ）。
export function checkUpstreamAdditions(worktree, prevRef, baseRef) {
  if (!prevRef) return { status: "skipped", reason: "--prev-tag が無い" };
  const folders = [];
  for (const d of ADDITION_DIRS) {
    const prev = listTree(worktree, prevRef, d, { dirsOnly: true }) || [];
    const next = listTree(worktree, baseRef, d, { dirsOnly: true }) || [];
    for (const name of diffNameLists(prev, next).added) folders.push({ path: `${d}/${name}`, highlight: highlightWords(name) });
  }
  const imports = [];
  // workbench.*.main.ts（common・desktop・web）と、sessions.*.main.ts（1.146.0 では sessions の main も workbench の contrib を
  // import する。docs/03 の6節、2026-11-14 リーダーの判断）
  const mains = [];
  for (const [dir, re] of MAIN_FILES) {
    for (const f of listTree(worktree, baseRef, dir) || []) if (re.test(f)) mains.push(`${dir}/${f}`);
  }
  for (const rel of mains) {
    const prevText = showFile(worktree, prevRef, rel) || "";
    const nextText = showFile(worktree, baseRef, rel) || "";
    for (const line of addedImportLines(prevText, nextText)) imports.push({ file: rel, line, highlight: highlightWords(line) });
  }
  return { status: "info", prevTag: prevRef, folders, imports, highlighted: [...folders, ...imports].filter((x) => x.highlight.length).length };
}

// ルートの package.json に増えた依存。
export function checkDependencies(worktree, prevRef, baseRef) {
  if (!prevRef) return { status: "skipped", reason: "--prev-tag が無い" };
  const parse = (t) => {
    try {
      return t ? JSON.parse(t) : {};
    } catch {
      return {};
    }
  };
  const prev = parse(showFile(worktree, prevRef, "package.json"));
  const next = parse(showFile(worktree, baseRef, "package.json"));
  const added = addedDependencies(prev, next).map((d) => ({ ...d, highlight: highlightWords(d.name) }));
  return { status: "info", added };
}

// .nvmrc と Electron の版（package.json の nativeBuild.target）の変化。
export function checkToolchain(worktree, prevRef, baseRef) {
  const read = (ref) => {
    const nvmrc = (showFile(worktree, ref, ".nvmrc") || "").trim() || null;
    let electron = null;
    let electronFrom = null;
    try {
      const pkg = JSON.parse(showFile(worktree, ref, "package.json") || "{}");
      electron = (pkg.nativeBuild && pkg.nativeBuild.target) || null;
      if (electron) electronFrom = "package.json nativeBuild.target";
    } catch {}
    if (!electron) {
      // 古い版は .npmrc の target="..." に置いていた
      const m = /^\s*target\s*=\s*"?([^"\r\n]+)"?/m.exec(showFile(worktree, ref, ".npmrc") || "");
      if (m) {
        electron = m[1].trim();
        electronFrom = ".npmrc target";
      }
    }
    return { nvmrc, electron, electronFrom };
  };
  const now = read(baseRef);
  if (!prevRef) {
    return { status: "info", nvmrc: { prev: null, now: now.nvmrc, changed: null }, electron: { prev: null, now: now.electron, changed: null }, reason: "--prev-tag が無い" };
  }
  const prev = read(prevRef);
  return {
    status: "info",
    nvmrc: { prev: prev.nvmrc, now: now.nvmrc, changed: prev.nvmrc !== now.nvmrc },
    electron: { prev: prev.electron, now: now.electron, changed: prev.electron !== now.electron, prevFrom: prev.electronFrom, nowFrom: now.electronFrom },
  };
}

// 登録の確かめでは試験のファイルを数えない（試験だけが名前を持っていても、登録されているとはいえない）。
export const isTestPath = (rel) => /(^|\/)(test|tests|fixtures)\//.test(rel) || /\.test\.ts$/.test(rel);

function wordRegExp(key) {
  return new RegExp(`(^|[^A-Za-z0-9_$])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_$]|$)`);
}

// lock-fetch.mjs の置き方（<dir>/<id>-<版>[@<target>]/package.json）で、台帳の拡張の manifest を読む。
export function readLockManifests(lock, manifestsDir) {
  const found = [];
  const missing = [];
  for (const e of Array.isArray(lock) ? lock : []) {
    const name = `${e.id}-${e.version}${e.targetPlatform ? "@" + e.targetPlatform : ""}`;
    const p = manifestsDir ? path.join(manifestsDir, name, "package.json") : null;
    let manifest = null;
    if (p && fs.existsSync(p)) {
      try {
        manifest = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {}
    }
    if (manifest) found.push({ id: e.id, manifest });
    else missing.push(e.id);
  }
  return { found, missing };
}

// overlay の set のキーと、mydist の既定・shukoConfigurationDefaults の設定のキーが、本家で登録されているか。
export function checkRegisteredKeys({ worktree, baseProduct, overlay, mydistManifest, lock, manifestsDir }) {
  // product.json のキー
  const product = [];
  const setKeys = overlay && overlay.set && typeof overlay.set === "object" ? Object.keys(overlay.set) : [];
  const pending = [];
  for (const key of setKeys) {
    if (baseProduct && Object.prototype.hasOwnProperty.call(baseProduct, key)) product.push({ key, status: "upstream", foundIn: "product.json" });
    else pending.push(key);
  }
  if (pending.length) {
    const left = new Set(pending);
    const found = new Map();
    const scan = (dir, filter) => {
      for (const rel of walkFiles(worktree, dir)) {
        if (!left.size) return;
        if (!filter(rel)) continue;
        const text = readIfText(worktree, rel);
        if (text === null) continue;
        for (const k of [...left]) {
          if (wordRegExp(k).test(text)) {
            found.set(k, rel);
            left.delete(k);
          }
        }
      }
    };
    scan("src/vs/base/common/product.ts", () => true);
    scan("build", (rel) => /\.(ts|js|mjs|cjs|json)$/.test(rel) && !isTestPath(rel));
    scan("src/vs", (rel) => rel.endsWith(".ts") && !isTestPath(rel));
    for (const key of pending) product.push(found.has(key) ? { key, status: "referenced", foundIn: found.get(key) } : { key, status: "missing", foundIn: null });
  }

  // 設定のキー
  const wanted = settingKeysToCheck(mydistManifest, overlay);
  const settings = new Map(wanted.map((w) => [w.key, { key: w.key, from: w.from, status: null, foundIn: null }]));
  const left = new Set(settings.keys());
  // 本家の src/vs: 設定の登録の形（properties のキー。keys.mjs の resolveRegisteredSettingKeys）で見つける。
  // 登録の形では見つからず、文字列としてだけ在るキーは mentionedIn に記録する（読み手だけが残った恐れ）。
  const mentionedIn = new Map();
  if (left.size) {
    const files = [];
    for (const rel of walkFiles(worktree, "src/vs")) {
      if (!rel.endsWith(".ts") || isTestPath(rel)) continue;
      const text = readIfText(worktree, rel);
      if (text === null) continue;
      const definitions = extractSettingDefinitions(text);
      const registrations = extractRegistrationKeys(text);
      if (definitions.length || registrations.length) files.push({ file: rel, definitions, registrations });
      for (const k of left) if (!mentionedIn.has(k) && literalIncluded(text, k)) mentionedIn.set(k, rel);
    }
    const registered = resolveRegisteredSettingKeys(files);
    for (const k of [...left]) {
      if (registered.has(k)) {
        Object.assign(settings.get(k), { status: "upstream", foundIn: registered.get(k)[0] });
        left.delete(k);
      }
    }
  }
  if (left.size) {
    const extDir = path.join(worktree, "extensions");
    const names = fs.existsSync(extDir) ? fs.readdirSync(extDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
    for (const name of names) {
      if (name === "mydist" || !left.size) continue;
      const p = path.join(extDir, name, "package.json");
      if (!fs.existsSync(p)) continue;
      let m;
      try {
        m = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        continue;
      }
      for (const k of configurationPropertyKeys(m)) {
        if (left.has(k)) {
          Object.assign(settings.get(k), { status: "extension", foundIn: `extensions/${name}/package.json` });
          left.delete(k);
        }
      }
    }
  }
  let manifestsMissing = [];
  if (left.size) {
    const { found, missing } = readLockManifests(lock, manifestsDir);
    manifestsMissing = missing;
    for (const { id, manifest } of found) {
      for (const k of configurationPropertyKeys(manifest)) {
        if (left.has(k)) {
          Object.assign(settings.get(k), { status: "lockManifest", foundIn: id });
          left.delete(k);
        }
      }
    }
  }
  for (const k of left) {
    const s = settings.get(k);
    if (mentionedIn.has(k)) {
      // 本家の src に文字列はあるが、登録の形が無い（登録を消して読み手だけが残った。例 B-7 の後の terminal.integrated.suggest.enabled）
      Object.assign(s, { status: "unregistered", foundIn: null, mentionedIn: mentionedIn.get(k) });
    } else {
      s.status = manifestsMissing.length ? "unverified" : "missing";
    }
  }

  const all = [...product, ...settings.values()];
  const status = all.some((x) => x.status === "missing" || x.status === "unregistered") ? "fail" : all.some((x) => x.status === "unverified") ? "warn" : "ok";
  return { status, product, settings: [...settings.values()], manifestsMissing };
}

const LIST_CAP = 100;
const cap = (arr) => (arr.length > LIST_CAP ? { count: arr.length, first: arr.slice(0, LIST_CAP) } : { count: arr.length, items: arr });

// ロックファイルの検査（docs/03 の5.4）。依存の導入の後に呼ぶ。
//   worktree: 作業ツリー、baseRef: 本家のタグの commit（当てる前）、units: 当てた単位（unit.json の配列）、
//   diffOut: 本家のロックファイルとの差分を書くファイル（null なら書かない）
// 返り値: { status: "ok" | "fail", files: [...], diff }
export function checkLockfiles({ worktree, baseRef, units, diffOut = null }) {
  const r = git(worktree, ["ls-tree", "-r", "--name-only", baseRef]);
  if (r.status !== 0) throw new Error(`git ls-tree ${baseRef} が失敗: ${r.stderr.trim()}`);
  const lockPaths = r.stdout.split(/\r?\n/).filter((p) => /(^|\/)pnpm-lock\.yaml$/.test(p));
  const files = [];
  for (const p of lockPaths) {
    const dir = path.posix.dirname(p) === "." ? "" : path.posix.dirname(p);
    const abs = path.join(worktree, ...p.split("/"));
    const removedByUnit = (units || []).some((u) => (u.delete || []).some((d) => isUnderPath(p, d)));
    if (!fs.existsSync(abs)) {
      files.push({ path: p, status: removedByUnit ? "removed" : "fail", reason: removedByUnit ? "単位が消したフォルダの中" : "ロックファイルが無い" });
      continue;
    }
    if (removedByUnit) {
      files.push({ path: p, status: "fail", reason: "単位が消したフォルダの中のロックファイルが残っている" });
      continue;
    }
    // 行末は比べない（作業ツリーでは .gitattributes や autocrlf で CRLF になることがある）
    const before = (showFile(worktree, baseRef, p) || "").replace(/\r\n/g, "\n");
    const after = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    if (before === after) {
      files.push({ path: p, status: "ok", unchanged: true });
      continue;
    }
    const importers = Object.keys(parsePnpmLock(before).importers);
    const expected = expectedLockRemovals(dir, importers, units || []);
    const c = compareLockfile(before, after, expected);
    files.push({
      path: p,
      status: c.ok ? "ok" : "fail",
      unchanged: false,
      expected,
      changedSections: c.changedSections,
      addedImporters: c.addedImporters,
      removedImporters: c.removedImporters,
      unexpectedRemovedImporters: c.unexpectedRemovedImporters,
      addedDeps: c.addedDeps,
      unexpectedRemovedDeps: c.unexpectedRemovedDeps,
      changedDeps: c.changedDeps,
      addedPackages: c.addedPackages,
      addedSnapshots: c.addedSnapshots,
      removedDeps: cap(c.removedDeps),
      removedPackages: cap(c.removedPackages),
      removedSnapshots: cap(c.removedSnapshots),
    });
  }
  let diff = null;
  if (diffOut) {
    const d = git(worktree, ["diff", "--no-color", baseRef, "--", ...lockPaths]);
    fs.mkdirSync(path.dirname(diffOut), { recursive: true });
    fs.writeFileSync(diffOut, d.stdout);
    diff = diffOut;
  }
  return { status: files.some((f) => f.status === "fail") ? "fail" : "ok", files, diff };
}
