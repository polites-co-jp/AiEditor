#!/usr/bin/env node
// Sublime Text のキー割り当てを mydist の contributes.keybindings に変換する（docs/04 の6.2、Phase 0 の 0-10）。
//
// 使い方:
//   node scripts/convert-sublime-keys.mjs [--cache <dir>] [--vsix <sublime の VSIX>] [--claude <Claude Code の VSIX か package.json>]
//                                         [--md <書き出す .md>] [--apply]
//
//   --cache   取ったものと結果の置き場所（既定 C:/b/p0/sublime）
//   --vsix    元の VSIX を指定する（既定: Open VSX から 4.1.10 を取り、.sha256 と照合する）
//   --claude  Claude Code の manifest の出どころ。既定の順: <buildRoot>\cache\vsix の Claude Code の VSIX
//             → extensions.lock.json の版を Open VSX の API で → Open VSX の最新
//   --md      変換の結果と衝突の一覧を Markdown の表で書き出す
//   --apply   extensions-src/mydist/package.json の contributes.keybindings を書き換え、
//             ThirdPartyNotices.txt（元の LICENSE.md の本文）を書く。元の版は extensions-src/mydist/README.md に手で書く
//
// 出力（--cache の下）: sublime-<版>.package.json、converted-keybindings.json、dropped.json、
//   claude-code-keybindings.json、conflicts.json、same-key-different-when.json、convert-meta.json

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEntry } from './lib/zip-read.mjs';
import { resolveLocalConfig } from './lib/local-config.mjs';
import {
  convertKeybindingsDetailed, findConflicts, findSameKeyDifferentWhen, toWindowsKeybinding, unknownModifiersOf,
} from './lib/sublime-keys.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUBLIME = { namespace: 'ms-vscode', name: 'sublime-keybindings', version: '4.1.10' };
const OPENVSX = 'https://open-vsx.org/api';
const USER_AGENT = 'p0-convert-sublime-keys';

