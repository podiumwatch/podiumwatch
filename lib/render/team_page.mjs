import { escapeHtml } from "../../src/lib/content.mjs";
import { breadcrumb, layout } from "../../src/lib/html.mjs";

// Server-rendered team page (WO-11) at /teams/{slug}/. Every section is
// built from real records (lib/team_page_service.mjs) and hidden when it
// has nothing in it. Header in school colors with the school logo.

const styles = `<style>
  .tp { --tp-accent:#0f2a1f; --tp-on:#fff; }
  .tp-head { background:var(--tp-accent); color:var(--tp-on); }
  .tp-head .container { display:grid; grid-template-columns:auto minmax(0,1fr); gap:14px 22px; align-items:center; padding-block:22px 18px; }
  .tp-logo { width:150px; height:150px; display:grid; place-items:center; border-radius:18px; background:rgba(255,255,255,.94); padding:10px; box-sizing:border-box; }
  .tp-logo img { width:100%; height:100%; object-fit:contain; display:block; }
  .tp-logo.is-initials { font-family:Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size:3rem; color:var(--tp-accent); }
  .tp-name { display:grid; gap:6px; min-width:0; }
  .tp-name .eyebrow { color:inherit; opacity:.85; margin:0; }
  .tp-name h1 { margin:0; font-size:clamp(2rem, 6vw, 3.6rem); line-height:1; color:inherit; overflow-wrap:anywhere; }
  .tp-sub { margin:0; font-weight:750; opacity:.92; }
  .tp-badges { display:flex; flex-wrap:wrap; gap:8px; grid-column:2; }
  .tp-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; background:rgba(255,255,255,.18); color:inherit; font-size:.8rem; font-weight:850; text-decoration:none; border:1px solid rgba(255,255,255,.35); }
  .tp-head[data-on="dark"] .tp-badge { background:rgba(0,0,0,.08); border-color:rgba(0,0,0,.25); }
  .tp-badge small { font-weight:700; opacity:.8; text-transform:uppercase; letter-spacing:.04em; font-size:.68rem; }
  .tp-strip { background:var(--black, #090909); color:var(--white); }
  .tp-strip ul { display:flex; flex-wrap:wrap; gap:8px 18px; margin:0; padding:12px 0; list-style:none; }
  .tp-strip li { font-weight:850; font-size:.95rem; }
  .tp-strip li b { color:var(--green); }
  .tp-strip a { color:inherit; }
  .tp-body { display:grid; gap:22px; padding-block:22px; }
  .tp-body > * { min-width:0; }
  .tp-tabs { display:flex; gap:8px; }
  .tp-tabs button { padding:9px 18px; border:2px solid var(--line); border-radius:999px; background:var(--white); font:inherit; font-weight:850; cursor:pointer; }
  .tp-tabs button[aria-selected="true"] { background:var(--tp-accent); color:var(--tp-on); border-color:var(--tp-accent); }
  .tp-panel { display:grid; gap:20px; }
  .tp-panel > * { min-width:0; }
  .tp-card { padding:16px; border:1px solid var(--line); background:var(--white); display:grid; gap:12px; }
  .tp-card h2 { margin:0; font-size:1.2rem; }
  .tp-note { margin:0; color:var(--muted); font-weight:650; font-size:.85rem; }
  .tp-path { display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none; }
  .tp-path li { padding:8px 12px; border-radius:10px; border:2px solid var(--tp-accent); font-weight:850; }
  .tp-path li small { display:block; color:var(--muted); font-weight:700; font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; }
  .tp-roster { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:8px; margin:0; padding:0; list-style:none; }
  .tp-roster a { display:grid; gap:2px; padding:10px 12px; border:1px solid var(--line); border-left:4px solid var(--tp-accent); color:inherit; text-decoration:none; height:100%; box-sizing:border-box; }
  .tp-roster a:hover strong { text-decoration:underline; }
  .tp-roster small { color:var(--muted); font-weight:650; }
  .tp-roster .tp-time { font-weight:900; font-variant-numeric:tabular-nums; }
  .tp-honor { justify-self:start; margin-top:2px; padding:2px 8px; border-radius:999px; background:var(--green); color:var(--green-ink); font-size:.7rem; font-weight:850; }
  .tp-table-wrap { overflow-x:auto; }
  .tp-table { width:100%; min-width:300px; border-collapse:collapse; font-size:.9rem; }
  .tp-table th, .tp-table td { padding:7px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  .tp-table th { font-size:.7rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  .tp-table .num { font-variant-numeric:tabular-nums; font-weight:850; white-space:nowrap; }
  .tp-table small { display:block; color:var(--muted); font-weight:650; }
  .tp-foot { display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; font-weight:750; font-size:.88rem; }
  .tp-report { display:grid; gap:8px; max-width:420px; }
  .tp-report textarea, .tp-report input { padding:8px; border:1px solid var(--line); border-radius:8px; font:inherit; }
  @media (max-width:640px) {
    .tp-head .container { grid-template-columns:76px minmax(0,1fr); gap:10px 12px; padding-block:14px 12px; }
    .tp-logo { width:76px; height:76px; border-radius:12px; padding:5px; }
    .tp-logo.is-initials { font-size:1.6rem; }
    .tp-name h1 { font-size:clamp(1.6rem, 8vw, 2.2rem); }
    .tp-badges { grid-column:1 / -1; }
    .tp-strip ul { gap:4px 14px; padding:9px 0; }
    .tp-strip li { font-size:.85rem; }
  }
</style>`;

