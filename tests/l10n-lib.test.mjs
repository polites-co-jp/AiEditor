// scripts/lib/l10n-ja.mjs（日本語パックを作る・数える純粋な部品）の単体テスト。
// 仕様: docs/04-bundled-extensions.md の7節、tasks/2026-11-17-l10n-ja/l10n-design.md、蒙恬の引き継ぎ（l10n-ja/handoff-notes-meng-tian.md）の4節の表。
// 期待値は、その文書の説明と、部品の先頭の言葉の定義（文言の表・訳の層・足した訳・除外）から書いた。
// 「M2」の節は、検証（l10n-ja-verify の M2）で蒙恬が強める placeholderMismatch の仕様から書いた。強める前は落ちる（下の節の説明を見る）。
// Run: node --test tests/l10n-lib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './build/helpers.mjs';
import {
  hasJapanese, coreFromNls, recordFromL10nJson, recordFromPackageNls, countStrings, flattenStrings, manifestLiterals, lookup,
  buildPack, exclusionTree, coverage, validateExclusions, validateAdded, placeholderMismatch, placeholderMarks, decodeUnicodeEscapes, i18nFile, extensionContents, SECTIONS, EX_SECTIONS,
} from '../scripts/lib/l10n-ja.mjs';

// ---- 小さな文言の表 -------------------------------------------------------------------------------------------
const strings = () => ({
  core: { 'vs/a': { k1: 'Open File', k2: 'Save' }, 'vs/b': { k1: 'Close' } },
  extensions: {
    'vscode.git': { folder: 'git', own: false, package: { 'cmd.clone': 'Clone', displayName: 'Git' }, bundle: { 'Pull from {0}': 'Pull from {0}' } },
    'sukuna.mydist': { folder: 'mydist', own: true, package: {}, bundle: {}, literal: { displayName: 'Sukuna の既定', description: 'Defaults only' } },
  },
});

// ---- hasJapanese ----------------------------------------------------------------------------------------------
test('hasJapanese: ひらがな・カタカナ・漢字・全角の記号を日本語とみなす。英字・半角の記号だけなら偽', () => {
  assert.equal(hasJapanese('ファイルを開く'), true);
  assert.equal(hasJapanese('ひらがな'), true);
  assert.equal(hasJapanese('カタカナ'), true);
  assert.equal(hasJapanese('漢字'), true);
  assert.equal(hasJapanese('Git：状態'), true); // 全角のコロン
  assert.equal(hasJapanese('（Esc）'), true);
  assert.equal(hasJapanese('Open File'), false);
  assert.equal(hasJapanese('{0}: {1} (Esc) 100%'), false);
  assert.equal(hasJapanese(''), false);
  assert.equal(hasJapanese(undefined), false); // String(undefined) = "undefined"
});

// ---- coreFromNls ----------------------------------------------------------------------------------------------
test('coreFromNls: モジュールと鍵で英語の表にする（平らな配列を順に配る）', () => {
  const core = coreFromNls([['vs/a', ['k1', 'k2']], ['vs/b', ['k1']]], ['x', 'y', 'z']);
  assert.deepEqual(core, { 'vs/a': { k1: 'x', k2: 'y' }, 'vs/b': { k1: 'z' } });
});
test('coreFromNls: 同じ鍵名が別モジュールにあっても混ざらない', () => {
  const core = coreFromNls([['m1', ['k']], ['m2', ['k']]], ['one', 'two']);
  assert.equal(core.m1.k, 'one');
  assert.equal(core.m2.k, 'two');
});
test('coreFromNls: 同じモジュール・同じ鍵が2度出ると1つになる（件数は並びの数より少ない）', () => {
  const core = coreFromNls([['m', ['k']], ['m', ['k']]], ['same', 'same']);
  assert.deepEqual(core, { m: { k: 'same' } });
  assert.equal(countStrings({ core }).core, 1);
});
test('coreFromNls: 鍵の数より文言が少ない・多いと例外', () => {
  assert.throws(() => coreFromNls([['m', ['a', 'b']]], ['only']), /多い|鍵の数/);
  assert.throws(() => coreFromNls([['m', ['a']]], ['x', 'extra']), /違う|数/);
});
test('coreFromNls: 配列でない入力・形の違う項目は例外。空は空の表', () => {
  assert.throws(() => coreFromNls({}, []));
  assert.throws(() => coreFromNls([], {}));
  assert.throws(() => coreFromNls([['m']], []), /形/);
  assert.throws(() => coreFromNls([[1, ['k']]], ['x']), /形/);
  assert.deepEqual(coreFromNls([], []), {});
});

// ---- recordFromL10nJson / recordFromPackageNls ----------------------------------------------------------------
test('recordFromL10nJson: 文字列と { message, comment } の両方から { 鍵: 英語 } を作る。ほかの型は拾わない', () => {
  const r = recordFromL10nJson({ a: 'A', b: { message: 'B', comment: ['c'] }, c: 3, d: null, e: { message: 5 }, f: { comment: ['x'] } });
  assert.deepEqual(r, { a: 'A', b: 'B' });
});
test('recordFromL10nJson・recordFromPackageNls: オブジェクトでない入力は空。同じ規則', () => {
  for (const f of [recordFromL10nJson, recordFromPackageNls]) {
    assert.deepEqual(f(null), {});
    assert.deepEqual(f([]), {});
    assert.deepEqual(f('x'), {});
    assert.deepEqual(f({ 'cmd.x': { message: 'X', comment: [] }, y: 'Y' }), { 'cmd.x': 'X', y: 'Y' });
  }
});

