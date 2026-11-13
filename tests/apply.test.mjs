// apply.mjs の純粋な部品の単体テスト。仕様（docs/03 の3.1・5.1・6、docs/02 の3）から書いた。
// 実装は読まずに書いてある。入口の名前は tests/apply/api.mjs に集めてある（実装が無い名前は「実装なし」で飛ばす）。
// Run: node --test tests/apply.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, skipReason } from './apply/api.mjs';

const t = (key, name, fn) => test(`${key}: ${name}`, { skip: skipReason(key) }, fn);

// ---------------------------------------------------------------------------
// removeLines（docs/03 の3.1: 前後の空白を除いて完全一致、ちょうど1行、count、0行・2行以上は止める、正規表現は使わない）
// ---------------------------------------------------------------------------
const IMP = "import './contrib/debug/browser/debug.contribution.js';";
const SRC = ['// head', "import './a.js';", IMP, "import './b.js';", ''].join('\n');

t('removeLines', '完全に一致する1行を消し、ほかの行は変えない', () => {
  const r = api.removeLines(SRC, { line: IMP });
  assert.equal(r.removed, 1);
  assert.equal(r.text, ['// head', "import './a.js';", "import './b.js';", ''].join('\n'));
});

t('removeLines', '前後の空白（インデント・行末）を除いて比べる', () => {
  const text = ['x', `\t  ${IMP}  `, 'y'].join('\n');
  assert.equal(api.removeLines(text, { line: IMP }).text, 'x\ny');
  // 指定の側に空白があっても同じ
  assert.equal(api.removeLines(['x', IMP, 'y'].join('\n'), { line: `  ${IMP}\t` }).text, 'x\ny');
});

t('removeLines', '行の一部が一致するだけでは消さない（部分一致は 0 行）', () => {
  const text = ['x', `// ${IMP}`, `${IMP} // tail`, 'y'].join('\n');
  assert.throws(() => api.removeLines(text, { line: IMP }));
});

t('removeLines', '正規表現として扱わない', () => {
  const text = ['a.b', 'axb', 'y'].join('\n');
  assert.equal(api.removeLines(text, { line: 'a.b' }).text, 'axb\ny');
  assert.throws(() => api.removeLines('abc\n', { line: 'a.c' }));
  assert.throws(() => api.removeLines('abc\n', { line: '.*' }));
});

t('removeLines', '0 行なら止める（Error）。入力の文字列は変わらない', () => {
  const before = SRC;
  assert.throws(() => api.removeLines(SRC, { line: "import './zzz.js';" }));
  assert.equal(SRC, before);
});

t('removeLines', '2 行以上なら止める（既定は count=1）', () => {
  const text = [IMP, 'mid', IMP, ''].join('\n');
  assert.throws(() => api.removeLines(text, { line: IMP }));
});

t('removeLines', 'count を指定すると、その数ちょうどのときだけ消す', () => {
  const text = [IMP, 'mid', `  ${IMP}`, ''].join('\n');
  const r = api.removeLines(text, { line: IMP, count: 2 });
  assert.equal(r.removed, 2);
  assert.equal(r.text, 'mid\n');
  assert.throws(() => api.removeLines(text, { line: IMP, count: 3 }));
  assert.throws(() => api.removeLines(text, { line: IMP, count: 1 }));
});

t('removeLines', '改行コード（CRLF）を保つ。末尾の改行の有無も変えない', () => {
  const crlf = ['a', IMP, 'b', ''].join('\r\n');
  assert.equal(api.removeLines(crlf, { line: IMP }).text, ['a', 'b', ''].join('\r\n'));
  const noTail = ['a', IMP, 'b'].join('\n');
  assert.equal(api.removeLines(noTail, { line: IMP }).text, 'a\nb');
});

t('removeLines', '空の行を指定しても何も消さずに済ませない（空行は count と一致しない限り止める）', () => {
  // 空行を探す指定は意図が読めない。1行だけの空行でも、見つからない場合は止める
  assert.throws(() => api.removeLines('a\nb\n', { line: '' }));
});

// ---------------------------------------------------------------------------
// orderUnits（docs/03 の5.1: enabled を order 順。after は先に有効・適用済み。満たさなければ止める）
// ---------------------------------------------------------------------------
const U = (id, order, extra = {}) => ({ id, stage: id[0], order, enabled: true, after: [], ...extra });
const ids = (list) => list.map((u) => u.id);

t('orderUnits', 'order の昇順に並べる（入力の順に依らない）', () => {
  const r = api.orderUnits([U('B-1-x', 210), U('A-1-x', 110), U('A-2-x', 120)]);
  assert.deepEqual(ids(r), ['A-1-x', 'A-2-x', 'B-1-x']);
});

