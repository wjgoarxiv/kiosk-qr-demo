export const INDUSTRIES = ["cafe", "restaurant", "clinic"];
export const PAGE_KINDS = ["select", "options", "cart", "confirm", "pay"];
export const MAX_KRW = 100_000_000;
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isMoney = (v) => Number.isSafeInteger(v) && v >= 0 && v <= MAX_KRW;
export const isIntIn = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export const err = (code, path, message) => ({ code, path, message });

// Reports unknown and missing keys so extra fields cannot ride along.
export function exactKeys(obj, keys, path, out, code = "E_SCHEMA") {
  const allowed = new Set(keys);
  for (const k of Object.keys(obj)) if (!allowed.has(k)) out.push(err(code, `${path}.${k}`, "허용되지 않은 키"));
  for (const k of keys) if (!(k in obj)) out.push(err(code, `${path}.${k}`, "필수 키 없음"));
}

const result = (errors) => ({ ok: errors.length === 0, errors });

export function lineTotal(spec, line) {
  const item = spec.items.find((i) => i.id === line.item_id);
  const delta = line.option_ids.reduce((sum, oid) => sum + item.options.find((o) => o.id === oid).price_delta_krw, 0);
  return (item.price_krw + delta) * line.qty;
}

export function orderTotal(spec) {
  return spec.order.lines.reduce((sum, line) => sum + lineTotal(spec, line), 0);
}

