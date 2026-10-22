import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateAdapted } from "../app/js/validator.js";
import { specs, profiles, combos } from "./fixtures.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "precomputed");
const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));

test("체험 모드 출력이 9조합 모두 있고 각각 검증기를 다시 통과한다", () => {
  assert.equal(index.entries.length, combos.length);
  for (const { spec, profile } of combos) {
    const name = `${spec.id}-${profile.id}`;
    assert.ok(index.entries.includes(name), name);
    const rec = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
    assert.deepEqual(validateAdapted(specs[spec.id], profile, rec.raw).errors, [], name);
    assert.equal(rec.meta.verdict, "validator-pass");
    assert.ok(rec.meta.model && rec.meta.date && /^[0-9a-f]{64}$/.test(rec.meta.prompt_sha256), name);
  }
});
test("저장된 출력은 키 문자열이나 개인정보 패턴을 담지 않는다", () => {
  for (const name of index.entries) {
    const text = readFileSync(join(dir, `${name}.json`), "utf8");
    assert.ok(!/sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|[0-9]{6}-[0-9]{7}|@[a-z0-9.-]+\.[a-z]{2,}/i.test(text), name);
  }
});
