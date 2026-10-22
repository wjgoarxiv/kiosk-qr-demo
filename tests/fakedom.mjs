// Minimal DOM double: enough to render a page tree and inspect what the renderer produced.
class FakeNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.style = { props: {}, setProperty(k, v) { this.props[k] = v; } };
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...kids) { for (const k of kids) this.children.push(typeof k === "string" ? new FakeText(k) : k); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  set textContent(value) { this.children = [new FakeText(String(value))]; }
  get textContent() { return this.children.map((c) => c.textContent).join(""); }
}
class FakeText {
  constructor(text) { this.nodeType = 3; this.data = text; }
  get textContent() { return this.data; }
}

export const fakeDocument = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => new FakeText(text),
};

export function walk(node, visit) {
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}
export const elements = (root) => { const out = []; walk(root, (n) => { if (n.tagName) out.push(n); }); return out; };
export const textOf = (root) => root.textContent;
