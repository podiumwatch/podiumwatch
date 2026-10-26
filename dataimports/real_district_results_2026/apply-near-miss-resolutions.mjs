// Resolves the 65 near-misses from pr_update_report.json per the user's
// direct review:
//   (a) 10 confirmed same-person nickname/spelling matches -> rename the
//       roster entry to the real name and apply the real time as a PR
//       (same "only if faster" rule as the main update script).
//   (b) the remaining 55 (confirmed DIFFERENT people -- mostly siblings
//       or unrelated teammates sharing a surname) -> check whether that
//       real person already has their OWN entry anywhere on their real
//       team/category; if genuinely missing, add them as a new runner
//       (never replacing an existing one) with their real district time,
//       clearly marked as added from the real result, not originally
//       collected.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(pkgDir, "../..");
const candidatePath = path.join(root, "dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json");

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const parsed = JSON.parse(fs.readFileSync(path.join(pkgDir, "real_district_results_2026_parsed.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(pkgDir, "pr_update_report.json"), "utf8"));

function parseTimeToCentiseconds(timeStr) {
  const parts = timeStr.trim().split(":");
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number.parseFloat(part);
  return Math.round(seconds * 100);
}

// school|name -> full real row + race context (one real entry per person).
const realRowByKey = new Map();
for (const race of parsed.races) {
  for (const row of race.individualResults) {
    if (!row.time || /^(DNS|DNF)$/i.test(row.time)) continue;
    realRowByKey.set(`${row.school}|${row.name}`, { ...row, cs: parseTimeToCentiseconds(row.time), siteKey: race.siteKey, gender: race.gender, division: race.division });
  }
}

// (a) User-confirmed same-person matches.
const CONFIRMED = [
  { team: "Bellbrook", rosterName: "Josh Johnson", realName: "Joshua Johnson" },
  { team: "Beaver Local", rosterName: "Abram Rettos", realName: "Abe Rettos" },
  { team: "Lakeview", rosterName: "Brant Cunningham", realName: "Brandt Cunningham" },
  { team: "West Union", rosterName: "Tristan Bales", realName: "Tristen Bales" },
  { team: "Cardinal", rosterName: "Eliot Vincek", realName: "Elliot Vincek" },
  { team: "Riverdale", rosterName: "Giovanni Noascono", realName: "Gio Noascono" },
  { team: "John Glenn", rosterName: "Adelyn Kent", realName: "Addy Kent" },
  { team: "Akron SVSM", rosterName: "Madelyn Sellers", realName: "Maddie Sellers" },
  { team: "Smithville", rosterName: "Elisa Marullo", realName: "Elise Marullo" },
  { team: "Keystone", rosterName: "Emma Wilson", realName: "Amme Wilson" }
];

const renames = [];
for (const c of CONFIRMED) {
  const real = realRowByKey.get(`${c.team}|${c.realName}`);
  if (!real) { console.log(`SKIP (no real row found) ${c.team}: ${c.rosterName} -> ${c.realName}`); continue; }
  let found = false;
  for (const cat of Object.values(candidate.categories)) {
    for (const team of cat.teams) {
      if (team.name !== c.team) continue;
      const runner = team.runners.find((r) => r.name === c.rosterName);
      if (!runner) continue;
      found = true;
      const oldName = runner.name;
      const oldSeasonBest = runner.seasonBest;
      runner.name = c.realName;
      if (real.cs < runner.timeCentiseconds) {
        runner.seasonBest = real.time;
        runner.timeCentiseconds = real.cs;
      }
      renames.push({ team: c.team, from: oldName, to: c.realName, oldSeasonBest, newSeasonBest: runner.seasonBest });
    }
  }
  if (!found) console.log(`SKIP (roster runner not found) ${c.team}: ${c.rosterName}`);
}

// (b) Everything else in the near-miss report -- ensure the real person
// has their own roster entry; add only if genuinely absent.
const confirmedKeys = new Set(CONFIRMED.map((c) => `${c.team}|${c.rosterName}|${c.realName}`));
const toEnsure = report.possibleNearMisses.filter((n) => !confirmedKeys.has(`${n.team}|${n.rosterName}|${n.realName}`));

const added = [];
const alreadyPresent = [];
const notFound = [];
for (const n of toEnsure) {
  const real = realRowByKey.get(`${n.team}|${n.realName}`);
  if (!real) { notFound.push(n); continue; }
  const catKey = `${real.gender}_d${real.division}`;
  const cat = candidate.categories[catKey];
  if (!cat) { notFound.push({ ...n, reason: `no category ${catKey}` }); continue; }
  const team = cat.teams.find((t) => t.name === n.team);
  if (!team) { notFound.push({ ...n, reason: `no team "${n.team}" in ${catKey}` }); continue; }
  if (team.runners.some((r) => r.name === n.realName)) { alreadyPresent.push(n); continue; }
  team.runners.push({
    name: n.realName,
    grade: real.grade || null,
    graduationYear: null,
    seasonBest: real.time,
    timeCentiseconds: real.cs,
    athleticNetId: null,
    athleteUrl: null,
    resultUrl: null,
    meetName: null,
    meetDate: "2026-10-24",
    verificationStatus: "Added from real Oct 24, 2026 district result -- not in original roster collection",
    collectedAtEastern: null,
    notes: `Added 2026-10-26: distinct real teammate found via real district results, not originally collected (was flagged as a same-surname near-miss against "${n.rosterName}", confirmed a different person).`
  });
  added.push({ category: catKey, team: n.team, name: n.realName, seasonBest: real.time });
}

fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));

console.log(`=== ${renames.length} confirmed rename(s) applied ===`);
for (const r of renames) console.log(`${r.team}: "${r.from}" -> "${r.to}"${r.newSeasonBest !== r.oldSeasonBest ? ` (seasonBest ${r.oldSeasonBest} -> ${r.newSeasonBest})` : ""}`);

console.log(`\n=== ${added.length} new runner(s) added (confirmed missing from roster) ===`);
for (const a of added) console.log(`[${a.category}] ${a.team}: added "${a.name}" (${a.seasonBest})`);

console.log(`\n=== ${alreadyPresent.length} already present under their own name (no action) ===`);
for (const p of alreadyPresent) console.log(`${p.team}: "${p.realName}" already on roster`);

console.log(`\n=== ${notFound.length} could not be resolved (see reasons) ===`);
for (const nf of notFound) console.log(`${nf.team}: "${nf.realName}" -- ${nf.reason || "no matching real row"}`);

fs.writeFileSync(path.join(pkgDir, "near_miss_resolution_report.json"), JSON.stringify({ renames, added, alreadyPresent, notFound }, null, 2));
console.log(`\nWrote ${candidatePath}`);
console.log("Wrote near_miss_resolution_report.json");
