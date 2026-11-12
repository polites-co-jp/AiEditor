#!/usr/bin/env node
// 台帳の拡張の取得（docs/04 の2〜4節、docs/07 の2.7 の1）。Open VSX から VSIX・.sha256・.sigzip・公開鍵・manifest を取る。
//
// 版の決め方（裁定: 寝かせる期間。docs/04 の4節の4）:
//   基準の版（--seed の版、無ければ extensions.lock.json の版）と、Open VSX の今の最新を比べる。
//   最新が基準より新しく、公開から72時間以上たっていれば（--security に挙げた拡張は時間を問わない）最新を使う。
//   そうでなければ基準の版を使う。基準の版が Open VSX から消えていれば（取り下げ）誤りとして記録する。
//
// 使い方:
//   node scripts/lock-fetch.mjs [--seed <file>] [--lock extensions.lock.json] [--out C:/b/p0/vsix]
//                               [--now <ISO 8601>] [--security <id>[,<id>...]] [--only <id>[,<id>...]] [--refresh]
//     --seed     基準の一覧（[{ id, version, targetPlatform?, note? }]）。省くと --lock の台帳を基準にする
//     --lock     台帳（既定 extensions.lock.json）
//     --out      置き場所（既定 C:/b/p0/vsix）。拡張ごとに <out>/<id>-<版>[@<target>]/ を作る
//     --now      寝かせる期間の判定に使う今の時刻（既定は実行した時刻）
//     --security セキュリティ修正として寝かせる期間を問わない拡張の ID
//     --only     この ID だけを取る（ほかの拡張の前の結果は fetch-result.json に残す）
//     --refresh  あるファイルも取り直す（既定はあれば使う）
// 出力: <out>/fetch-result.json（拡張ごとの版の決定・Open VSX のメタデータ・取ったファイルの場所とハッシュ）

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { download, getJson, writeJson } from "./lib/http.mjs";
import { compareVersions, isSoaked } from "./lib/lock.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPEN_VSX = "https://open-vsx.org/api";
const PREFERRED_TARGET = "win32-x64";

function parseArgs(argv) {
  const args = {
    seed: null,
    lock: path.join(REPO_ROOT, "extensions.lock.json"),
    out: "C:/b/p0/vsix",
    now: null,
    security: [],
    only: null,
    refresh: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const list = () => argv[++i].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (a === "--seed") args.seed = argv[++i];
    else if (a === "--lock") args.lock = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--now") args.now = argv[++i];
    else if (a === "--security") args.security = list();
    else if (a === "--only") args.only = list();
    else if (a === "--refresh") args.refresh = true;
    else throw new Error(`知らない引数: ${a}`);
  }
  return args;
}

function splitId(id) {
  const dot = id.indexOf(".");
  if (dot <= 0) throw new Error(`ID の形が違う: ${id}`);
  return { namespace: id.slice(0, dot), name: id.slice(dot + 1) };
}

function apiUrl(namespace, name, target, version) {
  const parts = [OPEN_VSX, encodeURIComponent(namespace), encodeURIComponent(name)];
  if (target && target !== "universal") parts.push(target);
  if (version) parts.push(encodeURIComponent(version));
  return parts.join("/");
}

// 最新のメタデータ。targetPlatform の指定が無ければ、win32-x64 があればそれ、無ければ universal。
async function latestMeta(namespace, name, target) {
  if (target) {
    const meta = await getJson(apiUrl(namespace, name, target), { allow404: true });
    if (!meta) throw new Error(`Open VSX に ${namespace}.${name}（${target}）が無い`);
    return meta;
  }
  const specific = await getJson(apiUrl(namespace, name, PREFERRED_TARGET), { allow404: true });
  if (specific && specific.targetPlatform === PREFERRED_TARGET) return specific;
  const universal = await getJson(apiUrl(namespace, name), { allow404: true });
  if (!universal) throw new Error(`Open VSX に ${namespace}.${name} が無い`);
  return universal;
}

function fileNameOf(url) {
  return decodeURIComponent(new URL(url).pathname.split("/").pop());
}