t('orderUnits', 'enabled: false の単位は飛ばす', () => {
  const r = api.orderUnits([U('A-1-x', 110), U('A-2-x', 120, { enabled: false }), U('A-3-x', 130)]);
  assert.deepEqual(ids(r), ['A-1-x', 'A-3-x']);
});

t('orderUnits', 'after の単位が先に当たっていればよい', () => {
  const r = api.orderUnits([U('A-2-x', 120, { after: ['A-1-x'] }), U('A-1-x', 110)]);
  assert.deepEqual(ids(r), ['A-1-x', 'A-2-x']);
});

t('orderUnits', 'after の単位が無効なら止める（5.1 の1）', () => {
  assert.throws(() => api.orderUnits([U('A-1-x', 110, { enabled: false }), U('A-2-x', 120, { after: ['A-1-x'] })]));
});

t('orderUnits', 'after の単位が存在しないなら止める', () => {
  assert.throws(() => api.orderUnits([U('A-2-x', 120, { after: ['A-9-none'] })]));
});

t('orderUnits', 'after の単位の order のほうが大きい（後に当たる）なら止める', () => {
  assert.throws(() => api.orderUnits([U('A-1-x', 110, { after: ['A-2-x'] }), U('A-2-x', 120)]));
});

t('orderUnits', '同じ id が2つあれば止める', () => {
  assert.throws(() => api.orderUnits([U('A-1-x', 110), U('A-1-x', 115)]));
});

t('orderUnits', '無効な単位の after が壊れていても、その単位は検査しない（当てないため）', () => {
  const r = api.orderUnits([U('A-1-x', 110), U('A-2-x', 120, { enabled: false, after: ['A-9-none'] })]);
  assert.deepEqual(ids(r), ['A-1-x']);
});

t('orderUnits', '入力の配列を並べ替えて壊さない', () => {
  const input = [U('B-1-x', 210), U('A-1-x', 110)];
  api.orderUnits(input);
  assert.deepEqual(ids(input), ['B-1-x', 'A-1-x']);
});

// ---------------------------------------------------------------------------
// applyOverlay（docs/02 の3: set は値を入れる・置き換える、remove はキーを消す。remove のキーが本家に無ければ警告）
// ---------------------------------------------------------------------------
const PRODUCT = () => ({ nameShort: 'Code - OSS', applicationName: 'code-oss', reportIssueUrl: 'https://x', licenseName: 'MIT', onboardingThemes: [] });

t('applyOverlay', 'set は値を入れ、既にあるキーは置き換える', () => {
  const r = api.applyOverlay(PRODUCT(), { set: { nameShort: 'Shuko', urlProtocol: 'shuko' }, remove: [] });
  assert.equal(r.product.nameShort, 'Shuko');
  assert.equal(r.product.urlProtocol, 'shuko');
  assert.deepEqual(r.warnings, []);
});

t('applyOverlay', 'set の値がオブジェクトのときは丸ごと置き換える（混ぜない）', () => {
  const p = { ...PRODUCT(), shukoConfigurationDefaults: { old: 1 } };
  const r = api.applyOverlay(p, { set: { shukoConfigurationDefaults: { 'telemetry.telemetryLevel': 'off' } }, remove: [] });
  assert.deepEqual(r.product.shukoConfigurationDefaults, { 'telemetry.telemetryLevel': 'off' });
});

t('applyOverlay', 'remove はキーを消す。overlay に無いキー（licenseName など）は残す', () => {
  const r = api.applyOverlay(PRODUCT(), { set: {}, remove: ['reportIssueUrl'] });
  assert.equal('reportIssueUrl' in r.product, false);
  assert.equal(r.product.licenseName, 'MIT');
  assert.equal(r.product.applicationName, 'code-oss');
  assert.deepEqual(r.warnings, []);
});

t('applyOverlay', 'remove のキーが本家に無ければ警告する（本家の改名を見つけるため）。止めはしない', () => {
  const r = api.applyOverlay(PRODUCT(), { set: {}, remove: ['reportIssueUrl', 'emergencyAlertUrl'] });
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings.join('\n'), /emergencyAlertUrl/);
  assert.equal('reportIssueUrl' in r.product, false);
});

t('applyOverlay', '入力の product と overlay を書き換えない', () => {
  const p = PRODUCT();
  const o = { set: { nameShort: 'Shuko' }, remove: ['reportIssueUrl'] };
  const p0 = JSON.stringify(p);
  const o0 = JSON.stringify(o);
  api.applyOverlay(p, o);
  assert.equal(JSON.stringify(p), p0);
  assert.equal(JSON.stringify(o), o0);
});

t('applyOverlay', 'set と remove に同じキーがあれば止める（意図が読めない）', () => {
  assert.throws(() => api.applyOverlay(PRODUCT(), { set: { nameShort: 'S' }, remove: ['nameShort'] }));
});

