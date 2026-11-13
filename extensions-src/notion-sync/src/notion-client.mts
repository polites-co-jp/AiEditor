// Notion API の呼び出し（docs/05 の8節）。fetch・待ち・時計を差し替えられる。
// トークンはヘッダにだけ置き、エラーやログの文に入れない。

export const NOTION_API_BASE = "https://api.notion.com/v1";
export const NOTION_VERSION = "2025-09-03";
/** 1リクエストの上限（500KB。単位の定義が公式に無いので 500,000 バイトで切る） */
export const MAX_PAYLOAD_BYTES = 500_000;
/** append の children の上限 */
export const MAX_CHILDREN_PER_APPEND = 100;
/** 1リクエストのブロック要素の上限（rich_text の要素も数に入れて控えめに見る） */
export const MAX_ELEMENTS_PER_REQUEST = 1000;

/** Notion のブロック（使うところだけ） */
export interface NotionBlock {
  object?: string;
  id?: string;
  type: string;
  [key: string]: unknown;
}

export interface FetchResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponseLike>;

export interface NotionApi {
  /** 子のブロックを全部（ページ送りをたどって）返す */
  listChildren(blockId: string): Promise<NotionBlock[]>;
  getBlock(blockId: string): Promise<NotionBlock>;
  /** コードブロックの rich_text と言語を書き換える */
  updateCode(blockId: string, richText: unknown[], language?: string): Promise<NotionBlock>;
  /** 末尾に足す（100 個まで）。足したブロックを返す */
  appendChildren(parentId: string, children: NotionBlock[]): Promise<NotionBlock[]>;
  deleteBlock(blockId: string): Promise<void>;
}

/** Notion が返したエラー（HTTP の状態が 2xx でない） */
export class NotionApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly method: string;
  readonly path: string;
  constructor(status: number, code: string, message: string, method: string, path: string) {
    super(`Notion API ${method} ${path} が ${status} ${code}: ${message}`);
    this.name = "NotionApiError";
    this.status = status;
    this.code = code;
    this.method = method;
    this.path = path;
  }
}

/** つながらない（fetch が失敗した）。次のきっかけでやり直す */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/** 送る前に上限を超えると分かった */
export class PayloadTooLargeError extends Error {
  readonly bytes: number;
  constructor(bytes: number, what: string) {
    super(`${what} の送る量が ${bytes} バイトで、上限 ${MAX_PAYLOAD_BYTES} を超える`);
    this.name = "PayloadTooLargeError";
    this.bytes = bytes;
  }
}

export interface NotionClientOptions {
  token: string;
  fetch: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** 429・529 のやり直しの回数の上限 */
  maxRetries?: number;
  /** 呼び出しの間を空ける最小の間隔（平均 3 回/秒を超えないため） */
  minIntervalMs?: number;
  baseUrl?: string;
  notionVersion?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 429・529 のときに待つ時間（ミリ秒）。Retry-After（整数の秒）を使い、無ければ attempt に応じて伸ばす（1, 2, 4… 秒、上限 30 秒）。
 * 待ちは 60 秒で頭打ちにする。
 */
export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter != null && /^\s*\d+(\.\d+)?\s*$/.test(retryAfter)) {
    return Math.min(Math.ceil(Number(retryAfter) * 1000), 60_000);
  }
  return Math.min(1000 * 2 ** attempt, 30_000);
}

/** ブロック要素の数（ブロック1つ＋その rich_text の要素の数） */
export function countElements(blocks: NotionBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    const body = b[b.type] as { rich_text?: unknown[] } | undefined;
    if (body && Array.isArray(body.rich_text)) n += body.rich_text.length;
  }
  return n;
}

