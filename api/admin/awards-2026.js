import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  addFinalist,
  adminSummary,
  announceAllReady,
  announceFinalists,
  closeVotingEarly,
  deleteNomination,
  finalistsCsv,
  moveFinalist,
  nominationsCsv,
  publishAll,
  publishResults,
  removeFinalist,
  unpublishResults,
  updateFinalist,
  voidVotes,
  voteActivity,
  voteSnapshots,
  finalTalliesCsv
} from "../../lib/yearly_awards_2026_service.mjs";

// Admin only: 2026 Athlete, Team and Coach of the Year. POST actions:
//   summary, delete_nomination,
//   add_finalist, update_finalist, move_finalist, remove_finalist,
//   announce_finalists (undo), announce_all,
//   close_early (undo), void_votes,
//   publish (winner_key for ties), publish_all, unpublish.
// GET ?format=csv (nominations) or ?format=finalists (finalists with live
// vote counts).

function bodyOf(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });

  try {
    const format = String(request.query?.format || "");
    if (request.method === "GET" && format === "final") {
      const csv = await finalTalliesCsv();
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="podium-watch-2026-yearly-award-final-tallies-${new Date().toISOString().slice(0, 16).replace(":", "")}.csv"`);
      return response.status(200).send(csv);
    }
    if (request.method === "GET" && (format === "csv" || format === "finalists")) {
      const csv = format === "csv" ? await nominationsCsv() : await finalistsCsv();
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="podium-watch-2026-yearly-award-${format === "csv" ? "nominations" : "finalists"}.csv"`);
      return response.status(200).send(csv);
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed." });
    }

    const body = bodyOf(request);
    const action = String(body.action || "summary").trim().toLowerCase();
    const slug = body.category;
    const undo = body.undo === true;
    const actions = {
      summary: async () => ({ categories: await adminSummary() }),
      delete_nomination: () => deleteNomination(body.nomination_id),
      add_finalist: () => addFinalist({ slug, nomineeKey: body.nominee_key, displayName: body.display_name, school: body.school, note: body.note }),
      update_finalist: () => updateFinalist({ id: body.finalist_id, displayName: body.display_name, school: body.school, note: body.note }),
      move_finalist: () => moveFinalist({ id: body.finalist_id, direction: body.direction === "up" ? "up" : "down" }),
      remove_finalist: () => removeFinalist({ id: body.finalist_id }),
      announce_finalists: () => announceFinalists({ slug, undo }),
      announce_all: () => announceAllReady(),
      close_early: () => closeVotingEarly({ slug, undo }),
      void_votes: () => voidVotes({ slug, tokenPrefix: body.token_prefix, ipPrefix: body.ip_prefix, reason: body.reason }),
      publish: () => publishResults({ slug, winnerKey: body.winner_key || null }),
      publish_all: () => publishAll(),
      unpublish: () => unpublishResults({ slug }),
      vote_activity: async () => ({ categories: await voteActivity() }),
      vote_snapshots: async () => ({ categories: await voteSnapshots() })
    };
    if (!actions[action]) return response.status(400).json({ error: "Unsupported action." });
    return response.status(200).json(await actions[action]());
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Yearly awards admin error:", error);
    return response.status(status).json({
      error: status < 500 ? error.message : "That action could not be completed.",
      ...(error?.tied ? { tied: error.tied } : {})
    });
  }
}
