// 削除の単位（removals/*/unit.json）・builtin/keep.json・product.overlay.json の形の検査。
// 仕様: docs/03 の3.1（unit.json）・4節（残す組み込み拡張）・6節（未分類の検出）、docs/02 の3節（shukoConfigurationDefaults）。
// 蒙恬の成果物（removals/・builtin/keep.json・product.overlay.json）がまだ無いときは「無い」と書いて飛ばす。
// 本家 1.146.0 のソースは常設の clone（C:/b/vscode）のタグから git show / ls-tree で読む（作業ツリーはビルドで変わるため読まない）。読めなければ飛ばす。
// Run: node --test tests/removals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 本家のままのソースは、作業ツリー（ビルドで書き換わる）ではなく、常設の clone のタグから git で読む。
const UPSTREAM_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UPSTREAM_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const UPSTREAM = `${UPSTREAM_REPO} の ${UPSTREAM_TAG}`;
const git = (...args) => spawnSync('git', ['-C', UPSTREAM_REPO, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const upstreamOkFlag = existsSync(UPSTREAM_REPO) && git('rev-parse', '--verify', `${UPSTREAM_TAG}^{commit}`).status === 0;
const upstreamShow = (p) => { const r = git('show', `${UPSTREAM_TAG}:${p.replace(/\\/g, '/')}`); return r.status === 0 ? r.stdout : null; };
const upstreamHas = (p) => git('cat-file', '-e', `${UPSTREAM_TAG}:${p.replace(/\\/g, '/').replace(/\/+$/, '')}`).status === 0;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const REMOVALS = join(REPO, 'removals');
const unitDirs = existsSync(REMOVALS)
  ? readdirSync(REMOVALS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];
const units = unitDirs.map((name) => {
  const file = join(REMOVALS, name, 'unit.json');
  try { return { name, file, unit: readJson(file) }; } catch (e) { return { name, file, error: e.message }; }
});
const noUnits = unitDirs.length === 0 ? '実装なし: removals/*/ が無い' : false;

// ---------------------------------------------------------------------------
// unit.json の形（docs/03 の3.1）
// ---------------------------------------------------------------------------
const RANGE = { A: [100, 199], B: [200, 299], C: [300, 399] };
const ID_RE = /^([ABC])-(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const relPath = (p) => typeof p === 'string' && p.length > 0 && !/^([a-zA-Z]:|[\\/])/.test(p) && !p.split(/[\\/]/).includes('..');

test('unit.json: すべて JSON として読める', { skip: noUnits }, () => {
  assert.deepEqual(units.filter((u) => u.error).map((u) => `${u.name}: ${u.error}`), []);
});

for (const u of units.filter((x) => x.unit)) {
  const { unit, name } = u;
  const others = units.filter((x) => x.unit && x !== u);

  test(`unit ${name}: id がフォルダの名前と同じで <段階>-<番号>-<名前> の形、stage が id の頭と同じ`, () => {
    assert.equal(unit.id, name);
    const m = ID_RE.exec(unit.id);
    assert.ok(m, `id の形が違う: ${unit.id}`);
    assert.equal(unit.stage, m[1]);
  });

  test(`unit ${name}: order が段階の範囲（A=100台・B=200台・C=300台）にある整数`, () => {
    assert.ok(Number.isInteger(unit.order), 'order が整数でない');
    const [lo, hi] = RANGE[unit.stage] ?? [NaN, NaN];
    assert.ok(unit.order >= lo && unit.order <= hi, `order ${unit.order} は ${unit.stage} の範囲 ${lo}-${hi} の外`);
  });

  test(`unit ${name}: 必須の項目と型（enabled・intent・after・delete・removeLines・productRemove・kept・checks・smoke）`, () => {
    assert.equal(typeof unit.enabled, 'boolean', 'enabled が真偽値でない');
    assert.ok(typeof unit.intent === 'string' && unit.intent.trim(), 'intent が空');
    assert.ok(strArr(unit.after), 'after が文字列の配列でない');
    assert.ok(strArr(unit.delete ?? []), 'delete が文字列の配列でない');
    assert.ok(Array.isArray(unit.removeLines ?? []), 'removeLines が配列でない');
    assert.ok(strArr(unit.productRemove ?? []), 'productRemove が文字列の配列でない');
    assert.ok(Array.isArray(unit.kept ?? []), 'kept が配列でない');
    assert.ok(unit.checks && typeof unit.checks === 'object', 'checks が無い');
    assert.ok(strArr(unit.smoke) && unit.smoke.length > 0, 'smoke が空（この単位の後に通す組が要る）');
    if (unit.removeDependencies !== undefined) {
      assert.equal(typeof unit.removeDependencies, 'object');
      for (const [f, v] of Object.entries(unit.removeDependencies)) assert.ok(strArr(v), `removeDependencies.${f} が文字列の配列でない`);
    }
  });

  test(`unit ${name}: delete はリポジトリのルートからの相対パス（絶対パス・.. は不可）`, () => {
    for (const p of unit.delete ?? []) assert.ok(relPath(p), `不正な delete: ${p}`);
  });

  test(`unit ${name}: removeLines の各要素は { file, line, count? }（line は 1 行・空でない、count は 1 以上の整数）`, () => {
    for (const r of unit.removeLines ?? []) {
      assert.ok(relPath(r.file), `file が不正: ${r.file}`);
      assert.ok(typeof r.line === 'string' && r.line.trim() && !/[\r\n]/.test(r.line), `line が空か複数行: ${JSON.stringify(r.line)}`);
      if (r.count !== undefined) assert.ok(Number.isInteger(r.count) && r.count >= 1, `count が不正: ${r.count}`);
    }
  });

  test(`unit ${name}: kept の各要素に path と reason（理由）がある`, () => {
    for (const k of unit.kept ?? []) {
      assert.ok(relPath(k.path), `path が不正: ${k.path}`);
      assert.ok(typeof k.reason === 'string' && k.reason.trim(), `reason が空: ${k.path}`);
    }
  });

  test(`unit ${name}: checks の項目は既知の名前で、配列（absentStrings は { in, text }）`, () => {
    const known = ['absentCommands', 'absentViews', 'absentSettings', 'absentStrings', 'absentProcesses', 'absentHosts'];
    for (const [k, v] of Object.entries(unit.checks)) {
      assert.ok(known.includes(k), `未知の checks: ${k}`);
      assert.ok(Array.isArray(v), `${k} が配列でない`);
      if (k === 'absentStrings') {
        for (const s of v) {
          assert.ok(strArr(s.in) && s.in.length > 0, 'absentStrings.in が文字列の配列でない');
          assert.ok(typeof s.text === 'string' && s.text, 'absentStrings.text が空');
        }
      } else {
        assert.ok(strArr(v), `${k} が文字列の配列でない`);
      }
    }
  });

  test(`unit ${name}: after は実在する別の単位を指し、自分より前の order で、自分自身ではない`, () => {
    for (const a of unit.after) {
      assert.notEqual(a, unit.id, 'after が自分自身');
      const t = others.find((x) => x.unit.id === a);
      assert.ok(t, `after の単位が実在しない: ${a}`);
      assert.ok(t.unit.order < unit.order, `after の ${a}（order ${t.unit.order}）が自分（${unit.order}）より前でない`);
    }
  });

  test(`unit ${name}: README.md がある。patch を指すなら、そのファイルがある`, () => {
    assert.ok(existsSync(join(REMOVALS, name, 'README.md')), 'README.md が無い（docs/03 の3.2）');
    if (unit.patch) assert.ok(existsSync(join(REMOVALS, name, unit.patch)), `patch が無い: ${unit.patch}`);
  });

  test(`unit ${name}: 有効（enabled: true）の単位の after はすべて有効（docs/03 の5.1・7節）`, { skip: !unit.enabled }, () => {
    for (const a of unit.after) assert.equal(others.find((x) => x.unit.id === a)?.unit.enabled, true, `${a} が無効`);
  });
}

test('unit.json: id が重複しない・order が重複しない', { skip: noUnits }, () => {
  const okUnits = units.filter((x) => x.unit).map((x) => x.unit);
  const dup = (arr) => arr.filter((v, i) => arr.indexOf(v) !== i);
  assert.deepEqual(dup(okUnits.map((x) => x.id)), []);
  assert.deepEqual(dup(okUnits.map((x) => x.order)), []);
});

test('unit.json: after に循環が無い', { skip: noUnits }, () => {
  const g = new Map(units.filter((x) => x.unit).map((x) => [x.unit.id, x.unit.after ?? []]));
  const state = new Map();
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, `循環: ${[...path, id].join(' -> ')}`);
    state.set(id, 1);
    for (const a of g.get(id) ?? []) if (g.has(a)) visit(a, [...path, id]);
    state.set(id, 2);
  };
  for (const id of g.keys()) visit(id, []);
});

// ---------------------------------------------------------------------------
// builtin/keep.json と単位で、本家の extensions/* がすべて覆われる（docs/03 の4節の末尾・6節）
// ---------------------------------------------------------------------------
const KEEP_FILE = join(REPO, 'builtin', 'keep.json');
const keepNames = (raw) => {
  const list = Array.isArray(raw) ? raw : (raw.keep ?? raw.extensions ?? []);
  return list.map((e) => (typeof e === 'string' ? e : (e.name ?? e.id ?? String(e.path ?? '').replace(/^extensions[\\/]/, ''))));
};
const extDeleteNames = (u) => (u.delete ?? [])
  .map((p) => p.replace(/\\/g, '/'))
  .filter((p) => /^extensions\/[^/]+\/?$/.test(p))
  .map((p) => p.replace(/^extensions\//, '').replace(/\/$/, ''));
// 拡張 = package.json のあるフォルダ。extensions/types は型定義だけで拡張ではない（docs/03 の4節は「すべての extensions/*」と書くが、
// apply.mjs の検査も package.json のあるものを数える。この読み替えは報告に書く）。
const upstreamExt = upstreamOkFlag
  ? [...new Set(git('ls-tree', '-r', '--name-only', UPSTREAM_TAG, '--', 'extensions').stdout.split(/\r?\n/).map((l) => l.match(/^extensions\/([^/]+)\/package\.json$/)?.[1]).filter(Boolean))].sort()
  : null;

const noKeep = existsSync(KEEP_FILE) ? false : '実装なし: builtin/keep.json が無い';
test('keep.json: 読めて、各要素に名前と理由がある。名前は重複しない', { skip: noKeep }, () => {
  const raw = readJson(KEEP_FILE);
  const list = Array.isArray(raw) ? raw : (raw.keep ?? raw.extensions ?? []);
  assert.ok(list.length > 0, '空');
  for (const e of list) {
    if (typeof e === 'string') continue; // 理由なしの文字列は許さない、とまではしない
    assert.ok(typeof e.reason === 'string' && e.reason.trim(), `reason が空: ${JSON.stringify(e)}`);
  }
  const names = keepNames(raw);
  assert.ok(names.every((n) => n && typeof n === 'string'));
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});

test('keep.json: docs/03 の4節が「少なくとも載せる」とした拡張がある', { skip: noKeep }, () => {
  const names = new Set(keepNames(readJson(KEEP_FILE)));
  const must = ['git', 'git-base', 'merge-conflict', 'search-result', 'markdown-language-features', 'markdown-math', 'markdown-basics',
    'typescript-language-features', 'html-language-features', 'css-language-features', 'json-language-features', 'emmet',
    'configuration-editing', 'npm', 'references-view', 'theme-defaults', 'theme-seti', 'powershell', 'dotenv', 'shellscript', 'bat', 'python'];
  assert.deepEqual(must.filter((n) => !names.has(n)), []);
});

test('keep.json と単位: 同じ拡張が「残す」と「消す」の両方に載っていない', { skip: noKeep || noUnits }, () => {
  const keep = new Set(keepNames(readJson(KEEP_FILE)));
  const both = units.filter((x) => x.unit).flatMap((x) => extDeleteNames(x.unit).filter((n) => keep.has(n)).map((n) => `${n} (${x.name})`));
  assert.deepEqual(both, []);
});

test('keep.json と単位: 本家 1.146.0 の extensions/* がすべて、keep.json か単位の delete のどちらかに載っている', { skip: noKeep || (upstreamExt ? false : `本家の作業ツリーが無い: ${UPSTREAM}`) }, () => {
  const covered = new Set(keepNames(readJson(KEEP_FILE)));
  for (const x of units.filter((y) => y.unit)) for (const n of extDeleteNames(x.unit)) covered.add(n);
  const missing = upstreamExt.filter((n) => !covered.has(n));
  assert.deepEqual(missing, [], `未分類の組み込み拡張（docs/03 の6節。取り込みが止まる）: ${missing.join(', ')}`);
});

test('keep.json: 載っている名前が本家 1.146.0 に実在する（改名・削除に気づくため）', { skip: noKeep || (upstreamExt ? false : `本家の作業ツリーが無い: ${UPSTREAM}`) }, () => {
  const ghost = keepNames(readJson(KEEP_FILE)).filter((n) => !upstreamExt.includes(n));
  assert.deepEqual(ghost, []);
});

test('単位の delete: extensions/<名前> は本家 1.146.0 に実在する', { skip: noUnits || (upstreamExt ? false : `本家の作業ツリーが無い: ${UPSTREAM}`) }, () => {
  const ghost = units.filter((x) => x.unit).flatMap((x) => extDeleteNames(x.unit).filter((n) => !upstreamExt.includes(n)).map((n) => `${n} (${x.name})`));
  assert.deepEqual(ghost, []);
});

// ---------------------------------------------------------------------------
// 単位の removeLines・delete が、本家 1.146.0 の実物にそのまま当たる（メモリの上で順に。docs/03 の3.1・5.1）
// ---------------------------------------------------------------------------
{
  const upstreamOk = upstreamOkFlag;
  const skipUp = noUnits || (upstreamOk ? false : `本家のソースが読めない: ${UPSTREAM}`);
  const { removeLinesFromText } = await import('../scripts/lib/apply/lines.mjs').catch(() => ({}));
  const ordered = units.filter((x) => x.unit).sort((a, b) => a.unit.order - b.unit.order);
  for (const stage of ['A', 'B']) {
    test(`段階 ${stage} の removeLines: すべて本家 1.146.0 のファイルに、ちょうど count 行ある（前の単位の変更を引き継いで順に）`,
      { skip: skipUp || (removeLinesFromText ? false : '実装なし: lines.removeLinesFromText') }, () => {
        const mem = new Map();
        const bad = [];
        for (const { unit } of ordered) {
          if (unit.stage !== stage && !(stage === 'B' && unit.stage === 'A')) continue; // B は A の後の状態から
          for (const r of unit.removeLines ?? []) {
            if (!mem.has(r.file)) {
              const src = upstreamShow(r.file);
              if (src === null) { bad.push(`${unit.id}: ${r.file} が本家に無い`); continue; }
              mem.set(r.file, src);
            }
            const res = removeLinesFromText(mem.get(r.file), r.line, r.count ?? 1);
            if (!res.ok) bad.push(`${unit.id}: ${r.file}: ${res.error} (found ${res.found})`);
            else mem.set(r.file, res.text);
          }
        }
        assert.deepEqual(bad, []);
      });
  }
  test('単位の delete: 本家 1.146.0 に実在する（無ければ改名の恐れ。apply.mjs では警告）', { skip: skipUp }, () => {
    const missing = ordered.flatMap(({ unit }) => (unit.delete ?? []).filter((p) => !upstreamHas(p)).map((p) => `${unit.id}: ${p}`));
    assert.deepEqual(missing, []);
  });
}

// ---------------------------------------------------------------------------
// product.overlay.json（docs/02 の3節）
// ---------------------------------------------------------------------------
const OVERLAY = join(REPO, 'product.overlay.json');
const noOverlay = existsSync(OVERLAY) ? false : '実装なし: product.overlay.json が無い';

test('overlay: set と remove を持ち、同じキーが両方に無い', { skip: noOverlay }, () => {
  const o = readJson(OVERLAY);
  assert.ok(o.set && typeof o.set === 'object' && !Array.isArray(o.set), 'set がオブジェクトでない');
  assert.ok(strArr(o.remove ?? []), 'remove が文字列の配列でない');
  const both = (o.remove ?? []).filter((k) => k in o.set);
  assert.deepEqual(both, []);
});

test('overlay: shukoConfigurationDefaults の extensions.allowed が、台帳（extensions.lock.json）の ID とちょうど一致する', { skip: noOverlay }, () => {
  const o = readJson(OVERLAY);
  const allowed = o.set?.shukoConfigurationDefaults?.['extensions.allowed'];
  assert.ok(allowed && typeof allowed === 'object', 'extensions.allowed が無い');
  assert.equal(allowed['*'], false, '"*" は false（台帳に無い拡張は入れない）');
  const ledger = readJson(join(REPO, 'extensions.lock.json')).map((e) => e.id);
  assert.equal(new Set(ledger.map((i) => i.toLowerCase())).size, ledger.length, '台帳の ID に重複');
  const keys = Object.keys(allowed).filter((k) => k !== '*');
  // VS Code の拡張 ID は大文字小文字を区別しない（MS-CEINTL）ので、比べるときは小文字にそろえる
  assert.deepEqual(keys.map((k) => k.toLowerCase()).sort(), ledger.map((i) => i.toLowerCase()).sort());
  for (const k of keys) assert.equal(allowed[k], true, `${k} が true でない`);
});

test('overlay: shukoConfigurationDefaults の他の既定が docs/02 の3節の値と同じ', { skip: noOverlay }, () => {
  const d = readJson(OVERLAY).set?.shukoConfigurationDefaults ?? {};
  assert.equal(d['telemetry.telemetryLevel'], 'off');
  assert.equal(d['update.mode'], 'none');
  assert.equal(d['workbench.enableExperiments'], false);
  assert.equal(d['extensions.autoUpdate'], 'off');
  assert.equal(d['extensions.autoCheckUpdates'], false);
});

test('overlay: remove に reportIssueUrl があり、server*・tunnel*・AI のキーは（C-1・C-3 より前なので）まだ remove に無い', { skip: noOverlay }, () => {
  const o = readJson(OVERLAY);
  const rm = new Set([...(o.remove ?? []), ...(o.removeIfPresent ?? [])]);
  const b3 = units.find((x) => x.unit?.id?.startsWith('B-3'));
  if (!b3) return; // B-3 が無ければ見ない
  // docs/02 の3節の表は reportIssueUrl を overlay の remove にする。実装は B-3 の productRemove に置いた（overlay の $comment に理由）。
  // どちらでも「B-3 のとき消える」ことは守られるので通す。食い違いは報告に書く（どちらが正しいかは決めない）。
  assert.ok(rm.has('reportIssueUrl') || (b3.unit.productRemove ?? []).includes('reportIssueUrl'), 'reportIssueUrl を消す宣言が overlay にも B-3 にも無い');
  // C-1・C-3 のキー（server*・tunnel*・defaultChatAgent など）は、それらの単位が無いうちは overlay の remove に入れない
  const early = [...(o.remove ?? [])].filter((k) => /^(server|tunnel|win32Tunnel)/.test(k) || k === 'defaultChatAgent');
  assert.deepEqual(early, [], 'C-1・C-3 のキーを overlay の remove に入れると、AI やリモートのコードが値を見失う（docs/02 の3節）');
});

test('overlay: A-3 があるなら builtInExtensions を [] に set する（キーを消すとビルドが止まる。docs/02 の3節）', { skip: noOverlay || !units.some((x) => x.unit?.id?.startsWith('A-3')) }, () => {
  assert.deepEqual(readJson(OVERLAY).set?.builtInExtensions, []);
});

test('overlay: 単位の productRemove のキーが、overlay の remove か単位の productRemove のいずれかにある（二重管理の食い違い検出）', { skip: noOverlay || noUnits }, () => {
  // docs/02 の3節の表は remove を overlay に書く。単位の productRemove は「その単位を有効にしたとき」に消すキー。
  // 食い違いの検出だけを目的にする: 単位が消すと言うキーが、overlay の set に入っていたら矛盾。
  const o = readJson(OVERLAY);
  const clash = units.filter((x) => x.unit).flatMap((x) => (x.unit.productRemove ?? []).filter((k) => k in (o.set ?? {})).map((k) => `${k} (${x.name})`));
  assert.deepEqual(clash, []);
});

test('台帳（extensions.lock.json）: ID が重複しない（allowed との照合の前提）', () => {
  const ids = readJson(join(REPO, 'extensions.lock.json')).map((e) => e.id.toLowerCase());
  assert.deepEqual(ids.filter((n, i) => ids.indexOf(n) !== i), []);
});
