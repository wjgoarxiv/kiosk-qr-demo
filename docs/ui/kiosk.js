import { formatClock, formatKrw } from "../js/format.js";

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Draws the "before" kiosk screen: small type, dense tiles, English labels and a static time-left label.
export function renderKiosk(root, spec) {
  root.replaceChildren();
  const bar = el("div", "k-bar");
  bar.append(el("span", "", "Self Order (demo)"), el("span", "k-timer", `Time left ${formatClock(spec.constraints.time_limit_sec)}`));
  const grid = el("div", "k-grid");
  for (const item of spec.items) {
    const tile = el("div", "k-tile");
    tile.append(el("b", "", item.name), el("span", "", formatKrw(item.price_krw)));
    for (const opt of item.options) {
      const line = el("span", "k-addon", `+ ${opt.name} `);
      line.append(el("span", "nowrap", formatKrw(opt.price_delta_krw)));
      tile.append(line);
    }
    grid.append(tile);
  }
  const foot = el("div", "k-foot");
  const qty = spec.order.lines.reduce((s, l) => s + l.qty, 0);
  foot.append(el("span", "", `Cart (${qty})`), el("span", "", "Checkout"));
  root.append(bar, el("div", "", spec.title), grid, foot);
}
