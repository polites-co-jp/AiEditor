// スモークテストの共通部品（Windows 専用）。
// 仕様: docs/06 の5節、docs/07 の3.2 の1（起動の注意）、docs/03 の7節。
// 純粋な関数（引数だけで結果が決まるもの）と、プロセス・ファイルを扱う関数に分けて書く。
// 純粋な関数は tests/smoke.test.mjs が試す。

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { resolveLocalConfig } from '../../../scripts/lib/local-config.mjs';

export const SMOKE_ROOT = 'C:\\b\\smoke';
export const DEFAULT_BUILD = 'C:\\b\\p0\\vscode-1.146.0';

/**
 * VSIX のキャッシュの場所: <buildRoot>\cache\vsix（既定 C:\b\cache\vsix。docs/02 の8節）。
 * buildRoot は scripts/lib/local-config.mjs の resolveLocalConfig で読む（オプション → local.json → 既定 C:\b）。
 * vsixRoot を渡せばそれを使う（--vsix-root）。以前は C:\b\p0\vsix に固定していた。
 */
export function vsixRootFor(buildRoot) {
  return join(buildRoot, 'cache', 'vsix');
}

export function resolveVsixRoot({ vsixRoot = null, buildRoot = null, configPath, env = process.env } = {}) {
  if (vsixRoot) return resolve(vsixRoot);
  const cfg = resolveLocalConfig({ configPath, overrides: { buildRoot }, env });
  return vsixRootFor(cfg.buildRoot);
}

// ---------------------------------------------------------------------------
// 環境変数（docs/07 の3.2 の1）
// ---------------------------------------------------------------------------

// 子のプロセスから外すもの。親のエディタや Electron アプリ（VS Code のターミナル、Claude Code）が
// 設定していることがある。ELECTRON_RUN_AS_NODE=1 のままだと Code.exe が node として動き、終了コード 9 で終わる。
export const EDITOR_ENV_STRIP = /^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|VSCODE_.*)$/i;
// Claude Code から起動したときに入る、IDE 連携を狂わせうる変数（試す相手の Claude Code 拡張に漏らさない）
export const CLAUDE_ENV_STRIP = /^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_CODE_SSE_PORT|CLAUDE_CODE_IDE_.*)$/i;

/** 起動するエディタの環境変数を作る。VSCODE_PORTABLE だけを足す。元の env は書き換えない。 */
export function cleanEditorEnv(env, portable, extra = {}) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (EDITOR_ENV_STRIP.test(k) || CLAUDE_ENV_STRIP.test(k)) continue;
    out[k] = v;
  }
  if (portable) out.VSCODE_PORTABLE = portable;
  return { ...out, ...extra };
}

// ---------------------------------------------------------------------------
// パスの安全
// ---------------------------------------------------------------------------

function norm(p) {
  return resolve(p).replace(/[\\/]+$/, '').toLowerCase();
}

export function isUnder(child, parent) {
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p + sep.toLowerCase());
}

/** 普段使いのエディタのデータ（書いてはならない場所）。 */
export function dailyDataPaths(env = process.env, home = homedir()) {
  const out = [join(home, '.vscode'), join(home, '.vscode-oss')];
  if (env.APPDATA) out.push(env.APPDATA);
  return out;
}

/**
 * 書き込んでよい場所か。root の下で、普段使いのエディタのデータの下でないこと。
 * 違うときは Error を投げる。通れば絶対パスを返す。
 */
export function assertSafeWritePath(p, root = SMOKE_ROOT, env = process.env, home = homedir()) {
  const full = resolve(p);
  if (!isUnder(full, root) || norm(full) === norm(root)) {
    throw new Error(`書き込み先が ${root} の下ではない: ${full}`);
  }
  for (const bad of dailyDataPaths(env, home)) {
    if (isUnder(full, bad)) throw new Error(`普段使いのエディタのデータの下には書かない: ${full}`);
  }
  return full;
}

// ---------------------------------------------------------------------------
// 本体の場所（Resolve-P0Editor の移植）
// ---------------------------------------------------------------------------

/**
 * 展開済みの zip（版つきの配置 <root>\<commit10>\resources\app と、平らな配置 <root>\resources\app の両方）から
 * 実行ファイル・product.json などを見つける。
 */
