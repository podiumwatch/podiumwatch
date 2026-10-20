// Resolves Hilliard Darby's 5 previously-ambiguous district races (Boys
// D2/D3/D4, Girls D2/D4 -- Girls D3 was always a single race, never
// ambiguous) using the real athletic.net entry list for meet 286386
// (hilliard_darby_race_entries_2026-10-20.json, parsed from the user's
// pasted text). For each team entered at HD, this sets a new field
// `districtRaceLabel` ("Race 1" / "Race 2") on the team object in
// ohio_2026_xc_full_statewide_2026.json, and restricts that team's
// roster down to only the runners actually entered in that specific
// session (matched by name against our existing roster's season bests
// -- the entry list decides WHO races, our own data decides the TIME).
//
// A team with fewer than 5 real entries in a session is NOT force-fit
// into a 5-person roster -- its roster here is capped to exactly its
// matched entries, so the existing `runners.length >= 5` rule already
// marks it correctly incomplete (individuals-only), with no special
// case needed in the scoring engine itself.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const entryData = JSON.parse(fs.readFileSync(path.join(pkgDir, "hilliard_darby_race_entries_2026-10-20.json"), "utf8"));

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

const report = { unmatchedRunners: [], divisionMismatches: [], notInEntryFile: [], notInOurData: [] };

// Group the 11 races by gender/division FIRST (both sessions, or the
// single Girls D3 race) -- a team only counts as "not in the real entry
// file" if it's missing from EVERY session of its own division, not
// just the one session being looked at first. Processing session-by-
// session and clearing districtSiteKey immediately was the bug: Boys D2
// Session 1's cleanup pass wrongly stripped every Session-2-only team
// (Big Walnut, Bexley, etc.) before Session 2 ever got a chance to find
// them, corrupting the whole dataset. This cost a full regenerate-and-
// reapply of every prior fix to recover from.
const racesByGenderDiv = new Map();
for (const race of entryData.races) {
  const key = `${race.gender}|${race.division}`;
  if (!racesByGenderDiv.has(key)) racesByGenderDiv.set(key, []);
  racesByGenderDiv.get(key).push(race);
}

for (const [, racesForDivision] of racesByGenderDiv) {
  const { gender, division } = racesForDivision[0];
  const cat = Object.values(data.categories).find((c) => c.gender.toLowerCase() === gender && c.division === `D${division}`);
  if (!cat) continue;

  const allEnteredTeamNames = new Set();
  for (const race of racesForDivision) {
    const raceLabel = division === 3 && gender === "girls" ? null : (race.session === 1 ? "Race 1" : "Race 2");
    const entriesByTeam = new Map();
    for (const e of race.entries) {
      if (!entriesByTeam.has(e.team)) entriesByTeam.set(e.team, []);
      entriesByTeam.get(e.team).push(e);
    }

    for (const [teamName, entries] of entriesByTeam) {
      allEnteredTeamNames.add(teamName);
      const team = cat.teams.find((t) => t.name === teamName);
      if (!team) {
        let foundElsewhere = null;
        for (const otherCat of Object.values(data.categories)) {
          const t = otherCat.teams.find((t) => t.name === teamName);
          if (t) { foundElsewhere = `${otherCat.gender} ${otherCat.division}`; break; }
        }
        report.notInOurData.push(`${gender} D${division} ${raceLabel || ""}: "${teamName}" (${entries.length} entries) -- ${foundElsewhere ? `our data has it at ${foundElsewhere} instead` : "not in our data at all"}`);
        continue;
      }
      if (team.districtSiteKey !== "HD") {
        report.divisionMismatches.push(`${gender} D${division}: "${teamName}" entered at HD per athletic.net, but our data has it at districtSiteKey=${team.districtSiteKey || "(none)"}`);
        continue;
      }
      team.districtRaceLabel = raceLabel;
      const matchedRunners = [];
      const ourByName = new Map(team.runners.map((r) => [normName(r.name), r]));
      for (const e of entries) {
        const match = ourByName.get(normName(e.name));
        if (match) matchedRunners.push(match);
        else report.unmatchedRunners.push(`${teamName} (${gender} D${division} ${raceLabel || ""}): "${e.name}" entered, not in our roster for this team`);
      }
      team.runners = matchedRunners;
    }
  }

  // Only now, after BOTH sessions have been scanned, decide a team is
  // genuinely absent from the real entry file.
  for (const team of cat.teams) {
    if (team.districtSiteKey === "HD" && !allEnteredTeamNames.has(team.name)) {
      report.notInEntryFile.push(`${gender} D${division}: "${team.name}" is in our data at HD, not in the real entry file -- treating as not entered`);
      team.districtSiteKey = undefined;
    }
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(pkgDir, "hd_race_split_report.json"), JSON.stringify(report, null, 2));

console.log(`=== Not in our data at all (${report.notInOurData.length}) ===`);
console.log(report.notInOurData.join("\n"));
console.log(`\n=== Division/site mismatches (${report.divisionMismatches.length}) ===`);
console.log(report.divisionMismatches.join("\n"));
console.log(`\n=== In our data at HD, not in real entry file (${report.notInEntryFile.length}) ===`);
console.log(report.notInEntryFile.join("\n"));
console.log(`\n=== Entered runners missing from our roster (${report.unmatchedRunners.length}) ===`);
console.log(report.unmatchedRunners.join("\n"));
console.log(`\nWrote ${dataPath} and hd_race_split_report.json`);
