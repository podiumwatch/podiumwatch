import { verifyRaceDayCode, resolveRaceDaySession } from "../../lib/race_day_auth.mjs";
import { confirmHelperPosition } from "../../lib/timing_crew_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// Public, unauthenticated -- this IS the authentication step. A
// volunteer with a team's current race day code gets a real session
// cookie back; no Supabase account, no sign-in, no email required.
//
// Timing Crew (Project 3) adds one more action, confirm_position --
// still no coach account, but this one DOES require the race-day
// cookie already set by a successful code entry above (resolved via
// resolveRaceDaySession -- the same cookie resolver every authenticated
// Split Watch request ultimately checks). This is the helper's own
// self-service "here's my name and which position I'm covering" step,
// deliberately separate from api/split-watch/crew.js (coach-only,
// requires a real signed-in account) -- a helper is authorizing only
// themselves here, nothing about anyone else's session.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();

    if (action === "confirm_position") {
      const raceDaySession = await resolveRaceDaySession(request);
      if (!raceDaySession) {
        const error = new Error("Enter your team's race day code again to continue.");
        error.status = 401;
        throw error;
      }
      const data = await confirmHelperPosition({
        raceDaySession: { id: raceDaySession.raceDaySessionId, team_id: raceDaySession.teamId },
        teamId: cleanText(body.team_id),
        sessionId: cleanText(body.session_id),
        positionId: body.position_id,
        displayName: body.display_name
      });
      return response.status(200).json(data);
    }

    const { cookie, team } = await verifyRaceDayCode(request, { code: cleanText(body.code) });
    response.setHeader("Set-Cookie", cookie);
    return response.status(200).json({ team });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Race day join request failed.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The request could not be completed." });
  }
}
