// エディタのアイコン（PNG・ICO・SVG）を書き出す。Node.js の標準の部品（zlib・fs・path・url）だけを使う。
//
// 意匠（--variant で選ぶ。既定は DEFAULT_VARIANT）:
//   裁定（2026-11-17、アイコンの意匠）で候補 A（center-spark）に決まった。既定と assets/ は A。
//   ほかの4つ（current・spark-badge・dark-tile・warm-ribbon）は選ばれなかった意匠で、assets/ には使わない。
//   見本（tasks/2026-11-17-icon/preview-all.png）を同じバイト列で作り直せるように、描き方を残してある。
//   current      前の仮のアイコン（自作。2026-11-17 まで assets/ にあったもの）。1024×1024 の座標で、角の丸い四角（64〜960、角の半径 192、色 #2E6DA4）の上に、
//                白い線（太さ 88、端と角は丸い）で `>`（272,336 → 480,512 → 272,688）と `_`（544,688 → 752,688）。
//   center-spark 候補 A（短い名前 a）。採用（既定）。VS Code の青いリボンを全面に置き、真ん中（切り欠きの所）に Claude の橙の印を重ねる。
//                印のまわりは透かす。
//   spark-badge  候補 B（b。選ばれなかった）。Claude の橙の印を大きく置き、右下に VS Code の青いリボンを小さく重ねる。リボンのまわりは透かす。
//   dark-tile    候補 C（c。選ばれなかった）。暗い灰の角の丸い板（前の意匠 current の四角と同じ位置）の上に、青いリボンと橙の印を A と同じ組みで置く。
//   warm-ribbon  参考（3つの候補の外）。リボンの形を Claude の橙の3つの色で塗り、真ん中にクリーム色の印（濃い橙の縁）。
//                青が無く、印が橙でないので、「VS Code の形と Claude の橙の印」の条件から外れる。
//   候補の元の絵は scripts/icon-src/ の写し（scripts/copy-icon-sources.mjs が写す。出どころと SHA-256 は SOURCES.json）。
//   裁定（2026-11-17）: アイコンは Claude のアイコンと VS Code のアイコンを合わせた意匠にする。名称の文字は絵に入れない。
//
// 使い方:
//   node scripts/make-icons.mjs [--variant <id>] [--out <dir>] [--check] [--preview <dir>]
//     --variant  current | center-spark | spark-badge | dark-tile | warm-ribbon | a | b | c
//                （--preview のときだけ all も可）。既定は DEFAULT_VARIANT
//     --out      既定の出力先は assets/（リポジトリの直下の assets）。次の8つを書く:
//                  <dir>/resources/win32/code.ico          16・24・32・48・64・128・256 px（どれも PNG で格納）
//                  <dir>/resources/win32/code_70x70.png
//                  <dir>/resources/win32/code_150x150.png
//                  <dir>/src/vs/workbench/browser/media/code-icon.svg                 タイトルバー・通知のバナー
//                  <dir>/src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg  透かし
//     --check    書かずに、<dir> の8つが台本の出力と同じバイト列かを確かめる。同じなら 0、違えば 1
//     --preview  アイコンは書かずに、見本の画像を <dir> に書く:
//                  preview-<id>.png        512×512 の1枚（背景は透明）
//                  preview-<id>-sizes.png  16〜256 px を明るい背景と暗い背景に並べたもの（並びは icon-variants.md）
//                  preview-all.png         （--variant all のとき）全部の意匠を並べたもの
//   同じ入力からは毎回同じバイト列になる（時刻などを入れない）。
//
// テストの入口（export）:
//   ICON_SIZES                          → [16, 24, 32, 48, 64, 128, 256]
//   VARIANTS                            → ["current", "center-spark", "spark-badge", "dark-tile", "warm-ribbon"]
//   VARIANT_ALIASES                     → { a: "center-spark", b: "spark-badge", c: "dark-tile" }
//   DEFAULT_VARIANT                     → "center-spark"（裁定 2026-11-17。assets/ の意匠）
//   resolveVariant(name)                → 正式の名前（短い名前も受ける。知らない名前は例外）
//   （variant を受ける関数は、どれも短い名前を受ける）
//   crc32(buf)                          → 符号なし32ビットの整数
//   coverageAt(x, y)                    → 前の意匠（current）の 1024 の座標の1点の色 { kind: "stroke" | "fill" | "none" }
//   renderIcon(size, samples?, variant?) → 長さ size*size*4 の Buffer（RGBA、ストレートアルファ）
//   renderLetterpress(size, variant)    → 長さ size*size の Float32Array（透かしの形の被覆 0〜1。current は扱わない）
//   encodePng(width, height, rgba)      → PNG の Buffer
//   encodeIco(images)                   → ICO の Buffer。images は [{ size, png }]
//   makeIconFiles(variant?)             → [{ rel, data }]（PNG と ICO の3つ。相対パスと中身）
//   makeSvgFiles(variant?)              → [{ rel, data }]（SVG の5つ）
//   makePreviewFiles(variant)           → [{ rel, data }]（見本の画像。variant が "all" なら全部と preview-all.png）
//   parsePathToPolygons(d, matrix?)     → SVG のパスを折れ線にした Float64Array の配列（[x0,y0,x1,y1,...]、閉じた形）

