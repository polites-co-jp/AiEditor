// ロックファイルの検査（docs/03 の5.4）: 依存の導入で作り直した pnpm-lock.yaml と本家のものの差が「消した依存の削除」だけか。
// pnpm の lockfileVersion 9 の形だけを読む（YAML の一般の読み手ではない。Node.js の標準だけで書くため）。純粋な関数。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   parsePnpmLock(text)                               → { sections, importers, packages, snapshots }
//   compareLockfile(beforeText, afterText, expected)  → { ok, ... }
//   expectedLockRemovals(lockDir, importers, units)   → { removedImporters, removedDeps }

import path from "node:path";
import { normalizeRelPath, isUnderPath } from "./units.mjs";

const STRUCTURED = ["importers", "packages", "snapshots"];
const DEP_GROUPS = ["dependencies", "devDependencies", "optionalDependencies"];

// YAML のキー（行の頭から）を読む。'...'（'' は '）、"..."、裸のキー。返り値 { key, rest } か null。
function readKey(s) {
  if (s.startsWith("'")) {
    let i = 1;
    let out = "";
    while (i < s.length) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        break;
      }
      out += s[i++];
    }
    if (s[i] !== "'" || s[i + 1] !== ":") return null;
    return { key: out, rest: s.slice(i + 2).trim() };
  }
  if (s.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)":(.*)$/.exec(s);
    if (!m) return null;
    try {
      return { key: JSON.parse(`"${m[1]}"`), rest: m[2].trim() };
    } catch {
      return null;
    }
  }
  const m = /^(\S.*?):(?:\s+(.*)|\s*)$/.exec(s);
  return m ? { key: m[1], rest: (m[2] || "").trim() } : null;
}

const indentOf = (line) => /^ */.exec(line)[0].length;

export function parsePnpmLock(text) {
  const sections = {};
  const importers = {};
  const packages = [];
  const snapshots = [];
  if (typeof text !== "string") return { sections, importers, packages, snapshots };
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let section = null;
  let raw = [];
  let imp = null;
  let group = null;
  let dep = null;
  const flush = () => {
    if (section !== null && !STRUCTURED.includes(section)) sections[section] = raw.join("\n").replace(/\n+$/, "");
  };
  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      if (section !== null) raw.push("");
      continue;
    }
    const ind = indentOf(line);
    if (ind === 0) {
      flush();
      const k = readKey(line);
      section = k ? k.key : line;
      raw = [line];
      imp = group = dep = null;
      continue;
    }
    raw.push(line);
    const body = line.slice(ind);
    if (section === "importers") {
      if (ind === 2) {
        const k = readKey(body);
        imp = k ? k.key : null;
        if (imp !== null) importers[imp] = importers[imp] || {};
        group = dep = null;
      } else if (ind === 4 && imp !== null) {
        const k = readKey(body);
        group = k && DEP_GROUPS.includes(k.key) ? k.key : null;
        if (group) importers[imp][group] = importers[imp][group] || {};
        dep = null;
      } else if (ind === 6 && group) {
        const k = readKey(body);
        dep = k ? k.key : null;
        if (dep !== null) importers[imp][group][dep] = { specifier: null, version: null };
      } else if (ind === 8 && dep !== null) {
        const k = readKey(body);
        if (k && (k.key === "specifier" || k.key === "version")) importers[imp][group][dep][k.key] = k.rest;
      }
    } else if ((section === "packages" || section === "snapshots") && ind === 2) {
      const k = readKey(body);
      if (k) (section === "packages" ? packages : snapshots).push(k.key);
    }
  }
  flush();
  return { sections, importers, packages, snapshots };
}

function depMap(importer) {
  const m = new Map();
  for (const g of DEP_GROUPS) {
    const deps = importer && importer[g];
    if (!deps) continue;
    for (const [name, v] of Object.entries(deps)) m.set(`${g}\u0000${name}`, { group: g, name, ...v });
  }
  return m;
}

// importer の中の link: が指す importer（ロックファイルのフォルダからの相対。ルートは "."）。
function linkTarget(importerName, version) {
  if (typeof version !== "string" || !version.startsWith("link:")) return null;
  const base = importerName === "." ? "" : importerName;
  const joined = path.posix.normalize(path.posix.join(base || ".", version.slice(5)));
  return joined === "" ? "." : joined.replace(/\/$/, "");
}

