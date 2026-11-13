// apply.mjs の部品（scripts/lib/apply/*.mjs）の、境界と変わった入力のテスト。
// 仕様: docs/03 の3.1・5.1・5.4・6、docs/02 の3節。関数の入出力は tasks/2026-11-13-p2-apply/apply-design.md の3節。
// 蒙恬の handoff-notes.md「テストの入口」の「特に試してほしい点」を含む。期待値は設計書の文言から書いた（実装の出力を写していない）。
// Run: node --test tests/apply-parts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mods } from './apply/api.mjs';

const M = (name) => mods[name] ?? {};
const need = (mod, fnName) => ({ skip: M(mod)[fnName] ? false : `実装なし: ${mod}.${fnName}` });
const IMP = "import './x.js';";

// ---------------------------------------------------------------------------
// lines.removeLinesFromText
// ---------------------------------------------------------------------------
test('lines: 先頭の BOM つきの最初の行も一致し、BOM は残る', need('lines', 'removeLinesFromText'), () => {
  const r = M('lines').removeLinesFromText(`\uFEFF${IMP}\nb\n`, IMP);
  assert.equal(r.ok, true);
  assert.equal(r.text, '\uFEFFb\n');
  assert.equal(r.found, 1);
});

// 食い違いの疑い（どちらが正しいかは決めない）: 実装は 'a' を返す（前の行の改行も消える）。設計書の「行末は行ごとに保つ」どおりなら 'a\n'。
test('lines: 最後の行（改行なし）を消す。前の行の改行は残る（行末は行ごとに保つ）', need('lines', 'removeLinesFromText'), () => {
  const r = M('lines').removeLinesFromText(`a\n${IMP}`, IMP);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'a\n');
});

test('lines: CRLF と LF が混ざったファイルで、残る行の行末は行ごとに保つ', need('lines', 'removeLinesFromText'), () => {
  const r = M('lines').removeLinesFromText(`a\r\n${IMP}\r\nb\nc\r\n`, IMP);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'a\r\nb\nc\r\n');
});

test('lines: count=2 でちょうど2行のとき消す。found が数を返す', need('lines', 'removeLinesFromText'), () => {
  const r = M('lines').removeLinesFromText(`${IMP}\nx\n  ${IMP}\n`, IMP, 2);
  assert.equal(r.ok, true);
  assert.equal(r.found, 2);
  assert.equal(r.text, 'x\n');
});

test('lines: 数が合わないとき ok:false で text は元のまま、error に理由、found は実数', need('lines', 'removeLinesFromText'), () => {
  const src = `${IMP}\nx\n${IMP}\n`;
  for (const count of [1, 3]) {
    const r = M('lines').removeLinesFromText(src, IMP, count);
    assert.equal(r.ok, false);
    assert.equal(r.text, src);
    assert.equal(r.found, 2);
    assert.ok(r.error);
  }
  const z = M('lines').removeLinesFromText('a\n', IMP);
  assert.equal(z.ok, false);
  assert.equal(z.found, 0);
});

test('lines: count が 0・小数・文字列・負なら ok:false（count は1以上の整数）', need('lines', 'removeLinesFromText'), () => {
  for (const count of [0, 1.5, '2', -1, NaN]) {
    const r = M('lines').removeLinesFromText(`${IMP}\n`, IMP, count);
    assert.equal(r.ok, false, String(count));
    assert.equal(r.text, `${IMP}\n`);
  }
});

test('lines: matchesLine は前後の空白だけを除く（中の空白は区別する）', need('lines', 'matchesLine'), () => {
  assert.equal(M('lines').matchesLine('  a b\t', 'a b'), true);
  assert.equal(M('lines').matchesLine('a  b', 'a b'), false);
});

test('lines: splitLinesKeepEol は行末を保ち、連結すると元に戻る', need('lines', 'splitLinesKeepEol'), () => {
  const src = 'a\r\nb\nc';
  const parts = M('lines').splitLinesKeepEol(src);
  assert.deepEqual(parts.map((p) => p.eol), ['\r\n', '\n', '']);
  assert.equal(parts.map((p) => p.body + p.eol).join(''), src);
});

