// 同期の流れ（docs/05 の4節・6節）。vscode に依存しない。Notion API・手元のファイル・基底・時計を差し替えられる。
//
// 1回の同期:
//   1. 手元を読む（settings.json は ignoredSettings を除いた「共有する形」にする）
//   2. ページの子のブロックを全部読み、manifest と本文を取り出す
//   3. ファイルごとに decide（手元・Notion・基底）
//   4. 取り込み（手元に書く）→ 基底を保存
//   5. 書き出し: manifest を読み直して rev を確かめ → 変わったファイルのコードブロックを書き換え・足し・消し →
//      最後に manifest を書き換える（rev を1つ上げる）→ 基底を保存
// 競合は自動でマージしない。結果の conflicts に入れて返し、基底を動かさない。

import { decideAll, type BaseEntry, type FileDecision } from "./decide.mts";
import { emptyManifest, nextManifest, serializeManifest, ManifestError, parseManifest, type Manifest } from "./manifest.mts";
import { compareNames, MANIFEST_HEADING } from "./names.mts";
import { chunkForAppend, NetworkError, type NotionApi, type NotionBlock } from "./notion-client.mts";
import { parsePage, headingBlock, codeBlock, type PageState } from "./page.mts";
import { jsoncErrors, mergeIgnored, stripIgnored } from "./settings-filter.mts";
import type { BaseState, BaseStore, FileStore } from "./stores.mts";
import { canonicalize, detectEol, fromRichText, hashText, toLocalText, toRichText, TooLargeError } from "./text.mts";

export type SyncMode = "both" | "import" | "export";
export type ForceChoice = "local" | "remote";

export interface SyncDeps {
  api: NotionApi;
  store: FileStore;
  baseStore: BaseStore;
  /** ハイフン付きのページの ID（normalizePageId を通したもの） */
  pageId: string;
  ignoredSettings: readonly string[];
  /** 書き出した PC の名前（os.hostname()） */
  machine: string;
  now: () => Date;
  /** 手元に新しく作るファイルの改行（Windows は CRLF） */
  defaultEol: "\r\n" | "\n";
  log?: (message: string) => void;
}

export interface SyncOptions {
  mode?: SyncMode;
  /** 競合の解き方。local＝手元を採る（書き出す）、remote＝Notion を採る（取り込む） */
  force?: Readonly<Record<string, ForceChoice>>;
}

export interface ConflictInfo {
  name: string;
  /** 手元の共有する形（canonical）。無ければ null */
  local: string | null;
  /** Notion の本文（canonical）。無ければ null */
  remote: string | null;
  /** Notion を採ったときに手元が成る中身（settings.json は手元の ignoredSettings の値を足した形）。無ければ null */
  remoteAsLocal: string | null;
}

export type SyncStatus = "synced" | "conflict" | "offline" | "error";

export interface SyncResult {
  status: SyncStatus;
  /** 終わった時点の manifest の rev（読めなかったときは null） */
  rev: number | null;
  imported: string[];
  exported: string[];
  /** Notion で消えていたので手元から消したもの */
  deletedLocal: string[];
  /** 手元で消えていたので Notion から消したもの */
  deletedRemote: string[];
  conflicts: ConflictInfo[];
  /** mode のため今回は行わなかったもの（import のときの書き出し、export のときの取り込み） */
  pending: Array<{ name: string; decision: "import" | "export" }>;
  /** 構文の誤りなどで扱わなかったもの */
  skipped: Array<{ name: string; reason: string }>;
  warnings: string[];
  /** Notion を呼んだか（export のとき、手元に変わりが無ければ呼ばない） */
  contacted: boolean;
  error?: string;
}

/** 書き出す直前に manifest を読み直したら rev が変わっていた（ほかの PC が書いた） */
export class RevChangedError extends Error {
  readonly expected: number;
  readonly actual: number;
  constructor(expected: number, actual: number) {
    super(`manifest の rev が読んだときの ${expected} から ${actual} に変わった（ほかの PC が書いた）`);
    this.name = "RevChangedError";
    this.expected = expected;
    this.actual = actual;
  }
}

const SETTINGS = "settings.json";

