// Shape helpers that return SVG path data. All coordinates are template units
// (the drawing area is 1000 x 1250 units, 0.18 mm per unit when printed).

const f = (n) => Math.round(n * 10) / 10;

export function ellipse(cx, cy, rx, ry, rot = 0) {
  const a = (rot * Math.PI) / 180;
  const dx = Math.cos(a) * rx;
  const dy = Math.sin(a) * rx;
  return `M${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${f(cx + dx)} ${f(cy + dy)}Z`;
}

export function circle(cx, cy, r) {
  return ellipse(cx, cy, r, r, 0);
}

export function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/** Smooth closed curve through points (Catmull-Rom). */
export function blob(pts, tension = 1) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Smooth open curve through points. */
export function curve(pts, tension = 1) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export function line(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
}

/** Sample points along a Catmull-Rom spline. */
export function sampleSpline(pts, count = 40) {
  const n = pts.length;
  const segs = n - 1;
  const out = [];
  for (let k = 0; k <= count; k++) {
    const u = (k / count) * segs;
    const i = Math.min(segs - 1, Math.floor(u));
    const t = u - i;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

/** A tapered tube (tail, tentacle, leg) around a centerline. Round tip. */
export function tube(pts, w0, w1, count = 36) {
  const s = sampleSpline(pts, count);
  const left = [];
  const right = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const w = (w0 + (w1 - w0) * (i / (s.length - 1))) / 2;
    left.push([s[i][0] - ty * w, s[i][1] + tx * w]);
    right.push([s[i][0] + ty * w, s[i][1] - tx * w]);
  }
  const r1 = w1 / 2;
  const r0 = w0 / 2;
  const e = left[left.length - 1];
  const er = right[right.length - 1];
  let d = `M${f(left[0][0])} ${f(left[0][1])}`;
  for (let i = 1; i < left.length; i++) d += `L${f(left[i][0])} ${f(left[i][1])}`;
  d += `A${f(r1)} ${f(r1)} 0 0 0 ${f(er[0])} ${f(er[1])}`;
  for (let i = right.length - 2; i >= 0; i--) d += `L${f(right[i][0])} ${f(right[i][1])}`;
  d += `A${f(r0)} ${f(r0)} 0 0 0 ${f(left[0][0])} ${f(left[0][1])}Z`;
  void e;
  return d;
}

/** Rounded spike / ear: base centered at (cx, cy), pointing at angle (deg, 0 = up). */
export function spike(cx, cy, w, h, angle = 0) {
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const T = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  const p = [T(-w / 2, 0), T(-w / 5, -h * 0.95), T(0, -h), T(w / 5, -h * 0.95), T(w / 2, 0)];
  return `M${f(p[0][0])} ${f(p[0][1])}Q${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])}Q${f(p[3][0])} ${f(p[3][1])} ${f(p[4][0])} ${f(p[4][1])}Z`;
}

export function star(cx, cy, r, inner = 0.5, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = ((rot - 90) * Math.PI) / 180 + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  // soften the corners a little
  return blob(pts, 0.35);
}

export function heart(cx, cy, s) {
  return `M${f(cx)} ${f(cy + s * 0.9)}C${f(cx - s * 1.3)} ${f(cy + s * 0.1)} ${f(cx - s * 0.9)} ${f(cy - s * 0.95)} ${f(cx)} ${f(cy - s * 0.35)}C${f(cx + s * 0.9)} ${f(cy - s * 0.95)} ${f(cx + s * 1.3)} ${f(cy + s * 0.1)} ${f(cx)} ${f(cy + s * 0.9)}Z`;
}

export function cloud(cx, cy, w) {
  const h = w * 0.42;
  return blob([
    [cx - w / 2, cy + h / 2],
    [cx - w / 2 - w * 0.02, cy + h * 0.05],
    [cx - w * 0.3, cy - h * 0.25],
    [cx - w * 0.12, cy - h * 0.6],
    [cx + w * 0.12, cy - h * 0.55],
    [cx + w * 0.3, cy - h * 0.25],
    [cx + w / 2 + w * 0.02, cy + h * 0.05],
    [cx + w / 2, cy + h / 2],
  ], 0.9);
}

/** Flower: returns { petals, center } path data. */
export function flower(cx, cy, r, petals = 5) {
  const ps = [];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ps.push(ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.48, r * 0.36, (a * 180) / Math.PI));
  }
  return { petals: ps.join(''), center: circle(cx, cy, r * 0.36) };
}

/** Wavy band from y down to the bottom of the drawing area. */
export function waveBand(y, amp, waves, x0 = 0, x1 = 1000, bottom = 1250) {
  const w = (x1 - x0) / waves;
  let d = `M${f(x0)} ${f(bottom)}L${f(x0)} ${f(y)}`;
  for (let i = 0; i < waves; i++) {
    const xa = x0 + i * w;
    d += `Q${f(xa + w / 4)} ${f(y - amp)} ${f(xa + w / 2)} ${f(y)}Q${f(xa + (3 * w) / 4)} ${f(y + amp)} ${f(xa + w)} ${f(y)}`;
  }
  return d + `L${f(x1)} ${f(bottom)}Z`;
}

export function hills(y, bumps, x0 = 0, x1 = 1000, bottom = 1250) {
  const pts = [[x0, bottom], [x0, y]];
  const w = (x1 - x0) / bumps;
  for (let i = 0; i < bumps; i++) {
    pts.push([x0 + w * (i + 0.5), y - 40 * (i % 2 ? 0.6 : 1)]);
    pts.push([x0 + w * (i + 1), y]);
  }
  let d = `M${f(x0)} ${f(bottom)}L${f(x0)} ${f(y)}`;
  for (let i = 0; i < bumps; i++) {
    const xa = x0 + w * i;
    d += `Q${f(xa + w / 2)} ${f(y - (i % 2 ? 50 : 80))} ${f(xa + w)} ${f(y)}`;
  }
  return d + `L${f(x1)} ${f(bottom)}Z`;
}

/** Mirror an array of points around x = 500. */
export function mirror(pts, cx = 500) {
  return pts.map(([x, y]) => [2 * cx - x, y]);
}
