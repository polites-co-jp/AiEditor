// C-1-ai（本家の AI）の単位のファイルの静的な検査と、何もしない実装の検査。ビルドリポジトリの中だけで済む。
// 仕様: docs/03 の3節（unit.json）・4節（段階 C の表と末尾の箇条書き）・5.1・5.3・9節、
//       docs/user-decisions.md の 2026-11-14（C-1 の範囲）と 2026-11-15（edits.patch を作るときに出た点）。
// 行数・sha・パッチの並びには頼らない: edits.patch はファイルごとの区画に分け、新しいファイルの本文は「+ の行」から読む。
// 一般の形の検査は tests/removals.test.mjs が全単位にかける。ここは C-1 に固有の分だけ。
// 走らせる形が要る検査（VS Code のテストの仕組み）は tests/removals/c1-gate-script.md に書く（実行は大岡越前守）。
// Run: node --test tests/c1-unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareMemberGates, expectChecked, memberGatesOf, outerSyncGateNames } from './gate-members.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// AIED_C1_UNIT_DIR: 単位のフォルダの代わり(tests/c1-mutation.test.mjs が、壊した写しでこのテストが落ちることを確かめるのに使う)
const UNIT_DIR = process.env.AIED_C1_UNIT_DIR ? resolve(process.env.AIED_C1_UNIT_DIR) : join(REPO, 'removals', 'C-1-ai');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const noUnit = existsSync(join(UNIT_DIR, 'unit.json')) ? false : '実装なし: removals/C-1-ai/unit.json が無い';
const unit = noUnit ? null : readJson(join(UNIT_DIR, 'unit.json'));
const patchFile = unit?.patch ? join(UNIT_DIR, unit.patch) : null;
const noPatch = noUnit || (patchFile && existsSync(patchFile) ? false : '実装なし: edits.patch が無い');

