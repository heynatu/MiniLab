// Turns a coloured drawing into a soft, puffy 3D toy with a skeleton.
//  - silhouette + distance transform  -> "inflated" plush surface (front and back)
//  - part masks / chains              -> smooth skin weights for each bone
//  - the scanned drawing              -> texture (the back shows it mirrored)
import * as THREE from 'three';
import { ART } from '../print/geometry.js';
import { drawPartMask, makeCanvas } from '../print/page.js';
import { R, GW, GH, boxBlur, distanceInside, spreadLabels, alphaOf, segDist } from '../scan/fields.js';

const N = GW * GH;
const STEP = 2; // mesh cell = 2 low-res px = 8 template units
const RM = 120; // rounding radius (units)
const TH = 78; // max half thickness (units) at puff 1

function bboxOf(mask) {
  let minx = GW, maxx = -1, miny = GH, maxy = -1;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (!mask[y * GW + x]) continue;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  return maxx < 0 ? null : { minx, maxx, miny, maxy };
}

/** Builds bone list, per-pixel bone labels, puff field and silhouette. */
function rigFromTemplate(tpl) {
  const bones = tpl.bones;
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const labels = new Int32Array(N).fill(-1);
  const partIdx = new Int32Array(N).fill(-1);
  const sil = new Uint8Array(N);
  const cv = makeCanvas(GW, GH);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  tpl.parts.forEach((part, pi) => {
    ctx.clearRect(0, 0, GW, GH);
    drawPartMask(ctx, [part], R);
    const a = alphaOf(cv);
    const chain = part.chain ? part.chain.bones.map((n) => index.get(n)) : null;
    const pts = chain ? [...chain.map((bi) => [bones[bi].x, bones[bi].y]), part.chain.tip] : null;
    for (let i = 0; i < N; i++) {
      if (!a[i]) continue;
      sil[i] = 1;
      partIdx[i] = pi;
      if (chain) {
        const x = ((i % GW) + 0.5) / R;
        const y = (Math.floor(i / GW) + 0.5) / R;
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < chain.length; k++) {
          const dd = segDist(x, y, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
          if (dd < bd) { bd = dd; best = k; }
        }
        labels[i] = chain[best];
      } else {
        labels[i] = index.get(part.bone) ?? 0;
      }
    }
  });
  spreadLabels(labels, GW, GH);
  spreadLabels(partIdx, GW, GH);
  const puff = new Float32Array(N);
  for (let i = 0; i < N; i++) puff[i] = tpl.parts[partIdx[i]]?.puff ?? 1;
  return { bones, labels, puff, sil, blend: tpl.blend ?? 12 };
}

function rigFromDrawing(seg) {
  const sil = seg.low;
  const bb = bboxOf(sil);
  const cx = ((bb.minx + bb.maxx + 1) / 2) / R;
  const top = bb.miny / R;
  const bottom = (bb.maxy + 1) / R;
  const hh = bottom - top;
  const bones = [
    { name: 'root', x: cx, y: bottom },
    { name: 'b1', parent: 'root', x: cx, y: bottom - hh * 0.06 },
    { name: 'b2', parent: 'b1', x: cx, y: bottom - hh * 0.42 },
    { name: 'b3', parent: 'b2', x: cx, y: bottom - hh * 0.72 },
  ];
  const pts = [[cx, bones[1].y], [cx, bones[2].y], [cx, bones[3].y], [cx, top]];
  const labels = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (!sil[i]) continue;
    const x = ((i % GW) + 0.5) / R;
    const y = (Math.floor(i / GW) + 0.5) / R;
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < 3; k++) {
      const dd = segDist(x, y, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
      if (dd < bd) { bd = dd; best = k; }
    }
    labels[i] = best + 1;
  }
  spreadLabels(labels, GW, GH);
  return { bones, labels, puff: new Float32Array(N).fill(0.85), sil, blend: 40 };
}

