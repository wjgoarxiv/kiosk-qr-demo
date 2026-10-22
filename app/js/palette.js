export const PALETTES = {
  normal: { bg: "#ffffff", fg: "#1b1f24", muted: "#4a5560", accent: "#a63d22", accentFg: "#ffffff", line: "#c9d1d9", warn: "#8a3b00" },
  high: { bg: "#000000", fg: "#ffffff", muted: "#e6e6e6", accent: "#ffffff", accentFg: "#000000", line: "#ffffff", warn: "#ffb4a0" },
};

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

// WCAG 2.x contrast ratio between two #rrggbb colors.
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
