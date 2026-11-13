// 試験用のワークスペース。実行ごとに <runDir>\ws に作る。誤りのあるファイルを置き、診断が出ることを確かめる。
// git のリポジトリにする（git の確認用）。ユーザーの git の設定は使わず、このリポジトリのローカル設定だけで済ませる。

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 1x1 の PNG
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 最小の PDF（1ページ。テキスト "smoke"）
export function minimalPdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // 4: ストリームは下で作る
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 18 Tf 20 50 Td (smoke) Tj ET';
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    const body = o === null ? `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream` : o;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

/** ファイルの内容と、補完を試す位置（0 始まりの行・桁）の定義。 */
export function fixtureFiles() {
  return {
    'ts/bad.ts': 'const n: number = "not a number";\nexport {};\n',
    'ts/complete.ts': 'const v = Math.\n',
    'py/bad.py': 'x: int = "a"\n\n\ndef f(a: int) -> str:\n    return a\n',
    'web/index.html': '<!DOCTYPE html>\n<html>\n<body>\n<di\n</body>\n</html>\n',
    'web/style.css': 'a {\n  colr: red;\n}\n\nb {\n  col\n}\n',
    'web/data.json': '{ "a": 1, }\n',
    'web/fmt.json': '{"a":1,"b":[1,2,{"c":3}]}\n',
    'docs/readme.md': '# smoke\n\nsmoke_needle\n',
    'shell/bad.sh': '#!/bin/bash\necho $1\nfoo=$(ls)\ncd $foo\n',
    'ps/bad.ps1': 'Write-Host "hello"\n$unused = 1\n',
    'data/sample.csv': 'a,b,c\n1,2,3\n4,5\n',
    '.env': 'FOO=bar\nBAZ=${F\n',
    // dotenv の拡張の比べ用（docs/07 の2.4 の4）。誤りを含む .env。拡張子・名前の付け方で言語が変わるので3通り置く
    '.env.bad': 'GOOD=1\nBAD LINE WITHOUT EQUALS\n=NOKEY\nDUP=1\nDUP=2\nUNCLOSED="abc\n',
    'bad.env': 'GOOD=1\nBAD LINE WITHOUT EQUALS\n=NOKEY\nDUP=1\nDUP=2\nUNCLOSED="abc\n',
    'web/schema.json': '{\n  "type": "object",\n  "properties": {\n    "color": { "type": "string", "enum": ["red", "green", "blue"] }\n  }\n}\n',
    'web/schema-sample.json': '{\n  "$schema": "./schema.json",\n  "color": ""\n}\n',
    'edit/replace.txt': 'replace_me\n',
    'edit/target.txt': 'before\n',
    'edit/a.txt': 'line1\nline2\n',
    'edit/b.txt': 'line1\nline2 changed\n',
    'edit/snippet.txt': '',
    'tracked.txt': 'tracked\n',
  };
}

export const COMPLETION_POSITIONS = {
  ts: { file: 'ts/complete.ts', line: 0, character: 'const v = Math.'.length, expect: 'floor' },
  html: { file: 'web/index.html', line: 3, character: 3, expect: 'div' },
  css: { file: 'web/style.css', line: 5, character: 5, expect: 'color' },
  // JSON: $schema（相対パスの schema.json）の enum が値の補完に出る。引用符の間（2行目の "" の中）
  json: { file: 'web/schema-sample.json', line: 2, character: '  "color": "'.length, expect: 'red' },
  // dotenv の拡張の比べ用（事実を報告するだけ。合否には使わない）
  env: [
    { label: 'after FOO=', file: '.env', line: 0, character: 4 },
    { label: 'inside ${F', file: '.env', line: 1, character: 'BAZ=${F'.length },
  ],
};

/** 台本が意図して書き換えるファイル（保存・置換・git の確認）。ほかのファイルが変わったら事故（置換が別のファイルに効いた、など）。 */
export const EXPECTED_CHANGES = ['edit/replace.txt', 'edit/target.txt', 'tracked.txt'];

/** ws の全ファイル（.git を除く）の期待する中身。 */
export function expectedContents() {
  const out = new Map();
  for (const [rel, text] of Object.entries(fixtureFiles())) out.set(rel, Buffer.from(text, 'utf8'));
  out.set('img/pixel.png', Buffer.from(PNG_1x1, 'base64'));
  out.set('doc/sample.pdf', Buffer.from(minimalPdf(), 'latin1'));
  return out;
}

/**
 * 実行の後に ws を fixtures と照らす。
 * 返す: { unexpected: 意図しない変更のあったファイル, missing: 無くなったファイル, changedAsExpected: 意図した変更のあったファイル }
 */
export function diffFixtures(root, allowed = EXPECTED_CHANGES) {
  const unexpected = [];
  const missing = [];
  const changedAsExpected = [];
  for (const [rel, want] of expectedContents()) {
    let got = null;
    try { got = readFileSync(join(root, rel)); } catch { /* 無い */ }
    if (got === null) { missing.push(rel); continue; }
    if (got.equals(want)) continue;
    (allowed.includes(rel) ? changedAsExpected : unexpected).push(rel);
  }
  return { unexpected, missing, changedAsExpected };
}

/** ws を作り、git のリポジトリにする。返す: { root, files, git: { ok, reason? } } */
export function createWorkspace(root, { git = true } = {}) {
  const files = fixtureFiles();
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text, 'utf8');
  }
  mkdirSync(join(root, 'img'), { recursive: true });
  writeFileSync(join(root, 'img', 'pixel.png'), Buffer.from(PNG_1x1, 'base64'));
  mkdirSync(join(root, 'doc'), { recursive: true });
  writeFileSync(join(root, 'doc', 'sample.pdf'), minimalPdf(), 'latin1');
  const result = { root, files: Object.keys(files).concat(['img/pixel.png', 'doc/sample.pdf']), git: { ok: false } };
  if (!git) return { ...result, git: { ok: false, reason: 'git を使わない設定' } };
  const run = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  const v = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (v.status !== 0) return { ...result, git: { ok: false, reason: 'git が実行できない' } };
  const steps = [
    ['init', '-q', '-b', 'main'],
    ['config', 'user.name', 'smoke'],
    ['config', 'user.email', 'smoke@example.invalid'],
    ['config', 'commit.gpgsign', 'false'],
    ['config', 'core.autocrlf', 'false'],
    ['add', '-A'],
    ['commit', '-q', '-m', 'smoke fixture'],
  ];
  for (const s of steps) {
    const r = run(s);
    if (r.status !== 0) return { ...result, git: { ok: false, reason: `git ${s[0]} が失敗: ${(r.stderr ?? '').trim()}` } };
  }
  return { ...result, git: { ok: true } };
}
