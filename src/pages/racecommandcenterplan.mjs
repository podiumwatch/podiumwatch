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
    /* [hidden] must always win the cascade -- several classes below set
       their own display property at the same specificity as the
       browser's built-in [hidden] rule, and a page's own style block
       loads after the UA stylesheet, so without this a hidden root/
       message/empty-state element stays fully visible regardless of its
       hidden attribute. Confirmed as a real bug on the Live page (see
       docs/DECISIONS.md's Live Race Mode diagnostic entry) and fixed
       here across every Race Command Center page for the same reason. */
    [hidden] { display: none !important; }

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

    .rcc-race-switcher-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .rcc-race-switcher-select {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      background: #ffffff;
      font: inherit;
    }

    .rcc-bulk-goals {
      margin: 16px 0 22px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.03);
    }

    .rcc-bulk-goals h3 {
      margin: 0 0 4px;
      font-size: 1rem;
    }

    .rcc-bulk-goals-note {
      margin: 0 0 12px;
      font-size: 0.82rem;
      opacity: 0.8;
    }

    .rcc-bulk-goals-scroll {
      overflow-x: auto;
    }

    table.rcc-bulk-goals-table {
      width: 100%;
      border-collapse: collapse;
    }

    table.rcc-bulk-goals-table th,
    table.rcc-bulk-goals-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(15, 23, 42, 0.1);
      white-space: nowrap;
    }

    table.rcc-bulk-goals-table input[type="text"] {
      width: 90px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      font: inherit;
    }

    .rcc-bulk-goals-skip-note {
      font-size: 0.78rem;
      opacity: 0.7;
    }

    .rcc-bulk-goals-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
    }

    .rcc-bulk-goals-apply {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }

    .rcc-bulk-goals-apply input {
      width: 90px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      font: inherit;
    }

    .rcc-roster-quick-add {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }

    .rcc-quick-add-btn {
      font-size: 0.8rem;
      padding: 8px 6px;
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

    .rcc-bulk-panel {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.03);
    }

    .rcc-bulk-panel textarea {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      font: inherit;
      resize: vertical;
    }

    .rcc-roster-import-note {
      margin-top: 10px;
      font-size: 0.9rem;
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

    dialog.rcc-race-day-dialog {
      width: min(560px, calc(100% - 28px));
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.35);
    }

    dialog.rcc-race-day-dialog::backdrop {
      background: rgba(15, 23, 42, 0.72);
    }

    .rcc-race-day-dialog-body {
      padding: 26px;
    }

    .rcc-race-day-reveal {
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(0, 191, 99, 0.12);
      border: 1px solid rgba(0, 191, 99, 0.35);
    }

    .rcc-race-day-reveal p {
      margin: 0 0 10px;
      font-weight: 800;
      font-size: 0.85rem;
    }

    .rcc-race-day-code-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .rcc-race-day-code {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
    }

    .rcc-item-meta {
      margin-top: 4px;
      font-size: 0.85rem;
      opacity: 0.75;
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
            <a class="button button-outline" href="/race-command-center/" data-rcc-all-races-link>All races</a>
            <span class="rcc-race-switcher-label" data-rcc-race-switcher-wrap hidden>
              Switch race
              <select class="rcc-race-switcher-select" data-rcc-race-switcher></select>
            </span>
            <button class="button button-outline" type="button" data-rcc-race-day-open hidden>Share access code</button>
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
            <p>
              Select from your current roster, or add a runner manually for a guest or unrostered athlete.
              <a data-rcc-manage-roster-link href="/team-roster/">Manage your full roster</a> to bulk-import or edit it.
            </p>

            <button class="button button-outline" type="button" data-rcc-select-all-roster style="width:100%;margin-bottom:10px;">Add all from roster</button>

            <div class="rcc-roster-quick-add" data-rcc-quick-add-wrap hidden>
              <button class="button button-outline rcc-quick-add-btn" type="button" data-rcc-quick-add="hs_boys" hidden>Add all HS Boys</button>
              <button class="button button-outline rcc-quick-add-btn" type="button" data-rcc-quick-add="hs_girls" hidden>Add all HS Girls</button>
              <button class="button button-outline rcc-quick-add-btn" type="button" data-rcc-quick-add="jh_boys" hidden>Add all JH Boys</button>
              <button class="button button-outline rcc-quick-add-btn" type="button" data-rcc-quick-add="jh_girls" hidden>Add all JH Girls</button>
            </div>

            <div class="rcc-roster-list" data-rcc-roster-list></div>
            <div class="rcc-empty" data-rcc-roster-empty hidden>
              No current-season roster found for this team.
              <p class="rcc-roster-import-note">
                <a data-rcc-roster-import-link href="/team-roster/">Build or import your season roster</a>
                to select runners here on every race, not just this one.
              </p>
            </div>

            <form class="rcc-manual-form" data-rcc-manual-form>
              <input type="text" name="manual_name" placeholder="Guest runner name">
              <input type="text" name="race_group" placeholder="Group (Varsity, JV...)">
              <button class="button button-outline" type="submit">Add</button>
            </form>

            <div class="rcc-bulk-add" style="margin-top:10px;">
              <button class="button button-outline" type="button" data-rcc-bulk-toggle style="width:100%;">Paste multiple names</button>

              <div class="rcc-bulk-panel" data-rcc-bulk-panel hidden>
                <label style="display:block;font-size:0.85rem;font-weight:700;">
                  One runner per line -- add a group after a comma if you want (e.g. "Jordan Smith, Varsity").
                </label>
                <textarea data-rcc-bulk-textarea rows="6" placeholder="Jordan Smith, Varsity&#10;Casey Lee, JV&#10;Morgan Diaz"></textarea>
                <button class="button button-primary" type="button" data-rcc-bulk-add style="margin-top:10px;width:100%;">Add all as guest runners</button>
              </div>
            </div>

            <button class="button button-primary" type="button" data-rcc-save-participants style="margin-top:16px;width:100%;">Save participants</button>
          </section>

          <section class="rcc-panel">
            <div class="rcc-header">
              <div>
                <p class="eyebrow">Team plan</p>
                <h2>Goals and pacing</h2>
              </div>
            </div>
            <p>Click a runner to set a goal and pacing plan -- it's entirely optional. The race can start with any or all runners left without a goal; they just won't show pace comparisons during live timing. A runner's goal from their most recent race carries over automatically -- click in to review or change it.</p>

            <div class="rcc-bulk-goals" data-rcc-bulk-goals hidden>
              <h3>Set Goal A for everyone at once</h3>
              <p class="rcc-bulk-goals-note">
                Each row is that runner's Goal A -- already filled in wherever one exists. Edit any of them and
                save all at once, instead of opening every runner's card individually. Runners on a Custom Pace
                plan aren't editable here -- open their own card below for that.
              </p>
              <div class="rcc-bulk-goals-scroll">
                <table class="rcc-bulk-goals-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" data-rcc-bulk-select-all></th>
                      <th>Runner</th>
                      <th>Goal A</th>
                    </tr>
                  </thead>
                  <tbody data-rcc-bulk-goals-rows></tbody>
                </table>
              </div>
              <div class="rcc-bulk-goals-actions">
                <div class="rcc-bulk-goals-apply">
                  <span>Apply one goal to selected:</span>
                  <input type="text" placeholder="19:30" data-rcc-bulk-apply-value>
                  <button class="button button-outline" type="button" data-rcc-bulk-apply-selected>Apply</button>
                </div>
                <button class="button button-primary" type="button" data-rcc-save-bulk-goals>Save all goals</button>
              </div>
            </div>

            <div class="rcc-participant-list" data-rcc-participant-list style="margin-top:14px;"></div>
            <div class="rcc-empty" data-rcc-participant-empty hidden>Add participants on the left to start planning.</div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <dialog class="rcc-race-day-dialog" data-rcc-race-day-dialog>
    <div class="rcc-race-day-dialog-body">
      <div class="rcc-header">
        <div>
          <p class="eyebrow">Race day access</p>
          <h2>Get volunteers timing</h2>
        </div>
        <button class="button button-outline" type="button" data-rcc-race-day-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        Share this code with anyone timing this race for you -- a parent at mile one, a friend at the finish.
        They enter it at <strong>Race Command Center</strong> in the main menu and go straight into live
        timing for this team, no account required.
      </p>

      <div class="rcc-race-day-reveal" data-rcc-race-day-reveal hidden>
        <p>Your new code -- share it now, it won't be shown again</p>
        <div class="rcc-race-day-code-row">
          <code class="rcc-race-day-code" data-rcc-race-day-reveal-code></code>
          <button class="button button-outline" type="button" data-rcc-race-day-copy>Copy</button>
        </div>
      </div>

      <div data-rcc-race-day-status style="margin-top:14px;"></div>

      <div class="rcc-actions" style="margin-top:14px;">
        <button class="button button-primary" type="button" data-rcc-race-day-generate>Generate code</button>
        <button class="button button-outline" type="button" data-rcc-race-day-revoke hidden>Turn off access</button>
      </div>
    </div>
  </dialog>

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
