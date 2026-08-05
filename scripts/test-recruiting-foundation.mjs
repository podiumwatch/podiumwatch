import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const {
  EVENT_GROUPS,
  eventDefinitions,
  loadLatestRankSnapshots,
  normalizePerformanceImportRow,
  parseMark,
  performanceDuplicateKey,
  recordRecruitRatingRankSnapshots,
  resolveEvent,
  starRatingForScore,
  validatePerformanceImportRow
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
const taxonomyMigration = await read(
  "install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql"
);
const publicApi = await read("api/recruiting/index.js");
const adminApi = await read("api/admin/recruiting.js");
const buildScript = await read("scripts/build.mjs");
const publicPage = await read("src/pages/recruiting.mjs");
const methodologyPage = await read("src/pages/recruitingmethodology.mjs");
const adminPage = await read("src/pages/adminrecruiting.mjs");
const siteScript = await read("public/scripts/site.js");
const mainStyles = await read("src/styles/main.css");
const packageFile = await read("package.json");
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

const safeImportDefaults = {
  gender: "girls",
  sport: "cross_country",
  season_year: 2025,
  event_name: "5K",
  meet_name: "OHSAA State Championship",
  meet_date: "2025-11-01",
  source_label: "Official results",
  source_url: "https://example.com/results",
  source_type: "official",
  verification_status: "source_linked"
};
const normalizedImport = normalizePerformanceImportRow({
  athlete_name: "Example Athlete",
  school_name: "Example High School",
  gender: "",
  graduation_year: 2027,
  sport: "",
  season_year: "",
  event_name: "",
  mark_text: "18:45.20",
  meet_name: "",
  meet_date: "",
  place: "12",
  source_label: "",
  source_url: "",
  source_type: "",
  verification_status: "",
  public_visible: "true"
}, 0, safeImportDefaults);

assert.equal(normalizedImport.gender, "girls");
assert.equal(normalizedImport.event_key, "xc_5k");
assert.equal(normalizedImport.meet_name, safeImportDefaults.meet_name);
assert.equal(normalizedImport.meet_date, safeImportDefaults.meet_date);
assert.equal(normalizedImport.place, 12);
assert.equal(normalizedImport.public_visible, false);
assert.deepEqual(validatePerformanceImportRow(normalizedImport), []);

const incompleteImport = normalizePerformanceImportRow({
  athlete_name: "Example Athlete",
  school_name: "Example High School",
  gender: "boys",
  graduation_year: 2027,
  sport: "cross_country",
  season_year: 2025,
  event_name: "5K",
  mark_text: "16:00",
  source_label: "Official results"
}, 0);
const incompleteErrors = validatePerformanceImportRow(incompleteImport);

includesAll(
  incompleteErrors.join(" "),
  [
    "Meet name is required.",
    "Meet date is required.",
    "Place is required."
  ],
  "Required performance import fields"
);

const duplicateBase = {
  profile_id: "profile-1",
  school_id: "school-1",
  event_key: "xc_5k",
  mark_text: "16:00.00",
  meet_name: "State Championship",
  meet_date: "2025-11-01",
  place: 5
};

assert.equal(
  performanceDuplicateKey({
    ...duplicateBase,
    source_label: "Source A",
    source_url: "https://example.com/a"
  }),
  performanceDuplicateKey({
    ...duplicateBase,
    source_label: "Source B",
    source_url: "https://example.com/b"
  })
);
assert.notEqual(
  performanceDuplicateKey(duplicateBase),
  performanceDuplicateKey({ ...duplicateBase, place: 6 })
);

assert.ok(eventDefinitions().length >= 30, "Expected a complete event catalog.");

// Phase Two: nine group taxonomy (Cross Country, Distance, Middle Distance,
// Sprints, Hurdles, Jumps, Pole Vault, Throws, Combined Events) plus an
// "other" fallback, approved 2026-08-04.
assert.deepEqual(
  [...EVENT_GROUPS].sort(),
  [
    "combined_events",
    "cross_country",
    "distance",
    "hurdles",
    "jumps",
    "middle_distance",
    "other",
    "pole_vault",
    "sprints",
    "throws"
  ],
  "Event group taxonomy must match the approved Phase One architecture decision."
);

const eventGroupByKey = new Map(
  eventDefinitions().map((event) => [event.event_key, event.event_group])
);
assert.equal(eventGroupByKey.get("xc_5k"), "cross_country");
assert.equal(eventGroupByKey.get("xc_2_mile"), "cross_country");
assert.equal(eventGroupByKey.get("track_800"), "middle_distance");
assert.equal(eventGroupByKey.get("track_1600"), "middle_distance");
assert.equal(eventGroupByKey.get("track_mile"), "middle_distance");
assert.equal(eventGroupByKey.get("track_600"), "sprints");
assert.equal(eventGroupByKey.get("track_3200"), "distance");
assert.equal(eventGroupByKey.get("track_5000"), "distance");
assert.equal(eventGroupByKey.get("decathlon"), "combined_events");
assert.equal(eventGroupByKey.get("heptathlon"), "combined_events");
assert.ok(
  ![...eventGroupByKey.values()].includes("multis"),
  "No event should remain assigned to the retired 'multis' group."
);

assert.equal(typeof recordRecruitRatingRankSnapshots, "function");
assert.equal(typeof loadLatestRankSnapshots, "function");

includesAll(
  taxonomyMigration,
  [
    "'cross_country'",
    "'middle_distance'",
    "'combined_events'",
    "podium-watch-recruit-ratings-2026-2",
    "status = 'retired'",
    "create table if not exists public.athlete_content_items",
    "create table if not exists public.athlete_recruit_rating_rank_snapshots",
    "enable row level security",
    "grant all on table public.athlete_content_items to service_role",
    "grant all on table public.athlete_recruit_rating_rank_snapshots to service_role"
  ],
  "Recruiting taxonomy and media migration"
);
assert.ok(
  !/insert\s+into\s+public\.athlete_content_items\s*\(/i.test(taxonomyMigration),
  "Migration must not invent or seed athlete media."
);

includesAll(
  adminApi,
  [
    "save_content_item",
    "archive_content_item",
    "preview_public_profile",
    "recordRecruitRatingRankSnapshots",
    "CONTENT_ITEM_TYPES",
    "PERFORMANCE_SOURCE_TYPES"
  ],
  "Recruiting admin API media and preview actions"
);
assert.ok(
  adminApi.includes("cannot be shown until it is published"),
  "Preview action must explain why a draft rating has no public rank yet."
);

includesAll(
  adminPage,
  [
    "cross_country",
    "middle_distance",
    "combined_events",
    "data-recruit-content-form",
    "data-recruit-preview-button",
    "data-recruit-preview-panel"
  ],
  "Recruiting admin page media and preview markup"
);

includesAll(
  publicPage,
  [
    "cross_country",
    "middle_distance",
    "combined_events"
  ],
  "Public recruiting directory event group filters"
);

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
includesAll(
  adminApi,
  [
    "gender: cleanAthleteText(body.gender",
    "event_name: cleanAthleteText(body.event_name",
    "meet_name: cleanAthleteText(body.meet_name",
    "meet_date: cleanAthleteText(body.meet_date"
  ],
  "Performance import defaults"
);
assert.ok(
  !adminPage.includes('name="create_unmatched"'),
  "Recruiting admin must not offer to create public athletes from unmatched rows."
);
includesAll(
  adminPage,
  [
    "Every imported performance is saved hidden until you approve it for publication.",
    "Unmatched rows are never saved and never create athlete profiles."
  ],
  "Performance import safety explanation"
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

assert.ok(
  siteScript.includes('window.matchMedia("(max-width: 1320px)")'),
  "Navigation behavior and responsive menu CSS must use the same breakpoint."
);
includesAll(
  mainStyles,
  [
    ".sports-ticker { display:none; }",
    ".site-nav { top:98px; width:min(92vw,390px); height:calc(100dvh - 98px); }",
    ".nav-overlay { inset:98px 0 0; }",
    ".section-nav { display:block; position:relative; }"
  ],
  "Responsive header cleanup"
);
includesAll(
  packageFile,
  [
    '"test:athletes": "node scripts/test-athlete-foundation.mjs"',
    '"test:recruiting": "node scripts/test-recruiting-foundation.mjs"',
    'npm run test:athletes && npm run test:recruiting && npm run test:results'
  ],
  "Complete test command"
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
console.log("Performance import safety checked: required fields, defaults, hidden records, and duplicates");
console.log("Responsive header breakpoints checked: menu behavior and CSS stay aligned");
console.log("Privacy, admin authentication, migration security, and build routes checked");
console.log("Phase Two taxonomy checked: nine event groups, no event left in a retired group");
console.log("Phase Two media and preview checked: admin actions, migration safety, and admin/public markup");