function emptyResult(): SyncResult {
  return {
    status: "synced", rev: null, imported: [], exported: [], deletedLocal: [], deletedRemote: [],
    conflicts: [], pending: [], skipped: [], warnings: [], contacted: false,
  };
}

/** 手元の本文を、共有する形（canonical。settings.json は ignoredSettings を除く）にする */
export function sharedForm(name: string, raw: string, ignored: readonly string[]): string {
  return name === SETTINGS ? stripIgnored(raw, ignored) : canonicalize(raw);
}

/** Notion の本文を、手元に書く中身（canonical）にする */
export function remoteAsLocal(name: string, remote: string, localRaw: string | null, ignored: readonly string[]): string {
  return name === SETTINGS ? mergeIgnored(remote, localRaw, ignored) : canonicalize(remote);
}

interface LocalSnapshot {
  raw: Map<string, string>;
  shared: Map<string, string>;
  hash: Map<string, string | null>;
  invalid: Map<string, string>;
}

async function readLocal(deps: SyncDeps): Promise<LocalSnapshot> {
  const snap: LocalSnapshot = { raw: new Map(), shared: new Map(), hash: new Map(), invalid: new Map() };
  for (const name of await deps.store.list()) {
    const raw = await deps.store.read(name);
    if (raw == null) continue;
    snap.raw.set(name, raw);
    const errs = jsoncErrors(raw);
    if (errs.length > 0) {
      snap.invalid.set(name, `JSONC の構文の誤りが ${errs.length} 個ある（直すまで同期しない）`);
      continue;
    }
    const shared = sharedForm(name, raw, deps.ignoredSettings);
    snap.shared.set(name, shared);
    snap.hash.set(name, hashText(shared));
  }
  return snap;
}

function freshBase(pageId: string): BaseState {
  return { schema: 1, pageId, rev: 0, files: {} };
}

/** export のとき、手元が基底から変わったファイルがあるか（Notion を呼ぶ前の近道） */
export function hasLocalChanges(localHash: ReadonlyMap<string, string | null>, base: BaseState): boolean {
  for (const [name, h] of localHash) if ((base.files[name]?.local ?? null) !== h) return true;
  for (const [name, e] of Object.entries(base.files)) if (e.local !== null && !localHash.has(name)) return true;
  return false;
}

/**
 * 1回同期する。ネットワークの失敗は status "offline"、それ以外の失敗は "error" で返す（例外にしない）。
 * 書き出す直前に rev が変わっていたら、1回だけ最初からやり直す。
 */
export async function runSync(deps: SyncDeps, opts: SyncOptions = {}): Promise<SyncResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await syncOnce(deps, opts);
    } catch (e) {
      const r = emptyResult();
      r.contacted = true;
      if (e instanceof RevChangedError && attempt === 0) {
        deps.log?.(`${e.message}。読み直してやり直す`);
        continue;
      }
      if (e instanceof NetworkError) {
        r.status = "offline";
      } else {
        r.status = "error";
      }
      r.error = (e as Error)?.message ?? String(e);
      deps.log?.(`同期に失敗: ${r.error}`);
      return r;
    }
  }
  /* c8 ignore next */
  throw new Error("unreachable");
}

