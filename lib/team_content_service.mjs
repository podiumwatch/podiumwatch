import { supabaseAdmin } from "./supabase-admin.mjs";
import { writeTeamChange } from "./team_audit.mjs";

const CONTENT_TYPES = new Set([
  "announcement",
  "achievement",
  "result",
  "coverage",
  "media"
]);

const CONTENT_STATUSES = new Set([
  "draft",
  "published",
  "archived"
]);

const SPORT_SCOPES = new Set([
  "All",
  "Cross Country",
  "Indoor Track",
  "Outdoor Track",
  "Track and Field"
]);

const PROGRAM_SCOPES = new Set([
  "combined",
  "boys",
  "girls"
]);

const MEDIA_KINDS = new Set([
  "photo",
  "graphic",
  "video",
  "gallery",
  "other"
]);

const ITEM_FIELDS = `
  id,
  created_at,
  updated_at,
  team_id,
  content_type,
  title,
  summary,
  body_text,
  event_date,
  season_label,
  sport_scope,
  program_scope,
  meet_name,
  result_place,
  result_score,
  url,
  cta_label,
  image_url,
  video_url,
  media_kind,
  photographer_name,
  photographer_url,
  source_name,
  status,
  notify_followers,
  featured,
  featured_rank,
  sort_order,
  published_at,
  archived_at,
  suspended,
  admin_locked,
  moderation_note,
  created_by_user_id,
  created_by_label,
  updated_by_user_id,
  updated_by_label
`;

function cleanText(value, maxLength = 3000) {
  return String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .slice(0, maxLength);
}

function cleanSingleLine(value, maxLength = 3000) {
  return cleanText(value, maxLength)
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNullableText(value, maxLength = 3000) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function cleanNullableSingleLine(value, maxLength = 3000) {
  const cleaned = cleanSingleLine(value, maxLength);
  return cleaned || null;
}

function cleanBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes", "on"].includes(
    cleanSingleLine(value, 20).toLowerCase()
  );
}

function cleanInteger(value, fallback = 0, minimum = -100000, maximum = 100000) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.trunc(number)));
}

function cleanId(value, label = "ID") {
  const cleaned = cleanSingleLine(value, 100);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleaned
    )
  ) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return cleaned;
}

function cleanOptionalId(value, label = "ID") {
  const cleaned = cleanSingleLine(value, 100);
  return cleaned ? cleanId(cleaned, label) : null;
}

