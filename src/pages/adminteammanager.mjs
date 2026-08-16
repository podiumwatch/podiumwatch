import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .team-manager-shell,
    .team-manager-list,
    .team-manager-detail-grid,
    .team-manager-history,
    .team-manager-report-list,
    .team-manager-claim-list {
      display: grid;
      gap: 20px;
    }

    .team-manager-tools,
    .team-manager-actions,
    .team-manager-badges,
    .team-manager-member-actions,
    .team-manager-detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    .team-manager-form,
    .team-manager-member-form,
    .team-manager-merge-form,
    .team-manager-report-form {
      display: grid;
      gap: 16px;
    }

    .team-manager-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
    }

    .team-manager-form label,
    .team-manager-member-form label,
    .team-manager-merge-form label,
    .team-manager-report-form label {
      display: block;
    }

    .team-manager-form input,
    .team-manager-form select,
    .team-manager-member-form input,
    .team-manager-member-form select,
    .team-manager-merge-form input,
    .team-manager-merge-form select,
    .team-manager-report-form textarea,
    .team-manager-report-form select,
    .team-manager-claim-card select {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-manager-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-manager-counts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }

    .team-manager-count {
      padding: 18px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-manager-count strong {
      display: block;
      font-size: 1.7rem;
    }

    .team-manager-table-wrap {
      overflow-x: auto;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 12px;
    }

    .team-manager-table {
      width: 100%;
      min-width: 1280px;
      border-collapse: collapse;
      background: #ffffff;
    }

    .team-manager-table th,
    .team-manager-table td {
      padding: 12px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.1);
      text-align: left;
      vertical-align: top;
    }

    .team-manager-table th {
      position: sticky;
      top: 0;
      background: #111827;
      color: #ffffff;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    .team-manager-badge {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.13);
      font-size: 0.75rem;
      font-weight: 850;
    }

    .team-manager-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-manager-badge-warning {
      background: rgba(220, 38, 38, 0.13);
      color: #991b1b;
    }

    .team-manager-badge-blue {
      background: rgba(37, 99, 235, 0.14);
      color: #1d4ed8;
    }

    .team-manager-actions .button,
    .team-manager-member-actions .button,
    .team-manager-detail-actions .button {
      padding: 8px 11px;
      font-size: 0.8rem;
    }

    .team-manager-empty {
      padding: 28px;
      text-align: center;
    }

    .team-manager-claim-card,
    .team-manager-report-card,
    .team-manager-member-card,
    .team-manager-history-card {
      display: grid;
      gap: 14px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 12px;
      background: #ffffff;
    }

    .team-manager-claim-card {
      grid-template-columns: 1fr minmax(190px, 250px);
    }

    .team-manager-claim-card h3,
    .team-manager-report-card h3,
    .team-manager-member-card h3,
    .team-manager-history-card h3,
    .team-manager-claim-card p,
    .team-manager-report-card p,
    .team-manager-member-card p,
    .team-manager-history-card p {
      margin-bottom: 7px;
    }

    .team-manager-detail {
      position: fixed;
      inset: 0;
      z-index: 1000;
      overflow-y: auto;
      padding: 22px;
      background: rgba(15, 23, 42, 0.72);
    }

    .team-manager-detail-card {
      width: min(1120px, 100%);
      margin: 0 auto;
      padding: 26px;
      border-radius: 18px;
      background: #f8fafc;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35);
    }

    .team-manager-detail-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: start;
    }

    .team-manager-detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 22px;
    }

    .team-manager-panel {
      padding: 20px;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
    }

    .team-manager-panel-full {
      grid-column: 1 / -1;
    }

    .team-manager-progress {
      overflow: hidden;
      height: 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.1);
    }

    .team-manager-progress span {
      display: block;
      height: 100%;
      width: 0;
      background: #00bf63;
    }

    .team-manager-warning {
      padding: 14px;
      border-radius: 10px;
      background: rgba(220, 38, 38, 0.1);
      color: #991b1b;
    }

    .team-manager-muted {
      color: rgba(15, 23, 42, 0.65);
      font-size: 0.9rem;
    }

    @media (max-width: 820px) {
      .team-manager-detail-grid,
      .team-manager-claim-card {
        grid-template-columns: 1fr;
      }

      .team-manager-detail {
        padding: 8px;
      }

      .team-manager-detail-card {
        padding: 18px;
      }
    }

    @media (max-width: 720px) {
      .team-manager-tools,
      .team-manager-actions,
      .team-manager-member-actions,
      .team-manager-detail-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .team-manager-tools .button,
      .team-manager-actions .button,
      .team-manager-member-actions .button,
      .team-manager-detail-actions .button {
        width: 100%;
        justify-content: center;
      }

      .team-manager-detail-header {
        display: grid;
      }
    }
