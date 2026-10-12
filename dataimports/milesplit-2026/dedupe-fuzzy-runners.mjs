// Fixes real duplicate-person bugs the user caught on the live site: the
// same real runner recorded under two slightly different spellings in the
// two merged sources (a typo, a nickname, a malformed "(Nickname)" artifact
// from the original MileSplit export) was never caught by the exact-name
// dedup in merge-top75-into-roster.mjs, so both entries survived -- one of
// them inflating the scoring five and shifting every place behind it.
//
// Detection: within one team's roster, flag two runners as the same real
// person only when (a) first name is an exact match and last name is a
// close (edit distance 1-2) misspelling, or (b) last name is an exact match
// and first names are identical, a known nickname pair, or a 1-character
// typo. Never flags two runners whose first AND last names both differ
// meaningfully (that's two real teammates/siblings, not a duplicate).
// Groups are built by transitive closure (so a 3-way chain like
// "Alyssandra 'Grace' Peirano" / "Alyssandra (Grace) Periano" / "Alyssandra
// Peirano" collapses to one person), and each group keeps the single real
// recorded time that is fastest -- never an invented or averaged time.
import fs from "node:fs";

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const NICK = {
  zach: "zachary", zac: "zachary", zachery: "zachary",
  josh: "joshua", will: "william", sam: "samuel", sammy: "samuel",
  matt: "matthew", gabe: "gabriel", nate: "nathan", nick: "nicholas", nico: "nicholas",
  mike: "michael", ben: "benjamin", chris: "christopher", jon: "jonathan", jonathon: "jonathan",
  alex: "alexander", max: "maxwell", andy: "andrew", drew: "andrew",
  landin: "landon", landen: "landon",
  tony: "anthony", issac: "isaac", colten: "colton", jake: "jacob",
  liz: "elizabeth", maddy: "madelyn", maddie: "madelyn", madison: "madelyn",
  katie: "katherine", kate: "katherine", addie: "adeline", addi: "adeline",
  abby: "abigail", ester: "esther", brooklyn: "brooklynn",
  conner: "connor", presten: "preston", leej: "lj",
  everrett: "everett", joe: "joseph", harry: "harrison", avee: "avelyn",
  lexi: "alexis", lexie: "alexis", allie: "allison", ally: "allison",
  madeline: "madelyn", madi: "madelyn",
  kaitlin: "katherine", caitlin: "katherine", katelyn: "katherine",
  libby: "elizabeth", lizzie: "elizabeth", beth: "elizabeth"
};
const canon = (name) => { const n = norm(name); return NICK[n] || n; };
const parts = (name) => name.replace(/["'(),.]/g, " ").trim().split(/\s+/).filter(Boolean);

function isDuplicatePair(a, b) {
  const pa = parts(a.name), pb = parts(b.name);
  const lastA = norm(pa[pa.length - 1]), lastB = norm(pb[pb.length - 1]);
  const firstA = norm(pa[0]), firstB = norm(pb[0]);
  const firstExact = firstA === firstB;
  const lastExact = lastA === lastB;
  const lastDist = lev(lastA, lastB);
  const firstDist1 = lev(firstA, firstB) <= 1;
  const firstCanonMatch = canon(pa[0]) === canon(pb[0]);
  const ruleA = firstExact && lastDist >= 1 && lastDist <= 2;
  const ruleB = lastExact && (firstCanonMatch || firstDist1);
  return ruleA || ruleB;
}

// Prefer a "clean" name string when times are close: no stray punctuation
// artifacts, proper capitalization, not literally truncated.
function nameQuality(n) {
  let score = 0;
  if (/^[A-Z]/.test(n)) score += 2; // starts uppercase
  if (!/[()".]/.test(n)) score += 2; // no leftover punctuation
  if (n === n.trim()) score += 1;
  score -= Math.max(0, n.length - 25) * 0; // no length penalty, just structure
  return score;
}

const path = "src/data/mock-regionals-2026.json";
const mock = JSON.parse(fs.readFileSync(path, "utf8"));

let totalGroups = 0;
let totalRemoved = 0;
const report = [];

for (const division of mock.divisions) {
  for (const [regionKey, region] of Object.entries(division.regions)) {
    for (const team of region.teams) {
      const n = team.runners.length;
      if (n < 2) continue;
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      const union = (x, y) => { const rx = find(x), ry = find(y); if (rx !== ry) parent[rx] = ry; };
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (isDuplicatePair(team.runners[i], team.runners[j])) union(i, j);
        }
      }
      const groups = new Map();
      for (let i = 0; i < n; i++) {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(i);
      }
      const keepIndices = new Set();
      let changed = false;
      for (const idxs of groups.values()) {
        if (idxs.length === 1) { keepIndices.add(idxs[0]); continue; }
        changed = true;
        totalGroups++;
        // keep the fastest real time; break ties by name "quality"
        let best = idxs[0];
        for (const i of idxs) {
          const r = team.runners[i], b = team.runners[best];
          if (r.timeCentiseconds < b.timeCentiseconds) best = i;
          else if (r.timeCentiseconds === b.timeCentiseconds && nameQuality(r.name) > nameQuality(team.runners[best].name)) best = i;
        }
        keepIndices.add(best);
        totalRemoved += idxs.length - 1;
        report.push(`${division.label} / ${team.name}: ${idxs.map((i) => `"${team.runners[i].name}" (${team.runners[i].seasonBest})`).join(" = ")} -> kept "${team.runners[best].name}" (${team.runners[best].seasonBest})`);
      }
      if (changed) {
        team.runners = team.runners.filter((_, i) => keepIndices.has(i)).sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);
      }
    }
  }
}

mock.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path, JSON.stringify(mock, null, 2) + "\n");

console.log(`Collapsed ${totalGroups} duplicate-person group(s), removing ${totalRemoved} extra entr${totalRemoved === 1 ? "y" : "ies"}:`);
report.forEach((r) => console.log(" -", r));
