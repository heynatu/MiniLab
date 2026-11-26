// Safety scan: stops secrets from ever reaching GitHub or the published site.
// Run with: npm run check   (also runs automatically at the start of every build)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.minilab-tmp', '.vercel', '.claude']);
const TEXT_EXT = /\.(js|mjs|cjs|ts|json|md|txt|html|css|svg|yml|yaml|toml|env|local|example)$/i;

const PATTERNS = [
  { name: 'MINILAB_SECRET', re: /(?<![A-Za-z0-9_-])mlk_[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/ },
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: 'AWS key', re: /\bAKIA[0-9A-Z]{16}\b/ },
];

function listFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out.toString('utf8').split('\0').filter(Boolean);
    if (files.length) return { files, viaGit: true };
  } catch {
    /* not a git repo yet */
  }
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name));
      } else {
        files.push(path.relative(root, path.join(dir, ent.name)).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return { files, viaGit: false };
}

export function scanForSecrets(root) {
  const errors = [];
  const warnings = [];
  const { files, viaGit } = listFiles(root);
  for (const rel of files) {
    const base = path.basename(rel);
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
      if (viaGit) errors.push(`${rel}: file môi trường sẽ bị đưa lên git. Hãy xoá nó hoặc thêm vào .gitignore.`);
      else warnings.push(`${rel}: đừng tải file này lên GitHub (nó chứa khoá bí mật).`);
      continue;
    }
    if (!TEXT_EXT.test(base) && base.includes('.') && !base.startsWith('.')) continue;
    const full = path.join(root, rel);
    let text;
    try {
      const st = fs.statSync(full);
      if (!st.isFile() || st.size > 2_000_000) continue;
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const p of PATTERNS) {
      if (p.re.test(text)) errors.push(`${rel}: có vẻ chứa ${p.name}. Hãy xoá nó khỏi file này.`);
    }
  }
  for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const listed = warnings.some((w) => w.startsWith(f + ':')) || errors.some((e) => e.startsWith(f + ':'));
    if (!listed && fs.existsSync(path.join(root, f))) {
      warnings.push(`${f}: file này chỉ dùng trên máy bạn. Khi tải repo lên GitHub bằng trình duyệt, đừng chọn nó.`);
    }
  }
  return { errors, warnings, count: files.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, warnings, count } = scanForSecrets(root);
  for (const w of warnings) console.warn(`  ! ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  x ${e}`);
    console.error(`\nKiểm tra bảo mật THẤT BẠI (${errors.length} vấn đề).`);
    process.exit(1);
  }
  console.log(`Kiểm tra bảo mật OK: ${count} file, không thấy khoá bí mật.`);
}
