// Tests for scripts/make-icons.mjs (PNG/ICO writer with the standard zlib).
// Spec: tasks/2026-11-13-p2-units-b/handoff-notes.md ("テストの入口 追加分"), assets/README.md,
// PNG (RFC 2083 / W3C PNG) and ICO (PNG-in-ICO, Vista and later) file formats.
// Run: node --test tests/make-icons.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32, encodePng, encodeIco, renderIcon, makeIconFiles, makeSvgFiles, DEFAULT_VARIANT, VARIANTS, resolveVariant } from '../scripts/make-icons.mjs';
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
test('renderIcon: length size*size*4, transparent corners, an opaque pixel near the centre (any design)', () => {
  for (const size of [16, 32, 48, 64, 150, 256]) {
    const px = renderIcon(size);
    assert.equal(px.length, size * size * 4, String(size));
    const alpha = (x, y) => px[(y * size + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
      assert.equal(alpha(x, y), 0, `corner ${x},${y} of ${size}`);
    }
    let opaque = 0;
    const lo = Math.floor(size * 0.25);
    const hi = Math.ceil(size * 0.75);
    for (let y = lo; y < hi; y++) {
      for (let x = lo; x < hi; x++) if (alpha(x, y) === 255) opaque++;
    }
    assert.ok(opaque > 0, `no opaque pixel in the middle of ${size}`);
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

// ---- design: Claude + VS Code composite (2026-11-17 decision; holds for any candidate) ----------------------
// The checks look at what the script writes with `--out <dir>` (ICO, PNGs, SVGs), so they do not depend on the candidate.
// Which candidate: env ICON_TEST_ARGS_LIST = a ';'-separated list of extra argument strings, one run each,
// e.g. "--variant a;--variant b;--variant c" (default: one run with no extra argument = the script's default design).
// 2026-11-17 の裁定: 既定は候補 A（center-spark）。環境変数が無いときは「引数なし（= 既定）」と「--variant center-spark」の2回走らせる。
const ARGS_LIST = (process.env.ICON_TEST_ARGS_LIST ?? '').split(';').map((s) => s.trim().split(/\s+/).filter(Boolean));
if (ARGS_LIST.length === 0 || (ARGS_LIST.length === 1 && ARGS_LIST[0].length === 0)) ARGS_LIST.splice(0, ARGS_LIST.length, [], ['--variant', 'center-spark']);

// VS Code blue family (#007ACC, #0065A9, #1F9CF0, #75BEFF ...) and Claude orange family (#D97757 ...).
const isBlue = (r, g, b) => b >= 120 && b - r >= 60 && b >= g;
const isOrange = (r, g, b) => r >= 170 && r - b >= 70 && r - g >= 40 && g >= b;

function countColors(rgba, minAlpha = 200) {
  let blue = 0;
  let orange = 0;
  let opaque = 0;
  let clear = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0) clear++;
    if (a < minAlpha) continue;
    opaque++;
    if (isBlue(rgba[i], rgba[i + 1], rgba[i + 2])) blue++;
    if (isOrange(rgba[i], rgba[i + 1], rgba[i + 2])) orange++;
  }
  return { blue, orange, opaque, clear, total: rgba.length / 4 };
}

function icoImages(ico) {
  assert.ok(ico.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])));
  const n = ico.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + i * 16;
    const size = ico[e] || 256;
    const bytes = ico.readUInt32LE(e + 8);
    const off = ico.readUInt32LE(e + 12);
    out.push({ size, png: ico.subarray(off, off + bytes) });
  }
  return out;
}

