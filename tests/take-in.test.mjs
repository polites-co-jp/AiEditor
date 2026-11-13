// 取り込み（scripts/take-in.mjs・adopt.mjs・scripts/lib/take-in/*）の単体テスト。
// 仕様: docs/06 の3・4・6・7・8節、CLAUDE.md の起動の注意。入口の名前は tasks/2026-11-14-p3-take-in/take-in-design.md の11節。
// 仕様から先に書いた（実装を読んでテストを合わせてはいない。入口の名前と形だけ合わせた）。
// Run: node --test tests/take-in.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { coreStepOrder, CORE_STEPS, nextAction, checksOutcome, selectCoreSteps } from '../scripts/lib/take-in/steps.mjs';
import { validateVerdict, guardVerdict, VERDICT_SCHEMA } from '../scripts/lib/take-in/verdict.mjs';
import { buildClaudeInvocation, claudeChildEnv, parseClaudeOutput, parseCmdShim } from '../scripts/lib/take-in/claude.mjs';
import { classifyApplyFailure, findConflictMarkers, outsideAllowed, groupFixes } from '../scripts/lib/take-in/repair.mjs';
import { parseTakeInArgs, extLabel, branchFor } from '../scripts/lib/take-in/args.mjs';
import { selectReleases, selectAdvisories, parseLsRemote } from '../scripts/lib/take-in/upstream-info.mjs';
import { readWatchStatus, writeBack } from '../scripts/lib/take-in/writeback.mjs';
import { planAdopt } from '../scripts/lib/take-in/adopt.mjs';

const REPO = resolve(fileURLToPath(import.meta.url), '..', '..');

// ---- 手順の並べ方と止まる条件 (docs/06 の4節の表) ----
test('手順: 1〜10 の順で、8（計測）は無い', () => {
  assert.deepEqual(coreStepOrder(), [1, 2, 3, 4, 5, 6, 7, 9, 10]);
  assert.deepEqual(CORE_STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 9, 10]);
});
test('手順1: タグが無ければ止まる', () => {
  assert.equal(nextAction(1, { ok: false }), 'stop');
  assert.notEqual(nextAction(1, { ok: true }), 'stop');
});
test('手順2: 当たれば修理（3）へ行かない。当たらなければ修理へ', () => {
  assert.notEqual(nextAction(2, { ok: true }), 'repair');
  assert.equal(nextAction(2, { ok: false }), 'repair');
});
test('手順3: 修理は3回まで。直らなければ止まる。直れば手順2からやり直す', () => {
  assert.equal(nextAction(3, { ok: true, attempt: 1 }), 'retry');
  assert.notEqual(nextAction(3, { ok: false, attempt: 1 }), 'stop');
  assert.notEqual(nextAction(3, { ok: false, attempt: 2 }), 'stop');
  assert.equal(nextAction(3, { ok: false, attempt: 3 }), 'stop');
});
test('手順3: --max-repair で上限が変わる', () => {
  assert.equal(nextAction(3, { ok: false, attempt: 1, max: 1 }), 'stop');
  assert.notEqual(nextAction(3, { ok: false, attempt: 4, max: 5 }), 'stop');
});
test('手順2: 修理しない種類（repairable:false）・--no-repair では止まる', () => {
  assert.equal(nextAction(2, { ok: false, repairable: false }), 'stop');
  assert.equal(nextAction(2, { ok: false, noRepair: true }), 'stop');
});
test('手順4: 検査を満たさなければ止まる。未分類の組み込み拡張だけなら止めない（保留）', () => {
  assert.equal(nextAction(4, { ok: false }), 'stop');
  assert.notEqual(nextAction(4, { ok: false, unclassifiedOnly: true }), 'stop');
  assert.notEqual(nextAction(4, { ok: true }), 'stop');
});
test('手順5: ビルドが通らなければ止まる（型検査の誤りだけは修理へ）', () => {
  assert.equal(nextAction(5, { ok: false }), 'stop');
  assert.notEqual(nextAction(5, { ok: true }), 'stop');
  assert.equal(nextAction(5, { ok: false, typecheck: true, attempt: 1 }), 'repair');
  assert.equal(nextAction(5, { ok: false, typecheck: true, attempt: 3 }), 'stop');
});
test('手順6・7・9・10: 結果が悪くても止めない', () => {
  for (const s of [6, 7, 9, 10]) assert.notEqual(nextAction(s, { ok: false }), 'stop', `step ${s}`);
});
test('手順: 知らない番号（8 を含む）は例外', () => {
  assert.throws(() => nextAction(8, { ok: true }));
  assert.throws(() => nextAction(11, { ok: true }));
});

