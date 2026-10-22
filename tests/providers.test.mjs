import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createByokProvider } from "../app/js/providers/byok.js";
import { createPrecomputedProvider } from "../app/js/providers/precomputed.js";
import { buildCsp } from "../app/js/csp.js";
import { specs, profiles, makeValid } from "./fixtures.mjs";

const providersJson = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "providers.json"), "utf8"));
const entry = (id) => providersJson.providers.find((p) => p.id === id);
const spec = specs.cafe; const profile = profiles[0];
const KEY = "sk-test-SECRET-1234567890";
const okJson = JSON.stringify(makeValid(spec, profile));

function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return respond(url, init); };
  fn.calls = calls;
  return fn;
}
const jsonRes = (obj, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(obj) });
const textRes = (text, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => text });

const shapes = {
  gemini: (t) => jsonRes({ candidates: [{ content: { parts: [{ text: t }] } }] }),
  groq: (t) => jsonRes({ choices: [{ message: { content: t } }] }),
  openrouter: (t) => jsonRes({ choices: [{ message: { content: t } }] }),
  openai: (t) => jsonRes({ choices: [{ message: { content: t } }] }),
  anthropic: (t) => jsonRes({ content: [{ type: "text", text: t }] }),
};

for (const id of Object.keys(shapes)) {
  test(`${id}: 요청 모양과 응답 해석`, async () => {
    const f = fakeFetch(() => shapes[id](okJson));
    const p = createByokProvider({ entry: entry(id), apiKey: KEY, model: "model-x", fetchImpl: f });
    const out = await p.adapt(spec, profile, {});
    assert.equal(out.raw, okJson);
    assert.equal(out.meta.provider, id);
    const { url, init } = f.calls[0];
    assert.ok(url.startsWith(entry(id).origin), url);
    assert.equal(init.method, "POST");
    assert.ok(!url.includes(KEY), "키가 URL에 있다");
    assert.ok(!String(init.body).includes(KEY), "키가 본문에 있다");
    const headerBlob = JSON.stringify(init.headers);
    assert.ok(headerBlob.includes(KEY), "키는 헤더로만 간다");
  });
}

test("anthropic: 브라우저 직접 호출 헤더와 버전 헤더", async () => {
  const f = fakeFetch(() => shapes.anthropic(okJson));
  await createByokProvider({ entry: entry("anthropic"), apiKey: KEY, model: "m", fetchImpl: f }).adapt(spec, profile, {});
  const h = f.calls[0].init.headers;
  assert.equal(h["anthropic-dangerous-direct-browser-access"], "true");
  assert.ok(h["anthropic-version"]);
  assert.equal(h["x-api-key"], KEY);
});
test("gemini: 헤더 x-goog-api-key 사용, URL은 모델만 들어간다", async () => {
  const f = fakeFetch(() => shapes.gemini(okJson));
  await createByokProvider({ entry: entry("gemini"), apiKey: KEY, model: "gemini-2.5-flash", fetchImpl: f }).adapt(spec, profile, {});
  assert.equal(f.calls[0].init.headers["x-goog-api-key"], KEY);
  assert.ok(f.calls[0].url.includes("gemini-2.5-flash:generateContent"));
});
test("groq: JSON 객체 모드를 요청한다", async () => {
  const f = fakeFetch(() => shapes.groq(okJson));
  await createByokProvider({ entry: entry("groq"), apiKey: KEY, model: "", fetchImpl: f }).adapt(spec, profile, {});
  assert.deepEqual(JSON.parse(f.calls[0].init.body).response_format, { type: "json_object" });
  assert.equal(JSON.parse(f.calls[0].init.body).model, "openai/gpt-oss-120b");
});

async function kindOf(promise) {
  try { await promise; } catch (e) { return e.kind; }
  return "no-error";
}
const mk = (respond, id = "groq", model = "m") => createByokProvider({ entry: entry(id), apiKey: KEY, model, fetchImpl: fakeFetch(respond) });

