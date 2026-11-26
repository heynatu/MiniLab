// Small UI kit: toasts, dialogs, consent prompts.
import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { MASCOT_SVG } from '../../shared/mascot.js';

let toastHost;
export function toast(message, { kind = 'info', ms = 3200 } = {}) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const ico = kind === 'ok' ? 'check' : kind === 'error' ? 'warning' : 'info';
  const el = h('div', { class: `toast toast-${kind}` }, h('span', { html: icon(ico) }), h('span', null, message));
  toastHost.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

/**
 * Generic dialog. Resolves with the value of the clicked action (or null on dismiss).
 * actions: [{ label, value, kind: 'primary'|'ghost'|'danger', icon }]
 */
export function dialog({ title, body, actions = [{ label: 'Đóng', value: null }], mascot = false, wide = false, dismissable = true }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    const btns = actions.map((a) => h('button', {
      class: `btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : a.kind === 'blue' ? 'btn-blue' : a.kind === 'ghost' ? 'btn-ghost' : ''}`,
      type: 'button',
      onclick: () => finish(a.value),
      html: (a.icon ? icon(a.icon) : '') + `<span></span>`,
    }));
    btns.forEach((b, i) => { b.querySelector('span:last-child').textContent = actions[i].label; });
    const dlg = h('dialog', { class: `ml-dialog${wide ? ' ml-dialog-wide' : ''}`, 'aria-labelledby': 'dlg-title' },
      mascot ? h('div', { class: 'dlg-mascot', html: MASCOT_SVG }) : null,
      h('h2', { id: 'dlg-title', class: 'heading-6' }, title),
      typeof body === 'string' ? h('p', { class: 'body-6 muted' }, body) : body,
      h('div', { class: 'dlg-actions' }, btns));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (dismissable) finish(null);
    });
    document.body.append(dlg);
    dlg.showModal();
    const primary = btns.find((_, i) => actions[i].kind === 'primary') || btns[0];
    setTimeout(() => primary?.focus(), 30);
  });
}

export function confirmDialog(title, body, { ok = 'Đồng ý', cancel = 'Huỷ', danger = false } = {}) {
  return dialog({
    title,
    body,
    actions: [
      { label: cancel, value: false, kind: 'ghost' },
      { label: ok, value: true, kind: danger ? 'danger' : 'primary' },
    ],
  }).then((v) => v === true);
}

// ---------------- consent (camera, photo library) ----------------
const CONSENT_KEYS = { camera: 'minilab.consent.camera', photos: 'minilab.consent.photos' };

export function hasConsent(kind) {
  try { return !!localStorage.getItem(CONSENT_KEYS[kind]); } catch { return false; }
}

export function setConsent(kind, value) {
  try {
    if (value) localStorage.setItem(CONSENT_KEYS[kind], new Date().toISOString().slice(0, 10));
    else localStorage.removeItem(CONSENT_KEYS[kind]);
  } catch { /* storage blocked: we simply ask again next time */ }
}

export function consentDate(kind) {
  try { return localStorage.getItem(CONSENT_KEYS[kind]); } catch { return null; }
}

const CONSENT_TEXT = {
  camera: {
    title: 'Cho phép MiniLab dùng camera?',
    points: [
      'Camera chỉ dùng để nhìn bức tranh bé vừa tô.',
      'Hình ảnh được xử lý ngay trên máy này, không gửi lên mạng và không lưu lại.',
      'Bạn có thể thu hồi quyền này bất cứ lúc nào trong mục Quyền riêng tư.',
    ],
    ok: 'Đồng ý dùng camera',
  },
  photos: {
    title: 'Cho phép MiniLab mở thư viện ảnh?',
    points: [
      'Bạn tự chọn một ảnh chụp bức tranh, MiniLab chỉ đọc đúng ảnh đó.',
      'Ảnh được xử lý ngay trên máy này, không gửi lên mạng.',
      'Bạn có thể thu hồi quyền này bất cứ lúc nào trong mục Quyền riêng tư.',
    ],
    ok: 'Đồng ý mở thư viện',
  },
};

/** Asks the device owner once; the answer is remembered on this device until revoked. */
export async function ensureConsent(kind) {
  if (hasConsent(kind)) return true;
  const t = CONSENT_TEXT[kind];
  const body = h('div', { class: 'consent-body' },
    h('ul', { class: 'consent-list body-6' }, t.points.map((p) => h('li', null, h('span', { html: icon('check') }), h('span', null, p)))),
    h('p', { class: 'caption-2 muted' }, 'Nếu bạn là học sinh, hãy nhờ thầy cô hoặc bố mẹ đọc giúp và bấm đồng ý.'));
  const ok = await dialog({
    title: t.title,
    body,
    mascot: true,
    actions: [
      { label: 'Không, cảm ơn', value: false, kind: 'ghost' },
      { label: t.ok, value: true, kind: 'primary', icon: kind === 'camera' ? 'camera' : 'image' },
    ],
  });
  if (ok) setConsent(kind, true);
  return ok === true;
}