import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON_SRC = path.join(REPO, "scripts", "icon-src");

export const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
export const VARIANTS = ["current", "center-spark", "spark-badge", "dark-tile", "warm-ribbon"];
// 候補の短い名前（a・b・c）。warm-ribbon は参考（3つの候補の外）なので短い名前を付けない
export const VARIANT_ALIASES = Object.freeze({ a: "center-spark", b: "spark-badge", c: "dark-tile" });
// 採用した意匠（裁定 2026-11-17: 候補 A「中央に印」）。assets/ はこの意匠で書き出す
export const DEFAULT_VARIANT = "center-spark";

// 短い名前を正式の名前に直す。知らない名前は例外
export function resolveVariant(variant) {
  const v = Object.hasOwn(VARIANT_ALIASES, variant) ? VARIANT_ALIASES[variant] : variant;
  if (!VARIANTS.includes(v)) throw new Error(`知らない意匠: ${variant}（${[...VARIANTS, ...Object.keys(VARIANT_ALIASES)].join(" | ")}）`);
  return v;
}

// ==== 前の意匠（current。選ばれなかった）。この節の定数と描き方は変えない（2026-11-17 まで assets/ にあったファイルと同じバイト列にするため） ====
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

// ---- 図形（current） ----
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
function renderCurrent(size, samples = size <= 64 ? 8 : 4) {
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

// 前の意匠の SVG（2026-11-17 まで assets/ に置いていたものと同じ文字列）
function currentSvgFiles() {
  const lp = (open, color) =>
    `${open}\n<g fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">\n` +
    `<rect x="6" y="22" width="248" height="216" rx="34"/>\n<path d="M66 92 118 130 66 168"/>\n<path d="M138 168H194"/>\n</g>\n</svg>\n`;
  const open = (attr) => `<svg width="260" height="260" viewBox="0 0 260 260" ${attr} xmlns="http://www.w3.org/2000/svg">`;
  return {
    code:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect x="64" y="64" width="896" height="896" rx="192" fill="#2E6DA4"/>` +
      `<path d="M272 336 480 512 272 688" fill="none" stroke="#FFFFFF" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M544 688H752" fill="none" stroke="#FFFFFF" stroke-width="88" stroke-linecap="round"/></svg>\n`,
    light: lp(open(`opacity="0.1"`), "#000000"),
    dark: lp(open(`opacity="0.3"`), "#000000"),
    hcLight: lp(open(`fill="none"`), "#D9D9D9"),
    hcDark: lp(open(`fill="none"`), "#3C3C3C"),
  };
}

// ==== SVG のパスを折れ線にする（M L H V C S Q T A Z。大文字は絶対、小文字は相対） ====
const CURVE_STEPS = 24; // 2次・3次の曲線を何本の線分に分けるか
const ARC_STEP = Math.PI / 48; // 円弧を分ける角度の刻み

// matrix は [a, b, c, d, e, f]（x' = a x + c y + e、y' = b x + d y + f）
export function parsePathToPolygons(d, matrix = [1, 0, 0, 1, 0, 0]) {
  const n = d.length;
  let i = 0;
  const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  const skip = () => {
    while (i < n && (d[i] === " " || d[i] === "," || d[i] === "\n" || d[i] === "\r" || d[i] === "\t")) i++;
  };
  const num = () => {
    skip();
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) throw new Error(`数が要る所に数が無い（位置 ${i}）`);
    i += m[0].length;
    return Number(m[0]);
  };
  // 円弧の2つの旗は1文字ずつ（"01" のように詰めて書ける）
  const flag = () => {
    skip();
    const c = d[i];
    if (c !== "0" && c !== "1") throw new Error(`円弧の旗が 0 か 1 でない（位置 ${i}）`);
    i++;
    return c === "1";
  };
  const hasNumber = () => {
    skip();
    return i < n && /[-+.\d]/.test(d[i]);
  };

  const subs = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let last = null; // 直前の曲線の制御点 { kind: "C" | "Q", x, y }
  const start = (nx, ny) => {
    cur = [nx, ny];
    subs.push(cur);
    x = sx = nx;
    y = sy = ny;
  };
  const lineTo = (nx, ny) => {
    if (!cur) start(sx, sy);
    cur.push(nx, ny);
    x = nx;
    y = ny;
  };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= CURVE_STEPS; k++) {
      const t = k / CURVE_STEPS, u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
      lineTo(a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3);
    }
    last = { kind: "C", x: x2, y: y2 };
  };
  const quad = (x1, y1, x2, y2) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= CURVE_STEPS; k++) {
      const t = k / CURVE_STEPS, u = 1 - t;
      lineTo(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2);
    }
    last = { kind: "Q", x: x1, y: y1 };
  };
  // SVG 1.1 の付録 F.6.5（端点から中心を求める）
  const arc = (rx, ry, phiDeg, large, sweep, x2, y2) => {
    const x1 = x, y1 = y;
    if (x1 === x2 && y1 === y2) return;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx === 0 || ry === 0) return lineTo(x2, y2);
    const phi = (phiDeg * Math.PI) / 180, cs = Math.cos(phi), sn = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) {
      const s = Math.sqrt(lam);
      rx *= s;
      ry *= s;
    }
    const rx2 = rx * rx, ry2 = ry * ry;
    const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
    let coef = Math.sqrt(Math.max(0, rx2 * ry2 - den) / den);
    if (large === sweep) coef = -coef;
    const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
    const cx = cs * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry, vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry;
    const th1 = ang(1, 0, ux, uy);
    let dth = ang(ux, uy, vx, vy);
    if (!sweep && dth > 0) dth -= 2 * Math.PI;
    else if (sweep && dth < 0) dth += 2 * Math.PI;
    const steps = Math.max(2, Math.ceil(Math.abs(dth) / ARC_STEP));
    for (let k = 1; k < steps; k++) {
      const t = th1 + (dth * k) / steps, ct = Math.cos(t), st = Math.sin(t);
      lineTo(cx + rx * ct * cs - ry * st * sn, cy + rx * ct * sn + ry * st * cs);
    }
    lineTo(x2, y2);
  };

  const run = (c, first) => {
    const rel = c === c.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (c.toUpperCase()) {
      case "M": {
        const nx = num() + ox, ny = num() + oy;
        if (first) start(nx, ny);
        else lineTo(nx, ny);
        last = null;
        return;
      }
      case "L": {
        const nx = num() + ox, ny = num() + oy;
        lineTo(nx, ny);
        last = null;
        return;
      }
      case "H":
        lineTo(num() + ox, y);
        last = null;
        return;
      case "V":
        lineTo(x, num() + oy);
        last = null;
        return;
      case "C": {
        const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy;
        return cubic(x1, y1, x2, y2, x3, y3);
      }
      case "S": {
        const x1 = last && last.kind === "C" ? 2 * x - last.x : x;
        const y1 = last && last.kind === "C" ? 2 * y - last.y : y;
        const x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy;
        return cubic(x1, y1, x2, y2, x3, y3);
      }
      case "Q": {
        const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy;
        return quad(x1, y1, x2, y2);
      }
      case "T": {
        const x1 = last && last.kind === "Q" ? 2 * x - last.x : x;
        const y1 = last && last.kind === "Q" ? 2 * y - last.y : y;
        return quad(x1, y1, num() + ox, num() + oy);
      }
      case "A": {
        const rx = num(), ry = num(), phi = num(), large = flag(), sweep = flag();
        const nx = num() + ox, ny = num() + oy;
        arc(rx, ry, phi, large, sweep, nx, ny);
        last = null;
        return;
      }
      case "Z":
        x = sx;
        y = sy;
        cur = null;
        last = null;
        return;
    }
  };

  for (;;) {
    skip();
    if (i >= n) break;
    const c = d[i];
    if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) throw new Error(`パスの命令でない文字: ${c}（位置 ${i}）`);
    i++;
    let first = true;
    do {
      run(c, first);
      first = false;
    } while (c !== "Z" && c !== "z" && hasNumber());
  }

  const [a, b, c2, d2, e, f] = matrix;
  return subs
    .filter((s) => s.length >= 6)
    .map((s) => {
      const out = new Float64Array(s.length);
      for (let k = 0; k < s.length; k += 2) {
        out[k] = a * s[k] + c2 * s[k + 1] + e;
        out[k + 1] = b * s[k] + d2 * s[k + 1] + f;
      }
      return out;
    });
}

