import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The operational page for one meet -- the direct realization of the
// spec's "Meet Center" concept. Bridges the real, existing team_meet_connections
// schedule system with Race Command Center: every race session tied to
// this meet, its readiness, and a way to create a new one without
// re-typing the meet's name/date. Race Command Center itself is not
// modified -- this page only calls its existing sessions.js "create"
// action with meet_id pre-filled.
export function teamMeetCenterPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Workspace",
    title: "Meet center.",
    description: "Everything your team needs for one meet, in one place.",
    compact: true
  })}

  <style>
    .tw-shell, .tw-grid, .tw-list { display: grid; gap: 20px; }
    .tw-grid { grid-template-columns: minmax(0, 1fr); }
    .tw-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .tw-header, .tw-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tw-header { justify-content: space-between; }
    .tw-header h2 { margin-bottom: 0; }
    .tw-message { padding: 14px 16px; border-radius: 10px; background: rgba(220, 38, 38, 0.12); }
    .tw-race-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 14px 16px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 12px; }
    .tw-badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: rgba(0, 191, 99, 0.14); font-size: 0.74rem; font-weight: 800; text-transform: uppercase; }
    .tw-badge-live { background: #dc2626; color: #fff; }
    .tw-badge-finished, .tw-badge-reviewed { background: #111827; color: #fff; }
    .tw-empty { padding: 20px; text-align: center; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .tw-create-form { display: grid; gap: 14px; margin-top: 16px; }
    .tw-create-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .tw-create-form input, .tw-create-form select { display: block; width: 100%; margin-top: 6px; padding: 10px; border: 1px solid rgba(15, 23, 42, 0.22); border-radius: 8px; font: inherit; }
    .tw-create-form label { display: block; font-size: 0.9rem; }
    .tw-not-connected { padding: 14px 16px; border-radius: 10px; background: rgba(245, 158, 11, 0.14); }
    @media (max-width: 720px) {
      .tw-race-row { grid-template-columns: 1fr; }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-tmc-loading>
        <h2>Loading meet center</h2>
        <p>Please wait while Podium Watch securely loads this meet.</p>
      </div>

      <div class="tw-shell" data-tmc-root hidden>
        <div class="tw-header">
          <div>
            <p class="eyebrow" data-tmc-team-name></p>
            <h2 data-tmc-meet-name></h2>
            <p data-tmc-meet-meta></p>
          </div>
          <div class="tw-actions">
            <a class="button button-outline" data-tmc-home-link href="/team-home/">Team home</a>
            <a class="button button-outline" data-tmc-public-link href="/meetdetail/" target="_blank" rel="noopener">View public meet page</a>
          </div>
        </div>

        <p class="tw-message" data-tmc-message aria-live="polite" hidden></p>
        <p class="tw-not-connected" data-tmc-not-connected hidden>This meet is not yet on your team schedule. Connect it from the schedule manager to have it appear on your Team Home.</p>

        <div class="tw-grid">
          <section class="tw-panel">
            <div class="tw-header">
              <div><p class="eyebrow">Races</p><h2>Race groups at this meet</h2></div>
            </div>

            <div class="tw-list" data-tmc-race-list style="margin-top:14px;"></div>
            <div class="tw-empty" data-tmc-race-empty hidden>No races created for this meet yet.</div>

            <form class="tw-create-form" data-tmc-create-form>
              <p class="eyebrow" style="margin:0;">New race group</p>
              <div class="tw-create-fields">
                <label>Race name<input type="text" name="name" placeholder="Varsity Boys" required></label>
                <label>Distance (miles)<input type="number" name="distance_miles" step="0.01" min="0.01" value="5" required></label>
              </div>
              <button class="button button-primary" type="submit">Create race for this meet</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-meet-center.js" defer></script>`;

  return layout({
    site,
    title: "Meet Center | Team Workspace",
    description: "A coach's operational page for one meet -- race groups, readiness, and Race Command Center.",
    pathname: "/team-meet-center/",
    content
  });
}