// ---- manifestLiterals -----------------------------------------------------------------------------------------
test('manifestLiterals: %key% は拾わない。画面に出る直書きの文字列だけを、場所の名前つきで拾う', () => {
  const lit = manifestLiterals({
    displayName: 'Sukuna の既定',
    description: '%description%',
    contributes: {
      commands: [{ command: 'x.open', title: '開く', category: 'Sukuna' }, { command: 'x.t', title: '%x.t%' }],
      configuration: { title: '設定', properties: { 'x.a': { description: 'A の説明', markdownDescription: '**A**' }, 'x.b': { description: '%x.b%' } } },
      localizations: [{ languageId: 'ja', localizedLanguageName: '日本語' }],
    },
  });
  assert.deepEqual(lit, {
    displayName: 'Sukuna の既定',
    'commands.x.open.title': '開く',
    'commands.x.open.category': 'Sukuna',
    'configuration[0].title': '設定',
    'configuration.x.a.description': 'A の説明',
    'configuration.x.a.markdownDescription': '**A**',
    'localizations.ja.localizedLanguageName': '日本語',
  });
});
test('manifestLiterals: configuration が配列でも読む。空の文字列・文字列でない値・contributes が無い manifest は拾わない', () => {
  const lit = manifestLiterals({ displayName: '', description: 5, contributes: { configuration: [{ title: 'A' }, { title: 'B', properties: { p: { description: 'P' } } }] } });
  assert.deepEqual(lit, { 'configuration[0].title': 'A', 'configuration[1].title': 'B', 'configuration.p.description': 'P' });
  assert.deepEqual(manifestLiterals({}), {});
  assert.deepEqual(manifestLiterals({ displayName: 'x', contributes: 'bad' }), { displayName: 'x' });
});

// ---- flattenStrings / countStrings ----------------------------------------------------------------------------
test('flattenStrings: area（core・package・bundle・literal）ごとの平らな一覧', () => {
  const flat = flattenStrings(strings());
  const by = (area) => flat.filter((t) => t.area === area).map((t) => `${t.owner}#${t.key}`).sort();
  assert.deepEqual(by('core'), ['vs/a#k1', 'vs/a#k2', 'vs/b#k1']);
  assert.deepEqual(by('package'), ['vscode.git#cmd.clone', 'vscode.git#displayName']);
  assert.deepEqual(by('bundle'), ['vscode.git#Pull from {0}']);
  assert.deepEqual(by('literal'), ['sukuna.mydist#description', 'sukuna.mydist#displayName']);
  assert.equal(flat.length, 3 + 2 + 1 + 2);
  assert.deepEqual(flat.find((t) => t.area === 'core' && t.key === 'k2'), { area: 'core', owner: 'vs/a', key: 'k2', en: 'Save' });
});
test('flattenStrings: 空の表・部分の表でも例外にならない', () => {
  assert.deepEqual(flattenStrings({}), []);
  assert.deepEqual(flattenStrings({ core: {}, extensions: { x: {} } }), []);
});
test('countStrings: core・拡張の件数と合計。literal があれば拡張の内訳に出る', () => {
  const c = countStrings(strings());
  assert.equal(c.core, 3);
  assert.equal(c.extensions, 2 + 1 + 2);
  assert.equal(c.total, 3 + 5);
  assert.deepEqual(c.perExtension['vscode.git'], { package: 2, bundle: 1 });
  assert.deepEqual(c.perExtension['sukuna.mydist'], { package: 0, bundle: 0, literal: 2 });
  assert.deepEqual(countStrings({}), { core: 0, extensions: 0, total: 0, perExtension: {} });
});

// ---- lookup ---------------------------------------------------------------------------------------------------
test('lookup: 本体は core[モジュール][鍵]、拡張は extensions[ID][area][鍵]。無ければ undefined', () => {
  const t = { core: { m: { k: 'v' } }, extensions: { id: { package: { p: 'P' }, bundle: { b: 'B' } } } };
  assert.equal(lookup(t, 'core', 'm', 'k'), 'v');
  assert.equal(lookup(t, 'package', 'id', 'p'), 'P');
  assert.equal(lookup(t, 'bundle', 'id', 'b'), 'B');
  assert.equal(lookup(t, 'bundle', 'id', 'p'), undefined, '別の area の鍵は引かない');
  assert.equal(lookup(t, 'core', 'm', 'zz'), undefined);
  assert.equal(lookup(t, 'core', 'nomod', 'k'), undefined);
  assert.equal(lookup(t, 'package', 'noid', 'p'), undefined);
  assert.equal(lookup(null, 'core', 'm', 'k'), undefined);
  assert.equal(lookup({}, 'package', 'id', 'p'), undefined);
});
test('lookup: 継承された名前（constructor・__proto__・toString）を鍵として拾わない', () => {
  const t = { core: { m: { k: 'v' } }, extensions: { id: { package: { p: 'P' } } } };
  for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(lookup(t, 'core', bad, 'k'), undefined, bad);
    assert.equal(lookup(t, 'core', 'm', bad), undefined, bad);
    assert.equal(lookup(t, 'package', 'id', bad), undefined, bad);
    assert.equal(lookup(t, 'package', bad, 'p'), undefined, bad);
  }
});