test('checksOutcome: 全部 ok なら ok', () => {
  assert.equal(checksOutcome({ result: 'ok', checks: { a: { status: 'ok' } } }).ok, true);
});
test('checksOutcome: fail は止める。hold が未分類の組み込み拡張だけなら unclassifiedOnly', () => {
  assert.equal(checksOutcome({ result: 'fail', checks: { a: { status: 'fail' } } }).ok, false);
  const r = checksOutcome({ result: 'hold', checks: { unclassifiedExtensions: { status: 'hold' } } });
  assert.equal(r.ok, false);
  assert.equal(r.unclassifiedOnly, true);
  const r2 = checksOutcome({ result: 'hold', checks: { unclassifiedExtensions: { status: 'hold' }, other: { status: 'hold' } } });
  assert.notEqual(r2.unclassifiedOnly, true);
});
test('checksOutcome: checks.json が無ければ止める', () => {
  assert.equal(checksOutcome(null).ok, false);
});
test('selectCoreSteps: --from/--to は名前か番号。逆順・知らない名前は例外', () => {
  assert.deepEqual(selectCoreSteps('apply', 'checks').map((s) => s.n), [2, 3, 4]);
  assert.deepEqual(selectCoreSteps(5, 7).map((s) => s.n), [5, 6, 7]);
  assert.deepEqual(selectCoreSteps().map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 9, 10]);
  assert.throws(() => selectCoreSteps('build', 'apply'));
  assert.throws(() => selectCoreSteps('nope', null));
});

// ---- verdict.json の形 (docs/06 の7.3) ----
const goodVerdict = () => ({
  label: '1.147.0-1',
  verdict: 'pass',
  security: { advisories: ['GHSA-aaaa'], relevantToThisBuild: [{ id: 'GHSA-aaaa', relevant: false, why: '消したリモートの機能の修正' }] },
  patches: { changed: ['removals/C-1-ai/edits.patch'], why: '行がずれた' },
  checks: 'ok',
  build: 'ok',
  smoke: { auto: 'ok', manualToDo: ['claude-code のパネルで送信'] },
  network: { newHosts: [] },
  newUpstreamParts: [{ path: 'extensions/foo', proposal: 'keep', why: '...' }],
  conditions: [],
  recommendation: '入れ替えてよい',
});
const valid = (v) => validateVerdict(v).length === 0;

