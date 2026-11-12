// Tests for scripts/lib/lock.mjs, written from docs/04 sections 3 and 4 and the function
// contract in tasks/2026-11-13-p0-fetch-and-lock/brief.md ("やること" 5).
// Run: node tests/lock.test.mjs   (Node 24 does not accept a directory for "node --test")
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLockEntry,
  isSoaked,
  satisfiesEngine,
  compareFileLists,
  diffManifest,
  isOvsxSuccess,
  judgeChecks,
  mergeLock,
  checkPinnedTool,
} from '../scripts/lib/lock.mjs';

const HOUR = 3600 * 1000;

const goodEntry = () => ({
  id: 'anthropic.claude-code',
  version: '2.1.322',
  targetPlatform: 'win32-x64',
  source: 'open-vsx',
  download:
    'https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.vsix',
  sha256: '8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4',
  publishedAt: '2026-11-10T02:30:51Z',
  verified: true,
  engines: '^1.94.0',
});

// ---- validateLockEntry (docs/04 section 3) ----------------------------------
test('validateLockEntry: the docs/04 example is valid', () => {
  assert.deepEqual(validateLockEntry(goodEntry()), []);
});

test('validateLockEntry: targetPlatform is optional', () => {
  const e = goodEntry();
  delete e.targetPlatform;
  assert.deepEqual(validateLockEntry(e), []);
});

test('validateLockEntry: extra fields of the docs/04 form are accepted', () => {
  const e = {
    ...goodEntry(),
    sha256Source: 'https://example.invalid/x.sha256',
    signature: 'https://example.invalid/x.sigzip',
    publicKey: 'https://example.invalid/key',
    publishedBy: 'igorkofman',
    license: 'x',
    licenseSha256: 'abc',
    crossCheck: { marketplaceSameVersion: true },
    manifestDigest: { activationEvents: [] },
    verifiedAt: '2026-11-13',
    verdict: 'records/take-in/x/verdict.md',
  };
  assert.deepEqual(validateLockEntry(e), []);
});

for (const field of ['id', 'version', 'source', 'download', 'sha256', 'publishedAt', 'verified', 'engines']) {
  test(`validateLockEntry: missing required field "${field}" is reported`, () => {
    const e = goodEntry();
    delete e[field];
    const errors = validateLockEntry(e);
    assert.ok(Array.isArray(errors));
    assert.ok(errors.length >= 1, `expected an error for missing ${field}`);
    assert.ok(errors.every((s) => typeof s === 'string'));
  });
}

for (const [label, value] of [
  ['uppercase hex', '8C0B09C6AEFBCA3196BCFE87E33B4E531CAB3C13B2D9FD43A441562C74C5E4A4'],
  ['63 digits', '8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a'],
  ['65 digits', '8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4a'],
  ['non-hex character', 'zc0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4'],
  ['empty', ''],
  ['with sha256: prefix', 'sha256:8c0b09c6aefbca3196bcfe87e33b4e531cab3c13b2d9fd43a441562c74c5e4a4'],
]) {
  test(`validateLockEntry: bad sha256 (${label}) is reported`, () => {
    const e = goodEntry();
    e.sha256 = value;
    assert.ok(validateLockEntry(e).length >= 1);
  });
}

for (const bad of ['yesterday', '2026-13-45T00:00:00Z', '', '2026/11/10 02:30']) {
  test(`validateLockEntry: bad publishedAt "${bad}" is reported`, () => {
    const e = goodEntry();
    e.publishedAt = bad;
    assert.ok(validateLockEntry(e).length >= 1);
  });
}

test('validateLockEntry: publishedAt with a millisecond part and an offset is valid ISO 8601', () => {
  const e = goodEntry();
  e.publishedAt = '2026-11-10T11:30:51.123+09:00';
  assert.deepEqual(validateLockEntry(e), []);
});