// ---- buildPack ------------------------------------------------------------------------------------------------
const layer = (name, tree) => ({ name, core: {}, extensions: {}, ...tree });
const addedFile = (version, tree) => ({ version, core: {}, extensions: {}, ...tree });

test('buildPack: 先の層が勝つ。どの層から入れたかを provenance に数える', () => {
  const strs = { core: { m: { k1: 'A', k2: 'B' } } };
  const l1 = layer('first', { core: { m: { k1: '一' } } });
  const l2 = layer('second', { core: { m: { k1: '二', k2: '弐' } } });
  const r = buildPack({ strings: strs, layers: [l1, l2] });
  assert.equal(r.pack.core.m.k1, '一');
  assert.equal(r.pack.core.m.k2, '弐');
  assert.deepEqual(r.provenance, { first: 1, second: 1 });
  assert.deepEqual(r.redundantAdded, []);
  assert.deepEqual(r.staleAdded, []);
});
test('buildPack: 空の訳は訳と見なさず、次の層へ進む', () => {
  const r = buildPack({ strings: { core: { m: { k: 'A' } } }, layers: [layer('a', { core: { m: { k: '' } } }), layer('b', { core: { m: { k: '二' } } })] });
  assert.equal(r.pack.core.m.k, '二');
  assert.deepEqual(r.provenance, { b: 1 });
});
test('buildPack: 表にある鍵だけをパックに入れる（層の余分な鍵は入れない）', () => {
  const r = buildPack({ strings: { core: { m: { k: 'A' } } }, layers: [layer('a', { core: { m: { k: '一', extra: '余分' }, other: { z: 'z' } } })] });
  assert.deepEqual(r.pack.core, { m: { k: '一' } });
});
test('buildPack: 足した訳は、公式の層に訳が無い文言にだけ使う。provenance は added:<版>', () => {
  const strs = { core: { m: { k: 'Hello' } } };
  const r = buildPack({ strings: strs, layers: [layer('a', {})], added: [addedFile('1.146.0', { core: { m: { k: { en: 'Hello', ja: 'こんにちは' } } } })] });
  assert.equal(r.pack.core.m.k, 'こんにちは');
  assert.deepEqual(r.provenance, { 'added:1.146.0': 1 });
  assert.deepEqual(r.redundantAdded, []);
  assert.deepEqual(r.staleAdded, []);
});
test('buildPack: 公式の層にも訳がある足した訳は使わず、redundantAdded に出す（公式が勝つ）', () => {
  const strs = { core: { m: { k: 'Hello' } } };
  const r = buildPack({ strings: strs, layers: [layer('official', { core: { m: { k: '公式' } } })], added: [addedFile('1.146.0', { core: { m: { k: { en: 'Hello', ja: '課の訳' } } } })] });
  assert.equal(r.pack.core.m.k, '公式');
  assert.deepEqual(r.redundantAdded, [{ area: 'core', owner: 'm', key: 'k', version: '1.146.0', official: 'official' }]);
  assert.deepEqual(r.provenance, { official: 1 });
});
test('buildPack: 記録した英語が今の英語と違う足した訳は使わず、staleAdded に出す（訳し直しが要る）', () => {
  const strs = { core: { m: { k: 'Hello v2' } } };
  const r = buildPack({ strings: strs, layers: [], added: [addedFile('1.146.0', { core: { m: { k: { en: 'Hello', ja: 'こんにちは' } } } })] });
  assert.equal(r.pack.core?.m?.k, undefined);
  assert.equal(r.staleAdded.length, 1);
  assert.deepEqual({ ...r.staleAdded[0] }, { area: 'core', owner: 'm', key: 'k', version: '1.146.0', recordedEn: 'Hello', en: 'Hello v2' });
});
test('buildPack: 足した訳は後の版が勝つ', () => {
  const strs = { core: { m: { k: 'Hello' } } };
  const r = buildPack({ strings: strs, added: [
    addedFile('1.146.0', { core: { m: { k: { en: 'Hello', ja: '古い訳' } } } }),
    addedFile('1.147.0', { core: { m: { k: { en: 'Hello', ja: '新しい訳' } } } }),
  ] });
  assert.equal(r.pack.core.m.k, '新しい訳');
  assert.deepEqual(r.provenance, { 'added:1.147.0': 1 });
});
test('buildPack: override: true の足した訳は、公式の訳より先に使う。redundantAdded には出さない', () => {
  const strs = { core: { m: { k: 'Zen Mode' } } };
  const r = buildPack({ strings: strs, layers: [layer('official', { core: { m: { k: 'Zen Mode' } } })], added: [addedFile('1.146.0', { core: { m: { k: { en: 'Zen Mode', ja: '禅モード', override: true } } } })] });
  assert.equal(r.pack.core.m.k, '禅モード');
  assert.deepEqual(r.provenance, { 'added:1.146.0:override': 1 });
  assert.deepEqual(r.redundantAdded, []);
});
test('buildPack: override でも、記録した英語が今と違えば使わず staleAdded（override: true つき）。公式の訳に戻る', () => {
  const strs = { core: { m: { k: 'Zen Mode v2' } } };
  const r = buildPack({ strings: strs, layers: [layer('official', { core: { m: { k: '公式の訳' } } })], added: [addedFile('1.146.0', { core: { m: { k: { en: 'Zen Mode', ja: '禅モード', override: true } } } })] });
  assert.equal(r.pack.core.m.k, '公式の訳');
  assert.equal(r.staleAdded.length, 1);
  assert.equal(r.staleAdded[0].override, true);
  assert.equal(r.staleAdded[0].recordedEn, 'Zen Mode');
});
test('buildPack: 拡張の package・bundle の鍵も同じ規則で入る', () => {
  const strs = { extensions: { 'vscode.git': { package: { a: 'A' }, bundle: { 'B {0}': 'B {0}' } } } };
  const l = layer('o', { extensions: { 'vscode.git': { package: { a: 'あ' }, bundle: { 'B {0}': 'び {0}' } } } });
  const r = buildPack({ strings: strs, layers: [l] });
  assert.deepEqual(r.pack.extensions, { 'vscode.git': { package: { a: 'あ' }, bundle: { 'B {0}': 'び {0}' } } });
});
test('buildPack: 表が無いときは層の鍵を全部入れ、英語の突き合わせ（stale）はしない', () => {
  const r = buildPack({ layers: [layer('o', { core: { m: { k: '訳' } } })], added: [addedFile('1.0.0', { core: { m: { k2: { en: 'whatever', ja: '足し' } } } })] });
  assert.equal(r.pack.core.m.k, '訳');
  assert.equal(r.pack.core.m.k2, '足し');
  assert.deepEqual(r.staleAdded, []);
});
test('buildPack: 層も足した訳も無ければ空のパック', () => {
  const r = buildPack({ strings: { core: { m: { k: 'A' } } } });
  assert.deepEqual(r.pack, { core: {}, extensions: {} });
  assert.deepEqual(r.provenance, {});
});
test('buildPack: 自前の拡張の直書き（literal）だけの表からは、パックに何も入らない（直書きは言語パックで訳さない）', () => {
  const strs = { extensions: { 'sukuna.mydist': { package: {}, bundle: {}, literal: { displayName: 'Sukuna の既定' } } } };
  const r = buildPack({ strings: strs, layers: [layer('o', { extensions: { 'sukuna.other': { package: { p: 'ぴ' } } } })] });
  assert.deepEqual(r.pack, { core: {}, extensions: {} });
  assert.deepEqual(r.provenance, {});
});

