import { layout, pageHero } from "../lib/html.mjs";

// /wrapped/ (short link podiumwatch.org/wrapped), WO-36: find a runner's
// 2026 Podium Watch Wrapped card by name or school. Before the admin
// launch date the search stays hidden behind a "coming soon" note.
export function wrappedSearchPage(site) {
  const content = `${pageHero({ eyebrow: "Podium Watch Wrapped", title: "Your 2026 season, wrapped", description: "A free share card for every Ohio cross country runner with at least 3 races on Podium Watch: races run, season best, postseason, All-Ohio and where you ranked. All from official results." })}
  <style>
    .wrs { display:grid; gap:14px; max-width:680px; margin:0 auto; }
    .wrs label { display:grid; gap:8px; font-weight:850; }
    .wrs input { font:inherit; padding:13px 14px; border:2px solid var(--ink); border-radius:12px; }
    .wrs-list { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
    .wrs-list a { display:flex; justify-content:space-between; gap:12px; padding:12px 16px; border:1px solid var(--line); border-radius:12px; background:#fff; color:inherit; text-decoration:none; font-weight:800; }
    .wrs-list a:hover, .wrs-list a:focus-visible { border-color:var(--ink); }
    .wrs-list small { color:var(--muted); font-weight:600; text-align:right; }
    .wrs-msg { color:var(--muted); margin:0; }
  </style>
  <section class="section"><div class="container"><div class="wrs">
    <p class="wrs-msg" data-wrs-soon hidden></p>
    <div data-wrs-search hidden>
      <label for="wrs-q">Find a runner<input id="wrs-q" type="search" autocomplete="off" placeholder="Name or school" maxlength="80" data-wrs-q></label>
      <p class="wrs-msg" data-wrs-msg role="status">Type at least 2 letters.</p>
      <ul class="wrs-list" data-wrs-list></ul>
    </div>
    <p class="wrs-msg">Missing races? <a href="/submit-results/?sport=cross_country&amp;season=2026">Send the results</a> and they'll be added.</p>
  </div></div></section>
  <script src="/scripts/wrapped-search.js" defer></script>`;
  return layout({ site, title: "Podium Watch Wrapped 2026", description: "Free 2026 season share cards for Ohio cross country runners: races, season best, postseason and ranks, from official results.", pathname: "/wrapped/", content });
}
