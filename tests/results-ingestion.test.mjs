import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessParsedResults, canonicalizeResultUrl, classifyDocument, createPublicResultsSubmission, extractScoredLinks, fetchPage, parseGenericRows, providerSeedVariants, recognizeProvider, scoreResultLink, verifyResultContent } from "../lib/result_ingestion_engine.mjs";
import { extractDocument, parsePastedOrDelimitedText, parserInternals } from "../lib/result_parsers.mjs";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ingestionEngineSource = fs.readFileSync(path.join(root, "lib/result_ingestion_engine.mjs"), "utf8");
const publicSubmissionsApi = fs.readFileSync(path.join(root, "api/results-submissions/index.js"), "utf8");
const submitResultsPageSource = fs.readFileSync(path.join(root, "src/pages/submitresults.mjs"), "utf8");
const submitResultsScriptSource = fs.readFileSync(path.join(root, "public/scripts/submit-results.js"), "utf8");

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

test("canonical URLs remove fragments and trackers", () => {
  assert.equal(canonicalizeResultUrl("https://www.baumspage.com/cc/event/results.html?utm_source=x&id=7#top"), "https://www.baumspage.com/cc/event/results.html?id=7");
});

test("approved legacy HTTP provider links are safely upgraded", () => {
  assert.equal(canonicalizeResultUrl("http://www.baumspage.com/cc/results.pdf"), "https://www.baumspage.com/cc/results.pdf");
});

test("unsafe and unapproved hosts are rejected", () => {
  assert.throws(() => canonicalizeResultUrl("http://localhost/test"));
  assert.throws(() => canonicalizeResultUrl("https://example.com/results"));
});

test("providers are recognized", () => {
  assert.equal(recognizeProvider("https://oh.milesplit.com/meets/1"), "milesplit_ohio");
  assert.equal(recognizeProvider("https://runsignup.com/Race/Results/1"), "runsignup");
});

test("result links outrank navigation", () => {
  const result = scoreResultLink({ anchor: "2025 Complete Results PDF", surrounding: "Boys and Girls Cross Country", url: "https://www.baumspage.com/cc/a/results.pdf", parentProvider: "baumspage" });
  const privacy = scoreResultLink({ anchor: "Privacy and Login", url: "https://www.baumspage.com/privacy", parentProvider: "baumspage" });
  assert.ok(result.score >= 70);
  assert.ok(privacy.score < result.score);
});

test("Baumspage event routes outrank generic archive navigation", () => {
  const meet = scoreResultLink({ anchor: "Willard Early Bird Cross Country Invitational", surrounding: "08/20/25", url: "https://www.baumspage.com/cc/ccevent.php?peventid=2&table=C", parentProvider: "baumspage" });
  const archive = scoreResultLink({ anchor: "Regional", surrounding: "2021 archived results", url: "https://www.baumspage.com/cc/regional.php", parentProvider: "baumspage" });
  assert.ok(meet.score > archive.score);
  assert.ok(meet.score >= 60);
});

test("intermediate result links are extracted without meet identity", () => {
  const links = extractScoredLinks('<nav><a href="/privacy">Privacy</a></nav><main><p>2025 race files</p><a href="next.html">Live Results</a></main>', "https://www.baumspage.com/cc/event/");
  assert.equal(links[0].url, "https://www.baumspage.com/cc/event/next.html");
  assert.ok(links[0].score >= 24);
});

test("document signatures override extensions", () => {
  assert.equal(classifyDocument({ contentType: "application/octet-stream", url: "https://www.baumspage.com/cc/file", bytes: Buffer.from("%PDF-1.7") }), "pdf");
});

test("controlled network integration follows and records safe redirects", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: "/cc/final-results.csv" } });
    return new Response("place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20", { status: 200, headers: { "content-type": "text/csv" } });
  };
  const result = await fetchPage("https://www.baumspage.com/cc/start", { timeoutMs: 1000, retries: 0 }, fakeFetch, async () => {});
  assert.equal(result.finalUrl, "https://www.baumspage.com/cc/final-results.csv");
  assert.deepEqual(result.redirects, ["https://www.baumspage.com/cc/final-results.csv"]);
  assert.equal(result.bytes.toString("utf8").split("\n").length, 2);
});

