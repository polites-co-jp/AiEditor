// HTTP の取得の共通の部品（Node.js の fetch だけ）。取得したファイルの SHA-256 を、書きながら計算する。
// 利用者の情報を送らない（User-Agent は一般の名前）。

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const USER_AGENT = "shuko-build/0.1 (+lock-fetch)";

async function withRetry(label, fn, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err && err.noRetry) break;
      if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`${label}: ${lastErr && lastErr.message}`);
}

function httpError(res, url) {
  const err = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  err.status = res.status;
  if (res.status >= 400 && res.status < 500 && res.status !== 429) err.noRetry = true;
  return err;
}

// JSON を取る。404 は null を返す（allow404 のとき）。
export async function getJson(url, { allow404 = false, headers = {}, method = "GET", body } = {}) {
  return withRetry(`JSON の取得に失敗 ${url}`, async () => {
    const res = await fetch(url, {
      method,
      body,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
      redirect: "follow",
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw httpError(res, url);
    return res.json();
  });
}

// 本文を文字列で取る。
export async function getText(url, { allow404 = false } = {}) {
  return withRetry(`取得に失敗 ${url}`, async () => {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw httpError(res, url);
    return res.text();
  });
}

// url を dest に保存し、{ sha256, bytes, finalUrl, contentType } を返す。途中のファイルは dest.part に書き、
// 終わってから名前を変える。skipIfExists が真で dest があれば取らずにハッシュだけを返す。
export async function download(url, dest, { skipIfExists = false } = {}) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  if (skipIfExists && fs.existsSync(dest)) {
    const { sha256, bytes } = await sha256File(dest);
    return { sha256, bytes, finalUrl: null, contentType: null, cached: true };
  }
  return withRetry(`ダウンロードに失敗 ${url}`, async () => {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    if (!res.ok) throw httpError(res, url);
    const hash = createHash("sha256");
    let bytes = 0;
    const counter = new Transform({
      transform(chunk, _enc, cb) {
        hash.update(chunk);
        bytes += chunk.length;
        cb(null, chunk);
      },
    });
    const part = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(part));
    const expected = Number(res.headers.get("content-length"));
    if (expected && expected !== bytes && !res.headers.get("content-encoding")) {
      throw new Error(`長さが合わない（${bytes} / ${expected}）`);
    }
    await fs.promises.rename(part, dest);
    return { sha256: hash.digest("hex"), bytes, finalUrl: res.url, contentType: res.headers.get("content-type"), cached: false };
  });
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of fs.createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

export async function writeJson(file, value) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
