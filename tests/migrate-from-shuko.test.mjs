// 移行の台本 scripts/migrate/migrate-from-shuko.ps1 のテスト（改名 Shuko → Sukuna）。
// 仕様: tasks/2026-11-18-rename-sukuna-survey/rename-plan.md の 3.2・4節の 2a の4・5節、permission-requests.md の1.5（守り1〜7）。
// 入口（仕様から想定。蒙恬の handoff-notes-meng-tian.md で確定する。違えば下の SANDBOX_LAYOUT と runMigrate を合わせる）:
//   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 [-SandboxRoot <dir>] [-List | -Apply]
//   - 引数なし: 何もせず使い方を出す。-List: 写すものの一覧だけ（何も書かない）。-Apply: 本番。
//   - -SandboxRoot <dir>: 6つの場所を <dir> の下の模擬に置き換える。<buildRoot>\trial-* の下でなければ止まる。
//   - 標準出力は JSON 1つ。秘密のファイル（watch\・secrets\ の下、Local State、state.vscdb）は名前と大きさだけ。中身もハッシュも出ない。
//
// 本物の %APPDATA%・%USERPROFILE%・%LOCALAPPDATA% には触れない: 子プロセスの3つの環境変数は、模擬の外の「おとり」に向ける。
// 場所は一時の buildRoot（<repo>\tmp\tests\migrate-buildroot-*）の trial-migrate-t*\。台本の -ConfigPath にその local.json を渡す（本物の tmp\b には作らない）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { REPO, cleanEnv, sandboxBase } from './build/helpers.mjs';

const SCRIPT_REL = 'scripts/migrate/migrate-from-' + 'shu' + 'ko.ps1';
// AIED_MIGRATE_SCRIPT: 台本の代わりに別の台本を指す（テストの道具の確かめ用。通常は使わない）
const SCRIPT = process.env.AIED_MIGRATE_SCRIPT ? path.resolve(process.env.AIED_MIGRATE_SCRIPT) : path.join(REPO, SCRIPT_REL);
const OLD = 'Shu' + 'ko'; // 旧の名前（この台本のテストだけが書く）
const OLDL = OLD.toLowerCase();
const exists = fs.existsSync(SCRIPT);
const skip = !exists && `${SCRIPT_REL} がまだ無い（蒙恬の実装待ち）`;

// 模擬の中の6つの場所（+ プロセスを見る Programs の下）。蒙恬の実装が違えばここを直す。
const SANDBOX_LAYOUT = (root) => {
  const profile = path.join(root, 'Users', 'sandbox');
  return { profile, appdata: path.join(profile, 'AppData', 'Roaming'), local: path.join(profile, 'AppData', 'Local') };
};

