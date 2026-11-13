// Front page lead block (WO-43). One renderer for both sides: the static
// build (scripts/build.mjs imports this file) draws the lead set from the
// newest stories, and the browser (front-lead-client.mjs) redraws it with
// the lead and picks an admin set.
// A story shape: { slug, href, title, summary, kicker, image_url,
// image_alt, image_credit, byline, story_date }.
// No real photo means a type-only headline, never a stock image.
//
// Homepage redesign (2026-11-13, step 7): click-through, not a timer.
// The story changes only when the reader uses the arrows, the headline
// tabs or a swipe (Zachary approved; auto-rotate stays off unless he asks
// for it). All slides sit in one grid cell so the block keeps the height
// of the tallest one and nothing below jumps.

export const ROTATION_MAX = 8;

// The cover (Zachary, 2026-11-13): a newly published story always takes
// over. A lead set by hand in admin holds only until a story dated after
// the day it was set (Ohio time) is published; then the newest story is
// the cover again. Pure, so the server and the tests agree.
const ohioDay = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};
export function handLeadHolds(lead, newestStory) {
  if (!lead) return false;
  const newest = String(newestStory?.story_date || newestStory?.date || "").slice(0, 10);
  const setOn = lead.starts_at ? ohioDay(lead.starts_at) : "";
  if (!newest || !setOn) return true;
  return newest <= setOn || newestStory?.slug === lead.story_slug;
}

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function storyDateLabel(iso) {
  const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const imageStyle = (story) => story.image_fit === "contain"
  ? ' style="object-fit:contain;background:#090909"'
  : /^[a-z0-9%. ]{1,40}$/i.test(String(story.image_position || "")) ? ` style="object-position:${esc(story.image_position)}"` : "";

export function frontLeadHtml(story, { first = true, index = 0, total = 1 } = {}) {
  const date = storyDateLabel(story.story_date);
  const meta = [story.byline ? `By ${esc(story.byline)}` : "", date ? esc(date) : ""].filter(Boolean).join(" &middot; ");
  // Only the first photo loads with the page. The others carry data-src and
  // load when their story is shown, or just before (front-lead-client.mjs):
  // stacked under the visible slide, a lazy image would still download.
  const media = story.image_url
    ? `<figure class="fl-media"><a href="${esc(story.href)}" tabindex="-1" aria-hidden="true"><img ${first ? "src" : "data-src"}="${esc(story.image_url)}" alt="${esc(story.image_alt || "")}" width="1200" height="675"${imageStyle(story)} ${first ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a>${story.image_credit ? `<figcaption>Photo: ${esc(story.image_credit)}</figcaption>` : ""}</figure>`
    : "";
  const heading = first ? "h1" : "h2";
  return `<div class="fl-lead${story.image_url ? "" : " is-type"}${first ? " is-active" : ""}" data-front-lead-slug="${esc(story.slug)}"${total > 1 ? ` role="group" aria-roledescription="slide" aria-label="${index + 1} of ${total}"` : ""}${first ? "" : ' aria-hidden="true" inert'}>
    ${media}
    <div class="fl-body">
      ${story.kicker ? `<p class="fl-kicker">${esc(story.kicker)}</p>` : ""}
      <${heading} class="fl-title"><a href="${esc(story.href)}">${esc(story.title)}</a></${heading}>
      ${story.summary ? `<p class="fl-summary">${esc(story.summary)}</p>` : ""}
      ${meta ? `<p class="fl-meta">${meta}</p>` : ""}
      <a class="fl-button" href="${esc(story.href)}">Read the story</a>
    </div>
  </div>`;
}

// The lead set: slides, previous and next arrows on the photo, and one
// headline tab per story (on a phone the tabs become small progress bars).
export function frontRotatorHtml(stories) {
  const list = (stories || []).slice(0, ROTATION_MAX);
  if (!list.length) return "";
  const slides = list.map((story, index) => frontLeadHtml(story, { first: index === 0, index, total: list.length })).join("");
  if (list.length === 1) return `<div class="fl-rotator" data-front-rotator>${slides}</div>`;
  const tabs = list.map((story, index) => `<li><button type="button" class="fl-pick" data-front-pick="${index}" aria-pressed="${index === 0}" aria-label="Story ${index + 1} of ${list.length}: ${esc(story.title)}"><span class="fl-pick-kicker">${esc(story.kicker || "Podium Watch")}</span><span class="fl-pick-title">${esc(story.title)}</span></button></li>`).join("");
  const arrow = (dir) => `<button type="button" class="fl-arrow fl-arrow-${dir}" data-front-${dir} aria-label="${dir === "next" ? "Next" : "Previous"} story"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="${dir === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="square"/></svg></button>`;
  return `<div class="fl-rotator" data-front-rotator aria-roledescription="carousel" aria-label="Top stories">${slides}${arrow("prev")}${arrow("next")}</div>
  <ol class="fl-picks" aria-label="Choose a story">${tabs}</ol>
  <p class="visually-hidden" aria-live="polite" data-front-status></p>`;
}

// Kept for the archive and older callers: a plain list of stories.
export function frontAlsoHtml(stories) {
  if (!stories.length) return "";
  return `<h2 class="fl-also-title">Also on the front page</h2><ul class="fl-also-list${stories.length >= 4 ? " is-four" : ""}">${stories.map((story) => `<li><a href="${esc(story.href)}">${story.image_url ? `<img src="${esc(story.image_url)}" alt="" width="320" height="180" loading="lazy">` : `<span class="fl-also-type">${esc(story.kicker || "Podium Watch")}</span>`}<span><small>${esc(story.kicker || "")}</small><strong>${esc(story.title)}</strong></span></a></li>`).join("")}</ul>`;
}