function sampleF(f, fx, fy) {
  const x = Math.min(GW - 1.001, Math.max(0, fx));
  const y = Math.min(GH - 1.001, Math.max(0, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const ax = x - x0;
  const ay = y - y0;
  const i = y0 * GW + x0;
  return (f[i] * (1 - ax) + f[i + 1] * ax) * (1 - ay) + (f[i + GW] * (1 - ax) + f[i + GW + 1] * ax) * ay;
}

function alphaCanvasFromTemplate(tpl) {
  const s = 0.5;
  const c = makeCanvas(ART.uw * s, ART.uh * s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  // cut inside the printed outline so paper colour never shows at the edge
  drawPartMask(ctx, tpl.parts, s, '#fff', 13);
  return c;
}

function alphaCanvasFromMask(mask) {
  const f = new Float32Array(N);
  for (let i = 0; i < N; i++) f[i] = mask[i];
  boxBlur(f, GW, GH, 1, 1);
  const small = makeCanvas(GW, GH);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(GW, GH);
  for (let i = 0; i < N; i++) {
    const v = Math.round(f[i] * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const c = makeCanvas(ART.uw * 0.5, ART.uh * 0.5);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, c.width, c.height);
  return c;
}

/**
 * tpl: character template. art: 1000 x 1250 canvas with the child's colours.
 * seg: for the free page, the segmentation result.
 */
export function buildToy(tpl, art, seg = null) {
  const rig = tpl.free ? rigFromDrawing(seg) : rigFromTemplate(tpl);
  const { bones, labels, sil } = rig;
  const bb = bboxOf(sil);
  if (!bb) throw new Error('EMPTY_DRAWING');

  // ---- fields
  const dist = distanceInside(sil, GW, GH);
  const puff = boxBlur(rig.puff, GW, GH, 3, 2);
  const blendPx = Math.max(1, Math.round(rig.blend * R));
  const weights = bones.map((_, bi) => {
    let any = false;
    const f = new Float32Array(N);
    for (let i = 0; i < N; i++) if (labels[i] === bi) { f[i] = 1; any = true; }
    return any ? boxBlur(f, GW, GH, blendPx, 2) : null;
  });

  // ---- world scale
  const unitsW = (bb.maxx - bb.minx + 1) / R;
  const unitsH = (bb.maxy - bb.miny + 1) / R;
  const S = 2 / Math.max(unitsH, unitsW * 0.72);
  const root = bones[0];
  const wx = (x) => (x - root.x) * S;
  const wy = (y) => (root.y - y) * S;

  // ---- grid
  const gx0 = Math.max(0, bb.minx - 3);
  const gy0 = Math.max(0, bb.miny - 3);
  const gx1 = Math.min(GW - 1, bb.maxx + 3);
  const gy1 = Math.min(GH - 1, bb.maxy + 3);
  const cols = Math.ceil((gx1 - gx0) / STEP) + 1;
  const rows = Math.ceil((gy1 - gy0) / STEP) + 1;
  const keep = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows - 1; cy++) {
    for (let cx = 0; cx < cols - 1; cx++) {
      let hit = 0;
      for (let yy = gy0 + cy * STEP - 1; yy <= gy0 + (cy + 1) * STEP + 1 && !hit; yy++) {
        for (let xx = gx0 + cx * STEP - 1; xx <= gx0 + (cx + 1) * STEP + 1; xx++) {
          if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && sil[yy * GW + xx]) { hit = 1; break; }
        }
      }
      keep[cy * cols + cx] = hit;
    }
  }
  const vIndex = new Int32Array(cols * rows).fill(-1);
  const pos = [];
  const uv = [];
  const sIdx = [];
  const sW = [];
  let nv = 0;
  const useVertex = (vx, vy) => {
    const k = vy * cols + vx;
    if (vIndex[k] >= 0) return vIndex[k];
    const lx = gx0 + vx * STEP;
    const ly = gy0 + vy * STEP;
    const ux = (lx + 0.5) / R; // template units
    const uy = (ly + 0.5) / R;
    const fx = lx;
    const fy = ly;
    const d = sampleF(dist, fx, fy) / R;
    const p = sampleF(puff, fx, fy);
    const t = Math.min(d, RM) / RM;
    const z = d > 0 ? p * TH * Math.sqrt(1 - (1 - t) * (1 - t)) : 0;
    pos.push(wx(ux), wy(uy), z * S);
    uv.push(ux / ART.uw, 1 - uy / ART.uh);
    const ws = [];
    weights.forEach((f, bi) => {
      if (!f) return;
      const v = sampleF(f, fx, fy);
      if (v > 0.002) ws.push([bi, v]);
    });
    ws.sort((a, b) => b[1] - a[1]);
    const top = ws.slice(0, 4);
    let sum = top.reduce((s, a) => s + a[1], 0);
    if (sum < 1e-4) { top.length = 0; top.push([0, 1]); sum = 1; }
    for (let i = 0; i < 4; i++) {
      sIdx.push(top[i] ? top[i][0] : 0);
      sW.push(top[i] ? top[i][1] / sum : 0);
    }
    vIndex[k] = nv;
    return nv++;
  };
  const front = [];
  for (let cy = 0; cy < rows - 1; cy++) {
    for (let cx = 0; cx < cols - 1; cx++) {
      if (!keep[cy * cols + cx]) continue;
      const a = useVertex(cx, cy);
      const b = useVertex(cx, cy + 1);
      const c = useVertex(cx + 1, cy);
      const d = useVertex(cx + 1, cy + 1);
      front.push(a, b, c, c, b, d);
    }
  }
  // back side: mirrored depth, reversed winding
  const total = nv * 2;
  const P = new Float32Array(total * 3);
  const U = new Float32Array(total * 2);
  const SI = new Uint16Array(total * 4);
  const SW = new Float32Array(total * 4);
  P.set(pos);
  U.set(uv);
  SI.set(sIdx);
  SW.set(sW);
  for (let i = 0; i < nv; i++) {
    P[(nv + i) * 3] = pos[i * 3];
    P[(nv + i) * 3 + 1] = pos[i * 3 + 1];
    P[(nv + i) * 3 + 2] = -pos[i * 3 + 2];
    U[(nv + i) * 2] = uv[i * 2];
    U[(nv + i) * 2 + 1] = uv[i * 2 + 1];
    for (let k = 0; k < 4; k++) {
      SI[(nv + i) * 4 + k] = sIdx[i * 4 + k];
      SW[(nv + i) * 4 + k] = sW[i * 4 + k];
    }
  }
  const idx = new Uint32Array(front.length * 2);
  idx.set(front);
  for (let i = 0; i < front.length; i += 3) {
    idx[front.length + i] = front[i] + nv;
    idx[front.length + i + 1] = front[i + 2] + nv;
    idx[front.length + i + 2] = front[i + 1] + nv;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geom.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  geom.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  // ---- textures & material
  const map = new THREE.CanvasTexture(art);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const alphaCanvas = tpl.free ? alphaCanvasFromMask(sil) : alphaCanvasFromTemplate(tpl);
  const alphaMap = new THREE.CanvasTexture(alphaCanvas);
  const material = new THREE.MeshStandardMaterial({
    map,
    alphaMap,
    alphaTest: 0.5,
    roughness: 0.72,
    metalness: 0,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: map,
    emissiveIntensity: 0.28,
  });

  // ---- skeleton
  const boneObjs = bones.map((b) => {
    const o = new THREE.Bone();
    o.name = b.name;
    return o;
  });
  const byName = {};
  bones.forEach((b, i) => {
    byName[b.name] = boneObjs[i];
    if (b.parent) {
      const p = bones.find((x) => x.name === b.parent);
      boneObjs[i].position.set(wx(b.x) - wx(p.x), wy(b.y) - wy(p.y), 0);
    } else {
      boneObjs[i].position.set(wx(b.x), wy(b.y), 0);
    }
  });
  bones.forEach((b, i) => {
    if (b.parent) byName[b.parent].add(boneObjs[i]);
  });

  const mesh = new THREE.SkinnedMesh(geom, material);
  bones.forEach((b, i) => { if (!b.parent) mesh.add(boneObjs[i]); });
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(boneObjs));
  mesh.frustumCulled = false;

  const rest = boneObjs.map((o) => o.position.clone());
  const box = geom.boundingBox;

  return {
    mesh,
    bones: byName,
    S,
    rootUnits: [root.x, root.y],
    height: box.max.y - box.min.y,
    width: box.max.x - box.min.x,
    box,
    silhouette: sil,
    alphaCanvas,
    resetPose() {
      boneObjs.forEach((o, i) => {
        o.position.copy(rest[i]);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
      });
    },
    dispose() {
      geom.dispose();
      material.dispose();
      map.dispose();
      alphaMap.dispose();
    },
  };
}