`;

export function adminTeamManagerPage(site) {
  const content = `<div class="team-manager-shell">
        <div class="info-card" data-team-manager-loading>
          <h2>Checking admin access</h2>
          <p>Podium Watch is confirming your secure admin session.</p>
        </div>

        <div class="team-manager-shell" data-team-manager-content hidden>
          <div class="section-heading">
            <div>
              <p class="eyebrow">Team administration</p>
              <h2>All team profiles</h2>
              <p>Control every team page without signing into a coach account.</p>
            </div>

            <div class="team-manager-tools">
              <a class="button button-outline" href="/teams/" target="_blank" rel="noopener noreferrer">Public directory</a>
            </div>
          </div>

          <p class="team-manager-message" data-team-manager-message aria-live="polite" hidden></p>

          <section class="info-card">
            <form class="team-manager-form" data-team-manager-form>
              <div class="team-manager-fields">
                <label>
                  <strong>Search teams</strong>
                  <input type="search" name="search" placeholder="School, city, mascot, or conference">
                </label>

                <label>
                  <strong>Page status</strong>
                  <select name="status">
                    <option value="">All statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Private draft</option>
                    <option value="suspended">Suspended</option>
                    <option value="locked">Editing locked</option>
                    <option value="archived">Archived</option>
                    <option value="merged">Merged duplicate</option>
                  </select>
                </label>

                <label>
                  <strong>Profile source</strong>
                  <select name="origin">
                    <option value="">All sources</option>
                    <option value="admin_import">Admin import</option>
                    <option value="coach_created">Coach created</option>
                    <option value="admin_created">Admin created</option>
                  </select>
                </label>

                <label>
                  <strong>Claim status</strong>
                  <select name="claim_status">
                    <option value="">All teams</option>
                    <option value="claimed">Claimed</option>
                    <option value="unclaimed">Unclaimed</option>
                  </select>
                </label>
              </div>

              <div class="team-manager-tools">
                <button class="button button-primary" type="submit">Search teams</button>
                <button class="button button-outline" type="button" data-team-manager-clear>Clear filters</button>
                <button class="button button-outline" type="button" data-team-manager-refresh>Refresh everything</button>
              </div>
            </form>
          </section>

          <div class="team-manager-counts">
            <div class="team-manager-count">
              <strong data-team-manager-count>0</strong>
              <span>Matching teams</span>
            </div>
            <div class="team-manager-count">
              <strong data-team-manager-pending-count>0</strong>
              <span>Pending access requests</span>
            </div>
            <div class="team-manager-count">
              <strong data-team-manager-report-count>0</strong>
              <span>Open team reports</span>
            </div>
          </div>

          <section>
            <div class="team-manager-table-wrap">
              <table class="team-manager-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Location</th>
                    <th>Source</th>
                    <th>Managers</th>
                    <th>Completion</th>
                    <th>Status</th>
                    <th>Reports</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody data-team-manager-rows></tbody>
              </table>
            </div>

            <div class="info-card team-manager-empty" data-team-manager-empty hidden>
              <h2>No teams found</h2>
              <p>Change the filters or import more teams.</p>
            </div>
          </section>

          <section class="info-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Additional managers</p>
                <h2>Pending access requests</h2>
                <p>The first confirmed account claiming an unclaimed team receives owner access automatically. Requests here are for already claimed teams.</p>
              </div>
              <button class="button button-outline" type="button" data-team-claims-refresh>Refresh requests</button>
            </div>

            <div class="team-manager-claim-list" data-team-claim-list></div>
            <div class="team-manager-empty" data-team-claim-empty hidden>There are no pending access requests.</div>
          </section>

          <section class="info-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Visitor reports</p>
                <h2>Open team reports</h2>
                <p>Review only the pages that visitors flag for incorrect information, duplicate profiles, bad links, or ownership concerns.</p>
              </div>
              <button class="button button-outline" type="button" data-team-reports-refresh>Refresh reports</button>
            </div>

            <div class="team-manager-report-list" data-team-report-list></div>
            <div class="team-manager-empty" data-team-report-empty hidden>There are no open team reports.</div>
          </section>
        </div>
      </div>

  <section class="team-manager-detail" data-team-detail-panel hidden>
    <div class="team-manager-detail-card">
      <div class="team-manager-detail-header">
        <div>
          <p class="eyebrow">Team control center</p>
          <h2 data-team-detail-title>Team profile</h2>
          <p data-team-detail-subtitle></p>
        </div>
        <button class="button button-outline" type="button" data-team-detail-close>Close</button>
      </div>

      <p class="team-manager-message" data-team-detail-message aria-live="polite" hidden></p>

      <div class="team-manager-detail-grid">
        <section class="team-manager-panel">
          <p class="eyebrow">Profile health</p>
          <h3 data-team-detail-completion>0 percent complete</h3>
          <div class="team-manager-progress"><span data-team-detail-progress></span></div>
          <p class="team-manager-muted" data-team-detail-updated></p>
          <div class="team-manager-badges" data-team-detail-badges></div>
          <div class="team-manager-detail-actions" data-team-detail-status-actions style="margin-top:16px;"></div>
        </section>

        <section class="team-manager-panel">
          <p class="eyebrow">Direct admin access</p>
          <h3>Edit this team</h3>
          <p>You can open the full team editor and change any profile or social account.</p>
          <div class="team-manager-detail-actions" data-team-detail-open-actions></div>
        </section>

        <section class="team-manager-panel team-manager-panel-full">
          <p class="eyebrow">Owners and editors</p>
          <h3>Team managers</h3>
          <div class="team-manager-list" data-team-detail-members></div>
          <div class="team-manager-empty" data-team-detail-members-empty hidden>No active managers are connected to this team.</div>

          <form class="team-manager-member-form" data-team-member-add-form style="margin-top:18px;">
            <div class="team-manager-fields">
              <label>
                <strong>Existing team account email</strong>
                <input type="email" name="email" required placeholder="coach@example.com">
              </label>
              <label>
                <strong>Access level</strong>
                <select name="role">
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <label>
                <strong>Display name</strong>
                <input type="text" name="display_name" placeholder="Optional">
              </label>
            </div>
            <button class="button button-primary" type="submit">Add team manager</button>
          </form>
        </section>

        <section class="team-manager-panel">
          <p class="eyebrow">Duplicate protection</p>
          <h3>Merge this duplicate</h3>
          <p>This profile will be archived. Managers, social links, reports, rosters, schedules, and other connected records move to the primary profile.</p>
          <form class="team-manager-merge-form" data-team-merge-form>
            <label>
              <strong>Primary team profile</strong>
              <select name="target_team_id" required data-team-merge-target>
                <option value="">Choose the profile to keep</option>
              </select>
            </label>
            <label>
              <strong>Reason</strong>
              <input type="text" name="reason" value="Merged as a duplicate team profile.">
            </label>
            <button class="button button-outline" type="submit">Merge duplicate profile</button>
          </form>
        </section>

        <section class="team-manager-panel">
          <p class="eyebrow">Archive</p>
          <h3>Remove without deleting</h3>
          <p>Archived profiles disappear from the public directory and coach editing, but remain recoverable.</p>
          <div class="team-manager-detail-actions" data-team-detail-archive-actions></div>
        </section>

        <section class="team-manager-panel team-manager-panel-full">
          <p class="eyebrow">Claim history</p>
          <h3>Access requests</h3>
          <div class="team-manager-history" data-team-detail-claims></div>
          <div class="team-manager-empty" data-team-detail-claims-empty hidden>No access requests have been submitted.</div>
        </section>

        <section class="team-manager-panel team-manager-panel-full">
          <p class="eyebrow">Reports</p>
          <h3>Reports for this page</h3>
          <div class="team-manager-report-list" data-team-detail-reports></div>
          <div class="team-manager-empty" data-team-detail-reports-empty hidden>No reports have been submitted.</div>
        </section>

        <section class="team-manager-panel team-manager-panel-full">
          <p class="eyebrow">Edit history</p>
          <h3>Recent changes</h3>
          <div class="team-manager-history" data-team-detail-history></div>
          <div class="team-manager-empty" data-team-detail-history-empty hidden>No history has been recorded yet.</div>
        </section>
      </div>
    </div>
  </section>`;

  return adminShell({
    site,
    pathname: "/admin/team-manager/",
    title: "Admin Team Manager",
    description: "Manage all Podium Watch team profiles, owners, claims, reports, duplicates, archives, and change history.",
    heading: "Team Manager.",
    intro: "Search every team, manage owners and editors, review claims and reports, merge duplicates, archive profiles, and see the full change history.",
    styles,
    content,
    scripts: ["/scripts/admin-team-manager.js"]
  });
}