// Minimal well-formedness check for the SVGs we write: tags balance, one <svg> root, no text or script.
function checkSvg(text, label) {
  const body = text.replace(/^﻿/, '').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  assert.ok(/^<svg[\s>]/.test(body), `${label}: root is <svg>`);
  assert.ok(/<\/svg>\s*$/.test(body), `${label}: ends with </svg>`);
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(body))) {
    const [, close, name, , self] = m;
    if (close) assert.equal(stack.pop(), name, `${label}: </${name}> closes the open tag`);
    else if (!self) stack.push(name);
  }
  assert.deepEqual(stack, [], `${label}: every tag is closed`);
  assert.ok(/viewBox="[^"]+"/.test(body) || /width="\d+/.test(body), `${label}: has a size (viewBox or width)`);
  assert.ok(!/<(script|text|foreignObject)\b/i.test(body), `${label}: no script, text or foreignObject (no product names in the picture)`);
  assert.ok(!/(href|src)\s*=\s*["']https?:/i.test(body), `${label}: no external reference`);
  return body;
}

function walk(dir) {
  const out = [];
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

ARGS_LIST.forEach((extra, idx) => {
  const label = extra.length ? extra.join(' ') : '(default)';
  const dirName = `design-${idx}`;
  const outDir = () => path.join(sb, dirName);
  let ran = false;
  const ensure = () => {
    if (ran) return;
    const r = runNode(['scripts/make-icons.mjs', '--out', outDir(), ...extra]);
    assert.equal(r.status, 0, `${label}: ${r.stderr}${r.stdout}`);
    ran = true;
  };

  test(`design ${label}: code.ico has exactly the seven sizes, each a PNG of that size`, () => {
    ensure();
    const ico = fs.readFileSync(path.join(outDir(), 'resources', 'win32', 'code.ico'));
    const imgs = icoImages(ico);
    assert.deepEqual(imgs.map((i) => i.size), [16, 24, 32, 48, 64, 128, 256]);
    for (const i of imgs) {
      const d = decodePng(Buffer.from(i.png));
      assert.deepEqual([d.w, d.h], [i.size, i.size]);
    }
  });
  test(`design ${label}: 70x70 and 150x150 PNGs have the right size`, () => {
    ensure();
    for (const s of [70, 150]) {
      const d = decodePng(fs.readFileSync(path.join(outDir(), 'resources', 'win32', `code_${s}x${s}.png`)));
      assert.deepEqual([d.w, d.h], [s, s]);
    }
  });
  test(`design ${label}: 256 px has both VS Code blue and Claude orange pixels, in quantity; not blank, not a full square`, () => {
    ensure();
    const ico = fs.readFileSync(path.join(outDir(), 'resources', 'win32', 'code.ico'));
    const d = decodePng(Buffer.from(icoImages(ico).find((i) => i.size === 256).png));
    const c = countColors(d.rgba);
    assert.ok(c.blue >= 256, `blue pixels ${c.blue}`);
    assert.ok(c.orange >= 256, `orange pixels ${c.orange}`);
    assert.ok(c.clear > 0 && c.opaque > c.total * 0.1, `opaque ${c.opaque}, clear ${c.clear}`);
    // The orange must be near #D97757 in the strongest cluster: the most common orange pixel is within 40 of it.
    const counts = new Map();
    for (let i = 0; i < d.rgba.length; i += 4) {
      if (d.rgba[i + 3] === 255 && isOrange(d.rgba[i], d.rgba[i + 1], d.rgba[i + 2])) {
        const k = (d.rgba[i] << 16) | (d.rgba[i + 1] << 8) | d.rgba[i + 2];
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    assert.ok(top, 'an opaque orange pixel exists');
    const [r, g, b] = [(top[0] >> 16) & 255, (top[0] >> 8) & 255, top[0] & 255];
    assert.ok(Math.abs(r - 0xd9) + Math.abs(g - 0x77) + Math.abs(b - 0x57) <= 60, `most common orange is #${top[0].toString(16)}, far from #D97757`);
  });
  test(`design ${label}: both elements are still visible at 16 and 32 px (and in the 150 px tile)`, () => {
    ensure();
    const ico = fs.readFileSync(path.join(outDir(), 'resources', 'win32', 'code.ico'));
    const imgs = icoImages(ico);
    for (const [size, min] of [[16, 3], [32, 10]]) {
      const c = countColors(decodePng(Buffer.from(imgs.find((i) => i.size === size).png)).rgba, 128);
      assert.ok(c.blue >= min, `${size}px: blue ${c.blue} < ${min}`);
      assert.ok(c.orange >= min, `${size}px: orange ${c.orange} < ${min}`);
    }
    const t = countColors(decodePng(fs.readFileSync(path.join(outDir(), 'resources', 'win32', 'code_150x150.png'))).rgba);
    assert.ok(t.blue >= 100 && t.orange >= 100, `150px: blue ${t.blue}, orange ${t.orange}`);
  });
  test(`design ${label}: output is deterministic (a second run gives the same bytes)`, () => {
    ensure();
    const second = path.join(sb, `${dirName}-again`);
    const r = runNode(['scripts/make-icons.mjs', '--out', second, ...extra]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const a = walk(outDir()).map((p) => path.relative(outDir(), p)).sort();
    const b = walk(second).map((p) => path.relative(second, p)).sort();
    assert.deepEqual(a, b);
    for (const rel of a) assert.ok(fs.readFileSync(path.join(outDir(), rel)).equals(fs.readFileSync(path.join(second, rel))), rel);
  });
  test(`design ${label}: SVGs - code-icon.svg and the four letterpress files are well-formed; code-icon.svg has both a blue and an orange fill`, () => {
    ensure();
    const svgs = walk(outDir()).filter((p) => p.endsWith('.svg'));
    const names = svgs.map((p) => path.basename(p)).sort();
    assert.deepEqual(names, ['code-icon.svg', 'letterpress-dark.svg', 'letterpress-hcDark.svg', 'letterpress-hcLight.svg', 'letterpress-light.svg'].sort());
    for (const p of svgs) checkSvg(fs.readFileSync(p, 'utf8'), path.basename(p));
    const code = fs.readFileSync(svgs.find((p) => path.basename(p) === 'code-icon.svg'), 'utf8');
    const hexes = [...code.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)]);
    assert.ok(hexes.some(([r, g, b]) => isBlue(r, g, b)), 'a blue colour (VS Code family) in code-icon.svg');
    assert.ok(hexes.some(([r, g, b]) => isOrange(r, g, b)), 'an orange colour (#D97757 family) in code-icon.svg');
  });
});

// ---- 既定は候補 A（center-spark）で、assets/ はその出力と同じ ------------------------------------------------
test('既定の意匠は候補 A（center-spark）。短い名前 a も同じ', () => {
  assert.equal(DEFAULT_VARIANT, 'center-spark');
  assert.equal(resolveVariant('a'), 'center-spark');
  assert.ok(VARIANTS.includes(DEFAULT_VARIANT));
});
test('assets/ の下の SVG・ICO・PNG はすべて、台本の既定の出力と同じバイト列（--check と同じ照らし）', () => {
  const all = [...makeIconFiles(), ...makeSvgFiles()];
  assert.equal(all.length, 3 + 5);
  for (const { rel, data } of all) {
    const onDisk = path.join(REPO, 'assets', ...rel.split(/[\\/]/));
    assert.ok(fs.existsSync(onDisk), `${rel} が assets/ に無い（node scripts/make-icons.mjs を走らせる）`);
    assert.ok(fs.readFileSync(onDisk).equals(Buffer.from(data)), `${rel} が台本の出力と違う`);
  }
});
test('CLI: --check は assets/ が台本の出力と同じなら終了コード 0', () => {
  const r = runNode(['scripts/make-icons.mjs', '--check']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(!/違う:/.test(r.stdout), r.stdout);
});
test('CLI: --check は違うファイルがあれば 1（別の意匠と比べる）。知らない意匠は 2', () => {
  const r = runNode(['scripts/make-icons.mjs', '--check', '--variant', 'spark-badge']);
  assert.equal(r.status, 1, '既定でない意匠と assets/ は同じでない');
  assert.equal(runNode(['scripts/make-icons.mjs', '--variant', 'no-such-design', '--out', path.join(sb, 'bad-variant')]).status, 2);
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
