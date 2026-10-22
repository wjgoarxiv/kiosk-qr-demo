// Writes the prompt and output schema for every demo combination so the model runner and the browser share one prompt source.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { buildPrompt } from "../app/js/prompt.js";
import { adaptedJsonSchema } from "./adapted_schema.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, "app", "data", p), "utf8"));
const out = process.argv[2];
if (!out) { console.error("usage: node emit_prompts.mjs <out.json>"); process.exit(64); }

const specs = ["cafe", "restaurant", "clinic"].map((id) => read(`specs/${id}.json`));
const profiles = read("profiles.json").profiles;
const combos = [];
for (const spec of specs) for (const profile of profiles) {
  const { system, user } = buildPrompt(spec, profile);
  combos.push({ key: `${spec.id}/${profile.id}`, spec_id: spec.id, profile_id: profile.id, prompt: `${system}\n\n${user}`, prompt_sha256: createHash("sha256").update(`${system}\n${user}`).digest("hex") });
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ schema: adaptedJsonSchema(), combos }, null, 1));
console.log(JSON.stringify({ out, combos: combos.length }));
