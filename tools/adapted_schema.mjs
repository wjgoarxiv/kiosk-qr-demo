// JSON Schema for AdaptedScreen in the strict structured-output dialect: every key required, no extra keys.
const str = { type: "string" };
const int = { type: "integer" };
const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const arr = (items) => ({ type: "array", items });

export function adaptedJsonSchema() {
  return obj({
    screen_id: str,
    profile_id: str,
    style: obj({ text_scale: { type: "number" }, contrast: { type: "string", enum: ["normal", "high"] }, touch_target_px: int, scroll_hint: { type: "boolean" } }),
    items: arr(obj({ id: str, label: str, hint: str, price_krw: int, options: arr(obj({ id: str, label: str, price_delta_krw: int })) })),
    pages: arr(obj({ id: str, kind: { type: "string", enum: ["select", "options", "cart", "confirm", "pay"] }, title: str, lead: str, item_ids: arr(str) })),
    cart: obj({ lines: arr(obj({ item_id: str, option_ids: arr(str), qty: int, line_total_krw: int })), total_krw: int }),
    confirm: obj({ lines: arr(obj({ item_id: str, original_name: str, amount_krw: int })), total_krw: int, original_check_required: { type: "boolean" } }),
    staff_call: obj({ label: str }),
  });
}
