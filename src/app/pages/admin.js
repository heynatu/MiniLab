// Account administration. Runs entirely in the browser: the admin re-enters
// their password, the account vault is decrypted locally, changes produce a
// new access.json that the admin uploads to the repository.
import { h, clear } from '../../shared/h.js';
import { icon } from '../../shared/icons.js';
import * as C from '../../shared/crypto.js';
import { secretBox, deployGuide, downloadText } from '../../shared/deploy-guide.js';
import { printNodes } from '../print/print.js';
import { confirmDialog, dialog, toast } from '../ui/ui.js';

// In-memory draft, kept while the tab is open so switching pages does not lose work.
let draft = null;

const ROLE = { admin: 'Quản trị', user: 'Thành viên' };

function busyText(btn, text) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${text} <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
  return () => { btn.disabled = false; btn.innerHTML = old; };
}

async function loadAccess() {
  if (window.MiniLabShell?.fetchAccess) return window.MiniLabShell.fetchAccess();
  const r = await fetch('access.json', { cache: 'no-cache' });
  return C.parseAccess(await r.text());
}

function onBeforeUnload(e) {
  if (draft?.dirty) { e.preventDefault(); e.returnValue = ''; }
}

export default async function admin(root, params, { session }) {
  window.addEventListener('beforeunload', onBeforeUnload);
  const cleanup = () => window.removeEventListener('beforeunload', onBeforeUnload);

  if (session.role !== 'admin') {
    root.append(h('section', { class: 'empty card' },
      h('h1', { class: 'heading-5' }, 'Chỉ dành cho quản trị viên'),
      h('p', { class: 'body-6 muted' }, 'Tài khoản của bạn là tài khoản thành viên nên không mở được trang này.'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Về trang chủ')));
    return cleanup;
  }

  const render = () => { clear(root); if (draft) panel(); else unlock(); };

  // ---------------- unlock ----------------
  function unlock() {
    let fileDoc = null;
    const user = h('input', { class: 'input', id: 'ad-user', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', value: session.dev ? '' : session.name });
    const pw = h('input', { class: 'input', id: 'ad-pass', type: 'password', autocomplete: 'current-password' });
    const err = h('div', { class: 'form-error', role: 'alert' });
    const src = h('p', { class: 'caption-2 muted' }, 'Nguồn: access.json đang có trên web.');
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      try {
        fileDoc = C.parseAccess(await f.text());
        src.textContent = `Nguồn: file ${f.name} trên máy này.`;
        toast('Đã mở file access.json.', { kind: 'ok' });
      } catch (e) {
        err.textContent = e.message;
      }
    });
    const submit = h('button', { class: 'btn btn-purple btn-lg btn-block', type: 'submit', html: `${icon('lock-key')}<span>Mở khoá quản trị</span>` });
    const form = h('form', { class: 'auth-form', novalidate: true },
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ad-user' }, 'Tên đăng nhập quản trị'), user),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ad-pass' }, 'Mật khẩu'), pw),
      err, submit, src,
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', html: `${icon('file-arrow-up')}<span>Dùng file access.json trên máy</span>`, onclick: () => file.click() }),
      file);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!user.value.trim() || !pw.value) { err.textContent = 'Hãy nhập tên đăng nhập và mật khẩu.'; return; }
      const done = busyText(submit, 'Đang giải mã');
      try {
        const doc = fileDoc || (await loadAccess());
        if (!C.isConfigured(doc)) { err.textContent = 'access.json chưa có tài khoản nào. Hãy dùng trang thiết lập lần đầu.'; done(); return; }
        const state = await C.unlockAdmin(doc, user.value, pw.value);
        if (!state) { err.textContent = 'Tên đăng nhập hoặc mật khẩu chưa đúng.'; done(); pw.value = ''; pw.focus(); return; }
        draft = { state, dirty: false, secretChanged: false, slips: [] };
        render();
      } catch (ex) {
        done();
        err.textContent = ex.message === 'NOT_ADMIN' ? 'Tài khoản này không có quyền quản trị.' : 'Không mở được danh sách tài khoản. Hãy thử lại.';
      }
    });
    root.append(
      h('section', { class: 'admin-lock card' },
        h('span', { class: 'admin-lock-ico', html: icon('crown') }),
        h('h1', { class: 'heading-5' }, 'Quản trị tài khoản'),
        h('p', { class: 'body-6 muted' }, 'Hãy nhập lại mật khẩu quản trị. Danh sách tài khoản được giải mã ngay trên máy này và không gửi đi đâu.'),
        form));
    setTimeout(() => (user.value ? pw : user).focus(), 50);
  }

  // ---------------- panel ----------------
  function markDirty() { draft.dirty = true; }

  function panel() {
    const st = draft.state;
    const users = C.listUsers(st);
    const header = h('section', { class: 'admin-head' },
      h('div', null,
        h('h1', { class: 'heading-3' }, 'Quản trị tài khoản'),
        h('p', { class: 'body-6 muted' }, `${users.length} tài khoản. Thay đổi chỉ có hiệu lực sau khi bạn tải access.json lên repo.`)),
      h('div', { class: 'row-actions' },
        draft.dirty ? h('span', { class: 'badge badge-pink' }, 'Có thay đổi chưa xuất bản') : h('span', { class: 'badge badge-mint' }, 'Không có thay đổi mới'),
        h('button', {
          class: 'btn btn-sm', type: 'button', html: `${icon('lock-key')}<span>Khoá lại</span>`,
          onclick: async () => {
            if (draft.dirty && !(await confirmDialog('Bỏ các thay đổi chưa xuất bản?', 'Bạn chưa tải access.json mới. Nếu khoá lại bây giờ, các thay đổi sẽ mất.', { ok: 'Bỏ thay đổi', danger: true }))) return;
            draft = null;
            render();
          },
        })));

    root.append(header,
      h('div', { class: 'admin-grid' },
        h('div', { class: 'admin-col' }, usersCard(users), addCard(), bulkCard()),
        h('div', { class: 'admin-col' }, draft.slips.length ? slipsCard() : null, publishCard(), secretCard())));
  }

  function usersCard(users) {
    const me = draft.state.me;
    const rows = users.map((u) => h('li', { class: 'acc-row' },
      h('span', { class: `avatar ${u.r === 'admin' ? 'is-admin' : ''}`, 'aria-hidden': 'true' }, u.n.slice(0, 1).toUpperCase()),
      h('div', { class: 'acc-info' },
        h('div', { class: 'title-3' }, u.n, u.n === me ? h('span', { class: 'caption-4 muted' }, ' (bạn)') : null),
        h('div', { class: 'acc-meta' }, h('span', { class: `badge ${u.r === 'admin' ? '' : 'badge-blue'}` }, ROLE[u.r]), h('span', { class: 'caption-5 muted' }, `tạo ngày ${u.c.split('-').reverse().join('/')}`))),
      h('div', { class: 'acc-actions' },
        h('button', { class: 'btn btn-sm btn-icon', type: 'button', title: 'Đặt lại mật khẩu', 'aria-label': `Đặt lại mật khẩu cho ${u.n}`, html: icon('key'), onclick: () => resetPw(u) }),
        h('button', { class: 'btn btn-sm btn-icon', type: 'button', title: 'Đổi vai trò', 'aria-label': `Đổi vai trò của ${u.n}`, html: icon('crown'), onclick: () => toggleRole(u) }),
        h('button', { class: 'btn btn-sm btn-icon btn-danger', type: 'button', title: 'Xoá tài khoản', 'aria-label': `Xoá tài khoản ${u.n}`, html: icon('trash'), onclick: () => removeAcc(u) }))));
    return h('section', { class: 'card admin-card' },
      h('h2', { class: 'heading-6' }, 'Danh sách tài khoản'),
      h('ul', { class: 'acc-list' }, rows));
  }

  async function resetPw(u) {
    const input = h('input', { class: 'input', id: 'rp-pass', value: C.friendlyPassword(), autocomplete: 'new-password', spellcheck: 'false' });
    const ok = await dialog({
      title: `Đặt lại mật khẩu cho ${u.n}`,
      body: h('div', { class: 'print-form' },
        h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'rp-pass' }, 'Mật khẩu mới'), input,
          h('p', { class: 'field-hint' }, u.r === 'admin' ? 'Ít nhất 10 ký tự.' : 'Ít nhất 8 ký tự. Đã tạo sẵn một mật khẩu dễ gõ.'))),
      actions: [{ label: 'Huỷ', value: false, kind: 'ghost' }, { label: 'Đặt lại', value: true, kind: 'primary' }],
    });
    if (!ok) return;
    try {
      await C.resetPassword(draft.state, u.n, input.value);
      draft.slips.push({ n: u.n, p: input.value });
      markDirty();
      toast(`Đã đặt mật khẩu mới cho ${u.n}. Nhớ xuất bản access.json.`, { kind: 'ok', ms: 4500 });
      render();
    } catch (e) {
      toast(e.message, { kind: 'error', ms: 5000 });
    }
  }

  async function toggleRole(u) {
    const to = u.r === 'admin' ? 'user' : 'admin';
    if (!(await confirmDialog(`Đổi ${u.n} thành ${ROLE[to]}?`, to === 'admin' ? 'Quản trị viên quản lý được mọi tài khoản và xem được khoá bảo mật.' : 'Tài khoản này sẽ không vào được trang Quản trị nữa.'))) return;
    try {
      await C.setRole(draft.state, u.n, to);
      markDirty();
      render();
    } catch (e) {
      toast(e.message, { kind: 'error', ms: 5000 });
    }
  }

  async function removeAcc(u) {
    if (!(await confirmDialog(`Xoá tài khoản ${u.n}?`, 'Sau khi xuất bản, tài khoản này không đăng nhập được nữa. Muốn chắc chắn người đó không còn dùng được bản cũ, hãy đổi khoá bảo mật.', { ok: 'Xoá', danger: true }))) return;
    try {
      await C.removeUser(draft.state, u.n);
      markDirty();
      render();
    } catch (e) {
      toast(e.message, { kind: 'error', ms: 5000 });
    }
  }

  function addCard() {
    const name = h('input', { class: 'input', id: 'ac-name', autocapitalize: 'none', spellcheck: 'false', maxlength: '32', placeholder: 'vd: an.nguyen' });
    const role = h('select', { class: 'input', id: 'ac-role' }, h('option', { value: 'user' }, 'Thành viên'), h('option', { value: 'admin' }, 'Quản trị'));
    const pw = h('input', { class: 'input', id: 'ac-pass', value: C.friendlyPassword(), spellcheck: 'false', autocomplete: 'new-password' });
    const err = h('div', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', html: `${icon('user-plus')}<span>Thêm tài khoản</span>` });
    const form = h('form', { class: 'admin-form', novalidate: true },
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ac-name' }, 'Tên đăng nhập'), name, h('p', { class: 'field-hint' }, C.USERNAME_RULE)),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ac-role' }, 'Vai trò'), role),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ac-pass' }, 'Mật khẩu'),
        h('div', { class: 'input-wrap' }, pw, h('button', { class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': 'Tạo mật khẩu khác', html: icon('arrows-clockwise'), onclick: () => { pw.value = C.friendlyPassword(); } }))),
      err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const uErr = C.usernameError(name.value);
      if (uErr) { err.textContent = uErr; name.focus(); return; }
      const pErr = C.passwordError(pw.value, role.value);
      if (pErr) { err.textContent = pErr; pw.focus(); return; }
      const done = busyText(btn, 'Đang tạo');
      try {
        const u = await C.addUser(draft.state, { name: name.value, password: pw.value, role: role.value });
        draft.slips.push({ n: u.n, p: pw.value });
        markDirty();
        toast(`Đã thêm ${u.n}. Nhớ xuất bản access.json.`, { kind: 'ok', ms: 4500 });
        render();
      } catch (ex) {
        done();
        err.textContent = ex.message;
      }
    });
    return h('section', { class: 'card admin-card' }, h('h2', { class: 'heading-6' }, 'Thêm một tài khoản'), form);
  }

  function bulkCard() {
    const prefix = h('input', { class: 'input', id: 'bk-prefix', value: 'lop2a-', autocapitalize: 'none', spellcheck: 'false', maxlength: '28' });
    const count = h('input', { class: 'input', id: 'bk-count', type: 'number', min: '1', max: '60', value: '30', inputmode: 'numeric' });
    const err = h('div', { class: 'form-error', role: 'alert' });
    const bar = h('div', { class: 'progress', hidden: true }, h('i'));
    const btn = h('button', { class: 'btn btn-blue', type: 'submit', html: `${icon('users-three')}<span>Tạo tài khoản cho lớp</span>` });
    const form = h('form', { class: 'admin-form', novalidate: true },
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'bk-prefix' }, 'Tiền tố'), prefix),
        h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'bk-count' }, 'Số tài khoản'), count)),
      h('p', { class: 'field-hint' }, 'Ví dụ tiền tố "lop2a-" tạo ra lop2a-01, lop2a-02 và mỗi bạn một mật khẩu riêng. Bạn có thể in phiếu đăng nhập ngay sau đó.'),
      bar, err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const p = C.normalizeUsername(prefix.value);
      const n = Math.round(Number(count.value));
      if (!(n >= 1 && n <= 60)) { err.textContent = 'Số tài khoản từ 1 đến 60.'; return; }
      const names = Array.from({ length: n }, (_, i) => `${p}${String(i + 1).padStart(2, '0')}`);
      const bad = names.find((x) => C.usernameError(x));
      if (bad) { err.textContent = `Tên "${bad}" chưa hợp lệ. ${C.USERNAME_RULE}`; return; }
      const exists = new Set(C.listUsers(draft.state).map((u) => u.n));
      const todo = names.filter((x) => !exists.has(x));
      if (!todo.length) { err.textContent = 'Các tên này đều đã có rồi.'; return; }
      const done = busyText(btn, 'Đang tạo');
      bar.hidden = false;
      let made = 0;
      try {
        for (const x of todo) {
          const pass = C.friendlyPassword();
          await C.addUser(draft.state, { name: x, password: pass, role: 'user' });
          draft.slips.push({ n: x, p: pass });
          made++;
          bar.firstChild.style.transform = `scaleX(${made / todo.length})`;
        }
      } catch (ex) {
        err.textContent = ex.message;
      }
      if (made) markDirty();
      done();
      toast(`Đã tạo ${made} tài khoản${todo.length < names.length ? `, bỏ qua ${names.length - todo.length} tên đã có` : ''}.`, { kind: 'ok', ms: 4500 });
      render();
    });
    return h('section', { class: 'card admin-card' }, h('h2', { class: 'heading-6' }, 'Tạo tài khoản cho cả lớp'), form);
  }

  function slipsCard() {
    const list = h('ul', { class: 'slip-list' }, draft.slips.map((s) => h('li', null, h('code', null, s.n), h('code', null, s.p))));
    return h('section', { class: 'card admin-card slips' },
      h('h2', { class: 'heading-6' }, `Phiếu đăng nhập vừa tạo (${draft.slips.length})`),
      h('p', { class: 'body-6 muted' }, 'Mật khẩu chỉ hiện ở đây cho tới khi bạn khoá lại hoặc tải lại trang. MiniLab không lưu mật khẩu ở bất kỳ đâu.'),
      list,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-yellow btn-sm', type: 'button', html: `${icon('printer')}<span>In phiếu A4</span>`, onclick: printSlips }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', html: `${icon('eye-slash')}<span>Ẩn phiếu</span>`, onclick: () => { draft.slips = []; render(); } })));
  }

  function printSlips() {
    const site = location.origin + location.pathname;
    const per = 10;
    const sheets = [];
    for (let i = 0; i < draft.slips.length; i += per) {
      sheets.push(h('div', { class: 'print-sheet slip-sheet' },
        draft.slips.slice(i, i + per).map((s) => h('div', { class: 'slip' },
          h('div', { class: 'slip-brand' }, 'MiniLab'),
          h('div', { class: 'slip-site' }, site),
          h('div', { class: 'slip-line' }, h('span', null, 'Tên đăng nhập'), h('b', null, s.n)),
          h('div', { class: 'slip-line' }, h('span', null, 'Mật khẩu'), h('b', null, s.p)),
          h('div', { class: 'slip-note' }, 'Giữ phiếu cẩn thận, không cho người lạ xem.')))));
    }
    printNodes(sheets);
  }

  function publishCard() {
    const json = () => C.serializeAccess(draft.state.doc);
    const check = h('p', { class: 'caption-2 muted', role: 'status' });
    return h('section', { class: `card admin-card ${draft.dirty ? 'is-hot' : ''}` },
      h('h2', { class: 'heading-6' }, 'Xuất bản thay đổi'),
      h('p', { class: 'body-6 muted' }, 'Tải file access.json mới rồi đưa lên thư mục public của repo. File này không chứa tên hay mật khẩu ở dạng đọc được.'),
      h('div', { class: 'row-actions' },
        h('button', {
          class: 'btn btn-primary', type: 'button', html: `${icon('download-simple')}<span>Tải access.json</span>`,
          onclick: () => { downloadText('access.json', json()); toast('Đã tải access.json. Giờ hãy tải nó lên repo.', { kind: 'ok', ms: 4500 }); },
        }),
        h('button', {
          class: 'btn btn-sm', type: 'button', html: `${icon('arrows-clockwise')}<span>Kiểm tra web đã cập nhật</span>`,
          onclick: async () => {
            check.textContent = 'Đang kiểm tra';
            try {
              const live = await loadAccess();
              const a = new Set(live.entries.map((e) => e.l));
              const b = draft.state.doc.entries.map((e) => e.l);
              const same = live.keyId === draft.state.doc.keyId && a.size === b.length && b.every((l) => a.has(l));
              if (same) { draft.dirty = false; draft.secretChanged = false; render(); toast('Web đã dùng danh sách tài khoản mới.', { kind: 'ok' }); }
              else check.textContent = 'Web vẫn đang dùng danh sách cũ. Nếu bạn vừa tải lên, hãy đợi một đến hai phút rồi kiểm tra lại.';
            } catch {
              check.textContent = 'Không đọc được access.json trên web.';
            }
          },
        })),
      check,
      deployGuide({ withSecret: draft.secretChanged }));
  }

  function secretCard() {
    const box = h('div', { class: 'secret-slot' });
    const show = h('button', {
      class: 'btn btn-sm', type: 'button', html: `${icon('key')}<span>Xem khoá hiện tại</span>`,
      onclick: () => { box.replaceChildren(secretBox(C.secretFromKey(draft.state.K))); show.hidden = true; },
    });
    if (draft.secretChanged) { box.append(secretBox(C.secretFromKey(draft.state.K))); show.hidden = true; }
    const rotate = h('button', {
      class: 'btn btn-danger btn-sm', type: 'button', html: `${icon('arrows-clockwise')}<span>Đổi khoá bảo mật</span>`,
      onclick: async () => {
        const ok = await confirmDialog('Đổi khoá bảo mật?', 'Mọi tài khoản giữ nguyên mật khẩu, nhưng ứng dụng được mã hoá bằng khoá mới. Người đã bị xoá tài khoản sẽ không dùng được bản cũ nữa. Bạn cần cập nhật MINILAB_SECRET trước, rồi tải access.json mới lên.', { ok: 'Đổi khoá', danger: true });
        if (!ok) return;
        const done = busyText(rotate, 'Đang đổi khoá');
        try {
          await C.rotateKey(draft.state);
          draft.secretChanged = true;
          markDirty();
          toast('Đã tạo khoá mới. Làm theo hướng dẫn xuất bản để áp dụng.', { kind: 'ok', ms: 5000 });
          render();
        } catch (e) {
          done();
          toast(e.message, { kind: 'error' });
        }
      },
    });
    return h('section', { class: 'card admin-card' },
      h('h2', { class: 'heading-6' }, 'Khoá bảo mật MINILAB_SECRET'),
      h('p', { class: 'body-6 muted' }, draft.secretChanged
        ? 'Khoá MỚI ở dưới. Hãy cập nhật biến MINILAB_SECRET trên Vercel hoặc GitHub trước, sau đó mới tải access.json lên.'
        : 'Khoá này mã hoá toàn bộ ứng dụng. Chỉ dán vào phần cài đặt bí mật của Vercel hoặc GitHub.'),
      box,
      h('div', { class: 'row-actions' }, show, rotate));
  }

  render();
  return cleanup;
}