function bboxOf(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) {
    for (let k = 0; k < p.length; k += 2) {
      if (p[k] < x0) x0 = p[k];
      if (p[k] > x1) x1 = p[k];
      if (p[k + 1] < y0) y0 = p[k + 1];
      if (p[k + 1] > y1) y1 = p[k + 1];
    }
  }
  return { x0, y0, x1, y1 };
}

function edgesOf(polys) {
  const edges = [];
  for (const p of polys) {
    const m = p.length;
    for (let k = 0; k < m; k += 2) {
      const x0 = p[k], y0 = p[k + 1], x1 = p[(k + 2) % m], y1 = p[(k + 3) % m];
      if (x0 === x1 && y0 === y1) continue;
      edges.push({ x0, y0, x1, y1, ymin: Math.min(y0, y1), ymax: Math.max(y0, y1), xmin: Math.min(x0, x1), xmax: Math.max(x0, x1) });
    }
  }
  return edges;
}

// ==== 塗りの被覆（1024 の座標の図形を size px に描く）。縦は ss 本の走査線、横は区間の長さで正確に数える ====
function fillCoverage(polys, rule, size, ss) {
  const unit = 1024 / size;
  const edges = edgesOf(polys).filter((e) => e.y0 !== e.y1);
  const cov = new Float32Array(size * size);
  const w = 1 / ss;
  const cross = [];
  for (let py = 0; py < size; py++) {
    const row = py * size;
    for (let j = 0; j < ss; j++) {
      const y = (py + (j + 0.5) / ss) * unit;
      cross.length = 0;
      for (const e of edges) {
        if ((e.y0 <= y && e.y1 > y) || (e.y1 <= y && e.y0 > y)) {
          cross.push([e.x0 + ((y - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0), e.y1 > e.y0 ? 1 : -1]);
        }
      }
      if (cross.length < 2) continue;
      cross.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      let wind = 0;
      for (let k = 0; k < cross.length - 1; k++) {
        wind += cross[k][1];
        const inside = rule === "evenodd" ? (wind & 1) !== 0 : wind !== 0;
        if (!inside) continue;
        const pa = Math.max(0, cross[k][0] / unit), pb = Math.min(size, cross[k + 1][0] / unit);
        if (pb <= pa) continue;
        const ia = Math.floor(pa), ib = Math.floor(pb);
        if (ia === ib) {
          cov[row + ia] += (pb - pa) * w;
        } else {
          cov[row + ia] += (ia + 1 - pa) * w;
          for (let q = ia + 1; q < ib; q++) cov[row + q] += w;
          if (ib < size) cov[row + ib] += (pb - ib) * w;
        }
      }
    }
  }
  for (let k = 0; k < cov.length; k++) if (cov[k] > 1) cov[k] = 1;
  return cov;
}

// 縁から r（1024 の座標）以内の帯の被覆。点を ds×ds 個数える（SVG の stroke-linejoin="round" の線と同じ形）
function bandCoverage(polys, r, size) {
  const ds = size <= 64 ? 8 : 4;
  const unit = 1024 / size;
  const edges = edgesOf(polys);
  const cov = new Float32Array(size * size);
  const bb = bboxOf(polys);
  const r2 = r * r;
  const px0 = Math.max(0, Math.floor((bb.x0 - r) / unit)), px1 = Math.min(size - 1, Math.floor((bb.x1 + r) / unit));
  const py0 = Math.max(0, Math.floor((bb.y0 - r) / unit)), py1 = Math.min(size - 1, Math.floor((bb.y1 + r) / unit));
  const w = 1 / (ds * ds);
  for (let py = py0; py <= py1; py++) {
    for (let j = 0; j < ds; j++) {
      const y = (py + (j + 0.5) / ds) * unit;
      const cand = edges.filter((e) => e.ymin - r <= y && e.ymax + r >= y);
      if (cand.length === 0) continue;
      for (let px = px0; px <= px1; px++) {
        let hits = 0;
        for (let k = 0; k < ds; k++) {
          const x = (px + (k + 0.5) / ds) * unit;
          for (const e of cand) {
            if (x < e.xmin - r || x > e.xmax + r) continue;
            if (distanceToSegmentSquared(x, y, e.x0, e.y0, e.x1, e.y1) <= r2) {
              hits++;
              break;
            }
          }
        }
        if (hits) cov[py * size + px] += hits * w;
      }
    }
  }
  return cov;
}

// 図形を r だけ太らせた形の被覆（中の塗りと縁の帯の大きいほう）
function dilatedCoverage(polys, rule, r, size, ss) {
  const fill = fillCoverage(polys, rule, size, ss);
  const band = bandCoverage(polys, r, size);
  for (let k = 0; k < fill.length; k++) if (band[k] > fill[k]) fill[k] = Math.min(1, band[k]);
  return fill;
}

const mulCov = (a, b) => {
  const out = new Float32Array(a.length);
  for (let k = 0; k < a.length; k++) out[k] = a[k] * b[k];
  return out;
};

// ==== 元の絵（scripts/icon-src/ の写し）を読む ====
let sourcesCache = null;
function attr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}
function loadSources() {
  if (sourcesCache) return sourcesCache;
  const read = (name) => {
    const f = path.join(ICON_SRC, name);
    if (!existsSync(f)) throw new Error(`元の絵の写しが無い: ${f}（node scripts/copy-icon-sources.mjs で写す）`);
    return readFileSync(f, "utf8");
  };
  const tags = (svg) => svg.match(/<path\b[^>]*>/g) || [];
  const byFill = (svg, fill, label) => {
    const hit = tags(svg).filter((t) => attr(t, "fill") === fill);
    if (hit.length !== 1) throw new Error(`${label}: fill="${fill}" の path が ${hit.length} 個（1個のはず）`);
    return attr(hit[0], "d");
  };
  const vs = read("vscode-code-icon.svg");
  const cl = read("claude-logo.svg");
  sourcesCache = {
    // VS Code（256 の座標）。outline は mask の形（evenodd）、folds は奥から手前の順、overlay は上の光沢（evenodd）
    ribbon: {
      outline: byFill(vs, "#fff", "vscode-code-icon.svg"),
      folds: [byFill(vs, "#0065A9", "vscode-code-icon.svg"), byFill(vs, "#007ACC", "vscode-code-icon.svg"), byFill(vs, "#1F9CF0", "vscode-code-icon.svg")],
      overlay: byFill(vs, "url(#paint0_linear)", "vscode-code-icon.svg"),
      gradient: { y0: 0.66, y1: 255.34 }, // 光沢の白の濃さ（上 1 → 下 0）。元の linearGradient のまま
    },
    // Claude の印（24 の座標、nonzero）
    spark: byFill(cl, "#D97757", "claude-logo.svg"),
  };
  return sourcesCache;
}

