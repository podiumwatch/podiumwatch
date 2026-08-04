import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamSchedulePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Pages",
    title: "Team schedule.",
    description:
      "Connect your program to Meet Center pages, request missing meets, and import a full season schedule."
  })}

  <style>
    .team-schedule-shell,
    .team-schedule-grid,
    .team-schedule-list,
    .team-schedule-search-results,
    .team-schedule-request-list,
    .team-schedule-import-preview {
      display: grid;
      gap: 20px;
    }

    .team-schedule-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .team-schedule-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .team-schedule-panel-full {
      grid-column: 1 / -1;
    }

    .team-schedule-header,
    .team-schedule-actions,
    .team-schedule-card-actions,
    .team-schedule-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .team-schedule-header {
      justify-content: space-between;
      align-items: start;
    }

    .team-schedule-form {
      display: grid;
      gap: 16px;
    }

    .team-schedule-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
    }

    .team-schedule-form label {
      display: block;
    }

    .team-schedule-form input,
    .team-schedule-form select,
    .team-schedule-form textarea {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-schedule-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-schedule-card,
    .team-schedule-search-card,
    .team-schedule-request-card,
    .team-schedule-import-row {
      display: grid;
      gap: 13px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 13px;
      background: #ffffff;
    }

    .team-schedule-card {
      border-left: 6px solid #00bf63;
    }

    .team-schedule-card h3,
    .team-schedule-search-card h3,
    .team-schedule-request-card h3,
    .team-schedule-import-row h3,
    .team-schedule-card p,
    .team-schedule-search-card p,
    .team-schedule-request-card p,
    .team-schedule-import-row p {
      margin: 0;
    }

    .team-schedule-badge {
      display: inline-flex;
      padding: 6px 9px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.76rem;
      font-weight: 850;
    }

    .team-schedule-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-schedule-badge-warning {
      background: rgba(217, 119, 6, 0.15);
      color: #92400e;
    }

    .team-schedule-badge-error {
      background: rgba(220, 38, 38, 0.13);
      color: #991b1b;
    }

    .team-schedule-empty {
      padding: 24px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
      text-align: center;
    }

    .team-schedule-loading {
      padding: 34px;
      text-align: center;
    }

    .team-schedule-import-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
      gap: 12px;
    }

    .team-schedule-import-count {
      padding: 15px;
      border-radius: 11px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-schedule-import-count strong {
      display: block;
      font-size: 1.45rem;
    }

    .team-schedule-note {
      white-space: pre-line;
      color: rgba(15, 23, 42, 0.75);
    }

    @media (max-width: 850px) {
      .team-schedule-grid {
        grid-template-columns: 1fr;
      }

      .team-schedule-panel-full {
        grid-column: auto;
      }
    }

    @media (max-width: 640px) {
      .team-schedule-actions,
      .team-schedule-card-actions,
      .team-schedule-header {
        display: grid;
      }

      .team-schedule-actions .button,
      .team-schedule-card-actions .button,
      .team-schedule-header .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="team-schedule-loading info-card" data-team-schedule-loading>
        <h2>Loading team schedule</h2>
        <p>Podium Watch is checking your team account and schedule access.</p>
      </div>

      <div class="team-schedule-shell" data-team-schedule hidden>
        <div class="team-schedule-header">
          <div>
            <p class="eyebrow">Team schedule manager</p>
            <h2 data-team-schedule-name></h2>
            <p data-team-schedule-account></p>
          </div>

          <div class="team-schedule-actions">
            <a class="button button-outline" href="/team-dashboard/">Team dashboard</a>
            <a class="button button-outline" data-team-schedule-profile href="/team/">View profile</a>
            <button class="button button-outline" type="button" data-team-schedule-signout>Sign out</button>
          </div>
        </div>

        <p class="team-schedule-message" data-team-schedule-message aria-live="polite" hidden></p>

        <div class="team-schedule-grid">
          <section class="team-schedule-panel">
            <p class="eyebrow">Upcoming meets</p>
            <h2>Current schedule</h2>
            <div class="team-schedule-list" data-team-schedule-upcoming></div>
            <div class="team-schedule-empty" data-team-schedule-upcoming-empty hidden>
              No upcoming meets are connected yet.
            </div>
          </section>

          <section class="team-schedule-panel">
            <p class="eyebrow">Completed meets</p>
            <h2>Past schedule</h2>
            <div class="team-schedule-list" data-team-schedule-completed></div>
            <div class="team-schedule-empty" data-team-schedule-completed-empty hidden>
              No completed meets are connected yet.
            </div>
          </section>

          <section class="team-schedule-panel team-schedule-panel-full">
            <p class="eyebrow">Meet Center search</p>
            <h2>Add an existing meet</h2>
            <p>Search the Meet Center before requesting a new meet. Connecting an existing page prevents duplicate events.</p>

            <form class="team-schedule-form" data-team-meet-search-form>
              <div class="team-schedule-fields">
                <label>
                  <strong>Meet name, city, venue, or host</strong>
                  <input type="search" name="query" placeholder="Search Meet Center">
                </label>

                <label>
                  <strong>Meet date</strong>
                  <input type="date" name="meet_date">
                </label>

                <label>
                  <strong>Sport</strong>
                  <select name="sport">
                    <option value="">All sports</option>
                    <option value="Cross Country">Cross Country</option>
                    <option value="Track and Field">Track and Field</option>
                  </select>
                </label>
              </div>

              <button class="button button-primary" type="submit">Search Meet Center</button>
            </form>

            <div class="team-schedule-search-results" data-team-meet-search-results style="margin-top:20px;"></div>
          </section>

          <section class="team-schedule-panel">
            <p class="eyebrow">Missing meet</p>
            <h2>Request a Meet Center page</h2>
            <p>Use this when the meet is not already listed. Podium Watch will review it and connect the approved page to your team.</p>

            <form class="team-schedule-form" data-team-meet-request-form>
              <div class="team-schedule-fields">
                <label>
                  <strong>Meet name</strong>
                  <input type="text" name="meet_name" required>
                </label>

                <label>
                  <strong>Meet date</strong>
                  <input type="date" name="meet_date" required>
                </label>

                <label>
                  <strong>Sport</strong>
                  <select name="sport" required>
                    <option value="Cross Country">Cross Country</option>
                    <option value="Track and Field">Track and Field</option>
                  </select>
                </label>

                <label>
                  <strong>Start time</strong>
                  <input type="time" name="start_time">
                </label>

                <label>
                  <strong>Venue</strong>
                  <input type="text" name="venue_name">
                </label>

                <label>
                  <strong>City</strong>
                  <input type="text" name="city">
                </label>

                <label>
                  <strong>State</strong>
                  <input type="text" name="state" value="Ohio">
                </label>

                <label>
                  <strong>Meet website</strong>
                  <input type="url" name="website_url">
                </label>

                <label>
                  <strong>Results link</strong>
                  <input type="url" name="results_url">
                </label>
              </div>

              <label>
                <strong>Address</strong>
                <input type="text" name="address">
              </label>

              <label>
                <strong>Notes for Podium Watch</strong>
                <textarea name="notes" rows="4"></textarea>
              </label>

              <button class="button button-primary" type="submit">Submit meet request</button>
            </form>
          </section>

          <section class="team-schedule-panel">
            <p class="eyebrow">Submitted meets</p>
            <h2>Request status</h2>
            <div class="team-schedule-request-list" data-team-meet-request-list></div>
            <div class="team-schedule-empty" data-team-meet-request-empty hidden>
              No meet requests have been submitted.
            </div>
          </section>

          <section class="team-schedule-panel team-schedule-panel-full">
            <div class="team-schedule-header">
              <div>
                <p class="eyebrow">Season import</p>
                <h2>Upload a schedule CSV</h2>
                <p>Podium Watch will match existing Meet Center pages first. Unmatched rows become review requests.</p>
              </div>

              <button class="button button-outline" type="button" data-team-schedule-template>Download CSV template</button>
            </div>

            <form class="team-schedule-form" data-team-schedule-import-form>
              <label>
                <strong>Schedule CSV</strong>
                <input type="file" name="schedule_file" accept=".csv,text/csv" required>
              </label>

              <div class="team-schedule-actions">
                <button class="button button-primary" type="submit">Preview schedule import</button>
                <button class="button button-outline" type="button" data-team-schedule-import-clear>Clear import</button>
              </div>
            </form>

            <div data-team-schedule-import-section hidden style="margin-top:24px;">
              <div class="team-schedule-import-summary">
                <div class="team-schedule-import-count"><strong data-import-total>0</strong><span>Total rows</span></div>
                <div class="team-schedule-import-count"><strong data-import-matched>0</strong><span>Matched meets</span></div>
                <div class="team-schedule-import-count"><strong data-import-review>0</strong><span>Needs review</span></div>
                <div class="team-schedule-import-count"><strong data-import-request>0</strong><span>New requests</span></div>
                <div class="team-schedule-import-count"><strong data-import-error>0</strong><span>Errors</span></div>
              </div>

              <div class="team-schedule-import-preview" data-team-schedule-import-preview style="margin-top:20px;"></div>

              <button class="button button-primary" type="button" data-team-schedule-import-commit>Import schedule</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-schedule.js" defer></script>`;

  return layout({
    site,
    title: "Team Schedule",
    description:
      "Manage a Podium Watch team schedule and connect meets to the Meet Center.",
    pathname: "/team-schedule/",
    content
  });
}