// ---- exclusionTree / validateExclusions -----------------------------------------------------------------------
const EXC = () => ({
  reasons: { format: '書式だけ', 'proper-noun': '固有名詞' },
  exclusions: [
    { module: 'vs/a', key: 'k2', en: 'Save', reason: 'format' },
    { extension: 'vscode.git', section: 'bundle', key: 'Pull from {0}', en: 'Pull from {0}', reason: 'format' },
    { extension: 'vscode.git', section: 'package', key: 'displayName', en: 'Git', reason: 'proper-noun', note: 'メモ' },
    { extension: 'sukuna.mydist', section: 'literal', key: 'description', en: 'Defaults only', reason: 'proper-noun' },
  ],
});
test('exclusionTree: lookup で引ける木にする（本体・拡張の package・bundle・literal）', () => {
  const t = exclusionTree(EXC());
  assert.deepEqual(lookup(t, 'core', 'vs/a', 'k2'), { en: 'Save', reason: 'format', note: undefined });
  assert.equal(lookup(t, 'bundle', 'vscode.git', 'Pull from {0}').reason, 'format');
  assert.equal(lookup(t, 'package', 'vscode.git', 'displayName').note, 'メモ');
  assert.equal(lookup(t, 'literal', 'sukuna.mydist', 'description').en, 'Defaults only');
  assert.equal(lookup(t, 'package', 'vscode.git', 'Pull from {0}'), undefined, 'section が違えば別の鍵');
});
test('exclusionTree: section を省いた拡張の項目は package に入る。key の無い項目・不正な入力は読み飛ばす', () => {
  const t = exclusionTree({ exclusions: [{ extension: 'x.y', key: 'k', en: 'E', reason: 'r' }, { module: 'm' }, 'bad', null] });
  assert.equal(lookup(t, 'package', 'x.y', 'k').en, 'E');
  assert.deepEqual(exclusionTree(null), { core: {}, extensions: {} });
  assert.deepEqual(exclusionTree({ exclusions: 'x' }), { core: {}, extensions: {} });
});
test('validateExclusions: 正しい一覧は誤り 0', () => {
  assert.deepEqual(validateExclusions(EXC()), []);
  assert.deepEqual(validateExclusions({ reasons: {}, exclusions: [] }), []);
});
test('validateExclusions: 理由が reasons に無い・en が無い・key が無い・module と extension の両方・どちらも無いは誤り', () => {
  const bad = (item) => validateExclusions({ reasons: { r: 'x' }, exclusions: [item] });
  assert.match(bad({ module: 'm', key: 'k', en: 'E', reason: 'zzz' }).join(' '), /reasons/);
  assert.match(bad({ module: 'm', key: 'k', reason: 'r' }).join(' '), /en/);
  assert.match(bad({ module: 'm', en: 'E', reason: 'r' }).join(' '), /key/);
  assert.match(bad({ module: 'm', extension: 'x.y', section: 'package', key: 'k', en: 'E', reason: 'r' }).join(' '), /module か extension/);
  assert.match(bad({ key: 'k', en: 'E', reason: 'r' }).join(' '), /module か extension/);
  assert.match(bad({ extension: 'x.y', key: 'k', en: 'E', reason: 'r' }).join(' '), /section/);
  assert.match(bad({ extension: 'x.y', section: 'nowhere', key: 'k', en: 'E', reason: 'r' }).join(' '), /section/);
  assert.match(bad('str').join(' '), /オブジェクト/);
});
test('validateExclusions: 同じ鍵の重複は誤り。区別されるのは module・section・key', () => {
  const dup = { reasons: { r: 'x' }, exclusions: [{ module: 'm', key: 'k', en: 'E', reason: 'r' }, { module: 'm', key: 'k', en: 'E', reason: 'r' }] };
  assert.match(validateExclusions(dup).join(' '), /2度/);
  const ok = { reasons: { r: 'x' }, exclusions: [
    { module: 'm', key: 'k', en: 'E', reason: 'r' }, { module: 'm2', key: 'k', en: 'E', reason: 'r' },
    { extension: 'x.y', section: 'package', key: 'k', en: 'E', reason: 'r' }, { extension: 'x.y', section: 'bundle', key: 'k', en: 'E', reason: 'r' },
  ] };
  assert.deepEqual(validateExclusions(ok), []);
});
test('validateExclusions: オブジェクトでない・exclusions が配列でないは誤り（例外にならない）', () => {
  assert.equal(validateExclusions(null).length, 1);
  assert.equal(validateExclusions([]).length, 1);
  assert.equal(validateExclusions({ reasons: {} }).length, 1);
});
test('EX_SECTIONS は package・bundle・literal。SECTIONS は package・bundle（literal は訳を足せない）', () => {
  assert.deepEqual([...SECTIONS], ['package', 'bundle']);
  assert.deepEqual([...EX_SECTIONS], ['package', 'bundle', 'literal']);
});

