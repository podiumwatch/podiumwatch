import { loadAthleteSeed, isMissingAthleteFoundationError } from "../../lib/athlete_foundation_service.mjs";
import { cleanSlug, fallbackProfile, loadDatabaseProfile, parseInput } from "../../lib/athlete_profile_service.mjs";

// JSON profile for the athlete page script. Data loading lives in
// lib/athlete_profile_service.mjs (shared with the server-rendered page).

export default async function handler(request, response) {
  response.setHeader(
    "Cache-Control",
    "public, max-age=30, s-maxage=120, stale-while-revalidate=600"
  );

  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const input = parseInput(request);
    const slug = cleanSlug(input.slug);

    if (!slug) {
      return response.status(400).json({
        error: "Choose an athlete profile."
      });
    }

    try {
      const profile = await loadDatabaseProfile(slug);

      if (profile?.merged) {
        return response.status(200).json(profile);
      }

      if (profile?.private) {
        return response.status(404).json({
          error: "Published athlete profile not found."
        });
      }

      if (profile) {
        return response.status(200).json(profile);
      }
    } catch (error) {
      if (!isMissingAthleteFoundationError(error)) {
        throw error;
      }
    }

    const dataset = await loadAthleteSeed();
    const seed = (dataset.athletes || []).find(
      (athlete) => athlete.profile_slug === slug
    );

    if (!seed) {
      return response.status(404).json({
        error: "Published athlete profile not found."
      });
    }

    return response.status(200).json(fallbackProfile(seed));
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Athlete profile error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The athlete profile could not be loaded."
    });
  }
}
