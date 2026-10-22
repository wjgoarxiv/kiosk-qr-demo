import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClock } from "../app/js/format.js";

test("제한 시간은 분:초로 쓴다(00:60 같은 표기를 만들지 않는다)", () => {
  assert.equal(formatClock(60), "01:00");
  assert.equal(formatClock(90), "01:30");
  assert.equal(formatClock(120), "02:00");
  assert.equal(formatClock(45), "00:45");
  assert.equal(formatClock(3600), "60:00");
});