// ==== 候補の意匠 ====
const BLUE = ["#0065A9", "#007ACC", "#1F9CF0"]; // VS Code の元の色（奥の折り目・手前の折り目・右の柱）
const CLAUDE_ORANGE = "#D97757"; // Claude の印の元の色
const WARM = ["#9A4426", "#C15F3C", "#D97757"]; // 参考 warm-ribbon のリボン（濃い橙・中の橙・Claude の橙）
const CREAM = "#F5F0E6";
const WARM_RING = "#7A3520";
const TILE = { x0: 64, y0: 64, x1: 960, y1: 960, r: 192 }; // 候補 C の板（今の意匠の四角と同じ位置と角の丸み）
const TILE_COLOR = "#2B2B2B";

function tilePath({ x0, y0, x1, y1, r }) {
  return `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

// 印の外接の四角の中心を (cx, cy)、長いほうの辺を size にする変換
function placeSpark(cx, cy, size) {
  const bb = bboxOf(parsePathToPolygons(loadSources().spark));
  const s = size / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
  return [s, 0, 0, s, cx - s * (bb.x0 + bb.x1) / 2, cy - s * (bb.y0 + bb.y1) / 2];
}
const placeRibbon = (x, y, size) => [size / 256, 0, 0, size / 256, x, y];

// 絵は下から順に描く。halo は、その要素を描く前に下の絵をくり抜く（knockout）か、縁の色で塗る（ring）
function sceneOf(variant) {
  switch (variant) {
    case "center-spark":
      return [
        { kind: "ribbon", m: placeRibbon(64, 64, 896), colors: BLUE },
        { kind: "spark", m: placeSpark(600, 512, 480), color: CLAUDE_ORANGE, halo: { mode: "knockout", gap: 28 } },
      ];
    case "spark-badge":
      return [
        { kind: "spark", m: placeSpark(392, 392, 720), color: CLAUDE_ORANGE },
        { kind: "ribbon", m: placeRibbon(432, 432, 576), colors: BLUE, halo: { mode: "knockout", gap: 36 } },
      ];
    case "dark-tile":
      return [
        { kind: "tile", rect: TILE, color: TILE_COLOR, mono: false },
        { kind: "ribbon", m: placeRibbon(176, 176, 672), colors: BLUE },
        { kind: "spark", m: placeSpark(568, 512, 400), color: CLAUDE_ORANGE, halo: { mode: "ring", gap: 24, color: TILE_COLOR } },
      ];
    case "warm-ribbon":
      return [
        { kind: "ribbon", m: placeRibbon(64, 64, 896), colors: WARM },
        { kind: "spark", m: placeSpark(600, 512, 480), color: CREAM, halo: { mode: "ring", gap: 28, color: WARM_RING } },
      ];
    default:
      throw new Error(`候補の意匠でない: ${variant}`);
  }
}

// 要素の外形（透かし・くり抜きに使う）: ポリゴンと塗りの規則
function silhouetteOf(item) {
  const src = loadSources();
  if (item.kind === "ribbon") return { polys: parsePathToPolygons(src.ribbon.outline, item.m), rule: "evenodd" };
  return { polys: parsePathToPolygons(src.spark, item.m), rule: "nonzero" };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// 前乗算の RGBA（0〜1）の板に、被覆 cov・色 rgb で重ねる
function paint(buf, cov, rgb, opacity = 1) {
  for (let k = 0, p = 0; k < cov.length; k++, p += 4) {
    const a = cov[k] * opacity;
    if (a <= 0) continue;
    const ia = 1 - a;
    buf[p] = rgb[0] * a + buf[p] * ia;
    buf[p + 1] = rgb[1] * a + buf[p + 1] * ia;
    buf[p + 2] = rgb[2] * a + buf[p + 2] * ia;
    buf[p + 3] = a + buf[p + 3] * ia;
  }
}
function knock(buf, cov) {
  for (let k = 0, p = 0; k < cov.length; k++, p += 4) {
    const keep = 1 - cov[k];
    if (keep >= 1) continue;
    buf[p] *= keep;
    buf[p + 1] *= keep;
    buf[p + 2] *= keep;
    buf[p + 3] *= keep;
  }
}
// 白の光沢を mix-blend-mode:overlay で重ねる（W3C Compositing の式。白との overlay は、下が 0.5 以下なら 2 倍、超えれば 1）
function overlayWhite(buf, cov, alphaAt, size) {
  for (let py = 0; py < size; py++) {
    const g = alphaAt(py);
    for (let px = 0; px < size; px++) {
      const k = py * size + px, p = k * 4;
      const as = cov[k] * g;
      if (as <= 0) continue;
      const ab = buf[p + 3];
      for (let c = 0; c < 3; c++) {
        const cb = ab > 0 ? buf[p + c] / ab : 0;
        const blended = cb <= 0.5 ? 2 * cb : 1;
        const cs = (1 - ab) * 1 + ab * blended;
        buf[p + c] = as * cs + (1 - as) * buf[p + c];
      }
      buf[p + 3] = as + (1 - as) * ab;
    }
  }
}

function drawScene(variant, size, ss, mono) {
  const src = loadSources();
  const unit = 1024 / size;
  const buf = new Float32Array(size * size * 4);
  const black = [0, 0, 0];
  for (const item of sceneOf(variant)) {
    if (item.kind === "tile") {
      // 板は透かし（mono）には描かない（描くと中の絵が板と同じ色になって消える）
      if (!mono) paint(buf, fillCoverage(parsePathToPolygons(tilePath(item.rect)), "nonzero", size, ss), hex(item.color));
      continue;
    }
    const sil = silhouetteOf(item);
    if (item.halo) {
      const halo = dilatedCoverage(sil.polys, sil.rule, item.halo.gap, size, ss);
      if (item.halo.mode === "ring" && !mono) paint(buf, halo, hex(item.halo.color));
      else knock(buf, halo);
    }
    if (mono) {
      paint(buf, fillCoverage(sil.polys, sil.rule, size, ss), black);
      continue;
    }
    if (item.kind === "spark") {
      paint(buf, fillCoverage(sil.polys, sil.rule, size, ss), hex(item.color));
      continue;
    }
    // リボン: 3つの折り目を外形で切り抜いて描き、上に光沢を重ねる（元の絵の影の filter は描かない）
    const clip = fillCoverage(sil.polys, sil.rule, size, ss);
    src.ribbon.folds.forEach((d, idx) => {
      paint(buf, mulCov(fillCoverage(parsePathToPolygons(d, item.m), "nonzero", size, ss), clip), hex(item.colors[idx]));
    });
    const ov = mulCov(fillCoverage(parsePathToPolygons(src.ribbon.overlay, item.m), "evenodd", size, ss), clip);
    const s = item.m[0], ty = item.m[5];
    const { y0, y1 } = src.ribbon.gradient;
    overlayWhite(buf, ov, (py) => {
      const ly = ((py + 0.5) * unit - ty) / s;
      const t = Math.min(1, Math.max(0, (ly - y0) / (y1 - y0)));
      return 0.25 * (1 - t);
    }, size);
  }
  return buf;
}

function toRgba8(buf, size) {
  const out = Buffer.alloc(size * size * 4);
  for (let k = 0; k < size * size; k++) {
    const p = k * 4;
    const a = Math.min(1, Math.max(0, buf[p + 3]));
    const a8 = Math.round(a * 255);
    if (a8 === 0) continue;
    for (let c = 0; c < 3; c++) out[p + c] = Math.min(255, Math.max(0, Math.round((buf[p + c] / a) * 255)));
    out[p + 3] = a8;
  }
  return out;
}

// samples: current は1画素の縦横の点の数、候補は1画素の走査線の数（既定 16）
export function renderIcon(size, samples, variant = DEFAULT_VARIANT) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`大きさが正の整数でない: ${size}`);
  variant = resolveVariant(variant);
  if (variant === "current") return renderCurrent(size, samples ?? (size <= 64 ? 8 : 4));
  return toRgba8(drawScene(variant, size, samples ?? 16, false), size);
}

export function renderLetterpress(size, variant) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`大きさが正の整数でない: ${size}`);
  variant = resolveVariant(variant);
  if (variant === "current") throw new Error("current の透かしは線で描く SVG のまま（この関数では描かない）");
  const buf = drawScene(variant, size, 16, true);
  const out = new Float32Array(size * size);
  for (let k = 0; k < out.length; k++) out[k] = Math.min(1, Math.max(0, buf[k * 4 + 3]));
  return out;
}

// ==== SVG を書く（候補） ====
const fmt = (v) => {
  const s = (Math.round(v * 10000) / 10000).toString();
  return s === "-0" ? "0" : s;
};
const mat = (m) => `matrix(${m.map(fmt).join(" ")})`;

function svgScene(variant, mono) {
  const src = loadSources();
  const defs = [];
  let body = "";
  sceneOf(variant).forEach((item, idx) => {
    if (item.kind === "tile") {
      const { x0, y0, x1, y1, r } = item.rect;
      if (!mono) body += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${r}" fill="${item.color}"/>`;
      return;
    }
    const sil =item.kind === "ribbon" ? { d: src.ribbon.outline, rule: "evenodd" } : { d: src.spark, rule: "nonzero" };
    if (item.halo) {
      const sw = fmt((2 * item.halo.gap) / item.m[0]);
      const haloPath = (color) =>
        `<path transform="${mat(item.m)}" d="${sil.d}" fill="${color}"${sil.rule === "evenodd" ? ` fill-rule="evenodd"` : ""} stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      if (item.halo.mode === "ring" && !mono) {
        body += haloPath(item.halo.color);
      } else {
        defs.push(`<mask id="k${idx}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>${haloPath("#000")}</mask>`);
        body = `<g mask="url(#k${idx})">${body}</g>`;
      }
    }
    if (mono) {
      body += `<path transform="${mat(item.m)}" d="${sil.d}"${sil.rule === "evenodd" ? ` fill-rule="evenodd"` : ""}/>`;
    } else if (item.kind === "spark") {
      body += `<path transform="${mat(item.m)}" d="${src.spark}" fill="${item.color}"/>`;
    } else {
      defs.push(`<clipPath id="c${idx}"><path d="${src.ribbon.outline}" clip-rule="evenodd"/></clipPath>`);
      defs.push(
        `<linearGradient id="g${idx}" x1="127.844" y1="${fmt(src.ribbon.gradient.y0)}" x2="127.844" y2="${fmt(src.ribbon.gradient.y1)}" gradientUnits="userSpaceOnUse">` +
          `<stop stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
      );
      body +=
        `<g transform="${mat(item.m)}"><g clip-path="url(#c${idx})">` +
        src.ribbon.folds.map((d, k) => `<path d="${d}" fill="${item.colors[k]}"/>`).join("") +
        `<path d="${src.ribbon.overlay}" fill-rule="evenodd" fill="url(#g${idx})" opacity=".25" style="mix-blend-mode:overlay"/>` +
        `</g></g>`;
    }
  });
  return { defs: defs.length ? `<defs>${defs.join("")}</defs>` : "", body };
}

const SVG_RELS = {
  code: "src/vs/workbench/browser/media/code-icon.svg",
  light: "src/vs/workbench/browser/parts/editor/media/letterpress-light.svg",
  dark: "src/vs/workbench/browser/parts/editor/media/letterpress-dark.svg",
  hcLight: "src/vs/workbench/browser/parts/editor/media/letterpress-hcLight.svg",
  hcDark: "src/vs/workbench/browser/parts/editor/media/letterpress-hcDark.svg",
};

export function makeSvgFiles(variant = DEFAULT_VARIANT) {
  variant = resolveVariant(variant);
  let t;
  if (variant === "current") {
    t = currentSvgFiles();
  } else {
    const color = svgScene(variant, false);
    const mono = svgScene(variant, true);
    // 透かしは本家と同じ組み立て（大きさ 260×260、明るい 0.1・暗い 0.3 の黒、ハイコントラストは #D9D9D9・#3C3C3C）
    const lp = (rootAttr, fill) =>
      `<svg width="260" height="260" viewBox="0 0 1024 1024" ${rootAttr} xmlns="http://www.w3.org/2000/svg">\n${mono.defs}<g fill="${fill}">${mono.body}</g>\n</svg>\n`;
    t = {
      code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${color.defs}${color.body}</svg>\n`,
      light: lp(`opacity="0.1"`, "#000000"),
      dark: lp(`opacity="0.3"`, "#000000"),
      hcLight: lp(`fill="none"`, "#D9D9D9"),
      hcDark: lp(`fill="none"`, "#3C3C3C"),
    };
  }
  return ["code", "light", "dark", "hcLight", "hcDark"].map((k) => ({ rel: SVG_RELS[k], data: Buffer.from(t[k], "utf8") }));
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

