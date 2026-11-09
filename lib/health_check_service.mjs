// Daily health check (WO-31). Looks at the things that broke quietly
// before (2026-11-09 audit): Finish Timing failing, failed notification
// emails, failed performance imports, jobs stuck in "running", a stale
// site build and a shrunken sitemap. When anything is red it emails one
// summary to the site contact address through Resend. Run by
// api/cron/health.js once a day.

export const STALE_BUILD_HOURS = 72;
export const MIN_SITEMAP_URLS = 150;
export const STUCK_JOB_MINUTES = 30;

// Pure: turns raw readings into checks. Unit tested.
export function evaluateHealth(readings, { now = new Date() } = {}) {
  const checks = [];
  const add = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const ft = readings.finishTiming;
  if (ft) {
    // Paused by an admin on purpose is fine; paused by the automation
    // itself (a 401/403) or failing while on is a problem.
    const paused = ft.active === false;
    const autoPaused = paused && ft.paused_by === "Finish Timing automation";
    const failed = !paused && ft.last_scan_status === "failed";
    add("finish_timing", "Finish Timing automation", !autoPaused && !failed,
      paused ? `Paused${ft.pause_reason ? `: ${ft.pause_reason}` : "."}` : failed ? "Last scan failed." : "Running.");
  }
  add("failed_notifications", "Notification emails", (readings.failedNotifications || 0) === 0,
    `${readings.failedNotifications || 0} failed delivery record${readings.failedNotifications === 1 ? "" : "s"}.`);
  add("failed_imports", "Performance imports", (readings.failedImports || 0) === 0,
    `${readings.failedImports || 0} failed import${readings.failedImports === 1 ? "" : "s"} not dismissed.`);
  add("stuck_jobs", "Ingestion jobs", (readings.stuckJobs || 0) === 0,
    `${readings.stuckJobs || 0} job${readings.stuckJobs === 1 ? "" : "s"} running with no progress for ${STUCK_JOB_MINUTES}+ minutes.`);

  if (readings.buildGeneratedAt) {
    const ageHours = (now.getTime() - new Date(readings.buildGeneratedAt).getTime()) / 3600000;
    add("build_age", "Site build", ageHours <= STALE_BUILD_HOURS, `Last built ${Math.round(ageHours)} hours ago.`);
  } else {
    add("build_age", "Site build", false, "Could not read the build date from /site-data.json.");
  }

  if (Number.isFinite(readings.sitemapUrls)) {
    add("sitemap", "Sitemap", readings.sitemapUrls >= MIN_SITEMAP_URLS, `${readings.sitemapUrls} URLs.`);
  } else {
    add("sitemap", "Sitemap", false, "Could not read /sitemap.xml.");
  }

  if (readings.forceFailure) add("test", "Test alert", false, "Forced failure to test the alert email.");

  return { ok: checks.every((check) => check.ok), checks };
}

// Pure: the email for a red result.
export function buildHealthEmail(result, { siteUrl, now = new Date() }) {
  const red = result.checks.filter((check) => !check.ok);
  const date = now.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
  const subject = `Podium Watch health: ${red.length} problem${red.length === 1 ? "" : "s"} (${date})`;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rows = result.checks.map((check) => `<tr><td style="padding:6px 10px;font-weight:700;color:${check.ok ? "#0f7a4a" : "#b42318"}">${check.ok ? "OK" : "PROBLEM"}</td><td style="padding:6px 10px;font-weight:700">${escape(check.label)}</td><td style="padding:6px 10px">${escape(check.detail)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#111827"><h2 style="margin:0 0 8px">Podium Watch daily health check</h2><p>${red.length} problem${red.length === 1 ? "" : "s"} found on ${escape(date)}.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p><a href="${escape(siteUrl)}/admin/">Open admin</a></p></div>`;
  const text = [`Podium Watch daily health check (${date})`, ...result.checks.map((check) => `${check.ok ? "OK" : "PROBLEM"} - ${check.label}: ${check.detail}`), `${siteUrl}/admin/`].join("\n");
  return { subject, html, text };
}

async function count(query) {
  const { count: value, error } = await query;
  if (error) throw error;
  return value || 0;
}

export async function collectHealthReadings({ siteUrl, now = new Date() }) {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  const stuckCutoff = new Date(now.getTime() - STUCK_JOB_MINUTES * 60000).toISOString();
  const [finishTiming, failedNotifications, failedImports, stuckJobs] = await Promise.all([
    supabaseAdmin.from("results_source_providers").select("active, pause_reason, paused_by, last_scan_status").eq("provider_key", "finish_timing").maybeSingle().then(({ data }) => data || null),
    count(supabaseAdmin.from("team_notification_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed")),
    count(supabaseAdmin.from("athlete_performance_import_batches").select("id", { count: "exact", head: true }).eq("status", "failed").is("options->>dismissed_at", null)),
    count(supabaseAdmin.from("result_ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "running").lt("updated_at", stuckCutoff))
  ]);

  let buildGeneratedAt = null;
  let sitemapUrls = NaN;
  try {
    const response = await fetch(`${siteUrl}/site-data.json`, { headers: { Accept: "application/json" } });
    if (response.ok) buildGeneratedAt = (await response.json()).generatedAt || null;
  } catch {
    // reported as a problem by evaluateHealth
  }
  try {
    const response = await fetch(`${siteUrl}/sitemap.xml`);
    if (response.ok) sitemapUrls = ((await response.text()).match(/<loc>/g) || []).length;
  } catch {
    // reported as a problem by evaluateHealth
  }

  return { finishTiming, failedNotifications, failedImports, stuckJobs, buildGeneratedAt, sitemapUrls };
}
