import { h, clear } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { MASCOT_SVG } from '../../shared/mascot.js';
import { CHARACTERS, byId } from '../templates/characters.js';
import { makeCanvas } from '../print/page.js';
import { detectMarkers, scaleCorners } from '../scan/detect.js';
import { processScan, pageHomography, measureLight, readCode, warpArt } from '../scan/warp.js';
import { segmentDrawing } from '../scan/segment.js';
import { openCamera, stopStream, torchSupported, setTorch, cameraErrorText } from '../scan/camera.js';
import { ensureConsent, toast } from '../ui/ui.js';
import { play as sfx, unlockAudio } from '../three/audio.js';

const MAX_SIDE = 2400;
const LIVE_SIDE = 480;

function imageDataOf(source, w, h, maxSide) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = makeCanvas(w * s, h * s);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return { canvas: c, ctx, img: ctx.getImageData(0, 0, c.width, c.height), s };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function scan(root, params, { navigate, appState }) {
  let stream = null;
  let loopTimer = null;
  let facing = 'environment';
  let torchOn = false;
  let alive = true;
  let lastTplId = appState.lastTplId || null;

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) handleFile(f);
  });

  function stopCamera() {
    clearTimeout(loopTimer);
    loopTimer = null;
    stopStream(stream);
    stream = null;
    document.body.classList.remove('immersive');
  }

  function view(...kids) {
    stopCamera();
    clear(root);
    root.className = 'page page-scan';
    root.append(...kids, fileInput);
  }

  // ---------------- 1. choose ----------------
  function showChoose() {
    const opt = (ico, title, desc, cls, onClick) => h('button', { class: `scan-option card ${cls}`, type: 'button', onclick: onClick },
      h('span', { class: 'scan-option-ico', html: icon(ico) }),
      h('span', { class: 'scan-option-text' }, h('span', { class: 'title-1' }, title), h('span', { class: 'body-6 muted' }, desc)));
    view(
      h('section', { class: 'page-head' },
        h('h1', { class: 'heading-3' }, 'Quét bức tranh bé đã tô'),
        h('p', { class: 'body-3 muted' }, 'MiniLab nhìn bốn ô vuông đen ở góc giấy để nhận ra bức tranh, rồi biến nó thành nhân vật 3D. Mọi việc diễn ra ngay trên máy này.')),
      h('div', { class: 'scan-options' },
        opt('camera', 'Dùng camera', 'Hướng camera vào tờ giấy, MiniLab tự chụp khi thấy đủ bốn góc.', 'is-pink', startCamera),
        opt('image', 'Chọn ảnh có sẵn', 'Chọn một ảnh đã chụp cả tờ giấy, thấy rõ bốn ô vuông đen.', 'is-blue', pickFile)),
      h('section', { class: 'scan-tips card' },
        h('h2', { class: 'title-1' }, 'Mẹo để quét đẹp'),
        h('ul', { class: 'tips-list' },
          tip('lightning', 'Đủ sáng', 'Gần cửa sổ hoặc dưới đèn, tránh bóng điện thoại đè lên tranh.'),
          tip('arrows-out-cardinal', 'Thấy đủ bốn góc', 'Cả bốn ô vuông đen phải nằm trong khung hình.'),
          tip('paint-brush', 'Tô đậm màu', 'Bút chì màu hoặc sáp màu đều được, tô càng kín càng đẹp.'),
          tip('printer', 'In đúng tỉ lệ', 'In trang từ Thư viện tranh, khổ A4, tỉ lệ 100%.')),
        h('a', { class: 'btn btn-sm', href: '#/library', html: `${icon('palette')}<span>Chưa có tranh? Vào thư viện để in</span>` })),
    );
  }

  function tip(ico, title, text) {
    return h('li', { class: 'tip-item' }, h('span', { class: 'tip-ico', html: icon(ico) }), h('div', null, h('div', { class: 'title-4' }, title), h('div', { class: 'body-6 muted' }, text)));
  }

  async function pickFile() {
    if (!(await ensureConsent('photos'))) return;
    fileInput.click();
  }

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      toast('File này không phải là ảnh. Hãy chọn ảnh JPG hoặc PNG.', { kind: 'error' });
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      toast('Ảnh lớn quá 40 MB. Hãy chọn ảnh nhỏ hơn.', { kind: 'error' });
      return;
    }
    showWorking('Đang đọc ảnh');
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      toast('Không đọc được ảnh này. Hãy thử ảnh khác.', { kind: 'error' });
      showChoose();
      return;
    }
    const { canvas, img } = imageDataOf(bmp, bmp.width, bmp.height, MAX_SIDE);
    bmp.close?.();
    await analyse(canvas, img, null);
  }

  // ---------------- 2. camera ----------------
  async function startCamera() {
    unlockAudio();
    if (!(await ensureConsent('camera'))) return;
    const video = h('video', { class: 'cam-video', playsinline: true, muted: true, autoplay: true });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cam-overlay');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('class', 'cam-quad');
    svg.append(poly);
    const status = h('div', { class: 'cam-status title-4', role: 'status' }, 'Đang mở camera');
    const torchBtn = h('button', { class: 'play-chip', type: 'button', hidden: true, 'aria-label': 'Bật đèn', 'aria-pressed': 'false', html: icon('lightning') });
    const flipBtn = h('button', { class: 'play-chip', type: 'button', 'aria-label': 'Đổi camera', html: icon('camera-rotate') });
    const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Chụp ngay' }, h('span'));
    const cam = h('div', { class: 'cam' },
      video, svg,
      h('div', { class: 'cam-guide', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      h('div', { class: 'play-top' },
        h('button', { class: 'play-chip', type: 'button', 'aria-label': 'Đóng camera', html: icon('x'), onclick: showChoose }),
        h('div', { class: 'play-title title-4' }, 'Đưa cả tờ giấy vào khung'),
        h('div', { class: 'play-top-right' }, torchBtn, flipBtn)),
      status,
      h('div', { class: 'cam-bottom' },
        h('button', { class: 'play-chip', type: 'button', html: `${icon('image')}<span>Chọn ảnh</span>`, onclick: pickFile }),
        shutter,
        h('span', { class: 'cam-spacer' })));
    view(cam);
    document.body.classList.add('immersive');

    try {
      stream = await openCamera(video, { facing });
    } catch (e) {
      stopCamera();
      showChoose();
      toast(cameraErrorText(e), { kind: 'error', ms: 6000 });
      return;
    }
    if (!alive) { stopCamera(); return; }
    torchBtn.hidden = !torchSupported(stream);
    torchBtn.onclick = async () => {
      torchOn = !torchOn;
      if (await setTorch(stream, torchOn)) torchBtn.setAttribute('aria-pressed', String(torchOn));
    };
    flipBtn.onclick = async () => {
      facing = facing === 'environment' ? 'user' : 'environment';
      startCamera();
    };

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    const live = makeCanvas(1, 1);
    const lctx = live.getContext('2d', { willReadFrequently: true });
    let stable = 0;
    let prev = null;
    let lastDet = null;
    let capturing = false;

    const capture = async () => {
      if (capturing || !stream) return;
      capturing = true;
      sfx('shutter');
      cam.classList.add('flash');
      const W = video.videoWidth;
      const H = video.videoHeight;
      const { canvas, img, s } = imageDataOf(video, W, H, MAX_SIDE);
      const liveDet = lastDet ? { normal: scaleCorners(lastDet.det.normal, lastDet.k * s), mirrored: scaleCorners(lastDet.det.mirrored, lastDet.k * s) } : null;
      stopCamera();
      showWorking('Đang làm phép');
      await wait(30);
      await analyse(canvas, img, liveDet);
    };
    shutter.addEventListener('click', capture);

    const tick = () => {
      if (!stream || !alive) return;
      const W = video.videoWidth;
      const H = video.videoHeight;
      if (W && H) {
        const k = Math.max(W, H) / LIVE_SIDE;
        live.width = Math.round(W / k);
        live.height = Math.round(H / k);
        lctx.drawImage(video, 0, 0, live.width, live.height);
        const det = detectMarkers(lctx.getImageData(0, 0, live.width, live.height));
        if (det) {
          const c = scaleCorners(det.normal, k);
          poly.setAttribute('points', ['tl', 'tr', 'br', 'bl'].map((q) => `${c[q].x},${c[q].y}`).join(' '));
          poly.classList.add('is-on');
          const diag = Math.hypot(W, H);
          const moved = prev ? Math.max(...['tl', 'tr', 'br', 'bl'].map((q) => Math.hypot(c[q].x - prev[q].x, c[q].y - prev[q].y))) / diag : 1;
          stable = moved < 0.02 ? stable + 1 : 1;
          prev = c;
          lastDet = { det, k };
          if (stable >= 6) { capture(); return; }
          status.textContent = stable >= 3 ? 'Thấy rồi, giữ yên máy nhé' : 'Thấy bốn góc rồi';
          status.classList.add('is-ok');
        } else {
          stable = 0;
          prev = null;
          poly.classList.remove('is-on');
          status.textContent = 'Đang tìm bốn ô vuông đen ở góc giấy';
          status.classList.remove('is-ok');
        }
      }
      loopTimer = setTimeout(tick, 110);
    };
    status.textContent = 'Đang tìm bốn ô vuông đen ở góc giấy';
    tick();
  }

  // ---------------- 3. analyse ----------------
  function showWorking(text) {
    view(h('section', { class: 'working' },
      h('div', { class: 'working-mascot', html: MASCOT_SVG }),
      h('p', { class: 'title-1', role: 'status' }, text, ' ', h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')))));
  }

  async function analyse(canvas, img, liveDet) {
    await wait(20);
    const small = imageDataOf(canvas, canvas.width, canvas.height, 1000);
    let det = detectMarkers(small.img);
    if (det) det = { normal: scaleCorners(det.normal, 1 / small.s), mirrored: scaleCorners(det.mirrored, 1 / small.s) };
    else det = liveDet;
    if (!det) {
      showAdjust(canvas, img, null);
      return;
    }
    const res = processScan(img, det);
    if (!res.H) { showAdjust(canvas, img, det.normal); return; }
    const art = warpArt(img, res.H, res.light);
    showConfirm({ art, id: res.id, canvas, img, corners: res.corners });
  }

  // ---------------- 4. manual corners ----------------
  function showAdjust(canvas, img, corners) {
    const W = canvas.width;
    const H = canvas.height;
    const pts = corners
      ? { ...corners }
      : { tl: { x: W * 0.12, y: H * 0.1 }, tr: { x: W * 0.88, y: H * 0.1 }, br: { x: W * 0.88, y: H * 0.9 }, bl: { x: W * 0.12, y: H * 0.9 } };
    const stageEl = h('div', { class: 'adjust-stage' });
    const shown = makeCanvas(W, H);
    shown.getContext('2d').drawImage(canvas, 0, 0);
    shown.className = 'adjust-photo';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'adjust-svg');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    svg.append(poly);
    const loupe = makeCanvas(130, 130);
    loupe.className = 'loupe';
    loupe.hidden = true;
    stageEl.append(shown, svg, loupe);
    const names = { tl: 'Góc trên trái', tr: 'Góc trên phải', br: 'Góc dưới phải (ô có lỗ)', bl: 'Góc dưới trái' };
    const handles = {};
    const place = () => {
      for (const k of Object.keys(pts)) {
        handles[k].style.left = `${(pts[k].x / W) * 100}%`;
        handles[k].style.top = `${(pts[k].y / H) * 100}%`;
      }
      poly.setAttribute('points', ['tl', 'tr', 'br', 'bl'].map((q) => `${pts[q].x},${pts[q].y}`).join(' '));
      poly.setAttribute('stroke-width', String(Math.max(W, H) / 250));
    };
    const drawLoupe = (k) => {
      const g = loupe.getContext('2d');
      const z = 3;
      const r = 130 / z / 2;
      const sc = W / shown.getBoundingClientRect().width;
      g.clearRect(0, 0, 130, 130);
      g.drawImage(canvas, pts[k].x - r * sc, pts[k].y - r * sc, 2 * r * sc, 2 * r * sc, 0, 0, 130, 130);
      g.strokeStyle = '#FF7AA8';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(65, 45); g.lineTo(65, 85); g.moveTo(45, 65); g.lineTo(85, 65); g.stroke();
      loupe.style.left = handles[k].style.left;
      loupe.style.top = handles[k].style.top;
    };
    for (const k of ['tl', 'tr', 'br', 'bl']) {
      const el = h('button', { class: `handle handle-${k}`, type: 'button', 'aria-label': `${names[k]}: kéo vào giữa ô vuông đen. Dùng phím mũi tên để chỉnh.` });
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        loupe.hidden = false;
        const move = (ev) => {
          const r = shown.getBoundingClientRect();
          pts[k] = { x: Math.max(0, Math.min(W, ((ev.clientX - r.left) / r.width) * W)), y: Math.max(0, Math.min(H, ((ev.clientY - r.top) / r.height) * H)) };
          place();
          drawLoupe(k);
        };
        const up = () => {
          loupe.hidden = true;
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
      el.addEventListener('keydown', (e) => {
        const step = (e.shiftKey ? 10 : 2) * (W / 500);
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        pts[k] = { x: pts[k].x + d[0], y: pts[k].y + d[1] };
        place();
      });
      handles[k] = el;
      stageEl.append(el);
    }
    place();
    const picker = templatePicker(lastTplId, (id) => { lastTplId = id; });
    view(
      h('section', { class: 'page-head' },
        h('h1', { class: 'heading-4' }, 'Giúp MiniLab tìm bốn góc'),
        h('p', { class: 'body-6 muted' }, 'Kéo mỗi chấm tròn vào giữa một ô vuông đen ở góc giấy. Chấm có viền đôi đặt vào ô có lỗ ở góc dưới bên phải.')),
      stageEl,
      h('div', { class: 'adjust-pick' }, h('h2', { class: 'title-2' }, 'Đây là trang nào?'), picker.el),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', html: `${icon('arrow-left')}<span>Quét lại</span>`, onclick: showChoose }),
        h('button', {
          class: 'btn btn-primary', type: 'button', html: `${icon('check')}<span>Tiếp tục</span>`,
          onclick: async () => {
            const Hm = pageHomography(pts);
            if (!Hm) { toast('Bốn chấm chưa tạo thành một hình tứ giác. Hãy kéo lại.', { kind: 'error' }); return; }
            showWorking('Đang làm phép');
            await wait(30);
            const light = measureLight(img, Hm);
            const id = readCode(img, Hm, light) || picker.value();
            const art = warpArt(img, Hm, light);
            showConfirm({ art, id, canvas, img, corners: pts });
          },
        })),
    );
  }

  function templatePicker(selected, onChange) {
    let value = selected;
    const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Chọn trang tô màu' });
    const paint = () => {
      wrap.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.id) === value)));
    };
    for (const t of CHARACTERS) {
      wrap.append(h('button', {
        class: 'chip', type: 'button', role: 'radio', dataset: { id: t.id }, 'aria-checked': 'false',
        onclick: () => { value = t.id; paint(); onChange?.(t.id); },
      }, t.name));
    }
    paint();
    return { el: wrap, value: () => value };
  }

  // ---------------- 5. confirm ----------------
  function showConfirm({ art, id, canvas, img, corners }) {
    let tplId = id || lastTplId;
    const detected = !!id;
    const preview = makeCanvas(400, 500);
    preview.getContext('2d').drawImage(art, 0, 0, 400, 500);
    preview.className = 'confirm-art';
    const nameEl = h('strong');
    const err = h('div', { class: 'form-error', role: 'alert' });
    const go = h('button', { class: 'btn btn-primary btn-lg', type: 'button', html: `${icon('magic-wand')}<span>Làm sống dậy</span>` });
    const picker = templatePicker(tplId, (v) => { tplId = v; paintName(); err.textContent = ''; });
    function paintName() {
      const t = byId(tplId);
      nameEl.textContent = t ? t.name : 'chưa chọn';
    }
    paintName();
    go.addEventListener('click', () => {
      const tpl = byId(tplId);
      if (!tpl) { err.textContent = 'Hãy chọn đây là trang nào trước nhé.'; return; }
      let seg = null;
      if (tpl.free) {
        seg = segmentDrawing(art);
        if (!seg.ok) { err.textContent = 'MiniLab chưa thấy hình vẽ. Hãy vẽ nét đậm, tô kín rồi quét lại.'; return; }
      }
      appState.lastTplId = tplId;
      appState.creation = { tpl, art, seg, created: Date.now(), saved: false };
      sfx('magic');
      navigate('play', { src: 'scan' });
    });
    view(
      h('section', { class: 'confirm' },
        h('div', { class: 'confirm-frame card' }, preview),
        h('div', { class: 'confirm-side' },
          h('span', { class: `badge ${detected ? 'badge-mint' : 'badge-yellow'}` }, detected ? 'Đã nhận ra trang' : 'Cần bạn chọn trang'),
          h('h1', { class: 'heading-4' }, 'Bức tranh đẹp quá'),
          h('p', { class: 'body-3' }, 'Đây là trang: ', nameEl),
          h('details', { class: 'confirm-change', open: !detected },
            h('summary', { class: 'title-4' }, detected ? 'Không đúng? Chọn trang khác' : 'Chọn đúng trang bé đã tô'),
            picker.el),
          err,
          h('div', { class: 'row-actions' },
            h('button', { class: 'btn', type: 'button', html: `${icon('arrow-counter-clockwise')}<span>Quét lại</span>`, onclick: showChoose }),
            h('button', { class: 'btn btn-ghost', type: 'button', html: `${icon('arrows-out-cardinal')}<span>Chỉnh bốn góc</span>`, onclick: () => showAdjust(canvas, img, corners) }),
            go))),
    );
    void canvas;
  }

  showChoose();
  return () => {
    alive = false;
    stopCamera();
  };
}
