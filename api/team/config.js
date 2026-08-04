export default function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
  );

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    return response.status(500).json({
      error:
        "Team account configuration is unavailable."
    });
  }

  return response.status(200).json({
    supabaseUrl,
    supabasePublishableKey
  });
}