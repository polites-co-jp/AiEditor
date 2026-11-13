// 取り込みの追加のテスト（p34-verify の T-2・T-3、M-1・M-2、CLI を子のプロセスで呼ぶ試し）。
// 仕様: docs/06 の3・4・6・7・8節、docs/03 の6節。claude -p は起動しない（--claude に node.exe を渡して引数の組み立てだけを見る）。
// 本物の Notion・GitHub・タスクスケジューラ・普段使いのデータには触れない（一時フォルダと、一時の git リポジトリだけ）。
// Run: node --test tests/take-in-more.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode } from './build/helpers.mjs';
import { buildClaudeInvocation } from '../scripts/lib/take-in/claude.mjs';
import { normalizeRepoPath, isInsideAllowed, outsideAllowed } from '../scripts/lib/take-in/repair.mjs';
import { smokeRunArgs, newBaselinePath, summarizeSmoke, netEnvLayout, netEnvInstallArgs, netauditArgs, NETAUDIT_SETTINGS, SMOKE_RUNS } from '../scripts/lib/take-in/smoke-net.mjs';

let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-ti-');
});
after(() => removeSandbox(sb));

// ---- T-2: 修理の claude -p の引数 (docs/06 の7.1・7.2) ----
const repair = (extra = {}) => buildClaudeInvocation({ kind: 'repair', repoRoot: REPO, worktree: 'C:\\b\\wt\\1.147.0', prompt: 'p', claudePath: 'claude', env: {}, ...extra });
const valueOf = (args, flag) => args[args.indexOf(flag) + 1];

test('修理の引数: --strict-mcp-config（本家の作業ツリーの .mcp.json を読ませない）と --disallowedTools mcp__*', () => {
  const a = repair().args;
  assert.ok(a.includes('--strict-mcp-config'));
  assert.equal(valueOf(a, '--disallowedTools'), 'mcp__*');
});
test('修理の引数: --tools は Read・Glob・Grep・Edit・Write だけ。Bash を含めない（switch.ps1・install-extensions.mjs を実行する手段を渡さない）', () => {
  const a = repair().args;
  const tools = valueOf(a, '--tools').split(',').sort();
  assert.deepEqual(tools, ['Edit', 'Glob', 'Grep', 'Read', 'Write']);
  assert.ok(!a.some((x) => /^Bash|PowerShell/i.test(String(x))));
  assert.ok(!a.includes('--allowedTools') || !/Bash/.test(valueOf(a, '--allowedTools')));
});
test('修理の引数: --add-dir は builderWorktree があればそれ（取り込みのブランチの作業ツリー）、無ければ repoRoot', () => {
  const bw = 'C:\\b\\take-in\\1.147.0-1\\repo';
  assert.equal(path.resolve(valueOf(repair({ builderWorktree: bw }).args, '--add-dir')).toLowerCase(), path.resolve(bw).toLowerCase());
  assert.equal(path.resolve(valueOf(repair().args, '--add-dir')).toLowerCase(), REPO.toLowerCase());
});
test('修理の引数: 規約 TAKE-IN.md を --append-system-prompt-file で渡す（既定は builderWorktree の TAKE-IN.md。rulesFile で変えられる）', () => {
  const bw = 'C:\\b\\take-in\\x\\repo';
  const a = repair({ builderWorktree: bw }).args;
  assert.equal(path.basename(valueOf(a, '--append-system-prompt-file')), 'TAKE-IN.md');
  assert.equal(path.dirname(path.resolve(valueOf(a, '--append-system-prompt-file'))).toLowerCase(), path.resolve(bw).toLowerCase());
  assert.equal(valueOf(repair({ rulesFile: 'X:\\r.md' }).args, '--append-system-prompt-file'), path.resolve('X:\\r.md'));
});
test('修理の引数: 権限の確認で止まらない（--permission-mode acceptEdits）が、bypassPermissions・--dangerously-skip-permissions は使わない', () => {
  const a = repair().args;
  assert.equal(valueOf(a, '--permission-mode'), 'acceptEdits');
  assert.ok(!a.includes('--dangerously-skip-permissions'));
  assert.ok(!a.some((x) => /bypassPermissions/.test(String(x))));
});
test('修理の引数: --json-schema は JSON として読め、fixes を持つ。--max-turns・--no-session-persistence がある。prompt は最後の引数、本文は input で渡す', () => {
  const inv = repair({ input: 'REQUEST BODY', prompt: 'short prompt' });
  const schema = JSON.parse(valueOf(inv.args, '--json-schema'));
  assert.ok(JSON.stringify(schema).includes('fixes'));
  assert.ok(Number(valueOf(inv.args, '--max-turns')) > 0);
  assert.ok(inv.args.includes('--no-session-persistence'));
  assert.equal(inv.args[inv.args.length - 1], 'short prompt');
  assert.equal(inv.input, 'REQUEST BODY');
});
test('判定の引数: --tools を渡さない代わりに --permission-mode dontAsk、--strict-mcp-config、--add-dir を付けない', () => {
  const a = buildClaudeInvocation({ kind: 'verdict', repoRoot: REPO, prompt: 'p', claudePath: 'claude', env: {} }).args;
  assert.equal(valueOf(a, '--permission-mode'), 'dontAsk');
  assert.ok(a.includes('--strict-mcp-config'));
  assert.ok(!a.includes('--add-dir'));
  assert.ok(!a.includes('--bare'));
});

