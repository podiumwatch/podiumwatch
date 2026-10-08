// Builds the "overall" Top 10 by grade -- the ten fastest season-best
// times per grade, per gender, across ALL divisions combined (not split
// by division the way build-top10-combined.mjs's output is). Reuses the
// exact same pool-building, merge, and dedup logic as that script
// (same source files, same ALIAS fix, same Levenshtein/name-fallback
// merge) -- the only real difference is the final grouping key drops
// division entirely: `${gender}-${grade}` instead of
// `${gender}-${div}-${grade}`.
import fs from "node:fs";
const dir = "dataimports/mock-meet-export/";
const toCs = (t) => { const m = String(t).match(/^(\d+):(\d{2})\.(\d+)$/); return Number(m[1]) * 6000 + Number(m[2]) * 100 + Number(m[3].padEnd(2, "0").slice(0, 2)); };
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const lev = (a, b) => { const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) dp[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return dp[a.length][b.length]; };
const ALIAS = { "Central Christian (Kidron)": "Kid. Cent. Christian", "St Joseph Academy": "Cle. St. Joseph Acad." };
const schoolKey = (s) => (ALIAS[s] || s).replace(/\s*\(OH\)$/, "").trim();
const GRADE = { Freshman: "9", Sophomore: "10", Junior: "11", Senior: "12" };
const GRADES = new Set(["9", "10", "11", "12"]);

const AN = {
  "boys-1": ["Athletic Net - d1boys.csv", "Milesplit - d1boys.csv", "plain"], "boys-2": ["Athletic Net - d2 boys.csv", "Milesplit - d2boys.csv", "plain"],
  "boys-3": ["Athletic Net - d3 boys.csv", "Milesplit - d3boys.csv", "plain"], "boys-4": ["d4-boys-full.csv", "milesplitd4final.csv", "d4boys"],
  "girls-1": ["Athletic Net - d1girls.csv", "Milesplit - d1girls.csv", "plain"], "girls-2": ["Athletic Net - d2girls.csv", "Milesplit - d2girls.csv", "plain"],
  "girls-3": ["Athletic Net - d3 girls.csv", "Milesplit - d3girls.csv", "d3girls"], "girls-4": ["d4girlsanet - Sheet1.csv", "d4girlsmilesplit - Sheet2.csv", "d4girls"],
};

const pool = [];
for (const [key, [anF, msF, fmt]] of Object.entries(AN)) {
  const ms = new Map();
  for (const line of fs.readFileSync(dir + msF, "utf8").split(/\r?\n/).filter(Boolean)) {
    const c = line.split(",").map((s) => s.trim());
    let a, s, t;
    if (fmt === "d4boys" || fmt === "d4girls") { if (c.length < 6) continue; [s, a, t] = [c[0], c[4], c[5]]; }
    else { [a, s, , t] = c; }
    if (!a || !t || !/^\d+:\d{2}\.\d+$/.test(t)) continue;
    const k = schoolKey(s) + "|" + norm(a);
    const cs = toCs(t);
    if (!ms.has(k) || cs < ms.get(k).cs) ms.set(k, { cs, t });
  }
  let lines = fs.readFileSync(dir + anF, "utf8").split(/\r?\n/).filter(Boolean);
  if (fmt === "d4boys" || fmt === "d3girls") lines = lines.slice(1);
  for (const l of lines) {
    const p = (fmt === "d4girls" ? l.split("|") : l.split(",")).map((x) => x.trim());
    let a, school, grade, mark;
    if (fmt === "d3girls") [a, mark, grade, school] = p;
    else [a, school, grade, mark] = p;
    if (!a || !GRADES.has(grade)) continue;
    a = a.replace(/^\*/, "").trim();
    let cs = toCs(mark), t = mark;
    const hit = ms.get(schoolKey(school) + "|" + norm(a));
    if (hit && hit.cs < cs - 10) { cs = hit.cs; t = hit.t; }
    pool.push({ name: a, school: schoolKey(school), grade, time: t, cs, gender: key.split("-")[0], div: key.split("-")[1], src: "AN" });
  }
}

