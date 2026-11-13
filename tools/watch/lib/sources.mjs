// 更新の検知が取りに行くもの（docs/06 の2.2）の URL と、応答の読み方。取得そのものは「取得の部品」（fetcher）に任せ、
// 本物（HTTP）と差し替え（応答を書いた JSON）を同じ形で使えるようにする。
//
// 書き出している関数（テストの入口。tasks/2026-11-14-p4-watch/watch-design.md の3節）:
//   GITHUB_RELEASES_URL, GITHUB_ADVISORIES_URL, OPEN_VSX_API
//   releaseNotesUrl(version) / openVsxApiUrl(entry) / openVsxPageUrl(namespace, name, version) / splitExtId(id)
//   createHttpFetcher({ record })         → { getJson(url), getText(url) }（404 は null。record に応答を写す）
//   createFixtureFetcher(responses)        → 同じ形。responses は { "<url>": { status, json } | { status, text } | { error } }
//   parseReleases(json)                    → [{ version, tag, publishedAt, url, body }]（正式版だけ。版の昇順）
//   parseAdvisories(json)                  → [{ id, severity, summary, publishedAt, url, patched, vulnerableRanges }]
//   inVersionRange(version, range)         → 真偽か null（読めない範囲）
//   releaseNotesSecurityLine(html, version) → その版の「Update x.y.z: ...」の文に security があればその文、無ければ null
//   mentionsSecurity(text)                 → 真偽
//   parseOpenVsx(json)                     → { version, timestamp, verified, preRelease, namespace, name, targetPlatform }

import { getJson, getText } from "../../../scripts/lib/http.mjs";
import { compareVersions, parseVersion } from "../../../scripts/lib/lock.mjs";

export const GITHUB_RELEASES_URL = "https://api.github.com/repos/microsoft/vscode/releases?per_page=10";
export const GITHUB_ADVISORIES_URL =
  "https://api.github.com/repos/microsoft/vscode/security-advisories?state=published&sort=published&direction=desc&per_page=50";
export const OPEN_VSX_API = "https://open-vsx.org/api";
const USER_AGENT = "shuko-watch/0.1";
const GITHUB_HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": USER_AGENT };

// リリースノートのページ（docs/06 の2.2）。https://code.visualstudio.com/updates/v1_<minor>
export function releaseNotesUrl(version) {
  const v = parseVersion(version);
  if (!v) throw new Error(`版として読めない: ${version}`);
  return `https://code.visualstudio.com/updates/v${v[0]}_${v[1]}`;
}

export function splitExtId(id) {
  const dot = String(id).indexOf(".");
  if (dot <= 0) throw new Error(`拡張の ID の形が違う: ${id}`);
  return { namespace: id.slice(0, dot), name: id.slice(dot + 1) };
}

// 台帳の1件の Open VSX の API（プラットフォーム別の拡張は /<namespace>/<name>/<targetPlatform>）。
export function openVsxApiUrl(entry) {
  const { namespace, name } = splitExtId(entry.id);
  const parts = [OPEN_VSX_API, encodeURIComponent(namespace), encodeURIComponent(name)];
  if (entry.targetPlatform && entry.targetPlatform !== "universal") parts.push(encodeURIComponent(entry.targetPlatform));
  return parts.join("/");
}

export function openVsxPageUrl(namespace, name, version) {
  const base = `https://open-vsx.org/extension/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  return version ? `${base}/${encodeURIComponent(version)}` : base;
}

// ---- 取得の部品 ----

function isGithub(url) {
  return /^https:\/\/api\.github\.com\//.test(url);
}

// 本物。scripts/lib/http.mjs の getJson・getText（3回までやり直す）を使う。record（Map か null）に応答を写す。
export function createHttpFetcher({ record = null } = {}) {
  const keep = (url, entry) => {
    if (record) record.set(url, entry);
  };
  return {
    async getJson(url) {
      try {
        const headers = isGithub(url) ? GITHUB_HEADERS : { "User-Agent": USER_AGENT };
        const json = await getJson(url, { allow404: true, headers });
        keep(url, json === null ? { status: 404 } : { status: 200, json });
        return json;
      } catch (err) {
        keep(url, { error: err.message });
        throw err;
      }
    },
    async getText(url) {
      try {
        const t = await getText(url, { allow404: true });
        keep(url, t === null ? { status: 404 } : { status: 200, text: t });
        return t;
      } catch (err) {
        keep(url, { error: err.message });
        throw err;
      }
    },
  };
}

// 差し替え。URL ごとに応答を書いた JSON（responses）から返す。書いていない URL は「取得に失敗」として扱う。
export function createFixtureFetcher(responses) {
  const table = responses && typeof responses === "object" ? responses : {};
  const look = (url) => {
    const r = table[url];
    if (!r) throw new Error(`差し替えの応答が無い（取得の失敗として扱う）: ${url}`);
    if (r.error) throw new Error(String(r.error));
    if (r.status === 404) return { missing: true };
    if (r.status && r.status !== 200) throw new Error(`HTTP ${r.status}: ${url}`);
    return r;
  };
  return {
    async getJson(url) {
      const r = look(url);
      if (r.missing) return null;
      if (r.json !== undefined) return r.json;
      return JSON.parse(r.text);
    },
    async getText(url) {
      const r = look(url);
      if (r.missing) return null;
      return r.text !== undefined ? r.text : JSON.stringify(r.json);
    },
  };
}

// ---- 応答の読み方 ----

const STABLE_TAG = /^\d+\.\d+\.\d+$/;

// GitHub の releases の一覧。下書き・プレリリース・x.y.z でないタグ（vsda-v... など）は外す。版の昇順。
export function parseReleases(json) {
  if (!Array.isArray(json)) throw new Error("releases の応答が配列でない");
  const out = [];
  for (const r of json) {
    if (!r || typeof r !== "object") continue;
    if (r.draft === true || r.prerelease === true) continue;
    const tag = typeof r.tag_name === "string" ? r.tag_name.trim() : "";
    if (!STABLE_TAG.test(tag)) continue;
    out.push({
      version: tag,
      tag,
      publishedAt: typeof r.published_at === "string" ? r.published_at : null,
      url: typeof r.html_url === "string" ? r.html_url : `https://github.com/microsoft/vscode/releases/tag/${tag}`,
      body: typeof r.body === "string" ? r.body : "",
    });
  }
  out.sort((a, b) => compareVersions(a.version, b.version));
  return out;
}