test("controlled network integration rejects unsafe redirect handoffs", async () => {
  const fakeFetch = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  await assert.rejects(() => fetchPage("https://www.baumspage.com/cc/start", { timeoutMs: 1000, retries: 0 }, fakeFetch, async () => {}), /public HTTPS|approved provider/i);
});

test("result verification requires combined evidence", () => {
  const verified = verifyResultContent({ documentType: "text", text: "Official Results 5K Boys Place Name School Time\n1 John Runner Central 15:30.20\n2 Sam Fast North 15:40.10\n3 Eli Pace South 15:50.00\n4 Max Swift East 16:00.00" });
  const weak = verifyResultContent({ documentType: "text", text: "Welcome to our privacy policy and contact page" });
  assert.ok(verified.score >= 52);
  assert.ok(weak.score < 52);
});

test("generic CSV parser creates stable normalized rows", () => {
  const csv = "athlete_name,school_name,event_name,mark_text,place\nJohn Runner,Central,5K,15:30.20,1";
  const rows = parseGenericRows({ text: csv, documentType: "csv", metadata: { meetName: "Sample Invitational", meetDate: "2025-09-01", sport: "cross_country", seasonYear: 2025 } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].athleteName, "John Runner");
  assert.equal(rows[0].place, 1);
  assert.equal(rows[0].warningCodes.length, 0);
  assert.match(rows[0].resultFingerprint, /^[a-f0-9]{64}$/);
});

test("HTML tables parse through the normalized contract", async () => {
  const html = `<html><head><title>Firelands Conference Championship</title></head><body><h2>High School Boys 5K</h2><table><tr><th>Place</th><th>Name</th><th>School</th><th>Time</th></tr><tr><td>1</td><td>John Runner</td><td>New London</td><td>15:30.20</td></tr><tr><td>2</td><td>Sam Fast</td><td>Western Reserve</td><td>15:40.10</td></tr></table></body></html>`;
  const result = await extractDocument({ bytes: Buffer.from(html), text: html, documentType: "html", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows.length, 2); assert.equal(result.rows[0].meetName, "Firelands Conference Championship"); assert.equal(result.rows[0].place, 1);
});

test("HTML table headings carry event and gender context into rows", async () => {
  const html = `<html><head><title>Gibsonburg Invitational</title></head><body><h2>Girls Shot Put</h2><table><tr><th>Place</th><th>Name</th><th>School</th><th>Mark</th></tr><tr><td>1</td><td>Ava Thrower</td><td>Central</td><td>31-00.00</td></tr></table></body></html>`;
  const result = await extractDocument({ bytes: Buffer.from(html), text: html, documentType: "html", metadata: { sport: "outdoor_track", seasonYear: 2026 } });
  assert.equal(result.rows[0].eventCode, "shot_put");
  assert.equal(result.rows[0].gender, "girls");
  assert.ok(Math.abs(result.rows[0].markValue - 9.4488) < 0.00001);
});

test("project event keys and human dates normalize for performance history", async () => {
  const csv = "meet_date,place,athlete_name,school_name,event_name,mark_text\nOctober 11 2025,1,John Runner,Central,5K,15:30.20";
  const result = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows[0].eventCode, "xc_5k");
  assert.equal(result.rows[0].meetDate, "2025-10-11");
});

test("normalized compound headers are accepted as school and mark columns", async () => {
  const csv = "Athlete Name,School / Team,Event Name,Result Time,Place\nJohn Runner,Central,5K,15:30.20,1";
  const result = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows[0].schoolName, "Central");
  assert.equal(result.rows[0].markText, "15:30.20");
  assert.deepEqual(result.rows[0].warningCodes, []);
});

