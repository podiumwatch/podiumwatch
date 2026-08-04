(() => {
  let clientPromise = null;

  async function createTeamClient() {
    const response = await fetch(
      "/api/team/config/",
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const config =
      await response.json();

    if (!response.ok) {
      throw new Error(
        config.error ||
        "Team account configuration could not be loaded."
      );
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