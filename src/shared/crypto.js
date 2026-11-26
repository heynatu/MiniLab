// MiniLab access crypto. Runs in browsers and in Node >= 20 (globalThis.crypto).
//
// Design (no server, no database, nothing collected):
//  - The whole app bundle is encrypted at build time with a random 256-bit key K
//    (MINILAB_SECRET). Only the encrypted file (app.bin) is published.
//  - public/access.json holds one entry per account. Each entry is K wrapped
//    with a key derived from (username, password) via PBKDF2-SHA256 + HKDF.
//    Usernames are never stored in clear text in access.json.
//  - The admin's entry also carries a vault key V. The vault (encrypted with V)
//    lists accounts so the admin can manage them and rotate K.

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

export const ACCESS_FORMAT = 'minilab-access';
export const DEFAULT_ITER = 600000;
export const SECRET_PREFIX = 'mlk_';
export const APP_MAGIC = 'MLB1';
export const AAD_APP = 'minilab/app/v1';
const AAD_ENTRY = 'minilab/entry/v1:';
const AAD_VAULT = 'minilab/vault/v1';

export function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function concatBytes(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function b64uEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- usernames & passwords ----------

export function normalizeUsername(u) {
  return String(u ?? '').normalize('NFC').trim().toLowerCase();
}

export const USERNAME_RULE = 'Từ 3 đến 32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.';
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function usernameError(u) {
  const n = normalizeUsername(u);
  if (!n) return 'Hãy nhập tên đăng nhập.';
  if (!USERNAME_RE.test(n)) return USERNAME_RULE;
  return '';
}

export function passwordError(p, role = 'user') {
  const min = role === 'admin' ? 10 : 8;
  const s = String(p ?? '');
  if (s.length < min) return `Mật khẩu cần ít nhất ${min} ký tự.`;
  if (s.length > 128) return 'Mật khẩu dài quá 128 ký tự.';
  if (/^(.)\1+$/.test(s)) return 'Mật khẩu không được lặp một ký tự.';
  return '';
}

const PW_A = ['meo', 'cun', 'tho', 'gau', 'voi', 'ca', 'cua', 'ech', 'cu', 'ga', 'vit', 'heo', 'nai', 'ong', 'buom', 'rua',
  'soc', 'cao', 'khi', 'ngua', 'bo', 'de', 'cuu', 'chim', 'tom', 'oc', 'sao', 'trang', 'may', 'hoa', 'la', 'cay'];
const PW_B = ['xanh', 'do', 'vang', 'tim', 'hong', 'cam', 'nau', 'trang', 'bac', 'vui', 'xinh', 'nho', 'to', 'nhanh', 'ngoan',
  'tinh', 'deo', 'gioi', 'hien', 'khoe', 'mat', 'thom', 'ngot', 'bay', 'nhay', 'hat', 'mua', 'cuoi', 'mo', 'sang', 'ngu', 'chay'];
const PW_C = ['sang', 'trua', 'chieu', 'toi', 'xuan', 'he', 'thu', 'dong', 'nui', 'song', 'bien', 'rung', 'dong', 'vuon', 'nha',
  'truong', 'lop', 'san', 'cau', 'pho', 'lang', 'que', 'dao', 'ho', 'suoi', 'thac', 'doi', 'ga', 'cho', 'den', 'chua', 'thap'];

function randInt(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const b = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(b); } while (b[0] >= max);
  return b[0] % n;
}

/** Easy to type, hard to guess: three words plus three digits. */
export function friendlyPassword() {
  const pick = (a) => a[randInt(a.length)];
  const num = String(randInt(1000)).padStart(3, '0');
  return `${pick(PW_A)}-${pick(PW_B)}-${pick(PW_C)}-${num}`;
}

// ---------- primitives ----------

async function sha256(bytes) {
  return new Uint8Array(await subtle.digest('SHA-256', bytes));
}

export async function keyIdOf(kBytes) {
  const h = await sha256(concatBytes(te.encode('minilab-keyid:'), kBytes));
  return b64uEncode(h.subarray(0, 12));
}

export async function deriveCredential(username, password, saltB64, iter) {
  const name = normalizeUsername(username);
  const pw = String(password ?? '').normalize('NFC');
  const base = await subtle.importKey('raw', te.encode(`${name}\u0000${pw}`), 'PBKDF2', false, ['deriveBits']);
  const master = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64uDecode(saltB64), iterations: iter }, base, 256);
  const hk = await subtle.importKey('raw', master, 'HKDF', false, ['deriveBits']);
  const empty = new Uint8Array(0);
  const lookup = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: empty, info: te.encode('minilab/lookup/v1') }, hk, 128);
  const kek = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: empty, info: te.encode('minilab/kek/v1') }, hk, 256);
  return { lookup: b64uEncode(new Uint8Array(lookup)), kek: new Uint8Array(kek) };
}

