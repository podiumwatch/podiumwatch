import { layout, pageHero } from "../lib/html.mjs";

// Phase 1 of docs/FEATURE_ROADMAP.md: "Goal-pace splits builder -- goal
// time + distance in, mile or 400m splits out." A companion to the race
// pace calculator (src/pages/pacecalculator.mjs), which covers the 6
// standard HS track/XC race distances -- this page is for anything else:
// a marathon, a half marathon, a training run, or any custom distance a
// coach types in. Shares the exact same reusable split-math utility
// (public/scripts/pace-splits.js, window.PodiumPaceSplits) rather than
// duplicating it, exactly the reuse that utility was built for. Entirely
// client-side, no API call, no database.
export function splitsCalculatorPage(site) {
  const pathname = "/splits-calculator/";

  const content = `${pageHero({
    eyebrow: "Podium Watch Tools",
    title: "Splits calculator.",
    description: "Plan mile or 400m splits for any goal time and distance -- a marathon, half marathon, training run, or any custom race."
  })}

  <style>
    .tool-crosslink {
      margin: 0; padding: 14px 16px; background: var(--paper); border-left: 4px solid var(--green);
      font-size: 0.92rem; line-height: 1.5;
    }
    .tool-crosslink a { color: var(--green-dark); font-weight: 700; text-decoration: underline; }

    .splits-tool { display: grid; gap: 28px; max-width: 720px; }

    .splits-field-label {
      margin: 0 0 8px; font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.78rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted);
    }

    .splits-distance-chips, .splits-step-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .splits-chip {
      min-height: 44px; padding: 10px 18px; border: 2px solid var(--ink); background: var(--white);
      color: var(--ink); font: inherit; font-weight: 700; cursor: pointer;
    }
    .splits-chip[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: var(--black); }

    .splits-custom-distance { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    .splits-custom-distance input[type="number"] {
      width: 110px; padding: 10px 12px; border: 2px solid var(--ink); background: var(--white); font: inherit; font-weight: 700;
    }
    .splits-unit-chips { display: flex; gap: 6px; }
    .splits-unit-chips button {
      min-height: 40px; padding: 8px 14px; border: 1px solid var(--line); background: var(--white);
      color: var(--muted); font: inherit; font-weight: 700; cursor: pointer;
    }
    .splits-unit-chips button[aria-pressed="true"] { border-color: var(--ink); color: var(--ink); background: var(--paper); }

    .splits-time-input { display: inline-flex; align-items: center; gap: 6px; padding: 12px 18px; border: 2px solid var(--ink); background: var(--white); width: fit-content; }
    .splits-time-field { text-align: center; }
    .splits-time-field input {
      border: none; outline: none; background: transparent; width: 56px; text-align: center;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: 1.9rem; color: var(--black);
    }
    .splits-time-field span { display: block; font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
    .splits-time-sep { font-size: 1.6rem; font-weight: 700; color: var(--muted); }

    .splits-summary { background: var(--black); color: var(--paper); padding: 26px; text-align: center; }
    .splits-summary-time { font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: clamp(2.3rem, 7vw, 3.2rem); line-height: 1; }
    .splits-summary-event { margin-top: 4px; font-size: 0.8rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--green); font-weight: 700; }
    .splits-summary-paces { display: flex; justify-content: center; gap: 36px; margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(246, 244, 238, 0.15); }
    .splits-summary-paces strong { display: block; font-size: 1.2rem; }
    .splits-summary-paces span { display: block; margin-top: 2px; font-size: 0.7rem; letter-spacing: 1px; text-transform: uppercase; color: #b9b6ad; }

    .splits-table { width: 100%; border-collapse: collapse; background: var(--white); margin-top: 14px; }
    .splits-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); padding: 8px 10px; border-bottom: 2px solid var(--black); }
    .splits-table td { padding: 9px 10px; font-size: 0.92rem; font-weight: 700; border-bottom: 1px solid var(--line); }
    .splits-table th:not(:first-child), .splits-table td:not(:first-child) { text-align: right; }
    .splits-table tr:last-child td { color: var(--green-dark); }
  </style>

  <section class="section section-paper"><div class="container splits-tool" data-splits-calculator>
    <p class="tool-crosslink"><a href="/pace-calculator/">Racing one of the 6 standard track or cross country distances? Try the race pace calculator instead &rarr;</a></p>

    <div>
      <p class="splits-field-label">Distance</p>
      <div class="splits-distance-chips" data-splits-distance-chips></div>
      <div class="splits-custom-distance">
        <span>Custom:</span>
        <input type="number" min="0" step="0.01" inputmode="decimal" data-splits-custom-distance aria-label="Custom distance">
        <div class="splits-unit-chips" data-splits-unit-chips></div>
      </div>
    </div>

    <div>
      <p class="splits-field-label">Goal time</p>
      <div class="splits-time-input">
        <label class="splits-time-field"><input type="number" min="0" inputmode="numeric" data-splits-hours aria-label="Goal hours"><span>Hr</span></label>
        <span class="splits-time-sep">:</span>
        <label class="splits-time-field"><input type="number" min="0" max="59" inputmode="numeric" data-splits-minutes aria-label="Goal minutes"><span>Min</span></label>
        <span class="splits-time-sep">:</span>
        <label class="splits-time-field"><input type="number" min="0" max="59" inputmode="numeric" data-splits-seconds aria-label="Goal seconds"><span>Sec</span></label>
      </div>
    </div>

    <div>
      <p class="splits-field-label">Split by</p>
      <div class="splits-step-chips" data-splits-step-chips></div>
    </div>

    <div data-splits-summary></div>
    <div data-splits-results></div>
  </div></section>

  <script src="/scripts/pace-splits.js"></script>
  <script src="/scripts/splits-calculator.js" defer></script>`;

  return layout({
    site,
    title: "Splits Calculator: Marathon, Half Marathon, and Custom Race Splits",
    description: "Free splits calculator for any goal time and distance -- marathon pace calculator, half marathon splits calculator, or any custom race and training run. Get mile or 400m splits instantly.",
    pathname,
    content
  });
}