/** 1回の同期の本体（失敗は例外で返す） */
export async function syncOnce(deps: SyncDeps, opts: SyncOptions = {}): Promise<SyncResult> {
  const mode: SyncMode = opts.mode ?? "both";
  const force = opts.force ?? {};
  const log = deps.log ?? (() => {});
  const result = emptyResult();

  let base = await deps.baseStore.load();
  if (!base || base.pageId !== deps.pageId) base = freshBase(deps.pageId);

  // 1. 手元
  const local = await readLocal(deps);
  for (const [name, reason] of local.invalid) result.skipped.push({ name, reason });

  if (mode === "export" && Object.keys(force).length === 0) {
    // 構文の誤りで読めなかったファイルは「変わっていない」とみなす（基底に戻して比べる）
    const comparable = new Map(local.hash);
    for (const name of local.invalid.keys()) comparable.set(name, base.files[name]?.local ?? null);
    if (!hasLocalChanges(comparable, base)) {
      result.rev = base.rev;
      return result;
    }
  }

  // 2. Notion
  result.contacted = true;
  const page: PageState = parsePage(await deps.api.listChildren(deps.pageId));
  result.warnings.push(...page.warnings);
  if (!page.manifest && page.files.size > 0) {
    throw new ManifestError("ページにファイルの見出しはあるが manifest が無い。manifest の見出しとコードブロックを戻してから同期する");
  }
  const manifest: Manifest = page.manifest ?? emptyManifest();
  const readRev = manifest.rev;
  const remoteText = new Map<string, string>();
  const remoteHash = new Map<string, string | null>();
  for (const [name, f] of page.files) {
    const t = canonicalize(f.text);
    remoteText.set(name, t);
    const h = hashText(t);
    remoteHash.set(name, h);
    const m = manifest.files[name];
    if (!m || m.sha256 !== h) result.warnings.push(`Notion の ${name} は manifest と合わない（Notion で直されたものとして扱う）`);
  }

  // 3. 判断
  const localForDecision = new Map(local.hash);
  for (const name of local.invalid.keys()) localForDecision.delete(name);
  const decisions: FileDecision[] = decideAll(localForDecision, remoteHash, base.files)
    .filter((d) => !local.invalid.has(d.name))
    .sort((a, b) => compareNames(a.name, b.name));

  for (const d of decisions) {
    const f = force[d.name];
    if (!f) continue;
    if (d.local === d.remote) d.decision = "converged";
    else d.decision = f === "local" ? "export" : "import";
  }

  const imports: FileDecision[] = [];
  const exports: FileDecision[] = [];
  for (const d of decisions) {
    switch (d.decision) {
      case "none":
      case "converged":
        base.files[d.name] = { local: d.local, remote: d.remote };
        break;
      case "conflict": {
        const r = remoteText.get(d.name) ?? null;
        result.conflicts.push({
          name: d.name,
          local: local.shared.get(d.name) ?? null,
          remote: r,
          remoteAsLocal: r === null ? null : remoteAsLocal(d.name, r, local.raw.get(d.name) ?? null, deps.ignoredSettings),
        });
        break;
      }
      case "import":
        if (mode === "export") result.pending.push({ name: d.name, decision: "import" });
        else imports.push(d);
        break;
      case "export":
        if (mode === "import") result.pending.push({ name: d.name, decision: "export" });
        else exports.push(d);
        break;
    }
  }

  // 書き出すものが上限を超えないかを、何かを書く前に確かめる
  const exportBlocks = new Map<string, NotionBlock>();
  for (const d of exports) {
    if (d.local === null) continue;
    try {
      exportBlocks.set(d.name, codeBlock(local.shared.get(d.name) as string));
    } catch (e) {
      if (e instanceof TooLargeError) throw new TooLargeError(`${d.name}: ${e.message}`, e.chars, e.items);
      throw e;
    }
  }

  // 4. 取り込み
  for (const d of imports) {
    const raw = local.raw.get(d.name) ?? null;
    if (d.remote === null) {
      await deps.store.remove(d.name);
      result.deletedLocal.push(d.name);
      base.files[d.name] = { local: null, remote: null };
      log(`取り込み: ${d.name} を手元から消した（Notion に無い）`);
      continue;
    }
    const remote = remoteText.get(d.name) as string;
    const remoteErrs = jsoncErrors(remote);
    if (remoteErrs.length > 0) {
      result.skipped.push({ name: d.name, reason: `Notion の本文に JSONC の構文の誤りが ${remoteErrs.length} 個ある（取り込まない）` });
      continue;
    }
    const content = remoteAsLocal(d.name, remote, raw, deps.ignoredSettings);
    const written = toLocalText(content, detectEol(raw) ?? deps.defaultEol);
    await deps.store.write(d.name, written);
    result.imported.push(d.name);
    base.files[d.name] = { local: hashText(sharedForm(d.name, written, deps.ignoredSettings)), remote: d.remote };
    log(`取り込み: ${d.name}`);
  }
  if (imports.length > 0) {
    base.syncedAt = deps.now().toISOString();
    await deps.baseStore.save(dropEmpty(base));
  }

  // 5. 書き出し
  let finalRev = readRev;
  if (exports.length > 0) {
    let manifestCodeId = page.manifestCodeId;
    if (manifestCodeId) {
      const blk = await deps.api.getBlock(manifestCodeId);
      const cur = parseManifest(fromRichText((blk.code as { rich_text?: unknown } | undefined)?.rich_text));
      if (cur.rev !== readRev) throw new RevChangedError(readRev, cur.rev);
    } else {
      // 空のページ: 先に manifest（rev 0。まだ何も書いていない印）を置く
      const created = await deps.api.appendChildren(deps.pageId, [headingBlock(MANIFEST_HEADING), codeBlock(serializeManifest(emptyManifest()))]);
      manifestCodeId = created.find((b) => b.type === "code")?.id ?? null;
      if (!manifestCodeId) throw new Error("manifest のコードブロックを作れなかった（応答に ID が無い）");
      log("ページに manifest を作った");
    }

    const written: Array<{ name: string; sha256: string }> = [];
    const deleted: string[] = [];
    const appendGroups: NotionBlock[][] = [];
    const appendNames: string[] = [];
    for (const d of exports) {
      const existing = page.files.get(d.name);
      if (d.local === null) {
        if (existing) {
          await deps.api.deleteBlock(existing.codeId);
          await deps.api.deleteBlock(existing.headingId);
        }
        deleted.push(d.name);
        result.deletedRemote.push(d.name);
        log(`書き出し: ${d.name} を Notion から消した（手元に無い）`);
        continue;
      }
      const block = exportBlocks.get(d.name) as NotionBlock;
      if (existing) {
        await deps.api.updateCode(existing.codeId, (block.code as { rich_text: unknown[] }).rich_text, "json");
      } else {
        appendGroups.push([headingBlock(d.name), block]);
        appendNames.push(d.name);
      }
      written.push({ name: d.name, sha256: d.local });
      result.exported.push(d.name);
      log(`書き出し: ${d.name}`);
    }
    for (const chunk of chunkForAppend(appendGroups)) await deps.api.appendChildren(deps.pageId, chunk);

    // manifest を本文に合わせ直す: Notion で手で直された本文の sha256、見出しごと消された項目
    const touched = new Set(exports.map((d) => d.name));
    const healed: Array<{ name: string; sha256: string }> = [];
    for (const [name, h] of remoteHash) {
      if (!touched.has(name) && h !== null && manifest.files[name]?.sha256 !== h) healed.push({ name, sha256: h });
    }
    const stale = Object.keys(manifest.files).filter((n) => !touched.has(n) && !page.files.has(n));
    const next = nextManifest(manifest, { written, deleted: [...deleted, ...stale], healed }, deps.machine, deps.now());
    await deps.api.updateCode(manifestCodeId, toRichText(serializeManifest(next)), "json");
    finalRev = next.rev;
    log(`manifest を rev ${next.rev} にした`);

    for (const w of written) base.files[w.name] = { local: w.sha256, remote: w.sha256 };
    for (const n of deleted) base.files[n] = { local: null, remote: null };
  }

  base.rev = finalRev;
  base.syncedAt = deps.now().toISOString();
  await deps.baseStore.save(dropEmpty(base));

  result.rev = finalRev;
  result.status = result.conflicts.length > 0 ? "conflict" : "synced";
  return result;
}

function dropEmpty(base: BaseState): BaseState {
  const files: Record<string, BaseEntry> = {};
  for (const [n, e] of Object.entries(base.files)) if (e.local !== null || e.remote !== null) files[n] = e;
  return { ...base, files };
}

/** 差分を見るための材料（Notion を読むだけで、何も書かない） */
export async function readDiffs(deps: SyncDeps): Promise<ConflictInfo[]> {
  const local = await readLocal(deps);
  const page = parsePage(await deps.api.listChildren(deps.pageId));
  const names = new Set<string>([...local.raw.keys(), ...page.files.keys()]);
  const out: ConflictInfo[] = [];
  for (const name of [...names].sort(compareNames)) {
    const raw = local.raw.get(name) ?? null;
    const remote = page.files.has(name) ? canonicalize((page.files.get(name) as { text: string }).text) : null;
    const l = local.shared.get(name) ?? (raw !== null ? canonicalize(raw) : null);
    if (l === remote) continue;
    out.push({
      name,
      local: l,
      remote,
      remoteAsLocal: remote === null ? null : remoteAsLocal(name, remote, raw, deps.ignoredSettings),
    });
  }
  return out;
}
