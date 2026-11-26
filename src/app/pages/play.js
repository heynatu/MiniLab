import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { MASCOT_SVG } from '../../shared/mascot.js';
import { downloadBlob } from '../../shared/deploy-guide.js';
import { galleryGet, galleryPut } from '../../shared/idb.js';
import { bySlug, byId } from '../templates/characters.js';
import { demoArt, makeCanvas } from '../print/page.js';
import { segmentDrawing } from '../scan/segment.js';
import { Stage } from '../three/stage.js';
import { isMuted, setMuted, unlockAudio } from '../three/audio.js';
import { openCamera, stopStream, cameraErrorText } from '../scan/camera.js';
import { ensureConsent, toast } from '../ui/ui.js';

async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob);
  const c = makeCanvas(1000, 1250);
  c.getContext('2d').drawImage(bmp, 0, 0, 1000, 1250);
  bmp.close?.();
  return c;
}

export function canvasToBlob(c, type = 'image/jpeg', q = 0.92) {
  return new Promise((res) => c.toBlob(res, type, q));
}

export async function saveCreation(creation) {
  const art = await canvasToBlob(creation.art);
  const t = makeCanvas(240, 300);
  t.getContext('2d').drawImage(creation.art, 0, 0, 240, 300);
  const thumb = await canvasToBlob(t, 'image/jpeg', 0.85);
  const id = creation.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  await galleryPut({ id, tplId: creation.tpl.id, created: creation.created || Date.now(), art, thumb });
  creation.id = id;
  return id;
}

async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'MiniLab' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancel';
    }
  }
  downloadBlob(name, blob);
  return 'downloaded';
}

function emptyState(root) {
  root.append(h('section', { class: 'empty card' },
    h('div', { class: 'empty-mascot', html: MASCOT_SVG }),
    h('h1', { class: 'heading-4' }, 'Chưa có bức tranh nào để làm sống dậy'),
    h('p', { class: 'body-3 muted' }, 'Hãy quét một bức tranh đã tô, hoặc xem thử một nhân vật mẫu trong thư viện.'),
    h('div', { class: 'row-center' },
      h('a', { class: 'btn btn-primary btn-lg', href: '#/scan', html: `${icon('scan')}<span>Quét tranh</span>` }),
      h('a', { class: 'btn btn-lg', href: '#/library', html: `${icon('palette')}<span>Thư viện</span>` }))));
}

