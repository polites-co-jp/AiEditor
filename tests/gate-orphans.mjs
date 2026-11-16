// 単位が消した部品の「使い手」が、残るコードに残っていないかを見る網(共通の部品)。2026-11-16。
// 起きたこと(1.146.0-p5-c-all-r2 の関門。records/take-in/1.146.0-p5-c-all-r2/gate-C-1-ai.md): C-1 が消した部品の使い手が残り、ワークベンチが動いて初めて誤りが出た。
//   1) サービス: ITerminalChatService の実装(terminalContrib/chat)を消したが、注入(@ITerminalChatService)が残った -> depends on UNKNOWN service
//   2) 設定: search.searchView.semanticSearchBehavior の登録を消したが、`getValue('search').searchView.semanticSearchBehavior` が残った -> Cannot read properties of undefined
//   3) コマンド: _chat.editSessions.accept を消したが、組み込みの git の拡張が executeCommand で呼んだ -> command not found
// 期待は本家のタグから読む(実装の一覧から写さない)。型検査・absentStrings・smoke が見ない穴を、静的に塞ぐ。
// 見るもの:
//   A サービスの注入: 登録(registerSingleton(IX, ...)・.set(IX, ...))が、その単位が消した行・ファイルにだけあり、残る登録が無い ID を、
//     残るコードが `@IX`・`accessor.get(IX)`・`getService(IX)` で使っていないこと(@optional は除く)。
//   B 設定のキーの読み手: その単位が消した設定のキー(消すファイルや消す行の `'a.b.c': {`、unit.json の absentSettings)を、
//     残るコードが `.b.c`(? なしの鎖)で読んでいないこと。型の網: 親(`b`)が edits.patch で省略できる型(`b?:`)になっていれば、型検査が見張る。
//   C コマンドの呼び手: その単位が消したコマンドの ID(消すファイル・消す行にその文字列がある)を、残るコードと組み込み拡張(extensions/)が
//     executeCommand で呼んでいて、残るコード・patch が足した行にその ID の定義が無いこと。
// 「解決された」= (1) 21単位の edits.patch か removeLines がその行を消している・書き換えている (2) patch が登録(A)・定義(C)を足している (3) 型の網(B)。
// 例外は呼び手(テスト)が理由つきで渡す。本家にその行が無くなれば、呼び手が古い例外として落とす。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const clean = (p) => p.replace(/\/+$/, '');
export const underAny = (list, p) => list.some((d) => { const dd = clean(d); return p === dd || p.startsWith(dd + '/'); });
export const isTestPath = (p) => /(^|\/)test\/|\.test\.ts$|\/fixtures?\/|\/node_modules\//.test(p);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** パッチの本文を、ファイルごとの区画に分ける。 */
export function parsePatchSections(text) {
  const out = [];
  let cur = null;
  let inHunk = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], added: [], removed: [] }; out.push(cur); inHunk = false; continue; }
    if (!cur) continue;
    if (!inHunk) { if (/^@@ /.test(line)) inHunk = true; continue; }
    if (/^@@ /.test(line)) continue;
    if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
  return out;
}

/** removals/ の単位を読む。unitDirs = { 'C-1-ai': <フォルダ> } で、フォルダを差し替えられる(壊した写し用)。 */
export function loadUnits(repo, unitDirs = {}) {
  const root = join(repo, 'removals');
  const units = [];
  for (const d of readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = unitDirs[d.name] ?? join(root, d.name);
    const f = join(dir, 'unit.json');
    if (!existsSync(f)) continue;
    const json = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
    if (json.enabled === false) continue;
    const pp = json.patch ? join(dir, json.patch) : null;
    units.push({ id: d.name, json, sections: pp && existsSync(pp) ? parsePatchSections(readFileSync(pp, 'utf8')) : [] });
  }
  return units;
}

function mapAdd(map, k, v) { if (!map.has(k)) map.set(k, []); map.get(k).push(v); }

