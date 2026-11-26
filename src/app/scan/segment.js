// Finds the child's own drawing on the blank "free" page.
import { GW, GH } from './fields.js';

function morph(src, w, h, r, dilate) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const s = src[y * w + xx];
        if (dilate ? s : !s) { v = dilate ? 1 : 0; break; }
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const s = tmp[yy * w + x];
        if (dilate ? s : !s) { v = dilate ? 1 : 0; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

export function segmentDrawing(art) {
  const c = document.createElement('canvas');
  c.width = GW;
  c.height = GH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(art, 0, 0, GW, GH);
  const d = ctx.getImageData(0, 0, GW, GH).data;
  const N = GW * GH;
  let mask = new Uint8Array(N);
  const M = 4;
  for (let y = M; y < GH - M; y++) {
    for (let x = M; x < GW - M; x++) {
      const i = (y * GW + x) * 4;
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      mask[y * GW + x] = mx - mn > 0.16 || l < 0.7 ? 1 : 0;
    }
  }
  mask = morph(morph(mask, GW, GH, 3, true), GW, GH, 3, false);

  // fill holes: everything the border cannot reach is inside
  const reach = new Uint8Array(N);
  const q = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (let x = 0; x < GW; x++) {
    for (const y of [0, GH - 1]) { const p = y * GW + x; if (!mask[p] && !reach[p]) { reach[p] = 1; q[tail++] = p; } }
  }
  for (let y = 0; y < GH; y++) {
    for (const x of [0, GW - 1]) { const p = y * GW + x; if (!mask[p] && !reach[p]) { reach[p] = 1; q[tail++] = p; } }
  }
  while (head < tail) {
    const p = q[head++];
    const x = p % GW;
    for (const n of [x > 0 ? p - 1 : -1, x < GW - 1 ? p + 1 : -1, p - GW, p + GW]) {
      if (n < 0 || n >= N || reach[n] || mask[n]) continue;
      reach[n] = 1;
      q[tail++] = n;
    }
  }
  for (let i = 0; i < N; i++) mask[i] = reach[i] ? 0 : 1;

  // keep only the big shapes
  const lab = new Int32Array(N);
  const areas = [0];
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (!mask[s] || lab[s]) continue;
    id++;
    let area = 0;
    head = 0;
    tail = 0;
    q[tail++] = s;
    lab[s] = id;
    while (head < tail) {
      const p = q[head++];
      area++;
      const x = p % GW;
      for (const n of [x > 0 ? p - 1 : -1, x < GW - 1 ? p + 1 : -1, p - GW, p + GW]) {
        if (n < 0 || n >= N || lab[n] || !mask[n]) continue;
        lab[n] = id;
        q[tail++] = n;
      }
    }
    areas.push(area);
  }
  const largest = Math.max(0, ...areas);
  let total = 0;
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const a = areas[lab[i]];
    if (a < Math.max(120, largest * 0.12)) mask[i] = 0;
    else total++;
  }
  return { low: mask, ok: total > N * 0.01, coverage: total / N };
}
