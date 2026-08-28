// My Podium account sync (Project 5, Slice B) -- an optional layer on
// top of public/scripts/my-podium-store.js's device-local preferences.
// Depends on window.PodiumMyPodiumStore (the local store) and
// window.PodiumTeamAuth (the shared Supabase session wrapper every
// account tier already uses). Never runs any network request for a
// signed-out visitor beyond one local, no-network session check --
// accountless My Podium stays exactly as fast as it already was.
(() => {
  const store = window.PodiumMyPodiumStore;
  if (!store) return;

  let client = null;
  let signedIn = false;
  let lastSyncedAt = null;
  let pushTimer = null;
  let reconciling = false;

  async function getClient() {
    if (!client) client = await window.PodiumTeamAuth.getClient();
    return client;
  }

  async function authedFetch(url, options = {}) {
    const token = await window.PodiumTeamAuth.getAccessToken();
    if (!token) throw new Error("Not signed in.");
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function pushNow() {
    if (!signedIn) return;
    const preferences = store.getPreferences();
    try {
      const result = await authedFetch("/api/my-podium/sync", {
        method: "POST",
        body: JSON.stringify({ preferences, client_updated_at: preferences.updatedAt })
      });
      lastSyncedAt = new Date().toISOString();
      // The server is the final word on conflicts -- if it reports a
      // newer stored state than what was just pushed (another device
      // won the race), reconcile this device down to match rather than
      // silently disagreeing with it.
      if (result.conflict && result.preferences) {
        store.applyRemotePreferences(result.preferences);
      }
    } catch {
      // A failed push must never break the page it's syncing -- the
      // local preferences already saved fine; the next change (or the
      // next page load's reconcile()) will simply try again.
    }
  }

  function schedulePush() {
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(pushNow, 800);
  }

  function hasRemoteData(preferences) {
    return Boolean(preferences && (preferences.team || (preferences.athletes || []).length));
  }

  function newer(aIso, bIso) {
    const a = aIso ? new Date(aIso).getTime() : 0;
    const b = bIso ? new Date(bIso).getTime() : 0;
    return Number.isFinite(a) && a > b;
  }

  async function reconcile() {
    if (reconciling) return;
    reconciling = true;
    try {
      const supabase = await getClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        signedIn = false;
        return;
      }
      signedIn = true;

      const remote = await authedFetch("/api/my-podium/me");
      const localPreferences = store.getPreferences();
      const hasLocal = store.hasPreferences();
      const hasRemote = hasRemoteData(remote.preferences);

      if (!hasRemote) {
        if (hasLocal) await pushNow();
        // Neither side has anything real -- nothing to reconcile.
      } else if (!hasLocal) {
        store.applyRemotePreferences(remote.preferences);
      } else if (newer(localPreferences.updatedAt, remote.client_updated_at)) {
        await pushNow();
      } else {
        store.applyRemotePreferences(remote.preferences);
      }

      lastSyncedAt = new Date().toISOString();
      store.onChange(() => { if (signedIn) schedulePush(); });
    } catch {
      // Sign-in state genuinely unknown (network, config) -- fail into
      // the safe default: treat this load as signed-out/accountless so
      // the page is still fully usable, and let the next load retry.
      signedIn = false;
    } finally {
      reconciling = false;
    }
  }

  async function getStatus() {
    try {
      const supabase = await getClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return { signedIn: false, email: null, lastSyncedAt: null };
      return { signedIn: true, email: data.session.user?.email || null, lastSyncedAt };
    } catch {
      return { signedIn: false, email: null, lastSyncedAt: null };
    }
  }

  // Clears the signed-in user's SYNCED copy (api/my-podium/clear.js) --
  // called before store.clearAll() wipes the local copy, so the next
  // reconcile() on this or any other signed-in device doesn't just pull
  // the old preferences straight back down from the server.
  async function clearSynced() {
    if (!signedIn) return;
    await authedFetch("/api/my-podium/clear", { method: "POST" });
  }

  async function signOut() {
    try {
      const supabase = await getClient();
      await supabase.auth.signOut();
    } catch {
      // Sign-out failing client-side still leaves the device's local
      // preferences fully intact and usable -- nothing to recover from.
    }
    signedIn = false;
  }

  window.PodiumMyPodiumSync = { reconcile, pushNow, getStatus, signOut, clearSynced };
})();
