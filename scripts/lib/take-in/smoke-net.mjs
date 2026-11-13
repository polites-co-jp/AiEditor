// 手順 6（スモークと基準）と手順 7（通信の監査の一時の環境）の組み立て。純粋な関数だけ。読み込んでも何も走らない。
// docs/06 の9節（リーダーの判断 2026-11-14）:
//   - スモークの基準: 今の版の基準と比べたうえで、--prime の3回の和を <smoke>\baseline-<新しい版のラベル>.json に残す
//   - 通信の監査の環境: 新しい版の CLI で install-extensions.mjs --portable を使い、台帳の拡張を入れた一時の環境を作って
//     netaudit.ps1 -EnvDir に渡す
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の3節の手順 6・7。

import path from "node:path";

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

// netaudit.ps1 の引数。
export function netauditArgs({ script, exe, envDir, label, duration = 600, outDir, previous = null, workRoot }) {
  return [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
    "-Exe", exe, "-EnvDir", envDir, "-Label", `take-in-${label}`, "-DurationSeconds", String(duration),
    "-OutDir", outDir, "-WorkRoot", workRoot, ...(previous ? ["-Previous", previous] : []), "-Force",
  ];
}
