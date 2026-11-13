// 削除の単位（docs/03 の3節）の形の検査、当てる順の決定、after の検査。純粋な関数。
//
// テストの入口（tasks/2026-11-13-p2-apply/apply-design.md の3節）:
//   normalizeRelPath(p)               → "/" 区切りの相対パスか null
//   isUnderPath(p, prefix)            → 真偽
//   validateUnit(unit, dirName)       → 誤りの文字列の配列
//   planUnits(units, { only, until }) → { plan, skipped, errors }
//   checkAfter(unit, appliedIds)      → 満たさない ID の配列

export const STAGE_ORDER_RANGES = { A: [100, 199], B: [200, 299], C: [300, 399] };
export const UNIT_ID_PATTERN = /^([ABC])-(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const CHECK_ARRAY_KEYS = ["absentCommands", "absentViews", "absentSettings", "absentProcesses", "absentHosts"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// リポジトリのルートからの相対パスを "/" 区切りにそろえる。絶対パス・".."・空・文字列でないものは null。
export function normalizeRelPath(p) {
  if (typeof p !== "string") return null;
  let s = p.trim().replace(/\\/g, "/");
  if (s === "" || s.startsWith("/") || /^[A-Za-z]:/.test(s)) return null;
  const parts = [];
  for (const seg of s.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") return null;
    parts.push(seg);
  }
  return parts.length ? parts.join("/") : null;
}

// p が prefix と同じか、その下にあるか（どちらも相対パス。大文字小文字は区別する）。
export function isUnderPath(p, prefix) {
  const a = normalizeRelPath(p);
  const b = normalizeRelPath(prefix);
  if (!a || !b) return false;
  return a === b || a.startsWith(b + "/");
}

export function validateUnit(unit, dirName) {
  if (!isPlainObject(unit)) return ["unit.json: オブジェクトでない"];
  const e = [];
  const id = unit.id;
  const m = typeof id === "string" ? UNIT_ID_PATTERN.exec(id) : null;
  if (!m) e.push(`id: <段階>-<番号>-<名前> の形でない: ${JSON.stringify(id)}`);
  if (dirName !== undefined && id !== dirName) e.push(`id: フォルダの名前 ${dirName} と違う: ${JSON.stringify(id)}`);
  if (!["A", "B", "C"].includes(unit.stage)) e.push(`stage: A・B・C のどれでもない: ${JSON.stringify(unit.stage)}`);
  else if (m && m[1] !== unit.stage) e.push(`stage: id の段階 ${m[1]} と違う: ${unit.stage}`);
  if (!Number.isInteger(unit.order)) e.push(`order: 整数でない: ${JSON.stringify(unit.order)}`);
  else if (STAGE_ORDER_RANGES[unit.stage]) {
    const [lo, hi] = STAGE_ORDER_RANGES[unit.stage];
    if (unit.order < lo || unit.order > hi) e.push(`order: 段階 ${unit.stage} の範囲 ${lo}〜${hi} の外: ${unit.order}`);
  }
  if (typeof unit.enabled !== "boolean") e.push(`enabled: 真偽値でない: ${JSON.stringify(unit.enabled)}`);
  if (unit.intent !== undefined && typeof unit.intent !== "string") e.push("intent: 文字列でない");

  const strArray = (key, { paths = false } = {}) => {
    const v = unit[key];
    if (v === undefined) return;
    if (!Array.isArray(v)) return e.push(`${key}: 配列でない`);
    v.forEach((x, i) => {
      if (typeof x !== "string" || x === "") e.push(`${key}[${i}]: 空でない文字列でない`);
      else if (paths && !normalizeRelPath(x)) e.push(`${key}[${i}]: リポジトリのルートからの相対パスでない: ${x}`);
    });
  };
  strArray("after");
  strArray("delete", { paths: true });
  strArray("productRemove");
  strArray("smoke");
  if (Array.isArray(unit.after) && unit.after.includes(id)) e.push("after: 自分を挙げている");

  if (unit.removeDependencies !== undefined) {
    if (!isPlainObject(unit.removeDependencies)) e.push("removeDependencies: オブジェクトでない");
    else
      for (const [file, names] of Object.entries(unit.removeDependencies)) {
        const f = normalizeRelPath(file);
        if (!f || !/(^|\/)package\.json$/.test(f)) e.push(`removeDependencies: キーが package.json の相対パスでない: ${file}`);
        if (!Array.isArray(names) || names.some((n) => typeof n !== "string" || n === "")) {
          e.push(`removeDependencies[${file}]: 空でない文字列の配列でない`);
        }
      }
  }
  if (unit.removeLines !== undefined) {
    if (!Array.isArray(unit.removeLines)) e.push("removeLines: 配列でない");
    else
      unit.removeLines.forEach((r, i) => {
        if (!isPlainObject(r)) return e.push(`removeLines[${i}]: オブジェクトでない`);
        if (!normalizeRelPath(r.file)) e.push(`removeLines[${i}].file: 相対パスでない: ${JSON.stringify(r.file)}`);
        if (typeof r.line !== "string" || r.line.trim() === "") e.push(`removeLines[${i}].line: 空でない文字列でない`);
        if (r.count !== undefined && !(Number.isInteger(r.count) && r.count >= 1)) e.push(`removeLines[${i}].count: 1以上の整数でない`);
      });
  }
  if (unit.patch !== undefined) {
    if (typeof unit.patch !== "string" || !normalizeRelPath(unit.patch) || unit.patch.includes("/") || unit.patch.includes("\\")) {
      e.push(`patch: 単位のフォルダの中のファイルの名前でない: ${JSON.stringify(unit.patch)}`);
    }
  }
  if (unit.kept !== undefined) {
    if (!Array.isArray(unit.kept)) e.push("kept: 配列でない");
    else
      unit.kept.forEach((k, i) => {
        if (!isPlainObject(k) || !normalizeRelPath(k.path)) e.push(`kept[${i}].path: 相対パスでない`);
        else if (typeof k.reason !== "string" || k.reason === "") e.push(`kept[${i}].reason: 理由が無い`);
      });
  }
  if (unit.checks !== undefined) {
    if (!isPlainObject(unit.checks)) e.push("checks: オブジェクトでない");
    else {
      for (const k of CHECK_ARRAY_KEYS) {
        const v = unit.checks[k];
        if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== "string"))) e.push(`checks.${k}: 文字列の配列でない`);
      }
      const as = unit.checks.absentStrings;
      if (as !== undefined) {
        if (!Array.isArray(as)) e.push("checks.absentStrings: 配列でない");
        else
          as.forEach((a, i) => {
            if (!isPlainObject(a) || typeof a.text !== "string" || a.text === "") e.push(`checks.absentStrings[${i}].text: 空でない文字列でない`);
            else if (a.in !== undefined && (!Array.isArray(a.in) || a.in.some((p) => !normalizeRelPath(p)))) {
              e.push(`checks.absentStrings[${i}].in: 相対パスの配列でない`);
            }
          });
      }
    }
  }
  return e;
}

