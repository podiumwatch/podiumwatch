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

// --- admin/staff: review queue and publishing -------------------------------

const REVIEW_STATUSES = new Set(["submitted", "needs_revision", "approved", "published", "archived"]);

export async function listArticlesForReview({ status, category, authorId } = {}) {
  let query = supabaseAdmin
    .from("portal_articles")
    .select("id, title, status, category, tags, author_id, submitted_at, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  const cleanStatus = cleanAthleteText(status, 30).toLowerCase();
  if (cleanStatus && REVIEW_STATUSES.has(cleanStatus)) {
    query = query.eq("status", cleanStatus);
  } else {
    // Default view: everything actually needing or past review -- never
    // a writer's still-private draft, which staff has no reason to see
    // unless the writer themselves submits it.
    query = query.in("status", [...REVIEW_STATUSES]);
  }

  const cleanCategoryFilter = cleanCategory(category);
  if (cleanCategoryFilter) query = query.eq("category", cleanCategoryFilter);

  const cleanAuthorId = cleanAthleteText(authorId, 100);
  if (cleanAuthorId) query = query.eq("author_id", cleanAuthorId);

  const { data: articles, error } = await query;
  if (error) throw error;

  const authorIds = [...new Set((articles || []).map((a) => a.author_id))];
  const authorMap = new Map();
  if (authorIds.length) {
    const { data: authors, error: authorError } = await supabaseAdmin
      .from("portal_profiles")
      .select("id, full_name")
      .in("id", authorIds);
    if (authorError) throw authorError;
    for (const author of authors || []) authorMap.set(author.id, author.full_name);
  }

  return (articles || []).map((article) => ({ ...article, author_name: authorMap.get(article.author_id) || "" }));
}

export async function getArticleForReview(articleId) {
  const cleanedId = cleanAthleteText(articleId, 100);
  if (!cleanedId) fail("Choose an article.");

  const { data: article, error } = await supabaseAdmin
    .from("portal_articles")
    .select("*")
    .eq("id", cleanedId)
    .maybeSingle();
  if (error) throw error;
  if (!article) fail("That article could not be found.", 404);

  const [authorResult, notesResult] = await Promise.all([
    supabaseAdmin.from("portal_profiles").select("id, full_name, school, grade").eq("id", article.author_id).maybeSingle(),
    supabaseAdmin.from("portal_editor_notes").select("id, note, editor_id, created_at").eq("article_id", cleanedId).order("created_at", { ascending: false })
  ]);
  if (authorResult.error) throw authorResult.error;
  if (notesResult.error) throw notesResult.error;

  const editorIds = [...new Set((notesResult.data || []).map((n) => n.editor_id))];
  const editorMap = new Map();
  if (editorIds.length) {
    const { data: editors, error: editorError } = await supabaseAdmin.from("portal_profiles").select("id, full_name").in("id", editorIds);
    if (editorError) throw editorError;
    for (const editor of editors || []) editorMap.set(editor.id, editor.full_name);
  }

  return {
    ...article,
    author: authorResult.data || null,
    notes: (notesResult.data || []).map((note) => ({ ...note, editor_name: editorMap.get(note.editor_id) || "" }))
  };
}

export async function addEditorNote({ articleId, editorId, note }) {
  const cleanedId = cleanAthleteText(articleId, 100);
  const cleanedNote = cleanAthleteText(note, 4000);
  if (!cleanedId) fail("Choose an article.");
  if (!cleanedNote) fail("Write a note first.");

  const { error } = await supabaseAdmin.from("portal_editor_notes").insert({
    article_id: cleanedId,
    editor_id: editorId,
    note: cleanedNote
  });
  if (error) throw error;
}

async function transitionArticleStatus({ articleId, fromStatuses, toStatus, extraFields = {}, requireStatusMessage }) {
  const cleanedId = cleanAthleteText(articleId, 100);
  if (!cleanedId) fail("Choose an article.");

  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .update({ status: toStatus, ...extraFields })
    .eq("id", cleanedId)
    .in("status", fromStatuses)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail(requireStatusMessage, 409);
  await recordRevision(data);
  return data;
}

export async function requestRevision({ articleId, editorId, note }) {
  const cleanedNote = cleanAthleteText(note, 4000);
  if (!cleanedNote) fail("Explain what needs to change before requesting a revision.");

  const article = await transitionArticleStatus({
    articleId,
    fromStatuses: ["submitted"],
    toStatus: "needs_revision",
    requireStatusMessage: "This article isn't awaiting review."
  });
  await addEditorNote({ articleId, editorId, note: cleanedNote });
  return article;
}

export async function approveArticle({ articleId }) {
  return transitionArticleStatus({
    articleId,
    fromStatuses: ["submitted"],
    toStatus: "approved",
    requireStatusMessage: "This article isn't awaiting review."
  });
}

// Sequential -3, -4 (not random) so a collision is only ever with an
// article of the same or very similar title -- readable, predictable
// URLs, matching how every other slugged content type on this site
// resolves collisions (stories, teams, rankings).
async function generateUniqueSlug(title) {
  const base = String(title || "article")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "article";

  let candidate = base;
  let suffix = 2;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("portal_articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function publishArticle({ articleId }) {
  const cleanedId = cleanAthleteText(articleId, 100);
  if (!cleanedId) fail("Choose an article.");

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("portal_articles")
    .select("id, title, slug, status")
    .eq("id", cleanedId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) fail("That article could not be found.", 404);
  if (existing.status !== "approved") fail("Only an approved article can be published.", 409);

  const slug = existing.slug || await generateUniqueSlug(existing.title);

  return transitionArticleStatus({
    articleId,
    fromStatuses: ["approved"],
    toStatus: "published",
    extraFields: { slug, published_at: new Date().toISOString() },
    requireStatusMessage: "Only an approved article can be published."
  });
}

export async function archiveArticle({ articleId }) {
  return transitionArticleStatus({
    articleId,
    fromStatuses: ["published"],
    toStatus: "archived",
    requireStatusMessage: "Only a published article can be archived."
  });
}

// --- public: published articles and author pages, no login required -------

export async function getPublishedArticleBySlug(slug) {
  const cleanedSlug = cleanAthleteText(slug, 300).toLowerCase();
  if (!cleanedSlug) fail("Choose an article.");

  const { data: article, error } = await supabaseAdmin
    .from("portal_articles")
    .select("id, title, slug, dek, body, category, tags, featured_image_url, photo_credit, published_at, author_id")
    .eq("slug", cleanedSlug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!article) fail("That article could not be found.", 404);

  const { data: author, error: authorError } = await supabaseAdmin
    .from("portal_profiles")
    .select("id, full_name, school, bio, avatar_url")
    .eq("id", article.author_id)
    .maybeSingle();
  if (authorError) throw authorError;

  return { ...article, author: author || null };
}

export async function getAuthorPublicProfile(profileId) {
  const cleanedId = cleanAthleteText(profileId, 100);
  if (!cleanedId) fail("Choose an author.");

  const { data: profile, error } = await supabaseAdmin
    .from("portal_profiles")
    .select("id, full_name, school, bio, avatar_url")
    .eq("id", cleanedId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) fail("That author could not be found.", 404);

  const { data: articles, error: articlesError } = await supabaseAdmin
    .from("portal_articles")
    .select("id, title, slug, dek, featured_image_url, published_at")
    .eq("author_id", cleanedId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (articlesError) throw articlesError;

  return { profile, articles: articles || [] };
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
