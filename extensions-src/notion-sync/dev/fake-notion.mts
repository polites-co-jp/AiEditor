// 差し替え用の Notion（fetch の形）。試し（trial.mts）とテストで使う。本物の Notion には接続しない。
//
// 使う道（docs/05 の8節で使うものだけ）:
//   GET    /v1/blocks/{id}/children?page_size=&start_cursor=
//   GET    /v1/blocks/{id}
//   PATCH  /v1/blocks/{id}              （code の rich_text・language の書き換え）
//   PATCH  /v1/blocks/{id}/children     （末尾に足す）
//   DELETE /v1/blocks/{id}
// 本物の上限（rich_text の1要素 2000 文字・100 要素、children 100 個）を超えたら 400 validation_error を返す。

import type { FetchLike, FetchResponseLike, NotionBlock } from "../src/notion-client.mts";

export interface FakeCall {
  method: string;
  path: string;
  body?: unknown;
  status: number;
}

export interface FakeNotionOptions {
  token: string;
  pageId: string;
  /** 子のブロックの1回の応答の数（ページ送りを試すために小さくできる。既定 100） */
  pageSize?: number;
}

type Hook = (call: { method: string; path: string; body?: unknown }) => FetchResponseLike | null | void | Promise<FetchResponseLike | null | void>;

