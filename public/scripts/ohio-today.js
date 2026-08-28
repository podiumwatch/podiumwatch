// Shared "what's happening in Ohio right now" data layer -- powers both
// the sitewide header ticker (every page) and the homepage's Ohio Today
// card (home page only). Reuses the exact same /api/meets/ endpoint the
// Meet Center itself calls -- there is deliberately no second, separate
// static list of meets anywhere on the site.
//
// "Today" is always Ohio's own calendar day (America/New_York), computed
// fresh on every page load via Intl.DateTimeFormat with an explicit
// timeZone -- never the visitor's own device timezone/date, and never a
// value baked in at build time (a static build-time "today" would just
// go stale the moment the calendar day changes, the exact bug this file
// exists to fix).
(() => {
  const CACHE_KEY = "podium_ohio_today_cache_v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function ohioDateKey(date = new Date()) {
    // en-CA gives YYYY-MM-DD directly, no manual reassembly.
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
  }

  function dateKey(value) {
    return String(value || "").slice(0, 10);
  }

  function addDaysToKey(key, days) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  async function fetchMeets() {
    try {
      const cachedRaw = sessionStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && Array.isArray(cached.meets)) {
          return cached.meets;
        }
      }
    } catch {
      // Corrupt/unavailable cache -- fall through to a real fetch.
    }

    const response = await fetch("/api/meets/", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Meets could not be loaded.");
    const meets = Array.isArray(data.meets) ? data.meets : [];
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), meets }));
    } catch {
      // Storage full/unavailable -- not fatal, just skip the cache.
    }
    return meets;
  }

  // The one shared computation both the ticker and the Ohio Today card
  // draw from, so the two can never disagree with each other about what
  // "today" means.
  async function computeOhioToday() {
    const meets = await fetchMeets();
    const today = ohioDateKey();
    const weekendEnd = addDaysToKey(today, 7);

    const todaysMeets = meets
      .filter((meet) => dateKey(meet.meet_date) === today)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const upcoming = meets
      .filter((meet) => {
        const key = dateKey(meet.meet_date);
        return key > today;
      })
      .sort((a, b) => dateKey(a.meet_date).localeCompare(dateKey(b.meet_date)));

    const upcomingNext7d = upcoming.filter((meet) => dateKey(meet.meet_date) <= weekendEnd);

    const completed = meets
      .filter((meet) => {
        const finalKey = dateKey(meet.end_date || meet.meet_date);
        return finalKey && finalKey < today;
      })
      .sort((a, b) => dateKey(b.end_date || b.meet_date).localeCompare(dateKey(a.end_date || a.meet_date)));

    return {
      today,
      todaysMeets,
      upcoming,
      upcomingNext7d,
      nextUpcoming: upcoming[0] || null,
      completed,
      newestCompleted: completed.slice(0, 3)
    };
  }

  window.PodiumOhioToday = { computeOhioToday, ohioDateKey, dateKey };
})();
