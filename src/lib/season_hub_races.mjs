// Pure helpers for the season results hubs (WO-37), kept free of the
// database client so tests can import them. lib/season_hub_service.mjs
// loads the rows; these only group and sort them.

const ROMAN = { 1: "Division I", 2: "Division II", 3: "Division III", 4: "Division IV" };
const DIVISION_NUMBER = { "Division I": 1, "Division II": 2, "Division III": 3, "Division IV": 4 };

// Pure: group performance and team rows into races (meet x gender x
// division), sorted the way the official results are.
export function buildRaces({ meets, performances, teamScores, year }) {
  const metaKey = `postseason_${year}`;
  const races = new Map();
  const raceFor = (meetId, gender, division, session = null) => {
    const key = `${meetId}|${gender}|${division}|${session || ""}`;
    if (!races.has(key)) {
      const meet = meets.find((m) => m.id === meetId);
      races.set(key, { key, meet, gender, division, session, divisionLabel: ROMAN[division], runners: [], teams: [] });
    }
    return races.get(key);
  };
  for (const p of performances) {
    const meta = p.metadata?.[metaKey];
    if (!meta?.gender || !meta?.division || p.place == null) continue;
    raceFor(p.meet_id, meta.gender, Number(meta.division), meta.session ? Number(meta.session) : null).runners.push(p);
  }
  for (const t of teamScores) {
    const division = DIVISION_NUMBER[t.division];
    if (!division || !t.gender) continue;
    const session = Number((String(t.provider_event_id || "").match(/-session-(\d+)$/) || [])[1]) || null;
    raceFor(t.meet_id, t.gender, division, session).teams.push(t);
  }
  const genderOrder = { girls: 0, boys: 1 };
  return [...races.values()]
    .map((race) => ({
      ...race,
      runners: race.runners.sort((a, b) => Number(a.place) - Number(b.place)),
      teams: race.teams.sort((a, b) => (a.place_numeric ?? 9999) - (b.place_numeric ?? 9999))
    }))
    .sort((a, b) => String(a.meet?.name).localeCompare(String(b.meet?.name)) || a.division - b.division || genderOrder[a.gender] - genderOrder[b.gender] || (a.session || 0) - (b.session || 0));
}

// Pure: the fastest official times across races of one gender (same
// course and day at state, so they compare directly).
export function fastestTimes(races, gender, limit = 10) {
  return races
    .filter((race) => race.gender === gender)
    .flatMap((race) => race.runners.filter((r) => Number.isFinite(Number(r.mark_value)) && r.mark_unit === "seconds").map((r) => ({ ...r, race })))
    .sort((a, b) => Number(a.mark_value) - Number(b.mark_value))
    .slice(0, limit);
}
