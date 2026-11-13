// Tests for the exported functions of scripts/install-extensions.mjs.
// Spec: docs/04 section 5 and 7; docs/02 section 8; build-switch-design.md section 4 (4.1).
// Run: node --test tests/install-ext.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  DAILY_DATA_FOLDERS,
  isLanguagePack,
  orderForInstall,
  vsixCachePath,
  parseListedExtensions,
  compareInstalled,
  scanJsonc,
  setArgvLocale,
  argvPathFor,
} from '../scripts/install-extensions.mjs';

const E = (id, extra = {}) => ({
  id,
  version: '1.0.0',
  targetPlatform: 'universal',
  download: `https://open-vsx.org/api/x/${id}/1.0.0/file/${id}-1.0.0.vsix`,
  ...extra,
});

test('DAILY_DATA_FOLDERS', () => {
  assert.deepEqual([...DAILY_DATA_FOLDERS], ['.vscode', '.vscode-oss', '.vscode-insiders']);
});

// ---- isLanguagePack / orderForInstall --------------------------------------------------
test('isLanguagePack: id ends with .vscode-language-pack-<alnum and ->', () => {
  assert.equal(isLanguagePack({ id: 'MS-CEINTL.vscode-language-pack-ja' }), true);
  assert.equal(isLanguagePack({ id: 'ms-ceintl.vscode-language-pack-zh-hans' }), true);
  assert.equal(isLanguagePack({ id: 'ms-ceintl.vscode-language-pack-ja.extra' }), false);
  assert.equal(isLanguagePack({ id: 'x.language-pack-ja' }), false);
  assert.equal(isLanguagePack({ id: 'anthropic.claude-code' }), false);
  assert.equal(isLanguagePack({ id: 'x.vscode-language-pack-' }), false);
});
test('orderForInstall: language packs first, each group keeps the ledger order', () => {
  const ledger = [E('a.one'), E('ms.vscode-language-pack-ja'), E('b.two'), E('ms.vscode-language-pack-fr'), E('c.three')];
  assert.deepEqual(orderForInstall(ledger).map((e) => e.id), ['ms.vscode-language-pack-ja', 'ms.vscode-language-pack-fr', 'a.one', 'b.two', 'c.three']);
});
test('orderForInstall: does not change its input; empty and no-pack cases', () => {
  const ledger = [E('a'), E('ms.vscode-language-pack-ja')];
  const copy = JSON.parse(JSON.stringify(ledger));
  orderForInstall(ledger);
  assert.deepEqual(ledger, copy);
  assert.deepEqual(orderForInstall([]), []);
  assert.deepEqual(orderForInstall([E('a'), E('b')]).map((e) => e.id), ['a', 'b']);
});

// ---- vsixCachePath ----------------------------------------------------------------------
test('vsixCachePath: <cache>\\<id>-<version>[@target]\\<last name of the download URL>', () => {
  const e = E('anthropic.claude-code', {
    version: '2.1.322',
    targetPlatform: 'win32-x64',
    download: 'https://open-vsx.org/api/Anthropic/claude-code/win32-x64/2.1.322/file/Anthropic.claude-code-2.1.322@win32-x64.vsix',
  });
  const p = vsixCachePath('C:\\b\\cache\\vsix', e);
  assert.equal(path.normalize(p).toLowerCase(), path.normalize('C:\\b\\cache\\vsix\\anthropic.claude-code-2.1.322@win32-x64\\Anthropic.claude-code-2.1.322@win32-x64.vsix').toLowerCase());
});
test('vsixCachePath: universal (or no target) gets no @target', () => {
  const e = E('ms.vscode-language-pack-ja', { version: '1.146.0', download: 'https://x/y/ms-ceintl.vscode-language-pack-ja-1.146.0.vsix' });
  const p = path.normalize(vsixCachePath('C:\\c', e)).toLowerCase();
  assert.equal(p, path.normalize('C:\\c\\ms.vscode-language-pack-ja-1.146.0\\ms-ceintl.vscode-language-pack-ja-1.146.0.vsix').toLowerCase());
  const e2 = { ...e };
  delete e2.targetPlatform;
  assert.equal(path.normalize(vsixCachePath('C:\\c', e2)).toLowerCase(), p);
});
test('vsixCachePath: no file name in the URL throws', () => {
  assert.throws(() => vsixCachePath('C:\\c', E('a.b', { download: 'https://example.com/' })));
  assert.throws(() => vsixCachePath('C:\\c', E('a.b', { download: '' })));
});

