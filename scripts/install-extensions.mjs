#!/usr/bin/env node
// 台帳の拡張を入れる（docs/04 の5節）。
//   1. 台帳（extensions.lock.json。--rev なら git のその時点のもの）を読み、VSIX を <buildRoot>\cache\vsix\ から取る
//      （無ければ台帳の download から取ってキャッシュに置く）。CLI は <installRoot>\current\bin\<applicationName>.cmd。
//   2. SHA-256 を台帳と照合する。1件でも違えば、何も入れずに止める。
//   3. 言語パックを先に、残りを台帳の順に `<CLI> --install-extension <vsix> --force` で入れる。
//   4. `--list-extensions --show-versions` で、台帳に無い拡張が入っていたら一覧を出して止める（消すかはユーザーが決める）。
//      台帳の版と違う版・入っていない拡張も止める。
//   5. argv.json に "locale": "ja" を書く。ファイルの末尾は "\n}" で終える（既存の中身も保つ。コメントも残す）。
//
// 使い方:
//   node scripts/install-extensions.mjs [--install-root <dir>] [--build-root <dir>] [--config <local.json>]
//        [--cli <cmd>] [--cache <dir>] [--lock <file> | --rev <commit>] [--portable <dir>] [--extensions-dir <dir>]
//        [--user-data-dir <dir>] [--argv <file>] [--locale ja] [--no-download] [--dry-run] [--out <json>]
//     --cache          VSIX の置き場所（既定 <buildRoot>\cache\vsix。lock-fetch.mjs と同じ <id>-<版>[@<target>]\<ファイル> の形）
//     --rev            ビルドリポジトリの git のその commit の台帳を使う（戻し方。docs/04 の5節）
//     --portable       CLI に VSCODE_PORTABLE を渡す（試し。argv.json は <portable>\argv.json、拡張の既定は <portable>\extensions）
//     --extensions-dir / --user-data-dir  CLI にそのまま渡す
//     --argv           argv.json の場所（既定: --portable があれば <portable>\argv.json、無ければ %USERPROFILE%\<dataFolderName>\argv.json）
//     --dry-run        VSIX の用意と照合だけを行い、CLI は走らせず argv.json も書かない
// 普段使いのデータを守るため、CLI の版の dataFolderName が本家のもの（.vscode・.vscode-oss・.vscode-insiders）のときは、
// --portable か --extensions-dir が無ければ止める（公式の zip で試すときの事故を防ぐ）。
// 出力: 標準出力に JSON 1つ（--out にも書く）。
// 終了コード: 0 = ok（dry-run も）、1 = 誤り、2 = SHA-256 の不一致、3 = 台帳に無い拡張が入っている
//
// 書き出している関数（テストの入口。build-switch-design.md の4節）:
//   isLanguagePack, orderForInstall, vsixCachePath, parseListedExtensions, compareInstalled,
//   scanJsonc, setArgvLocale, argvPathFor, DAILY_DATA_FOLDERS

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLocalConfig } from "./lib/local-config.mjs";
import { validateLockEntry } from "./lib/lock.mjs";
import { download, sha256File } from "./lib/http.mjs";
import { resolveEditorLayout, childEnv, quoteCmdArg } from "./build.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");

export const DAILY_DATA_FOLDERS = Object.freeze([".vscode", ".vscode-oss", ".vscode-insiders"]);

// ---------------------------------------------------------------------------
// 純粋な関数
// ---------------------------------------------------------------------------

export function isLanguagePack(entry) {
  return !!entry && typeof entry.id === "string" && /\.vscode-language-pack-[a-z0-9-]+$/i.test(entry.id);
}

// 言語パックを先に、残りは台帳の順（どちらの中でも元の順を保つ）。
export function orderForInstall(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return [...list.filter(isLanguagePack), ...list.filter((e) => !isLanguagePack(e))];
}

