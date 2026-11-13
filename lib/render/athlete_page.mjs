import { escapeHtml, formatDate } from "../../src/lib/content.mjs";
import { labelSchool } from "../../src/lib/school_labels.mjs";
import { logoBaseFromUrl, schoolLogoBaseFor } from "../../src/lib/team_logo_html.mjs";
import { layout } from "../../src/lib/html.mjs";
import { pageBand, statCards, panel, bandColor } from "../../src/lib/components.mjs";
import { teamColor } from "../team_colors.mjs";

// Athlete page at /athletes/{slug}/ (site redesign step 4, 2026-11-13;
// first built for WO-09). Data from loadDatabaseProfile
// (lib/athlete_profile_service.mjs). Everything shown is a stored record;
// the only derived numbers are the season best per event and each other
// race's gap to it, worked out from the stored marks. Modules with nothing
// real in them are left out. Never shows contact info, birth date, home
// address or hometown. public/scripts/athlete-page.js sends the correction
// form and copies the profile link.
//
// Decisions made for Zachary (easy to reverse): a team honor such as
// "State Champion team" shows only when the athlete ran in that meet; the
// donation block is gone from athlete pages (Support stays in the footer).

const e = escapeHtml;
const CORRECTION_TYPES = [["name", "Name"], ["school", "School"], ["graduation_year", "Graduation year"], ["performance", "Performance"], ["division", "Division"], ["college_commitment", "College commitment"], ["duplicate", "Duplicate profile"], ["privacy", "Privacy concern"], ["other", "Other"]];
const GENDER = { boys: "Boys", girls: "Girls" };

const shortDate = (iso) => { const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const isTimed = (performance) => String(performance.mark_unit || "").toLowerCase() === "seconds";
const better = (a, b) => (isTimed(a) ? Number(a.mark_value) < Number(b.mark_value) : Number(a.mark_value) > Number(b.mark_value));
const ordinal = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "";
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
};
const titleWords = (text) => String(text || "").replace(/\b[a-z]/g, (c) => c.toUpperCase());
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "");
export const teamHref = (team) => (team?.slug ? `/teams/${encodeURIComponent(team.slug)}/` : null);

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