export function makeIconFiles(variant = DEFAULT_VARIANT) {
  variant = resolveVariant(variant);
  const png = (size) => encodePng(size, size, renderIcon(size, undefined, variant));
  const ico = encodeIco(ICON_SIZES.map((size) => ({ size, png: png(size) })));
  return [
    { rel: "resources/win32/code.ico", data: ico },
    { rel: "resources/win32/code_70x70.png", data: png(70) },
    { rel: "resources/win32/code_150x150.png", data: png(150) },
  ];
}

// ==== 見本の画像 ====
const LIGHT_BG = [0xf3, 0xf3, 0xf3]; // Windows の明るいタスクバーに近い色
const DARK_BG = [0x1f, 0x1f, 0x1f]; // 暗いタスクバー・Dark Modern のエディタに近い色
const EDITOR_LIGHT = [0xff, 0xff, 0xff]; // Light Modern のエディタ

function canvas(w, h, fill = null) {
  const c = { w, h, px: Buffer.alloc(w * h * 4) };
  if (fill) rect(c, 0, 0, w, h, fill);
  return c;
}
function rect(c, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const p = (yy * c.w + xx) * 4;
      c.px[p] = rgb[0];
      c.px[p + 1] = rgb[1];
      c.px[p + 2] = rgb[2];
      c.px[p + 3] = 255;
    }
  }
}
// 不透明の板の上に、ストレートアルファの絵を重ねる（zoom は最近傍で拡大）
function blit(c, rgba, size, x, y, zoom = 1) {
  for (let sy = 0; sy < size * zoom; sy++) {
    for (let sx = 0; sx < size * zoom; sx++) {
      const s = ((Math.floor(sy / zoom) * size + Math.floor(sx / zoom)) * 4);
      const a = rgba[s + 3] / 255;
      if (a === 0) continue;
      const p = ((y + sy) * c.w + (x + sx)) * 4;
      for (let k = 0; k < 3; k++) c.px[p + k] = Math.round(rgba[s + k] * a + c.px[p + k] * (1 - a));
      c.px[p + 3] = 255;
    }
  }
}
function blitCoverage(c, cov, size, x, y, rgb, opacity) {
  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      const a = cov[sy * size + sx] * opacity;
      if (a === 0) continue;
      const p = ((y + sy) * c.w + (x + sx)) * 4;
      for (let k = 0; k < 3; k++) c.px[p + k] = Math.round(rgb[k] * a + c.px[p + k] * (1 - a));
    }
  }
}
const pngOf = (c) => encodePng(c.w, c.h, c.px);

