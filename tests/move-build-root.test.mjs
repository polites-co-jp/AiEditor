// scripts/move-build-root.mjs（ビルドの作業場所を移す、写すだけの台本）のテスト。
// 仕様: tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md の「2回目」の R2-4・R2-6（テストの入口）。
// 試しはすべて tmp/tests の下の一時の入れ物で行う。C:\b にも <リポジトリ>\tmp\b にも触れない（--from・--to に一時の入れ物を渡す）。
// Run: node --test tests/move-build-root.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { REPO, makeSandbox, removeSandbox, writeFile, runNode } from './build/helpers.mjs';
import { NEW_DEFAULT } from './build/root.mjs';
import { PLAN, parseArgs, planItem, selectFiles, verifySame, FILE_LIMIT, DIR_LIMIT, ArgError } from '../scripts/move-build-root.mjs';

const SCRIPT = path.join(REPO, 'scripts', 'move-build-root.mjs');
let sb;
let n = 0;
before(() => {
  sb = makeSandbox('tests-mbr-');
});
after(() => removeSandbox(sb));

const fresh = (name) => {
  const d = path.join(sb, `${name}-${++n}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const run = (args) => {
  const r = runNode([SCRIPT, ...args]);
  let json = null;
  const i = r.stdout.search(/^\{/m);
  if (i >= 0) {
    try {
      json = JSON.parse(r.stdout.slice(i));
    } catch {
      /* 引数の誤りなどで JSON が無い */
    }
  }
  return { ...r, json };
};
const item = (json, name) => json.items.find((x) => x.name === name);

// 元（--from）の偽の作業場所。PLAN の項目のうち、試しに使うものだけを作る。
function makeSource(from) {
  writeFile(path.join(from, 'dist', '1.146.0-p2-all.zip'), 'ZIPDATA-p2-all');
  writeFile(path.join(from, 'p2', '1.146.0-p2-all', 'Sukuna.exe'), 'EXE');
  writeFile(path.join(from, 'p2', '1.146.0-p2-all', 'resources', 'app', 'product.json'), '{"a":1}');
  writeFile(path.join(from, 'smoke', 'baseline-1.json'), '{"b":1}');
  writeFile(path.join(from, 'smoke', 'baseline-2.json'), '{"b":2}');
  writeFile(path.join(from, 'smoke', 'notes.txt'), '写さない（baseline-*.json だけ）');
  // 実行の置き場所: 直下のファイルだけ写す。user\・ws\・logs\ の下は写さない
  writeFile(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'smoke-result.json'), '{"ok":true}');
  writeFile(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'smoke-result.md'), '# ok');
  writeFile(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'user', 'user-data', 'Code Cache', 'x.cache'), 'CACHE');
  writeFile(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'ws', 'a.ts'), 'ws');
  writeFile(path.join(from, 'smoke', 'runs', 'p2-A-1-20261114T130741', 'probe-result.json'), '{}');
}

// 元の全体の指紋（相対パス・大きさ・SHA-256・更新時刻）。写した後で変わっていないことを見る。
function fingerprint(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const st = fs.statSync(p);
        out.push(`${path.relative(dir, p)}|${st.size}|${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}|${st.mtimeMs}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}
const listAll = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      out.push(path.relative(dir, p));
      if (e.isDirectory()) walk(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
};

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
function makeClone(dir, { worktrees = 0 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'one');
  writeFile(path.join(dir, 'f.txt'), 'file');
  git(dir, 'add', 'f.txt');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'two');
  git(dir, 'tag', '1.146.0');
  for (let i = 0; i < worktrees; i++) git(dir, 'worktree', 'add', '-q', '--detach', path.join(path.dirname(dir), `${path.basename(dir)}-wt${i}`), '1.146.0');
}

// ---- 入口（読むだけの部品）-----------------------------------------------------------------

