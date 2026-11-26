// MiniLab production build.
//  1. Safety scan (no secrets in the repo).
//  2. Build the public shell (login and first-time setup).
//  3. If MINILAB_SECRET matches public/access.json: bundle the app into one file,
//     encrypt it with AES-256-GCM into dist/app.bin and delete the plain copy.
//  4. Verify that no plain app code ended up in dist/.
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { parseAccess, isConfigured, keyFromSecret, keyIdOf, encryptApp } from '../src/shared/crypto.js';
import { scanForSecrets } from './check-secrets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const tmp = path.join(root, '.minilab-tmp');
const SENTINEL = 'MINILAB_APP_SENTINEL_V1';

export const CSP = [
  "default-src 'self'",
  "script-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
].join('; ');

function log(msg) {
  console.log(`[minilab] ${msg}`);
}

function readSecret() {
  if (process.env.MINILAB_SECRET && process.env.MINILAB_SECRET.trim()) {
    return { value: process.env.MINILAB_SECRET.trim(), from: 'biến môi trường' };
  }
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*MINILAB_SECRET\s*=\s*(.+?)\s*$/);
      if (m) return { value: m[1].replace(/^['"]|['"]$/g, ''), from: f };
    }
  }
  return null;
}

function htmlPlugin(mode) {
  return {
    name: 'minilab-html',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const metas =
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n` +
          `    <meta name="minilab-mode" content="${mode}" />`;
        return html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    ${metas}`);
      },
    },
  };
}

async function walk(dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  const scan = scanForSecrets(root);
  for (const w of scan.warnings) console.warn(`  ! ${w}`);
  if (scan.errors.length) {
    for (const e of scan.errors) console.error(`  x ${e}`);
    throw new Error('Dừng build: phát hiện thông tin bí mật trong mã nguồn.');
  }

  const access = parseAccess(await fs.readFile(path.join(root, 'public', 'access.json'), 'utf8'));
  const secret = readSecret();
  let mode;
  let key = null;
  if (!isConfigured(access)) {
    mode = 'setup';
    log('public/access.json chưa có tài khoản: xây dựng trang THIẾT LẬP LẦN ĐẦU (ứng dụng chưa được đóng gói).');
  } else if (!secret) {
    mode = 'missing-secret';
    console.warn('[minilab] CẢNH BÁO: thiếu MINILAB_SECRET. Chỉ có trang đăng nhập, ứng dụng KHÔNG được đóng gói.');
  } else {
    key = keyFromSecret(secret.value);
    if ((await keyIdOf(key)) !== access.keyId) {
      throw new Error(
        'MINILAB_SECRET không khớp với public/access.json. Hãy dán đúng khoá (xem trong mục Quản trị) vào Vercel hoặc GitHub rồi build lại.',
      );
    }
    mode = 'app';
    log(`Đã nhận khoá từ ${secret.from}, khớp với access.json.`);
  }

  await fs.rm(dist, { recursive: true, force: true });
  await fs.rm(tmp, { recursive: true, force: true });

  await build({
    configFile: false,
    root,
    base: './',
    logLevel: 'warn',
    publicDir: path.join(root, 'public'),
    plugins: [htmlPlugin(mode)],
    build: { outDir: dist, emptyOutDir: true, sourcemap: false, target: 'es2020' },
  });
  log('Đã xây dựng trang đăng nhập.');

  if (mode === 'app') {
    await build({
      configFile: false,
      root,
      base: './',
      logLevel: 'warn',
      publicDir: false,
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        outDir: tmp,
        emptyOutDir: true,
        sourcemap: false,
        minify: true,
        target: 'es2020',
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        lib: {
          entry: path.join(root, 'src', 'app', 'main.js'),
          formats: ['iife'],
          name: 'MiniLabApp',
          fileName: () => 'app.js',
        },
      },
    });
    const files = await walk(tmp);
    const extra = files.filter((f) => path.basename(f) !== 'app.js');
    if (extra.length) {
      throw new Error(`Bản đóng gói sinh thêm file ngoài dự kiến: ${extra.map((f) => path.basename(f)).join(', ')}`);
    }
    const plain = await fs.readFile(path.join(tmp, 'app.js'));
    if (!plain.includes(SENTINEL)) throw new Error('Không tìm thấy dấu kiểm tra trong bản ứng dụng.');
    const enc = await encryptApp(new Uint8Array(key), new Uint8Array(plain));
    await fs.writeFile(path.join(dist, 'app.bin'), enc);
    key.fill(0);
    await fs.rm(tmp, { recursive: true, force: true });
    log(`Đã mã hoá ứng dụng: app.bin (${(enc.length / 1024).toFixed(0)} KB).`);
  }

  for (const f of await walk(dist)) {
    const base = path.basename(f);
    if (/^\.env/.test(base)) throw new Error(`dist chứa file không được phép: ${base}`);
    if (base === 'app.bin') continue;
    const buf = await fs.readFile(f);
    if (buf.includes(SENTINEL)) {
      throw new Error(`Mã ứng dụng chưa mã hoá lọt vào ${path.relative(root, f)}. Dừng build.`);
    }
  }
  log(`Hoàn tất (chế độ: ${mode}). Thư mục xuất bản: dist/`);
}

main().catch(async (err) => {
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  console.error(`\n[minilab] LỖI: ${err.message}\n`);
  process.exit(1);
});