// ---- parseListedExtensions / compareInstalled -------------------------------------------
test('parseListedExtensions: only id@version lines', () => {
  const out = '(node:1) [DEP0169] DeprecationWarning: x\r\nanthropic.claude-code@2.1.322\r\n\r\nms-ceintl.vscode-language-pack-ja@1.146.0\n  \nsome noise line\nExtensions installed on x:\n';
  assert.deepEqual(parseListedExtensions(out), [
    { id: 'anthropic.claude-code', version: '2.1.322' },
    { id: 'ms-ceintl.vscode-language-pack-ja', version: '1.146.0' },
  ]);
  assert.deepEqual(parseListedExtensions(''), []);
});
test('compareInstalled: ok when the sets and versions agree; id case-insensitive', () => {
  const r = compareInstalled([{ id: 'Anthropic.Claude-Code', version: '1.0.0' }], [E('anthropic.claude-code')]);
  assert.equal(r.ok, true);
  assert.equal(r.extra.length, 0);
  assert.equal(r.missing.length, 0);
  assert.equal(r.versionMismatch.length, 0);
});
test('compareInstalled: extra, missing and versionMismatch are told apart', () => {
  const ledger = [E('a.one'), E('b.two'), E('c.three')];
  const installed = [
    { id: 'a.one', version: '1.0.0' },
    { id: 'b.two', version: '9.9.9' },
    { id: 'z.extra', version: '1.0.0' },
  ];
  const r = compareInstalled(installed, ledger);
  assert.equal(r.ok, false);
  assert.equal(r.extra.length, 1);
  assert.match(JSON.stringify(r.extra), /z\.extra/);
  assert.equal(r.missing.length, 1);
  assert.match(JSON.stringify(r.missing), /c\.three/);
  assert.equal(r.versionMismatch.length, 1);
  assert.match(JSON.stringify(r.versionMismatch), /b\.two/);
});
test('compareInstalled: both empty is ok', () => {
  assert.equal(compareInstalled([], []).ok, true);
});

// ---- scanJsonc --------------------------------------------------------------------------
test('scanJsonc: returns tokens, sees through comments and strings', () => {
  const t = scanJsonc('{\n\t// c "x": {\n\t"a": "}", /* b */ "b": [1, 2]\n}');
  assert.ok(Array.isArray(t) && t.length > 0);
  for (const k of t) assert.ok('type' in k && 'start' in k && 'end' in k);
  const s = JSON.stringify(t);
  assert.ok(s.includes('"a"') || s.includes('a'));
});
test('scanJsonc: unclosed bracket, string or comment throws', () => {
  assert.throws(() => scanJsonc('{ "a": 1'));
  assert.throws(() => scanJsonc('{ "a": "x }'));
  assert.throws(() => scanJsonc('{ /* x }'));
  assert.throws(() => scanJsonc('{ "a": [1, 2 }'));
});

// ---- setArgvLocale ----------------------------------------------------------------------
// Reads a JSONC text the way VS Code does (comments and trailing commas allowed). Own small reader so that
// the checks do not depend on scanJsonc.
function readJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 2;
    } else {
      out += c;
      i++;
    }
  }
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(out);
}

test('setArgvLocale: the four examples of the design', () => {
  assert.equal(setArgvLocale(null, 'ja'), '{\n\t"locale": "ja"\n}');
  assert.equal(setArgvLocale('{\n\t// c\n}', 'ja'), '{\n\t"locale": "ja"\n\t// c\n}');
  assert.equal(setArgvLocale('{\n\t"a": 1 // c\n}\n', 'ja'), '{\n\t"a": 1,\n\t"locale": "ja" // c\n}');
  assert.equal(setArgvLocale('{ "locale": "en" }', 'ja'), '{ "locale": "ja"\n}');
});

const ARGV_INPUTS = {
  null: null,
  'empty string': '',
  'spaces only': '   \n  ',
  '{}': '{}',
  '{ newline }': '{\n}',
  'only a comment': '{\n\t// c\n}',
  'only a block comment': '{\n\t/* c */\n}\n',
  'one key': '{\n\t"a": 1\n}',
  'one key, trailing newline': '{\n\t"a": 1\n}\n',
  'trailing comma': '{\n\t"a": 1,\n}',
  'trailing comma and comment': '{\n\t"a": 1, // keep\n}\n',
  'trailing comma, no space before brace': '{"a": 1,}',
  'locale already ja': '{\n\t"locale": "ja"\n}',
  'locale en': '{\n\t"locale": "en"\n}',
  'locale en with comment': '{\n\t// the locale\n\t"locale": "en", // c\n\t"a": 1\n}',
  CRLF: '{\r\n\t"a": 1\r\n}\r\n',
  'editor default style': '// This configuration file allows you to pass permanent command line arguments to VS Code.\n{\n\t// Enables the crash reporter.\n\t"enable-crash-reporter": true,\n\n\t// Unique id used for correlating crash reports\n\t"crash-reporter-id": "00000000-0000-0000-0000-000000000000"\n}\n',
  'comment after the closing brace': '{\n\t"a": 1\n} // end\n',
  'string containing // and braces': '{\n\t"a": "x // } {",\n\t"b": 2\n}',
  'nested object value': '{\n\t"a": { "b": [1, 2, { "c": 3 }] }\n}',
};

