import { layout, pageHero } from "../lib/html.mjs";

export function recruitingPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Recruit Ratings",
    title: "Ohio track and cross country recruits.",
    description:
      "Search original Podium Watch recruiting evaluations by class, event group, rating, verified performance, and commitment status."
  })}

  <style>
    .recruiting-shell { display:grid; gap:24px; }
    .recruiting-trust { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:20px; border-left:6px solid #00bf63; }
    .recruiting-trust h2, .recruiting-trust p { margin-bottom:0; }
    .recruiting-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:13px; }
    .recruiting-summary article { padding:18px; border:1px solid rgba(15,23,42,.12); border-radius:13px; background:#fff; box-shadow:0 10px 25px rgba(15,23,42,.05); }
    .recruiting-summary strong { display:block; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:2.3rem; line-height:1; }
    .recruiting-summary span { display:block; margin-top:8px; font-weight:900; }
    .recruiting-filter { display:grid; gap:16px; }
    .recruiting-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:13px; }
    .recruiting-fields label { display:grid; gap:7px; font-weight:850; }
    .recruiting-fields input, .recruiting-fields select { min-height:46px; width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .recruiting-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .recruiting-message { margin:0; padding:14px 16px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:850; }
    .recruiting-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .recruiting-heading { display:flex; flex-wrap:wrap; align-items:end; justify-content:space-between; gap:12px; }
    .recruiting-heading h2, .recruiting-heading p { margin-bottom:0; }
    .recruiting-table-wrap { overflow:auto; border:1px solid rgba(15,23,42,.12); border-radius:13px; background:#fff; box-shadow:0 12px 30px rgba(15,23,42,.06); }
    .recruiting-table { width:100%; min-width:980px; border-collapse:collapse; }
    .recruiting-table th { padding:13px 12px; background:#111; color:#fff; font-size:.76rem; letter-spacing:.05em; text-align:left; text-transform:uppercase; }
    .recruiting-table td { padding:14px 12px; border-bottom:1px solid rgba(15,23,42,.1); vertical-align:middle; }
    .recruiting-table tbody tr:nth-child(even) { background:#f8fafc; }
    .recruiting-rank { font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.7rem; color:#64748b; }
    .recruiting-athlete strong { display:block; font-size:1.05rem; }
    .recruiting-athlete span { display:block; color:#64748b; font-size:.84rem; font-weight:750; }
    .recruiting-score { display:inline-grid; place-items:center; min-width:52px; min-height:52px; border-radius:50%; background:#111; color:#fff; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.45rem; }
    .recruiting-stars { display:flex; gap:2px; white-space:nowrap; color:#e6a700; font-size:1.08rem; letter-spacing:.02em; }
    .recruiting-stars span[data-empty="true"] { color:#d7dce3; }
    .recruiting-badge { display:inline-flex; padding:5px 9px; border-radius:999px; background:rgba(0,191,99,.14); font-size:.73rem; font-weight:900; }
    .recruiting-pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:12px; }
    .recruiting-pagination p { margin:0; min-width:130px; text-align:center; font-weight:900; }
    .recruiting-mobile-cards { display:none; gap:14px; }
    .recruiting-mobile-card { display:grid; gap:12px; padding:18px; border:1px solid rgba(15,23,42,.12); border-radius:14px; background:#fff; }
    .recruiting-mobile-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .recruiting-mobile-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
    .recruiting-mobile-facts div { padding:9px; border-radius:9px; background:#f8fafc; }
    .recruiting-mobile-facts span { display:block; color:#64748b; font-size:.7rem; font-weight:900; text-transform:uppercase; }
    .recruiting-mobile-facts strong { display:block; margin-top:3px; }
    @media (max-width:780px) {
      .recruiting-trust { grid-template-columns:1fr; }
      .recruiting-table-wrap { display:none; }
      .recruiting-mobile-cards { display:grid; }
      .recruiting-actions { display:grid; grid-template-columns:1fr; }
      .recruiting-actions .button { width:100%; justify-content:center; }
    }
  </style>

  <section class="section section-paper">
    <div class="container recruiting-shell" data-recruiting-directory>
      <section class="info-card recruiting-trust">
        <div>
          <p class="eyebrow">Independent editorial evaluation</p>
          <h2>Performance first. No pay to play.</h2>
          <p>Ratings require sourced performance evidence. Offers, school popularity, social following, and payment do not affect the score.</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <a class="button button-outline" href="/recruiting/methodology/">Read the full methodology</a>
          <a class="button button-outline" href="/recruiting/submit-activity/">Report an offer or commitment</a>
        </div>
      </section>

      <div class="gender-tabs" data-recruiting-gender-tabs role="group" aria-label="Filter by gender">
        <button type="button" data-recruiting-gender-tab="" aria-pressed="true">All athletes</button>
        <button type="button" data-recruiting-gender-tab="boys" aria-pressed="false">Boys</button>
        <button type="button" data-recruiting-gender-tab="girls" aria-pressed="false">Girls</button>
      </div>

      <div class="recruiting-summary" aria-live="polite">
        <article><strong data-recruiting-total>0</strong><span>Published recruits</span></article>
        <article><strong data-recruiting-five-stars>0</strong><span>Five star recruits</span></article>
        <article><strong data-recruiting-committed>0</strong><span>Committed athletes</span></article>
        <article><strong data-recruiting-uncommitted>0</strong><span>Uncommitted athletes</span></article>
      </div>

      <form class="info-card recruiting-filter" data-recruiting-form>
        <div>
          <p class="eyebrow">Recruiter search</p>
          <h2>Find the right athlete.</h2>
        </div>

        <div class="recruiting-fields">
          <label>Search<input type="search" name="search" placeholder="Athlete, school, event, or college"></label>
          <label>Gender<select name="gender"><option value="">All athletes</option><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
          <label>Graduation year<select name="graduation_year"><option value="">All classes</option><option>2027</option><option>2028</option><option>2029</option><option>2030</option><option>2031</option></select></label>
          <label>Event group<select name="event_group"><option value="">All event groups</option><option value="cross_country">Cross Country</option><option value="distance">Distance</option><option value="middle_distance">Middle Distance</option><option value="sprints">Sprints</option><option value="hurdles">Hurdles</option><option value="jumps">Jumps</option><option value="pole_vault">Pole Vault</option><option value="throws">Throws</option><option value="combined_events">Combined Events</option></select></label>
          <label>Specific event<select name="event_key" data-recruiting-event-filter><option value="">All events</option></select></label>
          <label>Minimum stars<select name="minimum_stars"><option value="">Any rating</option><option value="5">Five stars</option><option value="4">Four stars or higher</option><option value="3">Three stars or higher</option><option value="2">Two stars or higher</option><option value="1">One star or higher</option></select></label>
          <label>Minimum score<input type="number" name="minimum_score" min="70" max="100" step=".01" placeholder="Example: 90"></label>
          <label>Commitment<select name="commitment"><option value="">All athletes</option><option value="uncommitted">Uncommitted</option><option value="committed">Committed</option></select></label>
          <label>Maximum time in seconds<input type="number" name="maximum_time" min="1" step=".01" placeholder="Example: 585 for 9:45"></label>
          <label>Minimum field mark in meters<input type="number" name="minimum_mark" min="0" step=".001" placeholder="Example: 1.93"></label>
          <label>Sort<select name="sort"><option value="rating">Recruit rating</option><option value="name">Athlete name</option><option value="class">Graduation class</option></select></label>
        </div>

        <div class="recruiting-actions">
          <button class="button button-primary" type="submit">Search recruits</button>
          <button class="button button-outline" type="button" data-recruiting-reset>Clear filters</button>
        </div>
      </form>

      <p class="recruiting-message" data-recruiting-message role="status">Loading published recruit ratings.</p>

      <div class="recruiting-heading">
        <div><p class="eyebrow">Podium Watch recruiting database</p><h2>Published evaluations</h2></div>
        <p data-recruiting-count>Loading results</p>
      </div>

      <div class="recruiting-table-wrap">
        <table class="recruiting-table">
          <thead>
            <tr>
              <th>Class rank</th>
              <th>Athlete</th>
              <th>Group</th>
              <th>Class</th>
              <th>Top verified mark</th>
              <th>Score</th>
              <th>Stars</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody data-recruiting-rows></tbody>
        </table>
      </div>

      <div class="recruiting-mobile-cards" data-recruiting-mobile></div>

      <div class="recruiting-pagination" data-recruiting-pagination hidden>
        <button class="button button-outline" type="button" data-recruiting-previous>Previous</button>
        <p data-recruiting-page>Page 1 of 1</p>
        <button class="button button-outline" type="button" data-recruiting-next>Next</button>
      </div>
    </div>
  </section>

  <script src="/scripts/recruiting-directory.js" defer></script>`;

  return layout({
    site,
    title: "Ohio Track and Cross Country Recruiting Database",
    description:
      "Search Podium Watch recruit ratings for Ohio high school cross country and track athletes by class, event group, verified performance, and commitment status.",
    pathname: "/recruiting/",
    content
  });
}
