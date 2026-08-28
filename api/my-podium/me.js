import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireMyPodiumUser(request);

    const { data, error } = await supabaseAdmin
      .from("my_podium_accounts")
      .select("preferences, client_updated_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return response.status(200).json({
      user: {
        id: user.id,
        email: user.email || "",
        display_name: user.user_metadata?.display_name || ""
      },
      preferences: data?.preferences || null,
      client_updated_at: data?.client_updated_at || null,
      updated_at: data?.updated_at || null
    });
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to load your My Podium account.");
  }
}
