import { layout, pageHero } from "../lib/html.mjs";

export function athletesPage(site) {
  const content = `${pageHero({
    eyebrow: "Ohio athlete profiles",
    title: "Find Ohio runners.",
    description:
      "Search Podium Watch athlete profiles by name, school, graduation year, division, event, and verification status."
  })}

  <style>
    .athlete-directory-shell { display:grid; gap:25px; }
    .athlete-directory-source { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:22px; align-items:center; border-left:6px solid #00bf63; }
    .athlete-directory-source h2, .athlete-directory-source p { margin-bottom:0; }
    .athlete-directory-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
    .athlete-directory-stat { padding:20px; border:1px solid rgba(15,23,42,.11); border-radius:14px; background:#fff; box-shadow:0 12px 28px rgba(15,23,42,.05); }
    .athlete-directory-stat strong { display:block; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:clamp(2rem,5vw,3rem); line-height:1; }
    .athlete-directory-stat span { display:block; margin-top:9px; font-weight:900; }
    .athlete-directory-filters { display:grid; gap:17px; }
    .athlete-directory-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); gap:14px; }
    .athlete-directory-fields label { display:grid; gap:8px; font-weight:850; }
    .athlete-directory-fields input, .athlete-directory-fields select { width:100%; min-height:47px; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .athlete-directory-check { display:flex !important; align-items:center; gap:9px; }
    .athlete-directory-check input { width:auto; min-height:auto; }
    .athlete-directory-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .athlete-directory-message { margin:0; padding:14px 16px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:800; }
    .athlete-directory-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .athlete-directory-message[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.16); }
    .athlete-directory-heading { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:end; gap:15px; }
    .athlete-directory-heading h2, .athlete-directory-heading p { margin-bottom:0; }
    .athlete-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .athlete-card { display:grid; gap:15px; padding:21px; border:1px solid rgba(15,23,42,.12); border-radius:15px; background:#fff; box-shadow:0 12px 28px rgba(15,23,42,.05); }
    .athlete-card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .athlete-card h3, .athlete-card p { margin:0; }
    .athlete-card h3 { font-size:1.35rem; }
    .athlete-card-school { color:#475569; font-weight:800; }
    .athlete-card-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .athlete-card-fact { padding:10px; border-radius:10px; background:#f8fafc; }
    .athlete-card-fact span { display:block; color:#64748b; font-size:.72rem; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
    .athlete-card-fact strong { display:block; margin-top:3px; }
    .athlete-status-badge { display:inline-flex; align-items:center; padding:5px 9px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.75rem; font-weight:900; }
    .athlete-status-badge[data-status="editorial"] { color:#7c4a03; background:rgba(245,158,11,.18); }
    .athlete-status-badge[data-status="unverified"] { color:#475569; background:#e2e8f0; }
    .athlete-ranking-note { padding:12px; border-left:4px solid #00bf63; background:#f8fafc; }
    .athlete-ranking-note strong { display:block; }
    .athlete-directory-pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:12px; }
    .athlete-directory-pagination p { min-width:130px; margin:0; text-align:center; font-weight:900; }
    .athlete-directory-empty { padding:34px; border:1px dashed rgba(15,23,42,.25); border-radius:14px; text-align:center; background:#fff; }
    @media (max-width:980px) { .athlete-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:680px) {
      .athlete-directory-source, .athlete-card-grid { grid-template-columns:1fr; }
      .athlete-directory-actions { display:grid; grid-template-columns:1fr; }
      .athlete-directory-actions .button { width:100%; justify-content:center; }
    }
  </style>

  <section class="section section-paper">
    <div class="container athlete-directory-shell" data-athlete-directory>
      <section class="info-card athlete-directory-source">
        <div>
          <p class="eyebrow">Accuracy first</p>
          <h2>Every fact keeps its source label.</h2>
          <p>Podium Watch editorial rankings are clearly separated from official results and verified performance records.</p>
        </div>
        <a class="button button-outline" href="/rankings/methodology/">Read ranking methodology</a>
      </section>

      <div class="athlete-directory-stats" aria-live="polite">
        <article class="athlete-directory-stat"><strong data-athlete-stat-total>0</strong><span>Athlete profiles</span></article>
        <article class="athlete-directory-stat"><strong data-athlete-stat-boys>0</strong><span>Boys profiles</span></article>
        <article class="athlete-directory-stat"><strong data-athlete-stat-girls>0</strong><span>Girls profiles</span></article>
        <article class="athlete-directory-stat"><strong data-athlete-stat-verified>0</strong><span>Verified profiles</span></article>
      </div>

      <form class="info-card athlete-directory-filters" data-athlete-filter-form>
        <div>
          <p class="eyebrow">Search and filter</p>
          <h2>Find an athlete.</h2>
        </div>
        <div class="athlete-directory-fields">
          <label>Search name or school<input type="search" name="search" autocomplete="off" placeholder="Athlete, school, city, or event"></label>
          <label>Gender<select name="gender"><option value="">All athletes</option><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
          <label>Graduation year<select name="graduation_year"><option value="">All classes</option><option>2027</option><option>2028</option><option>2029</option><option>2030</option></select></label>
          <label>Division<select name="division"><option value="">All divisions</option><option value="1">Division I</option><option value="2">Division II</option><option value="3">Division III</option><option value="4">Division IV</option><option value="5">Division V</option></select></label>
          <label>Event<input type="search" name="event" placeholder="5K, 1600, 3200"></label>
          <label>School<input type="search" name="school" placeholder="School name"></label>
          <label>Verification<select name="verification"><option value="">All source levels</option><option value="verified">Verified profiles</option><option value="source_linked">Source linked profiles</option></select></label>
          <label class="athlete-directory-check"><input type="checkbox" name="recruiting_only">Recruiting information available</label>
        </div>
        <div class="athlete-directory-actions">
          <button class="button button-primary" type="submit">Search athletes</button>
          <button class="button button-outline" type="button" data-athlete-reset>Clear filters</button>
        </div>
      </form>

      <p class="athlete-directory-message" data-athlete-directory-message role="status">Loading athlete profiles.</p>

      <div class="athlete-directory-heading">
        <div><p class="eyebrow">Directory results</p><h2 data-athlete-result-title>Athletes</h2></div>
        <p data-athlete-result-count>Loading results</p>
      </div>

      <div class="athlete-card-grid" data-athlete-results aria-live="polite"></div>

      <div class="athlete-directory-pagination" data-athlete-pagination hidden>
        <button class="button button-outline" type="button" data-athlete-previous>Previous</button>
        <p data-athlete-page-label>Page 1 of 1</p>
        <button class="button button-outline" type="button" data-athlete-next>Next</button>
      </div>
    </div>
  </section>

  <script src="/scripts/athlete-directory.js" defer></script>`;

  return layout({
    site,
    title: "Ohio Athlete Directory",
    description:
      "Search Ohio high school cross country and track athlete profiles, rankings, schools, graduation years, and verified performance records.",
    pathname: "/athletes/",
    content
  });
}
