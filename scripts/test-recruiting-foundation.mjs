import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  eventDefinitions,
  parseMark,
  resolveEvent,
  starRatingForScore
} = await import("../lib/recruiting_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

const migration = await read(
  "install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql"
);
const publicApi = await read("api/recruiting/index.js");
const adminApi = await read("api/admin/recruiting.js");
const buildScript = await read("scripts/build.mjs");
const publicPage = await read("src/pages/recruiting.mjs");
const methodologyPage = await read("src/pages/recruitingmethodology.mjs");
const template = await read("public/data/performance-import-template.csv");
const operationsApi = await read("api/admin/operations.js");

includesAll(
  migration,
  [
    "create table if not exists public.athlete_event_catalog",
    "create table if not exists public.athlete_event_aliases",
    "create table if not exists public.athlete_recruit_rating_methodologies",
    "create table if not exists public.athlete_recruit_ratings",
    "create table if not exists public.athlete_recruiting_activity",
    "create table if not exists public.athlete_performance_import_batches",
    "create table if not exists public.athlete_performance_import_rows",
    "create or replace view public.athlete_best_performances",
    "create or replace view public.athlete_published_recruit_ratings"
  ],
  "Migration"
);

includesAll(
  migration,
  [
    "'distance'",
    "'sprints'",
    "'hurdles'",
    "'jumps'",
    "'pole_vault'",
    "'throws'",
    "'multis'"
  ],
  "Event group catalog"
);

includesAll(
  migration,
  [
    "when new.rating_score >= 95 then 5",
    "when new.rating_score >= 90 then 4",
    "when new.rating_score >= 84 then 3",
    "when new.rating_score >= 78 then 2",
    "RECRUIT_RATING_VERIFIED_PERFORMANCE_REQUIRED",
    "RECRUIT_RATING_EVALUATION_REQUIRED",
    "RECRUIT_RATING_DATA_CUTOFF_REQUIRED",
    "performance.event_group = new.event_group",
    "performance.source_type in ('official', 'supplied_reference')",
    "performance.source_type = 'community'"
  ],
  "Rating publication guard"
);

includesAll(
  migration,
  [
    "enable row level security",
    "revoke all on table public.athlete_recruit_ratings from anon, authenticated",
    "grant all on table public.athlete_recruit_ratings to service_role"
  ],
  "Database security"
);

assert.ok(
  !/insert\s+into\s+public\.athlete_recruit_ratings\s*\(/i.test(migration),
  "Migration must not invent or seed athlete ratings."
);

const aliasMatches = [...migration.matchAll(
  /\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g
)].map((match) => match[3]);
const duplicateAliases = aliasMatches.filter(
  (value, index) => aliasMatches.indexOf(value) !== index
);
assert.deepEqual(
  duplicateAliases,
  [],
  "Event alias seed must not contain duplicate normalized aliases."
);

assert.equal(starRatingForScore(100), 5);
assert.equal(starRatingForScore(95), 5);
assert.equal(starRatingForScore(94.99), 4);
assert.equal(starRatingForScore(90), 4);
assert.equal(starRatingForScore(89.99), 3);
assert.equal(starRatingForScore(84), 3);
assert.equal(starRatingForScore(83.99), 2);
assert.equal(starRatingForScore(78), 2);
assert.equal(starRatingForScore(77.99), 1);
assert.equal(starRatingForScore(70), 1);
assert.equal(starRatingForScore(69.99), null);

const track3200 = resolveEvent("3200m", "outdoor_track");
const poleVault = resolveEvent("PV", "outdoor_track");
const highJump = resolveEvent("High Jump", "outdoor_track");
const crossCountry5K = resolveEvent("5K", "cross_country");
const crossCountry5000 = resolveEvent("5000", "cross_country");
const crossCountryTwoMile = resolveEvent("2 Mile", "cross_country");
const crossCountry3200 = resolveEvent("3200m", "cross_country");

assert.equal(track3200?.event_key, "track_3200");
assert.equal(poleVault?.event_key, "pole_vault");
assert.equal(highJump?.event_key, "high_jump");
assert.equal(crossCountry5K?.event_key, "xc_5k");
assert.equal(crossCountry5000?.event_key, "xc_5k");
assert.equal(crossCountryTwoMile?.event_key, "xc_2_mile");
assert.equal(crossCountry3200?.event_key, "xc_3200");

assert.equal(parseMark("9:45", track3200).mark_sort_value, 585);
assert.equal(parseMark("15:45.20", crossCountry5K).mark_sort_value, 945.2);
assert.equal(parseMark("14-6", poleVault).mark_sort_value, 4.4196);
assert.equal(parseMark("6'4\"", highJump).mark_sort_value, 1.9304);
assert.equal(parseMark("9:75", track3200).valid, false);
assert.equal(parseMark("6'12\"", highJump).valid, false);

assert.ok(eventDefinitions().length >= 30, "Expected a complete event catalog.");

includesAll(
  buildScript,
  [
    'writePage("/recruiting/"',
    'writePage("/recruiting/methodology/"',
    'writePage("/admin/recruiting/"',
    'href: "/recruiting/"'
  ],
  "Static build"
);

includesAll(
  publicPage,
  [
    "Performance first. No pay to play.",
    "Recruiter search",
    "Top verified mark",
    "data-recruiting-event-filter",
    "/recruiting/methodology/"
  ],
  "Recruiting page"
);

includesAll(
  methodologyPage,
  [
    'aria-label="Five stars"',
    'aria-label="Four stars"',
    'aria-label="Three stars"',
    'aria-label="Two stars"',
    'aria-label="One star"',
    "No athlete, family, coach, school, sponsor, or recruiting service can buy a rating.",
    "Offers are tracked separately and do not determine the performance based evaluation."
  ],
  "Methodology page"
);

assert.ok(
  adminApi.includes('isAdminRequest(request)'),
  "Recruiting admin API must require admin authentication."
);
assert.ok(
  adminApi.includes("previewPerformanceImport") &&
    adminApi.includes("commitPerformanceImport"),
  "Recruiting admin API must use preview first imports."
);
assert.ok(
  adminApi.includes("performance.event_group === eventGroup"),
  "Published rating evidence must match the selected event group."
);
assert.ok(
  adminApi.includes('["official", "supplied_reference"]') &&
    adminApi.includes('performance.source_type === "community"'),
  "Published rating evidence must exclude editorial performance context."
);

for (const sensitiveField of [
  "personal_email",
  "phone_number",
  "home_address",
  "guardian_email",
  "private_email"
]) {
  assert.ok(
    !publicApi.includes(sensitiveField),
    `Public recruiting API must not expose ${sensitiveField}.`
  );
}

includesAll(
  template,
  [
    "athlete_name",
    "school_name",
    "gender",
    "graduation_year",
    "sport",
    "season_year",
    "event_name",
    "mark_text",
    "source_label",
    "source_url"
  ],
  "CSV template"
);

includesAll(
  operationsApi,
  [
    "athlete_recruit_performances",
    "athlete_recruit_ratings_published",
    "athlete_recruit_ratings_draft",
    "athlete_performance_import_failures",
    'href: "/admin/recruiting/"'
  ],
  "Operations Center integration"
);

console.log("Recruit Ratings and Performance History validation passed.");
console.log(`Event definitions checked: ${eventDefinitions().length}`);
console.log("Star boundaries checked: 70 through 100");
console.log("Performance parsing checked: time, distance, and height");
console.log("Privacy, admin authentication, migration security, and build routes checked");
