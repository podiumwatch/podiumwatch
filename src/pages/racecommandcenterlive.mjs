import { layout } from "../lib/html.mjs";

// Live Race Mode: a deliberately minimal-chrome page (no pageHero, no
// secondary nav) -- the spec calls for this to "look like a professional
// sports timing tool inside Podium Watch," with race controls taking
// priority over editorial design during live timing. Still calls the
// same layout() every other page uses (never a second design system),
// just with a lean content body and its own scoped CSS for large tap
// targets and mobile-first layout.
export function raceCommandCenterLivePage(site) {
  const content = `
  <style>
    /* Guards against the exact bug this page shipped with: several
       elements below (.rcc-start-screen, .rcc-live-controls) set their
       own display property at the same specificity as the browser's
       built-in [hidden] { display: none } rule -- and since a page's own
       style block loads after the UA stylesheet, the class rule wins the
       cascade, so setting an element's hidden property to true had ZERO
       visual effect. Concretely: the "Ready to Start?" screen (with its
       own live Start Race button) stayed visible, stacked above the
       live timing screen, for the entire race. This one rule makes
       [hidden] always win, regardless of what any other selector here sets. */
    [hidden] { display: none !important; }

    .rcc-live-shell {
      min-height: 70vh;
      padding: 16px;
      background: #0b0b0b;
      color: #ffffff;
    }

    .rcc-live-back {
      display: inline-block;
      font-size: 0.78rem;
      opacity: 0.7;
      color: #ffffff;
      text-decoration: none;
      padding: 4px 0 10px;
    }

    .rcc-live-back:hover { opacity: 1; text-decoration: underline; }

    .rcc-live-top-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .rcc-race-switcher-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      opacity: 0.9;
    }

    .rcc-race-switcher-label select {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: #1a1a1a;
      color: #ffffff;
      font: inherit;
    }

    /* Sticky as ONE unit (topbar + checkpoint indicator together) rather
       than two independently-positioned sticky elements -- avoids
       hardcoding a second element's top offset against the first one's
       variable rendered height. */
    .rcc-live-sticky-header {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #0b0b0b;
    }

    .rcc-live-topbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    }

    .rcc-live-topbar h1 {
      margin: 0;
      font-size: 1.2rem;
    }

    .rcc-live-clock {
      font-variant-numeric: tabular-nums;
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .rcc-live-clock-note {
      font-size: 0.72rem;
      opacity: 0.75;
      display: block;
    }

    .rcc-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      font-size: 0.78rem;
      font-weight: 750;
    }

    .rcc-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
    }

    .rcc-status-synced .rcc-status-dot { background: #00bf63; }
    .rcc-status-syncing .rcc-status-dot { background: #f59e0b; }
    .rcc-status-saved .rcc-status-dot { background: #3b82f6; }
    .rcc-status-offline .rcc-status-dot,
    .rcc-status-needs_attention .rcc-status-dot { background: #dc2626; }

    /* Part of the sticky header above -- impossible to scroll past.
       Built specifically so a volunteer stationed at one fixed
       checkpoint always knows which checkpoint THEIR device is
       recording, even after scrolling deep into a 20-30 runner list.
       This is a per-device setting, never synced -- one phone can sit
       on Mile 1 all race while another sits on Mile 2, independently. */
    .rcc-checkpoint-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      font-weight: 800;
      font-size: 1rem;
    }

    .rcc-checkpoint-indicator-label {
      opacity: 0.65;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .rcc-checkpoint-indicator-value {
      color: #00e676;
    }

    .rcc-checkpoint-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 4px 0;
    }

    .rcc-checkpoint-tab {
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
      color: #ffffff;
    }

    .rcc-checkpoint-tab-active {
      background: #00bf63;
      border-color: #00bf63;
      color: #06210f;
    }

    .rcc-checkpoint-tab-label {
      font-weight: 850;
      font-size: 0.95rem;
    }

    .rcc-checkpoint-tab-count {
      font-size: 0.74rem;
      opacity: 0.8;
      font-weight: 700;
    }

    .rcc-live-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 14px 4px;
      align-items: center;
    }

    .rcc-live-btn {
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

    .rcc-live-btn-primary { background: #00bf63; color: #06210f; }
    .rcc-live-btn-outline { background: transparent; border: 2px solid rgba(255, 255, 255, 0.4); color: #ffffff; }
    .rcc-live-btn-danger { background: #dc2626; color: #ffffff; }
    .rcc-live-btn-warning { background: #f59e0b; color: #451a03; }
    .rcc-live-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .rcc-live-message {
      margin: 10px 4px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
    }

    .rcc-list-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin: 22px 4px 10px;
      font-weight: 800;
      font-size: 0.95rem;
    }

    .rcc-list-heading span {
      font-weight: 700;
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .rcc-runner-list {
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

    .rcc-recorded-list {
      display: grid;
      gap: 8px;
      margin: 0 4px 40px;
    }

    .rcc-recorded-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
      border: 1px solid rgba(0, 191, 99, 0.25);
    }

    .rcc-recorded-row-manual {
      background: rgba(255, 255, 255, 0.05);
      border: 1px dashed rgba(255, 255, 255, 0.4);
    }

    .rcc-recorded-row-name {
      font-weight: 750;
      font-size: 0.92rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rcc-recorded-row-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 0 0 auto;
    }

    .rcc-recorded-row-value {
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      font-size: 1rem;
    }

    .rcc-empty-note {
      margin: 0 4px;
      opacity: 0.6;
      font-size: 0.85rem;
    }

    /* One compact row per runner (name + the big Tap button side by
       side, not stacked) so a coach can see 8+ runners at once instead of
       2-3 -- see docs/DECISIONS.md's runner-list density entry. Manual
       entry/DNS/DNF live in a collapsed .rcc-runner-expand block, opened
       per-runner via the small "more" button, so they cost no space
       until actually needed. */
    .rcc-runner-card {
      display: grid;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: #17181c;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .rcc-runner-card-excluded {
      opacity: 0.55;
    }

    .rcc-runner-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rcc-runner-name {
      flex: 1;
      min-width: 0;
      font-weight: 750;
      font-size: 0.95rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rcc-runner-tap {
      appearance: none;
      border: none;
      border-radius: 12px;
      padding: 0 22px;
      font: inherit;
      font-weight: 850;
      font-size: 1.05rem;
      cursor: pointer;
      background: #00bf63;
      color: #06210f;
      min-height: 56px;
      min-width: 96px;
      flex: 0 0 auto;
    }

    .rcc-runner-more {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      color: #ffffff;
      border-radius: 10px;
      min-height: 56px;
      width: 44px;
      font-size: 1.3rem;
      line-height: 1;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .rcc-runner-expand {
      display: grid;
      gap: 8px;
    }

    .rcc-runner-recorded {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(0, 191, 99, 0.16);
      min-height: 68px;
    }

    .rcc-runner-recorded-value {
      font-variant-numeric: tabular-nums;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .rcc-runner-recorded-manual {
      border: 2px dashed rgba(255, 255, 255, 0.55);
      background: rgba(255, 255, 255, 0.06);
    }

    .rcc-runner-row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .rcc-runner-small-btn {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      color: #ffffff;
      border-radius: 9px;
      padding: 10px 12px;
      font: inherit;
      font-size: 0.82rem;
      cursor: pointer;
      min-height: 44px;
    }

    .rcc-pack-checkbox {
      width: 26px;
      height: 26px;
    }

    .rcc-manual-entry {
      display: flex;
      gap: 8px;
    }

    .rcc-manual-entry input {
      flex: 1;
      min-width: 0;
      padding: 12px;
      border-radius: 9px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: #0b0b0b;
      color: #ffffff;
      font: inherit;
    }

    .rcc-start-screen {
      display: grid;
      gap: 18px;
      place-items: center;
      padding: 60px 16px;
      text-align: center;
    }

    /* Deliberately NOT dark-themed like the rest of this page -- the
       dialog is a self-contained light popup (matching every other
       coach-tool dialog in this codebase, e.g. teamroster.mjs's athlete
       dialog), floating over the dark live timing view rather than
       trying to match it. */
    dialog.rcc-race-day-dialog {
      width: min(560px, calc(100% - 28px));
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.5);
      color: #171717;
    }

    dialog.rcc-race-day-dialog::backdrop {
      background: rgba(0, 0, 0, 0.72);
    }

    .rcc-race-day-dialog-body {
      padding: 26px;
    }

    .rcc-race-day-dialog-body h2,
    .rcc-race-day-dialog-body p {
      color: #171717;
    }

    .rcc-race-day-reveal {
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(0, 191, 99, 0.12);
      border: 1px solid rgba(0, 191, 99, 0.35);
    }

    .rcc-race-day-reveal p {
      margin: 0 0 10px;
      font-weight: 800;
      font-size: 0.85rem;
    }

    .rcc-race-day-code-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .rcc-race-day-code {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.08);
      color: #171717;
    }

    .rcc-item-meta {
      margin-top: 4px;
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .rcc-start-screen p {
      max-width: 46ch;
      opacity: 0.85;
    }

    @media (min-width: 900px) {
      .rcc-runner-list,
      .rcc-recorded-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>

  <div class="rcc-live-shell">
    <div data-rcc-loading style="padding:40px 8px;">
      <h2>Loading live race...</h2>
      <p>Please wait while Podium Watch securely loads this race.</p>
    </div>

    <div data-rcc-root hidden>
      <div class="rcc-live-top-row">
        <a class="rcc-live-back" href="/race-command-center/" data-rcc-back-link>&larr; Race Command Center</a>
        <div data-rcc-race-switcher-wrap hidden>
          <label class="rcc-race-switcher-label">
            Switch race
            <select data-rcc-race-switcher></select>
          </label>
        </div>
      </div>
      <div class="rcc-live-sticky-header">
        <div class="rcc-live-topbar">
          <div>
            <h1 data-rcc-race-name></h1>
            <span class="rcc-status-pill" data-rcc-sync-status><span class="rcc-status-dot"></span><span data-rcc-sync-status-text>Not started</span></span>
          </div>
          <div style="text-align:right;">
            <div class="rcc-live-clock" data-rcc-clock>0:00</div>
            <span class="rcc-live-clock-note" data-rcc-clock-note></span>
          </div>
        </div>
        <div class="rcc-checkpoint-indicator" data-rcc-checkpoint-indicator hidden>
          <span class="rcc-checkpoint-indicator-label">Recording:</span>
          <span class="rcc-checkpoint-indicator-value" data-rcc-checkpoint-indicator-value></span>
        </div>
      </div>

      <p class="rcc-live-message" data-rcc-message hidden></p>

      <div data-rcc-start-screen class="rcc-start-screen" hidden>
        <h2>Ready to start?</h2>
        <p>Starting the race begins the official race clock immediately for every runner. Make sure everyone is on the line.</p>
        <button class="rcc-live-btn rcc-live-btn-primary" type="button" data-rcc-start-button style="font-size:1.3rem;padding:22px 28px;">Start Race</button>
        <button class="rcc-live-btn rcc-live-btn-outline" type="button" data-rcc-race-day-open hidden>Share access code with a timer</button>
      </div>

      <div data-rcc-live-screen hidden>
        <p style="margin:0 4px 8px;opacity:0.75;font-size:0.85rem;">Each device picks its own checkpoint below -- one phone can stay on Mile 1 the whole race while another stays on Mile 2, at the same time.</p>
        <div class="rcc-checkpoint-tabs" data-rcc-checkpoint-tabs></div>

        <div class="rcc-live-controls">
          <button class="rcc-live-btn rcc-live-btn-outline" type="button" data-rcc-pack-toggle>Pack Capture</button>
          <button class="rcc-live-btn rcc-live-btn-warning" type="button" data-rcc-restart-race>Restart Race</button>
          <button class="rcc-live-btn rcc-live-btn-danger" type="button" data-rcc-finish-race>Finish Race</button>
        </div>

        <div class="rcc-live-controls" data-rcc-pack-bar hidden>
          <span data-rcc-pack-count>0 selected</span>
          <button class="rcc-live-btn rcc-live-btn-primary" type="button" data-rcc-pack-confirm>Capture selected</button>
          <button class="rcc-live-btn rcc-live-btn-outline" type="button" data-rcc-pack-cancel>Cancel</button>
        </div>

        <div class="rcc-list-heading"><span data-rcc-still-heading-label>Still need a time</span><span data-rcc-still-count></span></div>
        <div class="rcc-runner-list" data-rcc-runner-list></div>
        <p class="rcc-empty-note" data-rcc-still-empty hidden>Everyone at this checkpoint has a time. Nice work.</p>

        <div class="rcc-list-heading" data-rcc-recorded-heading hidden><span>Recorded at this checkpoint</span><span data-rcc-recorded-count></span></div>
        <div class="rcc-recorded-list" data-rcc-recorded-list></div>
      </div>
    </div>
  </div>

  <dialog class="rcc-race-day-dialog" data-rcc-race-day-dialog>
    <div class="rcc-race-day-dialog-body">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <p class="eyebrow">Race day access</p>
          <h2 style="margin:2px 0 0;">Get volunteers timing</h2>
        </div>
        <button class="button button-outline" type="button" data-rcc-race-day-close>Close</button>
      </div>

      <p style="margin-top:6px;">
        Share this code with anyone timing this race for you -- a parent at mile one, a friend at the finish.
        They enter it at <strong>Race Command Center</strong> in the main menu and go straight into live
        timing for this team, no account required.
      </p>

      <div class="rcc-race-day-reveal" data-rcc-race-day-reveal hidden>
        <p>Your new code -- share it now, it won't be shown again</p>
        <div class="rcc-race-day-code-row">
          <code class="rcc-race-day-code" data-rcc-race-day-reveal-code></code>
          <button class="button button-outline" type="button" data-rcc-race-day-copy>Copy</button>
        </div>
      </div>

      <div data-rcc-race-day-status style="margin-top:14px;"></div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
        <button class="button button-primary" type="button" data-rcc-race-day-generate>Generate code</button>
        <button class="button button-outline" type="button" data-rcc-race-day-revoke hidden>Turn off access</button>
      </div>
    </div>
  </dialog>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/pace-splits.js" defer></script>
  <script src="/scripts/race-math.js" defer></script>
  <script src="/scripts/race-timer.js" defer></script>
  <script src="/scripts/race-local-store.js" defer></script>
  <script src="/scripts/race-command-center-live.js" defer></script>`;

  return layout({
    site,
    title: "Live Timing | Race Command Center",
    description: "Live race timing for Podium Watch coaches.",
    pathname: "/race-command-center/live/",
    content,
    chromeless: true
  });
}
