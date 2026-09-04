import {
  layout,
  pageHero
} from "../lib/html.mjs";

// Split Watch's hub: a coach's list of races (draft/live/finished)
// for one team, plus a "create a race" form that starts the Plan -> Race
// -> Review workflow. Matches the coach-tool page structure established by
// src/pages/teamroster.mjs (loading state, auth-gated shell, PodiumTeamAuth
// + a plain team_id query param -- there is no server-side "current team"
// concept anywhere in this codebase).
export function splitWatchHubPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Split Watch",
    title: "Race day, planned and run in one place.",
    description:
      "Plan full-team goals before the gun, run live timing on race day, then review how it actually went -- all without leaving Podium Watch."
  })}

  <style>
    /* [hidden] must always win the cascade -- see splitwatchlive.mjs
       and docs/DECISIONS.md's Live Race Mode diagnostic entry for the
       real bug this guards against (a class-based display property at
       the same specificity as the browser's [hidden] rule, applied to
       this page's own root container). */
    [hidden] { display: none !important; }

    .sw-shell,
    .sw-grid,
    .sw-race-list {
      display: grid;
      gap: 20px;
    }

    .sw-grid {
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }

    .sw-panel {
      padding: 24px;
      border-radius: 16px;
      background: var(--white);
      box-shadow: 0 12px 34px rgba(var(--black-rgb),0.08);
    }

    .sw-header,
    .sw-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .sw-header {
      justify-content: space-between;
    }

    .sw-header h2 {
      margin-bottom: 0;
    }

    .sw-form {
      display: grid;
      gap: 16px;
      margin-top: 18px;
    }

    .sw-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }

    .sw-form label {
      display: block;
    }

    .sw-form input,
    .sw-form select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(var(--black-rgb),0.22);
      border-radius: 9px;
      background: var(--white);
      font: inherit;
    }

    .sw-checkpoint-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 100px) minmax(0, 118px) auto;
      gap: 10px;
      align-items: end;
    }

    .sw-meet-group {
      padding: 16px;
      border-radius: 12px;
      background: rgba(var(--black-rgb),0.03);
      display: grid;
      gap: 12px;
    }

    .sw-meet-squad-row {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
    }

    .sw-meet-squad-row label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
    }

    .sw-meet-squad-row input[type="checkbox"] {
      width: auto;
      margin: 0;
    }

    .sw-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(var(--green-rgb),0.1);
    }

    .sw-race-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      border: 1px solid rgba(var(--black-rgb),0.14);
      border-radius: 14px;
      background: var(--white);
    }

    .sw-race-card h3 {
      margin: 0;
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

    .sw-badge-live {
      background: var(--live-red);
      color: var(--white);
    }

    .sw-badge-finished,
    .sw-badge-reviewed {
      background: var(--black);
      color: var(--white);
    }

    .sw-empty {
      padding: 24px;
      text-align: center;
      border-radius: 12px;
      background: rgba(var(--black-rgb),0.05);
    }

    .sw-spectator-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(var(--black-rgb),0.1);
      font-size: 0.86rem;
    }

    .sw-spectator-row label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: 700;
    }

    .sw-spectator-link {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sw-spectator-link input {
      font-size: 0.78rem;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid rgba(var(--black-rgb),0.16);
      width: 210px;
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

    @media (max-width: 840px) {
      .sw-grid,
      .sw-checkpoint-row {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-sw-loading>
        <h2>Checking access</h2>
        <p>Please wait while Podium Watch securely loads your races.</p>
      </div>

      <div class="sw-shell" data-sw-root hidden>
        <div class="sw-header">
          <div>
            <p class="eyebrow">Split Watch</p>
            <h2 data-sw-team-name></h2>
            <p data-sw-account></p>
          </div>

          <div class="sw-actions">
            <a class="button button-outline" data-sw-team-link href="/team/">View team profile</a>
            <a class="button button-outline" href="/team-dashboard/">Team dashboard</a>
          </div>
        </div>

        <p class="sw-message" data-sw-message aria-live="polite" hidden></p>

        <div class="sw-grid">
          <section class="sw-panel" data-sw-meet-panel>
            <p class="eyebrow">New meet</p>
            <h2>Set up a whole meet at once</h2>
            <p>
              Create HS and JH, boys and girls races together from one meet name -- each race is pre-filled
              with that squad's current roster automatically, so you don't have to add runners four times.
            </p>

            <div class="sw-empty" data-sw-meet-empty hidden>
              No current-season roster found to build races from.
              <a data-sw-meet-roster-link href="/team-roster/">Build your roster</a> first, then come back here.
            </div>

            <form class="sw-form" data-sw-meet-form>
              <label>
                <strong>Meet name</strong>
                <input type="text" name="meet_name" placeholder="Conference Championship" required>
              </label>

              <div class="sw-fields">
                <label>
                  <strong>Meet date</strong>
                  <input type="date" name="meet_date" required>
                </label>
                <label>
                  <strong>Sport</strong>
                  <select name="meet_sport" data-sw-meet-sport>
                    <option value="cross_country">Cross Country</option>
                    <option value="track">Track</option>
                  </select>
                </label>
              </div>

              <div class="sw-meet-group" data-sw-meet-group="hs">
                <strong>High School</strong>
                <div class="sw-meet-squad-row">
                  <label><input type="checkbox" data-sw-meet-squad="hs_boys" checked> HS Boys</label>
                  <label><input type="checkbox" data-sw-meet-squad="hs_girls" checked> HS Girls</label>
                </div>
                <div class="sw-fields">
                  <label>
                    <strong>Distance</strong>
                    <input type="number" step="0.01" min="0.01" placeholder="5" data-sw-meet-distance="hs">
                  </label>
                  <label>
                    <strong>Unit</strong>
                    <select data-sw-meet-unit="hs">
                      <option value="miles">Miles</option>
                      <option value="km">Kilometers</option>
                      <option value="meters">Meters</option>
                    </select>
                  </label>
                </div>
                <div>
                  <strong>Checkpoints</strong>
                  <p style="margin:6px 0 12px;font-size:0.85rem;">
                    Shared by both HS races -- each checkpoint has its own unit, so a 5K can still use mile
                    markers. A finish checkpoint is added automatically at the full distance.
                  </p>
                  <div data-sw-meet-checkpoint-rows="hs" style="display:grid;gap:10px;"></div>
                  <button class="button button-outline" type="button" data-sw-meet-add-checkpoint="hs" style="margin-top:10px;">Add checkpoint</button>
                </div>
              </div>

              <div class="sw-meet-group" data-sw-meet-group="jh">
                <strong>Junior High</strong>
                <div class="sw-meet-squad-row">
                  <label><input type="checkbox" data-sw-meet-squad="jh_boys" checked> JH Boys</label>
                  <label><input type="checkbox" data-sw-meet-squad="jh_girls" checked> JH Girls</label>
                </div>
                <div class="sw-fields">
                  <label>
                    <strong>Distance</strong>
                    <input type="number" step="0.01" min="0.01" placeholder="2" data-sw-meet-distance="jh">
                  </label>
                  <label>
                    <strong>Unit</strong>
                    <select data-sw-meet-unit="jh">
                      <option value="miles">Miles</option>
                      <option value="km">Kilometers</option>
                      <option value="meters">Meters</option>
                    </select>
                  </label>
                </div>
                <div>
                  <strong>Checkpoints</strong>
                  <p style="margin:6px 0 12px;font-size:0.85rem;">
                    Shared by both JH races -- each checkpoint has its own unit, so a 5K can still use mile
                    markers. A finish checkpoint is added automatically at the full distance.
                  </p>
                  <div data-sw-meet-checkpoint-rows="jh" style="display:grid;gap:10px;"></div>
                  <button class="button button-outline" type="button" data-sw-meet-add-checkpoint="jh" style="margin-top:10px;">Add checkpoint</button>
                </div>
              </div>

              <button class="button button-primary" type="submit">Create races for this meet</button>
            </form>
          </section>

          <section class="sw-panel">
            <div class="sw-header">
              <div>
                <p class="eyebrow">Your races</p>
                <h2>Draft, live, and finished races</h2>
              </div>
              <button class="button button-outline" type="button" data-sw-toggle-archived>View archived races</button>
            </div>

            <div class="sw-race-list" data-sw-race-list style="margin-top:16px;"></div>
            <div class="sw-empty" data-sw-race-empty hidden>No races yet. Create your first race to start planning.</div>

            <div data-sw-archived-panel hidden style="margin-top:24px;border-top:1px solid rgba(15,23,42,0.12);padding-top:20px;">
              <p class="eyebrow">Archived</p>
              <p style="opacity:0.75;margin:4px 0 14px;">Archived races are hidden from the race switcher and Team Home, but every recorded time stays exactly as it was. Unarchive one to bring it back into your working list.</p>
              <div class="sw-race-list" data-sw-archived-list></div>
              <div class="sw-empty" data-sw-archived-empty hidden>No archived races.</div>
            </div>
          </section>
        </div>

        <section class="sw-panel" style="margin-top:24px;">
          <p class="eyebrow">One-off race</p>
          <h2>Create a single race</h2>
          <p>
            Need something outside the standard HS/JH, boys/girls setup -- a combined race, an alumni run,
            a fun run? Build one race at a time here instead.
          </p>

          <form class="sw-form" data-sw-create-form>
            <label>
              <strong>Race name</strong>
              <input type="text" name="name" placeholder="Conference Championship" required>
            </label>

            <div class="sw-fields">
              <label>
                <strong>Race date</strong>
                <input type="date" name="race_date" required>
              </label>

              <label>
                <strong>Sport</strong>
                <select name="sport">
                  <option value="cross_country">Cross Country</option>
                  <option value="track">Track</option>
                </select>
              </label>

              <label>
                <strong>Distance</strong>
                <input type="number" name="distance_value" step="0.01" min="0.01" placeholder="5" required>
              </label>

              <label>
                <strong>Distance unit</strong>
                <select name="distance_unit_display">
                  <option value="miles">Miles</option>
                  <option value="km">Kilometers</option>
                  <option value="meters">Meters</option>
                </select>
              </label>
            </div>

            <div>
              <strong>Checkpoints</strong>
              <p style="margin:6px 0 12px;font-size:0.9rem;">
                Add split points along the course. Each checkpoint has its own distance unit, so a 5K race can
                still use mile markers -- label one "Mile 1" and set its unit to Miles even if the race itself
                is set in kilometers. A finish checkpoint is added automatically at the full race distance.
              </p>
              <div data-sw-checkpoint-rows style="display:grid;gap:10px;"></div>
              <button class="button button-outline" type="button" data-sw-add-checkpoint style="margin-top:10px;">Add checkpoint</button>
            </div>

            <button class="button button-primary" type="submit">Create race and plan it</button>
          </form>
        </section>

        <section class="sw-panel" data-sw-race-day-section hidden>
          <div class="sw-header">
            <div>
              <p class="eyebrow">Race day access</p>
              <h2>Get timing helpers connected</h2>
            </div>
          </div>
          <p style="margin-top:6px;max-width:640px;">
            Share this 4-digit code with anyone actually recording splits for you -- a coach at mile one, a
            volunteer at the finish. They enter it at <strong>Split Watch</strong> and go straight into today's
            race, no account required. For parents and fans who just want to watch, use Copy Parent Live Link
            on the race's Plan page instead -- that's a read-only view, this code is not.
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
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/split-watch-hub.js" defer></script>`;

  return layout({
    site,
    title: "Split Watch",
    description: "Plan, run, and review a race for your team -- Podium Watch's coach timing tool.",
    pathname: "/split-watch/",
    content
  });
}
