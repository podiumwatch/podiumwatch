// Story page redesign v3 "simple" (2026-10-28): reading progress bar in
// the sticky header, and the share row's copy-link button (its own
// handler, not the sitewide data-copy-link one in site.js -- that one
// swaps the button's own text, which would destroy this button's icon-
// only markup). Share-on-X/Facebook are plain links, no JS needed.
(() => {
  const shell = document.querySelector("[data-story-slug]");
  const story = document.querySelector(".sp-article");
  const bar = document.querySelector("[data-reading-progress]");
  if (shell && story && bar) {
    const updateProgress = () => {
      const rect = story.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const progress = Math.min(1, Math.max(0, (-rect.top + 120) / Math.max(1, total)));
      bar.style.width = `${progress * 100}%`;
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  const copyLinkButton = document.querySelector("[data-sp-copy-link]");
  const toast = document.querySelector("[data-sp-toast]");
  if (copyLinkButton) {
    copyLinkButton.addEventListener("click", () => {
      const showToast = () => {
        if (!toast) return;
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(showToast).catch(() => {});
      }
    });
  }
})();
