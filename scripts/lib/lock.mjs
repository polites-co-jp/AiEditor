// 台帳（extensions.lock.json）の純粋な関数。docs/04 の3節（台帳の形）と4節（検証の項目）。
// 入出力をもつ処理（取得・ハッシュ・外部の道具）は lock-fetch.mjs・lock-verify.mjs に置き、ここには置かない。
//
// 単体テストとの約束（tasks/2026-11-13-p0-fetch-and-lock/brief.md の「やること」の5）。名前と形を変えない。
//   validateLockEntry(entry)                 → 誤りの文字列の配列（正しければ空）
//   isSoaked(publishedAt, now, { security }) → 真偽（公開から72時間以上で真。security なら常に真）
//   satisfiesEngine(range, vscodeVersion)    → 真偽（^x.y.z と >=x.y.z）
//   compareFileLists(prev, next)             → { added, removed, changed, newExecutables }
//   diffManifest(prev, next)                 → 変わった項目の名前の配列

export const SOAK_HOURS = 72;
const SOAK_MS = SOAK_HOURS * 60 * 60 * 1000;

// 台帳の1件で必須の項目（docs/04 の3節）。targetPlatform は任意。
export const REQUIRED_FIELDS = ["id", "version", "source", "download", "sha256", "publishedAt", "verified", "engines"];

// 台帳の取得元。Marketplace からは取らない（docs/04 の1節）。
export const ALLOWED_SOURCES = ["open-vsx"];

// Open VSX の targetPlatform の値（https://open-vsx.org/api の一覧と同じ）。
export const TARGET_PLATFORMS = [
  "win32-x64", "win32-arm64", "win32-ia32",
  "linux-x64", "linux-arm64", "linux-armhf",
  "alpine-x64", "alpine-arm64",
  "darwin-x64", "darwin-arm64",
  "web", "universal",
];

// 実行ファイルとみなす拡張子（docs/04 の4節の6）。
export const EXECUTABLE_EXTENSIONS = [".exe", ".dll", ".node"];

// manifest の差分で見る項目（docs/04 の4節の5）。contributes の下は「増えたか」だけを見る。
export const MANIFEST_TOP_KEYS = [
  "activationEvents",
  "extensionDependencies",
  "enabledApiProposals",
  "engines",
  "main",
  "capabilities",
];
export const MANIFEST_CONTRIBUTES_KEYS = [
  "chatParticipants",
  "languageModelTools",
  "languageModelChatProviders",
  "mcpServerDefinitionProviders",
  "debuggers",
  "notebooks",
];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
// ISO 8601 の日時（日付と時刻とタイムゾーン）。例 2026-11-10T02:30:51Z、2026-11-10T02:30:51.123+09:00
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ENGINE_PATTERN = /^(\^|>=)\s*(\d+)\.(\d+)\.(\d+)$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function isIsoDateTime(value) {
  return typeof value === "string" && ISO_DATETIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// 台帳の1件を docs/04 の3節の形に照らし、誤りの文字列の配列を返す（正しければ空）。
// 必須の項目は値の形まで見る。任意の項目（sha256Source・signature・publicKey・publishedBy・license・licenseSha256・
// crossCheck・manifestDigest・verifiedAt・verdict）は、あれば型だけを見る（docs の例は一部が書きかけの値のため）。
export function validateLockEntry(entry) {
  if (!isPlainObject(entry)) return ["entry: オブジェクトではない"];
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(entry, field) || entry[field] === undefined || entry[field] === null) {
      errors.push(`${field}: 必須の項目が無い`);
    }
  }
  const has = (field) => entry[field] !== undefined && entry[field] !== null;

  if (has("id") && !(typeof entry.id === "string" && ID_PATTERN.test(entry.id))) {
    errors.push(`id: <発行元>.<名前> の形ではない: ${JSON.stringify(entry.id)}`);
  }
  if (has("version") && !(typeof entry.version === "string" && VERSION_PATTERN.test(entry.version))) {
    errors.push(`version: x.y.z の形ではない: ${JSON.stringify(entry.version)}`);
  }
  if (has("source") && !ALLOWED_SOURCES.includes(entry.source)) {
    errors.push(`source: ${ALLOWED_SOURCES.join(" / ")} ではない: ${JSON.stringify(entry.source)}`);
  }
  if (has("download") && !isHttpsUrl(entry.download)) {
    errors.push(`download: https の URL ではない: ${JSON.stringify(entry.download)}`);
  }
  if (has("sha256") && !(typeof entry.sha256 === "string" && SHA256_PATTERN.test(entry.sha256))) {
    errors.push(`sha256: 64桁の16進の小文字ではない: ${JSON.stringify(entry.sha256)}`);
  }
  if (has("publishedAt") && !isIsoDateTime(entry.publishedAt)) {
    errors.push(`publishedAt: ISO 8601 の日時ではない: ${JSON.stringify(entry.publishedAt)}`);
  }
  if (has("verified") && typeof entry.verified !== "boolean") {
    errors.push(`verified: 真偽値ではない: ${JSON.stringify(entry.verified)}`);
  }
  if (has("engines") && !(typeof entry.engines === "string" && ENGINE_PATTERN.test(entry.engines.trim()))) {
    errors.push(`engines: ^x.y.z か >=x.y.z の形ではない: ${JSON.stringify(entry.engines)}`);
  }
  if (has("targetPlatform") && !TARGET_PLATFORMS.includes(entry.targetPlatform)) {
    errors.push(`targetPlatform: 知らない値: ${JSON.stringify(entry.targetPlatform)}`);
  }

  for (const field of ["sha256Source", "signature", "publicKey", "publishedBy", "license", "licenseSha256", "verifiedAt", "verdict"]) {
    if (has(field) && typeof entry[field] !== "string") errors.push(`${field}: 文字列ではない`);
  }
  for (const field of ["crossCheck", "manifestDigest"]) {
    if (has(field) && !isPlainObject(entry[field])) errors.push(`${field}: オブジェクトではない`);
  }
  return errors;
}

function toTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") return Date.parse(value);
  return NaN;
}

// 公開から72時間以上たっていれば真（ちょうど72時間で真）。security が真なら常に真（docs/04 の4節の4）。
// publishedAt・now は ISO 8601 の文字列、Date、エポックのミリ秒のどれでもよい。読めなければ偽（security なら真）。
export function isSoaked(publishedAt, now, options = {}) {
  if (options && options.security === true) return true;
  const published = toTime(publishedAt);
  const current = toTime(now === undefined ? new Date() : now);
  if (Number.isNaN(published) || Number.isNaN(current)) return false;
  return current - published >= SOAK_MS;
}

// "1.146.0" → [1, 146, 0]。先頭の v と、後ろの -insider などの付け足しは無視する。読めなければ null。
export function parseVersion(version) {
  if (typeof version !== "string") return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// a と b を比べて負・0・正を返す。読めないものは null。
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// engines.vscode の範囲を、本体の版が満たすか。^x.y.z（npm の ^ と同じ。x が 0 なら y まで固定）と >=x.y.z を扱う。
// ほかの形と、読めない版は偽。
export function satisfiesEngine(range, vscodeVersion) {
  if (typeof range !== "string") return false;
  const m = ENGINE_PATTERN.exec(range.trim());
  const v = parseVersion(vscodeVersion);
  if (!m || !v) return false;
  const op = m[1];
  const r = [Number(m[2]), Number(m[3]), Number(m[4])];
  const cmp = compareVersions(v.join("."), r.join("."));
  if (cmp < 0) return false;
  if (op === ">=") return true;
  // ^
  if (r[0] > 0) return v[0] === r[0];
  if (r[1] > 0) return v[0] === 0 && v[1] === r[1];
  return v[0] === 0 && v[1] === 0 && v[2] === r[2];
}

export function isExecutablePath(p) {
  if (typeof p !== "string") return false;
  const lower = p.toLowerCase();
  return EXECUTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// VSIX のファイルの一覧を前の版と比べる（docs/04 の4節の6）。各要素は { path, size }。
//   added:          next にだけある要素（{ path, size }。next の順）
//   removed:        prev にだけある要素（{ path, size }。prev の順）
//   changed:        両方にあってサイズが違う要素（{ path, prevSize, nextSize }。next の順）
//   newExecutables: added のうち .exe・.dll・.node（大文字小文字を問わない）の要素（{ path, size }）
// パスは大文字小文字を区別して比べる（zip の中の名前のまま）。同じパスが重なっていれば後のものを使う。
export function compareFileLists(prev, next) {
  const prevList = Array.isArray(prev) ? prev : [];
  const nextList = Array.isArray(next) ? next : [];
  const prevMap = new Map(prevList.map((e) => [e.path, e]));
  const nextMap = new Map(nextList.map((e) => [e.path, e]));
  const added = [];
  const changed = [];
  const seen = new Set();
  for (const e of nextList) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    const n = nextMap.get(e.path);
    const p = prevMap.get(e.path);
    if (!p) added.push({ path: n.path, size: n.size });
    else if (p.size !== n.size) changed.push({ path: n.path, prevSize: p.size, nextSize: n.size });
  }
  const removed = [];
  const seenPrev = new Set();
  for (const e of prevList) {
    if (seenPrev.has(e.path)) continue;
    seenPrev.add(e.path);
    if (!nextMap.has(e.path)) {
      const p = prevMap.get(e.path);
      removed.push({ path: p.path, size: p.size });
    }
  }
  const newExecutables = added.filter((e) => isExecutablePath(e.path));
  return { added, removed, changed, newExecutables };
}

// キーを並べ替えた JSON（比べるため）。
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function sameValue(a, b) {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  return canonicalJson(a) === canonicalJson(b);
}

// contributes の下の1項目の要素（配列なら各要素、オブジェクトなら各キーと値の組、そのほかは値1つ）。
function contributionItems(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isPlainObject(value)) return Object.keys(value).map((k) => canonicalJson({ [k]: value[k] }));
  return [canonicalJson(value)];
}

