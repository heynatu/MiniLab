import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { CHARACTERS } from '../templates/characters.js';
import { demoArt } from '../print/page.js';
import { Stage } from '../three/stage.js';

function reveal(els) {
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return null; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }
  }, { threshold: 0.15 });
  els.forEach((e) => io.observe(e));
  return io;
}

function taglineWords(text) {
  const words = text.split(' ');
  const el = h('p', { class: 'tagline heading-2' }, words.map((w, i) => [h('span', { class: /^(phép|thuật)/.test(w) ? 'tw hl' : 'tw' }, w), i < words.length - 1 ? ' ' : '']));
  let io = null;
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); }
      }
    }, { rootMargin: '0px 0px -38% 0px' });
    el.querySelectorAll('.tw').forEach((w) => io.observe(w));
  } else {
    el.querySelectorAll('.tw').forEach((w) => w.classList.add('on'));
  }
  return { el, io };
}

export default function home(root, params, { navigate, session }) {
  const hostEl = h('div', { class: 'hero-stage', role: 'img', 'aria-label': 'Khủng long Xíu 3D đang chuyển động' });
  const showcase = CHARACTERS.filter((c) => !c.free);
  let pick = showcase[Math.floor(Math.random() * showcase.length)];

  const steps = [
    { ico: 'printer', title: 'In tranh', text: 'Chọn tranh trong thư viện, in khổ A4. In một lần cho cả lớp cũng được.', cls: 'is-pink' },
    { ico: 'paint-brush', title: 'Bé tô màu', text: 'Bút chì màu, sáp màu hay bút dạ đều được. Tô càng đậm càng rực rỡ.', cls: 'is-yellow' },
    { ico: 'scan', title: 'Quét tranh', text: 'Hướng camera vào tờ giấy. MiniLab tự nhận ra bức tranh trong chớp mắt.', cls: 'is-blue' },
    { ico: 'sparkle', title: 'Chơi cùng bạn 3D', text: 'Nhân vật bước ra khỏi trang giấy, biết nhảy, xoay và làm trò khi bé chạm vào.', cls: 'is-mint' },
  ];

  const tag = taglineWords('Mỗi nét màu của bé là một phép thuật nhỏ. MiniLab giúp phép thuật ấy bước ra khỏi trang giấy.');

  const cards = CHARACTERS.map((tpl) => {
    const c = demoArt(tpl, 0.24);
    c.className = 'char-thumb';
    c.setAttribute('aria-hidden', 'true');
    return h('a', { class: 'char-card card', href: `#/play?demo=${tpl.slug}` },
      c,
      h('span', { class: 'title-3' }, tpl.name),
      h('span', { class: 'caption-4 muted', html: `${icon('cube')} Xem thử 3D` }));
  });

  const sections = [
    h('section', { class: 'hero' },
      h('div', { class: 'hero-copy' },
        h('span', { class: 'badge badge-pink' }, 'Miễn phí, không quảng cáo, không thu thập dữ liệu'),
        h('h1', { class: 'heading-1 hero-title' }, 'Tranh tô màu', h('br'), 'của bé biết cử động'),
        h('p', { class: 'body-3 muted hero-sub' }, 'In tranh, để bé tô màu, rồi quét bằng camera. Nhân vật bước ra khỏi trang giấy thành bạn 3D biết nhảy, xoay và vẫy chào.'),
        h('div', { class: 'hero-cta' },
          h('a', { class: 'btn btn-primary btn-lg', href: '#/scan', html: `${icon('scan')}<span>Quét tranh ngay</span>` }),
          h('a', { class: 'btn btn-lg', href: '#/library', html: `${icon('printer')}<span>Chọn tranh để in</span>` })),
        h('p', { class: 'caption-2 muted hero-proof', html: `${icon('shield-check')}<span>Ảnh quét chỉ xử lý trên máy của bạn, không gửi lên mạng.</span>` })),
      h('div', { class: 'hero-visual card' },
        hostEl,
        h('div', { class: 'hero-visual-bar' },
          h('span', { class: 'title-4 hero-name' }, pick.name),
          h('button', { class: 'btn btn-sm btn-yellow', type: 'button', html: `${icon('arrows-clockwise')}<span>Bạn khác</span>`, onclick: () => swap() })))),
    h('section', { class: 'steps reveal' },
      h('h2', { class: 'heading-4' }, 'Bốn bước, vài phút, cả lớp cùng vui'),
      h('ol', { class: 'steps-grid' }, steps.map((s, i) => h('li', { class: `step card ${s.cls}` },
        h('span', { class: 'step-num' }, String(i + 1)),
        h('span', { class: 'step-ico', html: icon(s.ico) }),
        h('h3', { class: 'title-1' }, s.title),
        h('p', { class: 'body-6 muted' }, s.text))))),
    h('section', { class: 'tagline-wrap' }, tag.el),
    h('section', { class: 'chars reveal' },
      h('div', { class: 'section-head' },
        h('h2', { class: 'heading-4' }, 'Các bạn nhân vật'),
        h('a', { class: 'btn btn-sm', href: '#/library', html: `<span>Xem thư viện</span>${icon('palette')}` })),
      h('div', { class: 'chars-row' }, cards)),
    h('section', { class: 'teachers card reveal' },
      h('div', { class: 'teachers-ico', html: icon('chalkboard-teacher') }),
      h('div', null,
        h('h2', { class: 'heading-5' }, 'Dành cho thầy cô và phụ huynh'),
        h('ul', { class: 'teach-list body-6' },
          h('li', null, 'In nhiều bản một lúc, có ô ghi tên lớp ở đầu trang.'),
          h('li', null, 'Không cần cài ứng dụng: mở web trên điện thoại, máy tính bảng hoặc laptop.'),
          h('li', null, 'Mỗi người dùng cần tài khoản do quản trị viên tạo, nên web không bị người lạ sử dụng.'),
          h('li', null, 'Camera và thư viện ảnh chỉ mở sau khi người dùng đồng ý.'))),
      session.role === 'admin' ? h('a', { class: 'btn btn-purple', href: '#/admin', html: `${icon('crown')}<span>Quản lý tài khoản</span>` }) : h('a', { class: 'btn', href: '#/guide', html: `${icon('book-open')}<span>Xem hướng dẫn</span>` })),
  ];
  root.append(...sections);
  const io = reveal([...root.querySelectorAll('.reveal')]);

  let stage = null;
  const start = () => {
    try {
      stage = new Stage(hostEl, { theme: pick.theme, onTap: () => stage.action(['jump', 'spin', 'special'][Math.floor(Math.random() * 3)]) });
      // Preview only: no drag (keeps page scrolling on phones), slow turntable instead.
      stage.controls.enabled = false;
      stage.controls.autoRotate = true;
      stage.controls.autoRotateSpeed = 1.6;
      stage.setToy(pick, demoArt(pick));
    } catch (e) {
      console.warn('3D preview unavailable', e);
      hostEl.classList.add('no-3d');
      hostEl.append(demoArt(pick, 0.4));
    }
  };
  const swap = () => {
    const others = showcase.filter((c) => c !== pick);
    pick = others[Math.floor(Math.random() * others.length)];
    root.querySelector('.hero-name').textContent = pick.name;
    hostEl.setAttribute('aria-label', `${pick.name} 3D đang chuyển động`);
    if (stage) {
      hostEl.classList.remove(...[...hostEl.classList].filter((c) => c.startsWith('theme-')));
      stage.dispose();
      stage = null;
    }
    start();
  };
  requestAnimationFrame(start);

  return () => {
    io?.disconnect();
    tag.io?.disconnect();
    stage?.dispose();
  };
}
