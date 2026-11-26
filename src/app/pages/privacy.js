import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import { galleryAll, galleryClear, kvGet, kvDel } from '../../shared/idb.js';
import { consentDate, setConsent, confirmDialog, toast } from '../ui/ui.js';
import { isMuted, setMuted } from '../three/audio.js';

export default async function privacy(root) {
  const promises = [
    ['shield-check', 'Không theo dõi', 'Không quảng cáo, không công cụ thống kê, không cookie theo dõi, không tải phông chữ hay thư viện từ máy chủ bên ngoài.'],
    ['camera', 'Camera chỉ khi bạn đồng ý', 'MiniLab hỏi ý kiến bạn trước khi mở camera hoặc thư viện ảnh, sau đó trình duyệt cũng hỏi thêm một lần nữa.'],
    ['cube', 'Xử lý ngay trên máy', 'Ảnh quét, nhân vật 3D, ảnh chụp và video đều được tạo trong trình duyệt. Không có gì được gửi lên mạng.'],
    ['lock-key', 'Tài khoản được mã hoá', 'Ứng dụng được mã hoá, chỉ mở được bằng tài khoản hợp lệ. Tên đăng nhập và mật khẩu không được lưu ở dạng đọc được.'],
  ];

  const consentRow = (kind, label) => {
    const status = h('span', { class: 'caption-3' });
    const btn = h('button', { class: 'btn btn-sm btn-danger', type: 'button' }, 'Thu hồi');
    const paint = () => {
      const d = consentDate(kind);
      status.textContent = d ? `Đã đồng ý ngày ${d.split('-').reverse().join('/')}` : 'Chưa cho phép';
      status.className = `badge ${d ? 'badge-mint' : 'badge-yellow'}`;
      btn.hidden = !d;
    };
    btn.addEventListener('click', () => {
      setConsent(kind, false);
      paint();
      toast(`Đã thu hồi quyền ${label.toLowerCase()}. MiniLab sẽ hỏi lại lần sau.`, { kind: 'ok' });
    });
    paint();
    return h('div', { class: 'pv-row' }, h('div', null, h('div', { class: 'title-3' }, label), status), btn);
  };

  let galleryCount = 0;
  try { galleryCount = (await galleryAll()).length; } catch { galleryCount = 0; }
  let remembered = false;
  try { remembered = !!(await kvGet('session')); } catch { remembered = false; }

  const galStatus = h('span', { class: 'caption-5 muted' }, `${galleryCount} bức tranh đang được lưu`);
  const galBtn = h('button', { class: 'btn btn-sm btn-danger', type: 'button', hidden: !galleryCount }, 'Xoá bộ sưu tập');
  galBtn.addEventListener('click', async () => {
    if (!(await confirmDialog('Xoá bộ sưu tập?', 'Mọi bức tranh đã lưu trên máy này sẽ bị xoá và không khôi phục được.', { ok: 'Xoá', danger: true }))) return;
    await galleryClear();
    galStatus.textContent = '0 bức tranh đang được lưu';
    galBtn.hidden = true;
    toast('Đã xoá bộ sưu tập trên máy này.', { kind: 'ok' });
  });

  const memBtn = h('button', { class: 'btn btn-sm btn-danger', type: 'button', hidden: !remembered }, 'Quên đăng nhập');
  memBtn.addEventListener('click', async () => {
    await kvDel('session').catch(() => {});
    memBtn.hidden = true;
    toast('Máy này sẽ không tự đăng nhập nữa.', { kind: 'ok' });
  });

  const sound = h('input', { type: 'checkbox', id: 'pv-sound' });
  sound.checked = !isMuted();
  sound.addEventListener('change', () => setMuted(!sound.checked));

  const wipe = h('button', { class: 'btn btn-danger', type: 'button', html: `${icon('trash')}<span>Xoá mọi dữ liệu MiniLab trên máy này</span>` });
  wipe.addEventListener('click', async () => {
    if (!(await confirmDialog('Xoá mọi dữ liệu MiniLab?', 'Bộ sưu tập, các lựa chọn đồng ý, cài đặt âm thanh và phiên đăng nhập trên máy này sẽ bị xoá. Bạn sẽ được đăng xuất.', { ok: 'Xoá và đăng xuất', danger: true }))) return;
    try { await galleryClear(); } catch { /* ignore */ }
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('minilab')).forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch { /* ignore */ }
    if (window.MiniLabShell) window.MiniLabShell.logout();
    else location.reload();
  });

  root.append(
    h('section', { class: 'page-head' },
      h('h1', { class: 'heading-3' }, 'Quyền riêng tư'),
      h('p', { class: 'body-3 muted' }, 'MiniLab được làm cho trẻ em, nên chúng tôi giữ mọi thứ đơn giản: không thu thập dữ liệu nào cả.')),
    h('div', { class: 'pv-grid' }, promises.map(([ico, t, d]) => h('div', { class: 'pv-card card' },
      h('span', { class: 'pv-ico', html: icon(ico) }), h('h2', { class: 'title-1' }, t), h('p', { class: 'body-6 muted' }, d)))),
    h('section', { class: 'pv-panel card' },
      h('h2', { class: 'heading-6' }, 'Quyền đã cấp trên máy này'),
      consentRow('camera', 'Camera'),
      consentRow('photos', 'Thư viện ảnh'),
      h('p', { class: 'caption-2 muted' }, 'Thu hồi ở đây khiến MiniLab hỏi lại lần sau. Để chặn hẳn ở cấp trình duyệt, bấm biểu tượng ổ khoá cạnh địa chỉ web và tắt Camera.')),
    h('section', { class: 'pv-panel card' },
      h('h2', { class: 'heading-6' }, 'Dữ liệu trên máy này'),
      h('div', { class: 'pv-row' }, h('div', null, h('div', { class: 'title-3' }, 'Bộ sưu tập'), galStatus), galBtn),
      h('div', { class: 'pv-row' }, h('div', null, h('div', { class: 'title-3' }, 'Ghi nhớ đăng nhập'), h('span', { class: 'caption-5 muted' }, remembered ? 'Máy này đang tự đăng nhập' : 'Không ghi nhớ')), memBtn),
      h('label', { class: 'pv-row check' }, h('span', { class: 'title-3' }, 'Âm thanh hiệu ứng'), sound),
      wipe),
    h('p', { class: 'caption-2 muted pv-note' }, 'Lưu ý: như mọi trang web, nhà cung cấp hosting (Vercel hoặc GitHub) có thể ghi nhật ký kỹ thuật của lượt truy cập, ví dụ địa chỉ IP. MiniLab không thêm bất kỳ công cụ nào để đọc hay lưu những thông tin đó.'),
  );
}