// manifest（package.json）の差分で、変わった項目の名前の配列を返す（docs/04 の4節の5）。
//   activationEvents・extensionDependencies・enabledApiProposals・engines・main・capabilities: 値が変わったら名前を返す
//     （無い・null・空の配列・空のオブジェクトは同じとみなす。キーの順は問わない）。
//   contributes の下の chatParticipants・languageModelTools・languageModelChatProviders・mcpServerDefinitionProviders・
//     debuggers・notebooks: 前に無かった要素が増えたら "contributes.<名前>" を返す（減っただけなら返さない）。
// 返す順は docs/04 の4節の5の順（activationEvents → contributes.* → extensionDependencies → enabledApiProposals →
// engines → main → capabilities）。
export function diffManifest(prev, next) {
  const p = isPlainObject(prev) ? prev : {};
  const n = isPlainObject(next) ? next : {};
  const changed = [];
  if (!sameValue(p.activationEvents, n.activationEvents)) changed.push("activationEvents");
  const pc = isPlainObject(p.contributes) ? p.contributes : {};
  const nc = isPlainObject(n.contributes) ? n.contributes : {};
  for (const key of MANIFEST_CONTRIBUTES_KEYS) {
    const before = new Set(contributionItems(pc[key]));
    if (contributionItems(nc[key]).some((item) => !before.has(item))) changed.push(`contributes.${key}`);
  }
  for (const key of MANIFEST_TOP_KEYS.slice(1)) {
    if (!sameValue(p[key], n[key])) changed.push(key);
  }
  return changed;
}

// ---- 検証の判定（lock-verify.mjs が使う。純粋な関数。2026-11-13 の大岡越前守の指摘 A-1〜A-3 で分けた） ----

// A-1: `ovsx verify-signature` が通ったか。終了コードが 0 で、出力に "Signature is valid." があるときだけ真。
// "Signature is invalid" や、valid を含むほかの語（invalid など）では真にしない。
export function isOvsxSuccess(exitCode, stdout) {
  if (exitCode !== 0 || typeof stdout !== "string") return false;
  return /(^|[^A-Za-z])Signature is valid\./.test(stdout);
}

// A-2: 項目ごとの結果（{ <項目>: { status } }）を必須の項目に照らす。
//   failed:  必須の項目のうち、無い・pass でも skip でもないもの
//   skipped: 必須の項目のうち、skip のもの（飛ばした項目。結果に残す）
//   ok:      failed も skipped も空のときだけ真（必須の項目を飛ばしたら ok にしない）
export function judgeChecks(results, required) {
  const r = isPlainObject(results) ? results : {};
  const list = Array.isArray(required) ? required : [];
  const statusOf = (k) => (isPlainObject(r[k]) ? r[k].status : undefined);
  const skipped = list.filter((k) => statusOf(k) === "skip");
  const failed = list.filter((k) => statusOf(k) !== "pass" && statusOf(k) !== "skip");
  return { ok: failed.length === 0 && skipped.length === 0, failed, skipped };
}

// A-3: 書く台帳を決める。current は今の台帳（配列）、candidates は [{ id, entry, ok }]（検証した順）。
//   ok が真の行は新しい entry を書く（written）。
//   ok が偽の行は、今の台帳に同じ ID（大文字小文字を問わない）の行があればそれを残し（kept）、無ければ書かない（omitted）。
//   candidates に無い今の台帳の行は、そのまま後ろに残す（untouched）。
// 返り値: { lock, written, kept, omitted, untouched }（written 以下は ID の配列）
export function mergeLock(current, candidates) {
  const cur = Array.isArray(current) ? current.filter(isPlainObject) : [];
  const list = Array.isArray(candidates) ? candidates : [];
  const key = (id) => String(id || "").toLowerCase();
  const curById = new Map(cur.map((e) => [key(e.id), e]));
  const lock = [];
  const written = [];
  const kept = [];
  const omitted = [];
  const seen = new Set();
  for (const c of list) {
    if (!c || seen.has(key(c.id))) continue;
    seen.add(key(c.id));
    if (c.ok === true && isPlainObject(c.entry)) {
      lock.push(c.entry);
      written.push(c.id);
    } else if (curById.has(key(c.id))) {
      lock.push(curById.get(key(c.id)));
      kept.push(c.id);
    } else {
      omitted.push(c.id);
    }
  }
  const untouched = [];
  for (const e of cur) {
    if (seen.has(key(e.id))) continue;
    lock.push(e);
    untouched.push(e.id);
  }
  return { lock, written, kept, omitted, untouched };
}