// 並べ方（明るい帯・暗い帯の2段。それぞれ左から 16・24・32・48・64・128・256 px を等倍、続けて 16 px の8倍・32 px の4倍）
// 候補では3段目に透かし（130 px。左は Light Modern の白に 0.1、右は暗い背景に 0.3）
function sizesSheet(variant) {
  const pad = 16;
  const icons = ICON_SIZES.map((s) => ({ s, rgba: renderIcon(s, undefined, variant) }));
  const zooms = [{ s: 16, z: 8 }, { s: 32, z: 4 }];
  const bandH = 256 + pad * 2;
  const w = pad + icons.reduce((t, i) => t + i.s + pad, 0) + zooms.reduce((t, z) => t + z.s * z.z + pad, 0);
  const lpSize = 130;
  const withLp = variant !== "current";
  const h = bandH * 2 + (withLp ? lpSize + pad * 2 : 0);
  const c = canvas(w, h);
  [LIGHT_BG, DARK_BG].forEach((bg, band) => {
    const top = band * bandH;
    rect(c, 0, top, w, bandH, bg);
    let x = pad;
    for (const { s, rgba } of icons) {
      blit(c, rgba, s, x, top + pad + 256 - s);
      x += s + pad;
    }
    for (const { s, z } of zooms) {
      blit(c, icons.find((i) => i.s === s).rgba, s, x, top + pad + 256 - s * z, z);
      x += s * z + pad;
    }
  });
  if (withLp) {
    const top = bandH * 2;
    rect(c, 0, top, Math.floor(w / 2), lpSize + pad * 2, EDITOR_LIGHT);
    rect(c, Math.floor(w / 2), top, w - Math.floor(w / 2), lpSize + pad * 2, DARK_BG);
    const cov = renderLetterpress(lpSize, variant);
    blitCoverage(c, cov, lpSize, Math.floor(w / 4) - lpSize / 2, top + pad, [0, 0, 0], 0.1);
    blitCoverage(c, cov, lpSize, Math.floor((3 * w) / 4) - lpSize / 2, top + pad, [0, 0, 0], 0.3);
  }
  return pngOf(c);
}

