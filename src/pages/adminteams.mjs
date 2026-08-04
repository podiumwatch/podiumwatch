import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function adminTeamsPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Admin",
    title: "Bulk Team Import.",
    description:
      "Create the full Ohio team directory and safely update only the fields you choose."
  })}

  <style>
    .admin-team-shell,
    .admin-team-form,
    .admin-team-help {
      display: grid;
      gap: 22px;
    }

    .admin-team-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 18px;
    }

    .admin-team-form label {
      display: block;
    }

    .admin-team-form input,
    .admin-team-form select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .admin-team-form input[type="checkbox"] {
      display: inline-block;
      width: auto;
      margin: 0 8px 0 0;
    }

    .admin-team-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .admin-team-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .admin-team-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
      gap: 14px;
    }

    .admin-team-summary-card {
      padding: 18px;
      border-radius: 13px;
      background: rgba(15, 23, 42, 0.05);
    }

    .admin-team-summary-card strong {
      display: block;
      font-size: 1.8rem;
      line-height: 1;
    }

    .admin-team-summary-card span {
      display: block;
      margin-top: 8px;
      font-weight: 750;
    }

    .admin-team-field-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .admin-team-field-options label {
      display: flex;
      gap: 8px;
      align-items: start;
      padding: 8px;
      border-radius: 8px;
      background: #ffffff;
    }

    .admin-team-table-wrap {
      overflow-x: auto;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 12px;
    }

    .admin-team-table {
      width: 100%;
      min-width: 1050px;
      border-collapse: collapse;
      background: #ffffff;
    }

    .admin-team-table th,
    .admin-team-table td {
      padding: 12px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.1);
      text-align: left;
      vertical-align: top;
    }

    .admin-team-table th {
      position: sticky;
      top: 0;
      background: #111827;
      color: #ffffff;
      font-size: 0.82rem;
      text-transform: uppercase;
    }

    .admin-team-status {
      display: inline-flex;
      padding: 6px 9px;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 850;
      text-transform: uppercase;
    }

    .admin-team-status-insert {
      background: rgba(0, 191, 99, 0.15);
    }

    .admin-team-status-update {
      background: rgba(59, 130, 246, 0.15);
    }

    .admin-team-status-unchanged {
      background: rgba(15, 23, 42, 0.08);
    }

    .admin-team-status-error {
      background: rgba(220, 38, 38, 0.14);
      color: #991b1b;
    }

    .admin-team-errors {
      margin: 0;
      padding-left: 18px;
      color: #991b1b;
    }

    .admin-team-code {
      overflow-x: auto;
      padding: 14px;
      border-radius: 10px;
      background: #111827;
      color: #ffffff;
      font-family: Consolas, monospace;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .admin-team-warning {
      padding: 14px;
      border-radius: 10px;
      background: rgba(245, 158, 11, 0.12);
    }

    @media (max-width: 680px) {
      .admin-team-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .admin-team-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="admin-team-shell">
        <div class="info-card" data-admin-team-auth-loading>
          <h2>Checking admin access</h2>
          <p>Podium Watch is confirming your secure admin session.</p>
        </div>

        <div class="admin-team-shell" data-admin-team-content hidden>
          <div class="section-heading">
            <div>
              <p class="eyebrow">Team administration</p>
              <h2>Import or update team profiles</h2>
              <p>Preview everything before saving. Existing coach content, owners, social links, rosters, schedules, history, and announcements are never removed by this importer.</p>
            </div>

            <div class="admin-team-actions">
              <a class="button button-primary" href="/admin/team-manager/">Open Team Manager</a>
              <a class="button button-outline" href="/admin/">Main admin</a>
              <button class="button button-outline" type="button" data-download-team-template>Download CSV template</button>
            </div>
          </div>

          <p class="admin-team-message" data-admin-team-message aria-live="polite" hidden></p>

          <section class="info-card">
            <form class="admin-team-form" data-admin-team-import-form>
              <div class="admin-team-fields">
                <label>
                  <strong>Team CSV file</strong>
                  <input type="file" name="team_file" accept=".csv,text/csv" required>
                </label>

                <label>
                  <strong>Source name</strong>
                  <input type="text" name="source_name" value="Podium Watch Ohio Team List" required>
                </label>

                <label>
                  <strong>Existing team update rule</strong>
                  <select name="update_mode">
                    <option value="fill_missing">Fill missing information only</option>
                    <option value="overwrite_selected">Replace selected fields with CSV values</option>
                  </select>
                </label>
              </div>

              <label>
                <input type="checkbox" name="publish_imported_profiles" checked>
                Publish newly created base profiles in the public Team Directory
              </label>

              <div>
                <p><strong>Fields allowed to update on teams that already exist</strong></p>
                <p class="admin-team-warning">The default setting fills blanks only. Choose replace selected fields only when you intentionally want the CSV to overwrite those fields.</p>

                <div class="admin-team-field-options" data-team-update-fields>
                  <label><input type="checkbox" name="update_fields" value="school_name" checked> School name</label>
                  <label><input type="checkbox" name="update_fields" value="mascot" checked> Mascot</label>
                  <label><input type="checkbox" name="update_fields" value="city" checked> City</label>
                  <label><input type="checkbox" name="update_fields" value="state" checked> State</label>
                  <label><input type="checkbox" name="update_fields" value="zip_code" checked> ZIP code</label>
                  <label><input type="checkbox" name="update_fields" value="conference" checked> Conference</label>
                  <label><input type="checkbox" name="update_fields" value="region" checked> Ohio region</label>
                  <label><input type="checkbox" name="update_fields" value="program_level" checked> Program level</label>
                  <label><input type="checkbox" name="update_fields" value="program_scope" checked> Boys and girls scope</label>
                  <label><input type="checkbox" name="update_fields" value="cross_country_boys_division" checked> Boys cross country division</label>
                  <label><input type="checkbox" name="update_fields" value="cross_country_girls_division" checked> Girls cross country division</label>
                  <label><input type="checkbox" name="update_fields" value="track_boys_division" checked> Boys track division</label>
                  <label><input type="checkbox" name="update_fields" value="track_girls_division" checked> Girls track division</label>
                  <label><input type="checkbox" name="update_fields" value="athletics_url" checked> Athletics website</label>
                  <label><input type="checkbox" name="update_fields" value="website_url" checked> School website</label>
                  <label><input type="checkbox" name="update_fields" value="logo_url" checked> Logo URL</label>
                </div>
              </div>

              <div class="admin-team-actions">
                <button class="button button-primary" type="submit">Preview team import</button>
                <button class="button button-outline" type="button" data-clear-team-import>Clear import</button>
              </div>
            </form>
          </section>

          <section class="info-card" data-admin-team-preview hidden>
            <div class="section-heading">
              <div>
                <p class="eyebrow">Import preview</p>
                <h2>Review before saving</h2>
                <p>No team profiles have been changed yet.</p>
              </div>
              <button class="button button-primary" type="button" data-commit-team-import>Import teams</button>
            </div>

            <div class="admin-team-summary" data-admin-team-summary>
              <div class="admin-team-summary-card"><strong data-summary-total>0</strong><span>Total rows</span></div>
              <div class="admin-team-summary-card"><strong data-summary-insert>0</strong><span>New teams</span></div>
              <div class="admin-team-summary-card"><strong data-summary-update>0</strong><span>Teams changing</span></div>
              <div class="admin-team-summary-card"><strong data-summary-unchanged>0</strong><span>No changes needed</span></div>
              <div class="admin-team-summary-card"><strong data-summary-error>0</strong><span>Rows with errors</span></div>
            </div>

            <div class="admin-team-table-wrap" style="margin-top:22px;">
              <table class="admin-team-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>School</th>
                    <th>City</th>
                    <th>Conference</th>
                    <th>Region</th>
                    <th>Fields changing</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody data-admin-team-preview-rows></tbody>
              </table>
            </div>
          </section>

          <section class="info-card">
            <p class="eyebrow">CSV format</p>
            <h2>Supported team columns</h2>
            <div class="admin-team-help">
              <p>School Name and City are required. All other columns are optional.</p>
              <div class="admin-team-code">School Name,City,State,Mascot,Conference,Region,Program Level,Program Scope,Cross Country Boys Division,Cross Country Girls Division,Track Boys Division,Track Girls Division,Athletics Website,School Website,Logo URL,Source School ID</div>
              <p>The importer recognizes common alternatives such as School, Team Name, League, ZIP Code, OHSAA ID, XC Boys Division, and Boys Track Division.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="/scripts/admin-team-import.js" defer></script>`;

  return layout({
    site,
    title: "Admin Team Import",
    description: "Bulk create and safely update Podium Watch team profiles.",
    pathname: "/admin/teams/",
    content
  });
}
