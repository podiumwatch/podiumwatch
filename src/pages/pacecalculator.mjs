import { layout, pageHero } from "../lib/html.mjs";

// A public, no-login tool: enter a goal time for one of six track or
// cross country events and see live mile/kilometer/lap splits. Entirely
// computed in the browser from two inputs -- no API call, no database.
// The actual split math lives in public/scripts/pace-splits.js
// (window.PodiumPaceSplits) specifically so it's a single, reusable,
// independently-tested utility rather than logic embedded in this page's
// own script -- see scripts/test-pace-calculator.mjs. This page's own
// script (public/scripts/pace-calculator.js) only handles the UI: event
// selection, reading the two inputs, and rendering whatever
// PodiumPaceSplits returns.
export function paceCalculatorPage(site) {
  const pathname = "/pace-calculator/";

  const content = `${pageHero({
    eyebrow: "Podium Watch Tools",
    title: "Race pace calculator.",
    description: "A 5K pace calculator, cross country pace calculator, and track pace calculator in one place. Enter a goal time and see your mile splits, kilometer splits, or lap splits instantly."
  })}

  <style>
    .pace-tool { display: grid; gap: 28px; max-width: 720px; }

    .pace-event-groups { display: grid; gap: 18px; }
    .pace-event-group-label {
      margin: 0 0 8px; font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.78rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted);
    }
    .pace-event-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .pace-event-chip {
      min-height: 44px; padding: 10px 18px; border: 2px solid var(--ink); background: var(--white);
      color: var(--ink); font: inherit; font-weight: 700; cursor: pointer;
    }
    .pace-event-chip[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: var(--black); }

    .pace-time-input {
      display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px;
      border: 2px solid var(--ink); background: var(--white); width: fit-content;
    }
    .pace-time-field { text-align: center; }
    .pace-time-field input {
      border: none; outline: none; background: transparent; width: 68px; text-align: center;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: 2.1rem; color: var(--black);
    }
    .pace-time-field span {
      display: block; font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;
    }
    .pace-time-sep { font-size: 1.8rem; font-weight: 700; color: var(--muted); }

    .pace-quick-picks { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .pace-quick-picks button {
      min-height: 36px; padding: 6px 14px; border: 1px solid var(--line); background: var(--white);
      color: var(--muted); font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer;
    }
    .pace-quick-picks button:hover { border-color: var(--ink); color: var(--ink); }

    .pace-summary {
      background: var(--black); color: var(--paper); padding: 26px; text-align: center;
    }
    .pace-summary-time {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: clamp(2.6rem, 8vw, 3.4rem); line-height: 1;
    }
    .pace-summary-event { margin-top: 4px; font-size: 0.8rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--green); font-weight: 700; }
    .pace-summary-paces { display: flex; justify-content: center; gap: 36px; margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(246, 244, 238, 0.15); }
    .pace-summary-paces strong { display: block; font-size: 1.3rem; }
    .pace-summary-paces span { display: block; margin-top: 2px; font-size: 0.7rem; letter-spacing: 1px; text-transform: uppercase; color: #b9b6ad; }

    .pace-table-block { margin-bottom: 22px; }
    .pace-table-block h3 {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: 0.78rem;
      letter-spacing: 1.5px; text-transform: uppercase; color: var(--green-dark); margin: 0 0 8px;
    }
    .pace-table { width: 100%; border-collapse: collapse; background: var(--white); }
    .pace-table th {
      text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted);
      padding: 8px 10px; border-bottom: 2px solid var(--black);
    }
    .pace-table td { padding: 9px 10px; font-size: 0.92rem; font-weight: 700; border-bottom: 1px solid var(--line); }
    .pace-table th:not(:first-child), .pace-table td:not(:first-child) { text-align: right; }
    .pace-table tr:last-child td { color: var(--green-dark); }

    .pace-tables-wrap { display: grid; gap: 24px; }
    @media (min-width: 640px) { .pace-tables-wrap.pace-tables-wrap-xc { grid-template-columns: 1fr 1fr; } }
  </style>

  <section class="section section-paper"><div class="container pace-tool" data-pace-calculator>
    <div class="pace-event-groups">
      <div>
        <p class="pace-event-group-label">Track</p>
        <div class="pace-event-chips" data-pace-event-group="track"></div>
      </div>
      <div>
        <p class="pace-event-group-label">XC and road</p>
        <div class="pace-event-chips" data-pace-event-group="xc"></div>
      </div>
    </div>

    <div>
      <p class="pace-event-group-label">Goal time</p>
      <div class="pace-time-input">
        <label class="pace-time-field">
          <input type="number" min="0" inputmode="numeric" data-pace-minutes aria-label="Goal minutes">
          <span>Min</span>
        </label>
        <span class="pace-time-sep">:</span>
        <label class="pace-time-field">
          <input type="number" min="0" max="59" inputmode="numeric" data-pace-seconds aria-label="Goal seconds">
          <span>Sec</span>
        </label>
      </div>
      <div class="pace-quick-picks" data-pace-quick-picks></div>
    </div>

    <div data-pace-summary></div>
    <div data-pace-results></div>
  </div></section>

  <script src="/scripts/pace-splits.js"></script>
  <script src="/scripts/pace-calculator.js" defer></script>`;

  return layout({
    site,
    title: "Race Pace Calculator: 5K, Cross Country, and Track Splits | Podium Watch",
    description: "Free 5K pace calculator, cross country pace calculator, and track pace calculator. Enter a goal time for 800m, 1600m, 3200m, 5K, 3 mile, or 10K and get instant mile, kilometer, or lap splits.",
    pathname,
    content
  });
}
