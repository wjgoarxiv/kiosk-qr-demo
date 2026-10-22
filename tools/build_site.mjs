// Copies app/ into dist/ (the only thing that would be published), records every file's size and hash, and scans for leaks.
import { readdirSync, statSync, lstatSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.env.KIOSK_SRC ?? join(root, "app");
const dist = process.env.KIOSK_DIST ?? join(root, "dist");
const [planOut, leakOut] = process.argv.slice(2);

const LEAK_PATTERNS = {
  api_key_like: /\b(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{10,})\b/,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/,
  korean_phone: /\b01[016789]-?\d{3,4}-?\d{4}\b/,
  resident_number: /\b\d{6}-[1-4]\d{6}\b/,
  home_path: /\/Users\/[A-Za-z0-9._-]+|C:\\Users\\/,
  evidence_or_workspace_ref: /\.litcodex|\.litclaude|info_card_trial|\/00_INBOX\//,
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) throw new Error(`symlink not allowed: ${relative(src, p)}`);
    if (name.startsWith(".")) throw new Error(`hidden file not allowed: ${relative(src, p)}`);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

rmSync(dist, { recursive: true, force: true });
const files = walk(src);
const entries = [];
const findings = [];
for (const f of files) {
  const rel = relative(src, f).split("\\").join("/");
  const to = join(dist, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(f, to);
  const buf = readFileSync(to);
  entries.push({ path: rel, bytes: statSync(to).size, sha256: createHash("sha256").update(buf).digest("hex") });
  if (/\.(js|json|css|html|md|txt)$/.test(rel)) {
    const text = buf.toString("utf8");
    for (const [name, re] of Object.entries(LEAK_PATTERNS)) {
      const m = text.match(re);
      if (m && !(rel === "vendor/LICENSES.md" && name === "evidence_or_workspace_ref")) findings.push({ file: rel, pattern: name });
    }
  }
}
const plan = { built_at: new Date().toISOString(), source: "kiosk_qr/app", files: entries.length, total_bytes: entries.reduce((s, e) => s + e.bytes, 0), entries };
if (planOut) writeFileSync(planOut, `${JSON.stringify(plan, null, 1)}\n`);
const leak = { scanned_files: entries.length, patterns: Object.keys(LEAK_PATTERNS), findings };
if (leakOut) writeFileSync(leakOut, `${JSON.stringify(leak, null, 1)}\n`);
console.log(JSON.stringify({ files: plan.files, bytes: plan.total_bytes, leak_findings: findings.length }));
process.exit(findings.length ? 3 : 0);
