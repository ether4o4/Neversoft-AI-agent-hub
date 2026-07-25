/**
 * Dependency-free brand icon generator.
 *
 * Renders the NeverSoft "container" mark — a rounded green frame enclosing a
 * solid rounded square — onto a dark tile and writes PNGs at the requested
 * sizes. Used for both the PWA icons (public/icon) and the Android launcher
 * icons (android/.../res/mipmap-*). No native image libraries required.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BG = [17, 17, 17]; // #111111 dark tile
const GREEN = [46, 204, 122]; // brand primary

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Coverage of pixel (px,py) inside a rounded rect, 4x supersampled (0..1). */
function roundedRectCoverage(px, py, x0, y0, x1, y1, r) {
  let hit = 0;
  for (let sx = 0; sx < 2; sx++) {
    for (let sy = 0; sy < 2; sy++) {
      const x = px + (sx + 0.5) / 2;
      const y = py + (sy + 0.5) / 2;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const cx = Math.min(Math.max(x, x0 + r), x1 - r);
      const cy = Math.min(Math.max(y, y0 + r), y1 - r);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) hit++;
    }
  }
  return hit / 4;
}

/** Source-over composite of `color` at coverage `a` onto RGBA pixel i. */
function over(out, i, color, a) {
  if (a <= 0) return;
  const dstA = out[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    const src = color[c] * a;
    const dst = out[i + c] * dstA * (1 - a);
    out[i + c] = Math.round((src + dst) / outA);
  }
  out[i + 3] = Math.round(outA * 255);
}

function render(size, mode = "tile") {
  const rgba = Buffer.alloc(size * size * 4);
  // "tile": opaque dark background for PWA / legacy launcher icons.
  // "fg":   transparent background + extra padding for adaptive foregrounds,
  //         where the OS supplies the background layer and reserves a safe zone.
  const transparent = mode === "fg";
  if (!transparent) {
    for (let i = 0; i < size * size; i++) {
      rgba[i * 4] = BG[0];
      rgba[i * 4 + 1] = BG[1];
      rgba[i * 4 + 2] = BG[2];
      rgba[i * 4 + 3] = 255;
    }
  }

  const s = size;
  // Pull the mark toward the centre for the adaptive safe zone.
  const k = transparent ? 0.72 : 1;
  const f = (v) => 0.5 + (v - 0.5) * k;
  const frameOuter = { x0: s * f(0.2), y0: s * f(0.2), x1: s * f(0.8), y1: s * f(0.8), r: s * 0.14 * k };
  const frameInner = { x0: s * f(0.28), y0: s * f(0.28), x1: s * f(0.72), y1: s * f(0.72), r: s * 0.09 * k };
  const core = { x0: s * f(0.42), y0: s * f(0.42), x1: s * f(0.58), y1: s * f(0.58), r: s * 0.04 * k };

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      // Frame ring = outer rounded rect minus inner rounded rect.
      const outer = roundedRectCoverage(x, y, frameOuter.x0, frameOuter.y0, frameOuter.x1, frameOuter.y1, frameOuter.r);
      const inner = roundedRectCoverage(x, y, frameInner.x0, frameInner.y0, frameInner.x1, frameInner.y1, frameInner.r);
      const ring = Math.max(0, outer - inner);
      const c = roundedRectCoverage(x, y, core.x0, core.y0, core.x1, core.y1, core.r);
      const a = Math.min(1, ring + c);
      if (a > 0) over(rgba, i, GREEN, a);
    }
  }
  return encodePng(s, s, rgba);
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: generate-icons.mjs <size:path> ...");
  process.exit(1);
}
for (const t of targets) {
  const [sizeStr, path, mode = "tile"] = t.split(":");
  const size = Number(sizeStr);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, render(size, mode));
  console.log(`wrote ${path} (${size}x${size}, ${mode})`);
}