export default async function play(root, params, { navigate, appState }) {
  let tpl = null;
  let art = null;
  let creation = null;
  let backTo = '#/library';
  try {
    if (params.get('demo')) {
      tpl = bySlug(params.get('demo'));
      if (tpl) art = demoArt(tpl);
    } else if (params.get('gallery')) {
      const item = await galleryGet(params.get('gallery'));
      if (item) {
        tpl = byId(item.tplId);
        art = await blobToCanvas(item.art);
        creation = { id: item.id, tpl, art, created: item.created, saved: true };
      }
      backTo = '#/gallery';
    } else if (appState.creation) {
      creation = appState.creation;
      tpl = creation.tpl;
      art = creation.art;
      backTo = '#/scan';
    }
  } catch (e) {
    console.error(e);
  }
  if (!tpl || !art) {
    emptyState(root);
    return undefined;
  }

  let seg = null;
  if (tpl.free) {
    seg = creation?.seg || segmentDrawing(art);
    if (!seg.ok) {
      root.append(h('section', { class: 'empty card' },
        h('div', { class: 'empty-mascot', html: MASCOT_SVG }),
        h('h1', { class: 'heading-5' }, 'MiniLab chưa thấy hình vẽ trên trang'),
        h('p', { class: 'body-6 muted' }, 'Hãy vẽ nét đậm, kín và tô màu đầy đủ, rồi quét lại nhé.'),
        h('a', { class: 'btn btn-primary', href: '#/scan' }, 'Quét lại')));
      return undefined;
    }
  }

  document.body.classList.add('immersive');
  root.classList.add('page-play');
  const host = h('div', { class: 'stage-host' });
  const title = h('h1', { class: 'play-title title-2' }, tpl.name);
  let arStream = null;
  let stage;

  const soundBtn = h('button', { class: 'play-chip', type: 'button' });
  const paintSound = () => {
    soundBtn.innerHTML = icon(isMuted() ? 'speaker-slash' : 'speaker-high');
    soundBtn.setAttribute('aria-label', isMuted() ? 'Bật âm thanh' : 'Tắt âm thanh');
    soundBtn.setAttribute('aria-pressed', String(!isMuted()));
  };
  soundBtn.addEventListener('click', () => { setMuted(!isMuted()); paintSound(); });
  paintSound();

  const arBtn = h('button', { class: 'play-chip', type: 'button', 'aria-pressed': 'false', html: `${icon('camera')}<span>Thực tế</span>` });
  arBtn.addEventListener('click', async () => {
    if (arStream) {
      stopStream(arStream);
      arStream = null;
      stage.setAR(null);
      arBtn.setAttribute('aria-pressed', 'false');
      return;
    }
    if (!(await ensureConsent('camera'))) return;
    try {
      arStream = await openCamera(null, { facing: 'environment', width: 1280, height: 720 });
      stage.setAR(arStream);
      arBtn.setAttribute('aria-pressed', 'true');
      toast('Đang dùng camera làm nền. Hình ảnh không rời khỏi máy này.');
    } catch (e) {
      toast(cameraErrorText(e), { kind: 'error', ms: 5000 });
    }
  });

  const hint = h('div', { class: 'play-hint caption-3', role: 'note' }, icon('hand-tap') ? h('span', { html: icon('hand-tap') }) : null, 'Chạm vào bạn ấy nhé. Kéo để xoay, chụm hai ngón để phóng to.');
  const hideHint = () => hint.classList.add('is-hidden');

  const actBtn = (label, ico, cls, fn) => h('button', { class: `play-action ${cls}`, type: 'button', onclick: () => { unlockAudio(); hideHint(); fn(); } },
    h('span', { class: 'play-action-ico', html: icon(ico) }), h('span', { class: 'play-action-label' }, label));

  const special = actBtn(tpl.special?.label || 'Phép màu', tpl.special?.icon || 'sparkle', 'is-pink', () => stage.action('special'));
  const jump = actBtn('Nhảy', 'arrow-counter-clockwise', 'is-yellow', () => stage.action('jump'));
  jump.querySelector('.play-action-ico').innerHTML = icon('shooting-star');
  const spin = actBtn('Xoay vòng', 'arrow-counter-clockwise', 'is-blue', () => stage.action('spin'));

  const photoBtn = h('button', { class: 'play-tool', type: 'button', 'aria-label': 'Chụp ảnh', html: `${icon('aperture')}<span>Chụp ảnh</span>` });
  photoBtn.addEventListener('click', async () => {
    const blob = await stage.capture();
    if (!blob) return;
    host.classList.add('flash');
    setTimeout(() => host.classList.remove('flash'), 350);
    const r = await shareOrDownload(blob, `minilab-${tpl.slug}-${Date.now()}.png`);
    if (r === 'downloaded') toast('Đã lưu ảnh vào thư mục Tải xuống của máy.', { kind: 'ok' });
  });

  let recording = false;
  const recBtn = h('button', { class: 'play-tool', type: 'button', 'aria-label': 'Quay video', html: `${icon('record')}<span>Quay video</span>` });
  const stopRec = async () => {
    if (!recording) return;
    recording = false;
    recBtn.classList.remove('is-rec');
    recBtn.innerHTML = `${icon('record')}<span>Quay video</span>`;
    const res = await stage.stopRecording();
    if (res?.blob?.size) {
      const r = await shareOrDownload(res.blob, `minilab-${tpl.slug}-${Date.now()}.${res.ext}`);
      if (r === 'downloaded') toast('Đã lưu video vào thư mục Tải xuống của máy.', { kind: 'ok' });
    }
  };
  recBtn.addEventListener('click', () => {
    if (recording) { stopRec(); return; }
    if (!stage.startRecording(20)) {
      toast('Trình duyệt này chưa hỗ trợ quay video. Bạn vẫn chụp ảnh được.', { kind: 'error' });
      return;
    }
    recording = true;
    recBtn.classList.add('is-rec');
    recBtn.innerHTML = `${icon('stop')}<span>Dừng quay</span>`;
    toast('Đang quay, tối đa 20 giây.');
  });
  if (!Stage.canRecord()) recBtn.hidden = true;

  const saveBtn = h('button', { class: 'play-tool', type: 'button', html: `${icon('heart')}<span>Lưu vào bộ sưu tập</span>` });
  if (!creation || creation.saved) saveBtn.hidden = true;
  saveBtn.addEventListener('click', async () => {
    try {
      await saveCreation(creation);
      creation.saved = true;
      saveBtn.hidden = true;
      toast('Đã lưu vào bộ sưu tập trên máy này.', { kind: 'ok' });
    } catch {
      toast('Chưa lưu được. Trình duyệt có thể đang chặn bộ nhớ (chế độ ẩn danh).', { kind: 'error', ms: 5000 });
    }
  });

  const top = h('div', { class: 'play-top' },
    h('a', { class: 'play-chip', href: backTo, 'aria-label': 'Quay lại', html: icon('arrow-left') }),
    title,
    h('div', { class: 'play-top-right' }, soundBtn, arBtn));
  const bottom = h('div', { class: 'play-bottom' },
    h('div', { class: 'play-actions' }, special, jump, spin),
    h('div', { class: 'play-tools' }, photoBtn, recBtn, saveBtn));

  root.append(h('div', { class: 'play' }, host, top, hint, bottom));

  stage = new Stage(host, {
    theme: tpl.theme,
    onTap: () => {
      unlockAudio();
      hideHint();
      const pick = ['special', 'jump', 'spin', 'wiggle'][Math.floor(Math.random() * 4)];
      stage.action(pick);
      stage.particles.burst(tpl.theme === 'space' ? 'star' : 'heart', stage.boneWorld('root').add({ x: 0, y: stage.toy.height * 0.6, z: 0 }), 8, 1);
    },
  });
  stage.onRecordLimit = stopRec;
  if (import.meta.env.DEV) window.__stage = stage;
  try {
    stage.setToy(tpl, art, seg);
  } catch (e) {
    console.error(e);
    toast('Không dựng được nhân vật từ bức tranh này. Hãy quét lại rõ hơn.', { kind: 'error', ms: 5000 });
  }
  setTimeout(hideHint, 9000);

  return () => {
    if (recording) stage.stopRecording();
    if (arStream) stopStream(arStream);
    stage.dispose();
    document.body.classList.remove('immersive');
  };
}
