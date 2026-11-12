#!/usr/bin/env node
// 台帳の拡張の検証（docs/04 の4節、docs/07 の2.7 の2〜5）。lock-fetch.mjs が取ったものを、拡張ごとに確かめる。
//
//   publisher       Open VSX の verified が true。publishedBy（前の台帳と違えば目立たせる）
//   sha256          VSIX の SHA-256 と Open VSX の .sha256 の値
//   signature       .sigzip の .signature.sig を公開鍵（Ed25519）で検証し、.signature.manifest の各エントリーの
//                   ダイジェストを VSIX の中身と照合する（Node.js の crypto で、ovsx と同じ手順を自前で行う）
//   ovsx            ovsx verify-signature -i <vsix> -m <.signature.manifest> -s <.signature.sig> -k <公開鍵>
//                   ovsx は package.json の devDependencies で版を固定したもの（node_modules/ovsx）を、
//                   node で直に起動する（node <repo>/node_modules/ovsx/bin/ovsx verify-signature ...）。npx は使わない。
//                   入っていない・版が違うときは error（npm の最新を取りに行かない）
//   soak            公開から72時間以上（裁定）。取り下げられていない（lock-fetch の allVersions の確認）
//   engines         engines.vscode が本体の版（--vscode、既定 1.146.0）を満たす
//   defender        MpCmdRun.exe -Scan -ScanType 3 -File <vsix> -DisableRemediation
//   files           VSIX のファイルの一覧（JS の中身は開かない）、実行ファイル、前の版との差（--prev-dir があれば）
//   manifest        manifest の要約と、基準の版との差（基準と違う版にしたとき）と、前の版との差（--prev-dir があれば）
//   license         VSIX の中の LICENSE の本文の SHA-256
//   参考 sourceTag  （Claude Code 以外）ソースのリポジトリに同じ版のタグがあるか（GitHub だけ）。必須ではない
//                   （裁定 2026-11-13: 記録して判定で触れる）。結果は references.sourceTag に found / not-found /
//                   skip / error で残し、ok には効かない。台帳では checks ではなく references に書く
//   Claude Code だけ:
//   bundledCli      VSIX の中の claude.exe の SHA-256 を downloads.claude.ai の manifest.json の checksum と照合
//   manifestGpg     manifest.json.sig を GPG で検証し、署名の鍵の指紋を照らす
//   authenticode    同梱の claude.exe の Authenticode の署名（"Anthropic, PBC"）
//   marketplace     Marketplace に同じ版（win32-x64）が Anthropic 名義で出ている（メタデータだけ。VSIX は取らない）
//
// 使い方:
//   node scripts/lock-verify.mjs [--dir C:/b/p0/vsix] [--vscode 1.146.0] [--write-lock extensions.lock.json]
//                                [--prev-lock <前の台帳>] [--prev-dir <前の lock-fetch の置き場所>]
//                                [--only <id>[,<id>...]] [--skip defender,ovsx] [--now <ISO 8601>] [--result <file>]
//     --prev-lock  publishedBy が前の台帳から変わったかを見る
//     --prev-dir   前の版の files.json・package.json と比べる（compareFileLists・diffManifest）
//     --skip       項目を飛ばす（defender・ovsx）。必須の項目を飛ばした拡張は ok にしない（結果の skipped に残る）
//     --result     結果の書き出し先（既定 <dir>/verify-result.json。試しで本番の結果を上書きしないため）
// 出力: verify-result.json。--write-lock を付けると台帳（docs/04 の3節の形）を書く。
//   台帳には、検証を通った（ok）行だけを新しい値で書く。通らなかった行は、今の台帳に同じ ID の行があれば
//   それを残し、無ければ書かない（mergeLock。どれにしたかは画面と verify-result.json の lockWrite に残す）。
// 終わりの状態: 必須の項目がどれか通らないか飛ばしたら 1。台帳に新しい値で書けなかった行があっても 1。

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { download, getJson, sha256File, writeJson } from "./lib/http.mjs";
import { listZip, hashZipEntry, extractZipEntry, readZipEntry } from "./lib/zip.mjs";
import {
  isSoaked,
  satisfiesEngine,
  compareFileLists,
  diffManifest,
  manifestDigest,
  summarizeFileList,
  validateLockEntry,
  orderLockEntry,
  isOvsxSuccess,
  judgeChecks,
  mergeLock,
  checkPinnedTool,
} from "./lib/lock.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CLAUDE_ID = "anthropic.claude-code";
const CLAUDE_RELEASES = "https://downloads.claude.ai/claude-code-releases";
const CLAUDE_KEY_URL = "https://downloads.claude.ai/keys/claude-code.asc";
// docs/04 の4節の3。https://code.claude.com/docs/en/setup の指定
const CLAUDE_KEY_FINGERPRINT = "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE";
const AUTHENTICODE_ORG = "Anthropic, PBC";
const MARKETPLACE_QUERY = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";
const VERDICT_PATH = "records/phase0/lock-verification.md";

