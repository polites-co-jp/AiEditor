// Tests for scripts/lib/sublime-keys.mjs, written from docs/04 section 6.2 and the contract in
// tasks/2026-11-13-p0-envs-mydist-keys/brief.md ("やること" 6).
// Run: node tests/sublime-keys.test.mjs   (Node 24 does not accept a directory for "node --test")
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertKeybindings, findConflicts } from '../scripts/lib/sublime-keys.mjs';

const clone = (o) => JSON.parse(JSON.stringify(o));
const parts = (key) => key.toLowerCase().split(/\s+/).map((chord) => chord.split('+').sort().join('+'));
const sameKey = (a, b) => JSON.stringify(parts(a)) === JSON.stringify(parts(b));

// ---- convertKeybindings (docs/04 6.2) -------------------------------------
test('convert: an item with only key keeps key, command and when', () => {
  const out = convertKeybindings([{ key: 'ctrl+d', command: 'editor.action.addSelectionToNextFindMatch', when: 'editorFocus' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 'ctrl+d');
  assert.equal(out[0].command, 'editor.action.addSelectionToNextFindMatch');
  assert.equal(out[0].when, 'editorFocus');
});

test('convert: win, when present, replaces key (the Windows key is used)', () => {
  const out = convertKeybindings([{ key: 'cmd+k', win: 'ctrl+shift+k', mac: 'cmd+k', linux: 'ctrl+k', command: 'editor.action.deleteLines' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 'ctrl+shift+k');
});

test('convert: win absent - key is used even if mac and linux are present', () => {
  const out = convertKeybindings([{ key: 'ctrl+l', mac: 'cmd+l', linux: 'ctrl+alt+l', command: 'expandLineSelection' }]);
  assert.equal(out[0].key, 'ctrl+l');
});

test('convert: the output carries no mac / linux / win fields (only the Windows key is extracted)', () => {
  const out = convertKeybindings([{ key: 'a', win: 'ctrl+b', mac: 'cmd+c', linux: 'ctrl+d', command: 'x' }]);
  assert.equal('mac' in out[0], false);
  assert.equal('linux' in out[0], false);
  assert.equal('win' in out[0], false);
});

test('convert: when is omitted from the output when the input has none', () => {
  const out = convertKeybindings([{ key: 'ctrl+d', command: 'x' }]);
  assert.ok(out[0].when === undefined);
});

test('convert: args are kept as they are', () => {
  const args = { to: 'down', by: 'line', value: 3 };
  const out = convertKeybindings([{ key: 'ctrl+alt+down', command: 'cursorMove', args }]);
  assert.deepEqual(out[0].args, args);
});

test('convert: order of the input is kept', () => {
  const input = [
    { key: 'ctrl+1', command: 'a' },
    { key: 'ctrl+2', command: 'b' },
    { key: 'ctrl+3', command: 'c' },
  ];
  assert.deepEqual(convertKeybindings(input).map((k) => k.command), ['a', 'b', 'c']);
});

test('convert: empty input gives an empty array', () => {
  assert.deepEqual(convertKeybindings([]), []);
});

test('convert: items that point to removed features (debug) are dropped', () => {
  const out = convertKeybindings([
    { key: 'f5', command: 'workbench.action.debug.start' },
    { key: 'f9', command: 'editor.debug.action.toggleBreakpoint' },
    { key: 'f10', command: 'workbench.action.debug.stepOver' },
    { key: 'ctrl+d', command: 'editor.action.addSelectionToNextFindMatch' },
  ]);
  assert.deepEqual(out.map((k) => k.command), ['editor.action.addSelectionToNextFindMatch']);
});

// Rules added by the implementer (sublime-keys.md section 3 and 4; docs/04 6.2 is silent on them).
test('convert: an item whose chosen key is "none" is dropped', () => {
  assert.deepEqual(convertKeybindings([{ key: 'none', mac: 'cmd+s', command: 'workbench.action.files.saveAll' }]), []);
});

test('convert: win "none" is dropped and does not fall back to key', () => {
  assert.deepEqual(convertKeybindings([{ win: 'none', key: 'ctrl+s', command: 'x' }]), []);
});

test('convert: the documented example { key ctrl+a, win ctrl+b, mac cmd+a } gives { key ctrl+b, command x }', () => {
  assert.deepEqual(convertKeybindings([{ key: 'ctrl+a', win: 'ctrl+b', mac: 'cmd+a', command: 'x' }]), [{ key: 'ctrl+b', command: 'x' }]);
});

// T1: keys with an unknown modifier are dropped (rule added by the implementer after the real source
// turned out to contain "ctr+shift+[" for editor.fold; leader decision 2026-11-13: drop it).
// Known modifiers: ctrl, shift, alt, meta and the aliases control, option, cmd, win, super.
for (const bad of ['ctr+shift+[', 'ctrl+shfit+a', 'ctr+k', 'fn+a', 'ctrl+foo+k', 'CTR+SHIFT+[']) {
  test(`convert: key "${bad}" (unknown modifier) is dropped`, () => {
    assert.deepEqual(convertKeybindings([{ key: bad, command: 'editor.fold' }]), []);
  });
}

test('convert: the real case - { key: "ctr+shift+[", command: "editor.fold" } is dropped, its neighbours stay in order', () => {
  const out = convertKeybindings([
    { key: 'ctrl+shift+[', command: 'before' },
    { key: 'ctr+shift+[', command: 'editor.fold' },
    { key: 'ctrl+shift+]', command: 'after' },
  ]);
  assert.deepEqual(out.map((k) => k.command), ['before', 'after']);
});

test('convert: an unknown modifier in any step of a chord drops the item', () => {
  assert.deepEqual(convertKeybindings([{ key: 'ctrl+k ctr+c', command: 'x' }]), []);
  assert.deepEqual(convertKeybindings([{ key: 'ctr+k ctrl+c', command: 'x' }]), []);
});

test('convert: the unknown-modifier check looks at the chosen Windows key (win), not at an ignored one', () => {
  assert.deepEqual(convertKeybindings([{ key: 'ctrl+a', win: 'ctr+b', command: 'x' }]), []);
  const out = convertKeybindings([{ key: 'ctr+a', win: 'ctrl+b', command: 'x' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 'ctrl+b');
});

for (const known of ['ctrl+k', 'control+k', 'shift+k', 'alt+k', 'option+k', 'meta+k', 'cmd+k', 'win+k', 'super+k', 'CMD+K', 'Control+Shift+K', 'ctrl+alt+shift+meta+k']) {
  test(`convert: key "${known}" (known modifiers and aliases) is kept`, () => {
    const out = convertKeybindings([{ key: known, command: 'x' }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].command, 'x');
  });
}

test('convert: chords of known modifiers, keys without modifiers and bracket keys are kept', () => {
  const out = convertKeybindings([
    { key: 'ctrl+k cmd+c', command: 'a' },
    { key: 'f5', command: 'b' },
    { key: 'escape', command: 'c' },
    { key: 'ctrl+[', command: 'd' },
    { key: 'ctrl+shift+pageup', command: 'e' },
  ]);
  assert.deepEqual(out.map((k) => k.command), ['a', 'b', 'c', 'd', 'e']);
});

test('convert: a kept alias key still takes part in conflict detection with the standard spelling', () => {
  const out = convertKeybindings([{ key: 'control+shift+escape', command: 'sublime.x' }]);
  const r = findConflicts(out, [{ key: 'ctrl+shift+escape', command: 'claude-vscode.editor.open' }]);
  assert.equal(r.length, 1);
});

test('convert: does not modify its input', () => {
  const input = [{ key: 'a', win: 'ctrl+b', mac: 'cmd+c', command: 'x', when: 'w' }];
  const copy = clone(input);
  convertKeybindings(input);
  assert.deepEqual(input, copy);
});

test('convert: output items are valid VS Code keybindings (non-empty key and command)', () => {
  const out = convertKeybindings([
    { key: 'ctrl+d', command: 'a' },
    { key: 'x', win: 'ctrl+e', command: 'b', when: 'editorTextFocus' },
  ]);
  for (const k of out) {
    assert.equal(typeof k.key, 'string');
    assert.ok(k.key.length > 0);
    assert.equal(typeof k.command, 'string');
    assert.ok(k.command.length > 0);
  }
});

// ---- findConflicts (brief: same normalized key, when both absent or equal) ---
test('conflicts: same key, no when on both sides is a conflict; result is { key, a, b }', () => {
  const a = [{ key: 'ctrl+escape', command: 'sublime.x' }];
  const b = [{ key: 'ctrl+escape', command: 'claude-vscode.focus' }];
  const r = findConflicts(a, b);
  assert.equal(r.length, 1);
  assert.ok(sameKey(r[0].key, 'ctrl+escape'));
  assert.equal(r[0].a.command, 'sublime.x');
  assert.equal(r[0].b.command, 'claude-vscode.focus');
});

test('conflicts: same key and the same when is a conflict', () => {
  const r = findConflicts([{ key: 'ctrl+k', command: 'a', when: 'editorTextFocus' }], [{ key: 'ctrl+k', command: 'b', when: 'editorTextFocus' }]);
  assert.equal(r.length, 1);
});

test('conflicts: same key with different when is not a conflict', () => {
  const r = findConflicts([{ key: 'ctrl+k', command: 'a', when: 'editorTextFocus' }], [{ key: 'ctrl+k', command: 'b', when: 'terminalFocus' }]);
  assert.deepEqual(r, []);
});

test('conflicts: when on one side only is not a conflict', () => {
  assert.deepEqual(findConflicts([{ key: 'ctrl+k', command: 'a', when: 'editorTextFocus' }], [{ key: 'ctrl+k', command: 'b' }]), []);
  assert.deepEqual(findConflicts([{ key: 'ctrl+k', command: 'a' }], [{ key: 'ctrl+k', command: 'b', when: 'editorTextFocus' }]), []);
});

test('conflicts: different keys are not a conflict', () => {
  assert.deepEqual(findConflicts([{ key: 'ctrl+k', command: 'a' }], [{ key: 'ctrl+j', command: 'b' }]), []);
});

test('conflicts: letter case is ignored', () => {
  const r = findConflicts([{ key: 'Ctrl+Shift+K', command: 'a' }], [{ key: 'ctrl+shift+k', command: 'b' }]);
  assert.equal(r.length, 1);
});

test('conflicts: the order of modifier keys is ignored', () => {
  const r = findConflicts([{ key: 'shift+ctrl+alt+f', command: 'a' }], [{ key: 'ctrl+alt+shift+f', command: 'b' }]);
  assert.equal(r.length, 1);
});

test('conflicts: the final key is not confused with a modifier (ctrl+k vs ctrl+shift+k)', () => {
  assert.deepEqual(findConflicts([{ key: 'ctrl+k', command: 'a' }], [{ key: 'ctrl+shift+k', command: 'b' }]), []);
});

test('conflicts: chords (two-step keys) compare step by step', () => {
  const same = findConflicts([{ key: 'ctrl+k ctrl+c', command: 'a' }], [{ key: 'ctrl+k ctrl+c', command: 'b' }]);
  assert.equal(same.length, 1);
  const normalized = findConflicts([{ key: 'Ctrl+K Ctrl+C', command: 'a' }], [{ key: 'ctrl+k ctrl+c', command: 'b' }]);
  assert.equal(normalized.length, 1);
  assert.deepEqual(findConflicts([{ key: 'ctrl+k ctrl+c', command: 'a' }], [{ key: 'ctrl+k ctrl+u', command: 'b' }]), []);
  assert.deepEqual(findConflicts([{ key: 'ctrl+k', command: 'a' }], [{ key: 'ctrl+k ctrl+c', command: 'b' }]), []);
});

test('conflicts: several pairs give several entries', () => {
  const a = [{ key: 'ctrl+1', command: 'a1' }, { key: 'ctrl+2', command: 'a2' }, { key: 'ctrl+3', command: 'a3' }];
  const b = [{ key: 'ctrl+2', command: 'b2' }, { key: 'ctrl+3', command: 'b3' }, { key: 'ctrl+4', command: 'b4' }];
  const r = findConflicts(a, b);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((c) => c.a.command).sort(), ['a2', 'a3']);
  assert.deepEqual(r.map((c) => c.b.command).sort(), ['b2', 'b3']);
});

test('conflicts: empty lists give no conflicts', () => {
  assert.deepEqual(findConflicts([], []), []);
  assert.deepEqual(findConflicts([{ key: 'a', command: 'x' }], []), []);
  assert.deepEqual(findConflicts([], [{ key: 'a', command: 'x' }]), []);
});

test('conflicts: the Claude Code default keys of docs/04 6.2 against a converted Sublime list', () => {
  const claude = [
    { key: 'ctrl+escape', command: 'claude-vscode.focus' },
    { key: 'ctrl+shift+escape', command: 'claude-vscode.editor.open' },
    { key: 'ctrl+alt+k', command: 'claude-vscode.insertAtMentioned', when: 'editorTextFocus' },
  ];
  const sublime = convertKeybindings([
    { key: 'ctrl+alt+k', command: 'some.sublime.command', when: 'editorTextFocus' },
    { key: 'ctrl+d', command: 'editor.action.addSelectionToNextFindMatch' },
  ]);
  const r = findConflicts(sublime, claude);
  assert.equal(r.length, 1);
  assert.equal(r[0].a.command, 'some.sublime.command');
});

test('conflicts: does not modify its inputs', () => {
  const a = [{ key: 'Ctrl+K', command: 'a' }];
  const b = [{ key: 'ctrl+k', command: 'b' }];
  const ac = clone(a);
  const bc = clone(b);
  findConflicts(a, b);
  assert.deepEqual(a, ac);
  assert.deepEqual(b, bc);
});