const VERSION_IN_TEXT = /\d+\.\d+\.\d+/g;

// GitHub のリポジトリのセキュリティアドバイザリの一覧。
// patched は vulnerabilities[].patched_versions に現れる x.y.z の全部（重ねない。昇順）。
// vulnerableRanges は vulnerabilities[].vulnerable_version_range（null は外す）。
export function parseAdvisories(json) {
  if (!Array.isArray(json)) throw new Error("security-advisories の応答が配列でない");
  const out = [];
  for (const a of json) {
    if (!a || typeof a !== "object" || typeof a.ghsa_id !== "string") continue;
    const vulns = Array.isArray(a.vulnerabilities) ? a.vulnerabilities : [];
    const patched = new Set();
    const ranges = [];
    for (const v of vulns) {
      if (!v || typeof v !== "object") continue;
      if (typeof v.patched_versions === "string") for (const m of v.patched_versions.match(VERSION_IN_TEXT) || []) patched.add(m);
      if (typeof v.vulnerable_version_range === "string" && v.vulnerable_version_range.trim()) ranges.push(v.vulnerable_version_range.trim());
    }
    out.push({
      id: a.ghsa_id,
      cve: typeof a.cve_id === "string" ? a.cve_id : null,
      severity: typeof a.severity === "string" ? a.severity : null,
      summary: typeof a.summary === "string" ? a.summary : "",
      publishedAt: typeof a.published_at === "string" ? a.published_at : null,
      url: typeof a.html_url === "string" ? a.html_url : `https://github.com/microsoft/vscode/security/advisories/${a.ghsa_id}`,
      patched: [...patched].sort((x, y) => compareVersions(x, y)),
      vulnerableRanges: ranges,
    });
  }
  return out;
}

// GitHub のアドバイザリの範囲（"< 1.85.2"、">= 1.84.0, < 1.84.3"、"= 1.2.3"、"1.2.3"）に version が入るか。
// 読めない範囲は null。
export function inVersionRange(version, range) {
  if (typeof range !== "string" || !range.trim()) return null;
  if (!parseVersion(version)) return null;
  for (const part of range.split(",")) {
    const m = /^\s*(<=|>=|<|>|==|=)?\s*v?(\d+\.\d+\.\d+)\s*$/.exec(part);
    if (!m) return null;
    const op = m[1] || "=";
    const c = compareVersions(version, m[2]);
    const ok =
      op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : op === ">=" ? c >= 0 : c === 0;
    if (!ok) return false;
  }
  return true;
}

export function mentionsSecurity(textValue) {
  return typeof textValue === "string" && /security/i.test(textValue);
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// リリースノートのページで、その版の「Update 1.145.3: The update addresses these security issues.」の文を探す
// （docs/06 の2.2。2026-11-14 に v1_145 のページで、1.145.1・1.145.2 は "these issues"、1.145.3 は "these security issues"
// と書かれていることを確かめた）。文は次の「Update x.y.z」か 300 文字までとする。security を含めばその文を返す。
// x.y.0 には Update の文が無いので null。
export function releaseNotesSecurityLine(html, version) {
  if (typeof html !== "string" || !parseVersion(version)) return null;
  const t = htmlToText(html);
  const re = new RegExp(`Update\\s+${escapeRegExp(version)}(?![\\d.]*\\d)`, "g");
  let m;
  while ((m = re.exec(t)) !== null) {
    const rest = t.slice(m.index, m.index + 300);
    const next = rest.slice(m[0].length).search(/Update\s+\d+\.\d+\.\d+/);
    const sentence = (next >= 0 ? rest.slice(0, m[0].length + next) : rest).trim();
    if (mentionsSecurity(sentence)) return sentence;
  }
  return null;
}

// Open VSX の拡張のメタデータ（/api/<namespace>/<name>[/<targetPlatform>]）。
export function parseOpenVsx(json) {
  if (!json || typeof json !== "object") throw new Error("Open VSX の応答がオブジェクトでない");
  if (typeof json.error === "string") throw new Error(`Open VSX の誤り: ${json.error}`);
  if (typeof json.version !== "string") throw new Error("Open VSX の応答に version が無い");
  return {
    version: json.version,
    timestamp: typeof json.timestamp === "string" ? json.timestamp : null,
    verified: json.verified === true,
    preRelease: json.preRelease === true,
    namespace: typeof json.namespace === "string" ? json.namespace : null,
    name: typeof json.name === "string" ? json.name : null,
    targetPlatform: typeof json.targetPlatform === "string" ? json.targetPlatform : null,
  };
}
