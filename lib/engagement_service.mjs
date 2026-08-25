import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";

const CATEGORY_COLUMNS = {
  schedule: "alert_schedule",
  roster: "alert_roster",
  results: "alert_results",
  announcements: "alert_announcements",
  achievements: "alert_achievements",
  coverage: "alert_coverage",
  media: "alert_media",
  recruiting: "alert_recruiting"
};

const SITE_FALLBACK = "https://podiumwatch.vercel.app";

// Event types recordAnalyticsEvent will accept, covering both the
// original team-page engagement tracking (team_profile_view through
// sponsor_click) and free public tools that have nothing to do with a
// team (pace_calculator_use). team_id is already nullable and already
// used this way in practice -- directory_view fires with no team_id
// today -- so a tool-page event needs no schema change, just a new
// allowed type here. Exported (not a local literal inside
// recordAnalyticsEvent) so it's directly unit-testable without a live
// database connection.
const ANALYTICS_EVENT_TYPES = new Set([
  "team_profile_view",
  "directory_view",
  "schedule_view",
  "roster_view",
  "content_view",
  "social_click",
  "recruiting_click",
  "follow_submit",
  "sponsor_impression",
  "sponsor_click",
  "pace_calculator_use",
  // Fires once per browser session per story from every /stories/{slug}/
  // page (public/scripts/story-view.js) -- reuses this same table via its
  // existing content_type/content_id columns rather than a new one, the
  // same way pace_calculator_use reuses it with team_id left null.
  "story_view"
]);

function cleanText(value, maxLength = 4000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const cleaned = cleanText(value, 2000);

  if (!cleaned) {
    return "";
  }

  try {
    const url = new URL(cleaned);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function getSiteUrl() {
  const value = cleanText(
    process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL,
    500
  );

  if (!value) {
    return SITE_FALLBACK;
  }

  const prepared = /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;

  return safeUrl(prepared).replace(/\/$/, "") || SITE_FALLBACK;
}

function resolveDestinationUrl(value) {
  const cleaned = cleanText(value, 2000);

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) {
    return `${getSiteUrl()}${cleaned}`;
  }

  return safeUrl(cleaned);
}

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function normalizeEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function validateEmail(value) {
  const email = normalizeEmail(value);

  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }

  return email;
}

async function getEngagementSettings() {
  const { data, error } = await supabaseAdmin
    .from("engagement_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || {
    id: true,
    notification_mode: "paused",
    default_frequency: "weekly",
    emails_per_run: 100,
    public_following_enabled: false,
    sponsor_display_enabled: true,
    analytics_enabled: true
  };
}

function requireEmailConfiguration() {
  const apiKey = cleanText(process.env.RESEND_API_KEY, 1000);
  const from = cleanText(process.env.RESEND_FROM_EMAIL, 500);

  if (!apiKey || !from) {
    const error = new Error(
      "Email delivery is not configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel."
    );
    error.status = 503;
    throw error;
  }

  return {
    apiKey,
    from,
    replyTo: cleanText(process.env.RESEND_REPLY_TO, 500) || undefined
  };
}

async function sendResendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey
}) {
  const config = requireEmailConfiguration();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey
        ? { "Idempotency-Key": idempotencyKey.slice(0, 256) }
        : {})
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      html,
      text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {})
    })
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || "Resend could not send the email."
    );
    error.status = 502;
    throw error;
  }

  return data;
}

