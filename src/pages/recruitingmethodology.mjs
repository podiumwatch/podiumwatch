import { layout, pageHero } from "../lib/html.mjs";

export function recruitingMethodologyPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Recruit Ratings",
    title: "How the recruiting ratings work.",
    description:
      "A transparent explanation of the original Podium Watch score, stars, source rules, update process, and correction policy."
  })}

  <style>
    .recruit-method-shell { display:grid; gap:24px; }
    .recruit-method-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
    .recruit-method-card { padding:22px; border:1px solid rgba(15,23,42,.12); border-radius:14px; background:#fff; box-shadow:0 12px 28px rgba(15,23,42,.05); }
    .recruit-method-card h2, .recruit-method-card h3 { margin-top:0; }
    .recruit-method-card p:last-child { margin-bottom:0; }
    .recruit-star-table { width:100%; border-collapse:collapse; }
    .recruit-star-table th, .recruit-star-table td { padding:12px; border-bottom:1px solid rgba(15,23,42,.12); text-align:left; }
    .recruit-star-table th { background:#111; color:#fff; }
    .recruit-star-mark { color:#e6a700; letter-spacing:.04em; white-space:nowrap; }
    .recruit-method-principles { display:grid; gap:12px; counter-reset:principle; padding:0; list-style:none; }
    .recruit-method-principles li { display:grid; grid-template-columns:42px minmax(0,1fr); gap:12px; align-items:start; padding:15px; border-radius:12px; background:#f8fafc; }
    .recruit-method-principles li::before { counter-increment:principle; content:counter(principle); display:grid; place-items:center; width:36px; height:36px; border-radius:50%; background:#00bf63; color:#08140e; font-weight:1000; }
    @media (max-width:760px) { .recruit-method-grid { grid-template-columns:1fr; } .recruit-star-table { font-size:.9rem; } }
  </style>

  <section class="section section-paper">
    <div class="container recruit-method-shell">
      <section class="info-card">
        <p class="eyebrow">What the rating means</p>
        <h2>An editorial recruiting projection, not an official offer.</h2>
        <p>The Podium Watch Recruit Rating is an independent evaluation of an athlete's college potential based on sourced performance evidence and documented competitive context. It is not an OHSAA designation, a college scholarship promise, or a substitute for direct communication with college coaches.</p>
      </section>

      <section class="recruit-method-card">
        <h2>Score and star bands</h2>
        <div style="overflow:auto">
          <table class="recruit-star-table">
            <thead><tr><th>Stars</th><th>Score</th><th>Podium Watch label</th></tr></thead>
            <tbody>
              <tr><td class="recruit-star-mark"><span aria-label="Five stars">★★★★★</span></td><td>95 to 100</td><td>National level recruit</td></tr>
              <tr><td class="recruit-star-mark"><span aria-label="Four stars">★★★★</span></td><td>90 to 94.99</td><td>High level Division I prospect</td></tr>
              <tr><td class="recruit-star-mark"><span aria-label="Three stars">★★★</span></td><td>84 to 89.99</td><td>Strong college prospect</td></tr>
              <tr><td class="recruit-star-mark"><span aria-label="Two stars">★★</span></td><td>78 to 83.99</td><td>Developing college prospect</td></tr>
              <tr><td class="recruit-star-mark"><span aria-label="One star">★</span></td><td>70 to 77.99</td><td>Recruiting watch list</td></tr>
            </tbody>
          </table>
        </div>
        <p>A profile can exist without a rating. Podium Watch does not assign stars until the evaluation is ready for publication.</p>
      </section>

      <div class="recruit-method-grid">
        <article class="recruit-method-card">
          <h2>What carries the most weight</h2>
          <ol class="recruit-method-principles">
            <li><div><strong>Verified performance level</strong><p>Official or reviewed marks form the foundation of the evaluation.</p></div></li>
            <li><div><strong>Championship evidence</strong><p>State, regional, district, conference, and major invitational performances add context.</p></div></li>
            <li><div><strong>Consistency</strong><p>Repeated high level performances matter more than an isolated mark.</p></div></li>
            <li><div><strong>Development</strong><p>Age, graduation class, and improvement trajectory shape the projection.</p></div></li>
            <li><div><strong>Versatility</strong><p>Range across related events can strengthen the college projection.</p></div></li>
            <li><div><strong>Competition context</strong><p>Meet quality, conditions, and championship pressure are considered when supported by sources.</p></div></li>
          </ol>
        </article>

        <article class="recruit-method-card">
          <h2>What never affects the score</h2>
          <ol class="recruit-method-principles">
            <li><div><strong>Payment</strong><p>No athlete, family, coach, school, sponsor, or recruiting service can buy a rating.</p></div></li>
            <li><div><strong>Social following</strong><p>Popularity and follower counts do not measure recruiting ability.</p></div></li>
            <li><div><strong>School size or fame</strong><p>Large and small school athletes are evaluated from the same evidence rules.</p></div></li>
            <li><div><strong>Connections to Podium Watch</strong><p>Knowing the brand or submitting information does not improve the score.</p></div></li>
            <li><div><strong>Offers</strong><p>Offers are tracked separately and do not determine the performance based evaluation.</p></div></li>
          </ol>
        </article>
      </div>

      <section class="recruit-method-card">
        <h2>Event groups</h2>
        <p>Ratings use a broad event group and a specific primary event. The groups are Distance, Sprints, Hurdles, Jumps, Pole Vault, Throws, and Multis. Cross country athletes are normally evaluated inside Distance while retaining cross country as a specific performance event.</p>
      </section>

      <section class="recruit-method-card">
        <h2>Source and publication rules</h2>
        <p>A published rating requires at least one source linked or verified performance, a written Podium Watch evaluation, a data cutoff date, a primary event, and an event group. Ranking snapshots alone do not count as verified personal bests.</p>
        <p>Offers, interest, visits, commitments, and signings keep separate verification labels. Public recruiting activity requires a source link and confirmation or a public announcement.</p>
      </section>

      <section class="recruit-method-card">
        <h2>Updates and corrections</h2>
        <p>Ratings can change as new verified results are added. Podium Watch should publish major class updates after cross country, indoor track, early outdoor track, and the state meet. Every athlete profile includes a correction path for inaccurate identity, school, result, or commitment information.</p>
        <a class="button button-primary" href="/recruiting/">Open recruit ratings</a>
      </section>
    </div>
  </section>`;

  return layout({
    site,
    title: "Recruit Rating Methodology",
    description:
      "How Podium Watch creates transparent one through five star recruiting ratings for Ohio high school cross country and track athletes.",
    pathname: "/recruiting/methodology/",
    content
  });
}