test('verdict.json: docs/06 の7.3 の例は正しい', () => assert.deepEqual(validateVerdict(goodVerdict()), []));
for (const v of ['conditional', 'fail']) {
  test(`verdict.json: ${v} は build が ok でなくても正しい`, () => {
    const o = goodVerdict();
    o.verdict = v;
    o.build = 'failed';
    o.recommendation = v === 'fail' ? '見送る' : '条件を満たしてから';
    assert.equal(valid(o), true);
  });
}
test('verdict.json: verdict が列挙の外なら誤り', () => {
  for (const bad of ['PASS', 'ok', 'pass | conditional | fail', '', null, undefined, 1]) {
    const o = goodVerdict();
    o.verdict = bad;
    assert.equal(valid(o), false, String(bad));
  }
});
for (const key of ['label', 'verdict', 'security', 'patches', 'checks', 'build', 'smoke', 'network', 'newUpstreamParts', 'conditions', 'recommendation']) {
  test(`verdict.json: ${key} が無ければ誤り`, () => {
    const o = goodVerdict();
    delete o[key];
    assert.equal(valid(o), false);
  });
}
test('verdict.json: network.newHosts が配列でなければ誤り', () => {
  const o = goodVerdict();
  o.network.newHosts = 'api.example.com';
  assert.equal(valid(o), false);
});
test('verdict.json: relevant が真偽値でなければ誤り', () => {
  const o = goodVerdict();
  o.security.relevantToThisBuild[0].relevant = 'no';
  assert.equal(valid(o), false);
});
test('verdict.json: proposal は keep か removal-unit:<ID>', () => {
  const o = goodVerdict();
  o.newUpstreamParts = [{ path: 'extensions/foo', proposal: 'removal-unit:A-7', why: 'x' }];
  assert.equal(valid(o), true);
  for (const bad of ['maybe', 'removal-unit:', 'removal-unit', 'KEEP']) {
    o.newUpstreamParts = [{ path: 'extensions/foo', proposal: bad, why: 'x' }];
    assert.equal(valid(o), false, bad);
  }
});
test('verdict.json: 合格なのに build / checks / smoke.auto が ok でないのは矛盾', () => {
  for (const mut of [(o) => (o.build = 'failed'), (o) => (o.checks = 'fail'), (o) => (o.smoke.auto = 'failed')]) {
    const o = goodVerdict();
    mut(o);
    assert.equal(valid(o), false);
  }
});
test('verdict.json: 合格なのに新しい宛先がある（docs/06 の7.3: 許した宛先の外への接続が無い）のは矛盾', () => {
  const o = goodVerdict();
  o.network.newHosts = ['evil.example.com'];
  assert.equal(valid(o), false);
});
test('verdict.json: オブジェクトでないものは誤りを返す（落ちない）', () => {
  for (const x of [null, undefined, 'x', 1, []]) assert.ok(validateVerdict(x).length > 0);
});
test('verdict.json: label を渡せば、違うラベルは誤り', () => {
  assert.ok(validateVerdict(goodVerdict(), { label: '1.148.0-1' }).length > 0);
  assert.deepEqual(validateVerdict(goodVerdict(), { label: '1.147.0-1' }), []);
});
test('guardVerdict: 台本の記録と食い違う合格を見つける', () => {
  assert.ok(guardVerdict(goodVerdict(), { build: 'failed' }).length > 0);
  assert.ok(guardVerdict(goodVerdict(), { newHosts: ['x.example.com'] }).length > 0);
  assert.deepEqual(guardVerdict(goodVerdict(), { checks: 'ok', build: 'ok', smokeAuto: 'ok', newHosts: [] }), []);
});
test('VERDICT_SCHEMA: verdict の列挙が pass / conditional / fail', () => {
  const s = JSON.stringify(VERDICT_SCHEMA);
  for (const w of ['pass', 'conditional', 'fail']) assert.ok(s.includes(`"${w}"`));
});

// ---- claude -p の起動 (docs/06 の7.1、CLAUDE.md の注意) ----
const ENV = { ANTHROPIC_API_KEY: 'sk-test-xxx', PATH: 'p', HOME: 'h' };
const WT = 'C:\\b\\wt\\take-in-1.147.0-1';
const invoke = (kind, env = ENV) => buildClaudeInvocation({ kind, repoRoot: REPO, worktree: WT, env, prompt: 'test', claudePath: 'claude' });

