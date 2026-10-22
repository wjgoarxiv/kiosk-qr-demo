// Original 12x12 pixel-art cup drawn on an integer grid and scaled without smoothing.
const ART = [
  "............",
  "...s..s.....",
  "....s..s....",
  "..cccccccc..",
  ".cmmmmmmmmc.",
  ".cmmmmmmmmcc",
  ".cmmmmmmmmcc",
  "..cmmmmmmc..",
  "..cccccccc..",
  "............",
  ".bbbbbbbbbb.",
  "............",
];
const COLORS = { s: "#6fae92", c: "#18272b", m: "#c64d2e", b: "#18272b" };
const PLATE = "#f5f3eb";

export function drawCup(canvas) {
  const ctx = canvas.getContext("2d");
  const cell = Math.floor(canvas.width / 12);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ART.forEach((row, y) => [...row].forEach((ch, x) => {
    if (COLORS[ch]) { ctx.fillStyle = COLORS[ch]; ctx.fillRect(x * cell, y * cell, cell, cell); }
  }));
}