// ---------------------------------------------------------------------------
// deps.removeDependenciesFromText
// ---------------------------------------------------------------------------
const PKG = (indent = '  ') => [
  '{',
  `${indent}"name": "x",`,
  `${indent}"dependencies": {`,
  `${indent}${indent}"a": "1",`,
  `${indent}${indent}"b": "2",`,
  `${indent}${indent}"c": "3"`,
  `${indent}},`,
  `${indent}"devDependencies": {`,
  `${indent}${indent}"d": "4"`,
  `${indent}}`,
  '}',
  '',
].join('\n');

test('deps: 区分の最後の要素を消すと、前の行の , を外し、JSON として読める', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG(), ['c']);
  assert.equal(r.ok, true, r.error);
  const j = JSON.parse(r.text);
  assert.deepEqual(j.dependencies, { a: '1', b: '2' });
  assert.deepEqual(r.removed, [{ name: 'c', section: 'dependencies' }]);
});

test('deps: 真ん中の要素を消しても、ほかの行の整形は変えない', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG(), ['b']);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.text, PKG().replace('    "b": "2",\n', ''));
});

test('deps: 区分の要素を全部消しても JSON として読める', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG(), ['a', 'b', 'c']);
  assert.equal(r.ok, true, r.error);
  const j = JSON.parse(r.text);
  assert.deepEqual(j.dependencies ?? {}, {});
  assert.deepEqual(j.devDependencies, { d: '4' });
});

test('deps: 別の区分の最後の要素（devDependencies の d）も消せる', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG(), ['d']);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.removed, [{ name: 'd', section: 'devDependencies' }]);
});

test('deps: 2つの区分に同じ名前があれば、両方から消す', need('deps', 'removeDependenciesFromText'), () => {
  const text = '{\n  "dependencies": {\n    "a": "1",\n    "z": "1"\n  },\n  "devDependencies": {\n    "a": "1"\n  }\n}\n';
  const r = M('deps').removeDependenciesFromText(text, ['a']);
  assert.equal(r.ok, true, r.error);
  const j = JSON.parse(r.text);
  assert.equal('a' in (j.dependencies ?? {}), false);
  assert.equal('a' in (j.devDependencies ?? {}), false);
  assert.equal(r.removed.filter((x) => x.name === 'a').length, 2);
});

test('deps: タブの字下げでも読める', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG('\t'), ['c']);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(JSON.parse(r.text).dependencies, { a: '1', b: '2' });
  assert.ok(r.text.includes('\t"name"'));
});

test('deps: どの区分にも無い名前は missing に入り、ok のまま（警告は呼ぶ側）', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText(PKG(), ['a', 'nope']);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.missing, ['nope']);
});