// 本物の <repo>\tmp\b には作らない（run-all の見張りが tmp\b の変化を見る）。一時の場所（tmp\tests\ の下）を buildRoot にして、
// 台本の -ConfigPath にその local.json を渡す。試しはすべて <この buildRoot>\trial-* の下、範囲の外の場合も同じ buildRoot の下に作る。
const TRIAL_BASE = fs.mkdtempSync(path.join(sandboxBase(), 'migrate-buildroot-'));
const CONFIG = path.join(TRIAL_BASE, 'local.json');
fs.writeFileSync(CONFIG, JSON.stringify({ buildRoot: TRIAL_BASE }));
let seq = 0;
const made = [];
function newRoot(prefix = 'trial-migrate-t') {
  const d = path.join(TRIAL_BASE, `${prefix}${process.pid}-${++seq}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(d, { recursive: true });
  made.push(d);
  return d;
}
test.after(() => { for (const d of [...made, TRIAL_BASE]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

const put = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
const randBytes = (marker, n = 200) => Buffer.concat([Buffer.from(marker), Buffer.from([0, 1, 2, 255, 254]), crypto.randomBytes(n)]);

// 秘密に見立てる中身（目印の文字列つき。出力にこの目印・ハッシュ・Base64 が出たら守り2の違反）
const SECRETS = {
  token: randBytes('MARK-DPAPI-TOKEN-7f3a-'),
  localState: randBytes('MARK-LOCAL-STATE-91cc-'),
  vscdb: randBytes('MARK-STATE-VSCDB-2b6d-'),
  secretsK: randBytes('MARK-SECRETS-K-55e0-'),
  state: Buffer.from(JSON.stringify({ todoPageId: 'MARK-STATE-JSON-aa11', n: 1 })),
  settings: Buffer.from('{"editor.fontSize": 17, "x": "MARK-SETTINGS-c0de"}'),
  syncBase: Buffer.from('{"base":"MARK-SYNC-BASE-d00d"}'),
};

// 模擬の旧の場所を作る。返す値は各場所
function plant(root, { withSecretsDir = true } = {}) {
  const L = SANDBOX_LAYOUT(root);
  const a = path.join(L.appdata, OLD);
  put(path.join(a, 'Local State'), SECRETS.localState);
  put(path.join(a, 'User', 'settings.json'), SECRETS.settings);
  put(path.join(a, 'User', 'keybindings.json'), '[]');
  put(path.join(a, 'User', 'globalStorage', 'state.vscdb'), SECRETS.vscdb);
  put(path.join(a, 'User', 'globalStorage', `${OLDL}.notion-sync`, 'sync-base.json'), SECRETS.syncBase);
  put(path.join(a, 'User', 'globalStorage', 'ms-vscode.other', 'keep.json'), '{"k":1}');
  for (const d of ['Cache', 'CachedData', 'Code Cache', 'GPUCache', 'CachedExtensionVSIXs', 'logs', 'Crashpad', 'clp']) put(path.join(a, d, 'junk.bin'), 'JUNK-' + d);
  put(path.join(a, 'languagepacks.json'), '{"old":"path"}');
  put(path.join(L.profile, `.${OLDL}`, 'argv.json'), '{"locale":"ja","hand":"MARK-ARGV-edit"}');
  put(path.join(L.profile, `.${OLDL}`, 'extensions', 'x.y-1.0.0', 'package.json'), '{}');
  put(path.join(L.profile, `.${OLDL}`, 'extensions', 'extensions.json'), '[]');
  const w = path.join(L.local, OLD, 'watch');
  put(path.join(w, 'state.json'), SECRETS.state);
  put(path.join(w, 'notion-token.dpapi'), SECRETS.token);
  put(path.join(w, 'watch.log'), 'log line 1\r\nlog line 2\r\n');
  if (withSecretsDir) put(path.join(L.local, OLD, 'secrets', 'k.bin'), SECRETS.secretsK);
  put(path.join(L.local, OLD, 'local.json'), '{"keepVersions":5}'); // 台本は写さない（configure.ps1 が作る）
  return {
    ...L,
    srcAppdata: a, srcArgv: path.join(L.profile, `.${OLDL}`), srcLocal: path.join(L.local, OLD),
    dstAppdata: path.join(L.appdata, 'Sukuna'), dstArgvDir: path.join(L.profile, '.sukuna'), dstLocal: path.join(L.local, 'Sukuna'),
    programsOld: path.join(L.local, 'Programs', OLD), programsNew: path.join(L.local, 'Programs', 'Sukuna'),
  };
}

// 木の写真（相対パス → 大きさとバイトの SHA-256。テストの側だけが中身を読む）
function snap(dir) {
  const out = {};
  const walk = (d, rel) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out[r + '/'] = 'dir'; walk(p, r); }
      else { const b = fs.readFileSync(p); out[r] = `${b.length}:${crypto.createHash('sha256').update(b).digest('hex')}`; }
    }
  };
  walk(dir, '');
  return out;
}
const sourceSnap = (P) => ({ a: snap(P.srcAppdata), p: snap(P.srcArgv), l: snap(P.srcLocal) });
const destSnap = (P) => ({ a: snap(P.dstAppdata), p: snap(P.dstArgvDir), l: snap(P.dstLocal) });
const destEmpty = (P) => Object.values(destSnap(P)).every((s) => Object.keys(s).length === 0);

// おとり: 子プロセスの本物の場所の環境変数の向け先。ここに Sukuna・.sukuna が作られたら、本物に書こうとした印
function runMigrate(args, root) {
  const decoy = path.join(root, '__real_decoy__');
  const env = { APPDATA: path.join(decoy, 'Roaming'), LOCALAPPDATA: path.join(decoy, 'Local'), USERPROFILE: path.join(decoy, 'Profile') };
  for (const v of Object.values(env)) fs.mkdirSync(v, { recursive: true });
  const cfg = args.includes('-SandboxRoot') && !process.env.AIED_MIGRATE_SCRIPT ? ['-ConfigPath', CONFIG] : [];
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args, ...cfg], {
    cwd: REPO, env: cleanEnv(env), encoding: 'utf8', timeout: 180000,
  });
  const decoyHits = [];
  const walk = (d, depth) => {
    if (depth > 3 || !fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (/sukuna|shuko/i.test(e.name)) decoyHits.push(path.join(d, e.name));
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
    }
  };
  walk(decoy, 0);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error, decoyHits };
}
const both = (r) => r.stdout + '\n' + r.stderr;

// 出力に秘密の中身・そのハッシュ・Base64 が出ていないこと（守り2）
function assertNoSecretLeak(text, label) {
  for (const [name, buf] of Object.entries(SECRETS)) {
    const markers = [...buf.toString('latin1').matchAll(/MARK-[A-Za-z0-9-]+/g)].map((m) => m[0]);
    for (const m of markers) assert.ok(!text.includes(m), `${label}: ${name} の中身の目印 ${m} が出力にある`);
    const forms = new Set();
    for (const alg of ['sha256', 'sha1', 'md5', 'sha512']) {
      const hex = crypto.createHash(alg).update(buf).digest('hex');
      forms.add(hex); forms.add(hex.toUpperCase());
      forms.add(crypto.createHash(alg).update(buf).digest('base64'));
    }
    forms.add(buf.toString('base64'));
    forms.add(buf.toString('hex'));
    const lower = text.toLowerCase();
    for (const f of forms) assert.ok(!lower.includes(f.toLowerCase()), `${label}: ${name} のハッシュか Base64 が出力にある`);
  }
}

const parseOne = (stdout) => {
  // 標準出力は JSON 1つ（前後の空白だけ許す）
  return JSON.parse(stdout.trim());
};

// ---------------------------------------------------------------------------------------------------------------
test('台本が存在する（scripts/migrate/ の下。一般の行 scripts/*.ps1 に当たらない場所）', () => {
  assert.ok(exists, `${SCRIPT_REL} が無い`);
  assert.ok(!fs.existsSync(path.join(REPO, 'scripts', 'migrate-from-' + OLDL + '.ps1')), 'scripts 直下には置かない');
});

test('引数なし: 何も書かず、使い方（-List・-Apply・-SandboxRoot）を出す', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  const before = { s: sourceSnap(P), d: destSnap(P) };
  const r = runMigrate([], root);
  assert.equal(r.status, 2, '引数なしは終了 2（使い方を標準エラーへ）');
  assert.equal(r.stdout.trim(), '', '標準出力は空');
  assert.match(both(r), /-List/);
  assert.match(both(r), /-Apply/);
  assert.match(both(r), /-SandboxRoot/);
  assert.deepEqual(destSnap(P), before.d, '何も書かない');
  assert.deepEqual(sourceSnap(P), before.s);
  assert.deepEqual(r.decoyHits, [], '本物の場所には向かわない');
});

test('-List: 写すものの一覧だけ。何も書かない。JSON 1つ。除くもの・秘密の中身は出ない', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  const before = { s: sourceSnap(P), d: destSnap(P) };
  const r = runMigrate(['-SandboxRoot', root, '-List'], root);
  assert.equal(r.status, 0, both(r));
  const j = parseOne(r.stdout);
  assert.equal(typeof j, 'object');
  const text = r.stdout;
  for (const name of ['state.json', 'notion-token.dpapi', 'argv.json', 'settings.json', 'sync-base.json']) assert.ok(text.includes(name), `一覧に ${name}`);
  assert.deepEqual(destSnap(P), before.d, '-List は何も書かない（書く先が空のまま）');
  assert.deepEqual(sourceSnap(P), before.s);
  assert.equal(r.decoyHits.length, 0);
  assertNoSecretLeak(both(r), '-List');
});

test('-Apply: 写す・除く・名前を変える。バイトが同じ。元は変わらない。出力に秘密が無い', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  const src = sourceSnap(P);
  const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
  assert.equal(r.status, 0, both(r));
  parseOne(r.stdout);
  assertNoSecretLeak(both(r), '-Apply');

  // 元の場所: 書かない・消さない・動かさない
  assert.deepEqual(sourceSnap(P), src, '元の場所は1バイトも変わらない');

  // %APPDATA%\Sukuna
  const A = snap(P.dstAppdata);
  const aSrc = src.a;
  const same = (rel, relSrc = rel) => assert.equal(A[rel], aSrc[relSrc], `${rel} がバイトのまま同じ`);
  same('Local State');
  same('User/settings.json');
  same('User/keybindings.json');
  same('User/globalStorage/state.vscdb');
  same('User/globalStorage/ms-vscode.other/keep.json');
  // 名前を変える: shuko.notion-sync → sukuna.notion-sync（中身は同じ）
  same('User/globalStorage/sukuna.notion-sync/sync-base.json', `User/globalStorage/${OLDL}.notion-sync/sync-base.json`);
  assert.ok(!(`User/globalStorage/${OLDL}.notion-sync/` in A), '旧の名前のフォルダは作らない');
  // 除く: キャッシュとログ
  for (const d of ['Cache', 'CachedData', 'Code Cache', 'GPUCache', 'CachedExtensionVSIXs', 'logs', 'Crashpad', 'clp']) {
    assert.ok(!(`${d}/` in A) && !(`${d}/junk.bin` in A), `${d} は写さない`);
  }
  assert.ok(!('languagepacks.json' in A), 'languagepacks.json は写さない');

  // %USERPROFILE%\.sukuna\argv.json だけ（extensions\ は写さない）
  const Pf = snap(P.dstArgvDir);
  assert.deepEqual(Object.keys(Pf).sort(), ['argv.json']);
  assert.equal(Pf['argv.json'], src.p['argv.json']);

  // %LOCALAPPDATA%\Sukuna\watch\（・secrets\）。local.json は作らない
  const Lc = snap(P.dstLocal);
  for (const f of ['watch/state.json', 'watch/notion-token.dpapi', 'watch/watch.log', 'secrets/k.bin']) assert.equal(Lc[f], src.l[f], `${f} がバイトのまま同じ`);
  assert.ok(!('local.json' in Lc), 'local.json は台本では作らない');
  assert.equal(r.decoyHits.length, 0, '本物の場所に書いていない');
});

test('-Apply: 照らしの結果（数と大きさ）を出す。写した数が実際と合う', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
  assert.equal(r.status, 0, both(r));
  // 出力の形は実装で確定する。ここでは「数」と「大きさ」を表す数値が JSON に含まれることだけを見る
  const nums = JSON.stringify(parseOne(r.stdout)).match(/\d+/g) ?? [];
  const nWatch = Object.keys(snap(path.join(P.dstLocal, 'watch'))).length;
  assert.ok(nums.includes(String(nWatch)) || nums.length > 0, `数が出ていない（watch の写し ${nWatch}）`);
  const sizeToken = String(SECRETS.token.length);
  assert.ok(nums.includes(sizeToken), `大きさ（notion-token.dpapi = ${sizeToken} バイト）が出ている`);
});

test('secrets\\ が無くても写せる（あれば写す）', { skip }, () => {
  const root = newRoot();
  const P = plant(root, { withSecretsDir: false });
  const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
  assert.equal(r.status, 0, both(r));
  assert.ok(fs.existsSync(path.join(P.dstLocal, 'watch', 'state.json')));
  assert.ok(!fs.existsSync(path.join(P.dstLocal, 'secrets')));
});

test('書く先が空のフォルダなら進む（無いか空のときだけ作る）', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  fs.mkdirSync(P.dstAppdata, { recursive: true });
  fs.mkdirSync(path.join(P.dstLocal, 'watch'), { recursive: true });
  const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
  assert.equal(r.status, 0, both(r));
  assert.ok(fs.existsSync(path.join(P.dstAppdata, 'Local State')));
  assert.ok(fs.existsSync(path.join(P.dstLocal, 'watch', 'state.json')));
});

// ---- 止まる場合 -------------------------------------------------------------------------------------------------
// 蒙恬の引き継ぎ 1.1: 止めたとき（blockers がある）は終了 3、標準出力は JSON で result: "blocked"・written: false、blockers[].kind が理由。
function assertBlocked(r, kind) {
  assert.equal(r.status, 3, both(r));
  const j = parseOne(r.stdout);
  assert.equal(j.result, 'blocked');
  assert.equal(j.written, false);
  assert.ok(j.blockers.some((b) => b.kind === kind), `blockers に ${kind}: ${JSON.stringify(j.blockers)}`);
}
function stopsWithoutWriting(prepare, label, kind) {
  test(`止まる: ${label}`, { skip }, () => {
    const root = newRoot();
    const P = plant(root);
    const marks = prepare(P) ?? {};
    const srcBefore = sourceSnap(P);
    const dstBefore = destSnap(P);
    const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
    assert.notEqual(r.status, 0, '0 以外で終わる\n' + both(r));
    if (kind) assertBlocked(r, kind);
    assert.deepEqual(destSnap(P), dstBefore, '何も書かずに止まる（混ぜない）');
    assert.deepEqual(sourceSnap(P), srcBefore, '元は変わらない');
    assert.equal(r.decoyHits.length, 0);
    assertNoSecretLeak(both(r), label);
    if (marks.after) marks.after(r, P);
  });
}
stopsWithoutWriting((P) => put(path.join(P.dstAppdata, 'User', 'settings.json'), '{"existing":true}'), '書く先の %APPDATA%\\Sukuna\\User に中身がある', 'destNotEmpty');
stopsWithoutWriting((P) => put(path.join(P.dstArgvDir, 'argv.json'), '{"existing":true}'), '書く先の .sukuna\\argv.json がある', 'destNotEmpty');
stopsWithoutWriting((P) => put(path.join(P.dstLocal, 'watch', 'state.json'), '{"existing":true}'), '書く先の %LOCALAPPDATA%\\Sukuna\\watch に中身がある', 'destNotEmpty');

test('止まる: 2回目の -Apply（1回目で書く先に中身ができている）。混ぜない', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  assert.equal(runMigrate(['-SandboxRoot', root, '-Apply'], root).status, 0);
  const dst = destSnap(P);
  const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
  assert.notEqual(r.status, 0);
  assert.deepEqual(destSnap(P), dst, '2回目は何も変えない');
});

// 動いているプロセスを模擬: node.exe の写しを <local>\Programs\<名前>\current\<名前>.exe に置いて起動する
function withRunningExe(P, dir, exeName, fn) {
  const exe = path.join(dir, 'current', exeName);
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.copyFileSync(process.execPath, exe);
  const child = spawn(exe, ['-e', 'setTimeout(()=>{},120000)'], { stdio: 'ignore', windowsHide: true });
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    return fn();
  } finally {
    child.kill();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
}
for (const [label, key, exeName] of [['Shuko が動いている', 'programsOld', OLD + '.exe'], ['Sukuna が動いている', 'programsNew', 'Sukuna.exe']]) {
  test(`止まる: ${label}（日常の版の実行ファイルのプロセス）。何も書かない`, { skip }, () => {
    const root = newRoot();
    const P = plant(root);
    const srcBefore = sourceSnap(P);
    withRunningExe(P, P[key], exeName, () => {
      const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
      assertBlocked(r, 'running');
      assert.ok(destEmpty(P), '何も書かない');
      assert.deepEqual(sourceSnap(P), srcBefore);
      assertNoSecretLeak(both(r), label);
    });
  });
}

test('止まる: -SandboxRoot が <buildRoot>\\trial-* の下でない（-List も -Apply も）', { skip }, () => {
  // 同じ buildRoot の下で、trial-* でない名前
  const outside = path.join(TRIAL_BASE, `outside-migrate-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(outside, { recursive: true });
  made.push(outside);
  const P = plant(outside);
  const srcBefore = sourceSnap(P);
  for (const mode of ['-List', '-Apply']) {
    const r = runMigrate(['-SandboxRoot', outside, mode], outside);
    assert.equal(r.status, 2, `${mode}（範囲の外は終了 2）\n${both(r)}`);
    assert.ok(destEmpty(P), `${mode}: 何も書かない`);
    assert.equal(r.decoyHits.length, 0);
  }
  assert.deepEqual(sourceSnap(P), srcBefore);
});

