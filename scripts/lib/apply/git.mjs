// apply.mjs が使う git の呼び出し。作業ツリーの中だけで動く。
// コミットの作者・コミッターは利用者の設定に頼らず、決まった名前にする（docs/03 の5.1 の ops と edits のコミット）。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// コミットの名前（docs/03 の5.2。2026-11-14 リーダーの判断）。apply.mjs が作るコミットも、edits.patch・patches/ の作者もこれにそろえる。
export const COMMIT_NAME = "shuko-apply";
export const COMMIT_EMAIL = "apply@shuko.invalid";
export const COMMIT_IDENT = `${COMMIT_NAME} <${COMMIT_EMAIL}>`;
export const COMMIT_IDENTITY = ["-c", `user.name=${COMMIT_NAME}`, "-c", `user.email=${COMMIT_EMAIL}`];

export function git(cwd, args, { input, allowFail = true } = {}) {
  const r = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  const out = { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
  if (!allowFail && r.status !== 0) {
    throw new Error(`git ${args.join(" ")} が失敗（${r.status}）: ${out.stderr.trim() || out.stdout.trim()}`);
  }
  return out;
}

export const gitOk = (cwd, args) => git(cwd, args, { allowFail: false }).stdout;

export function head(cwd) {
  return gitOk(cwd, ["rev-parse", "HEAD"]).trim();
}

export function statusPorcelain(cwd) {
  return gitOk(cwd, ["status", "--porcelain"]).trim();
}

// git am の途中か（rebase-apply のフォルダがあるか）。
export function amInProgress(cwd) {
  const r = git(cwd, ["rev-parse", "--git-path", "rebase-apply"]);
  if (r.status !== 0) return false;
  const p = r.stdout.trim();
  return fs.existsSync(path.isAbsolute(p) ? p : path.join(cwd, p));
}

export function enableRerere(cwd) {
  gitOk(cwd, ["config", "rerere.enabled", "true"]);
  gitOk(cwd, ["config", "rerere.autoupdate", "true"]);
}

// すべての変更をステージしてコミットする。変更が無くても空のコミットを作る。返り値はコミットの SHA。
export function commitAll(cwd, message) {
  gitOk(cwd, ["add", "-A"]);
  gitOk(cwd, [...COMMIT_IDENTITY, "commit", "--no-verify", "--allow-empty", "-q", "-m", message]);
  return head(cwd);
}

export function subjectOf(cwd, rev = "HEAD") {
  return gitOk(cwd, ["log", "-1", "--format=%s", rev]).trim();
}

export function unmergedFiles(cwd) {
  return gitOk(cwd, ["diff", "--name-only", "--diff-filter=U"])
    .split(/\r?\n/)
    .filter(Boolean);
}

// パッチのファイルの全部の行が CRLF なら、チェックアウトのときに改行が変えられたものとみなす（--keep-cr を付けない）。
// 一部の行だけが CRLF なら、本家の CRLF のファイルへの変更なので --keep-cr を付ける。
export function shouldKeepCr(patchText) {
  const lines = patchText.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const cr = lines.filter((l) => l.endsWith("\r")).length;
  return cr > 0 && cr < lines.length;
}

const tail = (r) => (r.stderr + "\n" + r.stdout).trim().split(/\r?\n/).filter(Boolean).slice(-30).join("\n");

// パッチ（git format-patch の形）を git am -3 で当てる。
// 当たらなければ、rerere が解いていれば（未解決のファイルが無ければ）--continue。
// 解けなければ衝突のファイルを返し、keepConflict でなければ --abort する。
// 返り値: { applied: "ok" | "conflict", commits, subjects, conflicts, message, kept }
export function amApply(cwd, patchFile, { keepConflict = false } = {}) {
  const before = head(cwd);
  const keepCr = shouldKeepCr(fs.readFileSync(patchFile, "utf8"));
  let r = git(cwd, [...COMMIT_IDENTITY, "am", "-3", ...(keepCr ? ["--keep-cr"] : []), patchFile]);
  let guard = 0;
  while (r.status !== 0 && amInProgress(cwd) && guard++ < 50) {
    const unmerged = unmergedFiles(cwd);
    if (unmerged.length) {
      const message = tail(r);
      if (!keepConflict) git(cwd, ["am", "--abort"]);
      return { applied: "conflict", commits: [], subjects: [], conflicts: unmerged, message, kept: keepConflict };
    }
    const st = statusPorcelain(cwd);
    if (st === "") break; // 何も当たっていない（解いたものも無い）。--continue しても進まない
    r = git(cwd, [...COMMIT_IDENTITY, "am", "--continue"]);
  }
  if (r.status !== 0) {
    const message = tail(r);
    const inProgress = amInProgress(cwd);
    if (inProgress && !keepConflict) git(cwd, ["am", "--abort"]);
    return { applied: "conflict", commits: [], subjects: [], conflicts: [], message, kept: keepConflict && inProgress };
  }
  const commits = gitOk(cwd, ["rev-list", "--reverse", `${before}..HEAD`]).split(/\r?\n/).filter(Boolean);
  return { applied: "ok", commits, subjects: commits.map((c) => subjectOf(cwd, c)), conflicts: [], message: null, kept: false };
}

// ref の時点のファイルの中身。無ければ null。
export function showFile(cwd, ref, relPath) {
  const r = git(cwd, ["show", `${ref}:${relPath}`]);
  return r.status === 0 ? r.stdout : null;
}

// ref の時点の、dir の直下の項目の名前。dirsOnly なら木（フォルダ）だけ。dir が無ければ null。
export function listTree(cwd, ref, dir, { dirsOnly = false } = {}) {
  const r = git(cwd, ["ls-tree", ...(dirsOnly ? ["-d"] : []), "--name-only", ref, `${dir.replace(/\/$/, "")}/`]);
  if (r.status !== 0) return null;
  return r.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => p.split("/").pop());
}

// from..to のコミットの一覧（古い順）。各要素 { sha, subject, author, committer }（author・committer は "名前 <メール>"）。
export function listCommits(cwd, from, to = "HEAD") {
  const SEP = "\u001f";
  const out = gitOk(cwd, ["log", "--reverse", `--format=%H${SEP}%s${SEP}%an <%ae>${SEP}%cn <%ce>`, `${from}..${to}`]);
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [sha, subject, author, committer] = l.split(SEP);
      return { sha, subject, author, committer };
    });
}

export function resolveCommit(cwd, ref) {
  const r = git(cwd, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
  return r.status === 0 ? r.stdout.trim() : null;
}
