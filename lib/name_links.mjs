// School and athlete names -> their Podium Watch pages (2026-11-11).
// Pure: builds an index from rows and answers lookups. Never guesses:
//   - a school name links only when it matches exactly one school (after
//     normalizing case, punctuation and spacing), and that school has a
//     published team page;
//   - an athlete links only when the exact name plus the school matches
//     exactly one public profile. A name without a school is never linked.
// lib/name_links_service.mjs loads the rows; api/links/index.js serves it.
import { labelSchool } from "../src/lib/school_labels.mjs";

export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "Division I", "D2", "3", "IV" -> 1..4; anything else -> null.
export function parseDivision(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:division\s*|div\.?\s*|d)?(iv|i{1,3}|[1-4])$/i) || text.match(/\bdivision\s+(iv|i{1,3}|[1-4])\b/i) || text.match(/\bd([1-4])\b/i);
  if (!match) return null;
  const token = match[1].toLowerCase();
  return { i: 1, ii: 2, iii: 3, iv: 4 }[token] || Number(token) || null;
}

// teams:   [{ slug, ohio_school_id }] published, live team pages
// schools: [{ id, school_name, city }] (ohio_schools)
// athletes:[{ slug, display_name, current_school_id }] public profiles
// aliases: { "School label": "ohio school id" } checked by hand
// divisions: [{ school_id, gender, division }] current cross country
//   divisions (ohio_school_divisions). A label that matches more than one
//   school links only when the row's division (and gender, when the row
//   has one) matches exactly one of those schools (Zachary, 2026-11-11).
export function parseGender(value) {
  const text = String(value ?? "").toLowerCase();
  if (/\bgirls?\b|\bwomen\b/.test(text)) return "girls";
  if (/\bboys?\b|\bmen\b/.test(text)) return "boys";
  return null;
}

export function buildLinkIndex({ teams = [], schools = [], athletes = [], aliases = {}, divisions = [] } = {}) {
  const teamBySchool = new Map();
  for (const team of teams) if (team.ohio_school_id && team.slug && !teamBySchool.has(team.ohio_school_id)) teamBySchool.set(team.ohio_school_id, team.slug);

  // Label -> set of school ids; more than one id means ambiguous (skipped).
  const labels = new Map();
  const addLabel = (label, id) => {
    const key = normalizeName(label);
    if (!key || !id) return;
    if (!labels.has(key)) labels.set(key, new Set());
    labels.get(key).add(id);
  };
  for (const school of schools) {
    addLabel(school.school_name, school.id);
    if (school.city) {
      addLabel(`${school.city} ${school.school_name}`, school.id);
      addLabel(`${school.school_name} (${school.city})`, school.id);
      const shown = labelSchool(school.school_name, school.city);
      if (shown && shown !== school.school_name) addLabel(shown, school.id);
    }
  }
  for (const [label, id] of Object.entries(aliases)) addLabel(label, id);
  const schoolByLabel = new Map();
  const ambiguous = new Set();
  for (const [key, ids] of labels) {
    if (ids.size === 1) schoolByLabel.set(key, [...ids][0]);
    else ambiguous.add(key);
  }
  // Ambiguous label -> its candidate schools, for the division rule.
  const candidates = new Map();
  for (const key of ambiguous) candidates.set(key, [...labels.get(key)]);
  const divisionsBySchool = new Map();
  for (const row of divisions) {
    const division = parseDivision(row.division);
    if (!row.school_id || !division) continue;
    if (!divisionsBySchool.has(row.school_id)) divisionsBySchool.set(row.school_id, []);
    divisionsBySchool.get(row.school_id).push({ gender: parseGender(row.gender), division });
  }

  const athleteKeys = new Map();
  for (const athlete of athletes) {
    if (!athlete.slug || !athlete.current_school_id) continue;
    const key = `${normalizeName(athlete.display_name)}|${athlete.current_school_id}`;
    athleteKeys.set(key, athleteKeys.has(key) ? null : athlete.slug); // null = two profiles share it
  }
  return { teamBySchool, schoolByLabel, candidates, divisionsBySchool, athleteKeys };
}

// context: "2", "2:girls", "Division II", or { division, gender }.
export function parseContext(context) {
  if (context && typeof context === "object") return { division: parseDivision(context.division), gender: parseGender(context.gender) };
  const [division, gender] = String(context ?? "").split(":");
  return { division: parseDivision(division), gender: parseGender(gender) };
}

export function schoolIdFor(index, label, context = null) {
  const key = normalizeName(label);
  const unique = index.schoolByLabel.get(key);
  if (unique) return unique;
  const { division, gender } = parseContext(context);
  const list = division ? index.candidates?.get(key) : null;
  if (!list) return null;
  const fits = list.filter((id) => (index.divisionsBySchool.get(id) || []).some((row) => row.division === division && (!gender || row.gender === gender)));
  return fits.length === 1 ? fits[0] : null;
}

export function teamHrefForSchoolId(index, schoolId) {
  const slug = index.teamBySchool.get(schoolId);
  return slug ? `/teams/${slug}/` : null;
}

export function teamHrefForName(index, label, division = null) {
  const id = schoolIdFor(index, label, division);
  return id ? teamHrefForSchoolId(index, id) : null;
}

export function athleteHrefFor(index, name, schoolLabel, division = null) {
  const schoolId = schoolIdFor(index, schoolLabel, division);
  if (!schoolId || !normalizeName(name)) return null;
  const slug = index.athleteKeys.get(`${normalizeName(name)}|${schoolId}`);
  return slug ? `/athletes/${slug}/` : null;
}

export const LINK_LIMITS = { schools: 300, athletes: 400, ids: 100, length: 120 };

// Resolves one request: { s: ["School" or "School@2" or "School@2:girls"], a: [[name, school, "2:girls"?]], i: [school ids] }.
// Answers are keyed exactly as asked.
export function resolveLinks(index, { s = [], a = [], i = [] } = {}) {
  const clip = (value) => String(value ?? "").slice(0, LINK_LIMITS.length);
  const schools = {};
  for (const entry of s.slice(0, LINK_LIMITS.schools)) {
    const at = String(entry).lastIndexOf("@");
    const [label, division] = at > 0 ? [entry.slice(0, at), entry.slice(at + 1)] : [entry, null];
    const href = teamHrefForName(index, clip(label), division);
    if (href) schools[entry] = href;
  }
  const athletes = {};
  for (const pair of a.slice(0, LINK_LIMITS.athletes)) {
    if (!Array.isArray(pair)) continue;
    const href = athleteHrefFor(index, clip(pair[0]), clip(pair[1]), pair[2] ?? null);
    if (href) athletes[pair.join("~")] = href;
  }
  const ids = {};
  for (const id of i.slice(0, LINK_LIMITS.ids)) { const href = teamHrefForSchoolId(index, clip(id)); if (href) ids[id] = href; }
  return { schools, athletes, ids };
}
