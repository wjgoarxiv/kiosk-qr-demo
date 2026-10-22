import { formatKrw } from "./format.js";
import { lineTotal } from "./schema.js";

const money = (doc, amount, cls) => el(doc, "span", { cls, text: formatKrw(amount) });

function el(doc, tag, { cls, text, attrs } = {}, kids = []) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) node.setAttribute(k, v);
  for (const kid of kids) node.appendChild(kid);
  return node;
}

function button(doc, label, action, onAction, cls = "btn") {
  const b = el(doc, "button", { cls, text: label, attrs: { type: "button", "data-action": action } });
  b.addEventListener("click", () => onAction(action));
  return b;
}

const optionText = (adapted, itemId, optionIds) => {
  const item = adapted.items.find((i) => i.id === itemId);
  return optionIds.map((oid) => item?.options.find((o) => o.id === oid)?.label ?? "").filter(Boolean).join(", ");
};

function selectBody(doc, adapted, page) {
  const list = el(doc, "ul", { cls: "items" });
  for (const id of page.item_ids) {
    const item = adapted.items.find((i) => i.id === id);
    if (!item) continue;
    const li = el(doc, "li", { cls: "item" });
    li.appendChild(el(doc, "strong", { cls: "item-label", text: item.label }));
    li.appendChild(money(doc, item.price_krw, "item-price"));
    for (const opt of item.options) {
      li.appendChild(el(doc, "span", { cls: "item-option" }, [el(doc, "span", { text: `${opt.label} ` }), el(doc, "span", { cls: "nowrap", text: `+${formatKrw(opt.price_delta_krw)}` })]));
    }
    if (item.hint) li.appendChild(el(doc, "p", { cls: "item-hint", text: item.hint }));
    list.appendChild(li);
  }
  return list;
}

// A split cart/confirm step shows only its own lines; the total appears on the last step of that kind.
const pageLines = (lines, page) => (page.item_ids.length ? lines.filter((l) => page.item_ids.includes(l.item_id)) : lines);
const isLastOfKind = (adapted, page, pageIndex) => adapted.pages.findLastIndex((p) => p.kind === page.kind) === pageIndex;

function cartBody(doc, adapted, page, withTotal) {
  const list = el(doc, "ul", { cls: "cart" });
  for (const line of pageLines(adapted.cart.lines, page)) {
    const item = adapted.items.find((i) => i.id === line.item_id);
    const opts = optionText(adapted, line.item_id, line.option_ids);
    const nameBlock = el(doc, "span", { cls: "cart-name" }, [el(doc, "span", { text: item?.label ?? "" }), el(doc, "span", { cls: "nowrap", text: ` × ${line.qty}` })]);
    if (opts) nameBlock.appendChild(el(doc, "span", { cls: "cart-opts", text: opts }));
    list.appendChild(el(doc, "li", { cls: "cart-line" }, [nameBlock, money(doc, line.line_total_krw, "amount")]));
  }
  if (withTotal) list.appendChild(el(doc, "li", { cls: "cart-total" }, [el(doc, "strong", { text: "합계" }), el(doc, "strong", { cls: "amount", text: formatKrw(adapted.cart.total_krw) })]));
  return list;
}

// The confirm step reads names and amounts from the original spec, never from model output.
function confirmBody(doc, spec, page, withTotal) {
  const box = el(doc, "div", { cls: "original-check", attrs: { role: "group", "aria-label": "키오스크 원래 화면" } });
  box.appendChild(el(doc, "p", { cls: "original-note", text: "키오스크 화면의 이름과 금액입니다. 같은지 확인해 주세요." }));
  const list = el(doc, "ul", { cls: "cart" });
  for (const line of spec.order.lines) {
    if (page.item_ids.length && !page.item_ids.includes(line.item_id)) continue;
    const item = spec.items.find((i) => i.id === line.item_id);
    const delta = line.option_ids.reduce((s, oid) => s + item.options.find((o) => o.id === oid).price_delta_krw, 0);
    const amount = (item.price_krw + delta) * line.qty;
    const opts = line.option_ids.map((oid) => item.options.find((o) => o.id === oid).name);
    const nameBlock = el(doc, "span", { cls: "cart-name" }, [el(doc, "span", { text: item.name }), el(doc, "span", { cls: "nowrap", text: ` × ${line.qty}` })]);
    if (opts.length) nameBlock.appendChild(el(doc, "span", { cls: "cart-opts", text: opts.join(", ") }));
    list.appendChild(el(doc, "li", { cls: "cart-line" }, [nameBlock, money(doc, amount, "amount")]));
  }
  if (withTotal) {
    const all = spec.order.lines.reduce((sum, l) => sum + lineTotal(spec, l), 0);
    list.appendChild(el(doc, "li", { cls: "cart-total" }, [el(doc, "strong", { text: "합계" }), el(doc, "strong", { cls: "amount", text: formatKrw(all) })]));
  }
  box.appendChild(list);
  return box;
}

