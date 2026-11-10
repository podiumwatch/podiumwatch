import { layout, pageHero } from "../lib/html.mjs";

// /teams/banquet/ (short link podiumwatch.org/banquet), WO-35: find a team's
// 2026 Banquet Pack. Search by school or city; each result opens
// /teams/{slug}/season/2026/banquet/, which shows the full pack when the
// team has results from at least 3 meets and an upload button otherwise.

export function teamBanquetPage(site) {
  const content = `${pageHero({ eyebrow: "For coaches", title: "2026 Banquet Pack", description: "Your team's cross country season, ready to print, put on the projector or share: results, season bests, postseason and honors from Podium Watch. Free for every Ohio team." })}
  <style>
    .tbq { display:grid; gap:16px; max-width:680px; margin:0 auto; }
    .tbq label { display:grid; gap:8px; font-weight:850; }
    .tbq input { font:inherit; padding:13px 14px; border:2px solid var(--ink); border-radius:12px; }
    .tbq-list { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
    .tbq-list a { display:flex; justify-content:space-between; gap:12px; padding:13px 16px; border:1px solid var(--line); border-radius:12px; background:#fff; color:inherit; text-decoration:none; font-weight:800; }
    .tbq-list a:hover, .tbq-list a:focus-visible { border-color:var(--ink); }
    .tbq-list small { color:var(--muted); font-weight:600; }
    .tbq-msg { color:var(--muted); margin:0; }
  </style>
  <section class="section"><div class="container"><div class="tbq">
    <label for="tbq-search">Find your team<input id="tbq-search" type="search" autocomplete="off" placeholder="School or city" maxlength="80" data-tbq-search></label>
    <p class="tbq-msg" data-tbq-msg role="status">Type at least 2 letters.</p>
    <ul class="tbq-list" data-tbq-list></ul>
    <p class="tbq-msg">Missing meets make a thinner pack. <a href="/submit-results/">Send results</a> and they'll be added.</p>
  </div></div></section>
  <script src="/scripts/team-banquet-search.js" defer></script>`;
  return layout({
    site,
    title: "2026 Cross Country Banquet Pack",
    description: "A free 2026 season summary for every Ohio high school cross country team: results, season bests, postseason and honors, ready to print, project or share.",
    pathname: "/teams/banquet/",
    content
  });
}
