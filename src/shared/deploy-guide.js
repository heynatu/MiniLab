import { h } from './h.js';
import { icon } from './icons.js';

export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** Secret display: hidden by default, with reveal and copy buttons. */
export function secretBox(secret) {
  const masked = secret.slice(0, 6) + '•'.repeat(24) + secret.slice(-4);
  const code = h('code', null, masked);
  let shown = false;
  const eye = h('button', {
    class: 'btn btn-sm btn-icon btn-ghost', type: 'button', 'aria-label': 'Hiện khoá', html: icon('eye'),
    onclick: () => {
      shown = !shown;
      code.textContent = shown ? secret : masked;
      eye.innerHTML = icon(shown ? 'eye-slash' : 'eye');
      eye.setAttribute('aria-label', shown ? 'Ẩn khoá' : 'Hiện khoá');
    },
  });
  const status = h('span', { class: 'sr-only', role: 'status' });
  const copy = h('button', {
    class: 'btn btn-sm btn-purple', type: 'button',
    onclick: async () => {
      const ok = await copyText(secret);
      copy.innerHTML = icon(ok ? 'check' : 'warning') + (ok ? ' Đã chép' : ' Chưa chép được');
      status.textContent = ok ? 'Đã chép khoá vào bộ nhớ tạm' : 'Không chép được, hãy bấm hiện khoá và chép tay';
      setTimeout(() => { copy.innerHTML = icon('copy') + ' Chép'; }, 2200);
    },
    html: icon('copy') + ' Chép',
  });
  return h('div', { class: 'codebox' }, code, eye, copy, status);
}

function step(n, ...content) {
  return h('li', { class: 'guide-step' }, h('span', { class: 'guide-num', 'aria-hidden': 'true' }, String(n)), h('div', null, ...content));
}

function kbd(t) {
  return h('code', { class: 'kbd' }, t);
}

/**
 * Step-by-step publishing guide.
 * withSecret: the admin must also set (or change) MINILAB_SECRET.
 */
export function deployGuide({ withSecret = true } = {}) {
  const tabs = [
    { id: 'vercel', label: 'Vercel', sub: 'khuyến nghị' },
    { id: 'pages', label: 'GitHub Pages', sub: '' },
    { id: 'local', label: 'Máy tính', sub: 'tuỳ chọn' },
  ];
  const panels = {};
  const vercelSteps = [];
  let i = 1;
  if (withSecret) {
    vercelSteps.push(step(i++, 'Mở ', h('b', null, 'vercel.com'), ', vào dự án MiniLab, chọn ', h('b', null, 'Settings'), ' rồi ', h('b', null, 'Environment Variables'), '.'));
    vercelSteps.push(step(i++, 'Thêm (hoặc sửa) biến ', kbd('MINILAB_SECRET'), ' với giá trị là khoá ở trên, chọn môi trường ', h('b', null, 'Production'), ', bấm ', h('b', null, 'Save'), '.'));
  }
  vercelSteps.push(step(i++, 'Trên GitHub, mở repo MiniLab, vào thư mục ', kbd('public'), ', chọn ', h('b', null, 'Add file'), ' rồi ', h('b', null, 'Upload files'), ', thả file ', kbd('access.json'), ' vừa tải và bấm ', h('b', null, 'Commit changes'), '.'));
  vercelSteps.push(step(i++, 'Vercel tự xây dựng lại trong khoảng một phút. Sau đó mở web và đăng nhập.'));
  panels.vercel = h('ol', { class: 'guide-list' }, vercelSteps);

  const pagesSteps = [];
  i = 1;
  if (withSecret) {
    pagesSteps.push(step(i++, 'Trong repo trên GitHub: ', h('b', null, 'Settings'), ', ', h('b', null, 'Secrets and variables'), ', ', h('b', null, 'Actions'), ', bấm ', h('b', null, 'New repository secret'), '.'));
    pagesSteps.push(step(i++, 'Đặt tên ', kbd('MINILAB_SECRET'), ', dán khoá ở trên vào ô Secret, bấm ', h('b', null, 'Add secret'), ' (khi đổi khoá thì sửa secret này).'));
    pagesSteps.push(step(i++, 'Lần đầu: vào ', h('b', null, 'Settings'), ', ', h('b', null, 'Pages'), ', mục Source chọn ', h('b', null, 'GitHub Actions'), '.'));
  }
  pagesSteps.push(step(i++, 'Vào thư mục ', kbd('public'), ', chọn ', h('b', null, 'Add file'), ', ', h('b', null, 'Upload files'), ', thả ', kbd('access.json'), ' rồi bấm ', h('b', null, 'Commit changes'), '.'));
  pagesSteps.push(step(i++, 'Đợi tab ', h('b', null, 'Actions'), ' chạy xong (khoảng một đến hai phút), rồi mở web và đăng nhập.'));
  panels.pages = h('div', null,
    h('ol', { class: 'guide-list' }, pagesSteps),
    h('p', { class: 'guide-note caption-2' }, 'Lưu ý: GitHub Pages miễn phí cần repo công khai, nên ai cũng đọc được mã nguồn. Web vẫn bắt buộc đăng nhập, nhưng nếu muốn giữ kín mã nguồn hãy dùng Vercel với repo riêng tư.'));

  panels.local = h('div', null,
    h('ol', { class: 'guide-list' },
      step(1, 'Chép ', kbd('access.json'), ' vào thư mục ', kbd('public'), ' của dự án.'),
      withSecret ? step(2, 'Tạo file ', kbd('.env.local'), ' cạnh ', kbd('package.json'), ' với một dòng: ', kbd('MINILAB_SECRET=khoá ở trên'), '.') : null,
      step(withSecret ? 3 : 2, 'Chạy ', kbd('npm run preview'), ' rồi mở ', kbd('http://localhost:4173'), '.'),
    ),
    h('p', { class: 'guide-note caption-2' }, 'File .env.local đã được chặn khỏi git. Đừng bao giờ tải nó lên GitHub hay gửi cho ai.'));

  const tabBtns = tabs.map((t, idx) => h('button', {
    class: 'guide-tab', type: 'button', role: 'tab', id: `gt-${t.id}`, 'aria-controls': `gp-${t.id}`,
    'aria-selected': idx === 0 ? 'true' : 'false', tabindex: idx === 0 ? '0' : '-1',
    onclick: () => select(t.id),
  }, t.label, t.sub ? h('span', { class: 'guide-tab-sub' }, t.sub) : null));

  const panelEls = tabs.map((t, idx) => h('div', {
    class: 'guide-panel', role: 'tabpanel', id: `gp-${t.id}`, 'aria-labelledby': `gt-${t.id}`, hidden: idx !== 0,
  }, panels[t.id]));

  function select(id) {
    tabs.forEach((t, idx) => {
      const on = t.id === id;
      tabBtns[idx].setAttribute('aria-selected', on ? 'true' : 'false');
      tabBtns[idx].tabIndex = on ? 0 : -1;
      panelEls[idx].hidden = !on;
    });
  }

  const list = h('div', { class: 'guide-tabs', role: 'tablist', 'aria-label': 'Nơi đăng web' }, tabBtns);
  list.addEventListener('keydown', (e) => {
    const cur = tabBtns.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    let next = cur;
    if (e.key === 'ArrowRight') next = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    select(tabs[next].id);
    tabBtns[next].focus();
  });

  return h('div', { class: 'guide' }, list, panelEls);
}
