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
      /* Grid items default to min-width:auto, so a wide nowrap descendant
         (the bulk-goals table below, in particular) can stretch this grid
         wider than the viewport on mobile even though that table has its
         own overflow-x:auto scroller. min-width:0 lets the scroller do its
         job instead of the grid track absorbing the overflow. Confirmed as
         a real horizontal-overflow bug during Rehearsal Mode's mobile
         testing (pre-existing, unrelated to rehearsal itself). */
      min-width: 0;
    }

    .sw-panel {
      padding: 24px;
      border-radius: 16px;
      background: var(--white);
      box-shadow: 0 12px 34px rgba(var(--black-rgb),0.08);
      min-width: 0;
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
      border: 1px solid rgba(var(--black-rgb),0.22);
      background: var(--white);
      font: inherit;
    }

    .sw-bulk-goals {
      margin: 16px 0 22px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(var(--black-rgb),0.03);
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
      border-bottom: 1px solid rgba(var(--black-rgb),0.1);
      white-space: nowrap;
    }

    table.sw-bulk-goals-table input[type="text"] {
      width: 90px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(var(--black-rgb),0.22);
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
      border: 1px solid rgba(var(--black-rgb),0.22);
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
      background: rgba(var(--green-rgb),0.1);
    }

    .sw-badge {
      display: inline-flex;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(var(--green-rgb),0.14);
      font-size: 0.76rem;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sw-badge-live { background: var(--live-red); color: var(--white); }
    .sw-badge-finished, .sw-badge-reviewed { background: var(--black); color: var(--white); }

    .sw-checkpoint-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .sw-checkpoint-chip {
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(var(--black-rgb),0.06);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .sw-crew-list {
      display: grid;
      gap: 10px;
    }

    .sw-crew-card {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(var(--black-rgb),0.14);
      border-radius: 12px;
    }

    .sw-crew-card-label {
      font-weight: 800;
    }

    .sw-crew-card-meta {
      font-size: 0.85rem;
      opacity: 0.75;
      margin-top: 2px;
    }

    .sw-crew-helper-name {
      font-weight: 700;
    }

    .sw-crew-presence {
      font-size: 0.78rem;
      opacity: 0.7;
    }

    .sw-crew-open {
      font-size: 0.85rem;
      opacity: 0.65;
      font-style: italic;
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
      border: 1px solid rgba(var(--black-rgb),0.12);
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
      border: 1px solid rgba(var(--black-rgb),0.22);
      border-radius: 9px;
      font: inherit;
    }

    .sw-bulk-panel {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid rgba(var(--black-rgb),0.14);
      border-radius: 10px;
      background: rgba(var(--black-rgb),0.03);
    }

    .sw-bulk-panel textarea {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid rgba(var(--black-rgb),0.22);
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
      border: 1px solid rgba(var(--black-rgb),0.14);
      border-radius: 14px;
      background: var(--white);
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
      border-top: 1px solid rgba(var(--black-rgb),0.1);
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
      border: 1px solid rgba(var(--black-rgb),0.22);
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
      background: rgba(var(--black-rgb),0.05);
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
      max-height: calc(100dvh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.35);
    }

    dialog.sw-race-day-dialog::backdrop {
      background: rgba(var(--black-rgb),0.72);
    }

    .sw-race-day-dialog-body {
      padding: 26px;
    }

    .sw-race-day-reveal {
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(var(--green-rgb),0.12);
      border: 1px solid rgba(var(--green-rgb),0.35);
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

        <section class="sw-panel sw-panel-full" data-sw-rehearsal-panel style="margin-bottom:20px;" hidden>
          <p class="eyebrow">Practice safely</p>
          <h2>Rehearsal</h2>
          <p>
            Practice the complete timing flow -- starting the clock, recording splits, inviting helpers -- using
            this race's real roster and goals. Rehearsal clocks and captures never affect the official race,
            parent page, Review, or athlete history.
          </p>

          <div data-sw-rehearsal-status style="margin:14px 0;font-size:0.9rem;opacity:0.85;"></div>

          <div class="sw-actions">
            <button class="button button-primary" type="button" data-sw-rehearsal-enter>Practice This Race</button>
          </div>

          <!-- Rehearsal Mode gap fix (2026-08-27): a rehearsal never
               appears in the smart routing a helper's race-day code
               normally uses (by design -- it's practice data, never
               shown as if it were today's real race), so there was
               previously no way at all for a coach's actual helpers to
               land on the SAME rehearsal the coach is running. This
               direct link is the fix -- share it with helpers exactly
               like the parent live link below, except this one lands
               helpers straight on this specific rehearsal. -->
          <div data-sw-rehearsal-share-row style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--black-rgb),0.12);" hidden>
            <p style="margin:0 0 8px;font-size:0.85rem;opacity:0.8;">
              Practicing with helpers? A race-day code alone won't find this rehearsal -- send them this link instead.
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
              <input type="text" readonly data-sw-rehearsal-share-link style="flex:1 1 280px;min-width:0;padding:10px 12px;border-radius:8px;border:1px solid rgba(var(--black-rgb),0.22);font:inherit;">
              <button class="button button-outline" type="button" data-sw-rehearsal-share-copy>Copy link</button>
            </div>
          </div>
        </section>

        <section class="sw-panel sw-panel-full" style="margin-bottom:20px;">
          <p class="eyebrow">Parent &amp; fan sharing</p>
          <h2>Parent live link</h2>
          <p>
            One link, the whole day -- share it the night before or the morning of. It shows an upcoming/waiting
            screen before the race starts, switches to live times automatically the moment you start timing, and
            shows final results once the race is finished. It never shows goals, private notes, or coach cues --
            only what's public here.
          </p>

          <label style="display:flex;align-items:center;gap:10px;font-weight:800;margin-top:14px;cursor:pointer;">
            <input type="checkbox" data-sw-spectator-toggle style="width:auto;">
            Turn on the parent live link for this race
          </label>

          <div data-sw-spectator-link-row style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px;" hidden>
            <input type="text" data-sw-spectator-link readonly style="flex:1 1 320px;min-width:0;padding:10px 12px;border-radius:8px;border:1px solid rgba(var(--black-rgb),0.22);font:inherit;">
            <button class="button button-primary" type="button" data-sw-copy-parent-link>Copy parent live link</button>
          </div>

          <label style="display:block;margin-top:18px;font-weight:800;max-width:320px;">
            Scheduled race time (optional)
            <input type="time" data-sw-scheduled-start-input style="display:block;width:100%;margin-top:8px;padding:10px;border:1px solid rgba(var(--black-rgb),0.22);border-radius:8px;font:inherit;">
          </label>
          <p style="margin-top:6px;font-size:0.85rem;opacity:0.75;max-width:480px;">Shown to parents on the waiting screen before you start timing, alongside this race's own date (<span data-sw-scheduled-start-date></span>). Leave blank if you'd rather not display a time.</p>
        </section>

        <div class="sw-checkpoint-strip" data-sw-checkpoint-strip></div>

        <section class="sw-panel sw-panel-full" style="margin-top:20px;">
          <p class="eyebrow">Timing crew</p>
          <h2>Positions &amp; volunteers</h2>
          <p style="opacity:0.8;">
            Set up a position for each checkpoint (Mile 1, Finish, Pack Capture) so a volunteer only ever needs to
            worry about their own spot. This is optional -- if you never set any up, every volunteer who enters your
            race day code can record any checkpoint, exactly like before.
          </p>

          <div class="sw-crew-list" data-sw-crew-list style="margin-top:14px;"></div>
          <div class="sw-empty" data-sw-crew-empty hidden>No positions set up yet -- every volunteer can record any checkpoint until you add one.</div>

          <form class="sw-crew-add-form" data-sw-crew-add-form style="margin-top:18px;border-top:1px solid rgba(var(--black-rgb),0.12);padding-top:16px;">
            <h3 style="margin:0 0 10px;">Add a position</h3>
            <div class="sw-fields">
              <label>
                Label
                <input type="text" name="label" placeholder="Mile 1" required>
              </label>
              <label>
                Capability
                <select name="capability" data-sw-crew-capability-select>
                  <option value="checkpoint">Checkpoint tap</option>
                  <option value="pack_capture">Pack Capture</option>
                  <option value="backup">Backup timer (any checkpoint)</option>
                </select>
              </label>
              <label data-sw-crew-checkpoint-field>
                Checkpoint
                <select name="checkpoint_id" data-sw-crew-checkpoint-select></select>
              </label>
              <label>
                Instructions (optional)
                <input type="text" name="instructions" placeholder="e.g. Stand at the mailbox, not the tree">
              </label>
            </div>
            <p class="sw-message" data-sw-crew-message hidden style="margin-top:10px;"></p>
            <button class="button button-primary" type="submit" style="margin-top:12px;">Add position</button>
          </form>
        </section>

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
        Share this 4-digit code with anyone actually recording splits for you -- a coach at mile one, a volunteer
        at the finish. They enter it at <strong>Split Watch</strong> and go straight into today's race, no account
        required. For parents and fans who just want to watch, use Copy Parent Live Link above instead -- that's
        a read-only view, this code is not.
      </p>

      <div class="sw-race-day-reveal" data-sw-race-day-reveal hidden>
        <p>Your team's race day code -- give it to anyone timing today. It stays here until you regenerate or turn off access.</p>
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

  <dialog class="sw-race-day-dialog" data-sw-rehearsal-intro-dialog>
    <div class="sw-race-day-dialog-body">
      <div class="sw-header">
        <div>
          <p class="eyebrow">Before you start</p>
          <h2>Practice safely</h2>
        </div>
        <button class="button button-outline" type="button" data-sw-rehearsal-intro-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        Practice the complete timing flow safely. Rehearsal clocks and captures never affect the official race,
        parent page, Review, or athlete history.
      </p>

      <div class="sw-actions" style="margin-top:14px;">
        <button class="button button-primary" type="button" data-sw-rehearsal-intro-confirm>Enter Rehearsal</button>
        <button class="button button-outline" type="button" data-sw-rehearsal-intro-cancel>Cancel</button>
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
