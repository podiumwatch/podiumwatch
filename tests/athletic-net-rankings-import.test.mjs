import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_COLUMNS,
  EXPECTED_LIST_COUNTS,
  EXPECTED_TOTAL,
  parseAthleticNetRankingsCsv,
  validateCsvHeader,
  normalizeAthleticNetUrl,
  normalizeMeetDate,
  normalizeRankingRow,
  validateRankingRow,
  validateRankingDataset,
  athleticNetRankingSourceKey,
  athleticNetProfileIdentityKey
} from "../lib/athletic_net_rankings_service.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(root, "dataimports/ohio_xc_2026_top_1000_all_divisions_week7.csv");

const SAMPLE_CSV = [
  EXPECTED_COLUMNS.join(","),
  [
    "Boys", "Division I", "1", '"John ""Jack"" Reardon"', "10", "10", "St. Charles",
    "17:38.8", "1058.843", "Bear Den Dash", "Oct 03",
    "https://www.athletic.net/athlete/29503473/cross-country",
    "https://www.athletic.net/team/8058/cross-country",
    "https://www.athletic.net/CrossCountry/meet/276326",
    "https://www.athletic.net/CrossCountry/rankings/list/87319/m/5000",
    "10/13/2026, 08:52:16 EDT"
  ].join(","),
  [
    "Girls", "Division IV", "1000", "Kaitlin Carter", "10", "10", "East Canton",
    "26:23.0", "1583", "Boardman Spartan Invitational", "Sep 19",
    "https://www.athletic.net/athlete/29655484/cross-country",
    "https://www.athletic.net/team/8303/cross-country",
    "https://www.athletic.net/CrossCountry/meet/281837",
    "https://www.athletic.net/CrossCountry/rankings/list/87369/f/5000",
    "10/13/2026, 08:54:14 EDT"
  ].join(",")
].join("\r\n") + "\r\n";

test("parses a quote-aware CSV into header-keyed row objects", () => {
  const rows = parseAthleticNetRankingsCsv(SAMPLE_CSV);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].athlete_name, 'John "Jack" Reardon');
  assert.equal(rows[0].school_name, "St. Charles");
  assert.equal(rows[1].athlete_name, "Kaitlin Carter");
});

test("validateCsvHeader flags missing and unexpected columns", () => {
  assert.deepEqual(validateCsvHeader(EXPECTED_COLUMNS), []);
  const missingOne = EXPECTED_COLUMNS.filter((c) => c !== "athlete_url");
  assert.ok(validateCsvHeader(missingOne)[0].includes("athlete_url"));
  const withExtra = [...EXPECTED_COLUMNS, "unexpected_column"];
  assert.ok(validateCsvHeader(withExtra)[0].includes("unexpected_column") || validateCsvHeader(withExtra).some((e) => e.includes("unexpected_column")));
});

test("normalizeAthleticNetUrl strips query strings, fragments, and a trailing slash, never changing the athlete id", () => {
  assert.equal(
    normalizeAthleticNetUrl("https://www.athletic.net/athlete/26376838/cross-country?utm=x#y"),
    "https://www.athletic.net/athlete/26376838/cross-country"
  );
  assert.equal(
    normalizeAthleticNetUrl("HTTPS://WWW.ATHLETIC.NET/athlete/26376838/cross-country/"),
    "https://www.athletic.net/athlete/26376838/cross-country"
  );
  assert.notEqual(
    normalizeAthleticNetUrl("https://www.athletic.net/athlete/26376838/cross-country"),
    normalizeAthleticNetUrl("https://www.athletic.net/athlete/26376839/cross-country")
  );
});

test("normalizeMeetDate converts an abbreviated month/day into the season's ISO date, never guessing on bad input", () => {
  assert.equal(normalizeMeetDate("Oct 10", 2026), "2026-10-10");
  assert.equal(normalizeMeetDate("Sep 3", 2026), "2026-09-03");
  assert.equal(normalizeMeetDate("not a date", 2026), null);
  assert.equal(normalizeMeetDate("", 2026), null);
  assert.equal(normalizeMeetDate("Oct 10", null), null);
});

