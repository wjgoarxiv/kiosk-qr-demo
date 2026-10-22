import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { enumerateScripts } from "../app/js/speak.js";
import { specs, profiles } from "./fixtures.mjs";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const precomputed = Object.fromEntries(
  ["cafe", "restaurant", "clinic"].flatMap((s) => profiles.map((p) => [`${s}/${p.id}`, JSON.parse(readFileSync(join(appDir, "data/precomputed", `${s}-${p.id}.json`), "utf8")).raw])),
);

test("미리 만든 목소리 파일이 현재 낭독문 전부를 덮고 파일이 실제로 있다(글을 바꾸면 이 시험이 깨진다)", async () => {
  const indexPath = join(appDir, "audio", "index.json");
  assert.ok(existsSync(indexPath), "app/audio/index.json 이 없다");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  assert.equal(typeof index.voice?.engine, "string");
  const all = await enumerateScripts({ specs, precomputed });
  const missing = all.filter((s) => !index.clips[s.key]);
  assert.deepEqual(missing.map((s) => s.text.slice(0, 40)), [], "목소리 파일이 없는 낭독문");
  for (const [key, clip] of Object.entries(index.clips)) {
    const f = join(appDir, "audio", clip.file);
    assert.ok(existsSync(f) && statSync(f).size === clip.bytes, `${key} 파일`);
  }
});
