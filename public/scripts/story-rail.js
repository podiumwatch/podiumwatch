// Desktop-only prev/next convenience for the homepage story rail. The
// rail itself is a plain CSS scroll-snap container -- touch devices
// already get real swipe for free with no JS at all; this only wires up
// the two arrow buttons (hidden on touch viewports via CSS) and disables
// whichever one has nothing left to scroll to. Never auto-advances.
(() => {
  const rail = document.querySelector("[data-story-rail]");
  const prevButton = document.querySelector("[data-story-rail-prev]");
  const nextButton = document.querySelector("[data-story-rail-next]");
  if (!rail || !prevButton || !nextButton) return;

  function stepDistance() {
    const card = rail.querySelector(".story-card");
    if (!card) return rail.clientWidth;
    const style = getComputedStyle(rail);
    const gap = parseFloat(style.columnGap || style.gap || "0") || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function updateButtons() {
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    prevButton.disabled = rail.scrollLeft <= 4;
    nextButton.disabled = rail.scrollLeft >= maxScroll - 4;
  }

  prevButton.addEventListener("click", () => {
    rail.scrollBy({ left: -stepDistance(), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    rail.scrollBy({ left: stepDistance(), behavior: "smooth" });
  });

  rail.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  updateButtons();
})();