test('deps: JSON として読めなければ ok:false', need('deps', 'removeDependenciesFromText'), () => {
  const r = M('deps').removeDependenciesFromText('{ "dependencies": { "a": ', ['a']);
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test('deps: 名前が部分一致する別の依存（@scope/a と a）を巻き込まない', need('deps', 'removeDependenciesFromText'), () => {
  const text = '{\n  "dependencies": {\n    "@s/a": "1",\n    "a": "1",\n    "ab": "1"\n  }\n}\n';
  const r = M('deps').removeDependenciesFromText(text, ['a']);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(JSON.parse(r.text).dependencies, { '@s/a': '1', ab: '1' });
});

// ---------------------------------------------------------------------------
// overlay
// ---------------------------------------------------------------------------
test('overlay: validateOverlay は正しければ空、知らない項目は誤り、$ で始まる項目は読まない', need('overlay', 'validateOverlay'), () => {
  const v = M('overlay').validateOverlay;
  assert.deepEqual(v({ set: {}, remove: [], removeIfPresent: [] }), []);
  assert.deepEqual(v({ $comment: 'x', set: {} }), []);
  assert.ok(v({ set: {}, bogus: 1 }).length > 0);
  assert.ok(v({ set: {}, remove: ['a'], removeIfPresent: ['a'] }).length > 0, 'remove と removeIfPresent の重なり');
  assert.ok(v({ set: { a: 1 }, remove: ['a'] }).length > 0, 'set と remove の重なり');
  assert.ok(v({ set: { a: 1 }, removeIfPresent: ['a'] }).length > 0, 'set と removeIfPresent の重なり');
  assert.ok(v({ set: [] }).length > 0, 'set は配列ではなくオブジェクト');
  assert.ok(v({ remove: 'a' }).length > 0, 'remove は配列');
});

test('overlay: applyProductOverlay は errors のとき product を元の写しで返す', need('overlay', 'applyProductOverlay'), () => {
  const p = { a: 1 };
  const r = M('overlay').applyProductOverlay(p, { set: { a: 2 }, remove: ['a'] });
  assert.ok(r.errors.length > 0);
  assert.deepEqual(r.product, { a: 1 });
});

test('overlay: set・removed・removedIfPresent をキーの配列で返す。入力を書き換えない', need('overlay', 'applyProductOverlay'), () => {
  const p = { a: 1, b: 2, c: 3 };
  const o = { $comment: 'x', set: { a: 9 }, remove: ['b'], removeIfPresent: ['c', 'zz'] };
  const p0 = JSON.stringify(p);
  const o0 = JSON.stringify(o);
  const r = M('overlay').applyProductOverlay(p, o);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.set, ['a']);
  assert.deepEqual(r.removed, ['b']);
  assert.deepEqual(r.removedIfPresent, ['c']);
  assert.deepEqual(r.product, { a: 9 });
  assert.equal(JSON.stringify(p), p0);
  assert.equal(JSON.stringify(o), o0);
  assert.ok(r.warnings.some((w) => w.includes('c')), '本家が足したキーは警告');
  assert.ok(!r.warnings.some((w) => w.includes('zz')), '無いキーは警告しない');
});

test('overlay: 既にあるキーの位置は変えず、新しいキーは末尾に足す（docs/apply-design 2.1）', need('overlay', 'applyProductOverlay'), () => {
  const r = M('overlay').applyProductOverlay({ a: 1, b: 2, c: 3 }, { set: { b: 20, z: 26 } });
  assert.deepEqual(Object.keys(r.product), ['a', 'b', 'c', 'z']);
});

test('overlay: removeProductKeys は removed と missing を分ける', need('overlay', 'removeProductKeys'), () => {
  const r = M('overlay').removeProductKeys({ a: 1, b: 2 }, ['a', 'q']);
  assert.deepEqual(r.product, { b: 2 });
  assert.deepEqual(r.removed, ['a']);
  assert.deepEqual(r.missing, ['q']);
});

test('overlay: detectIndent はタブか空白。stringifyLike は字下げと末尾の改行の有無を保つ', need('overlay', 'stringifyLike'), () => {
  const ov = M('overlay');
  assert.equal(ov.detectIndent('{\n\t"a": 1\n}\n'), '\t');
  assert.equal(ov.detectIndent('{\n    "a": 1\n}\n'), '    ');
  assert.equal(ov.stringifyLike({ a: 1 }, '{\n\t"b": 1\n}\n'), '{\n\t"a": 1\n}\n');
  assert.equal(ov.stringifyLike({ a: 1 }, '{\n\t"b": 1\n}'), '{\n\t"a": 1\n}');
  assert.equal(ov.stringifyLike({ a: 1 }, '{\r\n  "b": 1\r\n}\r\n'), '{\r\n  "a": 1\r\n}\r\n');
});

// ---------------------------------------------------------------------------
// units
// ---------------------------------------------------------------------------
const U = (id, order, extra = {}) => ({ id, stage: id[0], order, enabled: true, after: [], ...extra });

test('units: planUnits は同じ order を誤りにする', need('units', 'planUnits'), () => {
  const r = M('units').planUnits([U('A-1-x', 110), U('A-2-y', 110)], {});
  assert.ok(r.errors.length > 0);
});

test('units: planUnits は同じ id を誤りにする', need('units', 'planUnits'), () => {
  const r = M('units').planUnits([U('A-1-x', 110), U('A-1-x', 120)], {});
  assert.ok(r.errors.length > 0);
});

test('units: 無効な単位は skipped に reason:disabled で入る。only で挙げれば無効でも当てる', need('units', 'planUnits'), () => {
  const units = [U('A-1-x', 110), U('A-2-y', 120, { enabled: false })];
  const r = M('units').planUnits(units, {});
  assert.deepEqual(r.plan.map((u) => u.id), ['A-1-x']);
  assert.deepEqual(r.skipped, [{ id: 'A-2-y', reason: 'disabled' }]);
  const o = M('units').planUnits(units, { only: ['A-2-y'] });
  assert.deepEqual(o.errors, []);
  assert.deepEqual(o.plan.map((u) => u.id), ['A-2-y']);
  assert.deepEqual(o.skipped.map((s) => s.reason), ['not in --only']);
});

test('units: only・until に知らない ID があれば誤り', need('units', 'planUnits'), () => {
  const units = [U('A-1-x', 110)];
  assert.ok(M('units').planUnits(units, { only: ['A-9-none'] }).errors.length > 0);
  assert.ok(M('units').planUnits(units, { until: 'A-9-none' }).errors.length > 0);
});

test('units: until はその単位を含めて止め、後ろは skipped（reason:after --until）', need('units', 'planUnits'), () => {
  const r = M('units').planUnits([U('A-1-x', 110), U('A-2-y', 120), U('A-3-z', 130)], { until: 'A-2-y' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.plan.map((u) => u.id), ['A-1-x', 'A-2-y']);
  assert.deepEqual(r.skipped, [{ id: 'A-3-z', reason: 'after --until' }]);
});

test('units: until が無効な単位を指すときの扱い（設計書に明記なし。結果を記録する）', need('units', 'planUnits'), () => {
  // 仕様（docs/03 の8節）は「その単位まで当てる」。無効な単位を指したときは、誤りにするか、飛ばして続けるかの二択。
  // どちらでも許す（黙って無効な単位を当てないことだけを確かめる）。
  const r = M('units').planUnits([U('A-1-x', 110), U('A-2-y', 120, { enabled: false }), U('A-3-z', 130)], { until: 'A-2-y' });
  assert.ok(!r.plan.some((u) => u.id === 'A-2-y'), '無効な単位を plan に入れない');
});

test('units: after が後ろの単位を指すと、理由に「後ろにある」', need('units', 'planUnits'), () => {
  const r = M('units').planUnits([U('A-1-x', 110, { after: ['A-2-y'] }), U('A-2-y', 120)], {});
  assert.ok(r.errors.some((e) => e.includes('後ろにある')), r.errors.join('|'));
});

test('units: after の誤りの文言（無い・有効でない・--only に入っていない）', need('units', 'planUnits'), () => {
  const pu = M('units').planUnits;
  assert.ok(pu([U('A-2-y', 120, { after: ['A-1-x'] })], {}).errors.some((e) => e.includes('無い')));
  assert.ok(pu([U('A-1-x', 110, { enabled: false }), U('A-2-y', 120, { after: ['A-1-x'] })], {}).errors.some((e) => e.includes('有効でない')));
  assert.ok(pu([U('A-1-x', 110), U('A-2-y', 120, { after: ['A-1-x'] })], { only: ['A-2-y'] }).errors.some((e) => e.includes('--only に入っていない')));
});

test('units: checkAfter は満たさない ID だけを返す', need('units', 'checkAfter'), () => {
  assert.deepEqual(M('units').checkAfter(U('A-3-z', 130, { after: ['A-1-x', 'A-2-y'] }), new Set(['A-1-x'])), ['A-2-y']);
  assert.deepEqual(M('units').checkAfter(U('A-3-z', 130), new Set()), []);
});

test('units: validateUnit は正しい単位で空。id とフォルダの違い・stage の違い・order の範囲外・enabled の型を誤りにする', need('units', 'validateUnit'), () => {
  const v = M('units').validateUnit;
  const ok = U('A-1-x', 110, { intent: 'x', delete: [], removeLines: [], productRemove: [], kept: [], checks: {}, smoke: ['base'] });
  assert.deepEqual(v(ok, 'A-1-x'), []);
  assert.ok(v(ok, 'A-1-other').length > 0, 'id とフォルダ');
  assert.ok(v({ ...ok, stage: 'B' }, 'A-1-x').length > 0, 'stage');
  for (const order of [99, 200, 0, 110.5, '110']) assert.ok(v({ ...ok, order }, 'A-1-x').length > 0, `order ${order}`);
  assert.ok(v({ ...ok, enabled: 'false' }, 'A-1-x').length > 0, 'enabled');
  assert.ok(v({ ...ok, id: 'A-1-Bad_Name' }, 'A-1-Bad_Name').length > 0, 'id の形');
});

test('units: validateUnit は order の段階ごとの範囲（B=200台・C=300台）を見る', need('units', 'validateUnit'), () => {
  const v = M('units').validateUnit;
  const mk = (id, order) => U(id, order, { intent: 'x', checks: {}, smoke: ['base'] });
  assert.deepEqual(v(mk('B-1-x', 210), 'B-1-x'), []);
  assert.ok(v(mk('B-1-x', 110), 'B-1-x').length > 0);
  assert.deepEqual(v(mk('C-1-x', 310), 'C-1-x'), []);
  assert.ok(v(mk('C-1-x', 210), 'C-1-x').length > 0);
});

test('units: validateUnit は patch にパスの区切りが入ると誤り。delete・removeLines.file の絶対パスと .. も誤り', need('units', 'validateUnit'), () => {
  const v = M('units').validateUnit;
  const base = U('A-1-x', 110, { intent: 'x', checks: {}, smoke: ['base'] });
  assert.ok(v({ ...base, patch: '../edits.patch' }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, patch: 'sub/edits.patch' }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, delete: ['/abs'] }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, delete: ['C:\\abs'] }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, delete: ['a/../b'] }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, removeLines: [{ file: '../x', line: 'a' }] }, 'A-1-x').length > 0);
  assert.ok(v({ ...base, removeLines: [{ file: 'x' }] }, 'A-1-x').length > 0, 'line が無い');
});