// 全部の意匠を1段ずつ（VARIANTS の順）。各段の左半分が明るい背景、右半分が暗い背景で、それぞれ左から 256・32・16 px
function compareSheet() {
  const pad = 16;
  const rowH = 256 + pad * 2;
  const halfW = pad + 256 + pad + 32 + pad + 16 + pad;
  const c = canvas(halfW * 2, rowH * VARIANTS.length);
  VARIANTS.forEach((v, row) => {
    const top = row * rowH;
    const imgs = [256, 32, 16].map((s) => ({ s, rgba: renderIcon(s, undefined, v) }));
    [LIGHT_BG, DARK_BG].forEach((bg, half) => {
      const left = half * halfW;
      rect(c, left, top, halfW, rowH, bg);
      let x = left + pad;
      for (const { s, rgba } of imgs) {
        blit(c, rgba, s, x, top + pad + 256 - s);
        x += s + pad;
      }
    });
  });
  return pngOf(c);
}

export function makePreviewFiles(variant) {
  if (variant === "all") {
    return [...VARIANTS.flatMap((v) => makePreviewFiles(v)), { rel: "preview-all.png", data: compareSheet() }];
  }
  variant = resolveVariant(variant);
  return [
    { rel: `preview-${variant}.png`, data: encodePng(512, 512, renderIcon(512, undefined, variant)) },
    { rel: `preview-${variant}-sizes.png`, data: sizesSheet(variant) },
  ];
}