// B-4: shape errors of source, verified and engines (docs/04 section 3: "source": "open-vsx", "verified": true, "engines": "^1.94.0")
for (const [label, value] of [['a number', 42], ['empty', ''], ['null', null], ['an unknown store', 'some-random-store']]) {
  test(`validateLockEntry: bad source (${label}) is reported`, () => {
    const e = goodEntry();
    e.source = value;
    assert.ok(validateLockEntry(e).length >= 1);
  });
}

for (const [label, value] of [['the string "true"', 'true'], ['the number 1', 1], ['null', null], ['an object', {}]]) {
  test(`validateLockEntry: verified that is not a boolean (${label}) is reported`, () => {
    const e = goodEntry();
    e.verified = value;
    assert.ok(validateLockEntry(e).length >= 1);
  });
}

test('validateLockEntry: verified false is a valid shape (the entry is just not verified)', () => {
  const e = goodEntry();
  e.verified = false;
  assert.deepEqual(validateLockEntry(e), []);
});

for (const [label, value] of [['a number', 1.94], ['empty', ''], ['no version in it', 'latest'], ['an object', { vscode: '^1.94.0' }], ['null', null]]) {
  test(`validateLockEntry: bad engines (${label}) is reported`, () => {
    const e = goodEntry();
    e.engines = value;
    assert.ok(validateLockEntry(e).length >= 1);
  });
}

test('validateLockEntry: engines ">=1.94.0" is a valid shape', () => {
  const e = goodEntry();
  e.engines = '>=1.94.0';
  assert.deepEqual(validateLockEntry(e), []);
});

test('validateLockEntry: a non-object entry is rejected (errors or a throw, not a pass)', () => {
  for (const bad of [null, undefined, 'x', 42]) {
    let result;
    try {
      result = validateLockEntry(bad);
    } catch {
      continue;
    }
    assert.ok(Array.isArray(result) && result.length >= 1, `entry ${String(bad)} must not be valid`);
  }
});

test('validateLockEntry: several faults give several messages', () => {
  const e = goodEntry();
  delete e.id;
  e.sha256 = 'short';
  assert.ok(validateLockEntry(e).length >= 2);
});

test('validateLockEntry: does not modify its argument', () => {
  const e = goodEntry();
  const copy = JSON.parse(JSON.stringify(e));
  validateLockEntry(e);
  assert.deepEqual(e, copy);
});

// ---- isSoaked (docs/04 section 4, item 4: 72 hours) -------------------------
const published = '2026-11-10T00:00:00Z';
const t0 = Date.parse(published);

test('isSoaked: exactly 72 hours is soaked ("72時間以上")', () => {
  assert.equal(isSoaked(published, new Date(t0 + 72 * HOUR), { security: false }), true);
});

test('isSoaked: 1 ms short of 72 hours is not soaked', () => {
  assert.equal(isSoaked(published, new Date(t0 + 72 * HOUR - 1), { security: false }), false);
});

test('isSoaked: 1 ms past 72 hours is soaked', () => {
  assert.equal(isSoaked(published, new Date(t0 + 72 * HOUR + 1), { security: false }), true);
});

test('isSoaked: just published is not soaked; one day is not soaked; ten days is soaked', () => {
  assert.equal(isSoaked(published, new Date(t0), { security: false }), false);
  assert.equal(isSoaked(published, new Date(t0 + 24 * HOUR), { security: false }), false);
  assert.equal(isSoaked(published, new Date(t0 + 240 * HOUR), { security: false }), true);
});

test('isSoaked: a security fix is always soaked, even before publication time', () => {
  assert.equal(isSoaked(published, new Date(t0), { security: true }), true);
  assert.equal(isSoaked(published, new Date(t0 + HOUR), { security: true }), true);
  assert.equal(isSoaked(published, new Date(t0 - HOUR), { security: true }), true);
});

test('isSoaked: the options argument may be left out (treated as not a security fix)', () => {
  assert.equal(isSoaked(published, new Date(t0 + HOUR)), false);
  assert.equal(isSoaked(published, new Date(t0 + 100 * HOUR)), true);
});

