// Front page lead block (WO-43). One renderer for both sides: the static
// build (scripts/build.mjs imports this file) draws the rotation from the
// newest stories, and the browser (front-lead-client.mjs) redraws it with
// the lead and picks an admin set.
// A story shape: { slug, href, title, summary, kicker, image_url,
// image_alt, image_credit, byline, story_date }.
// No real photo means a type-only headline, never a stock image.
//
// Rotation (Zachary, 2026-11-10): the lead moves to the next story every
// 8 seconds, through up to 8 stories. All slides sit in one grid cell so
// the block keeps the height of the tallest one and nothing below jumps.

export const ROTATION_MAX = 8;
export const ROTATION_MS = 8000;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function storyDateLabel(iso) {
  const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>';

export function frontLeadHtml(story, { first = true, index = 0, total = 1 } = {}) {
  const date = storyDateLabel(story.story_date);
  const meta = [story.byline ? `By ${esc(story.byline)}` : "", date ? esc(date) : ""].filter(Boolean).join(" &middot; ");
  const media = story.image_url
    ? `<figure class="fl-media"><a href="${esc(story.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(story.image_url)}" alt="${esc(story.image_alt || "")}" width="1200" height="675" ${first ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a>${story.image_credit ? `<figcaption>Photo: ${esc(story.image_credit)}</figcaption>` : ""}</figure>`
    : "";
  const heading = first ? "h1" : "h2";
  return `<article class="fl-lead${story.image_url ? "" : " is-type"}${first ? " is-active" : ""}" data-front-lead-slug="${esc(story.slug)}"${total > 1 ? ` role="group" aria-roledescription="slide" aria-label="${index + 1} of ${total}"` : ""}${first ? "" : ' aria-hidden="true" inert'}>
    ${media}
    <div class="fl-body">
      ${story.kicker ? `<p class="fl-kicker">${esc(story.kicker)}</p>` : ""}
      <${heading} class="fl-title"><a href="${esc(story.href)}">${esc(story.title)}</a></${heading}>
      ${story.summary ? `<p class="fl-summary">${esc(story.summary)}</p>` : ""}
      ${meta ? `<p class="fl-meta">${meta}</p>` : ""}
      <a class="button button-primary fl-button" href="${esc(story.href)}">Read the story ${ARROW}</a>
    </div>
  </article>`;
}

// The rotating lead plus a strip listing every story in the rotation (tap
// one to jump to it) and a pause button for the timer.
export function frontRotatorHtml(stories) {
  const list = (stories || []).slice(0, ROTATION_MAX);
  if (!list.length) return "";
  const slides = list.map((story, index) => frontLeadHtml(story, { first: index === 0, index, total: list.length })).join("");
  if (list.length === 1) return `<div class="fl-rotator" data-front-rotator>${slides}</div>`;
  const strip = list.map((story, index) => `<li><button type="button" class="fl-pick${index === 0 ? " is-active" : ""}" data-front-pick="${index}" aria-label="Show story ${index + 1}: ${esc(story.title)}"${index === 0 ? ' aria-current="true"' : ""}><span class="fl-pick-bar"><span></span></span><span class="fl-pick-kicker">${esc(story.kicker || "Podium Watch")}</span><span class="fl-pick-title">${esc(story.title)}</span></button></li>`).join("");
  const arrow = (dir) => `<button type="button" class="fl-arrow fl-arrow-${dir}" data-front-${dir} aria-label="${dir === "next" ? "Next" : "Previous"} story"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="${dir === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="square"/></svg></button>`;
  return `<div class="fl-rotator" data-front-rotator aria-roledescription="carousel" aria-label="Front page stories">${slides}${arrow("prev")}${arrow("next")}</div>
  <div class="fl-strip"><button type="button" class="fl-toggle" data-front-toggle aria-pressed="false">Pause</button><ol class="fl-picks">${strip}</ol></div>`;
}

// Kept for the archive and older callers: a plain list of stories.
export function frontAlsoHtml(stories) {
  if (!stories.length) return "";
  return `<h2 class="fl-also-title">Also on the front page</h2><ul class="fl-also-list${stories.length >= 4 ? " is-four" : ""}">${stories.map((story) => `<li><a href="${esc(story.href)}">${story.image_url ? `<img src="${esc(story.image_url)}" alt="" width="320" height="180" loading="lazy">` : `<span class="fl-also-type">${esc(story.kicker || "Podium Watch")}</span>`}<span><small>${esc(story.kicker || "")}</small><strong>${esc(story.title)}</strong></span></a></li>`).join("")}</ul>`;
}
