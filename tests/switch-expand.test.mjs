// switch.ps1 -ExpandOnly と、build.mjs から apply.mjs への受け渡し（applyPassThrough・lockfile の --removals）のテスト。
// 仕様: docs/06 の3節（取り込みは今使っている版に触らない）・9節、docs/02 の8節（-Zip は取り込みもこの入口を使う）。
// 試しの installRoot（一時フォルダ）だけを使う。普段使いの %LOCALAPPDATA%\Shuko\ と %APPDATA% には触れない。
// Run: node --test tests/switch-expand.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runPs, runNode, parseJsonOut, makeFakeEditor, isJunctionTo } from './build/helpers.mjs';
import { applyPassThrough, parseArgs } from '../scripts/build.mjs';

const SWITCH = path.join(REPO, 'scripts', 'switch.ps1');
let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-exp-');
});
after(() => removeSandbox(sb));

function makeZip(zipPath, srcParent, topName) {
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  const r = spawnSync(tar, ['-a', '-c', '-f', zipPath, '-C', srcParent, topName], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
const sha256 = (f) => spawnSync('powershell', ['-NoProfile', '-Command', `(Get-FileHash -Algorithm SHA256 -LiteralPath '${f}').Hash`], { encoding: 'utf8' }).stdout.trim().toLowerCase();

function setup({ labels = [], engines = ['^1.94.0'], version = '1.146.0' } = {}) {
  const root = path.join(sb, `t${++n}`);
  const installRoot = path.join(root, 'install');
  const cfg = path.join(root, 'local.json');
  const ledger = path.join(root, 'ledger.json');
  const userDataDir = path.join(root, 'userdata');
  writeFile(cfg, JSON.stringify({ keepVersions: 3 }));
  writeFile(ledger, JSON.stringify(engines.map((e, i) => ({ id: `pub.ext${i}`, version: '1.0.0', engines: e }))));
  for (const l of labels) makeFakeEditor(path.join(installRoot, 'versions', l), { version });
  writeFile(path.join(userDataDir, 'User', 'settings.json'), '{"a": 1}');
  const base = ['-InstallRoot', installRoot, '-ConfigPath', cfg, '-UserDataDir', userDataDir, '-LedgerPath', ledger];
  const run = (...args) => {
    const r = runPs(SWITCH, [...args, ...base]);
    let json = null;
    try {
      json = parseJsonOut(r.stdout);
    } catch {
      /* no JSON */
    }
    return { ...r, json };
  };
  const zipFor = (label, v = version) => {
    const src = path.join(root, `src-${label}`);
    makeFakeEditor(path.join(src, `Shuko-win32-x64-${label}`), { version: v });
    const zip = path.join(root, `${label}.zip`);
    makeZip(zip, src, `Shuko-win32-x64-${label}`);
    return zip;
  };
  const snapshot = () => {
    const list = (d) => (fs.existsSync(d) ? fs.readdirSync(d).sort() : null);
    const hist = path.join(installRoot, 'history.txt');
    return {
      current: fs.existsSync(path.join(installRoot, 'current')) ? fs.realpathSync(path.join(installRoot, 'current')) : null,
      history: fs.existsSync(hist) ? fs.readFileSync(hist, 'utf8') : null,
      backups: list(path.join(installRoot, 'backups')),
      userSettings: fs.readFileSync(path.join(userDataDir, 'User', 'settings.json'), 'utf8'),
      userData: list(path.join(userDataDir, 'User')),
    };
  };
  return { root, installRoot, cfg, ledger, userDataDir, run, zipFor, snapshot, current: path.join(installRoot, 'current'), ver: (l) => path.join(installRoot, 'versions', l) };
}

// ---- -ExpandOnly (docs/06 の3節: 取り込みは今使っている版に触らない) ----
test('-ExpandOnly -Zip: 版のフォルダに展開するだけ。current・history.txt・backups・ユーザーのデータは変わらない（今の版があるとき）', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  assert.equal(s.run('1.146.0-1').status, 0);
  const before = s.snapshot();
  assert.ok(before.history && before.backups && before.backups.length === 1);
  const zip = s.zipFor('1.147.0-1', '1.147.0');
  const r = s.run('1.147.0-1', '-Zip', zip, '-Sha256', sha256(zip), '-ExpandOnly');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.equal(r.json.expandOnly, true);
  assert.ok(fs.existsSync(path.join(s.ver('1.147.0-1'), 'Shuko.exe')), '展開された');
  assert.deepEqual(s.snapshot(), before, 'current・history・backups・ユーザーのデータが同じ');
  assert.ok(isJunctionTo(s.current, s.ver('1.146.0-1')), 'current は今の版のまま');
  assert.equal(r.json.current, '1.146.0-1');
});
test('-ExpandOnly -Zip: 今の版が無い（初めて）ときも current・history.txt・backups を作らない', () => {
  const s = setup();
  const zip = s.zipFor('1.147.0-1', '1.147.0');
  const r = s.run('1.147.0-1', '-Zip', zip, '-ExpandOnly');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(fs.existsSync(path.join(s.ver('1.147.0-1'), 'Shuko.exe')));
  assert.ok(!fs.existsSync(s.current));
  assert.ok(!fs.existsSync(path.join(s.installRoot, 'history.txt')));
  assert.ok(!fs.existsSync(path.join(s.installRoot, 'backups')));
});
test('-ExpandOnly: -Zip が無ければ、既にある版のフォルダの exe・CLI を確かめるだけ（何も変えない）', () => {
  const s = setup({ labels: ['1.146.0-1', '1.147.0-1'] });
  s.run('1.146.0-1');
  const before = s.snapshot();
  const r = s.run('1.147.0-1', '-ExpandOnly');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(r.json.target.exe && r.json.target.cli);
  assert.deepEqual(s.snapshot(), before);
});
test('-ExpandOnly: 版のフォルダが無く -Zip も無ければ終了コード 1。何も作らない', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  s.run('1.146.0-1');
  const before = s.snapshot();
  const r = s.run('9.9.9-1', '-ExpandOnly');
  assert.equal(r.status, 1);
  assert.equal(r.json.result, 'error');
  assert.deepEqual(s.snapshot(), before);
  assert.ok(!fs.existsSync(s.ver('9.9.9-1')));
});
test('-ExpandOnly: -Sha256 が違えば展開の前に止まる（版のフォルダを作らず、何も変えない）', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  s.run('1.146.0-1');
  const before = s.snapshot();
  const zip = s.zipFor('1.147.0-1', '1.147.0');
  const r = s.run('1.147.0-1', '-Zip', zip, '-Sha256', '0'.repeat(64), '-ExpandOnly');
  assert.equal(r.status, 1);
  assert.ok(!fs.existsSync(s.ver('1.147.0-1')));
  assert.deepEqual(s.snapshot(), before);
});
test('-ExpandOnly: 版のフォルダが既にあれば -Zip で上書きしない（止まる）。今の版には触らない', () => {
  const s = setup({ labels: ['1.146.0-1', '1.147.0-1'] });
  s.run('1.146.0-1');
  fs.writeFileSync(path.join(s.ver('1.147.0-1'), 'marker.txt'), 'keep');
  const before = s.snapshot();
  const r = s.run('1.147.0-1', '-Zip', s.zipFor('1.147.0-1', '1.147.0'), '-ExpandOnly');
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(path.join(s.ver('1.147.0-1'), 'marker.txt'), 'utf8'), 'keep');
  assert.deepEqual(s.snapshot(), before);
});
test('-ExpandOnly: -List・-Previous とは一緒に使えない（終了コード 1）', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  s.run('1.146.0-1');
  const before = s.snapshot();
  assert.equal(s.run('-List', '-ExpandOnly').status, 1);
  assert.equal(s.run('-Previous', '-ExpandOnly').status, 1);
  assert.deepEqual(s.snapshot(), before);
});
test('-ExpandOnly: 台帳の engines を満たさなくても止めない（切り替えの確かめは切り替えるときだけ）。切り替えるときは止まる（終了コード 4）', () => {
  const s = setup({ labels: ['1.146.0-1'], engines: ['^2.0.0'] });
  const e = s.run('1.146.0-1', '-ExpandOnly');
  assert.equal(e.status, 0, e.stderr + e.stdout);
  assert.ok(!fs.existsSync(s.current));
  const sw = s.run('1.146.0-1');
  assert.equal(sw.status, 4);
  assert.equal(sw.json.result, 'engines-unsatisfied');
});
test('-ExpandOnly: 版のフォルダだけを確かめ、終了コード 0 で終わる（実行中のエディタの確認は切り替えのときだけ。ここでは起動しない）', () => {
  const s = setup({ labels: ['1.146.0-1'] });
  const r = s.run('1.146.0-1', '-ExpandOnly');
  assert.equal(r.status, 0);
  assert.ok(!r.json.running);
});
test('-ExpandOnly の後に同じ版へ普通に切り替えると、そこで初めて current・history・backups ができる', () => {
  const s = setup();
  const zip = s.zipFor('1.147.0-1', '1.147.0');
  s.run('1.147.0-1', '-Zip', zip, '-ExpandOnly');
  const r = s.run('1.147.0-1');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(isJunctionTo(s.current, s.ver('1.147.0-1')));
  assert.equal(s.snapshot().history.split(/\r?\n/).filter(Boolean).length, 1);
});