test("오류 분류: 401·403은 key, 429는 rate_limit, 그 밖의 HTTP 오류는 http", async () => {
  assert.equal(await kindOf(mk(() => textRes("no", 401)).adapt(spec, profile, {})), "key");
  assert.equal(await kindOf(mk(() => textRes("no", 403)).adapt(spec, profile, {})), "key");
  assert.equal(await kindOf(mk(() => textRes("slow", 429)).adapt(spec, profile, {})), "rate_limit");
  assert.equal(await kindOf(mk(() => textRes("boom", 500)).adapt(spec, profile, {})), "http");
});
test("오류 분류: 네트워크 실패, 본문 형식 오류, 모델 이름 오류", async () => {
  assert.equal(await kindOf(mk(() => { throw new TypeError("Failed to fetch"); }).adapt(spec, profile, {})), "network");
  assert.equal(await kindOf(mk(() => textRes("<html>")).adapt(spec, profile, {})), "bad_body");
  assert.equal(await kindOf(mk(() => jsonRes({ nothing: 1 })).adapt(spec, profile, {})), "bad_body");
  assert.equal(await kindOf(mk(() => jsonRes({}), "openai", "").adapt(spec, profile, {})), "config");
  assert.equal(await kindOf(mk(() => jsonRes({}), "gemini", "a/../b?x=1").adapt(spec, profile, {})), "config");
});
test("키가 비어 있으면 config 오류", async () => {
  const p = createByokProvider({ entry: entry("groq"), apiKey: "  ", model: "m", fetchImpl: fakeFetch(() => jsonRes({})) });
  assert.equal(await kindOf(p.adapt(spec, profile, {})), "config");
});
test("중단 신호를 fetch에 전달한다", async () => {
  const f = fakeFetch(() => shapes.groq(okJson));
  const ac = new AbortController();
  await createByokProvider({ entry: entry("groq"), apiKey: KEY, model: "m", fetchImpl: f }).adapt(spec, profile, { signal: ac.signal });
  assert.equal(f.calls[0].init.signal, ac.signal);
});

test("키 비노출: 오류 메시지·결과·직렬화·콘솔·저장소 어디에도 키가 없다", async () => {
  const seen = [];
  const consoleSpies = ["log", "info", "warn", "error", "debug"].map((m) => { const orig = console[m]; console[m] = (...a) => seen.push(a.map(String).join(" ")); return [m, orig]; });
  const storageTouched = [];
  for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(globalThis, name, { configurable: true, get() { storageTouched.push(name); throw new Error("storage"); } });
  try {
    const echoKey = (_url, init) => textRes(`bad key ${init.headers.Authorization ?? init.headers["x-api-key"]}`, 401);
    const prov = mk(echoKey);
    let err;
    try { await prov.adapt(spec, profile, {}); } catch (e) { err = e; }
    seen.push(String(err.message), JSON.stringify(err), String(err.stack ?? ""));
    seen.push(JSON.stringify(prov), String(prov), Object.keys(prov).join(","));
    const good = await mk(() => shapes.groq(okJson)).adapt(spec, profile, {});
    seen.push(JSON.stringify(good));
  } finally {
    for (const [m, orig] of consoleSpies) console[m] = orig;
    for (const name of ["localStorage", "sessionStorage"]) delete globalThis[name];
  }
  assert.deepEqual(storageTouched, []);
  assert.ok(seen.every((s) => !s.includes(KEY)), "키 문자열이 노출됐다");
});

test("체험 모드 공급자: 저장된 출력을 돌려주고 없으면 missing", async () => {
  const stored = { raw: makeValid(spec, profile), meta: { model: "m", date: "2026-10-23" } };
  const p = createPrecomputedProvider({ [`${spec.id}/${profile.id}`]: stored });
  const out = await p.adapt(spec, profile, {});
  assert.deepEqual(out.raw, stored.raw);
  assert.equal(out.meta.provider, "precomputed");
  assert.equal(await kindOf(p.adapt(specs.clinic, profile, {})), "missing");
});

test("CSP: connect-src는 providers.json의 출처와 정확히 같다", () => {
  const csp = buildCsp(providersJson);
  const connect = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("connect-src"));
  assert.deepEqual(connect.split(/\s+/).slice(1).sort(), ["'self'", ...providersJson.csp_connect_src].sort());
  assert.ok(providersJson.providers.every((p) => providersJson.csp_connect_src.includes(p.origin)));
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp));
});

test("키 비노출: adaptScreen 결과(성공·실패)와 사유 어디에도 키가 없다", async () => {
  const { adaptScreen } = await import("../app/js/adapt.js");
  const outcomes = [];
  for (const respond of [() => shapes.groq(okJson), (_u, init) => textRes(`echo ${init.headers.Authorization}`, 401), () => { throw new TypeError(`fail ${KEY}`); }]) {
    const prov = mk(respond);
    outcomes.push(JSON.stringify(await adaptScreen({ spec, profile, provider: prov, timeoutMs: 500 })));
  }
  assert.ok(outcomes.every((s) => !s.includes(KEY)), "키 문자열이 결과에 있다");
  assert.ok(outcomes[1].includes('"code":"key"'));
});