test('PLAN: 全項目に name・kind・src・dst があり、名前は重ならず、C: の文字を持たない', () => {
  assert.ok(PLAN.length >= 10);
  const names = PLAN.map((p) => p.name);
  assert.equal(new Set(names).size, names.length);
  for (const p of PLAN) {
    assert.ok(p.name && p.kind && p.src && p.dst, JSON.stringify(p));
    assert.ok(['dir', 'git', 'file', 'files', 'results'].includes(p.kind), p.kind);
    assert.ok(!/^[A-Za-z]:/.test(p.src) && !/^[A-Za-z]:/.test(p.dst), `相対パスのはず: ${p.name}`);
  }
  assert.equal(FILE_LIMIT, 259);
  assert.equal(DIR_LIMIT, 247);
});

test('PLAN: 公式の版は <buildRoot>\\official\\、計測の ws-info は measure\\ へ、スモークの古い結果は smoke\\archive\\ へ', () => {
  const by = Object.fromEntries(PLAN.map((p) => [p.name, p]));
  assert.equal(by['official-1.146.0'].dst, 'official/vscode-1.146.0');
  assert.equal(by['ws-info'].dst, 'measure/ws-info.json');
  assert.equal(by['smoke-runs'].dst, 'smoke/archive/runs');
  assert.equal(by['smoke-absent'].dst, 'smoke/archive/absent');
  assert.equal(by.clone.kind, 'git');
});

test('parseArgs: --from は必須、ドライブ文字の絶対パスだけ、知らない引数・知らない --only は ArgError', () => {
  assert.throws(() => parseArgs([]), ArgError);
  assert.throws(() => parseArgs(['--from']), ArgError);
  assert.throws(() => parseArgs(['--from', 'rel\\dir']), ArgError);
  assert.throws(() => parseArgs(['--from', 'D:\\a', '--to', 'rel']), ArgError);
  assert.throws(() => parseArgs(['--from', 'D:\\a', '--nope']), ArgError);
  assert.throws(() => parseArgs(['--from', 'D:\\a', '--only', 'no-such-item']), ArgError);
  const a = parseArgs(['--from', 'D:/a/', '--to', 'E:\\b\\', '--dry-run', '--only', 'p2-all,ws-info']);
  assert.equal(a.from, 'D:\\a');
  assert.equal(a.to, 'E:\\b');
  assert.equal(a.dryRun, true);
  assert.deepEqual(a.only, ['p2-all', 'ws-info']);
});

test('selectFiles / planItem は読むだけ: 元と写し先を変えない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const before = fingerprint(from);
  const it = PLAN.find((p) => p.name === 'p2-all');
  const sel = selectFiles(it, from, to);
  assert.equal(sel.files.length, 2);
  assert.equal(sel.exists, true);
  const p = planItem(it, from, to);
  assert.deepEqual(p.problems, []);
  assert.equal(p.destExists, false);
  assert.deepEqual(fingerprint(from), before);
  assert.deepEqual(listAll(to), []);
});

// ---- 台本として走らせる ----------------------------------------------------------------------

test('dry-run: 何も写さない。計画に planned と数が出る。終了コード 0', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const r = run(['--from', from, '--to', to, '--dry-run', '--only', 'dist-p2-all,p2-all,smoke-baselines,smoke-runs']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json.result, 'ok');
  assert.equal(r.json.dryRun, true);
  for (const nme of ['dist-p2-all', 'p2-all', 'smoke-baselines', 'smoke-runs']) assert.equal(item(r.json, nme).status, 'planned', nme);
  assert.equal(item(r.json, 'p2-all').files, 2);
  assert.deepEqual(listAll(to), [], '何も作らない');
});

