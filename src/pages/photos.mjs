import { layout, pageHero } from "../lib/html.mjs";

// Public gallery of recently-selected meet photos -- the read-only mirror
// of the admin photo submissions review queue. Populated client-side from
// /api/photos/recent (see public/scripts/recent-photos.js), same as the
// homepage's smaller preview of this same data. Never shows a pending or
// unreviewed submission -- only photos an admin has actually selected.
export function photosPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Photos",
    title: "Meet photos from around Ohio.",
    description:
      "Shared by parents, coaches, and photographers, and selected by Podium Watch for use in coverage. Want to contribute? Submit your own meet photos."
  })}

  <section class="section section-paper">
    <div class="container">
      <div class="section-heading">
        <div><p class="eyebrow">Recent submissions</p><h2>Photos from the community.</h2></div>
        <a class="button button-dark" href="/submit-photos/">Submit your photos</a>
      </div>
      <div class="photos-grid" data-recent-photos-grid data-photos-limit="60"></div>
    </div>
  </section>

  <script src="/scripts/recent-photos.js" defer></script>`;

  return layout({
    site,
    title: "Meet Photos",
    description: "Ohio high school cross country and track meet photos, submitted by parents, coaches, and photographers.",
    pathname: "/photos/",
    content
  });
}