export function resolveEditor(root) {
  if (!existsSync(root)) throw new Error(`エディタのフォルダが無い: ${root}`);
  let appDir = join(root, 'resources', 'app');
  if (!existsSync(join(appDir, 'product.json'))) {
    const cands = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(root, d.name, 'resources', 'app'))
      .filter((d) => existsSync(join(d, 'product.json')));
    if (cands.length !== 1) throw new Error(`product.json が見つからない（または複数）: ${root}`);
    appDir = cands[0];
  }
  const product = readJson(join(appDir, 'product.json'));
  const exe = join(root, `${product.nameShort}.exe`);
  if (!existsSync(exe)) throw new Error(`実行ファイルが無い: ${exe}`);
  return {
    root,
    exe,
    appDir,
    cliJs: join(appDir, 'out', 'cli.js'),
    productJson: product,
    builtinExtDir: join(appDir, 'extensions'),
    nameShort: product.nameShort,
    version: product.version,
    commit: product.commit,
    dataFolderName: product.dataFolderName,
    // ポータブルは product.json に "target" が無いことが条件
    portableOk: !Object.prototype.hasOwnProperty.call(product, 'target'),
  };
}

export function readJson(path) {
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// プロセスの木（自分が起動した PID の木だけを止める）
// ---------------------------------------------------------------------------

/** rows: { ProcessId, ParentProcessId, ... }[]。rootId とその子孫を、幅優先で返す。rootId が無ければ []。 */
export function treeFromProcesses(rows, rootId) {
  const byParent = new Map();
  let root = null;
  for (const r of rows) {
    const pp = Number(r.ParentProcessId);
    if (!byParent.has(pp)) byParent.set(pp, []);
    byParent.get(pp).push(r);
    if (Number(r.ProcessId) === rootId) root = r;
  }
  if (!root) return [];
  const out = [];
  const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const p = queue.shift();
    const id = Number(p.ProcessId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
    for (const c of byParent.get(id) ?? []) {
      // PID の使い回し: 親より前に作られた「子」は、親が終わった後に親の PID を別のプロセスが使っているだけ（別のブラウザの
      // 孤児が木に混ざった実例がある）。作成時刻が両方分かるときは、親より古い子を外す
      if (Number.isFinite(Number(c.CreatedMs)) && Number.isFinite(Number(p.CreatedMs)) && c.CreatedMs !== null && p.CreatedMs !== null
        && Number(c.CreatedMs) < Number(p.CreatedMs)) continue;
      queue.push(c);
    }
  }
  return out;
}

export function listProcesses() {
  // 読めないことがあるので数回やり直す。それでも読めなければ投げる（空を返すと「止める木が無い」と誤る）
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try { return listProcessesOnce(); } catch (e) { lastErr = e; }
  }
  throw new Error(`プロセスの一覧を読めない: ${lastErr?.message ?? lastErr}`);
}

function listProcessesOnce() {
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command',
      // 出力を UTF-8 にする。既定の OEM コードページ（日本語環境では cp932）だと、日本語のコマンドラインを持つ
      // 別のプロセスがあるだけで JSON が壊れ、台本が終了コード 2 で落ちた（2026-11-13）
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,@{n=\'CreatedMs\';e={ if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { $null } }} | ConvertTo-Json -Compress -Depth 3'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  if (r.status !== 0 || !r.stdout.trim()) throw new Error(`powershell の終了コード ${r.status}`);
  const j = JSON.parse(r.stdout.replace(/^﻿/, ''));
  return Array.isArray(j) ? j : [j];
}

/** runs\ の直下の、実行ごとの置き場所か（runs そのもの・その外・孫以下は false）。 */
export function isRunDirPath(p, runsRoot) {
  const full = resolve(p);
  return norm(resolve(full, '..')) === norm(runsRoot) && norm(full) !== norm(runsRoot);
}

/** 記録の根拠にする実行の置き場所に置く印のファイル名。ある置き場所は --keep-runs が消さない。 */
export const KEEP_MARK = '.keep';

/** 実行の置き場所の名前（<label>-<時刻>）か。パスの区切りや .. を含むものは false。 */
export function isRunDirName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+-\d{8}T\d{6}$/.test(name) && !name.includes('..');
}

