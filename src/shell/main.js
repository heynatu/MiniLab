// MiniLab public shell: login, first-time setup and the encrypted app loader.
// This file is the only code visitors can read without an account.
import '../shared/base.css';
import './shell.css';
import { h, clear } from '../shared/h.js';
import { icon } from '../shared/icons.js';
import { MASCOT_SVG, wordmarkHTML } from '../shared/mascot.js';
import * as C from '../shared/crypto.js';
import { kvGet, kvSet, kvDel } from '../shared/idb.js';
import { renderSetup, renderMissingSecret } from './setup.js';

const metaMode = document.querySelector('meta[name="minilab-mode"]')?.getAttribute('content');
const MODE = import.meta.env.DEV ? 'dev' : metaMode || 'setup';
const root = document.getElementById('shell');
const REMEMBER_DAYS = 30;

const DOODLES = [
  { x: '6%', y: '12%', c: '#FFC93C', d: 'M32 4l7 17 18 2-14 12 4 18-15-9-15 9 4-18L7 23l18-2z' },
  { x: '86%', y: '8%', c: '#FF7AA8', d: 'M32 56S6 40 6 22a13 13 0 0126-6 13 13 0 0126 6c0 18-26 34-26 34z' },
  { x: '90%', y: '72%', c: '#4FB3FF', d: 'M32 8a24 24 0 100 48 24 24 0 000-48z' },
  { x: '4%', y: '78%', c: '#3DD6A3', d: 'M8 40c8-16 16 16 24 0s16 16 24 0' , stroke: true },
  { x: '48%', y: '90%', c: '#9B7BFF', d: 'M32 6l26 46H6z' },
  { x: '72%', y: '40%', c: '#FFC93C', d: 'M20 44a12 12 0 010-24 16 16 0 0130-2 11 11 0 012 22z' },
  { x: '16%', y: '46%', c: '#FF8A4C', d: 'M32 10v44M10 32h44', stroke: true },
];