test('units: normalizeRelPath と isUnderPath', { skip: M('units').normalizeRelPath ? false : '実装なし' }, () => {
  const { normalizeRelPath: n, isUnderPath: u } = M('units');
  assert.equal(n('a\\b/c'), 'a/b/c');
  for (const bad of ['', '/a', 'C:/a', '../a', 'a/../b', null, 5]) assert.equal(n(bad), null, String(bad));
  assert.equal(u('a/b', 'a'), true);
  assert.equal(u('a', 'a'), true);
  assert.equal(u('ab', 'a'), false, '前方一致の誤り');
  assert.equal(u('a', 'a/b'), false);
});

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------
test('classify: keepNamesOf は4つの形を読む', need('classify', 'keepNamesOf'), () => {
  const k = M('classify').keepNamesOf;
  assert.deepEqual([...k(['a', 'b'])].sort(), ['a', 'b']);
  assert.deepEqual([...k([{ name: 'a', reason: 'x' }, { id: 'b' }])].sort(), ['a', 'b']);
  assert.deepEqual([...k({ keep: [{ name: 'a' }] })], ['a']);
  assert.deepEqual([...k({ extensions: ['a'] })], ['a']);
  assert.deepEqual([...k({ a: 'x', b: 'y' })].sort(), ['a', 'b']);
});