test('写す: 中身・大きさが同じ。baseline-*.json だけ。実行の置き場所は直下のファイルだけで smoke\\archive\\ へ。元は変わらない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const before = fingerprint(from);
  const r = run(['--from', from, '--to', to, '--only', 'dist-p2-all,p2-all,smoke-baselines,smoke-runs']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const nme of ['dist-p2-all', 'p2-all', 'smoke-baselines', 'smoke-runs']) assert.equal(item(r.json, nme).status, 'copied', nme);
  assert.equal(fs.readFileSync(path.join(to, 'dist', '1.146.0-p2-all.zip'), 'utf8'), 'ZIPDATA-p2-all');
  assert.equal(fs.readFileSync(path.join(to, 'p2', '1.146.0-p2-all', 'resources', 'app', 'product.json'), 'utf8'), '{"a":1}');
  assert.ok(fs.existsSync(path.join(to, 'smoke', 'baseline-1.json')));
  assert.ok(fs.existsSync(path.join(to, 'smoke', 'baseline-2.json')));
  assert.ok(!fs.existsSync(path.join(to, 'smoke', 'notes.txt')), 'baseline-*.json 以外は写さない');
  const arch = path.join(to, 'smoke', 'archive', 'runs');
  assert.ok(fs.existsSync(path.join(arch, 'official-20261113T124359', 'smoke-result.json')));
  assert.ok(fs.existsSync(path.join(arch, 'official-20261113T124359', 'smoke-result.md')));
  assert.ok(fs.existsSync(path.join(arch, 'p2-A-1-20261114T130741', 'probe-result.json')));
  assert.ok(!fs.existsSync(path.join(arch, 'official-20261113T124359', 'user')), 'user\\ の下は写さない');
  assert.ok(!fs.existsSync(path.join(arch, 'official-20261113T124359', 'ws')), 'ws\\ の下は写さない');
  assert.ok(!fs.existsSync(path.join(to, 'smoke', 'runs')), '古い結果を smoke\\runs に混ぜない');
  // 元を変えない（数・大きさ・中身・更新時刻）
  assert.deepEqual(fingerprint(from), before);
  // 何も消さない
  assert.ok(fs.existsSync(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'user', 'user-data', 'Code Cache', 'x.cache')));
});

test('元が無い項目は problem（元が無い）。終了コード 1', () => {
  const from = fresh('from');
  const to = fresh('to');
  fs.mkdirSync(from, { recursive: true });
  const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.json.result, 'problem');
  assert.equal(item(r.json, 'p2-all').status, 'problem');
  assert.match(item(r.json, 'p2-all').problems.join(' '), /元が無い/);
  assert.deepEqual(listAll(to), []);
});

// ---- 上書きしない・違えば problem -----------------------------------------------------------

test('上書きしない: 写し先に同じものがあれば already（終了コード 0）。2回走らせても変わらない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const args = ['--from', from, '--to', to, '--only', 'dist-p2-all,p2-all,ws-info'];
  writeFile(path.join(from, 'p0', 'ws-info.json'), '{"openFilesFull":[]}');
  assert.equal(run(args).status, 0);
  const after1 = fingerprint(to);
  const r2 = run(args);
  assert.equal(r2.status, 0, r2.stderr + r2.stdout);
  for (const nme of ['dist-p2-all', 'p2-all', 'ws-info']) assert.equal(item(r2.json, nme).status, 'already', nme);
  assert.deepEqual(fingerprint(to), after1, '2回目は何も変えない');
});

