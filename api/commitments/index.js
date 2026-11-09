import { listCommitments } from "../../lib/commitments_service.mjs";

// Public: college commitments for one class year (WO-38). Only public,
// sourced commitment/signing rows from athlete_recruiting_activity.
// GET ?class=2027

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const commitments = await listCommitments({ classYear: request.query?.class });
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return response.status(200).json({ class_year: Number(request.query?.class), commitments });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Commitments error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(status).json({ error: status < 500 ? error.message : "Commitments could not be loaded right now." });
  }
}