test("a real Baumspage HY-TEK results PDF parses names and schools without column drift", async () => {
  // Bug found and fixed 2026-08-05, from a real Baumspage crawl of the 2025
  // Willard Early Bird Cross Country Invitational: pdfText() joined PDF
  // text items with exactly one space per item boundary, so the number of
  // spaces between reconstructed columns depended on how many separate
  // text runs the PDF happened to split a field into, not on the real
  // pixel gap between them. The fixed-column parser then sliced at
  // character positions taken from the header line, which almost never
  // lined up with a data line's actual column boundaries once place
  // numbers and names of different lengths shifted everything after them.
  // Real symptom: "Roberson, Jeremiah" / "Buckeye Central" came out as
  // athleteName "Rober" and schoolName "son, Jeremiah Buckeye Central".
  const bytes = fs.readFileSync(path.join(fixturesDir, "baumspage-boys-hs-results.pdf"));
  const result = await extractDocument({ bytes, documentType: "pdf", metadata: { sport: "cross_country", seasonYear: 2025 } });
  // The real fixture's finishers are already in place order; indexing by
  // array position (rather than grouping by the place number) avoids a
  // separate, real issue this fixture also exposed -- its Team Scores
  // table is not yet recognized and produces a few extra rows whose place
  // numbers collide with real finishers (see the follow-up test below).
  assert.ok(result.rows.length >= 8, "The real fixture has at least 8 finishers on its first page.");
  assert.equal(result.rows[0].athleteName, "Hull, Cale");
  assert.equal(result.rows[0].schoolName, "Old Fort");
  assert.equal(result.rows[0].markText, "18:26.30");
  assert.equal(result.rows[1].athleteName, "Roberson, Jeremiah", "A name split across a PDF text run boundary must not be truncated.");
  assert.equal(result.rows[1].schoolName, "Buckeye Central", "The truncated tail of a name must not leak into the school column.");
  assert.equal(result.rows[1].markText, "18:30.62");
  assert.equal(result.rows[2].athleteName, "Hessick, Dalton");
  assert.equal(result.rows[2].schoolName, "Old Fort");
});

test("a real Baumspage PDF's Team Scores table does not leak fake individual results", async () => {
  // Bug found and fixed 2026-08-05 in the same real fixture: the generic
  // text-row parser has no notion of a HY-TEK Team Scores table (rank,
  // team name, total, and each scoring runner's place), so a line like
  // "1 Old Fort  21  1 2 5 6 7" satisfied the generic place/name/mark row
  // pattern and was staged as a fake individual result with athleteName
  // "Old Fort" and schoolName "1 2 5 6 7". The real fixture has exactly
  // 39 finishers and a three-team Team Scores table on its second page.
  const bytes = fs.readFileSync(path.join(fixturesDir, "baumspage-boys-hs-results.pdf"));
  const result = await extractDocument({ bytes, documentType: "pdf", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows.length, 39, "Team Scores rows must be skipped, not staged as extra finishers.");
  assert.ok(
    !result.rows.some((row) => row.schoolName && /^\d+(\s+\d+)+$/.test(row.schoolName)),
    "No staged row should have a school name that is really a list of scoring places."
  );
});

test("preformatted result pages parse without a meet identity on the intermediate page", async () => {
  const html = `<html><body><h2>Boys 5K Results</h2><pre>Place  Name  School  Time\n1  John Runner  Central  15:30.20\n2  Sam Fast  North  15:40.10</pre></body></html>`;
  const result = await extractDocument({ bytes: Buffer.from(html), text: html, documentType: "html", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows.length, 2); assert.equal(result.rows[1].athleteName, "Sam Fast");
});

test("pasted track text keeps event, gender, status, and wind", () => {
  const text = "High School Girls 100 Hurdles\nPlace  Name  School  Time  Wind\n1  Ava Swift  Central  14.52  +1.2\n2  Mia Fast  North  DQ";
  const rows = parsePastedOrDelimitedText(text, { sport: "outdoor_track", seasonYear: 2026 });
  assert.equal(rows.length, 2); assert.equal(rows[0].gender, "girls"); assert.match(rows[0].eventName, /hurdles/i); assert.equal(rows[1].resultStatus, "DQ");
});

test("field event and no mark values are preserved", () => {
  const rows = parsePastedOrDelimitedText("Boys High Jump\nPlace  Name  School  Mark\n1  Eli Jumper  West  6.50\n2  Max Leaper  East  NM", { sport: "outdoor_track", seasonYear: 2026 });
  assert.equal(rows.length, 2); assert.equal(rows[0].eventCode, "high_jump"); assert.equal(rows[1].resultStatus, "NM");
});

test("relay rows can use relay team identity", async () => {
  const csv = "place,relay_team,school,event,mark\n1,Central A,Central,4x800 Relay,8:01.22";
  const result = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata: { sport: "outdoor_track", seasonYear: 2026 } });
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].relayTeam, "Central A"); assert.ok(!result.rows[0].warningCodes.includes("ATHLETE_OR_RELAY_MISSING"));
});