test('isSoaked: publishedAt with an offset is compared as an instant', () => {
  // 2026-11-10T09:00:00+09:00 == 2026-11-10T00:00:00Z
  assert.equal(isSoaked('2026-11-10T09:00:00+09:00', new Date(t0 + 72 * HOUR - 1), { security: false }), false);
  assert.equal(isSoaked('2026-11-10T09:00:00+09:00', new Date(t0 + 72 * HOUR), { security: false }), true);
});

// ---- satisfiesEngine (^x.y.z and >=x.y.z) -----------------------------------
test('satisfiesEngine: ^1.94.0 accepts the base version and newer 1.x', () => {
  assert.equal(satisfiesEngine('^1.94.0', '1.94.0'), true);
  assert.equal(satisfiesEngine('^1.94.0', '1.94.1'), true);
  assert.equal(satisfiesEngine('^1.94.0', '1.146.0'), true);
});

test('satisfiesEngine: ^1.94.0 rejects older and the next major', () => {
  assert.equal(satisfiesEngine('^1.94.0', '1.93.9'), false);
  assert.equal(satisfiesEngine('^1.94.0', '1.0.0'), false);
  assert.equal(satisfiesEngine('^1.94.0', '2.0.0'), false);
});

test('satisfiesEngine: versions are compared as numbers, not text (1.100 > 1.94)', () => {
  assert.equal(satisfiesEngine('^1.94.0', '1.100.0'), true);
  assert.equal(satisfiesEngine('>=1.94.0', '1.100.0'), true);
  assert.equal(satisfiesEngine('^1.100.0', '1.94.0'), false);
});

test('satisfiesEngine: >=1.94.0 boundary and above, including a next major', () => {
  assert.equal(satisfiesEngine('>=1.94.0', '1.94.0'), true);
  assert.equal(satisfiesEngine('>=1.94.0', '1.93.99'), false);
  assert.equal(satisfiesEngine('>=1.94.0', '2.0.0'), true);
});

test('satisfiesEngine: the real case - Claude Code ^1.94.0 against VS Code 1.146.0', () => {
  assert.equal(satisfiesEngine('^1.94.0', '1.146.0'), true);
});

// ---- compareFileLists (docs/04 section 4, item 6) ----------------------------
const f = (path, size) => ({ path, size });
const names = (arr) => arr.map((x) => (typeof x === 'string' ? x : x.path)).sort();

test('compareFileLists: identical lists give nothing', () => {
  const l = [f('extension/package.json', 100), f('extension/dist/extension.js', 5000)];
  const r = compareFileLists(l, l.map((x) => ({ ...x })));
  assert.deepEqual(names(r.added), []);
  assert.deepEqual(names(r.removed), []);
  assert.deepEqual(names(r.changed), []);
  assert.deepEqual(names(r.newExecutables), []);
});

test('compareFileLists: added, removed and changed (size) files', () => {
  const prev = [f('a.js', 10), f('b.js', 20), f('c.js', 30)];
  const next = [f('a.js', 10), f('b.js', 25), f('d.js', 40)];
  const r = compareFileLists(prev, next);
  assert.deepEqual(names(r.added), ['d.js']);
  assert.deepEqual(names(r.removed), ['c.js']);
  assert.deepEqual(names(r.changed), ['b.js']);
});

test('compareFileLists: a new .exe, .dll and .node are reported as new executables', () => {
  const prev = [f('extension/package.json', 100)];
  const next = [
    f('extension/package.json', 100),
    f('extension/resources/native-binary/claude.exe', 200000000),
    f('extension/lib/helper.dll', 1000),
    f('extension/build/pty.node', 2000),
    f('extension/dist/more.js', 300),
  ];
  const r = compareFileLists(prev, next);
  assert.deepEqual(names(r.newExecutables), [
    'extension/build/pty.node',
    'extension/lib/helper.dll',
    'extension/resources/native-binary/claude.exe',
  ]);
  assert.equal(names(r.added).length, 4);
});