test('classify: mydist・notion-sync は未分類に数えない（own）', need('classify', 'findUnclassifiedExtensions'), () => {
  const r = M('classify').findUnclassifiedExtensions(['mydist', 'notion-sync', 'newone'], { keep: [] }, []);
  assert.deepEqual(r.map((x) => x.name), ['newone']);
});

test('classify: extensions/<名前>/<下> の delete は拡張を覆わない。extensions/<名前>/ は覆う', need('classify', 'findUnclassifiedExtensions'), () => {
  const units = [{ id: 'A-1-x', delete: ['extensions/a/src', 'extensions/b/', 'extensions/c'] }];
  const r = M('classify').findUnclassifiedExtensions(['a', 'b', 'c'], { keep: [] }, units);
  assert.deepEqual(r.map((x) => x.name), ['a']);
});

test('classify: 未分類の highlight は語の配列。名前の順に返す', need('classify', 'findUnclassifiedExtensions'), () => {
  const r = M('classify').findUnclassifiedExtensions(['zz-chat', 'aa-plain'], { keep: [] }, []);
  assert.deepEqual(r.map((x) => x.name), ['aa-plain', 'zz-chat']);
  assert.deepEqual(r[0].highlight, []);
  assert.ok(r[1].highlight.includes('chat'));
});

