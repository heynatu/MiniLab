// Low-resolution field helpers shared by the toy builder and the free-drawing segmenter.
// Grid: 250 x 313 pixels covering the 1000 x 1250 drawing (R = 0.25 px per unit).

export const R = 0.25;
export const GW = 250;
export const GH = 313;

export function boxBlur(src, w, h, r, passes = 2) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h);
  const div = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / div;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc / div;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return src;
}

/** Chamfer distance (in pixels) from each inside pixel to the nearest outside pixel. */
export function distanceInside(mask, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const A = 1;
  const B = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x === 0 || y === 0) v = Math.min(v, A);
      if (x > 0) v = Math.min(v, d[i - 1] + A);
      if (y > 0) {
        v = Math.min(v, d[i - w] + A);
        if (x > 0) v = Math.min(v, d[i - w - 1] + B);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + B);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x === w - 1 || y === h - 1) v = Math.min(v, A);
      if (x < w - 1) v = Math.min(v, d[i + 1] + A);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + A);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + B);
        if (x > 0) v = Math.min(v, d[i + w - 1] + B);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Fills every -1 label with the nearest labelled pixel (multi-source BFS). */
export function spreadLabels(labels, w, h) {
  const q = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w * h; i++) if (labels[i] >= 0) q[tail++] = i;
  if (!tail) return labels;
  while (head < tail) {
    const p = q[head++];
    const x = p % w;
    const l = labels[p];
    if (x > 0 && labels[p - 1] < 0) { labels[p - 1] = l; q[tail++] = p - 1; }
    if (x < w - 1 && labels[p + 1] < 0) { labels[p + 1] = l; q[tail++] = p + 1; }
    if (p >= w && labels[p - w] < 0) { labels[p - w] = l; q[tail++] = p - w; }
    if (p < w * (h - 1) && labels[p + w] < 0) { labels[p + w] = l; q[tail++] = p + w; }
  }
  return labels;
}

export function alphaOf(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = d[j] > 127 ? 1 : 0;
  return out;
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
