// PC ごとの設定ファイル local.json を読む共通の部品（docs/02 の6.1）。既定値と展開の規則をここに1か所で持つ。
// PowerShell 側の同じ部品は scripts/lib/local-config.ps1。規則を変えるときは両方を同じに直す。
//
// 規則（docs/02 の6.1 と、この部品で決めたこと）:
//   - 置き場所は %LOCALAPPDATA%\Shuko\local.json に固定。試しとテストのために、関数には別のパスを渡せる。
//   - ファイルが無い、キーが無い → 既定値。
//   - JSON として読めない、最上位がオブジェクトでない、知らないキーがある、型が違う → 止めて誤りを出す（既定値に戻さない）。
//   - キーの名前は大文字小文字を区別する（"InstallRoot" は知らないキー）。
//   - installRoot・buildRoot・builderRepo は文字列。%NAME% を環境変数で展開し、展開の後に絶対パス（ドライブ文字か UNC）でなければ誤り。
//     知らない環境変数の %NAME% は誤り。builderRepo だけは null を「未設定」として認める。
//   - keepVersions は 1 以上の整数。
//   - 優先の順は「オプション → local.json → 既定値」。
//
// 書き出している関数（テストの入口。tasks/2026-11-13-p2-build-switch/build-switch-design.md の2節）:
//   DEFAULTS, KNOWN_KEYS
//   localConfigPath(env)                         → 既定の local.json のパス
//   expandEnv(value, env)                        → %NAME% を展開した文字列（知らない名前は例外）
//   parseLocalConfig(text, source)               → オブジェクト（読めなければ例外）
//   validateLocalConfig(obj)                     → 誤りの文字列の配列（正しければ空）
//   resolveLocalConfig({ configPath, overrides, env }) → { installRoot, keepVersions, builderRepo, buildRoot, sources, configPath, configExists }
//
// 直接走らせると、解決した値を JSON で出す（試し用）:
//   node scripts/lib/local-config.mjs [--config <local.json>] [--install-root <dir>] [--build-root <dir>] [--keep-versions <n>] [--builder-repo <dir>]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULTS = Object.freeze({
  installRoot: "%LOCALAPPDATA%\\Programs\\Shuko",
  keepVersions: 3,
  builderRepo: null,
  buildRoot: "C:\\b",
});

export const KNOWN_KEYS = Object.freeze(["installRoot", "keepVersions", "builderRepo", "buildRoot"]);
const PATH_KEYS = ["installRoot", "buildRoot", "builderRepo"];

export function localConfigPath(env = process.env) {
  const la = env.LOCALAPPDATA;
  if (!la) throw new Error("環境変数 LOCALAPPDATA が無い。local.json の場所を決められない");
  return path.win32.join(la, "Shuko", "local.json");
}

// %NAME% を環境変数で展開する。名前は大文字小文字を問わない（Windows の環境変数と同じ）。知らない名前は例外。
export function expandEnv(value, env = process.env) {
  if (typeof value !== "string") throw new Error(`展開する値が文字列でない: ${JSON.stringify(value)}`);
  const lower = new Map(Object.keys(env).map((k) => [k.toLowerCase(), k]));
  return value.replace(/%([^%]+)%/g, (m, name) => {
    const key = lower.get(name.toLowerCase());
    if (key === undefined || env[key] === undefined) throw new Error(`環境変数 ${name} が無い（${value}）`);
    return env[key];
  });
}

function isAbsoluteWin(p) {
  return /^[A-Za-z]:[\\/]/.test(p) || /^[\\/]{2}[^\\/]+[\\/][^\\/]+/.test(p);
}

export function parseLocalConfig(text, source = "local.json") {
  let t = String(text);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  let obj;
  try {
    obj = JSON.parse(t);
  } catch (err) {
    throw new Error(`${source} が JSON として読めない: ${err.message}`);
  }
  return obj;
}

export function validateLocalConfig(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return ["最上位が JSON のオブジェクトでない"];
  const errors = [];
  for (const k of Object.keys(obj)) {
    if (!KNOWN_KEYS.includes(k)) errors.push(`${k}: 知らないキー（使えるのは ${KNOWN_KEYS.join("・")}。大文字小文字を区別する）`);
  }
  for (const k of PATH_KEYS) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (k === "builderRepo" && v === null) continue;
    if (typeof v !== "string" || v.trim() === "") errors.push(`${k}: 空でない文字列でない: ${JSON.stringify(v)}`);
  }
  if ("keepVersions" in obj) {
    const v = obj.keepVersions;
    if (!(typeof v === "number" && Number.isInteger(v) && v >= 1)) errors.push(`keepVersions: 1 以上の整数でない: ${JSON.stringify(v)}`);
  }
  return errors;
}

function normalizePath(key, raw, env) {
  const expanded = expandEnv(raw, env);
  if (!isAbsoluteWin(expanded)) throw new Error(`${key}: 展開した値が絶対パスでない: ${expanded}`);
  const n = path.win32.normalize(expanded);
  // 末尾の \ は外す。ただしドライブの直下（C:\）は外さない（C: はドライブの今のフォルダの意味になる）
  return /^[A-Za-z]:\\$/.test(n) ? n : n.replace(/[\\/]+$/, "");
}

// overrides: { installRoot?, keepVersions?, builderRepo?, buildRoot? }（各道具のオプション。undefined・null は「指定なし」）
export function resolveLocalConfig({ configPath, overrides = {}, env = process.env } = {}) {
  const p = configPath || localConfigPath(env);
  let data = {};
  let configExists = false;
  if (fs.existsSync(p)) {
    configExists = true;
    data = parseLocalConfig(fs.readFileSync(p, "utf8"), p);
    const errors = validateLocalConfig(data);
    if (errors.length) throw new Error(`${p} の誤り: ${errors.join(" / ")}`);
  }
  const ovErrors = validateLocalConfig(
    Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null)),
  );
  if (ovErrors.length) throw new Error(`オプションの誤り: ${ovErrors.join(" / ")}`);

  const out = { sources: {}, configPath: p, configExists };
  for (const k of KNOWN_KEYS) {
    let v;
    if (overrides[k] !== undefined && overrides[k] !== null) {
      v = overrides[k];
      out.sources[k] = "option";
    } else if (k in data && data[k] !== null) {
      v = data[k];
      out.sources[k] = "local.json";
    } else {
      v = DEFAULTS[k];
      out.sources[k] = "default";
    }
    if (PATH_KEYS.includes(k)) out[k] = v === null ? null : normalizePath(k, v, env);
    else out[k] = v;
  }
  return out;
}

function cli(argv) {
  const ov = {};
  let configPath;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") configPath = argv[++i];
    else if (a === "--install-root") ov.installRoot = argv[++i];
    else if (a === "--build-root") ov.buildRoot = argv[++i];
    else if (a === "--builder-repo") ov.builderRepo = argv[++i];
    else if (a === "--keep-versions") ov.keepVersions = Number(argv[++i]);
    else throw new Error(`知らない引数: ${a}`);
  }
  return resolveLocalConfig({ configPath, overrides: ov });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(cli(process.argv.slice(2)), null, 2));
  } catch (err) {
    console.error(`[local-config] ${err.message}`);
    process.exit(1);
  }
}