test('classify: highlightWords は大文字小文字を問わず、docs/03 の6節の語を含む', need('classify', 'highlightWords'), () => {
  const h = M('classify').highlightWords;
  for (const w of ['chat', 'agent', 'copilot', 'mcp', 'telemetry', 'experiment', 'survey']) {
    assert.ok(h(`src/vs/x/${w.toUpperCase()}Thing`).includes(w), w);
  }
  assert.deepEqual(h('src/vs/platform/clock'), []);
});

test('classify: diffNameLists は added と removed を並べて返す', need('classify', 'diffNameLists'), () => {
  assert.deepEqual(M('classify').diffNameLists(['b', 'a', 'x'], ['c', 'a', 'd']), { added: ['c', 'd'], removed: ['b', 'x'] });
});

test('classify: addedImportLines は増えた import の行だけ（前後の空白を除く）', need('classify', 'addedImportLines'), () => {
  const prev = "import './a.js';\nimport './b.js';\n";
  const next = "import './a.js';\n  import './c.js';  \nimport './b.js';\n// import './d.js';\n";
  assert.deepEqual(M('classify').addedImportLines(prev, next), ["import './c.js';"]);
});

test('classify: addedDependencies は区分が移っただけのものを数えない。peerDependencies は数えない', need('classify', 'addedDependencies'), () => {
  const prev = { dependencies: { a: '1' }, devDependencies: { b: '1' } };
  const next = { dependencies: { b: '1', c: '2' }, devDependencies: { a: '1', d: '3' }, optionalDependencies: { e: '4' }, peerDependencies: { f: '5' } };
  const r = M('classify').addedDependencies(prev, next);
  assert.deepEqual(r.map((x) => x.name).sort(), ['c', 'd', 'e']);
  assert.deepEqual(r.find((x) => x.name === 'c'), { name: 'c', section: 'dependencies', version: '2' });
});

// ---------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------
test('keys: settingKeysToCheck は mydist の configurationDefaults（言語の上書き [x] を除く）と overlay の shukoConfigurationDefaults', need('keys', 'settingKeysToCheck'), () => {
  const mydist = { contributes: { configurationDefaults: { 'editor.a': 1, '[python]': { 'editor.b': 2 } } } };
  const overlay = { set: { shukoConfigurationDefaults: { 'telemetry.telemetryLevel': 'off' } } };
  const r = M('keys').settingKeysToCheck(mydist, overlay);
  assert.deepEqual(r.map((x) => `${x.from}:${x.key}`).sort(), ['mydist:editor.a', 'shukoConfigurationDefaults:telemetry.telemetryLevel']);
});

