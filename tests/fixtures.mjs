import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data");
const read = (p) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));

export const specs = Object.fromEntries(["cafe", "restaurant", "clinic"].map((id) => [id, read(`specs/${id}.json`)]));
export const profiles = read("profiles.json").profiles;
export const clone = (v) => JSON.parse(JSON.stringify(v));

const lineSum = (spec, line) => {
  const item = spec.items.find((i) => i.id === line.item_id);
  const delta = line.option_ids.reduce((s, oid) => s + item.options.find((o) => o.id === oid).price_delta_krw, 0);
  return (item.price_krw + delta) * line.qty;
};

// Independent of the production adapter: a hand-built, rule-abiding AdaptedScreen for tests.
export function makeValid(spec, profile) {
  const touch = profile.touch_target === "large" ? 56 : 44;
  const items = spec.items.map((i) => ({
    id: i.id,
    label: i.name,
    hint: i.description,
    price_krw: i.price_krw,
    options: i.options.map((o) => ({ id: o.id, label: o.name, price_delta_krw: o.price_delta_krw })),
  }));
  const selectPages = profile.step_split
    ? spec.items.map((i, n) => ({ id: `select-${n + 1}`, kind: "select", title: "메뉴 고르기", lead: "하나만 골라 주세요.", item_ids: [i.id] }))
    : [{ id: "select-1", kind: "select", title: "메뉴 고르기", lead: "원하는 것을 눌러 주세요.", item_ids: spec.items.map((i) => i.id) }];
  const lines = spec.order.lines.map((l) => ({ item_id: l.item_id, option_ids: [...l.option_ids], qty: l.qty, line_total_krw: lineSum(spec, l) }));
  const total = lines.reduce((s, l) => s + l.line_total_krw, 0);
  return {
    screen_id: spec.id,
    profile_id: profile.id,
    style: { text_scale: profile.text_scale, contrast: profile.contrast, touch_target_px: touch, scroll_hint: true },
    items,
    pages: [
      ...selectPages,
      { id: "cart-1", kind: "cart", title: "담은 목록", lead: "고른 것을 확인해 주세요.", item_ids: [] },
      { id: "confirm-1", kind: "confirm", title: "원래 화면으로 확인", lead: "이름과 금액이 맞는지 봐 주세요.", item_ids: [] },
      { id: "pay-1", kind: "pay", title: "결제", lead: "모의 결제입니다.", item_ids: [] },
    ],
    cart: { lines, total_krw: total },
    confirm: {
      lines: lines.map((l) => ({ item_id: l.item_id, original_name: spec.items.find((i) => i.id === l.item_id).name, amount_krw: l.line_total_krw })),
      total_krw: total,
      original_check_required: true,
    },
    staff_call: { label: "직원 부르기" },
  };
}

export const combos = Object.values(specs).flatMap((spec) => profiles.map((profile) => ({ spec, profile })));