// Builds one phone page. Only text nodes and fixed attributes are used, so model text can never become markup.
// Instructions about controls (leads, staff button, confirm and pay pages) are fixed wording; the model rewords titles, names and hints.
export const FIXED = {
  confirm: { title: "원래 화면과 비교", lead: "이름과 금액이 맞는지 봐 주세요." },
  pay: { title: "결제", lead: "모의 결제입니다." },
};
export const FIXED_LEAD = {
  select: "메뉴와 금액을 살펴보세요.",
  options: "메뉴와 금액을 살펴보세요.",
  cart: "고른 내용이 맞는지 봐 주세요.",
};
const STAFF_LABEL = "직원 부르기";
export const PAY_NOTE = "실제 결제는 일어나지 않아요. 시연용 화면입니다.";

export function renderPage(doc, { spec, adapted, pageIndex, onAction }) {
  const page = adapted.pages[pageIndex];
  const last = pageIndex === adapted.pages.length - 1;
  const root = el(doc, "section", { cls: `phone-page kind-${page.kind}`, attrs: { "data-contrast": adapted.style.contrast, role: "region", "aria-label": page.title } });
  root.style.setProperty("--scale", String(adapted.style.text_scale));
  root.style.setProperty("--touch", `${adapted.style.touch_target_px}px`);

  const body = el(doc, "div", { cls: "page-body", attrs: { tabindex: "0", role: "region", "aria-label": "화면 내용" } });
  root.appendChild(body);
  body.appendChild(el(doc, "p", { cls: "progress", text: `${pageIndex + 1} / ${adapted.pages.length}` }));
  const fixed = FIXED[page.kind];
  body.appendChild(el(doc, "h3", { cls: "page-title", text: fixed ? fixed.title : page.title, attrs: { tabindex: "-1" } }));
  body.appendChild(el(doc, "p", { cls: "page-lead", text: fixed ? fixed.lead : FIXED_LEAD[page.kind] }));

  if (page.kind === "select" || page.kind === "options") body.appendChild(selectBody(doc, adapted, page));
  else if (page.kind === "cart") body.appendChild(cartBody(doc, adapted, page, isLastOfKind(adapted, page, pageIndex)));
  else if (page.kind === "confirm") body.appendChild(confirmBody(doc, spec, page, isLastOfKind(adapted, page, pageIndex)));
  else body.appendChild(el(doc, "p", { cls: "pay-note", text: PAY_NOTE }));

  if (adapted.style.scroll_hint && page.kind === "select" && page.item_ids.length > 3) {
    body.appendChild(el(doc, "p", { cls: "scroll-hint", text: "아래로 밀면 더 있어요." }));
  }

  const nav = el(doc, "div", { cls: "nav" });
  if (pageIndex > 0) nav.appendChild(button(doc, "이전", "prev", onAction, "btn btn-quiet"));
  const nextLabel = last ? "모의 결제 완료" : page.kind === "confirm" ? "맞아요, 결제로" : "다음";
  nav.appendChild(button(doc, nextLabel, last ? "finish" : "next", onAction));
  root.appendChild(el(doc, "div", { cls: "actions" }, [nav, button(doc, STAFF_LABEL, "staff", onAction, "btn btn-staff")]));
  return root;
}
