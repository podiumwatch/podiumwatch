import { layout, pageHero } from "../lib/html.mjs";

// Media-credibility audit (2026-10-28), P2-3: new page, exact copy from
// credibility-overhaul-handoff.md. Linked from the footer.
export function termsPage(site) {
  const content = `${pageHero({
    eyebrow: "Terms of Use",
    title: "Terms of Use",
    description: "How Podium Watch's content may and may not be used."
  })}

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Terms</p>
        <h2>Our content, your questions</h2>
      </div>
      <div class="prose">
        <p>Content on podiumwatch.org, including stories, rankings, graphics, and photos, belongs to Podium Watch or its contributors and may not be republished without permission. Sharing links to our coverage is always welcome.</p>
        <p>Rankings, mock meets, and projections are editorial opinion, not official results. Podium Watch is not affiliated with the OHSAA.</p>
        <p>Questions: <a href="mailto:${site.contactEmail}">${site.contactEmail}</a></p>
      </div>
    </div>
  </section>`;

  return layout({
    site,
    title: "Terms of Use",
    description: "Podium Watch's terms of use for content, rankings, projections, and republication.",
    pathname: "/terms/",
    content
  });
}
