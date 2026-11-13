// Tests for scripts/make-icons.mjs (PNG/ICO writer with the standard zlib).
// Spec: tasks/2026-11-13-p2-units-b/handoff-notes.md ("テストの入口 追加分"), assets/README.md,
// PNG (RFC 2083 / W3C PNG) and ICO (PNG-in-ICO, Vista and later) file formats.
// Run: node --test tests/make-icons.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32, encodePng, encodeIco, renderIcon, makeIconFiles } from '../scripts/make-icons.mjs';
import { REPO, makeSandbox, removeSandbox, runNode } from './build/helpers.mjs';

let sb;
before(() => {
  sb = makeSandbox('tests-mi-');
});
after(() => removeSandbox(sb));

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunksOf(png) {
  const out = [];
  let o = 8;
  while (o < png.length) {
    const len = png.readUInt32BE(o);
    const type = png.toString('latin1', o + 4, o + 8);
    const data = png.subarray(o + 8, o + 8 + len);
    const crc = png.readUInt32BE(o + 8 + len);
    out.push({ type, data, crc, typeAndData: png.subarray(o + 4, o + 8 + len) });
    o += 12 + len;
  }
  assert.equal(o, png.length, 'chunks fill the file exactly');
  return out;
}

// Decode an 8-bit RGBA PNG (non-interlaced) to a Buffer of w*h*4.
function decodePng(png) {
  assert.ok(png.subarray(0, 8).equals(SIG));
  const cs = chunksOf(png);
  const ihdr = cs[0].data;
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  assert.equal(ihdr[8], 8, 'bit depth');
  assert.equal(ihdr[9], 6, 'color type RGBA');
  assert.equal(ihdr[12], 0, 'not interlaced');
  const idat = Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);
  const bpp = 4;
  const stride = w * bpp;
  assert.equal(raw.length, h * (1 + stride));
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (1 + stride)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (1 + stride) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let r;
      if (f === 0) r = v;
      else if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else assert.fail('bad filter ' + f);
      out[y * stride + x] = r & 0xff;
    }
  }
  return { w, h, rgba: out };
}

// ---- crc32 ------------------------------------------------------------------------------
test('crc32: PNG IEND and the standard check value', () => {
  assert.equal(crc32(Buffer.from('IEND')) >>> 0, 0xae426082);
  assert.equal(crc32(Buffer.from('123456789')) >>> 0, 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)) >>> 0, 0);
});

// ---- encodePng --------------------------------------------------------------------------
test('encodePng: signature, IHDR width and height, IEND last, every chunk CRC valid', () => {
  const w = 5;
  const h = 3;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 7) & 0xff;
  const png = encodePng(w, h, rgba);
  assert.ok(Buffer.isBuffer(png));
  assert.ok(png.subarray(0, 8).equals(SIG));
  const cs = chunksOf(png);
  assert.equal(cs[0].type, 'IHDR');
  assert.equal(cs[0].data.length, 13);
  assert.equal(cs[0].data.readUInt32BE(0), w);
  assert.equal(cs[0].data.readUInt32BE(4), h);
  assert.equal(cs[cs.length - 1].type, 'IEND');
  assert.equal(cs[cs.length - 1].data.length, 0);
  assert.ok(cs.some((c) => c.type === 'IDAT'));
  for (const c of cs) assert.equal(crc32(c.typeAndData) >>> 0, c.crc, c.type);
});
test('encodePng: decodes back to the same pixels (several sizes, including non-square)', () => {
  for (const [w, h] of [[1, 1], [2, 2], [16, 16], [7, 13], [64, 32]]) {
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 31 + (i >> 3)) & 0xff;
    const d = decodePng(encodePng(w, h, rgba));
    assert.equal(d.w, w);
    assert.equal(d.h, h);
    assert.ok(d.rgba.equals(rgba), `${w}x${h}`);
  }
});
test('encodePng: a wrong rgba length throws', () => {
  assert.throws(() => encodePng(4, 4, Buffer.alloc(4 * 4 * 4 - 1)));
  assert.throws(() => encodePng(4, 4, Buffer.alloc(4 * 4 * 4 + 4)));
  assert.throws(() => encodePng(4, 4, Buffer.alloc(0)));
});
test('encodePng: the same input gives the same bytes', () => {
  const rgba = Buffer.alloc(8 * 8 * 4, 0x55);
  assert.ok(encodePng(8, 8, rgba).equals(encodePng(8, 8, rgba)));
});

