// The 3D stage: renders the toy standing on its own coloring page,
// with idle animation, tap actions, particles, AR camera background,
// photo capture and short video recording. Everything runs on the device.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildToy } from './toy.js';
import { ART, PAGE } from '../print/geometry.js';
import { makeCanvas } from '../print/page.js';
import { play } from './audio.js';

export const THEMES = {
  sea: { bg: '#CDEFFF', ambient: 'bubble', rate: 2.2 },
  meadow: { bg: '#E3F7D4', ambient: 'petal', rate: 1.2 },
  garden: { bg: '#FFF0D9', ambient: 'sparkle', rate: 1.6 },
  space: { bg: '#2F2B66', ambient: 'star', rate: 3 },
  cozy: { bg: '#FFE6F0', ambient: 'heart', rate: 0.9 },
};

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// ---------------- particle sprites ----------------
function spriteTexture(kind) {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = (w = 3) => { g.lineWidth = w; g.strokeStyle = '#2B2A4C'; g.stroke(); };
  switch (kind) {
    case 'bubble':
      g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
      g.beginPath(); g.arc(24, 22, 6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      break;
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11 : 26;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
      }
      g.closePath(); g.fillStyle = '#FFD84D'; g.fill(); outline(3);
      break;
    }
    case 'heart':
      g.beginPath(); g.moveTo(32, 52);
      g.bezierCurveTo(4, 34, 12, 8, 32, 22); g.bezierCurveTo(52, 8, 60, 34, 32, 52);
      g.fillStyle = '#FF7AA8'; g.fill(); outline(3);
      break;
    case 'petal':
      g.beginPath(); g.ellipse(32, 32, 12, 22, 0.5, 0, Math.PI * 2);
      g.fillStyle = '#FFB3CF'; g.fill(); outline(2.5);
      break;
    case 'sparkle':
      g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(36, 28, 60, 32); g.quadraticCurveTo(36, 36, 32, 60);
      g.quadraticCurveTo(28, 36, 4, 32); g.quadraticCurveTo(28, 28, 32, 4);
      g.fillStyle = '#FFF2A8'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#FFB020'; g.stroke();
      break;
    case 'water':
      g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(48, 28, 52, 38, 52, 42); g.arc(32, 42, 20, 0, Math.PI); g.bezierCurveTo(12, 38, 16, 28, 32, 6);
      g.fillStyle = '#9EE3FF'; g.fill(); outline(2.5);
      break;
    case 'ink':
      g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fillStyle = '#5E3B8C'; g.fill();
      g.beginPath(); g.arc(25, 25, 6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill();
      break;
    case 'smoke':
    default: {
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Particles {
  constructor(scene, max = 160) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.textures = {};
    this.pool = [];
    this.live = [];
    this.max = max;
  }

  mat(kind) {
    if (!this.textures[kind]) this.textures[kind] = spriteTexture(kind);
    return new THREE.SpriteMaterial({ map: this.textures[kind], transparent: true, depthWrite: false });
  }

  spawn(kind, p, v, { life = 1.5, size = 0.15, gravity = 0, spin = 0, grow = 0, twinkle = false } = {}) {
    if (this.live.length >= this.max) return;
    let s = this.pool.pop();
    if (!s) s = new THREE.Sprite(this.mat(kind));
    else { s.material.map = this.textures[kind] || (this.textures[kind] = spriteTexture(kind)); s.material.needsUpdate = true; }
    s.position.copy(p);
    s.scale.setScalar(size);
    s.material.opacity = 1;
    s.material.rotation = Math.random() * Math.PI * 2;
    s.visible = true;
    this.group.add(s);
    this.live.push({ s, v: v.clone(), age: 0, life, size, gravity, spin, grow, twinkle });
  }

  burst(kind, at, n = 14, speed = 1.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const v = new THREE.Vector3(Math.cos(a) * speed * 0.6, up * speed, Math.sin(a) * speed * 0.6);
      this.spawn(kind, at, v, { life: 0.9 + Math.random() * 0.6, size: 0.12 + Math.random() * 0.12, gravity: kind === 'smoke' ? -0.3 : 2.2, spin: (Math.random() - 0.5) * 6 });
    }
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.s.visible = false;
        this.group.remove(p.s);
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.v.y -= p.gravity * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.rotation += p.spin * dt;
      const k = p.age / p.life;
      p.s.material.opacity = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const tw = p.twinkle ? 0.7 + 0.3 * Math.sin(p.age * 8) : 1;
      p.s.scale.setScalar(p.size * (1 + p.grow * k) * tw);
    }
  }

  dispose() {
    for (const t of Object.values(this.textures)) t.dispose();
    for (const p of this.live) p.s.material.dispose();
    for (const s of this.pool) s.material.dispose();
  }
}