test('上書きしない・違えば problem: 写し先に違う中身（同じ大きさでも）があれば problem、終了コード 1、写し先のファイルは元のまま', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  // file（SHA-256 も照らす）: 同じ大きさで中身が違う
  writeFile(path.join(to, 'dist', '1.146.0-p2-all.zip'), 'ZIPDATA-p2-XXX');
  // dir: 大きさが違う
  writeFile(path.join(to, 'p2', '1.146.0-p2-all', 'Sukuna.exe'), 'EXE-DIFFERENT-SIZE');
  writeFile(path.join(to, 'p2', '1.146.0-p2-all', 'resources', 'app', 'product.json'), '{"a":1}');
  const r = run(['--from', from, '--to', to, '--only', 'dist-p2-all,p2-all']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.json.result, 'problem');
  assert.equal(item(r.json, 'dist-p2-all').status, 'problem');
  assert.equal(item(r.json, 'p2-all').status, 'problem');
  assert.match(item(r.json, 'dist-p2-all').problems.join(' '), /上書きしない/);
  assert.equal(fs.readFileSync(path.join(to, 'dist', '1.146.0-p2-all.zip'), 'utf8'), 'ZIPDATA-p2-XXX', '上書きしていない');
  assert.equal(fs.readFileSync(path.join(to, 'p2', '1.146.0-p2-all', 'Sukuna.exe'), 'utf8'), 'EXE-DIFFERENT-SIZE', '上書きしていない');
});

test('verifySame: 数・大きさ・SHA-256 の違いを見つける', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const it = PLAN.find((p) => p.name === 'dist-p2-all');
  const sel = selectFiles(it, from, to);
  assert.equal(verifySame(it, sel).ok, false, '写し先に無い');
  fs.mkdirSync(path.dirname(sel.files[0].dst), { recursive: true });
  fs.copyFileSync(sel.files[0].src, sel.files[0].dst);
  assert.deepEqual(verifySame(it, sel), { ok: true, checked: 1, problems: [] });
  fs.writeFileSync(sel.files[0].dst, 'ZIPDATA-p2-XXX');
  // 照らし済み（f.verified）のファイルは照らし直さない。書き換えた後は選び直す
  const v = verifySame(it, selectFiles(it, from, to));
  assert.equal(v.ok, false);
  assert.match(v.problems[0], /SHA-256 が違う/);
});

// ---- 259 文字 -------------------------------------------------------------------------------

test('写し先のパスが 259 文字を超えれば problem。何も写さない（--to を長くして試す。フォルダは作らない）', () => {
  const from = fresh('from');
  makeSource(from);
  // 写し先の根を、存在しないが長い名前にする（selectFiles は写し先を作らない）
  let to = fresh('toparent');
  while (to.length < 235) to = path.join(to, 'd'.repeat(30));
  const parent = to.split(path.sep).slice(0, -1).join(path.sep);
  const r = run(['--from', from, '--to', to, '--only', 'dist-p2-all,p2-all']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  for (const nme of ['dist-p2-all', 'p2-all']) {
    assert.equal(item(r.json, nme).status, 'problem', nme);
    assert.match(item(r.json, nme).problems.join(' '), /長すぎる/);
  }
  assert.ok(!fs.existsSync(to), '写し先を作らない');
  assert.ok(!fs.existsSync(parent) || fs.readdirSync(parent).length === 0 || !fs.existsSync(to));
});

test('259 文字ちょうどは通り、260 文字は problem（file の上限）', () => {
  const from = fresh('from');
  writeFile(path.join(from, 'dist', '1.146.0-p2-all.zip'), 'Z');
  const it = PLAN.find((p) => p.name === 'dist-p2-all');
  const tail = '\\dist\\1.146.0-p2-all.zip';
  const mk = (len) => {
    let to = 'E:\\';
    while (to.length + 1 + 20 + tail.length < len) to += `${'x'.repeat(19)}\\`;
    const pad = len - (to.length + tail.length);
    return path.win32.join(to, 'p'.repeat(Math.max(1, pad - 1)));
  };
  const exact = path.win32.join(mk(259));
  const s259 = planItem(it, from, exact);
  const dst259 = selectFiles(it, from, exact).files[0].dst;
  assert.ok(dst259.length <= 259, `想定: ${dst259.length}`);
  assert.deepEqual(s259.problems, []);
  const longer = exact + 'ZZ';
  const sLong = planItem(it, from, longer);
  assert.ok(selectFiles(it, from, longer).files[0].dst.length > 259);
  assert.match(sLong.problems.join(' '), /長すぎる/);
});

test('フォルダのパスは 247 文字まで（実行の置き場所の dirs）', () => {
  const from = fresh('from');
  writeFile(path.join(from, 'smoke', 'runs', 'official-20261113T124359', 'a.json'), '{}');
  const it = PLAN.find((p) => p.name === 'smoke-runs');
  let to = 'E:\\';
  while (to.length < 200) to += `${'y'.repeat(19)}\\`;
  const base = path.win32.join(to, 'smoke', 'archive', 'runs', 'official-20261113T124359');
  // フォルダが 247 を超え、ファイル（フォルダ + \a.json）が 259 以下のときだけ、フォルダの上限が効く
  const over = 248 - base.length;
  const toLong = over > 0 ? to + 'z'.repeat(over) : to;
  const p = planItem(it, from, toLong);
  const dirLen = path.win32.join(toLong, 'smoke', 'archive', 'runs', 'official-20261113T124359').length;
  assert.ok(dirLen > DIR_LIMIT && dirLen + 7 <= FILE_LIMIT, `想定: フォルダ ${dirLen}`);
  assert.match(p.problems.join(' '), /長すぎる/);
});

// ---- リンク・作業ツリーの付いた clone ----------------------------------------------------------

test('リンク（ジャンクション）があれば problem。写さない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const target = fresh('link-target');
  writeFile(path.join(target, 'x.txt'), 'x');
  fs.symlinkSync(target, path.join(from, 'p2', '1.146.0-p2-all', 'junction'), 'junction');
  try {
    const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(item(r.json, 'p2-all').status, 'problem');
    assert.match(item(r.json, 'p2-all').problems.join(' '), /リンク/);
    assert.ok(!fs.existsSync(path.join(to, 'p2')), '写さない');
    assert.ok(fs.existsSync(path.join(target, 'x.txt')), 'リンクの先は無事');
  } finally {
    fs.rmdirSync(path.join(from, 'p2', '1.146.0-p2-all', 'junction'));
  }
});

