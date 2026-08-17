import {
  layout,
  pageHero
} from "../lib/html.mjs";

// A guardian's own view of their linked athlete(s)' race plans and
// results -- mirrors src/pages/athletehome.mjs structurally (same CSS
// class names, same upcoming/past layout). The real difference: a
// guardian can be linked to more than one athlete (siblings), so every
// race card is labeled with which athlete it belongs to, and a race the
// coach has made spectator_visible links out to the full public
// leaderboard at /race/?race=<id> rather than duplicating that table
// here. See lib/guardian_access_service.mjs's getGuardianRaces().
export function guardianHomePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Guardian Access",
    title: "Your athlete's races.",
    description: "Race plans and results, shared by the coach.",
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
    .ah-athlete-tag { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #111827; color: #ffffff; font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 8px; }
    .ah-watch-live { display: inline-block; margin-top: 10px; }
    @media (max-width: 720px) {
      table.ah-table { display: block; overflow-x: auto; }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-gh-loading>
        <h2>Loading your athlete's races</h2>
        <p>Please wait while Podium Watch securely loads your account.</p>
      </div>

      <div class="ah-shell" data-gh-root hidden>
        <div class="ah-header">
          <div>
            <p class="eyebrow" data-gh-account></p>
            <p data-gh-athletes></p>
          </div>
          <button class="button button-outline" type="button" data-gh-signout>Sign out</button>
        </div>

        <p class="ah-message" data-gh-message hidden></p>

        <section class="ah-panel">
          <p class="eyebrow">Upcoming</p>
          <h2>Next races</h2>
          <div class="ah-list" data-gh-upcoming-list style="margin-top:14px;"></div>
          <div class="ah-empty" data-gh-upcoming-empty hidden>No upcoming races yet.</div>
        </section>

        <section class="ah-panel">
          <p class="eyebrow">Results</p>
          <h2>Past races</h2>
          <div class="ah-list" data-gh-past-list style="margin-top:14px;"></div>
          <div class="ah-empty" data-gh-past-empty hidden>No finished races yet.</div>
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/guardian-home.js" defer></script>`;

  return layout({
    site,
    title: "Guardian Home",
    description: "A guardian's own view of their athlete's Podium Watch race plans and results.",
    pathname: "/guardian-home/",
    content
  });
}