// ---------------- ground (the coloring page lying flat) ----------------
function ghostTexture(art, alphaCanvas) {
  const c = makeCanvas(ART.uw, ART.uh);
  const g = c.getContext('2d');
  g.drawImage(art, 0, 0);
  const m = makeCanvas(ART.uw, ART.uh);
  const mg = m.getContext('2d', { willReadFrequently: true });
  mg.drawImage(alphaCanvas, 0, 0, ART.uw, ART.uh);
  const id = mg.getImageData(0, 0, ART.uw, ART.uh);
  const paper = (r, gg, b) => {
    for (let i = 0; i < id.data.length; i += 4) {
      const a = id.data[i];
      id.data[i] = r; id.data[i + 1] = gg; id.data[i + 2] = b; id.data[i + 3] = a;
    }
  };
  paper(200, 188, 170);
  mg.putImageData(id, 0, 0);
  for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6], [-4, -4], [4, 4], [-4, 4], [4, -4]]) g.drawImage(m, dx, dy);
  paper(250, 246, 238);
  mg.putImageData(id, 0, 0);
  g.drawImage(m, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(43,42,76,0.42)');
  gr.addColorStop(1, 'rgba(43,42,76,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Stage {
  constructor(host, { theme = 'garden', onTap } = {}) {
    this.host = host;
    this.themeName = theme;
    this.theme = THEMES[theme] || THEMES.garden;
    this.onTap = onTap;
    this.ar = false;
    this.actions = [];
    this.t = 0;
    this.running = true;

    host.classList.add('stage', `theme-${theme}`);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'stage-canvas';
    host.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.8;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.5;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffe6cf, 1.3);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 5);
    const rim = new THREE.DirectionalLight(0xfff0e0, 0.7);
    rim.position.set(-3, 2, -4);
    this.scene.add(hemi, key, rim);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.particles = new Particles(this.scene);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.004;
    this.scene.add(this.shadow);

    this.clock = new THREE.Clock();
    this.tmp = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    this.onPointerDown = (e) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this.onPointerUp = (e) => {
      const d = this.down;
      this.down = null;
      if (!d || performance.now() - d.t > 400 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
      if (this.hitToy(e.clientX, e.clientY)) this.onTap?.();
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.onVis = () => { if (document.hidden) this.clock.stop(); else this.clock.start(); };
    document.addEventListener('visibilitychange', this.onVis);

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.toy) this.frame(false);
  }

  setToy(tpl, art, seg) {
    this.clearToy();
    this.tpl = tpl;
    const toy = buildToy(tpl, art, seg);
    toy.mesh.material.map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.toy = toy;
    this.toyGroup = new THREE.Group();
    this.hoverY = (tpl.hover || 0) * toy.height * 0.6;
    this.toyGroup.add(toy.mesh);
    this.world.add(this.toyGroup);

    // the page lies flat, the character stands where it was drawn
    const S = toy.S;
    const [rx, ry] = toy.rootUnits;
    this.groundTex = ghostTexture(art, toy.alphaCanvas);
    const pageW = ART.uw * S;
    const pageH = ART.uh * S;
    const ground = new THREE.Group();
    const paperScaleX = PAGE.w / ART.w;
    const paperScaleY = PAGE.h / ART.h;
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW * paperScaleX, pageH * paperScaleY),
      new THREE.MeshBasicMaterial({ color: 0xf6f3ee }),
    );
    const artPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      new THREE.MeshBasicMaterial({ map: this.groundTex, color: 0xf2efe9 }),
    );
    // page centre sits a little below the drawing centre (local -Y points toward the viewer)
    paper.position.set(0, -((PAGE.h / 2 - (ART.y + ART.h / 2)) / ART.scale) * S, 0);
    artPlane.position.z = 0.002;
    ground.add(paper, artPlane);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((ART.uw / 2 - rx) * S, -0.002, (ART.uh / 2 - ry) * S);
    this.ground = ground;
    this.world.add(ground);
    this.ground.visible = !this.ar;

    this.shadowBase = Math.max(toy.width, 0.8) * 0.75;
    this.frame(true);
    this.enter = 0;
    this.toyGroup.scale.setScalar(0.001);
    play('magic');
  }

  clearToy() {
    if (!this.toy) return;
    this.world.remove(this.toyGroup);
    this.world.remove(this.ground);
    this.toy.dispose();
    this.ground.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.groundTex?.dispose();
    this.toy = null;
  }

  frame(reset) {
    const H = this.toy.height;
    const W = this.toy.width;
    const target = new THREE.Vector3(0, this.hoverY + H * 0.34, 0);
    const fov = (this.camera.fov * Math.PI) / 180;
    const fit = Math.max(H, (W * 0.9) / Math.max(0.6, Math.min(1.4, this.camera.aspect)));
    const dist = ((fit * 0.5) / Math.tan(fov / 2)) * 1.6;
    this.controls.minDistance = dist * 0.45;
    this.controls.maxDistance = dist * 2.2;
    if (reset) {
      this.camera.position.set(target.x, target.y + dist * 0.3, target.z + dist);
      this.controls.target.copy(target);
    }
    this.controls.update();
  }

  hitToy(cx, cy) {
    if (!this.toy) return false;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObject(this.toy.mesh, false).length > 0;
  }

  rootWorld() {
    this.toy.bones.root.getWorldPosition(this.tmp);
    return this.tmp;
  }

  boneWorld(name) {
    const b = this.toy?.bones[name] || this.toy?.bones.root;
    const v = new THREE.Vector3();
    b.getWorldPosition(v);
    return v;
  }

  action(name) {
    if (!this.toy) return;
    const tpl = this.tpl;
    if (this.actions.some((a) => a.name === name)) return;
    let a;
    if (name === 'jump') {
      a = {
        dur: 1,
        update(p, B) {
          const sq = p < 0.15 ? Math.sin((p / 0.15) * Math.PI) : p > 0.85 ? Math.sin(((p - 0.85) / 0.15) * Math.PI) : 0;
          const air = p < 0.15 || p > 0.85 ? 0 : Math.sin(((p - 0.15) / 0.7) * Math.PI);
          B.root.position.y += air * 0.9;
          B.root.scale.set(1 + sq * 0.14, 1 - sq * 0.2 + air * 0.06, 1 + sq * 0.14);
        },
      };
      play('boing');
    } else if (name === 'spin') {
      a = { dur: 1.1, update(p, B) { B.root.rotation.y += easeInOut(p) * Math.PI * 2; B.root.position.y += Math.sin(p * Math.PI) * 0.25; } };
      play('whoosh');
    } else if (name === 'wiggle') {
      a = { dur: 0.9, update(p, B) { B.root.rotation.z += Math.sin(p * Math.PI * 6) * 0.16 * (1 - p); } };
      play('pop');
    } else if (name === 'special' && tpl.special) {
      const sp = tpl.special;
      a = { dur: sp.dur, update: (p, B, t) => sp.update(p, B, t) };
      play(sp.sound);
      const kind = sp.particles;
      const at = this.boneWorld(sp.at);
      const n = kind === 'smoke' ? 26 : 18;
      this.particles.burst(kind, at, n, kind === 'water' ? 2 : 1.3);
      if (kind === 'water' || kind === 'smoke') {
        let k = 0;
        const iv = setInterval(() => {
          if (!this.toy || ++k > 6) { clearInterval(iv); return; }
          this.particles.burst(kind, this.boneWorld(sp.at), 6, kind === 'water' ? 2.2 : 1);
        }, 180);
      }
    }
    if (!a) return;
    a.name = name;
    a.t0 = this.t;
    this.actions.push(a);
  }

  emitAmbient(dt) {
    if (!this.toy) return;
    const th = this.theme;
    this.ambAcc = (this.ambAcc || 0) + dt * th.rate;
    const H = this.toy.height;
    const W = Math.max(this.toy.width, H);
    while (this.ambAcc > 1) {
      this.ambAcc -= 1;
      const x = (Math.random() - 0.5) * W * 2.2;
      const z = (Math.random() - 0.5) * W * 1.6;
      const kind = th.ambient;
      if (kind === 'bubble') this.particles.spawn('bubble', new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 0.35 + Math.random() * 0.3, 0), { life: 4, size: 0.06 + Math.random() * 0.1 });
      else if (kind === 'petal') this.particles.spawn('petal', new THREE.Vector3(x, H * 1.8, z), new THREE.Vector3(0.1, -0.3, 0), { life: 5, size: 0.08 + Math.random() * 0.06, spin: 1.5 });
      else if (kind === 'sparkle') this.particles.spawn('sparkle', new THREE.Vector3(x, Math.random() * H * 1.6, z), new THREE.Vector3(0, 0.05, 0), { life: 2, size: 0.08 + Math.random() * 0.08, twinkle: true });
      else if (kind === 'star') this.particles.spawn('star', new THREE.Vector3(x * 1.4, Math.random() * H * 2, z - W), new THREE.Vector3(0, 0, 0), { life: 2.5, size: 0.06 + Math.random() * 0.08, twinkle: true });
      else if (kind === 'heart') this.particles.spawn('heart', new THREE.Vector3(x, 0.2, z), new THREE.Vector3(0, 0.25, 0), { life: 4, size: 0.07 + Math.random() * 0.05 });
    }
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (this.toy) {
      const B = this.toy.bones;
      this.toy.resetPose();
      this.tpl.idle(this.t, B);
      this.actions = this.actions.filter((a) => {
        const p = (this.t - a.t0) / a.dur;
        if (p >= 1) return false;
        a.update(p, B, this.t);
        return true;
      });
      if (this.enter < 1) {
        this.enter = Math.min(1, this.enter + dt / 1.1);
        const e = easeOutBack(this.enter);
        this.toyGroup.scale.setScalar(Math.max(0.001, e));
        this.toyGroup.position.y = this.hoverY - (1 - this.enter) * 0.4;
        if (this.enter >= 1) this.particles.burst('sparkle', new THREE.Vector3(0, this.hoverY + this.toy.height * 0.5, 0), 20, 1.6);
      } else {
        this.toyGroup.position.y = this.hoverY;
      }
      this.scene.updateMatrixWorld();
      const rp = this.rootWorld();
      const lift = Math.max(0, rp.y);
      const k = Math.max(0.25, 1 - lift / 4);
      this.shadow.position.set(rp.x, 0.004, rp.z);
      this.shadow.scale.setScalar(this.shadowBase * k * this.toyGroup.scale.x);
      this.shadow.material.opacity = k;
      this.emitAmbient(dt);
    }
    this.particles.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.rec) this.recordFrame();
  }

  // ---------------- AR camera background ----------------
  setAR(stream) {
    if (stream) {
      if (!this.video) {
        this.video = document.createElement('video');
        this.video.className = 'stage-video';
        this.video.setAttribute('playsinline', '');
        this.video.muted = true;
        this.video.autoplay = true;
        this.host.prepend(this.video);
      }
      this.video.srcObject = stream;
      this.video.play().catch(() => {});
      this.ar = true;
    } else {
      if (this.video) {
        this.video.srcObject = null;
        this.video.remove();
        this.video = null;
      }
      this.ar = false;
    }
    this.host.classList.toggle('is-ar', this.ar);
    if (this.ground) this.ground.visible = !this.ar;
  }

  drawBackground(ctx, w, h) {
    if (this.ar && this.video && this.video.videoWidth) {
      const vw = this.video.videoWidth;
      const vh = this.video.videoHeight;
      const s = Math.max(w / vw, h / vh);
      ctx.drawImage(this.video, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
    } else {
      ctx.fillStyle = this.theme.bg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ---------------- photo ----------------
  async capture() {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    this.drawBackground(g, c.width, c.height);
    g.drawImage(src, 0, 0);
    const fs = Math.round(c.height * 0.035);
    g.font = `800 ${fs}px Nunito, sans-serif`;
    g.textAlign = 'right';
    g.lineWidth = Math.max(2, fs * 0.18);
    g.strokeStyle = 'rgba(43,42,76,0.85)';
    g.fillStyle = '#fff';
    g.strokeText('MiniLab', c.width - fs * 0.8, c.height - fs * 0.8);
    g.fillText('MiniLab', c.width - fs * 0.8, c.height - fs * 0.8);
    play('shutter');
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  // ---------------- video ----------------
  static canRecord() {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  }

  startRecording(maxSeconds = 20) {
    if (this.rec || !Stage.canRecord()) return false;
    const src = this.renderer.domElement;
    const s = Math.min(1, 1280 / Math.max(src.width, src.height));
    const c = makeCanvas(Math.round((src.width * s) / 2) * 2, Math.round((src.height * s) / 2) * 2);
    const stream = c.captureStream(30);
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
    } catch {
      return false;
    }
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    this.rec = { c, g: c.getContext('2d'), recorder, chunks, mime: recorder.mimeType || mime || 'video/webm' };
    recorder.start(250);
    this.rec.timer = setTimeout(() => this.onRecordLimit?.(), maxSeconds * 1000);
    return true;
  }

  recordFrame() {
    const { c, g } = this.rec;
    this.drawBackground(g, c.width, c.height);
    g.drawImage(this.renderer.domElement, 0, 0, c.width, c.height);
  }

  stopRecording() {
    const rec = this.rec;
    if (!rec) return Promise.resolve(null);
    this.rec = null;
    clearTimeout(rec.timer);
    return new Promise((res) => {
      rec.recorder.onstop = () => {
        const blob = new Blob(rec.chunks, { type: rec.mime.split(';')[0] });
        res({ blob, ext: rec.mime.includes('mp4') ? 'mp4' : 'webm' });
      };
      rec.recorder.stop();
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.rec) { try { this.rec.recorder.stop(); } catch { /* ignore */ } this.rec = null; }
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.setAR(null);
    this.clearToy();
    this.particles.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.map.dispose();
    this.shadow.material.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