// ---- encodeIco --------------------------------------------------------------------------
function pngOf(size) {
  return encodePng(size, size, Buffer.alloc(size * size * 4, 0x80));
}
test('encodeIco: header, directory entries and offsets', () => {
  const sizes = [16, 32, 48, 256];
  const items = sizes.map((size) => ({ size, png: pngOf(size) }));
  const ico = encodeIco(items);
  assert.ok(ico.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])));
  assert.equal(ico.readUInt16LE(4), sizes.length);
  let dataStart = 6 + 16 * sizes.length;
  sizes.forEach((size, i) => {
    const e = 6 + i * 16;
    const expectedByte = size === 256 ? 0 : size;
    assert.equal(ico[e], expectedByte, `width ${size}`);
    assert.equal(ico[e + 1], expectedByte, `height ${size}`);
    assert.equal(ico[e + 2], 0, 'palette');
    assert.equal(ico[e + 3], 0, 'reserved');
    assert.equal(ico.readUInt16LE(e + 4), 1, 'planes');
    assert.equal(ico.readUInt16LE(e + 6), 32, 'bit count');
    const bytes = ico.readUInt32LE(e + 8);
    const off = ico.readUInt32LE(e + 12);
    assert.equal(bytes, items[i].png.length);
    assert.ok(off >= dataStart, 'offset is after the directory');
    assert.ok(ico.subarray(off, off + 8).equals(SIG), 'offset points at the PNG signature');
    assert.ok(ico.subarray(off, off + bytes).equals(items[i].png));
  });
  assert.equal(ico.length, ico.readUInt32LE(6 + 3 * 16 + 12) + items[3].png.length, 'file ends with the last image');
});
test('encodeIco: 257 or 0 throws; empty list throws or gives an empty directory', () => {
  assert.throws(() => encodeIco([{ size: 257, png: pngOf(2) }]));
  assert.throws(() => encodeIco([{ size: 0, png: pngOf(2) }]));
});
test('encodeIco: a single entry', () => {
  const png = pngOf(32);
  const ico = encodeIco([{ size: 32, png }]);
  assert.equal(ico.readUInt16LE(4), 1);
  assert.equal(ico.readUInt32LE(6 + 12), 22);
  assert.ok(ico.subarray(22).equals(png));
});

// ---- renderIcon -------------------------------------------------------------------------
test('renderIcon: length size*size*4, transparent corners, a white pixel near the centre', () => {
  for (const size of [16, 32, 48, 64, 150, 256]) {
    const px = renderIcon(size);
    assert.equal(px.length, size * size * 4, String(size));
    const alpha = (x, y) => px[(y * size + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
      assert.equal(alpha(x, y), 0, `corner ${x},${y} of ${size}`);
    }
    let white = 0;
    const lo = Math.floor(size * 0.25);
    const hi = Math.ceil(size * 0.75);
    for (let y = lo; y < hi; y++) {
      for (let x = lo; x < hi; x++) {
        const o = (y * size + x) * 4;
        if (px[o] === 255 && px[o + 1] === 255 && px[o + 2] === 255 && px[o + 3] === 255) white++;
      }
    }
    assert.ok(white > 0, `no white pixel in the middle of ${size}`);
  }
});
test('renderIcon: deterministic', () => {
  assert.ok(Buffer.from(renderIcon(48)).equals(Buffer.from(renderIcon(48))));
});
test('renderIcon: the image has opaque and transparent pixels (not blank, not a full square)', () => {
  const px = renderIcon(64);
  let opaque = 0;
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] === 255) opaque++;
    if (px[i] === 0) clear++;
  }
  assert.ok(opaque > 0 && clear > 0);
});