// <cache>\<id>-<版>[@<target>]\<download の URL の最後の名前>（lock-fetch.mjs の置き方と同じ）。
export function vsixCachePath(cacheDir, entry) {
  const target = entry.targetPlatform && entry.targetPlatform !== "universal" ? `@${entry.targetPlatform}` : "";
  const file = decodeURIComponent(new URL(entry.download).pathname.split("/").pop());
  if (!file || file.includes("..") || /[\\/]/.test(file)) throw new Error(`download の URL からファイルの名前を決められない: ${entry.download}`);
  return path.join(cacheDir, `${entry.id}-${entry.version}${target}`, file);
}

// `--list-extensions --show-versions` の出力から [{ id, version }]。id@version の形の行だけを読む。
export function parseListedExtensions(stdout) {
  const out = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9._-]*)@(\S+)\s*$/.exec(line);
    if (m) out.push({ id: m[1], version: m[2] });
  }
  return out;
}

// 入っている拡張と台帳を比べる（ID は大文字小文字を問わない）。
//   extra:           入っているが台帳に無い（{ id, version }）
//   missing:         台帳にあるが入っていない（ID）
//   versionMismatch: 両方にあるが版が違う（{ id, installed, ledger }）
export function compareInstalled(installed, ledger) {
  const L = new Map((Array.isArray(ledger) ? ledger : []).map((e) => [String(e.id).toLowerCase(), e]));
  const I = new Map((Array.isArray(installed) ? installed : []).map((e) => [String(e.id).toLowerCase(), e]));
  const extra = [];
  const versionMismatch = [];
  for (const [k, e] of I) {
    const l = L.get(k);
    if (!l) extra.push({ id: e.id, version: e.version });
    else if (l.version !== e.version) versionMismatch.push({ id: l.id, installed: e.version, ledger: l.version });
  }
  const missing = [...L.entries()].filter(([k]) => !I.has(k)).map(([, e]) => e.id);
  return { ok: extra.length === 0 && missing.length === 0 && versionMismatch.length === 0, extra, missing, versionMismatch };
}

// JSON with comments の字句。[{ type: "string"|"punct"|"literal", start, end, depth, value }]。
// depth は、その字句が入っている括弧の深さ（最上位の { 自身は 0、その中のキーは 1）。コメントと空白は字句にしない。
export function scanJsonc(text) {
  const t = String(text);
  const tokens = [];
  let i = 0;
  let depth = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "﻿") {
      i++;
    } else if (c === "/" && t[i + 1] === "/") {
      while (i < t.length && t[i] !== "\n") i++;
    } else if (c === "/" && t[i + 1] === "*") {
      const e = t.indexOf("*/", i + 2);
      if (e < 0) throw new Error("閉じていないコメント");
      i = e + 2;
    } else if (c === '"') {
      let j = i + 1;
      while (j < t.length && t[j] !== '"') j += t[j] === "\\" ? 2 : 1;
      if (j >= t.length) throw new Error("閉じていない文字列");
      tokens.push({ type: "string", start: i, end: j + 1, depth, value: JSON.parse(t.slice(i, j + 1)) });
      i = j + 1;
    } else if (c === "{" || c === "[") {
      tokens.push({ type: "punct", start: i, end: i + 1, depth, value: c });
      depth++;
      i++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth < 0) throw new Error("括弧が合わない");
      tokens.push({ type: "punct", start: i, end: i + 1, depth, value: c });
      i++;
    } else if (c === "," || c === ":") {
      tokens.push({ type: "punct", start: i, end: i + 1, depth, value: c });
      i++;
    } else {
      let j = i;
      while (j < t.length && !/[\s,:{}\[\]"\/]/.test(t[j])) j++;
      if (j === i) throw new Error(`読めない文字: ${JSON.stringify(c)}（位置 ${i}）`);
      tokens.push({ type: "literal", start: i, end: j, depth, value: t.slice(i, j) });
      i = j;
    }
  }
  if (depth !== 0) throw new Error("括弧が閉じていない");
  return tokens;
}

