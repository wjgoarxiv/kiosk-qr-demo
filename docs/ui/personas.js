// What the visitor sees for each profile. The profile objects (and their labels) go to the model unchanged;
// these names exist only in the page, so stored model outputs keep their provenance.
export const PERSONAS = {
  "p-large-voice": { label: "글씨가 작아서 안 보여요", help: "큰 글씨, 진한 색, 소리로 읽어 주기" },
  "p-easy-one": { label: "한꺼번에 많으면 헷갈려요", help: "쉬운 말로, 한 번에 하나씩" },
  "p-big-safe": { label: "잘못 누를까 봐 걱정돼요", help: "큰 버튼, 천천히, 결제 전에 다시 확인" },
};

export const SPEC_LABEL = { cafe: "카페", restaurant: "식당", clinic: "병원 접수" };
