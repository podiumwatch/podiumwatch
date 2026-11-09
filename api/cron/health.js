import { buildHealthEmail, collectHealthReadings, evaluateHealth } from "../../lib/health_check_service.mjs";
import { sendResendEmail } from "../../lib/engagement_service.mjs";
import { site } from "../../src/config/site.mjs";

// Daily health check (WO-31), 8 AM ET. Emails the site contact address
// one summary when anything is red; silent when everything is fine.
// ?test=1 forces one fake failure so the alert email can be tested.
// ?dry_run=1 returns the report without sending.

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && (request.headers?.authorization || "") === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!authorized(request)) return response.status(401).json({ error: "Unauthorized." });

  try {
    const now = new Date();
    const readings = await collectHealthReadings({ siteUrl: site.siteUrl, now });
    readings.forceFailure = String(request.query?.test || "") === "1";
    const result = evaluateHealth(readings, { now });
    let emailed = false;
    let emailError = null;

    if (!result.ok && String(request.query?.dry_run || "") !== "1") {
      const email = buildHealthEmail(result, { siteUrl: site.siteUrl, now });
      try {
        await sendResendEmail({ to: site.contactEmail, ...email, idempotencyKey: `health-${now.toISOString().slice(0, 13)}${readings.forceFailure ? "-test" : ""}` });
        emailed = true;
      } catch (error) {
        emailError = error.message;
        console.error("Health check email failed:", error);
      }
    }

    return response.status(200).json({ ok: result.ok, emailed, email_error: emailError, checks: result.checks });
  } catch (error) {
    console.error("Health check error:", error);
    return response.status(500).json({ error: "The health check could not run." });
  }
}
