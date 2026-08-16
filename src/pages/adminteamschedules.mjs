import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .admin-schedule-shell,
    .admin-schedule-grid,
    .admin-schedule-list,
    .admin-schedule-search-results,
    .admin-schedule-match-results {
      display: grid;
      gap: 20px;
    }

    .admin-schedule-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .admin-schedule-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .admin-schedule-panel-full {
      grid-column: 1 / -1;
    }

    .admin-schedule-heading,
    .admin-schedule-actions,
    .admin-schedule-badges,
    .admin-schedule-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .admin-schedule-heading {
      justify-content: space-between;
      align-items: start;
    }

    .admin-schedule-form {
      display: grid;
      gap: 15px;
    }

    .admin-schedule-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 13px;
    }

    .admin-schedule-form label {
      display: block;
    }

    .admin-schedule-form input,
    .admin-schedule-form select,
    .admin-schedule-form textarea {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .admin-schedule-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .admin-schedule-counts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .admin-schedule-count {
      padding: 17px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .admin-schedule-count strong {
      display: block;
      font-size: 1.6rem;
    }

    .admin-schedule-card,
    .admin-schedule-result {
      display: grid;
      gap: 13px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 13px;
      background: #ffffff;
    }

    .admin-schedule-card h3,
    .admin-schedule-result h3,
    .admin-schedule-card p,
    .admin-schedule-result p {
      margin: 0;
    }

    .admin-schedule-badge {
      display: inline-flex;
      padding: 6px 9px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.76rem;
      font-weight: 850;
    }

    .admin-schedule-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .admin-schedule-badge-warning {
      background: rgba(217, 119, 6, 0.15);
      color: #92400e;
    }

    .admin-schedule-badge-error {
      background: rgba(220, 38, 38, 0.13);
      color: #991b1b;
    }

    .admin-schedule-team-choice,
    .admin-schedule-meet-choice {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
      padding: 13px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.05);
    }

    .admin-schedule-team-choice input,
    .admin-schedule-meet-choice input {
      width: auto;
      margin: 4px 0 0;
    }

    .admin-schedule-empty {
      padding: 24px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
      text-align: center;
    }

    .admin-schedule-loading {
      padding: 34px;
      text-align: center;
    }

    .admin-schedule-note {
      white-space: pre-line;
      color: rgba(15, 23, 42, 0.72);
    }

    @media (max-width: 850px) {
      .admin-schedule-grid {
        grid-template-columns: 1fr;
      }

      .admin-schedule-panel-full {
        grid-column: auto;
      }
    }

    @media (max-width: 640px) {
      .admin-schedule-heading,
      .admin-schedule-actions,
      .admin-schedule-card-actions {
        display: grid;
      }

      .admin-schedule-heading .button,
      .admin-schedule-actions .button,
      .admin-schedule-card-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
`;

export function adminTeamSchedulesPage(site) {
  const content = `<div class="admin-schedule-loading info-card" data-admin-schedule-loading>
    <h2>Checking admin access</h2>
    <p>Podium Watch is loading team schedule requests and connections.</p>
  </div>

  <div class="admin-schedule-shell" data-admin-schedule hidden>
    <div class="admin-schedule-heading">
      <div>
        <p class="eyebrow">Team schedule administration</p>
        <h2>Meet Center connections</h2>
      </div>

      <div class="admin-schedule-actions">
        <button class="button button-primary" type="button" data-admin-schedule-refresh>Refresh</button>
      </div>
    </div>

    <p class="admin-schedule-message" data-admin-schedule-message aria-live="polite" hidden></p>

    <div class="admin-schedule-counts">
      <div class="admin-schedule-count"><strong data-admin-count-pending>0</strong><span>Pending requests</span></div>
      <div class="admin-schedule-count"><strong data-admin-count-reviewing>0</strong><span>Under review</span></div>
      <div class="admin-schedule-count"><strong data-admin-count-connections>0</strong><span>Recent connections</span></div>
    </div>

    <div class="admin-schedule-grid">
      <section class="admin-schedule-panel admin-schedule-panel-full">
        <div class="admin-schedule-heading">
          <div>
            <p class="eyebrow">Coach submissions</p>
            <h2>Meet requests</h2>
          </div>

          <label>
            <strong>Status</strong>
            <select data-admin-request-status style="display:block;margin-top:7px;padding:10px;">
              <option value="active">Pending and reviewing</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="duplicate">Duplicate</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        <div class="admin-schedule-list" data-admin-request-list style="margin-top:20px;"></div>
        <div class="admin-schedule-empty" data-admin-request-empty hidden>No meet requests match this status.</div>
      </section>

      <section class="admin-schedule-panel">
        <p class="eyebrow">Step one</p>
        <h2>Select teams</h2>
        <form class="admin-schedule-form" data-admin-team-search-form>
          <label>
            <strong>School, city, or mascot</strong>
            <input type="search" name="query" placeholder="Search teams">
          </label>
          <button class="button button-primary" type="submit">Search teams</button>
        </form>
        <div class="admin-schedule-search-results" data-admin-team-results style="margin-top:18px;"></div>
      </section>

      <section class="admin-schedule-panel">
        <p class="eyebrow">Step two</p>
        <h2>Select a Meet Center page</h2>
        <form class="admin-schedule-form" data-admin-meet-search-form>
          <div class="admin-schedule-fields">
            <label>
              <strong>Name, venue, city, or host</strong>
              <input type="search" name="query" placeholder="Search meets">
            </label>
            <label>
              <strong>Date</strong>
              <input type="date" name="meet_date">
            </label>
          </div>
          <button class="button button-primary" type="submit">Search meets</button>
        </form>
        <div class="admin-schedule-search-results" data-admin-meet-results style="margin-top:18px;"></div>
      </section>

      <section class="admin-schedule-panel admin-schedule-panel-full">
        <p class="eyebrow">Step three</p>
        <h2>Connect selected teams</h2>
        <p data-admin-selection-summary>No teams or meet selected yet.</p>

        <form class="admin-schedule-form" data-admin-connect-form>
          <div class="admin-schedule-fields">
            <label>
              <strong>Program</strong>
              <select name="program_scope">
                <option value="combined">Boys and Girls</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
              </select>
            </label>
            <label>
              <strong>Sport</strong>
              <select name="sport_scope">
                <option value="All">All</option>
                <option value="Cross Country">Cross Country</option>
                <option value="Track and Field">Track and Field</option>
              </select>
            </label>
            <label>
              <strong>Results override</strong>
              <input type="url" name="results_url_override">
            </label>
            <label>
              <strong>Sort order</strong>
              <input type="number" name="sort_order" value="0" min="-999" max="999">
            </label>
          </div>
          <label>
            <strong>Schedule note</strong>
            <textarea name="schedule_note" rows="3"></textarea>
          </label>
          <label><input type="checkbox" name="published" checked> Show on public team profiles when the meet is published</label>
          <button class="button button-primary" type="submit">Connect selected teams</button>
        </form>
      </section>

      <section class="admin-schedule-panel admin-schedule-panel-full">
        <p class="eyebrow">Recent activity</p>
        <h2>Schedule connections</h2>
        <div class="admin-schedule-list" data-admin-connection-list></div>
        <div class="admin-schedule-empty" data-admin-connection-empty hidden>No schedule connections were found.</div>
      </section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/team-schedules/",
    title: "Admin Team Schedule Manager",
    description: "Review team meet requests and manage Meet Center schedule connections.",
    heading: "Team Schedule Manager.",
    intro: "Review coach meet requests, connect one Meet Center page to multiple teams, and correct schedule connections.",
    styles,
    content,
    scripts: ["/scripts/admin-team-schedules.js"]
  });
}
