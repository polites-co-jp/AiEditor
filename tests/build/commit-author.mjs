// 当て直しの記録（apply.mjs の --checks-out）の、コミットの作者の期待。
// 改名（旧の名前 → Sukuna、2026-11-18 の裁定）の前に取った記録は古い作者（OLD_AUTHOR）、後に取った記録は sukuna-apply。
// 記録の startedAt（apply.mjs が書く）で分ける。過去の記録は直さない裁定なので、作り直さずに両方を正しく照らす。
// どちらでもよいとはしない: 前の記録に sukuna-apply、後の記録に古い作者があれば食い違い。
// startedAt が無い・読めない記録は「後」（新しい作者）として扱う（最小の手作りの記録・壊した記録が緩く通らないように）。
export const RENAME_CUTOFF_MS = Date.parse('2026-11-18T00:00:00+09:00');
export const OLD_AUTHOR = 'shu' + 'ko-apply <apply@shu' + 'ko.invalid>';
export const NEW_AUTHOR = 'sukuna-apply <apply@sukuna.invalid>';

export function expectedAuthor(record) {
  const t = Date.parse(record?.startedAt ?? '');
  return Number.isFinite(t) && t < RENAME_CUTOFF_MS ? OLD_AUTHOR : NEW_AUTHOR;
}
export const authorName = (author) => author.split(' ')[0];
