#!/usr/bin/env node
// 言語サーバー（LSP、stdio）を直に起動し、1つのファイルを開いて、返ってきた診断（publishDiagnostics）を表示する。調べ物用。
// エディタを介さずに「同梱のサーバーが診断を出すか」を確かめるためのもの。ファイルは読むだけで、書き換えない。
//
// 使い方:
//   node scripts/p0-lsp-probe.mjs --server <server.js> --file <対象のファイル> [--python <python.exe>]
//                                 [--language python] [--timeout 30]
// 出力: JSON（サーバーの window/logMessage の抜粋、診断の配列、かかった時間）。

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// file:///C:/x と file:///c%3A/x を同じものとして比べる
function sameUri(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const n = (u) => decodeURIComponent(u).toLowerCase();
  return n(a) === n(b);
}

function parseArgs(argv) {
  const o = { server: null, file: null, python: null, language: 'python', timeout: 30, stripPythonPath: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--strip-python-path') { o.stripPythonPath = true; continue; }
    const k = argv[i].replace(/^--/, '');
    if (!(k in o)) throw new Error(`知らない引数: ${argv[i]}`);
    o[k] = argv[++i];
  }
  if (!o.server || !o.file) throw new Error('--server と --file が要る');
  o.timeout = Number(o.timeout);
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const file = resolve(o.file);
  const uri = pathToFileURL(file).href;
  const text = readFileSync(file, 'utf8');
  const started = Date.now();
  // --strip-python-path: PATH から Python の場所（名前に python を含むもの）と WindowsApps（python の別名）を外し、
  // 「Python 本体が見つからない」状態でサーバーを動かす
  const env = { ...process.env };
  if (o.stripPythonPath) {
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
    env[key] = (env[key] ?? '').split(';').filter((p) => p && !/python|windowsapps/i.test(p)).join(';');
  }
  const child = spawn(process.execPath, [resolve(o.server), '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], env });
  const logs = [];
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  let nextId = 1;
  const pending = new Map();
  const send = (msg) => {
    const body = JSON.stringify({ jsonrpc: '2.0', ...msg });
    child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  };
  const request = (method, params) => new Promise((res) => {
    const id = nextId++;
    pending.set(id, res);
    send({ id, method, params });
  });

  const settingsFor = (section) => {
    const python = o.python ? { pythonPath: o.python } : {};
    const all = {
      python: { ...python, analysis: {} },
      'python.analysis': {},
      basedpyright: { importStrategy: 'useBundled', analysis: { diagnosticMode: 'openFilesOnly' } },
      'basedpyright.analysis': { diagnosticMode: 'openFilesOnly' },
    };
    return all[section] ?? null;
  };

  let resolveDiag;
  const diagDone = new Promise((r) => { resolveDiag = r; });
  const result = { server: o.server, file, python: o.python, stripPythonPath: o.stripPythonPath, diagnostics: null, logExcerpt: [], ms: null, exitCode: null };

  let buf = Buffer.alloc(0);
  child.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const sep = buf.indexOf('\r\n\r\n');
      if (sep < 0) return;
      const m = /Content-Length: (\d+)/i.exec(buf.subarray(0, sep).toString());
      if (!m) { buf = buf.subarray(sep + 4); continue; }
      const len = Number(m[1]);
      if (buf.length < sep + 4 + len) return;
      const msg = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString('utf8'));
      buf = buf.subarray(sep + 4 + len);
      if (msg.id !== undefined && msg.method === undefined) {
        const r = pending.get(msg.id);
        if (r) { pending.delete(msg.id); r(msg); }
      } else if (msg.method === 'workspace/configuration') {
        send({ id: msg.id, result: (msg.params?.items ?? []).map((it) => settingsFor(it.section)) });
      } else if (msg.id !== undefined) {
        send({ id: msg.id, result: null }); // client/registerCapability, window/workDoneProgress/create など
      } else if (msg.method === 'window/logMessage') {
        logs.push(msg.params?.message ?? '');
      } else if (msg.method === 'textDocument/publishDiagnostics' && sameUri(msg.params?.uri, uri)) {
        // 開いた直後に空の診断が来ることがあるので、空でないもの（または待ちの終わり）を採る
        result.publishCount = (result.publishCount ?? 0) + 1;
        if (msg.params.diagnostics.length === 0 && result.publishCount < 3) { result.diagnostics = []; continue; }
        result.diagnostics = msg.params.diagnostics.map((d) => ({
          line: d.range?.start?.line + 1, severity: d.severity, code: d.code, message: d.message,
        }));
        resolveDiag();
      }
    }
  });

  const timer = setTimeout(() => resolveDiag(), o.timeout * 1000);
  await request('initialize', {
    processId: process.pid,
    rootUri: null,
    workspaceFolders: null,
    capabilities: { workspace: { configuration: true }, textDocument: { publishDiagnostics: {} } },
  });
  send({ method: 'initialized', params: {} });
  send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: o.language, version: 1, text } } });
  await diagDone;
  clearTimeout(timer);
  result.ms = Date.now() - started;
  result.logExcerpt = logs.filter((l) => /python|version|interpreter|search|error|not found/i.test(l)).slice(0, 20);
  try { await Promise.race([request('shutdown', null), new Promise((r) => setTimeout(r, 3000))]); } catch { /* ignore */ }
  send({ method: 'exit' });
  setTimeout(() => child.kill(), 2000).unref();
  child.on('exit', (code) => {
    result.exitCode = code;
    if (stderr.trim()) result.stderr = stderr.trim().split(/\r?\n/).slice(0, 10);
    console.log(JSON.stringify(result, null, 2));
  });
}

main().catch((e) => {
  console.error(`p0-lsp-probe: ${e.message}`);
  process.exit(1);
});
