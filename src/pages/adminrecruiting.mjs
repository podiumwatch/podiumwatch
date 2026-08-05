import { layout, pageHero } from "../lib/html.mjs";

export function adminRecruitingPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Admin",
    title: "Recruit Ratings and Performance Center",
    description:
      "Import sourced performances, publish recruit ratings, and manage recruiting activity without exposing private contact information."
  })}

  <style>
    .recruit-admin-shell { display:grid; gap:22px; }
    .recruit-admin-message { margin:0; padding:14px 16px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:850; }
    .recruit-admin-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .recruit-admin-message[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.16); }
    .recruit-admin-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:13px; }
    .recruit-admin-stat { padding:18px; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff; }
    .recruit-admin-stat strong { display:block; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:2.2rem; line-height:1; }
    .recruit-admin-stat span { display:block; margin-top:8px; font-weight:900; }
    .recruit-admin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
    .recruit-admin-panel { display:grid; gap:15px; }
    .recruit-admin-panel h2, .recruit-admin-panel h3, .recruit-admin-panel p { margin-bottom:0; }
    .recruit-admin-form { display:grid; gap:14px; }
    .recruit-admin-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .recruit-admin-fields label { display:grid; gap:7px; font-weight:850; }
    .recruit-admin-fields input, .recruit-admin-fields select, .recruit-admin-fields textarea, .recruit-admin-form > label input, .recruit-admin-form > label textarea { width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:8px; background:#fff; font:inherit; }
    .recruit-admin-fields textarea, .recruit-admin-form > label textarea { min-height:104px; resize:vertical; }
    .recruit-admin-wide { grid-column:1 / -1; }
    .recruit-admin-check { display:flex !important; align-items:center; gap:9px; }
    .recruit-admin-check input { width:auto !important; }
    .recruit-admin-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .recruit-admin-profile-list { display:grid; gap:8px; max-height:420px; overflow:auto; }
    .recruit-admin-profile-button { width:100%; padding:12px; border:1px solid rgba(15,23,42,.14); border-radius:9px; background:#fff; text-align:left; cursor:pointer; }
    .recruit-admin-profile-button strong, .recruit-admin-profile-button span { display:block; }
    .recruit-admin-profile-button span { color:#64748b; font-size:.85rem; margin-top:4px; }
    .recruit-admin-table-wrap { overflow:auto; border:1px solid rgba(15,23,42,.12); border-radius:10px; }
    .recruit-admin-table { width:100%; min-width:720px; border-collapse:collapse; background:#fff; }
    .recruit-admin-table th, .recruit-admin-table td { padding:10px; border-bottom:1px solid rgba(15,23,42,.1); text-align:left; vertical-align:top; }
    .recruit-admin-table th { background:#111; color:#fff; font-size:.74rem; text-transform:uppercase; }
    .recruit-admin-preview-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:9px; }
    .recruit-admin-preview-summary div { padding:11px; border-radius:9px; background:#f8fafc; }
    .recruit-admin-preview-summary strong, .recruit-admin-preview-summary span { display:block; }
    .recruit-admin-preview-summary strong { font-size:1.35rem; }
    .recruit-admin-code { min-height:230px !important; font-family:Consolas,monospace !important; font-size:.86rem !important; }
    .recruit-admin-upload { padding:18px; border:2px dashed rgba(15,23,42,.22); border-radius:12px; background:#f8fafc; }
    .recruit-admin-help { padding:12px 14px; border-radius:9px; background:rgba(0,191,99,.09); }
    .recruit-admin-advanced { border:1px solid rgba(15,23,42,.12); border-radius:10px; padding:12px; }
    .recruit-admin-advanced summary { cursor:pointer; font-weight:900; }
    @media (max-width:850px) { .recruit-admin-grid, .recruit-admin-fields { grid-template-columns:1fr; } .recruit-admin-wide { grid-column:auto; } .recruit-admin-actions { display:grid; grid-template-columns:1fr; } .recruit-admin-actions .button { width:100%; justify-content:center; } }
  </style>

  <section class="section section-paper">
    <div class="container recruit-admin-shell" data-recruit-admin>
      <section class="info-card" data-recruit-admin-loading>
        <h2>Checking admin access</h2>
        <p>Please wait while the Recruit Ratings Center loads.</p>
      </section>

      <div data-recruit-admin-dashboard hidden>
        <div class="recruit-admin-actions">
          <a class="button button-outline" href="/admin/operations/">Operations Center</a>
          <a class="button button-outline" href="/admin/athletes/">Athlete Data</a>
          <a class="button button-outline" href="/recruiting/" target="_blank" rel="noopener">Public recruiting database</a>
          <a class="button button-outline" href="/recruiting/methodology/" target="_blank" rel="noopener">Methodology</a>
        </div>

        <p class="recruit-admin-message" data-recruit-admin-message role="status">Loading recruiting data.</p>

        <div class="recruit-admin-stats">
          <article class="recruit-admin-stat"><strong data-recruit-stat-performances>0</strong><span>Total performances</span></article>
          <article class="recruit-admin-stat"><strong data-recruit-stat-verified>0</strong><span>Sourced or verified</span></article>
          <article class="recruit-admin-stat"><strong data-recruit-stat-published>0</strong><span>Published ratings</span></article>
          <article class="recruit-admin-stat"><strong data-recruit-stat-drafts>0</strong><span>Draft ratings</span></article>
          <article class="recruit-admin-stat"><strong data-recruit-stat-activity>0</strong><span>Recruiting activity</span></article>
          <article class="recruit-admin-stat"><strong data-recruit-stat-failed>0</strong><span>Failed imports</span></article>
        </div>

        <div class="recruit-admin-grid">
          <section class="info-card recruit-admin-panel">
            <div><p class="eyebrow">Find athlete</p><h2>Open a recruiting profile</h2></div>
            <form class="recruit-admin-form" data-recruit-search-form>
              <label>Search athlete<input type="search" name="search" placeholder="Athlete name or profile slug"></label>
              <button class="button button-dark" type="submit">Search athletes</button>
            </form>
            <div class="recruit-admin-profile-list" data-recruit-search-results><p>Search for an athlete to begin.</p></div>
          </section>

          <section class="info-card recruit-admin-panel">
            <div><p class="eyebrow">Meet results import</p><h2>Upload a complete meet</h2></div>
            <p class="recruit-admin-help">Enter the meet information once, then upload a CSV or paste the complete results. Podium Watch will match existing athletes, identify duplicates, and stop uncertain rows for review. Every imported performance is saved hidden until you approve it for publication.</p>
            <form class="recruit-admin-form" data-performance-import-form>
              <div class="recruit-admin-fields">
                <label>Meet name<input name="meet_name" required placeholder="OHSAA Division 4 State Championship"></label>
                <label>Meet date<input type="date" name="meet_date" required></label>
                <label>Sport<select name="sport" required><option value="cross_country">Cross Country</option><option value="indoor_track">Indoor Track</option><option value="outdoor_track">Outdoor Track</option></select></label>
                <label>Season year<input type="number" name="season_year" min="2000" max="2200" required></label>
                <label>Default gender<select name="gender"><option value="">Use each row</option><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
                <label>Default event<input name="event_name" placeholder="5K, 1600, High Jump"></label>
                <label class="recruit-admin-wide">Official results link<input type="url" name="source_url" placeholder="https://"></label>
                <div class="recruit-admin-wide recruit-admin-actions">
                  <button class="button button-outline" type="button" data-results-link-import>Load supported results link</button>
                  <small>Direct Athletic.net importing stays disabled. Use an authorized original timing source, an uploaded file, or keep the Athletic.net link as source credit.</small>
                </div>
                <label class="recruit-admin-wide recruit-admin-upload">Upload official results file<input type="file" name="results_file" accept=".csv,.txt,.html,.htm,text/csv,text/plain,text/html"></label>
                <label class="recruit-admin-wide">Or paste complete results<textarea class="recruit-admin-code" name="csv_data" placeholder="Place,Athlete,Team,Grade,Time,Event,Gender"></textarea></label>
                <p class="recruit-admin-wide recruit-admin-help">Unmatched rows are never saved and never create athlete profiles by default. Connect or create the athlete in Athlete Data, then preview the import again.</p>
                <label class="recruit-admin-wide">Or paste results copied straight from an official results page (MileSplit, SEO Timing, and similar sites that render results with JavaScript and cannot be fetched directly)<textarea class="recruit-admin-code" name="official_results_text" placeholder="Paste everything you copied from the page, including the PLACE / ATHLETE / TEAM / MARK header line and any Team Scores section -- both are handled automatically."></textarea></label>
                <div class="recruit-admin-wide recruit-admin-actions">
                  <button class="button button-outline" type="button" data-official-text-preview>Preview pasted official results</button>
                  <small>Reads the meet name, date, sport, season year, and source settings above. Grade (FR/SO/JR/SR) is converted to graduation year using the season year.</small>
                </div>
                <label class="recruit-admin-wide recruit-admin-check"><input type="checkbox" name="create_profiles_for_unmatched_official_rows"><span>Create hidden profiles for unmatched rows from this official source</span></label>
                <p class="recruit-admin-wide recruit-admin-help">Only applies to rows with Source type set to Official, and only when the row's school resolves to exactly one official Ohio school by exact name or an existing alias. Created profiles are marked Unverified and stay hidden from every public page until an administrator reviews and publishes them, the same as every other import.</p>
              </div>
              <details class="recruit-admin-advanced"><summary>Advanced source settings</summary><div class="recruit-admin-fields">
                <label>Source label<input name="source_label" value="Official meet results"></label>
                <label>Source type<select name="source_type"><option value="official">Official</option><option value="supplied_reference">Supplied reference</option><option value="community">Community submitted</option><option value="editorial">Editorial</option></select></label>
                <label>Verification<select name="verification_status"><option value="source_linked">Source linked</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></label>
              </div></details>
              <div class="recruit-admin-actions">
                <button class="button button-dark" type="submit">Preview meet results</button>
                <button class="button button-primary" type="button" data-performance-import-commit disabled>Import ready results</button>
                <a class="button button-outline" href="/data/performance-import-template.csv" download>Download template</a>
              </div>
            </form>
            <div class="recruit-admin-preview-summary" data-performance-import-summary></div>
            <div class="recruit-admin-table-wrap"><table class="recruit-admin-table"><thead><tr><th>Row</th><th>Athlete and team</th><th>Event</th><th>Mark</th><th>Status</th><th>Review note</th></tr></thead><tbody data-performance-import-rows></tbody></table></div>
          </section>
        </div>

        <section class="info-card recruit-admin-panel" data-recruit-athlete-editor hidden>
          <div><p class="eyebrow">Recruit evaluation</p><h2 data-recruit-athlete-title>Edit athlete recruiting information</h2></div>

          <div class="recruit-admin-actions">
            <button class="button button-outline" type="button" data-recruit-preview-button>Preview public profile</button>
            <small>Shows exactly what would appear publicly if every current draft were published right now. Nothing is changed or published by this preview.</small>
          </div>
          <div class="recruit-admin-panel" data-recruit-preview-panel hidden>
            <h3>Public profile preview</h3>
            <div data-recruit-preview-body></div>
          </div>

          <div class="recruit-admin-grid">
            <section class="recruit-admin-panel">
              <h3>Podium Watch recruit rating</h3>
              <form class="recruit-admin-form" data-recruit-rating-form>
                <input type="hidden" name="profile_id">
                <input type="hidden" name="rating_id">
                <div class="recruit-admin-fields">
                  <label>Event group<select name="event_group" required><option value="cross_country">Cross Country</option><option value="distance">Distance</option><option value="middle_distance">Middle Distance</option><option value="sprints">Sprints</option><option value="hurdles">Hurdles</option><option value="jumps">Jumps</option><option value="pole_vault">Pole Vault</option><option value="throws">Throws</option><option value="combined_events">Combined Events</option><option value="other">Other</option></select></label>
                  <label>Primary event<select name="primary_event_key" data-recruit-event-options></select></label>
                  <label>Secondary event keys<input name="secondary_event_keys" placeholder="track_1600, track_3200"></label>
                  <label>Rating score<input type="number" name="rating_score" min="70" max="100" step=".01"></label>
                  <label>Projection<select name="projection_level"><option value="">Not selected</option><option value="national_elite">National elite</option><option value="high_division_one">High Division I</option><option value="division_one">Division I</option><option value="division_two">Division II</option><option value="division_three_naia">Division III or NAIA</option><option value="developing_college">Developing college prospect</option><option value="watch_list">Watch list</option></select></label>
                  <label>Confidence<select name="confidence_level"><option value="limited">Limited evidence</option><option value="developing">Developing evidence</option><option value="strong">Strong evidence</option></select></label>
                  <label>Top verified event<select name="top_verified_event_key" data-recruit-best-event-options></select></label>
                  <label>Data cutoff date<input type="date" name="data_cutoff_date"></label>
                  <label>Status<select name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                  <label class="recruit-admin-check"><input type="checkbox" name="based_on_verified_data">Based on verified performance evidence</label>
                  <label class="recruit-admin-wide">Evaluation<textarea name="evaluation" placeholder="Explain the performance evidence, event fit, and recruiting projection."></textarea></label>
                  <label class="recruit-admin-wide">Strengths<textarea name="strengths"></textarea></label>
                  <label class="recruit-admin-wide">Development notes<textarea name="development_notes"></textarea></label>
                  <label class="recruit-admin-wide">Editorial override note<textarea name="editorial_override_reason" placeholder="Optional internal explanation."></textarea></label>
                </div>
                <button class="button button-primary" type="submit">Save recruit rating</button>
              </form>
              <div class="recruit-admin-actions">
                <button class="button button-outline" type="button" data-recruit-comparison-button>Compare to rated athletes in this group</button>
                <small>Shows already published ratings in the same class, gender, and event group as a side-by-side reference. It never suggests a score.</small>
              </div>
              <div class="recruit-admin-table-wrap" data-recruit-comparison-panel hidden><table class="recruit-admin-table"><thead><tr><th>Athlete</th><th>Mark</th><th>Score</th><th>Stars</th><th>Class rank</th><th>Group rank</th></tr></thead><tbody data-recruit-comparison-rows></tbody></table></div>
            </section>

            <section class="recruit-admin-panel">
              <h3>Recruiting activity</h3>
              <form class="recruit-admin-form" data-recruit-activity-form>
                <input type="hidden" name="profile_id">
                <input type="hidden" name="activity_id">
                <div class="recruit-admin-fields">
                  <label>Activity type<select name="activity_type"><option value="interest">Interest</option><option value="offer">Offer</option><option value="visit">Visit</option><option value="commitment">Commitment</option><option value="signing">Signing</option><option value="other">Other</option></select></label>
                  <label>College name<input name="college_name" required></label>
                  <label>College division<input name="college_division" placeholder="NCAA Division I"></label>
                  <label>Event group<input name="event_group"></label>
                  <label>Activity date<input type="date" name="activity_date"></label>
                  <label>Verification<select name="verification_status"><option value="reported">Reported</option><option value="confirmed_by_athlete">Confirmed by athlete or family</option><option value="confirmed_by_coach">Confirmed by coach</option><option value="publicly_announced">Publicly announced</option><option value="disputed">Disputed</option></select></label>
                  <label>Source label<input name="source_label" required></label>
                  <label>Source URL<input type="url" name="source_url"></label>
                  <label class="recruit-admin-check"><input type="checkbox" name="public_visible">Publish this activity</label>
                  <label class="recruit-admin-wide">Notes<textarea name="notes"></textarea></label>
                </div>
                <button class="button button-dark" type="submit">Save recruiting activity</button>
              </form>
            </section>
          </div>

          <div class="recruit-admin-grid">
            <section class="recruit-admin-panel"><h3>Best sourced performances</h3><div class="recruit-admin-table-wrap"><table class="recruit-admin-table"><thead><tr><th>Event</th><th>Mark</th><th>Meet</th><th>Source</th></tr></thead><tbody data-recruit-best-rows></tbody></table></div></section>
            <section class="recruit-admin-panel"><h3>Ratings</h3><div class="recruit-admin-table-wrap"><table class="recruit-admin-table"><thead><tr><th>Group</th><th>Score</th><th>Stars</th><th>Status</th><th>Action</th></tr></thead><tbody data-recruit-rating-rows></tbody></table></div></section>
          </div>

          <section class="recruit-admin-panel"><h3>Recruiting timeline</h3><div class="recruit-admin-table-wrap"><table class="recruit-admin-table"><thead><tr><th>Type</th><th>College</th><th>Date</th><th>Verification</th><th>Public</th><th>Action</th></tr></thead><tbody data-recruit-activity-rows></tbody></table></div></section>

          <section class="recruit-admin-panel">
            <h3>Athlete media</h3>
            <form class="recruit-admin-form" data-recruit-content-form>
              <input type="hidden" name="profile_id">
              <input type="hidden" name="content_item_id">
              <div class="recruit-admin-fields">
                <label>Media type<select name="content_type" required><option value="photo">Photo</option><option value="video">Video</option><option value="article">Article</option><option value="other">Other</option></select></label>
                <label>Status<select name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="archived">Archived</option></select></label>
                <label class="recruit-admin-wide">Media URL<input type="url" name="url" required placeholder="https://"></label>
                <label>Title<input name="title"></label>
                <label>Credit<input name="credit" placeholder="Photographer or source name"></label>
                <label class="recruit-admin-wide">Caption<textarea name="caption"></textarea></label>
                <label>Source label<input name="source_label"></label>
                <label>Source URL<input type="url" name="source_url" placeholder="https://"></label>
                <label class="recruit-admin-check"><input type="checkbox" name="featured">Feature on profile</label>
              </div>
              <button class="button button-dark" type="submit">Save media item</button>
            </form>
            <div class="recruit-admin-table-wrap"><table class="recruit-admin-table"><thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Featured</th><th>Action</th></tr></thead><tbody data-recruit-content-rows></tbody></table></div>
          </section>
        </section>
      </div>
    </div>
  </section>

  <script src="/scripts/admin-recruiting.js" defer></script>`;

  return layout({
    site,
    title: "Recruit Ratings and Performance Center",
    description:
      "Private Podium Watch performance import, recruit rating, and recruiting activity administration.",
    pathname: "/admin/recruiting/",
    content
  });
}
