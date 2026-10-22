// Runs one raw model reply through the same adaptScreen path the browser uses; optionally stores it as a precomputed output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptScreen } from "../app/js/adapt.js";
import { createPrecomputedProvider } from "../app/js/providers/precomputed.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, "app", "data", p), "utf8"));
const [rawPath, specId, profileId, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
if (!rawPath || !specId || !profileId) { console.error("usage: node check_raw.mjs <raw.txt> <spec> <profile> [--store dir --model m --date d --retries n]"); process.exit(64); }

const spec = read(`specs/${specId}.json`);
const profile = read("profiles.json").profiles.find((p) => p.id === profileId);
const raw = readFileSync(rawPath, "utf8");
const provider = createPrecomputedProvider({ [`${spec.id}/${profile.id}`]: { raw, meta: { model: flag("--model") ?? "unknown" } } });
const res = await adaptScreen({ spec, profile, provider });
const summary = { source: res.source, reason: res.reason ? { code: res.reason.code, errors: (res.reason.errors ?? []).map((e) => e.code) } : null };
if (res.source === "ai" && flag("--store")) {
  const dir = flag("--store");
  mkdirSync(dir, { recursive: true });
  const record = { raw: res.adapted, meta: { model: flag("--model"), date: flag("--date"), prompt_sha256: res.meta.promptHash, retries: Number(flag("--retries") ?? 0), verdict: "validator-pass" } };
  writeFileSync(join(dir, `${spec.id}-${profile.id}.json`), `${JSON.stringify(record, null, 1)}\n`);
}
console.log(JSON.stringify(summary));
process.exit(res.source === "ai" ? 0 : 3);
