// edits.patch と patches/ のコミットの名前、取り込みで見る main の import（MAIN_FILES）、commitIdentity、
// mydist の既定の外し方（pruneConfigurationDefaults の apply.mjs からの使われ方）のテスト。
// 仕様: docs/03 の5.1・5.2・6節、docs/06 の4節、tasks/2026-11-13-p2-apply/apply-design.md、
//       tasks/2026-11-13-p2-units-b/handoff-notes.md（件名は `unit <id>: edits`、From: は shuko-apply <apply@shuko.invalid>）、
//       tasks/2026-11-13-p2-apply/handoff-notes.md の追記3・4。
// 本家のソースは常設の clone（C:/b/vscode）のタグから読む。通しの試し（apply.mjs を本当に当てる）は、そこから新しい作業ツリーを
// C:\b\wt\ の下に作って行い、終わったら消す。clone が無ければ飛ぶ。
// Run: node --test tests/apply-commits.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MAIN_FILES, checkUpstreamAdditions } from '../scripts/lib/apply/checks.mjs';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode } from './build/helpers.mjs';

const IDENT = 'shuko-apply <apply@shuko.invalid>';
const UP_REPO = process.env.AIED_UPSTREAM_REPO || 'C:/b/vscode';
const UP_TAG = process.env.AIED_UPSTREAM_TAG || '1.146.0';
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitOk = (cwd, ...args) => {
  const r = git(cwd, ...args);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const upstreamOk = fs.existsSync(UP_REPO) && git(UP_REPO, 'rev-parse', '--verify', `${UP_TAG}^{commit}`).status === 0;

let sb;
before(() => {
  sb = makeSandbox('tests-ac-');
});
after(() => removeSandbox(sb));

// ---- edits.patch と patches/ の From: と件名 ---------------------------------------------
const REMOVALS = path.join(REPO, 'removals');
const PATCHES = path.join(REPO, 'patches');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const header = (text) => {
  const from = /^From: (.*)$/m.exec(text);
  const subject = /^Subject: (.*(?:\r?\n[ \t].*)*)$/m.exec(text);
  return { from: from ? from[1].trim() : null, subject: subject ? subject[1].replace(/\r?\n[ \t]+/g, ' ').trim() : null };
};
const unitDirs = fs.existsSync(REMOVALS) ? fs.readdirSync(REMOVALS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
const editsPatches = unitDirs.filter((d) => fs.existsSync(path.join(REMOVALS, d, 'edits.patch')));

test('edits.patch: 1つ以上ある（B-1・B-2・B-3・B-7 と A の一部）', () => {
  assert.ok(editsPatches.length >= 4, editsPatches.join(','));
});
for (const d of editsPatches) {
  test(`edits.patch ${d}: From: は ${IDENT}、件名は "unit ${d}: edits"、patch の項目が unit.json にある`, () => {
    const text = read(path.join(REMOVALS, d, 'edits.patch'));
    assert.match(text, /^From [0-9a-f]{40} /, 'format-patch の先頭行');
    const h = header(text);
    assert.equal(h.from, IDENT);
    assert.equal(h.subject, `[PATCH] unit ${d}: edits`);
    const unit = JSON.parse(read(path.join(REMOVALS, d, 'unit.json')));
    assert.equal(unit.patch, 'edits.patch', 'edits.patch があるのに unit.json の patch が指していない');
  });
}
test('edits.patch: unit.json が patch を指す単位は、そのファイルがあり、From: と件名が揃っている', () => {
  const bad = [];
  for (const d of unitDirs) {
    const u = JSON.parse(read(path.join(REMOVALS, d, 'unit.json')));
    if (!u.patch) continue;
    const f = path.join(REMOVALS, d, u.patch);
    if (!fs.existsSync(f)) {
      bad.push(`${d}: ${u.patch} が無い`);
      continue;
    }
    const h = header(read(f));
    if (h.from !== IDENT) bad.push(`${d}: From: ${h.from}`);
    if (h.subject !== `[PATCH] unit ${d}: edits`) bad.push(`${d}: 件名 ${h.subject}`);
  }
  assert.deepEqual(bad, []);
});

const patchFiles = fs.existsSync(PATCHES) ? fs.readdirSync(PATCHES).filter((n) => n.endsWith('.patch')).sort() : [];
test('patches/: 1つ以上あり、名前は頭が数', () => {
  assert.ok(patchFiles.length >= 2, patchFiles.join(','));
  for (const n of patchFiles) assert.match(n, /^\d+-[a-z0-9][a-z0-9-]*\.patch$/, n);
});
for (const n of patchFiles) {
  test(`patches/${n}: From: は ${IDENT}、件名がある`, () => {
    const text = read(path.join(PATCHES, n));
    assert.match(text, /^From [0-9a-f]{40} /);
    const h = header(text);
    assert.equal(h.from, IDENT);
    assert.ok(h.subject && /^\[PATCH[^\]]*\]\s+\S/.test(h.subject), h.subject);
  });
}

// ---- MAIN_FILES ----------------------------------------------------------------------------
test('MAIN_FILES: workbench と sessions の2つの main。名前の形で拾う', () => {
  assert.ok(Array.isArray(MAIN_FILES));
  const byDir = Object.fromEntries(MAIN_FILES.map(([dir, re]) => [dir, re]));
  assert.deepEqual(Object.keys(byDir).sort(), ['src/vs/sessions', 'src/vs/workbench']);
  const wb = byDir['src/vs/workbench'];
  for (const f of ['workbench.common.main.ts', 'workbench.desktop.main.ts', 'workbench.web.main.ts']) assert.ok(wb.test(f), f);
  for (const f of ['workbench.desktop.main.js', 'workbench.desktop.main.ts.bak', 'other.main.ts', 'sessions.desktop.main.ts', 'workbench.ts']) assert.ok(!wb.test(f), f);
  const se = byDir['src/vs/sessions'];
  for (const f of ['sessions.common.main.ts', 'sessions.desktop.main.ts']) assert.ok(se.test(f), f);
  for (const f of ['sessions.desktop.main.js', 'workbench.desktop.main.ts', 'sessions.main.ts']) assert.ok(!se.test(f), f);
});

test('MAIN_FILES: 本家 1.146.0 で、workbench の main を3つ以上、sessions の main を1つ以上拾い、sessions の main は workbench の contrib を import している', { skip: upstreamOk ? false : `本家の clone が読めない: ${UP_REPO}` }, () => {
  const list = (dir) => gitOk(UP_REPO, 'ls-tree', '--name-only', UP_TAG, `${dir}/`).split(/\r?\n/).filter(Boolean).map((p) => p.split('/').pop());
  const found = Object.fromEntries(MAIN_FILES.map(([dir, re]) => [dir, list(dir).filter((f) => re.test(f))]));
  assert.ok(found['src/vs/workbench'].length >= 3, found['src/vs/workbench'].join(','));
  assert.ok(found['src/vs/sessions'].length >= 1, found['src/vs/sessions'].join(','));
  const importsWorkbenchContrib = found['src/vs/sessions'].some((f) => /^\s*import\s+['"][^'"]*workbench\/contrib\//m.test(gitOk(UP_REPO, 'show', `${UP_TAG}:src/vs/sessions/${f}`)));
  assert.ok(importsWorkbenchContrib, 'sessions の main が workbench の contrib を import していない（MAIN_FILES に sessions を入れた理由がなくなった）');
});

test('checkUpstreamAdditions: workbench と sessions の main に増えた import だけを返し、増えた部品のフォルダも返す', () => {
  const repo = path.join(sb, 'additions');
  fs.mkdirSync(repo, { recursive: true });
  gitOk(repo, 'init', '-q');
  const commit = (m) => gitOk(repo, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-q', '-m', m);
  const WB = 'src/vs/workbench/workbench.desktop.main.ts';
  const SE = 'src/vs/sessions/sessions.desktop.main.ts';
  writeFile(path.join(repo, WB), "import './contrib/a/a.js';\n");
  writeFile(path.join(repo, SE), "import '../workbench/contrib/a/a.js';\n");
  writeFile(path.join(repo, 'src/vs/workbench/contrib/a/a.ts'), 'export {};\n');
  writeFile(path.join(repo, 'src/vs/workbench/other.ts'), "import './x.js';\n");
  gitOk(repo, 'add', '-A');
  commit('prev');
  gitOk(repo, 'tag', 'prev');
  fs.appendFileSync(path.join(repo, WB), "import './contrib/newchat/b.js';\n");
  fs.appendFileSync(path.join(repo, SE), "import '../workbench/contrib/telemetry/c.js';\n");
  fs.appendFileSync(path.join(repo, 'src/vs/workbench/other.ts'), "import './y.js';\n");
  writeFile(path.join(repo, 'src/vs/workbench/contrib/newchat/b.ts'), 'export {};\n');
  gitOk(repo, 'add', '-A');
  commit('next');
  gitOk(repo, 'tag', 'next');

  const r = checkUpstreamAdditions(repo, 'prev', 'next');
  assert.equal(r.status, 'info');
  const byFile = Object.fromEntries(r.imports.map((i) => [i.file, i.line]));
  assert.equal(r.imports.length, 2, JSON.stringify(r.imports));
  assert.match(byFile[WB], /contrib\/newchat\/b\.js/);
  assert.match(byFile[SE], /workbench\/contrib\/telemetry\/c\.js/);
  assert.ok(!r.imports.some((i) => i.file.endsWith('other.ts')), 'main でないファイルは見ない');
  assert.ok(!r.imports.some((i) => /contrib\/a\/a\.js/.test(i.line)), '前からある import は数えない');
  const sessionsImport = r.imports.find((i) => i.file === SE);
  assert.ok(sessionsImport.highlight.length > 0, 'テレメトリの語を含む import は highlight になる');
  assert.ok(r.folders.some((f) => f.path === 'src/vs/workbench/contrib/newchat'), JSON.stringify(r.folders));
  assert.ok(!r.folders.some((f) => f.path.endsWith('/contrib/a')));
  assert.ok(r.highlighted >= 1);
  // 前のタグが無ければ飛ばす
  assert.equal(checkUpstreamAdditions(repo, null, 'next').status, 'skipped');
});

// ---- apply.mjs を本当に当てる通しの試し（commitIdentity と mydist の既定の外し方） ------------------
const WT_BASE = 'C:\\b\\wt';
const e2eSkip = upstreamOk && fs.existsSync('C:\\b') ? false : `本家の clone が読めない: ${UP_REPO}`;
let wt = null;
const wtName = `tests-ac-${process.pid}`;

function newWorktree() {
  fs.mkdirSync(WT_BASE, { recursive: true });
  const p = path.join(WT_BASE, wtName);
  gitOk(UP_REPO, 'worktree', 'add', '--detach', p, UP_TAG);
  return p;
}
function resetWorktree(p) {
  gitOk(p, 'reset', '--hard', UP_TAG);
  gitOk(p, 'clean', '-fdq');
}
after(() => {
  if (wt) {
    git(UP_REPO, 'worktree', 'remove', '--force', wt);
    git(UP_REPO, 'worktree', 'prune');
  }
});
const applyRun = (args) => runNode(['scripts/apply.mjs', wt, ...args], { timeout: 900000 });

test('apply.mjs（本物の B-2・B-7 と patches/）: commitIdentity は ok、mydist の既定から2つを外し、extensions-src は変えない', { skip: e2eSkip, timeout: 1200000 }, () => {
  wt = newWorktree();
  const srcManifest = path.join(REPO, 'extensions-src', 'mydist', 'package.json');
  const srcBefore = fs.readFileSync(srcManifest);
  const out = path.join(sb, 'checks-e2e.json');
  const r = applyRun(['--label', 'tests-ac-e2e', '--only', 'B-2-onboarding-experiments-surveys,B-7-terminal-suggest', '--checks-out', out]);
  assert.ok([0, 1].includes(r.status) && fs.existsSync(out), `${r.status}\n${r.stdout.slice(-2000)}\n${r.stderr.slice(-2000)}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));

  // commitIdentity: apply.mjs のコミットと、edits.patch・patches/ から入ったコミットの作者・コミッターがそろっている
  assert.ok(j.checks.commitIdentity, 'commitIdentity が無い');
  assert.equal(j.checks.commitIdentity.status, 'ok', JSON.stringify(j.checks.commitIdentity.items));
  assert.equal(j.checks.commitIdentity.expected, IDENT);
  assert.deepEqual(j.checks.commitIdentity.items, []);
  const log = gitOk(wt, 'log', '--format=%an <%ae>|%cn <%ce>|%s', `${UP_TAG}..HEAD`).split(/\r?\n/).filter(Boolean);
  assert.ok(log.length >= 5, log.join('\n'));
  for (const l of log) assert.ok(l.startsWith(`${IDENT}|${IDENT}|`), l);
  // edits.patch から入ったコミットの件名は `unit <id>: edits`
  assert.ok(log.some((l) => l.endsWith('|unit B-2-onboarding-experiments-surveys: edits')), log.join('\n'));
  assert.ok(log.some((l) => l.endsWith('|unit B-7-terminal-suggest: edits')), log.join('\n'));

  // mydist の既定: B-2 と B-7 の absentSettings のキーが、作業ツリーの mydist から外れ、記録に残る
  const be = j.builtinExtensions;
  assert.ok(be && Array.isArray(be.removedDefaults), 'builtinExtensions.removedDefaults が無い');
  assert.deepEqual(be.removedDefaults.map((x) => x.key).sort(), ['terminal.integrated.suggest.enabled', 'workbench.startupEditor']);
  assert.ok(be.removedDefaults.some((x) => x.key === 'workbench.startupEditor' && x.unit === 'B-2-onboarding-experiments-surveys'));
  assert.ok(be.removedDefaults.some((x) => x.key === 'terminal.integrated.suggest.enabled' && x.unit === 'B-7-terminal-suggest'));
  const copied = JSON.parse(fs.readFileSync(path.join(wt, 'extensions', 'mydist', 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
  const defaults = (copied.contributes && copied.contributes.configurationDefaults) || {};
  assert.ok(!('workbench.startupEditor' in defaults));
  assert.ok(!('terminal.integrated.suggest.enabled' in defaults));
  assert.ok(Object.keys(defaults).length > 0, 'ほかの既定は残る');
  assert.ok(fs.readFileSync(srcManifest).equals(srcBefore), 'リポジトリの extensions-src/mydist/package.json は書き換えない');
  // 外した後の manifest で registeredKeys を見るので、fail にならない
  assert.notEqual(j.checks.registeredKeys.status, 'fail', JSON.stringify(j.checks.registeredKeys).slice(0, 1500));
  assert.ok(j.result === 'ok' || j.result === 'hold', j.result);
});

test('apply.mjs（単位を当てない）: mydist の既定は1つも外さない（removedDefaults が空）', { skip: e2eSkip, timeout: 1200000 }, () => {
  assert.ok(wt, '前のテストが作業ツリーを作っていない');
  resetWorktree(wt);
  const out = path.join(sb, 'checks-nounits.json');
  const r = applyRun(['--label', 'tests-ac-nounits', '--only', 'A-6-themes', '--checks-out', out]);
  assert.ok(fs.existsSync(out), `${r.status}\n${r.stdout.slice(-1500)}${r.stderr.slice(-1500)}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(j.builtinExtensions.removedDefaults, [], 'A-6 の absentSettings は mydist の既定と重ならない');
  const copied = JSON.parse(fs.readFileSync(path.join(wt, 'extensions', 'mydist', 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.ok('workbench.startupEditor' in copied.contributes.configurationDefaults, 'B-2 を当てていないので既定は残る');
});

test('apply.mjs: 作者が違うパッチ（From: が shuko-apply でない）が入ると commitIdentity が warn（止めはしない）', { skip: e2eSkip, timeout: 1200000 }, () => {
  assert.ok(wt, '前のテストが作業ツリーを作っていない');
  resetWorktree(wt);
  // 作者が違うパッチを作る
  fs.writeFileSync(path.join(wt, 'tests-ac-marker.txt'), 'x\n');
  gitOk(wt, 'add', 'tests-ac-marker.txt');
  gitOk(wt, '-c', 'user.name=Someone Else', '-c', 'user.email=else@example.invalid', 'commit', '-q', '-m', 'marker');
  const badDir = path.join(sb, 'bad-patches');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, '10-marker.patch'), gitOk(wt, 'format-patch', '-1', '--stdout'));
  resetWorktree(wt);
  const out = path.join(sb, 'checks-badauthor.json');
  const r = applyRun(['--label', 'tests-ac-bad', '--only', 'A-6-themes', '--patches', badDir, '--checks-out', out]);
  assert.ok(fs.existsSync(out), `${r.status}\n${r.stdout.slice(-1500)}${r.stderr.slice(-1500)}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.checks.commitIdentity.status, 'warn');
  assert.ok(j.checks.commitIdentity.items.length >= 1);
  assert.ok(j.checks.commitIdentity.items.some((c) => /Someone Else/.test(c.author)), JSON.stringify(j.checks.commitIdentity.items));
  assert.ok(j.checks.commitIdentity.items.every((c) => c.committer === IDENT), 'コミッターは apply.mjs が shuko-apply にする');
  assert.ok(j.warnings.some((w) => /コミットの名前/.test(w)), '警告に出る');
  assert.ok(!j.stoppedAt, '止めない');
});

test('apply.mjs --dry-run: commitIdentity は skipped（コミットを作らないため）', { skip: e2eSkip, timeout: 1200000 }, () => {
  assert.ok(wt, '前のテストが作業ツリーを作っていない');
  resetWorktree(wt);
  const out = path.join(sb, 'checks-dry.json');
  const r = applyRun(['--label', 'tests-ac-dry', '--dry-run', '--only', 'A-6-themes', '--checks-out', out]);
  assert.ok(fs.existsSync(out), `${r.status}\n${r.stdout.slice(-1500)}${r.stderr.slice(-1500)}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.checks.commitIdentity.status, 'skipped');
  assert.equal(gitOk(wt, 'rev-parse', 'HEAD').trim(), gitOk(UP_REPO, 'rev-parse', `${UP_TAG}^{commit}`).trim(), 'dry-run は HEAD を動かさない');
});
