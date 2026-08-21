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
export function raceCommandCenterReviewPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Race Command Center",
    title: "Review the race.",
    description: "How the race actually went, checkpoint by checkpoint, compared with the plan.",
    compact: true
  })}

  <style>
    /* [hidden] must always win the cascade -- see racecommandcenterlive.mjs
       and docs/DECISIONS.md's Live Race Mode diagnostic entry for the
       real bug this guards against (a class-based display property at
       the same specificity as the browser's [hidden] rule, applied to
       this page's own root container). */
    [hidden] { display: none !important; }

    .rcc-shell, .rcc-grid { display: grid; gap: 20px; }
    .rcc-grid { grid-template-columns: minmax(0, 1fr); }
    .rcc-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); }
    .rcc-header { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .rcc-header h2 { margin-bottom: 0; }
    .rcc-race-switcher-label { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 700; }
    .rcc-race-switcher-select { padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(15, 23, 42, 0.22); background: #ffffff; font: inherit; }
    .rcc-message { padding: 14px 16px; border-radius: 10px; background: rgba(0, 191, 99, 0.1); }

    .rcc-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 16px 0; }
    .rcc-stat { padding: 16px; border-radius: 12px; background: rgba(15, 23, 42, 0.05); }
    .rcc-stat strong { display: block; font-size: 1.5rem; }
    .rcc-stat span { display: block; margin-top: 6px; font-weight: 700; font-size: 0.85rem; }

    .rcc-review-table-wrap { overflow-x: auto; margin-top: 10px; }
    table.rcc-review-table { width: 100%; border-collapse: collapse; }
    table.rcc-review-table th, table.rcc-review-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(15, 23, 42, 0.1); white-space: nowrap; }
    table.rcc-review-table tbody tr { cursor: pointer; }
    table.rcc-review-table tbody tr:hover { background: rgba(15, 23, 42, 0.04); }

    .rcc-tag { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
    .rcc-tag-ahead { background: rgba(0, 191, 99, 0.18); }
    .rcc-tag-on_pace { background: rgba(59, 130, 246, 0.18); }
    .rcc-tag-at_risk { background: rgba(245, 158, 11, 0.2); }
    .rcc-tag-missed { background: rgba(107, 114, 128, 0.18); }
    .rcc-tag-dns, .rcc-tag-dnf { background: rgba(220, 38, 38, 0.14); }

    .rcc-individual-detail { display: none; margin-top: 20px; }
    .rcc-individual-detail.rcc-open { display: block; }

  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-rcc-loading>
        <h2>Loading review</h2>
        <p>Please wait while Podium Watch securely loads this race.</p>
      </div>

      <div class="rcc-shell" data-rcc-root hidden>
        <div class="rcc-header">
          <div>
            <p class="eyebrow"><span data-rcc-team-name></span> &middot; Review</p>
            <h2 data-rcc-race-name></h2>
            <p data-rcc-race-meta></p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <a class="button button-outline" href="/race-command-center/" data-rcc-all-races-link>All races</a>
            <span class="rcc-race-switcher-label" data-rcc-race-switcher-wrap hidden>
              Switch race
              <select class="rcc-race-switcher-select" data-rcc-race-switcher></select>
            </span>
            <button class="button button-primary" type="button" data-rcc-copy-summary>Copy team summary</button>
          </div>
        </div>

        <p class="rcc-message" data-rcc-message aria-live="polite" hidden></p>

        <div class="rcc-grid">
          <section class="rcc-panel">
            <p class="eyebrow">Team review</p>
            <h2>How the team did against Goal A</h2>

            <div class="rcc-stat-row" data-rcc-team-stats></div>

            <div class="rcc-review-table-wrap">
              <table class="rcc-review-table">
                <thead>
                  <tr><th>Runner</th><th>Group</th><th>Finish</th><th>Goal A</th><th>Diff</th><th>Status</th></tr>
                </thead>
                <tbody data-rcc-team-rows></tbody>
              </table>
            </div>
          </section>

          <section class="rcc-panel" data-rcc-individual-panel hidden>
            <div class="rcc-header">
              <div>
                <p class="eyebrow">Individual review</p>
                <h2 data-rcc-individual-name></h2>
              </div>
              <button class="button button-outline" type="button" data-rcc-individual-close>Close</button>
            </div>

            <div class="rcc-review-table-wrap">
              <table class="rcc-review-table">
                <thead>
                  <tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Actual</th><th>Diff</th></tr>
                </thead>
                <tbody data-rcc-individual-rows></tbody>
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
  <script src="/scripts/race-command-center-review.js" defer></script>`;

  return layout({
    site,
    title: "Race Review | Race Command Center",
    description: "Individual and team review of a finished race.",
    pathname: "/race-command-center/review/",
    content
  });
}
