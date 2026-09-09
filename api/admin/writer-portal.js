import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { resendAccountSetupLink } from "../../lib/writer_portal_service.mjs";
// TEMPORARY -- verifying the GitHub commit mechanism in isolation
// before wiring it into publishArticle(), per the approved plan.
// Removed once that verification is done; this import and the two
// actions below are not meant to ship.
import { commitFile, deleteFile, repoFileExists } from "../../lib/github_content_service.mjs";

// Shared-admin-password-gated Writer Portal actions -- deliberately
// separate from api/portal/writers.js (that file requires signing in
// as a Writer Portal editor/admin via Supabase, not the site's shared
// password). Built so an account-setup problem (an invite link
// consumed by an email app's automatic link-scanning before the real
// person ever clicked it -- a real incident, not hypothetical) can be
// fixed without needing a Writer Portal login at all.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({ error: "Podium Watch admin sign in required." });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase();
    let data;

    if (action === "resend_setup_link") {
      data = await resendAccountSetupLink({ email: body.email });
    } else if (action === "test_github_exists") {
      data = { exists: await repoFileExists(body.path) };
    } else if (action === "test_github_commit") {
      data = await commitFile({ path: body.path, content: body.content, message: body.message || "Test commit" });
    } else if (action === "test_github_delete") {
      data = await deleteFile({ path: body.path, message: body.message || "Remove test commit" });
    } else {
      const error = new Error("Unsupported Writer Portal admin action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Writer Portal admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The Writer Portal admin request could not be completed."
    });
  }
}
