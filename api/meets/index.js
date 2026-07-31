import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

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

    return response.status(200).json({
      meets: meets ?? []
    });
  } catch (error) {
    console.error(
      "Meet directory route error:",
      error
    );

    return response.status(500).json({
      error: "Unable to load meets right now."
    });
  }
}