// ---- makeIconFiles ----------------------------------------------------------------------
// The return shape is not fixed by the notes: accept an array of { path, data }, a Map, or an object.
function filesOf(r) {
  const entries = [];
  const pick = (o, names) => names.map((n) => o[n]).find((v) => v !== undefined);
  if (r instanceof Map) for (const [k, v] of r) entries.push([k, v]);
  else if (Array.isArray(r)) {
    for (const f of r) {
      if (Array.isArray(f)) entries.push([f[0], f[1]]);
      else entries.push([pick(f, ['path', 'rel', 'relPath', 'file', 'name']), pick(f, ['data', 'bytes', 'buffer', 'content'])]);
    }
  } else for (const [k, v] of Object.entries(r)) entries.push([k, v]);
  return entries.map(([p, d]) => [String(p).replace(/\\/g, '/'), Buffer.from(d)]);
}

test('makeIconFiles: three files with the known relative paths', () => {
  const f = filesOf(makeIconFiles());
  assert.equal(f.length, 3);
  assert.deepEqual(f.map(([p]) => p).sort(), ['resources/win32/code.ico', 'resources/win32/code_150x150.png', 'resources/win32/code_70x70.png']);
});
test('makeIconFiles: PNG sizes 70x70 and 150x150, and the ICO has the usual sizes', () => {
  const f = new Map(filesOf(makeIconFiles()));
  const p70 = decodePng(f.get('resources/win32/code_70x70.png'));
  assert.deepEqual([p70.w, p70.h], [70, 70]);
  const p150 = decodePng(f.get('resources/win32/code_150x150.png'));
  assert.deepEqual([p150.w, p150.h], [150, 150]);
  const ico = f.get('resources/win32/code.ico');
  assert.ok(ico.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])));
  const n = ico.readUInt16LE(4);
  assert.ok(n >= 1);
  const widths = [];
  for (let i = 0; i < n; i++) widths.push(ico[6 + i * 16] || 256);
  assert.ok(widths.includes(256), 'has the 256 size');
  assert.ok(widths.includes(16) && widths.includes(32), 'has 16 and 32');
});
test('makeIconFiles: fixed output - two calls give the same bytes', () => {
  const a = filesOf(makeIconFiles());
  const b = filesOf(makeIconFiles());
  assert.equal(a.length, b.length);
  a.forEach(([p, d], i) => {
    assert.equal(b[i][0], p);
    assert.ok(b[i][1].equals(d), p);
  });
});
test('makeIconFiles: the files under assets/ are exactly what the script produces', () => {
  for (const [p, d] of filesOf(makeIconFiles())) {
    const onDisk = path.join(REPO, 'assets', ...p.split('/'));
    assert.ok(fs.existsSync(onDisk), `${onDisk} is missing; run node scripts/make-icons.mjs`);
    assert.ok(fs.readFileSync(onDisk).equals(d), `${p} on disk differs from makeIconFiles()`);
  }
});

// ---- command line -----------------------------------------------------------------------
test('CLI: --out <dir> writes the three files and exits 0', () => {
  const out = path.join(sb, 'cli-out');
  const r = runNode(['scripts/make-icons.mjs', '--out', out]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const [p, d] of filesOf(makeIconFiles())) {
    const f = path.join(out, ...p.split('/'));
    assert.ok(fs.existsSync(f), f);
    assert.ok(fs.readFileSync(f).equals(d), p);
  }
});
test('CLI: an unknown argument exits 2 and writes nothing', () => {
  const out = path.join(sb, 'cli-bad');
  const r = runNode(['scripts/make-icons.mjs', '--out', out, '--bogus']);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  assert.ok(!fs.existsSync(path.join(out, 'resources')));
});
