import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { discoverMeetBatch, discoveryStatus, listMeetCatalog, updateMeetStatuses } from "../../lib/meet_discovery_service.mjs";
import { cancelJob, createContentIngestionJob, createIngestionJob, getIngestionJob, importApprovedRows, listIngestionJobs, pauseJob, resolveJobIdentities, retryFailedPages, reviewRows, reverseImportedJob, runIngestionJob } from "../../lib/result_ingestion_engine.mjs";
import crypto from "node:crypto";

function bodyOf(request) {
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { const error = new Error("The request is invalid."); error.status = 400; throw error; }
  }
  return request.body || {};
}

function missingMigration(error) {
  const message = String(error?.message || "");
  if (/result_ingestion_jobs|result_crawl_pages|result_source_documents|result_staging_rows/i.test(message)) return "05";
  if (/results_source_providers|discovered_meets|results_discovery_runs/i.test(message)) return "04";
  return null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).json({ error: "Method not allowed." }); }
  try {
    const body = bodyOf(request);
    const action = String(body.action || "status").trim().toLowerCase();
    let data;
    if (action === "status") data = { ...(await discoveryStatus()), ingestion_jobs: await listIngestionJobs() };
    else if (action === "list") data = { meets: await listMeetCatalog(body) };
    else if (action === "discover") data = await discoverMeetBatch({ providerKey: body.provider_key, sport: body.sport, seasonYear: body.season_year, limit: body.limit });
    else if (action === "set_status") data = await updateMeetStatuses({ meetIds: body.meet_ids, status: body.status });
    else if (action === "create_ingestion_job") data = await createIngestionJob({ jobType: body.job_type, urls: body.urls, seeds: body.seeds, providerKey: body.provider_key, sport: body.sport, seasonYear: Number(body.season_year) || null, options: body.options });
    else if (action === "create_content_job") data = await createContentIngestionJob({ jobType: body.job_type, text: body.text, encoding: body.encoding, fileName: body.file_name, contentType: body.content_type, documentType: body.document_type, providerKey: body.provider_key, sport: body.sport, seasonYear: Number(body.season_year) || null, meetName: body.meet_name || null, meetDate: body.meet_date || null, meetLocation: body.meet_location || null, gender: body.gender || null, dryRun: body.dry_run !== false });
    else if (action === "run_ingestion_job" || action === "resume_ingestion_job") data = await runIngestionJob(body.job_id, Number(body.slice_limit) || 10);
    else if (action === "pause_ingestion_job") data = await pauseJob(body.job_id);
    else if (action === "retry_ingestion_job") data = await retryFailedPages(body.job_id);
    else if (action === "cancel_ingestion_job") data = await cancelJob(body.job_id);
    else if (action === "get_ingestion_job") data = await getIngestionJob(body.job_id);
    else if (action === "list_ingestion_jobs") data = { jobs: await listIngestionJobs() };
    else if (action === "review_ingestion_rows") data = await reviewRows(body.job_id, Array.isArray(body.row_ids) ? body.row_ids : [], body.review_status, body.note);
    else if (action === "resolve_ingestion_identities") data = await resolveJobIdentities(body.job_id);
    else if (action === "import_ingestion_job") data = await importApprovedRows(body.job_id);
    else if (action === "reverse_ingestion_job") data = await reverseImportedJob(body.job_id);
    else { const error = new Error("Unsupported Results Source Manager action."); error.status = 400; throw error; }
    return response.status(200).json(data);
  } catch (error) {
    const migration = missingMigration(error);
    if (migration) return response.status(409).json({ error: `Run install/${migration === "05" ? "05_RESULTS_INGESTION_ENGINE.sql" : "04_RESULTS_SOURCE_MANAGER.sql"} in Supabase before using this section.`, installed: false, code: `MIGRATION_${migration}_REQUIRED` });
    const status = Number(error?.status) || 500;
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("Results Source Manager error", { requestId, code: error?.code || null, message: error?.message || String(error), details: error?.details || null });
    const safeMessage = error?.message ? String(error.message) : error?.details ? String(error.details) : "The database or provider returned an empty error response.";
    return response.status(status).json({ error: status < 500 ? safeMessage : `The Results Source Manager request could not be completed. Request ${requestId}.`, request_id: requestId, code: error?.code || null, stage: error?.stage || null, provider: error?.provider || null, url: error?.url || null, retry_state: error?.retryState || null });
  }
}
