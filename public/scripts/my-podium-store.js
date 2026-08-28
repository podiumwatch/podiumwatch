// Shared My Podium preference store -- the one place preferences are
// read from and written to. Used by the homepage's Follow Your School
// panel and promo/preview card, and by /my-podium/ itself, so a
// preference set anywhere on the site shows up everywhere else without a
// second copy of this logic. Device-local only (localStorage) -- no
// account, no server round trip, no personal information. See
// docs/MY_PODIUM_MASTER_BUILD_PLAN.md Project 2.3 for the full schema
// rationale.
(() => {
  const STORAGE_KEY = "podiumWatch.myPodium.v1";
  const LEGACY_FOLLOW_KEY = "podium_followed_school";
  const SCHEMA_VERSION = 1;
  const listeners = new Set();

  function emptyPreferences() {
    return { schemaVersion: SCHEMA_VERSION, team: null, athletes: [], updatedAt: null };
  }

  // Every read goes through here, so a corrupted value, a future schema
  // version this copy of the site doesn't understand yet, or storage
  // being unavailable at all (private browsing, quota, a browser setting)
  // all land on the same safe, valid, empty shape -- the page always has
  // something real to render rather than throwing.
  function readRaw() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeRaw(preferences) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage full/unavailable -- the in-memory value below still
      // powers this one page view, it just won't survive a reload.
    }
  }

  // One-time migration from this project's earlier, narrower "Follow
  // Your School" homepage feature (podium_followed_school, no sport,
  // gender, or athletes) into this richer, canonical store -- so
  // whoever already used that panel doesn't lose their pick, and the
  // site ends up with exactly one preference store, not two.
  function migrateLegacyFollow(current) {
    if (current) return current;
    try {
      const legacyRaw = window.localStorage.getItem(LEGACY_FOLLOW_KEY);
      if (!legacyRaw) return null;
      const legacy = JSON.parse(legacyRaw);
      if (!legacy || !legacy.id || !legacy.slug) return null;
      const migrated = {
        schemaVersion: SCHEMA_VERSION,
        team: {
          id: legacy.id,
          slug: legacy.slug,
          schoolName: legacy.school_name || "",
          sport: null,
          gender: null
        },
        athletes: [],
        updatedAt: new Date().toISOString()
      };
      writeRaw(migrated);
      window.localStorage.removeItem(LEGACY_FOLLOW_KEY);
      return migrated;
    } catch {
      return null;
    }
  }

  function notify() {
    const current = getPreferences();
    listeners.forEach((callback) => {
      try {
        callback(current);
      } catch {
        // A listener throwing must never break the store for every
        // other listener/caller.
      }
    });
  }

  function getPreferences() {
    const stored = readRaw() || migrateLegacyFollow(readRaw());
    return stored ? { ...emptyPreferences(), ...stored } : emptyPreferences();
  }

  function hasPreferences() {
    const preferences = getPreferences();
    return Boolean(preferences.team) || preferences.athletes.length > 0;
  }

  function setTeam(team) {
    if (!team || !team.id || !team.slug) return getPreferences();
    const current = getPreferences();
    const next = {
      ...current,
      team: {
        id: team.id,
        slug: team.slug,
        schoolName: team.schoolName || team.school_name || "",
        sport: team.sport || null,
        gender: team.gender || null
      },
      updatedAt: new Date().toISOString()
    };
    writeRaw(next);
    notify();
    return next;
  }

  function clearTeam() {
    const current = getPreferences();
    const next = { ...current, team: null, updatedAt: new Date().toISOString() };
    writeRaw(next);
    notify();
    return next;
  }

  function addAthlete(athlete) {
    if (!athlete || !athlete.id) return getPreferences();
    const current = getPreferences();
    if (current.athletes.some((item) => item.id === athlete.id)) return current;
    const next = {
      ...current,
      athletes: [...current.athletes, {
        id: athlete.id,
        slug: athlete.slug || null,
        displayName: athlete.displayName || athlete.display_name || ""
      }],
      updatedAt: new Date().toISOString()
    };
    writeRaw(next);
    notify();
    return next;
  }

  function removeAthlete(athleteId) {
    const current = getPreferences();
    const next = {
      ...current,
      athletes: current.athletes.filter((item) => item.id !== athleteId),
      updatedAt: new Date().toISOString()
    };
    writeRaw(next);
    notify();
    return next;
  }

  function clearAll() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage was never available.
    }
    notify();
    return emptyPreferences();
  }

  function onChange(callback) {
    if (typeof callback !== "function") return () => {};
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // Uses the site's existing Vercel Analytics queue (window.va, already
  // injected sitewide in src/lib/html.mjs's layout()) rather than adding
  // a new analytics vendor. `data` must only ever be generic categories
  // (a card name, a step number) -- never an athlete name, school
  // selection, or any free text a visitor typed; every call site in this
  // project is written to pass only static strings/counts, and this
  // wrapper is the one place that would need to change if that ever
  // needed enforcing more strictly.
  function trackEvent(name, data) {
    try {
      if (typeof window.va === "function") window.va("event", { name, data: data || {} });
    } catch {
      // Analytics must never break the page it's measuring.
    }
  }

  window.PodiumMyPodiumStore = {
    getPreferences, hasPreferences, setTeam, clearTeam, addAthlete, removeAthlete, clearAll, onChange, trackEvent
  };
})();
