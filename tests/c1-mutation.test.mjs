// c1-unit.test.mjs が、壊した単位(unit.json・edits.patch)で落ちることを確かめる(検査が空振りしていないことの見張り)。
// removals/ には書かず、一時のフォルダに写しを作り、環境変数 AIED_C1_UNIT_DIR でそこを指して c1-unit.test.mjs を子プロセスで走らせる。
// 壊さない写しは全部通る(対照)。壊した写しは、期待のテストが落ちる。行数・sha に頼らず、文字列の置き換えで壊す。
// Run: node --test tests/c1-mutation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './build/temp-root.mjs'; // os.tmpdir() を tmp\tests-temp に向ける（C: に出さない）
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'removals', 'C-1-ai');
const noSrc = existsSync(join(SRC, 'unit.json')) && existsSync(join(SRC, 'edits.patch')) ? false : '実装なし: removals/C-1-ai の unit.json か edits.patch が無い';

/** 写しを作って c1-unit.test.mjs を走らせ、落ちたテストの名前の配列を返す。 */
function run(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'c1mut-'));
  try {
    copyFileSync(join(SRC, 'README.md'), join(dir, 'README.md'));
    let patch = readFileSync(join(SRC, 'edits.patch'), 'utf8');
    const unit = JSON.parse(readFileSync(join(SRC, 'unit.json'), 'utf8').replace(/^﻿/, ''));
    const before = patch;
    const res = mutate ? mutate({ patch, unit }) : { patch, unit };
    patch = res.patch;
    writeFileSync(join(dir, 'edits.patch'), patch);
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(res.unit, null, 2));
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join('tests', 'c1-unit.test.mjs')], {
      // NODE_TEST_CONTEXT が残っていると、子の node --test が「再帰」として何も走らせない
      cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, NODE_TEST_CONTEXT: undefined, AIED_C1_UNIT_DIR: dir },
    });
    const failed = [...(r.stdout || '').matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
    const count = Number(/^# tests (\d+)/m.exec(r.stdout || '')?.[1] ?? 0);
    return { failed, count, out: `${(r.stdout || '').slice(0, 600)}\n${(r.stderr || '').slice(0, 600)}`, changed: res.patch !== before || JSON.stringify(res.unit) !== JSON.stringify(unit), status: r.status };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const sub = (text, from, to, all = false) => {
  const re = typeof from === 'string' ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), all ? 'g' : '') : from;
  const out = text.replace(re, to);
  assert.notEqual(out, text, `置き換えが当たらない: ${String(from).slice(0, 60)}`);
  return out;
};

test('c1-mutation: 壊さない写しは c1-unit.test.mjs が全部通る(対照)', { skip: noSrc }, () => {
  const r = run(null);
  assert.ok(r.count >= 30, `c1-unit.test.mjs のテストが走っていない(件数 ${r.count}): ${r.out}`);
  assert.deepEqual(r.failed, []);
  assert.equal(r.status, 0);
});