// ---- build.mjs から apply.mjs への受け渡し ----
test('applyPassThrough: 指定したものだけを --prev-tag、--keep-conflict、--patches、--assets、--overlay、--lock、--extensions-src の順で渡す。パスは絶対にする', () => {
  const a = parseArgs(['1.147.0', '--prev-tag', '1.146.0', '--keep-conflict', '--patches', 'p', '--assets', 'a', '--overlay', 'o.json', '--lock', 'l.json', '--extensions-src', 'es']);
  assert.deepEqual(applyPassThrough(a), ['--prev-tag', '1.146.0', '--keep-conflict', '--patches', path.resolve('p'), '--assets', path.resolve('a'), '--overlay', path.resolve('o.json'), '--lock', path.resolve('l.json'), '--extensions-src', path.resolve('es')]);
});
test('applyPassThrough: 何も指定しなければ何も渡さない。--keep-conflict は値を取らない', () => {
  assert.deepEqual(applyPassThrough(parseArgs(['1.147.0'])), []);
  assert.deepEqual(applyPassThrough(parseArgs(['1.147.0', '--keep-conflict'])), ['--keep-conflict']);
});
test('build.mjs の引数: 受け渡しの引数の値が無い・形の違う --prev-tag は誤り', () => {
  assert.throws(() => parseArgs(['1.147.0', '--patches']));
  assert.throws(() => parseArgs(['1.147.0', '--prev-tag', '../x']));
});

