// School and athlete names -> their Podium Watch pages (2026-11-11).
// Pure: builds an index from rows and answers lookups. Never guesses:
//   - a school name links only when it matches exactly one school (after
//     normalizing case, punctuation and spacing), and that school has a
//     published team page;
//   - an athlete links only when the exact name plus the school matches
//     exactly one public profile. A name without a school is never linked.
// lib/name_links_service.mjs loads the rows; api/links/index.js serves it.

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

// teams:   [{ slug, ohio_school_id }] published, live team pages
// schools: [{ id, school_name, city }] (ohio_schools); team_pages names too
// athletes:[{ slug, display_name, current_school_id }] public profiles
// aliases: { "School label": "ohio school id" } checked by hand
export function buildLinkIndex({ teams = [], schools = [], athletes = [], aliases = {} } = {}) {
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
    }
  }
  for (const [label, id] of Object.entries(aliases)) addLabel(label, id);
  const schoolByLabel = new Map();
  for (const [key, ids] of labels) if (ids.size === 1) schoolByLabel.set(key, [...ids][0]);

  const athleteKeys = new Map();
  for (const athlete of athletes) {
    if (!athlete.slug || !athlete.current_school_id) continue;
    const key = `${normalizeName(athlete.display_name)}|${athlete.current_school_id}`;
    athleteKeys.set(key, athleteKeys.has(key) ? null : athlete.slug); // null = two profiles share it
  }
  return { teamBySchool, schoolByLabel, athleteKeys };
}

export function schoolIdFor(index, label) {
  return index.schoolByLabel.get(normalizeName(label)) || null;
}

export function teamHrefForSchoolId(index, schoolId) {
  const slug = index.teamBySchool.get(schoolId);
  return slug ? `/teams/${slug}/` : null;
}

export function teamHrefForName(index, label) {
  const id = schoolIdFor(index, label);
  return id ? teamHrefForSchoolId(index, id) : null;
}

export function athleteHrefFor(index, name, schoolLabel) {
  const schoolId = schoolIdFor(index, schoolLabel);
  if (!schoolId || !normalizeName(name)) return null;
  const slug = index.athleteKeys.get(`${normalizeName(name)}|${schoolId}`);
  return slug ? `/athletes/${slug}/` : null;
}

export const LINK_LIMITS = { schools: 300, athletes: 400, ids: 100, length: 120 };

// Resolves one request: { s: [school labels], a: [[name, school]], i: [school ids] }.
export function resolveLinks(index, { s = [], a = [], i = [] } = {}) {
  const clip = (value) => String(value ?? "").slice(0, LINK_LIMITS.length);
  const schools = {};
  for (const label of s.slice(0, LINK_LIMITS.schools)) { const href = teamHrefForName(index, clip(label)); if (href) schools[label] = href; }
  const athletes = {};
  for (const pair of a.slice(0, LINK_LIMITS.athletes)) {
    if (!Array.isArray(pair)) continue;
    const href = athleteHrefFor(index, clip(pair[0]), clip(pair[1]));
    if (href) athletes[`${pair[0]}~${pair[1]}`] = href;
  }
  const ids = {};
  for (const id of i.slice(0, LINK_LIMITS.ids)) { const href = teamHrefForSchoolId(index, clip(id)); if (href) ids[id] = href; }
  return { schools, athletes, ids };
}