// 当てる単位と順を決める（docs/03 の5.1）。
//   only:  ID の配列か null。あれば挙げた単位だけを当てる（enabled を問わない。試しと関門の前の確かめのため）
//   until: ID か null。あればその単位まで（含む）で止め、後ろを skipped にする
// after の単位は plan の中で先に当たっていなければ誤り（無い・無効・選ばれていない・後ろにある）。
export function planUnits(units, { only = null, until = null } = {}) {
  const list = Array.isArray(units) ? units.filter(isPlainObject) : [];
  const errors = [];
  const skipped = [];
  const byId = new Map();
  for (const u of list) {
    if (byId.has(u.id)) errors.push(`単位の ID が重なっている: ${u.id}`);
    byId.set(u.id, u);
  }
  const onlySet = Array.isArray(only) && only.length ? new Set(only) : null;
  if (onlySet) for (const id of onlySet) if (!byId.has(id)) errors.push(`--only の単位が無い: ${id}`);
  if (until && !byId.has(until)) errors.push(`--until の単位が無い: ${until}`);

  const sorted = [...byId.values()].sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
  const byOrder = new Map();
  for (const u of sorted) {
    if (byOrder.has(u.order)) errors.push(`order ${u.order} が ${byOrder.get(u.order)} と ${u.id} で重なっている`);
    else byOrder.set(u.order, u.id);
  }

  let plan = [];
  for (const u of sorted) {
    if (onlySet ? !onlySet.has(u.id) : u.enabled !== true) {
      skipped.push({ id: u.id, reason: onlySet ? "not in --only" : "disabled" });
      continue;
    }
    plan.push(u);
  }
  if (until && byId.has(until)) {
    const idx = plan.findIndex((u) => u.id === until);
    // 無効な単位・--only の外の単位を指したら止める（2026-11-14 リーダーの判断。黙って全部当てない）
    if (idx === -1) errors.push(`--until の単位 ${until} が当てる単位に入っていない（${onlySet ? "--only に入っていない" : "有効でない"}）`);
    else {
      for (const u of plan.slice(idx + 1)) skipped.push({ id: u.id, reason: "after --until" });
      plan = plan.slice(0, idx + 1);
    }
  }
  const seen = new Set();
  for (const u of plan) {
    for (const dep of checkAfter(u, seen)) {
      const d = byId.get(dep);
      const why = !d ? "無い" : !plan.includes(d) ? (onlySet ? "--only に入っていない" : "有効でない") : "後ろにある";
      errors.push(`${u.id}: after の単位 ${dep} が先に当たらない（${why}）`);
    }
    seen.add(u.id);
  }
  return { plan, skipped, errors };
}

// unit の after のうち、appliedIds（Set か配列）に無いもの。
export function checkAfter(unit, appliedIds) {
  const applied = appliedIds instanceof Set ? appliedIds : new Set(Array.isArray(appliedIds) ? appliedIds : []);
  const after = isPlainObject(unit) && Array.isArray(unit.after) ? unit.after : [];
  return after.filter((id) => !applied.has(id));
}
