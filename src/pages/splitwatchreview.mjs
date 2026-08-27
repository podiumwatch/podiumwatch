import {
  layout,
  pageHero
} from "../lib/html.mjs";

// Individual + team review, computed on demand from race_splits +
// race_targets + race_participants (never a stored snapshot -- see
// install/11_RACE_COMMAND_CENTER.sql's header comment). Full site chrome,
// matching the Plan page's structure. Language throughout is kept
// factual and non-subjective per the spec -- "behind target" and "ahead
// of target," never a value judgment.
export function splitWatchReviewPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Split Watch",
    title: "Review the race.",
    description: "How the race actually went, checkpoint by checkpoint, compared with the plan.",
    compact: true
  })}

  <style>
    /* [hidden] must always win the cascade -- see splitwatchlive.mjs
       and docs/DECISIONS.md's Live Race Mode diagnostic entry for the
       real bug this guards against (a class-based display property at
       the same specificity as the browser's [hidden] rule, applied to
       this page's own root container). */
    [hidden] { display: none !important; }

    .sw-shell, .sw-grid { display: grid; gap: 20px; }
    .sw-grid { grid-template-columns: minmax(0, 1fr); }
    .sw-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .sw-header { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .sw-header h2 { margin-bottom: 0; }
    .sw-race-switcher-label { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 700; }
    .sw-race-switcher-select { padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(15, 23, 42, 0.22); background: #ffffff; font: inherit; }
    .sw-message { padding: 14px 16px; border-radius: 10px; background: rgba(0, 191, 99, 0.1); }

    /* Rehearsal Mode (race day build plan, Project 1) -- never relies on
       color alone; the words REHEARSAL MODE are the actual signal. */
    .sw-rehearsal-review-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 16px; border-radius: 10px; background: #fff3cd; color: #664500; border: 2px solid #ffb800; font-size: 0.9rem; }

    .sw-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 16px 0; }
    .sw-stat { padding: 16px; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .sw-stat strong { display: block; font-size: 1.5rem; }
    .sw-stat span { display: block; margin-top: 6px; font-weight: 700; font-size: 0.85rem; }

    .sw-review-table-wrap { overflow-x: auto; margin-top: 10px; }
    table.sw-review-table { width: 100%; border-collapse: collapse; }
    table.sw-review-table th, table.sw-review-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(15, 23, 42, 0.1); white-space: nowrap; }
    table.sw-review-table tbody tr { cursor: pointer; }
    table.sw-review-table tbody tr:hover { background: rgba(15, 23, 42, 0.04); }

    .sw-tag { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
    .sw-tag-ahead { background: rgba(0, 191, 99, 0.18); }
    .sw-tag-on_pace { background: rgba(59, 130, 246, 0.18); }
    .sw-tag-at_risk { background: rgba(245, 158, 11, 0.2); }
    .sw-tag-missed { background: rgba(107, 114, 128, 0.18); }
    .sw-tag-dns, .sw-tag-dnf { background: rgba(220, 38, 38, 0.14); }

    .sw-individual-detail { display: none; margin-top: 20px; }
    .sw-individual-detail.sw-open { display: block; }

  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-sw-loading>
        <h2>Loading review</h2>
        <p>Please wait while Podium Watch securely loads this race.</p>
      </div>

      <div class="sw-shell" data-sw-root hidden>
        <div class="sw-header">
          <div>
            <p class="eyebrow"><span data-sw-team-name></span> &middot; Review</p>
            <h2 data-sw-race-name></h2>
            <p data-sw-race-meta></p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <a class="button button-outline" href="/split-watch/" data-sw-all-races-link>All races</a>
            <span class="sw-race-switcher-label" data-sw-race-switcher-wrap hidden>
              Switch race
              <select class="sw-race-switcher-select" data-sw-race-switcher></select>
            </span>
            <button class="button button-primary" type="button" data-sw-copy-summary>Copy team summary</button>
          </div>
        </div>

        <div class="sw-rehearsal-review-banner" data-sw-rehearsal-review-banner hidden>
          <strong>REHEARSAL MODE</strong>
          <span>This is a practice run -- it never appears in official Review or results.</span>
        </div>

        <p class="sw-message" data-sw-message aria-live="polite" hidden></p>

        <div class="sw-grid">
          <section class="sw-panel">
            <p class="eyebrow">Team review</p>
            <h2>How the team did against Goal A</h2>

            <div class="sw-stat-row" data-sw-team-stats></div>

            <div class="sw-review-table-wrap">
              <table class="sw-review-table">
                <thead>
                  <tr><th>Runner</th><th>Group</th><th>Finish</th><th>Goal A</th><th>Diff</th><th>Status</th></tr>
                </thead>
                <tbody data-sw-team-rows></tbody>
              </table>
            </div>
          </section>

          <section class="sw-panel" data-sw-individual-panel hidden>
            <div class="sw-header">
              <div>
                <p class="eyebrow">Individual review</p>
                <h2 data-sw-individual-name></h2>
              </div>
              <button class="button button-outline" type="button" data-sw-individual-close>Close</button>
            </div>

            <div class="sw-review-table-wrap">
              <table class="sw-review-table">
                <thead>
                  <tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Actual</th><th>Diff</th></tr>
                </thead>
                <tbody data-sw-individual-rows></tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/race-poll.js" defer></script>
  <script src="/scripts/split-watch-review.js" defer></script>`;

  return layout({
    site,
    title: "Race Review | Split Watch",
    description: "Individual and team review of a finished race.",
    pathname: "/split-watch/review/",
    content
  });
}
