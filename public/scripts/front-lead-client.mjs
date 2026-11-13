// Homepage lead set (WO-43; site redesign step 7, 2026-11-13). The server
// already put the stories in order (api/pages/home.js: an admin-set lead
// first), so nothing here waits for or swaps the first story. No timer:
// the story changes only on the arrows, the headline tabs, the left and
// right arrow keys while focus is in the block, or a sideways swipe on the
// photo.

const holder = document.querySelector("[data-front-page] [data-front-lead]");
const slides = holder ? [...holder.querySelectorAll(".fl-lead")] : [];

if (slides.length > 1) {
  const picks = [...holder.querySelectorAll("[data-front-pick]")];
  const status = holder.querySelector("[data-front-status]");
  const strip = holder.querySelector(".fl-picks");
  let index = 0;

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === index;
      slide.classList.toggle("is-active", on);
      slide.toggleAttribute("inert", !on);
      if (on) slide.removeAttribute("aria-hidden"); else slide.setAttribute("aria-hidden", "true");
      // Photos of hidden stories load when shown; the next one is fetched ahead.
      const img = slide.querySelector("img[data-src]");
      if (img && (on || i === (index + 1) % slides.length)) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    });
    picks.forEach((pick, i) => pick.setAttribute("aria-pressed", String(i === index)));
    if (strip && strip.scrollWidth > strip.clientWidth) picks[index]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    if (status) status.textContent = `Story ${index + 1} of ${slides.length}: ${slides[index].querySelector(".fl-title")?.textContent || ""}`;
  };

  picks.forEach((pick, i) => pick.addEventListener("click", () => show(i)));
  holder.querySelector("[data-front-next]")?.addEventListener("click", () => show(index + 1));
  holder.querySelector("[data-front-prev]")?.addEventListener("click", () => show(index - 1));
  holder.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") { show(index + 1); event.preventDefault(); }
    if (event.key === "ArrowLeft") { show(index - 1); event.preventDefault(); }
  });
  // Swipe on the photo: a mostly sideways move of 40 px or more.
  const rotator = holder.querySelector("[data-front-rotator]");
  let touch = null;
  rotator?.addEventListener("touchstart", (event) => { const t = event.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  rotator?.addEventListener("touchend", (event) => {
    if (!touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
