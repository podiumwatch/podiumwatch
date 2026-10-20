// Full-roster duplicate-identity scan across all 8,158 runners in
// ohio_2026_xc_full_statewide_2026.json, per the user's 2026-10-20
// request. Flags candidate pairs WITHIN THE SAME TEAM only (a
// same-named pair on two different schools is not a duplicate). Never
// merges anything -- only reports, for the user to confirm each one
// individually, same as the 7-item list already reviewed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), "utf8"));

// Common nickname <-> full-name pairs. Deliberately conservative --
// missing a real pair just means it isn't flagged (safe); a wrong pair
// here would only ever surface as a candidate for the user to reject,
// never an auto-merge.
const NICKNAME_GROUPS = [
  ["ben", "benjamin"], ["andy", "andrew", "drew"], ["tony", "anthony"],
  ["maddy", "maddie", "madelyn", "madeline", "madison"], ["zach", "zachary", "zack", "zac"],
  ["alex", "alexander", "alexandra"], ["nick", "nicholas", "nicolas"], ["will", "william", "liam"],
  ["matt", "matthew"], ["sam", "samuel", "samantha"], ["josh", "joshua"], ["mike", "michael", "mikey"],
  ["chris", "christopher", "christian"], ["dan", "danny", "daniel"], ["jake", "jacob"], ["joe", "joey", "joseph"],
  ["tom", "tommy", "thomas"], ["nate", "nathan", "nathaniel"], ["cal", "calvin"], ["abby", "abbie", "abigail"],
  ["katie", "katy", "kate", "kathryn", "katherine"], ["liz", "lizzy", "elizabeth", "beth", "betsy", "eliza"],
  ["maggie", "margaret"], ["izzy", "isabella", "isabelle", "izzie"], ["lily", "lilly", "lillian"],
  ["addie", "addi", "addison"], ["jj", "jaylen"], ["charlie", "charles", "chuck"], ["jim", "jimmy", "james"],
  ["bob", "bobby", "robert", "rob"], ["dave", "david"], "ted,theodore".split(","), ["ed", "eddie", "edward"],
  ["pat", "patty", "patricia", "patrick"], ["steve", "steven", "stephen"], ["greg", "gregory"],
  ["ken", "kenny", "kenneth"], ["gabe", "gabriel"], ["jon", "jonathan", "john", "johnny"],
  ["evie", "eve", "evelyn"], ["ellie", "elle", "eleanor", "ella"], ["gracie", "grace"],
  ["sophie", "sophia"], ["ava", "avery"], ["ani", "annie", "anna", "ann", "anne"], ["mia", "amelia", "mya"],
  ["olive", "olivia"], ["emma", "emily", "em"], ["hallie", "hailey", "haylee", "haley"]
];
const NICKNAME_OF = new Map();
for (const group of NICKNAME_GROUPS) {
  for (const name of group) NICKNAME_OF.set(name, new Set(group));
}
function isNicknamePair(a, b) {
  const group = NICKNAME_OF.get(a);
  return !!group && group.has(b);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function splitName(full) {
  const parts = full.trim().split(/\s+/);
  const first = (parts[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  const last = (parts.slice(1).join(" ") || "").toLowerCase().replace(/[^a-z]/g, "");
  return { first, last };
}

const flags = [];
for (const cat of Object.values(data.categories)) {
  for (const team of cat.teams) {
    const runners = team.runners;
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const a = runners[i], b = runners[j];
        const na = splitName(a.name), nb = splitName(b.name);
        const lastClose = na.last === nb.last || (na.last && nb.last && levenshtein(na.last, nb.last) <= 2);
        const firstClose = na.first === nb.first || isNicknamePair(na.first, nb.first) || (na.first && nb.first && levenshtein(na.first, nb.first) <= 1);
        if (lastClose && firstClose) {
          flags.push({
            type: "name-match", gender: cat.gender, division: cat.division, school: team.name,
            a: `${a.name} (${a.seasonBest})`, b: `${b.name} (${b.seasonBest})`,
            aUrl: a.athleteUrl, bUrl: b.athleteUrl
          });
        }
        if (a.seasonBest && a.seasonBest === b.seasonBest) {
          flags.push({
            type: "identical-time", gender: cat.gender, division: cat.division, school: team.name,
            a: `${a.name} (${a.seasonBest})`, b: `${b.name} (${b.seasonBest})`,
            aUrl: a.athleteUrl, bUrl: b.athleteUrl
          });
        }
      }
    }
  }
}

console.log(`Found ${flags.length} candidate flag(s) across ${Object.values(data.categories).reduce((n, c) => n + c.teams.length, 0)} teams.\n`);
for (const f of flags) {
  console.log(`[${f.type}] ${f.gender} ${f.division} ${f.school}: "${f.a}" vs "${f.b}"`);
  if (f.type === "name-match") console.log(`   ${f.aUrl}  |  ${f.bUrl}`);
}
fs.writeFileSync(path.join(pkgDir, "duplicate_runner_scan.json"), JSON.stringify(flags, null, 2));