test("normalizeRankingRow derives graduation year from grade_normalized and leaves it null for the six unusual preserved values", () => {
  const row = normalizeRankingRow({
    gender: "Boys", division: "Division I", source_rank: "1", athlete_name: "Ian Patrick",
    grade_displayed: "11", grade_normalized: "11", school_name: "Little Miami",
    time_displayed: "14:54.4", time_seconds: "894.381", meet_name: "Les Eisenhart Invitational",
    meet_date: "Oct 10", athlete_url: "https://www.athletic.net/athlete/26376838/cross-country",
    school_url: "https://www.athletic.net/team/7947/cross-country",
    meet_url: "https://www.athletic.net/CrossCountry/meet/278216",
    rankings_page_url: "https://www.athletic.net/CrossCountry/rankings/list/87319/m/5000",
    collected_at_eastern: "10/13/2026, 08:52:16 EDT"
  }, 0, { seasonYear: 2026 });

  assert.equal(row.grade_normalized, 11);
  // A junior (grade 11) in the fall 2026 cross country season is in the
  // 2026-27 academic year; their senior year is 2027-28, graduating
  // spring 2028 -- not 2027.
  assert.equal(row.graduation_year, 2028);
  assert.equal(row.event_key, "xc_5k");
  assert.equal(row.meet_date, "2026-10-10");
  assert.equal(row.time_seconds, 894.381);

  // One of the six real unusual values this dataset documents preserving
  // in grade_displayed with grade_normalized left blank (e.g. "22").
  const unusualRow = normalizeRankingRow({
    gender: "Boys", division: "Division I", source_rank: "2", athlete_name: "Sam Darmanie",
    grade_displayed: "22", grade_normalized: "", school_name: "Some School",
    time_displayed: "15:00.0", time_seconds: "900",
    athlete_url: "https://www.athletic.net/athlete/1/cross-country",
    school_url: "https://www.athletic.net/team/1/cross-country",
    meet_url: "https://www.athletic.net/CrossCountry/meet/1",
    rankings_page_url: "https://www.athletic.net/CrossCountry/rankings/list/1/m/5000",
    meet_name: "Meet", meet_date: "Oct 03", collected_at_eastern: "x"
  }, 1, { seasonYear: 2026 });

  assert.equal(unusualRow.grade_normalized, null);
  assert.equal(unusualRow.graduation_year, null);
  assert.equal(unusualRow.grade_displayed, "22");
});

test("validateRankingRow requires gender/division/time/urls and rejects a non-Athletic.net athlete_url", () => {
  const base = normalizeRankingRow({
    gender: "Boys", division: "Division I", source_rank: "1", athlete_name: "A B",
    school_name: "School", time_displayed: "15:00.0", time_seconds: "900",
    athlete_url: "https://www.athletic.net/athlete/1/cross-country",
    school_url: "https://www.athletic.net/team/1/cross-country",
    meet_url: "https://www.athletic.net/CrossCountry/meet/1",
    rankings_page_url: "https://www.athletic.net/CrossCountry/rankings/list/1/m/5000",
    meet_name: "Meet", meet_date: "Oct 03", collected_at_eastern: "x"
  }, 0, { seasonYear: 2026 });

  assert.deepEqual(validateRankingRow(base), []);

  const badGender = { ...base, gender: "Unspecified" };
  assert.ok(validateRankingRow(badGender).some((e) => e.includes("Gender")));

  const badTime = { ...base, time_seconds: 0 };
  assert.ok(validateRankingRow(badTime).some((e) => e.includes("time_seconds")));

  const badUrl = { ...base, athlete_url: "https://www.milesplit.com/athlete/1" };
  assert.ok(validateRankingRow(badUrl).some((e) => /athletic\.net/i.test(e)));

  const missingUrl = { ...base, meet_url: "" };
  assert.ok(validateRankingRow(missingUrl).some((e) => e.includes("meet_url")));
});

