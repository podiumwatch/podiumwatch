// Front page lead block (WO-43). One renderer for both sides: the static
// build (scripts/build.mjs imports this file) draws the newest story, and
// the browser (front-lead-client.mjs) swaps in the lead an admin set.
// A story shape: { slug, href, title, summary, kicker, image_url,
// image_alt, image_credit, byline, story_date }.
// No real photo means a type-only headline, never a stock image.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function storyDateLabel(iso) {
  const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>';

export function frontLeadHtml(story) {
  const date = storyDateLabel(story.story_date);
  const meta = [story.byline ? `By ${esc(story.byline)}` : "", date ? esc(date) : ""].filter(Boolean).join(" &middot; ");
  const media = story.image_url
    ? `<figure class="fl-media"><a href="${esc(story.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(story.image_url)}" alt="${esc(story.image_alt || "")}" width="1200" height="675" loading="eager" fetchpriority="high"></a>${story.image_credit ? `<figcaption>Photo: ${esc(story.image_credit)}</figcaption>` : ""}</figure>`
    : "";
  return `<article class="fl-lead${story.image_url ? "" : " is-type"}" data-front-lead-slug="${esc(story.slug)}">
    ${media}
    <div class="fl-body">
      ${story.kicker ? `<p class="fl-kicker">${esc(story.kicker)}</p>` : ""}
      <h1 class="fl-title"><a href="${esc(story.href)}">${esc(story.title)}</a></h1>
      ${story.summary ? `<p class="fl-summary">${esc(story.summary)}</p>` : ""}
      ${meta ? `<p class="fl-meta">${meta}</p>` : ""}
      <a class="button button-primary fl-button" href="${esc(story.href)}">Read the story ${ARROW}</a>
    </div>
  </article>`;
}

export function frontAlsoHtml(stories) {
  if (!stories.length) return "";
  return `<h2 class="fl-also-title">Also on the front page</h2><ul class="fl-also-list">${stories.map((story) => `<li><a href="${esc(story.href)}">${story.image_url ? `<img src="${esc(story.image_url)}" alt="" width="320" height="180" loading="lazy">` : `<span class="fl-also-type">${esc(story.kicker || "Podium Watch")}</span>`}<span><small>${esc(story.kicker || "")}</small><strong>${esc(story.title)}</strong></span></a></li>`).join("")}</ul>`;
}