test("spreadsheet workbooks parse every sheet", async () => {
  const fixture = "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";
  const bytes = Buffer.from(fixture, "base64"); const result = await extractDocument({ bytes, documentType: "spreadsheet", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows.length, 2); assert.deepEqual(result.rows.map((row) => row.athleteName).sort(), ["Ava Runner","John Runner"]);
});

test("repeated CSV imports produce identical fingerprints", async () => {
  const csv = "place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20";
  const first = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata: { meetName: "Invite", meetDate: "2025-09-01" } });
  const second = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata: { meetName: "Invite", meetDate: "2025-09-01" } });
  assert.equal(first.rows[0].resultFingerprint, second.rows[0].resultFingerprint);
});

test("corrected marks create a different result fingerprint", async () => {
  const before = await extractDocument({ bytes: Buffer.from("place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20"), text: "place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20", documentType: "csv", metadata: { meetName: "Invite", meetDate: "2025-09-01" } });
  const after = await extractDocument({ bytes: Buffer.from("place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:29.20"), text: "place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:29.20", documentType: "csv", metadata: { meetName: "Invite", meetDate: "2025-09-01" } });
  assert.notEqual(before.rows[0].resultFingerprint, after.rows[0].resultFingerprint);
});

test("duplicate links and fragments collapse to one canonical URL", () => {
  const values = ["https://www.baumspage.com/cc/a/results.html#boys","https://www.baumspage.com/cc/a/results.html#girls","https://www.baumspage.com/cc/a/results.html?utm_source=x"];
  assert.equal(new Set(values.map((value) => canonicalizeResultUrl(value))).size, 1);
});

test("crawl loops are representable without duplicate canonical pages", () => {
  const first = extractScoredLinks('<a href="b.html">Results</a>', "https://www.baumspage.com/a.html")[0];
  const second = extractScoredLinks('<a href="a.html">Results</a>', first.url)[0];
  assert.equal(second.url, "https://www.baumspage.com/a.html");
});

test("misleading and empty documents do not verify", () => {
  assert.ok(verifyResultContent({ text: "Results are coming soon. Login and register for updates.", documentType: "text" }).score < 52);
  assert.ok(verifyResultContent({ text: "", documentType: "text" }).score < 52);
});

test("all named providers and handoffs are recognized", () => {
  const examples = [["https://www.baumspage.com/cc/","baumspage"],["https://oh.milesplit.com/meets/1/results","milesplit_ohio"],["https://www.athletic.net/CrossCountry/meet/1/results","athletic_net"],["https://finishtiming.trackscoreboard.com/meets/1","finish_timing"],["https://results.timingfirst.com/meets/1","timing_first"],["https://runsignup.com/Race/Results/1","runsignup"]];
  for (const [url, provider] of examples) assert.equal(recognizeProvider(url), provider);
});