const ordinal = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`; };
const shortDate = (iso) => { const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const clock = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds - m * 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "");
const STAGE_LABEL = { district: "District", regional: "Regional", state: "State" };
const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function logoHtml(data) {
  const name = data.team.display_name;
  if (data.logo?.base) return `<div class="tp-logo"><picture><source srcset="${data.logo.base}-256.webp" type="image/webp"><img src="${data.logo.base}-256.png" alt="${escapeHtml(name)} logo" width="150" height="150" fetchpriority="high"></picture></div>`;
  if (data.logo?.external) return `<div class="tp-logo"><img src="${escapeHtml(data.logo.external)}" alt="${escapeHtml(name)} logo" width="150" height="150"></div>`;
  return `<div class="tp-logo is-initials" aria-hidden="true">${escapeHtml(initials(name))}</div>`;
}

function genderPanel(gender, g, data) {
  const parts = [];
  if (g.path.length) parts.push(`<section class="tp-card"><h2>Postseason path</h2><ol class="tp-path">${g.path.map((p) => `<li><small>${STAGE_LABEL[p.stage]}</small>${p.place ? `${ordinal(p.place)}${p.score != null ? ` &middot; ${escapeHtml(p.score)} pts` : ""}` : p.individuals_only ? `${p.runners} individual${p.runners === 1 ? "" : "s"}` : "Ran"}</li>`).join("")}</ol></section>`);
  if (g.roster.length) parts.push(`<section class="tp-card"><h2>${data.season} roster</h2>${g.top7_average ? `<p class="tp-note">Top-7 average: <b>${clock(g.top7_average)}</b> (average of the top 7 season bests; different courses)</p>` : ""}<ul class="tp-roster">${g.roster.map((r) => `<li><a href="/athletes/${encodeURIComponent(r.slug)}/"><strong>${escapeHtml(r.name)}</strong><small>${r.class_year ? `Class of ${r.class_year}` : ""}</small><span class="tp-time">${escapeHtml(r.best)}</span><small>Season best${r.best_meet ? `, ${escapeHtml(meetShort(r.best_meet))}` : ""}</small>${r.honor ? `<span class="tp-honor">${escapeHtml(r.honor.replace(/\b(first|second) team\b/i, (m) => m.replace(/\b\w/g, (c) => c.toUpperCase())))}</span>` : ""}</a></li>`).join("")}</ul></section>`);
  if (g.results.length) parts.push(`<section class="tp-card"><h2>${data.season} season results</h2><div class="tp-table-wrap"><table class="tp-table"><thead><tr><th>Meet</th><th>Team place</th><th>Score</th></tr></thead><tbody>${g.results.map((r) => `<tr><td>${escapeHtml(meetShort(r.meet))}<small>${escapeHtml(shortDate(r.date))}</small></td>${r.place != null || r.score != null ? `<td class="num">${r.place != null ? ordinal(r.place) : ""}</td><td class="num">${r.score != null ? escapeHtml(r.score) : ""}</td>` : `<td colspan="2"><small>Team score not posted</small></td>`}</tr>`).join("")}</tbody></table></div></section>`);
  if (g.best_ever.length) parts.push(`<section class="tp-card"><h2>Best on Podium Watch</h2><p class="tp-note">Fastest 5K by each runner for this school, since ${data.first_year}. Different courses.</p><div class="tp-table-wrap"><table class="tp-table"><thead><tr><th></th><th>Athlete</th><th>Time</th></tr></thead><tbody>${g.best_ever.map((r, i) => `<tr><td class="num">${i + 1}</td><td><a href="/athletes/${encodeURIComponent(r.slug)}/">${escapeHtml(r.name)}</a><small>${escapeHtml(meetShort(r.meet))}, ${escapeHtml(shortDate(r.date))} ${escapeHtml(r.season)}</small></td><td class="num">${escapeHtml(r.mark)}</td></tr>`).join("")}</tbody></table></div></section>`);
  return parts.join("");
}

export function teamPageHtml(site, data) {
  const t = data.team;
  const name = t.display_name;
  const pathname = `/teams/${t.slug}/`;
  const genderKeys = ["boys", "girls"].filter((g) => { const x = data.genders[g]; return x.roster.length || x.results.length || x.path.length || x.best_ever.length; });
  const divisions = ["boys", "girls"].filter((g) => data.genders[g].division).map((g) => `${g === "boys" ? "Boys" : "Girls"} ${escapeHtml(data.genders[g].division)}`).join(" &middot; ");

  // 2026 highlight strip: real facts only.
  const strip = [];
  for (const g of ["boys", "girls"]) if (data.genders[g].state?.label) strip.push(`<li><b>${escapeHtml(data.genders[g].state.label)}</b>${data.genders[g].state.score != null ? `, ${escapeHtml(data.genders[g].state.score)} pts` : ""}</li>`);
  const qualifiers = data.genders.boys.state_qualifiers + data.genders.girls.state_qualifiers;
  if (qualifiers) strip.push(`<li>${qualifiers} state qualifier${qualifiers === 1 ? "" : "s"}</li>`);
  const allOhio = data.genders.boys.all_ohio + data.genders.girls.all_ohio;
  if (allOhio) strip.push(`<li>${allOhio} All-Ohio</li>`);
  for (const story of data.featured || []) strip.push(`<li><a href="${escapeHtml(story.href)}">On the Podium Watch front page</a></li>`);

  const badges = [
    ...data.instagram.map((i) => `<a class="tp-badge" href="${escapeHtml(i.url)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(i.handle)} <small>${escapeHtml(i.label)}</small></a>`),
    data.claimed ? `<span class="tp-badge">Claimed by coach</span>` : ""
  ].filter(Boolean).join("");

  const tabs = genderKeys.length > 1
    ? `<div class="tp-tabs" role="tablist">${genderKeys.map((g, i) => `<button type="button" role="tab" aria-selected="${i === 0}" aria-controls="tp-${g}" data-tp-tab="${g}">${g === "boys" ? "Boys" : "Girls"}</button>`).join("")}</div>`
    : "";
  const panels = genderKeys.map((g, i) => `<div class="tp-panel" id="tp-${g}" role="tabpanel" data-tp-panel="${g}"${genderKeys.length > 1 && i > 0 ? " hidden" : ""}>${genderKeys.length === 1 ? `<h2 style="margin:0">${g === "boys" ? "Boys" : "Girls"}</h2>` : ""}${genderPanel(g, data.genders[g], data)}</div>`).join("");

  const content = `${styles}
  <div class="tp" style="--tp-accent:${escapeHtml(data.accent)};--tp-on:${escapeHtml(data.accent_text)}">
    <header class="tp-head" data-on="${data.accent_text === "#ffffff" ? "light" : "dark"}"><div class="container">
      ${logoHtml(data)}
      <div class="tp-name">
        <p class="eyebrow">Ohio high school cross country</p>
        <h1>${escapeHtml(name)}</h1>
        <p class="tp-sub">${[t.city ? escapeHtml(t.city) : "", divisions].filter(Boolean).join(" &middot; ")}</p>
      </div>
      ${badges ? `<div class="tp-badges">${badges}</div>` : ""}
    </div></header>
    ${strip.length ? `<section class="tp-strip" aria-label="${data.season} highlights"><div class="container"><ul>${strip.join("")}</ul></div></section>` : ""}
    <div class="container tp-body">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Teams", href: "/teams/" }, { label: name }])}
      ${tabs}
      ${panels || `<section class="tp-card"><h2>No results yet</h2><p class="tp-note">No ${data.season} results for ${escapeHtml(name)} are on Podium Watch yet. Coaches and timers can <a href="/submit-results/">send official results</a>.</p></section>`}
      <div class="tp-foot">
        <a href="/team/?slug=${encodeURIComponent(t.slug)}">Follow, schedule and coach tools</a>
        <a href="/teams/instagram/?team=${encodeURIComponent(t.slug)}">Add your team's Instagram</a>
        <a href="/api/og/team/?slug=${encodeURIComponent(t.slug)}&amp;download=1" download>Share card</a>
        <details><summary>Wrong logo? Tell us</summary>
          <form class="tp-report" data-tp-report data-team-id="${escapeHtml(t.id)}">
            <textarea name="details" rows="3" maxlength="1000">The logo on this page is wrong. </textarea>
            <input type="email" name="reporter_email" placeholder="Your email (optional)" maxlength="320">
            <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
            <button class="button button-outline" type="submit">Send</button>
            <p class="tp-note" data-tp-report-message role="status"></p>
          </form>
        </details>
      </div>
    </div>
  </div>
  <script src="/scripts/team-page.js" defer></script>`;

  const logoAbs = data.logo?.base ? `${site.siteUrl}${data.logo.base}-512.webp` : undefined;
  const jsonLd = [{
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: `${name} Cross Country`,
    sport: "Cross country running",
    url: `${site.siteUrl}${pathname}`,
    ...(logoAbs ? { logo: logoAbs, image: logoAbs } : {}),
    ...(t.city ? { location: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: t.city, addressRegion: "OH", addressCountry: "US" } } } : {}),
    memberOf: { "@type": "SportsOrganization", name: "Ohio high school cross country" }
  }];
  const stateLine = ["boys", "girls"].map((g) => data.genders[g].state?.label).filter(Boolean).join("; ");
  const description = `${name}${t.city ? ` (${t.city})` : ""} cross country on Podium Watch: ${data.season} roster, season results${stateLine ? `, ${stateLine}` : ""}, and the school's best times.`.slice(0, 158);
  return layout({ site, title: `${name} Cross Country`, description, pathname, content, jsonLd, image: logoAbs, robots: genderKeys.length ? undefined : "noindex, follow" });
}
