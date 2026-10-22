import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { wonToKorean, nativeCount, spokenScript, scriptKey, enumerateScripts, NOTES } from "../app/js/speak.js";
import { specs, profiles } from "./fixtures.mjs";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const precomputed = Object.fromEntries(
  ["cafe", "restaurant", "clinic"].flatMap((s) => profiles.map((p) => [`${s}/${p.id}`, JSON.parse(readFileSync(join(appDir, "data/precomputed", `${s}-${p.id}.json`), "utf8")).raw])),
);

test("금액은 한국어 읽기로 바꾼다", () => {
  const cases = { 500: "오백 원", 3800: "삼천팔백 원", 4500: "사천오백 원", 9000: "구천 원", 1000: "천 원", 10000: "만 원", 12600: "만 이천육백 원", 24000: "이만 사천 원", 20000: "이만 원", 100000: "십만 원", 123456: "십이만 삼천사백오십육 원" };
  for (const [n, want] of Object.entries(cases)) assert.equal(wonToKorean(Number(n)), want, n);
  assert.equal(wonToKorean(0), "영 원");
});

test("수량은 우리말 수사로 읽는다", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 11, 12, 20].map(nativeCount), ["한 개", "두 개", "세 개", "네 개", "다섯 개", "열 개", "열한 개", "열두 개", "스무 개"]);
  assert.equal(nativeCount(21), "이십일 개");
});

test("낭독문 열쇠는 같은 글에 같고 다른 글에 다르며 16자리 16진수다", async () => {
  const a = await scriptKey("메뉴를 골라 주세요.");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await scriptKey("메뉴를 골라 주세요."));
  assert.notEqual(a, await scriptKey("메뉴를 골라 주세요"));
});

test("낭독문: 모든 조합·모든 단계에서 단추 문구·진행 표시·숫자 글자를 읽지 않는다", () => {
  let checked = 0;
  for (const [combo, adapted] of Object.entries(precomputed)) {
    const spec = specs[combo.split("/")[0]];
    adapted.pages.forEach((_, n) => {
      const t = spokenScript(spec, adapted, n);
      checked += 1;
      assert.ok(t.length > 5, `${combo} ${n}: 너무 짧음`);
      assert.ok(!/[0-9]/.test(t), `${combo} ${n}: 아라비아 숫자가 남음 → ${t}`);
      assert.ok(!/직원 부르기|다음|이전|\d\s*\/\s*\d/.test(t.replace(/다음 /g, "")), `${combo} ${n}: 단추·진행 표시 → ${t}`);
      assert.ok(!/AI|일 수 있어요/.test(t), `${combo} ${n}: ${t}`);
    });
  }
  assert.ok(checked >= 40, `검사한 단계 ${checked}`);
});

test("낭독문: 선택 단계는 이름·금액을, 확인 단계는 원본 스펙의 이름·금액을 읽는다", () => {
  const cafe = specs.cafe; const a = precomputed["cafe/p-large-voice"];
  const sel = spokenScript(cafe, a, a.pages.findIndex((p) => p.kind === "select"));
  assert.ok(sel.includes("아메리카노") && sel.includes("사천오백 원"), sel);
  const one = precomputed["cafe/p-easy-one"];
  const detail = spokenScript(cafe, one, 0);
  assert.ok(detail.includes("아메리카노") && detail.includes("사천오백 원") && detail.includes("오백 원이 더해져요"), detail);
  const conf = spokenScript(cafe, a, a.pages.findIndex((p) => p.kind === "confirm"));
  assert.ok(conf.includes("아메리카노") && conf.includes("오천 원") && conf.includes("합계") && conf.includes("만 이천육백 원"), conf);
  const cart = spokenScript(cafe, a, a.pages.findIndex((p) => p.kind === "cart"));
  assert.ok(cart.includes("합계"), cart);
});

test("낭독문: 나뉜 단계는 해당 줄만 읽고 합계는 마지막 단계에서만 읽는다", () => {
  const rest = specs.restaurant; const a = precomputed["restaurant/p-easy-one"];
  const idx = a.pages.map((p, n) => (p.kind === "confirm" ? n : -1)).filter((n) => n >= 0);
  assert.ok(idx.length >= 2, "나뉜 확인 단계가 있어야 함");
  const texts = idx.map((n) => spokenScript(rest, a, n));
  assert.ok(!texts[0].includes("합계") && texts.at(-1).includes("합계"));
});

test("낭독문 목록: 체험 출력 9개 조합의 모든 단계와 안내 2개가 들어 있고 열쇠가 겹치지 않거나 같은 글이다", async () => {
  const all = await enumerateScripts({ specs, precomputed });
  assert.ok(all.length >= 40);
  assert.ok(all.some((s) => s.text === NOTES.staff.say) && all.some((s) => s.text === NOTES.finish.say));
  const byKey = new Map();
  for (const s of all) { if (byKey.has(s.key)) assert.equal(byKey.get(s.key), s.text); byKey.set(s.key, s.text); }
});

test("낭독문: 품목이 4개 이상인 목록 단계는 이름과 금액만 읽고(짧게) 상세는 화면에서 보게 한다", () => {
  for (const [combo, adapted] of Object.entries(precomputed)) {
    const spec = specs[combo.split("/")[0]];
    adapted.pages.forEach((p, n) => {
      if (p.kind !== "select" && p.kind !== "options") return;
      const t = spokenScript(spec, adapted, n);
      if (p.item_ids.length > 3) assert.ok(t.includes("화면에서 확인하세요") && !t.includes("더해져요"), `${combo} ${n}: ${t}`);
      else if (p.item_ids.length === 1 && spec.items.find((i) => i.id === p.item_ids[0]).options.length) assert.ok(/더해져요|추가 금액은 없어요/.test(t), `${combo} ${n}`);
    });
  }
});

test("낭독문: 쉼표가 겹치거나 문장 끝에 쉼표가 남지 않는다", () => {
  for (const [combo, adapted] of Object.entries(precomputed)) {
    const spec = specs[combo.split("/")[0]];
    adapted.pages.forEach((_, n) => {
      const t = spokenScript(spec, adapted, n);
      assert.ok(!/,\s*,|,\s*\.|\.\./.test(t), `${combo} ${n}: ${t}`);
    });
  }
});

test("낭독문: 제목 뒤에 마침표가 있어 안내문과 이어 읽히지 않는다", () => {
  const a = precomputed["cafe/p-easy-one"];
  assert.ok(spokenScript(specs.cafe, a, 0).startsWith("메뉴 고르기. 메뉴와 금액을 살펴보세요."));
  const pay = a.pages.findIndex((p) => p.kind === "pay");
  assert.ok(spokenScript(specs.cafe, a, pay).startsWith("결제. 모의 결제입니다."));
});
