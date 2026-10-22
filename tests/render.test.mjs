import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderPage } from "../app/js/render.js";
import { baselineAdapt } from "../app/js/baseline-adapt.js";
import { formatKrw } from "../app/js/format.js";
import { fakeDocument, elements, textOf } from "./fakedom.mjs";
import { specs, profiles, clone, combos } from "./fixtures.mjs";

const render = (spec, adapted, pageIndex) => renderPage(fakeDocument, { spec, adapted, pageIndex, onAction() {} });

test("금액 표기: 천 단위 구분과 원", () => {
  assert.equal(formatKrw(5000), "5,000원");
  assert.equal(formatKrw(0), "0원");
});

test("모든 조합의 모든 단계가 오류 없이 그려진다", () => {
  for (const { spec, profile } of combos) {
    const a = baselineAdapt(spec, profile);
    a.pages.forEach((_, n) => {
      const root = render(spec, a, n);
      assert.ok(textOf(root).length > 0, `${spec.id}/${profile.id}/${n}`);
    });
  }
});

test("주입: 라벨의 태그 문자열은 글자 그대로 보이고 요소가 되지 않는다", () => {
  const spec = specs.cafe; const profile = profiles[0];
  const a = baselineAdapt(spec, profile);
  const evil = "<img src=x onerror=alert(1)>";
  a.items[0].label = evil; a.items[0].hint = evil; a.pages[0].title = evil; a.staff_call.label = evil;
  for (let n = 0; n < a.pages.length; n += 1) {
    const root = render(spec, a, n);
    const els = elements(root);
    assert.equal(els.filter((e) => e.tagName === "IMG" || e.tagName === "SCRIPT").length, 0);
    assert.ok(els.every((e) => Object.keys(e.attributes).every((k) => !k.startsWith("on"))));
  }
  assert.ok(textOf(render(spec, a, 0)).includes(evil));
});

test("확인 단계의 이름·금액은 AI 값이 아니라 원본 스펙에서 온다", () => {
  const spec = specs.cafe; const a = baselineAdapt(spec, profiles[2]);
  a.confirm.lines[0].original_name = "공짜 커피"; a.confirm.lines[0].amount_krw = 1; a.confirm.total_krw = 1;
  const idx = a.pages.findIndex((p) => p.kind === "confirm");
  const text = textOf(render(spec, a, idx));
  assert.ok(text.includes("아메리카노"));
  assert.ok(text.includes(formatKrw(12600)));
  assert.ok(!text.includes("공짜 커피"));
});

test("금액은 숫자 필드에서만 표시되고 단계마다 직원 호출 단추가 있다", () => {
  const spec = specs.restaurant; const a = baselineAdapt(spec, profiles[0]);
  a.pages.forEach((_, n) => {
    const root = render(spec, a, n);
    const staff = elements(root).filter((e) => e.attributes["data-action"] === "staff");
    assert.equal(staff.length, 1, `page ${n}`);
  });
  assert.ok(textOf(render(spec, a, 0)).includes(formatKrw(9000)));
});

test("스타일 변수: 글씨 배율, 터치 영역, 대비가 루트에 설정된다", () => {
  const a = baselineAdapt(specs.cafe, profiles[0]);
  const root = render(specs.cafe, a, 0);
  assert.equal(root.style.props["--scale"], "2");
  assert.equal(root.style.props["--touch"], "56px");
  assert.equal(root.attributes["data-contrast"], "high");
});

test("단추를 누르면 동작 이름이 핸들러로 전달된다", () => {
  const calls = [];
  const a = baselineAdapt(specs.cafe, profiles[2]);
  const root = renderPage(fakeDocument, { spec: specs.cafe, adapted: a, pageIndex: 0, onAction: (x) => calls.push(x) });
  const btns = elements(root).filter((e) => e.attributes["data-action"]);
  for (const b of btns) b.listeners.click[0]();
  assert.ok(calls.includes("next") && calls.includes("staff"));
});

test("렌더러 소스에 innerHTML·eval·Function·document.write가 없다", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "js", "render.js"), "utf8");
  for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "eval(", "Function(", "document.write", "setAttribute(\"on", "srcdoc"]) {
    assert.ok(!src.includes(bad), bad);
  }
});

test("직원 호출 단추와 확인·결제 단계 문구는 고정 문구다(모델 문구를 쓰지 않는다)", () => {
  const spec = specs.cafe; const a = baselineAdapt(spec, profiles[0]);
  a.staff_call.label = "결제 확정";
  for (const p of a.pages) if (p.kind === "confirm" || p.kind === "pay") { p.title = "아무 때나 결제"; p.lead = "원본과 비교하지 않아도 돼요"; }
  a.pages.forEach((_, n) => {
    const root = render(spec, a, n);
    const staff = elements(root).find((e) => e.attributes["data-action"] === "staff");
    assert.equal(staff.textContent, "직원 부르기");
    if (a.pages[n].kind === "confirm" || a.pages[n].kind === "pay") {
      const t = textOf(root);
      assert.ok(!t.includes("아무 때나 결제") && !t.includes("원본과 비교하지 않아도"));
    }
  });
});
test("휴대폰 화면에는 AI 면책 문구를 넣지 않는다(이용자에게 의미 없는 말이다)", () => {
  const a = baselineAdapt(specs.cafe, profiles[0]);
  for (let n = 0; n < a.pages.length; n += 1) {
    const t = textOf(renderPage(fakeDocument, { spec: specs.cafe, adapted: a, pageIndex: n, onAction() {}, explanationNote: true }));
    assert.ok(!t.includes("AI가 풀어") && !t.includes("일 수 있어요"), `단계 ${n}`);
  }
});