test('compareFileLists: extension match ignores case', () => {
  const r = compareFileLists([], [f('x/HELPER.DLL', 1), f('x/Tool.EXE', 1), f('x/a.NODE', 1)]);
  assert.equal(r.newExecutables.length, 3);
});

test('compareFileLists: an executable that was already there and only changed size is not "new"', () => {
  const prev = [f('bin/claude.exe', 100)];
  const next = [f('bin/claude.exe', 200)];
  const r = compareFileLists(prev, next);
  assert.deepEqual(names(r.newExecutables), []);
  assert.deepEqual(names(r.changed), ['bin/claude.exe']);
});

test('compareFileLists: names that merely contain "exe" or "node" are not executables', () => {
  const r = compareFileLists([], [f('docs/exe.md', 1), f('node_modules/x/index.js', 1), f('a/node', 1), f('a/readme.exe.txt', 1)]);
  assert.deepEqual(names(r.newExecutables), []);
});

test('compareFileLists: a removed executable is not a new executable', () => {
  const r = compareFileLists([f('bin/old.exe', 10)], []);
  assert.deepEqual(names(r.newExecutables), []);
  assert.deepEqual(names(r.removed), ['bin/old.exe']);
});

test('compareFileLists: empty previous list - everything is added', () => {
  const r = compareFileLists([], [f('a.js', 1), f('b.exe', 2)]);
  assert.equal(r.added.length, 2);
  assert.deepEqual(names(r.newExecutables), ['b.exe']);
});

// ---- diffManifest (docs/04 section 4, item 5) --------------------------------
const baseManifest = () => ({
  name: 'claude-code',
  version: '2.1.322',
  description: 'A',
  engines: { vscode: '^1.94.0' },
  main: './dist/extension.js',
  activationEvents: ['onStartupFinished', 'onWebviewPanel:claudeVSCodePanel'],
  extensionDependencies: [],
  enabledApiProposals: [],
  capabilities: { untrustedWorkspaces: { supported: false } },
  contributes: {
    commands: [{ command: 'claude.a', title: 'A' }],
    keybindings: [{ command: 'claude.a', key: 'ctrl+escape' }],
  },
});
const clone = (o) => JSON.parse(JSON.stringify(o));
const hasName = (diff, name) => diff.some((d) => String(d).includes(name));

test('diffManifest: identical manifests give an empty array', () => {
  assert.deepEqual(diffManifest(baseManifest(), baseManifest()), []);
});

test('diffManifest: version, description and ordinary fields are not watched', () => {
  const next = baseManifest();
  next.version = '2.1.323';
  next.description = 'B';
  assert.deepEqual(diffManifest(baseManifest(), next), []);
});

test('diffManifest: activationEvents change is reported by name', () => {
  const next = baseManifest();
  next.activationEvents.push('*');
  const d = diffManifest(baseManifest(), next);
  assert.ok(hasName(d, 'activationEvents'), JSON.stringify(d));
});

test('diffManifest: engines, main, extensionDependencies, enabledApiProposals, capabilities', () => {
  const cases = [
    ['engines', (m) => { m.engines.vscode = '^1.100.0'; }],
    ['main', (m) => { m.main = './dist/other.js'; }],
    ['extensionDependencies', (m) => { m.extensionDependencies.push('ms-python.python'); }],
    ['enabledApiProposals', (m) => { m.enabledApiProposals.push('chatParticipantPrivate'); }],
    ['capabilities', (m) => { m.capabilities.virtualWorkspaces = true; }],
  ];
  for (const [name, mutate] of cases) {
    const next = baseManifest();
    mutate(next);
    const d = diffManifest(baseManifest(), next);
    assert.ok(hasName(d, name), `${name}: ${JSON.stringify(d)}`);
    for (const [other] of cases) {
      if (other !== name) assert.ok(!hasName(d, other), `${name} change must not report ${other}`);
    }
  }
});

test('diffManifest: a new "main" where there was none is reported', () => {
  const prev = baseManifest();
  delete prev.main;
  assert.ok(hasName(diffManifest(prev, baseManifest()), 'main'));
});