/** 本家のタグの読み取り口(git grep / git show / git ls-tree)。 */
const cache = new Map(); // 同じ検索は1回だけ走らせる(本家のタグは変わらない)
export function upstream(repo, tag) {
  const run = (args, input) => {
    const ck = JSON.stringify([repo, tag, args, input ?? null]);
    if (cache.has(ck)) return cache.get(ck);
    const out = run0(args, input);
    cache.set(ck, out);
    return out;
  };
  const run0 = (args, input) => {
    const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, input });
    if (r.status !== 0 && r.status !== 1) throw new Error(`git ${args.slice(0, 3).join(' ')} が失敗: ${r.stderr}`);
    return r.stdout ?? '';
  };
  const parse = (out) => out.split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean).map((l) => {
    const m = /^[^:]+:(.+?):(\d+):(.*)$/.exec(l);
    return m ? { path: m[1], line: Number(m[2]), text: m[3] } : null;
  }).filter(Boolean);
  return {
    /** 正規表現(-E)で探す */
    grep: (pattern, paths = ['src']) => parse(run(['grep', '-n', '-I', '-E', '-e', pattern, tag, '--', ...paths])),
    /** 固定の文字列の一覧(1行1つ)で探す */
    grepFixed: (needles, paths = ['src']) => parse(run(['grep', '-n', '-I', '-F', '-f', '-', tag, '--', ...paths], needles.join('\n') + '\n')),
    show: (p) => { const r = spawnSync('git', ['-C', repo, 'show', `${tag}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; },
  };
}

/**
 * 単位 by が消した部品の使い手で、残っているものを探す。
 * ctx: { up: upstream(...), units: loadUnits(...), by: 単位の ID }
 * 返す: { services, settings, commands } それぞれ { ... }[]。解決済み(patch が直した・足した)は含まない。
 */
export function findOrphans({ up, units, by }) {
  const me = units.find((u) => u.id === by);
  if (!me) throw new Error(`単位が無い: ${by}`);
  const finalDeleted = units.flatMap((u) => u.json.delete ?? []);
  const byDeleted = me.json.delete ?? [];
  // 単位が消す行(removeLines と patch の - の行)。ファイル -> Set(trim した行)
  const linesOf = (us) => {
    const m = new Map();
    for (const u of us) {
      for (const r of u.json.removeLines ?? []) { if (!m.has(r.file)) m.set(r.file, new Set()); m.get(r.file).add(r.line.trim()); }
      for (const s of u.sections) { if (!m.has(s.path)) m.set(s.path, new Set()); for (const l of s.removed) m.get(s.path).add(l.trim()); }
    }
    return m;
  };
  const removedAll = linesOf(units);
  const removedBy = linesOf([me]);
  const added = new Map(); // path -> lines(全単位の patch が足す行)
  for (const u of units) for (const s of u.sections) for (const l of s.added) mapAdd(added, s.path, l);
  const addedText = [...added.values()].flat();
  const goneAll = (path, text) => underAny(finalDeleted, path) || removedAll.get(path)?.has(text.trim());
  const goneBy = (path, text) => underAny(byDeleted, path) || removedBy.get(path)?.has(text.trim());

  // ---- A サービス ----
  const services = [];
  {
    const regs = up.grep('(registerSingleton\\(\\s*|\\.set\\(\\s*)I[A-Z][A-Za-z0-9]+\\b').map((h) => ({ ...h, id: /(?:registerSingleton\(\s*|\.set\(\s*)(I[A-Z][A-Za-z0-9]+)\b/.exec(h.text)?.[1] })).filter((h) => h.id);
    // 登録の「側」: main(electron-main・code・server・共有プロセス・node)か、ワークベンチ(renderer・拡張ホストのうち node 以外)か。
    // 同じ ID を main には登録し、ワークベンチの登録だけが消えると、ワークベンチの注入が UNKNOWN service になる(例: IAgentNetworkFilterService)。
    // そこで、ID を側ごとに見る: その側の登録が、すべてこの単位が消したもので、残る登録・足された登録がその側に無いこと。
    // 側は3つ: main / workbench(src/vs/workbench・src/vs/editor の renderer) / common(platform・base など。どちらの側でも動く)。
    // common の登録は、どちらの側にも効く。common の使い手は、どちらの側に登録が残っていても足りる(別のプロセスに残る登録も「残る登録」)。
    const sideOf = (p) => (/(^|\/)electron-main\/|^src\/vs\/code\/|^src\/vs\/server\/|\/sharedProcess\/|\/node\//.test(p) ? 'main' : /^src\/vs\/(workbench|editor)\//.test(p) ? 'workbench' : 'common');
    // ID -> 登録の一覧(側つき)
    const regMap = new Map();
    for (const h of regs) { if (!regMap.has(h.id)) regMap.set(h.id, []); regMap.get(h.id).push({ ...h, side: sideOf(h.path) }); }
    // 足された登録(patch の + の行)。ID -> 側の集合
    const addedSides = new Map();
    for (const [p, ls] of added) for (const l of ls) { const m = /(?:registerSingleton\(\s*|\.set\(\s*)(I[A-Z][A-Za-z0-9]+)\b/.exec(l); if (m) { if (!addedSides.has(m[1])) addedSides.set(m[1], new Set()); addedSides.get(m[1]).add(sideOf(p)); } }
    // 使い手の側ごとの orphan: [{ id, side }]。side = その側の使い手(main / workbench / common)
    const orphanSides = [];
    for (const [id, rs] of regMap) {
      for (const side of ['main', 'workbench', 'common']) {
        // この側の使い手に効く登録: main の使い手は main と common、workbench は workbench と common、common の使い手はすべて
        const eff = side === 'common' ? rs : rs.filter((h) => h.side === side || h.side === 'common');
        // この単位が消した登録がある側だけ。残る登録が1つでもあれば、残る(別の単位が消した分が混ざるなら、その単位の持ち分)
        if (!eff.length || !eff.every((h) => goneBy(h.path, h.text))) continue;
        const effSides = side === 'common' ? ['main', 'workbench', 'common'] : [side, 'common'];
        if ([...(addedSides.get(id) ?? [])].some((s) => effSides.includes(s))) continue;
        orphanSides.push({ id, side });
      }
    }
    if (orphanSides.length) {
      const ids = [...new Set(orphanSides.map((o) => o.id))];
      const alt = ids.map(esc).join('|');
      const uses = up.grep(`(@(${alt})\\b|\\bget\\(\\s*(${alt})\\s*\\)|getService\\(\\s*(${alt})\\s*\\))`);
      for (const h of uses) {
        if (goneAll(h.path, h.text) || isTestPath(h.path) || /optional\(/.test(h.text) || /^\s*(\/\/|\*|\/\*)/.test(h.text)) continue;
        const id = ids.find((i) => new RegExp(`(@${esc(i)}\\b|get\\(\\s*${esc(i)}\\s*\\)|getService\\(\\s*${esc(i)}\\s*\\))`).test(h.text));
        // 使い手の側で、登録が消えている ID だけ
        if (id && orphanSides.some((o) => o.id === id && o.side === sideOf(h.path))) services.push({ kind: 'service', id, path: h.path, line: h.line, text: h.text.trim() });
      }
    }
  }

  // ---- B 設定のキー ----
  const settings = [];
  {
    const keys = new Set(me.json.checks?.absentSettings ?? []);
    const keyRe = /^\s*['"]([a-zA-Z][\w]*(?:\.[\w]+)+)['"]\s*:\s*\{/;
    const dirs = byDeleted.length ? byDeleted : ['src'];
    for (const h of up.grep("^\\s*['\"][a-zA-Z][A-Za-z0-9]*(\\.[A-Za-z0-9]+)+['\"]\\s*:\\s*\\{", dirs)) { const m = keyRe.exec(h.text); if (m) keys.add(m[1]); }
    for (const set of removedBy.values()) for (const l of set) { const m = keyRe.exec(l); if (m) keys.add(m[1]); }
    // 親が型の網になっているか: patch が `親?:` を足している
    const netted = (parent) => addedText.some((l) => new RegExp(`\\b${esc(parent)}\\?\\s*:`).test(l));
    // まだ登録が残っているキー(別の場所の `'キー': {`)は、消えていない
    const keyList = [...keys].filter((k) => k.includes('.'));
    const stillRegistered = new Set();
    if (keyList.length) {
      for (const h of up.grepFixed(keyList.flatMap((k) => [`'${k}'`, `"${k}"`]))) {
        if (goneAll(h.path, h.text) || isTestPath(h.path)) continue;
        for (const k of keyList) if (new RegExp(`['"]${esc(k)}['"]\\s*:\\s*\\{`).test(h.text)) stillRegistered.add(k);
      }
    }
    // 文字列の中(引用符の内側)の一致は、鎖の読みではない
    const insideString = (text, idx) => { let q = null; for (let i = 0; i < idx; i++) { const c = text[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; } return q !== null; };
    for (const key of keyList) {
      if (stillRegistered.has(key)) continue;
      const seg = key.split('.');
      const leaf = seg[seg.length - 1];
      const parent = seg[seg.length - 2];
      // (git の拡張正規表現では、文字クラスの `]` は先頭に置く。`\]` は効かない)
      const hits = up.grep(`[]A-Za-z0-9_)]\\.${esc(parent)}\\.${esc(leaf)}\\b`);
      for (const h of hits) {
        if (goneAll(h.path, h.text) || isTestPath(h.path) || /^\s*(\/\/|\*|\/\*)/.test(h.text)) continue;
        const m = new RegExp(`[A-Za-z0-9_)\\]]\\.${esc(parent)}\\.${esc(leaf)}\\b`).exec(h.text);
        if (!m || insideString(h.text, m.index)) continue;
        // 同じ行の前のほうで、親を条件にしている(`c.files && c.files.exclude`、`c.files ? c.files.exclude : …`)
        if (new RegExp(`\\.${esc(parent)}\\s*(?:&&|\\?(?![.?]))`).test(h.text.slice(0, m.index + 1))) continue;
        if (netted(parent)) continue;
        settings.push({ kind: 'setting', key, path: h.path, line: h.line, text: h.text.trim() });
      }
    }
  }

  // ---- C コマンド ----
  const commands = [];
  {
    const calls = up.grep("executeCommand(<[^>]*>)?\\(\\s*['\"][^'\"]+['\"]", ['src', 'extensions']);
    const callRe = /executeCommand(?:<[^>]*>)?\(\s*['"]([^'"]+)['"]/g;
    const byId = new Map(); // id -> 呼び手の hit
    for (const h of calls) {
      if (h.path.startsWith('src/vscode-dts/') || /^\s*(\/\/|\*|\/\*)/.test(h.text)) continue; // API の説明の例・コメントは呼び手ではない
      for (const m of h.text.matchAll(callRe)) if (!/\s/.test(m[1])) mapAdd(byId, m[1], h);
    }
    const ids = [...byId.keys()];
    if (ids.length) {
      // その ID の文字列が、その単位が消すファイル・消す行にあるもの
      const needles = ids.flatMap((i) => [`'${i}'`, `"${i}"`]);
      const inDeleted = new Set();
      if (byDeleted.length) for (const h of up.grepFixed(needles, byDeleted)) for (const i of ids) if (h.text.includes(`'${i}'`) || h.text.includes(`"${i}"`)) inDeleted.add(i);
      for (const set of removedBy.values()) for (const l of set) for (const i of ids) if (l.includes(`'${i}'`) || l.includes(`"${i}"`)) inDeleted.add(i);
      const cand = ids.filter((i) => inDeleted.has(i));
      if (cand.length) {
        const occ = up.grepFixed(cand.flatMap((i) => [`'${i}'`, `"${i}"`]), ['src', 'extensions']);
        for (const id of cand) {
          const mine = occ.filter((h) => h.text.includes(`'${id}'`) || h.text.includes(`"${id}"`));
          const defined = mine.some((h) => !goneAll(h.path, h.text) && !isTestPath(h.path) && !/package\.json$/.test(h.path) && !new RegExp(`executeCommand(?:<[^>]*>)?\\(\\s*['"]${esc(id)}['"]`).test(h.text))
            || addedText.some((l) => l.includes(`'${id}'`) || l.includes(`"${id}"`));
          if (defined) continue;
          // ビューの `<ビューの ID>.focus` は、ビューを登録すると自動で作られる(文字列の定義が無い)。ビューの ID が残る場所にあれば、定義済みと数える
          const focus = /^(.+)\.focus$/.exec(id);
          if (focus && occ.length >= 0 && up.grepFixed([`'${focus[1]}'`, `"${focus[1]}"`]).some((h) => !goneAll(h.path, h.text) && !isTestPath(h.path))) continue;
          for (const h of byId.get(id)) {
            if (goneAll(h.path, h.text) || isTestPath(h.path)) continue;
            commands.push({ kind: 'command', id, path: h.path, line: h.line, text: h.text.trim() });
          }
        }
      }
    }
  }
  return { services, settings, commands };
}

/** 例外(path の末尾・ID か key・行の一部・理由)を適用する。返す: { left, used: Set(添字) } */
export function applyAllowlist(found, allow) {
  const used = new Set();
  const left = found.filter((f) => {
    const i = allow.findIndex((a) => f.path.endsWith(a.path) && (a.id ?? a.key) === (f.id ?? f.key) && (!a.contains || f.text.includes(a.contains)));
    if (i >= 0) { used.add(i); return false; }
    return true;
  });
  return { left, used };
}

export const describeFound = (f) => `${f.path}:${f.line} [${f.kind}: ${f.id ?? f.key}] ${f.text.slice(0, 140)}`;