test("validateRankingDataset matches the documented expected counts, including both tied-rank exceptions, with no synthetic data", () => {
  const rows = [];
  for (const [key, count] of Object.entries(EXPECTED_LIST_COUNTS)) {
    const [gender, division] = key.split("|");
    for (let i = 0; i < count; i++) {
      rows.push(normalizeRankingRow({
        gender, division, source_rank: String(i + 1), athlete_name: `Athlete ${gender} ${division} ${i}`,
        school_name: "School", time_displayed: "15:00.0", time_seconds: String(900 + i),
        athlete_url: `https://www.athletic.net/athlete/${gender}-${division}-${i}/cross-country`,
        school_url: "https://www.athletic.net/team/1/cross-country",
        meet_url: "https://www.athletic.net/CrossCountry/meet/1",
        rankings_page_url: "https://www.athletic.net/CrossCountry/rankings/list/1/m/5000",
        meet_name: "Meet", meet_date: "Oct 03", collected_at_eastern: "x"
      }, i, { seasonYear: 2026 }));
    }
  }

  assert.equal(rows.length, EXPECTED_TOTAL);
  const check = validateRankingDataset(rows);
  assert.deepEqual(check.errors, []);
  assert.equal(check.total, EXPECTED_TOTAL);
  assert.equal(check.counts["Girls|Division III"], 1001);
  assert.equal(check.counts["Girls|Division II"], 1000);

  // Removing one row should be caught, not silently tolerated.
  const shortRows = rows.slice(1);
  const brokenCheck = validateRankingDataset(shortRows);
  assert.ok(brokenCheck.errors.some((e) => /expected/i.test(e) && e.includes("Boys|Division I")));
  assert.ok(brokenCheck.errors.some((e) => new RegExp(`expected ${EXPECTED_TOTAL}`, "i").test(e)));
});

test("athleticNetRankingSourceKey is stable per athlete+event+season regardless of mark/meet, so a re-import updates instead of duplicating", () => {
  const url = "https://www.athletic.net/athlete/26376838/cross-country";
  const keyWeek1 = athleticNetRankingSourceKey(url, "xc_5k", 2026);
  const keyWeek2 = athleticNetRankingSourceKey(url, "xc_5k", 2026);
  assert.equal(keyWeek1, keyWeek2, "the same athlete/event/season must always produce the same source_key");

  const differentAthlete = athleticNetRankingSourceKey(
    "https://www.athletic.net/athlete/999999/cross-country",
    "xc_5k",
    2026
  );
  assert.notEqual(keyWeek1, differentAthlete, "different athlete_urls must never collide");

  const differentSeason = athleticNetRankingSourceKey(url, "xc_5k", 2027);
  assert.notEqual(keyWeek1, differentSeason, "a different season must not reuse the same row");
});

test("athleticNetProfileIdentityKey is stable per athlete_url and distinct across athletes", () => {
  const url = "https://www.athletic.net/athlete/26376838/cross-country";
  assert.equal(athleticNetProfileIdentityKey(url), athleticNetProfileIdentityKey(url));
  assert.notEqual(
    athleticNetProfileIdentityKey(url),
    athleticNetProfileIdentityKey("https://www.athletic.net/athlete/999999/cross-country")
  );
});

test("the real materialized CSV in dataimports/ matches the documented header, counts, and total exactly", () => {
  if (!fs.existsSync(CSV_PATH)) {
    // The real dataset file is a large, environment-specific asset;
    // skip gracefully rather than fail if it is not present (for example,
    // in a checkout that has not run the xlsx-to-CSV conversion step).
    return;
  }

  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rawRows = parseAthleticNetRankingsCsv(csvText);
  assert.equal(rawRows.length, EXPECTED_TOTAL);

  const headerErrors = validateCsvHeader(Object.keys(rawRows[0]));
  assert.deepEqual(headerErrors, []);

  const normalizedRows = rawRows.map((row, index) => normalizeRankingRow(row, index, { seasonYear: 2026 }));
  const datasetCheck = validateRankingDataset(normalizedRows);
  assert.deepEqual(datasetCheck.errors, [], `Real dataset shape mismatch: ${datasetCheck.errors.join(" | ")}`);

  const invalidRows = normalizedRows.filter((row) => validateRankingRow(row).length > 0);
  assert.deepEqual(
    invalidRows.map((r) => ({ row: r.row_number, errors: validateRankingRow(r) })),
    [],
    "every retained row in the real dataset must pass per-row validation"
  );

  const blankGradeNormalized = normalizedRows.filter((r) => r.grade_normalized === null);
  assert.equal(blankGradeNormalized.length, 6, "expected exactly the six documented unusual grade_normalized values");

  const urls = new Set(normalizedRows.map((r) => r.normalized_athlete_url));
  assert.equal(urls.size, normalizedRows.length, "every retained row must have a unique athlete_url");
});
