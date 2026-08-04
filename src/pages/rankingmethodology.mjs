import { layout, pageHero } from "../lib/html.mjs";

export function rankingMethodologyPage(site) {
  const content = `${pageHero({
    eyebrow: "How Podium Watch works",
    title: "Ranking methodology and corrections",
    description: "A clear explanation of what Podium Watch rankings mean, which evidence matters, and how readers can report a correction."
  })}
  <section class="section section-paper"><div class="container methodology-layout">
    <article class="article-content methodology-copy">
      <h2>Two kinds of ranking information</h2>
      <p><strong>Verified performance lists</strong> organize published results, marks, and official tournament information. They are intended to reflect the supplied source data rather than predict what will happen next.</p>
      <p><strong>Editorial rankings and projections</strong> are Podium Watch analysis. They may consider cross country results, track performances, championship finishes, consistency, returning status, team depth, and recent verified information. They are opinions based on evidence, not official OHSAA rankings.</p>

      <h2>Evidence Podium Watch considers</h2>
      <ol>
        <li>Official state, regional, district, conference, and invitational results.</li>
        <li>The full season resume rather than one isolated performance.</li>
        <li>Championship performance and head to head results when the conditions are comparable.</li>
        <li>Relevant track performances when they help explain cross country potential.</li>
        <li>Verified roster, grade, division, and school information available at the time of publication.</li>
      </ol>

      <h2>What Podium Watch does not assume</h2>
      <p>Podium Watch does not invent injuries, transfers, eligibility changes, roster decisions, or performances. When a ranking is a projection, the page should say so. When information comes from an official document, the page should identify the source and remind readers to confirm late changes with OHSAA or the school.</p>

      <h2>Updates and corrections</h2>
      <p>Rankings can change when new verified results become available or a factual error is corrected. A correction to a school, grade, performance, division, or result does not guarantee a specific ranking position, but it will be reviewed.</p>
      <p><a class="button button-primary" href="mailto:${site.contactEmail}?subject=Podium%20Watch%20Ranking%20Correction">Submit a ranking correction</a></p>
    </article>
    <aside class="methodology-sidebar">
      <div class="info-card"><p class="eyebrow">Trust labels</p><h2>What to look for</h2><p><span class="ranking-trust-badge verified">Verified data</span> means the list is organized from supplied published results or official documents.</p><p><span class="ranking-trust-badge editorial">Editorial ranking</span> means the order includes Podium Watch judgment and projection.</p></div>
      <div class="info-card"><p class="eyebrow">Before reporting an error</p><h2>Include the source</h2><p>Send the athlete or team name, the page address, the information that needs corrected, and a result or official source link when possible.</p></div>
    </aside>
  </div></section>`;

  return layout({
    site,
    title: "Ranking Methodology",
    description: "How Podium Watch creates Ohio cross country and track rankings, distinguishes verified data from projections, and reviews corrections.",
    pathname: "/rankings/methodology/",
    content
  });
}
