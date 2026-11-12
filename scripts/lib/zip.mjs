// zip（VSIX・.sigzip）の読み出し。Node.js の標準だけで書く（中央ディレクトリを読む。ZIP64 も読む）。
// 使うのは、ファイルの一覧（名前とサイズ）と、1つのエントリーのハッシュ・書き出し・読み出しだけ。
// JS の中身を開かないこと（裁定）は呼ぶ側が守る。ここはバイト列を扱うだけで中身を解釈しない。

import fs from "node:fs";
import { createHash } from "node:crypto";
import { createInflateRaw } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

async function readAt(fh, position, length) {
  const buf = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const { bytesRead } = await fh.read(buf, done, length - done, position + done);
    if (bytesRead === 0) throw new Error(`zip: ファイルの終わりを越えて読もうとした（位置 ${position + done}）`);
    done += bytesRead;
  }
  return buf;
}

function u64(buf, offset) {
  const v = buf.readBigUInt64LE(offset);
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("zip: 値が大きすぎる");
  return Number(v);
}

// zip の中央ディレクトリを読み、エントリーの配列を返す。
// 各要素: { name, size（展開後）, compressedSize, method, crc32, localHeaderOffset, isDirectory }
export async function listZip(file) {
  const fh = await fs.promises.open(file, "r");
  try {
    const { size: fileSize } = await fh.stat();
    const tailLen = Math.min(fileSize, 22 + 0xffff + 20);
    const tail = await readAt(fh, fileSize - tailLen, tailLen);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === SIG_EOCD) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`zip: 終わりのレコードが見つからない: ${file}`);
    let total = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || tail.readUInt32LE(loc) !== SIG_ZIP64_LOCATOR) throw new Error("zip: ZIP64 の位置のレコードが無い");
      const z64Offset = u64(tail, loc + 8);
      const z64 = await readAt(fh, z64Offset, 56);
      if (z64.readUInt32LE(0) !== SIG_ZIP64_EOCD) throw new Error("zip: ZIP64 の終わりのレコードが無い");
      total = u64(z64, 32);
      cdSize = u64(z64, 40);
      cdOffset = u64(z64, 48);
    }
    const cd = await readAt(fh, cdOffset, cdSize);
    const entries = [];
    let p = 0;
    for (let i = 0; i < total; i++) {
      if (cd.readUInt32LE(p) !== SIG_CENTRAL) throw new Error(`zip: 中央ディレクトリの ${i} 件目が壊れている`);
      const flags = cd.readUInt16LE(p + 8);
      const method = cd.readUInt16LE(p + 10);
      const crc32 = cd.readUInt32LE(p + 16);
      let compressedSize = cd.readUInt32LE(p + 20);
      let size = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      let localHeaderOffset = cd.readUInt32LE(p + 42);
      const nameBuf = cd.subarray(p + 46, p + 46 + nameLen);
      const name = flags & 0x800 ? nameBuf.toString("utf8") : nameBuf.toString("latin1");
      const extra = cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
      let q = 0;
      while (q + 4 <= extra.length) {
        const id = extra.readUInt16LE(q);
        const len = extra.readUInt16LE(q + 2);
        if (id === 0x0001) {
          let r = q + 4;
          if (size === 0xffffffff) {
            size = u64(extra, r);
            r += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = u64(extra, r);
            r += 8;
          }
          if (localHeaderOffset === 0xffffffff) {
            localHeaderOffset = u64(extra, r);
            r += 8;
          }
        }
        q += 4 + len;
      }
      entries.push({
        name,
        size,
        compressedSize,
        method,
        crc32,
        localHeaderOffset,
        isDirectory: name.endsWith("/"),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    await fh.close();
  }
}

async function dataRange(file, entry) {
  const fh = await fs.promises.open(file, "r");
  try {
    const head = await readAt(fh, entry.localHeaderOffset, 30);
    if (head.readUInt32LE(0) !== SIG_LOCAL) throw new Error(`zip: ローカルヘッダーが壊れている: ${entry.name}`);
    const start = entry.localHeaderOffset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
    return { start, end: start + entry.compressedSize - 1 };
  } finally {
    await fh.close();
  }
}

// エントリーの展開後のバイト列の読み出しストリーム（stored と deflate だけ）。
async function entryStream(file, entry) {
  if (entry.method !== 0 && entry.method !== 8) throw new Error(`zip: 扱えない圧縮の方式 ${entry.method}: ${entry.name}`);
  if (entry.compressedSize === 0) {
    const { Readable } = await import("node:stream");
    return Readable.from([]);
  }
  const { start, end } = await dataRange(file, entry);
  const raw = fs.createReadStream(file, { start, end });
  if (entry.method === 0) return raw;
  const inflate = createInflateRaw();
  raw.on("error", (err) => inflate.destroy(err));
  return raw.pipe(inflate);
}

function hashingTransform(hash) {
  let bytes = 0;
  const t = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      bytes += chunk.length;
      cb(null, chunk);
    },
  });
  t.bytes = () => bytes;
  return t;
}

// エントリーの展開後の SHA-256（16進の小文字）とバイト数。
export async function hashZipEntry(file, entry) {
  const hash = createHash("sha256");
  const stream = await entryStream(file, entry);
  let bytes = 0;
  for await (const chunk of stream) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  if (bytes !== entry.size) throw new Error(`zip: 展開後のサイズが合わない: ${entry.name}（${bytes} / ${entry.size}）`);
  return { sha256: hash.digest("hex"), bytes };
}

// エントリーを dest に書き出し、その SHA-256 を返す。
export async function extractZipEntry(file, entry, dest) {
  const hash = createHash("sha256");
  const t = hashingTransform(hash);
  const stream = await entryStream(file, entry);
  await pipeline(stream, t, fs.createWriteStream(dest));
  if (t.bytes() !== entry.size) throw new Error(`zip: 展開後のサイズが合わない: ${entry.name}（${t.bytes()} / ${entry.size}）`);
  return { sha256: hash.digest("hex"), bytes: t.bytes() };
}

// 小さなエントリーをバッファに読む（.sigzip の中身、LICENSE、package.json など。JS には使わない）。
export async function readZipEntry(file, entry, maxBytes = 16 * 1024 * 1024) {
  if (entry.size > maxBytes) throw new Error(`zip: ${entry.name} が大きすぎる（${entry.size} バイト）`);
  const stream = await entryStream(file, entry);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
