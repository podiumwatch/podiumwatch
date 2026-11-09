import { escapeHtml, formatDate } from "../../src/lib/content.mjs";
import { breadcrumb, icon, layout } from "../../src/lib/html.mjs";

// Server-rendered athlete page (WO-09) for /athletes/{slug}/. All content
// is in the HTML: school, class year, season bests, every race, progression
// by season, rankings, Path to State and linked stories. Data comes from
// loadDatabaseProfile (lib/athlete_profile_service.mjs), the same loader
// the JSON API uses. Sections with nothing real in them are left out.
// Never shows contact info, birth date, home address or hometown.
// public/scripts/athlete-page.js only sends the correction form and the
// share button.

const styles = `<style>
  .ap-shell { display:grid; gap:22px; }
  .ap-shell > * { min-width:0; }
  .ap-head { display:grid; gap:6px; }
  .ap-head h1 { margin:0; }
  .ap-sub { margin:0; color:var(--muted); font-weight:700; }
  .ap-sub a { color:inherit; }
  .ap-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
  .ap-chip { padding:4px 10px; border-radius:999px; background:var(--pale-green); font-size:.8rem; font-weight:850; }
  .ap-chip.is-commit { background:#063d28; color:#fff; }
  .ap-chip.is-honor { background:var(--green); color:var(--green-ink); }
  .ap-card { padding:18px; border:1px solid var(--line); background:var(--white); }
  .ap-card h2 { margin:0 0 12px; font-size:1.25rem; }
  .ap-bests { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
  .ap-best { padding:12px; border:1px solid var(--line); }
  .ap-best strong { display:block; font-size:1.6rem; line-height:1.1; font-variant-numeric:tabular-nums; }
  .ap-best span, .ap-best small { display:block; color:var(--muted); font-weight:650; font-size:.85rem; }
  .ap-table-wrap { overflow-x:auto; }
  .ap-table { width:100%; min-width:520px; border-collapse:collapse; font-size:.92rem; }
  .ap-table th, .ap-table td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  .ap-table th { white-space:nowrap; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  .ap-table td.date { white-space:nowrap; }
  .ap-table td.num { font-weight:850; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ap-table th:first-child, .ap-table td:first-child { position:sticky; left:0; background:var(--white); }
  .ap-note { color:var(--muted); font-size:.86rem; font-weight:600; }
  .ap-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
  .ap-list li { padding:10px 12px; border:1px solid var(--line); }
  .ap-form { display:grid; gap:12px; }
  .ap-form label { display:grid; gap:6px; font-weight:800; }
  .ap-form input, .ap-form select, .ap-form textarea { padding:10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; font-size:16px; background:var(--white); }
  .ap-form textarea { min-height:110px; }
  .ap-actions { display:flex; flex-wrap:wrap; gap:10px; }
</style>`;

const CORRECTION_TYPES = [["name", "Name"], ["school", "School"], ["graduation_year", "Graduation year"], ["performance", "Performance"], ["division", "Division"], ["college_commitment", "College commitment"], ["duplicate", "Duplicate profile"], ["privacy", "Privacy concern"], ["other", "Other"]];

// "Sep 12, 2026": short enough for a phone-width table.
const shortDate = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };
const isTimed = (performance) => String(performance.mark_unit || "").toLowerCase() === "seconds";
const better = (a, b) => (isTimed(a) ? Number(a.mark_value) < Number(b.mark_value) : Number(a.mark_value) > Number(b.mark_value));
const ordinal = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "";
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
};
export const teamHref = (team) => (team?.slug ? `/team/?slug=${encodeURIComponent(team.slug)}` : null);

// Pure: best mark per event for one season list, fastest (or farthest) first.
export function bestByEvent(performances) {
  const best = new Map();
  for (const row of performances) {
    if (row.mark_value === null || row.mark_value === undefined || !Number.isFinite(Number(row.mark_value))) continue;
    const key = row.event_key || row.event_name;
    if (!best.has(key) || better(row, best.get(key))) best.set(key, row);
  }
  return [...best.values()];
}

// Pure: index only with real content (Decisions item 3): at least one
// public performance that names its source.
export function athleteIsIndexable(data) {
  return (data?.performances || []).some((row) => row.source_label || row.source_url);
}

function sourceCell(row) {
  if (row.source_url) return `<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.source_label || "Source")}</a>`;
  return escapeHtml(row.source_label || "");
}

