import {
  layout,
  pageHero
} from "../lib/html.mjs";

// Race Command Center's hub: a coach's list of races (draft/live/finished)
// for one team, plus a "create a race" form that starts the Plan -> Race
// -> Review workflow. Matches the coach-tool page structure established by
// src/pages/teamroster.mjs (loading state, auth-gated shell, PodiumTeamAuth
// + a plain team_id query param -- there is no server-side "current team"
// concept anywhere in this codebase).
export function raceCommandCenterHubPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Race Command Center",
    title: "Race day, planned and run in one place.",
    description:
      "Plan full-team goals before the gun, run live timing on race day, then review how it actually went -- all without leaving Podium Watch."
  })}

  <style>
    .rcc-shell,
    .rcc-grid,
    .rcc-race-list {
      display: grid;
      gap: 20px;
    }

    .rcc-grid {
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }

    .rcc-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .rcc-header,
    .rcc-actions {
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

    .rcc-form {
      display: grid;
      gap: 16px;
      margin-top: 18px;
    }

    .rcc-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }

    .rcc-form label {
      display: block;
    }

    .rcc-form input,
    .rcc-form select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .rcc-checkpoint-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 120px) auto;
      gap: 10px;
      align-items: end;
    }

    .rcc-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .rcc-race-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .rcc-race-card h3 {
      margin: 0;
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

    .rcc-badge-live {
      background: #dc2626;
      color: #ffffff;
    }

    .rcc-badge-finished,
    .rcc-badge-reviewed {
      background: #111827;
      color: #ffffff;
    }

    .rcc-empty {
      padding: 24px;
      text-align: center;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    @media (max-width: 840px) {
      .rcc-grid,
      .rcc-checkpoint-row {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-rcc-loading>
        <h2>Checking access</h2>
        <p>Please wait while Podium Watch securely loads your races.</p>
      </div>

      <div class="rcc-shell" data-rcc-root hidden>
        <div class="rcc-header">
          <div>
            <p class="eyebrow">Race Command Center</p>
            <h2 data-rcc-team-name></h2>
            <p data-rcc-account></p>
          </div>

          <div class="rcc-actions">
            <a class="button button-outline" data-rcc-team-link href="/team/">View team profile</a>
            <a class="button button-outline" href="/team-dashboard/">Team dashboard</a>
          </div>
        </div>

        <p class="rcc-message" data-rcc-message aria-live="polite" hidden></p>

        <div class="rcc-grid">
          <section class="rcc-panel">
            <div class="rcc-header">
              <div>
                <p class="eyebrow">Your races</p>
                <h2>Draft, live, and finished races</h2>
              </div>
            </div>

            <div class="rcc-race-list" data-rcc-race-list style="margin-top:16px;"></div>
            <div class="rcc-empty" data-rcc-race-empty hidden>No races yet. Create your first race to start planning.</div>
          </section>

          <section class="rcc-panel">
            <p class="eyebrow">New race</p>
            <h2>Create a race</h2>
            <p>Set the distance and checkpoints now -- you'll build the full team plan on the next screen.</p>

            <form class="rcc-form" data-rcc-create-form>
              <label>
                <strong>Race name</strong>
                <input type="text" name="name" placeholder="Conference Championship" required>
              </label>

              <div class="rcc-fields">
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
                  Add split points along the course. A finish checkpoint is added automatically at the full race distance.
                </p>
                <div data-rcc-checkpoint-rows style="display:grid;gap:10px;"></div>
                <button class="button button-outline" type="button" data-rcc-add-checkpoint style="margin-top:10px;">Add checkpoint</button>
              </div>

              <button class="button button-primary" type="submit">Create race and plan it</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/race-command-center-hub.js" defer></script>`;

  return layout({
    site,
    title: "Race Command Center",
    description: "Plan, run, and review a race for your team -- Podium Watch's coach timing tool.",
    pathname: "/race-command-center/",
    content
  });
}
