// ビルドと取り込みの子のプロセスの、一時のファイルとキャッシュの向け先（裁定 2026-11-15「C: に置かない」。
// tasks/2026-11-15-move-off-c/handoff-notes-meng-tian.md の3節）。純粋な関数（ensureEnvDirs だけがフォルダを作る）。
// 利用者の全体の設定（~/.npmrc・環境変数・レジストリ）は変えない。子に渡す環境の写しだけを変える。
//
// 向け先（<buildRoot> の下）:
//   tmp\                    TEMP・TMP（すべての子）。pnpm・npm のキャッシュ（下の3つ）も build.mjs のすべての子に渡す
//   cache\localappdata\     LOCALAPPDATA（道具の子だけ: pnpm の導入・型検査・パッケージ化。ロックファイルの検査は
//                           apply.mjs で pnpm を呼ばないので含めない）
//                           Electron の取得のキャッシュ（@electron/get 5.0.0 は env-paths の LOCALAPPDATA だけを見る。専用の
//                           環境変数は無い）と node-gyp のヘッダ（本家の build/npm/nodeGypHeaders.ts が
//                           %LOCALAPPDATA%\node-gyp\Cache を決め打ちで読む）を、本家の前提を崩さずに <buildRoot> の下へ移すため
//   cache\pnpm-store\       pnpm_config_store_dir（pnpm 11 以降は pnpm_config_* だけを読む。https://pnpm.io/configuring）
//   cache\pnpm-cache\       pnpm_config_cache_dir
//   cache\npm-cache\        npm_config_cache
// 名前の大文字小文字が違う同じ変数（Temp・PNPM_CONFIG_STORE_DIR など）は、消してから入れる（Windows では1つの変数）。
//
// 書き出している関数（テストの入口）:
//   CACHE_SUBDIRS, TOOLCHAIN_STEPS, IF_PRESENT_VARS
//   cacheLayout(buildRoot)            → { root, temp, localAppData, pnpmStore, pnpmCache, npmCache, electronCache, nodeGypCache }
//   tempEnvVars(buildRoot)            → { TEMP, TMP }（取り込みの子）
//   cacheEnvVars(buildRoot, base)     → { TEMP, TMP, pnpm_config_store_dir, pnpm_config_cache_dir, npm_config_cache,
//                                         ＋ base にあるときだけ IF_PRESENT_VARS }（build.mjs の全部の手順）
//   toolchainEnvVars(buildRoot, base) → cacheEnvVars ＋ LOCALAPPDATA（build.mjs の TOOLCHAIN_STEPS）
//   applyEnvVars(base, vars)          → { env, replaced }（base は変えない。replaced は base で置き換えた名前）
//   ensureEnvDirs(vars)               → 作ったフォルダの配列（値がフォルダのものだけ。既にあれば何もしない）

import fs from "node:fs";
import path from "node:path";

export const CACHE_SUBDIRS = Object.freeze({
  temp: "tmp",
  localAppData: "cache\\localappdata",
  pnpmStore: "cache\\pnpm-store",
  pnpmCache: "cache\\pnpm-cache",
  npmCache: "cache\\npm-cache",
});

// 道具の子の環境（LOCALAPPDATA まで向ける）を使う build.mjs の手順
export const TOOLCHAIN_STEPS = Object.freeze(["install", "typecheck", "package"]);

function checkRoot(buildRoot) {
  if (typeof buildRoot !== "string" || !/^([A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(buildRoot)) {
    throw new Error(`buildRoot が絶対パスでない: ${JSON.stringify(buildRoot)}`);
  }
  const n = path.win32.normalize(buildRoot);
  return /^[A-Za-z]:\\$/.test(n) ? n : n.replace(/[\\/]+$/, "");
}

export function cacheLayout(buildRoot) {
  const root = checkRoot(buildRoot);
  const j = (sub) => path.win32.join(root, sub);
  const localAppData = j(CACHE_SUBDIRS.localAppData);
  return {
    root,
    temp: j(CACHE_SUBDIRS.temp),
    localAppData,
    pnpmStore: j(CACHE_SUBDIRS.pnpmStore),
    pnpmCache: j(CACHE_SUBDIRS.pnpmCache),
    npmCache: j(CACHE_SUBDIRS.npmCache),
    // LOCALAPPDATA を向けた結果として決まる場所（記録と片づけのため）
    electronCache: path.win32.join(localAppData, "electron", "Cache"),
    nodeGypCache: path.win32.join(localAppData, "node-gyp", "Cache"),
  };
}

export function tempEnvVars(buildRoot) {
  const L = cacheLayout(buildRoot);
  return { TEMP: L.temp, TMP: L.temp };
}

// 利用者の環境に既にあるときだけ <buildRoot> の下へ向け直す変数（無ければ足さない。本家の 1.146.0 のビルドが読むとは
// 確かめていないが、全体の設定で C: を指していれば道具がそこへ書くため）。値は cacheLayout からの場所。
export const IF_PRESENT_VARS = Object.freeze({
  ELECTRON_CACHE: (L) => L.electronCache,
  electron_config_cache: (L) => L.electronCache,
  ELECTRON_BUILDER_CACHE: (L) => path.win32.join(L.root, "cache", "electron-builder"),
  npm_config_devdir: (L) => L.nodeGypCache,
  PLAYWRIGHT_BROWSERS_PATH: (L) => path.win32.join(L.localAppData, "ms-playwright"),
  COREPACK_HOME: (L) => path.win32.join(L.localAppData, "node", "corepack"),
});

// TEMP・TMP と pnpm・npm のキャッシュ（どの子にも渡してよい。pnpm と npm だけが読む）。base にある IF_PRESENT_VARS も向ける。
export function cacheEnvVars(buildRoot, base = {}) {
  const L = cacheLayout(buildRoot);
  const out = {
    TEMP: L.temp,
    TMP: L.temp,
    pnpm_config_store_dir: L.pnpmStore,
    pnpm_config_cache_dir: L.pnpmCache,
    npm_config_cache: L.npmCache,
  };
  const names = Object.keys(base || {});
  for (const [k, f] of Object.entries(IF_PRESENT_VARS)) {
    const hit = names.find((n) => n.toUpperCase() === k.toUpperCase());
    if (hit !== undefined) out[k] = f(L);
  }
  return out;
}

// 道具の子（TOOLCHAIN_STEPS）の環境: cacheEnvVars に LOCALAPPDATA を足す。
export function toolchainEnvVars(buildRoot, base = {}) {
  const L = cacheLayout(buildRoot);
  return { ...cacheEnvVars(buildRoot, base), LOCALAPPDATA: L.localAppData };
}

export function applyEnvVars(base = {}, vars = {}) {
  const env = { ...(base || {}) };
  const replaced = [];
  for (const [k, v] of Object.entries(vars || {})) {
    if (v === undefined || v === null) continue;
    for (const key of Object.keys(env)) {
      if (key.toUpperCase() === k.toUpperCase()) {
        replaced.push(key);
        delete env[key];
      }
    }
    env[k] = v;
  }
  return { env, replaced: replaced.sort() };
}

export function ensureEnvDirs(vars, { mkdir = (d) => fs.mkdirSync(d, { recursive: true }), exists = fs.existsSync } = {}) {
  const made = [];
  for (const v of new Set(Object.values(vars || {}))) {
    if (typeof v !== "string" || !/^[A-Za-z]:[\\/]/.test(v)) continue;
    if (exists(v)) continue;
    mkdir(v);
    made.push(v);
  }
  return made;
}
