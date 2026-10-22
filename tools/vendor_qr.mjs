// Bundles the Kazuhiko Arase QR encoder (MIT) from a local qrcode-terminal copy into one ES module.
// The vendored code is concatenated unchanged inside a CommonJS-style wrapper; only the export is added.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error("usage: node vendor_qr.mjs <qrcode-terminal/vendor/QRCode dir> <out file>");
  process.exit(64);
}

const order = [
  "QRMode", "QRErrorCorrectLevel", "QRMaskPattern", "QRMath", "QRPolynomial",
  "QR8bitByte", "QRBitBuffer", "QRRSBlock", "QRUtil", "index",
];

const hashes = {};
let body = "";
for (const name of order) {
  const text = readFileSync(join(srcDir, `${name}.js`), "utf8");
  hashes[`${name}.js`] = createHash("sha256").update(text).digest("hex");
  body += `__mods[${JSON.stringify(name)}] = (function () {\nvar module = { exports: {} };\n${text}\nreturn module.exports;\n})();\n`;
}

const out = `// Vendored: Kazuhiko Arase "QRCode for JavaScript" (MIT), via qrcode-terminal 0.12.0 vendor/QRCode.
// Bundled into one ES module by tools/vendor_qr.mjs. Source file hashes are in vendor/LICENSES.md.
const __mods = {};
function require(path) { return __mods[path.replace("./", "")]; }
${body}
const QRCode = __mods.index;

// Returns a square boolean matrix (true = dark module) for the given text.
// The vendored encoder writes UTF-16 code units, so a non-ASCII payload decodes wrongly (checked with OpenCV); refuse it.
export function qrMatrix(text, correctLevel = 1 /* L=1, M=0, Q=3, H=2 */) {
  if (!/^[\\x20-\\x7e]*$/.test(String(text))) throw new RangeError("qrMatrix accepts printable ASCII only");
  const qr = new QRCode(-1, correctLevel);
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r += 1) {
    const row = [];
    for (let c = 0; c < n; c += 1) row.push(Boolean(qr.isDark(r, c)));
    rows.push(row);
  }
  return rows;
}
`;
mkdirSync(join(outFile, ".."), { recursive: true });
writeFileSync(outFile, out);
console.log(JSON.stringify({ out: outFile, bytes: Buffer.byteLength(out), sourceHashes: hashes }, null, 2));
