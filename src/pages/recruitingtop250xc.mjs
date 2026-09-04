import { layout, pageHero, emptyState } from "../lib/html.mjs";

// Ohio Boys Cross Country Top 250, Class of 2027 -- a cross-country-specific
// companion to the combined track+XC /recruiting/top-100/ page. Same real
// Recruit Ratings data (same /api/recruiting/ endpoint, same
// athlete_recruit_ratings table, same admin tools), just scoped to
// event_group=cross_country and sized to 250 instead of 100. Rank shown here
// is this page's own sort position (fastest verified time first), not the
// API's state_class_rank -- that field is dense_rank()'d across ALL of a
// class's event groups combined and collapses ties into shared numbers,
// which reads fine for a top 10-20 but produces visibly repeated ranks
// across a full 250-athlete spread. Sequential position by sort order is
// what a "Top 250" list actually means here.
const styles = `
    .top250xc-shell { display:grid; gap:24px; }
    .top250xc-trust { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:20px; border-left:6px solid var(--green); }
    .top250xc-trust h2, .top250xc-trust p { margin-bottom:0; }
    .top250xc-message { margin:0; padding:14px 16px; border-radius:10px; background:rgba(var(--green-rgb),.12); font-weight:850; }
    .top250xc-message[data-tone="error"] { color:var(--danger); background:rgba(220,38,38,.12); }
    .top250xc-row { grid-template-columns:56px 1.6fr .85fr .7fr .9fr; }
    .top250xc-name { display:block; font-size:1.1rem; }
    .top250xc-event { display:inline-flex; margin-top:4px; padding:3px 8px; border-radius:999px; background:rgba(var(--green-rgb),.14); font-size:.74rem; font-weight:900; text-transform:uppercase; }
    .top250xc-hometown { display:block; margin-top:6px; color:var(--muted); }
    .top250xc-hometown strong { color:var(--ink); }
    .top250xc-time { font-variant-numeric:tabular-nums; font-weight:800; font-size:1.05rem; }
    .top250xc-stats { display:grid; gap:8px; justify-items:start; }
    .top250xc-score { display:inline-grid; place-items:center; min-width:48px; min-height:48px; border-radius:50%; background:var(--black); color:var(--white); font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.35rem; }
    .top250xc-stars { display:flex; gap:2px; color:#e6a700; font-size:1.02rem; }
    .top250xc-stars span[data-empty="true"] { color:#d7dce3; }
    .top250xc-commit { display:grid; gap:4px; text-align:right; }
    .top250xc-commit strong { font-size:1rem; }
    .top250xc-commit span { color:var(--muted); font-size:.84rem; }
    .top250xc-commit[data-committed="false"] { color:var(--muted); }
    @media (max-width:760px) {
      .top250xc-row { grid-template-columns:36px 1fr; gap:12px; }
      .top250xc-time, .top250xc-stats, .top250xc-commit { grid-column:2; text-align:left; }
      .top250xc-commit { flex-direction:row; gap:8px; }
    }
`;

export function recruitingTop250XcPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Recruiting",
    title: "Ohio Boys Cross Country Top 250.",
    description: "The top 250 senior boys cross country recruits in Ohio, ranked by verified 5K time -- no pay to play, no offers affecting the score."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container top250xc-shell" data-top250xc>
      <section class="info-card top250xc-trust">
        <div>
          <p class="eyebrow">Independent editorial evaluation</p>
          <h2>Ranked by verified time. No pay to play.</h2>
          <p>This is a preliminary, time-based ranking from verified 2026-season 5K results -- not yet a full editorial evaluation (course difficulty and meet quality aren't factored in). <a href="/recruiting/methodology/">Read the full methodology</a>.</p>
        </div>
      </section>

      <div class="top100-controls" style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="button button-outline" href="/recruiting/">Search the full recruiting database</a>
        <a class="button button-outline" href="/recruiting/top-100/boys/">Combined Boys Top 100</a>
        <a class="button button-outline" href="/recruiting/submit-activity/">Report an offer or commitment</a>
      </div>

      <p class="top250xc-message" data-top250xc-message role="status">Loading the Ohio Boys Cross Country Top 250.</p>

      <div class="ranking-list" data-top250xc-rows></div>

      <div data-top250xc-empty hidden>
        ${emptyState({
          title: "No cross country evaluations published yet",
          description: "The Boys Cross Country Top 250 is ready -- published Recruit Ratings for the Class of 2027 will appear here automatically, ranked by verified 5K time.",
          actionLabel: "View the combined Top 100",
          actionHref: "/recruiting/top-100/boys/"
        })}
      </div>
    </div>
  </section>

  <script src="/scripts/recruiting-top250-xc.js" defer></script>`;

  return layout({
    site,
    title: "Ohio Boys Cross Country Top 250 Recruits",
    description: "The top 250 Ohio high school senior boys cross country recruits, Class of 2027, ranked by verified 5K time -- evaluated by Podium Watch.",
    pathname: "/recruiting/top-250/boys-cross-country/",
    content
  });
}
