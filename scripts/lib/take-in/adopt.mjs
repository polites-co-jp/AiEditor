// 採ると決めた版の確定（docs/06 の8節の2、docs/02 の2・7節）の計画を立てる純粋な関数。git を動かすのは scripts/adopt.mjs。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の10節。

const LABEL_RE = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;

export function labelKind(label) {
  return /^ext-/.test(String(label)) ? "ext" : "core";
}

// opts: { label, verdict（verdict.json の中身か null）, branchExists, branch（今のブランチ名）, clean, tagExists, force,
//         records（記録をコミットするか。既定 true）, keepBranch, builderWorktree（ブランチの作業ツリー。無ければ null） }
// 返り値 { ok, code, errors, warnings, steps: [{ name, git?: [...], note? }] }
//   code: 0 = 進めてよい、1 = 誤り、4 = 判定が fail で --force が無い
export function planAdopt(opts = {}) {
  const errors = [];
  const warnings = [];
  const label = opts.label;
  if (!label || !LABEL_RE.test(label)) return { ok: false, code: 1, errors: [`ラベルの形が違う: ${label}`], warnings, steps: [] };
  const branch = `take-in/${label}`;
  if (opts.branch !== "main") errors.push(`ビルドリポジトリが main にいない（今 ${opts.branch || "不明"}）`);
  if (opts.clean === false) errors.push("ビルドリポジトリの追跡しているファイルに変更がある（先にコミットか戻す）");
  if (!opts.branchExists) errors.push(`ブランチ ${branch} が無い`);
  if (opts.tagExists) errors.push(`タグ ${label} が既にある（採った版を取り込み直すときはラベルを変える）`);
  const v = opts.verdict;
  if (!v || typeof v !== "object") errors.push(`records/take-in/${label}/verdict.json が無いか読めない（判定の前に採らない）`);
  else if (v.label && v.label !== label) errors.push(`verdict.json の label が ${v.label}`);
  let code = errors.length ? 1 : 0;
  if (!errors.length && v.verdict === "fail") {
    if (!opts.force) {
      errors.push("判定が不合格（fail）。それでも採るなら --force を付ける");
      code = 4;
    } else warnings.push("判定が不合格（fail）だが --force で採る");
  }
  if (!errors.length && v.verdict === "conditional") warnings.push(`判定は条件付き。条件: ${(v.conditions || []).join(" / ") || "（無し）"}`);
  const guard = v && v.scriptGuard && Array.isArray(v.scriptGuard.violations) ? v.scriptGuard.violations : [];
  if (guard.length) warnings.push(`判定に台本の照らし合わせの食い違いがある: ${guard.join(" / ")}`);
  if (errors.length) return { ok: false, code, errors, warnings, steps: [] };

  const kind = labelKind(label);
  const msgVerdict = `${v.verdict} / ${v.recommendation || ""}`.trim();
  const steps = [
    { name: "merge", git: ["merge", "--no-ff", "--no-edit", branch, "-m", `取り込み ${label} を採る（判定 ${msgVerdict}）`] },
  ];
  if (kind === "core") steps.push({ name: "confirm-upstream", note: "upstream.json の tag と commit がブランチのものになったことを確かめる" });
  if (opts.records !== false) {
    steps.push({ name: "commit-records", git: ["add", "--", `records/take-in/${label}`, ...(kind === "core" ? [`records/builds/${label}.json`] : [])] });
    steps.push({ name: "commit-records-commit", git: ["commit", "-m", `記録: 取り込み ${label}`, "--", `records/take-in/${label}`, ...(kind === "core" ? [`records/builds/${label}.json`] : [])] });
  }
  steps.push({ name: "tag", git: ["tag", "-a", label, "-m", `${label}: ${msgVerdict}`] });
  if (opts.builderWorktree) steps.push({ name: "remove-worktree", git: ["worktree", "remove", opts.builderWorktree] });
  if (!opts.keepBranch) steps.push({ name: "delete-branch", git: ["branch", "-d", branch] });
  steps.push({ name: "next", note: kind === "core" ? "エディタを閉じ、switch.ps1 <label> を実行する（ユーザー）" : "node scripts/install-extensions.mjs を実行し、エディタを再起動する（ユーザー）" });
  return { ok: true, code: 0, errors, warnings, steps, kind };
}
