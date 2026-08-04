(() => {
  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-site-nav]");
  const overlay = document.querySelector("[data-nav-overlay]");
  const mobileQuery = window.matchMedia("(max-width: 1120px)");

  const setNavigationState = (open, returnFocus = false) => {
    if (!menuButton || !nav) return;
    const shouldOpen = Boolean(open && mobileQuery.matches);
    nav.dataset.open = String(shouldOpen);
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
    menuButton.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("nav-open", shouldOpen);
    if ("inert" in nav) nav.inert = mobileQuery.matches && !shouldOpen;
    if (returnFocus) menuButton.focus();
  };

  if (menuButton && nav) {
    setNavigationState(false);
    menuButton.addEventListener("click", () => setNavigationState(nav.dataset.open !== "true"));
    overlay?.addEventListener("click", () => setNavigationState(false, true));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setNavigationState(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.dataset.open === "true") setNavigationState(false, true);
      if (event.key === "Tab" && nav.dataset.open === "true") {
        const focusable = [...nav.querySelectorAll("a, button, [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    mobileQuery.addEventListener("change", () => setNavigationState(false));
  }


  const searchDialog = document.querySelector("[data-search-dialog]");
  const searchOpenButtons = [...document.querySelectorAll("[data-search-open]")];
  const searchCloseButton = document.querySelector("[data-search-close]");
  const searchDialogInput = document.querySelector("[data-search-dialog-input]");
  let searchReturnFocus = null;

  const openSearch = (trigger = null) => {
    if (!searchDialog) return;
    searchReturnFocus = trigger || document.activeElement;
    setNavigationState(false);
    if (typeof searchDialog.showModal === "function") searchDialog.showModal();
    else searchDialog.setAttribute("open", "");
    window.setTimeout(() => searchDialogInput?.focus(), 0);
  };

  const closeSearch = () => {
    if (!searchDialog) return;
    if (typeof searchDialog.close === "function" && searchDialog.open) searchDialog.close();
    else searchDialog.removeAttribute("open");
    if (searchReturnFocus instanceof HTMLElement) searchReturnFocus.focus();
  };

  searchOpenButtons.forEach((button) => button.addEventListener("click", () => openSearch(button)));
  searchCloseButton?.addEventListener("click", closeSearch);
  searchDialog?.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearch();
  });
  searchDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSearch();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    const slash = event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (shortcut || slash) {
      event.preventDefault();
      openSearch();
    }
  });

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const searchInput = document.querySelector("[data-story-search]");
  const categorySelect = document.querySelector("[data-category-filter]");
  const storyCards = [...document.querySelectorAll("[data-story-card]")];
  const noResults = document.querySelector("[data-no-results]");
  const resultsCount = document.querySelector("[data-results-count]");

  const filterStories = () => {
    if (!storyCards.length) return;
    const query = (searchInput?.value || "").trim().toLowerCase();
    const category = (categorySelect?.value || "all").toLowerCase();
    let visible = 0;
    storyCards.forEach((card) => {
      const matchesQuery = !query || card.dataset.search.includes(query);
      const matchesCategory = category === "all" || card.dataset.category === category;
      const show = matchesQuery && matchesCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (noResults) noResults.classList.toggle("is-visible", visible === 0);
    if (resultsCount) resultsCount.textContent = `${visible} ${visible === 1 ? "story" : "stories"}`;
  };

  searchInput?.addEventListener("input", filterStories);
  categorySelect?.addEventListener("change", filterStories);
  if (searchInput) {
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) searchInput.value = query;
    filterStories();
  }

  document.querySelectorAll("[data-copy-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        const original = button.textContent;
        button.textContent = "Link copied";
        window.setTimeout(() => { button.textContent = original; }, 1800);
      } catch {
        window.prompt("Copy this page address", window.location.href);
      }
    });
  });

  document.querySelectorAll("img[data-fallback]").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = image.dataset.fallback;
      image.removeAttribute("data-fallback");
    }, { once: true });
  });
})();