/**
 * runsRoot（C:\b\smoke\runs）の直下の、名前が <label>-<時刻> の既存のフォルダにだけ、空の .keep を書く。
 * それ以外（名前の形が違う、パスを渡した、無い、フォルダでない）は投げる。既にあれば何もしない。書いたファイルのパスを返す。
 */
export function markKeep(name, runsRoot = join(SMOKE_ROOT, 'runs')) {
  if (!isRunDirName(name)) throw new Error(`置き場所の名前（<label>-<時刻>。パスは不可）を渡す: ${name}`);
  const dir = join(runsRoot, name);
  if (!isRunDirPath(dir, runsRoot)) throw new Error(`${runsRoot} の直下ではない: ${dir}`);
  let st;
  try { st = statSync(dir); } catch { throw new Error(`置き場所が無い: ${dir}`); }
  if (!st.isDirectory()) throw new Error(`フォルダではない: ${dir}`);
  const mark = join(dir, KEEP_MARK);
  if (!existsSync(mark)) writeFileSync(mark, '', { flag: 'wx' });
  return mark;
}

/** 木の根の実行ファイルが期待どおりか。expectedExe が null なら確かめない。 */
export function rootMatches(tree, expectedExe) {
  if (!expectedExe) return true;
  const root = tree[0];
  return Boolean(root && root.ExecutablePath && norm(root.ExecutablePath) === norm(expectedExe));
}

/**
 * runs\ の下の実行の置き場所の名前（<label>-<時刻>）から、消す分を選ぶ。最新の keep 個を残す。
 * 時刻は名前の最後の "-" より後ろ（20261113T124945）。読めない名前は選ばない（消さない）。
 */
export function selectPrune(names, keep) {
  const parsed = names
    .map((n) => ({ n, m: /-(\d{8}T\d{6})$/.exec(n) }))
    .filter((x) => x.m)
    .sort((a, b) => (a.m[1] < b.m[1] ? 1 : a.m[1] > b.m[1] ? -1 : 0));
  return parsed.slice(Math.max(0, keep)).map((x) => x.n);
}

/**
 * rootId とその子孫だけを止める。親（rootId）から止める（子から止めると、生きている本体が「異常終了」と記録するため）。
 * 返すのは止めようとした数。rootId の木以外には触れない。
 */
export function stopTree(rootId, expectedExe = null) {
  const tree = treeFromProcesses(listProcesses(), rootId);
  if (tree.length === 0) return 0;
  // 本体が先に終わって PID が使い回されていたら、別のプロセスを止めてしまう。実行ファイルが違えば止めない
  if (!rootMatches(tree, expectedExe)) return 0;
  // taskkill /T は木ごと止める。/PID は rootId だけを指す。
  spawnSync('taskkill.exe', ['/PID', String(rootId), '/T', '/F'], { windowsHide: true });
  return tree.length;
}

/**
 * 実行の置き場所（runDir）の名前をコマンドラインに持つエディタ（exePath）の本体プロセスを探し、その木だけを止める。
 * 台本が途中で落ちて、起動したエディタが残ったときの後始末に使う。置き場所は実行ごとに一意なので、ほかのエディタには当たらない。
 * rows を渡すとプロセス一覧を取り直さない（テスト用）。止めた木の PID の配列を返す。
 */
export function findRunRoots(rows, runDir, exePath) {
  const rd = norm(runDir);
  const ex = norm(exePath);
  const mine = rows.filter((p) => p.CommandLine && p.CommandLine.toLowerCase().includes(rd)
    && p.ExecutablePath && norm(p.ExecutablePath) === ex);
  const ids = new Set(mine.map((p) => Number(p.ProcessId)));
  return mine.filter((p) => !ids.has(Number(p.ParentProcessId))).map((p) => Number(p.ProcessId));
}

export function stopByRunDir(runDir, exePath) {
  const roots = findRunRoots(listProcesses(), runDir, exePath);
  for (const r of roots) stopTree(r, exePath);
  return roots;
}

// ---------------------------------------------------------------------------
// ログの誤りの抽出
// ---------------------------------------------------------------------------