async function fetchOne(base, args, nowIso) {
  const { namespace, name } = splitId(base.id);
  const security = args.security.includes(base.id.toLowerCase());
  const latest = await latestMeta(namespace, name, base.targetPlatform || null);
  const target = latest.targetPlatform || "universal";
  const latestSoaked = isSoaked(latest.timestamp, nowIso, { security });
  const newer = compareVersions(latest.version, base.version);
  let chosen;
  let reason;
  if (newer > 0 && latestSoaked) {
    chosen = latest.version;
    reason = security
      ? `最新 ${latest.version} が基準 ${base.version} より新しい（セキュリティ修正の指定のため寝かせる期間を問わない）`
      : `最新 ${latest.version} が基準 ${base.version} より新しく、公開から72時間以上たっている`;
  } else if (newer > 0) {
    chosen = base.version;
    reason = `最新 ${latest.version} は公開から72時間たっていない（${latest.timestamp}）ため、基準 ${base.version} を使う`;
  } else if (newer === 0) {
    chosen = base.version;
    reason = `最新が基準と同じ ${base.version}`;
  } else {
    chosen = base.version;
    reason = `最新 ${latest.version} が基準 ${base.version} より古い（要確認）`;
  }

  const meta = chosen === latest.version ? latest : await getJson(apiUrl(namespace, name, target, chosen), { allow404: true });
  const allVersions = latest.allVersions ? Object.keys(latest.allVersions) : [];
  const listed = allVersions.includes(chosen);
  const item = {
    id: base.id,
    namespace,
    name,
    targetPlatform: target,
    note: base.note || null,
    baselineVersion: base.version,
    latestVersion: latest.version,
    latestPublishedAt: latest.timestamp,
    latestSoaked,
    security,
    chosenVersion: chosen,
    chosenDiffersFromBaseline: chosen !== base.version,
    reason,
    listedInAllVersions: listed,
    errors: [],
  };
  if (!meta) {
    item.errors.push(`Open VSX に ${base.id} ${chosen}（${target}）が無い（取り下げの恐れ）`);
    return item;
  }
  if (!listed) item.errors.push(`${chosen} が最新のメタデータの allVersions に無い（取り下げの恐れ）`);

  const dirName = `${base.id}-${chosen}${target !== "universal" ? `@${target}` : ""}`;
  const dir = path.join(path.resolve(args.out), dirName);
  await fs.promises.mkdir(dir, { recursive: true });
  const files = meta.files || {};
  const opts = { skipIfExists: !args.refresh };
  const local = {};
  item.warnings = [];
  for (const key of ["download", "sha256", "signature", "manifest", "vsixmanifest", "license"]) {
    if (!files[key]) continue;
    const dest = path.join(dir, key === "manifest" ? "package.json" : fileNameOf(files[key]));
    try {
      const got = await download(files[key], dest, opts);
      local[key] = { url: files[key], file: dest, sha256: got.sha256, bytes: got.bytes };
    } catch (err) {
      // vsixmanifest・license は参考なので、取れなくても止めない（API が載せていても 404 のことがある）
      if (key === "vsixmanifest" || key === "license") item.warnings.push(`${key} を取れない: ${err.message}`);
      else throw err;
    }
  }
  if (files.publicKey) {
    const dest = path.join(dir, "public-key.pem");
    const got = await download(files.publicKey, dest, opts);
    local.publicKey = { url: files.publicKey, file: dest, sha256: got.sha256, bytes: got.bytes };
  }
  for (const key of ["download", "sha256", "signature", "manifest", "publicKey"]) {
    if (!local[key]) item.errors.push(`Open VSX の files に ${key} が無い`);
  }
  await writeJson(path.join(dir, "api.json"), meta);
  if (meta !== latest) await writeJson(path.join(dir, "api-latest.json"), latest);

  // 基準と違う版にしたときは、基準の版の manifest も取る（manifest の差分を見るため。VSIX は取らない）
  if (item.chosenDiffersFromBaseline) {
    const baseMeta = await getJson(apiUrl(namespace, name, target, base.version), { allow404: true });
    if (baseMeta && baseMeta.files && baseMeta.files.manifest) {
      const dest = path.join(dir, "baseline-package.json");
      await download(baseMeta.files.manifest, dest, opts);
      await writeJson(path.join(dir, "baseline-api.json"), baseMeta);
      local.baselineManifest = { url: baseMeta.files.manifest, file: dest, version: base.version };
    } else {
      item.errors.push(`基準の版 ${base.version} のメタデータを取れない`);
    }
  }

  Object.assign(item, {
    version: meta.version,
    publishedAt: meta.timestamp,
    publishedBy: meta.publishedBy ? meta.publishedBy.loginName : null,
    publishedByProvider: meta.publishedBy ? meta.publishedBy.provider || null : null,
    publishedWithTrustedPublishing: meta.publishedWithTrustedPublishing ?? null,
    verified: meta.verified === true,
    namespaceDisplayName: meta.namespaceDisplayName || null,
    displayName: meta.displayName || null,
    license: meta.license || null,
    engines: meta.engines || null,
    repository: meta.repository || null,
    preRelease: meta.preRelease ?? null,
    soaked: isSoaked(meta.timestamp, nowIso, { security }),
    dir,
    files: local,
  });
  if (local.sha256) {
    const text = await fs.promises.readFile(local.sha256.file, "utf8");
    item.sha256Published = (text.trim().split(/\s+/)[0] || "").toLowerCase();
  }
  if (local.download) item.sha256Computed = local.download.sha256;
  return item;
}

async function readBaseline(args) {
  if (args.seed) return JSON.parse(await fs.promises.readFile(args.seed, "utf8"));
  if (!fs.existsSync(args.lock)) throw new Error(`--seed が無く、台帳 ${args.lock} も無い`);
  const lock = JSON.parse(await fs.promises.readFile(args.lock, "utf8"));
  return lock.map((e) => ({ id: e.id, version: e.version, targetPlatform: e.targetPlatform, note: e.note || null }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nowIso = args.now || new Date().toISOString();
  const baseline = await readBaseline(args);
  const out = path.resolve(args.out);
  const resultFile = path.join(out, "fetch-result.json");
  const previous = fs.existsSync(resultFile) ? JSON.parse(await fs.promises.readFile(resultFile, "utf8")) : null;
  const items = [];
  for (const base of baseline) {
    if (args.only && !args.only.includes(base.id.toLowerCase())) {
      const prev = previous && previous.items.find((i) => i.id === base.id);
      if (prev) items.push(prev);
      continue;
    }
    console.log(`[lock-fetch] ${base.id}（基準 ${base.version}）`);
    try {
      const item = await fetchOne(base, args, nowIso);
      console.log(`  -> ${item.chosenVersion}: ${item.reason}${item.errors.length ? ` / 誤り: ${item.errors.join("; ")}` : ""}`);
      items.push(item);
    } catch (err) {
      console.error(`  -> 失敗: ${err.message}`);
      items.push({ id: base.id, baselineVersion: base.version, errors: [err.message] });
    }
  }
  const result = { fetchedAt: new Date().toISOString(), now: nowIso, source: args.seed || args.lock, out, items };
  await writeJson(resultFile, result);
  console.log(`記録: ${resultFile}`);
  if (items.some((i) => i.errors && i.errors.length)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
