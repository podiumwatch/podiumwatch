import { frontRotatorHtml, ROTATION_MAX, ROTATION_MS } from "./front-lead.mjs";

// Homepage (WO-43): the lead rotates every 8 seconds through up to 8
// stories. The build draws the 8 newest; here an admin-set lead goes first
// and stories an admin placed in the rotation by hand come right after it,
// then the newest fill the rest. Stories in the rotation are hidden from
// the Latest Stories rail. Failure is silent: the built rotation is real.
//
// The timer pauses while the pointer or keyboard focus is on the block,
// while it is off-screen or the tab is hidden, and when the reader presses
// Pause. With reduced motion it never advances on its own; the strip
// still switches stories.

const root = document.querySelector("[data-front-page]");
const candidatesNode = document.querySelector("[data-front-candidates]");
const holder = root?.querySelector("[data-front-lead]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let stop = () => {};

function start() {
  stop();
  const slides = [...holder.querySelectorAll(".fl-lead")];
  const picks = [...holder.querySelectorAll("[data-front-pick]")];
  const toggle = holder.querySelector("[data-front-toggle]");
  if (slides.length < 2) return;
  const controller = new AbortController();
  const opts = { signal: controller.signal };
  let index = 0;
  let timer = null;
  let userPaused = false;
  let hover = false;
  let visible = true;

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === index;
      slide.classList.toggle("is-active", on);
      slide.toggleAttribute("inert", !on);
      if (on) slide.removeAttribute("aria-hidden"); else slide.setAttribute("aria-hidden", "true");
      const img = slide.querySelector("img[loading=lazy]");
      if (img && (on || i === (index + 1) % slides.length)) img.loading = "eager"; // preload the next one
    });
    picks.forEach((pick, i) => {
      pick.classList.toggle("is-active", i === index);
      if (i === index) pick.setAttribute("aria-current", "true"); else pick.removeAttribute("aria-current");
    });
    restartBar();
  };
  const running = () => !reduceMotion && !userPaused && !hover && visible && !document.hidden;
  // The thin bar on the active strip item fills over the 8 seconds.
  const restartBar = () => {
    holder.style.setProperty("--fl-ms", `${ROTATION_MS}ms`);
    holder.classList.toggle("is-running", running());
    const bar = picks[index]?.querySelector(".fl-pick-bar span");
    if (bar) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
  };
  const schedule = () => {
    clearTimeout(timer);
    holder.classList.toggle("is-running", running());
    if (running()) timer = setTimeout(() => { show(index + 1); schedule(); }, ROTATION_MS);
  };

  picks.forEach((pick, i) => pick.addEventListener("click", () => { show(i); schedule(); }, opts));
  // Arrows on the lead: step through the stories; the timer starts over.
  holder.querySelector("[data-front-next]")?.addEventListener("click", () => { show(index + 1); schedule(); }, opts);
  holder.querySelector("[data-front-prev]")?.addEventListener("click", () => { show(index - 1); schedule(); }, opts);
  const onToggle = () => {
    userPaused = !userPaused;
    toggle.textContent = userPaused ? "Play" : "Pause";
    toggle.setAttribute("aria-pressed", String(userPaused));
    restartBar();
    schedule();
  };
  toggle?.addEventListener("click", onToggle, opts);
  if (reduceMotion && toggle) toggle.hidden = true;
  const enter = () => { hover = true; schedule(); };
  const leave = () => { hover = false; restartBar(); schedule(); };
  holder.addEventListener("pointerenter", enter, opts);
  holder.addEventListener("pointerleave", leave, opts);
  holder.addEventListener("focusin", enter, opts);
  holder.addEventListener("focusout", (event) => { if (!holder.contains(event.relatedTarget)) leave(); }, opts);
  document.addEventListener("visibilitychange", () => { restartBar(); schedule(); }, opts);
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restartBar(); schedule(); }, { threshold: 0.25 }) : null;
  observer?.observe(holder);
  restartBar();
  schedule();
  stop = () => { clearTimeout(timer); observer?.disconnect(); controller.abort(); };
}

function hideRepeats(slugs) {
  const shown = new Set(slugs);
  document.querySelectorAll("[data-story-rail] a[href^='/stories/']").forEach((link) => {
    const slug = link.getAttribute("href").split("/")[2];
    const card = link.closest(".story-card");
    if (card) card.hidden = shown.has(slug);
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
      const add = (story) => { if (story?.slug && !seen.has(story.slug) && order.length < ROTATION_MAX) { seen.add(story.slug); order.push({ ...story, image_position: story.image_position || bySlug.get(story.slug)?.image_position || null }); } };
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
