(() => {
  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-site-nav]");
  const overlay = document.querySelector("[data-nav-overlay]");
  const mobileQuery = window.matchMedia("(max-width: 1320px)");

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
    // The Race Command Center dropdown trigger is excluded here -- clicking
    // it opens/closes its own submenu (below), it must not also collapse
    // the whole mobile nav out from under that submenu. The two real
    // destination links inside the submenu are still plain <a> tags this
    // selector still matches, so choosing either of them closes the mobile
    // nav exactly like every other nav link already does.
    nav.querySelectorAll("a:not([data-nav-dropdown-trigger])").forEach((link) => link.addEventListener("click", () => setNavigationState(false)));
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

  // Content-nav dropdown groups (Rankings, Meets, Teams & Schools,
  // Athletes, Voting, More -- NAVIGATION_REBUILD_SPEC.md, 2026-08-21).
  // One shared click-to-toggle mechanism drives both the desktop floating
  // panel and the mobile in-flow accordion (CSS alone decides which one
  // renders, at the 1320px breakpoint) -- only one group is ever open at
  // a time, closing every other one first. Race Command Center's own
  // dropdown (below) is deliberately NOT part of this coordination -- its
  // logic is untouched from 2026-08-21, it manages its own open state
  // completely independently.
  const navGroupControls = [...document.querySelectorAll("[data-nav-group]")].map((group) => {
    const trigger = group.querySelector("[data-nav-group-trigger]");
    return {
      group,
      trigger,
      setOpen(open) {
        group.dataset.open = String(open);
        trigger?.setAttribute("aria-expanded", String(open));
      }
    };
  }).filter((control) => control.trigger);

  navGroupControls.forEach((control) => {
    control.trigger.addEventListener("click", () => {
      const willOpen = control.group.dataset.open !== "true";
      navGroupControls.forEach((other) => other.setOpen(other === control && willOpen));
    });
  });

  document.addEventListener("click", (event) => {
    navGroupControls.forEach((control) => {
      if (control.group.dataset.open === "true" && !control.group.contains(event.target)) control.setOpen(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") navGroupControls.forEach((control) => control.setOpen(false));
  });

  // Race Command Center nav dropdown -- see the header comment above
  // raceCommandCenterNavDropdown() in src/lib/html.mjs for the full
  // rationale. Hover already reveals the panel via CSS alone; this adds
  // click-to-toggle (the only thing that works on touch) and the "Coach
  // Sign In" smart redirect.
  const navDropdown = document.querySelector("[data-nav-dropdown]");
  const navDropdownTrigger = document.querySelector("[data-nav-dropdown-trigger]");
  const coachLink = document.querySelector("[data-nav-coach-link]");

  if (navDropdown && navDropdownTrigger) {
    const setDropdownOpen = (open) => {
      navDropdown.dataset.open = String(open);
      navDropdownTrigger.setAttribute("aria-expanded", String(open));
    };

    navDropdownTrigger.addEventListener("click", (event) => {
      // A real href (the join page) stays as the no-JS fallback -- only
      // intercept the click once we know this code is actually running.
      event.preventDefault();
      setDropdownOpen(navDropdown.dataset.open !== "true");
    });

    document.addEventListener("click", (event) => {
      if (navDropdown.dataset.open === "true" && !navDropdown.contains(event.target)) setDropdownOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navDropdown.dataset.open === "true") setDropdownOpen(false);
    });
  }

  // Lazily loads the same Supabase client + team-auth-client.js every
  // team-specific page already loads -- only fetched the first time a
  // visitor actually clicks "Coach Sign In" on a page that hasn't already
  // loaded them, so the other 99% of (non-coach) page views never pay for
  // it. Reuses window.PodiumTeamAuth directly if a team page already
  // loaded it (e.g. Race Command Center's own header uses this same nav).
  function ensureTeamAuthClient() {
    if (window.PodiumTeamAuth) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const supabaseScript = document.createElement("script");
      supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0";
      supabaseScript.onload = () => {
        const clientScript = document.createElement("script");
        clientScript.src = "/scripts/team-auth-client.js";
        clientScript.onload = () => resolve();
        clientScript.onerror = () => reject(new Error("Team account library failed to load."));
        document.head.appendChild(clientScript);
      };
      supabaseScript.onerror = () => reject(new Error("Secure account library failed to load."));
      document.head.appendChild(supabaseScript);
    });
  }

  coachLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    const originalText = coachLink.textContent;
    coachLink.textContent = "Checking...";
    try {
      await ensureTeamAuthClient();
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) {
        window.location.href = "/team-login/";
        return;
      }
      const accessToken = await window.PodiumTeamAuth.getAccessToken();
      const response = await fetch("/api/team/me/", {
        headers: { Accept: "application/json", Authorization: "Bearer " + accessToken }
      });
      const data = await response.json().catch(() => ({}));
      const teams = Array.isArray(data.teams) ? data.teams : [];
      if (teams.length === 1) {
        // Exactly one team -- this is the whole point of the feature:
        // straight to that team's Race Command Center, no extra click,
        // no re-typing credentials that are already valid.
        window.location.href = "/race-command-center/?id=" + encodeURIComponent(teams[0].id);
      } else if (teams.length > 1) {
        // More than one team -- team-dashboard/ already lists every one
        // with its own Race Command Center button, so that's the correct
        // "let the coach pick" landing spot rather than guessing.
        window.location.href = "/team-dashboard/";
      } else {
        window.location.href = "/team-dashboard/";
      }
    } catch {
      // Not actually signed in, or the team account library couldn't
      // load -- either way, /team-login/ is the correct, safe fallback.
      window.location.href = "/team-login/";
    } finally {
      coachLink.textContent = originalText;
    }
  });


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