// 必須の項目（通らなければ台帳に載せられない）。Claude Code は CLAUDE_REQUIRED も必須。
const REQUIRED = ["publisher", "sha256", "signature", "ovsx", "soak", "engines", "defender"];
const CLAUDE_REQUIRED = ["bundledCli", "manifestGpg", "authenticode", "marketplace"];

function parseArgs(argv) {
  const args = { dir: "C:/b/p0/vsix", vscode: "1.146.0", writeLock: null, prevLock: null, prevDir: null, only: null, skip: [], now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const list = () => argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    if (a === "--dir") args.dir = argv[++i];
    else if (a === "--vscode") args.vscode = argv[++i];
    else if (a === "--write-lock") args.writeLock = argv[++i];
    else if (a === "--prev-lock") args.prevLock = argv[++i];
    else if (a === "--prev-dir") args.prevDir = argv[++i];
    else if (a === "--only") args.only = list().map((s) => s.toLowerCase());
    else if (a === "--skip") args.skip = list();
    else if (a === "--now") args.now = argv[++i];
    else if (a === "--result") args.result = argv[++i];
    else throw new Error(`知らない引数: ${a}`);
  }
  return args;
}

function run(cmd, cmdArgs, { timeout = 10 * 60 * 1000, shell = false, cwd } = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout, shell, cwd, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return {
    command: [cmd, ...cmdArgs].join(" "),
    status: r.status,
    signal: r.signal,
    error: r.error ? r.error.message : null,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

function result(status, detail = {}) {
  return { status, ...detail };
}

// ---- 署名（.sigzip） ----

async function unpackSigzip(sigzip, outDir) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const entries = await listZip(sigzip);
  const out = { entries: entries.map((e) => e.name) };
  for (const e of entries) {
    if (e.isDirectory) continue;
    const dest = path.join(outDir, path.basename(e.name));
    await fs.promises.writeFile(dest, await readZipEntry(sigzip, e));
    if (e.name === ".signature.sig") out.sig = dest;
    if (e.name === ".signature.manifest") out.manifest = dest;
  }
  return out;
}

async function checkSignature(vsix, sig, publicKeyFile) {
  const [bytes, signature, pem, manifestText] = await Promise.all([
    fs.promises.readFile(vsix),
    fs.promises.readFile(sig.sig),
    fs.promises.readFile(publicKeyFile, "utf8"),
    fs.promises.readFile(sig.manifest, "utf8"),
  ]);
  const key = crypto.createPublicKey({ key: pem, format: "pem" });
  const valid = crypto.verify(null, bytes, key, signature);
  const manifest = JSON.parse(manifestText);
  const issues = [];
  const packageDigest = manifest.package && manifest.package.digests && manifest.package.digests.sha256;
  const actualPackage = crypto.createHash("sha256").update(bytes).digest("base64");
  if (packageDigest !== actualPackage) issues.push("package の digest が合わない");
  const entries = manifest.entries || {};
  const seen = new Set();
  let checked = 0;
  for (const e of await listZip(vsix)) {
    if (e.isDirectory) continue;
    const k = Buffer.from(e.name, "utf8").toString("base64");
    seen.add(k);
    const want = entries[k] && entries[k].digests && entries[k].digests.sha256;
    if (!want) {
      issues.push(`manifest に無い: ${e.name}`);
      continue;
    }
    const { sha256 } = await hashZipEntry(vsix, e);
    const got = Buffer.from(sha256, "hex").toString("base64");
    if (got !== want) issues.push(`digest が合わない: ${e.name}`);
    checked += 1;
  }
  for (const k of Object.keys(entries)) {
    if (!seen.has(k)) issues.push(`VSIX に無い: ${Buffer.from(k, "base64").toString("utf8")}`);
  }
  return result(valid && issues.length === 0 ? "pass" : "fail", {
    algorithm: key.asymmetricKeyType,
    signatureValid: valid,
    manifestEntries: Object.keys(entries).length,
    entriesChecked: checked,
    issues: issues.slice(0, 20),
    issueCount: issues.length,
  });
}

// A-4: package.json の devDependencies で固定した ovsx を探す。{ ok, reason, declared, installed, bin }
function resolveOvsx() {
  const readJsonOrNull = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };
  const root = readJsonOrNull(path.join(REPO_ROOT, "package.json"));
  const declared = root && root.devDependencies ? root.devDependencies.ovsx : undefined;
  const pkgDir = path.join(REPO_ROOT, "node_modules", "ovsx");
  const pkg = readJsonOrNull(path.join(pkgDir, "package.json"));
  const installed = pkg ? pkg.version : null;
  const pinned = checkPinnedTool(declared, installed);
  const binRel = pkg && pkg.bin ? (typeof pkg.bin === "string" ? pkg.bin : pkg.bin.ovsx) : null;
  const bin = binRel ? path.join(pkgDir, binRel) : null;
  if (pinned.ok && (!bin || !fs.existsSync(bin))) {
    return { ok: false, reason: `ovsx の起動ファイルが無い: ${bin}`, declared, installed, bin };
  }
  return { ok: pinned.ok, reason: pinned.reason, declared, installed, bin };
}

