// MiniLab app entry. In production this whole bundle is encrypted (app.bin)
// and only runs after a successful login in the public shell.
import css from './styles.css?inline';
import { h, clear } from '../shared/h.js';
import { icon } from '../shared/icons.js';
import { MASCOT_SVG, wordmarkHTML } from '../shared/mascot.js';
import home from './pages/home.js';
import library from './pages/library.js';
import scan from './pages/scan.js';
import play from './pages/play.js';
import gallery from './pages/gallery.js';
import guide from './pages/guide.js';
import privacy from './pages/privacy.js';
import admin from './pages/admin.js';
import notFound from './pages/notfound.js';

// Build check marker: the build refuses to publish if this text appears unencrypted.
window.__MINILAB_APP__ = 'MINILAB_APP_SENTINEL_V1';

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

const shell = window.MiniLabShell;
const session = shell?.session || { name: 'khách', role: 'user' };

const ROUTES = {
  '': home,
  library,
  scan,
  play,
  gallery,
  guide,
  privacy,
  admin,
};

const NAV = [
  { path: '', label: 'Trang chủ', icon: 'house' },
  { path: 'library', label: 'Thư viện tranh', short: 'Thư viện', icon: 'palette' },
  { path: 'scan', label: 'Quét tranh', short: 'Quét', icon: 'scan', primary: true },
  { path: 'gallery', label: 'Bộ sưu tập', short: 'Của bé', icon: 'images' },
  { path: 'guide', label: 'Hướng dẫn', icon: 'book-open' },
];

// Shared in-memory state (never persisted unless the user taps Save).
export const appState = { creation: null };

const app = document.getElementById('app');
let cleanup = null;
let current = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path.replace(/\/$/, ''), params: new URLSearchParams(query) };
}

export function navigate(path, params) {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  const target = `#/${path}${q}`;
  if (location.hash === target) render();
  else location.hash = target;
}

function userMenu() {
  const isAdmin = session.role === 'admin';
  const panel = h('div', { class: 'menu-panel', role: 'menu', hidden: true },
    h('div', { class: 'menu-who' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, (session.name || '?').slice(0, 1).toUpperCase()),
      h('div', null, h('div', { class: 'title-4' }, session.name), h('div', { class: 'caption-5 muted' }, isAdmin ? 'Quản trị viên' : 'Thành viên'))),
    isAdmin ? h('a', { class: 'menu-item', role: 'menuitem', href: '#/admin', html: `${icon('crown')}<span>Quản trị tài khoản</span>` }) : null,
    h('a', { class: 'menu-item', role: 'menuitem', href: '#/privacy', html: `${icon('shield-check')}<span>Quyền riêng tư</span>` }),
    h('a', { class: 'menu-item', role: 'menuitem', href: '#/guide', html: `${icon('book-open')}<span>Hướng dẫn</span>` }),
    h('button', {
      class: 'menu-item', role: 'menuitem', type: 'button', html: `${icon('sign-out')}<span>Đăng xuất</span>`,
      onclick: () => (shell ? shell.logout() : location.reload()),
    }));
  const btn = h('button', {
    class: 'menu-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': `Tài khoản ${session.name}`,
  }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, (session.name || '?').slice(0, 1).toUpperCase()), h('span', { class: 'menu-name' }, session.name));
  const wrap = h('div', { class: 'menu' }, btn, panel);
  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('.menu-item')?.focus();
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn.focus(); } });
  panel.addEventListener('click', (e) => { if (e.target.closest('.menu-item')) close(); });
  return wrap;
}

const navLinks = [];
const tabLinks = [];

function buildLayout() {
  clear(app);
  const topnav = h('nav', { class: 'topnav', 'aria-label': 'Điều hướng chính' },
    NAV.map((n) => {
      const a = h('a', { href: `#/${n.path}`, class: 'topnav-link', html: `${icon(n.icon)}<span>${n.label}</span>` });
      navLinks.push([n.path, a]);
      return a;
    }));
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/', 'aria-label': 'MiniLab, trang chủ' },
      h('span', { class: 'brand-mascot', html: MASCOT_SVG }),
      h('span', { class: 'wordmark brand-word', html: wordmarkHTML('MiniLab') })),
    topnav,
    userMenu());
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Điều hướng nhanh' },
    NAV.filter((n) => n.path !== 'guide').map((n) => {
      const a = h('a', { href: `#/${n.path}`, class: `tab${n.primary ? ' tab-primary' : ''}`, html: `<span class="tab-ico">${icon(n.icon)}</span><span class="tab-label">${n.short || n.label}</span>` });
      tabLinks.push([n.path, a]);
      return a;
    }));
  const main = h('main', { id: 'main', class: 'page', tabindex: '-1' });
  app.append(header, main, tabbar);
  return main;
}

const main = buildLayout();

async function render() {
  const { path, params } = parseHash();
  const page = Object.prototype.hasOwnProperty.call(ROUTES, path) ? ROUTES[path] : notFound;
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  document.body.classList.remove('immersive');
  clear(main);
  main.className = 'page';
  for (const [p, a] of [...navLinks, ...tabLinks]) {
    if (p === path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  current = page;
  window.scrollTo(0, 0);
  try {
    const ret = await page(main, params, { session, navigate, appState });
    if (current === page) cleanup = typeof ret === 'function' ? ret : null;
    else if (typeof ret === 'function') ret();
  } catch (e) {
    console.error(e);
    clear(main);
    main.append(h('div', { class: 'empty card' },
      h('div', { class: 'empty-mascot', html: MASCOT_SVG }),
      h('h1', { class: 'heading-5' }, 'Trang này gặp trục trặc'),
      h('p', { class: 'body-6 muted' }, 'Hãy quay lại trang chủ rồi thử lại.'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Về trang chủ')));
  }
  const h1 = main.querySelector('h1');
  document.title = h1 ? `${(h1.innerText || h1.textContent).replace(/\s+/g, ' ').trim()} · MiniLab` : 'MiniLab';
}

window.addEventListener('hashchange', render);
render().then(() => shell?.hide?.());
