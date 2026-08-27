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
    .tw-today-card { padding: 20px; border-radius: 14px; background: #111827; color: #ffffff; border: 2px solid #00bf63; }
    .tw-today-card .tw-item-meta { opacity: 0.8; }
    .tw-today-race { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.06); }
    .tw-today-race + .tw-today-race { margin-top: 10px; }
    .tw-today-race-live { background: rgba(220, 38, 38, 0.22); border: 1px solid rgba(220, 38, 38, 0.6); }
    .tw-today-live-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #dc2626; margin-right: 6px; animation: tw-today-pulse 1.6s ease-in-out infinite; }
    @keyframes tw-today-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .tw-race-day-reveal { margin-top: 16px; padding: 16px; border-radius: 12px; background: rgba(0, 191, 99, 0.12); border: 1px solid rgba(0, 191, 99, 0.35); }
    .tw-race-day-reveal p { margin: 0 0 10px; font-weight: 800; font-size: 0.85rem; }
    .tw-race-day-code-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tw-race-day-code { font-size: 1.5rem; font-weight: 800; letter-spacing: 0.12em; padding: 10px 14px; border-radius: 8px; background: rgba(255, 255, 255, 0.9); }
    @media (max-width: 720px) {
      .tw-item { flex-direction: column; align-items: flex-start; }
    }

    /* Race Day Command Center (build plan Project 2). */
    .tw-cc-race-name { font-size: 1.3rem; margin: 2px 0 4px; }
    .tw-cc-meta { opacity: 0.85; font-size: 0.9rem; margin-bottom: 14px; }
    .tw-cc-primary-action { display: inline-flex; width: 100%; justify-content: center; font-size: 1rem; padding: 14px 18px; }
    .tw-cc-summary { display: flex; align-items: center; gap: 8px; background: none; border: none; color: inherit; font: inherit; font-weight: 800; cursor: pointer; padding: 10px 0 4px; margin: 0; text-align: left; }
    .tw-cc-summary-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .tw-cc-summary-dot.tw-cc-dot-complete { background: #00bf63; }
    .tw-cc-summary-dot.tw-cc-dot-attention { background: #f4b400; }
    .tw-cc-checklist { display: grid; gap: 10px; margin-top: 10px; }
    .tw-cc-item { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.06); }
    .tw-cc-item-label { font-weight: 700; }
    .tw-cc-item-explanation { font-size: 0.85rem; opacity: 0.8; margin-top: 2px; }
    .tw-cc-item-status { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
    .tw-cc-status-complete { background: rgba(0, 191, 99, 0.22); color: #00e676; }
    .tw-cc-status-recommended { background: rgba(255, 255, 255, 0.14); color: #d9dee6; }
    .tw-cc-status-attention { background: rgba(244, 180, 0, 0.24); color: #ffcf4d; }
    .tw-cc-item-fix { align-self: center; }
    .tw-cc-choice-list { display: grid; gap: 10px; margin-top: 10px; }
    .tw-cc-secondary-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .tw-cc-secondary-actions .button { flex: 1 1 160px; text-align: center; }
    .tw-cc-device-line { font-size: 0.82rem; opacity: 0.75; margin-top: 10px; }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-tw-loading>
        <h2>Loading team home</h2>
        <p>Please wait while Podium Watch securely loads your team.</p>
      </div>

      <!-- Race Day Command Center (build plan Project 2): a sibling of
           data-tw-root, not a child of it, on purpose -- it fetches and
           renders from its OWN, faster call (see team-home.js), and must
           never sit behind [hidden] just because the slower roster/
           schedule aggregate below hasn't finished yet. -->
      <div class="tw-shell" style="margin-bottom:20px;">
        <div class="tw-today-card" data-tw-today-card hidden>
          <p class="eyebrow" style="color:#00bf63;">Today's Split Watch</p>

          <div data-tw-cc-empty hidden>
            <p style="margin:6px 0 14px;opacity:0.85;">Nothing scheduled yet. Connect a meet or create a race to get started.</p>
            <a class="button button-outline" href="/team-meet-center/" data-tw-cc-empty-link>Find a meet</a>
          </div>

          <div data-tw-cc-choice hidden>
            <p style="margin:6px 0 4px;opacity:0.9;">More than one race is live right now -- choose which one:</p>
            <div class="tw-cc-choice-list" data-tw-cc-choice-list></div>
          </div>

          <div data-tw-cc-single hidden>
            <h3 class="tw-cc-race-name" data-tw-cc-race-name></h3>
            <div class="tw-cc-meta" data-tw-cc-race-meta></div>

            <a class="button button-primary tw-cc-primary-action" data-tw-cc-primary-action href="/split-watch/"></a>

            <button type="button" class="tw-cc-summary" data-tw-cc-summary-toggle>
              <span class="tw-cc-summary-dot" data-tw-cc-summary-dot></span>
              <span data-tw-cc-summary-label>Checking readiness&hellip;</span>
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <div class="tw-cc-checklist" data-tw-cc-checklist hidden></div>

            <div class="tw-cc-secondary-actions">
              <a class="button button-outline" style="color:#fff;border-color:rgba(255,255,255,0.6);" data-tw-cc-crew-action href="#race-day-access">Manage Timing Crew</a>
              <a class="button button-outline" style="color:#fff;border-color:rgba(255,255,255,0.6);" data-tw-cc-parent-action href="/split-watch/">Share Parent Page</a>
            </div>

            <p class="tw-cc-device-line" data-tw-cc-device-line></p>
          </div>
        </div>
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
              <a class="button button-primary" data-tw-sw-link href="/split-watch/">Split Watch</a>
            </div>
          </section>

          <section class="tw-panel tw-panel-wide" id="race-day-access">
            <div class="tw-header">
              <div><p class="eyebrow">Race day access</p><h2>Timing helper code</h2></div>
            </div>
            <p style="margin-top:6px;max-width:640px;opacity:0.8;">
              Share this 4-digit code with anyone actually recording splits for you -- a coach at mile one, a
              volunteer at the finish. They enter it at <strong>Split Watch</strong> and go straight into today's
              race, no account required. For parents and fans who just want to watch, use Copy Parent Live Link
              on the race's Plan page instead -- that's a read-only view, this code is not.
            </p>

            <div class="tw-race-day-reveal" data-tw-race-day-reveal hidden>
              <p>Your new code -- share it now, it won't be shown again</p>
              <div class="tw-race-day-code-row">
                <code class="tw-race-day-code" data-tw-race-day-reveal-code></code>
                <button class="button button-outline" type="button" data-tw-race-day-copy>Copy</button>
              </div>
            </div>

            <div data-tw-race-day-status style="margin-top:14px;"></div>

            <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:0.9rem;cursor:pointer;">
              <input type="checkbox" data-tw-race-day-revoke-helpers style="width:auto;">
              Also sign out everyone currently using the old code (only needed if it leaked -- otherwise your timing crew's positions and access stay put)
            </label>

            <div class="tw-actions" style="margin-top:14px;">
              <button class="button button-primary" type="button" data-tw-race-day-generate>Generate code</button>
              <button class="button button-outline" type="button" data-tw-race-day-revoke hidden>Turn off access</button>
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
  <script src="/scripts/race-local-store.js" defer></script>
  <script src="/scripts/device-readiness.js" defer></script>
  <script src="/scripts/team-home.js" defer></script>`;

  return layout({
    site,
    title: "Team Home",
    description: "A coach's private season-at-a-glance workspace -- next meet, roster, schedule, and recent results.",
    pathname: "/team-home/",
    content
  });
}
