import { requireTeamUser } from "../../lib/team_auth.mjs";
import { coachBanquetState, saveBanquetSettings } from "../../lib/banquet_service.mjs";

// Banquet Pack coach settings (WO-35). A signed-in coach (owner or editor)
// on the team's account can hide athletes and set a short note.
//   GET  ?team_id=&season=   the team's 2026 runners and current settings
//   POST { team_id, season, hidden_profile_ids, note }

const SEASONS = new Set([2026]);
const parse = (request) => {
  if (typeof request.body === "string") { try { return JSON.parse(request.body); } catch { return {}; } }
  return request.body || {};
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const user = await requireTeamUser(request);
    const body = request.method === "POST" ? parse(request) : request.query || {};
    const teamId = String(body.team_id || "").trim();
    const season = Number(body.season);
    if (!/^[0-9a-f-]{36}$/i.test(teamId) || !SEASONS.has(season)) return response.status(400).json({ error: "Choose a team and season." });
    if (request.method === "GET") return response.status(200).json(await coachBanquetState({ teamId, userId: user.id, season }));
    const saved = await saveBanquetSettings({ teamId, userId: user.id, season, hiddenProfileIds: body.hidden_profile_ids, note: body.note });
    return response.status(200).json({ ok: true, ...saved });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Banquet settings error:", error);
    return response.status(status).json({ error: status >= 500 ? "Banquet settings could not be saved right now." : error.message });
  }
}
