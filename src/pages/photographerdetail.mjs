import {
  layout,
  pageHero
} from "../lib/html.mjs";

// A single photographer's public profile, driven by ?slug= (client-side
// fetch against api/photographers/detail.js), matching /team/?slug= and
// /race/?race= convention -- Photographer Network data lives entirely
// in Supabase (admin-managed, changes without a code deploy), so this
// is NOT baked per-record at build time the way /stories/ or the
// seed-file-backed /athletes/<slug>/ pages are.
export function photographerDetailPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Photographer Network",
    title: "Photographer profile.",
    description: "Portfolio, service area, and contact information.",
    compact: true
  })}

  <style>
    .photog-profile-shell { display: grid; gap: 24px; }
    .photog-profile-hero { display: flex; flex-wrap: wrap; gap: 22px; padding: 26px; border-radius: 18px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .photog-profile-image { width: 140px; height: 140px; object-fit: cover; border-radius: 14px; background: #f3f3f3; flex-shrink: 0; }
    .photog-profile-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .photog-badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; background: rgba(0, 191, 99, 0.16); }
    .photog-badge-featured { background: #111827; color: #ffffff; }
    .photog-badge-founding { background: #ffd447; color: #111827; }
    .photog-badge-verified { background: #00bf63; color: #ffffff; }
    .photog-profile-sports { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .photog-tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 0.78rem; background: rgba(15, 23, 42, 0.06); }
    .photog-profile-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .photog-profile-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .photog-portfolio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 14px; }
    .photog-portfolio-grid img { width: 100%; height: 170px; object-fit: cover; border-radius: 10px; }
    .photog-profile-empty { padding: 24px; text-align: center; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
  </style>

  <section class="section section-paper">
    <div class="container photog-profile-shell">
      <div class="info-card" data-photog-loading>
        <h2>Loading profile</h2>
        <p>Please wait while Podium Watch loads this photographer.</p>
      </div>

      <div data-photog-message hidden></div>

      <div data-photog-root hidden>
        <div class="photog-profile-hero">
          <img class="photog-profile-image" data-photog-image alt="" hidden>
          <div>
            <div class="photog-profile-badges" data-photog-badges></div>
            <h1 data-photog-name></h1>
            <p data-photog-location></p>
            <div class="photog-profile-sports" data-photog-sports></div>
          </div>
        </div>

        <section class="photog-profile-panel" data-photog-about-section hidden>
          <p class="eyebrow">About</p>
          <p data-photog-about></p>
        </section>

        <section class="photog-profile-panel">
          <p class="eyebrow">Portfolio</p>
          <div class="photog-portfolio-grid" data-photog-portfolio></div>
          <div class="photog-profile-empty" data-photog-portfolio-empty hidden>No portfolio images have been added yet.</div>
        </section>

        <section class="photog-profile-panel">
          <p class="eyebrow">Contact</p>
          <div class="photog-profile-links" data-photog-links></div>
        </section>

        <p><a class="text-link" href="/photographers/">Back to Find a Photographer</a></p>
      </div>
    </div>
  </section>

  <script src="/scripts/photographer-detail.js" defer></script>`;

  return layout({
    site,
    title: "Photographer Profile",
    description: "A Podium Watch Photographer Network profile -- portfolio, service area, and contact information.",
    pathname: "/photographers/profile/",
    content
  });
}