function checkOvsx(vsix, sig, publicKeyFile) {
  const tool = resolveOvsx();
  if (!tool.ok) {
    return result("error", {
      reason: `${tool.reason}。リポジトリの直下で依存を導入する（package.json の devDependencies の ovsx ${tool.declared}）。npx で別の版は取りに行かない`,
      declared: tool.declared ?? null,
      installed: tool.installed ?? null,
    });
  }
  // node で ovsx の起動ファイルを直に動かす（シェルも npx も通さない）
  const r = run(process.execPath, [tool.bin, "verify-signature", "-i", vsix, "-m", sig.manifest, "-s", sig.sig, "-k", publicKeyFile]);
  const ok = isOvsxSuccess(r.status, r.stdout);
  return result(ok ? "pass" : "fail", {
    ovsxVersion: tool.installed,
    command: r.command,
    exitCode: r.status,
    stdout: r.stdout,
    stderr: r.stderr.slice(0, 2000),
    error: r.error,
  });
}

// ---- Defender ----

function findMpCmdRun() {
  const platformDir = "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform";
  try {
    const dirs = fs
      .readdirSync(platformDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    for (const d of dirs) {
      const exe = path.join(platformDir, d, "MpCmdRun.exe");
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    // 無ければ次へ
  }
  const fallback = "C:\\Program Files\\Windows Defender\\MpCmdRun.exe";
  return fs.existsSync(fallback) ? fallback : null;
}

function checkDefender(target) {
  const exe = findMpCmdRun();
  if (!exe) return result("error", { reason: "MpCmdRun.exe が見つからない" });
  const r = run(exe, ["-Scan", "-ScanType", "3", "-File", target, "-DisableRemediation"], { timeout: 30 * 60 * 1000 });
  const found = /found\s+\d+\s+threats?/i.test(r.stdout) && !/found no threats/i.test(r.stdout);
  let status;
  if (r.status === 0 && /found no threats/i.test(r.stdout)) status = "pass";
  else if (r.status === 2 && found) status = "fail";
  else status = "error";
  return result(status, { mpcmdrun: exe, command: r.command, exitCode: r.status, stdout: r.stdout.slice(-3000), stderr: r.stderr.slice(-2000), error: r.error });
}

// ---- Claude Code ----

function findGpg() {
  const candidates = [
    "C:\\Program Files\\Git\\usr\\bin\\gpg.exe",
    "C:\\Program Files\\GnuPG\\bin\\gpg.exe",
    "C:\\Program Files (x86)\\GnuPG\\bin\\gpg.exe",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    const c = path.join(dir, "gpg.exe");
    if (dir && fs.existsSync(c)) return c;
  }
  return null;
}

async function checkManifestGpg(dir, manifestFile, sigFile) {
  const gpg = findGpg();
  if (!gpg) return result("error", { reason: "gpg が見つからない（Git for Windows の usr\\bin\\gpg.exe か GnuPG）" });
  const keyFile = path.join(dir, "claude-code.asc");
  await download(CLAUDE_KEY_URL, keyFile, { skipIfExists: false });
  // 普段の鍵束に触れないよう、使い捨ての GNUPGHOME を使う
  const home = path.join(path.dirname(dir), "gnupg-tmp");
  await fs.promises.rm(home, { recursive: true, force: true });
  await fs.promises.mkdir(home, { recursive: true });
  // Git for Windows の gpg（usr\bin\gpg.exe）は MSYS のプログラムで、C:/... を相対パスと読む。/c/... の形で渡す。
  const msys = /[\\/]usr[\\/]bin[\\/]gpg\.exe$/i.test(gpg);
  const fwd = (p) => {
    const s = p.replace(/\\/g, "/");
    return msys ? s.replace(/^([A-Za-z]):\//, (_m, d) => `/${d.toLowerCase()}/`) : s;
  };
  const homeArg = fwd(home);
  const version = run(gpg, ["--version"]);
  const imp = run(gpg, ["--homedir", homeArg, "--batch", "--import", fwd(keyFile)]);
  const fpr = run(gpg, ["--homedir", homeArg, "--batch", "--with-colons", "--fingerprint"]);
  const fingerprints = fpr.stdout
    .split(/\r?\n/)
    .filter((l) => l.startsWith("fpr:"))
    .map((l) => l.split(":")[9]);
  const ver = run(gpg, ["--homedir", homeArg, "--batch", "--status-fd", "1", "--verify", fwd(sigFile), fwd(manifestFile)]);
  const validsig = /^\[GNUPG:\] VALIDSIG (\S+) .* (\S+)$/m.exec(ver.stdout);
  const goodsig = /^\[GNUPG:\] GOODSIG /m.test(ver.stdout);
  const signerPrimary = validsig ? validsig[2] : null;
  const signerKey = validsig ? validsig[1] : null;
  const keyMatches = fingerprints.includes(CLAUDE_KEY_FINGERPRINT);
  const signerMatches = signerPrimary === CLAUDE_KEY_FINGERPRINT || signerKey === CLAUDE_KEY_FINGERPRINT;
  await fs.promises.rm(home, { recursive: true, force: true });
  return result(ver.status === 0 && goodsig && keyMatches && signerMatches ? "pass" : "fail", {
    gpg,
    gpgVersion: version.stdout.split(/\r?\n/)[0],
    importedFingerprints: fingerprints,
    expectedFingerprint: CLAUDE_KEY_FINGERPRINT,
    keyMatches,
    signerKey,
    signerPrimary,
    goodsig,
    exitCode: ver.status,
    status_fd: ver.stdout.split(/\r?\n/).filter((l) => /GOODSIG|VALIDSIG|BADSIG|ERRSIG|NO_PUBKEY|EXPKEYSIG/.test(l)),
    stderr: [imp.stderr, ver.stderr].join("\n").slice(-2000),
  });
}

function checkAuthenticode(file) {
  const lit = file.replace(/'/g, "''");
  const script =
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
    `$s = Get-AuthenticodeSignature -LiteralPath '${lit}'; ` +
    "[pscustomobject]@{ Status = [string]$s.Status; StatusMessage = $s.StatusMessage; " +
    "Subject = $(if ($s.SignerCertificate) { $s.SignerCertificate.Subject } else { $null }); " +
    "Issuer = $(if ($s.SignerCertificate) { $s.SignerCertificate.Issuer } else { $null }); " +
    "Thumbprint = $(if ($s.SignerCertificate) { $s.SignerCertificate.Thumbprint } else { $null }); " +
    "NotAfter = $(if ($s.SignerCertificate) { $s.SignerCertificate.NotAfter.ToString('o') } else { $null }); " +
    "TimeStamper = $(if ($s.TimeStamperCertificate) { $s.TimeStamperCertificate.Subject } else { $null }) } | ConvertTo-Json -Compress";
  const r = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  let sig = null;
  try {
    sig = JSON.parse(r.stdout);
  } catch {
    return result("error", { reason: "Get-AuthenticodeSignature の出力を読めない", stdout: r.stdout, stderr: r.stderr });
  }
  const orgOk = typeof sig.Subject === "string" && (sig.Subject.includes(`O="${AUTHENTICODE_ORG}"`) || sig.Subject.includes(`CN="${AUTHENTICODE_ORG}"`));
  return result(sig.Status === "Valid" && orgOk ? "pass" : "fail", { ...sig, expectedOrganization: AUTHENTICODE_ORG });
}

async function checkMarketplace(version, target) {
  const body = JSON.stringify({
    filters: [{ criteria: [{ filterType: 7, value: CLAUDE_ID }], pageNumber: 1, pageSize: 1 }],
    // IncludeVersions(1) | IncludeVersionProperties(16) | IncludeAssetUri(128)
    flags: 1 | 16 | 128,
  });
  const json = await getJson(MARKETPLACE_QUERY, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", Accept: "application/json;api-version=3.0-preview.1" },
  });
  const ext = json.results && json.results[0] && json.results[0].extensions && json.results[0].extensions[0];
  if (!ext) return result("fail", { reason: "Marketplace に見つからない" });
  const versions = ext.versions || [];
  const same = versions.filter((v) => v.version === version);
  const sameTarget = same.find((v) => (v.targetPlatform || "universal") === target);
  const publisher = ext.publisher || {};
  const nameOk = publisher.publisherName === "anthropic" || publisher.publisherName === "Anthropic";
  return result(sameTarget && nameOk ? "pass" : "fail", {
    publisherName: publisher.publisherName,
    publisherDisplayName: publisher.displayName,
    publisherDomain: publisher.domain || null,
    isDomainVerified: publisher.isDomainVerified ?? null,
    publisherFlags: publisher.flags || null,
    extensionName: ext.extensionName,
    sameVersionTargets: same.map((v) => v.targetPlatform || "universal"),
    sameVersionLastUpdated: sameTarget ? sameTarget.lastUpdated : null,
    latestListed: versions[0] ? versions[0].version : null,
  });
}

async function checkClaude(item, entries, out) {
  const version = item.version;
  const relDir = path.join(item.dir, "claude-release");
  await fs.promises.mkdir(relDir, { recursive: true });
  const manifestFile = path.join(relDir, "manifest.json");
  const sigFile = path.join(relDir, "manifest.json.sig");
  await download(`${CLAUDE_RELEASES}/${version}/manifest.json`, manifestFile, { skipIfExists: false });
  let sigOk = true;
  try {
    await download(`${CLAUDE_RELEASES}/${version}/manifest.json.sig`, sigFile, { skipIfExists: false });
  } catch (err) {
    sigOk = false;
    out.manifestGpg = result("fail", { reason: `manifest.json.sig を取れない: ${err.message}` });
  }
  const release = JSON.parse(await fs.promises.readFile(manifestFile, "utf8"));
  const exes = entries.filter((e) => !e.isDirectory && /(^|\/)claude\.exe$/i.test(e.name));
  const platformKey = item.targetPlatform;
  const plat = release.platforms && release.platforms[platformKey];
  if (exes.length !== 1) {
    out.bundledCli = result("fail", { reason: `VSIX の中の claude.exe が ${exes.length} 個`, candidates: exes.map((e) => e.name) });
  } else {
    const cliDir = path.join(item.dir, "bundled-cli");
    await fs.promises.mkdir(cliDir, { recursive: true });
    const dest = path.join(cliDir, "claude.exe");
    const { sha256, bytes } = await extractZipEntry(item.files.download.file, exes[0], dest);
    const want = plat ? String(plat.checksum).toLowerCase() : null;
    out.bundledCli = result(plat && sha256 === want ? "pass" : "fail", {
      pathInVsix: exes[0].name,
      extractedTo: dest,
      bytes,
      sha256,
      releaseManifest: `${CLAUDE_RELEASES}/${version}/manifest.json`,
      releaseVersion: release.version,
      platformKey,
      platformKeys: Object.keys(release.platforms || {}),
      manifestChecksum: want,
      manifestSize: plat ? plat.size : null,
      manifestBinary: plat ? plat.binary : null,
      sizeMatches: plat ? plat.size === bytes : null,
    });
    out.authenticode = checkAuthenticode(dest);
    out.defenderCli = out.skip.has("defender") ? result("skip") : checkDefender(dest);
  }
  if (sigOk) out.manifestGpg = await checkManifestGpg(relDir, manifestFile, sigFile);
  out.marketplace = await checkMarketplace(version, item.targetPlatform);
}

// ---- 参考: ソースのタグ（必須ではない。裁定 2026-11-13） ----
// 結果の status は found（同じ版のタグがある）・not-found（無い）・skip（GitHub でない）・error（取れない）。
// pass / fail を使わないのは、必須の項目の結果と見分けるため。ok には効かない。

function githubRepo(repository) {
  if (typeof repository !== "string") return null;
  const m = /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(repository);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function checkSourceTag(item) {
  const gh = githubRepo(item.repository);
  if (!gh) return result("skip", { required: false, reason: `GitHub のリポジトリではない: ${item.repository}` });
  const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/matching-refs/tags/`;
  let refs;
  try {
    refs = await getJson(url, { headers: { Accept: "application/vnd.github+json" } });
  } catch (err) {
    return result("error", { required: false, reason: err.message, url });
  }
  const v = item.version.replace(/\./g, "\\.");
  const re = new RegExp(`(^|[^0-9.])${v}$`);
  const tags = refs.map((r) => r.ref.replace(/^refs\/tags\//, "")).filter((t) => re.test(t));
  return result(tags.length ? "found" : "not-found", {
    required: false,
    repository: `${gh.owner}/${gh.repo}`,
    matchingTags: tags,
    tagCount: refs.length,
  });
}

// ---- 1件 ----

async function verifyOne(item, args, prevLock, prevFetch) {
  const out = { id: item.id, version: item.version, targetPlatform: item.targetPlatform, skip: new Set(args.skip) };
  const vsix = item.files.download.file;
  const nowIso = args.now || new Date().toISOString();

  // 1. 発行元
  const prev = prevLock ? prevLock.find((e) => e.id === item.id) : null;
  out.publisher = result(item.verified ? "pass" : "fail", {
    verified: item.verified,
    namespace: item.namespace,
    namespaceDisplayName: item.namespaceDisplayName,
    publishedBy: item.publishedBy,
    publishedByProvider: item.publishedByProvider,
    publishedWithTrustedPublishing: item.publishedWithTrustedPublishing,
    previousPublishedBy: prev ? prev.publishedBy || null : null,
    publishedByChanged: prev && prev.publishedBy ? prev.publishedBy !== item.publishedBy : null,
  });

  // 2. 完全性
  const { sha256 } = await sha256File(vsix);
  out.sha256 = result(sha256 === item.sha256Published ? "pass" : "fail", { computed: sha256, published: item.sha256Published });
  const sig = await unpackSigzip(item.files.signature.file, path.join(item.dir, "sig"));
  out.sigzipEntries = sig.entries;
  if (!sig.sig || !sig.manifest) {
    out.signature = result("fail", { reason: ".sigzip に .signature.sig か .signature.manifest が無い", entries: sig.entries });
    out.ovsx = result("fail", { reason: "同上" });
  } else {
    out.signature = await checkSignature(vsix, sig, item.files.publicKey.file);
    out.ovsx = out.skip.has("ovsx") ? result("skip") : checkOvsx(vsix, sig, item.files.publicKey.file);
  }

  // 4. 寝かせる期間・取り下げ
  const soaked = isSoaked(item.publishedAt, nowIso, { security: item.security === true });
  out.soak = result(soaked && item.listedInAllVersions ? "pass" : "fail", {
    publishedAt: item.publishedAt,
    now: nowIso,
    soaked,
    listedInAllVersions: item.listedInAllVersions,
    security: item.security === true,
  });

  // 9. engines
  const range = item.engines && item.engines.vscode;
  out.engines = result(satisfiesEngine(range, args.vscode) ? "pass" : "fail", { range, vscode: args.vscode });

  // 6. ファイルの一覧（名前とサイズだけ。中身は開かない）
  const entries = await listZip(vsix);
  const files = entries.filter((e) => !e.isDirectory).map((e) => ({ path: e.name, size: e.size }));
  await writeJson(path.join(item.dir, "files.json"), files);
  out.files = result("info", summarizeFileList(files, 3));
  const prevItem = prevFetch ? prevFetch.items.find((i) => i.id === item.id && i.dir && i.version !== item.version) : null;
  if (prevItem && fs.existsSync(path.join(prevItem.dir, "files.json"))) {
    const cmp = compareFileLists(JSON.parse(await fs.promises.readFile(path.join(prevItem.dir, "files.json"), "utf8")), files);
    out.filesDiff = result(cmp.newExecutables.length ? "attention" : "info", { from: prevItem.version, to: item.version, ...cmp });
  }

  // 5. manifest
  const manifest = JSON.parse(await fs.promises.readFile(item.files.manifest.file, "utf8"));
  out.manifest = result("info", { digest: manifestDigest(manifest) });
  if (prevItem && prevItem.files && prevItem.files.manifest && fs.existsSync(prevItem.files.manifest.file)) {
    const base = JSON.parse(await fs.promises.readFile(prevItem.files.manifest.file, "utf8"));
    const changed = diffManifest(base, manifest);
    out.manifestDiffPrev = result(changed.length ? "attention" : "info", { from: prevItem.version, to: item.version, changed });
  }
  if (item.files.baselineManifest) {
    const base = JSON.parse(await fs.promises.readFile(item.files.baselineManifest.file, "utf8"));
    const changed = diffManifest(base, manifest);
    out.manifestDiff = result(changed.length ? "attention" : "info", { from: item.files.baselineManifest.version, to: item.version, changed });
  }

  // 7. ライセンス
  const lic = entries.find((e) => /^extension\/licen[sc]e(\.(md|txt))?$/i.test(e.name));
  if (lic) {
    const h = await hashZipEntry(vsix, lic);
    out.license = result("info", { file: lic.name, sha256: h.sha256, apiLicense: item.license });
  } else {
    out.license = result("info", { file: null, sha256: null, apiLicense: item.license, reason: "VSIX に extension/LICENSE* が無い" });
  }

  // 8. Defender
  out.defender = out.skip.has("defender") ? result("skip") : checkDefender(vsix);

  // 3. 公式配布物との一致
  if (item.id.toLowerCase() === CLAUDE_ID) {
    try {
      await checkClaude(item, entries, out);
    } catch (err) {
      out.claudeError = err.stack || String(err);
    }
  } else {
    // 参考の項目は references の下に置き、必須の項目（REQUIRED）と混ぜない
    out.references = { sourceTag: await checkSourceTag(item) };
  }

  const required = item.id.toLowerCase() === CLAUDE_ID ? REQUIRED.concat(CLAUDE_REQUIRED) : REQUIRED;
  // 必須の項目を飛ばしたら ok にしない（A-2）。飛ばした項目は skipped に残す
  const judged = judgeChecks(out, required);
  out.failed = judged.failed;
  out.skipped = judged.skipped;
  out.ok = judged.ok;
  out.skip = [...out.skip];
  out.verifiedAt = nowIso;
  return out;
}

function statusOf(r) {
  return r ? r.status : "none";
}

// 参考のソースのタグの結果。古い形の結果（out.sourceTag に pass / fail）も読む。
function sourceTagRef(v) {
  const r = (v.references && v.references.sourceTag) || v.sourceTag || null;
  if (!r) return null;
  const status = r.status === "pass" ? "found" : r.status === "fail" ? "not-found" : r.status;
  return { ...r, status };
}

function lockEntry(item, v) {
  const isClaude = item.id.toLowerCase() === CLAUDE_ID;
  const tagRef = isClaude ? null : sourceTagRef(v);
  const crossCheck = isClaude
    ? {
        marketplaceSameVersion: statusOf(v.marketplace) === "pass",
        bundledCliSha256MatchesManifest: statusOf(v.bundledCli) === "pass",
        bundledCliPath: v.bundledCli ? v.bundledCli.pathInVsix || null : null,
        bundledCliSha256: v.bundledCli ? v.bundledCli.sha256 || null : null,
        manifestGpgSignature: statusOf(v.manifestGpg) === "pass",
        authenticode: v.authenticode && v.authenticode.status === "pass" ? AUTHENTICODE_ORG : statusOf(v.authenticode),
      }
    : {
        sourceTag: tagRef && tagRef.matchingTags && tagRef.matchingTags.length ? tagRef.matchingTags[0] : null,
        sourceRepository: tagRef ? tagRef.repository || null : null,
      };
  const digest = v.manifest.digest;
  const entry = {
    id: item.id,
    version: item.version,
    targetPlatform: item.targetPlatform !== "universal" ? item.targetPlatform : undefined,
    source: "open-vsx",
    download: item.files.download.url,
    sha256: v.sha256.computed,
    sha256Source: item.files.sha256.url,
    signature: item.files.signature.url,
    publicKey: item.files.publicKey.url,
    publishedAt: item.publishedAt,
    publishedBy: item.publishedBy || undefined,
    verified: item.verified,
    license: item.license || undefined,
    licenseSha256: v.license.sha256 || undefined,
    engines: item.engines && item.engines.vscode,
    crossCheck,
    manifestDigest: {
      activationEvents: digest.activationEvents,
      enabledApiProposals: digest.enabledApiProposals,
      extensionDependencies: digest.extensionDependencies,
    },
    verifiedAt: v.verifiedAt,
    verdict: VERDICT_PATH,
    // checks は必須の項目だけ。参考の項目は references に分ける（必須ではない。裁定 2026-11-13）
    checks: Object.fromEntries([...REQUIRED, ...(isClaude ? CLAUDE_REQUIRED : [])].map((k) => [k, statusOf(v[k])])),
    references: tagRef ? { sourceTag: tagRef.status } : undefined,
    note: item.note || undefined,
  };
  return orderLockEntry(entry);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  const fetched = JSON.parse(await fs.promises.readFile(path.join(dir, "fetch-result.json"), "utf8"));
  const prevLock = args.prevLock && fs.existsSync(args.prevLock)
    ? JSON.parse(await fs.promises.readFile(args.prevLock, "utf8"))
    : null;
  const prevFetchFile = args.prevDir ? path.join(path.resolve(args.prevDir), "fetch-result.json") : null;
  const prevFetch = prevFetchFile && fs.existsSync(prevFetchFile) ? JSON.parse(await fs.promises.readFile(prevFetchFile, "utf8")) : null;
  const resultFile = args.result ? path.resolve(args.result) : path.join(dir, "verify-result.json");
  const previous = fs.existsSync(resultFile) ? JSON.parse(await fs.promises.readFile(resultFile, "utf8")) : null;
  const results = [];
  for (const item of fetched.items) {
    if (args.only && !args.only.includes(item.id.toLowerCase())) {
      const p = previous && previous.results.find((r) => r.id === item.id);
      if (p) results.push(p);
      continue;
    }
    if (!item.files || !item.files.download) {
      results.push({ id: item.id, ok: false, failed: ["fetch"], errors: item.errors || [] });
      continue;
    }
    console.log(`[lock-verify] ${item.id} ${item.version}`);
    try {
      const v = await verifyOne(item, args, prevLock, prevFetch);
      const why = [v.failed.length ? `通らない: ${v.failed.join(", ")}` : "", v.skipped.length ? `必須の項目を飛ばした: ${v.skipped.join(", ")}` : ""]
        .filter(Boolean)
        .join(" / ");
      console.log(`  -> ${v.ok ? "通った" : `ok にしない（${why}）`}`);
      const ref = v.references && v.references.sourceTag;
      if (ref) {
        const label = { found: `あり（${(ref.matchingTags || []).join(", ")}）`, "not-found": "見つからない", skip: "見ていない", error: "取れない" }[ref.status] || ref.status;
        console.log(`     参考（必須ではない）: ソースのタグ ${label}`);
      }
      results.push(v);
    } catch (err) {
      console.error(`  -> 失敗: ${err.stack || err}`);
      results.push({ id: item.id, version: item.version, ok: false, failed: ["exception"], error: String(err.stack || err) });
    }
  }
  await writeJson(resultFile, { verifiedAt: new Date().toISOString(), vscode: args.vscode, dir, results });
  console.log(`記録: ${resultFile}`);

  // 台帳を書く（A-3）。検証を通った行（ok かつ台帳の形が正しい）だけを新しい値で書く。通らなかった行は、
  // 今の台帳に同じ ID の行があればそれを残し、無ければ書かない。どちらにしたかは画面と verify-result.json に残す。
  if (args.writeLock) {
    const lockPath = path.resolve(args.writeLock);
    const current = fs.existsSync(lockPath) ? JSON.parse(await fs.promises.readFile(lockPath, "utf8")) : [];
    const candidates = [];
    for (const item of fetched.items) {
      const v = results.find((r) => r.id === item.id);
      if (!v || !v.sha256 || !item.files) {
        console.error(`[lock-verify] ${item.id} は検証の結果が無い`);
        candidates.push({ id: item.id, entry: null, ok: false });
        continue;
      }
      const entry = lockEntry(item, v);
      const errors = validateLockEntry(entry);
      if (errors.length) console.error(`[lock-verify] ${item.id} の台帳の形の誤り: ${errors.join("; ")}`);
      candidates.push({ id: item.id, entry, ok: v.ok === true && errors.length === 0 });
    }
    const merged = mergeLock(current, candidates);
    await writeJson(lockPath, merged.lock);
    console.log(`台帳: ${lockPath}（${merged.lock.length} 件）`);
    console.log(`  新しく書いた: ${merged.written.join(", ") || "なし"}`);
    if (merged.kept.length) console.log(`  検証を通らず、今の台帳の行を残した: ${merged.kept.join(", ")}`);
    if (merged.omitted.length) console.log(`  検証を通らず、今の台帳にも無いので書かなかった: ${merged.omitted.join(", ")}`);
    if (merged.untouched.length) console.log(`  今回の検証に無く、そのまま残した: ${merged.untouched.join(", ")}`);
    const resultNow = JSON.parse(await fs.promises.readFile(resultFile, "utf8"));
    resultNow.lockWrite = { path: lockPath, written: merged.written, kept: merged.kept, omitted: merged.omitted, untouched: merged.untouched };
    await writeJson(resultFile, resultNow);
    if (merged.kept.length || merged.omitted.length) process.exitCode = 1;
  }
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
