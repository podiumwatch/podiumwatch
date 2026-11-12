(() => {
  let clientPromise = null;
  // Split Watch track build, Phase 1 (2026-11-12): the config request had
  // no timeout, so on stalled wifi every page that asked for a sign-in
  // token waited forever before its own request even started. Bounded
  // now; a failed load is also no longer cached (see getClient), so a
  // Try again can actually recover.
  const CONFIG_TIMEOUT_MS = 10000;
  const LIBRARY_WAIT_MS = 8000;

  async function createTeamClient() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(
        "/api/team/config/",
        {
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        }
      );
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Team account configuration took too long to load.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const config =
      await response.json();

    if (!response.ok) {
      throw new Error(
        config.error ||
        "Team account configuration could not be loaded."
      );
    }

    // Split Watch pages load the account library async (track build
    // Phase 1), so a stalled download can't block the page's own script;
    // wait for it here, bounded. Pages that load it with defer already
    // have it, so this returns at once.
    const libraryDeadline = Date.now() + LIBRARY_WAIT_MS;
    while (
      (!window.supabase || typeof window.supabase.createClient !== "function") &&
      Date.now() < libraryDeadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !==
        "function"
    ) {
      throw new Error(
        "The secure account library could not be loaded."
      );
    }

    return window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  function getClient() {
    if (!clientPromise) {
      clientPromise =
        createTeamClient();
      // A failed load is forgotten, so the next call tries again.
      clientPromise.catch(() => {
        clientPromise = null;
      });
    }

    return clientPromise;
  }

  async function getAccessToken() {
    const client =
      await getClient();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return (
      data.session?.access_token ||
      ""
    );
  }

  async function getUser() {
    const client =
      await getClient();

    const {
      data,
      error
    } = await client.auth.getUser();

    if (error) {
      return null;
    }

    return data.user || null;
  }

  window.PodiumTeamAuth = {
    getClient,
    getAccessToken,
    getUser
  };
})();