for (const [name, input] of Object.entries(ARGV_INPUTS)) {
  test(`setArgvLocale: "${name}" ends with \\n}, has locale ja, and keeps the other keys`, () => {
    const out = setArgvLocale(input, 'ja');
    assert.ok(out.endsWith('\n}'), JSON.stringify(out));
    // exactly one } after the last newline, nothing after it
    assert.equal(out.slice(out.lastIndexOf('\n')), '\n}');
    const obj = readJsonc(out);
    assert.equal(obj.locale, 'ja');
    // the other keys survive unchanged
    if (input && input.trim()) {
      const before = readJsonc(input.replace(/^\uFEFF/, ''));
      for (const [k, v] of Object.entries(before)) {
        if (k !== 'locale') assert.deepEqual(obj[k], v, k);
      }
    }
    // the result can be scanned again
    assert.doesNotThrow(() => scanJsonc(out));
    // idempotent
    assert.equal(setArgvLocale(out, 'ja'), out);
  });
}

test('setArgvLocale: comments are kept', () => {
  const out = setArgvLocale(ARGV_INPUTS['editor default style'], 'ja');
  assert.ok(out.includes('// This configuration file allows you'));
  assert.ok(out.includes('// Enables the crash reporter.'));
  assert.ok(out.includes('// Unique id used for correlating crash reports'));
  assert.equal(setArgvLocale('{\n\t"a": 1, // keep\n}\n', 'ja').includes('// keep'), true);
});
test('setArgvLocale: an existing locale is replaced, not duplicated', () => {
  const out = setArgvLocale('{\n\t"locale": "en"\n}', 'ja');
  assert.equal((out.match(/"locale"/g) || []).length, 1);
  assert.equal(readJsonc(out).locale, 'ja');
});
test('setArgvLocale: other locale values', () => {
  assert.equal(readJsonc(setArgvLocale(null, 'zh-cn')).locale, 'zh-cn');
});
test('setArgvLocale: top level not an object throws', () => {
  assert.throws(() => setArgvLocale('[]', 'ja'));
  assert.throws(() => setArgvLocale('"x"', 'ja'));
  assert.throws(() => setArgvLocale('5', 'ja'));
});
for (const [label, v] of [['number', '5'], ['null', 'null'], ['object', '{"a": 1}'], ['boolean', 'true'], ['array', '[]']]) {
  test(`setArgvLocale: an existing locale whose value is ${label} throws (design 4.1)`, () => {
    assert.throws(() => setArgvLocale(`{"locale": ${v}}`, 'ja'));
  });
}
test('setArgvLocale: a locale of the wrong form throws', () => {
  assert.throws(() => setArgvLocale(null, ''));
  assert.throws(() => setArgvLocale(null, 'ja ja'));
  assert.throws(() => setArgvLocale(null, 'ja"x'));
});
test('setArgvLocale: broken text (unclosed) throws', () => {
  assert.throws(() => setArgvLocale('{ "a": 1', 'ja'));
});

// ---- argvPathFor ------------------------------------------------------------------------
test('argvPathFor: --argv wins, then --portable, then %USERPROFILE%\\<dataFolderName>', () => {
  const env = { USERPROFILE: 'C:\\Users\\t' };
  assert.equal(path.normalize(argvPathFor({ argv: 'D:\\x\\argv.json', portable: 'D:\\p', dataFolderName: '.shuko', env })).toLowerCase(), path.normalize('D:\\x\\argv.json').toLowerCase());
  const p = path.normalize(argvPathFor({ portable: 'D:\\p', dataFolderName: '.shuko', env })).toLowerCase();
  assert.ok(p.startsWith(path.normalize('D:\\p').toLowerCase()) && p.endsWith('argv.json'), p);
  assert.equal(path.normalize(argvPathFor({ dataFolderName: '.shuko', env })).toLowerCase(), path.normalize('C:\\Users\\t\\.shuko\\argv.json').toLowerCase());
});
