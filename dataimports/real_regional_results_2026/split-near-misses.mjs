// Splits the 181 regional PR near-misses into
//   (a) same school, same surname, same grade, first name a nickname or a
//       one-letter typo of the other
//   (b) everything else
// Read-only. Applies nothing. Writes near_miss_split_regionals.json next to this file.
// Run: node dataimports/real_regional_results_2026/split-near-misses.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const report = JSON.parse(fs.readFileSync(`${root}/dataimports/real_regional_results_2026/pr_update_report_regionals.json`, "utf8"));
const parsed = JSON.parse(fs.readFileSync(`${root}/dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json`, "utf8"));
const candidate = JSON.parse(fs.readFileSync(`${root}/dataimports/ohio_2026_xc_Claude_Code/ohio_2026_xc_full_statewide_2026.json`, "utf8"));
const legacy = JSON.parse(fs.readFileSync(`${root}/src/data/mock-regionals-2026.json`, "utf8"));

// Real rows by gender|school|name, plus the set of IDs that some roster runner already matched.
const realByKey = new Map();
for (const race of parsed.races) {
  for (const row of race.results) {
    realByKey.set(`${race.gender}|${row.school}|${row.name}`, { ...row, gender: race.gender, division: race.division, site: race.site });
  }
}

// Roster runners by dataset|category|team|name.
const rosterByKey = new Map();
const rosterIds = new Set();
for (const [catKey, cat] of Object.entries(candidate.categories)) {
  for (const team of cat.teams) {
    for (const r of team.runners) {
      rosterByKey.set(`candidate|${catKey}|${team.name}|${r.name}`, r);
      if (r.athleticNetId) rosterIds.add(String(r.athleticNetId));
    }
  }
}
for (const division of legacy.divisions) {
  const gender = String(division.gender).toLowerCase();
  const category = `${gender}_d${division.division}`;
  for (const region of Object.values(division.regions)) {
    for (const team of region.teams) for (const r of team.runners) rosterByKey.set(`legacy|${category}|${team.name}|${r.name}`, r);
    for (const r of region.individuals || []) rosterByKey.set(`legacy|${category}|${r.school}|${r.name}`, r);
  }
}

const NICKNAMES = [
  ["alex", "alexander", "alexandra", "alexis"], ["will", "william", "liam"], ["ben", "benjamin"], ["sam", "samuel", "samantha"],
  ["nick", "nicholas"], ["matt", "matthew"], ["mike", "michael"], ["josh", "joshua"], ["zach", "zachary", "zack"],
  ["jake", "jacob"], ["nate", "nathan", "nathaniel"], ["dan", "daniel", "danny"], ["andy", "andrew", "drew"], ["chris", "christopher", "christian"],
  ["tony", "anthony"], ["joe", "joseph", "joey"], ["tom", "thomas", "tommy"], ["jack", "john", "jackson", "johnny"], ["jim", "james", "jimmy"],
  ["charlie", "charles"], ["gabe", "gabriel"], ["kate", "katherine", "katie", "kathryn", "katelyn", "kaitlyn"], ["liz", "elizabeth", "eliza", "lizzie", "beth"],
  ["abby", "abigail"], ["maddie", "madison", "madeline", "madelyn"], ["ellie", "eleanor", "ella", "elle"], ["alli", "allison", "ally", "allie", "alison"],
  ["izzy", "isabella", "isabel", "isabelle", "bella"], ["max", "maxwell", "maximus"], ["ty", "tyler"], ["eli", "elijah", "elias"], ["cam", "cameron"],
  ["kenny", "kenneth"], ["rob", "robert", "bobby", "robbie"], ["ed", "edward", "eddie"], ["jon", "jonathan", "jonathon", "johnathan"], ["ricky", "richard", "rick"],
  ["greg", "gregory"], ["pat", "patrick"], ["tim", "timothy"], ["steve", "steven", "stephen"], ["dave", "david"], ["ryan", "ryann"], ["evie", "evelyn"],
  ["gracie", "grace"], ["livvy", "olivia", "liv"], ["lily", "lillian", "lilly"], ["sophie", "sophia"], ["emmy", "emma", "emily"], ["mia", "amelia"],
  ["lexi", "alexis", "alexa"], ["annie", "anna", "anne", "ann"], ["molly", "mary"], ["peggy", "margaret", "maggie", "meg"], ["jen", "jennifer", "jenna"],
  ["jessie", "jessica"], ["kim", "kimberly"], ["vicky", "victoria", "tori"], ["becca", "rebecca", "becky"], ["cassie", "cassandra"], ["nat", "natalie", "natalia"],
  ["brady", "bradley", "brad"], ["jeff", "jeffrey"], ["ken", "kendall"], ["bo", "beau"], ["aj", "a.j."], ["cj", "c.j."], ["tj", "t.j."], ["dj", "d.j."],
  ["mason", "mace"], ["brayden", "braydon", "braden"], ["kaden", "kaiden", "cayden"], ["jaxon", "jackson"], ["colin", "collin"], ["aiden", "aidan", "ayden"],
  ["caleb", "kaleb"], ["kristen", "kristin"], ["hailey", "haley", "hayley"], ["kaylee", "kayleigh", "kailey"], ["rylee", "riley", "ryleigh"],
  ["mackenzie", "kenzie", "mckenzie"], ["brooklyn", "brooke"], ["elena", "ellie"], ["gabby", "gabrielle", "gabriella"], ["frankie", "francis", "frances", "frank"],
];
const nickIndex = new Map();
for (const g of NICKNAMES) for (const n of g) nickIndex.set(n, g);

