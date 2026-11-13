// スモークの環境の作り方。scripts/lib/p0-common.ps1 の考え方に合わせる（書き換えない）。
//   <SMOKE_ROOT>\ext\<profile>\            --extensions-dir（台帳の拡張を入れたもの。実行をまたいで使い回す）
//   <SMOKE_ROOT>\runs\<label>-<時刻>\      1回の実行の置き場所
//       user\                              VSCODE_PORTABLE（argv.json は user\argv.json）
//       user\user-data\                    ユーザーのデータ（設定は user-data\User\settings.json）
//       logs\                              --logsPath
//       ws\                                試験用のワークスペース（fixtures.mjs が作る）
// 普段使いのデータ（%APPDATA%\Code、~\.vscode、~\.vscode-oss）には触れない。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SMOKE_ROOT, assertSafeWritePath, cleanEditorEnv, readJson, resolveVsixRoot } from './common.mjs';

/** 台帳（extensions.lock.json）の id と版。 */
export function readLedger(lockPath) {
  const arr = readJson(lockPath);
  const list = Array.isArray(arr) ? arr : arr.extensions;
  return list.map((e) => ({ id: e.id, version: e.version, targetPlatform: e.targetPlatform ?? null }));
}

/**
 * 既定で入れる拡張: 台帳のとおり全部。台帳に無い拡張を試すときは、run.mjs の --ext で明示する
 * （dotenv の候補は weixu.wx-vsce-dotenv に決まり、台帳は 8 件になった。以前の「片方を除く」特例は無い）。
 */
export function defaultExtensionIds(ledger) {
  return ledger.map((e) => e.id);
}

/**
 * C:\b\p0\vsix の下から VSIX を探す。台帳の版を優先し、無ければ新しい版。
 * ファイル名: <id>-<version>[@<platform>].vsix（id の大文字小文字は問わない）。
 */
export function findVsix(id, wantVersion, root = resolveVsixRoot()) {
  const files = [];
  const rd = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []);
  for (const e of rd(root)) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.vsix')) files.push(join(root, e.name));
    if (e.isDirectory()) {
      for (const f of rd(join(root, e.name))) {
        if (f.isFile() && f.name.toLowerCase().endsWith('.vsix')) files.push(join(root, e.name, f.name));
      }
    }
  }
  const rx = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+(?:\\.\\d+)*)(?:@([A-Za-z0-9-]+))?\\.vsix$`, 'i');
  const hits = [];
  for (const f of files) {
    const name = f.split(/[\\/]/).pop();
    const m = rx.exec(name);
    if (!m) continue;
    if (m[2] && m[2] !== 'win32-x64') continue;
    hits.push({ path: f, version: m[1] });
  }
  if (hits.length === 0) throw new Error(`VSIX が無い: ${id}（${root}）`);
  if (wantVersion) {
    const w = hits.find((h) => h.version === wantVersion);
    if (!w) throw new Error(`${id} の台帳の版 ${wantVersion} の VSIX が無い（あるのは ${hits.map((h) => h.version).join(', ')}）`);
    return w;
  }
  hits.sort((a, b) => cmpVersion(b.version, a.version));
  return hits[0];
}

function cmpVersion(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * argv.json の本文。末尾は "\n}" で終わり、その後ろに何も無いこと
 * （初回の起動で、エディタが末尾の2文字を切って ",\n...\n}" を足すため。p0-common.ps1 の Write-P0Argv と同じ）。
 */
export function formatArgv(obj) {
  const keys = Object.keys(obj ?? {});
  if (keys.length === 0) return '{\n\t// scripts の台本が書いた: argv の設定は無い\n}';
  const body = keys.map((k) => `\t${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(',\n');
  return `{\n${body}\n}`;
}

/**
 * ユーザー設定。
 *  - 共通（台本が要るものだけ）: ワークスペースの信頼を切る（ダイアログが止めるため）、拡張の自動更新を切る（市場へ出ないため）。
 *  - mode 'upstream': 本家は mydist の既定を持たないので、basedpyright.importStrategy を設定に入れる（裁定 2026-11-13）。
 *  - mode 'built': 自作は mydist の既定が効くことを確かめたいので、入れない。
 */
