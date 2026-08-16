import { adminShell } from "../lib/adminshell.mjs";

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function toDateValue(value) {
  const date = new Date(`${value || ""}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}

const styles = `
    .operations-shell {
      display: grid;
      gap: 26px;
    }

    .operations-topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }

    .operations-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .operations-actions select,
    .operations-login input {
      min-height: 46px;
      padding: 10px 12px;
      border: 1px solid rgba(15, 23, 42, .24);
      border-radius: 8px;
      background: #fff;
      font: inherit;
    }

    .operations-message {
      margin: 0;
      padding: 14px 17px;
      border-radius: 10px;
      background: rgba(0, 191, 99, .13);
      font-weight: 800;
    }

    .operations-message[data-tone="error"] {
      color: #991b1b;
      background: rgba(220, 38, 38, .12);
    }

    .operations-message[data-tone="warning"] {
      color: #7c4a03;
      background: rgba(245, 158, 11, .16);
    }

    .operations-stats {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }

    .operations-stat {
      min-height: 128px;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, .1);
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, .06);
    }

    .operations-stat strong {
      display: block;
      font-family:
        Impact,
        Haettenschweiler,
        "Arial Narrow Bold",
        sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1;
    }

    .operations-stat span {
      display: block;
      margin-top: 10px;
      font-weight: 900;
    }

    .operations-stat small {
      display: block;
      margin-top: 7px;
      color: #64748b;
    }

    .operations-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    .operations-tab[aria-selected="true"] {
      color: #fff;
      background: #111827;
    }

    .operations-panel {
      display: grid;
      gap: 22px;
    }

    .operations-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 20px;
    }

    .operations-grid-wide {
      grid-template-columns:
        minmax(0, 1.35fr)
        minmax(280px, .65fr);
    }

    .operations-card {
      min-width: 0;
    }

    .operations-card-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 18px;
    }

    .operations-card-heading h2,
    .operations-card-heading h3 {
      margin-bottom: 0;
    }

    .operations-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 38px;
      min-height: 30px;
      padding: 4px 9px;
      border-radius: 999px;
      color: #fff;
      background: #111827;
      font-size: .78rem;
      font-weight: 900;
    }

    .operations-list {
      display: grid;
      gap: 10px;
    }

    .operations-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid rgba(15, 23, 42, .1);
    }

    .operations-row:last-child {
      border-bottom: 0;
    }

    .operations-row h3,
    .operations-row p {
      margin-bottom: 4px;
    }

    .operations-row small {
      color: #64748b;
    }

    .operations-row-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .operations-priority {
      display: inline-flex;
      width: max-content;
      margin-bottom: 7px;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 900;
      letter-spacing: .4px;
      text-transform: uppercase;
    }

    .operations-priority-urgent {
      color: #991b1b;
      background: rgba(220, 38, 38, .14);
    }

    .operations-priority-important {
      color: #7c4a03;
      background: rgba(245, 158, 11, .18);
    }

    .operations-priority-routine {
      color: #065f46;
      background: rgba(0, 191, 99, .14);
    }

    .operations-status {
      display: inline-flex;
      width: max-content;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(0, 191, 99, .13);
      font-size: .74rem;
      font-weight: 900;
    }

    .operations-status-warning {
      color: #7c4a03;
      background: rgba(245, 158, 11, .18);
    }

    .operations-status-error {
      color: #991b1b;
      background: rgba(220, 38, 38, .14);
    }

    .operations-status-neutral {
      color: #334155;
      background: rgba(100, 116, 139, .14);
    }

    .operations-progress {
      height: 9px;
      overflow: hidden;
      margin-top: 8px;
      border-radius: 999px;
      background: #e2e8f0;
    }

    .operations-progress span {
      display: block;
      height: 100%;
      background: #00bf63;
    }

    .operations-table-wrap {
      overflow: auto;
      border: 1px solid rgba(15, 23, 42, .12);
      border-radius: 12px;
    }

    .operations-table {
      width: 100%;
      min-width: 760px;
      border-collapse: collapse;
      background: #fff;
    }

    .operations-table th,
    .operations-table td {
      padding: 12px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid rgba(15, 23, 42, .09);
    }

    .operations-table th {
      color: #fff;
      background: #111827;
    }

    .operations-empty {
      padding: 22px;
      border: 1px dashed rgba(15, 23, 42, .25);
      background: rgba(255, 255, 255, .65);
      text-align: center;
    }

    .operations-quick-links {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
    }

    .operations-quick-link {
      min-height: 155px;
      display: flex;
      flex-direction: column;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, .12);
      background: #fff;
    }

    .operations-quick-link p {
      color: #64748b;
    }

    .operations-quick-link a {
      margin-top: auto;
      font-weight: 900;
    }

    .operations-config-grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
    }

    .operations-config-item {
      padding: 15px;
      border: 1px solid rgba(15, 23, 42, .1);
      background: #fff;
    }

    .operations-config-item strong {
      display: block;
      margin-bottom: 6px;
    }

    .operations-login {
      max-width: 620px;
      margin: 0 auto;
    }

    .operations-login label {
      display: grid;
      gap: 8px;
      margin-top: 18px;
      font-weight: 900;
    }

    @media (max-width: 850px) {
      .operations-grid,
      .operations-grid-wide {
        grid-template-columns: 1fr;
      }

      .operations-row {
        grid-template-columns: 1fr;
      }

      .operations-row-actions {
        justify-content: flex-start;
      }
    }
