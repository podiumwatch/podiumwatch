// Writer Portal. Stage 1: accounts and profiles. Stage 2 (this file's
// article functions below): the actual writing editor -- create, edit,
// autosave, and submit an article. Nothing here ever makes an article
// public; publishing is a staff-only action, Stage 3.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

const EDITABLE_STATUSES = ["draft", "needs_revision"];
const ARTICLE_CATEGORIES = new Set(["race_recap", "feature", "rankings_polls", "recruiting", "other"]);
const MAX_TAGS = 8;
const IMAGE_BUCKET = "writer-portal-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

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

// Direct-to-Supabase-Storage upload, matching install/45
// (timing_submissions_service.mjs's requestTimingSubmissionUploadSlot)
// rather than routing the file's bytes through this Vercel Function --
// see install/49's own header comment for why that matters here.
// Authenticated (any signed-in portal user), so unlike the public
// timing-submissions flow this doesn't need its own abuse-focused
// rate-limit table -- a signed-in writer is already a real, identified
// account.
export async function requestImageUploadSlot({ fileName, userId }) {
  const cleanedName = cleanAthleteText(fileName, 300);
  if (!cleanedName) fail("Choose an image to upload.");

  const match = cleanedName.match(/\.([a-z0-9]+)$/i);
  const extension = (match ? match[1] : "").toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    fail(`That file type isn't accepted. Use one of: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}.`);
  }

  const storageKey = `${userId}/${randomUUID()}.${extension}`;

  const { data, error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(storageKey);
  if (error) throw error;

  const { data: publicUrlData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(storageKey);

  return {
    storage_key: storageKey,
    signed_url: data.signedUrl,
    token: data.token,
    public_url: publicUrlData.publicUrl,
    max_file_bytes: MAX_IMAGE_BYTES
  };
}

const ARTICLE_STATUSES = ["draft", "submitted", "needs_revision", "approved", "published", "archived"];

export async function listOwnArticles(userId) {
  const { data, error } = await supabaseAdmin
    .from("portal_articles")
    .select("id, title, status, updated_at, view_count")
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
// service-role client which RLS doesn't apply to). includeNotes is off
// by default since updateOwnArticle/submitOwnArticle both call this
// purely as an ownership/status check and would otherwise pay for a
// join they never use -- only the writer-facing get_article action asks
// for notes.
export async function getOwnArticle(userId, articleId, { includeNotes = false } = {}) {
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
  if (!includeNotes) return data;

  // A writer needs to actually see WHY their piece was sent back --
  // without this, requestRevision's own note (lib/writer_portal_service.
  // mjs, staff side) is written but never visible to the one person it's
  // actually for.
  const { data: notes, error: notesError } = await supabaseAdmin
    .from("portal_editor_notes")
    .select("id, note, editor_id, created_at, anchor_text")
    .eq("article_id", cleanedId)
    .order("created_at", { ascending: false });
  if (notesError) throw notesError;

  const editorIds = [...new Set((notes || []).map((n) => n.editor_id))];
  const editorMap = new Map();
  if (editorIds.length) {
    const { data: editors, error: editorError } = await supabaseAdmin.from("portal_profiles").select("id, full_name").in("id", editorIds);
    if (editorError) throw editorError;
    for (const editor of editors || []) editorMap.set(editor.id, editor.full_name);
  }

  return { ...data, notes: (notes || []).map((note) => ({ ...note, editor_name: editorMap.get(note.editor_id) || "an editor" })) };
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

// A writer can only ever delete their own still-editable (never-submitted,
// or sent-back) work -- once something's been through review, deleting it
// would erase real review history (portal_article_revisions/
// portal_editor_notes both cascade-delete with the article), which stays
// staff's call (archiveArticle), not a plain writer's.
export async function deleteOwnArticle(userId, articleId) {
  const existing = await getOwnArticle(userId, articleId);
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    fail("Only a draft or an article sent back for revision can be deleted.", 409);
  }

  const { error } = await supabaseAdmin
    .from("portal_articles")
    .delete()
    .eq("id", articleId)
    .eq("author_id", userId);

  if (error) throw error;
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
    supabaseAdmin.from("portal_editor_notes").select("id, note, editor_id, created_at, anchor_text").eq("article_id", cleanedId).order("created_at", { ascending: false })
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

// anchorText is the literal passage this note refers to, if any -- see
// install/50's header comment for why that's a plain text field, not a
// mark saved inside the article's own body JSON.
export async function addEditorNote({ articleId, editorId, note, anchorText }) {
  const cleanedId = cleanAthleteText(articleId, 100);
  const cleanedNote = cleanAthleteText(note, 4000);
  if (!cleanedId) fail("Choose an article.");
  if (!cleanedNote) fail("Write a note first.");

  const { error } = await supabaseAdmin.from("portal_editor_notes").insert({
    article_id: cleanedId,
    editor_id: editorId,
    note: cleanedNote,
    anchor_text: cleanAthleteText(anchorText, 500) || null
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

  // Atomic in the database (increment_portal_article_view_count,
  // install/48) so concurrent readers can never race each other into
  // undercounting -- fire-and-forget: a view count that's briefly stale
  // by one request is fine, but the request itself should never wait on
  // it or fail the whole page load if it errors.
  supabaseAdmin.rpc("increment_portal_article_view_count", { p_article_id: article.id }).then(
    ({ error: rpcError }) => { if (rpcError) console.error("View count increment failed:", rpcError); }
  );

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

// --- editorial calendar / story ideas ---------------------------------------
// Any signed-in portal user can read the calendar (to find ideas to
// claim); only staff can create/edit/delete/assign. isStaffRole below is
// how the API layer decides which of those two a given caller gets --
// this file itself only ever trusts the actorId/actorRole it's handed by
// that layer, never a client-supplied "am I staff" flag.

export function isStaffRole(role) {
  return role === "editor" || role === "admin";
}

function cleanTargetDate(value) {
  const cleaned = cleanAthleteText(value, 30);
  if (!cleaned) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

export async function listStoryIdeas({ from, to, viewerId, viewerIsStaff }) {
  let query = supabaseAdmin
    .from("portal_story_ideas")
    .select("*")
    .order("target_date", { ascending: true, nullsFirst: false });

  const cleanFrom = cleanTargetDate(from);
  const cleanTo = cleanTargetDate(to);
  if (cleanFrom) query = query.gte("target_date", cleanFrom);
  if (cleanTo) query = query.lte("target_date", cleanTo);

  // A plain writer sees the same calendar staff does (open ideas plus
  // whatever's assigned to them) -- just never anyone ELSE's specific
  // assignment, matching "assignable" being staff's call, not a private
  // roster staff alone can see.
  if (!viewerIsStaff) {
    query = query.or(`assigned_to.is.null,assigned_to.eq.${viewerId}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const profileIds = [...new Set((data || []).flatMap((idea) => [idea.assigned_to, idea.created_by]).filter(Boolean))];
  const profileMap = new Map();
  if (profileIds.length) {
    const { data: profiles, error: profileError } = await supabaseAdmin.from("portal_profiles").select("id, full_name").in("id", profileIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) profileMap.set(profile.id, profile.full_name);
  }

  return (data || []).map((idea) => ({
    ...idea,
    assigned_to_name: idea.assigned_to ? profileMap.get(idea.assigned_to) || "" : "",
    created_by_name: profileMap.get(idea.created_by) || ""
  }));
}

export async function createStoryIdea({ title, description, category, targetDate, assignedTo, createdBy }) {
  const cleanedTitle = cleanAthleteText(title, 300);
  if (!cleanedTitle) fail("A title is required.");

  const { data, error } = await supabaseAdmin
    .from("portal_story_ideas")
    .insert({
      title: cleanedTitle,
      description: cleanAthleteText(description, 2000) || null,
      category: cleanCategory(category),
      target_date: cleanTargetDate(targetDate),
      assigned_to: cleanAthleteText(assignedTo, 100) || null,
      created_by: createdBy
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateStoryIdea(ideaId, input) {
  const cleanedId = cleanAthleteText(ideaId, 100);
  if (!cleanedId) fail("Choose a story idea.");

  const update = {};
  if (input.title !== undefined) {
    const cleanedTitle = cleanAthleteText(input.title, 300);
    if (!cleanedTitle) fail("A title is required.");
    update.title = cleanedTitle;
  }
  if (input.description !== undefined) update.description = cleanAthleteText(input.description, 2000) || null;
  if (input.category !== undefined) update.category = cleanCategory(input.category);
  if (input.targetDate !== undefined) update.target_date = cleanTargetDate(input.targetDate);
  if (input.assignedTo !== undefined) update.assigned_to = cleanAthleteText(input.assignedTo, 100) || null;

  const { data, error } = await supabaseAdmin
    .from("portal_story_ideas")
    .update(update)
    .eq("id", cleanedId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("That story idea could not be found.", 404);
  return data;
}

export async function deleteStoryIdea(ideaId) {
  const cleanedId = cleanAthleteText(ideaId, 100);
  if (!cleanedId) fail("Choose a story idea.");

  const { error } = await supabaseAdmin.from("portal_story_ideas").delete().eq("id", cleanedId);
  if (error) throw error;
}

// A writer claims an OPEN idea for themselves -- never reassigns
// something already claimed by someone else (that stays a staff-only
// action via updateStoryIdea).
export async function claimStoryIdea({ ideaId, writerId }) {
  const cleanedId = cleanAthleteText(ideaId, 100);
  if (!cleanedId) fail("Choose a story idea.");

  const { data, error } = await supabaseAdmin
    .from("portal_story_ideas")
    .update({ assigned_to: writerId })
    .eq("id", cleanedId)
    .is("assigned_to", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) fail("This idea has already been claimed.", 409);
  return data;
}

// Turns a story idea into a real draft -- a normal createArticle, with
// the idea's own title/category pre-filled, then linked back so the
// calendar shows what it became. A writer can only start from an idea
// that's open or already assigned to them (the same rule claimStoryIdea
// enforces), never someone else's claimed idea.
export async function startArticleFromIdea({ ideaId, writerId }) {
  const cleanedId = cleanAthleteText(ideaId, 100);
  if (!cleanedId) fail("Choose a story idea.");

  const { data: idea, error: ideaError } = await supabaseAdmin
    .from("portal_story_ideas")
    .select("*")
    .eq("id", cleanedId)
    .maybeSingle();
  if (ideaError) throw ideaError;
  if (!idea) fail("That story idea could not be found.", 404);
  if (idea.assigned_to && idea.assigned_to !== writerId) fail("This idea is assigned to someone else.", 403);
  if (idea.article_id) fail("This idea already has an article started from it.", 409);

  const created = await createArticle(writerId);
  // updateOwnArticle's own return value is the real, current row -- the
  // one actually handed back to the caller, not createArticle's now-stale
  // pre-update snapshot.
  const article = await updateOwnArticle(writerId, created.id, { title: idea.title, category: idea.category || undefined });

  const { error: linkError } = await supabaseAdmin
    .from("portal_story_ideas")
    .update({ assigned_to: writerId, article_id: article.id })
    .eq("id", cleanedId);
  if (linkError) throw linkError;

  return article;
}

// --- style guide (single row, id=1) -----------------------------------

export async function getStyleGuide() {
  const { data, error } = await supabaseAdmin
    .from("portal_style_guide")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data || { id: 1, body: {}, updated_at: null, updated_by: null };
}

export async function updateStyleGuide({ body, updatedBy }) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    fail("The style guide content is invalid.");
  }

  const { data, error } = await supabaseAdmin
    .from("portal_style_guide")
    .upsert({ id: 1, body, updated_by: updatedBy }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// --- staff: queue stats --------------------------------------------------
// A summary bar for the review queue -- counts by status sitewide (not
// scoped to one writer, unlike listOwnArticles' grouping), how many
// writers exist by role, total lifetime views across every published
// piece, and the single oldest still-submitted article so staff can see
// at a glance whether anything's been waiting a long time.

export async function getPortalStats() {
  const [articlesResult, profilesResult, oldestSubmittedResult] = await Promise.all([
    supabaseAdmin.from("portal_articles").select("status, view_count"),
    supabaseAdmin.from("portal_profiles").select("role"),
    supabaseAdmin
      .from("portal_articles")
      .select("id, title, submitted_at")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);
  if (articlesResult.error) throw articlesResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (oldestSubmittedResult.error) throw oldestSubmittedResult.error;

  const byStatus = Object.fromEntries(ARTICLE_STATUSES.map((status) => [status, 0]));
  let totalViews = 0;
  for (const article of articlesResult.data || []) {
    byStatus[article.status] = (byStatus[article.status] || 0) + 1;
    totalViews += Number(article.view_count) || 0;
  }

  const byRole = { writer: 0, editor: 0, admin: 0 };
  for (const profile of profilesResult.data || []) {
    byRole[profile.role] = (byRole[profile.role] || 0) + 1;
  }

  return {
    by_status: byStatus,
    total_articles: (articlesResult.data || []).length,
    total_views: totalViews,
    by_role: byRole,
    total_writers: (profilesResult.data || []).length,
    oldest_submitted: oldestSubmittedResult.data || null
  };
}
