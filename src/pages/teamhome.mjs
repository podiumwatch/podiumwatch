import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The private, single-team season landing page -- distinct from
// /team-dashboard/, which is a multi-team management list
// (renderOwnedTeams() in public/scripts/team-dashboard.js). Section
// layout borrows the same eyebrow+h2 pattern as the public team profile
// page (src/pages/teamprofile.mjs), adapted for an authenticated,
// coach-only, season-at-a-glance view. Answers three questions: what's
// happening next, what needs attention, what happened recently.
export function teamHomePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Workspace",
    title: "Team home.",
    description: "Your season at a glance -- next meet, roster, schedule, and recent results.",
    compact: true
  })}

  <style>
    .tw-shell, .tw-grid, .tw-list { display: grid; gap: 20px; }
    .tw-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .tw-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .tw-panel-wide { grid-column: 1 / -1; }
    .tw-header, .tw-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tw-header { justify-content: space-between; }
    .tw-header h2 { margin-bottom: 0; }
    .tw-message { padding: 14px 16px; border-radius: 10px; background: rgba(220, 38, 38, 0.12); }
    .tw-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; }
    .tw-stat { padding: 16px; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .tw-stat strong { display: block; font-size: 1.6rem; }
    .tw-stat span { display: block; margin-top: 6px; font-weight: 700; font-size: 0.82rem; }
    .tw-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 10px; }
    .tw-item-meta { font-size: 0.85rem; opacity: 0.75; }
    .tw-badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: rgba(0, 191, 99, 0.14); font-size: 0.74rem; font-weight: 800; text-transform: uppercase; }
    .tw-empty { padding: 20px; text-align: center; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .tw-next-card { padding: 20px; border-radius: 14px; background: #111827; color: #ffffff; }
    .tw-next-card .tw-item-meta { opacity: 0.8; }
    @media (max-width: 720px) {
      .tw-item { flex-direction: column; align-items: flex-start; }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-tw-loading>
        <h2>Loading team home</h2>
        <p>Please wait while Podium Watch securely loads your team.</p>
      </div>

      <div class="tw-shell" data-tw-root hidden>
        <div class="tw-header">
          <div>
            <p class="eyebrow" data-tw-team-name></p>
            <p data-tw-account></p>
          </div>
          <div class="tw-actions">
            <a class="button button-outline" href="/team-dashboard/">All teams</a>
            <a class="button button-outline" data-tw-team-link href="/team/">View team profile</a>
          </div>
        </div>

        <p class="tw-message" data-tw-message hidden></p>

        <div class="tw-next-card" data-tw-next-card>
          <p class="eyebrow" style="color:#00bf63;">Next up</p>
          <div data-tw-next-content></div>
        </div>

        <div class="tw-grid">
          <section class="tw-panel">
            <div class="tw-header">
              <div><p class="eyebrow">Roster</p><h2>Team status</h2></div>
            </div>
            <div class="tw-stat-row" style="margin-top:14px;">
              <div class="tw-stat"><strong data-tw-roster-count>0</strong><span>Current roster</span></div>
              <div class="tw-stat"><strong data-tw-upcoming-count>0</strong><span>Upcoming meets</span></div>
              <div class="tw-stat"><strong data-tw-recent-count>0</strong><span>Recent races</span></div>
            </div>
            <div class="tw-actions" style="margin-top:16px;">
              <a class="button button-outline" data-tw-roster-link href="/team-roster/">Manage roster</a>
              <a class="button button-outline" data-tw-schedule-link href="/team-schedule/">Manage schedule</a>
              <a class="button button-primary" data-tw-rcc-link href="/race-command-center/">Race Command Center</a>
            </div>
          </section>

          <section class="tw-panel tw-panel-wide">
            <p class="eyebrow">Schedule</p>
            <h2>Upcoming meets</h2>
            <div class="tw-list" data-tw-upcoming-list style="margin-top:14px;"></div>
            <div class="tw-empty" data-tw-upcoming-empty hidden>No upcoming meets connected yet. Add one from the schedule manager.</div>
          </section>

          <section class="tw-panel tw-panel-wide">
            <p class="eyebrow">Results</p>
            <h2>Recent races</h2>
            <div class="tw-list" data-tw-recent-list style="margin-top:14px;"></div>
            <div class="tw-empty" data-tw-recent-empty hidden>No finished races yet this season.</div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-home.js" defer></script>`;

  return layout({
    site,
    title: "Team Home",
    description: "A coach's private season-at-a-glance workspace -- next meet, roster, schedule, and recent results.",
    pathname: "/team-home/",
    content
  });
}
