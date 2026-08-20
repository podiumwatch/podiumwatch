import { verifyRaceDayCode } from "../../lib/race_day_auth.mjs";

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
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const { cookie, team } = await verifyRaceDayCode(request, { code: cleanText(body.code) });
    response.setHeader("Set-Cookie", cookie);
    return response.status(200).json({ team });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Race day code verification failed.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The code could not be verified." });
  }
}