const CASES = [
  ['件名が違う', ({ patch, unit }) => ({ patch: sub(patch, 'Subject: [PATCH] unit C-1-ai: edits', 'Subject: [PATCH] unit C-1-ai: other'), unit }), /件名/],
  ['作者が違う', ({ patch, unit }) => ({ patch: sub(patch, /^From: shuko-apply /m, 'From: someone '), unit }), /作者/],
  ['selectChatModels が [] 以外を返す', ({ patch, unit }) => ({ patch: sub(patch, /(selectChatModels: \(_selector\) => \{\r?\n\+\t\t\treturn )Promise\.resolve\(\[\]\)/, "$1Promise.resolve(['x'])"), unit }), /selectChatModels/],
  ['invokeTool が reject しない', ({ patch, unit }) => ({ patch: sub(patch, 'Promise.reject(removedError(`Tool', 'Promise.resolve(removedError(`Tool'), unit }), /invokeTool/],
  ['提案中の API の門が消える', ({ patch, unit }) => ({ patch: sub(patch, "checkProposedApiEnabled(extension, 'chatSessionsProvider');", '', true), unit }), /門|提案中の API/],
  ['安定版の API に門が付く', ({ patch, unit }) => ({ patch: sub(patch, /(createChatParticipant\(id: string, handler: vscode\.ChatExtendedRequestHandler\) \{\r?\n\+)/, "$1\t\t\tcheckProposedApiEnabled(extension, 'chatParticipantPrivate');\n+"), unit }), /安定版/],
  ['イベントが Event.None でなくなる', ({ patch, unit }) => ({ patch: sub(patch, /(onDidChangeChatModels: \(listener, thisArgs\?, disposables\?\) => \{\r?\n\+\t\t\treturn )Event\.None\(listener, thisArgs, disposables\)/, '$1new Emitter<void>().event(listener, thisArgs, disposables)'), unit }), /イベント|onDidChangeChatModels/],
  ['NullChatEntitlementService が契約を持つ', ({ patch, unit }) => ({ patch: sub(patch, 'readonly entitlement = ChatEntitlement.Unknown;', 'readonly entitlement = ChatEntitlement.Pro;'), unit }), /契約なし|NullChatEntitlementService/],
  ['NullChatEntitlementService が文脈キーを立てない', ({ patch, unit }) => ({ patch: sub(patch, 'ChatEntitlementContextKeys.Setup.hidden.bindTo(contextKeyService).set(true);', ''), unit }), /文脈キー/],
  ['NullChatEntitlementService が通信を呼ぶ', ({ patch, unit }) => ({ patch: sub(patch, 'async update(): Promise<void> { }', 'async update(): Promise<void> { await fetch("https://x.invalid"); }'), unit }), /通信|操作は空/],
  ['新しいファイルが new file でなくなる', ({ patch, unit }) => ({ patch: sub(patch, /(diff --git a\/src\/vs\/workbench\/api\/common\/extHostRemovedApi\.ai\.ts b\/[^\n]+\r?\n)new file mode 100644/, '$1old mode 100644'), unit }), /新しいファイル|作る/],
  ['NullChatEntitlementService が別のファイルに戻る(新しいファイルが2つになる)', ({ patch, unit }) => ({ patch: patch + '\ndiff --git a/src/vs/workbench/services/chat/common/nullChatEntitlementService.ts b/src/vs/workbench/services/chat/common/nullChatEntitlementService.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/src/vs/workbench/services/chat/common/nullChatEntitlementService.ts\n@@ -0,0 +1 @@\n+export {};\n', unit }), /新しいファイルは extHostRemovedApi/],
  ['NullChatEntitlementService の登録がクラスより前に来る', ({ patch, unit }) => ({ patch: sub(sub(patch, '+// Shuko (C-1-ai): register the implementation that never asks for the Copilot entitlements.\n+registerSingleton(IChatEntitlementService, NullChatEntitlementService, InstantiationType.Eager /* To ensure context keys are set asap */);', ''), '+export class NullChatEntitlementService implements IChatEntitlementService {', '+registerSingleton(IChatEntitlementService, NullChatEntitlementService, InstantiationType.Eager);\n+export class NullChatEntitlementService implements IChatEntitlementService {'), unit }), /登録がクラスより前|登録/],
  ['pnpm-workspace.yaml の allowBuilds に本家に無い行', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'pnpm-workspace.yaml', line: 'nonexistent-pkg@9.9.9: true' }] } }), /removeLines の各行/],
  ['登録が元の ChatEntitlementService に戻る', ({ patch, unit }) => ({ patch: sub(patch, 'registerSingleton(IChatEntitlementService, NullChatEntitlementService', 'registerSingleton(IChatEntitlementService, ChatEntitlementService'), unit }), /登録/],
  ['delete したファイルを patch が直す', ({ patch, unit }) => ({ patch: patch + '\ndiff --git a/src/vs/workbench/contrib/chat/browser/x.ts b/src/vs/workbench/contrib/chat/browser/x.ts\nindex 1..2 100644\n--- a/src/vs/workbench/contrib/chat/browser/x.ts\n+++ b/src/vs/workbench/contrib/chat/browser/x.ts\n@@ -1 +1 @@\n-a\n+b\n', unit }), /delete したファイルを直そう/],
  ['kept から MCP の認証のサービスが消える', ({ patch, unit }) => ({ patch, unit: { ...unit, kept: unit.kept.filter((k) => !k.path.endsWith('authenticationMcpService.ts')) } }), /kept に MCP/],
  ['delete と kept に同じパス', ({ patch, unit }) => ({ patch, unit: { ...unit, delete: [...unit.delete, 'src/vs/workbench/contrib/comments'] } }), /delete と kept/],
  ['removeLines に delete 外の import', ({ patch, unit }) => ({ patch, unit: { ...unit, removeLines: [...unit.removeLines, { file: 'src/vs/workbench/workbench.common.main.ts', line: "import './services/keep/keep.js';" }] } }), /removeLines の各行/],
  ['patch の指定が消える', ({ patch, unit }) => { const { patch: _p, ...rest } = unit; return { patch, unit: rest }; }, /patch が edits\.patch/],
  // 所(メンバー)ごとの門(5回目)。名前の集まりでは見えない抜け(同じ提案の名前が別の所に出る)を、メンバーごとの走らせる検査が見つける
  ['registerToolDefinition の門が消える', ({ patch, unit }) => ({ patch: sub(patch, /\+\t\t\tcheckProposedApiEnabled\(extension, 'languageModelToolSupportsModel'\);\r?\n/, ''), unit }), /メンバーごとに門|提案中の API の門が、本家/],
  ['fileIsIgnored の門が消える(同じ提案 chatParticipantAdditions は別の所に残る)', ({ patch, unit }) => ({ patch: sub(patch, /\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantAdditions'\);\r?\n(\+\t\t\treturn Promise\.resolve\(false\);)/, '+\t\t\t// no gate\n$1'), unit }), /メンバーごとに門/],
  ['registerIgnoredFileProvider の門が消える(同じ提案 chatParticipantPrivate は別の所に残る)', ({ patch, unit }) => ({ patch: sub(patch, /(registerIgnoredFileProvider\(_provider[^\n]*\n\+[^\n]*\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantPrivate'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['registerIgnoredFileProvider の門が別の提案になる', ({ patch, unit }) => ({ patch: sub(patch, /(registerIgnoredFileProvider\(_provider[^\n]*\n\+[^\n]*\n\+\t\t\tcheckProposedApiEnabled\(extension, ')chatParticipantPrivate/, '$1chatParticipantAdditions'), unit }), /メンバーごとに門/],
  ['参加者の helpTextPrefix の門が消える', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tget helpTextPrefix\(\) \{\r?\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'defaultChatParticipant'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['参加者の titleProvider の書き込みの門が消える', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tset titleProvider\(v\) \{\r?\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'defaultChatParticipant'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['参加者の supportIssueReporting の門が消える', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tget supportIssueReporting\(\) \{\r?\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantPrivate'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['参加者の participantVariableProvider の門が消える', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tget participantVariableProvider\(\) \{\r?\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantAdditions'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['参加者の onDidChangePauseState の門が消える', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\tget onDidChangePauseState\(\) \{\r?\n)\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantAdditions'\);\r?\n/, '$1'), unit }), /メンバーごとに門/],
  ['参加者の onDidPerformAction が提案なしでもイベントになる', ({ patch, unit }) => ({ patch: sub(patch, '+\t\t\t? undefined!', '+\t\t\t? Event.None'), unit }), /参加者の値/],
  ['fileIsIgnored が有効な拡張でも reject する', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\t\tcheckProposedApiEnabled\(extension, 'chatParticipantAdditions'\);\r?\n)\+\t\t\treturn Promise\.resolve\(false\);/, '$1+\t\t\treturn Promise.reject(new Error("x"));'), unit }), /fileIsIgnored|lm\.tools/],
  // 型の網(案A): 省略できる型の直しを外すと、?. なしで読む行を型検査が止めなくなる
  ['defaultChatAgent の型の直し(?:)を外す', ({ patch, unit }) => ({ patch: sub(patch, '+\treadonly defaultChatAgent?: IDefaultChatAgent;', '+\treadonly defaultChatAgent: IDefaultChatAgent;'), unit }), /型の網|残るコードが/],
  ['builtInExtensionsEnabledWithAutoUpdates の型の直し(?:)を外す', ({ patch, unit }) => ({ patch: sub(patch, '+\treadonly builtInExtensionsEnabledWithAutoUpdates?: readonly string[];', '+\treadonly builtInExtensionsEnabledWithAutoUpdates: readonly string[];'), unit }), /型の網|残るコードが/],
  ['registerToolDefinition が有効な拡張でも投げる', ({ patch, unit }) => ({ patch: sub(patch, /(\+\t\t\tcheckProposedApiEnabled\(extension, 'languageModelToolSupportsModel'\);\r?\n)\+\t\t\treturn noopDisposable\(\);/, "$1+\t\t\tthrow new Error('x');"), unit }), /fileIsIgnored|registerToolDefinition|登録系/],
];

for (const [name, mutate, expect] of CASES) {
  test(`c1-mutation: ${name} と c1-unit.test.mjs が落ちる`, { skip: noSrc }, () => {
    const r = run(mutate);
    assert.ok(r.changed, '壊れていない');
    assert.ok(r.failed.length > 0, '何も落ちない(検査が空振りしている)');
    assert.ok(r.failed.some((n) => expect.test(n)), `期待のテストが落ちない。落ちたもの: ${JSON.stringify(r.failed)}`);
  });
}