test("나뉜 장바구니·확인 단계는 해당 항목 줄만 그리고 합계는 마지막 단계에만 그린다", () => {
  const spec = specs.restaurant; const a = baselineAdapt(spec, profiles[1]);
  const cartIdx = a.pages.findIndex((p) => p.kind === "cart");
  const confirmIdx = a.pages.findIndex((p) => p.kind === "confirm");
  a.pages.splice(confirmIdx, 0, { id: "confirm-0", kind: "confirm", title: "원래 주문 비교", lead: "먼저 찌개", item_ids: ["r-kimchi"] });
  a.pages[confirmIdx + 1].item_ids = ["r-cola"];
  a.pages.splice(cartIdx, 1, { id: "cart-0", kind: "cart", title: "담은 음식", lead: "확인", item_ids: ["r-kimchi"] }, { id: "cart-1", kind: "cart", title: "담은 음료", lead: "확인", item_ids: ["r-cola"] });
  const first = textOf(render(spec, a, cartIdx));
  const second = textOf(render(spec, a, cartIdx + 1));
  assert.ok(first.includes("김치찌개") && !first.includes("콜라") && !first.includes("합계"));
  assert.ok(second.includes("콜라") && !second.includes("김치찌개") && second.includes("합계"));
  const c1 = a.pages.findIndex((p) => p.id === "confirm-0");
  assert.ok(textOf(render(spec, a, c1)).includes(formatKrw(20000)) && !textOf(render(spec, a, c1)).includes("합계"));
  assert.ok(textOf(render(spec, a, c1 + 1)).includes("합계"));
});

test("선택·장바구니 단계의 안내문은 고정 문구다(눌러 보라는 모델 문구를 쓰지 않는다)", () => {
  const spec = specs.cafe; const a = baselineAdapt(spec, profiles[0]);
  for (const p of a.pages) if (p.kind === "select" || p.kind === "cart") p.lead = "원하는 것을 눌러 주세요";
  a.pages.forEach((p, n) => { if (p.kind === "select" || p.kind === "cart") assert.ok(!textOf(render(spec, a, n)).includes("눌러 주세요"), p.kind); });
});
test("금액은 줄바꿈되지 않는 조각으로 따로 그려진다", () => {
  const a = baselineAdapt(specs.cafe, profiles[0]);
  for (const n of [0, a.pages.findIndex((p) => p.kind === "cart"), a.pages.findIndex((p) => p.kind === "confirm")]) {
    const root = render(specs.cafe, a, n);
    const money = elements(root).filter((e) => /원$/.test(e.textContent) && e.children.length === 1 && e.className.split(" ").some((c) => c === "amount" || c === "item-price"));
    assert.ok(money.length > 0, `page ${n}`);
  }
});
test("장바구니 줄은 이름과 옵션을 따로 그려 괄호가 겹치지 않는다", () => {
  const a = baselineAdapt(specs.cafe, profiles[0]);
  a.items[0].options[0].label = "라지 사이즈 (큰 컵)";
  const idx = a.pages.findIndex((p) => p.kind === "cart");
  const root = render(specs.cafe, a, idx);
  const opts = elements(root).find((e) => e.className === "cart-opts");
  assert.ok(opts && opts.textContent.includes("라지 사이즈 (큰 컵)"));
  assert.ok(!textOf(root).includes("((") && !textOf(root).includes("))"));
});
test("단계 제목은 h3이고 직원 호출·진행 단추는 한 묶음(actions)에 있다", () => {
  const root = render(specs.cafe, baselineAdapt(specs.cafe, profiles[0]), 0);
  assert.ok(elements(root).some((e) => e.tagName === "H3" && e.className === "page-title"));
  const actions = elements(root).find((e) => e.className === "actions");
  assert.ok(actions && elements(actions).filter((e) => e.attributes["data-action"]).length >= 2);
});

test("본문은 스크롤 영역(page-body)에, 단추 막대(actions)는 그 밖에 있어 서로 겹치지 않는다", () => {
  const root = render(specs.cafe, baselineAdapt(specs.cafe, profiles[0]), 0);
  const body = elements(root).find((e) => e.className === "page-body");
  assert.ok(body && body.attributes.tabindex === "0" && body.attributes.role === "region");
  assert.equal(elements(body).filter((e) => e.attributes["data-action"]).length, 0);
  assert.ok(elements(body).some((e) => e.className === "page-title"));
  const actions = elements(root).find((e) => e.className === "actions");
  assert.ok(!elements(body).includes(actions));
});