test('作業ツリーの付いた clone は problem。写さない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeClone(path.join(from, 'vscode'), { worktrees: 2 });
  const r = run(['--from', from, '--to', to, '--only', 'clone']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  const c = item(r.json, 'clone');
  assert.equal(c.status, 'problem');
  assert.match(c.problems.join(' '), /作業ツリーが付いている（3 個/);
  assert.ok(!fs.existsSync(path.join(to, 'vscode')), '写さない');
});

test('作業ツリーが main だけの clone は写せる。refs が元と同じ、写し先の作業ツリーは 1 個、元は変わらない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeClone(path.join(from, 'vscode'));
  const before = fingerprint(path.join(from, 'vscode'));
  const r = run(['--from', from, '--to', to, '--only', 'clone']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const c = item(r.json, 'clone');
  assert.equal(c.status, 'copied');
  assert.equal(c.git.refsSame, true);
  assert.equal(c.git.worktrees, 1);
  assert.equal(git(path.join(to, 'vscode'), 'rev-parse', '1.146.0'), git(path.join(from, 'vscode'), 'rev-parse', '1.146.0'));
  assert.deepEqual(fingerprint(path.join(from, 'vscode')), before, '元の clone は変わらない');
});

// ---- 引数の誤り: 終了コード 2 --------------------------------------------------------------------

test('--from と --to が重なれば終了コード 2（同じ・--to が --from の中・--from が --to の中）。何も作らない', () => {
  const base = fresh('overlap');
  const inner = path.join(base, 'inner');
  fs.mkdirSync(inner, { recursive: true });
  makeSource(base);
  const before = listAll(base);
  for (const [f, t] of [[base, base], [base, inner], [inner, base], [base.toUpperCase(), base.toLowerCase()], [base + '\\', base]]) {
    const r = run(['--from', f, '--to', t, '--dry-run', '--only', 'p2-all']);
    assert.equal(r.status, 2, `${f} / ${t}: ${r.stderr}`);
    assert.match(r.stderr, /重なっている/);
  }
  assert.deepEqual(listAll(base), before);
});

