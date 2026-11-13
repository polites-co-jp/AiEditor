// 仮のアイコン（PNG と ICO）を書き出す。Node.js の標準の部品（zlib・fs・path・url）だけを使う。
//
// 意匠は assets/src/vs/workbench/browser/media/code-icon.svg と同じ（自作。他者の著作物は使わない）:
//   1024×1024 の座標で、角の丸い四角（64〜960、角の半径 192、色 #2E6DA4）の上に、
//   白い線（太さ 88、端と角は丸い）で `>`（272,336 → 480,512 → 272,688）と `_`（544,688 → 752,688）。
//
// 使い方:
//   node scripts/make-icons.mjs [--out <dir>]
//     既定の出力先は assets/（リポジトリの直下の assets）。次の3つを書く:
//       <dir>/resources/win32/code.ico          16・24・32・48・64・128・256 px（どれも PNG で格納）
//       <dir>/resources/win32/code_70x70.png
//       <dir>/resources/win32/code_150x150.png
//   同じ入力からは毎回同じバイト列になる（時刻などを入れない）。
//
// テストの入口（export）:
//   ICON_SIZES                    → [16, 24, 32, 48, 64, 128, 256]
//   crc32(buf)                    → 符号なし32ビットの整数
//   coverageAt(x, y)              → 1024 の座標の1点の色 { kind: "stroke" | "fill" | "none" }
//   renderIcon(size, samples?)    → 長さ size*size*4 の Buffer（RGBA、ストレートアルファ）
//   encodePng(width, height, rgba) → PNG の Buffer
//   encodeIco(images)             → ICO の Buffer。images は [{ size, png }]
//   makeIconFiles()               → [{ rel, data }]（書き出すファイルの相対パスと中身）

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

const FILL = [0x2e, 0x6d, 0xa4];
const STROKE = [0xff, 0xff, 0xff];
const RECT = { x0: 64, y0: 64, x1: 960, y1: 960, r: 192 };
const HALF_WIDTH = 44; // 線の太さ 88 の半分
const SEGMENTS = [
  [272, 336, 480, 512],
  [480, 512, 272, 688],
  [544, 688, 752, 688],
];

// ---- CRC-32（PNG の塊の検査値） ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- 図形 ----
function insideRoundedRect(x, y) {
  const { x0, y0, x1, y1, r } = RECT;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return dx * dx + dy * dy;
}

function insideStroke(x, y) {
  const h2 = HALF_WIDTH * HALF_WIDTH;
  return SEGMENTS.some(([ax, ay, bx, by]) => distanceToSegmentSquared(x, y, ax, ay, bx, by) <= h2);
}

export function coverageAt(x, y) {
  if (insideStroke(x, y)) return { kind: "stroke" };
  if (insideRoundedRect(x, y)) return { kind: "fill" };
  return { kind: "none" };
}

// 1画素を samples×samples の点で数え、色を平均する（なめらかな縁にするため）。
export function renderIcon(size, samples = size <= 64 ? 8 : 4) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`大きさが正の整数でない: ${size}`);
  const out = Buffer.alloc(size * size * 4);
  const scale = 1024 / size;
  const n = samples * samples;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) * scale;
          const y = (py + (sy + 0.5) / samples) * scale;
          const { kind } = coverageAt(x, y);
          const c = kind === "stroke" ? STROKE : kind === "fill" ? FILL : null;
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a);
        out[i + 1] = Math.round(g / a);
        out[i + 2] = Math.round(b / a);
        out[i + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return out;
}

// ---- PNG ----
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error("RGBA の長さが width*height*4 でない");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // ビットの深さ
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // フィルターなし
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- ICO（各画像を PNG のまま格納する。Windows Vista 以降で読める形） ----
export function encodeIco(images) {
  if (!Array.isArray(images) || images.length === 0) throw new Error("画像が無い");
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // アイコン
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`ICO に入らない大きさ: ${size}`);
    const e = Buffer.alloc(16);
    e[0] = size === 256 ? 0 : size;
    e[1] = size === 256 ? 0 : size;
    e[2] = 0; // 色の数（パレットなし）
    e[3] = 0;
    e.writeUInt16LE(1, 4); // 面の数
    e.writeUInt16LE(32, 6); // 1画素のビット数
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

export function makeIconFiles() {
  const png = (size) => encodePng(size, size, renderIcon(size));
  const ico = encodeIco(ICON_SIZES.map((size) => ({ size, png: png(size) })));
  return [
    { rel: "resources/win32/code.ico", data: ico },
    { rel: "resources/win32/code_70x70.png", data: png(70) },
    { rel: "resources/win32/code_150x150.png", data: png(150) },
  ];
}

function main(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let outDir = path.join(repoRoot, "assets");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) outDir = path.resolve(argv[++i]);
    else {
      console.error(`知らない引数: ${argv[i]}\n使い方: node scripts/make-icons.mjs [--out <dir>]`);
      return 2;
    }
  }
  for (const { rel, data } of makeIconFiles()) {
    const file = path.join(outDir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    console.log(`[make-icons] ${path.relative(repoRoot, file)} (${data.length} bytes)`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