test("bulk fixture parses twenty five meets and one thousand unique rows twice", async () => {
  const fingerprints = new Set();
  for (let meet = 1; meet <= 25; meet += 1) {
    const lines = ["place,athlete_name,school_name,event_name,mark_text"];
    for (let athlete = 1; athlete <= 40; athlete += 1) lines.push(`${athlete},Runner ${meet} ${athlete},School ${meet},5K,${15 + Math.floor(athlete / 20)}:${String(athlete % 60).padStart(2,"0")}.10`);
    const csv = lines.join("\n"); const metadata = { meetName: `Meet ${meet}`, meetDate: `2025-09-${String(meet).padStart(2,"0")}`, sport: "cross_country", seasonYear: 2025 };
    const first = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata }); const second = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv", metadata });
    assert.equal(first.rows.length, 40); assert.deepEqual(first.rows.map((row) => row.resultFingerprint), second.rows.map((row) => row.resultFingerprint)); first.rows.forEach((row) => fingerprints.add(row.resultFingerprint));
  }
  assert.equal(fingerprints.size, 1000);
});

test("raw source rows are preserved for audit", async () => {
  const csv = "place,athlete_name,school_name,event_name,mark_text,points\n1,John Runner,Central,5K,15:30.20,10"; const result = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv" });
  assert.equal(result.rows[0].rawRow.points, "10"); assert.match(result.rows[0].sourceFingerprint, /^[a-f0-9]{64}$/);
});

test("unsafe protocols and IP addresses fail before fetch", () => {
  for (const url of ["ftp://www.baumspage.com/file.csv","https://127.0.0.1/file.csv","https://192.168.1.1/file.csv"]) assert.throws(() => canonicalizeResultUrl(url));
});

test("header normalization handles punctuation and merged labels", () => {
  assert.deepEqual(parserInternals.delimitedRows("Athlete Name,School / Team,Result Time\nJohn Runner,Central,15:30.20")[0], { athlete_name: "John Runner", school_team: "Central", result_time: "15:30.20", _row_number: 2 });
});

test("athlete directory names never become staged result rows", async () => {
  const html = `<html><title>Ohio Athlete Rankings</title><body><h2>Athletes</h2><table><tr><th>Rank</th><th>Name</th><th>Profile</th></tr><tr><td>1</td><td>Mercy Alamina</td><td>View athlete</td></tr><tr><td>2</td><td>Emily Chen</td><td>View athlete</td></tr></table></body></html>`;
  const result = await extractDocument({ bytes: Buffer.from(html), text: html, documentType: "html", metadata: { sport: "cross_country", seasonYear: 2025 } });
  assert.equal(result.rows.length, 0);
  assert.ok(result.warnings.includes("NO_RESULT_ROWS_PARSED"));
});

test("MileSplit completed raw HY TEK results stage complete fixed width rows", async () => {
  const html = `<html><head><title>OHSAA Division 2 State Championship 2025</title></head><body><pre>High School Boys Division 2 5KM Run Finals\n=======================================================================\n    Name                    Year School                  Finals  Points\n=======================================================================\n  1 Landon Kimmel             12 Tippecanoe            15:12.70    1\n  2 Jacob Proctor             12 Anthony Wayne         15:28.74    2\n  3 Grant Hamilton            12 Canal Winchester      15:33.65</pre></body></html>`;
  const result = await extractDocument({ bytes: Buffer.from(html), text: html, documentType: "html", metadata: { sport: "cross_country", seasonYear: 2025 } });
  const assessment = assessParsedResults(result.rows, result.rejectedRows);
  assert.equal(result.rows.length, 3);
  assert.equal(assessment.valid, true);
  assert.ok(result.rows.every((row) => row.athleteName && row.schoolName && row.eventName && row.markText));
  assert.equal(result.rows[0].athleteName, "Landon Kimmel");
  assert.equal(result.rows[0].schoolName, "Tippecanoe");
  assert.equal(result.rows[0].athleteGrade, "12");
  assert.equal(result.rows[0].eventCode, "xc_5k");
});

