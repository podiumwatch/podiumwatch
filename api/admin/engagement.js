import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  aggregateAnalytics,
  cleanText,
  getEngagementSettings,
  getSiteUrl,
  processImmediateNotifications,
  processWeeklyDigests,
  safeUrl,
  sendResendEmail
} from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The engagement admin request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function cleanBoolean(value) {
  return value === true || value === 1 || ["true", "1", "yes", "on"].includes(
    cleanText(value, 20).toLowerCase()
  );
}

function cleanId(value, label = "ID") {
  const id = cleanText(value, 100);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return id;
}

function cleanNullableDate(value, label) {
  const text = cleanText(value, 50);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return date.toISOString();
}

function slugify(value) {
  return cleanText(value, 220)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getDashboard(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const settings = await getEngagementSettings();

  const [
    subscriberResult,
    followResult,
    eventResult,
    deliveryResult,
    analyticsResult,
    sponsorsResult,
    placementsResult,
    teamsResult
  ] = await Promise.all([
    supabaseAdmin.from("team_followers").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("team_follows").select("id", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin
      .from("team_notification_events")
      .select("id, team_id, category, title, status, created_at, processed_at, last_error, team:team_pages(school_name, slug)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("team_notification_deliveries")
      .select("id, team_id, delivery_type, recipient_email, status, sent_at, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("team_analytics_events")
      .select("team_id, event_type, section, visitor_id, sponsor_id, content_type, content_id, created_at")
      .gte("created_at", since)
      .limit(30000),
    supabaseAdmin
      .from("team_sponsors")
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("team_sponsor_placements")
      .select("*, sponsor:team_sponsors(id, name, status), team:team_pages(id, school_name, slug)")
      .order("priority", { ascending: true }),
    supabaseAdmin
      .from("team_pages")
      .select("id, school_name, slug, mascot, city, state, published")
      .is("merged_into_team_id", null)
      .order("school_name", { ascending: true })
      .limit(3000)
  ]);

  for (const result of [
    subscriberResult,
    followResult,
    eventResult,
    deliveryResult,
    analyticsResult,
    sponsorsResult,
    placementsResult,
    teamsResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const analytics = aggregateAnalytics(analyticsResult.data || []);
  const teamMap = new Map((teamsResult.data || []).map((team) => [team.id, team]));
  const topTeams = analytics.team_counts.slice(0, 20).map((row) => ({
    ...row,
    team: teamMap.get(row.team_id) || null
  }));
  const sponsorMap = new Map((sponsorsResult.data || []).map((sponsor) => [sponsor.id, sponsor]));
  const sponsorPerformance = analytics.sponsor_counts.slice(0, 20).map((row) => ({
    ...row,
    sponsor: sponsorMap.get(row.sponsor_id) || null
  }));
  const deliverySummary = (deliveryResult.data || []).reduce((summary, row) => {
    summary[row.status] = (summary[row.status] || 0) + 1;
    return summary;
  }, {});

  return {
    settings,
    configuration: {
      resend_api_key: Boolean(process.env.RESEND_API_KEY),
      resend_from_email: Boolean(process.env.RESEND_FROM_EMAIL),
      resend_reply_to: Boolean(process.env.RESEND_REPLY_TO),
      cron_secret: Boolean(process.env.CRON_SECRET),
      site_url: getSiteUrl()
    },
    counts: {
      subscribers: Number(subscriberResult.count) || 0,
      active_follows: Number(followResult.count) || 0,
      sponsors: (sponsorsResult.data || []).length,
      placements: (placementsResult.data || []).length
    },
    analytics,
    top_teams: topTeams,
    // Titles/links are resolved client-side from the site's own public
    // site-data.json (already generated at build time, already public --
    // see scripts/build.mjs) rather than here, since this admin API has
    // no access to content/stories/*.md at request time and re-reading a
    // build artifact from a serverless function would be fragile. This
    // just returns the real, counted slugs.
    top_stories: analytics.story_counts.slice(0, 20),
    sponsor_performance: sponsorPerformance,
    delivery_summary: deliverySummary,
    notification_events: eventResult.data || [],
    deliveries: (deliveryResult.data || []).map((row) => ({
      ...row,
      recipient_email: row.recipient_email
        ? row.recipient_email.replace(/^(.{2}).*(@.*)$/, "$1••••$2")
        : null
    })),
    sponsors: sponsorsResult.data || [],
    placements: placementsResult.data || [],
    teams: teamsResult.data || [],
    days
  };
}

async function saveSettings(body) {
  const mode = ["paused", "test", "live"].includes(body.notification_mode)
    ? body.notification_mode
    : "paused";
  const frequency = ["immediate", "weekly"].includes(body.default_frequency)
    ? body.default_frequency
    : "weekly";
  const emailsPerRun = Math.min(500, Math.max(1, Number(body.emails_per_run) || 100));

  if (mode === "test" && !cleanText(body.test_email, 320)) {
    const error = new Error("Enter a test email before enabling testing mode.");
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("engagement_settings")
    .upsert({
      id: true,
      notification_mode: mode,
      test_email: cleanText(body.test_email, 320) || null,
      default_frequency: frequency,
      emails_per_run: emailsPerRun,
      public_following_enabled: cleanBoolean(body.public_following_enabled),
      sponsor_display_enabled: cleanBoolean(body.sponsor_display_enabled),
      analytics_enabled: cleanBoolean(body.analytics_enabled),
      updated_by: "Podium Watch Admin"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { saved: true, settings: data };
}

async function saveSponsor(body) {
  const name = cleanText(body.name, 220);

  if (!name) {
    const error = new Error("Sponsor name is required.");
    error.status = 400;
    throw error;
  }

  const status = ["draft", "active", "paused", "ended"].includes(body.status)
    ? body.status
    : "draft";
  const values = {
    name,
    slug: slugify(body.slug || name),
    status,
    logo_url: safeUrl(body.logo_url) || null,
    website_url: safeUrl(body.website_url) || null,
    description: cleanText(body.description, 3000) || null,
    contact_name: cleanText(body.contact_name, 300) || null,
    contact_email: cleanText(body.contact_email, 320) || null,
    starts_at: cleanNullableDate(body.starts_at, "Sponsor start date"),
    ends_at: cleanNullableDate(body.ends_at, "Sponsor end date"),
    notes: cleanText(body.notes, 5000) || null
  };

  let query;

  if (body.sponsor_id) {
    query = supabaseAdmin
      .from("team_sponsors")
      .update(values)
      .eq("id", cleanId(body.sponsor_id, "Sponsor ID"));
  } else {
    query = supabaseAdmin.from("team_sponsors").insert(values);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    throw error;
  }

  return { saved: true, sponsor: data };
}

async function savePlacement(body) {
  const sponsorId = cleanId(body.sponsor_id, "Sponsor ID");
  const placementType = ["directory", "team_profile", "schedule", "roster", "results", "email"].includes(body.placement_type)
    ? body.placement_type
    : "team_profile";
  const destinationUrl = safeUrl(body.destination_url);

  if (!destinationUrl) {
    const error = new Error("Sponsor destination URL is required.");
    error.status = 400;
    throw error;
  }

  const values = {
    sponsor_id: sponsorId,
    team_id: body.team_id ? cleanId(body.team_id, "Team ID") : null,
    placement_type: placementType,
    headline: cleanText(body.headline, 300) || null,
    body_text: cleanText(body.body_text, 3000) || null,
    image_url: safeUrl(body.image_url) || null,
    button_label: cleanText(body.button_label, 100) || null,
    destination_url: destinationUrl,
    active: cleanBoolean(body.active),
    priority: Math.min(9999, Math.max(0, Number(body.priority) || 100)),
    starts_at: cleanNullableDate(body.starts_at, "Placement start date"),
    ends_at: cleanNullableDate(body.ends_at, "Placement end date"),
    notes: cleanText(body.notes, 5000) || null
  };

  let query;

  if (body.placement_id) {
    query = supabaseAdmin
      .from("team_sponsor_placements")
      .update(values)
      .eq("id", cleanId(body.placement_id, "Placement ID"));
  } else {
    query = supabaseAdmin.from("team_sponsor_placements").insert(values);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    throw error;
  }

  return { saved: true, placement: data };
}

async function deleteRecord(table, id, label) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("id", cleanId(id, `${label} ID`));

  if (error) {
    throw error;
  }

  return { deleted: true };
}

async function sendTestEmail(body) {
  const settings = await getEngagementSettings();
  const email = cleanText(body.email || settings.test_email, 320);

  if (!email) {
    const error = new Error("Enter a test email address.");
    error.status = 400;
    throw error;
  }

  const result = await sendResendEmail({
    to: email,
    subject: "Podium Watch notification test",
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;color:#111827;"><h1>Podium Watch notifications are connected.</h1><p>This test confirms that Resend and your sending address are working.</p><p><a href="${getSiteUrl()}" style="color:#08783f;font-weight:800;">Open Podium Watch</a></p></div>`,
    text: "Podium Watch notifications are connected.",
    idempotencyKey: `admin-test-${Date.now()}`
  });

  return { sent: true, provider_id: result.id || null };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action, 80).toLowerCase() || "get_dashboard";
    let result;

    if (action === "get_dashboard") {
      const days = [7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30;
      result = await getDashboard(days);
    } else if (action === "save_settings") {
      result = await saveSettings(body);
    } else if (action === "save_sponsor") {
      result = await saveSponsor(body);
    } else if (action === "save_placement") {
      result = await savePlacement(body);
    } else if (action === "delete_sponsor") {
      result = await deleteRecord("team_sponsors", body.sponsor_id, "Sponsor");
    } else if (action === "delete_placement") {
      result = await deleteRecord("team_sponsor_placements", body.placement_id, "Placement");
    } else if (action === "send_test") {
      result = await sendTestEmail(body);
    } else if (action === "process_queue") {
      result = await processImmediateNotifications({ maxEvents: 50 });
    } else if (action === "process_weekly") {
      result = await processWeeklyDigests();
    } else {
      const error = new Error("Unsupported engagement admin action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Admin engagement error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "The engagement request could not be completed."
    });
  }
}
