export const RULES = [
  { id: "ids", label: "항목·옵션 목록이 원본과 같다", codes: ["E_ID_SET"] },
  { id: "names", label: "표시 이름에 원래 이름이 들어 있다", codes: ["E_LABEL"] },
  { id: "price", label: "가격과 옵션 차액이 원본과 같다", codes: ["E_PRICE"] },
  { id: "cart", label: "수량·합계를 다시 계산해도 같다", codes: ["E_CART"] },
  { id: "promo", label: "금액, 숫자, 할인, 무료 문구가 없다", codes: ["E_PROMO"] },
  { id: "confirm", label: "확인 단계가 원본 이름·금액 그대로다", codes: ["E_CONFIRM"] },
  { id: "safe", label: "허용 필드만 쓰고 HTML, 주소, 지시문이 없다", codes: ["E_SCHEMA", "E_UNSAFE_TEXT"] },
  { id: "length", label: "글자 수·단계 수 상한을 지킨다", codes: ["E_LENGTH"] },
  { id: "profile", label: "내 방식(글씨, 대비, 버튼 크기)을 지킨다", codes: ["E_PROFILE"] },
  { id: "flow", label: "장바구니 → 원문 확인 → 결제 순서다", codes: ["E_FLOW"] },
];

export const ERROR_TEXT = {
  E_SCHEMA: "허용되지 않은 구조나 값이 있어요",
  E_LENGTH: "글자 수 또는 단계 수가 상한을 넘었어요",
  E_UNSAFE_TEXT: "AI에게 시키는 말이나 주소 같은 수상한 문구가 있어요",
  E_PROMO: "금액, 숫자, 할인·무료 같은 문구가 있어요",
  E_LABEL: "표시 이름에 원래 이름이 들어 있지 않아요",
  E_ID_SET: "메뉴나 옵션이 더해졌거나 빠졌어요",
  E_PRICE: "가격이 원본과 달라요",
  E_CART: "수량이나 합계가 원본 주문과 달라요",
  E_CONFIRM: "확인 단계의 이름이나 금액이 원본과 달라요",
  E_PROFILE: "내 방식에 맞는 글씨·대비·버튼 크기가 아니에요",
  E_FLOW: "단계 순서나 항목 표시가 맞지 않아요",
};

export const REASON_TEXT = {
  validation: "AI 출력이 불변 검증을 통과하지 못해 버렸어요",
  parse: "AI 응답을 JSON으로 읽지 못했어요",
  too_large: "AI 응답이 너무 커서 버렸어요",
  timeout: "AI 응답이 제때 오지 않았어요",
  key: "공급자가 키를 받아들이지 않았어요",
  rate_limit: "공급자의 요청 한도에 걸렸어요",
  http: "공급자가 오류를 돌려줬어요",
  network: "공급자에 연결하지 못했어요",
  config: "키나 모델 이름이 올바르지 않아요",
  bad_body: "공급자 응답 형식을 읽지 못했어요",
  missing: "이 조합은 미리 만든 AI 출력이 없어요",
  no_provider: "AI 없이 규칙으로만 변환했어요",
  provider_error: "공급자에서 예상 밖 오류가 났어요",
  aborted: "요청이 취소됐어요",
  bad_input: "입력 화면 정보가 올바르지 않아요",
};

// The line under the phone when the AI screen was not used: it names the real reason.
export function fallbackStatus(code) {
  if (code === "validation") return "AI 화면이 키오스크와 달라서 버리고, 기본 화면을 보여 줘요.";
  if (code === "missing") return "이 조합은 미리 만든 AI 화면이 없어서 기본 화면을 보여 줘요.";
  return "AI 응답을 받지 못해서 기본 화면을 보여 줘요.";
}
