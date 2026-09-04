import { layout } from "../lib/html.mjs";

// Live Race Mode: a deliberately minimal-chrome page (no pageHero, no
// secondary nav) -- the spec calls for this to "look like a professional
// sports timing tool inside Podium Watch," with race controls taking
// priority over editorial design during live timing. Still calls the
// same layout() every other page uses (never a second design system),
// just with a lean content body and its own scoped CSS for large tap
// targets and mobile-first layout.
export function splitWatchLivePage(site) {
  const content = `
  <style>
    /* Guards against the exact bug this page shipped with: several
       elements below (.sw-start-screen, .sw-live-controls) set their
       own display property at the same specificity as the browser's
       built-in [hidden] { display: none } rule -- and since a page's own
       style block loads after the UA stylesheet, the class rule wins the
       cascade, so setting an element's hidden property to true had ZERO
       visual effect. Concretely: the "Ready to Start?" screen (with its
       own live Start Race button) stayed visible, stacked above the
       live timing screen, for the entire race. This one rule makes
       [hidden] always win, regardless of what any other selector here sets. */
    [hidden] { display: none !important; }

    .sw-live-shell {
      min-height: 70vh;
      padding: 16px;
      background: var(--sw-dark-bg);
      color: var(--white);
    }

    .sw-live-back {
      display: inline-block;
      font-size: 0.78rem;
      opacity: 0.7;
      color: var(--white);
      text-decoration: none;
      padding: 4px 0 10px;
    }

    .sw-live-back:hover { opacity: 1; text-decoration: underline; }

    .sw-live-top-row-left {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    /* Deliberately NOT a .sw-live-btn -- Restart is a rare, destructive,
       false-start-only admin action, not a normal race control, and
       shouldn't compete visually with Pack Capture/Finish Race for a
       coach's or volunteer's attention during a live race. Styled to
       match the small, muted .sw-live-back link next to it, with just
       enough warning-tinted color to read as "careful" rather than
       "primary." Still gated behind the existing confirm() dialog. */
    .sw-restart-link {
      appearance: none;
      border: none;
      background: transparent;
      cursor: pointer;
      font: inherit;
      display: inline-block;
      font-size: 0.78rem;
      opacity: 0.7;
      color: #fbbf24;
      text-decoration: none;
      padding: 4px 0 10px;
    }

    .sw-restart-link:hover { opacity: 1; text-decoration: underline; }

    .sw-live-top-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .sw-race-switcher-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      opacity: 0.9;
    }

    .sw-race-switcher-label select {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: var(--sw-dark-panel-alt);
      color: var(--white);
      font: inherit;
    }

    /* Sticky as ONE unit (topbar + checkpoint indicator together) rather
       than two independently-positioned sticky elements -- avoids
       hardcoding a second element's top offset against the first one's
       variable rendered height. */
    .sw-live-sticky-header {
      position: sticky;
      top: 0;
      z-index: 5;
      background: var(--sw-dark-bg);
    }

    /* Rehearsal Mode (race day build plan, Project 1): stays inside the
       already-sticky header so it can never scroll out of view, and
       never relies on color alone -- the words REHEARSAL MODE are the
       actual signal, not the amber background. */
    .sw-rehearsal-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 14px;
      padding: 8px 4px;
      background: #7a5b00;
      color: #fff6da;
      border-bottom: 2px solid #ffb800;
      font-size: 0.85rem;
    }

    .sw-rehearsal-banner strong {
      letter-spacing: 0.04em;
      font-size: 0.92rem;
    }

    .sw-live-topbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    }

    .sw-live-topbar h1 {
      margin: 0;
      font-size: 1.2rem;
      /* The sitewide h1 rule's -1.5px letter-spacing (main.css) is tuned
         for hero-scale headings (clamp(3.25rem, 8vw, 7.25rem)), where it's
         a tiny fraction of the font size. At this compact 1.2rem/19.2px
         size it's nearly 8% of the font size instead -- and on any device
         without Impact/Haettenschweiler installed (every Mac, Linux,
         iOS, and Android device -- i.e. most real mobile visitors), the
         generic sans-serif fallback's wider glyphs combined with that
         much negative tracking make adjacent letters visibly overlap.
         Confirmed directly: computed letter-spacing was -1.5px and the
         race name rendered as garbled, overlapping text on a real
         mobile-width render. Scoped to just this compact in-page title,
         not the sitewide h1 rule -- every other h1 on the site is at
         hero scale, where -1.5px never causes this. */
      letter-spacing: normal;
    }

    .sw-live-clock {
      font-variant-numeric: tabular-nums;
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .sw-live-clock-note {
      font-size: 0.72rem;
      opacity: 0.75;
      display: block;
    }

    .sw-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      font-size: 0.78rem;
      font-weight: 750;
    }

    .sw-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
    }

    .sw-status-synced .sw-status-dot { background: var(--green); }
    .sw-status-syncing .sw-status-dot { background: #f59e0b; }
    .sw-status-saved .sw-status-dot { background: #3b82f6; }
    .sw-status-offline .sw-status-dot,
    .sw-status-needs_attention .sw-status-dot { background: var(--live-red); }

    /* Part of the sticky header above -- impossible to scroll past.
       Built specifically so a volunteer stationed at one fixed
       checkpoint always knows which checkpoint THEIR device is
       recording, even after scrolling deep into a 20-30 runner list.
       This is a per-device setting, never synced -- one phone can sit
       on Mile 1 all race while another sits on Mile 2, independently. */
    .sw-checkpoint-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      font-weight: 800;
      font-size: 1rem;
    }

    .sw-checkpoint-indicator-label {
      opacity: 0.65;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sw-checkpoint-indicator-value {
      color: #00e676;
    }

    .sw-checkpoint-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 4px 0;
    }

    .sw-checkpoint-tab {
      appearance: none;
      cursor: pointer;
      font: inherit;
      border-radius: 12px;
      padding: 12px 16px;
      min-height: 52px;
      display: grid;
      gap: 2px;
      text-align: left;
      background: transparent;
      border: 2px solid rgba(255, 255, 255, 0.35);
      color: var(--white);
    }

    .sw-checkpoint-tab-active {
      background: var(--green);
      border-color: var(--green);
      color: #06210f;
    }

    .sw-checkpoint-tab-label {
      font-weight: 850;
      font-size: 0.95rem;
    }

    .sw-checkpoint-tab-count {
      font-size: 0.74rem;
      opacity: 0.8;
      font-weight: 700;
    }

    .sw-live-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 14px 4px;
      align-items: center;
    }

    .sw-live-btn {
      appearance: none;
      border: none;
      border-radius: 12px;
      padding: 16px 18px;
      font: inherit;
      font-weight: 800;
      font-size: 1rem;
      cursor: pointer;
      min-height: 52px;
    }

    .sw-live-btn-primary { background: var(--green); color: #06210f; }
    .sw-live-btn-outline { background: transparent; border: 2px solid rgba(255, 255, 255, 0.4); color: var(--white); }
    .sw-live-btn-danger { background: var(--live-red); color: var(--white); }
    .sw-live-btn-warning { background: #f59e0b; color: #451a03; }
    .sw-live-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .sw-live-message {
      margin: 10px 4px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
    }

    .sw-list-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin: 22px 4px 10px;
      font-weight: 800;
      font-size: 0.95rem;
    }

    .sw-list-heading span {
      font-weight: 700;
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .sw-runner-list {
      display: grid;
      gap: 6px;
      margin: 0 4px;
    }

    /* The "still need a time" list is the primary, full-attention view --
       runners never move or reorder as splits come in (still sorted by
       pre-race target so the list doesn't visually jump around), but
       once recorded a runner moves OUT of this list entirely and into
       the compact Recorded list below, so this one only ever shrinks
       during a race -- built specifically so a large roster doesn't mean
       scrolling past a wall of already-done runners to find who's left.
       See docs/DECISIONS.md's Live Race Mode diagnostic entry. */

    .sw-recorded-list {
      display: grid;
      gap: 8px;
      margin: 0 4px 40px;
    }

    .sw-recorded-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      /* Lets the right-hand group (badge + time + Undo) drop to its own
         line on a narrow phone instead of the name being squeezed to
         nothing to make room for a group that refuses to shrink -- see
         .sw-recorded-row-right below, which is exactly what was
         happening on mobile with the manual-entry badge added in. */
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(var(--green-rgb),0.1);
      border: 1px solid rgba(var(--green-rgb),0.25);
    }

    .sw-recorded-row-manual {
      background: rgba(255, 255, 255, 0.05);
      border: 1px dashed rgba(255, 255, 255, 0.4);
    }

    .sw-recorded-row-flash {
      animation: sw-recorded-flash 1.2s ease-out;
    }

    @keyframes sw-recorded-flash {
      0% { background: rgba(255, 255, 255, 0.55); }
      100% { background: rgba(var(--green-rgb),0.1); }
    }

    .sw-pace-badge {
      display: inline-flex;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .sw-pace-badge-ahead { background: rgba(var(--green-rgb),0.3); color: var(--white); }
    .sw-pace-badge-on_pace { background: rgba(59, 130, 246, 0.35); color: var(--white); }
    /* #111827 text here measured 2.09:1 against this badge's own
       rendered background (rgba(245,158,11,0.4) blended over the
       page's var(--sw-dark-bg)) -- fails WCAG AA (needs 4.5:1) by a wide margin,
       found during the overnight accessibility pass. #111827 reads
       fine on the light-background pages' equivalent tag (an OPAQUE
       light background there), but on this dark page the same badge
       is only 40% opaque, so the effective background stays dark and
       dark-on-dark is nearly unreadable -- exactly the "Behind target"
       flag a coach most needs to actually see. White text (matching
       the other three pace badges) measures 8.50:1 here. */
    .sw-pace-badge-at_risk { background: rgba(245, 158, 11, 0.4); color: var(--white); }
    .sw-pace-badge-missed { background: rgba(var(--live-red-rgb),0.4); color: var(--white); }

    .sw-recorded-row-name {
      font-weight: 750;
      font-size: 0.92rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 80px;
    }

    .sw-recorded-row-right {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      flex: 0 0 auto;
      /* Pushes this group flush to the row's right edge even on its own
         wrapped line (when it drops below the name on a narrow phone),
         rather than sitting stranded at the left. */
      margin-left: auto;
    }

    .sw-recorded-row-value {
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      font-size: 1rem;
    }

    .sw-empty-note {
      margin: 0 4px;
      opacity: 0.6;
      font-size: 0.85rem;
    }

    /* One compact row per runner (name + the big Tap button side by
       side, not stacked) so a coach can see 8+ runners at once instead of
       2-3 -- see docs/DECISIONS.md's runner-list density entry. Manual
       entry/DNS/DNF live in a collapsed .sw-runner-expand block, opened
       per-runner via the small "more" button, so they cost no space
       until actually needed. */
    .sw-runner-card {
      display: grid;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: var(--sw-dark-panel);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sw-runner-card-excluded {
      opacity: 0.55;
    }

    .sw-runner-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sw-runner-name {
      flex: 1;
      min-width: 0;
      font-weight: 750;
      font-size: 0.95rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sw-runner-tap {
      appearance: none;
      border: none;
      border-radius: 12px;
      padding: 0 22px;
      font: inherit;
      font-weight: 850;
      font-size: 1.05rem;
      cursor: pointer;
      background: var(--green);
      color: #06210f;
      min-height: 56px;
      min-width: 96px;
      flex: 0 0 auto;
    }

    .sw-runner-more {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      color: var(--white);
      border-radius: 10px;
      min-height: 56px;
      width: 44px;
      font-size: 1.3rem;
      line-height: 1;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .sw-runner-expand {
      display: grid;
      gap: 8px;
    }

    .sw-runner-recorded {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(var(--green-rgb),0.16);
      min-height: 68px;
    }

    .sw-runner-recorded-value {
      font-variant-numeric: tabular-nums;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .sw-runner-recorded-manual {
      border: 2px dashed rgba(255, 255, 255, 0.55);
      background: rgba(255, 255, 255, 0.06);
    }

    .sw-runner-row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .sw-runner-small-btn {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      color: var(--white);
      border-radius: 9px;
      padding: 10px 12px;
      font: inherit;
      font-size: 0.82rem;
      cursor: pointer;
      min-height: 44px;
    }

    .sw-pack-checkbox {
      width: 26px;
      height: 26px;
    }

    .sw-manual-entry {
      display: flex;
      gap: 8px;
    }

    .sw-manual-entry input {
      flex: 1;
      min-width: 0;
      padding: 12px;
      border-radius: 9px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: var(--sw-dark-bg);
      color: var(--white);
      font: inherit;
    }

    .sw-start-screen {
      display: grid;
      gap: 18px;
      place-items: center;
      padding: 60px 16px;
      text-align: center;
    }

    /* A real incident (2026-08-27): a helper on this exact screen
       started the HS boys race when they meant the JH boys race
       running the same day -- the race name up in the small sticky
       header (1.2rem) was easy to miss entirely. This banner is
       deliberately the single most prominent thing on the whole
       screen, more prominent than "Ready to start?" itself, since
       knowing WHICH race matters more than the generic prompt. */
    .sw-start-race-banner {
      width: 100%;
      max-width: 480px;
      padding: 20px 18px;
      border-radius: 16px;
      background: rgba(var(--green-rgb),0.14);
      border: 2px solid var(--green);
    }

    .sw-start-race-banner-label {
      margin: 0 0 4px;
      font-size: 0.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }

    .sw-start-race-banner-name {
      margin: 0;
      font-size: clamp(1.8rem, 8vw, 2.6rem);
      font-weight: 900;
      line-height: 1.05;
      color: var(--white);
    }

    .sw-start-switch-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.25);
    }

    .sw-start-switch-label {
      font-size: 0.85rem;
      font-weight: 700;
      opacity: 0.85;
    }

    .sw-start-switch-select {
      padding: 10px 12px;
      border-radius: 9px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: var(--sw-dark-bg);
      color: var(--white);
      font: inherit;
      font-weight: 700;
      max-width: 100%;
    }

    .sw-sunlight .sw-start-race-banner { background: #eafff2; border-color: var(--green-dark); }
    .sw-sunlight .sw-start-race-banner-label,
    .sw-sunlight .sw-start-race-banner-name { color: var(--black); }
    .sw-sunlight .sw-start-switch-row { border-top-color: rgba(0, 0, 0, 0.2); }
    .sw-sunlight .sw-start-switch-label { color: var(--black); }
    .sw-sunlight .sw-start-switch-select { background: var(--white); color: var(--black); border-color: var(--black); }

    /* Deliberately NOT dark-themed like the rest of this page -- the
       dialog is a self-contained light popup (matching every other
       coach-tool dialog in this codebase, e.g. teamroster.mjs's athlete
       dialog), floating over the dark live timing view rather than
       trying to match it. */
    dialog.sw-race-day-dialog {
      width: min(560px, calc(100% - 28px));
      max-height: calc(100dvh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.5);
      color: var(--ink);
    }

    dialog.sw-race-day-dialog::backdrop {
      background: rgba(0, 0, 0, 0.72);
    }

    .sw-race-day-dialog-body {
      padding: 26px;
    }

    .sw-race-day-dialog-body h2,
    .sw-race-day-dialog-body p {
      color: var(--ink);
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
      background: rgba(var(--black-rgb),0.08);
      color: var(--ink);
    }

    .sw-item-meta {
      margin-top: 4px;
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .sw-start-screen p {
      max-width: 46ch;
      opacity: 0.85;
    }

    @media (min-width: 900px) {
      .sw-runner-list,
      .sw-recorded-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* Outdoor live capture redesign (race day build plan, Project 4):
       Sunlight Mode. A bright, high-contrast override of the dark
       theme above -- for glare, not for taste, so it deliberately
       trades this page's normal look for maximum legibility: near-
       white background, near-black text, strong borders on every
       control, and no reliance on subtle color alone anywhere splits
       are recorded. Device-only preference (localStorage), never race
       data -- see public/scripts/split-watch-live.js's SUNLIGHT_KEY. */
    .sw-live-shell.sw-sunlight {
      background: #f5f5f0;
      color: var(--black);
    }

    .sw-sunlight .sw-live-back,
    .sw-sunlight .sw-live-clock-note,
    .sw-sunlight .sw-checkpoint-indicator-label,
    .sw-sunlight .sw-empty-note { color: var(--black); }

    /* .sw-restart-link's normal amber (#fbbf24, tuned for the dark
       theme) fails contrast against Sunlight Mode's bright background --
       a darker amber keeps the same "careful, not a primary action"
       cue while staying legible in direct sun. */
    .sw-sunlight .sw-restart-link { color: #7a4d00; }

    .sw-sunlight .sw-live-sticky-header { background: #f5f5f0; }

    .sw-sunlight .sw-live-topbar,
    .sw-sunlight .sw-checkpoint-indicator { border-bottom-color: rgba(0, 0, 0, 0.22); }

    .sw-sunlight .sw-checkpoint-indicator-value { color: var(--green-dark); }

    .sw-sunlight .sw-status-pill { background: rgba(0, 0, 0, 0.08); color: var(--black); }

    .sw-sunlight .sw-checkpoint-tab {
      border-color: var(--black);
      color: var(--black);
      background: var(--white);
    }

    .sw-sunlight .sw-checkpoint-tab-active {
      background: var(--green);
      border-color: var(--green-dark);
      color: #06210f;
    }

    .sw-sunlight .sw-live-btn-outline { border-color: var(--black); color: var(--black); background: var(--white); }
    .sw-sunlight .sw-live-message { background: var(--white); border: 1px solid rgba(0, 0, 0, 0.2); color: var(--black); }

    .sw-sunlight .sw-runner-card { background: var(--white); border-color: var(--black); }
    .sw-sunlight .sw-runner-name { color: var(--black); }
    .sw-sunlight .sw-runner-more { border-color: var(--black); color: var(--black); }

    .sw-sunlight .sw-recorded-row { background: #eafff2; border-color: var(--green-dark); color: var(--black); }
    .sw-sunlight .sw-recorded-row-manual { background: var(--white); border-color: var(--black); }
    .sw-sunlight .sw-recorded-row-name,
    .sw-sunlight .sw-recorded-row-value { color: var(--black); }
    .sw-sunlight .sw-runner-small-btn { border-color: var(--black); color: var(--black); }

    .sw-sunlight .sw-manual-entry input { background: var(--white); border-color: var(--black); color: var(--black); }

    /* Sunlight Mode's own confirmation must stay visible against the
       new bright background -- the base @keyframes above animates
       toward the DARK theme's recorded-row background, which would
       flash the wrong color here. */
    .sw-sunlight .sw-recorded-row-flash { animation-name: sw-recorded-flash-sunlight; }
    @keyframes sw-recorded-flash-sunlight {
      0% { background: #ffe066; }
      100% { background: #eafff2; }
    }

    /* Outdoor live capture redesign: Simple Timing View. Hides
       everything the spec calls "unused checkpoint navigation, Timing
       Crew details, Pack Capture unless explicitly enabled, advanced
       manual entry, extra race information, planning controls" --
       leaving only the clock, current checkpoint, runner buttons,
       recent captures, and Undo. Device-only preference, never
       changes the race plan or hides anything for another device. */
    .sw-simple-view [data-sw-checkpoint-tabs],
    .sw-simple-view [data-sw-pack-toggle],
    .sw-simple-view [data-sw-pack-bar],
    .sw-simple-view [data-sw-race-switcher-wrap],
    .sw-simple-view [data-sw-restart-race],
    .sw-simple-view [data-sw-adjust-clock-open],
    .sw-simple-view [data-sw-leave-rehearsal],
    .sw-simple-view .sw-runner-more {
      display: none !important;
    }

    /* Respects the user's OS-level motion preference -- the recorded-
       row flash is decorative confirmation, not information; the
       actual state change (still-needed -> recorded) is already
       conveyed by the row moving to a different list entirely. */
    @media (prefers-reduced-motion: reduce) {
      .sw-recorded-row-flash { animation: none; }
    }

    .sw-tools-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid rgba(var(--black-rgb),0.12);
    }

    .sw-tools-toggle-row:last-of-type { border-bottom: none; }

    .sw-tools-toggle-row p { margin: 2px 0 0; font-size: 0.85rem; opacity: 0.75; max-width: 38ch; }

    .sw-tools-switch { width: 46px; height: 26px; flex-shrink: 0; }

    /* Standard visually-hidden pattern -- present for assistive tech,
       invisible and non-disruptive for sighted users. Outdoor live
       capture redesign: "Screen reader announcements confirm capture
       without reading the entire page again" -- the visible
       confirmation is already the Recorded-row flash (sighted users);
       this is the same confirmation for a screen reader user, without
       adding a second visible banner for every single tap. */
    .sw-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  </style>

  <div class="sw-live-shell">
    <div data-sw-loading style="padding:40px 8px;">
      <h2>Loading live race...</h2>
      <p>Please wait while Podium Watch securely loads this race.</p>
    </div>

    <div data-sw-root hidden>
      <div class="sw-live-top-row">
        <div class="sw-live-top-row-left">
          <a class="sw-live-back" href="/split-watch/" data-sw-back-link>&larr; Split Watch</a>
          <a class="sw-restart-link" href="/split-watch/plan/" data-sw-leave-rehearsal hidden>Leave Rehearsal</a>
          <button class="sw-restart-link" type="button" data-sw-restart-race hidden>Restart race</button>
          <button class="sw-restart-link" type="button" data-sw-adjust-clock-open hidden>Adjust race clock</button>
          <button class="sw-restart-link" type="button" data-sw-tools-open>Tools</button>
        </div>
        <div data-sw-race-switcher-wrap hidden>
          <label class="sw-race-switcher-label">
            Switch race
            <select data-sw-race-switcher></select>
          </label>
        </div>
      </div>
      <div class="sw-live-sticky-header">
        <div class="sw-rehearsal-banner" data-sw-rehearsal-banner hidden>
          <strong>REHEARSAL MODE</strong>
          <span>Practice taps do not affect the official race.</span>
        </div>
        <div class="sw-live-topbar">
          <div>
            <h1 data-sw-race-name></h1>
            <span class="sw-status-pill" data-sw-sync-status><span class="sw-status-dot"></span><span data-sw-sync-status-text>Not started</span></span>
          </div>
          <div style="text-align:right;">
            <div class="sw-live-clock" data-sw-clock>0:00</div>
            <span class="sw-live-clock-note" data-sw-clock-note></span>
          </div>
        </div>
        <div class="sw-checkpoint-indicator" data-sw-checkpoint-indicator hidden>
          <span class="sw-checkpoint-indicator-label">Recording:</span>
          <span class="sw-checkpoint-indicator-value" data-sw-checkpoint-indicator-value></span>
        </div>
      </div>

      <p class="sw-live-message" data-sw-message hidden aria-live="polite"></p>

      <div data-sw-start-screen class="sw-start-screen" hidden>
        <div class="sw-start-race-banner">
          <p class="sw-start-race-banner-label">You are about to start</p>
          <p class="sw-start-race-banner-name" data-sw-start-race-name></p>
          <div class="sw-start-switch-row" data-sw-start-switcher-wrap hidden>
            <label class="sw-start-switch-label" for="sw-start-race-switcher">Timing a different race?</label>
            <select class="sw-start-switch-select" id="sw-start-race-switcher" data-sw-start-race-switcher></select>
          </div>
        </div>
        <h2 data-sw-start-heading>Ready to start?</h2>
        <p data-sw-start-message>Starting the race begins the official race clock immediately for every runner. Make sure everyone is on the line.</p>
        <button class="sw-live-btn sw-live-btn-primary" type="button" data-sw-start-button style="font-size:1.3rem;padding:22px 28px;">Start Race</button>
        <button class="sw-live-btn sw-live-btn-outline" type="button" data-sw-race-day-open hidden>Share access code with a timer</button>
      </div>

      <div class="sw-visually-hidden" aria-live="polite" data-sw-capture-announce></div>

      <div data-sw-live-screen hidden>
        <p style="margin:0 4px 8px;opacity:0.75;font-size:0.85rem;">Each device picks its own checkpoint below -- one phone can stay on Mile 1 the whole race while another stays on Mile 2, at the same time.</p>
        <div class="sw-checkpoint-tabs" data-sw-checkpoint-tabs></div>

        <div class="sw-live-controls">
          <button class="sw-live-btn sw-live-btn-outline" type="button" data-sw-pack-toggle>Pack Capture</button>
          <button class="sw-live-btn sw-live-btn-danger" type="button" data-sw-finish-race>Finish Race</button>
        </div>

        <div class="sw-live-controls" data-sw-pack-bar hidden>
          <span data-sw-pack-count>0 selected</span>
          <button class="sw-live-btn sw-live-btn-primary" type="button" data-sw-pack-confirm>Capture selected</button>
          <button class="sw-live-btn sw-live-btn-outline" type="button" data-sw-pack-cancel>Cancel</button>
        </div>

        <div class="sw-list-heading"><span data-sw-still-heading-label>Still need a time</span><span data-sw-still-count></span></div>
        <div class="sw-runner-list" data-sw-runner-list></div>
        <p class="sw-empty-note" data-sw-still-empty hidden>Everyone at this checkpoint has a time. Nice work.</p>

        <div class="sw-list-heading" data-sw-recorded-heading hidden><span>Recorded at this checkpoint</span><span data-sw-recorded-count></span></div>
        <div class="sw-recorded-list" data-sw-recorded-list></div>
      </div>
    </div>
  </div>

  <dialog class="sw-race-day-dialog" data-sw-race-day-dialog>
    <div class="sw-race-day-dialog-body">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <p class="eyebrow">Race day access</p>
          <h2 style="margin:2px 0 0;">Get volunteers timing</h2>
        </div>
        <button class="button button-outline" type="button" data-sw-race-day-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        Share this 4-digit code with anyone actually recording splits for you -- a coach at mile one, a volunteer
        at the finish. They enter it at <strong>Split Watch</strong> and go straight into today's race, no account
        required. For parents and fans who just want to watch, use Copy Parent Live Link on the Plan page
        instead -- that's a read-only view, this code is not.
      </p>

      <div class="sw-race-day-reveal" data-sw-race-day-reveal hidden>
        <p>Your team's race day code -- give it to anyone timing today. It stays here until you regenerate or turn off access.</p>
        <div class="sw-race-day-code-row">
          <code class="sw-race-day-code" data-sw-race-day-reveal-code></code>
          <button class="button button-outline" type="button" data-sw-race-day-copy>Copy</button>
        </div>
      </div>

      <div data-sw-race-day-status style="margin-top:14px;"></div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
        <button class="button button-primary" type="button" data-sw-race-day-generate>Generate code</button>
        <button class="button button-outline" type="button" data-sw-race-day-revoke hidden>Turn off access</button>
      </div>
    </div>
  </dialog>

  <dialog class="sw-race-day-dialog" data-sw-adjust-clock-dialog>
    <div class="sw-race-day-dialog-body">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <p class="eyebrow">Coach only</p>
          <h2 style="margin:2px 0 0;">Adjust race clock</h2>
        </div>
        <button class="button button-outline" type="button" data-sw-adjust-clock-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        If the official scoreboard and Split Watch disagree, enter the official clock's current elapsed time below.
        Split Watch will correct itself -- future splits and the live display use the corrected time, and every
        split already recorded is recalculated to match. Raw capture times are never lost.
      </p>

      <p style="margin-top:10px;font-weight:800;">
        Split Watch currently shows: <span data-sw-adjust-clock-current>0:00</span>
      </p>

      <label style="display:block;margin-top:14px;font-weight:800;">
        Official clock's current elapsed time (m:ss)
        <input type="text" data-sw-adjust-clock-input placeholder="e.g. 10:08" style="display:block;width:100%;margin-top:8px;padding:14px;font-size:1.2rem;border:2px solid rgba(var(--black-rgb),0.22);border-radius:9px;font-family:inherit;">
      </label>

      <p class="sw-message" data-sw-adjust-clock-message hidden style="margin-top:12px;"></p>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
        <button class="button button-primary" type="button" data-sw-adjust-clock-save>Save correction</button>
      </div>
    </div>
  </dialog>

  <dialog class="sw-race-day-dialog" data-sw-tools-dialog>
    <div class="sw-race-day-dialog-body">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <p class="eyebrow">This device only</p>
          <h2 style="margin:2px 0 0;">Tools</h2>
        </div>
        <button class="button button-outline" type="button" data-sw-tools-close>Close</button>
      </div>

      <div class="sw-tools-toggle-row">
        <div>
          <strong>Sunlight Mode</strong>
          <p>A brighter, higher-contrast look for reading this screen outdoors in direct sun.</p>
        </div>
        <input type="checkbox" class="sw-tools-switch" data-sw-sunlight-toggle>
      </div>

      <div class="sw-tools-toggle-row">
        <div>
          <strong>Simple Timing View</strong>
          <p>Hides Pack Capture, the race switcher, and other extras -- just the clock, your runners, and Undo. For one person timing alone.</p>
        </div>
        <input type="checkbox" class="sw-tools-switch" data-sw-simple-view-toggle>
      </div>

      <p style="margin-top:14px;font-size:0.8rem;opacity:0.65;">
        Both only affect this device -- nothing here changes the race plan or any other timer's screen.
      </p>
    </div>
  </dialog>

  <dialog class="sw-race-day-dialog" data-sw-retap-dialog>
    <div class="sw-race-day-dialog-body">
      <p class="eyebrow">Already recorded</p>
      <h2 style="margin:2px 0 0;" data-sw-retap-heading></h2>
      <p style="margin-top:8px;" data-sw-retap-message></p>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;">
        <button class="button button-primary" type="button" data-sw-retap-confirm>Use new time</button>
        <button class="button button-outline" type="button" data-sw-retap-cancel>Keep original</button>
      </div>
    </div>
  </dialog>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/race-timer.js" defer></script>
  <script src="/scripts/race-local-store.js" defer></script>
  <script src="/scripts/device-readiness.js" defer></script>
  <script src="/scripts/split-watch-live.js" defer></script>`;

  return layout({
    site,
    title: "Live Timing | Split Watch",
    description: "Live race timing for Podium Watch coaches.",
    pathname: "/split-watch/live/",
    content,
    chromeless: true
  });
}