test('重ならない兄弟（名前の前方一致だけ）は重なりとしない', () => {
  const a = fresh('sib');
  const b = a + '-x'; // 前方一致だけ
  fs.mkdirSync(b, { recursive: true });
  makeSource(a);
  const r = run(['--from', a, '--to', b, '--dry-run', '--only', 'p2-all']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('引数の誤りは終了コード 2: --from なし・相対パス・知らない引数・知らない --only', () => {
  const to = fresh('to');
  for (const args of [[], ['--to', to], ['--from', 'rel\\dir'], ['--from', to, '--bogus'], ['--from', to, '--only', 'nope']]) {
    const r = run(args);
    assert.equal(r.status, 2, `${JSON.stringify(args)}: ${r.stderr}`);
  }
});

test('--to を省くと local.json の buildRoot、無ければ <リポジトリ>\\tmp\\b（dry-run では作らない）', () => {
  const from = fresh('from');
  makeSource(from);
  const la = fresh('localappdata');
  const r = runNode([SCRIPT, '--from', from, '--dry-run', '--only', 'p2-all'], { env: { LOCALAPPDATA: la } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(r.stdout.slice(r.stdout.search(/^\{/m)));
  assert.equal(j.to.toLowerCase(), NEW_DEFAULT.toLowerCase());
  assert.equal(item(j, 'p2-all').status, 'planned');
  // local.json の buildRoot が勝つ
  const other = fresh('other-root');
  writeFile(path.join(la, 'Sukuna', 'local.json'), JSON.stringify({ buildRoot: other }));
  const r2 = runNode([SCRIPT, '--from', from, '--dry-run', '--only', 'p2-all'], { env: { LOCALAPPDATA: la } });
  assert.equal(JSON.parse(r2.stdout.slice(r2.stdout.search(/^\{/m))).to.toLowerCase(), other.toLowerCase());
});

test('--out に結果の JSON を書く', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const out = path.join(fresh('outdir'), 'plan.json');
  const r = run(['--from', from, '--to', to, '--dry-run', '--out', out, '--only', 'p2-all']);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.result, 'ok');
  assert.equal(j.items[0].name, 'p2-all');
});

// ---- 2026-11-16 の直し: dir の SHA-256、途中で止まった後の続き -----------------------------------------
// 裁定「数と大きさと SHA-256 を照らす」を file だけでなく dir（p2-all・smoke-ext など約 8 GB）にもかける。
// 写し先に途中まで写したものがあるときは、元と同じファイル（大きさと SHA-256）は飛ばし、無いものだけを写して続ける。違うものがあれば problem（上書きしない）。

const P2 = ['p2', '1.146.0-p2-all'];

test('dir の SHA-256: 写し先に同じ大きさで中身だけ違うファイルがあれば problem（大きさだけの照らしでは通ってしまう）。上書きしない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  // 元の Sukuna.exe は 'EXE'（3 バイト）。同じ大きさで中身が違うもの
  writeFile(path.join(to, ...P2, 'Sukuna.exe'), 'EXX');
  writeFile(path.join(to, ...P2, 'resources', 'app', 'product.json'), '{"a":1}');
  const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(item(r.json, 'p2-all').status, 'problem');
  assert.match(item(r.json, 'p2-all').problems.join(' '), /SHA-256|上書きしない/);
  assert.equal(fs.readFileSync(path.join(to, ...P2, 'Sukuna.exe'), 'utf8'), 'EXX', '上書きしていない');
});

test('dir の SHA-256: 写した後の照らし（verifySame）が、同じ大きさで中身が違う dir のファイルを見つける', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const it = PLAN.find((p) => p.name === 'p2-all');
  const sel = selectFiles(it, from, to);
  for (const f of sel.files) {
    fs.mkdirSync(path.dirname(f.dst), { recursive: true });
    fs.copyFileSync(f.src, f.dst);
  }
  assert.equal(verifySame(it, selectFiles(it, from, to)).ok, true, '全部同じなら ok');
  fs.writeFileSync(path.join(to, ...P2, 'Sukuna.exe'), 'EXX'); // 同じ 3 バイト
  const v = verifySame(it, selectFiles(it, from, to));
  assert.equal(v.ok, false, 'dir でも SHA-256 を照らす');
  assert.match(v.problems.join(' '), /SHA-256 が違う/);
  assert.equal(v.checked, sel.files.length, '照らした数は写す全部');
});

test('写した項目ごとに、かかった時間を記録に出す（写す時間と照らす時間。秒の数値）', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const r = run(['--from', from, '--to', to, '--only', 'p2-all,dist-p2-all']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const nme of ['p2-all', 'dist-p2-all']) {
    const it = item(r.json, nme);
    assert.equal(it.status, 'copied', nme);
    assert.equal(typeof it.seconds, 'number', `${nme}.seconds`);
    assert.equal(typeof it.verifySeconds, 'number', `${nme}.verifySeconds`);
    assert.ok(it.verify.checked >= 1, `${nme} は照らした数が出る`);
  }
  assert.equal(item(r.json, 'p2-all').verify.checked, 2, 'dir は全ファイル（2 個）を照らす');
});

test('続き: 途中で止まった写し先（一部だけ写してある）は、元と同じものを飛ばし、無いものだけを写して終わる。上書きしない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const exe = path.join(to, ...P2, 'Sukuna.exe');
  writeFile(exe, 'EXE'); // 元と同じ
  const old = new Date(2020, 0, 1);
  fs.utimesSync(exe, old, old); // 上書きされたら更新時刻が変わる
  const before = fs.statSync(exe);
  const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const it = item(r.json, 'p2-all');
  assert.notEqual(it.status, 'problem', it.problems.join(' '));
  assert.equal(it.status, 'copied', '無いものを写したので copied');
  assert.equal(it.existing.same, 1, '飛ばした数（前からあった同じもの）');
  assert.equal(it.existing.missing, 1);
  assert.equal(it.copied, 1, '写したのは無かった 1 個だけ');
  assert.equal(fs.readFileSync(path.join(to, ...P2, 'resources', 'app', 'product.json'), 'utf8'), '{"a":1}', '無かったものが写った');
  const after = fs.statSync(exe);
  assert.equal(after.mtimeMs, before.mtimeMs, '前からあった同じファイルは触らない');
  assert.equal(fs.readFileSync(exe, 'utf8'), 'EXE');
  // もう一度走らせれば already（何も変えない）
  const fp = fingerprint(to);
  const r2 = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r2.status, 0);
  assert.equal(item(r2.json, 'p2-all').status, 'already');
  assert.deepEqual(fingerprint(to), fp);
});