for (const key of [
  'chatParticipants',
  'languageModelTools',
  'languageModelChatProviders',
  'mcpServerDefinitionProviders',
  'debuggers',
  'notebooks',
]) {
  test(`diffManifest: contributes.${key} that appears is reported`, () => {
    const next = baseManifest();
    next.contributes[key] = [{ id: 'x' }];
    const d = diffManifest(baseManifest(), next);
    assert.ok(hasName(d, key), `${key}: ${JSON.stringify(d)}`);
  });

  test(`diffManifest: contributes.${key} that grows is reported; unchanged is not`, () => {
    const prev = baseManifest();
    prev.contributes[key] = [{ id: 'x' }];
    const same = clone(prev);
    assert.ok(!hasName(diffManifest(prev, same), key));
    const grown = clone(prev);
    grown.contributes[key].push({ id: 'y' });
    assert.ok(hasName(diffManifest(prev, grown), key));
  });
}

test('diffManifest: an added chatParticipants is reported even when nothing else changes', () => {
  const next = baseManifest();
  next.contributes.chatParticipants = [{ id: 'claude', name: 'claude' }];
  const d = diffManifest(baseManifest(), next);
  assert.ok(d.length >= 1);
  assert.ok(hasName(d, 'chatParticipants'));
});

test('diffManifest: does not modify its arguments', () => {
  const a = baseManifest();
  const b = baseManifest();
  b.activationEvents.push('*');
  const ac = clone(a);
  const bc = clone(b);
  diffManifest(a, b);
  assert.deepEqual(a, ac);
  assert.deepEqual(b, bc);
});

// ---- O-3: functions added later (tasks/2026-11-13-p0-fetch-and-lock/handoff-notes.md) ----

// isOvsxSuccess(exitCode, stdout): true only for exit code 0 and "Signature is valid." not preceded by a letter
test('isOvsxSuccess: the real ovsx output with exit code 0 passes', () => {
  assert.equal(isOvsxSuccess(0, '✅  Signature is valid.'), true);
  assert.equal(isOvsxSuccess(0, 'Signature is valid.'), true);
  assert.equal(isOvsxSuccess(0, 'some line\nSignature is valid.\n'), true);
});

test('isOvsxSuccess: "invalid" does not pass (the old /valid/i bug)', () => {
  assert.equal(isOvsxSuccess(0, 'Signature is invalid.'), false);
  assert.equal(isOvsxSuccess(0, '❌  Signature is invalid.'), false);
});

test('isOvsxSuccess: a non-zero exit code never passes, even with the valid text', () => {
  assert.equal(isOvsxSuccess(1, 'Signature is valid.'), false);
  assert.equal(isOvsxSuccess(2, 'Signature is valid.'), false);
  assert.equal(isOvsxSuccess(null, 'Signature is valid.'), false);
  assert.equal(isOvsxSuccess(undefined, 'Signature is valid.'), false);
});

test('isOvsxSuccess: empty, missing or non-string output does not pass', () => {
  assert.equal(isOvsxSuccess(0, ''), false);
  assert.equal(isOvsxSuccess(0, undefined), false);
  assert.equal(isOvsxSuccess(0, null), false);
  assert.equal(isOvsxSuccess(0, 42), false);
});

test('isOvsxSuccess: a match whose preceding character is a letter does not pass', () => {
  assert.equal(isOvsxSuccess(0, 'Signature isvalid.'), false);
  assert.equal(isOvsxSuccess(0, 'xSignature is valid.'), false);
});

// judgeChecks(results, required) -> { ok, failed, skipped }, both lists in the order of "required"
test('judgeChecks: all required checks pass -> ok, nothing failed or skipped', () => {
  const r = judgeChecks({ sha256: { status: 'pass' }, ovsx: { status: 'pass' } }, ['sha256', 'ovsx']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.skipped, []);
});

