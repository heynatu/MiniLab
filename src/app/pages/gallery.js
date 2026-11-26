import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { MASCOT_SVG } from '../../shared/mascot.js';
import { downloadBlob } from '../../shared/deploy-guide.js';
import { galleryAll, galleryDel, galleryClear } from '../../shared/idb.js';
import { byId } from '../templates/characters.js';
import { confirmDialog, toast } from '../ui/ui.js';

export default async function gallery(root) {
  const urls = [];
  const head = h('section', { class: 'page-head' },
    h('h1', { class: 'heading-3' }, 'Bộ sưu tập của bé'),
    h('p', { class: 'body-3 muted' }, 'Những bức tranh bạn đã bấm Lưu. Chúng chỉ nằm trên máy này, không gửi đi đâu cả.'));
  const grid = h('div', { class: 'gal-grid' });
  const foot = h('div', { class: 'row-actions gal-foot' });
  root.append(head, grid, foot);

  for (let i = 0; i < 4; i++) grid.append(h('div', { class: 'skeleton gal-skel' }));

  async function load() {
    let items;
    try {
      items = await galleryAll();
    } catch {
      grid.replaceChildren(h('div', { class: 'empty card' },
        h('h2', { class: 'heading-6' }, 'Trình duyệt đang chặn bộ nhớ'),
        h('p', { class: 'body-6 muted' }, 'Có thể bạn đang ở chế độ ẩn danh. Hãy mở MiniLab ở cửa sổ thường để lưu tranh.')));
      return;
    }
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    items.sort((a, b) => b.created - a.created);
    foot.replaceChildren();
    if (!items.length) {
      grid.replaceChildren(h('div', { class: 'empty card' },
        h('div', { class: 'empty-mascot', html: MASCOT_SVG }),
        h('h2', { class: 'heading-5' }, 'Chưa có bức tranh nào'),
        h('p', { class: 'body-6 muted' }, 'Quét một bức tranh rồi bấm "Lưu vào bộ sưu tập" để giữ lại bạn nhân vật nhé.'),
        h('a', { class: 'btn btn-primary', href: '#/scan', html: `${icon('scan')}<span>Quét tranh</span>` })));
      return;
    }
    grid.replaceChildren(...items.map((it) => {
      const tpl = byId(it.tplId);
      const url = URL.createObjectURL(it.thumb || it.art);
      urls.push(url);
      const date = new Date(it.created).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return h('article', { class: 'gal-card card' },
        h('a', { class: 'gal-thumb', href: `#/play?gallery=${encodeURIComponent(it.id)}`, 'aria-label': `Chơi với ${tpl?.name || 'nhân vật'}` },
          h('img', { src: url, alt: `Tranh ${tpl?.name || ''} đã tô`, loading: 'lazy' })),
        h('div', { class: 'gal-body' },
          h('h2', { class: 'title-3' }, tpl?.name || 'Tranh'),
          h('p', { class: 'caption-5 muted' }, `Lưu ngày ${date}`),
          h('div', { class: 'gal-actions' },
            h('a', { class: 'btn btn-blue btn-sm', href: `#/play?gallery=${encodeURIComponent(it.id)}`, html: `${icon('cube')}<span>Chơi</span>` }),
            h('button', {
              class: 'btn btn-sm btn-icon', type: 'button', 'aria-label': 'Tải ảnh tranh', title: 'Tải ảnh tranh', html: icon('download-simple'),
              onclick: () => downloadBlob(`minilab-${tpl?.slug || 'tranh'}.jpg`, it.art),
            }),
            h('button', {
              class: 'btn btn-sm btn-icon btn-danger', type: 'button', 'aria-label': 'Xoá tranh này', title: 'Xoá', html: icon('trash'),
              onclick: async () => {
                if (!(await confirmDialog('Xoá bức tranh này?', 'Tranh sẽ bị xoá khỏi máy này và không khôi phục được.', { ok: 'Xoá', danger: true }))) return;
                await galleryDel(it.id);
                toast('Đã xoá bức tranh.', { kind: 'ok' });
                load();
              },
            }))));
    }));
    foot.append(h('button', {
      class: 'btn btn-danger btn-sm', type: 'button', html: `${icon('trash')}<span>Xoá tất cả (${items.length})</span>`,
      onclick: async () => {
        if (!(await confirmDialog('Xoá toàn bộ bộ sưu tập?', `${items.length} bức tranh sẽ bị xoá khỏi máy này và không khôi phục được.`, { ok: 'Xoá tất cả', danger: true }))) return;
        await galleryClear();
        toast('Đã xoá toàn bộ bộ sưu tập.', { kind: 'ok' });
        load();
      },
    }));
  }
  await load();
  return () => urls.forEach((u) => URL.revokeObjectURL(u));
}
