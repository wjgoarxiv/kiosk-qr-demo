// Reads the phone page aloud. A recorded voice file (same origin, found by the script's key) is played first; the browser's own speech is only the fallback.
// The app sends no text anywhere; a browser may still use its own cloud voice for the fallback.
import { scriptKey } from "../js/speak.js";

const NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
const GOOD = /Yuna|유나|Google 한국어|Premium|Enhanced|Microsoft.*(SunHi|InJoon|Hyunsu|Korean)/i;
// The browser voice is only the fallback. macOS ships novelty "Korean" voices that sound wrong, so they are never picked.
export function pickKoreanVoice(voices) {
  const ko = (Array.isArray(voices) ? voices : []).filter((v) => String(v.lang).toLowerCase().startsWith("ko") && !NOVELTY.test(String(v.name ?? "")));
  return ko.find((v) => GOOD.test(String(v.name ?? ""))) ?? ko.find((v) => v.lang === "ko-KR") ?? ko[0] ?? null;
}

export function speechText(raw) {
  return String(raw).split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join(". ").slice(0, 1200);
}

export function createVoice({ onChange, base = "audio/" }) {
  const engine = () => globalThis.speechSynthesis;
  let speaking = false;
  let clips = null;
  let player = null;
  const done = () => { speaking = false; onChange(); };
  const browserOk = () => Boolean(engine() && globalThis.SpeechSynthesisUtterance && pickKoreanVoice(engine().getVoices()));

  async function load() {
    try {
      const res = await fetch(`${base}index.json`);
      clips = res.ok ? (await res.json()).clips ?? {} : {};
    } catch { clips = {}; }
    onChange();
  }

  function browserSpeak(text) {
    const synth = engine();
    const voice = pickKoreanVoice(synth.getVoices());
    if (!voice) return false;
    synth.cancel();
    const u = new globalThis.SpeechSynthesisUtterance(speechText(text));
    u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
    u.onend = u.onerror = done;
    speaking = true;
    synth.speak(u);
    onChange();
    return true;
  }

  return {
    load,
    supported: () => Boolean(clips && Object.keys(clips).length) || browserOk(),
    speaking: () => speaking,
    // Resolves true when something is being played, false when this script has no voice at all.
    async speak(text) {
      this.stop();
      let key = "";
      try { key = await scriptKey(text); } catch { key = ""; }
      const clip = clips?.[key];
      if (clip && globalThis.Audio) {
        player = new globalThis.Audio(`${base}${clip.file}`);
        player.onended = done;
        player.onerror = () => { player = null; if (!browserOk() || !browserSpeak(text)) done(); };
        speaking = true;
        onChange();
        try { await player.play(); return true; } catch { player = null; speaking = false; }
      }
      return browserOk() ? browserSpeak(text) : false;
    },
    stop() {
      if (player) { player.pause(); player = null; }
      engine()?.cancel();
      speaking = false;
      onChange();
    },
  };
}
