import { layout, pageHero } from "../lib/html.mjs";
import { toolsCrosslink } from "../lib/tools.mjs";

// Phase 1 of docs/FEATURE_ROADMAP.md: "Dual/invitational scoring
// calculator -- finish order in, team score out." The only remaining
// Phase 1 tool that doesn't need a formula or reference-data decision
// from the user first (training pace, equivalent performance, and the
// recruiting standards checker all do) -- standard NFHS cross country
// team scoring is a fixed, well-defined rule set, not something to
// invent. Entirely client-side, no API call, no database: teams and the
// finish order live only in this page's own in-memory state, gone on
// reload by design (this is a live-meet scratchpad, not a saved record).
// The scoring math itself lives in public/scripts/meet-scoring.js
// (window.PodiumMeetScoring) as its own reusable, independently-tested
// utility, matching the pace-splits.js pattern -- see
// scripts/test-scoring-calculator.mjs.
export function scoringCalculatorPage(site) {
  const pathname = "/scoring-calculator/";

  const content = `${pageHero({
    eyebrow: "Podium Watch Tools",
    title: "Meet scoring calculator.",
    description: "Score a dual or invitational cross country meet live. Add teams, tap off finishers in order as they cross the line, and see team scores update instantly -- no spreadsheet required."
  })}

  <style>
    .scoring-tool { display: grid; gap: 28px; max-width: 760px; }

    .scoring-field-label {
      margin: 0 0 8px; font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.78rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted);
    }
    .scoring-hint { margin: 0 0 12px; color: var(--muted); font-size: 0.88rem; }

    .scoring-team-add { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .scoring-team-add input[type="text"] {
      flex: 1 1 200px; min-height: 44px; padding: 10px 14px; border: 2px solid var(--ink);
      background: var(--white); font: inherit; font-weight: 700;
    }
    .scoring-team-add button {
      min-height: 44px; padding: 10px 20px; border: 2px solid var(--black); background: var(--green);
      color: var(--black); font: inherit; font-weight: 700; cursor: pointer;
    }

    .scoring-team-chips, .scoring-finish-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .scoring-team-chip {
      display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 8px 6px 14px;
      border: 2px solid var(--line); background: var(--white); font-weight: 700; font-size: 0.88rem;
    }
    .scoring-team-chip-swatch { width: 12px; height: 12px; border-radius: 50%; flex: none; }
    .scoring-team-chip button {
      min-height: 28px; min-width: 28px; border: none; background: transparent; color: var(--muted);
      font: inherit; font-weight: 700; cursor: pointer; line-height: 1;
    }
    .scoring-team-chip button:hover { color: var(--black); }

    .scoring-finish-button {
      display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 18px;
      border: 2px solid var(--ink); background: var(--white); color: var(--ink); font: inherit;
      font-weight: 700; cursor: pointer;
    }
    .scoring-finish-button:hover { background: var(--paper); }
    .scoring-finish-button .scoring-team-chip-swatch { width: 14px; height: 14px; }
    .scoring-finish-button-unattached { border-style: dashed; color: var(--muted); }

    .scoring-finish-order-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
    .scoring-finish-order-actions { display: flex; gap: 8px; }
    .scoring-finish-order-actions button {
      min-height: 36px; padding: 6px 14px; border: 1px solid var(--line); background: var(--white);
      color: var(--muted); font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer;
    }
    .scoring-finish-order-actions button:hover { border-color: var(--ink); color: var(--ink); }

    .scoring-finish-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; max-height: 320px; overflow-y: auto; }
    .scoring-finish-row {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--white);
      border: 1px solid var(--line); font-size: 0.9rem;
    }
    .scoring-finish-row-place { font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; min-width: 30px; color: var(--muted); }
    .scoring-finish-row-team { flex: 1; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .scoring-finish-row button {
      min-height: 28px; min-width: 28px; border: none; background: transparent; color: var(--muted);
      font: inherit; font-weight: 700; cursor: pointer;
    }
    .scoring-finish-row button:hover { color: #b3271e; }

    .scoring-results { display: grid; gap: 18px; }
    .scoring-standings { width: 100%; border-collapse: collapse; background: var(--white); }
    .scoring-standings th {
      text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted);
      padding: 8px 10px; border-bottom: 2px solid var(--black);
    }
    .scoring-standings td { padding: 9px 10px; font-size: 0.92rem; font-weight: 700; border-bottom: 1px solid var(--line); }
    .scoring-standings th:nth-child(2), .scoring-standings td:nth-child(2) { text-align: right; }
    .scoring-standings tr:first-child td { color: var(--green-dark); }
    .scoring-standings-team { display: flex; align-items: center; gap: 8px; }
    .scoring-standings-detail { display: block; margin-top: 2px; font-size: 0.76rem; font-weight: 400; color: var(--muted); }

    .scoring-incomplete { background: var(--paper); border: 1px solid var(--line); padding: 14px 16px; font-size: 0.86rem; color: var(--muted); }
    .scoring-incomplete strong { color: var(--ink); }
  </style>

  <section class="section section-paper"><div class="container scoring-tool" data-scoring-calculator>
    ${toolsCrosslink(pathname)}

    <div>
      <p class="scoring-field-label">Teams</p>
      <div class="scoring-team-add">
        <input type="text" maxlength="40" placeholder="Team name" data-scoring-team-name-input aria-label="Team name">
        <button type="button" data-scoring-add-team>Add team</button>
      </div>
      <div class="scoring-team-chips" data-scoring-team-list></div>
    </div>

    <div>
      <p class="scoring-field-label">Record finish order</p>
      <p class="scoring-hint">Tap the team of each finisher, in the order they crossed the line. Use "No team" for an unattached runner -- they still take up a place.</p>
      <div class="scoring-finish-buttons" data-scoring-finish-buttons></div>

      <div class="scoring-finish-order-header">
        <p class="scoring-field-label" style="margin:0;">Finish order</p>
        <div class="scoring-finish-order-actions">
          <button type="button" data-scoring-undo>Undo last</button>
          <button type="button" data-scoring-clear-order>Clear order</button>
        </div>
      </div>
      <ol class="scoring-finish-list" data-scoring-finish-order></ol>
    </div>

    <div class="scoring-results" data-scoring-results></div>
  </div></section>

  <script src="/scripts/meet-scoring.js"></script>
  <script src="/scripts/scoring-calculator.js" defer></script>`;

  return layout({
    site,
    title: "Meet Scoring Calculator: Cross Country Dual and Invitational Team Scoring",
    description: "Free cross country meet scoring calculator. Add teams, record the finish order, and get instant dual or invitational team scores using standard NFHS scoring rules -- including displacers and tie-breaks.",
    pathname,
    content
  });
}