// argv.json の中身に "locale" を入れる・置き換える。コメントとほかのキーは残す。結果は必ず "\n}" で終わる
// （エディタは初めての起動で末尾の2文字を切って項目を足すため。docs/04 の5節の5）。text が空か null なら新しく作る。
export function setArgvLocale(text, locale) {
  if (typeof locale !== "string" || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale)) throw new Error(`locale の形が違う: ${locale}`);
  const value = JSON.stringify(locale);
  if (text === null || text === undefined || String(text).trim() === "") return `{\n\t"locale": ${value}\n}`;
  let t = String(text);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const tok = scanJsonc(t);
  if (!tok.length || tok[0].value !== "{" || tok[0].type !== "punct") throw new Error("argv.json の最上位がオブジェクトでない");
  const close = tok[tok.length - 1];
  if (close.value !== "}" || close.depth !== 0 || tok.filter((x) => x.depth === 0).length !== 2) throw new Error("argv.json の最上位のオブジェクトの後ろに何かある");
  let out;
  const keyIdx = tok.findIndex((x, k) => x.type === "string" && x.depth === 1 && x.value === "locale" && tok[k + 1] && tok[k + 1].value === ":");
  if (keyIdx >= 0) {
    const v = tok[keyIdx + 2];
    // 文字列のほか（数・null・真偽・オブジェクト・配列）は誤り（設計 4.1）
    if (!v || v.type !== "string") throw new Error('"locale" の値が文字列でない');
    out = t.slice(0, v.start) + value + t.slice(v.end);
  } else {
    const prev = tok[tok.length - 2];
    const entry = `\n\t"locale": ${value}`;
    const sep = prev.value === "{" || prev.value === "," ? "" : ",";
    out = t.slice(0, prev.end) + sep + entry + t.slice(prev.end);
  }
  // 末尾を "\n}" にそろえる（最後の } の前の空白を詰め、改行を1つ置く。} の後ろの空白とコメントは捨てる）
  const last = close.start + (out.length - t.length); // 書き換えはどれも最後の } より前
  if (out[last] !== "}") throw new Error("最後の } の位置を見失った");
  out = `${out.slice(0, last).replace(/\s+$/, "")}\n}`;
  // 確かめ: 読み直して locale が入っている
  const re = scanJsonc(out);
  const k2 = re.findIndex((x, k) => x.type === "string" && x.depth === 1 && x.value === "locale" && re[k + 1] && re[k + 1].value === ":");
  if (k2 < 0 || re[k2 + 2].value !== locale) throw new Error("locale を書いた結果を読み直せない");
  return out;
}

// argv.json の場所（1.146.0 の src/mainImpl.ts の getArgvConfigPath: VSCODE_PORTABLE があれば <portable>\argv.json、
// 無ければ %USERPROFILE%\<dataFolderName>\argv.json。--user-data-dir は関係しない）。
export function argvPathFor({ argv, portable, dataFolderName, env = process.env }) {
  if (argv) return path.resolve(argv);
  if (portable) return path.join(path.resolve(portable), "argv.json");
  if (!env.USERPROFILE) throw new Error("USERPROFILE が無い");
  if (!dataFolderName) throw new Error("product.json に dataFolderName が無い");
  return path.join(env.USERPROFILE, dataFolderName, "argv.json");
}

// ---------------------------------------------------------------------------
// 入出力
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = {
    installRoot: null, buildRoot: null, config: null, cli: null, cache: null, lock: null, rev: null,
    portable: null, extensionsDir: null, userDataDir: null, argv: null, locale: "ja", download: true, dryRun: false, out: null,
  };
  const need = (i, name) => {
    if (i >= argv.length || String(argv[i]).startsWith("--")) throw new Error(`${name} に値が無い`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    switch (x) {
      case "--install-root": a.installRoot = need(++i, x); break;
      case "--build-root": a.buildRoot = need(++i, x); break;
      case "--config": a.config = need(++i, x); break;
      case "--cli": a.cli = need(++i, x); break;
      case "--cache": a.cache = need(++i, x); break;
      case "--lock": a.lock = need(++i, x); break;
      case "--rev": a.rev = need(++i, x); break;
      case "--portable": a.portable = need(++i, x); break;
      case "--extensions-dir": a.extensionsDir = need(++i, x); break;
      case "--user-data-dir": a.userDataDir = need(++i, x); break;
      case "--argv": a.argv = need(++i, x); break;
      case "--locale": a.locale = need(++i, x); break;
      case "--no-download": a.download = false; break;
      case "--dry-run": a.dryRun = true; break;
      case "--out": a.out = need(++i, x); break;
      default: throw new Error(`知らない引数: ${x}`);
    }
  }
  if (a.lock && a.rev) throw new Error("--lock と --rev は一緒に使えない");
  if (a.rev && !/^[0-9A-Za-z][0-9A-Za-z._\/-]*$/.test(a.rev)) throw new Error(`--rev の形が違う: ${a.rev}`);
  return a;
}

