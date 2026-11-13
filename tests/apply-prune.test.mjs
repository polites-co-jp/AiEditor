// Tests for pruneConfigurationDefaults in scripts/lib/apply/keys.mjs.
// Spec: tasks/2026-11-13-p2-apply/apply-design.md (3 and 2.6), handoff-notes.md addendum 4:
// the keys listed in checks.absentSettings of the applied units are removed from
// contributes.configurationDefaults of the copied mydist package.json.
// Run: node --test tests/apply-prune.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneConfigurationDefaults } from '../scripts/lib/apply/keys.mjs';

const manifest = () => ({
  name: 'mydist',
  contributes: {
    configurationDefaults: {
      'workbench.startupEditor': 'none',
      'terminal.integrated.suggest.enabled': false,
      'editor.minimap.enabled': false,
    },
  },
});
const unit = (id, keys) => ({ id, checks: { absentSettings: keys } });

test('prune: removes the keys listed in absentSettings; the others stay; removed is [{ key, unit }]', () => {
  const r = pruneConfigurationDefaults(manifest(), [unit('B-2', ['workbench.startupEditor']), unit('B-7', ['terminal.integrated.suggest.enabled'])]);
  assert.deepEqual(r.manifest.contributes.configurationDefaults, { 'editor.minimap.enabled': false });
  assert.deepEqual(r.removed, [
    { key: 'workbench.startupEditor', unit: 'B-2' },
    { key: 'terminal.integrated.suggest.enabled', unit: 'B-7' },
  ]);
});
test('prune: does not change its input', () => {
  const m = manifest();
  const copy = JSON.parse(JSON.stringify(m));
  const units = [unit('B-2', ['workbench.startupEditor'])];
  const ucopy = JSON.parse(JSON.stringify(units));
  pruneConfigurationDefaults(m, units);
  assert.deepEqual(m, copy);
  assert.deepEqual(units, ucopy);
});
test('prune: nothing to remove gives the same content and an empty removed', () => {
  const r = pruneConfigurationDefaults(manifest(), [unit('A-1', ['some.other.setting'])]);
  assert.deepEqual(r.manifest, manifest());
  assert.deepEqual(r.removed, []);
  assert.deepEqual(pruneConfigurationDefaults(manifest(), []).removed, []);
});
test('prune: removed follows the order of configurationDefaults; a key in two units goes to the first unit', () => {
  const r = pruneConfigurationDefaults(manifest(), [unit('B-7', ['terminal.integrated.suggest.enabled', 'workbench.startupEditor']), unit('B-2', ['workbench.startupEditor'])]);
  assert.deepEqual(r.removed.map((x) => x.key), ['workbench.startupEditor', 'terminal.integrated.suggest.enabled']);
  assert.equal(r.removed[0].unit, 'B-7');
});
test('prune: units without checks / absentSettings, and a manifest without configurationDefaults, do not fail', () => {
  assert.doesNotThrow(() => pruneConfigurationDefaults(manifest(), [{ id: 'X' }, { id: 'Y', checks: {} }]));
  const r = pruneConfigurationDefaults({ name: 'mydist' }, [unit('B-2', ['workbench.startupEditor'])]);
  assert.deepEqual(r.removed, []);
  assert.deepEqual(r.manifest, { name: 'mydist' });
});
test('prune: removing every default leaves a valid manifest (configurationDefaults is empty or absent)', () => {
  const r = pruneConfigurationDefaults(manifest(), [unit('Z', ['workbench.startupEditor', 'terminal.integrated.suggest.enabled', 'editor.minimap.enabled'])]);
  const cd = r.manifest.contributes && r.manifest.contributes.configurationDefaults;
  assert.ok(cd === undefined || Object.keys(cd).length === 0);
  assert.equal(r.removed.length, 3);
  assert.doesNotThrow(() => JSON.stringify(r.manifest));
});
test('prune: only the top-level keys of configurationDefaults are touched (a nested key of the same name stays)', () => {
  const m = { contributes: { configurationDefaults: { '[json]': { 'workbench.startupEditor': 'x' }, a: 1 } } };
  const r = pruneConfigurationDefaults(m, [unit('B-2', ['workbench.startupEditor'])]);
  assert.deepEqual(r.manifest, m);
  assert.deepEqual(r.removed, []);
});
