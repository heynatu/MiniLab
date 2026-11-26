// A4 page layout shared by printing and scanning. Units: millimetres.
export const PAGE = { w: 210, h: 297 };

export const MARKER = {
  size: 14,
  hole: 6,
  centers: { tl: [19, 19], tr: [191, 19], br: [191, 278], bl: [19, 278] },
};

// Drawing area: 1000 x 1250 template units, 0.18 mm per unit.
export const ART = { x: 15, y: 34, w: 180, h: 225, uw: 1000, uh: 1250, scale: 0.18 };

export const CODE = { count: 8, cell: 7, gap: 3.5, cy: 278 };

export function codeCells() {
  const total = CODE.count * CODE.cell + (CODE.count - 1) * CODE.gap;
  const x0 = PAGE.w / 2 - total / 2;
  const cells = [];
  for (let i = 0; i < CODE.count; i++) {
    const x = x0 + i * (CODE.cell + CODE.gap);
    cells.push({ x, y: CODE.cy - CODE.cell / 2, w: CODE.cell, h: CODE.cell, cx: x + CODE.cell / 2, cy: CODE.cy });
  }
  return cells;
}

/** 5 id bits (LSB first) + 3 parity bits. id must be 1..31. */
export function encodeId(id) {
  const b = [0, 1, 2, 3, 4].map((i) => (id >> i) & 1);
  const p0 = b[0] ^ b[1] ^ b[3] ^ b[4];
  const p1 = b[0] ^ b[2] ^ b[3];
  const p2 = b[1] ^ b[2] ^ b[3] ^ b[4];
  return [...b, p0, p1, p2];
}

export function decodeBits(bits) {
  if (!bits || bits.length !== 8) return null;
  const id = bits[0] | (bits[1] << 1) | (bits[2] << 2) | (bits[3] << 3) | (bits[4] << 4);
  if (id === 0) return null;
  const e = encodeId(id);
  for (let i = 5; i < 8; i++) if (e[i] !== bits[i]) return null;
  return id;
}

/** Points on the page that are always blank paper (for white balance). */
export function whiteSamples() {
  const pts = [];
  for (let x = 22; x <= 188; x += 8) pts.push([x, 30.5]);
  for (let x = 30; x <= 180; x += 10) pts.push([x, 264.5]);
  for (let y = 40; y <= 256; y += 12) {
    pts.push([10.5, y]);
    pts.push([199.5, y]);
  }
  return pts;
}

export function artToPage(u, v) {
  return [ART.x + u * ART.scale, ART.y + v * ART.scale];
}
