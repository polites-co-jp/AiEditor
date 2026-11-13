// Shared helpers for tests/build-*.test.mjs, tests/local-config.test.mjs, tests/install-ext.test.mjs,
// tests/switch.test.mjs, tests/configure.test.mjs and tests/make-icons.test.mjs.
// Test fixtures go under a fresh folder in C:\b\ (when it exists) or the OS temp folder.
// Nothing here touches %LOCALAPPDATA%\Shuko, the Start menu or PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCRIPTS = path.join(REPO, 'scripts');

export function sandboxBase() {
  return fs.existsSync('C:\\b') ? 'C:\\b' : os.tmpdir();
}

export function makeSandbox(prefix = 'tests-build-') {
  return fs.mkdtempSync(path.join(sandboxBase(), prefix));
}

// Remove a sandbox. Directory junctions inside (named "current") are removed as links first so
// that nothing outside the sandbox can be deleted through them.
export function removeSandbox(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const walk = (d, depth) => {
    let names;
    try {
      names = fs.readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      const p = path.join(d, n);
      let st;
      try {
        st = fs.lstatSync(p);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        try {
          fs.rmdirSync(p);
        } catch {
          try {
            fs.unlinkSync(p);
          } catch {
            /* ignore */
          }
        }
      } else if (st.isDirectory() && depth < 6) {
        walk(p, depth + 1);
      }
    }
  };
  walk(dir, 0);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export function writeFile(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

export function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || k.startsWith('VSCODE_')) delete env[k];
  }
  return { ...env, ...extra };
}

export function runNode(args, { env = {}, cwd = REPO, timeout = 120000 } = {}) {
  const r = spawnSync(process.execPath, args, { cwd, env: cleanEnv(env), encoding: 'utf8', timeout });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

export function runPs(script, args = [], { env = {}, cwd = REPO, timeout = 180000 } = {}) {
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
    { cwd, env: cleanEnv(env), encoding: 'utf8', timeout },
  );
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

// Standard output holds one JSON document (possibly after warning lines). Parse from the first
// line that starts with "{".
export function parseJsonOut(stdout) {
  const i = stdout.search(/^\{/m);
  if (i < 0) throw new Error('no JSON object in output: ' + stdout.slice(0, 300));
  return JSON.parse(stdout.slice(i));
}

// A fake editor folder in the layout of an official / own build (flat: resources\app at the top).
export function makeFakeEditor(dir, { version = '1.146.0', nameShort = 'Shuko', applicationName = 'shuko', dataFolderName = '.shuko', commit = '69047191fc427f2f92828279aae1d90d8eeda7ab', nested = false, exeBytes = 'MZ' } = {}) {
  const appRoot = nested ? path.join(dir, commit.slice(0, 10)) : dir;
  const app = path.join(appRoot, 'resources', 'app');
  writeFile(path.join(dir, `${nameShort}.exe`), exeBytes);
  writeFile(path.join(dir, 'bin', `${applicationName}.cmd`), '@echo off\r\n');
  writeFile(path.join(app, 'product.json'), JSON.stringify({ nameShort, nameLong: nameShort, applicationName, dataFolderName, commit, version, licenseFileName: 'LICENSE.txt' }, null, 2));
  writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'code-oss-dev', version }, null, 2));
  writeFile(path.join(app, 'LICENSE.txt'), 'license');
  writeFile(path.join(app, 'ThirdPartyNotices.txt'), 'notices');
  return { dir, app, nameShort, applicationName };
}

export function isJunctionTo(link, target) {
  try {
    const st = fs.lstatSync(link);
    if (!st.isSymbolicLink()) return false;
    const real = fs.realpathSync(link);
    return path.resolve(real).toLowerCase() === path.resolve(target).toLowerCase();
  } catch {
    return false;
  }
}