export function doodles() {
  const wrap = h('div', { class: 'doodles', 'aria-hidden': 'true' });
  DOODLES.forEach((d, i) => {
    const fill = d.stroke ? 'none' : d.c;
    const stroke = d.stroke ? d.c : '#2B2A4C';
    const sw = d.stroke ? 7 : 3;
    const svg = `<svg viewBox="0 0 64 64" style="left:${d.x};top:${d.y};animation-delay:${i * -1.1}s"><path d="${d.d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    wrap.insertAdjacentHTML('beforeend', svg);
  });
  return wrap;
}

export function brand() {
  return h('div', { class: 'auth-brand' },
    h('div', { class: 'auth-mascot', html: MASCOT_SVG }),
    h('div', { class: 'wordmark auth-wordmark', html: wordmarkHTML('MiniLab') }));
}

export function layout(...content) {
  clear(root);
  root.hidden = false;
  const main = h('main', { id: 'main', class: 'auth', tabindex: '-1' }, doodles(), h('section', { class: 'auth-card card' }, ...content));
  root.append(main);
  return main;
}

function privacyDialog() {
  const dlg = h('dialog', { class: 'ml-dialog', 'aria-labelledby': 'pv-title' },
    h('h2', { id: 'pv-title', class: 'heading-6' }, 'MiniLab và quyền riêng tư'),
    h('ul', { class: 'pv-list body-6' },
      h('li', null, 'Không quảng cáo, không theo dõi, không công cụ thống kê.'),
      h('li', null, 'Ảnh quét và camera chỉ được xử lý ngay trên máy của bạn, không gửi lên mạng.'),
      h('li', null, 'Camera và thư viện ảnh chỉ mở sau khi bạn đồng ý.'),
      h('li', null, 'Tên và mật khẩu không được lưu dạng đọc được ở bất kỳ đâu.'),
    ),
    h('button', { class: 'btn btn-blue btn-block', type: 'button', onclick: () => dlg.close() }, 'Đã hiểu'));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

export async function fetchAccess() {
  const r = await fetch('access.json', { cache: 'no-cache', credentials: 'same-origin' });
  if (!r.ok) throw new Error('ACCESS_FETCH');
  return C.parseAccess(await r.text());
}

function exposeShell(session) {
  window.MiniLabShell = Object.freeze({
    session: Object.freeze({ name: session.n, role: session.r, lookup: session.l, dev: !!session.dev }),
    mode: MODE,
    fetchAccess,
    logout,
    hide() {
      root.classList.add('is-leaving');
      setTimeout(() => { root.hidden = true; clear(root); root.classList.remove('is-leaving'); }, 420);
    },
  });
}

export async function logout() {
  try { await kvDel('session'); } catch { /* storage may be unavailable */ }
  location.replace(location.pathname + location.search);
}

async function launchApp(key, session) {
  const r = await fetch('app.bin', { cache: 'no-cache', credentials: 'same-origin' });
  if (!r.ok) throw new Error('APP_MISSING');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const plain = await C.decryptApp(key, bytes);
  exposeShell(session);
  const url = URL.createObjectURL(new Blob([plain], { type: 'text/javascript' }));
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error('APP_LOAD'));
      document.head.append(s);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const launchDev = import.meta.env.DEV
  ? async (session) => {
    exposeShell({ ...session, dev: true });
    await import('../app/main.js');
  }
  : null;

function showLoading(text) {
  layout(
    brand(),
    h('p', { class: 'title-2 auth-loading', role: 'status' }, text, ' ', h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))),
    h('div', { class: 'skeleton', style: 'height:48px' }),
    h('div', { class: 'skeleton', style: 'height:48px;width:70%' }),
  );
}

function passwordInput(id, autocomplete) {
  const input = h('input', {
    class: 'input', id, type: 'password', name: id, autocomplete, required: true, maxlength: '128',
  });
  const btn = h('button', {
    class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': 'Hiện mật khẩu', html: icon('eye'),
    onclick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eye-slash' : 'eye');
      btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    },
  });
  return { input, wrap: h('div', { class: 'input-wrap' }, input, btn) };
}

export function renderLogin(doc, { title, intro, notice } = {}) {
  const user = h('input', {
    class: 'input', id: 'lg-user', name: 'username', autocomplete: 'username', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', required: true, maxlength: '32',
  });
  const pw = passwordInput('lg-pass', 'current-password');
  const remember = h('input', { type: 'checkbox', id: 'lg-remember' });
  const err = h('div', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('sparkle') ? h('span', { html: icon('sparkle') }) : null, 'Vào phòng lab');
  const label = submit.innerHTML;

  const setBusy = (busy) => {
    submit.disabled = busy;
    user.disabled = busy;
    pw.input.disabled = busy;
    submit.innerHTML = busy ? 'Đang mở khoá <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' : label;
  };

  const form = h('form', { class: 'auth-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'lg-user' }, 'Tên đăng nhập'), user),
    h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'lg-pass' }, 'Mật khẩu'), pw.wrap),
    MODE === 'app' || MODE === 'dev'
      ? h('label', { class: 'check' }, remember, `Ghi nhớ trên máy này trong ${REMEMBER_DAYS} ngày`)
      : null,
    err,
    submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    user.removeAttribute('aria-invalid');
    pw.input.removeAttribute('aria-invalid');
    if (!user.value.trim()) {
      err.textContent = 'Hãy nhập tên đăng nhập.';
      user.setAttribute('aria-invalid', 'true');
      user.focus();
      return;
    }
    if (!pw.input.value) {
      err.textContent = 'Hãy nhập mật khẩu.';
      pw.input.setAttribute('aria-invalid', 'true');
      pw.input.focus();
      return;
    }
    setBusy(true);
    let res;
    try {
      res = await C.login(doc, user.value, pw.input.value);
    } catch (ex) {
      setBusy(false);
      err.textContent = ex.message === 'KEY_MISMATCH'
        ? 'Tài khoản đúng nhưng khoá của web đã thay đổi. Hãy báo quản trị viên.'
        : 'Không kiểm tra được tài khoản. Hãy tải lại trang rồi thử lại.';
      return;
    }
    if (!res) {
      setBusy(false);
      err.textContent = 'Tên đăng nhập hoặc mật khẩu chưa đúng. Hãy thử lại hoặc hỏi thầy cô quản trị.';
      pw.input.value = '';
      pw.input.focus();
      return;
    }
    const session = { n: res.payload.n, r: res.payload.r, l: res.lookup };
    try {
      if (MODE === 'missing-secret') {
        const secret = res.payload.r === 'admin' ? C.secretFromKey(res.k) : null;
        res.k.fill(0);
        renderMissingSecret({ layout, brand, session, secret, logout });
        return;
      }
      if (MODE === 'dev') {
        res.k.fill(0);
        if (launchDev) await launchDev(session);
        return;
      }
      const key = await C.importAppKey(res.k);
      res.k.fill(0);
      if (remember.checked) {
        await kvSet('session', { key, ...session, keyId: doc.keyId, exp: Date.now() + REMEMBER_DAYS * 864e5 }).catch(() => {});
      }
      showLoading('Đang mở phòng lab');
      await launchApp(key, session);
    } catch (ex) {
      console.error(ex);
      renderLogin(doc, { title, intro, notice: 'Không mở được MiniLab. Hãy tải lại trang. Nếu vẫn lỗi, quản trị viên cần kiểm tra lại bản xây dựng.' });
    }
  });

  layout(
    brand(),
    h('div', { class: 'auth-head' },
      h('h1', { class: 'heading-5' }, title || 'Chào bạn, cùng vào phòng lab nhé'),
      h('p', { class: 'body-6 muted' }, intro || 'Đăng nhập bằng tài khoản thầy cô hoặc quản trị viên đã tạo cho bạn.')),
    notice ? h('div', { class: 'form-error', role: 'alert' }, notice) : null,
    form,
    h('p', { class: 'auth-foot caption-5 muted' },
      'MiniLab không thu thập dữ liệu. Ảnh quét chỉ xử lý trên máy của bạn. ',
      h('button', { class: 'link-btn', type: 'button', onclick: privacyDialog }, 'Tìm hiểu thêm')),
  );
  setTimeout(() => user.focus(), 50);
}

async function tryRemembered(doc) {
  let rec;
  try { rec = await kvGet('session'); } catch { return false; }
  if (!rec) return false;
  const valid = rec.key && rec.exp > Date.now() && rec.keyId === doc.keyId && C.entryExists(doc, rec.l);
  if (!valid) {
    await kvDel('session').catch(() => {});
    return false;
  }
  try {
    showLoading(`Chào mừng ${rec.n} trở lại`);
    if (MODE === 'dev') {
      if (launchDev) await launchDev(rec);
    } else {
      await launchApp(rec.key, rec);
    }
    return true;
  } catch (ex) {
    console.error(ex);
    await kvDel('session').catch(() => {});
    return false;
  }
}

async function start() {
  let doc;
  try {
    doc = await fetchAccess();
  } catch (ex) {
    layout(brand(),
      h('h1', { class: 'heading-5' }, 'Chưa tải được MiniLab'),
      h('p', { class: 'body-6 muted' }, ex.message === 'ACCESS_FETCH'
        ? 'Không đọc được file access.json. Hãy kiểm tra kết nối mạng rồi tải lại trang.'
        : ex.message),
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => location.reload() }, 'Tải lại trang'));
    return;
  }

  if (!C.isConfigured(doc)) {
    // Development only: remember the "skip" choice for this tab so hot reloads stay in the app.
    const devSkip = launchDev
      ? () => { sessionStorage.setItem('minilab-dev-skip', '1'); launchDev({ n: 'dev', r: 'admin', l: '' }); }
      : null;
    if (devSkip && sessionStorage.getItem('minilab-dev-skip')) { devSkip(); return; }
    renderSetup({ layout, brand, onDevSkip: devSkip });
    return;
  }
  if (MODE === 'setup') {
    // Access exists but the build ran before it was uploaded. A new build fixes this.
    layout(brand(),
      h('h1', { class: 'heading-5' }, 'Đang chờ bản xây dựng mới'),
      h('p', { class: 'body-6 muted' }, 'Đã có file access.json nhưng web chưa được xây dựng lại. Hãy chạy lại bước triển khai (Vercel: Redeploy, GitHub: Actions, Run workflow) rồi tải lại trang.'));
    return;
  }
  if (MODE === 'missing-secret') {
    renderLogin(doc, {
      title: 'Web đang chờ khoá bảo mật',
      intro: 'Bản xây dựng hiện tại thiếu biến MINILAB_SECRET. Quản trị viên hãy đăng nhập để xem lại khoá và cách khắc phục.',
    });
    return;
  }
  if (await tryRemembered(doc)) return;
  renderLogin(doc);
}

start();
