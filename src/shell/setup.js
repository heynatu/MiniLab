// First-time setup wizard. Runs entirely in the browser: nothing is sent anywhere.
import { h } from '../shared/h.js';
import { icon } from '../shared/icons.js';
import * as C from '../shared/crypto.js';
import { secretBox, deployGuide, downloadText } from '../shared/deploy-guide.js';

function pwField(id, label, hint) {
  const input = h('input', { class: 'input', id, type: 'password', autocomplete: 'new-password', required: true, maxlength: '128' });
  const btn = h('button', {
    class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': 'Hiện mật khẩu', html: icon('eye'),
    onclick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eye-slash' : 'eye');
    },
  });
  return {
    input,
    el: h('div', { class: 'field' },
      h('label', { class: 'field-label', for: id }, label),
      h('div', { class: 'input-wrap' }, input, btn),
      hint ? h('p', { class: 'field-hint' }, hint) : null),
  };
}

export function renderSetup({ layout, brand, onDevSkip }) {
  const user = h('input', {
    class: 'input', id: 'su-user', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false',
    required: true, maxlength: '32', placeholder: 'vd: admin.lan',
  });
  const pw1 = pwField('su-pass', 'Mật khẩu quản trị', 'Ít nhất 10 ký tự. Nên dùng một câu dễ nhớ với khoảng trắng hoặc số.');
  const pw2 = pwField('su-pass2', 'Nhập lại mật khẩu');
  const err = h('div', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, 'Tạo tài khoản quản trị');

  const form = h('form', { class: 'auth-form', novalidate: true },
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'su-user' }, 'Tên đăng nhập quản trị'),
      user,
      h('p', { class: 'field-hint' }, C.USERNAME_RULE)),
    pw1.el, pw2.el, err, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const uErr = C.usernameError(user.value);
    if (uErr) { err.textContent = uErr; user.focus(); return; }
    const pErr = C.passwordError(pw1.input.value, 'admin');
    if (pErr) { err.textContent = pErr; pw1.input.focus(); return; }
    if (pw1.input.value !== pw2.input.value) { err.textContent = 'Hai mật khẩu chưa giống nhau.'; pw2.input.focus(); return; }
    submit.disabled = true;
    submit.innerHTML = 'Đang tạo khoá <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    try {
      const { state, secret } = await C.createAccess({ adminName: user.value, adminPassword: pw1.input.value });
      showResult({ layout, brand, state, secret, adminName: C.normalizeUsername(user.value), onDevSkip });
    } catch (ex) {
      err.textContent = ex.message || 'Không tạo được khoá. Hãy thử lại.';
      submit.disabled = false;
      submit.textContent = 'Tạo tài khoản quản trị';
    }
  });

  layout(
    brand(),
    h('div', { class: 'auth-head' },
      h('span', { class: 'badge badge-yellow' }, 'Thiết lập lần đầu'),
      h('h1', { class: 'heading-5' }, 'Chào mừng tới MiniLab'),
      h('p', { class: 'body-6 muted' }, 'Web này chưa có tài khoản quản trị. Hãy tạo tài khoản của bạn ngay tại đây. Khoá được tạo trong trình duyệt và không gửi đi đâu cả.')),
    form,
    onDevSkip ? h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: onDevSkip }, 'Bỏ qua, mở ứng dụng (chỉ ở chế độ phát triển)') : null,
  );
  setTimeout(() => user.focus(), 50);
}

