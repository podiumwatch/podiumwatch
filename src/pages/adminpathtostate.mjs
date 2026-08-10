import { layout, pageHero } from "../lib/html.mjs";

export function adminPathToStatePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Admin",
    title: "Path to State",
    description: "Search for a team and manually set its OHSAA cross country tournament advancement status per stage. Public team and athlete pages pick up a change within a few minutes."
  })}
  <style>
    .path-admin-shell { display: grid; gap: 20px; }
    .path-admin-actions { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
    .path-admin-actions input[type="number"] { width: 100px; padding: 8px 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; }
    .path-admin-message { margin: 0; padding: 14px 16px; border-radius: 10px; background: rgba(0,191,99,.12); font-weight: 850; }
    .path-admin-message[data-tone="error"] { color: #991b1b; background: rgba(220,38,38,.12); }
    .path-admin-search { display: flex; gap: 9px; flex-wrap: wrap; }
    .path-admin-search input[type="search"] { flex: 1 1 260px; padding: 10px 12px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; }
    .path-admin-team-list { display: grid; gap: 8px; margin-top: 14px; max-height: 340px; overflow: auto; }
    .path-admin-team-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px;
      border: 1px solid rgba(15,23,42,.12); border-radius: 8px; background: #fff; cursor: pointer; text-align: left; font: inherit;
    }
    .path-admin-team-row:hover { border-color: #111; }
    .path-admin-team-row[data-selected="true"] { border-color: #00bf63; background: rgba(0,191,99,.08); }
    .path-admin-team-meta { color: #6b7280; font-size: .82rem; }
    .path-admin-selected-name { font-weight: 900; font-size: 1.15rem; }
    .path-admin-stage-table-wrap { overflow: auto; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; margin-top: 14px; }
    .path-admin-stage-table { width: 100%; min-width: 760px; border-collapse: collapse; background: #fff; }
    .path-admin-stage-table th, .path-admin-stage-table td { padding: 10px; border-bottom: 1px solid rgba(15,23,42,.09); text-align: left; vertical-align: top; }
    .path-admin-stage-table th { background: #111; color: #fff; font-size: .74rem; text-transform: uppercase; }
    .path-admin-stage-table select, .path-admin-stage-table input { width: 100%; padding: 7px 8px; border: 1px solid rgba(15,23,42,.22); border-radius: 7px; font: inherit; }
    .path-admin-gender-heading { margin: 22px 0 4px; }
    .path-admin-threshold-table-wrap { overflow: auto; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; }
    .path-admin-threshold-table { width: 100%; min-width: 700px; border-collapse: collapse; background: #fff; font-size: .88rem; }
    .path-admin-threshold-table th, .path-admin-threshold-table td { padding: 8px 10px; border-bottom: 1px solid rgba(15,23,42,.09); text-align: left; }
    .path-admin-threshold-table th { background: #111; color: #fff; font-size: .7rem; text-transform: uppercase; }
    @media (max-width: 700px) { .path-admin-actions { display: grid; } .path-admin-actions .button { width: 100%; justify-content: center; } }
  </style>
  <section class="section section-paper"><div class="container path-admin-shell" data-path-admin-manager>
    <section class="info-card" data-path-admin-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-path-admin-dashboard hidden class="path-admin-shell">
      <div class="path-admin-actions">
        <a class="button button-outline" href="/admin/">Admin</a>
        <label>Season year <input type="number" data-path-admin-season value="2026"></label>
      </div>
      <p class="path-admin-message" data-path-admin-message role="status">Loading.</p>

      <section class="info-card">
        <div><p class="eyebrow">Find a team</p><h2>Search for a team</h2></div>
        <div class="path-admin-search">
          <input type="search" data-path-admin-search placeholder="Search by school name">
          <button class="button button-primary" type="button" data-path-admin-search-button>Search</button>
        </div>
        <div class="path-admin-team-list" data-path-admin-team-list></div>
      </section>

      <section class="info-card" data-path-admin-editor hidden>
        <div><p class="eyebrow">Set advancement status</p><h2 class="path-admin-selected-name" data-path-admin-selected-name></h2></div>
        <div data-path-admin-editor-body></div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Seed verification</p><h2>Seeded qualifying counts</h2></div>
        <p>Confirms install/10_PATH_TO_STATE.sql's real 2026 data landed correctly. A missing combination here (for example a Division 1 Northwest regional) is expected -- see docs/DECISIONS.md.</p>
        <div class="path-admin-threshold-table-wrap"><table class="path-admin-threshold-table"><thead><tr><th>Division</th><th>Gender</th><th>Stage</th><th>Scope</th><th>Teams</th><th>Individuals</th></tr></thead><tbody data-path-admin-threshold-rows></tbody></table></div>
      </section>
    </div>
  </div></section>
  <script src="/scripts/admin-path-to-state.js" defer></script>`;
  return layout({
    site,
    title: "Path to State Admin",
    description: "Search for a team and manually set its OHSAA cross country tournament advancement status per stage.",
    pathname: "/admin/path-to-state/",
    content
  });
}
