import { test } from "node:test";
import assert from "node:assert/strict";
import { pickKoreanVoice, speechText } from "../app/ui/voice.js";

test("한국어 음성을 고른다(ko-KR 우선, 없으면 ko로 시작하는 것, 없으면 null)", () => {
  assert.equal(pickKoreanVoice([{ lang: "en-US", name: "a" }, { lang: "ko-KR", name: "b" }]).name, "b");
  assert.equal(pickKoreanVoice([{ lang: "ko", name: "c" }]).name, "c");
  assert.equal(pickKoreanVoice([{ lang: "ja-JP", name: "d" }]), null);
  assert.equal(pickKoreanVoice([]), null);
  assert.equal(pickKoreanVoice(undefined), null);
});
test("장난감류 음성은 고르지 않고 좋은 음성을 먼저 고른다", () => {
  const novelty = ["Eddy", "Flo", "Grandma", "Grandpa", "Reed", "Rocko", "Sandy", "Shelley"].map((n) => ({ lang: "ko-KR", name: `${n} (Korean (South Korea))` }));
  assert.equal(pickKoreanVoice(novelty), null);
  assert.equal(pickKoreanVoice([...novelty, { lang: "ko-KR", name: "Yuna" }]).name, "Yuna");
  assert.equal(pickKoreanVoice([{ lang: "ko-KR", name: "Plain" }, { lang: "ko-KR", name: "Yuna (Premium)" }]).name, "Yuna (Premium)");
  assert.equal(pickKoreanVoice([{ lang: "ko-KR", name: "Plain" }, { lang: "ko-KR", name: "Google 한국어" }]).name, "Google 한국어");
});
test("읽을 글: 줄바꿈과 겹친 공백을 정리하고 길이를 제한한다", () => {
  assert.equal(speechText("메뉴  고르기\n\n아메리카노\n4,500원"), "메뉴 고르기. 아메리카노. 4,500원");
  assert.ok(speechText("가".repeat(3000)).length <= 1200);
  assert.equal(speechText(""), "");
});

import { createVoice } from "../app/ui/voice.js";
import { scriptKey } from "../app/js/speak.js";

function withGlobals(globals, run) {
  const saved = Object.fromEntries(Object.keys(globals).map((k) => [k, globalThis[k]]));
  Object.assign(globalThis, globals);
  return Promise.resolve(run()).finally(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
}

test("녹음된 목소리가 있으면 그것을 재생하고, 없으면 브라우저 음성, 둘 다 없으면 false", async () => {
  const text = "메뉴를 골라 주세요.";
  const key = await scriptKey(text);
  const played = [];
  class FakeAudio { constructor(url) { this.url = url; played.push(url); } play() { return Promise.resolve(); } pause() {} }
  const spoken = [];
  class FakeUtterance { constructor(t) { this.text = t; } }
  const synth = { getVoices: () => [{ lang: "ko-KR", name: "Yuna" }], cancel() {}, speak(u) { spoken.push(u.text); u.onend?.(); } };
  await withGlobals({
    fetch: async () => ({ ok: true, json: async () => ({ clips: { [key]: { file: `${key}.m4a` } } }) }),
    Audio: FakeAudio, SpeechSynthesisUtterance: FakeUtterance, speechSynthesis: synth,
  }, async () => {
    const voice = createVoice({ onChange() {}, base: "audio/" });
    await voice.load();
    assert.equal(voice.supported(), true);
    assert.equal(await voice.speak(text), true);
    assert.deepEqual(played, [`audio/${key}.m4a`]);
    assert.deepEqual(spoken, []);
    assert.equal(await voice.speak("목소리가 없는 글입니다."), true);
    assert.deepEqual(spoken, ["목소리가 없는 글입니다."]);
  });
  await withGlobals({
    fetch: async () => ({ ok: false }), Audio: FakeAudio, SpeechSynthesisUtterance: FakeUtterance, speechSynthesis: { getVoices: () => [{ lang: "ko-KR", name: "Eddy (Korean (South Korea))" }], cancel() {}, speak() {} },
  }, async () => {
    const voice = createVoice({ onChange() {}, base: "audio/" });
    await voice.load();
    assert.equal(voice.supported(), false);
    assert.equal(await voice.speak("아무 글"), false);
  });
});
