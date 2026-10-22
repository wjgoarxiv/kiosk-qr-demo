import { baselineAdapt } from "./baseline-adapt.js";
import { validateAdapted } from "./validator.js";
import { validateSpec, validateProfile } from "./schema.js";
import { buildPrompt, promptHash, extractJson, MAX_RESPONSE_CHARS } from "./prompt.js";

const fallback = (spec, profile, reason, meta) => ({ adapted: baselineAdapt(spec, profile), source: "fallback", reason, meta });

function withTimeout(run, ms, outer) {
  const ac = new AbortController();
  outer?.addEventListener("abort", () => ac.abort(), { once: true });
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { ac.abort(); reject(Object.assign(new Error("timeout"), { kind: "timeout" })); }, ms); });
  return Promise.race([run(ac.signal), timeout]).finally(() => clearTimeout(timer));
}

// Provider call -> parse -> schema/invariant validation. Anything short of ok falls back to the deterministic adapter with a reason.
export async function adaptScreen({ spec, profile, provider, timeoutMs = 30_000, signal }) {
  if (!validateSpec(spec).ok || !validateProfile(profile).ok) {
    return { adapted: null, source: "fallback", reason: { code: "bad_input", detail: "스펙 또는 프로필이 스키마를 통과하지 못함" }, meta: {} };
  }
  if (!provider) return fallback(spec, profile, { code: "no_provider", detail: "공급자가 선택되지 않음" }, {});
  if (signal?.aborted) return fallback(spec, profile, { code: "aborted", detail: "요청이 취소됨" }, {});
  const started = Date.now();
  let meta = { provider: provider.id };
  try {
    meta.promptHash = await promptHash(buildPrompt(spec, profile));
    const out = await withTimeout((inner) => provider.adapt(spec, profile, { signal: inner }), timeoutMs, signal);
    meta = { ...out.meta, ...meta, ms: Date.now() - started };
    if (typeof out.raw === "string" && out.raw.length > MAX_RESPONSE_CHARS) return fallback(spec, profile, { code: "too_large", detail: "응답이 너무 큼" }, meta);
    let parsed;
    try { parsed = extractJson(out.raw); } catch { return fallback(spec, profile, { code: "parse", detail: "JSON 객체를 읽지 못함" }, meta); }
    const verdict = validateAdapted(spec, profile, parsed);
    if (!verdict.ok) {
      return fallback(spec, profile, { code: "validation", detail: "불변 검증을 통과하지 못해 AI 출력을 버림", errors: verdict.errors.slice(0, 20) }, meta);
    }
    return { adapted: parsed, source: "ai", reason: null, meta };
  } catch (e) {
    const kind = signal?.aborted ? "aborted" : typeof e?.kind === "string" ? e.kind : "provider_error";
    return fallback(spec, profile, { code: kind, detail: kind === "provider_error" ? "공급자에서 예상 밖 오류" : String(e.message) }, { ...meta, ms: Date.now() - started });
  }
}