// VS Code のログの行: 2026-11-13 06:24:32.354 [error] 本文
const VSC_LINE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) \[(trace|debug|info|warning|error)\]\s?(.*)$/;
// Chromium のログの行: [12345:6789:1113/062432.123:ERROR:CONSOLE(123)] "本文", source: file (123)
// pid:tid は付かないこともあるので省けるようにする
const CHROMIUM_LINE = /^\[(?:(\d+):(\d+):)?(\d{4}\/\d{6}\.\d+):(INFO|WARNING|ERROR|FATAL|VERBOSE\d*):(.*)$/;

/**
 * VS Code 形式のログの本文から、[error] の記録を取り出す。続きの行（スタック）は直前の記録にくっつける。
 * 返す: { time, level, message, stack: string[] }[]（level === 'error' のものだけ）
 */
export function extractErrors(text, source = '') {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = VSC_LINE.exec(line);
    if (m) {
      cur = null;
      if (m[2] === 'error') {
        cur = { source, time: m[1], level: 'error', message: m[3], stack: [] };
        out.push(cur);
      }
    } else if (cur && line.trim() !== '') {
      cur.stack.push(line);
    }
  }
  return out;
}

/** Chromium のログ（--enable-logging=file）から ERROR・FATAL の行を取り出す。開発者ツールのコンソールの error に当たる。 */
export function extractChromiumErrors(text, source = 'chromium') {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = CHROMIUM_LINE.exec(line);
    if (!m) continue;
    if (m[4] === 'ERROR' || m[4] === 'FATAL') {
      // CONSOLE(行) は renderer の console.error（開発者ツールのコンソールに出るもの）。それ以外は Chromium 自身の誤り
      const group = /^CONSOLE/.test(m[5].trim()) ? 'devtools-console' : 'chromium';
      out.push({ source, group, time: m[3], level: m[4].toLowerCase(), message: m[5].trim(), stack: [] });
    }
  }
  return out;
}

/** VS Code のログの時刻（2026-11-13 21:48:24.020。ローカル時刻）を Date にする。読めなければ null。 */
export function parseLogTime(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(String(s));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), Number((m[7] ?? '0').padEnd(3, '0').slice(0, 3)));
}

/**
 * 止め始めた時刻（cutoff）以降の誤りを分ける。プロセスを強制終了すると、子（言語サーバーなど）の
 * 「Server process exited with code 1」が拡張ホストのログに残ることがある。後始末の誤りで、動作の誤りではない。
 * 時刻が読めない誤り（Chromium のログなど）は kept に入れる。
 */
export function splitByCutoff(errors, cutoff) {
  const kept = [];
  const teardown = [];
  for (const e of errors) {
    const t = parseLogTime(e.time);
    if (t && t.getTime() >= cutoff.getTime()) teardown.push(e);
    else kept.push(e);
  }
  return { kept, teardown };
}