for (const kind of ['verdict', 'repair']) {
  test(`claude -p（${kind}）: -p で起動し、--bare を付けない`, () => {
    const a = invoke(kind).args;
    assert.ok(a.includes('-p') || a.includes('--print'));
    assert.ok(!a.includes('--bare'));
  });
  test(`claude -p（${kind}）: 子の環境変数から ANTHROPIC_API_KEY を外す（ほかは残す）`, () => {
    const inv = invoke(kind);
    assert.ok(!Object.keys(inv.env).some((k) => k.toUpperCase() === 'ANTHROPIC_API_KEY'));
    assert.equal(inv.env.PATH, 'p');
  });
  test(`claude -p（${kind}）: 呼び出し側の env を書き換えない`, () => {
    const env = { ANTHROPIC_API_KEY: 'k', PATH: 'p' };
    invoke(kind, env);
    assert.equal(env.ANTHROPIC_API_KEY, 'k');
  });
  test(`claude -p（${kind}）: --setting-sources があれば project を含む`, () => {
    const a = invoke(kind).args;
    const i = a.indexOf('--setting-sources');
    if (i >= 0) assert.ok(/project/.test(a[i + 1]), a[i + 1]);
  });
  test(`claude -p（${kind}）: 引数に switch.ps1・install-extensions を実行できる道具（Bash）を渡さない`, () => {
    const s = invoke(kind).args.join(' ');
    assert.ok(!/switch\.ps1|install-extensions/.test(s));
    assert.ok(!/Bash\(?(?!git (diff|status))/.test(s.replace(/--disallowedTools\s+\S+/, '')) || /Bash\(git (diff|status)/.test(s));
  });
}
test('claude -p（verdict）: --agent di-renjie を付ける', () => {
  const a = invoke('verdict').args;
  const i = a.indexOf('--agent');
  assert.ok(i >= 0, '--agent が無い');
  assert.equal(a[i + 1], 'di-renjie');
});
test('claude -p（verdict）: 作業場所（cwd）はこのリポジトリの直下（docs/06 の7.1・CLAUDE.md。2026-11-14 に直した）', () => {
  assert.equal(String(invoke('verdict').cwd).replace(/[\\/]+$/, '').toLowerCase(), REPO.replace(/[\\/]+$/, '').toLowerCase());
});
test('claude -p（repair）: cwd は本家の作業ツリー、--agent は付けない、ビルドリポジトリを --add-dir で渡す', () => {
  const inv = invoke('repair');
  assert.equal(String(inv.cwd).toLowerCase(), resolve(WT).toLowerCase());
  assert.ok(!inv.args.includes('di-renjie'));
  const i = inv.args.indexOf('--add-dir');
  assert.ok(i >= 0);
  assert.equal(resolve(inv.args[i + 1]).toLowerCase(), REPO.toLowerCase());
});
test('claude -p: 知らない kind・repoRoot の欠け・空の prompt は例外', () => {
  assert.throws(() => buildClaudeInvocation({ kind: 'x', repoRoot: REPO, prompt: 'a' }));
  assert.throws(() => buildClaudeInvocation({ kind: 'verdict', prompt: 'a' }));
  assert.throws(() => buildClaudeInvocation({ kind: 'verdict', repoRoot: REPO, prompt: '' }));
  assert.throws(() => buildClaudeInvocation({ kind: 'repair', repoRoot: REPO, prompt: 'a' }), /worktree/);
});
test('claudeChildEnv: ANTHROPIC_API_KEY・ANTHROPIC_AUTH_TOKEN・CLAUDE_CODE_SIMPLE（--bare 相当）を、大文字小文字を問わず外す', () => {
  const { env, removed } = claudeChildEnv({ ANTHROPIC_API_KEY: 'a', anthropic_auth_token: 'b', CLAUDE_CODE_SIMPLE: '1', PATH: 'p', Keep: 'k' });
  assert.deepEqual(Object.keys(env).sort(), ['Keep', 'PATH']);
  assert.equal(removed.length, 3);
  assert.ok(!JSON.stringify(removed).includes('"a"'), '値を持たない');
});
test('claudeChildEnv: エディタの統合ターミナル由来の変数（ELECTRON_RUN_AS_NODE・VSCODE_*）も外す', () => {
  const { env } = claudeChildEnv({ ELECTRON_RUN_AS_NODE: '1', VSCODE_PID: '1', PATH: 'p' });
  assert.deepEqual(Object.keys(env), ['PATH']);
});
test('parseClaudeOutput: structured_output を読む。is_error・空・壊れた JSON は ok:false（落ちない）', () => {
  const ok = parseClaudeOutput(JSON.stringify({ type: 'result', is_error: false, structured_output: { a: 1 }, total_cost_usd: 0.1, num_turns: 3 }));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.structured, { a: 1 });
  assert.equal(parseClaudeOutput(JSON.stringify({ is_error: true, result: 'boom' })).ok, false);
  assert.equal(parseClaudeOutput(JSON.stringify({ is_error: false, result: 'text only' })).ok, false);
  assert.equal(parseClaudeOutput('').ok, false);
  assert.equal(parseClaudeOutput('{not json').ok, false);
});
test('parseCmdShim: npm の .cmd の包みの中の .exe を取り出す', () => {
  const text = '@ECHO off\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n';
  const r = parseCmdShim(text, 'C:\\Users\\u\\AppData\\Roaming\\npm');
  assert.ok(r && /claude\.exe$/i.test(JSON.stringify(r).replace(/\\\\/g, '\\').replace(/"/g, '').replace(/\}$/, '') ) || JSON.stringify(r).includes('claude.exe'));
});

// ---- 修理 (docs/06 の4節の手順 3、7節) ----
test('classifyApplyFailure: 当たった（stoppedAt が無い）なら none', () => {
  assert.equal(classifyApplyFailure({ result: 'ok' }).kind, 'none');
});
test('classifyApplyFailure: edits.patch が当たらない → editsConflict（修理できる）', () => {
  const r = classifyApplyFailure({ stoppedAt: { phase: 'unit', id: 'C-1-ai', message: 'C-1-ai: edits.patch が当たらない' } });
  assert.equal(r.kind, 'editsConflict');
  assert.equal(r.repairable, true);
  assert.equal(r.unitId, 'C-1-ai');
});
test('classifyApplyFailure: パッチの衝突 → patchConflict', () => {
  const r = classifyApplyFailure({ stoppedAt: { phase: 'patch', id: '10-x.patch', message: 'x' } });
  assert.equal(r.kind, 'patchConflict');
  assert.equal(r.repairable, true);
});
test('classifyApplyFailure: 入力・作業ツリー・overlay・組み込み拡張の段階の失敗は修理しない', () => {
  for (const phase of ['inputs', 'worktree', 'overlay', 'builtinExtensions']) {
    assert.equal(classifyApplyFailure({ stoppedAt: { phase, message: 'x' } }).repairable, false, phase);
  }
});
test('classifyApplyFailure: after の単位が当たっていないのは修理しない', () => {
  assert.equal(classifyApplyFailure({ stoppedAt: { phase: 'unit', id: 'B-2', message: 'B-2: after の単位が当たっていない: A-1' } }).repairable, false);
});
test('classifyApplyFailure: checks.json が無いのは修理しない（落ちない）', () => {
  assert.equal(classifyApplyFailure(null).repairable, false);
});
test('findConflictMarkers: <<<<<<<・=======・>>>>>>> の行番号（1 始まり）。普通の ======= の見出しは…', () => {
  assert.deepEqual(findConflictMarkers('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> x\nd\n'), [2, 4, 6]);
  assert.deepEqual(findConflictMarkers('clean\nfile\n'), []);
  assert.deepEqual(findConflictMarkers(''), []);
  assert.deepEqual(findConflictMarkers('a\r\n<<<<<<< HEAD\r\nb\r\n'), [2]);
});
test('outsideAllowed: removals/・patches/ の外の変更だけを返す（規約: それ以外を書き換えない）', () => {
  const porcelain = ' M removals/C-1/edits.patch\n M patches/10-a.patch\n M src/foo.ts\n?? scripts/x.mjs\n';
  assert.deepEqual(outsideAllowed(porcelain).sort(), ['scripts/x.mjs', 'src/foo.ts']);
  assert.deepEqual(outsideAllowed(' M removals/a/unit.json\n'), []);
  assert.deepEqual(outsideAllowed(''), []);
});
test('outsideAllowed: 名前の変更（R a -> b）は行き先で見る。removals-evil/ のような前方一致の偽装を通さない', () => {
  assert.deepEqual(outsideAllowed('R  removals/a -> src/b\n'), ['src/b']);
  assert.deepEqual(outsideAllowed(' M removals-evil/x\n'), ['removals-evil/x']);
});
test('outsideAllowed: ../ で外へ出るパスを通さない', () => {
  assert.ok(outsideAllowed(' M removals/../src/x.ts\n').length > 0);
});
test('groupFixes: unit:<ID> と patch:<name>.patch ごとに分け、持ち主が不明なものは unknown', () => {
  const r = groupFixes([
    { file: 'a.ts', owner: 'unit:C-1-ai' },
    { file: 'b.ts', owner: 'unit:C-1-ai' },
    { file: 'c.ts', owner: 'patch:10-x.patch' },
    { file: 'd.ts', owner: 'unknown' },
    { file: 'e.ts' },
  ]);
  assert.deepEqual(r.groups['unit:C-1-ai'], ['a.ts', 'b.ts']);
  assert.deepEqual(r.groups['patch:10-x.patch'], ['c.ts']);
  assert.deepEqual(r.unknown, ['d.ts', 'e.ts']);
});

// ---- 引数 ----
test('parseTakeInArgs: core <tag>', () => {
  const a = parseTakeInArgs(['core', '1.147.0']);
  assert.equal(a.command, 'core');
  assert.equal(a.tag, '1.147.0');
  assert.equal(a.maxRepair, 3);
});
test('parseTakeInArgs: ext <id> は版を省ける（2026-11-14 に直した）。版があれば読む', () => {
  assert.equal(parseTakeInArgs(['ext', 'anthropic.claude-code']).version, null);
  assert.equal(parseTakeInArgs(['ext', 'anthropic.claude-code', '2.1.330']).version, '2.1.330');
});
test('parseTakeInArgs: 誤りは例外（サブコマンド無し・tag 無し・id 無し・知らないサブコマンド・知らない引数・形の違うタグ）', () => {
  for (const argv of [[], ['core'], ['ext'], ['bogus'], ['core', '1.147.0', '--nope'], ['core', 'latest'], ['core', '1.147.0', '1.148.0'], ['ext', 'not-an-id']]) {
    assert.throws(() => parseTakeInArgs(argv), undefined, JSON.stringify(argv));
  }
});
test('parseTakeInArgs: core だけ・ext だけの引数を取り違えたら例外', () => {
  assert.throws(() => parseTakeInArgs(['core', '1.147.0', '--security']));
  assert.throws(() => parseTakeInArgs(['ext', 'a.b', '--from', 'apply']));
});
test('parseTakeInArgs: --max-repair の範囲、--dry-run、--no-repair', () => {
  assert.equal(parseTakeInArgs(['core', '1.147.0', '--max-repair', '5']).maxRepair, 5);
  assert.throws(() => parseTakeInArgs(['core', '1.147.0', '--max-repair', '0']));
  assert.throws(() => parseTakeInArgs(['core', '1.147.0', '--max-repair', 'x']));
  const a = parseTakeInArgs(['core', '1.147.0', '--dry-run', '--no-repair']);
  assert.equal(a.dryRun, true);
  assert.equal(a.noRepair, true);
});
test('parseTakeInArgs: 値を取る引数の値が無ければ例外', () => {
  assert.throws(() => parseTakeInArgs(['core', '1.147.0', '--label']));
  assert.throws(() => parseTakeInArgs(['core', '1.147.0', '--label', '--dry-run']));
});
test('extLabel・branchFor: ext-<id>-<version>、take-in/<label>', () => {
  assert.equal(extLabel('Anthropic.Claude-Code', '2.1.330'), 'ext-anthropic.claude-code-2.1.330');
  assert.equal(branchFor('1.147.0-1'), 'take-in/1.147.0-1');
  assert.throws(() => branchFor('bad label'));
  assert.throws(() => branchFor('../x'));
});

// ---- 前回から後のリリース・アドバイザリ (docs/06 の3節) ----
test('selectReleases: 前回の取り込みより後、新しいタグ以下を、新しい順に（1週に複数出たとき）', () => {
  const rel = [{ tag_name: '1.148.0' }, { tag_name: '1.147.1' }, { tag_name: '1.147.0' }, { tag_name: '1.146.0' }];
  assert.deepEqual(selectReleases(rel, '1.146.0', '1.147.1').map((r) => r.tag_name), ['1.147.1', '1.147.0']);
});
test('selectReleases: 下書き・プレリリース・本体以外のタグを除く', () => {
  const rel = [{ tag_name: '1.147.0', draft: true }, { tag_name: '1.147.1', prerelease: true }, { tag_name: 'vsda-v1.0.0' }, { tag_name: '1.147.2' }];
  assert.deepEqual(selectReleases(rel, '1.146.0', '1.147.2').map((r) => r.tag_name), ['1.147.2']);
});
test('selectReleases: 数として比べる（1.10.0 > 1.9.0）', () => {
  const rel = [{ tag_name: '1.10.0' }, { tag_name: '1.9.0' }];
  assert.deepEqual(selectReleases(rel, '1.9.0', '1.10.0').map((r) => r.tag_name), ['1.10.0']);
});
test('selectAdvisories: 修正版が (前回, 新しい版] に入るものだけ（途中の版の修正を含める）', () => {
  const adv = (id, patched) => ({ ghsa_id: id, published_at: '2026-01-01T00:00:00Z', vulnerabilities: [{ patched_versions: patched }] });
  const got = selectAdvisories([adv('in', '1.147.0'), adv('old', '1.140.0'), adv('future', '1.149.0'), adv('mid', '1.146.5')], { prevTag: '1.146.0', newTag: '1.148.0' });
  assert.deepEqual(got.map((a) => a.ghsa_id).sort(), ['in', 'mid']);
});
test('parseLsRemote: 注釈つきタグは ^{} の先を採る。無ければ null', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  assert.equal(parseLsRemote(`${a}\trefs/tags/1.147.0\n${b}\trefs/tags/1.147.0^{}\n`, '1.147.0'), b);
  assert.equal(parseLsRemote(`${a}\trefs/tags/1.147.0\n`, '1.147.0'), a);
  assert.equal(parseLsRemote(`${a}\trefs/tags/1.147.1\n`, '1.147.0'), null);
  assert.equal(parseLsRemote('', '1.147.0'), null);
});

// ---- ToDo への書き戻し・検知の最後の成功 (docs/06 の2.3・4節の10) ----
test('readWatchStatus: 3日以内なら警告しない。3日より古い・記録が無い・壊れているは警告', () => {
  const now = new Date('2026-11-14T00:00:00Z');
  const st = (iso) => readWatchStatus({ statePath: 'x', now, read: () => JSON.stringify({ lastSuccessAt: iso }) });
  assert.equal(st('2026-11-13T00:00:00Z').warn, false);
  assert.equal(st('2026-11-11T12:00:00Z').warn, false);
  assert.equal(st('2026-11-10T00:00:00Z').warn, true);
  assert.equal(readWatchStatus({ statePath: 'x', now, read: () => { throw new Error('ENOENT'); } }).warn, true);
  assert.equal(readWatchStatus({ statePath: 'x', now, read: () => '{broken' }).warn, true);
  assert.equal(readWatchStatus({ statePath: 'x', now, read: () => '{}' }).warn, true);
});
test('writeBack: 部品が無くても例外にせず ok:false（取り込みは止めない）', async () => {
  const r = await writeBack(REPO, { target: { kind: 'core' }, label: 'x' }, { find: async () => ({ fn: null, tried: ['a'] }) });
  assert.equal(r.ok, false);
  assert.equal(r.attempted, false);
});
test('writeBack: 部品が例外を投げても止めない', async () => {
  const r = await writeBack(REPO, { target: { kind: 'core' }, label: 'x' }, { find: async () => ({ fn: async () => { throw new Error('boom'); }, name: 'writeBackTakeIn', file: join(REPO, 'a.mjs') }) });
  assert.equal(r.ok, false);
  assert.equal(r.attempted, true);
  assert.match(r.message, /boom/);
});
test('writeBack: 部品の ok:false と reason を写す。ext は extId を渡す', async () => {
  let got;
  const r = await writeBack(REPO, { target: { kind: 'ext', id: 'anthropic.claude-code' }, label: 'ext-a-1.0.0', verdict: 'pass', reasons: [], verdictPath: 'v.md' }, {
    find: async () => ({ fn: async (a) => { got = a; return { ok: false, pageId: null, reason: 'トークン失効' }; }, name: 'writeBackTakeIn', file: join(REPO, 'a.mjs') }),
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /トークン失効/);
  assert.equal(got.kind, 'ext');
  assert.equal(got.extId, 'anthropic.claude-code');
});

// ---- adopt (docs/06 の8節の2、docs/02 の2節) ----
const adoptBase = () => ({ label: '1.147.0-1', verdict: goodVerdict(), branchExists: true, branch: 'main', clean: true, tagExists: false, force: false, records: true, keepBranch: false, builderWorktree: null });
const names = (p) => p.steps.map((s) => s.name);
test('planAdopt: 合格なら、マージ → 記録 → タグの順で計画を返す（main に取り込み、タグを打つ）', () => {
  const p = planAdopt(adoptBase());
  assert.equal(p.ok, true);
  const n = names(p);
  assert.ok(n.indexOf('merge') < n.indexOf('tag'));
  const tag = p.steps.find((s) => s.name === 'tag');
  assert.ok(tag.git.includes('1.147.0-1'));
  assert.ok(p.steps.find((s) => s.name === 'merge').git.includes('take-in/1.147.0-1'));
});
test('planAdopt: プッシュはしない（git push を含めない）', () => {
  assert.ok(!JSON.stringify(planAdopt(adoptBase()).steps).includes('push'));
});
test('planAdopt: 判定が fail なら --force が無ければ止める（コード 4）。--force があれば進める', () => {
  const o = adoptBase();
  o.verdict = { ...o.verdict, verdict: 'fail', recommendation: '見送る' };
  const p = planAdopt(o);
  assert.equal(p.ok, false);
  assert.equal(p.code, 4);
  assert.equal(planAdopt({ ...o, force: true }).ok, true);
});
test('planAdopt: main にいない・変更がある・ブランチが無い・タグが既にある・判定が無いは止める', () => {
  for (const mut of [{ branch: 'feature' }, { clean: false }, { branchExists: false }, { tagExists: true }, { verdict: null }]) {
    const p = planAdopt({ ...adoptBase(), ...mut });
    assert.equal(p.ok, false, JSON.stringify(mut));
    assert.deepEqual(p.steps, []);
  }
});
test('planAdopt: 判定の label が違えば止める。ラベルの形が違えば止める', () => {
  assert.equal(planAdopt({ ...adoptBase(), verdict: { ...goodVerdict(), label: '9.9.9-1' } }).ok, false);
  assert.equal(planAdopt({ ...adoptBase(), label: '../x' }).ok, false);
  assert.equal(planAdopt({ ...adoptBase(), label: '' }).ok, false);
});
test('planAdopt: --keep-branch ならブランチを消さない。--no-records なら記録をコミットしない', () => {
  assert.ok(!names(planAdopt({ ...adoptBase(), keepBranch: true })).includes('delete-branch'));
  assert.ok(names(planAdopt(adoptBase())).includes('delete-branch'));
  assert.ok(!names(planAdopt({ ...adoptBase(), records: false })).some((n) => n.startsWith('commit-records')));
});
test('planAdopt: 条件付きは警告を付けて進める', () => {
  const o = adoptBase();
  o.verdict = { ...o.verdict, verdict: 'conditional', conditions: ['新しい宛先を決める'], recommendation: '条件を満たしてから' };
  const p = planAdopt(o);
  assert.equal(p.ok, true);
  assert.ok(p.warnings.length > 0);
});
test('planAdopt: ext のラベルでは switch.ps1 でなく install-extensions.mjs を次の手順に出す', () => {
  const o = { ...adoptBase(), label: 'ext-anthropic.claude-code-2.1.330', verdict: { ...goodVerdict(), label: 'ext-anthropic.claude-code-2.1.330' } };
  const p = planAdopt(o);
  assert.equal(p.ok, true);
  assert.match(p.steps.find((s) => s.name === 'next').note, /install-extensions/);
});

// ---- 台本の入口（副作用の無い範囲）----
const run = (file, args) => spawnSync(process.execPath, [join(REPO, 'scripts', file), ...args], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
test('take-in.mjs: 引数なしは終了コード 2 で、使い方を出す', () => {
  const r = run('take-in.mjs', []);
  assert.equal(r.status, 2);
  assert.match(r.stdout + r.stderr, /core/);
});
test('take-in.mjs: core にタグが無い・ext に id が無い・知らないサブコマンドは 2', () => {
  for (const argv of [['core'], ['ext'], ['bogus']]) assert.equal(run('take-in.mjs', argv).status, 2, JSON.stringify(argv));
});
test('adopt.mjs: ラベルが無ければ 2（main へのマージもタグ付けもしない）', () => {
  assert.equal(run('adopt.mjs', []).status, 2);
});
test('TAKE-IN.md: docs/06 の7.2 の規約（単位の意図を変えない・最小のパッチ・外を書かない・圧縮 JS を読まない・提案だけ）とコミットの名前', () => {
  const r = spawnSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(REPO, 'TAKE-IN.md'))},'utf8'))`], { encoding: 'utf8' });
  const t = r.stdout;
  assert.ok(t.length > 0, 'TAKE-IN.md が無い');
  for (const w of ['intent', '要判断', '最小', 'switch.ps1', 'install-extensions', 'shuko-apply', 'apply@shuko.invalid']) assert.ok(t.includes(w), w);
});
