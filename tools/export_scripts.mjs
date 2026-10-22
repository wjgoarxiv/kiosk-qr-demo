// Writes every script the phone can read aloud (key + text) so the voice files can be recorded for exactly these.
// Usage: node tools/export_scripts.mjs <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enumerateScripts } from "../app/js/speak.js";

const app = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const read = (p) => JSON.parse(readFileSync(join(app, "data", p), "utf8"));
const out = process.argv[2];
if (!out) { console.error("usage: node export_scripts.mjs <out.json>"); process.exit(64); }
const specs = Object.fromEntries(["cafe", "restaurant", "clinic"].map((id) => [id, read(`specs/${id}.json`)]));
const profiles = read("profiles.json").profiles;
const precomputed = Object.fromEntries(["cafe", "restaurant", "clinic"].flatMap((s) => profiles.map((p) => [`${s}/${p.id}`, read(`precomputed/${s}-${p.id}.json`).raw])));
const all = await enumerateScripts({ specs, precomputed });
const unique = [...new Map(all.map((s) => [s.key, { key: s.key, text: s.text }])).values()];
writeFileSync(out, `${JSON.stringify(unique, null, 1)}\n`);
console.log(JSON.stringify({ pages: all.length, unique: unique.length, chars: unique.reduce((n, s) => n + s.text.length, 0) }));
