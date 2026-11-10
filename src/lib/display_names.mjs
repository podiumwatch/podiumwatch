// How athlete and school names are shown (Zachary, 2026-11-09). Pure, so
// the build, server pages, APIs and tests all agree.
//
// Athletes:
//   - a lowercase Mc surname gets its capital: "Mcdonald" -> "McDonald".
//     Only surnames (not the first name): "Mckenzie" as a first name is a
//     real spelling and stays. "Mac" is never changed ("Mackenzie",
//     "Maclay" and "Macnamara" can't be told apart from "MacDonald").
//   - O' names: "O'brien" -> "O'Brien".
//   - parenthetical nicknames leave the display: "Lillian (Lily) Kiser"
//     -> "Lillian Kiser" (the nickname is kept as an alias by the caller).
//   - ALL CAPS or all lowercase names become title case.
//   Names that are already correct are returned unchanged.
// Schools:
//   - one style: no "High School", "School" or "HS" at the end
//     ("Perrysburg High School" -> "Perrysburg", "Hathaway Brown School"
//     -> "Hathaway Brown"); ALL CAPS becomes title case.
//   - when more than one Ohio school shares the shown name, the city is
//     added: "Highland (Medina)".

const SMALL = new Set(["and", "of", "the", "at", "for"]);
const GENERIC_LEFTOVER = new Set(["university", "academy", "christian", "catholic", "country day", "day"]);

function titleWord(word, index) {
  const lower = word.toLowerCase();
  if (index > 0 && SMALL.has(lower)) return lower;
  return lower.replace(/(^|[-'’.])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());
}
const isAllCaps = (text) => /[A-Z]{2}/.test(text) && text === text.toUpperCase();
const isAllLower = (text) => /[a-z]/.test(text) && text === text.toLowerCase();

export function personDisplayName(name) {
  let text = String(name ?? "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return text;
  if (isAllCaps(text) || isAllLower(text)) text = text.split(" ").map((w) => titleWord(w, 1)).join(" ");
  const words = text.split(" ");
  return words.map((word, i) => {
    let w = word.replace(/^(O['’])([a-z])/, (m, p, c) => p + c.toUpperCase());
    // Mc only in surnames (any word after the first).
    if (i > 0) w = w.replace(/^Mc([a-z])/, (m, c) => `Mc${c.toUpperCase()}`);
    return w;
  }).join(" ");
}

// "Lillian (Lily) Kiser" -> "Lily Kiser"; null when there is no nickname.
export function nicknameAlias(name) {
  const m = String(name ?? "").match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
  if (!m) return null;
  const last = m[3].trim().split(/\s+/).pop() || m[1].trim().split(/\s+/).pop();
  return personDisplayName(`${m[2].trim()} ${last}`);
}

export function schoolBaseName(name) {
  let text = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!text) return text;
  if (isAllCaps(text)) text = text.split(" ").map((w, i) => titleWord(w, i)).join(" ");
  const stripped = text.replace(/\s+(Senior High School|High School|School|HS)$/i, "").trim();
  // "University School" keeps its name: the suffix is the name there.
  if (!stripped || GENERIC_LEFTOVER.has(stripped.toLowerCase())) return text;
  return stripped;
}

export const schoolKey = (name) => schoolBaseName(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ambiguous: a Set (or array) of schoolKey values shared by more than one
// Ohio school (src/data/ambiguous-school-names.json).
export function schoolLabel(name, city, ambiguous) {
  const base = schoolBaseName(name);
  if (!base) return base;
  const set = ambiguous instanceof Set ? ambiguous : new Set(ambiguous || []);
  const cityText = String(city ?? "").trim();
  if (!cityText || !set.has(schoolKey(base))) return base;
  const cityShown = isAllCaps(cityText) || isAllLower(cityText) ? cityText.split(" ").map((w, i) => titleWord(w, i)).join(" ") : cityText;
  return `${base} (${cityShown})`;
}