// The athlete's own official OHSAA tournament results by stage, for one
// season. Only official results with a place count; nothing is inferred.
const STAGE_MEET = { district: /^OHSAA Cross Country District\b/i, regional: /^OHSAA Cross Country Regional\b/i, state: /^OHSAA Cross Country State Championships?\b/i };
export function postseasonByStage(performances, seasonYear) {
  const out = {};
  for (const [stage, pattern] of Object.entries(STAGE_MEET)) {
    const row = (performances || []).find((p) => p.season_year === seasonYear && p.sport === "cross_country" && pattern.test(String(p.meet_name || "")) && Number.isInteger(Number(p.place)) && Number(p.place) > 0 && p.result_status !== "reviewed_result");
    if (row) out[stage] = row;
  }
  return out;
}

// Honors from the import's labels and official state places: "State
// champion" only for an official 1st at the state meet.
export function athleteHonors(performances) {
  const honors = [];
  for (const row of performances || []) {
    if (!STAGE_MEET.state.test(String(row.meet_name || "")) || row.result_status === "reviewed_result") continue;
    if (Number(row.place) === 1) honors.push({ label: `${row.season_year} State champion`, strong: true });
    if (row.honor_label) honors.push({ label: `${row.season_year} ${row.honor_label.replace(/\b(first|second) team\b/i, (m) => m.replace(/\b\w/g, (c) => c.toUpperCase()))}` });
  }
  return honors;
}

const individualLine = (stage, row) => {
  if (!row) return "";
  const what = stage === "state" && Number(row.place) === 1 ? "State champion" : `${ordinal(row.place)}${stage === "state" ? " at state" : ""}`;
  return `Individual: <b>${escapeHtml(what)}</b>${row.mark_text ? `, ${escapeHtml(row.mark_text)}` : ""}`;
};

export function pathToStateHtml(pts, performances = []) {
  const path = pts?.path;
  if (!path?.available || !Array.isArray(path.nodes)) {
    // No team path (no team page or no division on file): the athlete's
    // own official tournament results still show, stage by stage.
    const seasons = [...new Set((performances || []).map((p) => p.season_year).filter(Boolean))].sort((a, b) => b - a);
    const own = seasons.length ? postseasonByStage(performances, seasons[0]) : {};
    const stages = [["district", "District"], ["regional", "Regional"], ["state", "State Championship"]].filter(([key]) => own[key]);
    if (!stages.length) return "";
    return `<section class="ap-card"><h2>Path to State</h2>
    <ul class="ap-list">${stages.map(([key, label]) => `<li><b>${label}</b>${key === "state" ? "" : ` <span class="ap-note">${escapeHtml(own[key].meet_name.replace(/^OHSAA Cross Country (District|Regional) - /, ""))}</span>`}<br>${individualLine(key, own[key])}</li>`).join("")}</ul>
  </section>`;
  }
  const own = postseasonByStage(performances, path.season_year ?? pts?.season_year ?? null);
  const recordedIndex = path.nodes.map((node, i) => (node.status && node.status !== "not_started" && node.status_source !== "default") || own[node.key] ? i : -1).filter((i) => i >= 0);
  if (!recordedIndex.length) return "";
  const lastRecorded = Math.max(...recordedIndex);
  const items = path.nodes.map((node, i) => {
    const recorded = node.status_source !== "default" && node.status && node.status !== "not_started";
    let team;
    if (node.key === "state" && recorded && node.note && /^Finished /.test(node.note)) team = escapeHtml(node.note);
    else if (recorded) team = `${escapeHtml(node.status_label || "")}${node.note ? ` &middot; ${escapeHtml(node.note)}` : ""}`;
    else if (own[node.key]) team = node.key === "state" ? "Ran at state as an individual" : "Advanced as an individual";
    else if (i < lastRecorded) team = "Complete";
    else team = escapeHtml(node.status_label || "");
    const ind = individualLine(node.key, own[node.key]);
    return `<li><b>${escapeHtml(node.label)}</b>${node.date_label ? ` <span class="ap-note">${escapeHtml(node.date_label)}</span>` : ""}<br>${recorded ? "Team: " : ""}${team}${ind ? `<br>${ind}` : ""}</li>`;
  });
  return `<section class="ap-card"><h2>Path to State</h2>
    <p class="ap-note">${escapeHtml([path.division_label, path.athletic_district ? `${path.athletic_district} district` : "", path.regional_name ? `${path.regional_name} regional` : ""].filter(Boolean).join(" · "))}</p>
    <ul class="ap-list">${items.join("")}</ul>
  </section>`;
}