// ==== コマンド ====
function main(argv) {
  const usage = "使い方: node scripts/make-icons.mjs [--variant <id>] [--out <dir>] [--check] [--preview <dir>]";
  let outDir = path.join(REPO, "assets");
  let variant = DEFAULT_VARIANT;
  let check = false;
  let previewDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) outDir = path.resolve(argv[++i]);
    else if (argv[i] === "--variant" && argv[i + 1]) variant = argv[++i];
    else if (argv[i] === "--check") check = true;
    else if (argv[i] === "--preview" && argv[i + 1]) previewDir = path.resolve(argv[++i]);
    else {
      console.error(`知らない引数: ${argv[i]}\n${usage}`);
      return 2;
    }
  }
  if (!(variant === "all" && previewDir)) {
    try {
      variant = resolveVariant(variant);
    } catch {
      console.error(`知らない意匠: ${variant}（${[...VARIANTS, ...Object.keys(VARIANT_ALIASES)].join(" | ")}。all は --preview のときだけ）\n${usage}`);
      return 2;
    }
  }
  if (check && previewDir) {
    console.error(`--check と --preview は一緒に使えない\n${usage}`);
    return 2;
  }
  if (previewDir) {
    for (const { rel, data } of makePreviewFiles(variant)) {
      const file = path.join(previewDir, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, data);
      console.log(`[make-icons] ${path.relative(REPO, file)} (${data.length} bytes)`);
    }
    return 0;
  }
  const files = [...makeIconFiles(variant), ...makeSvgFiles(variant)];
  if (check) {
    let bad = 0;
    for (const { rel, data } of files) {
      const file = path.join(outDir, rel);
      const same = existsSync(file) && readFileSync(file).equals(data);
      if (!same) bad++;
      console.log(`[make-icons] ${same ? "同じ" : "違う"}: ${path.relative(REPO, file)}`);
    }
    return bad ? 1 : 0;
  }
  for (const { rel, data } of files) {
    const file = path.join(outDir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    console.log(`[make-icons] ${path.relative(REPO, file)} (${data.length} bytes)`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
