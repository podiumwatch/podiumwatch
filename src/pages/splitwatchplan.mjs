import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The Setup + Full Team Plan screen: race details, roster/manual
// participant selection, and per-runner goals (A/B/C), pace strategy, and
// checkpoint targets. Full site chrome, matching src/pages/teamroster.mjs's
// structure -- Split Watch reuses the existing coach-tool page
// pattern rather than inventing a second design system.
export function splitWatchPlanPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Split Watch",
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
       here across every Split Watch page for the same reason. */
    [hidden] { display: none !important; }

    .sw-shell,
    .sw-grid,
    .sw-participant-list {
      display: grid;
      gap: 20px;
    }

    .sw-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    }

    .sw-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .sw-panel-full {
      grid-column: 1 / -1;
    }

    .sw-header,
    .sw-actions,
    .sw-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .sw-race-switcher-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .sw-race-switcher-select {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      background: #ffffff;
      font: inherit;
    }

    .sw-bulk-goals {
      margin: 16px 0 22px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.03);
    }

    .sw-bulk-goals h3 {
      margin: 0 0 4px;
      font-size: 1rem;
    }

    .sw-bulk-goals-note {
      margin: 0 0 12px;
      font-size: 0.82rem;
      opacity: 0.8;
    }

    .sw-bulk-goals-scroll {
      overflow-x: auto;
    }

    table.sw-bulk-goals-table {
      width: 100%;
      border-collapse: collapse;
    }

    table.sw-bulk-goals-table th,
    table.sw-bulk-goals-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(15, 23, 42, 0.1);
      white-space: nowrap;
    }

    table.sw-bulk-goals-table input[type="text"] {
      width: 90px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      font: inherit;
    }

    .sw-bulk-goals-skip-note {
      font-size: 0.78rem;
      opacity: 0.7;
    }

    .sw-bulk-goals-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
    }

    .sw-bulk-goals-apply {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }

    .sw-bulk-goals-apply input {
      width: 90px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      font: inherit;
    }

    .sw-roster-quick-add {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }

    .sw-quick-add-btn {
      font-size: 0.8rem;
      padding: 8px 6px;
    }

    .sw-header {
      justify-content: space-between;
    }

    .sw-header h2 {
      margin-bottom: 0;
    }

    .sw-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .sw-badge {
      display: inline-flex;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.76rem;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sw-badge-live { background: #dc2626; color: #ffffff; }
    .sw-badge-finished, .sw-badge-reviewed { background: #111827; color: #ffffff; }

    .sw-checkpoint-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .sw-checkpoint-chip {
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.06);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .sw-roster-list {
      display: grid;
      gap: 8px;
      margin: 14px 0;
      max-height: 320px;
      overflow-y: auto;
    }

    .sw-roster-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 10px;
    }

    .sw-roster-row input[type="checkbox"] {
      width: auto;
    }

    .sw-manual-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 140px) auto;
      gap: 10px;
      margin-top: 14px;
    }

    .sw-manual-form input {
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      font: inherit;
    }

    .sw-bulk-panel {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.03);
    }

    .sw-bulk-panel textarea {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      font: inherit;
      resize: vertical;
    }

    .sw-roster-import-note {
      margin-top: 10px;
      font-size: 0.9rem;
    }

    .sw-participant-card {
      display: grid;
      gap: 12px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .sw-participant-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .sw-participant-summary h3 {
      margin: 0;
    }

    .sw-participant-detail {
      display: none;
      gap: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(15, 23, 42, 0.1);
    }

    .sw-participant-detail.sw-open {
      display: grid;
    }

    .sw-goal-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .sw-goal-fields label,
    .sw-participant-detail label {
      display: block;
      font-size: 0.9rem;
    }

    .sw-goal-fields input,
    .sw-participant-detail select,
    .sw-participant-detail input {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      font: inherit;
    }

    .sw-custom-targets {
      display: grid;
      gap: 8px;
    }

    .sw-custom-target-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 110px);
      gap: 10px;
      align-items: center;
    }

    .sw-empty {
      padding: 24px;
      text-align: center;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    @media (max-width: 900px) {
      .sw-grid,
      .sw-manual-form,
      .sw-custom-target-row {
        grid-template-columns: 1fr;
      }
    }

    dialog.sw-race-day-dialog {
      width: min(560px, calc(100% - 28px));
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.35);
    }

    dialog.sw-race-day-dialog::backdrop {
      background: rgba(15, 23, 42, 0.72);
    }

    .sw-race-day-dialog-body {
      padding: 26px;
    }

    .sw-race-day-reveal {
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(0, 191, 99, 0.12);
      border: 1px solid rgba(0, 191, 99, 0.35);
    }

    .sw-race-day-reveal p {
      margin: 0 0 10px;
      font-weight: 800;
      font-size: 0.85rem;
    }

    .sw-race-day-code-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .sw-race-day-code {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
    }

    .sw-item-meta {
      margin-top: 4px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-sw-loading>
        <h2>Loading race plan</h2>
        <p>Please wait while Podium Watch securely loads this race.</p>
      </div>

      <div class="sw-shell" data-sw-root hidden>
        <div class="sw-header">
          <div>
            <p class="eyebrow"><span data-sw-team-name></span> &middot; Plan</p>
            <h2 data-sw-race-name></h2>
            <div class="sw-badges">
              <span class="sw-badge" data-sw-status-badge></span>
              <span data-sw-race-meta></span>
            </div>
          </div>

          <div class="sw-actions">
            <a class="button button-outline" href="/split-watch/" data-sw-all-races-link>All races</a>
            <span class="sw-race-switcher-label" data-sw-race-switcher-wrap hidden>
              Switch race
              <select class="sw-race-switcher-select" data-sw-race-switcher></select>
            </span>
            <button class="button button-outline" type="button" data-sw-race-day-open hidden>Share access code</button>
            <button class="button button-outline" type="button" data-sw-delete-race>Delete draft</button>
            <button class="button button-primary" type="button" data-sw-live-link>Go to live timing</button>
          </div>
        </div>

        <p class="sw-message" data-sw-message aria-live="polite" hidden></p>

        <div class="sw-checkpoint-strip" data-sw-checkpoint-strip></div>

        <div class="sw-grid" style="margin-top:20px;">
          <section class="sw-panel">
            <p class="eyebrow">Roster</p>
            <h2>Add runners</h2>
            <p>
              Select from your current roster, or add a runner manually for a guest or unrostered athlete.
              <a data-sw-manage-roster-link href="/team-roster/">Manage your full roster</a> to bulk-import or edit it.
            </p>

            <button class="button button-outline" type="button" data-sw-select-all-roster style="width:100%;margin-bottom:10px;">Add all from roster</button>

            <div class="sw-roster-quick-add" data-sw-quick-add-wrap hidden>
              <button class="button button-outline sw-quick-add-btn" type="button" data-sw-quick-add="hs_boys" hidden>Add all HS Boys</button>
              <button class="button button-outline sw-quick-add-btn" type="button" data-sw-quick-add="hs_girls" hidden>Add all HS Girls</button>
              <button class="button button-outline sw-quick-add-btn" type="button" data-sw-quick-add="jh_boys" hidden>Add all JH Boys</button>
              <button class="button button-outline sw-quick-add-btn" type="button" data-sw-quick-add="jh_girls" hidden>Add all JH Girls</button>
            </div>

            <div class="sw-roster-list" data-sw-roster-list></div>
            <div class="sw-empty" data-sw-roster-empty hidden>
              No current-season roster found for this team.
              <p class="sw-roster-import-note">
                <a data-sw-roster-import-link href="/team-roster/">Build or import your season roster</a>
                to select runners here on every race, not just this one.
              </p>
            </div>

            <form class="sw-manual-form" data-sw-manual-form>
              <input type="text" name="manual_name" placeholder="Guest runner name">
              <input type="text" name="race_group" placeholder="Group (Varsity, JV...)">
              <button class="button button-outline" type="submit">Add</button>
            </form>

            <div class="sw-bulk-add" style="margin-top:10px;">
              <button class="button button-outline" type="button" data-sw-bulk-toggle style="width:100%;">Paste multiple names</button>

              <div class="sw-bulk-panel" data-sw-bulk-panel hidden>
                <label style="display:block;font-size:0.85rem;font-weight:700;">
                  One runner per line -- add a group after a comma if you want (e.g. "Jordan Smith, Varsity").
                </label>
                <textarea data-sw-bulk-textarea rows="6" placeholder="Jordan Smith, Varsity&#10;Casey Lee, JV&#10;Morgan Diaz"></textarea>
                <button class="button button-primary" type="button" data-sw-bulk-add style="margin-top:10px;width:100%;">Add all as guest runners</button>
              </div>
            </div>

            <button class="button button-primary" type="button" data-sw-save-participants style="margin-top:16px;width:100%;">Save participants</button>
          </section>

          <section class="sw-panel">
            <div class="sw-header">
              <div>
                <p class="eyebrow">Team plan</p>
                <h2>Goals and pacing</h2>
              </div>
            </div>
            <p>Click a runner to set a goal and pacing plan -- it's entirely optional. The race can start with any or all runners left without a goal; they just won't show pace comparisons during live timing. A runner's goal from their most recent race carries over automatically -- click in to review or change it.</p>

            <div class="sw-bulk-goals" data-sw-bulk-goals hidden>
              <h3>Set Goal A for everyone at once</h3>
              <p class="sw-bulk-goals-note">
                Each row is that runner's Goal A -- already filled in wherever one exists. Edit any of them and
                save all at once, instead of opening every runner's card individually. Runners on a Custom Pace
                plan aren't editable here -- open their own card below for that.
              </p>
              <div class="sw-bulk-goals-scroll">
                <table class="sw-bulk-goals-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" data-sw-bulk-select-all></th>
                      <th>Runner</th>
                      <th>Goal A</th>
                    </tr>
                  </thead>
                  <tbody data-sw-bulk-goals-rows></tbody>
                </table>
              </div>
              <div class="sw-bulk-goals-actions">
                <div class="sw-bulk-goals-apply">
                  <span>Apply one goal to selected:</span>
                  <input type="text" placeholder="19:30" data-sw-bulk-apply-value>
                  <button class="button button-outline" type="button" data-sw-bulk-apply-selected>Apply</button>
                </div>
                <button class="button button-primary" type="button" data-sw-save-bulk-goals>Save all goals</button>
              </div>
            </div>

            <div class="sw-participant-list" data-sw-participant-list style="margin-top:14px;"></div>
            <div class="sw-empty" data-sw-participant-empty hidden>Add participants on the left to start planning.</div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <dialog class="sw-race-day-dialog" data-sw-race-day-dialog>
    <div class="sw-race-day-dialog-body">
      <div class="sw-header">
        <div>
          <p class="eyebrow">Race day access</p>
          <h2>Get volunteers timing</h2>
        </div>
        <button class="button button-outline" type="button" data-sw-race-day-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        Share this code with anyone timing this race for you -- a parent at mile one, a friend at the finish.
        They enter it at <strong>Split Watch</strong> in the main menu and go straight into live
        timing for this team, no account required.
      </p>

      <div class="sw-race-day-reveal" data-sw-race-day-reveal hidden>
        <p>Your new code -- share it now, it won't be shown again</p>
        <div class="sw-race-day-code-row">
          <code class="sw-race-day-code" data-sw-race-day-reveal-code></code>
          <button class="button button-outline" type="button" data-sw-race-day-copy>Copy</button>
        </div>
      </div>

      <div data-sw-race-day-status style="margin-top:14px;"></div>

      <div class="sw-actions" style="margin-top:14px;">
        <button class="button button-primary" type="button" data-sw-race-day-generate>Generate code</button>
        <button class="button button-outline" type="button" data-sw-race-day-revoke hidden>Turn off access</button>
      </div>
    </div>
  </dialog>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/split-watch-plan.js" defer></script>`;

  return layout({
    site,
    title: "Plan a Race | Split Watch",
    description: "Build the full-team race plan: roster, goals, and pacing strategy.",
    pathname: "/split-watch/plan/",
    content
  });
}