// ---- validateAdded --------------------------------------------------------------------------------------------
test('validateAdded: 正しい足した訳は誤り 0（本体・拡張の package・bundle）', () => {
  const a = { version: '1.146.0', core: { m: { k: { en: 'E', ja: '訳' } } }, extensions: { 'x.y': { package: { p: { en: 'P', ja: 'ぴ' } }, bundle: { b: { en: 'B', ja: 'び', override: true } } } } };
  assert.deepEqual(validateAdded(a), []);
});
test('validateAdded: version の形が違う・en が無い・ja が無いか空は誤り', () => {
  assert.match(validateAdded({ version: '1.146', core: {} }).join(' '), /version/);
  assert.match(validateAdded({ version: 'v1.146.0', core: {} }).join(' '), /version/);
  assert.match(validateAdded({ core: {} }).join(' '), /version/);
  assert.match(validateAdded({ version: '1.0.0', core: { m: { k: { ja: '訳' } } } }).join(' '), /en/);
  assert.match(validateAdded({ version: '1.0.0', core: { m: { k: { en: 'E' } } } }).join(' '), /ja/);
  assert.match(validateAdded({ version: '1.0.0', core: { m: { k: { en: 'E', ja: '' } } } }).join(' '), /ja/);
  assert.match(validateAdded({ version: '1.0.0', core: { m: { k: 'str' } } }).join(' '), /オブジェクト/);
  assert.match(validateAdded({ version: '1.0.0', extensions: { 'x.y': { bundle: { b: { en: 'B' } } } } }).join(' '), /x\.y bundle b/);
  assert.equal(validateAdded(null).length, 1);
});