// A-4: 版を固定した道具（package.json の devDependencies）が、そのとおりの版で入っているか。
//   declared:  package.json に書いた版の指定（例 "1.4.0"）。正確な x.y.z だけを認める（^・~・範囲・タグは不可）
//   installed: node_modules/<名前>/package.json の version（無ければ null・undefined）
// 返り値: { ok, reason }（ok が偽なら reason に理由）
export function checkPinnedTool(declared, installed) {
  if (typeof declared !== "string" || !/^\d+\.\d+\.\d+$/.test(declared.trim())) {
    return { ok: false, reason: `package.json の版が正確な x.y.z ではない: ${JSON.stringify(declared)}` };
  }
  if (installed === undefined || installed === null || installed === "") {
    return { ok: false, reason: "node_modules に入っていない（依存の導入が要る）" };
  }
  if (installed !== declared.trim()) {
    return { ok: false, reason: `入っている版 ${installed} が package.json の ${declared.trim()} と違う` };
  }
  return { ok: true, reason: null };
}

// ---- 以下は約束の外の補助（lock-fetch.mjs・lock-verify.mjs が使う。純粋な関数） ----

// manifest から台帳の manifestDigest を作る（docs/04 の3節の例の形に、見る項目を足したもの）。
export function manifestDigest(manifest) {
  const m = isPlainObject(manifest) ? manifest : {};
  const contributes = isPlainObject(m.contributes) ? m.contributes : {};
  const digest = {
    activationEvents: Array.isArray(m.activationEvents) ? m.activationEvents : [],
    enabledApiProposals: Array.isArray(m.enabledApiProposals) ? m.enabledApiProposals : [],
    extensionDependencies: Array.isArray(m.extensionDependencies) ? m.extensionDependencies : [],
    extensionPack: Array.isArray(m.extensionPack) ? m.extensionPack : [],
    main: typeof m.main === "string" ? m.main : null,
    browser: typeof m.browser === "string" ? m.browser : null,
    engines: isPlainObject(m.engines) ? m.engines : {},
    extensionKind: m.extensionKind === undefined ? null : m.extensionKind,
    capabilities: m.capabilities === undefined ? null : m.capabilities,
    contributesKeys: Object.keys(contributes).sort(),
  };
  for (const key of MANIFEST_CONTRIBUTES_KEYS) {
    digest[`contributes.${key}`] = contributionItems(contributes[key]).length;
  }
  return digest;
}

// ファイルの一覧（{ path, size }）を、実行ファイルと、上から depth 段のフォルダごとの合計にまとめる。
export function summarizeFileList(files, depth = 2) {
  const list = Array.isArray(files) ? files : [];
  const folders = new Map();
  let total = 0;
  for (const f of list) {
    total += f.size || 0;
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, Math.min(depth, parts.length - 1)).join("/") + "/" : "(直下)";
    const cur = folders.get(dir) || { folder: dir, files: 0, size: 0 };
    cur.files += 1;
    cur.size += f.size || 0;
    folders.set(dir, cur);
  }
  return {
    files: list.length,
    totalSize: total,
    executables: list.filter((f) => isExecutablePath(f.path)).map((f) => ({ path: f.path, size: f.size })),
    folders: [...folders.values()].sort((a, b) => b.size - a.size),
  };
}

// 台帳の並べ方の規則（docs/04 の5節の3: 言語パックを先に、残りは台帳の順）は install-extensions.mjs が持つ。
// ここでは台帳の1件を、docs/04 の3節の項目の順に並べ直す。
const ENTRY_ORDER = [
  "id", "version", "targetPlatform", "source", "download", "sha256", "sha256Source", "signature", "publicKey",
  "publishedAt", "publishedBy", "verified", "license", "licenseSha256", "engines", "crossCheck", "manifestDigest",
  "verifiedAt", "verdict",
];
export function orderLockEntry(entry) {
  const out = {};
  for (const key of ENTRY_ORDER) if (entry[key] !== undefined) out[key] = entry[key];
  for (const key of Object.keys(entry)) if (!(key in out) && entry[key] !== undefined) out[key] = entry[key];
  return out;
}
