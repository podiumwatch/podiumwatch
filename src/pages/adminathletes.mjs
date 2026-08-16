import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .athlete-admin-shell { display:grid; gap:24px; }
    .athlete-admin-message { margin:0; padding:14px 17px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:800; }
    .athlete-admin-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .athlete-admin-message[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.16); }
    .athlete-admin-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:13px; }
    .athlete-admin-stat { padding:18px; border:1px solid rgba(15,23,42,.11); border-radius:13px; background:#fff; box-shadow:0 10px 26px rgba(15,23,42,.05); }
    .athlete-admin-stat strong { display:block; font-size:2rem; line-height:1; }
    .athlete-admin-stat span { display:block; margin-top:8px; font-weight:850; }
    .athlete-admin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
    .athlete-admin-panel { display:grid; gap:16px; }
    .athlete-admin-panel h2, .athlete-admin-panel p { margin-bottom:0; }
    .athlete-admin-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .athlete-admin-form { display:grid; gap:14px; }
    .athlete-admin-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .athlete-admin-form label { display:grid; gap:7px; font-weight:850; }
    .athlete-admin-form input, .athlete-admin-form select, .athlete-admin-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .athlete-admin-form textarea { min-height:110px; resize:vertical; }
    .athlete-admin-wide { grid-column:1 / -1; }
    .athlete-admin-checkbox { display:flex !important; align-items:flex-start; gap:9px; }
    .athlete-admin-checkbox input { width:auto; margin-top:4px; }
    .athlete-admin-table-wrap { overflow:auto; border:1px solid rgba(15,23,42,.12); border-radius:12px; }
    .athlete-admin-table { width:100%; min-width:860px; border-collapse:collapse; background:#fff; }
    .athlete-admin-table th, .athlete-admin-table td { padding:12px; text-align:left; vertical-align:top; border-bottom:1px solid rgba(15,23,42,.09); }
    .athlete-admin-table th { background:#111827; color:#fff; }
    .athlete-admin-badge { display:inline-flex; padding:5px 9px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.75rem; font-weight:900; }
    .athlete-admin-badge[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.18); }
    .athlete-admin-badge[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.13); }
    .athlete-admin-summary { display:grid; gap:9px; }
    .athlete-admin-row { display:flex; justify-content:space-between; gap:15px; padding:10px 0; border-bottom:1px solid rgba(15,23,42,.1); }
    .athlete-admin-row:last-child { border-bottom:0; }
    .athlete-admin-profile-list { display:grid; gap:10px; max-height:560px; overflow:auto; }
    .athlete-admin-profile-button { width:100%; padding:13px; border:1px solid rgba(15,23,42,.12); border-radius:11px; background:#fff; text-align:left; cursor:pointer; }
    .athlete-admin-profile-button:hover, .athlete-admin-profile-button:focus-visible { border-color:#00bf63; }
    .athlete-admin-profile-button strong, .athlete-admin-profile-button span { display:block; }
    .athlete-admin-profile-button span { margin-top:4px; color:#64748b; }
    @media (max-width:900px) { .athlete-admin-grid { grid-template-columns:1fr; } }
    @media (max-width:650px) { .athlete-admin-fields { grid-template-columns:1fr; } .athlete-admin-wide { grid-column:auto; } .athlete-admin-actions { display:grid; grid-template-columns:1fr; } .athlete-admin-actions .button { width:100%; justify-content:center; } }
`;

export function adminAthletesPage(site) {
  const content = `<div class="athlete-admin-shell" data-athlete-admin>
      <div class="info-card" data-athlete-admin-loading><h2>Checking admin access.</h2><p>Loading the Athlete Data Center.</p></div>

      <div data-athlete-admin-dashboard hidden>
        <p class="athlete-admin-message" data-athlete-admin-message role="status">Loading athlete data.</p>

        <div class="athlete-admin-stats" style="margin-top:20px">
          <article class="athlete-admin-stat"><strong data-athlete-count-profiles>0</strong><span>Profiles</span></article>
          <article class="athlete-admin-stat"><strong data-athlete-count-public>0</strong><span>Public profiles</span></article>
          <article class="athlete-admin-stat"><strong data-athlete-count-verified>0</strong><span>Verified profiles</span></article>
          <article class="athlete-admin-stat"><strong data-athlete-count-performance>0</strong><span>Performances</span></article>
          <article class="athlete-admin-stat"><strong data-athlete-count-corrections>0</strong><span>Open corrections</span></article>
          <article class="athlete-admin-stat"><strong data-athlete-count-unlinked>0</strong><span>Unlinked roster athletes</span></article>
        </div>

        <div class="athlete-admin-grid" style="margin-top:20px">
          <section class="info-card athlete-admin-panel">
            <div><p class="eyebrow">Foundation import</p><h2>2026 ranking athlete seed</h2><p>The bundled seed creates athlete identities and ranking links. It does not create verified personal bests.</p></div>
            <div data-athlete-install-status></div>
            <div class="athlete-admin-actions">
              <button class="button button-outline" type="button" data-athlete-preview>Preview import</button>
              <button class="button button-primary" type="button" data-athlete-commit disabled>Import reviewed seed</button>
              <button class="button button-outline" type="button" data-athlete-refresh>Refresh</button>
            </div>
            <label class="athlete-admin-checkbox"><input type="checkbox" data-athlete-publish checked>Publish imported database profiles</label>
            <label class="athlete-admin-checkbox"><input type="checkbox" data-athlete-link-rosters checked>Link safe exact roster matches</label>
            <div class="athlete-admin-summary" data-athlete-preview-summary><p>Run preview before importing.</p></div>
          </section>

          <section class="info-card athlete-admin-panel">
            <div><p class="eyebrow">Profile search</p><h2>Find and edit an athlete</h2></div>
            <form class="athlete-admin-form" data-athlete-admin-search-form>
              <label>Search athlete<input type="search" name="search" placeholder="Name or profile slug"></label>
              <button class="button button-dark" type="submit">Search profiles</button>
            </form>
            <div class="athlete-admin-profile-list" data-athlete-admin-results><p>Search for an athlete to begin.</p></div>
          </section>
        </div>

        <section class="info-card athlete-admin-panel" style="margin-top:20px" data-athlete-editor-panel hidden>
          <div><p class="eyebrow">Athlete profile editor</p><h2 data-athlete-editor-title>Edit athlete</h2></div>
          <form class="athlete-admin-form" data-athlete-profile-form>
            <input type="hidden" name="profile_id">
            <div class="athlete-admin-fields">
              <label>First name<input name="first_name" required></label>
              <label>Last name<input name="last_name" required></label>
              <label>Preferred name<input name="preferred_name"></label>
              <label>Display name<input name="display_name"></label>
              <label>Gender<select name="gender"><option value="boys">Boys</option><option value="girls">Girls</option><option value="unspecified">Unspecified</option></select></label>
              <label>Graduation year<input type="number" name="graduation_year" min="2000" max="2200"></label>
              <label>Graduation year source<input name="graduation_year_source"></label>
              <label>Athlete status<select name="athlete_status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option><option value="transferred">Transferred</option><option value="other">Other</option></select></label>
              <label>Official school ID<input name="current_school_id" placeholder="Optional UUID"></label>
              <label>Team page ID<input name="current_team_id" placeholder="Optional UUID"></label>
              <label>Hometown<input name="hometown"></label>
              <label>College commitment<input name="college_commitment"></label>
              <label>Photo URL<input type="url" name="photo_url"></label>
              <label>Primary events<input name="primary_events" placeholder="5K, 1600, 3200"></label>
              <label>Verification status<select name="verification_status"><option value="unverified">Unverified</option><option value="community_submitted">Community submitted</option><option value="team_roster_linked">Team roster linked</option><option value="editorial_source_linked">Editorial source linked</option><option value="source_verified">Source verified</option><option value="admin_verified">Admin verified</option><option value="disputed">Disputed</option></select></label>
              <label>Recruiting contact route<select name="recruiting_contact_route"><option value="none">None</option><option value="team">Team</option><option value="podium_watch">Podium Watch</option></select></label>
              <label class="athlete-admin-wide">Bio<textarea name="bio"></textarea></label>
              <label class="athlete-admin-wide">Recruiting headline<textarea name="recruiting_headline"></textarea></label>
              <label class="athlete-admin-wide">College interests<textarea name="college_interests"></textarea></label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="public_visible">Public profile</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="verified">Verified identity</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="college_commitment_verified">Verified commitment</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="suspended">Suspended</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="admin_locked">Admin locked</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="recruiting_enabled">Recruiting enabled</label>
              <label class="athlete-admin-checkbox"><input type="checkbox" name="recruiting_consent_confirmed">Recruiting consent confirmed</label>
            </div>
            <div class="athlete-admin-actions"><button class="button button-primary" type="submit">Save athlete profile</button><a class="button button-outline" href="/athletes/" target="_blank" rel="noopener" data-athlete-public-link>Open public profile</a></div>
          </form>

          <div class="athlete-admin-grid">
            <section class="athlete-admin-panel"><h3>Ranking links</h3><div class="athlete-admin-table-wrap"><table class="athlete-admin-table"><thead><tr><th>Ranking</th><th>Rank</th><th>Mark snapshot</th><th>Updated</th></tr></thead><tbody data-athlete-ranking-rows></tbody></table></div></section>
            <section class="athlete-admin-panel"><h3>Roster links</h3><div class="athlete-admin-table-wrap"><table class="athlete-admin-table"><thead><tr><th>Roster athlete</th><th>Gender</th><th>Class</th><th>Public</th></tr></thead><tbody data-athlete-roster-rows></tbody></table></div></section>
          </div>

          <section class="athlete-admin-panel">
            <h3>Add or update a sourced performance</h3>
            <form class="athlete-admin-form" data-athlete-performance-form>
              <input type="hidden" name="profile_id">
              <input type="hidden" name="performance_id">
              <div class="athlete-admin-fields">
                <label>Sport<select name="sport"><option value="cross_country">Cross Country</option><option value="indoor_track">Indoor Track</option><option value="outdoor_track">Outdoor Track</option></select></label>
                <label>Season year<input type="number" name="season_year" min="2000" max="2200" required></label>
                <label>Event<input name="event_name" required placeholder="5K or 1600"></label>
                <label>Mark<input name="mark_text" required placeholder="15:45.20"></label>
                <label>Record type<select name="record_type"><option value="race_result">Race result</option><option value="personal_best">Personal best</option><option value="season_best">Season best</option><option value="split">Split</option><option value="other">Other</option></select></label>
                <label>Meet name<input name="meet_name"></label>
                <label>Meet date<input type="date" name="meet_date"></label>
                <label>Place<input type="number" name="place" min="1"></label>
                <label>Source label<input name="source_label" required></label>
                <label>Source URL<input type="url" name="source_url"></label>
                <label>Source type<select name="source_type"><option value="official">Official</option><option value="supplied_reference">Supplied reference</option><option value="editorial">Editorial</option><option value="community">Community</option><option value="team_roster">Team roster</option></select></label>
                <label>Verification<select name="verification_status"><option value="unverified">Unverified</option><option value="source_linked">Source linked</option><option value="verified">Verified</option><option value="disputed">Disputed</option></select></label>
                <label class="athlete-admin-checkbox"><input type="checkbox" name="public_visible" checked>Public performance</label>
                <label class="athlete-admin-wide">Notes<textarea name="notes"></textarea></label>
              </div>
              <button class="button button-dark" type="submit">Save performance</button>
            </form>
            <div class="athlete-admin-table-wrap"><table class="athlete-admin-table"><thead><tr><th>Event</th><th>Mark</th><th>Meet</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody data-athlete-performance-rows></tbody></table></div>
          </section>
        </section>

        <div class="athlete-admin-grid" style="margin-top:20px">
          <section class="info-card athlete-admin-panel"><div><p class="eyebrow">Accuracy queue</p><h2>Open corrections</h2></div><div class="athlete-admin-table-wrap"><table class="athlete-admin-table"><thead><tr><th>Athlete</th><th>Type</th><th>Details</th><th>Source</th><th>Action</th></tr></thead><tbody data-athlete-correction-rows></tbody></table></div></section>
          <section class="info-card athlete-admin-panel"><div><p class="eyebrow">Duplicate protection</p><h2>Possible duplicate groups</h2></div><div data-athlete-duplicate-groups></div><form class="athlete-admin-form" data-athlete-merge-form><label>Source profile ID<input name="source_profile_id" required></label><label>Target profile ID<input name="target_profile_id" required></label><label>Reason<textarea name="reason"></textarea></label><label class="athlete-admin-checkbox"><input type="checkbox" name="confirm" required>I reviewed both profiles and confirm this merge</label><button class="button button-dark" type="submit">Merge profiles</button></form></section>
        </div>
      </div>
    </div>`;

  return adminShell({
    site,
    pathname: "/admin/athletes/",
    title: "Athlete Data Center",
    description: "Private Podium Watch athlete profile, performance, import, correction, duplicate, and recruiting administration.",
    heading: "Athlete Data Center.",
    intro: "Preview the athlete seed, review possible duplicates, manage public profiles, add sourced performances, and resolve corrections.",
    styles,
    content,
    scripts: ["/scripts/admin-athletes.js"]
  });
}
