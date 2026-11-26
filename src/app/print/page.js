// Printable A4 coloring pages (SVG) and canvas renderers for the same artwork.
import { esc } from '../../shared/h.js';
import { PAGE, MARKER, ART, codeCells, encodeId } from './geometry.js';

const INK = '#1d1d1f';
export const W_PART = 20; // drawn twice as wide, the fill covers the inner half
export const W_SCENE = 12;
export const W_DETAIL = 7;

let uid = 0;

function itemSVG(it, colored, wide) {
  const d = it.d;
  switch (it.kind) {
    case 'ink':
      return `<path d="${d}" fill="${INK}"/>`;
    case 'shine':
      return `<path d="${d}" fill="#fff"/>`;
    case 'line':
      return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${W_DETAIL}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'region':
    default: {
      const fill = colored && it.demo ? it.demo : '#fff';
      return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${wide}" stroke-linejoin="round"/><path d="${d}" fill="${fill}"/>`;
    }
  }
}

/** The artwork in template units (1000 x 1250). */
export function artSVGInner(tpl, { colored = false } = {}) {
  let s = '';
  for (const it of tpl.scenery) s += itemSVG(it, colored, W_SCENE);
  for (const p of tpl.parts) {
    const fill = colored ? p.color : '#fff';
    s += `<path d="${p.d}" fill="none" stroke="${INK}" stroke-width="${W_PART}" stroke-linejoin="round"/>`;
    s += `<path d="${p.d}" fill="${fill}"/>`;
    for (const it of p.details) s += itemSVG(it, colored, W_DETAIL * 1.6);
  }
  return s;
}

