import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { downloadText } from '../../shared/deploy-guide.js';
import { CHARACTERS, CATEGORIES, LEVELS } from '../templates/characters.js';
import { pageSVG } from '../print/page.js';
import { printPages } from '../print/print.js';
import { dialog, toast } from '../ui/ui.js';

const LEVEL_BADGE = { 1: 'badge-mint', 2: 'badge-yellow', 3: 'badge-pink' };

export default function library(root, params, { navigate }) {
  let cat = params.get('cat') || 'all';
  const selected = new Map(); // id -> tpl

  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Chủ đề' });
  const grid = h('div', { class: 'lib-grid' });
  const countEl = h('span', { class: 'title-3' });
  const bar = h('div', { class: 'selbar', hidden: true },
    h('div', { class: 'selbar-info' }, icon('check') ? h('span', { class: 'selbar-dot', html: icon('check') }) : null, countEl),
    h('div', { class: 'selbar-actions' },
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { selected.clear(); refresh(); } }, 'Bỏ chọn'),
      h('button', { class: 'btn btn-primary', type: 'button', html: `${icon('printer')}<span>In các trang đã chọn</span>`, onclick: () => openPrint([...selected.values()]) })));

  function renderChips() {
    chips.replaceChildren(...CATEGORIES.map((c) => h('button', {
      class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(c.id === cat),
      onclick: () => { cat = c.id; renderChips(); renderGrid(); history.replaceState(null, '', `#/library${c.id === 'all' ? '' : `?cat=${c.id}`}`); },
    }, c.label)));
  }

  function card(tpl) {
    let colored = false;
    const thumb = h('div', { class: 'lib-thumb', html: pageSVG(tpl) });
    const toggle = h('button', {
      class: 'btn btn-sm btn-ghost lib-toggle', type: 'button', 'aria-pressed': 'false',
      html: `${icon('paint-brush')}<span>Xem mẫu đã tô</span>`,
      onclick: () => {
        colored = !colored;
        thumb.innerHTML = pageSVG(tpl, { colored });
        toggle.setAttribute('aria-pressed', String(colored));
        toggle.querySelector('span').textContent = colored ? 'Xem bản để in' : 'Xem mẫu đã tô';
      },
    });
    const check = h('input', { type: 'checkbox', 'aria-label': `Chọn ${tpl.name} để in` });
    check.checked = selected.has(tpl.id);
    check.addEventListener('change', () => {
      if (check.checked) selected.set(tpl.id, tpl);
      else selected.delete(tpl.id);
      refresh();
    });
    return h('article', { class: `lib-card card${selected.has(tpl.id) ? ' is-selected' : ''}`, dataset: { id: tpl.id } },
      h('label', { class: 'lib-check' }, check, h('span', { class: 'sr-only' }, 'Chọn')),
      thumb,
      h('div', { class: 'lib-body' },
        h('div', { class: 'lib-title' },
          h('h2', { class: 'title-1' }, tpl.name),
          h('span', { class: `badge ${LEVEL_BADGE[tpl.level]}` }, LEVELS[tpl.level])),
        h('p', { class: 'body-6 muted' }, tpl.blurb),
        toggle,
        h('div', { class: 'lib-actions' },
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', html: `${icon('printer')}<span>In A4</span>`, onclick: () => openPrint([tpl]) }),
          h('button', { class: 'btn btn-blue btn-sm', type: 'button', html: `${icon('cube')}<span>Xem thử</span>`, onclick: () => navigate('play', { demo: tpl.slug }) }),
          h('button', {
            class: 'btn btn-sm btn-icon', type: 'button', 'aria-label': `Tải file SVG của ${tpl.name}`, title: 'Tải file SVG',
            html: icon('download-simple'),
            onclick: () => { downloadText(`minilab-${tpl.slug}.svg`, pageSVG(tpl), 'image/svg+xml'); toast(`Đã tải trang ${tpl.name}.`, { kind: 'ok' }); },
          }))));
  }

  function renderGrid() {
    const list = CHARACTERS.filter((c) => cat === 'all' || c.category === cat);
    grid.replaceChildren(...list.map(card));
  }

  function refresh() {
    countEl.textContent = `Đã chọn ${selected.size} trang`;
    bar.hidden = selected.size === 0;
    grid.querySelectorAll('.lib-card').forEach((el) => {
      const on = selected.has(Number(el.dataset.id));
      el.classList.toggle('is-selected', on);
      el.querySelector('.lib-check input').checked = on;
    });
  }

  async function openPrint(tpls) {
    const copies = h('input', { class: 'input', id: 'pr-copies', type: 'number', min: '1', max: '60', value: '1', inputmode: 'numeric' });
    const label = h('input', { class: 'input', id: 'pr-label', maxlength: '30', placeholder: 'vd: Lớp 2A' });
    const sample = h('input', { type: 'checkbox', id: 'pr-sample' });
    const err = h('div', { class: 'form-error', role: 'alert' });
    const body = h('div', { class: 'print-form' },
      h('p', { class: 'body-6 muted' }, tpls.length === 1 ? `Trang: ${tpls[0].name}` : `${tpls.length} trang: ${tpls.map((t) => t.name).join(', ')}`),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'pr-copies' }, 'Số bản mỗi trang'), copies, h('p', { class: 'field-hint' }, 'Mỗi học sinh một bản. Tối đa 60.')),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'pr-label' }, 'Ghi chú ở đầu trang (không bắt buộc)'), label),
      h('label', { class: 'check' }, sample, 'In kèm một bản mẫu đã tô màu'),
      h('div', { class: 'tip' }, h('span', { html: icon('info') }), h('span', { class: 'caption-2' }, 'Trong hộp thoại in, chọn khổ A4, tỷ lệ 100% (Thực tế) và tắt "Đầu trang và chân trang". Muốn lưu PDF thì chọn "Lưu dưới dạng PDF".')),
      err);
    const go = await dialog({
      title: 'In tranh tô màu',
      body,
      actions: [{ label: 'Huỷ', value: false, kind: 'ghost' }, { label: 'Mở hộp thoại in', value: true, kind: 'primary', icon: 'printer' }],
    });
    if (!go) return;
    const n = Math.max(1, Math.min(60, Math.round(Number(copies.value) || 1)));
    const total = await printPages(tpls.map((tpl) => ({ tpl, copies: n })), { label: label.value.trim().slice(0, 30), withSample: sample.checked });
    toast(`Đã chuẩn bị ${total} trang A4 để in.`, { kind: 'ok' });
  }

  root.append(
    h('section', { class: 'page-head' },
      h('h1', { class: 'heading-3' }, 'Thư viện tranh tô màu'),
      h('p', { class: 'body-3 muted page-lead' }, 'Chọn tranh, in ra giấy A4 cho bé tô. Mỗi trang có bốn ô vuông đen ở góc giúp MiniLab nhận ra bức tranh khi quét.')),
    chips, grid, bar);
  renderChips();
  renderGrid();
  refresh();
}
