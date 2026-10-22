import { test } from "node:test";
import assert from "node:assert/strict";
import { baselineAdapt } from "../app/js/baseline-adapt.js";
import { validateAdapted } from "../app/js/validator.js";
import { specs, profiles, clone, combos } from "./fixtures.mjs";

for (const { spec, profile } of combos) {
  test(`기준 변환기가 검증기를 통과한다: ${spec.id} × ${profile.id}`, () => {
    const res = validateAdapted(spec, profile, baselineAdapt(spec, profile));
    assert.deepEqual(res.errors, []);
  });
}

test("기준 변환기는 입력을 바꾸지 않고 결과가 항상 같다", () => {
  for (const { spec, profile } of combos) {
    const s0 = clone(spec); const p0 = clone(profile);
    const a = baselineAdapt(spec, profile);
    const b = baselineAdapt(spec, profile);
    assert.deepEqual(spec, s0);
    assert.deepEqual(profile, p0);
    assert.deepEqual(a, b);
  }
});

test("한 번에 하나 프로필은 선택 단계가 항목 수만큼 나뉜다", () => {
  const easy = profiles.find((p) => p.step_split);
  for (const spec of Object.values(specs)) {
    const a = baselineAdapt(spec, easy);
    const selects = a.pages.filter((p) => p.kind === "select");
    assert.equal(selects.length, spec.items.length);
    assert.ok(selects.every((p) => p.item_ids.length === 1));
  }
});

test("큰 버튼 프로필은 터치 영역 48px 이상, 글씨 배율은 프로필과 같다", () => {
  const big = profiles.find((p) => p.touch_target === "large");
  const a = baselineAdapt(specs.cafe, big);
  assert.ok(a.style.touch_target_px >= 48);
  assert.equal(a.style.text_scale, big.text_scale);
});

test("문구는 원본 이름·설명 그대로다(문구 변환은 AI 몫)", () => {
  const a = baselineAdapt(specs.restaurant, profiles[1]);
  for (const item of a.items) {
    const orig = specs.restaurant.items.find((i) => i.id === item.id);
    assert.equal(item.label, orig.name);
    assert.equal(item.hint, orig.description);
  }
});