/** 前の版との比べのために、誤りの文面から揺れる部分（時刻・PID・ポート・作業場所・乱数）を落とす。 */
export function normalizeError(message) {
  return String(message)
    .replace(/[A-Za-z]:\\[^\s"'`)\]]+/g, '<path>')
    .replace(/file:\/\/\/[^\s"'`)\]]+/g, '<uri>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b[0-9a-f]{32,}\b/gi, '<hex>')
    .replace(/\(node:\d+\)/g, '(node:<n>)') // 4桁の PID（(node:6604)）は下の5桁以上の規則に当たらない
    .replace(/\b(pid|port|id)[ =:]\d+/gi, '$1 <n>')
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, '<time>')
    .replace(/\b\d{5,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 誤りの一覧を「出どころ|正規化した文面」の集合にする。 */
export function errorKeys(errors) {
  const keys = new Set();
  for (const e of errors) keys.add(`${e.group ?? e.source}|${normalizeError(e.message)}`);
  return keys;
}

/** 前の版（baseline の鍵の配列）に無い誤りだけを返す。 */
export function newErrors(errors, baselineKeys) {
  const base = new Set(baselineKeys);
  return errors.filter((e) => !base.has(`${e.group ?? e.source}|${normalizeError(e.message)}`));
}

/** logsDir の下の *.log を全部集め、誤りを取り出す。group はログの種類（main / renderer / exthost / ほか）。 */
export function collectLogErrors(logsDir) {
  const errors = [];
  const files = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.toLowerCase().endsWith('.log')) files.push(p);
    }
  };
  if (existsSync(logsDir)) walk(logsDir);
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    const rel = f.slice(logsDir.length + 1).replace(/\\/g, '/');
    const group = classifyLog(rel);
    for (const e of extractErrors(text, rel)) errors.push({ ...e, group });
  }
  return { errors, files: files.map((f) => f.slice(logsDir.length + 1).replace(/\\/g, '/')) };
}

/** ログの相対パスから種類を決める。拡張ホストのログと、開発者ツールに当たる renderer を分けて数える。 */
export function classifyLog(rel) {
  const r = rel.toLowerCase();
  if (/(^|\/)exthost\//.test(r) || /(^|\/)exthost\.log$/.test(r)) return 'exthost';
  if (/(^|\/)renderer\.log$/.test(r)) return 'renderer';
  if (/(^|\/)main\.log$/.test(r)) return 'main';
  if (/sharedprocess\.log$/.test(r)) return 'sharedprocess';
  return 'other';
}

// ---------------------------------------------------------------------------
// Claude Code の IDE 連携の .lock（~/.claude/ide/<port>.lock）
// ---------------------------------------------------------------------------

export function claudeIdeDir(home = homedir()) {
  return join(home, '.claude', 'ide');
}

/** 今ある .lock の名前の一覧（中身は読まない）。 */
export function snapshotLocks(dir = claudeIdeDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^\d+\.lock$/.test(n)).sort();
}

/** 前の一覧に無かったもの（このテストで増えた .lock）。 */
export function newLocks(before, after) {
  const b = new Set(before);
  return after.filter((n) => !b.has(n));
}

/**
 * .lock の中身を読む。authToken（秘密）は返さない。
 * 返す: { file, port, pid, ideName, transport, workspaceFolders, hasAuthToken } | { file, port, error }
 */
export function readLock(file) {
  const name = file.split(/[\\/]/).pop();
  const port = Number(name.replace(/\.lock$/, ''));
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    return {
      file,
      port,
      pid: j.pid ?? null,
      ideName: j.ideName ?? null,
      transport: j.transport ?? null,
      workspaceFolders: Array.isArray(j.workspaceFolders) ? j.workspaceFolders : [],
      hasAuthToken: typeof j.authToken === 'string' && j.authToken.length > 0,
    };
  } catch (e) {
    return { file, port, error: String(e.message ?? e) };
  }
}

/**
 * 増えた .lock が、起動したエディタの木のものかを決める。
 * pids: 木の PID の集合。workspaces: 開いたフォルダ。
 * pid が木に入っている、または workspaceFolders に開いたフォルダが入っていれば「自分のもの」。
 */
export function lockBelongsTo(lock, pids, workspaces) {
  if (lock.error) return false;
  const set = new Set(pids.map(Number));
  if (lock.pid != null && set.has(Number(lock.pid))) return true;
  const ws = workspaces.map(norm);
  return lock.workspaceFolders.some((w) => ws.includes(norm(String(w))));
}

/**
 * 起動の前の一覧（before）より後に増えた .lock のうち、自分のもの（pid が pids にある、または開いたフォルダが workspaces に一致）だけを消す。
 * 普段使いの Claude Code の .lock（前からあるもの、pid もフォルダも違うもの）には触れない。消したファイルの一覧を返す。
 */
export function removeOwnLocks(before, pids, workspaces, dir = claudeIdeDir()) {
  const removed = [];
  for (const n of newLocks(before, snapshotLocks(dir))) {
    const l = readLock(join(dir, n));
    if (!lockBelongsTo(l, pids, workspaces)) continue;
    try { unlinkSync(l.file); removed.push(l.file); } catch { /* 消えていた */ }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// PATH の探索（shellcheck・pwsh・git があるか）
// ---------------------------------------------------------------------------

export function findOnPath(names, env = process.env) {
  const dirs = (env.PATH ?? env.Path ?? '').split(';').filter(Boolean);
  const exts = ['.exe', '.cmd', '.bat', ''];
  for (const n of names) {
    for (const d of dirs) {
      for (const e of exts) {
        const p = join(d, n + e);
        try { if (statSync(p).isFile()) return p; } catch { /* 無い */ }
      }
    }
  }
  return null;
}

export { dirname };
