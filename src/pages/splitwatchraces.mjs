import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The scoped landing page a race-day code lands on -- deliberately NOT
// the full coach hub (splitwatch.mjs). A race-day code today authorizes
// the same API actions a signed-in coach can call (see
// lib/race_day_auth.mjs's requireSplitWatchAccess -- both credentials
// resolve to the same { actor } shape), so this page's restriction is a
// UI/information-architecture fix, not the deeper API-layer scoping
// question, which is a separate decision (see SPLIT_WATCH_MOBILE_FIXES_
// HANDOFF.md section 3 and the accompanying report). Shows only races
// relevant to timing today -- live ones first, then scheduled -- plus
// recently finished ones so a volunteer can also check final results.
// Deliberately excludes draft races (not yet set up with participants/
// checkpoints -- nothing for a volunteer to do there) and cancelled
// ones. No create-race form, no meet setup, no delete button, no
// spectator-visibility toggle, no race-day-code management -- every one
// of those stays exclusively on splitwatch.mjs, reachable only by a
// signed-in coach.
export function splitWatchRacesPage(site) {
  const content = `${pageHero({
    eyebrow: "Split Watch",
    title: "Pick a race to time.",
    description: "Tap a race below to go straight to its live timing screen.",
    compact: true
  })}

  <style>
    .swr-shell, .swr-list { display: grid; gap: 20px; }
    .swr-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .swr-header { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .swr-header h2 { margin-bottom: 0; }
    .swr-message { padding: 14px 16px; border-radius: 10px; background: rgba(220, 38, 38, 0.12); }
    .swr-race-card { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 18px; border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 14px; }
    .swr-race-card h3 { margin: 0 0 4px; }
    .swr-race-meta { font-size: 0.85rem; opacity: 0.75; }
    .swr-badge { display: inline-flex; padding: 5px 10px; border-radius: 999px; background: rgba(0, 191, 99, 0.14); font-size: 0.76rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.03em; margin-left: 8px; }
    .swr-badge-live { background: #dc2626; color: #ffffff; }
    .swr-badge-finished, .swr-badge-reviewed { background: #111827; color: #ffffff; }
    .swr-empty { padding: 24px; text-align: center; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-swr-loading>
        <h2>Checking access</h2>
        <p>Please wait while Podium Watch securely loads this team's races.</p>
      </div>

      <div class="swr-shell" data-swr-root hidden>
        <div class="swr-panel">
          <div class="swr-header">
            <div>
              <p class="eyebrow" data-swr-team-name></p>
              <h2>Today's races</h2>
            </div>
          </div>

          <p class="swr-message" data-swr-message aria-live="polite" hidden></p>

          <div class="swr-list" data-swr-race-list style="margin-top:16px;"></div>
          <div class="swr-empty" data-swr-race-empty hidden>No races are ready for timing right now. Check back closer to race time, or ask your coach.</div>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/split-watch-races.js" defer></script>`;

  return layout({
    site,
    title: "Split Watch",
    description: "Pick a race to time -- race day access.",
    pathname: "/split-watch/races/",
    content
  });
}
