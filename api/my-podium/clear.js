import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";

// Clears a signed-in user's synced preferences back to empty. Does not
// delete the Supabase Auth account itself -- no account-deletion
// precedent exists anywhere in this codebase yet, for any account tier
// (team, photographer, athlete, or guardian); a real "delete my
// account" flow should be designed once, site-wide, not bolted on here
// alone. See docs/MY_PODIUM_MASTER_BUILD_PLAN.md, Project 5.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireMyPodiumUser(request);

    const emptyPreferences = { schemaVersion: 1, team: null, athletes: [], updatedAt: new Date().toISOString() };

    const { error } = await supabaseAdmin
      .from("my_podium_accounts")
      .upsert(
        { user_id: user.id, preferences: emptyPreferences, client_updated_at: emptyPreferences.updatedAt },
        { onConflict: "user_id" }
      );

    if (error) {
      throw error;
    }

    return response.status(200).json({ cleared: true });
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to clear your synced My Podium preferences.");
  }
}
