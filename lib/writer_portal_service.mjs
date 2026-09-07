// Writer Portal, Stage 1: accounts and profiles only. No article-writing
// UI yet (that's Stage 2) -- listOwnArticles exists now so the dashboard
// shell has a real (currently always-empty) data source to build on,
// rather than a hardcoded placeholder.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";

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