function showResult({ layout, brand, state, secret, adminName, onDevSkip }) {
  const json = C.serializeAccess(state.doc);
  let downloaded = false;
  const dlBtn = h('button', {
    class: 'btn btn-blue btn-block', type: 'button', html: `${icon('download-simple')} Tải access.json`,
    onclick: () => {
      downloadText('access.json', json);
      downloaded = true;
      dlBtn.innerHTML = `${icon('check')} Đã tải access.json`;
    },
  });
  window.addEventListener('beforeunload', (e) => {
    if (!downloaded) { e.preventDefault(); e.returnValue = ''; }
  });

  layout(
    brand(),
    h('div', { class: 'auth-head' },
      h('span', { class: 'badge badge-mint' }, 'Đã tạo xong'),
      h('h1', { class: 'heading-5' }, `Xin chào ${adminName}, còn vài bước nữa thôi`),
      h('p', { class: 'body-6 muted' }, 'Hãy làm lần lượt các bước dưới đây. Sau khi web được xây dựng lại, bạn đăng nhập bằng tài khoản vừa tạo.')),
    h('div', { class: 'setup-box' },
      h('h2', { class: 'title-2' }, '1. Khoá bảo mật MINILAB_SECRET'),
      h('p', { class: 'body-6 muted' }, 'Khoá này mã hoá toàn bộ ứng dụng. Giữ nó như mật khẩu và chỉ dán vào phần cài đặt bí mật của Vercel hoặc GitHub, không dán vào file nào trong repo.'),
      secretBox(secret)),
    h('div', { class: 'setup-box' },
      h('h2', { class: 'title-2' }, '2. File danh sách tài khoản'),
      h('p', { class: 'body-6 muted' }, 'File access.json an toàn để đưa lên GitHub: nó không chứa tên đăng nhập hay mật khẩu ở dạng đọc được.'),
      dlBtn),
    h('div', { class: 'setup-box' },
      h('h2', { class: 'title-2' }, '3. Đưa lên web'),
      deployGuide({ withSecret: true })),
    h('p', { class: 'caption-2 muted' }, 'Quên khoá? Sau khi đăng nhập bằng tài khoản quản trị, bạn luôn xem lại được khoá trong mục Quản trị.'),
    onDevSkip ? h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: onDevSkip }, 'Mở ứng dụng (chế độ phát triển)') : null,
  );
}

export function renderMissingSecret({ layout, brand, session, secret, logout }) {
  if (!secret) {
    layout(brand(),
      h('h1', { class: 'heading-5' }, 'MiniLab đang được bảo trì'),
      h('p', { class: 'body-6 muted' }, 'Tài khoản của bạn vẫn đúng. Quản trị viên đang hoàn tất cài đặt, bạn quay lại sau ít phút nhé.'),
      h('button', { class: 'btn btn-block', type: 'button', onclick: logout }, 'Đăng xuất'));
    return;
  }
  layout(brand(),
    h('div', { class: 'auth-head' },
      h('span', { class: 'badge badge-pink' }, 'Cần thêm khoá'),
      h('h1', { class: 'heading-5' }, `Chào ${session.n}, web đang thiếu MINILAB_SECRET`),
      h('p', { class: 'body-6 muted' }, 'access.json đã có nhưng bản xây dựng không nhận được khoá bảo mật, nên ứng dụng chưa được đóng gói. Hãy thêm khoá dưới đây rồi xây dựng lại.')),
    h('div', { class: 'setup-box' }, h('h2', { class: 'title-2' }, 'Khoá MINILAB_SECRET'), secretBox(secret)),
    h('div', { class: 'setup-box' },
      h('h2', { class: 'title-2' }, 'Cách khắc phục'),
      h('ol', { class: 'guide-list' },
        h('li', { class: 'guide-step' }, h('span', { class: 'guide-num' }, '1'), h('div', null, 'Vercel: Settings, Environment Variables, thêm MINILAB_SECRET. GitHub Pages: Settings, Secrets and variables, Actions, thêm MINILAB_SECRET.')),
        h('li', { class: 'guide-step' }, h('span', { class: 'guide-num' }, '2'), h('div', null, 'Xây dựng lại. Vercel: Deployments, chọn bản mới nhất, Redeploy. GitHub: tab Actions, chọn workflow Deploy MiniLab, Run workflow.')),
        h('li', { class: 'guide-step' }, h('span', { class: 'guide-num' }, '3'), h('div', null, 'Tải lại trang này và đăng nhập.')))),
    h('button', { class: 'btn btn-block', type: 'button', onclick: logout }, 'Đăng xuất'));
}