export function byteLength(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

/**
 * append の children を、上限（100 個・要素 1000・500,000 バイト）に収まるよう分ける。
 * groups（見出しとコードの組など、離したくないまとまり）の単位で分ける。1つのまとまりだけで超えるなら PayloadTooLargeError。
 */
export function chunkForAppend(groups: NotionBlock[][]): NotionBlock[][] {
  const out: NotionBlock[][] = [];
  let cur: NotionBlock[] = [];
  const fits = (blocks: NotionBlock[]) =>
    blocks.length <= MAX_CHILDREN_PER_APPEND &&
    countElements(blocks) <= MAX_ELEMENTS_PER_REQUEST &&
    byteLength(JSON.stringify({ children: blocks })) <= MAX_PAYLOAD_BYTES;
  for (const g of groups) {
    if (!fits(g)) throw new PayloadTooLargeError(byteLength(JSON.stringify({ children: g })), "1つのファイルのブロック");
    const next = [...cur, ...g];
    if (fits(next)) cur = next;
    else {
      if (cur.length) out.push(cur);
      cur = [...g];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function createNotionClient(opts: NotionClientOptions): NotionApi {
  const token = opts.token;
  if (!token) throw new Error("トークンが無い");
  const doFetch = opts.fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? (() => Date.now());
  const maxRetries = opts.maxRetries ?? 5;
  const minInterval = opts.minIntervalMs ?? 350;
  const base = (opts.baseUrl ?? NOTION_API_BASE).replace(/\/+$/, "");
  const version = opts.notionVersion ?? NOTION_VERSION;
  let lastAt = -Infinity;

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    if (payload !== undefined && byteLength(payload) > MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(byteLength(payload), `${method} ${path}`);
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": version,
    };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    for (let attempt = 0; ; attempt++) {
      const wait = lastAt + minInterval - now();
      if (wait > 0) await sleep(wait);
      lastAt = now();
      let res: FetchResponseLike;
      try {
        res = await doFetch(base + path, { method, headers, body: payload });
      } catch (e) {
        // fetch の失敗の文にトークンは入らない（URL とヘッダを含めない）
        throw new NetworkError(`Notion に接続できない（${method} ${path}）: ${(e as Error)?.message ?? String(e)}`);
      }
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          throw new NotionApiError(res.status, "invalid_json", "応答が JSON でない", method, path);
        }
      }
      if ((res.status === 429 || res.status === 529) && attempt < maxRetries) {
        await sleep(retryDelayMs(res.headers.get("retry-after"), attempt));
        continue;
      }
      let code = "unknown";
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { code?: unknown; message?: unknown };
        if (typeof j.code === "string") code = j.code;
        if (typeof j.message === "string") message = j.message;
      } catch {
        // 本文が JSON でなければそのまま（300 文字まで）
      }
      throw new NotionApiError(res.status, code, message, method, path);
    }
  }

  const enc = encodeURIComponent;

  return {
    async listChildren(blockId) {
      const out: NotionBlock[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 1000; guard++) {
        const q: string = cursor ? `?page_size=100&start_cursor=${enc(cursor)}` : "?page_size=100";
        const r = (await request("GET", `/blocks/${enc(blockId)}/children${q}`)) as {
          results?: NotionBlock[];
          has_more?: boolean;
          next_cursor?: string | null;
        };
        if (Array.isArray(r.results)) out.push(...r.results);
        if (!r.has_more || !r.next_cursor) return out;
        cursor = r.next_cursor;
      }
      throw new Error("子のブロックのページ送りが終わらない");
    },
    async getBlock(blockId) {
      return (await request("GET", `/blocks/${enc(blockId)}`)) as NotionBlock;
    },
    async updateCode(blockId, richText, language = "json") {
      return (await request("PATCH", `/blocks/${enc(blockId)}`, {
        type: "code",
        code: { rich_text: richText, language },
      })) as NotionBlock;
    },
    async appendChildren(parentId, children) {
      if (children.length > MAX_CHILDREN_PER_APPEND) throw new Error(`children は ${MAX_CHILDREN_PER_APPEND} 個まで`);
      const r = (await request("PATCH", `/blocks/${enc(parentId)}/children`, { children })) as { results?: NotionBlock[] };
      return Array.isArray(r.results) ? r.results : [];
    },
    async deleteBlock(blockId) {
      await request("DELETE", `/blocks/${enc(blockId)}`);
    },
  };
}
