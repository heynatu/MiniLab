import { h } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';

const FAQ = [
  ['MiniLab có mất phí không?', 'Không. MiniLab miễn phí, không quảng cáo và không bán gói nâng cấp.'],
  ['MiniLab có lưu hay gửi ảnh của bé đi đâu không?', 'Không. Ảnh quét được xử lý ngay trong trình duyệt trên máy của bạn. Chỉ khi bạn bấm "Lưu vào bộ sưu tập" thì tranh mới được giữ lại, và cũng chỉ nằm trên máy đó.'],
  ['Vì sao phải có tài khoản?', 'Để chỉ những người được quản trị viên cho phép mới dùng được web khi đường dẫn được chia sẻ. Toàn bộ ứng dụng được mã hoá, không có tài khoản thì không mở được.'],
  ['Máy không nhận ra bức tranh thì làm sao?', 'Hãy đặt tờ giấy phẳng, đủ sáng, thấy rõ cả bốn ô vuông đen. Nếu vẫn chưa được, MiniLab sẽ cho bạn kéo bốn chấm vào bốn góc và chọn trang bằng tay.'],
  ['Dùng trên máy tính được không?', 'Được. Bạn có thể dùng webcam, hoặc chụp tranh bằng điện thoại rồi chọn "Chọn ảnh có sẵn" trên máy tính.'],
  ['In bằng máy in đen trắng được không?', 'Được. Trang tô màu chỉ có nét đen. Hãy chọn khổ A4 và tỉ lệ 100% (Thực tế) trong hộp thoại in.'],
  ['Trang "Bé tự sáng tạo" hoạt động thế nào?', 'Bé tự vẽ một nhân vật thật to, nét kín và tô màu. MiniLab tự tìm hình vẽ, thổi phồng thành nhân vật 3D và cho bạn ấy nhảy múa.'],
  ['Quên mật khẩu thì sao?', 'Hãy nhờ quản trị viên đặt lại mật khẩu trong mục Quản trị. MiniLab không lưu mật khẩu nên không ai xem lại được mật khẩu cũ.'],
];

export default function guide(root) {
  const block = (ico, cls, title, items) => h('section', { class: `guide-block card ${cls}` },
    h('div', { class: 'guide-block-head' }, h('span', { class: 'guide-block-ico', html: icon(ico) }), h('h2', { class: 'heading-6' }, title)),
    h('ul', { class: 'guide-items body-6' }, items.map((t) => h('li', null, t))));

  root.append(
    h('section', { class: 'page-head' },
      h('h1', { class: 'heading-3' }, 'Hướng dẫn sử dụng'),
      h('p', { class: 'body-3 muted' }, 'Mọi thứ bạn cần để in, tô, quét và chơi cùng các bạn nhân vật.')),
    h('div', { class: 'guide-grid' },
      block('printer', 'is-pink', 'In tranh', [
        'Vào Thư viện tranh, bấm "In A4" hoặc chọn nhiều trang rồi in một lần.',
        'Trong hộp thoại in: khổ A4, hướng dọc, tỉ lệ 100% (Thực tế), tắt đầu trang và chân trang.',
        'Muốn gửi cho phụ huynh? Chọn "Lưu dưới dạng PDF" thay vì máy in.',
        'Đừng cắt hay che bốn ô vuông đen ở bốn góc giấy.',
      ]),
      block('paint-brush', 'is-yellow', 'Tô màu', [
        'Bút chì màu, sáp màu, bút dạ đều được. Tô càng đậm, nhân vật càng rực rỡ.',
        'Tô cả phần nền nếu thích: nền sẽ thành tấm thảm dưới chân nhân vật.',
        'Không tô lên các ô vuông đen và dãy ô nhỏ ở cuối trang.',
      ]),
      block('scan', 'is-blue', 'Quét tranh', [
        'Đặt tranh trên mặt bàn phẳng, đủ sáng, tránh bóng điện thoại.',
        'Giữ máy song song với tờ giấy, thấy đủ bốn góc. MiniLab tự chụp khi giữ yên.',
        'Không có camera? Chọn "Chọn ảnh có sẵn" và dùng một ảnh chụp cả tờ giấy.',
      ]),
      block('sparkle', 'is-mint', 'Chơi cùng nhân vật', [
        'Chạm vào nhân vật để bạn ấy làm trò. Kéo để xoay, chụm hai ngón để phóng to.',
        'Bấm "Thực tế" để đặt nhân vật lên khung cảnh thật qua camera.',
        'Chụp ảnh hoặc quay video ngắn, file được lưu thẳng vào máy của bạn.',
        'Bấm "Lưu vào bộ sưu tập" để chơi lại lần sau trên cùng thiết bị.',
      ])),
    h('section', { class: 'faq' },
      h('h2', { class: 'heading-4' }, 'Câu hỏi thường gặp'),
      FAQ.map(([q, a]) => h('details', { class: 'faq-item card' }, h('summary', { class: 'title-2' }, q), h('p', { class: 'body-6 muted' }, a)))),
  );
}