export function buildUserSettings(mode, extra = {}) {
  const s = {
    'security.workspace.trust.enabled': false,
    'extensions.autoUpdate': false,
    'extensions.autoCheckUpdates': false,
    'telemetry.telemetryLevel': 'off',
  };
  if (mode === 'upstream') s['basedpyright.importStrategy'] = 'useBundled';
  return { ...s, ...extra };
}

export function fingerprint(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function cliEnv(portable) {
  return cleanEditorEnv(process.env, portable, { ELECTRON_RUN_AS_NODE: '1' });
}

/**
 * 拡張のフォルダを用意する。同じ内容（エディタの版・VSIX のハッシュ）なら使い回す。
 * 返す: { extDir, installed: [{id, version, vsix, ok, output}] }
 */
export function prepareExtensions({ editor, vsix, profile, rebuild = false, reuse = false, root = SMOKE_ROOT, log = () => {} }) {
  const extDir = assertSafeWritePath(join(root, 'ext', profile), root);
  const markerPath = join(extDir, '..', `${profile}.marker.json`);
  const want = {
    editor: `${editor.version}/${editor.commit}`,
    vsix: vsix.map((v) => ({ id: v.id, path: v.path, sha: sha256File(v.path) })),
  };
  const fp = fingerprint(want);
  if (!rebuild && existsSync(markerPath)) {
    const m = readJson(markerPath);
    // reuse: 印が変わっていても入れ直さない（台帳を別の担当が直している最中に走らせる）。拡張フォルダが無ければ作る
    if ((m.fingerprint === fp || reuse) && existsSync(extDir)) {
      if (m.fingerprint !== fp) log('台帳・VSIX の印が変わっているが、--reuse-ext なので入れ直さない');
      log(`拡張のフォルダを使い回す: ${extDir}`);
      return { extDir, installed: m.installed, reused: true };
    }
  }
  if (existsSync(extDir)) rmSync(extDir, { recursive: true, force: true });
  mkdirSync(extDir, { recursive: true });
  // 一時的なユーザーデータ（インストールの CLI が使う。実行の user とは別）
  const tmpPortable = assertSafeWritePath(join(root, 'ext', `${profile}.install-user`), root);
  if (existsSync(tmpPortable)) rmSync(tmpPortable, { recursive: true, force: true });
  mkdirSync(join(tmpPortable, 'user-data'), { recursive: true });
  writeFileSync(join(tmpPortable, 'argv.json'), formatArgv({}), 'utf8');
  const installed = [];
  for (const v of vsix) {
    log(`拡張を入れる: ${v.id} ${v.version}`);
    const r = spawnSync(
      editor.exe,
      [editor.cliJs, '--user-data-dir', join(tmpPortable, 'user-data'), '--extensions-dir', extDir, '--install-extension', v.path],
      { env: cliEnv(tmpPortable), encoding: 'utf8', windowsHide: true, timeout: 300000 },
    );
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/).filter((l) => l && !/DEP0169|trace-deprecation/.test(l));
    installed.push({ id: v.id, version: v.version, vsix: v.path, ok: r.status === 0 && /successfully installed/i.test(output.join('\n')), output });
  }
  rmSync(tmpPortable, { recursive: true, force: true });
  writeFileSync(markerPath, JSON.stringify({ fingerprint: fp, want, installed }, null, 2), 'utf8');
  return { extDir, installed, reused: false };
}

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** 1回の実行の置き場所を作る（portable・user-data・logs）。設定と argv を書く。 */
export function prepareRunDir({ label, mode, argv, settings, root = SMOKE_ROOT, now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  const runDir = assertSafeWritePath(join(root, 'runs', `${label}-${stamp}`), root);
  const portable = join(runDir, 'user');
  const userData = join(portable, 'user-data');
  mkdirSync(join(userData, 'User'), { recursive: true });
  mkdirSync(join(runDir, 'logs'), { recursive: true });
  writeFileSync(join(portable, 'argv.json'), formatArgv(argv), 'utf8');
  writeFileSync(join(userData, 'User', 'settings.json'), JSON.stringify(settings ?? buildUserSettings(mode), null, 2), 'utf8');
  return { runDir, portable, userData, logs: join(runDir, 'logs'), settingsPath: join(userData, 'User', 'settings.json') };
}