// 本家 1.146.0（常設の clone のタグ）。読めなければ、本家の実在を見る検査だけ飛ばす。
const UP_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const upOk = existsSync(UP_REPO) && spawnSync('git', ['-C', UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`]).status === 0;
const upHas = (p) => spawnSync('git', ['-C', UP_REPO, 'cat-file', '-e', `${UP_TAG}:${p}`]).status === 0;
const upShow = (p) => { const r = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null; };

// ---------------------------------------------------------------------------
// edits.patch を、ファイルごとの区画に分ける
// ---------------------------------------------------------------------------
const patchText = noPatch ? '' : readFileSync(patchFile, 'utf8').replace(/\r\n/g, '\n');
const sections = []; // { path, isNew, isDelete, added: string[], removed: string[] }
{
  let cur = null;
  let inHunk = false;
  for (const line of patchText.split('\n')) {
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (m) { cur = { path: m[2], isNew: false, isDelete: false, added: [], removed: [] }; sections.push(cur); inHunk = false; continue; }
    if (!cur) continue;
    if (!inHunk) {
      if (/^new file mode/.test(line)) cur.isNew = true;
      else if (/^deleted file mode/.test(line)) cur.isDelete = true;
      else if (/^@@ /.test(line)) inHunk = true;
      continue;
    }
    if (/^@@ /.test(line)) continue;
    if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
}
const section = (suffix) => sections.find((s) => s.path.endsWith(suffix));
const body = (suffix) => (section(suffix)?.added ?? []).join('\n');

const NEW_API = 'src/vs/workbench/api/common/extHostRemovedApi.ai.ts';
const NEW_ENT = 'src/vs/workbench/services/chat/common/nullChatEntitlementService.ts';

const underAny = (list, p) => list.some((d) => {
  const dd = d.replace(/\/+$/, '');
  return p === dd || p.startsWith(dd + '/');
});

// ---------------------------------------------------------------------------
// 1. 単位のファイルの静的な検査
// ---------------------------------------------------------------------------
test('C-1: unit.json の patch が edits.patch で、ファイルがあり、空でない', { skip: noUnit }, () => {
  assert.equal(unit.patch, 'edits.patch');
  assert.ok(existsSync(patchFile), 'edits.patch が無い');
  assert.ok(patchText.length > 0, 'edits.patch が空');
  assert.ok(sections.length > 0, 'diff --git の区画が無い');
});

test('C-1: edits.patch の件名が [PATCH] unit C-1-ai: edits（applyEdits が件名で単位を見分ける）', { skip: noPatch }, () => {
  assert.match(patchText, /^Subject: \[PATCH\] unit C-1-ai: edits$/m);
});

test('C-1: edits.patch の作者が shuko-apply（コミットの作者の取り決め）', { skip: noPatch }, () => {
  assert.match(patchText, /^From: shuko-apply /m);
});

test('C-1: kept に MCP の認証の3つのサービスがある（理由つき。2026-11-15 の判断）', { skip: noUnit }, () => {
  const base = 'src/vs/workbench/services/authentication/browser/';
  const keptPaths = new Set((unit.kept ?? []).map((k) => k.path));
  for (const f of ['authenticationMcpService.ts', 'authenticationMcpAccessService.ts', 'authenticationMcpUsageService.ts']) {
    assert.ok(keptPaths.has(base + f), `kept に ${f} が無い`);
  }
});

test('C-1: Claude Code の受け手（コメント）と、残すと決めた部品が kept にある', { skip: noUnit }, () => {
  const keptPaths = new Set((unit.kept ?? []).map((k) => k.path));
  for (const p of ['src/vs/workbench/contrib/comments', 'src/vs/workbench/services/chat', 'src/vs/platform/chat',
    'src/vs/workbench/contrib/speech', 'src/vs/workbench/common/agentsColors.ts', 'src/vs/workbench/contrib/imageCarousel']) {
    assert.ok(keptPaths.has(p), `kept に ${p} が無い`);
  }
});

test('C-1: delete と kept に同じパスが無い。kept のパスの上にも下にも delete が無い', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  const clash = [];
  for (const k of unit.kept ?? []) {
    const kp = k.path.replace(/\/+$/, '');
    for (const d of del) {
      if (d === kp) clash.push(`同じ: ${kp}`);
      else if (kp.startsWith(d + '/')) clash.push(`kept ${kp} が delete ${d} の中`);
      else if (d.startsWith(kp + '/')) clash.push(`delete ${d} が kept ${kp} の中`);
    }
  }
  assert.deepEqual(clash, []);
});

test('C-1: delete の中に重複が無い', { skip: noUnit }, () => {
  const del = (unit.delete ?? []).map((d) => d.replace(/\/+$/, ''));
  assert.deepEqual(del.filter((d, i) => del.indexOf(d) !== i), []);
});

test('C-1: removeLines の各行が、delete したファイルの import か登録の1行（または消す場所への参照）である', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  const lines = unit.removeLines ?? [];
  const bad = [];
  for (const r of lines) {
    const line = r.line.trim();
    const where = `${r.file}: ${line}`;
    // import / export ... from './x.js' と import './x.js'
    const imp = /^(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?'([^']+)';?$/.exec(line);
    if (imp) {
      const spec = imp[1];
      if (!spec.startsWith('.')) { bad.push(`${where} (相対でない import)`); continue; }
      const target = posix.normalize(posix.join(posix.dirname(r.file), spec)).replace(/\.js$/, '.ts');
      if (!underAny(del, target)) bad.push(`${where} (${target} は delete に無い)`);
      continue;
    }
    // registerSingleton(I..., Impl, ...) / registerWorkbenchContribution2(X.ID, X, ...) / registerAction2(X)
    // 引数の名前が、同じファイルの import の removeLines のどれかで取り込まれていること
    const reg = /^(?:this\._register\()?(registerSingleton|registerWorkbenchContribution2|registerAction2)\((.*)\)\)?;?$/.exec(line);
    if (reg) {
      const names = [...reg[2].matchAll(/\b([A-Z][A-Za-z0-9_]+)\b/g)].map((m) => m[1])
        .filter((n) => !['InstantiationType', 'WorkbenchPhase', 'Delayed', 'Eager', 'AfterRestored', 'Eventually', 'ID'].includes(n));
      const importsHere = lines.filter((x) => x.file === r.file && /^(?:import|export)\b/.test(x.line.trim())).map((x) => x.line);
      const unknown = names.filter((n) => !importsHere.some((il) => new RegExp(`\\b${n}\\b`).test(il)));
      // 引数に挙がる名前のうち、1つでも消す import で取り込まれていれば、消す対象の登録
      if (names.length === 0 || unknown.length === names.length) bad.push(`${where} (登録の名前がどの消す import にも無い)`);
      continue;
    }
    // ビルドの設定・ワークスペースの設定にある、消す場所への参照（'vs/sessions/...'、'src/vs/sessions/test/e2e'、- src/vs/...）
    const ref = /(?:^|['"\s-])((?:src\/)?vs\/[A-Za-z0-9_./-]+)/.exec(line);
    if (ref && !line.startsWith('import ') && !/^register/.test(line)) {
      const p = ref[1].startsWith('src/') ? ref[1] : 'src/' + ref[1];
      // 'vs/platform/agentHost/node/agentHostMain' のように拡張子が無いものは、先頭の場所が delete の中にあればよい
      if (!underAny(del, p) && !underAny(del, p.replace(/\.js$/, '.ts'))) bad.push(`${where} (${p} は delete に無い)`);
      continue;
    }
    // package.json の scripts・pnpm-workspace.yaml の patchedDependencies の項目など、delete したファイルのパスを含む行
    const pathRef = /\b((?:src|build|extensions|test|remote)\/[A-Za-z0-9_./-]+)/.exec(line);
    if (pathRef) {
      if (!underAny(del, pathRef[1])) bad.push(`${where} (${pathRef[1]} は delete に無い)`);
      continue;
    }
    // pnpm-workspace.yaml の allowBuilds の項目(`<パッケージ>@<版>: true|false`)。本家のその節にある行をそのまま消すこと(5回目)。
    // 消した依存が作り直したロックファイルから外れるので、残ると pnpm が「使われない設定」で止まる。
    if (r.file === 'pnpm-workspace.yaml' && /^'?(?:@[\w.-]+\/)?[\w.-]+@\d[\w.-]*'?: (?:true|false)$/.test(line)) {
      if (upOk) {
        const src = spawnSync('git', ['-C', UP_REPO, 'show', `${UP_TAG}:pnpm-workspace.yaml`], { encoding: 'utf8' }).stdout ?? '';
        if (!src.split(/\r?\n/).some((l) => l.trim() === line)) bad.push(`${where} (本家の pnpm-workspace.yaml に無い行)`);
      }
      continue;
    }
    // pnpm-workspace.yaml の見出し `patchedDependencies:` は、同じファイルの項目の行がすべて消える（delete したパッチを指す）ときだけ消してよい
    if (r.file === 'pnpm-workspace.yaml' && line === 'patchedDependencies:') {
      const items = lines.filter((x) => x.file === r.file && x !== r && /\.patch$/.test(x.line.trim()));
      if (items.length === 0) bad.push(`${where} (見出しだけを消している。項目の行が無い)`);
      continue;
    }
    bad.push(`${where} (import でも登録でも消す場所への参照でもない)`);
  }
  assert.deepEqual(bad, []);
});

test('C-1: removeLines の file が、delete したファイルの中ではない（消えるファイルの行を消そうとしない）', { skip: noUnit }, () => {
  const del = unit.delete ?? [];
  const inside = (unit.removeLines ?? []).filter((r) => underAny(del, r.file)).map((r) => `${r.file}: ${r.line}`);
  assert.deepEqual(inside, []);
});

test('C-1: removeLines の file が本家 1.146.0 にある（ファイルの改名に気づく）', { skip: noUnit || (upOk ? false : `本家のソースが読めない: ${UP_REPO} の ${UP_TAG}`) }, () => {
  const files = [...new Set((unit.removeLines ?? []).map((r) => r.file))];
  assert.deepEqual(files.filter((f) => !upHas(f)), []);
});

test('C-1: edits.patch が delete したファイルを直そうとしていない（先に消えるので当たらない）', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const touched = sections.filter((s) => !s.isNew && underAny(del, s.path)).map((s) => s.path);
  assert.deepEqual(touched, []);
});

test('C-1: edits.patch が kept のファイルを消していない', { skip: noPatch }, () => {
  const kept = (unit.kept ?? []).map((k) => k.path);
  const deleted = sections.filter((s) => s.isDelete && underAny(kept, s.path)).map((s) => s.path);
  assert.deepEqual(deleted, []);
});

test('C-1: edits.patch が作る新しいファイルは extHostRemovedApi.ai.ts の1つだけ(5回目。NullChatEntitlementService は chatEntitlementService.ts の末尾)', { skip: noPatch }, () => {
  const s = sections.find((x) => x.path === NEW_API);
  assert.ok(s, `区画が無い: ${NEW_API}`);
  assert.ok(s.isNew, `new file でない: ${NEW_API}`);
  assert.ok(s.added.length > 10, `本文が短すぎる: ${NEW_API}`);
  assert.equal(s.removed.length, 0, `新しいファイルに削除の行がある: ${NEW_API}`);
  assert.deepEqual(sections.filter((x) => x.isNew).map((x) => x.path), [NEW_API], '新しいファイルが extHostRemovedApi.ai.ts の1つだけでない');
  assert.ok(!sections.some((x) => x.path === NEW_ENT), 'nullChatEntitlementService.ts を作る区画が残っている(2つのファイルが互いに import し合う形に戻る)');
});

test('C-1: 新しいファイルは、他の区画と重複しない・本家に元から無い', { skip: noPatch }, () => {
  assert.equal(sections.filter((s) => s.path === NEW_API).length, 1, `区画が重複: ${NEW_API}`);
  if (upOk) assert.equal(upHas(NEW_API), false, `本家に既にある: ${NEW_API}`);
});

test('C-1: edits.patch の区画のパスが相対で、.. を含まない', { skip: noPatch }, () => {
  const odd = sections.filter((s) => s.path.startsWith('/') || s.path.includes('..')).map((s) => s.path);
  assert.deepEqual(odd, []);
});

test('C-1: 新しいファイルの import が、delete で消える場所を指さない・本家か新しいファイルにある', { skip: noPatch }, () => {
  const del = unit.delete ?? [];
  const bad = [];
  for (const p of [NEW_API]) {
    const text = body(p.split('/').slice(-1)[0]);
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+'([^']+)'/gm)) {
      const spec = m[1];
      if (spec === 'vscode') continue;
      const target = posix.normalize(posix.join(posix.dirname(p), spec)).replace(/\.js$/, '.ts');
      if (underAny(del, target)) { bad.push(`${p}: ${spec} は delete の中`); continue; }
      const isNewFile = sections.some((s) => s.isNew && s.path === target);
      if (upOk && !isNewFile && !upHas(target)) bad.push(`${p}: ${spec} (${target}) が本家に無い`);
    }
  }
  assert.deepEqual(bad, []);
});

test('C-1: 登録 registerSingleton(IChatEntitlementService, NullChatEntitlementService ...) を、chatEntitlementService.ts の中で足す(元の登録は消す)', { skip: noPatch }, () => {
  const adders = sections.filter((s) => !s.isNew && s.added.some((l) => /registerSingleton\(\s*IChatEntitlementService\s*,\s*NullChatEntitlementService\b/.test(l)));
  assert.equal(adders.length, 1, '登録を足す区画がちょうど1つでない');
  assert.ok(adders[0].path.endsWith('services/chat/common/chatEntitlementService.ts'), `登録の場所が chatEntitlementService.ts でない: ${adders[0].path}`);
  assert.ok(adders[0].added.some((l) => /^export class NullChatEntitlementService implements IChatEntitlementService\b/.test(l)), '同じファイルにクラスの定義が無い');
  // 元の ChatEntitlementService の登録は消えている（同じ ID を二重に登録しない）
  assert.ok(adders[0].removed.some((l) => /registerSingleton\(\s*IChatEntitlementService\s*,\s*ChatEntitlementService\b/.test(l)), '元の登録が消えていない');
  assert.ok(!adders[0].added.some((l) => /registerSingleton\(\s*IChatEntitlementService\s*,\s*ChatEntitlementService\b/.test(l)));
  // 別のファイルを import しない(互いに import し合う形を作らない)
  assert.ok(!sections.some((s) => s.added.some((l) => /nullChatEntitlementService\.js/.test(l))), 'nullChatEntitlementService.js を import する行が残っている');
});

test('C-1: 新しい API の何もしない実装は、extHost.api.impl.ts などから呼ばれる（作っただけで使われない、にならない）', { skip: noPatch }, () => {
  const used = (name) => sections.some((s) => !s.isNew && s.added.some((l) => l.includes(name)));
  for (const n of ['createRemovedChatApi', 'createRemovedLanguageModelApi', 'createRemovedLanguageModelAccessInformation',
    'createRemovedAgentEditorComments', 'createRemovedChatStatusItem', 'removedTransferActiveChat', 'removedRegisterAITextSearchProvider']) {
    assert.ok(used(n), `${n} を使う所が edits.patch に無い`);
  }
});

// ---------------------------------------------------------------------------
// 2. 何もしない実装の検査（文字列と構文。VS Code のテストの仕組みは走らせない）
// ---------------------------------------------------------------------------
// 対象は新しいファイルの本文（+ の行）。対象の関数の本文を、波括弧の対応で切り出して読む。
const fnBody = (text, startRe) => {
  const m = startRe.exec(text);
  if (!m) return null;
  let i = text.indexOf('{', m.index + m[0].length - 1);
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(i, j + 1); }
  }
  return null;
};
const apiText = noPatch ? '' : body('extHostRemovedApi.ai.ts');
// NullChatEntitlementService は chatEntitlementService.ts の区画の、足す行のうち「export class NullChatEntitlementService」から後ろ
// (5回目で別のファイルから移した)。コメントの前置きも含める。区画の import の追加行は別に entImports に取る。
const entSection = noPatch ? null : sections.find((s) => s.path === 'src/vs/workbench/services/chat/common/chatEntitlementService.ts');
const entAdded = entSection ? entSection.added : [];
const entStart = entAdded.findIndex((l) => /^export class NullChatEntitlementService\b/.test(l));
const entText = entStart >= 0 ? entAdded.slice(entStart).join('\n') : '';
const entImports = entAdded.filter((l) => /^import\b/.test(l));
const noApi = noPatch || (apiText ? false : '実装なし: extHostRemovedApi.ai.ts の本文が無い');
const noEnt = noPatch || (entText ? false : '実装なし: chatEntitlementService.ts の中に NullChatEntitlementService が無い');

// 'x: (listener...) => { ... }' / 'x(listener...) { ... }' の形で、メンバーの本文を取る
const member = (text, name) => {
  const re = new RegExp(`^\\s*(?:get\\s+|async\\s+)?${name}\\s*(?:[:(<]|=)`, 'm');
  const m = re.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index);
  const eol = rest.indexOf('\n');
  const first = rest.slice(0, eol < 0 ? undefined : eol);
  // 1行で閉じる形 'x: () => undefined,'
  if (!first.includes('{') || (first.match(/\{/g) || []).length === (first.match(/\}/g) || []).length && !/\{\s*$/.test(first)) return first;
  const open = rest.indexOf('{', first.search(/\)\s*(?::[^={]*)?(?:=>)?\s*\{/) >= 0 ? first.search(/\)\s*(?::[^={]*)?(?:=>)?\s*\{/) : 0);
  let depth = 0;
  for (let j = open; j < rest.length; j++) {
    if (rest[j] === '{') depth++;
    else if (rest[j] === '}') { depth--; if (depth === 0) return rest.slice(0, j + 1); }
  }
  return null;
};

test('C-1 何もしない実装: createRemovedLanguageModelApi の selectChatModels は [] で resolve する', { skip: noApi }, () => {
  const m = member(apiText, 'selectChatModels');
  assert.ok(m, 'selectChatModels が無い');
  assert.match(m, /Promise\.resolve\(\s*\[\s*\]\s*\)/);
  assert.ok(!/fetch|request|await/i.test(m), '通信か待ちがある');
});

test('C-1 何もしない実装: invokeTool は reject する（Tool "<name>" was not found）', { skip: noApi }, () => {
  const m = member(apiText, 'invokeTool');
  assert.ok(m, 'invokeTool が無い');
  assert.match(m, /Promise\.reject\(/);
  assert.match(m, /was not found/);
  assert.ok(!/Promise\.resolve\(/.test(m), 'resolve する道がある');
  // 文言の定数
  assert.match(apiText, /const REMOVED = 'The built-in AI features are removed from this build'/);
});

test('C-1 何もしない実装: lm.tools は [] 、fileIsIgnored は false で resolve する', { skip: noApi }, () => {
  const t = member(apiText, 'tools');
  assert.ok(t && /return \[\];|=>\s*\[\s*\]/.test(t), 'tools が [] を返さない');
  const f = member(apiText, 'fileIsIgnored');
  assert.ok(f && /Promise\.resolve\(\s*false\s*\)/.test(f), 'fileIsIgnored が false で resolve しない');
});

test('C-1 何もしない実装: 登録系（registerTool・registerLanguageModelChatProvider・registerMcpServerDefinitionProvider ほか）は何もしない Disposable を返す', { skip: noApi }, () => {
  assert.match(apiText, /function noopDisposable\(\)[^{]*\{\s*return \{ dispose\(\) \{ \} \};\s*\}/);
  for (const n of ['registerTool', 'registerToolDefinition', 'registerLanguageModelChatProvider', 'registerMcpServerDefinitionProvider', 'registerIgnoredFileProvider']) {
    const m = member(apiText, n);
    assert.ok(m, `${n} が無い`);
    assert.match(m, /return noopDisposable\(\);/, `${n} が noopDisposable を返さない`);
  }
});

test('C-1 何もしない実装: イベントはすべて Event.None（listener を受ける形は Event.None(...) を返す）', { skip: noApi }, () => {
  // 'onDidXxx: (listener, ...) => { ... }' のメンバー
  const names = [...apiText.matchAll(/^\s*(onDid\w+)\s*[:(]\s*\(?listener\b/gm)].map((m) => m[1]);
  assert.ok(names.length >= 10, `イベントのメンバーが少ない: ${names.length}`);
  // listener を受けない形（値のイベント）は、右辺がちょうど Event.None
  const valueForm = [...apiText.matchAll(/^\s*(onDid\w+)\s*:(?!\s*\(?listener\b)([^\n]*)$/gm)].filter((m) => !/^Event\.None,?$/.test(m[2].trim()) && !(m[1] === 'onDidPerformAction' && /isProposedApiEnabled\(extension, 'chatParticipantAdditions'\)/.test(m[2]))).map((m) => `${m[1]}: ${m[2]}`);
  assert.deepEqual(valueForm, [], '値のイベントが Event.None でない');
  const bad = [];
  for (const n of names) {
    const m = member(apiText, n);
    // embeddings の通知は本物の ExtHostEmbeddings に渡す（裁定: 埋め込みは残す）
    if (n === 'onDidChangeEmbeddingModels') { if (!m || !m.includes('extHostEmbeddings.onDidChange')) bad.push(`${n}: 埋め込みに渡していない`); continue; }
    if (!m || !/Event\.None\(\s*listener\s*,\s*thisArgs\s*,\s*disposables\s*\)/.test(m)) bad.push(`${n}: Event.None を返さない`);
  }
  assert.deepEqual(bad, []);
  // 値のイベント（アクセス情報・参加者）
  assert.match(apiText, /onDidChange: Event\.None,/);
  assert.match(apiText, /onDidReceiveFeedback: Event\.None,|get onDidReceiveFeedback\(\) \{\s*return Event\.None;/);
});

test('C-1 何もしない実装: lm.onDidChangeChatModels は Event.None で、registerLanguageModelChatProvider は何も登録しない', { skip: noApi }, () => {
  const m = member(apiText, 'onDidChangeChatModels');
  assert.ok(m && /Event\.None\(/.test(m));
  const r = member(apiText, 'registerLanguageModelChatProvider');
  assert.ok(r && !/extHost|proxy|\$register/i.test(r), 'RPC の登録がある');
});

test('C-1 何もしない実装: createChatParticipant は id を持つ何もしない参加者（requestHandler を渡すだけ）', { skip: noApi }, () => {
  const p = fnBody(apiText, /function noopChatParticipant\(/);
  assert.ok(p, 'noopChatParticipant が無い');
  assert.match(p, /\bid;?\s*\n|\bid,/);
  assert.match(p, /dispose\(\) \{ \}/);
  const c = member(apiText, 'createChatParticipant');
  // 6回目から、参加者のメンバーが本家と同じ門を持つので、拡張(extension)も渡す
  assert.ok(c && /return noopChatParticipant\((?:extension, )?id, handler\);/.test(c));
});

test('C-1 何もしない実装: 提案中の API の門 checkProposedApiEnabled が残る（services/extensions/common/extensions.js から import）', { skip: noApi }, () => {
  assert.match(apiText, /import \{ checkProposedApiEnabled(?:, isProposedApiEnabled)? \} from '\.\.\/\.\.\/services\/extensions\/common\/extensions\.js';/);
  const calls = [...apiText.matchAll(/checkProposedApiEnabled\(extension, '(\w+)'\)/g)].map((m) => m[1]);
  assert.ok(calls.length >= 30, `門の呼び出しが少ない: ${calls.length}`);
  const proposals = new Set(calls);
  for (const p of ['chatParticipantPrivate', 'chatSessionsProvider', 'chatParticipantAdditions', 'languageModelProxy', 'mcpServerDefinitions',
    'chatContextProvider', 'chatPromptFiles', 'chatDebug', 'chatOutputRenderer', 'chatInputNotification', 'embeddings']) {
    assert.ok(proposals.has(p), `提案 ${p} の門が無い`);
  }
});

// 提案中の API の門の期待は、手で並べず、本家のタグの、C-1 が消す extHost のファイル(api/common の extHost*.ts)の
// `checkProposedApiEnabled(extension, '<名前>')` と、edits.patch が extHost.api.impl.ts から消す塊の同じ呼び出しから読む
// (C-4 で、手で並べた期待が実装の門の抜けを通した。大岡越前守の検証 2026-11-15。同じ見逃しが無いかを C-1 でも確かめた)。
function upstreamGateSites() {
  const names = [];
  const gate = /checkProposedApiEnabled\(extension, '(\w+)'\)/g;
  for (const d of unit.delete ?? []) {
    if (!/^src\/vs\/workbench\/api\/common\/extHost[^/]*\.ts$/.test(d)) continue;
    const t = upShow(d);
    assert.ok(t !== null, `本家に無い: ${d}`);
    for (const m of t.matchAll(gate)) names.push(m[1]);
  }
  for (const l of section('api/common/extHost.api.impl.ts')?.removed ?? []) for (const m of l.matchAll(gate)) names.push(m[1]);
  return names;
}
test('C-1 何もしない実装: 提案中の API の門が、本家の消すファイルと edits.patch が消す塊の門を、すべて含む(本家から読む。実装の一覧から写さない)', { skip: noApi || (upOk ? false : '本家のソースが読めない') }, () => {
  // 何もしない実装から呼べない場所の門は、持たなくてよい(呼び出し口が無い):
  //   languageModelSystem = 本物のモデルへ送るときのメッセージの変換(selectChatModels が [] なので、送る口が無い)
  //   mcpToolDefinitions = プロバイダーが返した定義の検証(何もしない実装はプロバイダーを呼ばない)
  const UNREACHABLE = new Set(['languageModelSystem', 'mcpToolDefinitions']);
  const expected = new Set(upstreamGateSites().filter((n) => !UNREACHABLE.has(n)));
  assert.ok(expected.size >= 10, `本家の門が少ない: ${[...expected].join(',')}`);
  const have = new Set([...apiText.matchAll(/checkProposedApiEnabled\(extension, '(\w+)'\)/g)].map((m) => m[1]));
  assert.deepEqual([...expected].filter((n) => !have.has(n)), [], '本家にある提案中の API の門が、何もしない実装から抜けている');
});

// ---------------------------------------------------------------------------
// 所（メンバー）ごとの門(5回目。6回目の直しを受けて)。名前の集まりを比べるだけでは、同じ提案の名前が別の所に出てくると抜けが見えない
// (registerToolDefinition・fileIsIgnored・registerIgnoredFileProvider・参加者の9項目がそうだった)。
// 期待は本家の消すファイル(api/common の extHost*.ts)の、メンバーごとの `checkProposedApiEnabled(.., '<名前>')` から読む。実装の一覧から写さない。
// 何もしない実装の本文を node で走らせ(型を外す。import は模擬)、提案を有効にしていない拡張で投げる(本家が async なら reject する)ことと、
// 有効にした拡張で投げないことを、メンバーごとに確かめる。
// ---------------------------------------------------------------------------
// (読み方と突き合わせは共通の部品 tests/gate-members.mjs。C-4 も同じ部品を使う)
/** 本家の消す extHost のファイルから、メンバー -> { name, kind, gates, async } を読む。 */
function upstreamMemberGates() {
  const files = [];
  for (const d of unit.delete ?? []) {
    if (!/^src\/vs\/workbench\/api\/common\/extHost[^/]*\.ts$/.test(d)) continue;
    const text = upShow(d);
    assert.ok(text !== null, `本家に無い: ${d}`);
    files.push({ path: d, text });
  }
  return memberGatesOf(files);
}
const nodeModule = await import('node:module');
const stripTs = nodeModule.stripTypeScriptTypes ?? nodeModule.default?.stripTypeScriptTypes;
const noRunApi = noApi || (typeof stripTs === 'function' ? false : 'node に module.stripTypeScriptTypes が無い');
function loadApi() {
  const src = apiText.replace(/^import .*$/gm, '').replace(/^export (function|interface) /gm, 'function ');
  const js = stripTs(src, { mode: 'strip' });
  const None = () => ({ dispose() { } });
  const Event = { None };
  const check = (ext, name) => { if (!(ext.enabledApiProposals ?? []).includes(name)) throw new Error(`Extension '${ext.name}' CANNOT use API proposal: ${name}.`); };
  const isEnabled = (ext, name) => (ext.enabledApiProposals ?? []).includes(name);
  const assertType = (cond, msg) => { if (!cond) throw new Error(msg ?? 'Assertion Failed'); };
  const ChatInputNotificationSeverity = { Info: 0, Warning: 1, Error: 2 };
  const fns = new Function('Event', 'checkProposedApiEnabled', 'isProposedApiEnabled', 'assertType', 'ChatInputNotificationSeverity',
    `${js}\nreturn { createRemovedChatApi, createRemovedLanguageModelApi };`)(Event, check, isEnabled, assertType, ChatInputNotificationSeverity);
  return { ...fns, None };
}
const extOf = (proposals) => ({ name: 'x.ext', identifier: { value: 'x.ext' }, enabledApiProposals: proposals });
const lmMock = { embeddingsModels: [], onDidChange: () => ({ dispose() { } }), registerEmbeddingsProvider: () => ({ dispose() { } }), computeEmbeddings: async () => ({}) };

/** 「メンバー名 -> オブジェクト(lm / chat / 参加者)」の、実装が持つもの。 */
function surfaces(ext) {
  const { createRemovedChatApi, createRemovedLanguageModelApi } = loadApi();
  const lm = createRemovedLanguageModelApi(ext, lmMock);
  const chat = createRemovedChatApi(ext);
  const participant = chat.createChatParticipant('p', () => { });
  return { lm, chat, participant };
}
async function compareGates() {
  const map = upstreamMemberGates();
  // invokeTool の門は、情報オブジェクトを渡したときだけ(本家と同じ)
  const outerSync = outerSyncGateNames(upShow('src/vs/workbench/api/common/extHost.api.impl.ts') ?? '');
  assert.ok(outerSync.has('getModelProxy'), `外側の口が同期で門を呼ぶ getModelProxy が読めていない: ${[...outerSync].join(',')}`);
  const r = await compareMemberGates({ map, surfacesFor: (proposals) => surfaces(extOf(proposals)), callArgs: { invokeTool: [{ name: 't' }, {}] }, outerSync });
  const gated = [...map].filter(([, v]) => v.gates.size > 0).map(([k, v]) => `${k}:${[...v.gates].join('/')}`);
  return { ...r, gated, mapSize: map.size };
}

test('C-1 何もしない実装(走らせる): 本家の消すファイルでメンバーごとに門があるものは、提案を有効にしていない拡張で門の誤りになる(投げる・reject する)。有効にした拡張では誤りにならない', { skip: noRunApi || (upOk ? false : '本家のソースが読めない') }, async () => {
  const { checked, bad, gated, mapSize } = await compareGates();
  assert.ok(checked.length >= 10, `突き合わせたメンバーが少ない(${checked.length}): 読み方が外れている。メンバー ${mapSize} 件、門のあるもの ${gated.length} 件: ${gated.slice(0, 12).join(', ')}`);
  // 6回目で見つかった抜けの所が、突き合わせに入っている(読み方の退行を見張る)
  expectChecked(checked, ['lm.registerToolDefinition', 'lm.fileIsIgnored', 'lm.registerIgnoredFileProvider', 'participant.get helpTextPrefix', 'participant.set helpTextPrefix', 'participant.get supportIssueReporting',
    'participant.set supportIssueReporting', 'participant.get participantVariableProvider', 'participant.set participantVariableProvider', 'participant.get onDidChangePauseState']);
  assert.deepEqual(bad, [], `突き合わせたメンバー: ${checked.join(', ')}`);
});

test('C-1 何もしない実装(走らせる): 門の誤りが、本家と同じ形で返る(本家のメソッドが async なら reject、そうでなければ同期で投げる)', { skip: noRunApi || (upOk ? false : '本家のソースが読めない') }, async () => {
  const { asyncBad } = await compareGates();
  assert.deepEqual(asyncBad, []);
});

test('C-1 何もしない実装(走らせる): 本家の門を持つメンバーのうち、実装に同じ名前が無いものが、呼べない所の例外の一覧だけである', { skip: noRunApi || (upOk ? false : '本家のソースが読めない') }, () => {
  // 本家で門のあるメンバーは多い(ホスト側の道・RPC の受け口)。API として拡張に出るのは lm / chat / 参加者のメンバーだけで、
  // 実装が持たないのに API に出るものがあれば、ここで見える。その確認は「API に出る本家の名前」= 本家の extHost.api.impl.ts の lm / chat の宣言から取る。
  const api = upShow('src/vs/workbench/api/common/extHost.api.impl.ts');
  const map = upstreamMemberGates();
  const { lm, chat, participant } = surfaces(extOf([]));
  const have = (n) => n in lm || n in chat || n in participant;
  // lm / chat の宣言のメンバー名(インデント3つ)
  const names = new Set();
  for (const start of ['const lm: typeof vscode.lm = {', 'const chat: typeof vscode.chat = {']) {
    const at = api.indexOf(start);
    if (at < 0) continue;
    const end = api.indexOf('\n\t\t};', at);
    for (const m of api.slice(at, end).matchAll(/^\t\t\t(?:get\s+|async\s+)?([A-Za-z_$][\w$]*)\s*(?:[(:<]|=)/gm)) names.add(m[1]);
  }
  assert.ok(names.size >= 15, `本家の lm / chat の宣言が読めない(${names.size})`);
  const gatedNames = new Set([...map.values()].filter((v) => v.gates.size > 0).map((v) => v.name));
  const missing = [...names].filter((n) => gatedNames.has(n) && !have(n));
  assert.deepEqual(missing, [], '本家の API に出る、門のあるメンバーが、何もしない実装に無い');
});

test('C-1 何もしない実装(走らせる): 参加者の値 — id は渡した名前、requestHandler に関数でない値を入れると Invalid request handler、onDidPerformAction は提案が無ければ undefined・有効ならイベント', { skip: noRunApi }, () => {
  const plain = surfaces(extOf([])).participant;
  assert.equal(plain.id, 'p');
  assert.throws(() => { plain.requestHandler = 1; }, /Invalid request handler/);
  assert.equal(plain.onDidPerformAction, undefined);
  const all = surfaces(extOf(['chatParticipantAdditions', 'chatParticipantPrivate', 'defaultChatParticipant'])).participant;
  assert.equal(typeof all.onDidPerformAction, 'function');
  assert.doesNotThrow(() => { all.helpTextPrefix = 'x'; all.titleProvider = undefined; all.supportIssueReporting = true; });
  assert.throws(() => { all.participantVariableProvider = { triggerCharacters: [] }; }, /triggerCharacters are required/);
  // 提案のないメンバーは、提案が無くても読み書きできる
  assert.doesNotThrow(() => { plain.iconPath = undefined; plain.followupProvider = undefined; void plain.onDidReceiveFeedback; });
});

test('C-1 何もしない実装(走らせる): lm.fileIsIgnored は提案が有効なら false で resolve する。registerToolDefinition・registerIgnoredFileProvider は有効なら Disposable を返す', { skip: noRunApi }, async () => {
  const on = surfaces(extOf(['chatParticipantAdditions', 'chatParticipantPrivate', 'languageModelToolSupportsModel'])).lm;
  assert.equal(await on.fileIsIgnored({}), false);
  assert.equal(typeof on.registerToolDefinition({}, {}).dispose, 'function');
  assert.equal(typeof on.registerIgnoredFileProvider({}).dispose, 'function');
  const off = surfaces(extOf([])).lm;
  // 本家の fileIsIgnored は async でなく、先頭で同期に投げる(7回目で実装を合わせた)
  assert.throws(() => off.fileIsIgnored({}), /CANNOT use API proposal: chatParticipantAdditions/);
  assert.throws(() => off.registerToolDefinition({}, {}), /CANNOT use API proposal: languageModelToolSupportsModel/);
  assert.throws(() => off.registerIgnoredFileProvider({}), /CANNOT use API proposal: chatParticipantPrivate/);
});

test('C-1 何もしない実装: 提案中の API のメンバー（registerChatSessionItemProvider など）は、門を通ってから何もしない値を返す', { skip: noApi }, () => {
  for (const [n, prop] of [['registerChatSessionItemProvider', 'chatSessionsProvider'], ['registerChatOutputRenderer', 'chatOutputRenderer'],
    ['registerCustomAgentProvider', 'chatPromptFiles'], ['registerChatDebugLogProvider', 'chatDebug'], ['createInputNotification', 'chatInputNotification'],
    ['createDynamicChatParticipant', 'chatParticipantPrivate'], ['isModelProxyAvailable', 'languageModelProxy'], ['mcpServerDefinitions', 'mcpServerDefinitions']]) {
    const m = member(apiText, n);
    assert.ok(m, `${n} が無い`);
    const gate = m.indexOf(`checkProposedApiEnabled(extension, '${prop}')`);
    assert.ok(gate >= 0, `${n}: 門 ${prop} が無い`);
    // 門が最初の文（return・throw より前）にある
    const firstReturn = m.search(/\b(return|throw)\b/);
    assert.ok(firstReturn < 0 || gate < firstReturn, `${n}: 門が return より後`);
  }
});

test('C-1 何もしない実装: 安定版の API の登録系・参加者は門を通さない（Claude Code が呼んでも誤りにならない）', { skip: noApi }, () => {
  for (const n of ['selectChatModels', 'onDidChangeChatModels', 'registerLanguageModelChatProvider', 'registerTool', 'registerMcpServerDefinitionProvider',
    'createChatParticipant']) {
    // (fileIsIgnored・registerIgnoredFileProvider は、本家に門があるので 6回目で門を足した。所ごとの検査が見る)
    const m = member(apiText, n);
    assert.ok(m, `${n} が無い`);
    assert.ok(!m.includes('checkProposedApiEnabled'), `${n} に門がある（安定版のはず）`);
  }
  assert.ok(!(member(apiText, 'tools') ?? '').includes('checkProposedApiEnabled'));
});

test('C-1 何もしない実装: 埋め込み（embeddings）は消さずに ExtHostEmbeddings に渡す（裁定）', { skip: noApi }, () => {
  assert.match(apiText, /import \{ ExtHostEmbeddings \} from '\.\/extHostEmbedding\.js';/);
  for (const n of ['registerEmbeddingsProvider', 'computeEmbeddings']) {
    const m = member(apiText, n);
    assert.ok(m && /extHostEmbeddings\./.test(m), `${n} が ExtHostEmbeddings に渡していない`);
  }
  assert.match(apiText, /extHostEmbeddings\.embeddingsModels/);
});

test('C-1 何もしない実装: languageModelAccessInformation は canSendRequest が undefined、onDidChange が Event.None', { skip: noApi }, () => {
  const f = fnBody(apiText, /export function createRemovedLanguageModelAccessInformation\(/);
  assert.ok(f);
  assert.match(f, /onDidChange: Event\.None/);
  assert.match(f, /canSendRequest: \(\) => undefined/);
});

test('C-1 何もしない実装: window / workspace / interactive の AI のメンバー（5つ）の何もしない実装がある', { skip: noApi }, () => {
  for (const n of ['createRemovedAgentEditorComments', 'createRemovedChatStatusItem', 'removedTransferActiveChat', 'removedRegisterAITextSearchProvider']) {
    assert.match(apiText, new RegExp(`export function ${n}\\(`), `${n} が無い`);
  }
  const t = fnBody(apiText, /export function removedTransferActiveChat\(/);
  assert.match(t, /Promise\.resolve\(\)/);
  const s = fnBody(apiText, /export function removedRegisterAITextSearchProvider\(/);
  assert.match(s, /return noopDisposable\(\);/);
});

test('C-1 何もしない実装: 通信・プロセス・タイマー・DI・RPC を持たない（何もしない）', { skip: noApi }, () => {
  const code = apiText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /child_process/,
    /\bIRPCProtocol\b/, /\$register/, /\.\$\w+\(/, /@I[A-Z]\w+/, /\bnew Emitter\b/, /\bconsole\./]) {
    assert.ok(!re.test(code), `使ってはいけないもの: ${re}`);
  }
});

test('C-1 何もしない実装: NullChatEntitlementService は IChatEntitlementService を実装し、契約なし（Unknown）', { skip: noEnt }, () => {
  assert.match(entText, /export class NullChatEntitlementService implements IChatEntitlementService/);
  assert.match(entText, /readonly entitlement = ChatEntitlement\.Unknown;/);
  assert.match(entText, /constObservable\(ChatEntitlement\.Unknown\)/);
  assert.match(entText, /readonly sentiment: IChatSentiment = \{ hidden: true, disabled: true \};/);
  assert.match(entText, /readonly anonymous = false;/);
  assert.match(entText, /readonly hasByokModels = false;/);
});

test('C-1 何もしない実装: NullChatEntitlementService の文脈キー chatSetupHidden・chatSetupDisabled を true にする', { skip: noEnt }, () => {
  const ctor = fnBody(entText, /constructor\(/);
  assert.ok(ctor, 'constructor が無い');
  assert.match(ctor, /ChatEntitlementContextKeys\.Setup\.hidden\.bindTo\(contextKeyService\)\.set\(true\)/);
  assert.match(ctor, /ChatEntitlementContextKeys\.Setup\.disabled\.bindTo\(contextKeyService\)\.set\(true\)/);
  // 注入は文脈キーのサービスだけ（取りに行く部品を注入しない）
  const sig = /constructor\(([^)]*)\)/.exec(entText)[1];
  const inj = [...sig.matchAll(/@(I\w+)/g)].map((m) => m[1]);
  assert.deepEqual(inj, ['IContextKeyService']);
});

test('C-1 何もしない実装: NullChatEntitlementService は通信・認証・テレメトリを呼ばない。操作は空', { skip: noEnt }, () => {
  const code = entText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bfetch\s*\(/, /IRequestService/, /IAuthenticationService/, /ITelemetryService/, /IProductService/, /IWorkbenchEnvironmentService/, /setTimeout/, /\.request\(/]) {
    assert.ok(!re.test(code), `使ってはいけないもの: ${re}`);
  }
  for (const m of ['acceptQuotas', 'clearQuotas', 'markAnonymousRateLimited', 'markSetupCompleted', 'setForceHidden']) {
    assert.match(code, new RegExp(`${m}\\(\\): void \\{ \\}`), `${m} が空の関数でない`);
  }
  assert.match(code, /async update\(\): Promise<void> \{ \}/);
});

test('C-1 何もしない実装: NullChatEntitlementService は同じファイルに置き、足す import は constObservable だけ(別のファイルを作らない・取りに行く部品を import しない)', { skip: noEnt }, () => {
  // 5回目: 別のファイルから、chatEntitlementService.ts の末尾へ移った。足す import は observable の constObservable の1行だけ。
  assert.equal(entImports.length, 1, `足す import が1行でない: ${JSON.stringify(entImports)}`);
  assert.match(entImports[0], /import \{[^}]*\bconstObservable\b[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/base\/common\/observable\.js';/);
  // クラスは本家の ID・文脈キー・型(IChatEntitlementService・ChatEntitlement・ChatEntitlementContextKeys・IChatSentiment)を、同じファイルのものとして使う
  for (const n of ['IChatEntitlementService', 'ChatEntitlement', 'ChatEntitlementContextKeys', 'IChatSentiment']) assert.match(entText, new RegExp(`\\b${n}\\b`));
});

test('C-1 何もしない実装: NullChatEntitlementService は chatEntitlementService.ts の末尾に近く、登録の直前にある(登録がクラスより前に来ない)', { skip: noEnt }, () => {
  const iClass = entAdded.findIndex((l) => /^export class NullChatEntitlementService\b/.test(l));
  const iReg = entAdded.findIndex((l) => /^registerSingleton\(\s*IChatEntitlementService\s*,\s*NullChatEntitlementService\b/.test(l));
  assert.ok(iClass >= 0 && iReg > iClass, 'クラスの定義より前に登録がある(クラスは宣言の巻き上げが効かず、起動時に落ちる)');
});