// ---- T-3: パスの正規化 (docs/03 の6節、TAKE-IN.md の「外を書き換えない」) ----
test('normalizeRepoPath: / 区切りにし、. と空の区切りを除き、中に留まる .. は畳む', () => {
  assert.equal(normalizeRepoPath('removals\\C-1\\edits.patch'), 'removals/C-1/edits.patch');
  assert.equal(normalizeRepoPath('./removals//C-1/./x'), 'removals/C-1/x');
  assert.equal(normalizeRepoPath('removals/a/../b'), 'removals/b');
  assert.equal(normalizeRepoPath('a/b/../../c'), 'c');
});
test('normalizeRepoPath: ドライブ文字（C:/x・C:x）・/ や \\ で始まる絶対パス・UNC・根の外へ出る .. は null', () => {
  for (const p of ['C:/x', 'C:\\x', 'c:/removals/a', 'C:x', '/x', '\\x', '\\\\server\\share\\removals\\a', '//server/share/x', '../x', 'a/../../x', 'a/C:/x', '', '   ', '.', './', null, undefined]) {
    assert.equal(normalizeRepoPath(p), null, JSON.stringify(p));
  }
});
test('isInsideAllowed: removals/・patches/ の中は true、フォルダそのもの（git status が未追跡のフォルダを1行で出す）も true', () => {
  for (const p of ['removals/C-1/edits.patch', 'patches/10-a.patch', 'removals/', 'removals', 'patches', 'removals\\C-1\\unit.json', './removals/x', 'removals//x', 'removals/a/../b']) {
    assert.equal(isInsideAllowed(p), true, p);
  }
});
test('isInsideAllowed: 外・外へ出る .. ・絶対パス・UNC・前方一致だけの別のフォルダは false', () => {
  for (const p of ['src/x.ts', 'removals/../src/x.ts', 'removals/../../x', 'patches/../removals-evil/x', 'removals-evil/x', 'removalsx', 'xremovals/a', 'C:/removals/a', '/removals/a', '\\\\server\\share\\removals\\a', '../removals/a', '', null]) {
    assert.equal(isInsideAllowed(p), false, String(p));
  }
});
test('isInsideAllowed: allowed を渡せる（フォルダの末尾の / があってもなくても）。allowed が空なら全部外', () => {
  assert.equal(isInsideAllowed('a/b', ['a']), true);
  assert.equal(isInsideAllowed('a/b', ['a/']), true);
  assert.equal(isInsideAllowed('ab/c', ['a']), false);
  assert.equal(isInsideAllowed('a/b', []), false);
});
test('outsideAllowed: 名前の変更は両方を見る（行き先が中でも、元が外ならそれも外）。引用符・\\ 区切り・重複を扱う', () => {
  assert.deepEqual(outsideAllowed('R  src/a.ts -> removals/a.ts\n'), ['src/a.ts']);
  assert.deepEqual(outsideAllowed('R  removals/a -> src/b\n'), ['src/b']);
  assert.deepEqual(outsideAllowed(' M "src/with space.ts"\n'), ['src/with space.ts']);
  assert.deepEqual(outsideAllowed(' M src\\a.ts\n M src\\a.ts\n'), ['src/a.ts']);
  assert.deepEqual(outsideAllowed(' M removals/../src/x.ts\n'), ['removals/../src/x.ts']);
  assert.deepEqual(outsideAllowed('?? removals/\n?? patches/\n'), []);
});