function cleanDate(value, label = "Date") {
  const cleaned = cleanSingleLine(value, 20);

  if (!cleaned) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const error = new Error(`${label} must use YYYY-MM-DD format.`);
    error.status = 400;
    throw error;
  }

  const date = new Date(`${cleaned}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }

  return cleaned;
}

function cleanUrl(value, label) {
  const cleaned = cleanSingleLine(value, 2000);

  if (!cleaned) {
    return null;
  }

  const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(prepared);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }

    return url.href;
  } catch {
    const error = new Error(`${label} must be a valid website address.`);
    error.status = 400;
    throw error;
  }
}

function cleanChoice(value, allowed, fallback, label) {
  const cleaned = cleanSingleLine(value, 100);

  if (!cleaned) {
    return fallback;
  }

  const exact = [...allowed].find(
    (item) => item.toLowerCase() === cleaned.toLowerCase()
  );

  if (!exact) {
    const error = new Error(`Choose a valid ${label}.`);
    error.status = 400;
    throw error;
  }

  return exact;
}

export function parseContentBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted content request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

async function loadTeam(teamId) {
  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .select(
      `
        id,
        school_name,
        slug,
        mascot,
        city,
        state,
        published,
        suspended,
        editing_locked,
        archived_at,
        merged_into_team_id,
        public_contact_email,
        recruiting_contact_email,
        recruiting_questionnaire_url,
        website_url,
        athletics_url,
        links_page_url,
        team_store_url,
        fundraiser_url,
        head_coach_setup,
        head_coach,
        head_boys_coach,
        head_girls_coach
      `
    )
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!team) {
    const notFound = new Error("Team page not found.");
    notFound.status = 404;
    throw notFound;
  }

  if (team.merged_into_team_id) {
    const merged = new Error("This team profile was merged into another profile.");
    merged.status = 409;
    throw merged;
  }

  return team;
}

function assertTeamEditable(team, actor) {
  if (actor.type === "admin") {
    return;
  }

  if (team.suspended) {
    const error = new Error("This team page is suspended.");
    error.status = 403;
    throw error;
  }

  if (team.archived_at) {
    const error = new Error("This team page is archived.");
    error.status = 403;
    throw error;
  }

  if (team.editing_locked) {
    const error = new Error("Podium Watch has temporarily locked editing for this team.");
    error.status = 403;
    throw error;
  }
}

async function loadItems(teamId) {
  const { data, error } = await supabaseAdmin
    .from("team_content_items")
    .select(ITEM_FIELDS)
    .eq("team_id", teamId)
    .order("featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

function summarizeItems(items) {
  const summary = {
    total: items.length,
    draft: 0,
    published: 0,
    archived: 0,
    featured: 0,
    suspended: 0,
    announcement: 0,
    achievement: 0,
    result: 0,
    coverage: 0,
    media: 0
  };

  items.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(summary, item.status)) {
      summary[item.status] += 1;
    }

    if (Object.prototype.hasOwnProperty.call(summary, item.content_type)) {
      summary[item.content_type] += 1;
    }

    if (item.featured) {
      summary.featured += 1;
    }

    if (item.suspended) {
      summary.suspended += 1;
    }
  });

  return summary;
}

async function getContent(teamId) {
  const [team, items] = await Promise.all([
    loadTeam(teamId),
    loadItems(teamId)
  ]);

  return {
    team,
    items,
    summary: summarizeItems(items)
  };
}

function normalizeItem(body, actor, existing = null) {
  const contentType = cleanChoice(
    body.content_type,
    CONTENT_TYPES,
    existing?.content_type || "announcement",
    "content type"
  );

  const status = cleanChoice(
    body.status,
    CONTENT_STATUSES,
    existing?.status || "draft",
    "content status"
  );

  const title = cleanSingleLine(body.title, 220);
  const summary = cleanNullableText(body.summary, 800);
  const bodyText = cleanNullableText(body.body_text, 16000);
  const eventDate = cleanDate(body.event_date, "Content date");
  const sportScope = cleanChoice(
    body.sport_scope,
    SPORT_SCOPES,
    existing?.sport_scope || "All",
    "sport"
  );
  const programScope = cleanChoice(
    body.program_scope,
    PROGRAM_SCOPES,
    existing?.program_scope || "combined",
    "program"
  );
  const mediaKind = cleanChoice(
    body.media_kind,
    MEDIA_KINDS,
    existing?.media_kind || "photo",
    "media type"
  );
  const url = cleanUrl(body.url, "Main link");
  const imageUrl = cleanUrl(body.image_url, "Image URL");
  const videoUrl = cleanUrl(body.video_url, "Video URL");
  const photographerUrl = cleanUrl(
    body.photographer_url,
    "Photographer website"
  );
  const featured = cleanBoolean(body.featured);

  if (!title) {
    const error = new Error("Content title is required.");
    error.status = 400;
    throw error;
  }

  if (
    status === "published" &&
    contentType === "announcement" &&
    !summary &&
    !bodyText
  ) {
    const error = new Error("Published announcements need a summary or message.");
    error.status = 400;
    throw error;
  }

  if (
    status === "published" &&
    contentType === "coverage" &&
    !url
  ) {
    const error = new Error("Published Podium Watch coverage needs a link.");
    error.status = 400;
    throw error;
  }

  if (
    status === "published" &&
    contentType === "media" &&
    !imageUrl &&
    !videoUrl &&
    !url
  ) {
    const error = new Error("Published media needs an image, video, or gallery link.");
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const finalFeatured = status === "published" && featured;

  return {
    content_type: contentType,
    title,
    summary,
    body_text: bodyText,
    event_date: eventDate,
    season_label: cleanNullableSingleLine(body.season_label, 120),
    sport_scope: sportScope,
    program_scope: programScope,
    meet_name: cleanNullableSingleLine(body.meet_name, 220),
    result_place: cleanNullableSingleLine(body.result_place, 120),
    result_score: cleanNullableSingleLine(body.result_score, 160),
    url,
    cta_label: cleanNullableSingleLine(body.cta_label, 80),
    image_url: imageUrl,
    video_url: videoUrl,
    media_kind: mediaKind,
    photographer_name: cleanNullableSingleLine(body.photographer_name, 180),
    photographer_url: photographerUrl,
    source_name: cleanNullableSingleLine(body.source_name, 180),
    status,
    notify_followers:
      Object.prototype.hasOwnProperty.call(body, "notify_followers")
        ? cleanBoolean(body.notify_followers)
        : existing?.notify_followers ?? true,
    featured: finalFeatured,
    featured_rank: cleanInteger(body.featured_rank, 0, 0, 9999),
    sort_order: cleanInteger(body.sort_order, 0, -9999, 9999),
    published_at:
      status === "published"
        ? existing?.published_at || now
        : null,
    archived_at:
      status === "archived"
        ? existing?.archived_at || now
        : null,
    updated_by_user_id: actor.userId || null,
    updated_by_label: cleanNullableSingleLine(actor.label, 300)
  };
}

async function loadItem(teamId, itemId) {
  const { data, error } = await supabaseAdmin
    .from("team_content_items")
    .select(ITEM_FIELDS)
    .eq("id", itemId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error("Content item not found.");
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

function assertItemEditable(item, actor) {
  if (actor.type !== "admin" && item.admin_locked) {
    const error = new Error("Podium Watch has locked this content item for review.");
    error.status = 403;
    throw error;
  }
}

async function saveItem(teamId, body, actor) {
  const team = await loadTeam(teamId);
  assertTeamEditable(team, actor);

  const itemId = cleanOptionalId(body.item_id, "Content item ID");
  const existing = itemId ? await loadItem(teamId, itemId) : null;

  if (existing) {
    assertItemEditable(existing, actor);
  }

  const updates = normalizeItem(body, actor, existing);

  if (actor.type === "admin") {
    if (Object.prototype.hasOwnProperty.call(body, "suspended")) {
      updates.suspended = cleanBoolean(body.suspended);
    }

    if (Object.prototype.hasOwnProperty.call(body, "admin_locked")) {
      updates.admin_locked = cleanBoolean(body.admin_locked);
    }

    if (Object.prototype.hasOwnProperty.call(body, "moderation_note")) {
      updates.moderation_note = cleanNullableText(body.moderation_note, 4000);
    }
  }

  if (updates.suspended === true) {
    updates.featured = false;
  }

  let saved;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("team_content_items")
      .update(updates)
      .eq("id", existing.id)
      .eq("team_id", teamId)
      .select(ITEM_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    saved = data;
  } else {
    const insert = {
      ...updates,
      team_id: teamId,
      created_by_user_id: actor.userId || null,
      created_by_label: cleanNullableSingleLine(actor.label, 300)
    };

    const { data, error } = await supabaseAdmin
      .from("team_content_items")
      .insert(insert)
      .select(ITEM_FIELDS)
      .single();

    if (error) {
      throw error;
    }

    saved = data;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: existing ? "update_team_content" : "create_team_content",
    summary: `${existing ? "Updated" : "Created"} ${saved.content_type}: ${saved.title}`,
    changedFields: ["team_content_items"],
    beforeData: existing || {},
    afterData: saved,
    metadata: { content_item_id: saved.id, content_type: saved.content_type }
  });

  return {
    saved: true,
    item: saved,
    ...(await getContent(teamId))
  };
}

async function changeStatus(teamId, body, actor) {
  const team = await loadTeam(teamId);
  assertTeamEditable(team, actor);

  const itemId = cleanId(body.item_id, "Content item ID");
  const item = await loadItem(teamId, itemId);
  assertItemEditable(item, actor);

  const status = cleanChoice(
    body.status,
    CONTENT_STATUSES,
    item.status,
    "content status"
  );

  const now = new Date().toISOString();
  const updates = {
    status,
    featured: status === "published" ? item.featured : false,
    published_at: status === "published" ? item.published_at || now : null,
    archived_at: status === "archived" ? item.archived_at || now : null,
    updated_by_user_id: actor.userId || null,
    updated_by_label: cleanNullableSingleLine(actor.label, 300)
  };

  const { data, error } = await supabaseAdmin
    .from("team_content_items")
    .update(updates)
    .eq("id", itemId)
    .eq("team_id", teamId)
    .select(ITEM_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "change_team_content_status",
    summary: `${data.title} changed to ${status}.`,
    changedFields: ["status", "featured"],
    beforeData: { status: item.status, featured: item.featured },
    afterData: { status: data.status, featured: data.featured },
    metadata: { content_item_id: data.id, content_type: data.content_type }
  });

  return {
    updated: true,
    item: data,
    ...(await getContent(teamId))
  };
}

async function toggleFeatured(teamId, body, actor) {
  const team = await loadTeam(teamId);
  assertTeamEditable(team, actor);

  const itemId = cleanId(body.item_id, "Content item ID");
  const item = await loadItem(teamId, itemId);
  assertItemEditable(item, actor);

  const featured = cleanBoolean(body.featured);

  if (featured && item.status !== "published") {
    const error = new Error("Publish this item before featuring it.");
    error.status = 400;
    throw error;
  }

  if (featured && item.suspended) {
    const error = new Error("A suspended item cannot be featured.");
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("team_content_items")
    .update({
      featured,
      featured_rank: cleanInteger(body.featured_rank, item.featured_rank || 0, 0, 9999),
      updated_by_user_id: actor.userId || null,
      updated_by_label: cleanNullableSingleLine(actor.label, 300)
    })
    .eq("id", itemId)
    .eq("team_id", teamId)
    .select(ITEM_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: featured ? "feature_team_content" : "unfeature_team_content",
    summary: featured
      ? `${data.title} was featured on the team page.`
      : `${data.title} was removed from featured content.`,
    changedFields: ["featured", "featured_rank"],
    beforeData: { featured: item.featured, featured_rank: item.featured_rank },
    afterData: { featured: data.featured, featured_rank: data.featured_rank },
    metadata: { content_item_id: data.id, content_type: data.content_type }
  });

  return {
    updated: true,
    item: data,
    ...(await getContent(teamId))
  };
}

async function moderateItem(teamId, body, actor) {
  if (actor.type !== "admin") {
    const error = new Error("Podium Watch admin access is required.");
    error.status = 403;
    throw error;
  }

  const itemId = cleanId(body.item_id, "Content item ID");
  const item = await loadItem(teamId, itemId);
  const suspended = cleanBoolean(body.suspended);
  const adminLocked = cleanBoolean(body.admin_locked);
  const moderationNote = cleanNullableText(body.moderation_note, 4000);

  const { data, error } = await supabaseAdmin
    .from("team_content_items")
    .update({
      suspended,
      admin_locked: adminLocked,
      moderation_note: moderationNote,
      featured: suspended ? false : item.featured,
      updated_by_label: actor.label || "Podium Watch Admin"
    })
    .eq("id", itemId)
    .eq("team_id", teamId)
    .select(ITEM_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "moderate_team_content",
    summary: `Podium Watch moderation settings changed for ${data.title}.`,
    changedFields: ["suspended", "admin_locked", "moderation_note", "featured"],
    beforeData: {
      suspended: item.suspended,
      admin_locked: item.admin_locked,
      moderation_note: item.moderation_note,
      featured: item.featured
    },
    afterData: {
      suspended: data.suspended,
      admin_locked: data.admin_locked,
      moderation_note: data.moderation_note,
      featured: data.featured
    },
    metadata: { content_item_id: data.id, content_type: data.content_type }
  });

  return {
    updated: true,
    item: data,
    ...(await getContent(teamId))
  };
}

async function deleteItem(teamId, body, actor) {
  const team = await loadTeam(teamId);
  assertTeamEditable(team, actor);

  const itemId = cleanId(body.item_id, "Content item ID");
  const item = await loadItem(teamId, itemId);
  assertItemEditable(item, actor);

  if (actor.type !== "admin" && item.status === "published") {
    const error = new Error("Archive published content before deleting it.");
    error.status = 409;
    throw error;
  }

  const { error } = await supabaseAdmin
    .from("team_content_items")
    .delete()
    .eq("id", itemId)
    .eq("team_id", teamId);

  if (error) {
    throw error;
  }

  await writeTeamChange({
    teamId,
    actorType: actor.type,
    actorId: actor.id,
    action: "delete_team_content",
    summary: `Deleted ${item.content_type}: ${item.title}`,
    changedFields: ["team_content_items"],
    beforeData: item,
    afterData: { deleted: true },
    metadata: { content_item_id: item.id, content_type: item.content_type }
  });

  return {
    deleted: true,
    item_id: itemId,
    ...(await getContent(teamId))
  };
}

export async function handleTeamContentAction({ teamId, body, actor }) {
  const action = cleanSingleLine(body.action, 80).toLowerCase() || "get";

  if (action === "get") {
    return getContent(teamId);
  }

  if (action === "save_item") {
    return saveItem(teamId, body, actor);
  }

  if (action === "change_status") {
    return changeStatus(teamId, body, actor);
  }

  if (action === "toggle_featured") {
    return toggleFeatured(teamId, body, actor);
  }

  if (action === "moderate_item") {
    return moderateItem(teamId, body, actor);
  }

  if (action === "delete_item") {
    return deleteItem(teamId, body, actor);
  }

  const error = new Error("Unsupported Team Content Hub action.");
  error.status = 400;
  throw error;
}

export { ITEM_FIELDS };