// 「本家が足したら remove」の行（enableTelemetry・aiConfig・updateUrl・tasConfig・extensionsGallery）。
// overlay 側でどう書くかは未確定。想定: removeIfPresent という配列。本家に無くても警告しない。あれば外して警告する。
t('applyOverlay', '「本家が足したら remove」: 本家に無ければ何もしない・警告もしない', () => {
  const r = api.applyOverlay(PRODUCT(), { set: {}, remove: [], removeIfPresent: ['aiConfig', 'updateUrl'] });
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.product, PRODUCT());
});

t('applyOverlay', '「本家が足したら remove」: 本家が足していたら外して、そのキーを名指しで警告する', () => {
  const p = { ...PRODUCT(), aiConfig: { x: 1 }, updateUrl: 'https://u' };
  const r = api.applyOverlay(p, { set: {}, remove: [], removeIfPresent: ['aiConfig', 'updateUrl', 'tasConfig'] });
  assert.equal('aiConfig' in r.product, false);
  assert.equal('updateUrl' in r.product, false);
  const w = r.warnings.join('\n');
  assert.match(w, /aiConfig/);
  assert.match(w, /updateUrl/);
  assert.doesNotMatch(w, /tasConfig/);
});

// ---------------------------------------------------------------------------
// findUnclassifiedExtensions（docs/03 の4節・6節: 本家の extensions/* は keep.json か単位のどちらかに載っていなければならない）
// ---------------------------------------------------------------------------
const KEEP = { keep: [{ name: 'git', reason: 'x' }, { name: 'theme-defaults', reason: 'y' }] };
// keep.json の形は蒙恬が決める。配列でも { keep: [...] } でも、名前の文字列でも { name } でも読めることまでは求めない:
// ここでは最も素直な { keep: [{name, reason}] } と、単位は delete のパス（extensions/<名前>）で渡す。
const UNITS = [{ id: 'A-1-x', delete: ['extensions/copilot', 'extensions/github'] }, { id: 'A-4-x', delete: ['extensions/ipynb'] }];

t('findUnclassifiedExtensions', 'keep にも単位にも無い名前だけを返す（並びは名前順）', () => {
  const r = api.findUnclassifiedExtensions(['git', 'copilot', 'ipynb', 'zeta-new', 'alpha-new', 'theme-defaults'], KEEP, UNITS);
  assert.deepEqual([...r].sort(), ['alpha-new', 'zeta-new']);
});

t('findUnclassifiedExtensions', 'すべて分類済みなら空', () => {
  assert.deepEqual(api.findUnclassifiedExtensions(['git', 'copilot', 'github', 'ipynb', 'theme-defaults'], KEEP, UNITS), []);
});

t('findUnclassifiedExtensions', '無効（enabled: false）の単位の delete も分類として数える（分類と有効は別）', () => {
  const units = [{ id: 'A-1-x', enabled: false, delete: ['extensions/copilot'] }];
  assert.deepEqual(api.findUnclassifiedExtensions(['copilot'], { keep: [] }, units), []);
});

t('findUnclassifiedExtensions', '名前の前方一致で誤って分類しない（git と git-base は別）', () => {
  const r = api.findUnclassifiedExtensions(['git', 'git-base'], KEEP, []);
  assert.deepEqual(r, ['git-base']);
});

// ---------------------------------------------------------------------------
// flagNewComponents（docs/03 の6節: 名前に chat・agent・copilot・mcp・telemetry・experiment・survey などを含むものを目立たせる）
// ---------------------------------------------------------------------------
t('flagNewComponents', '名前に AI・テレメトリ系の語を含むものを highlight にする', () => {
  const names = ['src/vs/workbench/contrib/chatTools', 'src/vs/platform/agentHost2', 'src/vs/workbench/contrib/copilotX',
    'src/vs/workbench/services/mcpGateway', 'src/vs/platform/telemetryV2', 'src/vs/workbench/services/experimentation',
    'src/vs/workbench/contrib/surveyPrompt'];
  const r = api.flagNewComponents(names);
  assert.equal(r.length, names.length);
  for (const x of r) assert.equal(x.highlight, true, x.name);
});

t('flagNewComponents', '語を含まないものは highlight にしない。すべて返す', () => {
  const names = ['src/vs/workbench/contrib/zenMode2', 'src/vs/platform/clock'];
  const r = api.flagNewComponents(names);
  assert.deepEqual(r.map((x) => x.name), names);
  for (const x of r) assert.equal(x.highlight, false, x.name);
});

t('flagNewComponents', '大文字小文字を区別しない（Copilot・CHAT）', () => {
  const r = api.flagNewComponents(['contrib/CopilotBridge', 'contrib/ChatAgentX']);
  assert.ok(r.every((x) => x.highlight));
});
