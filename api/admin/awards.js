import crypto from "node:crypto";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  listWeeks,
  getWeekDetail,
  createWeek,
  openNominations,
  closeNominations,
  openVoting,
  closeVoting,
  reviewNomination,
  setNominationSelected,
  createNomination,
  promoteNomination,
  updateFinalist,
  removeFinalist,
  announceWinner
} from "../../lib/awards_service.mjs";

// Admin control for Athlete of the Week / Team of the Week -- the first
// admin tool either award has ever had (see lib/awards_service.mjs for
// the full history). Shaped like every other admin action file in this
// project (api/admin/fan-poll.js, api/admin/results-sources.js): a
// single action-dispatch POST handler behind isAdminRequest.

function bodyOf(request) {
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { const error = new Error("The request is invalid."); error.status = 400; throw error; }
  }
  return request.body || {};
}

function missingMigration(error) {
  const message = String(error?.message || "");
  return /promoted_finalist_id|source_nomination_id/i.test(message) ? "35" : null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).json({ error: "Method not allowed." }); }

  try {
    const body = bodyOf(request);
    const action = String(body.action || "list_weeks").trim().toLowerCase();
    const type = body.type;
    let data;

    if (action === "list_weeks") data = { weeks: await listWeeks({ type, limit: Number(body.limit) || 30 }) };
    else if (action === "get_week") data = await getWeekDetail({ type, weekId: body.week_id });
    else if (action === "create_week") data = { week: await createWeek({ type, nominationOpens: body.nomination_opens, nominationCloses: body.nomination_closes, votingOpens: body.voting_opens, votingCloses: body.voting_closes }) };
    else if (action === "open_nominations") data = { week: await openNominations({ type, weekId: body.week_id }) };
    else if (action === "close_nominations") data = { week: await closeNominations({ type, weekId: body.week_id }) };
    else if (action === "open_voting") data = { week: await openVoting({ type, weekId: body.week_id }) };
    else if (action === "close_voting") data = { week: await closeVoting({ type, weekId: body.week_id }) };
    else if (action === "review_nomination") data = { nomination: await reviewNomination({ type, nominationId: body.nomination_id, reviewed: body.reviewed }) };
    else if (action === "select_nomination") data = { nomination: await setNominationSelected({ type, nominationId: body.nomination_id, selected: body.selected }) };
    else if (action === "create_nomination") data = {
      nomination: await createNomination({
        type,
        weekId: body.week_id,
        fields: {
          school: body.school, reason: body.reason, result_url: body.result_url, photo_url: body.photo_url,
          meet_name: body.meet_name, performance_date: body.performance_date,
          nominator_name: body.nominator_name, nominator_email: body.nominator_email,
          category: body.category, team_name: body.team_name, sport: body.sport, division: body.division, achievement: body.achievement,
          athlete_name: body.athlete_name, grade: body.grade, gender: body.gender, event_name: body.event_name, performance: body.performance
        }
      })
    };
    else if (action === "promote_nomination") data = { finalist: await promoteNomination({ type, nominationId: body.nomination_id, overrides: { image_url: body.image_url, achievement: body.achievement, description: body.description, sort_order: body.sort_order } }) };
    else if (action === "update_finalist") data = { finalist: await updateFinalist({ type, finalistId: body.finalist_id, fields: { image_url: body.image_url, achievement: body.achievement, description: body.description, sort_order: body.sort_order } }) };
    else if (action === "remove_finalist") data = await removeFinalist({ type, finalistId: body.finalist_id });
    else if (action === "announce_winner") data = await announceWinner({ type, weekId: body.week_id, finalistIds: body.finalist_ids });
    else { const error = new Error("Unsupported weekly awards action."); error.status = 400; throw error; }

    return response.status(200).json(data);
  } catch (error) {
    const migration = missingMigration(error);
    if (migration) return response.status(409).json({ error: `Run install/${migration}_WEEKLY_AWARDS_ADMIN.sql in Supabase before using this section.`, installed: false, code: `MIGRATION_${migration}_REQUIRED` });

    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("Weekly awards admin error", { requestId, code: error?.code || null, message: error?.message || String(error) });

    return response.status(status).json({
      error: status < 500 ? error.message : `The weekly awards admin request could not be completed. Request ${requestId}.`,
      request_id: requestId,
      code: error?.code || null
    });
  }
}
