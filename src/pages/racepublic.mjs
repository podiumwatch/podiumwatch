import {
  layout,
  pageHero
} from "../lib/html.mjs";

// Team Workspace Phase Three's public spectator surface. Fully public,
// indexable, no account needed -- driven by either ?race=<session id>
// (a specific race) or ?team=<team id> (the whole team, resolved to
// whichever race matters right now), resolved client-side (see
// public/scripts/race-public.js), matching the existing /team/?slug=
// convention. A race only ever loads here if the coach explicitly
// turned it on (race_sessions.spectator_visible) -- see
// api/race/public.js and lib/race_viewer_service.mjs's
// loadSpectatorDay(). Any other spectator_visible race sharing the same
// day is offered as a switcher, so one link covers a whole meet day
// (2026-08-27 feature request), not just one race.
export function racePublicPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Live",
    title: "Watch the race.",
    description: "Real-time checkpoints and times, shared by the coach.",
    compact: true
  })}

  <style>
    .race-public-shell {
      display: grid;
      gap: 22px;
    }

    /* Grid items default to min-width:auto, so a wide nowrap descendant
       (the runner table's own header/cells, further down, which already
       has its own overflow-x:auto scroller) could still stretch this
       whole page wider than the viewport on mobile -- confirmed as a
       real, pre-existing overflow bug during the archive/team-day-link
       mobile testing (2026-08-27), unrelated to that work itself.
       min-width:0 on the one real grid item here (the page's root
       content div) lets the table's own scroller do its job instead of
       the grid track absorbing the overflow -- same fix, same root
       cause, as the Split Watch Plan page's rehearsal-testing find. */
    [data-race-public-root] {
      min-width: 0;
    }

    .race-public-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 20px 22px;
      background: var(--black);
      color: var(--paper);
      border-radius: var(--radius);
    }

    .race-public-header h2 {
      margin: 4px 0 0;
      font-family: Impact, sans-serif;
      letter-spacing: 0.01em;
    }

    .race-public-header a {
      color: var(--paper);
    }

    .race-public-status {
      display: inline-flex;
      padding: 6px 14px;
      border-radius: 999px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.78rem;
    }

    .race-public-status-live {
      background: var(--live-red);
      color: var(--white);
      animation: race-public-pulse 1.6s ease-in-out infinite;
    }

    .race-public-status-scheduled,
    .race-public-status-draft {
      background: rgba(255, 255, 255, 0.16);
      color: var(--paper);
    }

    .race-public-status-finished,
    .race-public-status-reviewed {
      background: var(--green);
      color: var(--black);
    }

    .race-public-status-cancelled {
      background: rgba(255, 255, 255, 0.16);
      color: var(--paper);
    }

    @keyframes race-public-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }

    .race-public-table-wrap {
      overflow-x: auto;
    }

    table.race-public-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--paper);
    }

    table.race-public-table th,
    table.race-public-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(var(--black-rgb),0.12);
      text-align: left;
      white-space: nowrap;
    }

    table.race-public-table th {
      text-transform: uppercase;
      font-size: 0.74rem;
      letter-spacing: 0.05em;
      color: rgba(var(--black-rgb),0.6);
    }

    .race-public-rank {
      font-family: Impact, sans-serif;
      font-size: 1.2rem;
    }

    .race-public-tag {
      display: inline-flex;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      background: rgba(var(--black-rgb),0.08);
    }

    .race-public-updated {
      font-size: 0.82rem;
      color: rgba(var(--black-rgb),0.6);
    }

    .race-public-search {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .race-public-search input {
      flex: 1 1 240px;
      /* Without this, the input's own content-based minimum width (an
         <input>'s intrinsic min-width is NOT 0 by default) refuses to
         shrink below it even with flex-shrink: 1 set above -- on a narrow
         phone that silently forces the whole page wider than the
         viewport instead of the input just shrinking to fit. */
      min-width: 0;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(var(--black-rgb),0.22);
      font: inherit;
      font-size: 1rem;
    }

    .race-public-focused {
      padding: 20px 22px;
      border-radius: var(--radius);
      background: var(--black);
      color: var(--paper);
    }

    .race-public-focused h3 {
      margin: 0 0 4px;
      font-family: Impact, sans-serif;
      letter-spacing: 0.01em;
    }

    .race-public-focused-meta {
      font-size: 0.85rem;
      opacity: 0.75;
      margin-bottom: 14px;
    }

    table.race-public-focused-table {
      width: 100%;
      border-collapse: collapse;
    }

    table.race-public-focused-table th,
    table.race-public-focused-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.16);
      text-align: left;
      white-space: nowrap;
    }

    table.race-public-focused-table th {
      text-transform: uppercase;
      font-size: 0.72rem;
      letter-spacing: 0.05em;
      opacity: 0.65;
    }

    .race-public-fresh {
      display: block;
      font-size: 0.76rem;
      opacity: 0.6;
      white-space: nowrap;
    }

    .race-public-alerts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: var(--radius);
      background: rgba(var(--black-rgb),0.05);
      font-size: 0.9rem;
    }

    .race-public-alerts input {
      flex: 1 1 220px;
      min-width: 0;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(var(--black-rgb),0.22);
      font: inherit;
    }

    .race-public-waiting {
      padding: 28px 24px;
      border-radius: var(--radius);
      background: var(--black);
      color: var(--paper);
      text-align: center;
    }

    .race-public-waiting h3 {
      margin: 0 0 8px;
      font-family: Impact, sans-serif;
      letter-spacing: 0.01em;
    }

    .race-public-waiting p {
      margin: 6px 0 0;
      opacity: 0.85;
    }

    .race-public-waiting-scheduled {
      display: inline-block;
      margin-top: 14px;
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      font-weight: 800;
    }

    .race-public-switcher {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .race-public-switcher-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(var(--black-rgb),0.16);
      background: var(--paper);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-align: left;
    }

    .race-public-switcher-chip-selected {
      border-color: var(--black);
      background: var(--black);
      color: var(--paper);
    }

    .race-public-switcher-chip-live {
      border-color: var(--live-red);
    }

    .race-public-switcher-status {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.7;
    }

    .race-public-switcher-chip-live .race-public-switcher-status {
      color: var(--live-red);
      opacity: 1;
    }

    .race-public-switcher-chip-selected.race-public-switcher-chip-live .race-public-switcher-status {
      color: #ff8080;
    }
  </style>

  <section class="section section-paper">
    <div class="container race-public-shell">
      <div class="info-card" data-race-public-loading>
        <h2>Loading race</h2>
        <p>Please wait while Podium Watch loads this race.</p>
      </div>

      <div data-race-public-message hidden></div>

      <div data-race-public-root hidden>
        <div class="race-public-header">
          <div>
            <p class="eyebrow" data-race-public-team></p>
            <h2 data-race-public-name></h2>
          </div>
          <span class="race-public-status" data-race-public-status></span>
        </div>

        <div class="race-public-switcher" data-race-public-switcher hidden></div>

        <p class="race-public-updated" data-race-public-updated></p>

        <div class="race-public-waiting" data-race-public-waiting hidden>
          <h3>Live timing has not started yet</h3>
          <p data-race-public-waiting-time></p>
          <p>Keep this page open -- it will switch to live times the moment the coach starts the race. No need to refresh, and no new link needed.</p>
        </div>

        <div data-race-public-live-shell>
          <div class="race-public-search">
            <input type="text" placeholder="Find your runner by name" data-race-public-search aria-label="Find your runner by name">
          </div>

          <div class="race-public-focused" data-race-public-focused hidden>
            <h3 data-race-public-focused-name></h3>
            <p class="race-public-focused-meta" data-race-public-focused-meta></p>
            <div class="race-public-table-wrap">
              <table class="race-public-focused-table">
                <thead>
                  <tr><th>Checkpoint</th><th>Time</th></tr>
                </thead>
                <tbody data-race-public-focused-rows></tbody>
              </table>
            </div>
          </div>

          <div class="race-public-table-wrap">
            <table class="race-public-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Runner</th>
                  <th>Group</th>
                  <th>Latest checkpoint</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody data-race-public-rows></tbody>
            </table>
          </div>

          <div class="race-public-alerts">
            <span>Want a text or push alert at each checkpoint?</span>
            <input type="text" placeholder="Alerts aren't live yet" disabled>
            <button class="button button-outline" type="button" disabled>Coming soon</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <script src="/scripts/race-poll.js" defer></script>
  <script src="/scripts/race-public.js" defer></script>`;

  return layout({
    site,
    title: "Watch a live race",
    description: "Follow a Podium Watch team's race live -- checkpoints and times, shared by the coach.",
    pathname: "/race/",
    content
  });
}