function parseArgs(argv) {
  const opts = { cache: 'C:/b/p0/sublime', vsix: null, claude: null, md: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (['--cache', '--vsix', '--claude', '--md'].includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} の値が無い`);
      opts[a.slice(2)] = v;
    } else throw new Error(`知らない引数: ${a}`);
  }
  return opts;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`取得に失敗: ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getJson(url) {
  return JSON.parse((await download(url)).toString('utf8'));
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function readVsixManifest(vsixBuf, label) {
  const pkg = readEntry(vsixBuf, 'extension/package.json');
  if (!pkg) throw new Error(`${label} に extension/package.json が無い`);
  return JSON.parse(pkg.toString('utf8').replace(/^\uFEFF/, ''));
}

async function getSublime(opts) {
  const base = `${OPENVSX}/${SUBLIME.namespace}/${SUBLIME.name}/${SUBLIME.version}/file`;
  const fileName = `${SUBLIME.namespace}.${SUBLIME.name}-${SUBLIME.version}`;
  let vsixPath = opts.vsix;
  let expected = null;
  if (!vsixPath) {
    vsixPath = join(opts.cache, `${fileName}.vsix`);
    const shaPath = join(opts.cache, `${fileName}.sha256`);
    if (!existsSync(shaPath)) writeFileSync(shaPath, await download(`${base}/${fileName}.sha256`));
    if (!existsSync(vsixPath)) writeFileSync(vsixPath, await download(`${base}/${fileName}.vsix`));
    const m = readFileSync(shaPath, 'utf8').match(/[0-9a-fA-F]{64}/);
    if (!m) throw new Error(`${shaPath} に SHA-256 が無い`);
    expected = m[0].toLowerCase();
  }
  const buf = readFileSync(vsixPath);
  const actual = sha256(buf);
  if (expected && actual !== expected) throw new Error(`SHA-256 が違う: ${vsixPath} 実際 ${actual} 公開 ${expected}`);
  const manifest = readVsixManifest(buf, vsixPath);
  if (manifest.version !== SUBLIME.version) throw new Error(`版が違う: ${manifest.version}（期待 ${SUBLIME.version}）`);
  const license = readEntry(buf, 'extension/LICENSE.md') ?? readEntry(buf, 'extension/LICENSE.txt') ?? readEntry(buf, 'extension/LICENSE');
  return {
    vsixPath, sha256: actual, sha256Published: expected, manifest,
    license: license ? license.toString('utf8').replace(/^\uFEFF/, '') : null,
    url: `${base}/${fileName}.vsix`,
  };
}

function findLocalClaudeVsix() {
  // VSIX のキャッシュ <buildRoot>\cache\vsix（docs/02 の8節。Phase 0 の C:\b\p0\vsix は使わない）
  let dir;
  try {
    dir = join(resolveLocalConfig().buildRoot, 'cache', 'vsix');
  } catch {
    return null;
  }
  if (!existsSync(dir)) return null;
  // lock-fetch.mjs は vsix\<id>-<版>[@<target>]\ の下に置く。直下も見る
  const rx = /^anthropic\.claude-code-.*\.vsix$/i;
  const hits = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isFile() && rx.test(ent.name)) hits.push(join(dir, ent.name));
    if (ent.isDirectory()) {
      for (const f of readdirSync(join(dir, ent.name))) if (rx.test(f)) hits.push(join(dir, ent.name, f));
    }
  }
  hits.sort();
  return hits.length ? hits[hits.length - 1] : null;
}

function lockVersionOf(id) {
  const p = join(REPO, 'extensions.lock.json');
  if (!existsSync(p)) return null;
  try {
    const lock = JSON.parse(readFileSync(p, 'utf8'));
    const arr = Array.isArray(lock) ? lock : (lock.extensions ?? []);
    const e = arr.find((x) => typeof x?.id === 'string' && x.id.toLowerCase() === id);
    return e?.version ?? null;
  } catch {
    return null;
  }
}

async function getClaude(opts) {
  let src = opts.claude;
  if (!src) src = findLocalClaudeVsix();
  if (src) {
    if (/\.vsix$/i.test(src)) {
      const buf = readFileSync(src);
      return { source: src, sha256: sha256(buf), manifest: readVsixManifest(buf, src) };
    }
    return { source: src, manifest: JSON.parse(readFileSync(src, 'utf8').replace(/^\uFEFF/, '')) };
  }
  const ver = lockVersionOf('anthropic.claude-code');
  const meta = await getJson(`${OPENVSX}/Anthropic/claude-code/win32-x64${ver ? `/${ver}` : ''}`);
  const url = meta.files?.manifest;
  if (!url) throw new Error('Open VSX の応答に files.manifest が無い');
  const manifest = await getJson(url);
  return { source: url, manifest, openVsxVersion: meta.version, timestamp: meta.timestamp };
}

function cell(v) {
  if (v === undefined || v === null || v === '') return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return '`' + s.replace(/\|/g, '\\|').replace(/`/g, "'") + '`';
}

function toMarkdown(r) {
  const lines = [];
  lines.push(`<!-- node scripts/convert-sublime-keys.mjs が ${r.meta.generatedAt} に書き出した -->`);
  lines.push('');
  lines.push(`- 元: ${SUBLIME.namespace}.${SUBLIME.name} ${SUBLIME.version}（項目 ${r.meta.sourceCount}）。SHA-256 ${r.meta.sublime.sha256}${r.meta.sublime.sha256Published ? '（Open VSX の .sha256 と一致）' : ''}`);
  lines.push(`- 変換の結果: ${r.converted.length} 項目。落とした項目: ${r.dropped.length}（理由ごと: ${Object.entries(r.meta.droppedByReason).map(([k, v]) => `${k} ${v}`).join('、') || 'なし'}）`);
  lines.push(`- Claude Code の manifest: 版 ${r.meta.claude.version}（出どころ ${r.meta.claude.source}）。keybindings ${r.claude.length} 件`);
  lines.push(`- 衝突（同じキーで when が両方とも無いか同じ）: ${r.conflicts.length} 件。同じキーで when が違うもの（参考）: ${r.sameKeyDiffWhen.length} 件`);
  lines.push('');
  lines.push('### 衝突の一覧');
  lines.push('');
  if (r.conflicts.length === 0) lines.push('なし');
  else {
    lines.push('| キー | Sublime のコマンド | Claude Code のコマンド | when |');
    lines.push('|---|---|---|---|');
    for (const c of r.conflicts) lines.push(`| ${cell(c.key)} | ${cell(c.a.command)} | ${cell(c.b.command)} | ${cell(c.a.when)} |`);
  }
  lines.push('');
  lines.push('### 同じキーで when が違うもの（参考）');
  lines.push('');
  if (r.sameKeyDiffWhen.length === 0) lines.push('なし');
  else {
    lines.push('| キー | Sublime のコマンド | Sublime の when | Claude Code のコマンド | Claude Code の when |');
    lines.push('|---|---|---|---|---|');
    for (const c of r.sameKeyDiffWhen) lines.push(`| ${cell(c.key)} | ${cell(c.a.command)} | ${cell(c.a.when)} | ${cell(c.b.command)} | ${cell(c.b.when)} |`);
  }
  lines.push('');
  lines.push('### Claude Code の既定のキー（Windows 向けの見え方）');
  lines.push('');
  lines.push('| キー | コマンド | when |');
  lines.push('|---|---|---|');
  for (const k of r.claude) lines.push(`| ${cell(k.key)} | ${cell(k.command)} | ${cell(k.when)} |`);
  lines.push('');
  lines.push('### 変換の結果に残った、知らない修飾キーを含むキー（invalid-key で落とすので、通常は無い）');
  lines.push('');
  if (r.suspicious.length === 0) lines.push('なし');
  else {
    lines.push('| key | command | when | 知らない修飾キー |');
    lines.push('|---|---|---|---|');
    for (const s of r.suspicious) lines.push(`| ${cell(s.item.key)} | ${cell(s.item.command)} | ${cell(s.item.when)} | ${cell(s.unknown.join(', '))} |`);
  }
  lines.push('');
  lines.push('### 落とした項目');
  lines.push('');
  if (r.dropped.length === 0) lines.push('なし');
  else {
    lines.push('| 理由 | 単位・知らない修飾キー | key | win | command | when |');
    lines.push('|---|---|---|---|---|---|');
    for (const d of r.dropped) lines.push(`| ${d.reason} | ${d.unit ?? (d.unknown ? d.unknown.join(', ') : '')} | ${cell(d.item?.key)} | ${cell(d.item?.win)} | ${cell(d.item?.command)} | ${cell(d.item?.when)} |`);
  }
  lines.push('');
  lines.push('### 変換の結果');
  lines.push('');
  lines.push('| # | key | command | when | args |');
  lines.push('|---|---|---|---|---|');
  r.converted.forEach((k, i) => lines.push(`| ${i + 1} | ${cell(k.key)} | ${cell(k.command)} | ${cell(k.when)} | ${cell(k.args)} |`));
  lines.push('');
  return lines.join('\n');
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function applyToMydist(r, sublime) {
  const dir = join(REPO, 'extensions-src', 'mydist');
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) throw new Error(`${pkgPath} が無い（先に mydist の package.json を作る）`);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.contributes = pkg.contributes ?? {};
  pkg.contributes.keybindings = r.converted;
  writeJson(pkgPath, pkg);
  if (sublime.license) {
    const notice = [
      'Shuko mydist - Third Party Notices',
      '',
      'The keybindings in package.json (contributes.keybindings) are converted from',
      `${SUBLIME.namespace}.${SUBLIME.name} ${SUBLIME.version} (${sublime.url}).`,
      'Source: https://github.com/microsoft/vscode-sublime-keybindings',
      '',
      '----- LICENSE.md of the original extension -----',
      '',
      sublime.license.trimEnd(),
      '',
    ].join('\r\n');
    writeFileSync(join(dir, 'ThirdPartyNotices.txt'), notice, 'utf8');
  }
  return pkgPath;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.cache, { recursive: true });

  const sublime = await getSublime(opts);
  writeJson(join(opts.cache, `sublime-${SUBLIME.version}.package.json`), sublime.manifest);
  const source = sublime.manifest.contributes?.keybindings;
  if (!Array.isArray(source)) throw new Error('元の manifest に contributes.keybindings が無い');

  const { keybindings: converted, dropped } = convertKeybindingsDetailed(source);

  const claudeInfo = await getClaude(opts);
  const claudeRaw = claudeInfo.manifest.contributes?.keybindings ?? [];
  const claude = claudeRaw.map(toWindowsKeybinding).filter((x) => x !== null);
  const conflicts = findConflicts(converted, claude);
  const sameKeyDiffWhen = findSameKeyDifferentWhen(converted, claude);
  const suspicious = converted
    .map((item) => ({ item, unknown: unknownModifiersOf(item.key) }))
    .filter((s) => s.unknown.length > 0);

  const droppedByReason = {};
  for (const d of dropped) {
    const k = d.unit ? `${d.reason}(${d.unit})` : d.reason;
    droppedByReason[k] = (droppedByReason[k] ?? 0) + 1;
  }
  const meta = {
    generatedAt: new Date().toISOString(),
    sourceCount: source.length,
    convertedCount: converted.length,
    droppedCount: dropped.length,
    droppedByReason,
    sublime: { id: `${SUBLIME.namespace}.${SUBLIME.name}`, version: SUBLIME.version, vsix: sublime.vsixPath, sha256: sublime.sha256, sha256Published: sublime.sha256Published, url: sublime.url },
    claude: { version: claudeInfo.manifest.version, source: claudeInfo.source, sha256: claudeInfo.sha256 ?? null, keybindingsCount: claudeRaw.length },
    conflictsCount: conflicts.length,
    sameKeyDifferentWhenCount: sameKeyDiffWhen.length,
    suspiciousKeys: suspicious.map((s) => ({ key: s.item.key, command: s.item.command, unknown: s.unknown })),
  };
  const r = { converted, dropped, claude, conflicts, sameKeyDiffWhen, suspicious, meta };

  writeJson(join(opts.cache, 'converted-keybindings.json'), converted);
  writeJson(join(opts.cache, 'dropped.json'), dropped);
  writeJson(join(opts.cache, 'claude-code-keybindings.json'), claudeRaw);
  writeJson(join(opts.cache, 'conflicts.json'), conflicts);
  writeJson(join(opts.cache, 'same-key-different-when.json'), sameKeyDiffWhen);
  writeJson(join(opts.cache, 'convert-meta.json'), meta);
  if (opts.md) writeFileSync(opts.md, toMarkdown(r), 'utf8');
  let applied = null;
  if (opts.apply) applied = applyToMydist(r, sublime);

  console.log(JSON.stringify({ ...meta, applied, md: opts.md ?? null }, null, 2));
}

main().catch((e) => {
  console.error(`convert-sublime-keys: ${e.message}`);
  process.exit(1);
});