function norm(s) { return s.toLowerCase().replace(/[^a-z.]/g, ""); }
function dl1(a, b) {
  // Damerau-Levenshtein distance <= 1
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length === 1) return true;
    if (diffs.length === 2 && diffs[1] === diffs[0] + 1 && a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]]) return true;
    return false;
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}
function firstNameRule(rosterFirst, realFirst) {
  const a = norm(rosterFirst), b = norm(realFirst);
  if (!a || !b) return null;
  if (dl1(a, b)) return "one-letter typo";
  const g = nickIndex.get(a);
  if (g && g.includes(b)) return "nickname";
  if ((a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b))) return "nickname (short form)";
  return null;
}
function gradeOf(x) { return x?.grade ?? x?.classYear ?? x?.year ?? null; }
function normGrade(g) {
  if (g == null) return null;
  const s = String(g).trim().toLowerCase();
  const m = s.match(/\d+/);
  if (m) return m[0];
  return { fr: "9", so: "10", jr: "11", sr: "12" }[s.slice(0, 2)] ?? s;
}

const a = [], b = [];
for (const n of report.possibleNearMisses) {
  const gender = n.category.split("_")[0];
  const roster = rosterByKey.get(`${n.dataset}|${n.category}|${n.team}|${n.rosterName}`);
  const real = realByKey.get(`${gender}|${n.team}|${n.realName}`);
  const rGrade = normGrade(gradeOf(roster)), xGrade = normGrade(gradeOf(real));
  const rosterParts = n.rosterName.trim().split(/\s+/), realParts = n.realName.trim().split(/\s+/);
  const rule = firstNameRule(rosterParts[0], realParts[0]);
  const sameGrade = rGrade != null && xGrade != null && rGrade === xGrade;
  const notes = [];
  if (!roster) notes.push("roster row not found");
  if (!real) notes.push("regional row not found");
  const rosterId = roster?.athleticNetId ? String(roster.athleticNetId) : null;
  const realId = real?.athleticNetId ? String(real.athleticNetId) : null;
  if (rosterId && realId && rosterId !== realId) notes.push(`different Athletic.net IDs (${rosterId} vs ${realId})`);
  if (realId && rosterIds.has(realId) && realId !== rosterId) notes.push("regional ID already belongs to another roster runner");
  const row = {
    dataset: n.dataset, category: n.category, school: n.team, rosterName: n.rosterName, realName: n.realName,
    rosterGrade: gradeOf(roster), realGrade: gradeOf(real), oldPR: roster?.seasonBest ?? null, oldCs: roster?.timeCentiseconds ?? null,
    regionalTime: real?.time ?? null, regionalCs: real?.timeCentiseconds ?? null, faster: roster && real ? real.timeCentiseconds < roster.timeCentiseconds : null,
    rule, sameGrade, notes,
  };
  if (rule && sameGrade) a.push(row); else b.push(row);
}
fs.writeFileSync(`${root}/dataimports/real_regional_results_2026/near_miss_split_regionals.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rule: "(a) same school, same surname, same grade, first name a nickname or one-letter typo; (b) everything else. Nothing applied.", a, b }, null, 2));
console.log(`(a) ${a.length}   (b) ${b.length}   total ${a.length + b.length}`);
console.log("\n(a) rows:");
for (const r of a) console.log(`[${r.dataset} ${r.category}] ${r.school} | roster ${r.rosterName} (${r.rosterGrade}) | regional ${r.realName} (${r.realGrade}) | old ${r.oldPR} | regional ${r.regionalTime} | ${r.rule} | faster=${r.faster}${r.notes.length ? " | " + r.notes.join("; ") : ""}`);
const bWhy = {};
for (const r of b) { const k = r.rule ? (r.sameGrade ? "rule+grade?" : `first-name ${r.rule} but grade differs/unknown`) : "first name unrelated"; bWhy[k] = (bWhy[k] || 0) + 1; }
console.log("\n(b) breakdown:", bWhy);
const sample = candidate.categories[Object.keys(candidate.categories)[0]].teams[0].runners[0];
console.log("\nsample roster runner keys:", Object.keys(sample).join(", "));