test('keys: configurationPropertyKeys はオブジェクトでも配列でも properties のキーを返す。literalIncluded は3種の引用符', need('keys', 'configurationPropertyKeys'), () => {
  const k = M('keys').configurationPropertyKeys;
  assert.deepEqual(k({ contributes: { configuration: { properties: { a: {}, b: {} } } } }).sort(), ['a', 'b']);
  assert.deepEqual(k({ contributes: { configuration: [{ properties: { a: {} } }, { properties: { c: {} } }] } }).sort(), ['a', 'c']);
  assert.deepEqual(k({}), []);
  const L = M('keys').literalIncluded;
  assert.equal(L("x 'a.b' y", 'a.b'), true);
  assert.equal(L('x "a.b" y', 'a.b'), true);
  assert.equal(L('x `a.b` y', 'a.b'), true);
  assert.equal(L('x a.b y', 'a.b'), false);
  assert.equal(L("x 'a.bc' y", 'a.b'), false);
});

// ---------------------------------------------------------------------------
// lockfile（docs/03 の5.4: 差分が「消した依存の削除」だけであること）
// ---------------------------------------------------------------------------
const LOCK = ({ extra = '', depA = '1.0.0', settings = 'autoInstallPeers: true', pkgs = ['lodash@4.17.21'], importers = '' } = {}) => [
  "lockfileVersion: '9.0'",
  '',
  'settings:',
  `  ${settings}`,
  '',
  'importers:',
  '',
  '  .:',
  '    dependencies:',
  "      '@scope/name':",
  '        specifier: ^1.0.0',
  `        version: ${depA}`,
  '      lodash:',
  '        specifier: ^4.17.21',
  '        version: 4.17.21',
  extra,
  importers,
  '',
  'packages:',
  '',
  ...pkgs.flatMap((p) => [`  '${p}':`, '    resolution: {integrity: sha512-x}', '']),
  'snapshots:',
  '',
  ...pkgs.flatMap((p) => [`  '${p}': {}`, '']),
].join('\n');

test('lockfile: parsePnpmLock は引用符つきのキー（@scope/name、packages・snapshots のキー）を読む', need('lockfile', 'parsePnpmLock'), () => {
  const r = M('lockfile').parsePnpmLock(LOCK());
  assert.deepEqual(r.importers['.'].dependencies['@scope/name'], { specifier: '^1.0.0', version: '1.0.0' });
  assert.deepEqual(r.importers['.'].dependencies.lodash, { specifier: '^4.17.21', version: '4.17.21' });
  assert.deepEqual([...r.packages], ['lodash@4.17.21']);
  assert.deepEqual([...r.snapshots], ['lodash@4.17.21']);
  assert.ok('settings' in r.sections);
  assert.ok('lockfileVersion' in r.sections);
  assert.ok(!('importers' in r.sections) && !('packages' in r.sections) && !('snapshots' in r.sections));
});

test("lockfile: parsePnpmLock は名前に '' を含むキー（YAML の引用符のエスケープ）を壊さない", need('lockfile', 'parsePnpmLock'), () => {
  const text = LOCK({ pkgs: ["we''ird@1.0.0"] });
  const r = M('lockfile').parsePnpmLock(text);
  const names = [...r.packages];
  assert.equal(names.length, 1);
  assert.ok(names[0].includes('we') && names[0].includes('ird@1.0.0'), names[0]);
});