test('続き: 写し先に違うファイルが1つでもあれば problem。無いものも写さず、違うファイルも上書きしない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  writeFile(path.join(to, ...P2, 'Sukuna.exe'), 'EXX'); // 同じ大きさで中身が違う。product.json は無い
  const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(item(r.json, 'p2-all').status, 'problem');
  assert.ok(!fs.existsSync(path.join(to, ...P2, 'resources', 'app', 'product.json')), '違うものがあるときは何も写さない');
  assert.equal(fs.readFileSync(path.join(to, ...P2, 'Sukuna.exe'), 'utf8'), 'EXX', '上書きしない');
});

test('続き: 途中で切れたファイル（元より小さい）は「違うもの」。problem で止まり、上書きもしない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  writeFile(path.join(to, 'dist', '1.146.0-p2-all.zip'), 'ZIP'); // 元は 'ZIPDATA-p2-all'
  const r = run(['--from', from, '--to', to, '--only', 'dist-p2-all']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(item(r.json, 'dist-p2-all').status, 'problem');
  assert.equal(fs.readFileSync(path.join(to, 'dist', '1.146.0-p2-all.zip'), 'utf8'), 'ZIP');
});

test('続き: 実行の置き場所（results）も、直下のファイルが一部だけ写してあれば無いものだけを写す', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  const dst = path.join(to, 'smoke', 'archive', 'runs', 'official-20261113T124359');
  writeFile(path.join(dst, 'smoke-result.json'), '{"ok":true}');
  const r = run(['--from', from, '--to', to, '--only', 'smoke-runs']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(item(r.json, 'smoke-runs').status, 'copied');
  assert.equal(fs.readFileSync(path.join(dst, 'smoke-result.md'), 'utf8'), '# ok');
  assert.ok(fs.existsSync(path.join(to, 'smoke', 'archive', 'runs', 'p2-A-1-20261114T130741', 'probe-result.json')));
  assert.ok(!fs.existsSync(path.join(dst, 'user')), 'user\\ の下は写さない（続きでも）');
});