// Pure: index only with real content: at least one public performance
// that names its source.
export function athleteIsIndexable(data) {
  return (data?.performances || []).some((row) => row.source_label || row.source_url);
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

// Individual honors from official state results: "State champion" only
// for an official 1st at the state meet, plus the import's honor labels.
export function athleteHonors(performances) {
  const honors = [];
  for (const row of performances || []) {
    if (!STAGE_MEET.state.test(String(row.meet_name || "")) || row.result_status === "reviewed_result") continue;
    if (Number(row.place) === 1) honors.push({ label: `${row.season_year} State champion`, strong: true });
    if (row.honor_label) honors.push({ label: `${row.season_year} ${row.honor_label.replace(/\b(first|second) team\b/i, (m) => m.replace(/\b\w/g, (c) => c.toUpperCase()))}` });
  }
  return honors;
}

// Band honors: individual state honors, the team's state finish only when
// the athlete ran that state meet (from the Path to State team note
// "Finished 1st as a team, 107 points"), and a college commitment.
export function bandHonors(data, performances) {
  const honors = [];
  for (const row of performances) {
    if (!STAGE_MEET.state.test(String(row.meet_name || "")) || row.result_status === "reviewed_result") continue;
    if (Number(row.place) === 1) honors.push({ label: "State Champion", note: `${row.season_year} Cross Country`, featured: true });
    if (row.honor_label) honors.push({ label: titleWords(row.honor_label), note: `${row.season_year} Cross Country`, featured: honors.length === 0 });
  }
  const path = data.path_to_state?.path;
  const stateNode = path?.nodes?.find((n) => n.key === "state");
  const ranState = performances.some((p) => STAGE_MEET.state.test(String(p.meet_name || "")) && p.season_year === path?.season_year);
  const team = String(stateNode?.note || "").match(/^Finished (\d+)\w* as a team, (\d+) points/);
  if (team && ranState && stateNode.status_source !== "default") {
    const place = Number(team[1]);
    const label = place === 1 ? "State Champion team" : place === 2 ? "State Runner-up team" : `${ordinal(place)} at State (team)`;
    honors.push({ label, note: [path.division_label, GENDER[path.gender]].filter(Boolean).join(" ") + ` · ${team[2]} pts` });
  }
  if (data.profile?.college_commitment) honors.push({ label: `Committed to ${data.profile.college_commitment}` });
  return honors;
}

// Pure: three teammates from the team's roster (lib/team_page_service.mjs,
// ranked by season best): the next three after this athlete, filled from
// just ahead when the athlete is near the bottom; the top three when the
// athlete has no time this season.
export function teammatesFor(teamPage, profile) {
  const roster = teamPage?.genders?.[profile?.gender]?.roster || [];
  const idx = roster.findIndex((r) => r.slug === profile?.slug);
  const others = roster.filter((r) => r.slug !== profile?.slug);
  let picked;
  if (idx < 0) picked = others.slice(0, 3);
  else {
    const after = roster.slice(idx + 1, idx + 4);
    const before = roster.slice(Math.max(0, idx - (3 - after.length)), idx);
    picked = [...before, ...after];
  }
  return picked.slice(0, 3).map((r) => ({ slug: r.slug, name: r.name, best: r.best }));
}

// Path to State: the team's path (when there is a team path) with the
// athlete's own result at each round, else the athlete's own rounds.
export function pathNodes(pts, performances = []) {
  const path = pts?.path;
  if (!path?.available || !Array.isArray(path.nodes)) {
    const seasons = [...new Set((performances || []).map((p) => p.season_year).filter(Boolean))].sort((a, b) => b - a);
    const own = seasons.length ? postseasonByStage(performances, seasons[0]) : {};
    return [["district", "District"], ["regional", "Regional"], ["state", "State Championship"]].filter(([key]) => own[key]).map(([key, label]) => ({ label, date: own[key].meet_date ? shortDate(own[key].meet_date) : "", headline: `${ordinal(own[key].place)}, ${own[key].mark_text}`, team: "", done: true }));
  }
  const own = postseasonByStage(performances, path.season_year ?? null);
  const recorded = path.nodes.map((node, i) => ((node.status && node.status !== "not_started" && node.status_source !== "default") || own[node.key] ? i : -1)).filter((i) => i >= 0);
  if (!recorded.length) return [];
  const last = Math.max(...recorded);
  return path.nodes.map((node, i) => {
    const mine = own[node.key];
    const isRecorded = node.status_source !== "default" && node.status && node.status !== "not_started";
    let headline = "";
    if (mine) headline = `${ordinal(mine.place)}, ${mine.mark_text}`;
    else if (isRecorded) headline = node.status_label || "";
    else if (i < last) headline = "Complete";
    let team = "";
    if (isRecorded && node.note) team = node.key === "state" ? node.note.replace(/^Finished (\d+\w*) as a team, (\d+) points/, "$1, $2 points") : node.note;
    return { label: node.label, date: node.date_label ? node.date_label.toUpperCase() : "", headline, team, done: i <= last };
  });
}

function resultsTable(performances, latestSeason, oneResult) {
  const season = performances.filter((row) => row.season_year === latestSeason);
  const bests = new Map(bestByEvent(season).map((row) => [row.event_key || row.event_name, row]));
  const events = new Set(season.map((row) => row.event_key || row.event_name));
  const rows = season.map((row) => {
    const best = bests.get(row.event_key || row.event_name);
    let mark = e(row.mark_text || "");
    if (!oneResult && best) {
      if (best === row) mark += ' <em class="pw-sb">SB</em>';
      else if (isTimed(row) && isTimed(best) && Number.isFinite(Number(row.mark_value)) && Number.isFinite(Number(best.mark_value))) mark += `<span class="pw-sub">+${(Number(row.mark_value) - Number(best.mark_value)).toFixed(1)} off season best</span>`;
    }
    const sub = [events.size > 1 ? row.event_name : "", row.source_url ? `<a href="${e(row.source_url)}" target="_blank" rel="noopener noreferrer">${e(row.source_label || "Source")}</a>` : e(row.source_label || "")].filter(Boolean).join(" · ");
    return `<tr><td class="pw-col-date">${shortDate(row.meet_date) ? `<span class="pw-date">${e(shortDate(row.meet_date))}</span>` : `<span class="pw-date pw-date-none" aria-hidden="true"></span>`}</td><td class="pw-col-name"><b>${e(row.meet_name || "")}</b>${sub ? `<span class="pw-sub">${sub}</span>` : ""}</td><td class="pw-col-place">${row.place ? e(ordinal(row.place)) : ""}</td><td class="pw-col-time">${mark}</td></tr>`;
  }).join("");
  const eventsLine = events.size === 1 ? `${season[0].event_key === "xc_5k" ? "Cross Country 5K" : season[0].event_name}. ` : "";
  return panel({
    title: `${latestSeason} results`,
    sub: `${eventsLine}Newest first. Courses differ.`,
    body: `<div class="pw-table-wrap"><table class="pw-table pw-results-table"><caption class="visually-hidden">${latestSeason} results</caption><thead><tr><th scope="col" class="pw-col-date">Date</th><th scope="col" class="pw-col-name">Meet</th><th scope="col" class="pw-col-place">Place</th><th scope="col" class="pw-col-time">Time</th></tr></thead><tbody>${rows}</tbody></table></div><p class="pw-note">Every mark keeps its own source. Results missing? <a href="/submit-results/">Send official results.</a></p>`
  });
}

export function athletePageHtml(site, data) {
  const profile = data.profile;
  const name = profile.display_name;
  const schoolRaw = data.team?.school_name || data.school?.school_name || null;
  const school = schoolRaw ? labelSchool(schoolRaw, data.school?.city || data.team?.city || null) : null;
  const schoolLink = teamHref(data.team);
  const pathname = `/athletes/${profile.slug}/`;
  const performances = [...(data.performances || [])].sort((a, b) => String(b.meet_date || "").localeCompare(String(a.meet_date || "")));
  const seasons = [...new Set(performances.map((row) => row.season_year).filter(Boolean))].sort((a, b) => b - a);
  const latestSeason = seasons[0] || null;
  const latestRows = latestSeason ? performances.filter((row) => row.season_year === latestSeason) : [];
  const seasonBests = bestByEvent(latestRows);
  const oneResult = performances.length === 1;
  const path = data.path_to_state?.path;
  const division = path?.division_label || null;
  const classYear = profile.graduation_year ? `Class of ${profile.graduation_year}` : null;
  const genderLabel = GENDER[profile.gender] || "";

  // Band: school color and logo (team page logo, else the school's).
  const logoBase = logoBaseFromUrl(data.team?.logo_url) || schoolLogoBaseFor(data.school?.id);
  const color = data.team ? teamColor({ slug: data.team.slug, primary_color: data.team.primary_color, logo_url: data.team.logo_url }) : null;
  const contextHtml = [school ? (schoolLink ? `<a href="${e(schoolLink)}">${e(school)}</a>` : e(school)) : "", e(classYear || ""), e([genderLabel, division].filter(Boolean).join(" "))].filter(Boolean).join(" · ");
  const band = pageBand({
    crumbs: [{ label: "Home", href: "/" }, { label: "Athletes", href: "/athletes/" }, { label: name }],
    title: name,
    contextHtml,
    color: color || null,
    logo: school ? { src: logoBase ? `${logoBase}-256.webp` : null, name: school } : null,
    honors: bandHonors(data, performances)
  });

  // Stat cards: season best, state, regional, ranking (only with data).
  const xcBest = seasonBests.find((row) => row.event_key === "xc_5k") || seasonBests[0] || null;
  const own = latestSeason ? postseasonByStage(performances, latestSeason) : {};
  const rankings = (data.rankings || []).filter((ranking) => ranking.current !== false);
  const ranking = rankings[0] || null;
  const cards = statCards([
    xcBest ? { label: `${latestSeason} season best${xcBest.event_key === "xc_5k" ? " · 5K" : ` · ${xcBest.event_name}`}`, value: xcBest.mark_text, note: [meetShort(xcBest.meet_name), shortDate(xcBest.meet_date)].filter(Boolean).join(" · ") } : { value: null },
    own.state ? { label: "State", value: ordinal(own.state.place), note: [own.state.mark_text, shortDate(own.state.meet_date)].filter(Boolean).join(" · ") } : { value: null },
    own.regional ? { label: "Regional", value: ordinal(own.regional.place), note: [own.regional.mark_text, meetShort(own.regional.meet_name).replace(/^Regional - /, ""), shortDate(own.regional.meet_date)].filter(Boolean).join(" · ") } : own.district ? { label: "District", value: ordinal(own.district.place), note: [own.district.mark_text, shortDate(own.district.meet_date)].filter(Boolean).join(" · ") } : { value: null },
    ranking && !oneResult ? { label: "Podium Watch ranking", value: `No. ${ranking.rank}`, note: [ranking.division, GENDER[ranking.gender], (String(ranking.ranking_title || "").match(/Top \d+/) || [""])[0]].filter(Boolean).join(" ") } : { value: null }
  ]);

  const results = latestSeason ? resultsTable(performances, latestSeason, oneResult) : "";
  const nodes = pathNodes(data.path_to_state, performances);
  const pathPanel = nodes.length ? panel({
    title: "Path to State",
    sub: path?.available ? [path.division_label, path.athletic_district ? `${path.athletic_district} district` : "", path.regional_name ? `${path.regional_name} regional` : ""].filter(Boolean).join(" · ") : "",
    body: `<ol class="pw-timeline">${nodes.map((n) => `<li${n.done ? ' class="is-done"' : ""}><small>${e(n.label)}${n.date ? ` · ${e(n.date)}` : ""}</small>${n.headline ? `<b>${e(n.headline)}</b>` : ""}${n.team ? `<span>Team: ${e(n.team)}</span>` : ""}</li>`).join("")}</ol>`
  }) : "";

  const rankingsPanel = rankings.length ? panel({
    title: "Rankings",
    body: `<div class="pw-rank-list">${rankings.map((r) => `<div class="pw-rank-item"><b>No. ${e(r.rank)}</b><p><a href="${e(r.ranking_href || "/rankings/")}">${e(r.ranking_title)}</a>. ${e(r.ranking_type || "Podium Watch ranking")}${r.updated_date ? `, ${e(formatDate(r.updated_date))}` : ""}. ${r.editorial_only || /editorial/i.test(r.ranking_type || "") ? "An editorial ranking, not an official result." : ""}</p></div>`).join("")}</div>`
  }) : "";

  const teammates = (data.teammates || []).slice(0, 3);
  const teammatesPanel = teammates.length && school ? panel({
    title: `${school} teammates`,
    sub: `Next on the ${latestSeason} roster by season best`,
    body: `<ul class="pw-mates">${teammates.map((t) => `<li><a href="/athletes/${e(t.slug)}/"><b>${e(t.name)}</b><span>${e(t.best)}</span></a></li>`).join("")}</ul>${schoolLink ? `<p class="pw-note"><a href="${e(schoolLink)}">See the full ${e(school)} roster</a></p>` : ""}`
  }) : "";

  const progression = seasons.length > 1 ? seasons.map((season) => ({ season, bests: bestByEvent(performances.filter((row) => row.season_year === season)) })) : [];
  const progressionPanel = progression.length ? panel({
    title: "Season by season",
    body: `<ul class="pw-mates">${progression.flatMap(({ season, bests }) => bests.map((row) => `<li><span class="pw-mate-static"><b>${season} · ${e(row.event_name)}</b><span>${e(row.mark_text)}</span></span></li>`)).join("")}</ul>`
  }) : "";

  const stories = data.stories || [];
  const storiesPanel = stories.length ? panel({
    title: "Stories",
    body: `<ul class="pw-mates">${stories.map((story) => `<li><a href="${e(story.story_href || `/stories/${story.story_slug}/`)}"><b>${e(story.story_title || "Story")}</b><span>${story.story_date ? e(formatDate(story.story_date)) : ""}</span></a></li>`).join("")}</ul>`
  }) : "";

  const actions = `<section class="pw-panel"><div class="pw-coach">
    <button class="pw-linkbtn" type="button" data-athlete-share>Copy profile link</button>
    <a href="/my-podium/">Follow in My Podium</a>
    ${(data.front_page || []).map((story) => `<a href="${e(story.href)}" title="${e(`${story.title} (${story.label})`)}">Featured on the Podium Watch front page</a>`).join("")}
    <details class="pw-report"><summary>Something wrong? Submit a correction</summary>
      <p class="pw-note">Share an official result, a school correction, a duplicate profile, or a privacy concern. Podium Watch reviews every submission before changing a profile.</p>
      <form class="pw-form" data-athlete-correction-form>
        <label>Correction type <select name="correction_type" required><option value="">Choose a correction</option>${CORRECTION_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        <label>Official source link <input type="url" name="source_url" placeholder="https://"></label>
        <label>Your name <input type="text" name="submitter_name" maxlength="150"></label>
        <label>Email for follow up <input type="email" name="submitter_email" maxlength="320"></label>
        <label>Correction details <textarea name="details" required maxlength="5000" placeholder="Explain exactly what should be reviewed and why."></textarea></label>
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Leave this blank <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <button class="pw-claim-btn" type="submit">Send correction</button>
        <p class="pw-note" data-athlete-message role="status" aria-live="polite"></p>
      </form>
    </details>
  </div></section>`;

  const main = performances.length ? results : `<p class="pw-none">No results for ${e(name)} are on Podium Watch yet. Coaches and timers can <a href="/submit-results/">send official results</a>.</p>`;
  const content = `${band}<div class="container pw-team-body" data-athlete-page data-slug="${e(profile.slug)}" style="--pw-band:${e(bandColor(color))}">
  ${cards}
  <div class="pw-team-grid2">
    <div>${main}</div>
    <div class="pw-stack">${pathPanel}${rankingsPanel}${teammatesPanel}${progressionPanel}${storiesPanel}${actions}</div>
  </div>
</div>
<script src="/scripts/athlete-page.js" defer></script>`;

  const best = seasonBests[0];
  const latest = performances[0] || null;
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

