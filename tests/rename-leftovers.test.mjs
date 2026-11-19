// 名前の残りの検査（改名 Shuko → Sukuna。tasks/2026-11-18-rename-sukuna-survey/rename-plan.md の 4節の 2b）。
// 追跡しているファイルのうち、除く場所の外に、古い名前（大文字小文字を問わない）が残っていないこと。ファイルの名前も見る。
//
// 除く場所（brief.md の完了条件と、移行の間だけ残す理由のあるもの）:
//   - tasks/・records/・docs/・team/（過去の記録・設計資料の原本・権限とフック。docs/ は 2c でリーダーが直す）
//   - scripts/migrate/migrate-from-shuko.ps1（旧の場所を読む移行の台本）と、そのテスト
//   - scripts/measure.ps1・tests/measure.tests.ps1（日常の argv.json の一覧に、引退までは旧の .shuko も残す。2026-11-18 の裁定）
//   - このテストと使い捨ての置き換え台本（古い名前を文字として持つため）
// CLAUDE.md は説明の1行（「前の仮の名前は…」）だけを認める。.claude/ は別の検査にした（Team の開発部が直すまで落ちる）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO } from './build/helpers.mjs';

const OLD = new RegExp('shu' + 'ko', 'i');
// 追跡しているファイルに加えて、まだ追跡していない（git add 前の）ファイルも同じ扱いで見る（コミットの後に新しく落ちないように）。
// ただし、コミットに入れない使い捨て（調べ・試しの道具）は除く。.gitignore のものは見ない。
const NOT_COMMITTED = [
  'tests/probe-', 'tests/p34', 'tests/fixtures/ref-p34/', 'tests/validate-migrate-harness.mjs',
  'scripts/trial-', 'scripts/l10n-probe.mjs',
];
const tracked = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }).stdout
  .toString('utf8').split('\0').filter(Boolean)
  .filter((f) => !NOT_COMMITTED.some((p) => f.startsWith(p)));

const EXCLUDED_DIRS = ['tasks/', 'records/', 'docs/', 'team/'];
const EXCLUDED_FILES = new Set([
  'scripts/migrate/migrate-from-' + 'shu' + 'ko.ps1',
  'tests/migrate-from-' + 'shu' + 'ko.test.mjs',
  'scripts/measure.ps1',
  'tests/measure.tests.ps1',
  'tests/rename-leftovers.test.mjs',
  'tests/rename-apply-once.mjs',
]);
const LEADER_2C = (f) => f.startsWith('.claude/');
// CLAUDE.md は、前の仮の名前の説明の1行だけを認める（リーダーが「過去の記録にはその名前が残る」と説明するためにわざと残した。2026-11-18）。
// 認めるのは「前の仮の名前は」を含む1行だけ。ほかの行・2行目以降の残りは落とす。
const ALLOWED_LINES = { 'CLAUDE.md': { re: new RegExp('前の仮の名前は.*shu' + 'ko', 'i'), max: 1 } };

function scan(files) {
  const hits = [];
  for (const f of files) {
    if (OLD.test(f)) hits.push(`${f}: ファイルの名前`);
    const p = path.join(REPO, f);
    let buf;
    try {
      if (!fs.statSync(p).isFile()) continue;
      buf = fs.readFileSync(p);
    } catch {
      continue; // 作業ツリーに無い（消した）
    }
    if (buf.includes(0)) continue; // バイナリ
    const lines = buf.toString('utf8').split(/\r?\n/);
    const allow = ALLOWED_LINES[f];
    const bad = lines.filter((l) => OLD.test(l) && !(allow && allow.re.test(l)));
    const allowedCount = lines.filter((l) => OLD.test(l) && allow && allow.re.test(l)).length;
    if (allow && allowedCount > allow.max) hits.push(`${f}: 認めた説明の行が ${allowedCount} 行ある（認めるのは ${allow.max} 行まで）`);
    if (bad.length > 0) hits.push(`${f}: ${bad.length} 行（初めは ${lines.findIndex((l) => bad.includes(l)) + 1} 行目）`);
  }
  return hits;
}

test('追跡しているファイルの数を取れている（検査が空振りしていない）', () => {
  assert.ok(tracked.length > 300, `追跡ファイル ${tracked.length}`);
  assert.ok(tracked.includes('product.overlay.json'));
});

test('除く場所の外に古い名前が残っていない', () => {
  const files = tracked.filter((f) => !EXCLUDED_DIRS.some((d) => f.startsWith(d)) && !EXCLUDED_FILES.has(f) && !LEADER_2C(f));
  const hits = scan(files);
  assert.deepEqual(hits, [], `古い名前が残っている（${hits.length} ファイル）:\n${hits.join('\n')}`);
});

test('CLAUDE.md: 古い名前は「前の仮の名前は…」の説明の1行だけ', () => {
  const hits = scan(['CLAUDE.md']);
  assert.deepEqual(hits, [], `CLAUDE.md に説明の1行以外の古い名前がある:\n${hits.join('\n')}`);
});

test('リーダーの 2c の分（.claude/）に古い名前が残っていない（Team の開発部が直すまで落ちる）', () => {
  const hits = scan(tracked.filter(LEADER_2C));
  assert.deepEqual(hits, [], `古い名前が残っている:\n${hits.join('\n')}`);
});

test('除く場所の外に古い名前の環境変数・識別子が残っていない（大文字の SHUKO_ など）', () => {
  // 上の検査は大文字小文字を問わない。これは、検査の正規表現が i を落とされても気づけるようにする見張り。
  const sample = ['SHU' + 'KO_T_ROOT', 'Shu' + 'ko', 'shu' + 'ko'];
  for (const s of sample) assert.ok(OLD.test(s), s);
});
