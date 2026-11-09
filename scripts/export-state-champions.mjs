// Writes src/data/state-champions-{year}.json from the imported official
// state results (the same data /state/{year}/ shows), for the static
// homepage. Run after the state import or any correction to it:
//   node --env-file=.env.local scripts/export-state-champions.mjs 2026
import fs from "node:fs";
const year = Number(process.argv[2]);
if (!year) { console.log("Usage: export-state-champions.mjs YEAR"); process.exit(1); }
const { loadSeasonHub } = await import("../lib/season_hub_service.mjs");
const hub = await loadSeasonHub({ stageKey: "state", year });
if (!hub) { console.log(`No ${year} state results.`); process.exit(1); }
const order = [...hub.races].sort((a, b) => (a.gender === b.gender ? a.division - b.division : a.gender === "girls" ? -1 : 1));
const out = {
  year,
  meet: { name: hub.stage.heading(year), date: hub.meets[0].meet_date, venue: hub.meets[0].venue_name || null, results_url: hub.meets[0].results_url || null },
  exported_at: new Date().toISOString(),
  races: order.map((race) => ({
    gender: race.gender,
    division: race.division,
    anchor: `${race.gender}-d${race.division}`,
    individual: race.runners[0] ? { name: race.runners[0].name, href: race.runners[0].href, school: race.runners[0].school, time: race.runners[0].mark_text } : null,
    team: race.teams[0] ? { school: race.teams[0].school, href: race.teams[0].href, score: race.teams[0].score } : null
  }))
};
fs.writeFileSync(`src/data/state-champions-${year}.json`, JSON.stringify(out, null, 2) + "\n");
console.log(out.races.map((r) => `${r.gender} D${r.division}: ${r.individual?.name} ${r.individual?.time} | ${r.team?.school} ${r.team?.score}`).join("\n"));
