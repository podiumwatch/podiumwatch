import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The Setup + Full Team Plan screen: race details, roster/manual
// participant selection, and per-runner goals (A/B/C), pace strategy, and
// checkpoint targets. Full site chrome, matching src/pages/teamroster.mjs's
// structure -- Race Command Center reuses the existing coach-tool page
// pattern rather than inventing a second design system.
export function raceCommandCenterPlanPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Race Command Center",
    title: "Plan the race.",
    description:
      "Build your roster for this race, set a goal for every runner, and choose how each runner will pace it.",
    compact: true
  })}

  <style>
    .rcc-shell,
    .rcc-grid,
    .rcc-participant-list {
      display: grid;
      gap: 20px;
    }

    .rcc-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    }

    .rcc-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .rcc-panel-full {
      grid-column: 1 / -1;
    }

    .rcc-header,
    .rcc-actions,
    .rcc-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .rcc-header {
      justify-content: space-between;
    }

    .rcc-header h2 {
      margin-bottom: 0;
    }

    .rcc-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .rcc-badge {
      display: inline-flex;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.76rem;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .rcc-badge-live { background: #dc2626; color: #ffffff; }
    .rcc-badge-finished, .rcc-badge-reviewed { background: #111827; color: #ffffff; }

    .rcc-checkpoint-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .rcc-checkpoint-chip {
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.06);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .rcc-roster-list {
      display: grid;
      gap: 8px;
      margin: 14px 0;
      max-height: 320px;
      overflow-y: auto;
    }

    .rcc-roster-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 10px;
    }

    .rcc-roster-row input[type="checkbox"] {
      width: auto;
    }

    .rcc-manual-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 140px) auto;
      gap: 10px;
      margin-top: 14px;
    }

    .rcc-manual-form input {
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      font: inherit;
    }

    .rcc-participant-card {
      display: grid;
      gap: 12px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .rcc-participant-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .rcc-participant-summary h3 {
      margin: 0;
    }

    .rcc-participant-detail {
      display: none;
      gap: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(15, 23, 42, 0.1);
    }

    .rcc-participant-detail.rcc-open {
      display: grid;
    }

    .rcc-goal-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .rcc-goal-fields label,
    .rcc-participant-detail label {
      display: block;
      font-size: 0.9rem;
    }

    .rcc-goal-fields input,
    .rcc-participant-detail select,
    .rcc-participant-detail input {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      font: inherit;
    }

    .rcc-custom-targets {
      display: grid;
      gap: 8px;
    }

    .rcc-custom-target-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 110px);
      gap: 10px;
      align-items: center;
    }

    .rcc-empty {
      padding: 24px;
      text-align: center;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    @media (max-width: 900px) {
      .rcc-grid,
      .rcc-manual-form,
      .rcc-custom-target-row {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-rcc-loading>
        <h2>Loading race plan</h2>
        <p>Please wait while Podium Watch securely loads this race.</p>
      </div>

      <div class="rcc-shell" data-rcc-root hidden>
        <div class="rcc-header">
          <div>
            <p class="eyebrow"><span data-rcc-team-name></span> &middot; Plan</p>
            <h2 data-rcc-race-name></h2>
            <div class="rcc-badges">
              <span class="rcc-badge" data-rcc-status-badge></span>
              <span data-rcc-race-meta></span>
            </div>
          </div>

          <div class="rcc-actions">
            <a class="button button-outline" href="/race-command-center/">All races</a>
            <button class="button button-outline" type="button" data-rcc-delete-race>Delete draft</button>
            <button class="button button-primary" type="button" data-rcc-live-link>Go to live timing</button>
          </div>
        </div>

        <p class="rcc-message" data-rcc-message aria-live="polite" hidden></p>

        <div class="rcc-checkpoint-strip" data-rcc-checkpoint-strip></div>

        <div class="rcc-grid" style="margin-top:20px;">
          <section class="rcc-panel">
            <p class="eyebrow">Roster</p>
            <h2>Add runners</h2>
            <p>Select from your current roster, or add a runner manually for a guest or unrostered athlete.</p>

            <div class="rcc-roster-list" data-rcc-roster-list></div>
            <div class="rcc-empty" data-rcc-roster-empty hidden>No current-season roster found for this team.</div>

            <form class="rcc-manual-form" data-rcc-manual-form>
              <input type="text" name="manual_name" placeholder="Guest runner name">
              <input type="text" name="race_group" placeholder="Group (Varsity, JV...)">
              <button class="button button-outline" type="submit">Add</button>
            </form>

            <button class="button button-primary" type="button" data-rcc-save-participants style="margin-top:16px;width:100%;">Save participants</button>
          </section>

          <section class="rcc-panel">
            <div class="rcc-header">
              <div>
                <p class="eyebrow">Team plan</p>
                <h2>Goals and pacing</h2>
              </div>
            </div>
            <p>Every runner needs at least a Goal A time before the race can start. Click a runner to set their goal and pacing.</p>

            <div class="rcc-participant-list" data-rcc-participant-list style="margin-top:14px;"></div>
            <div class="rcc-empty" data-rcc-participant-empty hidden>Add participants on the left to start planning.</div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/race-command-center-plan.js" defer></script>`;

  return layout({
    site,
    title: "Plan a Race | Race Command Center",
    description: "Build the full-team race plan: roster, goals, and pacing strategy.",
    pathname: "/race-command-center/plan/",
    content
  });
}
