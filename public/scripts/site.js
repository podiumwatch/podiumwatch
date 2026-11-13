(() => {
  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-site-nav]");
  const overlay = document.querySelector("[data-nav-overlay]");
  // Site redesign step 1 (2026-11-13): the full menu shows above 1100px;
  // at 1100px and below the menu button opens the drawer
  // (src/styles/main.css, "Redesign shared parts").
  const mobileQuery = window.matchMedia("(max-width: 1100px)");

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
    // The Split Watch dropdown trigger is excluded here -- clicking
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
  // a time, closing every other one first. Split Watch's own
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

  // Split Watch nav dropdown -- see the header comment above
  // splitWatchNavDropdown() in src/lib/html.mjs for the full
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
  // loaded it (e.g. Split Watch's own header uses this same nav).
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
        // straight to that team's Split Watch, no extra click,
        // no re-typing credentials that are already valid.
        window.location.href = "/split-watch/?id=" + encodeURIComponent(teams[0].id);
      } else if (teams.length > 1) {
        // More than one team -- team-dashboard/ already lists every one
        // with its own Split Watch button, so that's the correct
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
  // Story page redesign (2026-10-28), A3: type filter chips alongside
  // the existing category select -- same card pool, one more condition.
  const typeChipButtons = [...document.querySelectorAll("[data-type-chip]")];
  let activeType = "all";

  const filterStories = () => {
    if (!storyCards.length) return;
    const query = (searchInput?.value || "").trim().toLowerCase();
    const category = (categorySelect?.value || "all").toLowerCase();
    let visible = 0;
    storyCards.forEach((card) => {
      const matchesQuery = !query || card.dataset.search.includes(query);
      const matchesCategory = category === "all" || card.dataset.category === category;
      const matchesType = activeType === "all" || card.dataset.type === activeType;
      const show = matchesQuery && matchesCategory && matchesType;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (noResults) noResults.classList.toggle("is-visible", visible === 0);
    if (resultsCount) resultsCount.textContent = `${visible} ${visible === 1 ? "story" : "stories"}`;
  };

  searchInput?.addEventListener("input", filterStories);
  categorySelect?.addEventListener("change", filterStories);
  typeChipButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.typeChip;
      typeChipButtons.forEach((item) => item.classList.toggle("active", item === button));
      filterStories();
    });
  });
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

  // Split Watch mobile placement fix (2026-08-28): the drawer is a
  // straight top-to-bottom accordion on mobile, and Split Watch sat
  // pinned to the very bottom of the whole drawer -- below every content
  // category AND the entire utility cluster (Search/Calculator/Social)
  // -- making it look like entering a race day code was the only way in.
  // Desktop's own position (right-aligned utility cluster) is exactly
  // right and stays completely untouched; this only ever moves the DOM
  // node, and only at mobile widths, to sit right after the Meets group
  // -- easy to find without scrolling past everything else. Round-trips
  // cleanly on resize using the anchor span left in its original spot.
  const splitWatchDropdown = document.querySelector("[data-nav-dropdown-sw]");
  const splitWatchAnchor = document.querySelector("[data-nav-dropdown-sw-anchor]");
  // Redesign: the drawer has its own slot for it (falls back to Meets).
  const meetsGroup = document.querySelector("[data-nav-sw-mobile-slot]") || document.querySelector('[data-nav-group-name="meets"]');
  if (splitWatchDropdown && splitWatchAnchor) {
    const placeSplitWatch = () => {
      if (mobileQuery.matches && meetsGroup) {
        meetsGroup.insertAdjacentElement("afterend", splitWatchDropdown);
      } else {
        splitWatchAnchor.insertAdjacentElement("afterend", splitWatchDropdown);
      }
    };
    placeSplitWatch();
    mobileQuery.addEventListener("change", placeSplitWatch);
  }

  // Mobile dock active state -- compares against pathname+search since
  // Results and Meets deliberately share the same /meets/ pathname,
  // differing only by ?view=.
  const dockLinks = [...document.querySelectorAll("[data-dock-path]")];
  if (dockLinks.length) {
    const currentUrl = window.location.pathname + window.location.search;
    let matched = false;
    dockLinks.forEach((link) => {
      const isHome = link.dataset.dockPath === "/";
      const isMatch = isHome ? window.location.pathname === "/" : currentUrl === link.dataset.dockPath;
      if (isMatch && !matched) {
        link.setAttribute("aria-current", "page");
        matched = true;
      } else {
        link.removeAttribute("aria-current");
      }
    });
    // Meets (bare /meets/, no ?view=) still deserves the dock's Meets tab
    // lit even though it isn't a byte-for-byte match against any single
    // data-dock-path (results carries ?view=results, meets carries none) --
    // handled above by matching the exact current URL, so a visitor on
    // plain /meets/ correctly lights up "Meets," not "Results."
  }

  // Ohio Today ticker (public/scripts/ohio-today.js) -- sitewide, since
  // the ticker itself is shared header chrome on every page. Cached in
  // sessionStorage there, so this costs a real network request only
  // once per few minutes of browsing, not on every single page view.
  const tickerLive = document.querySelector("[data-ticker-live]");
  const tickerHeadline = document.querySelector("[data-ticker-headline]");
  const tickerDetail = document.querySelector("[data-ticker-detail]");
  const tickerMobile = document.querySelector("[data-ticker-mobile]");
  if (tickerHeadline && tickerDetail && tickerMobile && window.PodiumOhioToday) {
    window.PodiumOhioToday.computeOhioToday().then((today) => {
      let headline;
      let detail;
      if (today.todaysMeets.length > 0) {
        headline = "OHIO XC TODAY";
        detail = today.todaysMeets.length === 1 ? "1 meet today" : `${today.todaysMeets.length} meets today`;
      } else if (today.newestCompleted.length > 0) {
        headline = "RESULTS ARE IN";
        detail = today.newestCompleted[0].name;
        // Point at that meet's page, not the calendar (WO-07).
        const tickerLink = document.querySelector("[data-ticker]");
        // State, regional and district meets link to their results hub (WO-37).
        const newestSlug = today.newestCompleted[0].slug || "";
        const hub = newestSlug.match(/^(\d{4})-ohsaa-(state-championships|regional-|district-)/);
        if (tickerLink && hub) tickerLink.href = "/" + (hub[2] === "state-championships" ? "state" : hub[2] === "regional-" ? "regionals" : "districts") + "/" + hub[1] + "/";
        else if (tickerLink && newestSlug) tickerLink.href = "/meetdetail/?slug=" + encodeURIComponent(newestSlug);
      } else if (today.upcomingNext7d.length > 0) {
        headline = "MEETS THIS WEEKEND";
        detail = today.upcomingNext7d.length === 1 ? "1 meet coming up" : `${today.upcomingNext7d.length} meets coming up`;
      } else if (today.nextUpcoming) {
        headline = "NEXT MEET";
        detail = today.nextUpcoming.name;
      } else {
        return; // Evergreen static fallback already in the markup is accurate enough.
      }
      tickerHeadline.textContent = headline;
      tickerDetail.textContent = detail;
      tickerMobile.textContent = `${headline.charAt(0)}${headline.slice(1).toLowerCase()} · ${detail}`;
    }).catch(() => {
      // Ticker failure must never be visible -- the static evergreen
      // fallback markup is already accurate, just less specific.
    });
  }

  // Dated calls to action (WO-07, src/config/season.mjs): anything with
  // data-starts/data-expires shows only inside its window, so it hides on
  // time even when the page was built before the deadline.
  // A page left open across a start or end time updates on its own too
  // (site fixes A3, 2026-11-13): the check runs again at the next boundary.
  // data-show-when="awards-2026-winners" (2026-11-13): also waits until
  // winners are published in every category, from the public awards
  // status (edge-cached). Rechecked every 2 minutes while it is waiting.
  const dated = document.querySelectorAll("[data-expires], [data-starts]");
  if (dated.length) {
    const conditions = {};
    const conditionChecks = {
      "awards-2026-winners": async () => {
        const response = await fetch("/api/awards-2026/status/", { headers: { accept: "application/json" } });
        if (!response.ok) return false;
        const body = await response.json();
        const categories = Array.isArray(body.categories) ? body.categories : [];
        return categories.length > 0 && categories.every((category) => category.status === "published");
      }
    };
    const checkCondition = async (name) => {
      if (conditions[name] || !conditionChecks[name]) return;
      try { conditions[name] = await conditionChecks[name](); } catch { conditions[name] = false; }
      if (conditions[name]) applyDated();
      else setTimeout(() => checkCondition(name), 120000);
    };
    const applyDated = () => {
      const now = Date.now();
      let next = Infinity;
      dated.forEach((node) => {
        const starts = node.dataset.starts ? Date.parse(node.dataset.starts) : NaN;
        const expires = node.dataset.expires ? Date.parse(node.dataset.expires) : NaN;
        const inWindow = (Number.isNaN(starts) || now >= starts) && (Number.isNaN(expires) || now < expires);
        const condition = node.dataset.showWhen;
        if (condition && inWindow && conditions[condition] === undefined) {
          conditions[condition] = false;
          checkCondition(condition);
        }
        const live = inWindow && (!condition || conditions[condition] === true);
        node.hidden = !live;
        if (starts > now) next = Math.min(next, starts);
        if (expires > now) next = Math.min(next, expires);
      });
      // Browsers cap timers at about 24.8 days; past that, a reload handles it.
      if (next !== Infinity && next - now < 2_000_000_000) setTimeout(applyDated, next - now + 250);
    };
    applyDated();
  }

  // Site redesign shared parts (2026-11-13, src/lib/components.mjs).
  // Tabs: on a phone the row scrolls sideways; the active tab is scrolled
  // into view on load.
  document.querySelectorAll("[data-pw-tabs]").forEach((row) => {
    const active = row.querySelector('[aria-current="page"], [aria-selected="true"]');
    if (active && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2);
  });
  // "Show more": the hidden rows are already in the HTML; one click shows
  // them in place and the button goes away.
  document.querySelectorAll("[data-pw-more]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.getAttribute("aria-controls"));
      if (!target) return;
      target.querySelectorAll("[data-pw-more-row]").forEach((row) => { row.hidden = false; });
      button.setAttribute("aria-expanded", "true");
      button.hidden = true;
    });
  });
})();
