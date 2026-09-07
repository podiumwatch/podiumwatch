// Writer Portal. Stage 1: accounts and profiles. Stage 2 (this file's
// article functions below): the actual writing editor -- create, edit,
// autosave, and submit an article. Nothing here ever makes an article
// public; publishing is a staff-only action, Stage 3.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

const EDITABLE_STATUSES = ["draft", "needs_revision"];
const ARTICLE_CATEGORIES = new Set(["race_recap", "feature", "rankings_polls", "recruiting", "other"]);
const MAX_TAGS = 8;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function updateOwnProfile(userId, input) {
  const fullName = cleanAthleteText(input.fullName, 200);
  if (!fullName) fail("Your name is required.");

  const { data, error } = await supabaseAdmin
    .from("portal_profiles")
    .update({
      full_name: fullName,
      school: cleanAthleteText(input.school, 200) || null,
      grade: cleanAthleteText(input.grade, 30) || null,
      bio: cleanAthleteText(input.bio, 2000) || null
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

const ARTICLE_STATUSES = ["draft", "submitted", "needs_revision", "approved", "published", "archived"];

export async function listOwnArticles(userId) {
  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .select("id, title, status, updated_at")
    .eq("author_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const grouped = Object.fromEntries(ARTICLE_STATUSES.map((status) => [status, []]));
  for (const article of data || []) {
    (grouped[article.status] || (grouped[article.status] = [])).push(article);
  }
  return grouped;
}

function cleanTags(value) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map((tag) => cleanAthleteText(tag, 40)).filter(Boolean);
  return [...new Set(cleaned)].slice(0, MAX_TAGS);
}

function cleanCategory(value) {
  const category = cleanAthleteText(value, 40).toLowerCase();
  return ARTICLE_CATEGORIES.has(category) ? category : null;
}

// A writer can only ever fetch/edit their OWN article -- author_id is
// always the verified caller's id, never client-supplied, matching the
// RLS policy's own rule (defense in depth, since this goes through the
// service-role client which RLS doesn't apply to).
export async function getOwnArticle(userId, articleId) {
  const cleanedId = cleanAthleteText(articleId, 100);
  if (!cleanedId) fail("Choose an article.");

  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .select("*")
    .eq("id", cleanedId)
    .eq("author_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("That article could not be found.", 404);
  return data;
}

export async function createArticle(userId) {
  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .insert({ author_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateOwnArticle(userId, articleId, input) {
  // Confirms ownership AND that it's still editable before touching
  // anything -- getOwnArticle's own 404 already keeps a writer from ever
  // learning whether some other article id exists at all.
  const existing = await getOwnArticle(userId, articleId);
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    fail("This article can no longer be edited -- it's already been submitted.", 409);
  }

  const update = {};
  if (input.title !== undefined) update.title = cleanAthleteText(input.title, 300);
  if (input.dek !== undefined) update.dek = cleanAthleteText(input.dek, 500) || null;
  if (input.body !== undefined) {
    // Tiptap's editor.getJSON() output -- a real object, never a bare
    // string or null. Not otherwise validated here; its internal shape
    // is Tiptap's own concern, not this service's.
    if (input.body === null || typeof input.body !== "object" || Array.isArray(input.body)) {
      fail("The article body is invalid.");
    }
    update.body = input.body;
  }
  if (input.category !== undefined) update.category = cleanCategory(input.category);
  if (input.tags !== undefined) update.tags = cleanTags(input.tags);
  if (input.featuredImageUrl !== undefined) update.featured_image_url = cleanAthleteText(input.featuredImageUrl, 1000) || null;
  if (input.photoCredit !== undefined) update.photo_credit = cleanAthleteText(input.photoCredit, 300) || null;

  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .update(update)
    .eq("id", articleId)
    .eq("author_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Snapshots the article's full state at the moment its status changes --
// article_revisions exists so an editor's "needs revision" round trip (or
// just plain history) never loses what an earlier version actually said.
async function recordRevision(article) {
  const { error } = await supabaseAdmin.from("portal_article_revisions").insert({
    article_id: article.id,
    snapshot: article,
    status_at_snapshot: article.status
  });
  if (error) throw error;
}

export async function submitOwnArticle(userId, articleId) {
  const existing = await getOwnArticle(userId, articleId);
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    fail("This article has already been submitted.", 409);
  }
  if (!cleanAthleteText(existing.title, 300)) fail("Add a title before submitting.");
  const bodyHasContent = existing.body && typeof existing.body === "object" && Array.isArray(existing.body.content) && existing.body.content.length > 0;
  if (!bodyHasContent) fail("Write something before submitting.");

  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", articleId)
    .eq("author_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  await recordRevision(data);
  return data;
}

// --- admin/staff: managing writers -----------------------------------------

export async function listPortalWriters() {
  const { data, error } = await supabaseAdmin
    .from("portal_profiles")
    .select("id, full_name, role, school, grade, bio, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

const PORTAL_ROLES = new Set(["writer", "editor", "admin"]);

export async function setPortalRole({ profileId, role, actorId }) {
  const cleanedId = cleanAthleteText(profileId, 100);
  if (!cleanedId) fail("Choose a writer.");
  if (!PORTAL_ROLES.has(role)) fail("Choose a valid role.");

  if (cleanedId === actorId && role !== "admin") {
    fail("Use another admin to change your own role.", 409);
  }

  const { data, error } = await supabaseAdmin
    .from("portal_profiles")
    .update({ role })
    .eq("id", cleanedId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("That writer could not be found.", 404);
  return data;
}