test("MileSplit formatted seeds automatically include completed raw results", () => {
  const seeds = providerSeedVariants("https://oh.milesplit.com/meets/699322-state-2025/results/1239242/formatted");
  assert.deepEqual(seeds, ["https://oh.milesplit.com/meets/699322-state-2025/results/1239242/formatted", "https://oh.milesplit.com/meets/699322-state-2025/results/1239242/raw"]);
});

test("provider profile and ranking links are excluded while direct results rank highly", () => {
  const profile = scoreResultLink({ anchor: "Athlete Profile and Rankings", url: "https://oh.milesplit.com/athletes/123/profile", parentProvider: "milesplit_ohio" });
  const results = scoreResultLink({ anchor: "Formatted Results", url: "https://oh.milesplit.com/meets/647746-meet-2025/results/1241790/formatted", parentProvider: "milesplit_ohio" });
  assert.ok(profile.score < 24);
  assert.ok(results.score >= 52);
});

test("performance import template columns parse into the normalized contract", async () => {
  const csv = "athlete_name,school_name,gender,graduation_year,sport,season_year,event_name,mark_text,meet_name,meet_date,place,source_label,source_url,source_type,verification_status,public_visible,course_context,wind_text,wind_legal,notes\nAva Runner,Central,girls,2027,cross_country,2025,5K,18:20.10,Sample Invite,2025-09-01,1,Official Results,https://oh.milesplit.com/meets/1/results,official,source_linked,false,,,,";
  const result = await extractDocument({ bytes: Buffer.from(csv), text: csv, documentType: "csv" });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].eventCode, "xc_5k");
  assert.equal(result.rows[0].meetName, "Sample Invite");
});

// Bug found and fixed 2026-08-05: the general ingestion parser's header
// detection matched "PLACE VIDEO ATHLETE TEAM MARK POINTS" as a real
// header line, but since this OHSAA/MileSplit-style format is single-space
// separated (not the 2+ space columns this parser otherwise expects), it
// split into exactly one cell -- which then made every data line beneath
// it also produce one garbage cell, matching a length check that was only
// meant to guard against genuinely empty lines. A public results
// submission in this exact real format therefore silently produced zero
// rows. Fixed with a grade-anchored fallback pattern (adapted from the
// admin recruiting importer's own proven copy of this same pattern) and by
// only accepting a HEADER-matched line as real multi-column headers when
// splitting it actually produces more than one cell.
test("OHSAA and MileSplit-style single-space results with an embedded grade parse correctly", () => {
  const text = `Division 3 Boys 5000 Meter Run

PLACE VIDEO ATHLETE TEAM MARK POINTS
1 Bennett Lehman JR Ansonia 15:17.91
18 Kenneth Morgan Jr SR Perrysburg 15:51.32 15`;
  const rows = parsePastedOrDelimitedText(text, { sport: "cross_country", seasonYear: 2025 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].athleteName, "Bennett Lehman");
  assert.equal(rows[0].schoolName, "Ansonia");
  assert.equal(rows[0].markText, "15:17.91");
  assert.equal(rows[1].athleteName, "Kenneth Morgan Jr", "A mixed-case name suffix must not be mistaken for the grade marker.");
  assert.equal(rows[1].schoolName, "Perrysburg");
});

// A caller-supplied meetName/meetDate (for example, a submitter typing them
// into a form, rather than the pasted content stating them per row) must
// still reach every row. rowContract() already falls back to this context;
// this confirms extractDocument() actually passes it through for a document
// that never states the meet name or date itself.
test("caller-supplied meet name and date reach every row when the document does not state them", async () => {
  const csv = "place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20\n2,Sam Fast,North,5K,15:40.10";
  const result = await extractDocument({
    bytes: Buffer.from(csv),
    text: csv,
    documentType: "csv",
    metadata: { sport: "cross_country", seasonYear: 2025, meetName: "Coach-Submitted Invite", meetDate: "2025-09-20" }
  });
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((row) => row.meetName === "Coach-Submitted Invite"), "Every row must carry the caller-supplied meet name.");
  assert.ok(result.rows.every((row) => row.meetDate === "2025-09-20"), "Every row must carry the caller-supplied meet date.");
});