`;

export function adminOperationsPage(
  site,
  {
    stories = [],
    rankings = []
  } = {}
) {
  const now = Date.now();
  const staleAfterDays = 21;
  const staleCutoff =
    now - staleAfterDays * 24 * 60 * 60 * 1000;

  const latestStory = [...stories]
    .sort(
      (first, second) =>
        toDateValue(second.updatedDate || second.date) -
        toDateValue(first.updatedDate || first.date)
    )[0] || null;

  const staleRankings = rankings
    .filter(
      (ranking) =>
        toDateValue(ranking.updatedDate) <
        staleCutoff
    )
    .map((ranking) => ({
      title: ranking.title,
      updatedDate: ranking.updatedDate,
      href: ranking.href
    }));

  const staticData = {
    generatedAt: new Date().toISOString(),
    stories: {
      count: stories.length,
      latest: latestStory
        ? {
            title: latestStory.title,
            date:
              latestStory.updatedDate ||
              latestStory.date,
            href: `/stories/${latestStory.slug}/`
          }
        : null
    },
    rankings: {
      count: rankings.length,
      staleAfterDays,
      stale: staleRankings,
      latestUpdatedDate:
        rankings
          .map((ranking) => ranking.updatedDate)
          .filter(Boolean)
          .sort()
          .at(-1) || null
    }
  };

  const content = `<div class="operations-shell">
        <div
          class="info-card"
          data-operations-loading
        >
          <h2>Checking admin access</h2>
          <p>
            Podium Watch is confirming your secure session
            and loading the current operating picture.
          </p>
        </div>

        <form
          class="info-card operations-login"
          data-operations-login
          hidden
        >
          <p class="eyebrow">Private access</p>
          <h2>Admin sign in</h2>
          <p>
            Sign in with the same password used by the main
            Podium Watch admin area.
          </p>

          <label>
            Password
            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
            >
          </label>

          <p
            data-operations-login-message
            aria-live="polite"
          ></p>

          <button
            class="button button-primary"
            type="submit"
          >
            Sign in
          </button>
        </form>

        <p
          class="operations-message"
          data-operations-message
          aria-live="polite"
          hidden
        ></p>

        <div
          class="operations-shell"
          data-operations-dashboard
          hidden
        >
          <div class="operations-topbar">
            <div>
              <p class="eyebrow">
                Daily command center
              </p>
              <h2>
                What needs your attention today
              </h2>
              <p data-operations-updated>
                Loading the latest information.
              </p>
            </div>

            <div class="operations-actions">
              <label>
                <span class="visually-hidden">
                  Analytics time period
                </span>

                <select data-operations-days>
                  <option value="7">
                    Last 7 days
                  </option>

                  <option value="30" selected>
                    Last 30 days
                  </option>

                  <option value="90">
                    Last 90 days
                  </option>
                </select>
              </label>

              <button
                class="button button-primary"
                type="button"
                data-operations-refresh
              >
                Refresh dashboard
              </button>

              <a
                class="button button-outline"
                href="/admin/meets/"
              >
                Meet Manager
              </a>

              <button
                class="button button-outline"
                type="button"
                data-operations-logout
              >
                Sign out
              </button>
            </div>
          </div>

          <div class="operations-stats">
            <article class="operations-stat">
              <strong data-stat-task-count>0</strong>
              <span>Open tasks</span>
              <small data-stat-urgent-tasks>
                No urgent items
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-upcoming-meets>0</strong>
              <span>Meets in 7 days</span>
              <small data-stat-upcoming-thirty>
                0 in the next 30 days
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-claims>0</strong>
              <span>Pending claims</span>
              <small data-stat-reports>
                0 active reports
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-views>0</strong>
              <span>Team page views</span>
              <small data-stat-clicks>
                0 tracked clicks
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-failures>0</strong>
              <span>Delivery failures</span>
              <small>
                Email and notification queue
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-incomplete>0</strong>
              <span>Incomplete teams</span>
              <small>
                Below 65 percent completion
              </small>
            </article>

            <article class="operations-stat">
              <strong data-stat-athletes>0</strong>
              <span>Public athletes</span>
              <small data-stat-athlete-corrections>
                0 corrections waiting
              </small>
            </article>
          </div>

          <div
            class="operations-tabs"
            role="tablist"
            aria-label="Operations Center sections"
          >
            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="overview"
              aria-selected="true"
            >
              Overview
            </button>

            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="meets"
              aria-selected="false"
            >
              Meets
            </button>

            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="teams"
              aria-selected="false"
            >
              Teams
            </button>

            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="athletes"
              aria-selected="false"
            >
              Athletes
            </button>

            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="content"
              aria-selected="false"
            >
              Content
            </button>

            <button
              class="button button-outline operations-tab"
              type="button"
              data-operations-tab="system"
              aria-selected="false"
            >
              System
            </button>
          </div>

          <section
            class="operations-panel"
            data-operations-panel="overview"
          >
            <div class="operations-grid operations-grid-wide">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Prioritized work
                    </p>
                    <h2>Today’s focus</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-task-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-task-list
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Weekly features
                    </p>
                    <h2>Awards status</h2>
                  </div>
                </div>

                <div
                  class="operations-list"
                  data-awards-list
                ></div>
              </article>
            </div>

            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Coming soon
                    </p>
                    <h2>Next meets</h2>
                  </div>

                  <a href="/admin/meets/">
                    Manage meets
                  </a>
                </div>

                <div
                  class="operations-list"
                  data-upcoming-overview
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Website publishing
                    </p>
                    <h2>Static content</h2>
                  </div>
                </div>

                <div
                  class="operations-list"
                  data-static-overview
                ></div>
              </article>
            </div>

            <article class="info-card operations-card">
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Fast navigation
                  </p>
                  <h2>Management tools</h2>
                </div>
              </div>

              <div class="operations-quick-links">
                <article class="operations-quick-link">
                  <h3>Meet Manager</h3>
                  <p>
                    Create meet pages, publish updates,
                    and add results.
                  </p>
                  <a href="/admin/meets/">
                    Open Meet Manager
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Team Manager</h3>
                  <p>
                    Review claims, reports, ownership,
                    and team profile quality.
                  </p>
                  <a href="/admin/team-manager/">
                    Open Team Manager
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Statewide Data</h3>
                  <p>
                    Import official schools, divisions,
                    regional sites, and team links.
                  </p>
                  <a href="/admin/statewide-data/">
                    Open Statewide Data
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Team Schedules</h3>
                  <p>
                    Review requested meets and connect
                    team schedules.
                  </p>
                  <a href="/admin/team-schedules/">
                    Open schedules
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Team Rosters</h3>
                  <p>
                    Manage seasons, athletes,
                    and roster publication.
                  </p>
                  <a href="/admin/team-rosters/">
                    Open rosters
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Team Content</h3>
                  <p>
                    Review announcements, results,
                    achievements, and media.
                  </p>
                  <a href="/admin/team-content/">
                    Open content
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Athlete Data</h3>
                  <p>
                    Import athlete profiles, review corrections,
                    connect rosters, and verify performances.
                  </p>
                  <a href="/admin/athletes/">
                    Open Athlete Data
                  </a>
                </article>

                <article class="operations-quick-link">
                  <h3>Engagement Center</h3>
                  <p>
                    Manage followers, analytics,
                    notifications, and sponsors.
                  </p>
                  <a href="/admin/engagement/">
                    Open engagement
                  </a>
                </article>
              </div>
            </article>
          </section>

          <section
            class="operations-panel"
            data-operations-panel="meets"
            hidden
          >
            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Results follow up
                    </p>
                    <h2>Missing results</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-missing-results-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-missing-results
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Visitor readiness
                    </p>
                    <h2>Incomplete upcoming pages</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-incomplete-meets-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-incomplete-meets
                ></div>
              </article>
            </div>

            <article class="info-card operations-card">
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Meet calendar
                  </p>
                  <h2>Upcoming meets</h2>
                </div>

                <a
                  class="button button-outline"
                  href="/admin/meets/"
                >
                  Open Meet Manager
                </a>
              </div>

              <div class="operations-table-wrap">
                <table class="operations-table">
                  <thead>
                    <tr>
                      <th>Meet</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Results</th>
                    </tr>
                  </thead>

                  <tbody data-upcoming-meets-table></tbody>
                </table>
              </div>
            </article>
          </section>

          <section
            class="operations-panel"
            data-operations-panel="teams"
            hidden
          >
            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Access requests
                    </p>
                    <h2>Pending claims</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-claims-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-claims-list
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Community corrections
                    </p>
                    <h2>Active reports</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-reports-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-reports-list
                ></div>
              </article>
            </div>

            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Schedule workflow
                    </p>
                    <h2>Meet requests</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-schedule-requests-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-schedule-requests
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Profile quality
                    </p>
                    <h2>Lowest completion</h2>
                  </div>

                  <a href="/admin/team-manager/">
                    Open Team Manager
                  </a>
                </div>

                <div
                  class="operations-list"
                  data-incomplete-teams
                ></div>
              </article>
            </div>

            <article class="info-card operations-card">
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Statewide coverage
                  </p>
                  <h2>Team profile totals</h2>
                </div>
              </div>

              <div
                class="operations-stats"
                data-team-stats
              ></div>
            </article>
          </section>

          <section
            class="operations-panel"
            data-operations-panel="athletes"
            hidden
          >
            <article class="info-card operations-card">
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Statewide athlete foundation
                  </p>
                  <h2>Athlete profile totals</h2>
                </div>

                <a
                  class="button button-outline"
                  href="/admin/athletes/"
                >
                  Open Athlete Data
                </a>
              </div>

              <div
                class="operations-stats"
                data-athlete-stats
              ></div>
            </article>

            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Data readiness
                    </p>
                    <h2>Athlete workflow</h2>
                  </div>
                </div>

                <div
                  class="operations-list"
                  data-athlete-readiness
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Public experience
                    </p>
                    <h2>Athlete tools</h2>
                  </div>
                </div>

                <div class="operations-quick-links">
                  <article class="operations-quick-link">
                    <h3>Athlete Directory</h3>
                    <p>
                      Review public athlete search,
                      filters, and profile discovery.
                    </p>
                    <a href="/athletes/">
                      Open directory
                    </a>
                  </article>

                  <article class="operations-quick-link">
                    <h3>Ranking Connections</h3>
                    <p>
                      Confirm ranking names lead to
                      the correct permanent profiles.
                    </p>
                    <a href="/rankings/">
                      Open rankings
                    </a>
                  </article>
                </div>
              </article>
            </div>
          </section>

          <section
            class="operations-panel"
            data-operations-panel="content"
            hidden
          >
            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Team publishing
                    </p>
                    <h2>Content drafts</h2>
                  </div>

                  <span
                    class="operations-count"
                    data-draft-content-count
                  >
                    0
                  </span>
                </div>

                <div
                  class="operations-list"
                  data-draft-content
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Rankings
                    </p>
                    <h2>Freshness review</h2>
                  </div>
                </div>

                <div
                  class="operations-list"
                  data-ranking-freshness
                ></div>
              </article>
            </div>

            <article class="info-card operations-card">
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Editorial inventory
                  </p>
                  <h2>Published website content</h2>
                </div>
              </div>

              <div
                class="operations-stats"
                data-content-stats
              ></div>
            </article>
          </section>

          <section
            class="operations-panel"
            data-operations-panel="system"
            hidden
          >
            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Platform readiness
                    </p>
                    <h2>Environment configuration</h2>
                  </div>
                </div>

                <div
                  class="operations-config-grid"
                  data-configuration
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Database features
                    </p>
                    <h2>Subsystem status</h2>
                  </div>
                </div>

                <div
                  class="operations-list"
                  data-subsystems
                ></div>
              </article>
            </div>

            <div class="operations-grid">
              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Notification workflow
                    </p>
                    <h2>Queue health</h2>
                  </div>

                  <a href="/admin/engagement/">
                    Open Engagement Center
                  </a>
                </div>

                <div
                  class="operations-list"
                  data-notification-health
                ></div>
              </article>

              <article class="info-card operations-card">
                <div class="operations-card-heading">
                  <div>
                    <p class="eyebrow">
                      Revenue systems
                    </p>
                    <h2>Sponsor readiness</h2>
                  </div>

                  <a href="/admin/engagement/">
                    Manage sponsors
                  </a>
                </div>

                <div
                  class="operations-list"
                  data-sponsor-health
                ></div>
              </article>
            </div>

            <article
              class="info-card operations-card"
              data-system-issues-card
              hidden
            >
              <div class="operations-card-heading">
                <div>
                  <p class="eyebrow">
                    Needs attention
                  </p>
                  <h2>Unavailable systems</h2>
                </div>
              </div>

              <div
                class="operations-list"
                data-system-issues
              ></div>
            </article>
          </section>
        </div>
      </div>

  <script>
    window.PODIUM_OPERATIONS_STATIC =
      ${safeJson(staticData)};
  </script>`;

  return adminShell({
    site,
    pathname: "/admin/operations/",
    title: "Operations Center",
    description: "Private Podium Watch operations dashboard for meets, teams, content, weekly awards, analytics, notifications, and sponsors.",
    heading: "Operations Center.",
    intro: "See what needs attention, what is coming next, and how the entire Podium Watch platform is performing from one secure dashboard.",
    styles,
    content,
    scripts: ["/scripts/admin-operations.js"]
  });
}