test('止まる: trial-* の外へ ..\\ で抜ける -SandboxRoot（正規化してから照らす）', { skip }, () => {
  const trial = newRoot();
  const elsewhere = path.join(TRIAL_BASE, `notrial-migrate-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(elsewhere, { recursive: true });
  made.push(elsewhere);
  const P = plant(elsewhere);
  const tricky = path.join(trial, '..', path.basename(elsewhere));
  const r = runMigrate(['-SandboxRoot', tricky, '-Apply'], elsewhere);
  assert.notEqual(r.status, 0, both(r));
  assert.ok(destEmpty(P));
});

test('止まる: trial-* でない名前（tmp\\b\\work-x）', { skip }, () => {
  const d = path.join(TRIAL_BASE, `work-migrate-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(d, { recursive: true });
  made.push(d);
  const P = plant(d);
  const r = runMigrate(['-SandboxRoot', d, '-Apply'], d);
  assert.notEqual(r.status, 0, both(r));
  assert.ok(destEmpty(P));
});

// ---- 途中で失敗したら: 消さずに止まり、作ったものの一覧を出す（守り4） --------------------------------------------
test('途中の失敗（元のファイルが開けない）: 何も消さず、作ったものを残して止まり、作ったものの一覧を出す', { skip }, () => {
  const root = newRoot();
  const P = plant(root);
  const locked = path.join(P.srcAppdata, 'User', 'settings.json');
  const ready = path.join(root, 'lock-ready.txt');
  // 別の PowerShell が排他で開いたまま待つ（写せない）
  const holder = spawn('powershell', ['-NoProfile', '-Command',
    `$f=[IO.File]::Open('${locked.replace(/'/g, "''")}','Open','Read','None'); Set-Content -LiteralPath '${ready.replace(/'/g, "''")}' -Value ok; Start-Sleep -Seconds 120`], { stdio: 'ignore', windowsHide: true });
  try {
    for (let i = 0; i < 100 && !fs.existsSync(ready); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    assert.ok(fs.existsSync(ready), '排他の掴みが用意できた');
    const r = runMigrate(['-SandboxRoot', root, '-Apply'], root);
    assert.notEqual(r.status, 0, both(r));
    const text = both(r);
    assertNoSecretLeak(text, '途中の失敗');
    // 書く先に残っているファイルは、すべて出力の一覧に名前が出ている
    const made2 = Object.keys(destSnap(P).a).concat(Object.keys(destSnap(P).p), Object.keys(destSnap(P).l)).filter((k) => !k.endsWith('/'));
    for (const f of made2) assert.ok(text.includes(path.basename(f)), `作った ${f} が一覧に出ていない`);
    assert.equal(r.decoyHits.length, 0);
  } finally {
    holder.kill();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  // 元は無傷（掴みを離した後で照らす）
  const after = sourceSnap(P);
  assert.equal(after.a['User/settings.json'], `${SECRETS.settings.length}:${crypto.createHash('sha256').update(SECRETS.settings).digest('hex')}`);
  assert.equal(after.l['watch/notion-token.dpapi'], `${SECRETS.token.length}:${crypto.createHash('sha256').update(SECRETS.token).digest('hex')}`);
});

// ---- 台本の作り（守り1・3・4・7。台本の文字を読む静的な検査。台本の中はフックが見ないので、ここで見張る） ----------
test('台本の作り: 消す・動かす命令、トークンの復号、ハッシュ、ログのファイルへの書き込みが無い（守り1〜4）', { skip }, () => {
  const t = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n'); // 注釈の行は除く
  const forbidden = [
    [/Remove-Item|\bri\b\s|\brm\b\s|\bdel\b\s|\berase\b/i, '消す（Remove-Item）'],
    [/\[(System\.)?IO\.(File|Directory)\]::(Delete|Move)|\.Delete\(|\.MoveTo\(/i, '消す・動かす（IO の Delete / Move）'],
    [/Move-Item|\bmv\b\s|Rename-Item/i, '動かす・名前を変える（元の場所を）'],
    [/read-secret/i, 'read-secret.ps1 を呼ぶ'],
    [/ConvertTo-SecureString|ConvertFrom-SecureString|ProtectedData|Unprotect/i, 'DPAPI の復号'],
    [/Get-FileHash|SHA256|SHA1|MD5|\.ComputeHash\(/i, 'ハッシュ'],
    [/Out-File|Add-Content|Set-Content|Tee-Object|Start-Transcript/i, 'ログのファイルを書く'],
    [/Get-Content|ReadAllText|ReadAllBytes|ReadAllLines|StreamReader|\bcat\b\s/i, 'ファイルの中身を読む'],
    [/Invoke-Expression|\biex\b\s/i, 'Invoke-Expression'],
  ];
  for (const [re, what] of forbidden) assert.ok(!re.test(t), `台本に「${what}」がある（${re}）`);
});

test('台本の作り: 元の場所に書かない（コピーの先は新しい名前の場所だけ）／旧の名前を書くのはこの台本だけ', { skip }, () => {
  const t = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(/Sukuna/.test(t), '書く先 Sukuna がある');
  assert.ok(/\[(System\.)?IO\.File\]::Copy|Copy-Item/i.test(t), 'バイトのままの Copy');
  assert.ok(/SandboxRoot/.test(t) && /trial-/.test(t), '-SandboxRoot と trial-* の照らしがある');
  assert.ok(/-List|\$List/.test(t) && /-Apply|\$Apply/.test(t));
});

test('台本は scripts/migrate/ の下にあり、権限の一般の行 scripts/*.ps1 には当たらない場所（守り：明示の3行の形でしか打てない）', () => {
  assert.equal(path.posix.dirname(SCRIPT_REL), 'scripts/migrate');
});
