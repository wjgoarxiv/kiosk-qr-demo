import { PAGE_KINDS, isObject, isMoney, isIntIn, err, exactKeys, lineTotal, orderTotal } from "./schema.js";

const LIMITS = { label: 60, hint: 120, title: 40, lead: 100, staff: 30, items: 8, options: 10, pages: 16, lines: 20 };

// Text from a model is untrusted. Everything is NFKC-normalized first, so full-width and compatibility forms collapse.
const norm = (s) => s.normalize("NFKC");
const HIDDEN = /[\p{Cc}\p{Cf}ᅟᅠㅤﾠ]/u;
const squash = (s) => norm(s).toLowerCase().replace(/[\p{Z}\p{M}\p{P}\p{Cc}\p{Cf}ᅟᅠㅤﾠ]/gu, "");

const UNSAFE_RAW = [/[<>`]|\$\{/, /https?:|\bwww\./i, /javascript:|vbscript:|data:/i, /&#?\w+;/, /\b[a-z0-9-]+\.(com|net|org|io|kr|co|app|dev|xyz|example)\b/i];
const UNSAFE_SQUASHED = [
  /ignore(all|the)?(previous|prior|above)/, /disregard/, /systemprompt/, /youarenow/, /developermode/,
  /이전(지시|명령|지침)/, /(지시|명령|지침)(을|를)?무시/, /시스템프롬프트|개발자모드/,
];

// Prices live only in numeric fields; wording that states an amount, a number or a deal is rejected.
const PROMO_SQUASHED = [
  /무료|공짜|할인|증정|사은품|이벤트|쿠폰|적립|무상|서비스(로|제공|드)|덤으로|^덤|추가요금없|가격포함|추가비용없|freeof|free|discount|sale|complimentary|onthehouse|krw|buyoneget|bogo/,
  /[일이삼사오육칠팔구십백천만억]원(?!두|래|본|료|산|재|가|칙|하)/,
];
const PROMO_RAW = /[%₩$]|1\s*\+\s*1|[0-9]\s*원(?!두|래|본|료|산|재|가|칙|하)/;

const len = (s) => [...s].length;

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (isObject(value)) Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}
const digitRuns = (s) => norm(s).match(/\p{N}+/gu) ?? [];

function checkText(value, path, max, out, ctx, { required = false } = {}) {
  if (typeof value !== "string") return out.push(err("E_SCHEMA", path, "문자열이 아님"));
  if (len(value) > max) out.push(err("E_LENGTH", path, `${max}자 초과`));
  const flat = squash(value);
  if (required && flat === "") out.push(err("E_SCHEMA", path, "비어 있음"));
  const n = norm(value);
  if (HIDDEN.test(value) || UNSAFE_RAW.some((re) => re.test(n)) || UNSAFE_SQUASHED.some((re) => re.test(flat))) {
    out.push(err("E_UNSAFE_TEXT", path, "허용되지 않은 문자열"));
  }
  if (PROMO_RAW.test(n) || PROMO_SQUASHED.some((re) => re.test(flat)) || digitRuns(value).some((run) => !ctx.allowedRuns.has(run))) {
    out.push(err("E_PROMO", path, "금액·숫자·할인 문구는 숫자 필드로만 표시"));
  }
  return undefined;
}

const strArray = (v, max) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string");

function checkShape(adapted, spec, profile, out, ctx) {
  if (!isObject(adapted)) return out.push(err("E_SCHEMA", "$", "객체가 아님"));
  exactKeys(adapted, ["screen_id", "profile_id", "style", "items", "pages", "cart", "confirm", "staff_call"], "$", out);
  if (adapted.screen_id !== spec.id) out.push(err("E_SCHEMA", "$.screen_id", "화면 id 불일치"));
  if (adapted.profile_id !== profile.id) out.push(err("E_SCHEMA", "$.profile_id", "프로필 id 불일치"));

  if (isObject(adapted.style)) {
    exactKeys(adapted.style, ["text_scale", "contrast", "touch_target_px", "scroll_hint"], "$.style", out);
    if (typeof adapted.style.text_scale !== "number" || adapted.style.text_scale < 1 || adapted.style.text_scale > 3) out.push(err("E_SCHEMA", "$.style.text_scale", "1~3"));
    if (!["normal", "high"].includes(adapted.style.contrast)) out.push(err("E_SCHEMA", "$.style.contrast", "normal 또는 high"));
    if (!isIntIn(adapted.style.touch_target_px, 24, 200)) out.push(err("E_SCHEMA", "$.style.touch_target_px", "24~200"));
    if (typeof adapted.style.scroll_hint !== "boolean") out.push(err("E_SCHEMA", "$.style.scroll_hint", "불리언"));
  } else out.push(err("E_SCHEMA", "$.style", "객체가 아님"));

  if (!Array.isArray(adapted.items)) out.push(err("E_SCHEMA", "$.items", "배열이 아님"));
  else if (adapted.items.length > LIMITS.items) out.push(err("E_LENGTH", "$.items", "항목 수 초과"));
  else {
    adapted.items.forEach((item, n) => {
      const p = `$.items[${n}]`;
      if (!isObject(item)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
      exactKeys(item, ["id", "label", "hint", "price_krw", "options"], p, out);
      if (typeof item.id !== "string") out.push(err("E_SCHEMA", `${p}.id`, "문자열이 아님"));
      checkText(item.label, `${p}.label`, LIMITS.label, out, ctx, { required: true });
      checkText(item.hint, `${p}.hint`, LIMITS.hint, out, ctx);
      if (!isMoney(item.price_krw)) out.push(err("E_SCHEMA", `${p}.price_krw`, "0 이상의 정수"));
      if (!Array.isArray(item.options) || item.options.length > LIMITS.options) return out.push(err("E_SCHEMA", `${p}.options`, "옵션 배열 오류"));
      item.options.forEach((opt, m) => {
        const q = `${p}.options[${m}]`;
        if (!isObject(opt)) return out.push(err("E_SCHEMA", q, "객체가 아님"));
        exactKeys(opt, ["id", "label", "price_delta_krw"], q, out);
        if (typeof opt.id !== "string") out.push(err("E_SCHEMA", `${q}.id`, "문자열이 아님"));
        checkText(opt.label, `${q}.label`, LIMITS.label, out, ctx, { required: true });
        if (!isMoney(opt.price_delta_krw)) out.push(err("E_SCHEMA", `${q}.price_delta_krw`, "0 이상의 정수"));
        return undefined;
      });
      return undefined;
    });
  }

  if (!Array.isArray(adapted.pages)) out.push(err("E_SCHEMA", "$.pages", "배열이 아님"));
  else if (adapted.pages.length > LIMITS.pages) out.push(err("E_LENGTH", "$.pages", "단계 수 초과"));
  else {
    adapted.pages.forEach((page, n) => {
      const p = `$.pages[${n}]`;
      if (!isObject(page)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
      exactKeys(page, ["id", "kind", "title", "lead", "item_ids"], p, out);
      if (typeof page.id !== "string") out.push(err("E_SCHEMA", `${p}.id`, "문자열이 아님"));
      if (!PAGE_KINDS.includes(page.kind)) out.push(err("E_SCHEMA", `${p}.kind`, "알 수 없는 종류"));
      checkText(page.title, `${p}.title`, LIMITS.title, out, ctx, { required: true });
      checkText(page.lead, `${p}.lead`, LIMITS.lead, out, ctx, { required: true });
      if (!strArray(page.item_ids, LIMITS.items)) out.push(err(Array.isArray(page.item_ids) && page.item_ids.length > LIMITS.items ? "E_LENGTH" : "E_SCHEMA", `${p}.item_ids`, "문자열 배열이 아니거나 너무 김"));
      else if (new Set(page.item_ids).size !== page.item_ids.length) out.push(err("E_LENGTH", `${p}.item_ids`, "항목 id 중복"));
      return undefined;
    });
  }

  if (isObject(adapted.cart)) {
    exactKeys(adapted.cart, ["lines", "total_krw"], "$.cart", out);
    if (!Array.isArray(adapted.cart.lines) || adapted.cart.lines.length > LIMITS.lines) out.push(err("E_SCHEMA", "$.cart.lines", "배열 오류"));
    else adapted.cart.lines.forEach((l, n) => {
      const p = `$.cart.lines[${n}]`;
      if (!isObject(l)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
      exactKeys(l, ["item_id", "option_ids", "qty", "line_total_krw"], p, out);
      if (typeof l.item_id !== "string") out.push(err("E_SCHEMA", `${p}.item_id`, "문자열이 아님"));
      if (!strArray(l.option_ids, LIMITS.options)) out.push(err("E_SCHEMA", `${p}.option_ids`, "문자열 배열이 아님"));
      if (!isIntIn(l.qty, 1, 99)) out.push(err("E_SCHEMA", `${p}.qty`, "1~99의 정수"));
      if (!isMoney(l.line_total_krw)) out.push(err("E_SCHEMA", `${p}.line_total_krw`, "0 이상의 정수"));
      return undefined;
    });
    if (!isMoney(adapted.cart.total_krw)) out.push(err("E_SCHEMA", "$.cart.total_krw", "0 이상의 정수"));
  } else out.push(err("E_SCHEMA", "$.cart", "객체가 아님"));

  if (isObject(adapted.confirm)) {
    exactKeys(adapted.confirm, ["lines", "total_krw", "original_check_required"], "$.confirm", out);
    if (!Array.isArray(adapted.confirm.lines) || adapted.confirm.lines.length > LIMITS.lines) out.push(err("E_SCHEMA", "$.confirm.lines", "배열 오류"));
    else adapted.confirm.lines.forEach((l, n) => {
      const p = `$.confirm.lines[${n}]`;
      if (!isObject(l)) return out.push(err("E_SCHEMA", p, "객체가 아님"));
      exactKeys(l, ["item_id", "original_name", "amount_krw"], p, out);
      if (typeof l.item_id !== "string") out.push(err("E_SCHEMA", `${p}.item_id`, "문자열이 아님"));
      if (typeof l.original_name !== "string") out.push(err("E_SCHEMA", `${p}.original_name`, "문자열이 아님"));
      if (!isMoney(l.amount_krw)) out.push(err("E_SCHEMA", `${p}.amount_krw`, "0 이상의 정수"));
      return undefined;
    });
    if (!isMoney(adapted.confirm.total_krw)) out.push(err("E_SCHEMA", "$.confirm.total_krw", "0 이상의 정수"));
    if (typeof adapted.confirm.original_check_required !== "boolean") out.push(err("E_SCHEMA", "$.confirm.original_check_required", "불리언"));
  } else out.push(err("E_SCHEMA", "$.confirm", "객체가 아님"));

  if (isObject(adapted.staff_call)) {
    exactKeys(adapted.staff_call, ["label"], "$.staff_call", out);
    checkText(adapted.staff_call.label, "$.staff_call.label", LIMITS.staff, out, ctx, { required: true });
  } else out.push(err("E_SCHEMA", "$.staff_call", "객체가 아님"));
  return undefined;
}

const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));

// A label may add words to its own name but must not carry another item's or option's name (that would pair a price with the wrong name).
function namesOtherThan(spec, own) {
  const names = spec.items.flatMap((i) => [i.name, ...i.options.map((o) => o.name)]).map(norm);
  return names.filter((n) => n !== own && !own.includes(n));
}
const mixesNames = (label, own, others) => others.some((n) => norm(label).includes(n) && !own.includes(n));

function checkItems(adapted, spec, out) {
  const ids = adapted.items.map((i) => i.id);
  if (!sameSet(ids, spec.items.map((i) => i.id))) out.push(err("E_ID_SET", "$.items", "항목 id 집합이 원본과 다름(추가·삭제·중복)"));
  adapted.items.forEach((item, n) => {
    const orig = spec.items.find((i) => i.id === item.id);
    if (!orig) return;
    if (item.price_krw !== orig.price_krw) out.push(err("E_PRICE", `$.items[${n}].price_krw`, "가격이 원본과 다름"));
    if (!norm(item.label).includes(norm(orig.name))) out.push(err("E_LABEL", `$.items[${n}].label`, "표시 이름에 원래 이름이 들어 있어야 함"));
    else if (mixesNames(item.label, norm(orig.name), namesOtherThan(spec, norm(orig.name)))) out.push(err("E_LABEL", `$.items[${n}].label`, "표시 이름에 다른 항목·옵션 이름이 섞여 있음"));
    if (!sameSet(item.options.map((o) => o.id), orig.options.map((o) => o.id))) out.push(err("E_ID_SET", `$.items[${n}].options`, "옵션 id 집합이 원본과 다름"));
    item.options.forEach((opt, m) => {
      const o = orig.options.find((x) => x.id === opt.id);
      if (!o) return;
      if (opt.price_delta_krw !== o.price_delta_krw) out.push(err("E_PRICE", `$.items[${n}].options[${m}]`, "옵션 차액이 원본과 다름"));
      if (!norm(opt.label).includes(norm(o.name))) out.push(err("E_LABEL", `$.items[${n}].options[${m}].label`, "표시 이름에 원래 이름이 들어 있어야 함"));
      else if (mixesNames(opt.label, norm(o.name), namesOtherThan(spec, norm(o.name)))) out.push(err("E_LABEL", `$.items[${n}].options[${m}].label`, "표시 이름에 다른 항목·옵션 이름이 섞여 있음"));
    });
  });
}

function checkCart(adapted, spec, out) {
  const lines = adapted.cart.lines;
  const want = spec.order.lines;
  if (lines.length !== want.length) out.push(err("E_CART", "$.cart.lines", "줄 수가 원본 주문과 다름"));
  want.forEach((w, n) => {
    const l = lines[n];
    if (!l) return;
    const a = [...l.option_ids].sort();
    const b = [...w.option_ids].sort();
    const sameOpts = a.length === b.length && a.every((x, i) => x === b[i]);
    if (l.item_id !== w.item_id || l.qty !== w.qty || !sameOpts) out.push(err("E_CART", `$.cart.lines[${n}]`, "항목·옵션·수량이 원본 주문과 다름"));
    else if (l.line_total_krw !== lineTotal(spec, w)) out.push(err("E_CART", `$.cart.lines[${n}].line_total_krw`, "줄 금액을 다시 계산한 값과 다름"));
  });
  if (adapted.cart.total_krw !== orderTotal(spec)) out.push(err("E_CART", "$.cart.total_krw", "합계를 다시 계산한 값과 다름"));
}

function checkConfirm(adapted, spec, out) {
  const c = adapted.confirm;
  if (c.original_check_required !== true) out.push(err("E_CONFIRM", "$.confirm.original_check_required", "결제 전 원문 확인을 끌 수 없음"));
  if (c.lines.length !== spec.order.lines.length) out.push(err("E_CONFIRM", "$.confirm.lines", "줄 수가 원본 주문과 다름"));
  spec.order.lines.forEach((w, n) => {
    const l = c.lines[n];
    if (!l) return;
    const item = spec.items.find((i) => i.id === w.item_id);
    if (l.item_id !== w.item_id) out.push(err("E_CONFIRM", `$.confirm.lines[${n}].item_id`, "항목이 원본 주문과 다름"));
    if (l.original_name !== item.name) out.push(err("E_CONFIRM", `$.confirm.lines[${n}].original_name`, "원본 이름과 글자가 다름"));
    if (l.amount_krw !== lineTotal(spec, w)) out.push(err("E_CONFIRM", `$.confirm.lines[${n}].amount_krw`, "원본 금액과 다름"));
  });
  if (c.total_krw !== orderTotal(spec)) out.push(err("E_CONFIRM", "$.confirm.total_krw", "합계가 원본과 다름"));
}

function checkProfile(adapted, profile, out) {
  const s = adapted.style;
  if (s.text_scale < profile.text_scale) out.push(err("E_PROFILE", "$.style.text_scale", "프로필이 요구한 글씨 배율보다 작음"));
  if (s.contrast !== profile.contrast) out.push(err("E_PROFILE", "$.style.contrast", "프로필의 대비와 다름"));
  const minTouch = profile.touch_target === "large" ? 48 : 36;
  if (s.touch_target_px < minTouch) out.push(err("E_PROFILE", "$.style.touch_target_px", `터치 영역은 ${minTouch}px 이상이어야 함`));
  if (profile.step_split) {
    adapted.pages.forEach((p, n) => {
      if ((p.kind === "select" || p.kind === "options") && p.item_ids.length > 1) out.push(err("E_PROFILE", `$.pages[${n}].item_ids`, "한 번에 하나 프로필은 단계마다 항목 1개"));
    });
  }
}

function checkFlow(adapted, spec, out) {
  const pages = adapted.pages;
  if (new Set(pages.map((p) => p.id)).size !== pages.length) out.push(err("E_FLOW", "$.pages", "단계 id 중복"));
  const at = (kind) => pages.findIndex((p) => p.kind === kind);
  const [cart, confirm, pay] = [at("cart"), at("confirm"), at("pay")];
  if (cart < 0 || confirm < 0 || pay < 0) out.push(err("E_FLOW", "$.pages", "장바구니·확인·결제 단계가 모두 있어야 함"));
  else {
    if (!(cart < confirm && confirm < pay)) out.push(err("E_FLOW", "$.pages", "순서는 장바구니, 확인, 결제여야 함"));
    if (pay !== pages.length - 1) out.push(err("E_FLOW", "$.pages", "결제가 마지막 단계여야 함"));
    pages.forEach((p, n) => { if ((p.kind === "select" || p.kind === "options") && n > cart) out.push(err("E_FLOW", `$.pages[${n}]`, "선택 단계는 장바구니 앞에 있어야 함")); });
  }
  const specIds = new Set(spec.items.map((i) => i.id));
  const shown = new Set();
  pages.forEach((p, n) => {
    for (const id of p.item_ids) {
      if (!specIds.has(id)) out.push(err("E_FLOW", `$.pages[${n}].item_ids`, "없는 항목을 가리킴"));
      else if (p.kind === "select" || p.kind === "options") shown.add(id);
    }
  });
  // A cart or confirm step that lists ids shows only those order lines, so together the steps of that kind must cover the whole order.
  const orderIds = new Set(spec.order.lines.map((l) => l.item_id));
  for (const kind of ["cart", "confirm"]) {
    const ofKind = pages.filter((p) => p.kind === kind);
    if (ofKind.some((p) => p.item_ids.length === 0)) continue;
    const covered = new Set(ofKind.flatMap((p) => p.item_ids));
    if ([...orderIds].some((id) => !covered.has(id))) out.push(err("E_FLOW", "$.pages", `${kind === "cart" ? "장바구니" : "확인"} 단계가 주문 줄을 모두 보여 주지 않음`));
    if (ofKind.some((p) => !p.item_ids.some((id) => orderIds.has(id)))) out.push(err("E_FLOW", "$.pages", `${kind === "cart" ? "장바구니" : "확인"} 단계에 보여 줄 주문 줄이 없음`));
  }
  for (const id of specIds) if (!shown.has(id)) out.push(err("E_FLOW", "$.pages", "어느 선택 단계에도 나오지 않는 항목이 있음"));
}

// Pure function: returns { ok, errors[] }. An AI output is used only when ok is true. Error text never echoes model strings.
export function validateAdapted(spec, profile, adapted) {
  const out = [];
  const ctx = { allowedRuns: new Set(collectStrings(spec).flatMap(digitRuns)) };
  checkShape(adapted, spec, profile, out, ctx);
  if (out.some((e) => e.code === "E_SCHEMA" || e.code === "E_LENGTH")) return { ok: false, errors: out };
  checkItems(adapted, spec, out);
  checkCart(adapted, spec, out);
  checkConfirm(adapted, spec, out);
  checkProfile(adapted, profile, out);
  checkFlow(adapted, spec, out);
  return { ok: out.length === 0, errors: out };
}