// ---- T-3: smoke-net.mjs（手順 6・7。docs/06 の5節・9節）----
test('smokeRunArgs: 3回の実行。1回目は --save-baseline で作り直し、2・3回目は --merge-baseline を足して和を取る（docs/06 の5節）', () => {
  assert.equal(SMOKE_RUNS, 3);
  const r = smokeRunArgs({ editorDir: 'E:\\ed', label: '1.147.0-1', newBaseline: 'B.json' });
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((x) => x.n), [1, 2, 3]);
  assert.ok(!r[0].args.includes('--merge-baseline'));
  assert.ok(r[1].args.includes('--merge-baseline') && r[2].args.includes('--merge-baseline'));
  for (const x of r) assert.equal(valueOf(x.args, '--save-baseline'), 'B.json');
});
test('smokeRunArgs: どの回も --prime（言語パックを読ませて日本語にする。基準と比べる実行は --prime の有無をそろえる）・--mode built・--build・回ごとに違う --label', () => {
  const r = smokeRunArgs({ editorDir: 'E:\\ed', label: 'L', newBaseline: 'B.json' });
  for (const x of r) {
    assert.ok(x.args.includes('--prime'));
    assert.equal(valueOf(x.args, '--mode'), 'built');
    assert.equal(valueOf(x.args, '--build'), 'E:\\ed');
  }
  assert.equal(new Set(r.map((x) => valueOf(x.args, '--label'))).size, 3);
  assert.ok(r.every((x) => valueOf(x.args, '--label').includes('take-in-L')));
});
test('smokeRunArgs: 今の版の基準があれば、どの回も --baseline で比べる。無ければ付けない。--lock・--timeout・runs を渡せる', () => {
  const withBase = smokeRunArgs({ editorDir: 'E', label: 'L', newBaseline: 'N.json', currentBaseline: 'C.json', lock: 'lock.json', timeout: 99, runs: 2 });
  assert.equal(withBase.length, 2);
  for (const x of withBase) {
    assert.equal(valueOf(x.args, '--baseline'), 'C.json');
    assert.equal(valueOf(x.args, '--lock'), 'lock.json');
    assert.equal(valueOf(x.args, '--timeout'), '99');
  }
  for (const x of smokeRunArgs({ editorDir: 'E', label: 'L', newBaseline: 'N.json' })) assert.ok(!x.args.includes('--baseline') && !x.args.includes('--lock'));
});
test('smokeRunArgs: 現在の基準を --save-baseline に使わない（比べる基準と作り直す基準は別のファイル）', () => {
  for (const x of smokeRunArgs({ editorDir: 'E', label: 'L', newBaseline: 'N.json', currentBaseline: 'C.json' })) assert.notEqual(valueOf(x.args, '--save-baseline'), valueOf(x.args, '--baseline'));
});
test('smokeRunArgs: editorDir・label・newBaseline が欠ければ例外', () => {
  for (const o of [{ label: 'L', newBaseline: 'N' }, { editorDir: 'E', newBaseline: 'N' }, { editorDir: 'E', label: 'L' }]) assert.throws(() => smokeRunArgs(o));
});
test('newBaselinePath: <smokeRoot>\\baseline-<label>.json', () => assert.equal(newBaselinePath('C:\\b\\smoke', '1.147.0-1'), path.join('C:\\b\\smoke', 'baseline-1.147.0-1.json')));
test('summarizeSmoke: 全部の回が 0 なら ok、1（FAIL あり）が混ざれば failed、2・null（起動できない）は error、回が無ければ skipped', () => {
  const run = (...codes) => codes.map((c, i) => ({ n: i + 1, exitCode: c }));
  assert.equal(summarizeSmoke(run(0, 0, 0)).status, 'ok');
  assert.equal(summarizeSmoke(run(0, 1, 0)).status, 'failed');
  assert.equal(summarizeSmoke(run(0, 2, 0)).status, 'error');
  assert.equal(summarizeSmoke(run(0, null, 0)).status, 'error');
  assert.equal(summarizeSmoke([]).status, 'skipped');
  assert.equal(summarizeSmoke(undefined).status, 'skipped');
  assert.equal(summarizeSmoke(run(0, 0, 0)).passedRuns, 3);
});
test('summarizeSmoke: 「消えている」の検査が failed なら、スモークが ok でも failed。基準が保存されたか・比べた基準を残す', () => {
  const ok = [{ exitCode: 0 }];
  assert.equal(summarizeSmoke(ok, { absent: { status: 'failed' } }).status, 'failed');
  assert.equal(summarizeSmoke(ok, { absent: { status: 'ok' } }).status, 'ok');
  const s = summarizeSmoke(ok, { baselineSaved: true, currentBaseline: 'C.json' });
  assert.equal(s.baselineSaved, true);
  assert.equal(s.comparedWith, 'C.json');
  assert.deepEqual(summarizeSmoke([]).absent, { status: 'skipped' });
});
test('通信の監査の環境: netEnvLayout は <envDir>\\user（VSCODE_PORTABLE）と <envDir>\\ext。argv.json は user の中、settings.json は user\\user-data\\User の中', () => {
  const L = netEnvLayout('C:\\e');
  assert.equal(L.user, path.join('C:\\e', 'user'));
  assert.equal(L.ext, path.join('C:\\e', 'ext'));
  assert.equal(L.argv, path.join('C:\\e', 'user', 'argv.json'));
  assert.equal(L.settings, path.join('C:\\e', 'user', 'user-data', 'User', 'settings.json'));
});
test('netEnvInstallArgs: 新しい版の CLI で、--portable・--extensions-dir・--argv を一時の環境に向け、台帳と出力を渡す。buildRoot・config は渡したときだけ', () => {
  const a = netEnvInstallArgs({ cli: 'X:\\bin\\shuko.cmd', envDir: 'C:\\e', lock: 'L.json', out: 'O.json' });
  assert.equal(valueOf(a, '--cli'), 'X:\\bin\\shuko.cmd');
  assert.equal(valueOf(a, '--portable'), path.join('C:\\e', 'user'));
  assert.equal(valueOf(a, '--extensions-dir'), path.join('C:\\e', 'ext'));
  assert.equal(valueOf(a, '--argv'), path.join('C:\\e', 'user', 'argv.json'));
  assert.equal(valueOf(a, '--lock'), 'L.json');
  assert.equal(valueOf(a, '--out'), 'O.json');
  assert.ok(!a.includes('--build-root') && !a.includes('--config'));
  const b = netEnvInstallArgs({ cli: 'c', envDir: 'C:\\e', lock: 'L', out: 'O', buildRoot: 'B', config: 'cfg.json' });
  assert.equal(valueOf(b, '--build-root'), 'B');
  assert.equal(valueOf(b, '--config'), 'cfg.json');
});
test('NETAUDIT_SETTINGS: フォルダのタスクを確かめずに走らせ、信頼のダイアログを出さない。書き換えられない', () => {
  assert.equal(NETAUDIT_SETTINGS['task.allowAutomaticTasks'], 'on');
  assert.equal(NETAUDIT_SETTINGS['security.workspace.trust.enabled'], false);
  assert.ok(Object.isFrozen(NETAUDIT_SETTINGS));
});
test('netauditArgs: -ExecutionPolicy Bypass -File、-Exe・-EnvDir・-Label take-in-<label>・-DurationSeconds・-OutDir・-WorkRoot・-Force。-Previous は渡したときだけ', () => {
  const a = netauditArgs({ script: 'S.ps1', exe: 'E.exe', envDir: 'C:\\e', label: '1.147.0-1', duration: 600, outDir: 'O', workRoot: 'W' });
  assert.deepEqual(a.slice(0, 5), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'S.ps1']);
  assert.equal(valueOf(a, '-Exe'), 'E.exe');
  assert.equal(valueOf(a, '-EnvDir'), 'C:\\e');
  assert.equal(valueOf(a, '-Label'), 'take-in-1.147.0-1');
  assert.equal(valueOf(a, '-DurationSeconds'), '600');
  assert.equal(valueOf(a, '-OutDir'), 'O');
  assert.equal(valueOf(a, '-WorkRoot'), 'W');
  assert.ok(a.includes('-Force'));
  assert.ok(!a.includes('-Previous'));
  assert.equal(valueOf(netauditArgs({ script: 'S', exe: 'E', envDir: 'D', label: 'L', outDir: 'O', workRoot: 'W', previous: 'P.json' }), '-Previous'), 'P.json');
});

