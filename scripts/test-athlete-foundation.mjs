import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const seedPath = path.join(
  root,
  "public",
  "data",
  "athlete-foundation-seed-2026.json"
);
const migrationPath = path.join(
  root,
  "install",
  "02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql"
);
const buildPath = path.join(
  root,
  "scripts",
  "build.mjs"
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function uniqueCount(values) {
  return new Set(values).size;
}

const [seedText, migration, build] = await Promise.all([
  fs.readFile(seedPath, "utf8"),
  fs.readFile(migrationPath, "utf8"),
  fs.readFile(buildPath, "utf8")
]);

const dataset = JSON.parse(seedText);
const athletes = Array.isArray(dataset.athletes)
  ? dataset.athletes
  : [];

assert(
  dataset.dataset_key ===
    "podium-watch-2026-xc-ranking-athlete-seed",
  "Unexpected athlete seed dataset key."
);
assert(
  athletes.length === 200,
  `Expected 200 athlete records, found ${athletes.length}.`
);
assert(
  Number(dataset.record_count) === athletes.length,
  "The athlete seed record count does not match the data."
);
assert(
  Number(dataset.official_school_match_count) === 196,
  "Expected 196 safely linked official school rows."
);
assert(
  uniqueCount(
    athletes.map((athlete) => athlete.source_identity_key)
  ) === athletes.length,
  "Athlete source identity keys must be unique."
);
assert(
  uniqueCount(
    athletes.map((athlete) => athlete.profile_slug)
  ) === athletes.length,
  "Athlete profile slugs must be unique."
);
assert(
  uniqueCount(
    athletes.map(
      (athlete) => athlete.ranking?.ranking_entry_key
    )
  ) === athletes.length,
  "Athlete ranking entry keys must be unique."
);

const expectedGradeYears = {
  Senior: 2027,
  Junior: 2028,
  Sophomore: 2029,
  Freshman: 2030
};
const rankingCounts = new Map();

for (const athlete of athletes) {
  assert(
    athlete.display_name &&
      athlete.first_name &&
      athlete.last_name,
    "Every athlete must have a complete display identity."
  );
  assert(
    ["boys", "girls"].includes(athlete.gender),
    `Unexpected athlete gender for ${athlete.display_name}.`
  );
  assert(
    expectedGradeYears[athlete.grade_label] ===
      athlete.graduation_year,
    `Graduation year mapping is incorrect for ${athlete.display_name}.`
  );
  assert(
    athlete.ranking?.ranking_type ===
      "Podium Watch editorial ranking",
    `Ranking type is not editorial for ${athlete.display_name}.`
  );
  assert(
    athlete.ranking?.mark_snapshot,
    `Ranking context mark is missing for ${athlete.display_name}.`
  );
  assert(
    !Object.hasOwn(athlete, "performances") &&
      !Object.hasOwn(athlete, "personal_best") &&
      !Object.hasOwn(athlete, "verified_performance"),
    `Editorial seed data must not create a verified performance for ${athlete.display_name}.`
  );

  const slug = athlete.ranking?.ranking_slug;
  rankingCounts.set(
    slug,
    Number(rankingCounts.get(slug) || 0) + 1
  );
}

assert(
  rankingCounts.size === 8,
  `Expected 8 ranking groups, found ${rankingCounts.size}.`
);

for (const [slug, count] of rankingCounts) {
  assert(
    count === 25,
    `Expected 25 athletes in ${slug}, found ${count}.`
  );
}

const requiredTables = [
  "athlete_data_sources",
  "athlete_profiles",
  "athlete_profile_aliases",
  "athlete_school_history",
  "athlete_performances",
  "athlete_ranking_entries",
  "athlete_story_links",
  "athlete_profile_corrections",
  "athlete_import_batches",
  "athlete_profile_merges"
];

for (const table of requiredTables) {
  assert(
    migration.includes(
      `create table if not exists public.${table}`
    ),
    `Migration is missing ${table}.`
  );
}

assert(
  migration.includes(
    "add column if not exists athlete_profile_id"
  ),
  "Migration does not link team roster athletes."
);
assert(
  migration.includes(
    "create or replace function public.athlete_commit_seed_import_v1"
  ),
  "Migration is missing the safe athlete import function."
);
assert(
  migration.includes(
    "create or replace function public.athlete_merge_profiles_v1"
  ),
  "Migration is missing the athlete merge function."
);
assert(
  migration.includes(
    "revoke all on function public.athlete_commit_seed_import_v1"
  ) &&
    migration.includes(
      "revoke all on function public.athlete_merge_profiles_v1"
    ),
  "Privileged athlete functions must be revoked from public roles."
);
assert(
  migration.includes(
    "'mark_is_verified_performance', false"
  ),
  "Ranking marks must remain explicitly separate from verified performances."
);
assert(
  build.includes('writePage("/athletes/"') &&
    build.includes('writePage("/admin/athletes/"') &&
    build.includes("athleteDetailPage"),
  "The build is missing athlete directory or profile routes."
);

console.log("");
console.log("Athlete Foundation validation passed.");
console.log(`Athlete profiles in seed: ${athletes.length}`);
console.log(`Ranking groups: ${rankingCounts.size}`);
console.log(
  `Safely linked official school rows: ${dataset.official_school_match_count}`
);
console.log(
  `Unmatched school names: ${(dataset.unmatched_school_names || []).join(", ")}`
);
console.log("");
