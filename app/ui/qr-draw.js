import { qrMatrix } from "../vendor/qr-encoder.js";

export const qrPayload = (spec, profile) => `KQR1.${spec.id}.${profile.id}`;

// Paints the QR on a canvas without smoothing; the payload is an ASCII code of ids only.
export function drawQr(canvas, text) {
  const matrix = qrMatrix(text);
  const quiet = 2;
  const size = matrix.length + quiet * 2;
  const cell = Math.max(1, Math.floor(canvas.width / size));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  const offset = Math.floor((canvas.width - cell * matrix.length) / 2);
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell); }));
}