// 2026-08-05: a public, unauthenticated submission path (createPublicResultsSubmission)
// lets a coach, timer, or meet host submit results without an admin account.
// These checks exercise only the validation that runs before any database
// call, since the rest of the function (rate limiting, staging) requires a
// real Supabase connection this fixture-only test file does not have.
test("public results submission rejects a filled honeypot silently, with no error", async () => {
  const result = await createPublicResultsSubmission({ website: "http://spam.example", text: "irrelevant" });
  assert.deepEqual(result, { accepted: true, job_id: null, rows_found: 0 });
});

test("public results submission requires a meet name, date, sport, season, submitter name, and a valid email", async () => {
  const base = {
    meetName: "Test Invite", meetDate: "2025-09-20", sport: "cross_country", seasonYear: 2025,
    submitterName: "Coach Example", submitterEmail: "coach@example.com", text: "1 John Runner Central 15:30.20"
  };
  await assert.rejects(() => createPublicResultsSubmission({ ...base, meetName: "" }), /Meet name is required/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, meetDate: "" }), /Meet date is required/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, sport: "swimming" }), /Choose cross country, indoor track, or outdoor track/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, seasonYear: NaN }), /Season year is required/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, submitterName: "" }), /Your name is required/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, submitterEmail: "not-an-email" }), /valid email address is required/);
  await assert.rejects(() => createPublicResultsSubmission({ ...base, text: "" }), /Paste the results text/);
});

// Source guards: the parts of this feature that do require a live database
// connection (rate limiting by a hashed IP, forwarding meet metadata into
// createContentIngestionJob, and tagging public-submission-derived
// performances with community trust rather than official trust) were
// verified live against the real API during development. These guard
// against the exact regressions found and fixed then.
test("public submissions are rate limited by a hashed address, never a raw IP", () => {
  assert.ok(publicSubmissionsApi.includes("createHmac"), "The public submission API must hash the submitter's address, not store it raw.");
  assert.ok(!publicSubmissionsApi.includes("submitter_ip:"), "No raw submitter IP field should exist alongside the hashed one.");
  assert.ok(ingestionEngineSource.includes("submitter_ip_hash"), "Rate limiting must key off a hashed address field.");
});

test("createContentIngestionJob forwards caller-supplied meet identity into row metadata", () => {
  assert.ok(ingestionEngineSource.includes("meetName: input.meetName"), "Meet name must flow from the caller into every parsed row.");
  assert.ok(ingestionEngineSource.includes("meetDate: input.meetDate"), "Meet date must flow from the caller into every parsed row.");
});

test("importApprovedRows tags public-submission performances as community trust, not official", () => {
  const importFunctionStart = ingestionEngineSource.indexOf("export async function importApprovedRows");
  const importFunctionEnd = ingestionEngineSource.indexOf("export async function reverseImportedJob");
  assert.ok(importFunctionStart > -1 && importFunctionEnd > importFunctionStart, "importApprovedRows must be found before reverseImportedJob to isolate its source.");
  const importFunctionSource = ingestionEngineSource.slice(importFunctionStart, importFunctionEnd);
  assert.ok(importFunctionSource.includes("isPublicSubmission"), "Import must distinguish public submissions from admin-controlled sources.");
  assert.ok(/source_type:\s*sourceType/.test(importFunctionSource), "The saved performance's source_type must not be hardcoded to \"official\" regardless of where the row came from.");
});

test("the public submit-results page and script exist with the expected safety markers", () => {
  includesAll(
    submitResultsPageSource,
    ["/submit-results/", 'name="meet_name"', 'name="meet_date"', 'name="submitter_name"', 'name="submitter_email"', "submit-results-honeypot", 'name="website"'],
    "Public submit-results page"
  );
  includesAll(
    submitResultsScriptSource,
    ["/api/results-submissions", "fileAsBase64"],
    "Public submit-results client script"
  );
});

