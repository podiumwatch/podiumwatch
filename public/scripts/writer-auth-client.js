(() => {
  let clientPromise = null;

  // Reuses /api/team/config/ directly -- it returns nothing team-specific,
  // just the public Supabase URL and publishable key, the same config any
  // Supabase Auth client on this site needs (already reused this way for
  // the timing-submissions direct-upload flow).
  async function createWriterClient() {
    const response = await fetch("/api/team/config/", { headers: { Accept: "application/json" } });
    const config = await response.json();

    if (!response.ok) {
      throw new Error(config.error || "Writer Portal configuration could not be loaded.");
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("The secure account library could not be loaded.");
    }

    return window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function getClient() {
    if (!clientPromise) clientPromise = createWriterClient();
    return clientPromise;
  }

  // A signed-in site admin with no writer session can still open the
  // portal's staff pages (lib/portal_auth.mjs accepts the admin cookie).
  // Checked once per page: the "admin-session" placeholder token tells
  // the server to look for that cookie.
  let adminSessionPromise = null;
  function adminSession() {
    if (!adminSessionPromise) {
      adminSessionPromise = fetch("/api/portal/me/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-session" },
        body: JSON.stringify({ action: "get_profile" })
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => (data && data.profile ? data.profile : null))
        .catch(() => null);
    }
    return adminSessionPromise;
  }

  async function getAccessToken() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session?.access_token) return data.session.access_token;
    return (await adminSession()) ? "admin-session" : "";
  }

  async function getUser() {
    const client = await getClient();
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) return data.user;
    const profile = await adminSession();
    return profile ? { id: profile.id, email: null, admin_session: true } : null;
  }

  window.PodiumWriterAuth = { getClient, getAccessToken, getUser };
})();
