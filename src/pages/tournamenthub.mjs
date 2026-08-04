import trackRegionalData from "../data/track-regional-sites-2026.json" with { type: "json" };
import { layout, pageHero } from "../lib/html.mjs";
import { escapeHtml } from "../lib/content.mjs";

function formatDate(value) {
  if (!value) return "Not listed";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function regionalCard(region) {
  const sessions = region.prelimDate
    ? `<li><strong>Preliminary:</strong> ${formatDate(region.prelimDate)} at ${escapeHtml(region.prelimTime)}</li><li><strong>Semifinal:</strong> ${formatDate(region.semifinalDate)}, field ${escapeHtml(region.semifinalFieldTime)}, running ${escapeHtml(region.semifinalRunningTime)}</li><li><strong>Final:</strong> ${formatDate(region.finalDate)}, field ${escapeHtml(region.finalFieldTime)}, running ${escapeHtml(region.finalRunningTime)}</li>`
    : `<li><strong>Semifinal:</strong> ${formatDate(region.semifinalDate)}, field ${escapeHtml(region.semifinalFieldTime)}, running ${escapeHtml(region.semifinalRunningTime)}</li><li><strong>Final:</strong> ${formatDate(region.finalDate)}, field ${escapeHtml(region.finalFieldTime)}, running ${escapeHtml(region.finalRunningTime)}</li>`;
  return `<article class="regional-card" data-track-region data-division="${region.division}">
    <div class="regional-card-heading"><p class="eyebrow">Division ${region.division}</p><h3>Region ${region.region}: ${escapeHtml(region.siteCity)}</h3></div>
    <p><strong>${escapeHtml(region.siteName)}</strong><br>${escapeHtml(region.address)}</p>
    <ul>${sessions}</ul>
    <div class="regional-representation"><p><strong>Boys:</strong> ${escapeHtml(region.boysRepresentation)}</p><p><strong>Girls:</strong> ${escapeHtml(region.girlsRepresentation)}</p></div>
  </article>`;
}

export function tournamentHubPage(site) {
  const cards = trackRegionalData.regions.map(regionalCard).join("");
  const content = `${pageHero({
    eyebrow: "Official tournament resources",
    title: "Ohio Tournament Hub",
    description: "Find official boys cross country divisions and the published 2026 track and field regional sites, dates, and representation information."
  })}
  <section class="section section-paper"><div class="container tournament-shell">
    <aside class="source-notice"><strong>Source and accuracy note</strong><p>This page organizes information from official OHSAA documents supplied to Podium Watch. The track regional document was updated April 3, 2026 and says all information is subject to change. Always confirm final details with OHSAA and your school.</p></aside>

    <section aria-labelledby="xc-division-finder-title">
      <div class="section-heading"><div><p class="eyebrow">2026 and 2027 boys cross country</p><h2 id="xc-division-finder-title">Official boys division finder</h2><p>Search 556 Ohio schools from the supplied OHSAA boys cross country division document.</p></div><a class="text-link" href="https://www.ohsaa.org/sports/cc/tournament-info" target="_blank" rel="noopener noreferrer">Confirm with OHSAA</a></div>
      <div class="info-card division-finder" data-xc-division-finder>
        <div class="filter-grid">
          <label class="form-field"><span>School or city</span><input type="search" data-xc-search placeholder="Search a school or city"></label>
          <label class="form-field"><span>2026 division</span><select data-xc-division><option value="">All divisions</option><option value="Division I">Division I</option><option value="Division II">Division II</option><option value="Division III">Division III</option><option value="Division IV">Division IV</option></select></label>
          <label class="form-field"><span>Athletic district</span><select data-xc-district><option value="">All districts</option><option>Central</option><option>East</option><option>Northeast</option><option>Northwest</option><option>Southeast</option><option>Southwest</option></select></label>
        </div>
        <p class="results-summary" data-xc-summary aria-live="polite">Loading official school divisions.</p>
        <div class="division-results" data-xc-results></div>
        <button class="button button-outline" type="button" data-xc-more hidden>Show more schools</button>
      </div>
    </section>

    <section aria-labelledby="track-regional-title">
      <div class="section-heading"><div><p class="eyebrow">2026 track and field</p><h2 id="track-regional-title">Regional sites, dates, and representation</h2><p>Filter the official regional information by division.</p></div><a class="text-link" href="${trackRegionalData.officialSourceUrl}" target="_blank" rel="noopener noreferrer">Confirm with OHSAA</a></div>
      <div class="gender-tabs tournament-tabs" role="group" aria-label="Filter track regional sites"><button type="button" data-track-division="all" aria-pressed="true">All divisions</button>${[1,2,3,4,5].map((division) => `<button type="button" data-track-division="${division}" aria-pressed="false">Division ${division}</button>`).join("")}</div>
      <div class="regional-grid" data-track-regions>${cards}</div>
    </section>
  </div></section>
  <script src="/scripts/tournament-hub.js" defer></script>`;
  return layout({
    site,
    title: "Ohio Tournament Hub",
    description: "Search official Ohio boys cross country divisions and review 2026 track and field regional sites, dates, and representation.",
    pathname: "/tournament-hub/",
    content
  });
}