async function aesKey(raw, usages) {
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usages);
}

/** Import K for decrypting the app only. Not extractable, safe to keep in IndexedDB. */
export function importAppKey(kBytes) {
  return aesKey(kBytes, ['decrypt']);
}

export async function seal(rawKey, plain, aad) {
  const iv = randomBytes(12);
  const key = await aesKey(rawKey, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, plain));
  return concatBytes(iv, ct);
}

export async function unseal(keyOrRaw, sealed, aad) {
  const key = keyOrRaw instanceof Uint8Array ? await aesKey(keyOrRaw, ['decrypt']) : keyOrRaw;
  const iv = sealed.subarray(0, 12);
  const ct = sealed.subarray(12);
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, ct));
}

async function sealJSON(raw, obj, aad) {
  return b64uEncode(await seal(raw, te.encode(JSON.stringify(obj)), aad));
}

async function unsealJSON(raw, str, aad) {
  return JSON.parse(td.decode(await unseal(raw, b64uDecode(str), aad)));
}

// ---------- app bundle ----------

export async function encryptApp(kBytes, plainBytes) {
  const body = await seal(kBytes, plainBytes, AAD_APP);
  return concatBytes(te.encode(APP_MAGIC), body);
}

export async function decryptApp(key, bytes) {
  const magic = td.decode(bytes.subarray(0, 4));
  if (magic !== APP_MAGIC) throw new Error('APP_FORMAT');
  return unseal(key, bytes.subarray(4), AAD_APP);
}

// ---------- secret ----------

export function secretFromKey(k) {
  return SECRET_PREFIX + b64uEncode(k);
}

export function keyFromSecret(secret) {
  const s = String(secret ?? '').trim();
  if (!s.startsWith(SECRET_PREFIX)) throw new Error('MINILAB_SECRET phải bắt đầu bằng "mlk_".');
  const k = b64uDecode(s.slice(SECRET_PREFIX.length));
  if (k.length !== 32) throw new Error('MINILAB_SECRET không đúng độ dài.');
  return k;
}

// ---------- access.json ----------

export function emptyAccess() {
  return { format: ACCESS_FORMAT, v: 1, iter: DEFAULT_ITER, salt: '', keyId: '', entries: [], vault: '' };
}

export function parseAccess(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('access.json không phải JSON hợp lệ.'); }
  if (!d || d.format !== ACCESS_FORMAT || d.v !== 1 || !Array.isArray(d.entries)) {
    throw new Error('access.json không đúng định dạng MiniLab.');
  }
  if (d.entries.length && (!d.salt || !d.keyId || !Number.isInteger(d.iter) || d.iter < 100000)) {
    throw new Error('access.json thiếu thông tin khoá.');
  }
  return d;
}

export function isConfigured(doc) {
  return !!(doc && doc.entries && doc.entries.length > 0 && doc.salt && doc.keyId);
}

/** Returns null when the username/password pair is unknown. */
export async function login(doc, username, password) {
  const { lookup, kek } = await deriveCredential(username, password, doc.salt, doc.iter);
  const entry = doc.entries.find((e) => e.l === lookup);
  if (!entry) return null;
  const payload = await unsealJSON(kek, entry.p, AAD_ENTRY + lookup);
  const k = b64uDecode(payload.k);
  if ((await keyIdOf(k)) !== doc.keyId) throw new Error('KEY_MISMATCH');
  return { lookup, payload, k };
}

export function entryExists(doc, lookup) {
  return !!doc?.entries?.some((e) => e.l === lookup);
}

// ---------- admin state ----------

async function saveVault(state) {
  state.doc.vault = await sealJSON(state.V, { users: state.users }, AAD_VAULT);
}

