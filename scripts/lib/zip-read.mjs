// zip（VSIX）の中のファイルを1つ取り出す最小の読み手。Node の標準だけで書く。
// 対応: 格納（0）と deflate（8）。zip64 と暗号化は扱わない（VSIX では使われない見込み。出会ったら止める）。

import { inflateRawSync } from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

function findEocd(buf) {
  // 末尾のコメントは最大 65535 バイト
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error('zip の終端（EOCD）が見つからない');
}

/** zip の中のエントリの一覧 `{ name, method, compressedSize, size, localOffset }` を返す。 */
export function listEntries(buf) {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cenOffset = buf.readUInt32LE(eocd + 16);
  if (cenOffset === 0xffffffff || count === 0xffff) throw new Error('zip64 は扱わない');
  const entries = [];
  let p = cenOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== SIG_CEN) throw new Error(`中央ディレクトリの署名が違う（位置 ${p}）`);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString((flags & 0x800) ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
    entries.push({ name, method, flags, compressedSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 名前が一致するエントリの中身を Buffer で返す。無ければ null。 */
export function readEntry(buf, name) {
  const e = listEntries(buf).find((x) => x.name === name);
  if (!e) return null;
  if (e.flags & 0x1) throw new Error(`${name} は暗号化されている`);
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== SIG_LOC) throw new Error(`ローカルヘッダの署名が違う（${name}）`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return Buffer.from(data);
  if (e.method === 8) return inflateRawSync(data);
  throw new Error(`${name} の圧縮方式 ${e.method} は扱わない`);
}
