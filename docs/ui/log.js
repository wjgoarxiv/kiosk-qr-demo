import { RULES, ERROR_TEXT, REASON_TEXT } from "./messages.js";
import { validateAdapted } from "../js/validator.js";

const PROVIDER_LABEL = { precomputed: "미리 만든 출력", gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter", anthropic: "Anthropic", openai: "OpenAI" };

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function ruleStates(errorCodes) {
  const shapeBroken = errorCodes.some((c) => c === "E_SCHEMA" || c === "E_LENGTH");
  return RULES.map((rule) => {
    const failed = rule.codes.some((c) => errorCodes.includes(c));
    const skipped = !failed && shapeBroken && !["safe", "length"].includes(rule.id);
    return { ...rule, state: failed ? "fail" : skipped ? "skip" : "pass" };
  });
}

function metaLine(meta, source) {
  const line = el("p", "log-meta");
  const add = (k, v) => { if (v) { const item = el("span", "meta-item", `${k} `); item.append(el("b", "", v)); line.append(item); } };
  add("만든 곳", PROVIDER_LABEL[meta.provider] ?? meta.provider);
  add("모델", meta.model);
  add("생성일", meta.date);
  add("프롬프트 해시", meta.promptHash ? meta.promptHash.slice(0, 12) : meta.prompt_sha256 ? meta.prompt_sha256.slice(0, 12) : "");
  add("응답 시간", meta.ms ? `${meta.ms}ms` : "");
  if (source === "ai") add("검증", "통과");
  return line;
}

// Renders the validator panel: verdict badge, provenance, per-rule pass/fail, and why a fallback was used.
export function renderLog(root, { spec, profile, result }) {
  root.replaceChildren();
  if (!result) { root.append(el("p", "hint", "QR을 찍으면 여기에 확인 결과가 나타나요.")); return; }
  const ai = result.source === "ai";
  const head = el("p");
  const chosenBaseline = result.reason?.code === "no_provider";
  head.append(el("span", `badge ${ai ? "ok" : "fallback"}`, ai ? "AI 출력 채택" : chosenBaseline ? "규칙 변환" : "규칙 변환으로 대체"));
  root.append(head);
  const detail = result.reason ? (REASON_TEXT[result.reason.code] ?? "알 수 없는 사유") : "AI가 만든 화면이 모든 검증을 통과했어요";
  root.append(el("p", "", detail));
  root.append(metaLine(result.meta ?? {}, result.source));

  const codes = chosenBaseline ? validateAdapted(spec, profile, result.adapted).errors.map((e) => e.code) : (result.reason?.errors?.map((e) => e.code) ?? []);
  const showRules = ai || chosenBaseline || result.reason?.code === "validation";
  if (showRules) {
    const list = el("ul", "log-list");
    for (const rule of ruleStates(codes)) {
      const li = el("li", rule.state);
      li.append(el("span", "mark", rule.state === "pass" ? "통과" : rule.state === "fail" ? "막힘" : "건너뜀"), el("span", "", rule.label));
      list.append(li);
    }
    root.append(list);
    for (const e of result.reason?.errors ?? []) root.append(el("p", "hint", ERROR_TEXT[e.code] ?? e.code));
  }
  if (!ai && result.adapted) {
    const again = validateAdapted(spec, profile, result.adapted);
    root.append(el("p", "hint", again.ok ? (chosenBaseline ? "이 규칙 변환 화면도 같은 검증기를 통과했어요." : "대체 화면도 같은 검증기를 통과했어요.") : "이 화면이 검증기를 통과하지 못했어요."));
  }
}