/** Full A4 page as an SVG string. `label` is optional teacher text (escaped). */
export function pageSVG(tpl, { colored = false, label = '', className = '' } = {}) {
  const id = `ml${++uid}`;
  const m = MARKER;
  const half = m.size / 2;
  const sq = (c) => `<rect x="${c[0] - half}" y="${c[1] - half}" width="${m.size}" height="${m.size}" fill="#000"/>`;
  const br = m.centers.br;
  const hh = m.hole / 2;
  const ring = `<path fill="#000" fill-rule="evenodd" d="M${br[0] - half} ${br[1] - half}h${m.size}v${m.size}h-${m.size}z M${br[0] - hh} ${br[1] - hh}v${m.hole}h${m.hole}v-${m.hole}z"/>`;
  const bits = encodeId(tpl.id);
  const cells = codeCells()
    .map((c, i) => (bits[i]
      ? `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="#000"/>`
      : `<rect x="${c.x + 0.25}" y="${c.y + 0.25}" width="${c.w - 0.5}" height="${c.h - 0.5}" fill="none" stroke="#bbb" stroke-width="0.3"/>`))
    .join('');
  const font = `font-family="Nunito, 'Segoe UI', Arial, sans-serif"`;
  const title = esc(tpl.name);
  const sub = esc(label ? `${label}  ·  Tên bé: ...........................` : tpl.free ? tpl.header : 'Tên bé: ...........................................');
  const bg = colored ? tpl.bg : '#fff';

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${esc(className)}" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}mm" height="${PAGE.h}mm" role="img" aria-label="Trang tô màu ${title}">
<rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>
${sq(m.centers.tl)}${sq(m.centers.tr)}${sq(m.centers.bl)}${ring}
<text x="105" y="20.5" text-anchor="middle" ${font} font-weight="800" font-size="7.5" fill="${INK}">${title}</text>
<text x="105" y="27" text-anchor="middle" ${font} font-weight="600" font-size="3.6" fill="#555">${sub}</text>
<defs><clipPath id="${id}c"><rect x="0" y="0" width="${ART.uw}" height="${ART.uh}" rx="22"/></clipPath></defs>
<g transform="translate(${ART.x} ${ART.y}) scale(${ART.scale})">
<rect x="0" y="0" width="${ART.uw}" height="${ART.uh}" rx="22" fill="${bg}"/>
<g clip-path="url(#${id}c)" stroke-linecap="round">${artSVGInner(tpl, { colored })}</g>
<rect x="0" y="0" width="${ART.uw}" height="${ART.uh}" rx="22" fill="none" stroke="${INK}" stroke-width="3.5"/>
</g>
${cells}
<text x="31" y="279.3" ${font} font-weight="800" font-size="4" fill="${INK}">MiniLab</text>
<text x="179" y="279.3" text-anchor="end" ${font} font-weight="600" font-size="3" fill="#555">tô màu rồi quét</text>
</svg>`;
}

// ---------------- canvas renderers (template units, 1 unit = `scale` px) ----------------

const pathCache = new Map();
export function p2d(d) {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

function drawItem(ctx, it, colored, wide) {
  const p = p2d(it.d);
  if (it.kind === 'ink') { ctx.fillStyle = INK; ctx.fill(p); return; }
  if (it.kind === 'shine') { ctx.fillStyle = '#fff'; ctx.fill(p); return; }
  if (it.kind === 'line') {
    ctx.lineWidth = W_DETAIL;
    ctx.strokeStyle = INK;
    ctx.stroke(p);
    return;
  }
  ctx.lineWidth = wide;
  ctx.strokeStyle = INK;
  ctx.stroke(p);
  ctx.fillStyle = colored && it.demo ? it.demo : '#fff';
  ctx.fill(p);
}

/** Draws the artwork into a canvas sized 1000*scale x 1250*scale. */
export function drawArt(ctx, tpl, { colored = true, scale = 1 } = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = colored ? tpl.bg : '#fff';
  ctx.fillRect(0, 0, ART.uw, ART.uh);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const it of tpl.scenery) drawItem(ctx, it, colored, W_SCENE);
  for (const part of tpl.parts) {
    const p = p2d(part.d);
    ctx.lineWidth = W_PART;
    ctx.strokeStyle = INK;
    ctx.stroke(p);
    ctx.fillStyle = colored ? part.color : '#fff';
    ctx.fill(p);
    for (const it of part.details) drawItem(ctx, it, colored, W_DETAIL * 1.6);
  }
  ctx.restore();
}

/** Fill (plus outline) of one or more parts as a white mask. */
export function drawPartMask(ctx, parts, scale = 1, color = '#fff', lineWidth = W_PART) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  for (const part of parts) {
    const p = p2d(part.d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.restore();
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Demo coloring of a template, as a 1000 x 1250 canvas. */
export function demoArt(tpl, scale = 1) {
  const c = makeCanvas(ART.uw * scale, ART.uh * scale);
  drawArt(c.getContext('2d'), tpl, { colored: true, scale });
  if (tpl.free) drawFreeDemo(c.getContext('2d'), scale);
  return c;
}

/** A sample creature for the free-drawing page demo. */
function drawFreeDemo(ctx, s) {
  ctx.save();
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const body = new Path2D('M500 260C650 260 720 380 720 520C720 700 640 900 500 940C360 900 280 700 280 520C280 380 350 260 500 260Z');
  const armL = new Path2D('M300 560C230 540 180 600 200 650C220 690 280 660 310 630Z');
  const armR = new Path2D('M700 560C770 540 820 600 800 650C780 690 720 660 690 630Z');
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  for (const [p, c] of [[armL, '#3DD6A3'], [armR, '#3DD6A3'], [body, '#9B7BFF']]) {
    ctx.fillStyle = c;
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(440, 470, 46, 56, 0, 0, Math.PI * 2); ctx.ellipse(560, 470, 46, 56, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(448, 482, 22, 0, Math.PI * 2); ctx.arc(568, 482, 22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(450, 600); ctx.quadraticCurveTo(500, 650, 550, 600); ctx.stroke();
  ctx.fillStyle = '#FFD84D';
  ctx.beginPath(); ctx.arc(500, 760, 60, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
