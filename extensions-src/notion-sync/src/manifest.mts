// manifest のブロックの中身（docs/05 の3節）。純粋な部品。
// {"schema":1,"rev":42,"files":{"settings.json":{"sha256":"...","updatedAt":"...","machine":"DESKTOP-A"}}}

import { isSyncableName, compareNames } from "./names.mts";

export const MANIFEST_SCHEMA = 1;

export interface ManifestEntry {
  sha256: string;
  updatedAt: string;
  machine: string;
}

export interface Manifest {
  schema: number;
  rev: number;
  files: Record<string, ManifestEntry>;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

export function emptyManifest(): Manifest {
  return { schema: MANIFEST_SCHEMA, rev: 0, files: {} };
}

/**
 * manifest の本文を読む。形が違えば ManifestError（推測で直さない。ほかの PC の書いたものを壊さないため）。
 * files のうち同期の対象でない名前は捨てる。
 */
export function parseManifest(text: string): Manifest {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`manifest が JSON として読めない: ${(e as Error).message}`);
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ManifestError("manifest がオブジェクトでない");
  const o = v as Record<string, unknown>;
  if (o.schema !== MANIFEST_SCHEMA) throw new ManifestError(`manifest の schema が ${MANIFEST_SCHEMA} でない: ${String(o.schema)}`);
  if (!Number.isInteger(o.rev) || (o.rev as number) < 0) throw new ManifestError(`manifest の rev が0以上の整数でない: ${String(o.rev)}`);
  const files: Record<string, ManifestEntry> = {};
  if (o.files !== undefined) {
    if (!o.files || typeof o.files !== "object" || Array.isArray(o.files)) throw new ManifestError("manifest の files がオブジェクトでない");
    for (const [name, e] of Object.entries(o.files as Record<string, unknown>)) {
      if (!isSyncableName(name) || !e || typeof e !== "object") continue;
      const ee = e as Record<string, unknown>;
      files[name] = {
        sha256: typeof ee.sha256 === "string" ? ee.sha256 : "",
        updatedAt: typeof ee.updatedAt === "string" ? ee.updatedAt : "",
        machine: typeof ee.machine === "string" ? ee.machine : "",
      };
    }
  }
  return { schema: MANIFEST_SCHEMA, rev: o.rev as number, files };
}

/** manifest を本文にする（人が Notion で読めるように字下げする。ファイルは並べる順にそろえる） */
export function serializeManifest(m: Manifest): string {
  const files: Record<string, ManifestEntry> = {};
  for (const name of Object.keys(m.files).sort(compareNames)) files[name] = m.files[name];
  return JSON.stringify({ schema: m.schema, rev: m.rev, files }, null, 2);
}

/**
 * 書き出した後の manifest を作る。rev を1つ上げ、書き出したファイルの項目を置き換え、消したファイルの項目を除く。
 * 書き出さなかったファイルの項目は前のまま残す。
 * healed: Notion で手で直されて本文と sha256 が合わなくなっていた項目。sha256 だけを本文に合わせる
 * （updatedAt と machine は前のまま。誰がいつ直したかは分からないため）。項目が無ければ（Notion で見出しごと足された）
 * updatedAt と machine を空文字にして作る。
 */
export function nextManifest(
  prev: Manifest,
  changes: { written: Array<{ name: string; sha256: string }>; deleted: string[]; healed?: Array<{ name: string; sha256: string }> },
  machine: string,
  now: Date,
): Manifest {
  const files: Record<string, ManifestEntry> = { ...prev.files };
  const updatedAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  for (const h of changes.healed ?? []) {
    files[h.name] = files[h.name] ? { ...files[h.name], sha256: h.sha256 } : { sha256: h.sha256, updatedAt: "", machine: "" };
  }
  for (const w of changes.written) files[w.name] = { sha256: w.sha256, updatedAt, machine };
  for (const d of changes.deleted) delete files[d];
  return { schema: MANIFEST_SCHEMA, rev: prev.rev + 1, files };
}
