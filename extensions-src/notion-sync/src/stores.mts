// 手元のファイルと基底（sync-base.json）の置き場所。Node.js の fs で読み書きする（vscode に依存しない）。
// テストと試しでは、同じ形のメモリの実装（memoryFileStore・memoryBaseStore）を使える。

import { promises as fsp } from "node:fs";
import * as path from "node:path";
import { FIXED_FILES, isSyncableName } from "./names.mts";
import type { BaseEntry } from "./decide.mts";

/** 同期の対象のファイル（名前は settings.json、snippets/python.json の形。区切りは /） */
export interface FileStore {
  /** 手元にある、同期の対象の名前 */
  list(): Promise<string[]>;
  /** 無ければ null */
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export interface BaseState {
  schema: 1;
  /** どのページと同期した基底か（ページを変えたら基底は使わない） */
  pageId: string;
  /** 最後に見た・書いた manifest の rev */
  rev: number;
  files: Record<string, BaseEntry>;
  syncedAt?: string;
}

export interface BaseStore {
  load(): Promise<BaseState | null>;
  save(state: BaseState): Promise<void>;
}

/**
 * 拡張の globalStorageUri（<User>/globalStorage/shuko.notion-sync）の2つ上が User フォルダ。
 * 拡張ホストは既定のプロファイルの globalStorageHome を渡す（1.146.0 の localProcessExtensionHost.ts の 540 行、
 * extHostStoragePaths.ts の 90 行、userDataProfile.ts の 196 行）。プロファイルを切り替えていても既定のプロファイルの User を指す。
 */
export function userDirFromGlobalStorage(globalStoragePath: string): string {
  return path.dirname(path.dirname(globalStoragePath));
}

/**
 * User フォルダ（例 %APPDATA%\Shuko\User）の同期の対象を読み書きする。
 * 名前は isSyncableName を通ったものだけを受け付ける（User フォルダの外へ書かない）。
 */
export function userDirFileStore(userDir: string): FileStore {
  const resolve = (name: string) => {
    if (!isSyncableName(name)) throw new Error(`同期の対象でない名前: ${name}`);
    const p = path.join(userDir, ...name.split("/"));
    const rel = path.relative(userDir, p);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`User フォルダの外: ${name}`);
    return p;
  };
  return {
    async list() {
      const out: string[] = [];
      for (const f of FIXED_FILES) {
        try {
          if ((await fsp.stat(path.join(userDir, f))).isFile()) out.push(f);
        } catch {
          // 無い
        }
      }
      try {
        for (const e of await fsp.readdir(path.join(userDir, "snippets"), { withFileTypes: true })) {
          const n = `snippets/${e.name}`;
          if (e.isFile() && isSyncableName(n)) out.push(n);
        }
      } catch {
        // snippets フォルダが無い
      }
      return out;
    },
    async read(name) {
      try {
        return await fsp.readFile(resolve(name), "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async write(name, text) {
      const p = resolve(name);
      await fsp.mkdir(path.dirname(p), { recursive: true });
      // 途中で切れたファイルを残さないよう、隣に書いてから置き換える
      const tmp = `${p}.notion-sync.tmp`;
      await fsp.writeFile(tmp, text, "utf8");
      await fsp.rename(tmp, p);
    },
    async remove(name) {
      try {
        await fsp.unlink(resolve(name));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    },
  };
}

/** 拡張の globalStorage の sync-base.json */
export function fileBaseStore(file: string): BaseStore {
  return {
    async load() {
      let text: string;
      try {
        text = await fsp.readFile(file, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
      try {
        const v = JSON.parse(text) as BaseState;
        if (v && v.schema === 1 && typeof v.pageId === "string" && v.files && typeof v.files === "object") return v;
      } catch {
        // 読めない基底は無いものとして扱う（全部が「初めて」になり、違うものは競合として見える）
      }
      return null;
    },
    async save(state) {
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
      await fsp.rename(tmp, file);
    },
  };
}

/** メモリの FileStore（テスト・試し用） */
export function memoryFileStore(initial: Record<string, string> = {}): FileStore & { files: Map<string, string> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async list() {
      return [...files.keys()].filter((n) => isSyncableName(n));
    },
    async read(name) {
      return files.has(name) ? (files.get(name) as string) : null;
    },
    async write(name, text) {
      if (!isSyncableName(name)) throw new Error(`同期の対象でない名前: ${name}`);
      files.set(name, text);
    },
    async remove(name) {
      files.delete(name);
    },
  };
}

/** メモリの BaseStore（テスト・試し用） */
export function memoryBaseStore(initial: BaseState | null = null): BaseStore & { state: BaseState | null } {
  const store = {
    state: initial ? (JSON.parse(JSON.stringify(initial)) as BaseState) : null,
    async load() {
      return store.state ? (JSON.parse(JSON.stringify(store.state)) as BaseState) : null;
    },
    async save(s: BaseState) {
      store.state = JSON.parse(JSON.stringify(s)) as BaseState;
    },
  };
  return store;
}