async function wrapFor(state, user) {
  const payload = { k: b64uEncode(state.K), r: user.r, n: user.n };
  if (user.r === 'admin') payload.vk = b64uEncode(state.V);
  return { l: user.l, p: await sealJSON(b64uDecode(user.kek), payload, AAD_ENTRY + user.l) };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function createAccess({ adminName, adminPassword, iter = DEFAULT_ITER }) {
  const doc = emptyAccess();
  doc.iter = iter;
  doc.salt = b64uEncode(randomBytes(16));
  const K = randomBytes(32);
  doc.keyId = await keyIdOf(K);
  const state = { doc, K, V: randomBytes(32), users: [], me: normalizeUsername(adminName) };
  await addUser(state, { name: adminName, password: adminPassword, role: 'admin' });
  return { state, secret: secretFromKey(K) };
}

export async function unlockAdmin(doc, username, password) {
  const r = await login(doc, username, password);
  if (!r) return null;
  if (r.payload.r !== 'admin' || !r.payload.vk) throw new Error('NOT_ADMIN');
  const V = b64uDecode(r.payload.vk);
  const vault = doc.vault ? await unsealJSON(V, doc.vault, AAD_VAULT) : { users: [] };
  return {
    doc: JSON.parse(JSON.stringify(doc)),
    K: r.k,
    V,
    users: vault.users || [],
    me: normalizeUsername(username),
  };
}

export async function addUser(state, { name, password, role = 'user' }) {
  const n = normalizeUsername(name);
  const uErr = usernameError(n);
  if (uErr) throw new Error(uErr);
  const pErr = passwordError(password, role);
  if (pErr) throw new Error(pErr);
  if (role !== 'admin' && role !== 'user') throw new Error('Vai trò không hợp lệ.');
  if (state.users.some((u) => u.n === n)) throw new Error(`Tên "${n}" đã có người dùng.`);
  const { lookup, kek } = await deriveCredential(n, password, state.doc.salt, state.doc.iter);
  const user = { n, r: role, l: lookup, kek: b64uEncode(kek), c: today() };
  state.users.push(user);
  state.doc.entries.push(await wrapFor(state, user));
  await saveVault(state);
  return { n: user.n, r: user.r, c: user.c };
}

function adminCount(state) {
  return state.users.filter((u) => u.r === 'admin').length;
}

export async function removeUser(state, name) {
  const n = normalizeUsername(name);
  const u = state.users.find((x) => x.n === n);
  if (!u) throw new Error('Không tìm thấy tài khoản.');
  if (u.r === 'admin' && adminCount(state) <= 1) throw new Error('Cần giữ lại ít nhất một quản trị viên.');
  state.users = state.users.filter((x) => x !== u);
  state.doc.entries = state.doc.entries.filter((e) => e.l !== u.l);
  await saveVault(state);
}

export async function resetPassword(state, name, password) {
  const n = normalizeUsername(name);
  const u = state.users.find((x) => x.n === n);
  if (!u) throw new Error('Không tìm thấy tài khoản.');
  const pErr = passwordError(password, u.r);
  if (pErr) throw new Error(pErr);
  const { lookup, kek } = await deriveCredential(n, password, state.doc.salt, state.doc.iter);
  state.doc.entries = state.doc.entries.filter((e) => e.l !== u.l);
  u.l = lookup;
  u.kek = b64uEncode(kek);
  state.doc.entries.push(await wrapFor(state, u));
  await saveVault(state);
}

export async function setRole(state, name, role) {
  const n = normalizeUsername(name);
  const u = state.users.find((x) => x.n === n);
  if (!u) throw new Error('Không tìm thấy tài khoản.');
  if (role !== 'admin' && role !== 'user') throw new Error('Vai trò không hợp lệ.');
  if (u.r === 'admin' && role === 'user' && adminCount(state) <= 1) {
    throw new Error('Cần giữ lại ít nhất một quản trị viên.');
  }
  u.r = role;
  state.doc.entries = state.doc.entries.filter((e) => e.l !== u.l);
  state.doc.entries.push(await wrapFor(state, u));
  await saveVault(state);
}

/** New app key K. Every remaining account keeps its password. Returns the new secret. */
export async function rotateKey(state) {
  state.K = randomBytes(32);
  state.doc.keyId = await keyIdOf(state.K);
  state.doc.entries = [];
  for (const u of state.users) state.doc.entries.push(await wrapFor(state, u));
  await saveVault(state);
  return secretFromKey(state.K);
}

export function listUsers(state) {
  return state.users.map((u) => ({ n: u.n, r: u.r, c: u.c })).sort((a, b) => a.n.localeCompare(b.n));
}

export function serializeAccess(doc) {
  const entries = doc.entries.slice();
  for (let i = entries.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  const out = {
    format: ACCESS_FORMAT,
    v: 1,
    iter: doc.iter,
    salt: doc.salt,
    keyId: doc.keyId,
    entries,
    vault: doc.vault,
  };
  return JSON.stringify(out, null, 2) + '\n';
}
