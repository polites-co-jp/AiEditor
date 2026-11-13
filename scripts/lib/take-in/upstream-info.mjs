// 判定に渡す「前回の取り込みから後のすべての版のリリースノートとアドバイザリ」（docs/06 の3節・7.1）を選ぶ・取る。
// 選ぶ関数は純粋。fetchUpstreamInfo だけが通信する（GitHub の未認証の API と code.visualstudio.com。読むだけ）。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の3節の手順 1(e)。

import fs from "node:fs";
import path from "node:path";
import { compareVersions } from "../lock.mjs";
import { getJson, getText } from "../http.mjs";

export const GITHUB_API = "https://api.github.com/repos/microsoft/vscode";
export const UPDATES_URL = (minor) => `https://code.visualstudio.com/updates/v1_${minor}`;

// git ls-remote <repo> refs/tags/<tag> refs/tags/<tag>^{} の出力からタグの commit を取る（注釈つきのタグは ^{} の先）。無ければ null。
export function parseLsRemote(text, tag) {
  let plain = null;
  let peeled = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!sha || !ref || !/^[0-9a-f]{40}$/i.test(sha)) continue;
    if (ref === `refs/tags/${tag}^{}`) peeled = sha;
    else if (ref === `refs/tags/${tag}`) plain = sha;
  }
  const v = peeled || plain;
  return v ? v.toLowerCase() : null;
}

// prevTag より後で newTag 以下のリリース（下書き・プレリリースを除く）を、新しい順に。
export function selectReleases(releases, prevTag, newTag) {
  const list = Array.isArray(releases) ? releases : [];
  return list
    .filter((r) => r && typeof r.tag_name === "string" && !r.draft && !r.prerelease)
    .filter((r) => {
      const a = compareVersions(r.tag_name, newTag);
      const b = prevTag ? compareVersions(r.tag_name, prevTag) : 1;
      return a !== null && b !== null && a <= 0 && b > 0;
    })
    .sort((x, y) => compareVersions(y.tag_name, x.tag_name));
}

// 版の文字列を、アドバイザリの patched_versions（例 "1.147.1"、">= 1.147.1"、"1.146.3, 1.147.1"）から拾う。
export function versionsIn(text) {
  return [...String(text || "").matchAll(/\d+\.\d+\.\d+/g)].map((m) => m[0]);
}

// 関係するアドバイザリ: 修正版のどれかが (prevTag, newTag] に入る、または since 以後に公開された。
export function selectAdvisories(advisories, { prevTag, newTag, since } = {}) {
  const list = Array.isArray(advisories) ? advisories : [];
  const sinceT = since ? Date.parse(since) : NaN;
  return list.filter((a) => {
    if (!a) return false;
    const patched = (a.vulnerabilities || []).flatMap((v) => versionsIn(v && v.patched_versions));
    const inRange = patched.some((v) => {
      const le = compareVersions(v, newTag);
      const gt = prevTag ? compareVersions(v, prevTag) : 1;
      return le !== null && gt !== null && le <= 0 && gt > 0;
    });
    const recent = !Number.isNaN(sinceT) && a.published_at && Date.parse(a.published_at) >= sinceT;
    return inRange || recent;
  });
}

// 1.147.0 と 1.145.2 の間の minor の一覧（両端を含む）。リリースノートのページは minor ごと。
export function minorsBetween(prevTag, newTag) {
  const a = Number((String(prevTag || newTag).split(".")[1]) || 0);
  const b = Number(String(newTag).split(".")[1] || 0);
  const out = [];
  for (let m = Math.min(a, b); m <= b; m++) out.push(m);
  return out;
}

// HTML を、判定役が読める程度のテキストにする（タグを外す）。
export function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 取って outDir に置く。失敗は errors に残し、止めない（判定役が「材料が足りない」と書く）。
// 返り値 { releases: [tag...], advisories: [ghsa...], notes: [file...], errors: [...] }
export async function fetchUpstreamInfo({ prevTag, newTag, since = null, outDir, maxNoteChars = 200000 }) {
  fs.mkdirSync(outDir, { recursive: true });
  const res = { prevTag, newTag, since, releases: [], advisories: [], notes: [], errors: [] };
  try {
    const all = await getJson(`${GITHUB_API}/releases?per_page=50`, { headers: { Accept: "application/vnd.github+json" } });
    const sel = selectReleases(all, prevTag, newTag);
    fs.writeFileSync(path.join(outDir, "releases.json"), JSON.stringify(sel.map((r) => ({ tag_name: r.tag_name, name: r.name, published_at: r.published_at, html_url: r.html_url, body: r.body })), null, 2) + "\n");
    res.releases = sel.map((r) => r.tag_name);
    if (!sel.some((r) => r.tag_name === newTag)) res.errors.push(`GitHub のリリースの一覧に ${newTag} が無い（タグだけで、リリースがまだ無い恐れ）`);
  } catch (err) {
    res.errors.push(`リリースの一覧を取れない: ${err.message}`);
  }
  try {
    const all = await getJson(`${GITHUB_API}/security-advisories?per_page=100`, { headers: { Accept: "application/vnd.github+json" } });
    const sel = selectAdvisories(all, { prevTag, newTag, since });
    fs.writeFileSync(path.join(outDir, "advisories.json"), JSON.stringify(sel, null, 2) + "\n");
    res.advisories = sel.map((a) => a.ghsa_id);
  } catch (err) {
    res.errors.push(`アドバイザリを取れない: ${err.message}`);
  }
  for (const m of minorsBetween(prevTag, newTag)) {
    const url = UPDATES_URL(m);
    try {
      const html = await getText(url, { allow404: true });
      if (html === null) {
        res.errors.push(`リリースノートが無い（404）: ${url}`);
        continue;
      }
      const file = path.join(outDir, `release-notes-v1_${m}.txt`);
      fs.writeFileSync(file, `${url}\n\n${htmlToText(html).slice(0, maxNoteChars)}\n`);
      res.notes.push(file);
    } catch (err) {
      res.errors.push(`リリースノートを取れない: ${url}: ${err.message}`);
    }
  }
  fs.writeFileSync(path.join(outDir, "upstream-info.json"), JSON.stringify(res, null, 2) + "\n");
  return res;
}
