import { layout, pageHero } from "../lib/html.mjs";

// Media-credibility audit (2026-10-28), P1-3: new page, exact copy from
// credibility-overhaul-handoff.md. Linked from the footer, About, and
// Contact.
export function standardsPage(site) {
  const content = `${pageHero({
    eyebrow: "Editorial Standards & Corrections",
    title: "Editorial Standards & Corrections",
    description: "Podium Watch is an independent outlet covering Ohio high school cross country and track and field. These are the standards behind everything we publish."
  })}

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Accuracy first</p>
        <h2>Verified first, every time</h2>
      </div>
      <div class="prose">
        <p>Results, times, places, and team scores come from official meet results and timing company postings. We do not publish times, names, or statistics we cannot verify. When results are posted as unofficial, we say so until they are final.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Facts and projections</p>
        <h2>Kept clearly separate</h2>
      </div>
      <div class="prose">
        <p>Rankings, mock meets, and previews are Podium Watch's editorial opinion and modeled projections. They are labeled that way, and they are never presented as official results.</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Corrections</p>
        <h2>We fix what we get wrong</h2>
      </div>
      <div class="prose">
        <p>If we get something wrong, we fix it and say so. Corrections are made as quickly as possible, and stories that change in a meaningful way carry a note at the bottom explaining what was corrected and when. To request a correction, email <a href="mailto:${site.contactEmail}">${site.contactEmail}</a> with the story link and the correct information.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Independence</p>
        <h2>No outside influence on coverage</h2>
      </div>
      <div class="prose">
        <p>Podium Watch is not affiliated with the Ohio High School Athletic Association, any school, or any coaches' association. Sponsors and advertisers have no influence over our rankings, coverage, or editorial decisions. Sponsored content is always labeled.</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Covering young athletes</p>
        <h2>Respect, always</h2>
      </div>
      <div class="prose">
        <p>The athletes we cover are high school students. We focus on performances and achievements, treat every athlete with respect, and do not criticize officials or individual students in our coverage.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Contact</p>
        <h2>Tips, ideas, and corrections</h2>
      </div>
      <div class="prose">
        <p>News tips, story ideas, and corrections: <a href="mailto:${site.contactEmail}">${site.contactEmail}</a></p>
      </div>
    </div>
  </section>`;

  return layout({
    site,
    title: "Editorial Standards & Corrections",
    description: "Podium Watch's editorial standards for accuracy, corrections, independence, and covering high school athletes.",
    pathname: "/standards/",
    content
  });
}