test('続き: dry-run は何も写さず、飛ばす数と写す数（existing）を出す', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  writeFile(path.join(to, ...P2, 'Sukuna.exe'), 'EXE');
  const fp = fingerprint(to);
  const r = run(['--from', from, '--to', to, '--only', 'p2-all', '--dry-run']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const it = item(r.json, 'p2-all');
  assert.equal(it.status, 'planned');
  assert.equal(it.existing.same, 1);
  assert.equal(it.existing.missing, 1);
  assert.deepEqual(fingerprint(to), fp, 'dry-run は何も写さない');
});

test('順番: smoke-ext（smoke\\ext を作る）の後に smoke-baselines（根が smoke）を写しても problem にならない。2回目は already', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  writeFile(path.join(from, 'smoke', 'ext', 'p', 'x.txt'), 'ext');
  const names = PLAN.map((p) => p.name);
  assert.ok(names.indexOf('smoke-ext') < names.indexOf('smoke-baselines'), 'PLAN の順');
  const args = ['--from', from, '--to', to, '--only', 'smoke-ext,smoke-baselines'];
  const r = run(args);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(item(r.json, 'smoke-ext').status, 'copied');
  assert.equal(item(r.json, 'smoke-baselines').status, 'copied', 'smoke\\ が先にできていても、無いものを写す');
  assert.ok(fs.existsSync(path.join(to, 'smoke', 'baseline-1.json')));
  assert.ok(!fs.existsSync(path.join(to, 'smoke', 'notes.txt')));
  const r2 = run(args);
  assert.equal(r2.status, 0);
  assert.equal(item(r2.json, 'smoke-ext').status, 'already');
  assert.equal(item(r2.json, 'smoke-baselines').status, 'already');
});

test('続き: 写し先にあって元に無いファイルは、数えず、消さず、照らさない', () => {
  const from = fresh('from');
  const to = fresh('to');
  makeSource(from);
  assert.equal(run(['--from', from, '--to', to, '--only', 'p2-all']).status, 0);
  writeFile(path.join(to, ...P2, 'extra-only-in-dest.txt'), 'x');
  const r = run(['--from', from, '--to', to, '--only', 'p2-all']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(item(r.json, 'p2-all').status, 'already');
  assert.ok(fs.existsSync(path.join(to, ...P2, 'extra-only-in-dest.txt')));
});

// ---- 静的な検査 --------------------------------------------------------------------------------

test('台本は何も消さない（unlink・rm・rmdir・rename を呼ばない）', () => {
  const t = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(t, /\b(unlinkSync|rmSync|rmdirSync|renameSync|unlink|rmdir)\s*\(/);
  assert.match(t, /COPYFILE_EXCL/);
});