function response(status: number, body: unknown, headers: Record<string, string> = {}): FetchResponseLike {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function err(status: number, code: string, message: string): FetchResponseLike {
  return response(status, { object: "error", status, code, message });
}

export class FakeNotion {
  readonly token: string;
  readonly pageId: string;
  pageSize: number;
  /** ページの子の並び（ID） */
  readonly order: string[] = [];
  readonly blocks = new Map<string, NotionBlock>();
  readonly calls: FakeCall[] = [];
  /** 呼ばれる前に割り込む（429 を返す、途中でほかの PC が書いたことにする、など）。null・undefined なら通常どおり */
  beforeRequest: Hook | null = null;
  private seq = 0;

  constructor(opts: FakeNotionOptions) {
    this.token = opts.token;
    this.pageId = opts.pageId;
    this.pageSize = opts.pageSize ?? 100;
  }

  private newId(): string {
    this.seq++;
    const hex = this.seq.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  }

  /** ページの子の並びを、見出しとコードの組として読む（試しで中身を確かめる用） */
  snapshot(): Array<{ type: string; text: string }> {
    return this.order.map((id) => {
      const b = this.blocks.get(id) as NotionBlock;
      const body = b[b.type] as { rich_text?: Array<{ plain_text?: string }> };
      return { type: b.type, text: (body?.rich_text ?? []).map((r) => r.plain_text ?? "").join("") };
    });
  }

  /** 名前の見出しの直後のコードブロックを、Notion で手で直したことにする */
  handEdit(name: string, text: string): void {
    const i = this.order.findIndex((id) => {
      const b = this.blocks.get(id) as NotionBlock;
      return b.type === "heading_2" && this.plain((b.heading_2 as { rich_text: unknown[] }).rich_text) === name;
    });
    if (i < 0) throw new Error(`見出し ${name} が無い`);
    const code = this.blocks.get(this.order[i + 1]) as NotionBlock;
    (code.code as { rich_text: unknown[] }).rich_text = this.toStored([{ type: "text", text: { content: text } }]);
  }

  /** manifest の rev だけを上げる（ほかの PC が書いたことにする） */
  bumpManifestRev(): void {
    for (let i = 0; i < this.order.length - 1; i++) {
      const b = this.blocks.get(this.order[i]) as NotionBlock;
      if (b.type === "heading_2" && this.plain((b.heading_2 as { rich_text: unknown[] }).rich_text) === "manifest") {
        const code = this.blocks.get(this.order[i + 1]) as NotionBlock;
        const m = JSON.parse(this.plain((code.code as { rich_text: unknown[] }).rich_text));
        m.rev += 1;
        (code.code as { rich_text: unknown[] }).rich_text = this.toStored([{ type: "text", text: { content: JSON.stringify(m) } }]);
        return;
      }
    }
    throw new Error("manifest が無い");
  }

  private plain(rt: unknown[]): string {
    return (rt as Array<{ plain_text?: string }>).map((r) => r.plain_text ?? "").join("");
  }

  private toStored(rt: unknown): unknown[] {
    return (rt as Array<{ type: string; text: { content: string } }>).map((r) => ({
      type: "text",
      text: { content: r.text.content, link: null },
      annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
      plain_text: r.text.content,
      href: null,
    }));
  }

  /** rich_text の上限を確かめる。違反なら説明、良ければ null */
  private checkRichText(rt: unknown): string | null {
    if (!Array.isArray(rt)) return "rich_text が配列でない";
    if (rt.length > 100) return `rich_text が ${rt.length} 要素（100 まで）`;
    for (const r of rt) {
      const c = (r as { text?: { content?: unknown } })?.text?.content;
      if (typeof c !== "string") return "text.content が無い";
      if (c.length > 2000) return `text.content が ${c.length} 文字（2000 まで）`;
    }
    return null;
  }

  private store(b: NotionBlock): NotionBlock {
    const id = this.newId();
    const body = b[b.type] as { rich_text?: unknown; language?: string };
    const stored: NotionBlock = {
      object: "block",
      id,
      type: b.type,
      [b.type]: { ...body, rich_text: this.toStored(body?.rich_text ?? []) },
    };
    this.blocks.set(id, stored);
    return stored;
  }

  readonly fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const p = u.pathname.replace(/^\/v1/, "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    const record = (res: FetchResponseLike) => {
      this.calls.push({ method: init.method, path: p + u.search, body, status: res.status });
      return res;
    };
    if (this.beforeRequest) {
      const r = await this.beforeRequest({ method: init.method, path: p + u.search, body });
      if (r) return record(r);
    }
    if (init.headers.Authorization !== `Bearer ${this.token}`) return record(err(401, "unauthorized", "API token is invalid."));
    if (!init.headers["Notion-Version"]) return record(err(400, "missing_version", "Notion-Version header failed validation"));

    let m: RegExpExecArray | null;
    if (init.method === "GET" && (m = /^\/blocks\/([^/]+)\/children$/.exec(p))) {
      const id = decodeURIComponent(m[1]);
      if (id !== this.pageId) return record(err(404, "object_not_found", "Could not find block"));
      const size = Math.min(Number(u.searchParams.get("page_size") ?? 100), 100, this.pageSize);
      const start = u.searchParams.get("start_cursor");
      const from = start ? this.order.indexOf(start) : 0;
      if (from < 0) return record(err(400, "validation_error", "bad cursor"));
      const slice = this.order.slice(from, from + size);
      const more = from + size < this.order.length;
      return record(
        response(200, {
          object: "list",
          results: slice.map((id) => this.blocks.get(id)),
          next_cursor: more ? this.order[from + size] : null,
          has_more: more,
          type: "block",
          block: {},
        }),
      );
    }
    if (init.method === "PATCH" && (m = /^\/blocks\/([^/]+)\/children$/.exec(p))) {
      const id = decodeURIComponent(m[1]);
      if (id !== this.pageId) return record(err(404, "object_not_found", "Could not find block"));
      const children = (body as { children?: NotionBlock[] })?.children;
      if (!Array.isArray(children)) return record(err(400, "validation_error", "children is required"));
      if (children.length > 100) return record(err(400, "validation_error", "children length should be ≤ 100"));
      for (const c of children) {
        const v = this.checkRichText((c[c.type] as { rich_text?: unknown })?.rich_text);
        if (v) return record(err(400, "validation_error", v));
      }
      const created = children.map((c) => this.store(c));
      this.order.push(...created.map((c) => c.id as string));
      return record(response(200, { object: "list", results: created, next_cursor: null, has_more: false, type: "block", block: {} }));
    }
    if ((m = /^\/blocks\/([^/]+)$/.exec(p))) {
      const id = decodeURIComponent(m[1]);
      const b = this.blocks.get(id);
      if (!b || !this.order.includes(id)) return record(err(404, "object_not_found", "Could not find block"));
      if (init.method === "GET") return record(response(200, b));
      if (init.method === "DELETE") {
        this.order.splice(this.order.indexOf(id), 1);
        return record(response(200, { ...b, in_trash: true }));
      }
      if (init.method === "PATCH") {
        const code = (body as { code?: { rich_text?: unknown; language?: string } })?.code;
        if (b.type !== "code" || !code) return record(err(400, "validation_error", "block type mismatch"));
        const v = this.checkRichText(code.rich_text);
        if (v) return record(err(400, "validation_error", v));
        b.code = { ...(b.code as object), rich_text: this.toStored(code.rich_text), language: code.language ?? "json" };
        return record(response(200, b));
      }
    }
    return record(err(400, "invalid_request_url", `no route ${init.method} ${p}`));
  };
}

export { response as fakeResponse };