// Found 2026-08-31 pasting a real, 959-row Athletic.net "Elite
// Performances" export (Bob Schul Invitational) -- it produced zero
// staged rows. Two real, distinct gaps, both fixed in
// lib/result_parsers.mjs: Athletic.net prints the raw grade number
// (9/10/11/12) in its single-space-separated results, not FR/SO/JR/SR,
// and its section headers write the distance with a thousands-separator
// comma ("5,000 Meters"), which the event-detection regex does not
// treat as the same token as "5000".
test("a numeric-grade, single-space-separated row (Athletic.net's own export format) parses", () => {
  const text = [
    "Boys DI-II 5,000 Meters",
    "============================================================================================",
    " Athlete Yr Team Mark H#",
    "============================================================================================",
    " 1 Logan Miller 11 Granville 16:08.0",
    " 2 Jack Rosson 12 Butler 16:18.4"
  ].join("\n");
  const rows = parsePastedOrDelimitedText(text, { sport: "cross_country", seasonYear: 2026 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].athleteName, "Logan Miller");
  assert.equal(rows[0].athleteGrade, "11");
  assert.equal(rows[0].schoolName, "Granville");
  assert.equal(rows[0].markText, "16:08.0");
  assert.equal(rows[0].gender, "boys", "The comma in \"5,000 Meters\" must not stop the event heading (and the gender embedded in it) from being recognized.");
  assert.equal(rows[0].eventCode, "xc_5k");
});

test("a HY-TEK Team Scores row does not leak as a fake individual result now that grade accepts a bare number", () => {
  // "2 Willard  53  3 11 12 13 14 16 17" -- rank, team, total, then
  // scoring places. Before the school-must-contain-a-letter guard, "11"
  // (one of the scoring places) matched the widened grade anchor and
  // the rest was staged as a fake finisher with a numeric "school name."
  const text = [
    " Athlete Yr Team Mark H#",
    "1 Old Fort                     21    1    2    5    6    7    8    9",
    "2 Willard                      53    3   11   12   13   14   16   17"
  ].join("\n");
  const rows = parsePastedOrDelimitedText(text, { sport: "cross_country", seasonYear: 2026 });
  assert.equal(rows.length, 0, "A team-score summary row must never be staged as an individual result.");
});

test("a real result row's school name is never mistaken for a run of scoring places", () => {
  const text = " 1 Logan Miller 11 Granville 16:08.0";
  const [row] = parsePastedOrDelimitedText(text, { sport: "cross_country", seasonYear: 2026, eventName: "5000" });
  assert.ok(row, "A genuine single-space result row must still parse.");
  assert.ok(/[A-Za-z]/.test(row.schoolName), "A real school name always contains a letter.");
});

test("a finisher's own place number (100, 200, 300...) is never mistaken for a new event heading", () => {
  // Found 2026-08-31 on a real 320-finisher Athletic.net race: place
  // "100" satisfies the same EVENT token list as "100 Meter Dash," so
  // every row from place 100 onward silently had its event/gender
  // context overwritten to an unrelated track event, mid cross-country
  // race, with no error or warning.
  const text = [
    "Boys DI-II 5,000 Meters",
    "============================================================================================",
    " Athlete Yr Team Mark H#",
    "============================================================================================",
    " 99 Jackson Shanley 9 Lebanon 19:24.9",
    " 100 Treson Henley 12 Franklin 19:25.0",
    " 200 Drew Glines 10 Oakwood 22:25.0",
    " 300 Jax Unrast 11 Russia 26:33.6"
  ].join("\n");
  const rows = parsePastedOrDelimitedText(text, { sport: "cross_country", seasonYear: 2026 });
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.gender, "boys", `Row for ${row.athleteName} lost its gender context.`);
    assert.equal(row.eventCode, "xc_5k", `Row for ${row.athleteName} was misclassified as a different event by its own place number.`);
  }
});
