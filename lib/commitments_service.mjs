// College commitment tracker (WO-38). Built on the existing recruiting
// activity system rather than a second table: athlete_recruiting_activity
// (install/03) already stores commitments and signings with a college,
// division, date and source link; a row can only be public once it is
// confirmed or publicly announced AND has a source link (api/admin/
// recruiting.js saveActivity), and a public commitment already sets
// "College commitment" on the athlete's profile. Public reports come in
// through /recruiting/submit-activity/ and are promoted by hand. No
// source, no listing.

export const COMMITMENT_TYPES = ["commitment", "signing"];

// Pure: "NCAA Division I" / "D1" / "NAIA" ... -> one of the tracker's levels.
export function commitmentLevel(division) {
  const text = String(division || "").toLowerCase().replace(/\s+/g, " ");
  // No division recorded: say so, never guess (Youngstown State, say, is
  // NCAA I, but only the source can tell us).
  if (!text) return "Level not listed";
  if (/naia/.test(text)) return "NAIA";
  if (/njcaa|juco|junior college/.test(text)) return "NJCAA";
  // "NCAA Division I", "Division 1", "D2", "DIII" -> the bare level.
  const bare = text.replace(/ncaa|division|\s+/g, "").replace(/^d/, "");
  if (["iii", "3"].includes(bare)) return "NCAA III";
  if (["ii", "2"].includes(bare)) return "NCAA II";
  if (["i", "1"].includes(bare)) return "NCAA I";
  return "Other";
}

// Pure: one row per athlete and college. A signing replaces an earlier
// commitment to the same college; a newer commitment elsewhere wins.
export function latestCommitments(rows) {
  const byProfile = new Map();
  const rank = (row) => `${row.activity_date || row.created_at || ""}|${row.activity_type === "signing" ? 1 : 0}`;
  for (const row of rows) {
    const current = byProfile.get(row.profile_id);
    if (!current || rank(row) > rank(current)) byProfile.set(row.profile_id, row);
  }
  return [...byProfile.values()];
}

export async function listCommitments({ classYear }) {
  const year = Number(classYear);
  if (!Number.isInteger(year) || year < 2020 || year > 2040) {
    const error = new Error("Choose a real class year.");
    error.status = 400;
    throw error;
  }
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  const { selectAll } = await import("./supabase_paging.mjs");
  const { data, error } = await selectAll(() => supabaseAdmin
    .from("athlete_recruiting_activity")
    .select("id, created_at, profile_id, activity_type, college_name, college_division, event_group, activity_date, source_label, source_url, profile:athlete_profiles!inner(id, slug, display_name, gender, graduation_year, current_school_id, public_visible, suspended, archived_at, merged_into_profile_id)")
    .in("activity_type", COMMITMENT_TYPES)
    .eq("public_visible", true)
    .is("archived_at", null)
    .not("source_url", "is", null)
    .eq("profile.graduation_year", year), { maxRows: 20000 });
  if (error) throw error;

  const visible = (data || []).filter((row) => row.profile && row.profile.public_visible && !row.profile.suspended && !row.profile.archived_at && !row.profile.merged_into_profile_id);
  const latest = latestCommitments(visible);
  const schoolIds = [...new Set(latest.map((row) => row.profile.current_school_id).filter(Boolean))];
  const schools = new Map();
  if (schoolIds.length) {
    const { data: schoolRows, error: schoolError } = await supabaseAdmin.from("ohio_schools").select("id, school_name, city").in("id", schoolIds);
    if (schoolError) throw schoolError;
    for (const school of schoolRows || []) schools.set(school.id, school);
  }

  return latest
    .map((row) => ({
      id: row.id,
      athlete_name: row.profile.display_name,
      athlete_slug: row.profile.slug,
      gender: row.profile.gender,
      school_name: schools.get(row.profile.current_school_id)?.school_name || null,
      college: row.college_name,
      level: commitmentLevel(row.college_division),
      division_label: row.college_division || null,
      event_group: row.event_group || null,
      type: row.activity_type,
      announced_on: row.activity_date || null,
      source_label: row.source_label,
      source_url: row.source_url
    }))
    .sort((a, b) => String(b.announced_on || "").localeCompare(String(a.announced_on || "")) || a.athlete_name.localeCompare(b.athlete_name));
}

const escapeXml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

// Pure: a 1080x1350 "Committed" share card as SVG, from a real public
// commitment row. Boys green, girls pink, podiumwatch.org on the card.
export function commitmentCardSvg(row) {
  const girls = row.gender === "girls";
  const accent = girls ? "#EC4899" : "#0FAF68";
  const ink = girls ? "#500724" : "#063D28";
  const name = escapeXml(row.athlete_name);
  const nameSize = row.athlete_name.length > 22 ? 82 : row.athlete_name.length > 16 ? 100 : 120;
  const collegeSize = String(row.college).length > 26 ? 64 : 84;
  // Long names and colleges are squeezed to fit 960px instead of running off
  // the card (Big Shoulders is condensed: about 0.47em per character).
  const fit = (text, size) => (String(text).length * size * 0.47 > 960 ? ' textLength="960" lengthAdjust="spacingAndGlyphs"' : "");
  const pillText = `${girls ? "GIRLS" : "BOYS"} · CLASS OF ${row.class_year || ""}`;
  const pillWidth = 48 + Math.ceil(pillText.length * 18.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#090909"/>
  <circle cx="1000" cy="120" r="700" fill="${accent}" opacity="0.12"/>
  <rect x="60" y="64" rx="26" ry="26" width="${pillWidth}" height="52" fill="${accent}"/>
  <text x="84" y="100" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="26" fill="${ink}">${girls ? "GIRLS" : "BOYS"} &#183; CLASS OF ${escapeXml(row.class_year || "")}</text>
  <text x="60" y="360" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="190" fill="${accent}">COMMITTED</text>
  <text x="60" y="560" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="${nameSize}" fill="#F6F4EE"${fit(row.athlete_name, nameSize)}>${name}</text>
  <text x="60" y="630" font-family="Outfit, Arial, sans-serif" font-weight="700" font-size="40" fill="#B0B0AA">${escapeXml(row.school_name || "")}</text>
  <text x="60" y="820" font-family="Outfit, Arial, sans-serif" font-weight="700" font-size="34" fill="#B0B0AA">TO</text>
  <text x="60" y="${820 + collegeSize + 10}" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="${collegeSize}" fill="#F6F4EE"${fit(row.college, collegeSize)}>${escapeXml(row.college)}</text>
  <text x="60" y="${820 + collegeSize + 70}" font-family="Outfit, Arial, sans-serif" font-weight="700" font-size="34" fill="${accent}">${escapeXml(["Other", "Level not listed"].includes(row.level) ? row.division_label || "" : row.level)}</text>
  <text x="60" y="1290" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="28" fill="#F6F4EE">podiumwatch.org/commitments</text>
</svg>`;
}