export function validateSpec(spec) {
  const out = [];
  if (!isObject(spec)) return result([err("E_SCHEMA", "$", "객체가 아님")]);
  exactKeys(spec, ["id", "industry", "title", "items", "order", "constraints"], "$", out);
  if (out.length) return result(out);
  if (typeof spec.id !== "string" || !ID_RE.test(spec.id)) out.push(err("E_SCHEMA", "$.id", "id 형식 오류"));
  if (!INDUSTRIES.includes(spec.industry)) out.push(err("E_SCHEMA", "$.industry", "알 수 없는 업종"));
  if (typeof spec.title !== "string" || !spec.title.length || spec.title.length > 60) out.push(err("E_SCHEMA", "$.title", "제목 오류"));

  if (!Array.isArray(spec.items) || spec.items.length < 1 || spec.items.length > 8) {
    out.push(err("E_SCHEMA", "$.items", "항목은 1~8개"));
    return result(out);
  }
  const seen = new Set();
  const claim = (id, path) => {
    if (typeof id !== "string" || !ID_RE.test(id)) out.push(err("E_SCHEMA", path, "id 형식 오류"));
    else if (seen.has(id)) out.push(err("E_SCHEMA", path, "중복 id"));
    else seen.add(id);
  };
  spec.items.forEach((item, n) => {
    const p = `$.items[${n}]`;
    if (!isObject(item)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
    const before = out.length;
    exactKeys(item, ["id", "name", "price_krw", "description", "options"], p, out);
    if (out.length > before) return undefined;
    claim(item.id, `${p}.id`);
    if (typeof item.name !== "string" || !item.name.length || item.name.length > 40) out.push(err("E_SCHEMA", `${p}.name`, "이름 오류"));
    if (typeof item.description !== "string" || item.description.length > 120) out.push(err("E_SCHEMA", `${p}.description`, "설명 오류"));
    if (!isMoney(item.price_krw)) out.push(err("E_SCHEMA", `${p}.price_krw`, "가격은 0 이상의 정수"));
    if (!Array.isArray(item.options) || item.options.length > 10) return out.push(err("E_SCHEMA", `${p}.options`, "옵션은 최대 10개"));
    item.options.forEach((opt, m) => {
      const q = `${p}.options[${m}]`;
      if (!isObject(opt)) return out.push(err("E_SCHEMA", q, "객체가 아님"));
      const b = out.length;
      exactKeys(opt, ["id", "name", "price_delta_krw"], q, out);
      if (out.length > b) return undefined;
      claim(opt.id, `${q}.id`);
      if (typeof opt.name !== "string" || !opt.name.length || opt.name.length > 40) out.push(err("E_SCHEMA", `${q}.name`, "이름 오류"));
      if (!isMoney(opt.price_delta_krw)) out.push(err("E_SCHEMA", `${q}.price_delta_krw`, "차액은 0 이상의 정수"));
      return undefined;
    });
    return undefined;
  });
  if (out.length) return result(out);

  if (!isObject(spec.order) || !Array.isArray(spec.order.lines) || spec.order.lines.length < 1 || spec.order.lines.length > 20) {
    out.push(err("E_SCHEMA", "$.order.lines", "주문 줄은 1~20개"));
  } else {
    exactKeys(spec.order, ["lines"], "$.order", out);
    spec.order.lines.forEach((line, n) => {
      const p = `$.order.lines[${n}]`;
      if (!isObject(line)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
      const b = out.length;
      exactKeys(line, ["item_id", "option_ids", "qty"], p, out);
      if (out.length > b) return undefined;
      const item = spec.items.find((i) => i.id === line.item_id);
      if (!item) return out.push(err("E_SCHEMA", `${p}.item_id`, "없는 항목"));
      if (!isIntIn(line.qty, 1, 99)) out.push(err("E_SCHEMA", `${p}.qty`, "수량은 1~99"));
      if (!Array.isArray(line.option_ids) || new Set(line.option_ids).size !== line.option_ids.length) {
        out.push(err("E_SCHEMA", `${p}.option_ids`, "옵션 목록 오류"));
      } else if (line.option_ids.some((oid) => !item.options.some((o) => o.id === oid))) {
        out.push(err("E_SCHEMA", `${p}.option_ids`, "그 항목의 옵션이 아님"));
      }
      return undefined;
    });
  }
  if (!isObject(spec.constraints)) out.push(err("E_SCHEMA", "$.constraints", "객체가 아님"));
  else {
    exactKeys(spec.constraints, ["min_font_px", "time_limit_sec"], "$.constraints", out);
    if (!isIntIn(spec.constraints.min_font_px, 8, 64)) out.push(err("E_SCHEMA", "$.constraints.min_font_px", "8~64"));
    if (!isIntIn(spec.constraints.time_limit_sec, 10, 3600)) out.push(err("E_SCHEMA", "$.constraints.time_limit_sec", "10~3600"));
  }
  return result(out);
}

export function validateProfile(profile) {
  const out = [];
  if (!isObject(profile)) return result([err("E_SCHEMA", "$", "객체가 아님")]);
  exactKeys(profile, ["id", "label", "text_scale", "contrast", "plain_language", "step_split", "voice", "slow_pace", "touch_target", "language"], "$", out);
  if (out.length) return result(out);
  if (typeof profile.id !== "string" || !ID_RE.test(profile.id)) out.push(err("E_SCHEMA", "$.id", "id 형식 오류"));
  if (typeof profile.label !== "string" || !profile.label.length || profile.label.length > 40) out.push(err("E_SCHEMA", "$.label", "이름 오류"));
  if (![1, 1.5, 2].includes(profile.text_scale)) out.push(err("E_SCHEMA", "$.text_scale", "1, 1.5, 2 중 하나"));
  if (!["normal", "high"].includes(profile.contrast)) out.push(err("E_SCHEMA", "$.contrast", "normal 또는 high"));
  for (const k of ["plain_language", "step_split", "voice", "slow_pace"]) if (typeof profile[k] !== "boolean") out.push(err("E_SCHEMA", `$.${k}`, "불리언"));
  if (!["normal", "large"].includes(profile.touch_target)) out.push(err("E_SCHEMA", "$.touch_target", "normal 또는 large"));
  if (!["ko", "ko_easy", "en"].includes(profile.language)) out.push(err("E_SCHEMA", "$.language", "ko, ko_easy, en 중 하나"));
  return result(out);
}
