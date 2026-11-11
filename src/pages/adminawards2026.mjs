import { adminShell } from "../lib/adminshell.mjs";

// Admin for the 2026 Athlete, Team and Coach of the Year: nominees ranked
// by nomination count with every reason, finalists (promote, reorder,
// edit the note, remove), announcing finalists, live vote counts with
// flagged networks and voiding, closing early, publishing winners, and
// CSV exports. Data: api/admin/awards-2026.js.
const styles = `
    .yoya-shell { display:grid; gap:16px; }
    .yoya-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    .yoya-bar select { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; max-width:100%; }
    .yoya-cat { display:grid; gap:10px; padding:16px; border:1px solid var(--line); background:var(--white); }
    .yoya-cat h2 { margin:0; font-size:1.1rem; }
    .yoya-cat h3 { margin:6px 0 0; font-size:.9rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
    .yoya-meta { margin:0; color:var(--muted); font-weight:700; font-size:.88rem; }
    .yoya-warn { margin:0; padding:8px 10px; background:#fff4e5; color:#8a4b00; font-weight:800; }
    .yoya-actions { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .yoya-cat button { padding:6px 12px; border:1px solid var(--line); border-radius:999px; background:var(--white); color:inherit; font:inherit; font-size:.82rem; font-weight:800; cursor:pointer; }
    .yoya-cat button[disabled] { opacity:.45; cursor:not-allowed; }
    .yoya-cat button.is-primary { border-color:#0faf68; background:#0faf68; color:#fff; }
    .yoya-cat button.is-danger { border-color:#b42318; color:#b42318; }
    .yoya-cat input { min-width:0; padding:7px 9px; border:1px solid var(--line); border-radius:7px; font:inherit; font-size:.9rem; }
    .yoya-finalists { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
    .yoya-finalist { display:grid; gap:6px; padding:10px; background:rgba(var(--black-rgb),.04); }
    .yoya-finalist.is-winner { outline:2px solid #0faf68; }
    .yoya-finalist-head { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .yoya-finalist-head input { flex:1 1 160px; }
    .yoya-votes { font-weight:900; font-variant-numeric:tabular-nums; }
    .yoya-winner, .yoya-tag { padding:2px 8px; border-radius:999px; background:#063d28; color:#fff; font-size:.72rem; font-weight:850; }
    .yoya-add input { width:100%; }
    .yoya-pool { display:grid; gap:4px; margin:6px 0 0; padding:0; list-style:none; font-size:.9rem; }
    .yoya-pool li { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .yoya-votebox { display:grid; gap:6px; padding:10px; border:1px dashed var(--line); }
    .yoya-votebox p { margin:0; }
    .yoya-networks { display:grid; gap:4px; margin:0; padding:0; list-style:none; font-size:.88rem; }
    .yoya-networks li.is-flagged { color:#b42318; font-weight:800; }
    .yoya-void { display:flex; flex-wrap:wrap; gap:6px; }
    .yoya-void input { flex:1 1 220px; }
    .is-error { color:#b42318; }
    .yoya-nominee { padding:10px 0; border-top:1px solid var(--line); }
    .yoya-nominee summary { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:baseline; cursor:pointer; }
    .yoya-nominee summary b { font-variant-numeric:tabular-nums; }
    .yoya-nominee small { color:var(--muted); font-weight:600; }
    .yoya-reasons { display:grid; gap:6px; margin:8px 0 0; padding:0; list-style:none; }
    .yoya-reasons li { display:flex; justify-content:space-between; gap:10px; padding:8px; background:rgba(var(--black-rgb),.04); font-size:.9rem; }
    .yoya-reasons button { flex:0 0 auto; }
    .yoya-empty { margin:0; color:var(--muted); font-weight:600; }
`;

export function adminAwards2026Page(site) {
  const content = `<div class="yoya-shell" data-yoya>
    <section class="info-card" data-yoya-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="yoya-shell" data-yoya-dashboard hidden>
      <div class="yoya-bar">
        <select data-yoya-filter><option value="">All categories</option></select>
        <button class="button button-secondary" type="button" data-yoya-refresh>Refresh</button>
        <button class="button button-secondary" type="button" data-yoya-announce-all data-confirm-text="Tap again to announce every category with 2+ finalists">Announce all ready</button>
        <button class="button button-secondary" type="button" data-yoya-publish-all data-confirm-text="Tap again to publish every closed category">Publish all</button>
        <button class="button button-primary" type="button" data-yoya-csv>Nominations CSV</button>
        <button class="button button-primary" type="button" data-yoya-finalists-csv>Finalists + votes CSV</button>
        <a class="button button-secondary" href="/awards/2026/" target="_blank" rel="noopener">Public hub</a>
      </div>
      <p class="awards-message" data-yoya-message role="status"></p>
      <section class="info-card" data-yoya-merch-panel>
        <h2>Podium Watch Store card</h2>
        <p>The merch card (The Podium Collection): awards hub, each ballot page below the finalists and vote button, the larger card after a vote, the homepage below the lead story, end of stories and results, bottom of rankings, and Wrapped. This switch turns every card off. Clicks show in the sponsor report as Podium Watch Shop; views and clicks by placement and product are in Engagement &gt; Merch. Products, colors and prices: src/data/merch.json; card text: src/data/merch-card.json.</p>
        <p><strong data-yoya-merch-state>Checking...</strong> <button class="button button-secondary" type="button" data-yoya-merch-toggle hidden>Turn off</button></p>
      </section>
      <section class="info-card" data-yoya-activity-panel>
        <h2>Vote activity</h2>
        <p>Votes per hour for each finalist (Eastern time), and bursts: one network casting 10 or more votes in an hour, or at least half of that hour's votes. Use it to check for vote stuffing before announcing winners; void votes by network ID in the category below.</p>
        <button class="button button-primary" type="button" data-yoya-activity>Load vote activity</button>
        <div data-yoya-activity-out style="margin-top:12px;display:grid;gap:16px"></div>
      </section>
      <section class="info-card" data-yoya-snapshots-panel>
        <h2>Saved tallies</h2>
        <p>Votes are backed up from Redis to the database every hour while voting is open. When a category closes (Fri Nov 13, 9:00 PM ET), its final tallies are frozen with a timestamp within 5 minutes and never change after that.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px"><button class="button button-primary" type="button" data-yoya-snapshots>Load saved tallies</button><button class="button button-secondary" type="button" data-yoya-final-csv>Download final tallies (CSV)</button></div>
        <div data-yoya-snapshots-out style="margin-top:12px;display:grid;gap:14px"></div>
      </section>
      <div class="yoya-shell" data-yoya-list></div>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/awards/2026/",
    title: "2026 Athlete, Team and Coach of the Year Admin",
    description: "Review nominations, pick finalists, watch votes and publish winners for the 2026 Athlete, Team and Coach of the Year.",
    heading: "2026 Athlete, Team and Coach of the Year",
    intro: "Pick finalists from the nominees (or the full list), then announce them. Voting in a category opens only after its finalists are announced and the voting window has started. Live vote counts also show on the public voting pages (about every 30 seconds). After voting closes, publish each winner.",
    styles,
    content,
    scripts: ["/scripts/admin-awards-2026.js"]
  });
}