// ---- M-2: ext の書き戻しには台帳の ID（大文字を含む）を渡す ----
test('M-2: ext の書き戻しの対象は台帳の entry.id（小文字にした a.id でない）。大文字を含む ID の ToDo の題名を検索で見つけるため', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'take-in.mjs'), 'utf8');
  assert.match(src, /recordAndWriteBack\(ctx, judged, \{ kind: "ext", id: entry\.id \}\)/);
});

// ---- CLI を子のプロセスで呼ぶ（--dry-run）。何も作らない・claude を起動しない ----
function sandboxCfg() {
  const root = path.join(sb, `c${++n}`);
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, JSON.stringify({ buildRoot: path.join(root, 'b'), installRoot: path.join(root, 'i') }));
  return { root, cfg, args: ['--config', cfg, '--build-root', path.join(root, 'b'), '--install-root', path.join(root, 'i'), '--watch-state', path.join(root, 'no-state.json'), '--claude', process.execPath] };
}
const jsonOf = (stdout) => JSON.parse(stdout.slice(stdout.search(/^\{/m)));
const gitIn = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });

test('CLI: take-in.mjs core 1.147.0 --dry-run は計画を JSON で出して終了コード 0。手順は 1〜10（8 なし）、何も作らない', () => {
  const s = sandboxCfg();
  const before = gitIn(REPO, 'branch', '--list', 'take-in/*').stdout;
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-1', '--prev-tag', '1.146.0', ...s.args]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.result, 'dry-run');
  assert.equal(o.tag, '1.147.0');
  assert.equal(o.label, 'dry-1');
  assert.equal(o.branch, 'take-in/dry-1');
  assert.deepEqual(o.steps.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7, 9, 10]);
  assert.equal(o.recordDirExists, false);
  assert.ok(!fs.existsSync(path.join(REPO, 'records', 'take-in', 'dry-1')), '記録を作らない');
  assert.ok(!fs.existsSync(path.join(s.root, 'b')), '試しの buildRoot に何も作らない');
  assert.equal(gitIn(REPO, 'branch', '--list', 'take-in/*').stdout, before, 'ブランチを作らない');
});
test('CLI: take-in.mjs core --dry-run の計画: apply に --keep-conflict・--prev-tag・取り込みのブランチの removals/patches/assets/overlay/keep/lock、--build-root と --config（M-1）', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-2', '--prev-tag', '1.146.0', ...s.args]);
  const apply = jsonOf(r.stdout).plan.apply.args.map(String);
  for (const f of ['--keep-conflict', '--removals', '--patches', '--assets', '--overlay', '--keep', '--lock', '--extensions-src', '--checks-out']) assert.ok(apply.includes(f), f);
  assert.equal(apply[apply.indexOf('--prev-tag') + 1], '1.146.0');
  assert.equal(apply[apply.indexOf('--build-root') + 1], path.join(s.root, 'b'));
  assert.equal(apply[apply.indexOf('--config') + 1], s.cfg);
  const bwt = path.join(s.root, 'b', 'take-in', 'dry-2', 'repo');
  assert.equal(apply[apply.indexOf('--removals') + 1], path.join(bwt, 'removals'));
});
test('CLI: take-in.mjs core --dry-run の claude: 判定は --agent di-renjie・cwd はリポジトリ直下・--bare なし・--setting-sources なし。修理は --strict-mcp-config・Bash なしの --tools・--add-dir にブランチの作業ツリー', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-3', '--prev-tag', '1.146.0', ...s.args]);
  const c = jsonOf(r.stdout).claude;
  const v = c.verdict.args;
  assert.equal(v[v.indexOf('--agent') + 1], 'di-renjie');
  assert.ok(!v.includes('--bare') && !v.includes('--setting-sources'));
  assert.equal(path.resolve(c.verdict.cwd).toLowerCase(), REPO.toLowerCase());
  const rp = c.repair.args;
  assert.ok(rp.includes('--strict-mcp-config'));
  assert.ok(!/Bash/.test(rp[rp.indexOf('--tools') + 1]));
  assert.equal(path.resolve(rp[rp.indexOf('--add-dir') + 1]).toLowerCase(), path.resolve(path.join(s.root, 'b', 'take-in', 'dry-3', 'repo')).toLowerCase());
  assert.ok(Array.isArray(c.verdict.envRemoved));
  assert.ok(!JSON.stringify(c).includes('sk-'), '値を持たない');
});
test('CLI: take-in.mjs core --dry-run は ANTHROPIC_API_KEY を持つ環境でも、子に渡す env から外したと記録する（値は出さない）', () => {
  const s = sandboxCfg();
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-4', '--prev-tag', '1.146.0', ...s.args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: 'sk-test-SECRET-123' } });
  assert.equal(r.status, 0, r.stderr);
  const c = jsonOf(r.stdout).claude;
  assert.ok(c.verdict.envRemoved.includes('ANTHROPIC_API_KEY'));
  assert.ok(c.repair.envRemoved.includes('ANTHROPIC_API_KEY'));
  assert.ok(!(r.stdout + r.stderr).includes('sk-test-SECRET-123'));
});
test('CLI: take-in.mjs core --dry-run: switch.ps1 の展開は -ExpandOnly で、-ConfigPath・-InstallRoot を渡す。スモークは3回、通信の監査は -ExecutionPolicy Bypass', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-5', '--prev-tag', '1.146.0', ...s.args]);
  const o = jsonOf(r.stdout);
  assert.equal(o.expandOnlySupported, true);
  assert.ok(o.plan.expand.args.includes('-ExpandOnly'));
  assert.ok(o.plan.expand.args.includes('-InstallRoot') && o.plan.expand.args.includes('-ConfigPath'));
  assert.equal(o.plan.smoke.length, 3);
  assert.ok(o.plan.netaudit.args.includes('Bypass'));
});
test('CLI: take-in.mjs core --dry-run: --from/--to で手順を絞る。main の upstream.json と同じタグは終了コード 3（取り込むものが無い）', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.147.0', '--dry-run', '--label', 'dry-6', '--prev-tag', '1.146.0', '--from', 'apply', '--to', 'checks', ...s.args]);
  assert.deepEqual(jsonOf(r.stdout).steps.map((x) => x.n), [2, 3, 4]);
  const same = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'core', '1.146.0', '--dry-run', '--prev-tag', '1.146.0', ...s.args]);
  assert.equal(same.status, 3);
});
test('CLI: take-in.mjs ext anthropic.claude-code --dry-run は計画を出して 0。版を省ける。取得は lock-fetch.mjs（--only <id>）、判定は --agent di-renjie。何も作らない', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'ext', 'anthropic.claude-code', '--dry-run', ...s.args]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.result, 'dry-run');
  assert.equal(o.id, 'anthropic.claude-code');
  assert.equal(o.requested, null);
  const f = o.plan.fetch.args.map(String);
  assert.ok(f.some((x) => /lock-fetch\.mjs$/.test(x)));
  assert.equal(f[f.indexOf('--only') + 1], 'anthropic.claude-code');
  assert.ok(!f.includes('--seed') && !f.includes('--security'));
  const v = o.claude.verdict.args;
  assert.equal(v[v.indexOf('--agent') + 1], 'di-renjie');
  assert.ok(!fs.existsSync(o.runDir), '取得の場所を作らない');
  assert.ok(!fs.existsSync(path.join(s.root, 'b')));
  const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'extensions.lock.json'), 'utf8'));
  assert.equal(o.ledgerVersion, ledger.find((e) => e.id === 'anthropic.claude-code').version);
});
test('CLI: take-in.mjs ext <id> <version> --security --dry-run: ラベルは ext-<id>-<version>、--seed と --security <id> を取得に渡す', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'ext', 'anthropic.claude-code', '2.9.999', '--security', '--dry-run', ...s.args]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.label, 'ext-anthropic.claude-code-2.9.999');
  assert.equal(o.branch, 'take-in/ext-anthropic.claude-code-2.9.999');
  const f = o.plan.fetch.args.map(String);
  assert.ok(f.includes('--seed'));
  assert.equal(f[f.indexOf('--security') + 1], 'anthropic.claude-code');
});
test('CLI: take-in.mjs ext: 台帳に無い拡張は止める（終了コード 1。何も作らない）', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'ext', 'nobody.no-such-ext', '--dry-run', ...s.args]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /台帳に無い/);
});
test('CLI: take-in.mjs probe-claude --dry-run: 起動の引数だけを出す（claude を起動しない）。--agent di-renjie、API キーなし', () => {
  const s = sandboxCfg();
  const r = runNode([path.join(REPO, 'scripts', 'take-in.mjs'), 'probe-claude', '--dry-run', '--out', path.join(s.root, 'probe'), ...s.args]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.result, 'dry-run');
  assert.ok(o.invocation.args.includes('di-renjie'));
  assert.equal(o.exitCode, null, '起動していない');
});