test('judgeChecks: a skipped required check is not ok (A-2) and is listed in skipped, not in failed', () => {
  const r = judgeChecks({ sha256: { status: 'pass' }, ovsx: { status: 'skip' }, defender: { status: 'skip' } }, ['sha256', 'ovsx', 'defender']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.skipped, ['ovsx', 'defender']);
  assert.deepEqual(r.failed, []);
});

test('judgeChecks: fail, error, any other status, and a missing result are failed', () => {
  const r = judgeChecks({ a: { status: 'fail' }, b: { status: 'error' }, c: { status: 'weird' }, d: { status: 'pass' } }, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed, ['a', 'b', 'c', 'e']);
  assert.deepEqual(r.skipped, []);
});

test('judgeChecks: the order of "required" decides the order of the lists, not the order of the results', () => {
  const r = judgeChecks({ z: { status: 'fail' }, a: { status: 'fail' } }, ['z', 'a']);
  assert.deepEqual(r.failed, ['z', 'a']);
  const r2 = judgeChecks({ z: { status: 'fail' }, a: { status: 'fail' } }, ['a', 'z']);
  assert.deepEqual(r2.failed, ['a', 'z']);
});

test('judgeChecks: results that are not required do not matter; no required checks is ok', () => {
  assert.equal(judgeChecks({ extra: { status: 'fail' }, sha256: { status: 'pass' } }, ['sha256']).ok, true);
  assert.equal(judgeChecks({}, []).ok, true);
});

test('judgeChecks: failed and skipped together -> not ok, each in its list', () => {
  const r = judgeChecks({ a: { status: 'fail' }, b: { status: 'skip' } }, ['a', 'b']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed, ['a']);
  assert.deepEqual(r.skipped, ['b']);
});

// mergeLock(current, candidates) -> { lock, written, kept, omitted, untouched }
const idOf = (x) => (typeof x === 'string' ? x : x.id ?? (x.entry && x.entry.id));
const ids = (arr) => arr.map(idOf);
const row = (id, version) => ({ id, version });

test('mergeLock: an ok candidate is written with its new entry, replacing the current row', () => {
  const r = mergeLock([row('a.x', '1')], [{ id: 'a.x', entry: row('a.x', '2'), ok: true }]);
  assert.deepEqual(r.lock, [row('a.x', '2')]);
  assert.deepEqual(ids(r.written), ['a.x']);
  assert.deepEqual(ids(r.kept), []);
  assert.deepEqual(ids(r.omitted), []);
  assert.deepEqual(ids(r.untouched), []);
});

test('mergeLock: a failed candidate keeps the current row (A-3)', () => {
  const r = mergeLock([row('a.x', '1')], [{ id: 'a.x', entry: row('a.x', '2'), ok: false }]);
  assert.deepEqual(r.lock, [row('a.x', '1')]);
  assert.deepEqual(ids(r.kept), ['a.x']);
  assert.deepEqual(ids(r.written), []);
});

test('mergeLock: a failed candidate with no current row is left out', () => {
  const r = mergeLock([], [{ id: 'a.x', entry: row('a.x', '2'), ok: false }]);
  assert.deepEqual(r.lock, []);
  assert.deepEqual(ids(r.omitted), ['a.x']);
});

test('mergeLock: the id match ignores case (Open VSX ids differ in case)', () => {
  const r = mergeLock([row('Tomoki1207.PDF', '1')], [{ id: 'tomoki1207.pdf', entry: row('tomoki1207.pdf', '2'), ok: false }]);
  assert.deepEqual(r.lock, [row('Tomoki1207.PDF', '1')]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.omitted.length, 0);
});

test('mergeLock: current rows that are not among the candidates stay, in their order, after the candidates', () => {
  const current = [row('u.1', '1'), row('a.x', '1'), row('u.2', '1')];
  const r = mergeLock(current, [{ id: 'a.x', entry: row('a.x', '2'), ok: true }]);
  assert.deepEqual(r.lock.map((e) => e.id), ['a.x', 'u.1', 'u.2']);
  assert.deepEqual(ids(r.untouched), ['u.1', 'u.2']);
});

