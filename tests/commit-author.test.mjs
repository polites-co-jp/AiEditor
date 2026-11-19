// 当て直しの記録のコミットの作者の期待（tests/build/commit-author.mjs）。改名の前の記録は古い作者、後の記録は新しい作者。
// どちらでもよいとはしない: 向きが逆なら食い違いが出る。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedAuthor, OLD_AUTHOR, NEW_AUTHOR, RENAME_CUTOFF_MS } from './build/commit-author.mjs';
import { checkApply } from './c2-check-json.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

test('expectedAuthor: 2026-11-18 0:00（日本時間）の前の記録は古い作者、後と startedAt の無い記録は新しい作者', () => {
  assert.equal(RENAME_CUTOFF_MS, Date.parse('2026-11-17T15:00:00Z'));
  assert.equal(expectedAuthor({ startedAt: '2026-11-15T02:27:09.587Z' }), OLD_AUTHOR);
  assert.equal(expectedAuthor({ startedAt: '2026-11-17T14:59:59Z' }), OLD_AUTHOR);
  assert.equal(expectedAuthor({ startedAt: '2026-11-17T15:00:00Z' }), NEW_AUTHOR);
  assert.equal(expectedAuthor({ startedAt: '2026-11-19T00:00:00Z' }), NEW_AUTHOR);
  assert.equal(expectedAuthor({}), NEW_AUTHOR);
  assert.equal(expectedAuthor({ startedAt: 'not a date' }), NEW_AUTHOR);
  assert.notEqual(OLD_AUTHOR, NEW_AUTHOR);
});

const REC = join(REPO, 'tasks', '2026-11-15-p5-c2-patch', 'trial', 'checks-verify-a.json');
test('checkApply(c2): 改名の前の実記録は古い作者で通り、新しい作者に変えると食い違う。後の日付にすると、古い作者が食い違う', { skip: existsSync(REC) ? false : '記録が無い' }, () => {
  const unitJson = readJson(join(REPO, 'removals', 'C-2-debug', 'unit.json'));
  const authorErrors = (j) => checkApply(j, unitJson).filter((e) => /の作者が/.test(e));
  const rec = readJson(REC);
  assert.ok(Date.parse(rec.startedAt) < RENAME_CUTOFF_MS);
  assert.ok(rec.commits.filter((c) => /^unit C-2-debug:/.test(c.subject)).every((c) => c.author === OLD_AUTHOR), '実記録は古い作者');
  assert.deepEqual(authorErrors(rec), []);
  const asNew = JSON.parse(JSON.stringify(rec));
  for (const c of asNew.commits) c.author = NEW_AUTHOR;
  assert.ok(authorErrors(asNew).length >= 2, '改名の前の記録に新しい作者は通らない');
  const later = JSON.parse(JSON.stringify(rec));
  later.startedAt = '2026-11-19T01:00:00Z';
  assert.ok(authorErrors(later).length >= 2, '改名の後の記録に古い作者は通らない');
  for (const c of later.commits) c.author = NEW_AUTHOR;
  assert.deepEqual(authorErrors(later), []);
});