// ---- adopt.mjs を子のプロセスで呼ぶ。一時の git リポジトリ（本物のリポジトリには触れない）----
const GITENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t.invalid' };
function tmpRepo({ label = '1.147.0-1', verdict = 'pass', withBranch = true, withVerdict = true } = {}) {
  const root = path.join(sb, `r${++n}`);
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  fs.cpSync(path.join(REPO, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  writeFile(path.join(repo, 'upstream.json'), JSON.stringify({ tag: '1.146.0', commit: 'a'.repeat(40), repository: 'https://github.com/microsoft/vscode.git' }, null, 2));
  const g = (...a) => {
    const r = spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8', env: { ...process.env, ...GITENV } });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.replace(/\s+$/, '');
  };
  g('init', '-q', '-b', 'main');
  g('config', 'core.autocrlf', 'false'); // adopt.mjs の中の git も同じ設定で動く（改行の変換で「変更あり」に見えるのを避ける）
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  if (withBranch) {
    g('checkout', '-q', '-b', `take-in/${label}`);
    writeFile(path.join(repo, 'upstream.json'), JSON.stringify({ tag: '1.147.0', commit: 'b'.repeat(40), repository: 'https://github.com/microsoft/vscode.git' }, null, 2));
    g('add', '-A');
    g('commit', '-q', '-m', 'take-in');
    g('checkout', '-q', 'main');
  }
  if (withVerdict) {
    const v = { label, verdict, recommendation: { pass: '入れ替えてよい', conditional: '条件を満たしてから', fail: '見送る' }[verdict], conditions: [] };
    writeFile(path.join(repo, 'records', 'take-in', label, 'verdict.json'), JSON.stringify(v));
  }
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, JSON.stringify({ buildRoot: path.join(root, 'b') }));
  const run = (...a) => spawnSync(process.execPath, [path.join(repo, 'scripts', 'adopt.mjs'), ...a, '--config', cfg, '--build-root', path.join(root, 'b')], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GITENV } });
  return { root, repo, g, run, label };
}
test('CLI: adopt.mjs <label> --dry-run（一時のリポジトリ）: 計画を出して 0。マージもタグ付けもブランチの削除もしない', () => {
  const t = tmpRepo();
  const head = t.g('rev-parse', 'HEAD');
  const r = t.run(t.label, '--dry-run');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.result, 'dry-run');
  assert.deepEqual(o.steps.map((s) => s.name).filter((x) => ['merge', 'tag'].includes(x)), ['merge', 'tag']);
  assert.ok(!JSON.stringify(o.steps).includes('push'));
  assert.equal(t.g('rev-parse', 'HEAD'), head, 'main は動かない');
  assert.equal(t.g('tag', '--list'), '');
  assert.equal(t.g('branch', '--list', `take-in/${t.label}`).trim().length > 0, true);
});
test('CLI: adopt.mjs（一時のリポジトリ）: 判定が fail で --force が無ければ終了コード 4。--force があれば進める（dry-run）', () => {
  const t = tmpRepo({ verdict: 'fail' });
  const r = t.run(t.label, '--dry-run');
  assert.equal(r.status, 4);
  assert.equal(jsonOf(r.stdout).result, 'refused');
  assert.equal(t.run(t.label, '--dry-run', '--force').status, 0);
});
test('CLI: adopt.mjs（一時のリポジトリ）: 判定が無い・ブランチが無い・ラベルが無い・知らない引数は止める（1 か 2）', () => {
  assert.equal(tmpRepo({ withVerdict: false }).run('1.147.0-1', '--dry-run').status, 1);
  assert.equal(tmpRepo({ withBranch: false }).run('1.147.0-1', '--dry-run').status, 1);
  const t = tmpRepo();
  assert.equal(t.run().status, 2);
  assert.equal(t.run(t.label, '--nope').status, 2);
});
test('CLI: adopt.mjs（一時のリポジトリ）: main にいない・追跡ファイルに変更があるときは止める（1）', () => {
  const a = tmpRepo();
  a.g('checkout', '-q', '-b', 'other');
  assert.equal(a.run(a.label, '--dry-run').status, 1);
  const b = tmpRepo();
  writeFile(path.join(b.repo, 'upstream.json'), '{"tag":"dirty"}');
  assert.equal(b.run(b.label, '--dry-run').status, 1);
});
test('CLI: adopt.mjs（一時のリポジトリ）: 実際に採る。ブランチを main にマージし、upstream.json が確定し、記録をコミットし、タグを打ち、ブランチを消す。プッシュしない（remote が無くても済む）', () => {
  const t = tmpRepo();
  const r = t.run(t.label);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const o = jsonOf(r.stdout);
  assert.equal(o.result, 'ok');
  assert.equal(JSON.parse(fs.readFileSync(path.join(t.repo, 'upstream.json'), 'utf8')).tag, '1.147.0');
  assert.equal(t.g('rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.ok(t.g('log', '--merges', '--format=%s').includes('1.147.0-1'), 'マージのコミット');
  assert.equal(t.g('tag', '--list'), t.label);
  assert.match(t.g('tag', '-l', '--format=%(contents)', t.label), /pass/);
  assert.equal(t.g('branch', '--list', `take-in/${t.label}`), '', 'ブランチを消す');
  assert.ok(t.g('ls-files', 'records').includes(`records/take-in/${t.label}/verdict.json`), '記録をコミット');
  assert.equal(t.g('status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(t.g('remote'), '');
  assert.match(o.next, /switch\.ps1 1\.147\.0-1/);
});
test('CLI: adopt.mjs（一時のリポジトリ）: --keep-branch・--no-records。同じラベルを2回は採れない（タグが既にある）', () => {
  const t = tmpRepo();
  const r = t.run(t.label, '--keep-branch', '--no-records');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(t.g('branch', '--list', `take-in/${t.label}`).length > 0);
  assert.ok(!t.g('ls-files', 'records').includes('verdict.json'));
  assert.equal(t.run(t.label).status, 1);
});
test('CLI: adopt.mjs（一時のリポジトリ）: マージが衝突したら --abort して止める（main は元のまま）', () => {
  const t = tmpRepo();
  writeFile(path.join(t.repo, 'upstream.json'), JSON.stringify({ tag: '1.146.5', commit: 'c'.repeat(40), repository: 'x' }, null, 2));
  t.g('add', '-A');
  t.g('commit', '-q', '-m', 'main moved');
  const head = t.g('rev-parse', 'HEAD');
  const r = t.run(t.label);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(t.g('rev-parse', 'HEAD'), head);
  assert.equal(t.g('status', '--porcelain', '--untracked-files=no'), '', 'マージの途中を残さない');
  assert.equal(t.g('tag', '--list'), '');
});
