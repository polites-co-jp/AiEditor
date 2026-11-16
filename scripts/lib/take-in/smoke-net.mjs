// 手順 6（スモークと基準）と手順 7（通信の監査の一時の環境）の組み立て。純粋な関数だけ。読み込んでも何も走らない。
// docs/06 の9節（リーダーの判断 2026-11-14）:
//   - スモークの基準: 今の版の基準と比べたうえで、--prime の3回の和を <smoke>\baseline-<新しい版のラベル>.json に残す
//   - 通信の監査の環境: 新しい版の CLI で install-extensions.mjs --portable を使い、台帳の拡張を入れた一時の環境を作って
//     netaudit.ps1 -EnvDir に渡す
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の3節の手順 6・7。

import path from "node:path";
import { createHash } from "node:crypto";

export const SMOKE_RUNS = 3;

// スモークの実行の引数（smoke-run.mjs）を runs 回分。1回目は --save-baseline で新しい基準を作り直し、
// 2回目からは --merge-baseline で和を取る。どの回も今の版の基準（currentBaseline）があれば --baseline で比べる。
// 返り値 [{ n, args: [...] }]（args は smoke-run.mjs のあとに続く引数）
export function smokeRunArgs({ editorDir, label, currentBaseline = null, newBaseline, runs = SMOKE_RUNS, timeout = 600, lock = null }) {
  if (!editorDir || !label || !newBaseline) throw new Error("editorDir・label・newBaseline が要る");
  const out = [];
  for (let n = 1; n <= runs; n++) {
    const args = ["--build", editorDir, "--label", `take-in-${label}-${n}`, "--mode", "built", "--prime", "--timeout", String(timeout)];
    if (lock) args.push("--lock", lock);
    if (currentBaseline) args.push("--baseline", currentBaseline);
    args.push("--save-baseline", newBaseline);
    if (n > 1) args.push("--merge-baseline");
    out.push({ n, args });
  }
  return out;
}

// 新しい版の基準のファイル（<smokeRoot>\baseline-<label>.json）。
export function newBaselinePath(smokeRoot, label) {
  return path.join(smokeRoot, `baseline-${label}.json`);
}

// スモークの各回の結果（{ n, exitCode }）と、「消えている」の検査の結果から、手順 6 の結果を作る。
//   全部の回が 0 → ok。どれかが 1（FAIL あり）→ failed。2（台本の誤り）や null（起動できない）→ error。
//   基準が保存されたか（baselineSaved）も添える。
export function summarizeSmoke(runs, { absent = null, baselineSaved = false, currentBaseline = null } = {}) {
  const list = Array.isArray(runs) ? runs : [];
  const codes = list.map((r) => r.exitCode);
  let status;
  if (!list.length) status = "skipped";
  else if (codes.some((c) => c !== 0 && c !== 1)) status = "error";
  else if (codes.some((c) => c === 1)) status = "failed";
  else status = "ok";
  if (status === "ok" && absent && absent.status === "failed") status = "failed";
  return {
    status,
    runs: list.length,
    passedRuns: codes.filter((c) => c === 0).length,
    comparedWith: currentBaseline,
    baselineSaved,
    absent: absent || { status: "skipped" },
  };
}

// 計測と監査の台本が要る設定（scripts/lib/p0-common.ps1 の P0MeasureSettings のうち、自作のビルドで要るもの）。
//   task.allowAutomaticTasks: フォルダを開いたときのタスクを確かめずに走らせる
//   security.workspace.trust.enabled=false: 信頼のダイアログで無人の実行が止まらない
//   （basedpyright.importStrategy は自作のビルドでは mydist の既定に入っている）
export const NETAUDIT_SETTINGS = Object.freeze({ "task.allowAutomaticTasks": "on", "security.workspace.trust.enabled": false });

// 通信の監査の一時の環境（netaudit.ps1 -EnvDir に渡す形。measure.ps1 の New-RunDataDir が <EnvDir>\user と <EnvDir>\ext を写す。
// user は VSCODE_PORTABLE の場所で、argv.json を中に、ユーザーのデータを user\user-data に置く。p0-env.ps1 と同じ形）。
export function netEnvLayout(envDir) {
  const user = path.join(envDir, "user");
  return {
    envDir,
    user,
    ext: path.join(envDir, "ext"),
    argv: path.join(user, "argv.json"),
    settings: path.join(user, "user-data", "User", "settings.json"),
    record: path.join(envDir, "take-in-env.json"),
  };
}

