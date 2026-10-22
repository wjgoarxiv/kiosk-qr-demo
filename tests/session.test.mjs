import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../app/ui/session.js";
import { adaptScreen } from "../app/js/adapt.js";
import { specs, profiles, makeValid } from "./fixtures.mjs";

test("새 시작이 이전 토큰을 무효로 하고 이전 요청을 중단한다", () => {
  const s = createSession();
  const a = s.start();
  const b = s.start();
  assert.equal(a.signal.aborted, true);
  assert.equal(s.valid(a.token), false);
  assert.equal(s.valid(b.token), true);
});
test("cancel은 진행 중 요청을 중단하고 토큰을 무효로 한다", () => {
  const s = createSession();
  const a = s.start();
  s.cancel();
  assert.equal(a.signal.aborted, true);
  assert.equal(s.valid(a.token), false);
});
test("adaptScreen: 바깥 중단 신호가 공급자 요청으로 전달된다", async () => {
  const s = createSession();
  const run = s.start();
  let seen;
  const provider = { id: "p", adapt: (_spec, _profile, { signal }) => { seen = signal; return new Promise(() => {}); } };
  const pending = adaptScreen({ spec: specs.cafe, profile: profiles[0], provider, timeoutMs: 5000, signal: run.signal });
  await new Promise((r) => setTimeout(r, 20));
  s.cancel();
  const res = await pending;
  assert.equal(seen.aborted, true);
  assert.equal(res.source, "fallback");
  assert.equal(res.reason.code, "aborted");
});
test("adaptScreen: 이미 중단된 신호면 공급자를 부르지 않는다", async () => {
  const ac = new AbortController(); ac.abort();
  let called = false;
  const provider = { id: "p", adapt: async () => { called = true; return { raw: makeValid(specs.cafe, profiles[0]), meta: {} }; } };
  const res = await adaptScreen({ spec: specs.cafe, profile: profiles[0], provider, signal: ac.signal });
  assert.equal(called, false);
  assert.equal(res.reason.code, "aborted");
});
