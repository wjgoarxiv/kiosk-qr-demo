import { ProviderError } from "./errors.js";

// Serves pre-generated real model outputs; store keys are "<spec id>/<profile id>".
export function createPrecomputedProvider(store) {
  return {
    id: "precomputed",
    async adapt(spec, profile) {
      const hit = store[`${spec.id}/${profile.id}`];
      if (!hit) throw new ProviderError("missing", "미리 만든 출력이 없음");
      return { raw: hit.raw, meta: { ...hit.meta, provider: "precomputed" } };
    },
  };
}