function dryRunBuild(extra = []) {
  const root = path.join(sb, `b${++n}`);
  const cfg = path.join(root, 'local.json');
  writeFile(cfg, JSON.stringify({ buildRoot: path.join(root, 'b') }));
  const r = runNode([path.join(REPO, 'scripts', 'build.mjs'), '1.147.0', '--dry-run', '--label', 't-exp', '--config', cfg, '--build-root', path.join(root, 'b'), ...extra]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return { rec: JSON.parse(r.stdout.slice(r.stdout.search(/^\{/m))), root };
}
test('build.mjs --dry-run: apply の手順に受け渡しの引数と --removals・--build-root・--config が付く', () => {
  const rm = path.join(sb, 'rm-given');
  const { rec } = dryRunBuild(['--removals', rm, '--prev-tag', '1.146.0', '--keep-conflict', '--patches', path.join(sb, 'pt'), '--overlay', path.join(sb, 'o.json')]);
  assert.equal(rec.result, 'dry-run');
  const c = rec.plan.apply.command;
  assert.ok(c.includes('--prev-tag 1.146.0'));
  assert.ok(c.includes('--keep-conflict'));
  assert.ok(c.includes(`--patches ${path.join(sb, 'pt')}`));
  assert.ok(c.includes(`--overlay ${path.join(sb, 'o.json')}`));
  assert.ok(c.includes(`--removals ${rm}`));
  assert.ok(c.includes('--build-root') && c.includes('--config'));
});
test('build.mjs --dry-run: ロックファイルの手順にも同じ --removals が付く（取り込みのブランチの removals/ で検査する）', () => {
  const rm = path.join(sb, 'rm-given2');
  const { rec } = dryRunBuild(['--removals', rm]);
  const c = rec.plan.lockfile.command;
  assert.ok(c.includes('--lockfile-check'));
  assert.ok(c.includes(`--removals ${rm}`));
  assert.ok(rec.plan.postprocess.removals === rm, 'postprocess も同じ場所');
});
test('build.mjs --dry-run: --removals を渡さなければ既定の removals/（ビルドリポジトリの）を apply・lockfile の両方で使う', () => {
  const { rec } = dryRunBuild();
  const def = path.join(REPO, 'removals');
  assert.ok(rec.plan.apply.command.includes(`--removals ${def}`));
  assert.ok(rec.plan.lockfile.command.includes(`--removals ${def}`));
});
test('build.mjs --dry-run: 何も書かない（--record を渡さない限り記録も作らない）', () => {
  const { root } = dryRunBuild();
  assert.ok(!fs.existsSync(path.join(root, 'b')), '試しの buildRoot に何も作らない');
});