test("Gemini의 잘못된 키(HTTP 400 API_KEY_INVALID)는 key로 분류된다", async () => {
  const p = createByokProvider({ entry: entry("gemini"), apiKey: KEY, model: "gemini-2.5-flash", fetchImpl: fakeFetch(() => textRes(JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "API key not valid", details: [{ reason: "API_KEY_INVALID" }] } }), 400)) });
  assert.equal(await kindOf(p.adapt(spec, profile, {})), "key");
  const other = createByokProvider({ entry: entry("gemini"), apiKey: KEY, model: "gemini-2.5-flash", fetchImpl: fakeFetch(() => textRes("{\"error\":{\"status\":\"INVALID_ARGUMENT\"}}", 400)) });
  assert.equal(await kindOf(other.adapt(spec, profile, {})), "http");
});
test("키에 줄바꿈·비ASCII 문자가 있으면 요청 전에 config로 거부한다", async () => {
  for (const bad of ["abc\ndef", "키값", "a b"]) {
    const f = fakeFetch(() => shapes.groq(okJson));
    const p = createByokProvider({ entry: entry("groq"), apiKey: bad, model: "m", fetchImpl: f });
    assert.equal(await kindOf(p.adapt(spec, profile, {})), "config");
    assert.equal(f.calls.length, 0);
  }
});
test("요청은 리다이렉트를 따르지 않는다(redirect: error)", async () => {
  const f = fakeFetch(() => shapes.groq(okJson));
  await createByokProvider({ entry: entry("groq"), apiKey: KEY, model: "m", fetchImpl: f }).adapt(spec, profile, {});
  assert.equal(f.calls[0].init.redirect, "error");
});
test("모델 이름의 경로 조작 문자열을 거부한다", async () => {
  for (const [id, model] of [["gemini", "a/../b"], ["gemini", "a/b"], ["openrouter", "a/../b:free"], ["groq", "..%2f"]]) {
    const p = createByokProvider({ entry: entry(id), apiKey: KEY, model, fetchImpl: fakeFetch(() => shapes.groq(okJson)) });
    assert.equal(await kindOf(p.adapt(spec, profile, {})), "config", `${id} ${model}`);
  }
  const ok = createByokProvider({ entry: entry("openrouter"), apiKey: KEY, model: "meta-llama/llama-3.3-70b-instruct:free", fetchImpl: fakeFetch(() => shapes.openrouter(okJson)) });
  assert.equal((await ok.adapt(spec, profile, {})).meta.provider, "openrouter");
});
test("OpenAI와 Anthropic 요청에는 temperature를 보내지 않고 Anthropic 최대 출력은 넉넉하다", async () => {
  const fo = fakeFetch(() => shapes.openai(okJson));
  await createByokProvider({ entry: entry("openai"), apiKey: KEY, model: "m", fetchImpl: fo }).adapt(spec, profile, {});
  assert.ok(!("temperature" in JSON.parse(fo.calls[0].init.body)));
  const fa = fakeFetch(() => shapes.anthropic(okJson));
  await createByokProvider({ entry: entry("anthropic"), apiKey: KEY, model: "m", fetchImpl: fa }).adapt(spec, profile, {});
  assert.ok(JSON.parse(fa.calls[0].init.body).max_tokens >= 8192);
  assert.ok(!("temperature" in JSON.parse(fa.calls[0].init.body)));
});
test("키 비노출: 모든 공급자의 키 오류 되돌림에서도 키가 새지 않는다", async () => {
  const { adaptScreen } = await import("../app/js/adapt.js");
  for (const id of Object.keys(shapes)) {
    const echo = (_u, init) => textRes(`echo ${JSON.stringify(init.headers)}`, 401);
    const prov = createByokProvider({ entry: entry(id), apiKey: KEY, model: "m", fetchImpl: fakeFetch(echo) });
    const out = JSON.stringify(await adaptScreen({ spec, profile, provider: prov, timeoutMs: 500 }));
    assert.ok(!out.includes(KEY), id);
  }
});
test("실제 중단 신호 경로: fetch가 신호를 받아 중단되면 timeout으로 폴백", async () => {
  const { adaptScreen } = await import("../app/js/adapt.js");
  const hang = (_u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const prov = createByokProvider({ entry: entry("groq"), apiKey: KEY, model: "m", fetchImpl: hang });
  const res = await adaptScreen({ spec, profile, provider: prov, timeoutMs: 60 });
  assert.equal(res.source, "fallback");
  assert.ok(["timeout", "network"].includes(res.reason.code));
});

test("index.html의 CSP 메타가 buildCsp 결과와 글자 그대로 같다", () => {
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "index.html"), "utf8");
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, "CSP 메타가 없다");
  assert.equal(m[1], buildCsp(providersJson));
});
test("index.html에 인라인 스크립트·스타일·외부 주소 자원이 없다", () => {
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "index.html"), "utf8");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "인라인 스크립트");
  assert.ok(!/<style\b/i.test(html) && !/\sstyle=/i.test(html), "인라인 스타일");
  assert.ok(!/\s(src|href)="https?:/i.test(html), "외부 자원");
});