// ---- coverage -------------------------------------------------------------------------------------------------
test('coverage: パックに空でない訳があれば訳あり、無い・空は未訳。除外は記録した英語が今と同じものだけ', () => {
  const pack = {
    core: { 'vs/a': { k1: 'ファイルを開く', k2: '' }, 'vs/b': {} },
    extensions: { 'vscode.git': { package: { 'cmd.clone': 'クローン' }, bundle: {} } },
  };
  const ex = { reasons: { r: 'x' }, exclusions: [
    { module: 'vs/b', key: 'k1', en: 'Close', reason: 'r' }, // 除外が効く
    { extension: 'vscode.git', section: 'package', key: 'displayName', en: 'Git', reason: 'r' }, // 効く
    { extension: 'vscode.git', section: 'bundle', key: 'Pull from {0}', en: 'Pull (old wording)', reason: 'r' }, // 英語が変わった
  ] };
  const c = coverage({ strings: strings(), pack, exclusions: ex });
  assert.equal(c.total, 3 + 2 + 1 + 2);
  const names = c.untranslatedList.map((t) => `${t.area}:${t.owner}#${t.key}`).sort();
  assert.deepEqual(names, ['bundle:vscode.git#Pull from {0}', 'core:vs/a#k2', 'literal:sukuna.mydist#description'].sort());
  assert.equal(c.excluded, 2);
  assert.equal(c.translated, c.total - c.untranslated - c.excluded);
  assert.deepEqual(c.staleExclusions, [{ area: 'bundle', owner: 'vscode.git', key: 'Pull from {0}', recordedEn: 'Pull (old wording)', en: 'Pull from {0}' }]);
});
test('coverage: 空の訳（""）は訳でなく、未訳に数える（本体は空なら英語に戻る）', () => {
  const c = coverage({ strings: { core: { m: { k: 'A' } } }, pack: { core: { m: { k: '' } }, extensions: {} } });
  assert.equal(c.untranslated, 1);
  assert.equal(c.translated, 0);
});
test('coverage: 除外に理由（reason）が無ければ効かない。en が無い除外も効かない', () => {
  const s = { core: { m: { k: 'A' } } };
  const noReason = coverage({ strings: s, pack: { core: {}, extensions: {} }, exclusions: { exclusions: [{ module: 'm', key: 'k', en: 'A' }] } });
  assert.equal(noReason.excluded, 0);
  assert.equal(noReason.untranslated, 1);
  const noEn = coverage({ strings: s, pack: { core: {}, extensions: {} }, exclusions: { exclusions: [{ module: 'm', key: 'k', reason: 'r' }] } });
  assert.equal(noEn.excluded, 0);
  assert.equal(noEn.untranslated, 1);
});
test('coverage: 除外の英語が今と違えば未訳に数え、staleExclusions に出す', () => {
  const c = coverage({ strings: { core: { m: { k: 'New wording' } } }, pack: { core: {}, extensions: {} }, exclusions: { exclusions: [{ module: 'm', key: 'k', en: 'Old wording', reason: 'r' }] } });
  assert.equal(c.excluded, 0);
  assert.equal(c.untranslated, 1);
  assert.equal(c.staleExclusions.length, 1);
  assert.equal(c.staleExclusions[0].recordedEn, 'Old wording');
});
test('coverage: literal は日本語を含めば訳あり、英語だけなら未訳（パックは見ない）。literal の除外も効く', () => {
  const s = { extensions: { 'sukuna.x': { package: {}, bundle: {}, literal: { a: 'Sukuna の既定', b: 'English only', c: 'Also English' } } } };
  const ex = { exclusions: [{ extension: 'sukuna.x', section: 'literal', key: 'c', en: 'Also English', reason: 'r' }] };
  const c = coverage({ strings: s, pack: { core: {}, extensions: {} }, exclusions: ex });
  assert.equal(c.byArea.literal.total, 3);
  assert.equal(c.byArea.literal.translated, 1);
  assert.equal(c.byArea.literal.excluded, 1);
  assert.equal(c.byArea.literal.untranslated, 1);
  assert.deepEqual(c.untranslatedList.map((t) => t.key), ['b']);
});
test('coverage: byArea・perOwner（本体は "vscode" にまとめる）・notJapanese（訳はあるが日本語を含まない）', () => {
  const pack = { core: { 'vs/a': { k1: 'ファイルを開く', k2: 'Save' }, 'vs/b': { k1: '閉じる' } }, extensions: { 'vscode.git': { package: { 'cmd.clone': 'Clone', displayName: 'Git' }, bundle: { 'Pull from {0}': '{0} から取得' } } } };
  const c = coverage({ strings: strings(), pack });
  assert.equal(c.byArea.core.total, 3);
  assert.equal(c.byArea.core.translated, 3);
  assert.equal(c.byArea.package.translated, 2);
  assert.equal(c.byArea.bundle.translated, 1);
  assert.equal(c.perOwner.vscode.total, 3);
  assert.equal(c.perOwner['vscode.git'].translated, 3);
  assert.equal(c.notJapanese, 3, 'Save・Clone・Git は日本語を含まない訳');
});
test('coverage: 空の表・除外なしでも例外にならない', () => {
  const c = coverage({ strings: {}, pack: {} });
  assert.equal(c.total, 0);
  assert.equal(c.untranslated, 0);
});

