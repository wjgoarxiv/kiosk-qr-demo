// Builds what the phone page says aloud: titles, names, prices read as Korean words, never the buttons or the page counter.
import { FIXED, FIXED_LEAD, PAY_NOTE } from "./render.js";
import { lineTotal } from "./schema.js";

const DIGIT = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const underTenThousand = (n) => {
  const [th, h, t, o] = [Math.floor(n / 1000), Math.floor((n % 1000) / 100), Math.floor((n % 100) / 10), n % 10];
  let out = "";
  if (th) out += `${th === 1 ? "" : DIGIT[th]}천`;
  if (h) out += `${h === 1 ? "" : DIGIT[h]}백`;
  if (t) out += `${t === 1 ? "" : DIGIT[t]}십`;
  if (o) out += DIGIT[o];
  return out;
};

export function sinoNumber(n) {
  if (n === 0) return "영";
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const rest = n % 1e4;
  const parts = [];
  if (eok) parts.push(`${underTenThousand(eok)}억`);
  if (man) parts.push(`${man === 1 ? "" : underTenThousand(man)}만`);
  if (rest) parts.push(underTenThousand(rest));
  return parts.join(" ");
}

export const wonToKorean = (n) => `${sinoNumber(n)} 원`;

const NATIVE = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
export function nativeCount(n) {
  if (n >= 1 && n <= 10) return `${NATIVE[n]} 개`;
  if (n >= 11 && n <= 19) return `열${NATIVE[n - 10]} 개`;
  if (n === 20) return "스무 개";
  return `${sinoNumber(n)} 개`;
}

// Parentheses become short pauses and the middle dot a space, so "라지 사이즈 (큰 컵)" reads naturally.
const say = (t) => String(t)
  .replace(/\s*\(([^)]*)\)/g, ", $1,")
  .replace(/·/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s+([,.])/g, "$1")
  .replace(/,\s*,/g, ",")
  .replace(/,\s*\./g, ".")
  .replace(/[,\s]+$/, "")
  .trim();
const sentence = (t) => `${say(t).replace(/[.!?。]+$/, "")}.`;

const pageLines = (lines, page) => (page.item_ids.length ? lines.filter((l) => page.item_ids.includes(l.item_id)) : lines);
const lastOfKind = (adapted, page, n) => adapted.pages.findLastIndex((p) => p.kind === page.kind) === n;

export const NOTES = {
  staff: {
    title: "직원을 불렀어요 (시연)",
    body: "실제로 연락하지는 않아요. 도움이 필요한 상황에서는 이렇게 사람에게 넘깁니다.",
    say: "직원을 불렀어요. 시연이라서 실제로 연락하지는 않아요. 도움이 필요한 상황에서는 이렇게 사람에게 넘깁니다.",
  },
  finish: {
    title: "모의 결제를 마쳤어요",
    body: "시연용이라 실제 결제나 주문은 만들어지지 않았어요.",
    say: "모의 결제를 마쳤어요. 시연용이라 실제 결제나 주문은 만들어지지 않았어요.",
  },
};

// A page with many items only names them and their prices; the explanations and options are for the eyes. One item per page is read in full.
const LONG_LIST = 3;
function itemSentences(adapted, ids) {
  const short = ids.length > LONG_LIST;
  const out = ids.flatMap((id) => {
    const item = adapted.items.find((i) => i.id === id);
    if (!item) return [];
    const lines = [`${say(item.label)}. ${wonToKorean(item.price_krw)}.`];
    if (!short) {
      if (item.hint) lines.push(sentence(item.hint));
      for (const o of item.options) lines.push(`${say(o.label)}, ${o.price_delta_krw === 0 ? "추가 금액은 없어요" : `${wonToKorean(o.price_delta_krw)}이 더해져요`}.`);
    }
    return lines;
  });
  if (short) out.push("설명과 옵션은 화면에서 확인하세요.");
  return out;
}

export function spokenScript(spec, adapted, pageIndex) {
  const page = adapted.pages[pageIndex];
  const fixed = FIXED[page.kind];
  const parts = [sentence(fixed ? fixed.title : page.title), sentence(fixed ? fixed.lead : FIXED_LEAD[page.kind])];
  const last = lastOfKind(adapted, page, pageIndex);
  if (page.kind === "select" || page.kind === "options") parts.push(...itemSentences(adapted, page.item_ids));
  else if (page.kind === "cart") {
    for (const line of pageLines(adapted.cart.lines, page)) {
      const item = adapted.items.find((i) => i.id === line.item_id);
      const opts = line.option_ids.map((oid) => say(item?.options.find((o) => o.id === oid)?.label ?? "")).filter(Boolean);
      parts.push(`${say(item?.label ?? "")}${opts.length ? `, ${opts.join(", ")}` : ""}, ${nativeCount(line.qty)}, ${wonToKorean(line.line_total_krw)}.`);
    }
    if (last) parts.push(`합계, ${wonToKorean(adapted.cart.total_krw)}.`);
  } else if (page.kind === "confirm") {
    for (const line of spec.order.lines) {
      if (page.item_ids.length && !page.item_ids.includes(line.item_id)) continue;
      const item = spec.items.find((i) => i.id === line.item_id);
      const opts = line.option_ids.map((oid) => say(item.options.find((o) => o.id === oid).name));
      parts.push(`${say(item.name)}${opts.length ? `, ${opts.join(", ")}` : ""}, ${nativeCount(line.qty)}, ${wonToKorean(lineTotal(spec, line))}.`);
    }
    if (last) parts.push(`합계, ${wonToKorean(spec.order.lines.reduce((s, l) => s + lineTotal(spec, l), 0))}.`);
  } else parts.push(PAY_NOTE);
  return parts.join(" ");
}

// 16 hex characters of the SHA-256 of the script: the name under which its recorded voice file is stored.
export async function scriptKey(text) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Every script the stored (체험) outputs can show, plus the two notes; the voice files must cover exactly these.
export async function enumerateScripts({ specs, precomputed }) {
  const out = [];
  for (const [combo, adapted] of Object.entries(precomputed)) {
    const spec = specs[combo.split("/")[0]];
    for (let n = 0; n < adapted.pages.length; n += 1) {
      const text = spokenScript(spec, adapted, n);
      out.push({ combo, page: n, text, key: await scriptKey(text) });
    }
  }
  for (const [name, note] of Object.entries(NOTES)) out.push({ combo: "note", page: name, text: note.say, key: await scriptKey(note.say) });
  return out;
}