export function compareLockfile(beforeText, afterText, expected = {}) {
  const a = parsePnpmLock(beforeText);
  const b = parsePnpmLock(afterText);
  const expImporters = new Set(Array.isArray(expected.removedImporters) ? expected.removedImporters : []);
  const expDeps = expected.removedDeps && typeof expected.removedDeps === "object" ? expected.removedDeps : {};

  const changedSections = [...new Set([...Object.keys(a.sections), ...Object.keys(b.sections)])]
    .filter((s) => a.sections[s] !== b.sections[s])
    .sort();
  const impA = Object.keys(a.importers);
  const impB = Object.keys(b.importers);
  const addedImporters = impB.filter((i) => !(i in a.importers)).sort();
  const removedImporters = impA.filter((i) => !(i in b.importers)).sort();
  const unexpectedRemovedImporters = removedImporters.filter((i) => !expImporters.has(i));

  const addedDeps = [];
  const removedDeps = [];
  const unexpectedRemovedDeps = [];
  const changedDeps = [];
  for (const imp of impA.filter((i) => i in b.importers)) {
    const before = depMap(a.importers[imp]);
    const after = depMap(b.importers[imp]);
    const allowed = new Set(Array.isArray(expDeps[imp]) ? expDeps[imp] : []);
    for (const [k, v] of after) if (!before.has(k)) addedDeps.push({ importer: imp, group: v.group, name: v.name, version: v.version });
    for (const [k, v] of before) {
      if (!after.has(k)) {
        const item = { importer: imp, group: v.group, name: v.name, version: v.version };
        removedDeps.push(item);
        const t = linkTarget(imp, v.version);
        if (!allowed.has(v.name) && !(t && expImporters.has(t))) unexpectedRemovedDeps.push(item);
      } else {
        const w = after.get(k);
        if (w.specifier !== v.specifier || w.version !== v.version) {
          changedDeps.push({ importer: imp, group: v.group, name: v.name, before: { specifier: v.specifier, version: v.version }, after: { specifier: w.specifier, version: w.version } });
        }
      }
    }
  }
  const setA = (xs) => new Set(xs);
  const pa = setA(a.packages);
  const pb = setA(b.packages);
  const sa = setA(a.snapshots);
  const sb = setA(b.snapshots);
  const addedPackages = b.packages.filter((x) => !pa.has(x));
  const removedPackages = a.packages.filter((x) => !pb.has(x));
  const addedSnapshots = b.snapshots.filter((x) => !sa.has(x));
  const removedSnapshots = a.snapshots.filter((x) => !sb.has(x));
  const ok =
    changedSections.length === 0 &&
    addedImporters.length === 0 &&
    unexpectedRemovedImporters.length === 0 &&
    addedDeps.length === 0 &&
    unexpectedRemovedDeps.length === 0 &&
    changedDeps.length === 0 &&
    addedPackages.length === 0 &&
    addedSnapshots.length === 0;
  return {
    ok,
    changedSections,
    addedImporters,
    removedImporters,
    unexpectedRemovedImporters,
    addedDeps,
    removedDeps,
    unexpectedRemovedDeps,
    changedDeps,
    addedPackages,
    removedPackages,
    addedSnapshots,
    removedSnapshots,
  };
}

// lockDir（ルートからの相対。ルートは ""）のロックファイルの importer のうち、単位が消すもの・依存を消すもの。
export function expectedLockRemovals(lockDir, importers, units) {
  const dir = lockDir ? normalizeRelPath(lockDir) || "" : "";
  const full = (imp) => {
    const j = path.posix.normalize(path.posix.join(dir || ".", imp));
    return j === "." ? "" : j.replace(/\/$/, "");
  };
  const removedImporters = [];
  const removedDeps = {};
  const list = Array.isArray(units) ? units : [];
  for (const imp of Array.isArray(importers) ? importers : []) {
    const f = full(imp);
    if (f && list.some((u) => Array.isArray(u.delete) && u.delete.some((d) => isUnderPath(f, d)))) removedImporters.push(imp);
    for (const u of list) {
      if (!u.removeDependencies || typeof u.removeDependencies !== "object") continue;
      for (const [file, names] of Object.entries(u.removeDependencies)) {
        const pj = normalizeRelPath(file);
        if (!pj || !Array.isArray(names)) continue;
        const pdir = path.posix.dirname(pj) === "." ? "" : path.posix.dirname(pj);
        if (pdir === f) removedDeps[imp] = [...new Set([...(removedDeps[imp] || []), ...names])];
      }
    }
  }
  return { removedImporters, removedDeps };
}