// install-extensions.mjs の引数（新しい版の CLI で、台帳の拡張を一時の環境に入れる）。
export function netEnvInstallArgs({ cli, envDir, lock, out, buildRoot = null, config = null }) {
  const L = netEnvLayout(envDir);
  return [
    "--cli", cli, "--portable", L.user, "--extensions-dir", L.ext, "--argv", L.argv, "--lock", lock, "--out", out,
    ...(buildRoot ? ["--build-root", buildRoot] : []), ...(config ? ["--config", config] : []),
  ];
}

// ---------------------------------------------------------------------------
// 通信の監査の実行のフォルダの名前の長さ（2026-11-16。検証 tasks/2026-11-15-move-off-c-verify/verification-ooka.md の指摘の1）
// ---------------------------------------------------------------------------
// netaudit.ps1 は実行のフォルダを <WorkRoot>\<Label>-netaudit に作る（New-RunDataDir）。取り込みの -Label は take-in-<ラベル>。
// その中で Electron が書く最も長いファイルは
//   <WorkRoot>\take-in-<ラベル>-netaudit\user\user-data\Code Cache\electron-preload\<64>-<64>.cache
// で、WorkRoot = <buildRoot>\audit（既定の <buildRoot> は 45 文字）のとき 248 + ラベルの文字数になる。LongPathsEnabled=0 の PC では
// 259 文字が上限なので、ラベルは 11 文字まで。曹参のスモーク（tests/smoke/lib/common.mjs の RUN_DIR_NAME_MAX）と同じく 1 文字の
// 余裕を残して 10 文字にし、長いラベルは同じ決まり（shortLabel: 先頭の (最大-3) 文字 + ラベル全体の sha1 の先頭 3 桁。使える文字は
// A-Za-z0-9._-、ほかは _）で縮める。同じラベルはいつも同じ名前になる。完全なラベルは records/take-in/<ラベル>/ の場所と take-in.json に残る。
// <buildRoot> が長くて縮めても収まらないときは、take-in.mjs が手順 7 を走らせる前（手順 1 の前）に止める（netauditPathCheck）。
export const NETAUDIT_LABEL_MAX = 10;
// 実行のフォルダより下の、最も長いファイルの部分（\user\user-data\Code Cache\electron-preload\ 44 文字 + <64>-<64>.cache 135 文字）
export const NETAUDIT_CC_TAIL_LENGTH = "\\user\\user-data\\Code Cache\\electron-preload\\".length + 64 + 1 + 64 + ".cache".length;
export const NETAUDIT_FILE_LIMIT = 259; // MAX_PATH 260 から終端の NUL を引く

// ラベルを max 文字以下にする（tests/smoke/lib/common.mjs の shortLabel と同じ決まり）。収まるときはそのまま（使えない文字だけ _）。
export function shortLabel(label, max) {
  const clean = String(label ?? "").replace(/[^A-Za-z0-9._-]/g, "_") || "x";
  if (clean.length <= max) return clean;
  const h = createHash("sha1").update(String(label)).digest("hex").slice(0, 3);
  return clean.slice(0, Math.max(0, max - 3)) + h;
}

// netaudit.ps1 に渡す -Label（take-in-<縮めたラベル>）。
export function netauditLabel(label, max = NETAUDIT_LABEL_MAX) {
  return `take-in-${shortLabel(label, max)}`;
}

// 実行のフォルダと、その中の最も長いファイルの文字数。{ label, runDir, longest, limit, ok }
export function netauditPathCheck(workRoot, label) {
  const name = netauditLabel(label);
  const runDir = path.win32.join(workRoot, `${name}-netaudit`);
  const longest = runDir.length + NETAUDIT_CC_TAIL_LENGTH;
  return { label: name, runDir, longest, limit: NETAUDIT_FILE_LIMIT, ok: longest <= NETAUDIT_FILE_LIMIT };
}

// netaudit.ps1 の引数。-Label は netauditLabel で縮めた形。
export function netauditArgs({ script, exe, envDir, label, duration = 600, outDir, previous = null, workRoot }) {
  return [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
    "-Exe", exe, "-EnvDir", envDir, "-Label", netauditLabel(label), "-DurationSeconds", String(duration),
    "-OutDir", outDir, "-WorkRoot", workRoot, ...(previous ? ["-Previous", previous] : []), "-Force",
  ];
}
