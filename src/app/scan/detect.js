// Finds the four corner markers of a MiniLab page in a photo.
// Three solid squares (top-left, top-right, bottom-left) and one square ring (bottom-right).
// Pure JavaScript, runs on the device, nothing leaves the browser.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function toGray(img) {
  const { data, width: w, height: h } = img;
  const N = w * h;
  const gray = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return gray;
}

function threshold(gray, w, h) {
  const W1 = w + 1;
  const integ = new Uint32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.min(w, h) / 7));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum = integ[(y1 + 1) * W1 + x1 + 1] - integ[y0 * W1 + x1 + 1] - integ[(y1 + 1) * W1 + x0] + integ[y0 * W1 + x0];
      const mean = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const g = gray[y * w + x];
      bin[y * w + x] = g < mean * 0.72 && g < mean - 20 ? 1 : 0;
    }
  }
  return bin;
}

function components(bin, w, h) {
  const N = w * h;
  const labels = new Int32Array(N);
  const stack = new Int32Array(N);
  const comps = [];
  let next = 1;
  for (let start = 0; start < N; start++) {
    if (!bin[start] || labels[start]) continue;
    const id = next++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    const c = { id, area: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, minx: w, maxx: 0, miny: h, maxy: 0, border: false };
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      c.area++;
      c.sx += x; c.sy += y; c.sxx += x * x; c.syy += y * y; c.sxy += x * y;
      if (x < c.minx) c.minx = x;
      if (x > c.maxx) c.maxx = x;
      if (y < c.miny) c.miny = y;
      if (y > c.maxy) c.maxy = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.border = true;
      if (x > 0 && bin[p - 1] && !labels[p - 1]) { labels[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !labels[p + 1]) { labels[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && bin[p - w] && !labels[p - w]) { labels[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !labels[p + w]) { labels[p + w] = id; stack[sp++] = p + w; }
    }
    comps.push(c);
  }
  return { labels, comps };
}

function candidates(comps, labels, w, h) {
  const N = w * h;
  const minA = Math.max(14, (Math.min(w, h) * 0.012) ** 2);
  const maxA = N * 0.03;
  const out = [];
  for (const c of comps) {
    if (c.area < minA || c.area > maxA || c.border) continue;
    const bw = c.maxx - c.minx + 1;
    const bh = c.maxy - c.miny + 1;
    if (bw < 4 || bh < 4) continue;
    const aspect = bw / bh;
    if (aspect < 0.33 || aspect > 3) continue;
    const fill = c.area / (bw * bh);
    if (fill < 0.3) continue;
    const cx = c.sx / c.area;
    const cy = c.sy / c.area;
    const vxx = c.sxx / c.area - cx * cx;
    const vyy = c.syy / c.area - cy * cy;
    const vxy = c.sxy / c.area - cx * cy;
    const tr = vxx + vyy;
    const det = vxx * vyy - vxy * vxy;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    if (l2 <= 0 || l1 / l2 > 4) continue;
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const centerIn = labels[iy * w + ix] === c.id;
    let ring = false;
    if (!centerIn) {
      ring = DIRS.every(([dx, dy]) => {
        let x = ix;
        let y = iy;
        for (let k = 0; k < bw + bh; k++) {
          x += dx;
          y += dy;
          if (x < c.minx || x > c.maxx || y < c.miny || y > c.maxy) return false;
          if (labels[y * w + x] === c.id) return true;
        }
        return false;
      });
      if (!ring) continue;
    } else if (fill < 0.42) {
      continue;
    }
    out.push({ x: cx, y: cy, area: c.area, ring, size: Math.sqrt(c.area) });
  }
  return out;
}

function orderClockwise(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function convexArea(o) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = o[i];
    const b = o[(i + 1) % 4];
    const c = o[(i + 2) % 4];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const s = Math.sign(cr);
    if (s === 0) return 0;
    if (sign === 0) sign = s;
    else if (s !== sign) return 0;
  }
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = o[i];
    const b = o[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * img: ImageData-like { data, width, height }.
 * Returns null or { normal: {tl,tr,br,bl}, mirrored: {...}, quad: area fraction }.
 */
export function detectMarkers(img) {
  const { width: w, height: h } = img;
  const gray = toGray(img);
  const bin = threshold(gray, w, h);
  const { labels, comps } = components(bin, w, h);
  const cands = candidates(comps, labels, w, h);
  const rings = cands.filter((c) => c.ring).sort((a, b) => b.area - a.area).slice(0, 4);
  const solids = cands.filter((c) => !c.ring).sort((a, b) => b.area - a.area).slice(0, 14);
  const N = w * h;
  let best = null;
  for (const r of rings) {
    const rArea = r.area / 0.82;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        for (let k = j + 1; k < solids.length; k++) {
          const s = [solids[i], solids[j], solids[k]];
          const areas = [rArea, s[0].area, s[1].area, s[2].area];
          const mn = Math.min(...areas);
          const mx = Math.max(...areas);
          if (mx / mn > 2.8) continue;
          const o = orderClockwise([r, ...s]);
          const qa = convexArea(o);
          if (qa < N * 0.03) continue;
          const score = qa * (0.5 + mn / mx);
          if (!best || score > best.score) best = { score, o, qa };
        }
      }
    }
  }
  if (!best) return null;
  const o = best.o;
  const ri = o.findIndex((p) => p.ring);
  const q = [0, 1, 2, 3].map((i) => o[(ri + i) % 4]);
  const P = (p) => ({ x: p.x, y: p.y });
  return {
    normal: { br: P(q[0]), bl: P(q[1]), tl: P(q[2]), tr: P(q[3]) },
    mirrored: { br: P(q[0]), tr: P(q[1]), tl: P(q[2]), bl: P(q[3]) },
    quad: best.qa / N,
    markerSize: q.reduce((s, p) => s + p.size, 0) / 4,
  };
}

export function scaleCorners(c, s) {
  const out = {};
  for (const k of ['tl', 'tr', 'br', 'bl']) out[k] = { x: (c[k].x + 0.5) * s - 0.5, y: (c[k].y + 0.5) * s - 0.5 };
  return out;
}