// ---- placeholderMismatch --------------------------------------------------------------------------------------
test('placeholderMismatch: 印が同じなら null。並びを替えても null', () => {
  assert.equal(placeholderMismatch('Open {0}', '{0} を開く'), null);
  assert.equal(placeholderMismatch('{0} on {1}', '{1} 上の {0}'), null);
  assert.equal(placeholderMismatch('Hello {name}', 'こんにちは {name}'), null);
  assert.equal(placeholderMismatch('No marks', '印なし'), null);
});
test('placeholderMismatch: 訳に無い印は missing、訳の余分な印は extra', () => {
  assert.deepEqual(placeholderMismatch('Open {0} and {1}', '{0} を開く'), { missing: ['{1}'], extra: [] });
  assert.deepEqual(placeholderMismatch('Open {0}', '{0} と {2} を開く'), { missing: [], extra: ['{2}'] });
  assert.deepEqual(placeholderMismatch('Hi {name}', 'やあ {nam}'), { missing: ['{name}'], extra: ['{nam}'] });
});

// ---- decodeUnicodeEscapes（bundle の鍵を実行時の鍵にそろえる。蒙恬の引き継ぎ 1.4 の表）-----------------------------------
const BS = '\\';
test('decodeUnicodeEscapes: 4桁の書き方は実行時の文字（↔）にする', () => {
  assert.equal(decodeUnicodeEscapes(`'{0} ${BS}u2194 {1}'`), "'{0} ↔ {1}'");
});
test('decodeUnicodeEscapes: u{…} は文字そのもの。対のサロゲートも1文字', () => {
  assert.equal(decodeUnicodeEscapes(`'${BS}u{1F600}'`), "'\u{1F600}'");
  assert.equal(decodeUnicodeEscapes(`'${BS}uD83D${BS}uDE00'`), "'\u{1F600}'");
});
test('decodeUnicodeEscapes: U+00FF 以下は \\xNN の書き方にする（l10n-dev が正しく読む形）', () => {
  assert.equal(decodeUnicodeEscapes(`'it${BS}u0027s'`), `'it${BS}x27s'`);
});
test('decodeUnicodeEscapes: 直さないもの（逆斜線そのものの後の u・対にならないサロゲート・U+2028・4桁でない・書き方なし）', () => {
  for (const s of [`'a${BS}${BS}u2194'`, `'${BS}uD83D'`, `'${BS}u2028'`, `'${BS}u12'`, 'plain text', '']) assert.equal(decodeUnicodeEscapes(s), s, s);
  assert.equal(decodeUnicodeEscapes(`'${BS}u2029'`), `'${BS}u2029'`);
});
test('decodeUnicodeEscapes: 1つの文字列に複数あれば全部直す。直した後にもう一度かけても変わらない', () => {
  const once = decodeUnicodeEscapes(`l10n.t('{0} ${BS}u2194 {1} ${BS}u2192 {2}')`);
  assert.equal(once, "l10n.t('{0} ↔ {1} → {2}')");
  assert.equal(decodeUnicodeEscapes(once), once);
});

// ---- i18nFile / extensionContents -----------------------------------------------------------------------------
test('i18nFile: { version: "1.0.0", contents }', () => {
  assert.deepEqual(i18nFile({ a: 1 }), { version: '1.0.0', contents: { a: 1 } });
});
test('extensionContents: package と bundle の両方を必ず持たせる（組み込みは両方を読む）。元のオブジェクトは変えない', () => {
  const src = { package: { a: 'あ' } };
  const c = extensionContents(src);
  assert.deepEqual(c, { package: { a: 'あ' }, bundle: {} });
  c.package.a = 'x';
  assert.equal(src.package.a, 'あ');
  assert.deepEqual(extensionContents(undefined), { package: {}, bundle: {} });
});