test('mergeLock: the order of the lock follows the candidates, then the untouched rows', () => {
  const r = mergeLock([row('b', '1'), row('a', '1')], [
    { id: 'a', entry: row('a', '2'), ok: true },
    { id: 'b', entry: row('b', '2'), ok: true },
  ]);
  assert.deepEqual(r.lock.map((e) => e.id), ['a', 'b']);
});

test('mergeLock: when ids repeat in the candidates only the first is used', () => {
  const r = mergeLock([], [
    { id: 'a', entry: row('a', 'first'), ok: true },
    { id: 'A', entry: row('A', 'second'), ok: true },
  ]);
  assert.equal(r.lock.length, 1);
  assert.equal(r.lock[0].version, 'first');
});

test('mergeLock: ok but the entry is not an object is not written (kept or omitted instead)', () => {
  const r1 = mergeLock([row('a', '1')], [{ id: 'a', entry: null, ok: true }]);
  assert.deepEqual(r1.lock, [row('a', '1')]);
  const r2 = mergeLock([], [{ id: 'a', entry: 'text', ok: true }]);
  assert.deepEqual(r2.lock, []);
});

test('mergeLock: non-object elements of current are dropped', () => {
  const r = mergeLock([row('a', '1'), null, 'x', 7], []);
  assert.deepEqual(r.lock, [row('a', '1')]);
});

test('mergeLock: the arguments are not modified', () => {
  const current = [row('a', '1'), row('u', '1')];
  const cands = [{ id: 'a', entry: row('a', '2'), ok: true }];
  const cc = clone(current);
  const kc = clone(cands);
  mergeLock(current, cands);
  assert.deepEqual(current, cc);
  assert.deepEqual(cands, kc);
});

test('mergeLock: the case from the trial - one verified row replaced, the unrelated row kept', () => {
  const current = [row('tomoki1207.pdf', '1.2.1'), row('trial.not-in-fetch', '9')];
  const r = mergeLock(current, [
    { id: 'tomoki1207.pdf', entry: row('tomoki1207.pdf', '1.2.2'), ok: true },
    { id: 'weixu.wx-vsce-dotenv', entry: row('weixu.wx-vsce-dotenv', '0.2.3'), ok: false },
  ]);
  assert.deepEqual(r.lock.map((e) => `${e.id}@${e.version}`), ['tomoki1207.pdf@1.2.2', 'trial.not-in-fetch@9']);
  assert.deepEqual(ids(r.omitted), ['weixu.wx-vsce-dotenv']);
});

// checkPinnedTool(declared, installed) -> { ok, reason }
test('checkPinnedTool: the same exact version is ok with reason null', () => {
  const r = checkPinnedTool('1.4.0', '1.4.0');
  assert.equal(r.ok, true);
  assert.equal(r.reason, null);
});

test('checkPinnedTool: a different installed version is not ok, with a reason', () => {
  const r = checkPinnedTool('1.4.0', '1.4.1');
  assert.equal(r.ok, false);
  assert.equal(typeof r.reason, 'string');
  assert.ok(r.reason.length > 0);
});

for (const bad of ['^1.4.0', '~1.4.0', '>=1.4.0', 'latest', '', '1.4', '1', '*']) {
  test(`checkPinnedTool: declared "${bad}" is not an exact x.y.z, so not ok even if installed matches`, () => {
    const r = checkPinnedTool(bad, bad === '' ? '' : '1.4.0');
    assert.equal(r.ok, false);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
    assert.equal(checkPinnedTool(bad, '1.4.0').ok, false);
  });
}

for (const missing of [null, undefined, '']) {
  test(`checkPinnedTool: installed ${JSON.stringify(missing)} (not in node_modules) is not ok`, () => {
    const r = checkPinnedTool('1.4.0', missing);
    assert.equal(r.ok, false);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
  });
}

test('checkPinnedTool: declared missing is not ok', () => {
  assert.equal(checkPinnedTool(undefined, '1.4.0').ok, false);
  assert.equal(checkPinnedTool(null, '1.4.0').ok, false);
});
