import { createByokProvider } from "../js/providers/byok.js";

// Holds a visitor's API key in memory only: read once from the field, then the field is emptied.
// forget() drops the key without touching the screen; clear() also tells the page the key is gone.
export function initKeyPanel({ providers, onReady, onCleared }) {
  const form = document.getElementById("key-form");
  const select = document.getElementById("key-provider");
  const model = document.getElementById("key-model");
  const value = document.getElementById("key-value");
  const state = document.getElementById("key-state");
  let provider = null;

  for (const p of providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    select.append(opt);
  }
  const syncModel = () => {
    const entry = providers.find((p) => p.id === select.value);
    model.value = entry.default_model;
    model.placeholder = entry.default_model ? "" : "사용할 모델 이름을 적어 주세요";
  };
  select.addEventListener("change", syncModel);
  syncModel();

  const forget = (message) => {
    provider = null;
    value.value = "";
    state.textContent = message;
  };
  const clear = () => {
    forget("키를 지웠어요.");
    onCleared();
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const entry = providers.find((p) => p.id === select.value);
    const key = value.value.trim();
    value.value = "";
    if (!key) { state.textContent = "키를 먼저 넣어 주세요."; value.focus(); return; }
    provider = createByokProvider({ entry, apiKey: key, model: model.value });
    state.textContent = `${entry.label} 키가 이 탭의 메모리에 있어요. 지우려면 '키 지우기'를 누르세요.`;
    onReady(provider);
  });
  document.getElementById("key-clear").addEventListener("click", clear);
  window.addEventListener("pagehide", () => { forget(""); onCleared(); });
  return { forget, clear };
}
