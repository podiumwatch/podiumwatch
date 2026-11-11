import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { CACHE_PAGE, CACHE_API_60, rememberGood, sendLastGood } from "../../lib/page_cache.mjs";

// Public meet directory: the same list for everyone, so the CDN keeps it
// 60 seconds (2026-11-11; it used to be no-store and hit Supabase on every
// visit). On a database error the last good list is served.

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { data: meets, error } = await supabaseAdmin
      .from("meets")
      .select("*")
      .eq("published", true)
      .order("meet_date", {
        ascending: true
      })
      .order("name", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    const body = JSON.stringify({ meets: meets ?? [] });
    rememberGood("meets", "application/json; charset=utf-8", body);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", CACHE_API_60);
    return response.status(200).send(body);
  } catch (error) {
    console.error(
      "Meet directory route error:",
      error
    );

    if (sendLastGood(response, "meets")) return;
    return response.status(500).json({
      error: "Unable to load meets right now."
    });
  }
}
