import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTES, contrastRatio } from "../app/js/palette.js";

test("대비비 계산: 흑백은 21, 같은 색은 1", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  assert.equal(contrastRatio("#336699", "#336699"), 1);
});

const textPairs = [["fg", "bg"], ["muted", "bg"], ["accentFg", "accent"], ["warn", "bg"]];
test("고대비 팔레트의 글자 조합은 모두 7:1 이상", () => {
  for (const [a, b] of textPairs) assert.ok(contrastRatio(PALETTES.high[a], PALETTES.high[b]) >= 7, `${a}/${b}`);
});
test("보통 팔레트의 글자 조합은 모두 4.5:1 이상", () => {
  for (const [a, b] of textPairs) assert.ok(contrastRatio(PALETTES.normal[a], PALETTES.normal[b]) >= 4.5, `${a}/${b}`);
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

test("휴대폰 CSS의 색 값이 palette.js와 같다(시험한 대비비가 실제 화면 값이다)", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "ui", "style.css"), "utf8");
  const block = (name, re) => (css.match(re) ?? [])[0] ?? "";
  const normal = block("normal", /\.phone-page \{[^}]*\}/);
  const high = block("high", /\.phone-page\[data-contrast="high"\] \{[^}]*\}/);
  const pick = (text, v) => (text.match(new RegExp(`--${v}: (#[0-9a-f]{6})`, "i")) ?? [])[1];
  for (const [mode, text] of [["normal", normal], ["high", high]]) {
    for (const [css_v, js_k] of [["bg", "bg"], ["fg", "fg"], ["muted", "muted"], ["accent", "accent"], ["accent-fg", "accentFg"], ["line", "line"], ["warn", "warn"]]) {
      assert.equal(pick(text, css_v)?.toLowerCase(), PALETTES[mode][js_k], `${mode}/${css_v}`);
    }
  }
});
