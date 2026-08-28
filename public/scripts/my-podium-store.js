// Shared My Podium preference store -- the one place preferences are
// read from and written to. Used by the homepage's Follow Your School
// panel and promo/preview card, and by /my-podium/ itself, so a
// preference set anywhere on the site shows up everywhere else without a
// second copy of this logic. Device-local (localStorage) by default --
// no account, no server round trip, no personal information. An
// optional account-based sync layer (public/scripts/my-podium-sync.js,
// Project 5 Slice B) can pull a remote copy in through
// applyRemotePreferences() below, but this file itself still never
// makes a network request and still never stores an email, password, or
// any of the fields listed in docs/MY_PODIUM_MASTER_BUILD_PLAN.md's
// "do not store" list. See that doc's Project 2.3 for the full schema
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
    // Carry the "already asked for alerts" flag over only when it's
    // still the same team -- switching schools should re-offer alerts
    // for the new one rather than silently suppressing the form based
    // on a request that was about a different school entirely.
    const alertsRequestedAt = current.team && current.team.id === team.id
      ? current.team.alertsRequestedAt || null
      : null;
    const next = {
      ...current,
      team: {
        id: team.id,
        slug: team.slug,
        schoolName: team.schoolName || team.school_name || "",
        sport: team.sport || null,
        gender: team.gender || null,
        alertsRequestedAt
      },
      updatedAt: new Date().toISOString()
    };
    writeRaw(next);
    notify();
    return next;
  }

  // Marks that this device already asked to follow the currently-set
  // team's email alerts (Project 5 Slice A) -- a bare, non-PII
  // timestamp, never the email address itself (that goes straight from
  // the form to POST /api/followers/subscribe and is never persisted
  // here). Used only to avoid re-showing the capture form; the real
  // subscription state lives in Supabase and is managed through the
  // existing /follow/?token= page, not here.
  function markAlertsRequested() {
    const current = getPreferences();
    if (!current.team) return current;
    const next = {
      ...current,
      team: { ...current.team, alertsRequestedAt: new Date().toISOString() }
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

  // Called only by public/scripts/my-podium-sync.js, after it has
  // already decided (by comparing timestamps against the signed-in
  // user's synced copy) that the remote preferences should replace the
  // local ones -- this function itself stays a dumb, defensive write,
  // exactly like readRaw()'s own posture: reject anything that isn't a
  // real preference object in the schema version this copy of the site
  // understands, rather than trusting a network response blindly.
  function applyRemotePreferences(remote) {
    if (!remote || typeof remote !== "object" || remote.schemaVersion !== SCHEMA_VERSION) {
      return getPreferences();
    }
    writeRaw(remote);
    notify();
    return remote;
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
    getPreferences, hasPreferences, setTeam, clearTeam, addAthlete, removeAthlete, clearAll, onChange, trackEvent,
    markAlertsRequested, applyRemotePreferences
  };
})();
