import { frontRotatorHtml, ROTATION_MAX } from "./front-lead.mjs";

// Homepage (WO-43): the lead set holds up to 8 stories. The build draws the
// 8 newest; here an admin-set lead goes first and stories an admin placed
// in the set by hand come right after it, then the newest fill the rest.
// Stories in the lead set are hidden from "More from the newsroom".
// Failure is silent: the built set is real.
//
// Homepage redesign (2026-11-13, step 7): no timer. The story changes
// only on the arrows, the headline tabs, the left and right arrow keys
// while focus is in the block, or a sideways swipe on the photo.

const root = document.querySelector("[data-front-page]");
const candidatesNode = document.querySelector("[data-front-candidates]");
const holder = root?.querySelector("[data-front-lead]");
let stop = () => {};

function start() {
  stop();
  const slides = [...holder.querySelectorAll(".fl-lead")];
  const picks = [...holder.querySelectorAll("[data-front-pick]")];
  const status = holder.querySelector("[data-front-status]");
  if (slides.length < 2) return;
  const controller = new AbortController();
  const opts = { signal: controller.signal };
  let index = 0;

  const show = (next, { announce = true } = {}) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === index;
      slide.classList.toggle("is-active", on);
      slide.toggleAttribute("inert", !on);
      if (on) slide.removeAttribute("aria-hidden"); else slide.setAttribute("aria-hidden", "true");
      // Photos of hidden stories load when shown; once the reader starts
      // clicking through, the next photo is fetched ahead.
      const img = slide.querySelector("img[data-src]");
      if (img && (on || (announce && i === (index + 1) % slides.length))) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    });
    picks.forEach((pick, i) => pick.setAttribute("aria-pressed", String(i === index)));
    const active = picks[index];
    if (active && active.scrollIntoView && holder.querySelector(".fl-picks")?.scrollWidth > holder.querySelector(".fl-picks")?.clientWidth) {
      active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
    if (announce && status) status.textContent = `Story ${index + 1} of ${slides.length}: ${slides[index].querySelector(".fl-title")?.textContent || ""}`;
  };

  picks.forEach((pick, i) => pick.addEventListener("click", () => show(i), opts));
  holder.querySelector("[data-front-next]")?.addEventListener("click", () => show(index + 1), opts);
  holder.querySelector("[data-front-prev]")?.addEventListener("click", () => show(index - 1), opts);
  holder.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea")) return;
    if (event.key === "ArrowRight") { show(index + 1); event.preventDefault(); }
    if (event.key === "ArrowLeft") { show(index - 1); event.preventDefault(); }
  }, opts);
  // Swipe on the photo: a mostly sideways move of 40 px or more.
  const rotator = holder.querySelector("[data-front-rotator]");
  let touch = null;
  rotator?.addEventListener("touchstart", (event) => { const t = event.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { ...opts, passive: true });
  rotator?.addEventListener("touchend", (event) => {
    if (!touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
  }, { ...opts, passive: true });
  show(0, { announce: false });
  stop = () => controller.abort();
}

function hideRepeats(slugs) {
  const shown = new Set(slugs);
  // The newsroom row shows its first four cards that are not in the lead set.
  const cards = [...document.querySelectorAll("[data-home-cards] [data-story-slug]")];
  let visible = 0;
  cards.forEach((card) => {
    const keep = !shown.has(card.getAttribute("data-story-slug")) && visible < 4;
    card.hidden = !keep;
    if (keep) visible += 1;
  });
}

if (root && candidatesNode && holder) {
  const candidates = JSON.parse(candidatesNode.textContent || "[]");
  const builtSlugs = [...holder.querySelectorAll("[data-front-lead-slug]")].map((n) => n.getAttribute("data-front-lead-slug"));
  // Always start on the lead (Zachary, 2026-11-10): the built page doesn't
  // know the admin-set lead, so the block keeps its space but stays
  // invisible until the lead is known (or 1.2 s pass), then starts at the
  // first story.
  let shown = false;
  const reveal = (order) => {
    if (shown) return;
    shown = true;
    if (order) { holder.innerHTML = frontRotatorHtml(order); hideRepeats(order.map((s) => s.slug)); }
    holder.classList.remove("is-pending");
    start();
  };
  holder.classList.add("is-pending");
  setTimeout(() => reveal(null), 1200);
  fetch("/api/front-page/current/", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || (!data.lead && !(data.also || []).length)) return reveal(null);
      const seen = new Set();
      const order = [];
      // Admin rows don't store the story's crop point; take it from the
      // built story list so faces stay in frame.
      const bySlug = new Map(candidates.map((s) => [s.slug, s]));
      const add = (story) => { if (story?.slug && !seen.has(story.slug) && order.length < ROTATION_MAX) { seen.add(story.slug); order.push({ ...story, image_position: story.image_position || bySlug.get(story.slug)?.image_position || null, image_fit: story.image_fit || bySlug.get(story.slug)?.image_fit || null }); } };
      // An admin lead keeps its own photo, kicker and credit.
      if (data.lead) add({ ...data.lead, slug: data.lead.story_slug });
      for (const pick of data.also || []) add({ ...pick, slug: pick.story_slug });
      for (const story of candidates) add(story);
      const same = order.map((s) => s.slug).join("|") === builtSlugs.join("|") && !data.lead;
      if (shown && !same) {
        // Arrived after the fallback: redraw, still starting on the lead.
        holder.innerHTML = frontRotatorHtml(order);
        hideRepeats(order.map((s) => s.slug));
        start();
        return;
      }
      reveal(same ? null : order);
    })
    .catch(() => reveal(null));
}
