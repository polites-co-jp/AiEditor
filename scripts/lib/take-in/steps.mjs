// 取り込みの手順の並べ方と、手順の結果から次を決める関数（docs/06 の4節の表）。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の3節。

// 本体の手順。番号は docs/06 の4節の表のまま（8 の計測は裁定 2026-11-13 でやめた。番号は詰めない）。
export const CORE_STEPS = Object.freeze([
  Object.freeze({ n: 1, name: "prepare", title: "用意" }),
  Object.freeze({ n: 2, name: "apply", title: "当て直し" }),
  Object.freeze({ n: 3, name: "repair", title: "修理" }),
  Object.freeze({ n: 4, name: "checks", title: "適用後の検査" }),
  Object.freeze({ n: 5, name: "build", title: "ビルド" }),
  Object.freeze({ n: 6, name: "smoke", title: "スモーク" }),
  Object.freeze({ n: 7, name: "netaudit", title: "通信の監査" }),
  Object.freeze({ n: 9, name: "judge", title: "判定" }),
  Object.freeze({ n: 10, name: "record", title: "記録と書き戻し" }),
]);

// 拡張の手順（docs/06 の6節）。
export const EXT_STEPS = Object.freeze([
  Object.freeze({ n: 1, name: "fetch", title: "取得" }),
  Object.freeze({ n: 2, name: "verify", title: "検証と台帳" }),
  Object.freeze({ n: 3, name: "diff", title: "manifest とファイル一覧の差" }),
  Object.freeze({ n: 4, name: "smoke", title: "一時的な置き場所でのスモーク" }),
  Object.freeze({ n: 5, name: "judge", title: "判定" }),
  Object.freeze({ n: 6, name: "record", title: "記録と書き戻し" }),
]);

export const DEFAULT_MAX_REPAIR = 3;

export function coreStepOrder() {
  return CORE_STEPS.map((s) => s.n);
}

// 手順の名前か番号から手順を返す。無ければ null。
export function stepByName(nameOrNumber, steps = CORE_STEPS) {
  const k = String(nameOrNumber);
  return steps.find((s) => s.name === k || String(s.n) === k) || null;
}

// --from / --to から走らせる手順（両端を含む）。知らない名前と逆順は例外。
export function selectCoreSteps(from, to, steps = CORE_STEPS) {
  const i = from ? steps.findIndex((s) => s.name === from || String(s.n) === String(from)) : 0;
  const j = to ? steps.findIndex((s) => s.name === to || String(s.n) === String(to)) : steps.length - 1;
  if (i < 0) throw new Error(`知らない手順: ${from}（${steps.map((s) => s.name).join(", ")}）`);
  if (j < 0) throw new Error(`知らない手順: ${to}（${steps.map((s) => s.name).join(", ")}）`);
  if (i > j) throw new Error(`--from ${from} が --to ${to} より後ろ`);
  return steps.slice(i, j + 1);
}

// 手順 step の結果 result から次を決める。返り値:
//   'next'   次の手順へ
//   'repair' 修理（手順 3）へ。手順 3 の中で返したときは、もう1回修理する
//   'retry'  手順 2 からやり直す（修理が済んだ）
//   'hold'   止めずに次へ。判定で扱う（未分類の組み込み拡張だけ）
//   'stop'   止める
//   'done'   終わり
// result: { ok, attempt?, max?, repairable?, noRepair?, unclassifiedOnly?, typecheck? }
export function nextAction(step, result = {}) {
  const r = result && typeof result === "object" ? result : {};
  const ok = r.ok === true;
  const max = Number.isInteger(r.max) && r.max > 0 ? r.max : DEFAULT_MAX_REPAIR;
  const attempt = Number.isInteger(r.attempt) && r.attempt > 0 ? r.attempt : 0;
  switch (Number(step)) {
    case 1:
      return ok ? "next" : "stop";
    case 2:
      if (ok) return "next";
      if (r.repairable === false || r.noRepair === true) return "stop";
      return "repair";
    case 3:
      if (ok) return "retry";
      return attempt < max ? "repair" : "stop";
    case 4:
      if (ok) return "next";
      return r.unclassifiedOnly === true ? "hold" : "stop";
    case 5:
      if (ok) return "next";
      if (r.typecheck === true && r.noRepair !== true && attempt < max) return "repair";
      return "stop";
    case 6:
    case 7:
    case 9:
      return "next";
    case 10:
      return "done";
    default:
      throw new Error(`知らない手順: ${step}`);
  }
}

// checks.json（apply.mjs の出力）から手順 4 の結果を作る。
// fail → ok:false。hold で、hold の検査が unclassifiedExtensions だけ → ok:false, unclassifiedOnly:true。
export function checksOutcome(checks) {
  if (!checks || typeof checks !== "object") return { ok: false, reason: "checks.json が無い" };
  const entries = Object.entries(checks.checks || {});
  const failed = entries.filter(([, c]) => c && c.status === "fail").map(([k]) => k);
  const held = entries.filter(([, c]) => c && c.status === "hold").map(([k]) => k);
  if (checks.result === "ok" && !failed.length && !held.length) return { ok: true, failed, held };
  if (checks.result === "fail" || failed.length || checks.stoppedAt) return { ok: false, failed, held, reason: failed.length ? `通らない検査: ${failed.join(", ")}` : "当て直しが止まった" };
  const onlyUnclassified = held.length > 0 && held.every((k) => k === "unclassifiedExtensions");
  return { ok: false, failed, held, unclassifiedOnly: onlyUnclassified, reason: `保留の検査: ${held.join(", ")}` };
}
