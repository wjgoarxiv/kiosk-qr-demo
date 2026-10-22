import { lineTotal, orderTotal } from "./schema.js";

const NOUN = { cafe: "메뉴", restaurant: "메뉴", clinic: "접수 항목" };

// Deterministic, AI-free conversion: only the profile's function codes change structure and style, wording stays original.
export function baselineAdapt(spec, profile) {
  const noun = NOUN[spec.industry] ?? "항목";
  const items = spec.items.map((i) => ({
    id: i.id,
    label: i.name,
    hint: i.description,
    price_krw: i.price_krw,
    options: i.options.map((o) => ({ id: o.id, label: o.name, price_delta_krw: o.price_delta_krw })),
  }));
  const selectPages = profile.step_split
    ? spec.items.map((i, n) => ({ id: `select-${n + 1}`, kind: "select", title: `${noun} 고르기`, lead: "하나씩 보여 드려요.", item_ids: [i.id] }))
    : [{ id: "select-1", kind: "select", title: `${noun} 고르기`, lead: "원하는 것을 눌러 주세요.", item_ids: spec.items.map((i) => i.id) }];
  const lines = spec.order.lines.map((l) => ({ item_id: l.item_id, option_ids: [...l.option_ids], qty: l.qty, line_total_krw: lineTotal(spec, l) }));
  return {
    screen_id: spec.id,
    profile_id: profile.id,
    style: {
      text_scale: profile.text_scale,
      contrast: profile.contrast,
      touch_target_px: profile.touch_target === "large" ? 56 : 44,
      scroll_hint: selectPages.some((p) => p.item_ids.length > 3),
    },
    items,
    pages: [
      ...selectPages,
      { id: "cart-1", kind: "cart", title: "담은 목록", lead: "고른 것을 확인해 주세요.", item_ids: [] },
      { id: "confirm-1", kind: "confirm", title: "원래 화면과 비교", lead: "이름과 금액이 맞는지 봐 주세요.", item_ids: [] },
      { id: "pay-1", kind: "pay", title: "결제", lead: "모의 결제입니다.", item_ids: [] },
    ],
    cart: { lines, total_krw: orderTotal(spec) },
    confirm: {
      lines: lines.map((l) => ({ item_id: l.item_id, original_name: spec.items.find((i) => i.id === l.item_id).name, amount_krw: l.line_total_krw })),
      total_krw: orderTotal(spec),
      original_check_required: true,
    },
    staff_call: { label: "직원 부르기" },
  };
}