function readLedger(a) {
  if (a.rev) {
    const r = spawnSync("git", ["-C", REPO, "show", `${a.rev}:extensions.lock.json`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git show ${a.rev}:extensions.lock.json に失敗: ${(r.stderr || "").trim()}`);
    return { source: `git ${a.rev}:extensions.lock.json`, entries: JSON.parse(r.stdout) };
  }
  const p = a.lock ? path.resolve(a.lock) : path.join(REPO, "extensions.lock.json");
  return { source: p, entries: JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")) };
}

function runCli(cli, cliArgs, env) {
  const line = [cli, ...cliArgs].map(quoteCmdArg).join(" ");
  const t0 = Date.now();
  const r = spawnSync(line, { shell: true, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000, windowsHide: true });
  return {
    exitCode: r.status,
    seconds: (Date.now() - t0) / 1000,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    error: r.error ? r.error.message : null,
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const res = { startedAt: new Date().toISOString(), result: "error", dryRun: a.dryRun, steps: [] };
  const finish = (result, code, message) => {
    res.result = result;
    if (message) res.message = message;
    res.finishedAt = new Date().toISOString();
    const text = `${JSON.stringify(res, null, 2)}\n`;
    if (a.out) {
      fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
      fs.writeFileSync(path.resolve(a.out), text);
    }
    process.stdout.write(text);
    process.exit(code);
  };

  try {
    const cfg = resolveLocalConfig({
      configPath: a.config || undefined,
      overrides: { installRoot: a.installRoot || undefined, buildRoot: a.buildRoot || undefined },
    });
    const cache = a.cache ? path.resolve(a.cache) : path.join(cfg.buildRoot, "cache", "vsix");
    res.config = { path: cfg.configPath, installRoot: cfg.installRoot, buildRoot: cfg.buildRoot, cache };

    // 台帳
    const ledger = readLedger(a);
    if (!Array.isArray(ledger.entries)) throw new Error(`台帳が配列でない: ${ledger.source}`);
    const errors = ledger.entries.flatMap((e, i) => validateLockEntry(e).map((m) => `#${i} ${e && e.id}: ${m}`));
    if (errors.length) throw new Error(`台帳の形の誤り: ${errors.join(" / ")}`);
    res.ledger = { source: ledger.source, count: ledger.entries.length };

    // CLI と版の形
    let layout = null;
    let cli = a.cli ? path.resolve(a.cli) : null;
    const current = path.join(cfg.installRoot, "current");
    if (!cli) {
      layout = resolveEditorLayout(current);
      cli = layout.cli;
    } else {
      try {
        layout = resolveEditorLayout(path.resolve(path.dirname(cli), ".."));
      } catch {}
    }
    if (!fs.existsSync(cli)) throw new Error(`CLI が無い: ${cli}`);
    res.cli = cli;
    res.editor = layout ? { root: layout.root, version: layout.version, nameShort: layout.nameShort, dataFolderName: layout.dataFolderName } : null;
    const dataFolderName = layout ? layout.dataFolderName : null;
    if ((!dataFolderName || DAILY_DATA_FOLDERS.includes(dataFolderName)) && !a.portable && !a.extensionsDir) {
      throw new Error(`CLI の版の dataFolderName が ${dataFolderName}（本家・不明）。普段使いのデータに入れないよう、--portable か --extensions-dir を付ける`);
    }

    // 1・2. VSIX の用意と照合（全部を確かめてから入れる）
    const ordered = orderForInstall(ledger.entries);
    const items = [];
    for (const e of ordered) {
      const file = vsixCachePath(cache, e);
      const it = { id: e.id, version: e.version, file, languagePack: isLanguagePack(e) };
      if (!fs.existsSync(file)) {
        if (!a.download) {
          it.error = "キャッシュに無い（--no-download）";
          items.push(it);
          continue;
        }
        const got = await download(e.download, file, { skipIfExists: false });
        it.downloaded = true;
        it.bytes = got.bytes;
      }
      const h = await sha256File(file);
      it.sha256 = h.sha256;
      it.sha256Ok = h.sha256 === String(e.sha256).toLowerCase();
      items.push(it);
    }
    res.vsix = items;
    const missingFiles = items.filter((x) => x.error);
    if (missingFiles.length) throw new Error(`VSIX が無い: ${missingFiles.map((x) => x.id).join(", ")}`);
    const bad = items.filter((x) => !x.sha256Ok);
    if (bad.length) finish("sha256-mismatch", 2, `SHA-256 が台帳と違う（何も入れていない）: ${bad.map((x) => x.id).join(", ")}`);

    const argvFile = argvPathFor({ argv: a.argv, portable: a.portable, dataFolderName });
    res.argv = { path: argvFile, locale: a.locale };
    if (a.dryRun) finish("dry-run", 0);

    // 3. 入れる
    const { env, removed } = childEnv(process.env, { VSCODE_PORTABLE: a.portable ? path.resolve(a.portable) : undefined });
    res.envRemovedForChildren = removed;
    const dirArgs = [];
    if (a.extensionsDir) dirArgs.push("--extensions-dir", path.resolve(a.extensionsDir));
    if (a.userDataDir) dirArgs.push("--user-data-dir", path.resolve(a.userDataDir));
    for (const it of items) {
      const r = runCli(cli, [...dirArgs, "--install-extension", it.file, "--force"], env);
      res.steps.push({ step: "install", id: it.id, exitCode: r.exitCode, seconds: r.seconds, output: `${r.stdout}\n${r.stderr}`.trim().split(/\r?\n/).slice(-5) });
      if (r.exitCode !== 0) throw new Error(`${it.id} を入れられない（終了コード ${r.exitCode}${r.error ? `、${r.error}` : ""}）`);
    }

    // 4. 台帳に無い拡張
    const l = runCli(cli, [...dirArgs, "--list-extensions", "--show-versions"], env);
    res.steps.push({ step: "list", exitCode: l.exitCode, seconds: l.seconds });
    if (l.exitCode !== 0) throw new Error(`--list-extensions が ${l.exitCode} で終わった`);
    const installed = parseListedExtensions(l.stdout);
    const cmp = compareInstalled(installed, ledger.entries);
    res.installed = installed;
    res.compare = cmp;
    if (cmp.extra.length) {
      finish("extra-extensions", 3, `台帳に無い拡張が入っている（消すかはユーザーが決める。argv.json は書いていない）: ${cmp.extra.map((x) => `${x.id}@${x.version}`).join(", ")}`);
    }
    if (cmp.missing.length || cmp.versionMismatch.length) {
      throw new Error(`入れた結果が台帳と合わない: 無い ${cmp.missing.join(", ") || "なし"} / 版の違い ${cmp.versionMismatch.map((x) => `${x.id} ${x.installed}≠${x.ledger}`).join(", ") || "なし"}`);
    }

    // 5. argv.json
    const before = fs.existsSync(argvFile) ? fs.readFileSync(argvFile, "utf8") : null;
    const after = setArgvLocale(before, a.locale);
    if (before !== after) {
      fs.mkdirSync(path.dirname(argvFile), { recursive: true });
      fs.writeFileSync(argvFile, after, "utf8");
    }
    res.argv.changed = before !== after;
    res.argv.created = before === null;
    res.argv.endsWithNewlineBrace = after.endsWith("\n}");
    finish("ok", 0);
  } catch (err) {
    finish("error", 1, err.message);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
