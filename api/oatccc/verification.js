import { oatcccFlags } from "../../src/oatccc/config.mjs";
import {
  requireUser,
  loadMe,
  listSubmissions,
  loadSubmission,
  findSubmission,
  submit,
  returnSubmission,
  approveSubmission,
  addComment,
  FORM_FIELDS,
  FORM_IS_PLACEHOLDER,
  STATUS_LABELS
} from "../../lib/oatccc_verification.mjs";

// OATCCC team verification API (Part B groundwork).
// 404 unless OATCCC_LIVE=1 and OATCCC_VERIFICATION_LIVE=1.
// Every call runs as the signed-in user, so row-level security in
// install/99_OATCCC_VERIFICATION.sql decides what they see and do.
//
// GET  ?view=me                       who am I: admin? AD for which schools?
// GET  ?view=queue[&status=]          admin: every submission
// GET  ?view=submission&id=           one submission, its comments and trail
// GET  ?view=mine&school=             AD: my school's submission (or none)
// POST {action:"submit", season_id, school_id, answers}
// POST {action:"return", submission_id, comment}
// POST {action:"approve", submission_id, comment?}
// POST {action:"comment", submission_id, body}
//
// Emails: lib/oatccc_email_templates.mjs has the "submitted", "returned"
// and "approved" templates. Nothing is sent from here yet.

function send(response, status, body) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (!oatcccFlags().verification) return send(response, 404, { error: "Not found." });
  try {
    const { client, user } = await requireUser(request);

    if (request.method === "GET") {
      const view = String(request.query?.view || "");
      if (view === "me") {
        const me = await loadMe(client, user);
        return send(response, 200, { ...me, form: { fields: FORM_FIELDS, placeholder: FORM_IS_PLACEHOLDER }, statusLabels: STATUS_LABELS });
      }
      if (view === "queue") {
        const me = await loadMe(client, user);
        if (!me.isAdmin) return send(response, 403, { error: "Only OATCCC admins can see the queue." });
        const status = String(request.query?.status || "") || undefined;
        return send(response, 200, { submissions: await listSubmissions(client, { status }) });
      }
      if (view === "submission") {
        return send(response, 200, await loadSubmission(client, String(request.query?.id || "")));
      }
      if (view === "mine") {
        const me = await loadMe(client, user);
        const school = me.schools.find((item) => item.id === String(request.query?.school || ""));
        if (!school) return send(response, 403, { error: "That is not your school." });
        if (!school.season) return send(response, 200, { school, submission: null });
        const submission = await findSubmission(client, school.season.id, school.id);
        return send(response, 200, { school, submission, ...(submission ? await loadSubmission(client, submission.id) : {}) });
      }
      return send(response, 400, { error: "Unknown view." });
    }

    if (request.method === "POST") {
      const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});
      const action = String(body.action || "");
      if (action === "submit") {
        const row = await submit(client, { seasonId: body.season_id, schoolId: body.school_id, answers: body.answers });
        return send(response, 200, { submission: row });
      }
      if (action === "return") {
        return send(response, 200, { submission: await returnSubmission(client, { submissionId: body.submission_id, comment: body.comment }) });
      }
      if (action === "approve") {
        return send(response, 200, { submission: await approveSubmission(client, { submissionId: body.submission_id, comment: body.comment }) });
      }
      if (action === "comment") {
        return send(response, 200, { comment: await addComment(client, { submissionId: body.submission_id, body: body.body }) });
      }
      return send(response, 400, { error: "Unknown action." });
    }

    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("OATCCC verification API error:", error?.message);
    return send(response, status, { error: status >= 500 && !error.status ? "Something went wrong. Please try again." : error.message });
  }
}
