import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONAS, SPEC_LABEL } from "../app/ui/personas.js";
import { profiles, specs } from "./fixtures.mjs";

// 화면에 보이는 이름은 사람의 말로 쓰되, 장애·질병·나이로 사람을 분류하지 않는다.
const BANNED = ["장애", "치매", "시각", "청각", "난독", "노인", "고령", "어르신", "환자", "저시력", "인지"];

test("프로필마다 사람의 말로 된 이름과 설명이 있다", () => {
  for (const p of profiles) {
    const persona = PERSONAS[p.id];
    assert.ok(persona, `${p.id} 이름 없음`);
    assert.ok(persona.label.length > 0 && persona.label.length <= 24, `${p.id} 이름 길이`);
    assert.ok(persona.help.length > 0 && persona.help.length <= 40, `${p.id} 설명 길이`);
  }
  assert.deepEqual(Object.keys(PERSONAS).sort(), profiles.map((p) => p.id).sort());
});

test("화면 이름에 장애·질병·나이 낱말이 없다", () => {
  for (const persona of Object.values(PERSONAS)) {
    for (const word of BANNED) assert.ok(!persona.label.includes(word) && !persona.help.includes(word), `${persona.label} / ${word}`);
  }
});

test("업종마다 화면 이름이 있다", () => {
  assert.deepEqual(Object.keys(SPEC_LABEL).sort(), Object.keys(specs).sort());
});

import { fallbackStatus } from "../app/ui/messages.js";

test("대체 화면 안내는 실제 이유를 말한다(공급자 연결 실패를 '화면이 달라서'라고 하지 않는다)", () => {
  assert.match(fallbackStatus("validation"), /달라서/);
  for (const code of ["network", "timeout", "http", "rate_limit", "key", "config", "bad_body", "provider_error", "parse", "too_large"]) {
    const text = fallbackStatus(code);
    assert.ok(!text.includes("달라서"), code);
    assert.match(text, /받지 못|연결|응답/, code);
  }
  assert.ok(fallbackStatus("missing").includes("미리 만든"));
});