// ---------------------------------------------------------------------------------------------------------------
// M2: 置き換えの印の照らしを強める（検証 tasks/2026-11-17-l10n-ja-verify の M2、蒙恬の依頼 2-M2）。
// 蒙恬の直しの前は、この節の「強めた」テストが落ちる（今は {0} {1} などの有無だけを見て、数・&&・$(...)・Markdown のリンクを見ない）。
// 戻り値の形（{ missing, extra }）は変えないものとして、null か非 null かだけを確かめる。
// ---------------------------------------------------------------------------------------------------------------
test('M2: 印の数も見る（{0} が英語に1つなのに訳に2つ、またはその逆は食い違い）', () => {
  assert.ok(placeholderMismatch('{0} {0}', '{0}'), '英語に2つ、訳に1つ');
  assert.ok(placeholderMismatch('{0}', '{0} {0}'), '英語に1つ、訳に2つ');
  assert.equal(placeholderMismatch('{0} and {0}', '{0} と {0}'), null, '数が同じなら通る');
});
test('M2: && （メニューの略称キー）は、英語にあれば訳にも要る。訳の余分な && も食い違い', () => {
  assert.ok(placeholderMismatch('&&File', 'ファイル'), '訳に && が無い');
  assert.ok(placeholderMismatch('File', 'ファイル(&&F)'), '英語に無い && が訳にある');
  assert.equal(placeholderMismatch('&&File', 'ファイル(&&F)'), null);
  assert.equal(placeholderMismatch('&&File', '&&ファイル'), null);
});
test('M2: $(アイコン名) は英語と同じものが訳にも要る（名前が違えば食い違い）', () => {
  assert.equal(placeholderMismatch('$(sync) Sync', '$(sync) 同期'), null);
  assert.ok(placeholderMismatch('$(sync) Sync', '同期'), 'アイコンが消えた');
  assert.ok(placeholderMismatch('$(sync) Sync', '$(refresh) 同期'), 'アイコンの名前が違う');
  assert.ok(placeholderMismatch('Sync', '$(sync) 同期'), '余分なアイコン');
  assert.equal(placeholderMismatch('$(sync~spin) Syncing', '$(sync~spin) 同期中'), null, '~spin つきの名前も同じなら通る');
});
test('M2: Markdown のリンクは、リンク先（URL・コマンド）が英語と同じで、リンクの数も同じ', () => {
  assert.equal(placeholderMismatch('See [docs](https://example.com/a)', '[ドキュメント](https://example.com/a) を参照'), null);
  assert.ok(placeholderMismatch('See [docs](https://example.com/a)', '[ドキュメント](https://example.com/b) を参照'), 'リンク先が違う');
  assert.ok(placeholderMismatch('See [docs](https://example.com/a)', 'ドキュメントを参照'), 'リンクが消えた');
  assert.ok(placeholderMismatch('See docs', '[ドキュメント](https://example.com/a) を参照'), '余分なリンク');
  assert.equal(placeholderMismatch('[a](command:x.y) or [b](command:x.z)', '[あ](command:x.y) か [い](command:x.z)'), null);
  assert.ok(placeholderMismatch('[a](command:x.y) or [b](command:x.z)', '[あ](command:x.y) か [い](command:x.y)'), '2つめのリンク先が同じ（違うはず）');
});
test('M2: 戻り値の形は { missing, extra }（蒙恬の引き継ぎ 1.2 の表）。訳に無い印は missing、余分は extra', () => {
  assert.deepEqual(placeholderMismatch('{0} {0}', '{0}'), { missing: ['{0}'], extra: [] });
  assert.deepEqual(placeholderMismatch('{0}', '{0} {0}'), { missing: [], extra: ['{0}'] });
  assert.deepEqual(placeholderMismatch('&&File', 'ファイル'), { missing: ['&&'], extra: [] });
  assert.deepEqual(placeholderMismatch('$(gear) Settings', '設定'), { missing: ['$(gear)'], extra: [] });
  assert.deepEqual(placeholderMismatch('See [docs](https://a.b/c)', '[資料](https://a.b/d) を見る'), { missing: ['[](https://a.b/c)'], extra: ['[](https://a.b/d)'] });
  assert.deepEqual(placeholderMismatch('[{0}](command:x)', '[x](command:x)'), { missing: ['{0}'], extra: [] }, '表示の文字の中の {0} も数える');
});
test('M2: 通るもの（表の null の行）。&& は後ろへ回してよい、並びは見ない、印の無い文は通る', () => {
  assert.equal(placeholderMismatch('&&File', 'ファイル(&&F)'), null);
  assert.equal(placeholderMismatch('$(gear) Settings', '$(gear) 設定'), null);
  assert.equal(placeholderMismatch('See [docs](https://a.b/c)', '[資料](https://a.b/c) を見る'), null);
  assert.equal(placeholderMismatch('{name} and {0}', '{0} と {name}'), null);
  assert.equal(placeholderMismatch('a', 'b'), null);
});
test('M2: placeholderMarks は印の配列（同じ印は2度出れば2つ）。並びは { } && $() の出てくる順、その後に Markdown のリンクの先', () => {
  assert.deepEqual(placeholderMarks('[{0}](command:x)'), ['{0}', '[](command:x)']);
  assert.deepEqual(placeholderMarks('{0} {0}'), ['{0}', '{0}']);
  assert.deepEqual(placeholderMarks('no marks'), []);
  assert.deepEqual(placeholderMarks('$(sync~spin) A'), ['$(sync~spin)']);
  assert.deepEqual(placeholderMarks('[b](https://q "title")'), ['[](https://q)'], '題（"…"）は印に入れない');
  // 角括弧つきの先 [a](<https://x/y z>) も1つのリンクとして読む。印の文字は実装次第（今は < > を残す）なので、数と先だけを見る
  const angle = placeholderMarks('[a](<https://x/y z>)');
  assert.equal(angle.length, 1);
  assert.ok(angle[0].includes('https://x/y z'));
});
test('M2: 今の added/*.json は、強めた照らしでも全部通る（印のある足した訳の回帰）', () => {
  const dir = path.join(REPO, 'extensions-src', 'language-pack-ja', 'added');
  const bad = [];
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const check = (where, v) => { n++; const mm = placeholderMismatch(v.en, v.ja); if (mm) bad.push(`${f} ${where}: ${JSON.stringify(mm)}`); };
    for (const [mod, m] of Object.entries(a.core || {})) for (const [k, v] of Object.entries(m)) check(`${mod}#${k}`, v);
    for (const [id, e] of Object.entries(a.extensions || {})) for (const sec of SECTIONS) for (const [k, v] of Object.entries(e[sec] || {})) check(`${id} ${sec} ${k}`, v);
  }
  assert.ok(n >= 150, `足した訳が ${n} 件しかない`);
  assert.deepEqual(bad, []);
});
