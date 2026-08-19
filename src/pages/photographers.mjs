import {
  layout,
  pageHero
} from "../lib/html.mjs";
import { SPORTS, REGIONS } from "../../lib/photographer_constants.mjs";

// Photographer Network -- Phase One public directory. Structurally
// mirrors src/pages/teams.mjs (search fields + card grid + count +
// empty state), backed by a server-side-filtered POST endpoint
// (api/photographers/index.js) since school-name resolution needs a
// real database join, not client-side filtering of one static payload.
export function photographersPage(site) {
  const sportOptions = SPORTS.map((s) => `<option value="${s.value}">${s.label}</option>`).join("");
  const regionOptions = REGIONS.map((r) => `<option value="${r}">${r}</option>`).join("");

  const content = `${pageHero({
    eyebrow: "Podium Watch Photographer Network",
    title: "Find sports photographers near your school.",
    description: "Search your school, city, or region to discover photographers who cover sports near you."
  })}

  <style>
    .photog-directory-shell { display: grid; gap: 28px; }
    .photog-directory-search { display: grid; gap: 20px; }
    .photog-directory-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .photog-directory-search label { display: block; }
    .photog-directory-search input, .photog-directory-search select {
      display: block; width: 100%; margin-top: 8px; padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22); border-radius: 9px; background: #ffffff; font: inherit;
    }
    .photog-directory-actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .photog-directory-status { padding: 14px 16px; border-radius: 10px; background: rgba(0, 191, 99, 0.1); }
    .photog-directory-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 16px; }
    .photog-directory-heading h2, .photog-directory-heading p { margin-bottom: 0; }
    .photog-directory-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }

    .photog-card { display: grid; gap: 12px; padding: 20px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 14px; background: #ffffff; }
    .photog-card-image { width: 100%; height: 150px; object-fit: cover; border-radius: 10px; background: #f3f3f3; }
    .photog-card-badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .photog-badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; background: rgba(0, 191, 99, 0.16); }
    .photog-badge-featured { background: #111827; color: #ffffff; }
    .photog-badge-founding { background: #ffd447; color: #111827; }
    .photog-badge-verified { background: #00bf63; color: #ffffff; }
    .photog-card h3 { margin: 0; }
    .photog-card-meta { font-size: 0.86rem; opacity: 0.75; }
    .photog-card-sports { display: flex; flex-wrap: wrap; gap: 6px; }
    .photog-tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 0.74rem; background: rgba(15, 23, 42, 0.06); }
    .photog-card-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }

    .photog-directory-manager { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; }
    .photog-directory-manager h2, .photog-directory-manager p { margin-bottom: 0; }

    @media (max-width: 700px) {
      .photog-directory-fields { grid-template-columns: 1fr; }
    }
  </style>

  <section class="section section-paper">
    <div class="container photog-directory-shell">
      <section class="info-card">
        <form class="photog-directory-search" data-photog-search-form>
          <div class="photog-directory-fields">
            <label><strong>School</strong><input type="text" name="school" placeholder="e.g. Russia High School" data-photog-school></label>
            <label><strong>City</strong><input type="text" name="city" placeholder="e.g. Columbus"></label>
            <label>
              <strong>Region</strong>
              <select name="region"><option value="">Any region</option>${regionOptions}</select>
            </label>
            <label>
              <strong>Sport</strong>
              <select name="sport"><option value="">Any sport</option>${sportOptions}</select>
            </label>
          </div>
          <div class="photog-directory-actions">
            <button class="button button-primary" type="submit">Search photographers</button>
            <button class="button button-outline" type="button" data-photog-clear>Clear filters</button>
          </div>
        </form>
      </section>

      <p class="photog-directory-status" data-photog-status aria-live="polite" hidden></p>

      <section>
        <div class="photog-directory-heading">
          <div>
            <p class="eyebrow">Photographer Network</p>
            <h2>Photographers serving Ohio sports</h2>
          </div>
          <p><strong data-photog-count>0</strong> photographers found</p>
        </div>

        <div class="photog-directory-grid" data-photog-results style="margin-top:22px;"></div>

        <div class="info-card" data-photog-empty hidden>
          <h2>No photographers found</h2>
          <p data-photog-empty-message>Try a different school, city, region, or sport.</p>
        </div>
      </section>

      <section class="info-card photog-directory-manager">
        <div>
          <p class="eyebrow">Sports photographers</p>
          <h2>List your business</h2>
          <p>Create a free listing to appear in the Podium Watch Photographer Network directory.</p>
        </div>
        <div class="photog-directory-actions">
          <a class="button button-primary" href="/photographer-login/">Manage your listing</a>
        </div>
      </section>
    </div>
  </section>

  <script src="/scripts/photographers.js" defer></script>`;

  return layout({
    site,
    title: "Find a Photographer",
    description: "Search Ohio sports photographers by school, city, region, or sport -- the Podium Watch Photographer Network.",
    pathname: "/photographers/",
    content
  });
}
