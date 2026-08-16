import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .statewide-admin-shell { display:grid; gap:24px; }
    .statewide-admin-message { margin:0; padding:14px 17px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:800; }
    .statewide-admin-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .statewide-admin-message[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.16); }
    .statewide-admin-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .statewide-admin-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
    .statewide-admin-stat { padding:19px; border:1px solid rgba(15,23,42,.11); border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(15,23,42,.06); }
    .statewide-admin-stat strong { display:block; font-size:2rem; line-height:1; }
    .statewide-admin-stat span { display:block; margin-top:8px; font-weight:850; }
    .statewide-admin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
    .statewide-admin-form { display:grid; gap:16px; }
    .statewide-admin-checkbox { display:flex; align-items:flex-start; gap:10px; }
    .statewide-admin-checkbox input { width:auto; margin-top:4px; }
    .statewide-admin-summary { display:grid; gap:10px; }
    .statewide-admin-row { display:flex; justify-content:space-between; gap:16px; padding:11px 0; border-bottom:1px solid rgba(15,23,42,.1); }
    .statewide-admin-row:last-child { border-bottom:0; }
    .statewide-admin-badge { display:inline-flex; padding:5px 9px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.76rem; font-weight:900; }
    .statewide-admin-badge-warning { color:#7c4a03; background:rgba(245,158,11,.18); }
    .statewide-admin-badge-error { color:#991b1b; background:rgba(220,38,38,.13); }
    .statewide-admin-table-wrap { overflow:auto; border:1px solid rgba(15,23,42,.12); border-radius:12px; }
    .statewide-admin-table { width:100%; min-width:920px; border-collapse:collapse; background:#fff; }
    .statewide-admin-table th, .statewide-admin-table td { padding:12px; text-align:left; vertical-align:top; border-bottom:1px solid rgba(15,23,42,.09); }
    .statewide-admin-table th { background:#111827; color:#fff; }
    .statewide-admin-source { border-left:6px solid #00bf63; }
    .statewide-admin-source h2, .statewide-admin-source p { margin-bottom:0; }
    .statewide-admin-options { display:grid; gap:12px; }
    @media (max-width:800px) {
      .statewide-admin-grid { grid-template-columns:1fr; }
      .statewide-admin-actions { display:grid; grid-template-columns:1fr; }
      .statewide-admin-actions .button { width:100%; justify-content:center; }
    }
`;

export function adminStatewideDataPage(site) {
  const content = `<div class="statewide-admin-shell" data-statewide-admin>
      <div class="info-card" data-statewide-auth-loading>
        <h2>Checking admin access</h2>
        <p>Podium Watch is confirming your secure admin session.</p>
      </div>

      <p class="statewide-admin-message" data-statewide-message aria-live="polite" hidden></p>

      <div class="statewide-admin-shell" data-statewide-dashboard hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Official school foundation</p>
            <h2>Ohio schools, divisions, and tournament sources</h2>
          </div>

          <div class="statewide-admin-actions">
            <button class="button button-outline" type="button" data-statewide-refresh>Refresh</button>
          </div>
        </div>

        <section class="info-card statewide-admin-source">
          <p class="eyebrow">Bundled official references</p>
          <h2>556 boys cross country schools and 16 track regional sites</h2>
          <p>
            The school dataset comes from the supplied OHSAA 2026 and 2027 boys cross country division document. The track dataset comes from the supplied 2026 regional site and representation document updated April 3, 2026.
          </p>
        </section>

        <div class="statewide-admin-stats">
          <article class="statewide-admin-stat"><strong data-statewide-bundled-schools>0</strong><span>Bundled schools</span></article>
          <article class="statewide-admin-stat"><strong data-statewide-db-schools>0</strong><span>Database schools</span></article>
          <article class="statewide-admin-stat"><strong data-statewide-db-divisions>0</strong><span>Division assignments</span></article>
          <article class="statewide-admin-stat"><strong data-statewide-db-sites>0</strong><span>Tournament sites</span></article>
          <article class="statewide-admin-stat"><strong data-statewide-conflicts>0</strong><span>Open conflicts</span></article>
          <article class="statewide-admin-stat"><strong data-statewide-moved>0</strong><span>Changed divisions</span></article>
        </div>

        <div class="statewide-admin-grid">
          <section class="info-card">
            <p class="eyebrow">Step 1</p>
            <h2>Install the database foundation</h2>
            <p data-statewide-install-status>
              Checking whether the statewide database tables are installed.
            </p>
            <div class="statewide-admin-actions" style="margin-top:16px;">
              <button class="button button-outline" type="button" data-copy-migration>
                Copy migration path
              </button>
            </div>
            <p style="margin-top:14px;"><code>install/01_STATEWIDE_FOUNDATION_DATABASE.sql</code></p>
          </section>

          <section class="info-card">
            <p class="eyebrow">Step 2</p>
            <h2>Preview the official import</h2>
            <p>
              Preview compares the bundled source records with the current statewide tables and existing team pages. Nothing is saved during preview.
            </p>
            <div class="statewide-admin-actions" style="margin-top:16px;">
              <button class="button button-primary" type="button" data-statewide-preview>
                Preview import
              </button>
            </div>
          </section>
        </div>

        <section class="info-card" data-statewide-preview-panel hidden>
          <p class="eyebrow">Import preview</p>
          <h2>Changes ready for review</h2>

          <div class="statewide-admin-grid" style="margin-top:18px;">
            <div class="statewide-admin-summary" data-statewide-preview-summary></div>

            <form class="statewide-admin-form" data-statewide-commit-form>
              <div>
                <h3>Team page options</h3>
                <p>The official foundation is always imported. These options control how school records connect to public team pages.</p>
              </div>

              <div class="statewide-admin-options">
                <label class="statewide-admin-checkbox">
                  <input type="checkbox" name="create_missing_teams" checked>
                  <span><strong>Create missing team pages</strong><br>Build one combined high school team page for official schools that do not already match a Podium Watch team.</span>
                </label>

                <label class="statewide-admin-checkbox">
                  <input type="checkbox" name="publish_new_teams" checked>
                  <span><strong>Publish new team pages</strong><br>Make newly created school profiles searchable and available for coaches to claim.</span>
                </label>

                <label class="statewide-admin-checkbox">
                  <input type="checkbox" name="overwrite_official_division">
                  <span><strong>Replace conflicting boys XC divisions</strong><br>Use the supplied official 2026 and 2027 assignment when an existing team page has a different boys cross country division.</span>
                </label>
              </div>

              <div class="statewide-admin-actions">
                <button class="button button-primary" type="submit" data-statewide-commit>
                  Import official statewide data
                </button>
              </div>
            </form>
          </div>

          <div data-statewide-preview-conflicts style="margin-top:22px;"></div>
        </section>

        <section class="info-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Data conflicts</p>
              <h2>Official assignment review</h2>
            </div>
          </div>

          <div class="statewide-admin-table-wrap">
            <table class="statewide-admin-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Current value</th>
                  <th>Official value</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody data-statewide-conflict-rows></tbody>
            </table>
          </div>
        </section>

        <section class="info-card">
          <p class="eyebrow">Recent imports</p>
          <h2>Statewide data history</h2>
          <div class="statewide-admin-table-wrap">
            <table class="statewide-admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Status</th>
                  <th>School records</th>
                  <th>Division records</th>
                  <th>Track sites</th>
                  <th>Team pages</th>
                </tr>
              </thead>
              <tbody data-statewide-batch-rows></tbody>
            </table>
          </div>
        </section>
      </div>
    </div>`;

  return adminShell({
    site,
    pathname: "/admin/statewide-data/",
    title: "Statewide Data Center",
    description: "Secure Podium Watch administration for Ohio school identity records, division assignments, tournament sites, team links, source history, and conflicts.",
    heading: "Statewide Data Center.",
    intro: "Import official Ohio school records, connect team pages, review division conflicts, and preserve source history from one secure workspace.",
    styles,
    content,
    scripts: ["/scripts/admin-statewide-data.js"]
  });
}