test('lockfile: 同じなら ok。節・版・依存に変化なし', need('lockfile', 'compareLockfile'), () => {
  const r = M('lockfile').compareLockfile(LOCK(), LOCK(), {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.changedSections, []);
});

test('lockfile: 予期した依存の削除は ok、予期しない削除は ng', need('lockfile', 'compareLockfile'), () => {
  const before = LOCK();
  const after = before.replace("      lodash:\n        specifier: ^4.17.21\n        version: 4.17.21\n", '');
  const ok = M('lockfile').compareLockfile(before, after, { removedDeps: { '.': ['lodash'] } });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const ng = M('lockfile').compareLockfile(before, after, {});
  assert.equal(ng.ok, false);
  assert.ok(JSON.stringify(ng.unexpectedRemovedDeps).includes('lodash'));
});

test('lockfile: 残った依存の version が変わったら ng（changedDeps）', need('lockfile', 'compareLockfile'), () => {
  const r = M('lockfile').compareLockfile(LOCK(), LOCK({ depA: '1.0.1' }), {});
  assert.equal(r.ok, false);
  assert.ok(JSON.stringify(r.changedDeps).includes('@scope/name'));
});

test('lockfile: settings などの節が変わったら ng（changedSections）', need('lockfile', 'compareLockfile'), () => {
  const r = M('lockfile').compareLockfile(LOCK(), LOCK({ settings: 'autoInstallPeers: false' }), {});
  assert.equal(r.ok, false);
  assert.ok(r.changedSections.includes('settings'));
});

test('lockfile: packages・snapshots が増えたら ng。減るだけなら、それ自体では ng にしない', need('lockfile', 'compareLockfile'), () => {
  const grown = M('lockfile').compareLockfile(LOCK(), LOCK({ pkgs: ['lodash@4.17.21', 'new@1.0.0'] }), {});
  assert.equal(grown.ok, false);
  assert.ok(JSON.stringify(grown.addedPackages).includes('new@1.0.0'));
  assert.ok(JSON.stringify(grown.addedSnapshots).includes('new@1.0.0'));
  const shrunk = M('lockfile').compareLockfile(LOCK({ pkgs: ['lodash@4.17.21', 'old@1.0.0'] }), LOCK(), {});
  assert.equal(shrunk.ok, true, JSON.stringify(shrunk));
  assert.ok(JSON.stringify(shrunk.removedPackages).includes('old@1.0.0'));
});

test('lockfile: importer の増加は ng。予期した importer の削除は ok、予期しない削除は ng', need('lockfile', 'compareLockfile'), () => {
  const sub = '\n  extensions/copilot:\n    dependencies:\n      zed:\n        specifier: ^1.0.0\n        version: 1.0.0\n';
  const withSub = LOCK({ importers: sub });
  const grown = M('lockfile').compareLockfile(LOCK(), withSub, {});
  assert.equal(grown.ok, false);
  assert.ok(grown.addedImporters.includes('extensions/copilot'));
  assert.equal(M('lockfile').compareLockfile(withSub, LOCK(), { removedImporters: ['extensions/copilot'] }).ok, true);
  const ng = M('lockfile').compareLockfile(withSub, LOCK(), {});
  assert.equal(ng.ok, false);
  assert.ok(ng.unexpectedRemovedImporters.includes('extensions/copilot'));
});

test('lockfile: link: で消した importer を指す依存の削除は、予期したものとみなす', need('lockfile', 'compareLockfile'), () => {
  const sub = '\n  extensions/copilot:\n    dependencies:\n      zed:\n        specifier: ^1.0.0\n        version: 1.0.0\n';
  const link = "      copilot:\n        specifier: file:extensions/copilot\n        version: link:extensions/copilot";
  const before = LOCK({ importers: sub, extra: link });
  const after = LOCK();
  const r = M('lockfile').compareLockfile(before, after, { removedImporters: ['extensions/copilot'] });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('lockfile: expectedLockRemovals は単位の delete の下の importer と、removeDependencies の package.json に当たる importer', need('lockfile', 'expectedLockRemovals'), () => {
  const units = [{ id: 'A-1-x', delete: ['extensions/copilot'], removeDependencies: { 'package.json': ['a'], 'build/package.json': ['b'] } }];
  const r = M('lockfile').expectedLockRemovals('', ['.', 'extensions/copilot', 'extensions/other', 'build'], units);
  assert.deepEqual([...r.removedImporters], ['extensions/copilot']);
  assert.deepEqual(r.removedDeps['.'], ['a']);
  assert.deepEqual(r.removedDeps.build, ['b']);
});

// ---------------------------------------------------------------------------
// git.shouldKeepCr
// ---------------------------------------------------------------------------
test('git: shouldKeepCr は一部の行だけ CR のとき true。全部 CRLF・全部 LF なら false', need('git', 'shouldKeepCr'), () => {
  const f = M('git').shouldKeepCr;
  assert.equal(f('a\r\nb\r\nc\r\n'), false);
  assert.equal(f('a\nb\nc\n'), false);
  assert.equal(f('a\r\nb\nc\r\n'), true);
  assert.equal(f(''), false);
});