const xml = fs.readFileSync(dir + "milesplit-top10-sheet2.xml", "utf8");
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
for (const r of xml.matchAll(/<x:row r="(\d+)"[^>]*>([\s\S]*?)<\/x:row>/g)) {
  if (Number(r[1]) < 6) continue;
  const cells = {};
  for (const c of r[2].matchAll(/<x:c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/x:c>)/g)) {
    const v = (c[2] || "").match(/<x:v>([\s\S]*?)<\/x:v>/) || (c[2] || "").match(/<x:t[^>]*>([\s\S]*?)<\/x:t>/);
    cells[c[1]] = v ? dec(v[1]) : "";
  }
  const division = cells.A || "", gender = cells.B || "", grade = cells.C || "", athlete = cells.E || "", team = cells.F || "", time = cells.G || "";
  if (!athlete || !GRADE[grade] || !division) continue;
  const cs = Math.round(Number(time) * 86400 * 100);
  const m = Math.floor(cs / 6000), sec = (cs % 6000) / 100;
  pool.push({ name: athlete, school: schoolKey(team), grade: GRADE[grade], time: `${m}:${sec.toFixed(1).padStart(4, "0")}`, cs, gender: gender.toLowerCase().startsWith("g") ? "girls" : "boys", div: division.replace("Division ", ""), src: "MileSplit" });
}

// Same Margaretta/boys-4 fix as build-top10-combined.mjs (see there for
// why): their boys team is really Division III for 2026-27, but the
// MileSplit D4 source file is stale from 2025-26, so without this filter
// Cole Zang (and the rest of the Margaretta boys roster) would be counted
// twice in this pooled-across-divisions list -- once correctly from the
// D3 source, once from the stale D4 one.
const EXCLUDE_FROM_DIVISION = new Set(["boys-4|margaretta"]);
const filteredPool = pool.filter((r) => !EXCLUDE_FROM_DIVISION.has(`${r.gender}-${r.div}|${norm(r.school)}`));

// Only real difference from build-top10-combined.mjs: group by
// `${gender}-${grade}` -- division is dropped entirely here, so each
// grade's list is the fastest 10 across every division combined.
const groups = {};
for (const r of filteredPool) (groups[`${r.gender}-${r.grade}`] ||= []).push(r);
const result = { boys: {}, girls: {} };
const shortLists = [];
for (const [k, rows] of Object.entries(groups)) {
  rows.sort((a, b) => a.cs - b.cs);
  const merged = [];
  for (const r of rows) {
    const n = norm(r.name);
    const last = norm(r.name.split(/\s+/).slice(-1)[0]);
    const first = norm(r.name.split(/\s+/)[0] || "");
    const hit = merged.find((m) => m.school === r.school && (m.key === n || lev(m.key, n) <= 2 || (m.last === last && Math.min(m.first.length, first.length) >= 3 && (m.first.startsWith(first) || first.startsWith(m.first)))));
    if (hit) { hit.sources.add(r.src); continue; }
    merged.push({ key: n, last, first, name: r.name, school: r.school, grade: r.grade, time: r.time, cs: r.cs, sources: new Set([r.src]) });
  }
  const list = merged.slice(0, 10).map((m) => ({ name: m.name, school: m.school, grade: m.grade, time: m.time }));
  if (list.length < 10) shortLists.push(`${k} (${list.length})`);
  const [gender, grade] = k.split("-");
  result[gender][grade] = list;
}
for (const gender of ["boys", "girls"]) for (const g of ["9", "10", "11", "12"]) {
  result[gender][g] ||= [];
}

fs.writeFileSync(
  "src/data/top10-overall-by-grade-2026.json",
  JSON.stringify({
    season: "2026",
    source: "Athletic.net individual season-best lists and the MileSplit 2026 grade rankings, combined by runner across every division. The fastest time for each runner across both sources is used. Grade comes from either source.",
    lists: result
  }, null, 2) + "\n"
);
console.log("pool rows:", pool.length, "| lists short of 10:", shortLists.length ? shortLists : "none");
