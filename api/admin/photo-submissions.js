import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  addKeptPhotoForLinkSubmission,
  archivePhotoItem,
  listPhotoSubmissions,
  markSubmissionReviewed,
  requestKeptUploadSlot,
  selectPhotoItem
} from "../../lib/photo_submissions_service.mjs";

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

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function list(body) {
  const submissions = await listPhotoSubmissions({
    status: cleanAthleteText(body.status, 20) || "pending",
    schoolName: cleanAthleteText(body.school_name, 300),
    meetName: cleanAthleteText(body.meet_name, 300),
    itemStatus: cleanAthleteText(body.item_status, 20) || "pending"
  });
  return { submissions };
}

async function requestKeptUpload(body) {
  return requestKeptUploadSlot({ itemId: body.item_id });
}

async function select(body) {
  const item = await selectPhotoItem({
    itemId: body.item_id,
    keptStorageKey: body.kept_storage_key,
    actor: "Podium Watch Admin"
  });
  return { item };
}

async function archive(body) {
  const item = await archivePhotoItem({ itemId: body.item_id, actor: "Podium Watch Admin" });
  return { item };
}

async function markReviewed(body) {
  const submission = await markSubmissionReviewed({ submissionId: body.submission_id, actor: "Podium Watch Admin" });
  return { submission };
}

async function addKeptForLink(body) {
  const item = await addKeptPhotoForLinkSubmission({
    submissionId: body.submission_id,
    keptStorageKey: body.kept_storage_key,
    originalFilename: body.original_filename,
    actor: "Podium Watch Admin"
  });
  return { item };
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
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = await list(body);
    } else if (action === "request_kept_upload") {
      data = await requestKeptUpload(body);
    } else if (action === "select") {
      data = await select(body);
    } else if (action === "archive") {
      data = await archive(body);
    } else if (action === "mark_reviewed") {
      data = await markReviewed(body);
    } else if (action === "add_kept_for_link") {
      data = await addKeptForLink(body);
    } else {
      fail("Unsupported photo submissions admin action.");
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Photo submissions admin error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The photo submissions admin request could not be completed."
    });
  }
}
