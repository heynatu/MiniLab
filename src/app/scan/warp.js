// Perspective correction, page code reading and colour clean-up for a scanned page.
import { homography, applyH } from './homography.js';
import { MARKER, ART, codeCells, decodeBits, whiteSamples } from '../print/geometry.js';

/** Homography from page millimetres to image pixels. */
export function pageHomography(c) {
  const M = MARKER.centers;
  return homography([M.tl, M.tr, M.br, M.bl], [c.tl, c.tr, c.br, c.bl].map((p) => [p.x, p.y]));
}

function pxPerMm(img, H) {
  const a = applyH(H, 105, 148);
  const b = applyH(H, 106, 148);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function avgAt(img, x, y, r) {
  const { data, width: w, height: h } = img;
  let R = 0;
  let G = 0;
  let B = 0;
  let n = 0;
  const x0 = Math.max(0, Math.round(x - r));
  const x1 = Math.min(w - 1, Math.round(x + r));
  const y0 = Math.max(0, Math.round(y - r));
  const y1 = Math.min(h - 1, Math.round(y + r));
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = (yy * w + xx) * 4;
      R += data[i];
      G += data[i + 1];
      B += data[i + 2];
      n++;
    }
  }
  if (!n) return null;
  return [R / n, G / n, B / n];
}

const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

function inside(img, p) {
  return p[0] >= 0 && p[1] >= 0 && p[0] < img.width && p[1] < img.height;
}

/** Paper white (as a plane over the page) and ink black, measured from the photo. */
export function measureLight(img, H) {
  const ppm = pxPerMm(img, H);
  const r = Math.max(1, ppm * 0.8);
  const samples = [];
  for (const [mx, my] of whiteSamples()) {
    const p = applyH(H, mx, my);
    if (!inside(img, p)) continue;
    const c = avgAt(img, p[0], p[1], r);
    if (c) samples.push({ x: mx, y: my, c, l: lum(c) });
  }
  const blacks = ['tl', 'tr', 'bl']
    .map((k) => applyH(H, ...MARKER.centers[k]))
    .filter((p) => inside(img, p))
    .map((p) => avgAt(img, p[0], p[1], Math.max(1, ppm * 2.5)))
    .filter(Boolean);
  const black = blacks.length
    ? [0, 1, 2].map((i) => blacks.reduce((s, c) => s + c[i], 0) / blacks.length)
    : [20, 20, 20];

  let use = samples;
  if (samples.length >= 8) {
    const sorted = samples.map((s) => s.l).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    use = samples.filter((s) => s.l > med * 0.8);
  }
  const planes = [0, 1, 2].map((ch) => fitPlane(use, ch));
  const whiteAt = (x, y) => planes.map((p) => (p ? p[0] + p[1] * x + p[2] * y : 235));
  const whiteMid = whiteAt(105, 148);
  return { whiteAt, whiteMid, black, ok: use.length >= 6 };
}

function fitPlane(samples, ch) {
  if (samples.length < 3) {
    if (!samples.length) return null;
    const m = samples.reduce((s, p) => s + p.c[ch], 0) / samples.length;
    return [m, 0, 0];
  }
  // least squares v = a + b x + c y (coordinates centred on the page)
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sv = 0, sxv = 0, syv = 0;
  for (const s of samples) {
    const x = s.x - 105;
    const y = s.y - 148;
    const v = s.c[ch];
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sv += v; sxv += x * v; syv += y * v;
  }
  const M = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
  const b = [sv, sxv, syv];
  const sol = solve3(M, b);
  if (!sol) return [sv / n, 0, 0];
  // convert back to page coordinates
  return [sol[0] - sol[1] * 105 - sol[2] * 148, sol[1], sol[2]];
}

function solve3(M, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-9) return null;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const m = M.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)));
    out.push(det(m) / D);
  }
  return out;
}

/** Reads the 8-cell page code. Returns the template id or null. */
export function readCode(img, H, light) {
  const L = light || measureLight(img, H);
  const ppm = pxPerMm(img, H);
  const bits = codeCells().map((c) => {
    let sum = 0;
    let n = 0;
    for (const [dx, dy] of [[0, 0], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      const p = applyH(H, c.cx + dx, c.cy + dy);
      if (!inside(img, p)) continue;
      const col = avgAt(img, p[0], p[1], Math.max(0.5, ppm * 0.6));
      if (col) { sum += lum(col); n++; }
    }
    if (!n) return -1;
    const white = lum(L.whiteAt(c.cx, c.cy));
    const thr = (white + lum(L.black)) / 2;
    return sum / n < thr ? 1 : 0;
  });
  if (bits.includes(-1)) return null;
  return decodeBits(bits);
}

/**
 * Warps the drawing area into a clean 1000 x 1250 canvas (template units).
 * Colours are corrected for uneven light and made a little more vivid.
 */
export function warpArt(img, H, light, { outW = 1000, outH = 1250, vivid = 1.3 } = {}) {
  const L = light || measureLight(img, H);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(outW, outH);
  const od = out.data;
  const { data, width: w, height: h } = img;
  const sx = ART.w / outW;
  const sy = ART.h / outH;
  const bk = L.black;
  for (let j = 0; j < outH; j++) {
    const py = ART.y + (j + 0.5) * sy;
    let px = ART.x + 0.5 * sx;
    let X = H[0] * px + H[1] * py + H[2];
    let Y = H[3] * px + H[4] * py + H[5];
    let Z = H[6] * px + H[7] * py + H[8];
    const dX = H[0] * sx;
    const dY = H[3] * sx;
    const dZ = H[6] * sx;
    // white level varies slowly: evaluate at row start and end, interpolate
    const w0 = L.whiteAt(ART.x, py);
    const w1 = L.whiteAt(ART.x + ART.w, py);
    for (let i = 0; i < outW; i++, px += sx, X += dX, Y += dY, Z += dZ) {
      const fx = X / Z;
      const fy = Y / Z;
      const o = (j * outW + i) * 4;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        od[o] = od[o + 1] = od[o + 2] = 255;
        od[o + 3] = 255;
        continue;
      }
      const ax = fx - x0;
      const ay = fy - y0;
      const i00 = (y0 * w + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + w * 4;
      const i11 = i01 + 4;
      const t = i / outW;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ch = 0; ch < 3; ch++) {
        const v = (data[i00 + ch] * (1 - ax) + data[i10 + ch] * ax) * (1 - ay) + (data[i01 + ch] * (1 - ax) + data[i11 + ch] * ax) * ay;
        const white = w0[ch] + (w1[ch] - w0[ch]) * t;
        const n = (v - bk[ch]) / Math.max(25, white - bk[ch]);
        if (ch === 0) r = n; else if (ch === 1) g = n; else b = n;
      }
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * vivid;
      g = l + (g - l) * vivid;
      b = l + (b - l) * vivid;
      od[o] = clamp255(r * 1.03);
      od[o + 1] = clamp255(g * 1.03);
      od[o + 2] = clamp255(b * 1.03);
      od[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function clamp255(v) {
  const x = v * 255;
  return x < 0 ? 0 : x > 255 ? 255 : x;
}

/** Full pipeline on given corners. Tries the mirrored order if the code does not read. */
export function processScan(img, det) {
  for (const which of ['normal', 'mirrored']) {
    const H = pageHomography(det[which]);
    if (!H) continue;
    const light = measureLight(img, H);
    const id = readCode(img, H, light);
    if (id) return { id, H, light, corners: det[which] };
  }
  const H = pageHomography(det.normal);
  return { id: null, H, light: H ? measureLight(img, H) : null, corners: det.normal };
}
