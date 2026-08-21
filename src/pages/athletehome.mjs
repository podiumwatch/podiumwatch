import {
  layout,
  pageHero
} from "../lib/html.mjs";

// An athlete's own view of their race plans and results -- deliberately
// no required ?id= query param, unlike every coach tool. An athlete's
// identity drives this page, not a team selection: it shows every race
// across every team_athletes row their account is actively linked to
// (see lib/athlete_access_service.mjs's getAthleteRaces()). Never shows
// race_coach_notes -- no visibility mechanism exists for that yet.
export function athleteHomePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Athlete Access",
    title: "My races.",
    description: "Your own race plans and results.",
    compact: true
  })}

  <style>
    .ah-shell, .ah-list { display: grid; gap: 20px; }
    .ah-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .ah-header, .ah-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .ah-header { justify-content: space-between; }
    .ah-header h2 { margin-bottom: 0; }
    .ah-message { padding: 14px 16px; border-radius: 10px; background: rgba(220, 38, 38, 0.12); }
    .ah-race-card { padding: 18px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 14px; }
    .ah-race-card h3 { margin: 0 0 4px; }
    .ah-race-meta { font-size: 0.85rem; opacity: 0.75; margin-bottom: 12px; }
    .ah-goal-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
    .ah-badge { display: inline-flex; padding: 5px 10px; border-radius: 999px; background: rgba(0, 191, 99, 0.14); font-size: 0.8rem; font-weight: 800; }
    table.ah-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.ah-table th, table.ah-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(15, 23, 42, 0.1); font-size: 0.92rem; }
    .ah-tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; }
    .ah-tag-ahead { background: rgba(0, 191, 99, 0.18); }
    .ah-tag-on_pace { background: rgba(59, 130, 246, 0.18); }
    .ah-tag-at_risk, .ah-tag-missed { background: rgba(107, 114, 128, 0.18); }
    .ah-empty { padding: 24px; text-align: center; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .ah-goals-athlete { padding: 16px; border-radius: 12px; background: rgba(15, 23, 42, 0.03); }
    .ah-goals-athlete + .ah-goals-athlete { margin-top: 14px; }
    .ah-goals-athlete h3 { margin: 0 0 10px; font-size: 1rem; }
    .ah-goals-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; }
    .ah-goals-fields label { display: block; font-size: 0.85rem; font-weight: 700; }
    .ah-goals-fields input { display: block; width: 100%; margin-top: 6px; padding: 10px; border-radius: 8px; border: 1px solid rgba(15, 23, 42, 0.22); font: inherit; }
    @media (max-width: 720px) {
      table.ah-table { display: block; overflow-x: auto; }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-ah-loading>
        <h2>Loading your races</h2>
        <p>Please wait while Podium Watch securely loads your account.</p>
      </div>

      <div class="ah-shell" data-ah-root hidden>
        <div class="ah-header">
          <div>
            <p class="eyebrow" data-ah-account></p>
            <p data-ah-teams></p>
          </div>
          <button class="button button-outline" type="button" data-ah-signout>Sign out</button>
        </div>

        <p class="ah-message" data-ah-message hidden></p>

        <section class="ah-panel" data-ah-goals-section hidden>
          <p class="eyebrow">Goal book</p>
          <h2>My goals</h2>
          <p style="font-size:0.85rem;opacity:0.8;margin:4px 0 14px;">
            One goal per distance -- set it once here, and it's used automatically whenever your coach
            adds you to a race at that distance.
          </p>
          <div data-ah-goals-athletes></div>
        </section>

        <section class="ah-panel">
          <p class="eyebrow">Upcoming</p>
          <h2>Your next races</h2>
          <div class="ah-list" data-ah-upcoming-list style="margin-top:14px;"></div>
          <div class="ah-empty" data-ah-upcoming-empty hidden>No upcoming races yet.</div>
        </section>

        <section class="ah-panel">
          <p class="eyebrow">Results</p>
          <h2>Your past races</h2>
          <div class="ah-list" data-ah-past-list style="margin-top:14px;"></div>
          <div class="ah-empty" data-ah-past-empty hidden>No finished races yet.</div>
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/athlete-home.js" defer></script>`;

  return layout({
    site,
    title: "My Races",
    description: "An athlete's own Podium Watch race plans and results.",
    pathname: "/athlete-home/",
    content
  });
}
