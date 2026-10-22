// Re-judges stored model replies with the current validator (no model calls).
// Usage: node tools/revalidate.mjs <raw dir named <spec>__<profile>__tryN.txt> [out.json]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptScreen } from "../app/js/adapt.js";
import { validateAdapted } from "../app/js/validator.js";
import { createPrecomputedProvider } from "../app/js/providers/precomputed.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, "app", "data", p), "utf8"));
const [rawDir, outPath] = process.argv.slice(2);
if (!rawDir) { console.error("usage: node revalidate.mjs <raw dir> [out.json]"); process.exit(64); }
const profiles = read("profiles.json").profiles;

const stored = [];
for (const [specId, profile] of ["cafe", "restaurant", "clinic"].flatMap((s) => profiles.map((p) => [s, p]))) {
  const spec = read(`specs/${specId}.json`);
  const record = read(`precomputed/${specId}-${profile.id}.json`);
  const v = validateAdapted(spec, profile, record.raw);
  stored.push({ combo: `${specId}/${profile.id}`, ok: v.ok, errors: v.errors.map((e) => e.code) });
}

const replies = [];
for (const name of readdirSync(rawDir).filter((n) => n.endsWith(".txt")).sort()) {
  const [specId, profileId] = name.split("__");
  const spec = read(`specs/${specId}.json`);
  const profile = profiles.find((p) => p.id === profileId);
  const res = await adaptScreen({ spec, profile, provider: createPrecomputedProvider({ [`${spec.id}/${profile.id}`]: { raw: readFileSync(join(rawDir, name), "utf8"), meta: { model: "stored" } } }) });
  replies.push({ file: name, source: res.source, reason: res.reason ? { code: res.reason.code, errors: (res.reason.errors ?? []).map((e) => e.code) } : null });
}
const summary = {
  stored_precomputed: { total: stored.length, ok: stored.filter((s) => s.ok).length, rejected: stored.filter((s) => !s.ok) },
  raw_replies: { total: replies.length, adopted: replies.filter((r) => r.source === "ai").length, rejected: replies.filter((r) => r.source !== "ai") },
};
if (outPath) writeFileSync(outPath, `${JSON.stringify(summary, null, 1)}\n`);
console.log(JSON.stringify({ stored: `${summary.stored_precomputed.ok}/${summary.stored_precomputed.total}`, raw: `${summary.raw_replies.adopted}/${summary.raw_replies.total}`, rejected_raw: summary.raw_replies.rejected }));
