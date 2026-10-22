import { ProviderError } from "./errors.js";
import { buildPrompt, MAX_RESPONSE_CHARS } from "./../prompt.js";

const MODEL_STRICT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MODEL_ROUTED = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;
const KEY_RE = /^[\x21-\x7e]{1,512}$/;
const modelOk = (entry, model) => (entry.format === "gemini-generate-content" ? MODEL_STRICT : MODEL_ROUTED).test(model) && !model.includes("..");

function requestFor(entry, model, apiKey, { system, user }) {
  const json = { "content-type": "application/json" };
  const temperature = entry.id === "openai" ? undefined : 0.2;
  if (entry.format === "gemini-generate-content") {
    return {
      url: entry.endpoint.replace("{model}", encodeURIComponent(model)),
      headers: { ...json, "x-goog-api-key": apiKey },
      body: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature } },
    };
  }
  if (entry.format === "anthropic-messages") {
    return {
      url: entry.endpoint,
      headers: { ...json, "x-api-key": apiKey, ...entry.auth.extra_headers },
      body: { model, max_tokens: 8192, temperature, system, messages: [{ role: "user", content: user }] },
    };
  }
  const body = { model, ...(temperature === undefined ? {} : { temperature }), messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  if (entry.id === "groq") body.response_format = { type: "json_object" };
  return { url: entry.endpoint, headers: { ...json, Authorization: `Bearer ${apiKey}` }, body };
}

function textFrom(entry, data) {
  if (entry.format === "gemini-generate-content") return (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? "").join("");
  if (entry.format === "anthropic-messages") return (data?.content ?? []).map((c) => c?.text ?? "").join("");
  return data?.choices?.[0]?.message?.content;
}

// The key lives only in this closure. Errors carry fixed messages and the HTTP status, never headers or server text.
export function createByokProvider({ entry, apiKey, model, fetchImpl = globalThis.fetch }) {
  const key = String(apiKey ?? "").trim();
  const modelName = (model || entry.default_model || "").trim();
  const provider = {
    id: entry.id,
    async adapt(spec, profile, { signal } = {}) {
      if (!key) throw new ProviderError("config", "키가 비어 있음");
      if (!KEY_RE.test(key)) throw new ProviderError("config", "키에 쓸 수 없는 글자가 있음");
      if (!modelOk(entry, modelName)) throw new ProviderError("config", "모델 이름이 올바르지 않음");
      const req = requestFor(entry, modelName, key, buildPrompt(spec, profile));
      let res;
      try {
        res = await fetchImpl(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
      } catch {
        throw new ProviderError("network", "공급자에 연결하지 못함");
      }
      if (res.status === 401 || res.status === 403) throw new ProviderError("key", `키가 거부됨(HTTP ${res.status})`);
      if (res.status === 400 && entry.format === "gemini-generate-content") {
        const text = await res.text().catch(() => "");
        if (text.includes("API_KEY_INVALID")) throw new ProviderError("key", "키가 거부됨(HTTP 400)");
      }
      if (res.status === 429) throw new ProviderError("rate_limit", "요청 한도 초과(HTTP 429)");
      if (!res.ok) throw new ProviderError("http", `공급자 오류(HTTP ${res.status})`);
      let body;
      try {
        const text = await res.text();
        if (text.length > MAX_RESPONSE_CHARS * 2) throw new ProviderError("bad_body", "응답이 너무 큼");
        body = JSON.parse(text);
      } catch (e) {
        throw e instanceof ProviderError ? e : new ProviderError("bad_body", "응답이 JSON이 아님");
      }
      const raw = textFrom(entry, body);
      if (typeof raw !== "string" || !raw) throw new ProviderError("bad_body", "응답에서 글을 찾지 못함");
      return { raw, meta: { provider: entry.id, model: modelName } };
    },
    toJSON() { return { id: entry.id, model: modelName }; },
    toString() { return `[byok ${entry.id}]`; },
  };
  return provider;
}
