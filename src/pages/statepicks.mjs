import { escapeHtml } from "../lib/content.mjs";
import { layout, pageHero } from "../lib/html.mjs";
import logoManifest from "../data/mock-postseason-logo-manifest-2026.json" with { type: "json" };

// Public State Meet Picks page (2026-11-05): readers pick the team champion
// of all eight 2026 state races and put a name on it. Picks lock at the
// start of the first race; then every entry shows here. Race list and team
// names come from public/data/state-picks-2026.json (the real state
// qualifiers). Logic: public/scripts/state-picks.js and
// lib/state_picks_service.mjs. School logos (2026-11-05) are the same
// hand-matched set the Mock Postseason pages use
// (mock-postseason-logo-manifest-2026.json); a team without one just
// shows its name.
const styles = `
    .spk-shell { display:grid; gap:22px; }
    .spk-card { padding:20px; border:1px solid var(--line); background:var(--white); }
    .spk-card h2 { margin:0 0 6px; font-size:1.25rem; }
    .spk-meta { margin:0; color:var(--muted); font-weight:600; font-size:.92rem; }
    .spk-count { margin:12px 0 0; font-weight:800; }
    .spk-form { display:grid; gap:16px; }
    .spk-form label { display:grid; gap:7px; font-weight:850; }
    .spk-form input, .spk-form select { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .spk-form input:focus, .spk-form select:focus { outline:3px solid var(--green); outline-offset:1px; }
    .spk-races { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .spk-select { display:flex; align-items:center; gap:10px; }
    .spk-select select { flex:1 1 auto; min-width:0; }
    .spk-logo { flex:0 0 auto; width:32px; height:32px; object-fit:contain; }
    .spk-logo-sm { display:inline-block; width:22px; height:22px; vertical-align:-6px; margin-right:6px; object-fit:contain; }
    .spk-mine li .spk-logo-sm { margin-left:4px; }
    .spk-hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
    .spk-submit { justify-self:start; padding:12px 22px; border:0; border-radius:999px; background:var(--green); color:var(--black); font:inherit; font-weight:900; cursor:pointer; }
    .spk-submit[disabled] { opacity:.6; cursor:wait; }
    .spk-status { margin:0; font-weight:800; }
    .spk-status.is-error { color:#b42318; }
    .spk-mine ul { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 18px; margin:10px 0 0; padding:0; list-style:none; }
    .spk-mine li span { color:var(--muted); font-weight:700; }
    .spk-tallies { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .spk-tally h3 { margin:0 0 8px; font-size:1rem; }
    .spk-tally ol { margin:0; padding-left:20px; }
    .spk-tally li { margin:2px 0; }
    .spk-tally li b { font-variant-numeric:tabular-nums; }
    .spk-table-wrap { overflow-x:auto; margin-top:12px; border:1px solid var(--line); }
    .spk-table { width:100%; border-collapse:collapse; font-size:.88rem; min-width:900px; }
    .spk-table th, .spk-table td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }
    .spk-table th { background:var(--green); color:#fff; font-size:.74rem; letter-spacing:.04em; text-transform:uppercase; }
    .spk-table td:first-child { font-weight:800; }
    .spk-filter { max-width:320px; }
    .spk-note { margin:0; color:var(--muted); font-size:.86rem; font-weight:600; }
    @media (max-width: 700px) { .spk-races, .spk-mine ul, .spk-tallies { grid-template-columns:1fr; } }
`;

export function statePicksPage(site, field) {
  const lockLabel = "10:00 AM ET on Saturday, Nov. 7";
  const logos = {};
  for (const race of field.races) for (const team of race.teams) if (logoManifest[team]) logos[team] = `/images/mock-postseason-logos/schools/${logoManifest[team].slug}.png`;
  const raceFields = field.races.map((race) => `<label>${escapeHtml(race.label)}
            <span class="spk-select"><img class="spk-logo" data-spk-logo alt="" width="32" height="32" hidden>
            <select name="${escapeHtml(race.key)}" required>
              <option value="">Pick a champion</option>
              ${race.teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join("")}
            </select></span>
          </label>`).join("\n          ");

  const content = `<style>${styles}</style>
  ${pageHero({
    eyebrow: "State Meet Picks",
    title: "Pick All 8 State Champions",
    description: `Pick the team champion of every race at Saturday's OHSAA state meet at ${field.venue} and put your name on it. Picks lock at ${lockLabel}, when the first race starts. Then everyone's picks show up here.`
  })}
  <section class="section section-paper">
    <div class="container spk-shell" data-state-picks data-lock-at="${escapeHtml(field.lockAt)}">
      <section class="spk-card" data-spk-open>
        <h2>Make your picks</h2>
        <p class="spk-meta">One champion per race. You can change your picks on this device until ${lockLabel}.</p>
        <p class="spk-count" data-spk-count hidden></p>
        <form class="spk-form" data-spk-form novalidate>
          <label>Your name
            <input name="name" type="text" maxlength="40" autocomplete="name" placeholder="Shown with your picks after the lock" required>
          </label>
          <div class="spk-races">
          ${raceFields}
          </div>
          <label class="spk-hp" aria-hidden="true">Website <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
          <button class="spk-submit" type="submit">Lock in my picks</button>
          <p class="spk-status" data-spk-status role="status" aria-live="polite"></p>
        </form>
      </section>
      <section class="spk-card spk-mine" data-spk-mine hidden>
        <h2>Your picks</h2>
        <p class="spk-meta" data-spk-mine-name></p>
        <ul data-spk-mine-list></ul>
      </section>
      <section class="spk-card" data-spk-results hidden>
        <h2>Everyone's picks</h2>
        <p class="spk-meta" data-spk-results-meta></p>
        <div class="spk-tallies" data-spk-tallies></div>
      </section>
      <section class="spk-card" data-spk-entries hidden>
        <h2>All entries</h2>
        <label class="spk-form"><span class="spk-meta">Find a name</span><input class="spk-filter" type="search" data-spk-filter placeholder="Search names"></label>
        <div class="spk-table-wrap"><table class="spk-table"><thead><tr><th>Name</th>${field.races.map((race) => `<th>${escapeHtml(race.label.replace("Division ", "D"))}</th>`).join("")}</tr></thead><tbody data-spk-rows></tbody></table></div>
      </section>
      <p class="spk-note">Fan picks, not Podium Watch predictions. Each race lists the teams that qualified for state at the Oct. 31 regionals.</p>
    </div>
  </section>
  <script type="application/json" id="state-picks-field">${JSON.stringify({ lockAt: field.lockAt, races: field.races.map(({ key, label }) => ({ key, label })), logos }).replace(/</g, "\\u003c")}</script>
  <script src="/scripts/state-picks.js" defer></script>`;

  return layout({
    site,
    title: "Pick All 8 State Champions",
    description: "Pick the team champion of all eight races at the 2026 OHSAA state cross country meet at Fortress Obetz and put your name on it. Picks lock when the first race starts.",
    pathname: "/state-picks/",
    content
  });
}