async function loadPublishedTeam(teamId) {
  const { data, error } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, published, suspended, archived_at, merged_into_team_id")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    !data.published ||
    data.suspended ||
    data.archived_at ||
    data.merged_into_team_id
  ) {
    const notFound = new Error("This team profile is not available for following.");
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

async function requestTeamFollow({
  teamId,
  email,
  frequency,
  preferences = {},
  source = "team_profile"
}) {
  const settings = await getEngagementSettings();

  if (!settings.public_following_enabled) {
    const error = new Error("Team following is not open yet.");
    error.status = 503;
    throw error;
  }

  if (settings.notification_mode === "paused") {
    const error = new Error("Team notifications are temporarily paused.");
    error.status = 503;
    throw error;
  }

  const normalizedEmail = validateEmail(email);
  const finalFrequency = ["immediate", "weekly"].includes(frequency)
    ? frequency
    : settings.default_frequency || "weekly";

  if (
    settings.notification_mode === "test" &&
    normalizeEmail(settings.test_email) !== normalizedEmail
  ) {
    const error = new Error(
      "Notifications are currently in testing mode. Only the Podium Watch test email can subscribe."
    );
    error.status = 403;
    throw error;
  }

  const team = await loadPublishedTeam(teamId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("team_followers")
    .select(
      "id, status, access_token_hash, access_token_secret, verified_at"
    )
    .eq("email_normalized", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const rawToken = existing?.access_token_secret || createToken();
  const tokenHash = existing?.access_token_hash || hashToken(rawToken);
  let subscriber;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("team_followers")
      .update({
        email: normalizedEmail,
        access_token_hash: tokenHash,
        access_token_secret: rawToken,
        source,
        unsubscribed_at: null
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    subscriber = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("team_followers")
      .insert({
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        access_token_hash: tokenHash,
        access_token_secret: rawToken,
        status: "pending",
        source
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    subscriber = data;
  }

  const { data: existingFollow, error: existingFollowError } =
    await supabaseAdmin
      .from("team_follows")
      .select("*")
      .eq("subscriber_id", subscriber.id)
      .eq("team_id", team.id)
      .maybeSingle();

  if (existingFollowError) {
    throw existingFollowError;
  }

  const preserveActiveFollow =
    subscriber.status === "active" && existingFollow?.active === true;

  const followValues = preserveActiveFollow
    ? {
        subscriber_id: subscriber.id,
        team_id: team.id,
        active: true,
        frequency: existingFollow.frequency,
        alert_schedule: existingFollow.alert_schedule,
        alert_roster: existingFollow.alert_roster,
        alert_results: existingFollow.alert_results,
        alert_announcements: existingFollow.alert_announcements,
        alert_achievements: existingFollow.alert_achievements,
        alert_coverage: existingFollow.alert_coverage,
        alert_media: existingFollow.alert_media,
        alert_recruiting: existingFollow.alert_recruiting
      }
    : {
        subscriber_id: subscriber.id,
        team_id: team.id,
        active: false,
        frequency: finalFrequency,
        alert_schedule: preferences.schedule !== false,
        alert_roster: preferences.roster !== false,
        alert_results: preferences.results !== false,
        alert_announcements: preferences.announcements !== false,
        alert_achievements: preferences.achievements !== false,
        alert_coverage: preferences.coverage !== false,
        alert_media: preferences.media === true,
        alert_recruiting: preferences.recruiting === true
      };

  const { error: followError } = await supabaseAdmin
    .from("team_follows")
    .upsert(followValues, {
      onConflict: "subscriber_id,team_id"
    });

  if (followError) {
    throw followError;
  }

  const siteUrl = getSiteUrl();
  const verifyUrl = `${siteUrl}/api/followers/verify?token=${encodeURIComponent(
    rawToken
  )}`;
  const manageUrl = `${siteUrl}/follow/?token=${encodeURIComponent(rawToken)}`;
  const subject = preserveActiveFollow
    ? `Manage your ${team.school_name} alerts`
    : `Confirm your ${team.school_name} alerts`;
  const actionLabel = preserveActiveFollow
    ? "Manage team alerts"
    : "Confirm team alerts";
  const intro = preserveActiveFollow
    ? `You already follow ${team.school_name}. Use the secure link below to review or change your preferences.`
    : `You asked to follow ${team.school_name}. Confirm your email before alerts begin.`;
  const actionUrl = preserveActiveFollow ? manageUrl : verifyUrl;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827;line-height:1.55;">
      <div style="padding:24px;background:#07130d;color:#fff;border-radius:16px 16px 0 0;">
        <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#00bf63;">Podium Watch</div>
        <h1 style="margin:8px 0 0;font-size:28px;">${escapeHtml(actionLabel)}</h1>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;">
        <p>${escapeHtml(intro)}</p>
        <p style="margin:28px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 20px;background:#00bf63;color:#07130d;text-decoration:none;border-radius:10px;font-weight:900;">${escapeHtml(actionLabel)}</a></p>
        <p style="font-size:13px;color:#6b7280;">You can manage or stop alerts at any time from <a href="${escapeHtml(manageUrl)}">your notification settings</a>.</p>
      </div>
    </div>`;
  const text = `${intro}\n\n${actionLabel}: ${actionUrl}\n\nManage notifications: ${manageUrl}`;
  const fifteenMinuteBucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const idempotencyKey = `follow-${subscriber.id}-${team.id}-${fifteenMinuteBucket}`;
  const delivery = await createDelivery({
    subscriber_id: subscriber.id,
    team_id: team.id,
    delivery_type: "verification",
    recipient_email: normalizedEmail,
    status: "queued",
    idempotency_key: idempotencyKey
  });

  if (delivery) {
    try {
      const result = await sendResendEmail({
        to: normalizedEmail,
        subject,
        html,
        text,
        idempotencyKey
      });

      await supabaseAdmin
        .from("team_notification_deliveries")
        .update({
          status: "sent",
          provider_id: result.id || null,
          sent_at: new Date().toISOString()
        })
        .eq("id", delivery.id);
    } catch (error) {
      await supabaseAdmin
        .from("team_notification_deliveries")
        .update({
          status: "failed",
          error_message: cleanText(error.message, 2000)
        })
        .eq("id", delivery.id);

      throw error;
    }
  }

  return {
    requested: true,
    team_name: team.school_name,
    frequency: preserveActiveFollow
      ? existingFollow.frequency
      : finalFrequency,
    already_following: preserveActiveFollow
  };
}

async function verifyFollowerToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  if (!rawToken || rawToken.length < 20) {
    const error = new Error("The notification link is invalid.");
    error.status = 400;
    throw error;
  }

  const { data: subscriber, error } = await supabaseAdmin
    .from("team_followers")
    .select("*")
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!subscriber) {
    const invalid = new Error("The notification link is invalid or expired.");
    invalid.status = 404;
    throw invalid;
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("team_followers")
    .update({
      status: "active",
      verified_at: subscriber.verified_at || now,
      unsubscribed_at: null
    })
    .eq("id", subscriber.id);

  if (updateError) {
    throw updateError;
  }

  const { error: followsError } = await supabaseAdmin
    .from("team_follows")
    .update({ active: true })
    .eq("subscriber_id", subscriber.id);

  if (followsError) {
    throw followsError;
  }

  return subscriber;
}

async function loadFollowerPreferences(rawToken) {
  const tokenHash = hashToken(rawToken);

  const { data: subscriber, error } = await supabaseAdmin
    .from("team_followers")
    .select("id, email, status, verified_at, created_at")
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!subscriber) {
    const invalid = new Error("The notification link is invalid.");
    invalid.status = 404;
    throw invalid;
  }

  const { data: follows, error: followsError } = await supabaseAdmin
    .from("team_follows")
    .select(`
      id,
      active,
      frequency,
      alert_schedule,
      alert_roster,
      alert_results,
      alert_announcements,
      alert_achievements,
      alert_coverage,
      alert_media,
      alert_recruiting,
      team:team_pages(id, school_name, slug, mascot, city, state)
    `)
    .eq("subscriber_id", subscriber.id)
    .order("created_at", { ascending: true });

  if (followsError) {
    throw followsError;
  }

  return {
    subscriber,
    follows: follows || []
  };
}

async function updateFollowerPreferences(rawToken, body) {
  const data = await loadFollowerPreferences(rawToken);
  const action = cleanText(body.action, 80).toLowerCase();

  if (action === "unsubscribe_all") {
    await Promise.all([
      supabaseAdmin
        .from("team_followers")
        .update({
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString()
        })
        .eq("id", data.subscriber.id),
      supabaseAdmin
        .from("team_follows")
        .update({ active: false })
        .eq("subscriber_id", data.subscriber.id)
    ]);

    return { unsubscribed: true };
  }

  if (action !== "save_follow") {
    const error = new Error("Choose a valid notification action.");
    error.status = 400;
    throw error;
  }

  const followId = cleanText(body.follow_id, 100);
  const existing = data.follows.find((follow) => follow.id === followId);

  if (!existing) {
    const error = new Error("The team follow was not found.");
    error.status = 404;
    throw error;
  }

  const frequency = ["immediate", "weekly"].includes(body.frequency)
    ? body.frequency
    : existing.frequency;

  const { error } = await supabaseAdmin
    .from("team_follows")
    .update({
      active: body.active !== false,
      frequency,
      alert_schedule: body.alert_schedule !== false,
      alert_roster: body.alert_roster !== false,
      alert_results: body.alert_results !== false,
      alert_announcements: body.alert_announcements !== false,
      alert_achievements: body.alert_achievements !== false,
      alert_coverage: body.alert_coverage !== false,
      alert_media: body.alert_media === true,
      alert_recruiting: body.alert_recruiting === true
    })
    .eq("id", followId)
    .eq("subscriber_id", data.subscriber.id);

  if (error) {
    throw error;
  }

  if (data.subscriber.status !== "active" && body.active !== false) {
    await supabaseAdmin
      .from("team_followers")
      .update({ status: "active", unsubscribed_at: null })
      .eq("id", data.subscriber.id);
  }

  return {
    saved: true,
    ...(await loadFollowerPreferences(rawToken))
  };
}

async function queueTeamNotification({
  teamId,
  category,
  title,
  summary,
  destinationUrl,
  sourceType,
  sourceId,
  dedupeKey,
  createdBy,
  metadata = {}
}) {
  if (!CATEGORY_COLUMNS[category]) {
    return { queued: false, reason: "unsupported_category" };
  }

  const finalTitle = cleanText(title, 220);

  if (!teamId || !finalTitle) {
    return { queued: false, reason: "missing_required_values" };
  }

  const finalDedupe = cleanText(
    dedupeKey || `${teamId}:${category}:${sourceType || "event"}:${sourceId || finalTitle}`,
    500
  );

  const { data, error } = await supabaseAdmin
    .from("team_notification_events")
    .upsert(
      {
        team_id: teamId,
        category,
        title: finalTitle,
        summary: cleanText(summary, 1200) || null,
        destination_url: resolveDestinationUrl(destinationUrl) || null,
        source_type: cleanText(sourceType, 100) || null,
        source_id: cleanText(sourceId, 200) || null,
        dedupe_key: finalDedupe,
        status: "queued",
        available_at: new Date().toISOString(),
        created_by: cleanText(createdBy, 300) || null,
        metadata
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    )
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    queued: Boolean(data),
    event: data || null
  };
}

async function loadSponsorPlacements({ teamId = null, placementTypes = [] } = {}) {
  const settings = await getEngagementSettings();

  if (!settings.sponsor_display_enabled) {
    return [];
  }

  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("team_sponsor_placements")
    .select(`
      id,
      team_id,
      placement_type,
      headline,
      body_text,
      image_url,
      button_label,
      destination_url,
      priority,
      starts_at,
      ends_at,
      sponsor:team_sponsors(
        id,
        name,
        slug,
        logo_url,
        website_url,
        description,
        status,
        starts_at,
        ends_at
      )
    `)
    .eq("active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (placementTypes.length) {
    query = query.in("placement_type", placementTypes);
  }

  if (teamId) {
    query = query.or(`team_id.is.null,team_id.eq.${teamId}`);
  } else {
    query = query.is("team_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).filter((placement) => {
    const sponsor = placement.sponsor;

    if (!sponsor || sponsor.status !== "active") {
      return false;
    }

    const startsAt = placement.starts_at || sponsor.starts_at;
    const endsAt = placement.ends_at || sponsor.ends_at;

    return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
  });
}

function buildEmailShell({ heading, intro, bodyHtml, manageUrl, sponsor }) {
  const sponsorHtml = sponsor
    ? `<div style="margin-top:26px;padding:18px;border-radius:12px;background:#f3f4f6;text-align:center;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Sponsored</div>
        ${sponsor.sponsor?.logo_url ? `<img src="${escapeHtml(sponsor.sponsor.logo_url)}" alt="${escapeHtml(sponsor.sponsor.name)}" style="max-height:52px;max-width:180px;margin:12px auto;display:block;">` : ""}
        <strong>${escapeHtml(sponsor.headline || sponsor.sponsor?.name || "Podium Watch Partner")}</strong>
        ${sponsor.body_text ? `<p style="margin:8px 0;">${escapeHtml(sponsor.body_text)}</p>` : ""}
        <a href="${escapeHtml(sponsor.destination_url)}" style="color:#08783f;font-weight:800;">${escapeHtml(sponsor.button_label || "Learn more")}</a>
      </div>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#111827;line-height:1.55;">
      <div style="padding:24px;background:#07130d;color:#fff;border-radius:16px 16px 0 0;">
        <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#00bf63;">Podium Watch</div>
        <h1 style="margin:8px 0 0;font-size:28px;">${escapeHtml(heading)}</h1>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;">
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
        ${bodyHtml}
        ${sponsorHtml}
        <p style="margin-top:28px;font-size:13px;color:#6b7280;">Manage or stop your Podium Watch alerts at <a href="${escapeHtml(manageUrl)}">notification settings</a>.</p>
      </div>
    </div>`;
}

async function createDelivery(values) {
  const { data, error } = await supabaseAdmin
    .from("team_notification_deliveries")
    .insert(values)
    .select("id")
    .single();

  if (error && error.code !== "23505") {
    throw error;
  }

  return data || null;
}

async function processImmediateNotifications({ maxEvents = 25 } = {}) {
  const settings = await getEngagementSettings();

  if (settings.notification_mode === "paused") {
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      mode: "paused"
    };
  }

  const sendBudget = Math.max(
    1,
    Number(settings.emails_per_run) || 100
  );

  const { data: events, error } = await supabaseAdmin
    .from("team_notification_events")
    .select(`
      *,
      team:team_pages(id, school_name, slug, published, suspended, archived_at)
    `)
    .eq("status", "queued")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(maxEvents);

  if (error) {
    throw error;
  }

  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    mode: settings.notification_mode,
    deferred: 0
  };

  for (const event of events || []) {
    if (stats.sent + stats.failed >= sendBudget) {
      break;
    }

    stats.processed += 1;

    let eventSent = 0;
    let eventSkipped = 0;
    let eventFailed = 0;
    let deferred = false;

    if (
      !event.team ||
      !event.team.published ||
      event.team.suspended ||
      event.team.archived_at
    ) {
      await supabaseAdmin
        .from("team_notification_events")
        .update({
          status: "cancelled",
          processed_at: new Date().toISOString(),
          last_error: "Team profile is not publicly available."
        })
        .eq("id", event.id);

      stats.skipped += 1;
      continue;
    }

    await supabaseAdmin
      .from("team_notification_events")
      .update({ status: "processing" })
      .eq("id", event.id);

    try {
      const sponsorPlacements = await loadSponsorPlacements({
        teamId: event.team_id,
        placementTypes: ["email"]
      });
      const sponsor = sponsorPlacements[0] || null;
      const siteUrl = getSiteUrl();
      const destination =
        safeUrl(event.destination_url) ||
        `${siteUrl}/team/?slug=${encodeURIComponent(event.team.slug)}`;

      if (settings.notification_mode === "test") {
        const testEmail = validateEmail(settings.test_email);
        const manageUrl = `${siteUrl}/follow/`;
        const idempotencyKey = `test-${event.id}-${testEmail}`;

        const delivery = await createDelivery({
          event_id: event.id,
          team_id: event.team_id,
          delivery_type: "test",
          recipient_email: testEmail,
          status: "queued",
          idempotency_key: idempotencyKey
        });

        if (!delivery) {
          stats.skipped += 1;
          eventSkipped += 1;
        } else {
          const bodyHtml = `
            <p style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#08783f;">${escapeHtml(event.category)}</p>
            <h2>${escapeHtml(event.title)}</h2>
            ${event.summary ? `<p>${escapeHtml(event.summary)}</p>` : ""}
            <p><a href="${escapeHtml(destination)}" style="display:inline-block;padding:12px 18px;background:#00bf63;color:#07130d;text-decoration:none;border-radius:10px;font-weight:900;">View update</a></p>`;

          try {
            const result = await sendResendEmail({
              to: testEmail,
              subject: `[TEST] ${event.team.school_name}: ${event.title}`,
              html: buildEmailShell({
                heading: event.team.school_name,
                intro: "This is a Podium Watch notification test.",
                bodyHtml,
                manageUrl,
                sponsor
              }),
              text: `${event.team.school_name}: ${event.title}\n${event.summary || ""}\n${destination}`,
              idempotencyKey
            });

            await supabaseAdmin
              .from("team_notification_deliveries")
              .update({
                status: "sent",
                provider_id: result.id || null,
                sent_at: new Date().toISOString()
              })
              .eq("id", delivery.id);

            stats.sent += 1;
            eventSent += 1;
          } catch (sendError) {
            await supabaseAdmin
              .from("team_notification_deliveries")
              .update({
                status: "failed",
                error_message: cleanText(sendError.message, 2000)
              })
              .eq("id", delivery.id);

            stats.failed += 1;
            eventFailed += 1;
          }
        }
      } else {
        const preferenceColumn = CATEGORY_COLUMNS[event.category];

        if (!preferenceColumn) {
          throw new Error(`Unsupported notification category: ${event.category}`);
        }

        const { data: follows, error: followsError } = await supabaseAdmin
          .from("team_follows")
          .select("id, subscriber_id, frequency")
          .eq("team_id", event.team_id)
          .eq("active", true)
          .eq("frequency", "immediate")
          .eq(preferenceColumn, true);

        if (followsError) {
          throw followsError;
        }

        const subscriberIds = [
          ...new Set((follows || []).map((row) => row.subscriber_id))
        ];
        let subscribers = [];

        if (subscriberIds.length) {
          const { data, error: subscriberError } = await supabaseAdmin
            .from("team_followers")
            .select("id, email, access_token_secret, status")
            .in("id", subscriberIds)
            .eq("status", "active")
            .order("created_at", { ascending: true });

          if (subscriberError) {
            throw subscriberError;
          }

          subscribers = data || [];
        }

        for (const subscriber of subscribers) {
          if (stats.sent + stats.failed >= sendBudget) {
            deferred = true;
            stats.deferred += 1;
            break;
          }

          const idempotencyKey = `event-${event.id}-${subscriber.id}`;
          const delivery = await createDelivery({
            event_id: event.id,
            subscriber_id: subscriber.id,
            team_id: event.team_id,
            delivery_type: "immediate",
            recipient_email: subscriber.email,
            status: "queued",
            idempotency_key: idempotencyKey
          });

          if (!delivery) {
            stats.skipped += 1;
            eventSkipped += 1;
            continue;
          }

          const manageUrl = `${siteUrl}/follow/?token=${encodeURIComponent(
            subscriber.access_token_secret
          )}`;
          const bodyHtml = `
            <p style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#08783f;">${escapeHtml(event.category)}</p>
            <h2>${escapeHtml(event.title)}</h2>
            ${event.summary ? `<p>${escapeHtml(event.summary)}</p>` : ""}
            <p><a href="${escapeHtml(destination)}" style="display:inline-block;padding:12px 18px;background:#00bf63;color:#07130d;text-decoration:none;border-radius:10px;font-weight:900;">View update</a></p>`;

          try {
            const result = await sendResendEmail({
              to: subscriber.email,
              subject: `${event.team.school_name}: ${event.title}`,
              html: buildEmailShell({
                heading: event.team.school_name,
                intro: "A team you follow posted a new update.",
                bodyHtml,
                manageUrl,
                sponsor
              }),
              text: `${event.team.school_name}: ${event.title}\n${event.summary || ""}\n${destination}`,
              idempotencyKey
            });

            const sentAt = new Date().toISOString();

            await Promise.all([
              supabaseAdmin
                .from("team_notification_deliveries")
                .update({
                  status: "sent",
                  provider_id: result.id || null,
                  sent_at: sentAt
                })
                .eq("id", delivery.id),
              supabaseAdmin
                .from("team_followers")
                .update({ last_email_at: sentAt })
                .eq("id", subscriber.id),
              supabaseAdmin
                .from("team_follows")
                .update({ last_notified_at: sentAt })
                .eq("subscriber_id", subscriber.id)
                .eq("team_id", event.team_id)
            ]);

            stats.sent += 1;
            eventSent += 1;
          } catch (sendError) {
            await supabaseAdmin
              .from("team_notification_deliveries")
              .update({
                status: "failed",
                error_message: cleanText(sendError.message, 2000)
              })
              .eq("id", delivery.id);

            stats.failed += 1;
            eventFailed += 1;
          }
        }
      }

      const processedAt = new Date().toISOString();
      const status = deferred
        ? "queued"
        : eventFailed > 0 && eventSent === 0
          ? "failed"
          : "sent";

      await supabaseAdmin
        .from("team_notification_events")
        .update({
          status,
          processed_at: deferred ? null : processedAt,
          available_at: deferred
            ? new Date(Date.now() + 60_000).toISOString()
            : event.available_at,
          last_error:
            eventFailed > 0
              ? "One or more deliveries failed."
              : deferred
                ? "Delivery continues on the next notification run."
                : null,
          metadata: {
            ...(event.metadata || {}),
            delivery_summary: {
              sent: eventSent,
              skipped: eventSkipped,
              failed: eventFailed,
              deferred
            }
          }
        })
        .eq("id", event.id);
    } catch (eventError) {
      await supabaseAdmin
        .from("team_notification_events")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          last_error: cleanText(eventError.message, 2000)
        })
        .eq("id", event.id);

      stats.failed += 1;
    }
  }

  return stats;
}

async function processWeeklyDigests() {
  const settings = await getEngagementSettings();

  if (settings.notification_mode !== "live") {
    return { sent: 0, skipped: 0, failed: 0, mode: settings.notification_mode };
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventError } = await supabaseAdmin
    .from("team_notification_events")
    .select(`
      id,
      team_id,
      category,
      title,
      summary,
      destination_url,
      created_at,
      team:team_pages(id, school_name, slug, published, suspended, archived_at)
    `)
    .gte("created_at", since)
    .in("status", ["sent", "queued"])
    .order("created_at", { ascending: false });

  if (eventError) {
    throw eventError;
  }

  const validEvents = (events || []).filter(
    (event) => event.team?.published && !event.team.suspended && !event.team.archived_at
  );

  if (!validEvents.length) {
    return { sent: 0, skipped: 0, failed: 0, mode: "live" };
  }

  const teamIds = [...new Set(validEvents.map((event) => event.team_id))];
  const { data: follows, error: followError } = await supabaseAdmin
    .from("team_follows")
    .select("*")
    .in("team_id", teamIds)
    .eq("active", true)
    .eq("frequency", "weekly");

  if (followError) {
    throw followError;
  }

  const subscriberIds = [...new Set((follows || []).map((follow) => follow.subscriber_id))];
  let subscribers = [];

  if (subscriberIds.length) {
    const { data, error } = await supabaseAdmin
      .from("team_followers")
      .select("id, email, access_token_secret, status")
      .in("id", subscriberIds)
      .eq("status", "active");

    if (error) {
      throw error;
    }

    subscribers = data || [];
  }

  const subscriberMap = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]));
  const followsBySubscriber = new Map();

  for (const follow of follows || []) {
    if (!followsBySubscriber.has(follow.subscriber_id)) {
      followsBySubscriber.set(follow.subscriber_id, []);
    }
    followsBySubscriber.get(follow.subscriber_id).push(follow);
  }

  const siteUrl = getSiteUrl();
  const stats = { sent: 0, skipped: 0, failed: 0, mode: "live" };

  for (const [subscriberId, subscriberFollows] of followsBySubscriber.entries()) {
    const subscriber = subscriberMap.get(subscriberId);

    if (!subscriber) {
      stats.skipped += 1;
      continue;
    }

    const relevantEvents = validEvents.filter((event) => {
      const follow = subscriberFollows.find((item) => item.team_id === event.team_id);
      return follow && follow[CATEGORY_COLUMNS[event.category]] === true;
    });

    if (!relevantEvents.length) {
      stats.skipped += 1;
      continue;
    }

    const weekKey = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `weekly-${weekKey}-${subscriber.id}`;
    const delivery = await createDelivery({
      subscriber_id: subscriber.id,
      delivery_type: "weekly",
      recipient_email: subscriber.email,
      status: "queued",
      idempotency_key: idempotencyKey,
      metadata: { event_ids: relevantEvents.map((event) => event.id) }
    });

    if (!delivery) {
      stats.skipped += 1;
      continue;
    }

    const listHtml = relevantEvents
      .slice(0, 30)
      .map((event) => {
        const destination = safeUrl(event.destination_url) || `${siteUrl}/team/?slug=${encodeURIComponent(event.team.slug)}`;
        return `<div style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#08783f;">${escapeHtml(event.team.school_name)} · ${escapeHtml(event.category)}</div>
          <h3 style="margin:6px 0;">${escapeHtml(event.title)}</h3>
          ${event.summary ? `<p style="margin:6px 0;">${escapeHtml(event.summary)}</p>` : ""}
          <a href="${escapeHtml(destination)}" style="color:#08783f;font-weight:800;">View update</a>
        </div>`;
      })
      .join("");

    try {
      const result = await sendResendEmail({
        to: subscriber.email,
        subject: `Your weekly Podium Watch team recap`,
        html: buildEmailShell({
          heading: "Weekly team recap",
          intro: `${relevantEvents.length} update${relevantEvents.length === 1 ? "" : "s"} from teams you follow.`,
          bodyHtml: listHtml,
          manageUrl: `${siteUrl}/follow/?token=${encodeURIComponent(subscriber.access_token_secret)}`,
          sponsor: null
        }),
        text: relevantEvents
          .map((event) => `${event.team.school_name}: ${event.title}`)
          .join("\n"),
        idempotencyKey
      });

      await supabaseAdmin
        .from("team_notification_deliveries")
        .update({
          status: "sent",
          provider_id: result.id || null,
          sent_at: new Date().toISOString()
        })
        .eq("id", delivery.id);
      stats.sent += 1;
    } catch (sendError) {
      await supabaseAdmin
        .from("team_notification_deliveries")
        .update({
          status: "failed",
          error_message: cleanText(sendError.message, 2000)
        })
        .eq("id", delivery.id);
      stats.failed += 1;
    }
  }

  return stats;
}

async function recordAnalyticsEvent(body) {
  const settings = await getEngagementSettings();

  if (!settings.analytics_enabled) {
    return { recorded: false };
  }

  const eventType = cleanText(body.event_type, 80);

  if (!ANALYTICS_EVENT_TYPES.has(eventType)) {
    const error = new Error("Analytics event type is invalid.");
    error.status = 400;
    throw error;
  }

  const teamId = cleanText(body.team_id, 100) || null;
  const sponsorId = cleanText(body.sponsor_id, 100) || null;
  const visitorId = cleanText(body.visitor_id, 100) || null;
  const sessionId = cleanText(body.session_id, 100) || null;

  if (teamId) {
    const { data: team, error } = await supabaseAdmin
      .from("team_pages")
      .select("id, published, suspended, archived_at")
      .eq("id", teamId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!team || !team.published || team.suspended || team.archived_at) {
      return { recorded: false };
    }
  }

  const referrer = cleanText(body.referrer, 1000);
  let referrerHost = null;

  if (referrer) {
    try {
      referrerHost = new URL(referrer).host.slice(0, 300);
    } catch {
      referrerHost = null;
    }
  }

  const { error } = await supabaseAdmin
    .from("team_analytics_events")
    .insert({
      team_id: teamId,
      event_type: eventType,
      section: cleanText(body.section, 120) || null,
      visitor_id: visitorId,
      session_id: sessionId,
      path: cleanText(body.path, 1000) || null,
      target_url: safeUrl(body.target_url) || null,
      content_type: cleanText(body.content_type, 100) || null,
      content_id: cleanText(body.content_id, 200) || null,
      sponsor_id: sponsorId,
      referrer_host: referrerHost,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? body.metadata
          : {}
    });

  if (error) {
    throw error;
  }

  return { recorded: true };
}

function aggregateAnalytics(events) {
  const counts = {};
  const uniqueVisitors = new Set();
  const sections = new Map();
  const teams = new Map();
  const sponsors = new Map();
  // Keyed by content_id (a story's slug for story_view events) --
  // deliberately scoped to event_type === "story_view" rather than every
  // content_type this table might ever carry, so a future, differently-
  // shaped content_view use doesn't silently mix into the same counts.
  const stories = new Map();

  for (const event of events || []) {
    counts[event.event_type] = (counts[event.event_type] || 0) + 1;

    if (event.visitor_id) {
      uniqueVisitors.add(event.visitor_id);
    }

    if (event.section) {
      sections.set(event.section, (sections.get(event.section) || 0) + 1);
    }

    if (event.team_id) {
      teams.set(event.team_id, (teams.get(event.team_id) || 0) + 1);
    }

    if (event.sponsor_id) {
      sponsors.set(event.sponsor_id, (sponsors.get(event.sponsor_id) || 0) + 1);
    }

    if (event.event_type === "story_view" && event.content_id) {
      stories.set(event.content_id, (stories.get(event.content_id) || 0) + 1);
    }
  }

  return {
    total_events: (events || []).length,
    unique_visitors: uniqueVisitors.size,
    counts,
    top_sections: [...sections.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    team_counts: [...teams.entries()]
      .map(([team_id, count]) => ({ team_id, count }))
      .sort((a, b) => b.count - a.count),
    sponsor_counts: [...sponsors.entries()]
      .map(([sponsor_id, count]) => ({ sponsor_id, count }))
      .sort((a, b) => b.count - a.count),
    story_counts: [...stories.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count)
  };
}

export {
  ANALYTICS_EVENT_TYPES,
  CATEGORY_COLUMNS,
  cleanText,
  escapeHtml,
  safeUrl,
  getSiteUrl,
  createToken,
  hashToken,
  normalizeEmail,
  validateEmail,
  getEngagementSettings,
  sendResendEmail,
  requestTeamFollow,
  verifyFollowerToken,
  loadFollowerPreferences,
  updateFollowerPreferences,
  queueTeamNotification,
  loadSponsorPlacements,
  processImmediateNotifications,
  processWeeklyDigests,
  recordAnalyticsEvent,
  aggregateAnalytics
};
