import { h } from '../../shared/h.js';
import { MASCOT_SVG } from '../../shared/mascot.js';

export default function notFound(root) {
  root.append(h('section', { class: 'empty card' },
    h('div', { class: 'empty-mascot', html: MASCOT_SVG }),
    h('h1', { class: 'heading-4' }, 'Ối, trang này không có trong phòng lab'),
    h('p', { class: 'body-3 muted' }, 'Có thể đường dẫn bị gõ nhầm. Mình cùng quay về trang chủ nhé.'),
    h('a', { class: 'btn btn-primary btn-lg', href: '#/' }, 'Về trang chủ')));
}
