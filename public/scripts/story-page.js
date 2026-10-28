// Story page redesign (2026-10-28): reading progress bar in the sticky
// header, sticky "On this page" scroll-spy, and the "How we reported
// this" box's copy-email button. Copy link / share buttons are handled
// globally by site.js (data-copy-link is already wired up sitewide).
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

  const tocLinks = Array.from(document.querySelectorAll("[data-sp-toc] a"));
  if (tocLinks.length) {
    const sections = tocLinks.map((link) => document.querySelector(link.getAttribute("href")));
    const spy = () => {
      let activeIndex = 0;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top < 160) activeIndex = index;
      });
      tocLinks.forEach((link, index) => link.classList.toggle("sp-on", index === activeIndex));
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  const copyMailButton = document.querySelector("[data-copy-mail]");
  if (copyMailButton) {
    copyMailButton.addEventListener("click", () => {
      const mailCode = copyMailButton.previousElementSibling;
      const address = mailCode ? mailCode.textContent.trim() : "media@podiumwatch.org";
      const originalLabel = copyMailButton.textContent;
      const showCopied = () => {
        copyMailButton.textContent = "Copied";
        setTimeout(() => { copyMailButton.textContent = originalLabel; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(showCopied).catch(() => {});
      }
    });
  }
})();