export function athletePageHtml(site, data) {
  const profile = data.profile;
  const name = profile.display_name;
  const school = data.school?.school_name || data.team?.school_name || null;
  const schoolLink = teamHref(data.team);
  const pathname = `/athletes/${profile.slug}/`;
  const performances = [...(data.performances || [])].sort((a, b) => String(b.meet_date || "").localeCompare(String(a.meet_date || "")));
  const seasons = [...new Set(performances.map((row) => row.season_year).filter(Boolean))].sort((a, b) => b - a);
  const latestSeason = seasons[0] || null;
  const seasonBests = latestSeason ? bestByEvent(performances.filter((row) => row.season_year === latestSeason)) : [];
  const division = data.path_to_state?.path?.division_label || null;
  const latest = performances[0] || null;
  const classYear = profile.graduation_year ? `Class of ${profile.graduation_year}` : null;

  const bestsHtml = seasonBests.length ? `<section class="ap-card"><h2>${latestSeason} season bests</h2><div class="ap-bests">${seasonBests.map((row) => `<div class="ap-best"><span>${escapeHtml(row.event_name)}</span><strong>${escapeHtml(row.mark_text)}</strong><small>${escapeHtml(row.meet_name || "")}${row.meet_date ? `, ${escapeHtml(shortDate(row.meet_date))}` : ""}</small></div>`).join("")}</div></section>` : "";

  const racesHtml = performances.length ? `<section class="ap-card"><h2>Results</h2><div class="ap-table-wrap"><table class="ap-table"><thead><tr><th>Date</th><th>Meet</th><th>Mark</th><th>Place</th><th>Event</th><th>Source</th></tr></thead><tbody>${performances.map((row) => `<tr><td class="date">${row.meet_date ? escapeHtml(shortDate(row.meet_date)) : ""}</td><td>${escapeHtml(row.meet_name || "")}</td><td class="num">${escapeHtml(row.mark_text || "")}</td><td>${escapeHtml(ordinal(row.place))}</td><td>${escapeHtml(row.event_name || "")}</td><td>${sourceCell(row)}</td></tr>`).join("")}</tbody></table></div><p class="ap-note">Every mark keeps its own source. Results missing? <a href="/submit-results/">Send official results</a>.</p></section>` : "";

  const progression = seasons.length > 1 ? seasons.map((season) => ({ season, bests: bestByEvent(performances.filter((row) => row.season_year === season)) })) : [];
  const progressionHtml = progression.length ? `<section class="ap-card"><h2>Season by season</h2><div class="ap-table-wrap"><table class="ap-table"><thead><tr><th>Season</th><th>Event</th><th>Best</th><th>Meet</th></tr></thead><tbody>${progression.flatMap(({ season, bests }) => bests.map((row) => `<tr><td>${season}</td><td>${escapeHtml(row.event_name)}</td><td class="num">${escapeHtml(row.mark_text)}</td><td>${escapeHtml(row.meet_name || "")}</td></tr>`)).join("")}</tbody></table></div></section>` : "";

  const rankings = (data.rankings || []).filter((ranking) => ranking.current !== false);
  const rankingsHtml = rankings.length ? `<section class="ap-card"><h2>Rankings</h2><ul class="ap-list">${rankings.map((ranking) => `<li><b>No. ${escapeHtml(ranking.rank)}</b> in <a href="${escapeHtml(ranking.ranking_href || "/rankings/")}">${escapeHtml(ranking.ranking_title)}</a><br><span class="ap-note">${escapeHtml(ranking.ranking_type || "Podium Watch editorial ranking")}${ranking.updated_date ? `, ${escapeHtml(formatDate(ranking.updated_date))}` : ""}. An editorial ranking, not an official result.</span>${ranking.explanation ? `<br>${escapeHtml(ranking.explanation)}` : ""}</li>`).join("")}</ul></section>` : "";

  const stories = data.stories || [];
  const storiesHtml = stories.length ? `<section class="ap-card"><h2>Stories</h2><ul class="ap-list">${stories.map((story) => `<li><a href="${escapeHtml(story.story_href || `/stories/${story.story_slug}/`)}">${escapeHtml(story.story_title || "Story")}</a>${story.story_date ? ` <span class="ap-note">${escapeHtml(formatDate(story.story_date))}</span>` : ""}</li>`).join("")}</ul></section>` : "";

  const honors = athleteHonors(performances);
  const honorChips = honors.map((h) => `<span class="ap-chip${h.strong ? " is-honor" : ""}">${escapeHtml(h.label)}</span>`).join("");
  const commitment = profile.college_commitment ? `<span class="ap-chip is-commit">Committed to ${escapeHtml(profile.college_commitment)}</span>` : "";

  const content = `${styles}
  <section class="section section-paper"><div class="container ap-shell" data-athlete-page data-slug="${escapeHtml(profile.slug)}">
    ${breadcrumb([{ label: "Home", href: "/" }, { label: "Athletes", href: "/athletes/" }, { label: name }])}
    <header class="ap-head">
      <p class="eyebrow">${escapeHtml(profile.gender === "girls" ? "Girls" : profile.gender === "boys" ? "Boys" : "Athlete")}${division ? ` &middot; ${escapeHtml(division)}` : ""}</p>
      <h1>${escapeHtml(name)}</h1>
      <p class="ap-sub">${school ? (schoolLink ? `<a href="${escapeHtml(schoolLink)}">${escapeHtml(school)}</a>` : escapeHtml(school)) : ""}${school && classYear ? " &middot; " : ""}${escapeHtml(classYear || "")}</p>
      ${honorChips || commitment ? `<div class="ap-chips">${honorChips}${commitment}</div>` : ""}
    </header>
    ${bestsHtml}
    ${racesHtml}
    ${progressionHtml}
    ${pathToStateHtml(data.path_to_state, performances)}
    ${rankingsHtml}
    ${storiesHtml}
    ${performances.length ? "" : `<section class="ap-card"><h2>No results yet</h2><p>No results for ${escapeHtml(name)} are on Podium Watch yet. Coaches and timers can <a href="/submit-results/">send official results</a>.</p></section>`}
    <div class="ap-actions"><button class="button button-outline" type="button" data-athlete-share>${icon("arrow")} Copy profile link</button></div>
    <section class="ap-card">
      <h2>Submit a correction</h2>
      <p class="ap-note">Share an official result, a school correction, a duplicate profile, or a privacy concern. Podium Watch reviews every submission before changing a profile.</p>
      <form class="ap-form" data-athlete-correction-form>
        <label>Correction type <select name="correction_type" required><option value="">Choose a correction</option>${CORRECTION_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        <label>Official source link <input type="url" name="source_url" placeholder="https://"></label>
        <label>Your name <input type="text" name="submitter_name" maxlength="150"></label>
        <label>Email for follow up <input type="email" name="submitter_email" maxlength="320"></label>
        <label>Correction details <textarea name="details" required maxlength="5000" placeholder="Explain exactly what should be reviewed and why."></textarea></label>
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Leave this blank <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <button class="button button-dark" type="submit">Send correction</button>
        <p class="ap-note" data-athlete-message role="status" aria-live="polite"></p>
      </form>
    </section>
  </div></section>
  <script src="/scripts/athlete-page.js" defer></script>`;

  const best = seasonBests[0];
  const descriptionParts = [
    `${name}${school ? ` of ${school}` : ""}${classYear ? `, ${classYear.toLowerCase()}` : ""}.`,
    best ? `${latestSeason} best ${best.mark_text} in the ${best.event_name}.` : "",
    latest && latest.meet_name ? `Latest race: ${latest.meet_name}.` : ""
  ];
  let description = descriptionParts.filter(Boolean).join(" ");
  if (description.length > 158) description = `${description.slice(0, 155).replace(/\s+\S*$/, "")}...`;

  const jsonLd = [{
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${site.siteUrl}${pathname}`,
    dateModified: profile.updated_at || undefined,
    mainEntity: {
      "@type": "Person",
      name,
      ...(school ? { affiliation: { "@type": "SportsTeam", name: school, ...(data.team?.slug ? { url: `${site.siteUrl}${teamHref(data.team)}` } : {}) } } : {})
    }
  }];

  return layout({
    site,
    title: `${name}${school ? ` | ${school}` : ""} Cross Country & Track`,
    description,
    pathname,
    content,
    jsonLd,
    robots: athleteIsIndexable(data) ? "index, follow" : "noindex, follow"
  });
}
