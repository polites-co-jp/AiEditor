// Runs every tests/*.test.mjs (one node process per file) and every tests/*.tests.ps1,
// and prints a count per file plus the names of the failing tests.
// Run: node tests/run-all.mjs [--no-ps] [--only <substring>]
// Exit code: 0 when nothing failed, 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const noPs = args.includes('--no-ps');
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1] : null;

const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();
const ps = fs.readdirSync(here).filter((f) => f.endsWith('.tests.ps1')).sort();
const rows = [];
const failures = [];

for (const f of files) {
  if (only && !f.includes(only)) continue;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join('tests', f)], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = r.stdout || '';
  const num = (k) => {
    const m = out.match(new RegExp(`^# ${k} (\\d+)`, 'm'));
    return m ? Number(m[1]) : 0;
  };
  const row = { file: f, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), cancelled: num('cancelled') };
  rows.push(row);
  for (const m of out.matchAll(/^\s*not ok \d+ - (.*)$/gm)) failures.push(`${f}: ${m[1]}`);
}

if (!noPs) {
  for (const f of ps) {
    if (only && !f.includes(only)) continue;
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join('tests', f)], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    // The PowerShell test scripts print "PASS"/"FAIL" lines and a summary; count them and keep the exit code.
    const sm = out.match(/passed:\s*(\d+)\s+failed:\s*(\d+)/i);
    const pass = sm ? Number(sm[1]) : (out.match(/^ok\s/gm) || []).length;
    const fail = sm ? Number(sm[2]) : (out.match(/^FAIL\s/gm) || []).length;
    rows.push({ file: f, tests: pass + fail, pass, fail: r.status === 0 ? fail : Math.max(fail, 1), skipped: 0, cancelled: 0, exit: r.status });
    for (const m of out.matchAll(/^FAIL\s.*$/gm)) failures.push(`${f}: ${m[0].trim()}`);
  }
}

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const lines = [];
const log = (s) => {
  console.log(s);
  lines.push(s);
};
for (const r of rows) log(`${r.file.padEnd(34)} tests ${String(r.tests).padStart(4)}  pass ${String(r.pass).padStart(4)}  fail ${String(r.fail).padStart(3)}  skip ${String(r.skipped).padStart(3)}${r.exit !== undefined ? '  exit ' + r.exit : ''}`);
log(`${'TOTAL'.padEnd(34)} tests ${String(sum('tests')).padStart(4)}  pass ${String(sum('pass')).padStart(4)}  fail ${String(sum('fail')).padStart(3)}  skip ${String(sum('skipped')).padStart(3)}`);
if (failures.length) {
  log('\nFailing:');
  for (const f of failures) log('  ' + f);
}
const si = args.indexOf('--save');
if (si >= 0 && args[si + 1]) fs.writeFileSync(args[si + 1], lines.join('\n') + '\n');
process.exit(sum('fail') > 0 ? 1 : 0);
