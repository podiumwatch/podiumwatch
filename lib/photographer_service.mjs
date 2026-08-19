// Podium Watch Photographer Network database service. Three read/write
// paths share these tables:
//   - Public (read-only, approved + public_visible listings only).
//   - Admin (Phase One): full control, including status/featured/
//     founding/verification/plan -- gated by api/admin/photographers.js's
//     isAdminRequest().
//   - Photographer self-service (Phase Two): a signed-in photographer
//     may create and edit their OWN listing's core fields/sports/service
//     areas/portfolio, and submit it for review -- but can never set
//     status directly to 'approved', never set featured/founding/
//     verification/plan themselves, and every write is ownership-checked
//     via lib/photographer_auth.mjs's requirePhotographerOwnership().
//     Admin approval remains the only path to 'approved'.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { SPORTS, REGIONS } from "./photographer_constants.mjs";
import { requirePhotographerOwnership, loadActivePhotographerMemberships } from "./photographer_auth.mjs";

export { SPORTS, REGIONS };
const SPORT_VALUES = new Set(SPORTS.map((s) => s.value));
const REGION_VALUES = new Set(REGIONS);

const STATUS_VALUES = ["draft", "submitted", "pending_review", "approved", "rejected", "suspended"];

function fail(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 500) {
  return cleanText(value, maxLength) || null;
}

function cleanNullableUrl(value, label) {
  const cleaned = cleanText(value, 500);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) fail(`${label} must start with http:// or https://.`);
  return cleaned;
}

function cleanBoolean(value) {
  return value === true || value === "true" || value === 1;
}

function cleanUuid(value, label = "ID") {
  const cleaned = cleanText(value, 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    fail(`${label} is invalid.`);
  }
  return cleaned;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "photographer";
}

async function generateUniqueSlug(businessName) {
  const base = slugify(businessName);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabaseAdmin
      .from("photographers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  fail("Could not generate a unique listing address. Try a different business name.");
}

const PHOTOGRAPHER_FIELDS =
  "id, business_name, photographer_name, slug, short_description, about, city, state, zip_code, " +
  "website_url, instagram_url, facebook_url, business_email, business_phone, profile_image_url, logo_url, " +
  "statewide_travel, status, featured, founding_photographer, verification_status, plan_id, public_visible, " +
  "admin_notes, created_at, updated_at";

async function attachChildren(photographers) {
  const ids = photographers.map((p) => p.id);
  if (ids.length === 0) return photographers;

  const [{ data: sports, error: sportsError }, { data: areas, error: areasError }, { data: plans, error: plansError }] =
    await Promise.all([
      supabaseAdmin.from("photographer_sports").select("photographer_id, sport").in("photographer_id", ids),
      supabaseAdmin.from("photographer_service_areas").select("photographer_id, area_type, area_value").in("photographer_id", ids),
      supabaseAdmin.from("photographer_plans").select("id, name")
    ]);
  if (sportsError) throw sportsError;
  if (areasError) throw areasError;
  if (plansError) throw plansError;

  const plansById = new Map((plans || []).map((p) => [p.id, p.name]));

  return photographers.map((p) => ({
    ...p,
    plan_name: p.plan_id ? plansById.get(p.plan_id) || null : null,
    sports: (sports || []).filter((s) => s.photographer_id === p.id).map((s) => s.sport),
    service_areas: (areas || []).filter((a) => a.photographer_id === p.id)
  }));
}

// --- public read path --------------------------------------------------------

// Resolves a free-text school name to the location facts a search needs:
// team_pages' own city/region, plus (when linked) ohio_schools' county.
// Returns null, honestly, if nothing matches -- never a guessed location.
export async function resolveSchoolLocation(schoolText) {
  const cleaned = cleanText(schoolText, 200);
  if (!cleaned) return null;

  const { data: team, error } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, city, region, ohio_school_id")
    .eq("published", true)
    .ilike("school_name", `%${cleaned}%`)
    .order("school_name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!team) return null;

  let county = null;
  if (team.ohio_school_id) {
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("ohio_schools")
      .select("county, athletic_district")
      .eq("id", team.ohio_school_id)
      .maybeSingle();
    if (schoolError) throw schoolError;
    county = school?.county || null;
    if (!team.region && school?.athletic_district) team.region = school.athletic_district;
  }

  return { school_name: team.school_name, city: team.city || null, region: team.region || null, county };
}

// Public directory search. Only ever returns status = 'approved' AND
// public_visible = true rows -- see install/14's design note for why
// those are two independent gates.
export async function listPublicPhotographers({ search, school, sport, region, city, page = 1, pageSize = 24 } = {}) {
  const cleanedSearch = cleanText(search, 200);
  const cleanedSport = SPORT_VALUES.has(sport) ? sport : "";
  const cleanedRegion = REGION_VALUES.has(region) ? region : "";
  const cleanedCity = cleanText(city, 100);
  const pageNumber = Math.max(1, Number(page) || 1);
  const size = Math.min(60, Math.max(1, Number(pageSize) || 24));

  let resolvedSchool = null;
  let matchingIds = null; // null = no area-based restriction; array = restrict to these ids

  if (school) {
    resolvedSchool = await resolveSchoolLocation(school);
    if (!resolvedSchool) {
      return { photographers: [], total: 0, page: pageNumber, page_size: size, resolved_school: null, school_not_found: true };
    }

    const orClauses = [];
    if (resolvedSchool.city) orClauses.push(`and(area_type.eq.city,area_value.ilike.${resolvedSchool.city})`);
    if (resolvedSchool.region) orClauses.push(`and(area_type.eq.region,area_value.eq.${resolvedSchool.region})`);
    if (resolvedSchool.county) orClauses.push(`and(area_type.eq.county,area_value.ilike.${resolvedSchool.county})`);

    let areaQuery = null;
    if (orClauses.length > 0) {
      const { data: areaRows, error: areaError } = await supabaseAdmin
        .from("photographer_service_areas")
        .select("photographer_id")
        .or(orClauses.join(","));
      if (areaError) throw areaError;
      areaQuery = new Set((areaRows || []).map((r) => r.photographer_id));
    }

    const { data: statewideRows, error: statewideError } = await supabaseAdmin
      .from("photographers")
      .select("id")
      .eq("statewide_travel", true);
    if (statewideError) throw statewideError;
    (statewideRows || []).forEach((r) => (areaQuery || (areaQuery = new Set())).add(r.id));

    matchingIds = [...(areaQuery || new Set())];
    if (matchingIds.length === 0) {
      return { photographers: [], total: 0, page: pageNumber, page_size: size, resolved_school: resolvedSchool, school_not_found: false };
    }
  }

  let sportIds = null;
  if (cleanedSport) {
    const { data: sportRows, error: sportError } = await supabaseAdmin
      .from("photographer_sports")
      .select("photographer_id")
      .eq("sport", cleanedSport);
    if (sportError) throw sportError;
    sportIds = (sportRows || []).map((r) => r.photographer_id);
    if (sportIds.length === 0) {
      return { photographers: [], total: 0, page: pageNumber, page_size: size, resolved_school: resolvedSchool, school_not_found: false };
    }
  }

  let query = supabaseAdmin
    .from("photographers")
    .select(PHOTOGRAPHER_FIELDS, { count: "exact" })
    .eq("status", "approved")
    .eq("public_visible", true)
    .order("featured", { ascending: false })
    .order("business_name", { ascending: true })
    .range((pageNumber - 1) * size, pageNumber * size - 1);

  if (cleanedSearch) {
    query = query.or([
      `business_name.ilike.%${cleanedSearch}%`,
      `photographer_name.ilike.%${cleanedSearch}%`,
      `city.ilike.%${cleanedSearch}%`
    ].join(","));
  }
  if (cleanedCity) query = query.ilike("city", `%${cleanedCity}%`);
  if (cleanedRegion) {
    const { data: regionRows, error: regionError } = await supabaseAdmin
      .from("photographer_service_areas")
      .select("photographer_id")
      .eq("area_type", "region")
      .eq("area_value", cleanedRegion);
    if (regionError) throw regionError;
    const regionIds = (regionRows || []).map((r) => r.photographer_id);
    if (regionIds.length === 0) {
      return { photographers: [], total: 0, page: pageNumber, page_size: size, resolved_school: resolvedSchool, school_not_found: false };
    }
    matchingIds = matchingIds ? matchingIds.filter((id) => regionIds.includes(id)) : regionIds;
  }
  if (matchingIds) query = query.in("id", matchingIds);
  if (sportIds) query = query.in("id", sportIds);

  const { data, error, count } = await query;
  if (error) throw error;

  const withChildren = await attachChildren(data || []);
  return { photographers: withChildren, total: count || 0, page: pageNumber, page_size: size, resolved_school: resolvedSchool, school_not_found: false };
}

export async function getPublicPhotographerBySlug(slug) {
  const cleanedSlug = cleanText(slug, 200);
  if (!cleanedSlug) fail("A photographer address is required.", 400);

  const { data, error } = await supabaseAdmin
    .from("photographers")
    .select(PHOTOGRAPHER_FIELDS)
    .eq("slug", cleanedSlug)
    .eq("status", "approved")
    .eq("public_visible", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) fail("This photographer listing could not be found.", 404);

  const [withChildren] = await attachChildren([data]);

  const [{ data: portfolio, error: portfolioError }, meetCoverage, galleries] = await Promise.all([
    supabaseAdmin
      .from("photographer_portfolio")
      .select("id, image_url, caption, sport, sort_order")
      .eq("photographer_id", data.id)
      .eq("public_visible", true)
      .order("sort_order", { ascending: true }),
    loadMeetCoverageForPhotographer(data.id, { onlyPublic: true }),
    loadGalleriesForPhotographer(data.id, { onlyPublished: true })
  ]);
  if (portfolioError) throw portfolioError;

  return { ...withChildren, portfolio: portfolio || [], meet_coverage: meetCoverage, galleries };
}

// --- admin path ---------------------------------------------------------------

// The four real photographer_plans rows (seeded by install/14), for the
// admin plan-assignment dropdown -- plan ids are database-generated
// uuids, so unlike SPORTS/REGIONS this can't be a build-time constant.
export async function adminListPlans() {
  const { data, error } = await supabaseAdmin
    .from("photographer_plans")
    .select("id, name, price_cents, active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminListPhotographers({ search, status } = {}) {
  let query = supabaseAdmin
    .from("photographers")
    .select(PHOTOGRAPHER_FIELDS)
    .order("created_at", { ascending: false });

  const cleanedSearch = cleanText(search, 200);
  if (cleanedSearch) {
    query = query.or([
      `business_name.ilike.%${cleanedSearch}%`,
      `photographer_name.ilike.%${cleanedSearch}%`,
      `city.ilike.%${cleanedSearch}%`
    ].join(","));
  }
  if (STATUS_VALUES.includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return attachChildren(data || []);
}

export async function adminGetPhotographer(id) {
  const cleanedId = cleanUuid(id, "Photographer");
  const { data, error } = await supabaseAdmin
    .from("photographers")
    .select(PHOTOGRAPHER_FIELDS)
    .eq("id", cleanedId)
    .maybeSingle();
  if (error) throw error;
  if (!data) fail("Photographer not found.", 404);

  const [withChildren] = await attachChildren([data]);
  const [{ data: portfolio, error: portfolioError }, meetCoverage, galleries, subscription] = await Promise.all([
    supabaseAdmin
      .from("photographer_portfolio")
      .select("id, image_url, caption, sport, sort_order, public_visible")
      .eq("photographer_id", cleanedId)
      .order("sort_order", { ascending: true }),
    loadMeetCoverageForPhotographer(cleanedId),
    loadGalleriesForPhotographer(cleanedId),
    getSubscription(cleanedId)
  ]);
  if (portfolioError) throw portfolioError;

  return { ...withChildren, portfolio: portfolio || [], meet_coverage: meetCoverage, galleries, subscription };
}

// Required(er): every field here is validated only when the caller
// actually supplied it -- this is shared by both create (which requires
// business_name up front) and update (a "just flip status/featured"
// call must never be forced to resupply the entire form, or it fails
// with a confusing "Business name is required" 400).
const CORE_FIELD_CLEANERS = {
  business_name: (value) => cleanText(value, 200),
  photographer_name: (value) => cleanNullableText(value, 200),
  short_description: (value) => cleanNullableText(value, 300),
  about: (value) => cleanNullableText(value, 4000),
  city: (value) => cleanNullableText(value, 100),
  state: (value) => cleanNullableText(value, 2) || "OH",
  zip_code: (value) => cleanNullableText(value, 10),
  website_url: (value) => cleanNullableUrl(value, "Website"),
  instagram_url: (value) => cleanNullableUrl(value, "Instagram link"),
  facebook_url: (value) => cleanNullableUrl(value, "Facebook link"),
  business_email: (value) => cleanNullableText(value, 200),
  business_phone: (value) => cleanNullableText(value, 30),
  profile_image_url: (value) => cleanNullableUrl(value, "Profile image"),
  logo_url: (value) => cleanNullableUrl(value, "Logo image"),
  statewide_travel: cleanBoolean,
  admin_notes: (value) => cleanNullableText(value, 2000)
};

// Only requires business_name -- used by create, where every core field
// is expected (a brand-new record with no prior values to fall back on).
function corePhotographerFieldsForCreate(body) {
  const fields = {};
  for (const [key, cleaner] of Object.entries(CORE_FIELD_CLEANERS)) fields[key] = cleaner(body[key]);
  if (!fields.business_name) fail("Business name is required.");
  return fields;
}

// Only touches fields the caller actually sent -- used by update, so a
// status-only or featured-only call never has to resupply the whole form.
function corePhotographerFieldsForUpdate(body) {
  const fields = {};
  for (const [key, cleaner] of Object.entries(CORE_FIELD_CLEANERS)) {
    if (body[key] !== undefined) fields[key] = cleaner(body[key]);
  }
  if (fields.business_name !== undefined && !fields.business_name) fail("Business name is required.");
  return fields;
}

export async function adminCreatePhotographer(body) {
  const fields = corePhotographerFieldsForCreate(body);
  const slug = await generateUniqueSlug(fields.business_name);

  const { data, error } = await supabaseAdmin
    .from("photographers")
    .insert({ ...fields, slug, status: "draft" })
    .select(PHOTOGRAPHER_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function adminUpdatePhotographer(id, body) {
  const cleanedId = cleanUuid(id, "Photographer");
  const updates = corePhotographerFieldsForUpdate(body);

  if (body.status !== undefined) {
    if (!STATUS_VALUES.includes(body.status)) fail("Invalid status.");
    updates.status = body.status;
  }
  if (body.featured !== undefined) updates.featured = cleanBoolean(body.featured);
  if (body.founding_photographer !== undefined) updates.founding_photographer = cleanBoolean(body.founding_photographer);
  if (body.public_visible !== undefined) updates.public_visible = cleanBoolean(body.public_visible);
  if (body.verification_status !== undefined) {
    if (!["unverified", "verified"].includes(body.verification_status)) fail("Invalid verification status.");
    updates.verification_status = body.verification_status;
  }
  if (body.plan_id !== undefined) updates.plan_id = body.plan_id ? cleanUuid(body.plan_id, "Plan") : null;

  const { data, error } = await supabaseAdmin
    .from("photographers")
    .update(updates)
    .eq("id", cleanedId)
    .select(PHOTOGRAPHER_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function adminSetSports(id, sports) {
  const cleanedId = cleanUuid(id, "Photographer");
  const cleanedSports = [...new Set((Array.isArray(sports) ? sports : []).filter((s) => SPORT_VALUES.has(s)))];

  const { error: deleteError } = await supabaseAdmin.from("photographer_sports").delete().eq("photographer_id", cleanedId);
  if (deleteError) throw deleteError;

  if (cleanedSports.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("photographer_sports")
      .insert(cleanedSports.map((sport) => ({ photographer_id: cleanedId, sport })));
    if (insertError) throw insertError;
  }
  return cleanedSports;
}

export async function adminSetServiceAreas(id, areas) {
  const cleanedId = cleanUuid(id, "Photographer");
  const cleanedAreas = (Array.isArray(areas) ? areas : [])
    .map((a) => ({
      area_type: cleanText(a.area_type, 20),
      area_value: cleanText(a.area_value, 100)
    }))
    .filter((a) => ["county", "region", "city"].includes(a.area_type) && a.area_value);

  for (const area of cleanedAreas) {
    if (area.area_type === "region" && !REGION_VALUES.has(area.area_value)) {
      fail(`"${area.area_value}" is not a recognized region.`);
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("photographer_service_areas").delete().eq("photographer_id", cleanedId);
  if (deleteError) throw deleteError;

  const deduped = [...new Map(cleanedAreas.map((a) => [`${a.area_type}:${a.area_value}`, a])).values()];
  if (deduped.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("photographer_service_areas")
      .insert(deduped.map((a) => ({ photographer_id: cleanedId, ...a })));
    if (insertError) throw insertError;
  }
  return deduped;
}

export async function adminAddPortfolioItem(id, { image_url, caption, sport }) {
  const cleanedId = cleanUuid(id, "Photographer");
  const cleanedUrl = cleanNullableUrl(image_url, "Image URL");
  if (!cleanedUrl) fail("An image URL is required.");
  const cleanedSport = SPORT_VALUES.has(sport) ? sport : null;

  const { data: existing, error: countError } = await supabaseAdmin
    .from("photographer_portfolio")
    .select("id")
    .eq("photographer_id", cleanedId);
  if (countError) throw countError;

  const { data, error } = await supabaseAdmin
    .from("photographer_portfolio")
    .insert({
      photographer_id: cleanedId,
      image_url: cleanedUrl,
      caption: cleanNullableText(caption, 200),
      sport: cleanedSport,
      sort_order: (existing || []).length
    })
    .select("id, image_url, caption, sport, sort_order, public_visible")
    .single();
  if (error) throw error;
  return data;
}

export async function adminRemovePortfolioItem(portfolioId) {
  const cleanedId = cleanUuid(portfolioId, "Portfolio item");
  const { error } = await supabaseAdmin.from("photographer_portfolio").delete().eq("id", cleanedId);
  if (error) throw error;
  return { removed: true };
}

// --- photographer self-service path (Phase Two) -----------------------------
// Every function below is ownership-checked against the real signed-in
// user (lib/photographer_auth.mjs's requirePhotographerOwnership()) --
// never trust a photographer_id in the request body alone. None of
// these ever touch status beyond the draft/rejected -> submitted
// transition, and none ever touch featured/founding_photographer/
// verification_status/plan_id -- those stay admin-only, enforced by
// simply never accepting them here, not by trusting the caller to omit
// them.

const SELF_SERVICE_PORTFOLIO_LIMIT = 12;

export async function getMyPhotographerListings(userId) {
  const memberships = await loadActivePhotographerMemberships(userId);
  if (memberships.length === 0) return [];

  const ids = memberships.map((m) => m.photographer_id);
  const { data, error } = await supabaseAdmin
    .from("photographers")
    .select(PHOTOGRAPHER_FIELDS)
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const withChildren = await attachChildren(data || []);
  return attachOwnSubscriptions(withChildren);
}

// getMyPhotographerListings is the only self-service read path that
// DIDN'T already carry real subscription/membership data (the singular
// getMyPhotographerListing -> adminGetPhotographer path always has). The
// dashboard needs its own real membership status on first load, not just
// after a later "detail" refresh, so this batches one subscription
// lookup across all of the caller's own listings (almost always exactly
// one) and merges it in as `subscription`, same shape adminGetPhotographer
// already returns. Deliberately NOT folded into the shared attachChildren()
// -- that function also backs the public directory and admin list views,
// and subscription/billing facts must never leak into either of those.
async function attachOwnSubscriptions(photographers) {
  const ids = photographers.map((p) => p.id);
  if (ids.length === 0) return photographers;

  const { data, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select(SUBSCRIPTION_FIELDS)
    .in("photographer_id", ids);
  if (error) throw error;

  const byPhotographerId = new Map((data || []).map((s) => [s.photographer_id, s]));
  return photographers.map((p) => ({
    ...p,
    subscription: byPhotographerId.get(p.id) || { status: "inactive", current_period_end: null, cancel_at_period_end: false, partnership_story_status: "not_eligible" }
  }));
}

export async function getMyPhotographerListing(userId, photographerId) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);
  return adminGetPhotographer(cleanedId);
}

export async function createMyPhotographerListing(userId, body) {
  const fields = corePhotographerFieldsForCreate(body);
  const slug = await generateUniqueSlug(fields.business_name);

  const { data: photographer, error } = await supabaseAdmin
    .from("photographers")
    .insert({ ...fields, slug, status: "draft" })
    .select(PHOTOGRAPHER_FIELDS)
    .single();
  if (error) throw error;

  const { error: memberError } = await supabaseAdmin
    .from("photographer_members")
    .insert({ photographer_id: photographer.id, user_id: userId, role: "owner", status: "active" });
  if (memberError) throw memberError;

  return photographer;
}

export async function updateMyPhotographerListing(userId, photographerId, body) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  // Deliberately only the core fields -- status/featured/founding/
  // verification/plan_id are never accepted from this path, no matter
  // what the request body contains.
  const updates = corePhotographerFieldsForUpdate(body);

  const { data, error } = await supabaseAdmin
    .from("photographers")
    .update(updates)
    .eq("id", cleanedId)
    .select(PHOTOGRAPHER_FIELDS)
    .single();
  if (error) throw error;
  const [withSubscription] = await attachOwnSubscriptions([data]);
  return withSubscription;
}

// The only self-service status transition: draft or rejected ->
// submitted. Every other transition (including the only path to
// 'approved') stays admin-only.
export async function submitMyPhotographerListing(userId, photographerId) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  const { data: current, error: loadError } = await supabaseAdmin
    .from("photographers")
    .select("status")
    .eq("id", cleanedId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!current) fail("Photographer not found.", 404);
  if (!["draft", "rejected"].includes(current.status)) {
    fail(`A listing with status "${current.status}" cannot be submitted for review.`, 409);
  }

  const { data, error } = await supabaseAdmin
    .from("photographers")
    .update({ status: "submitted" })
    .eq("id", cleanedId)
    .select(PHOTOGRAPHER_FIELDS)
    .single();
  if (error) throw error;
  const [withSubscription] = await attachOwnSubscriptions([data]);
  return withSubscription;
}

export async function selfSetSports(userId, photographerId, sports) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);
  return adminSetSports(cleanedId, sports);
}

export async function selfSetServiceAreas(userId, photographerId, areas) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);
  return adminSetServiceAreas(cleanedId, areas);
}

export async function selfAddPortfolioItem(userId, photographerId, item) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  // Flat limit for every approved photographer, paid membership or not --
  // see the Membership Pricing Finalized revision: "Both plans receive
  // the same core Photographer Network features... do not make
  // photographers pay more to receive normal directory functionality."
  // There is no per-plan bonus to look up anymore, so no subscription
  // lookup happens on this path at all.
  const { data: existing, error: countError } = await supabaseAdmin
    .from("photographer_portfolio")
    .select("id")
    .eq("photographer_id", cleanedId);
  if (countError) throw countError;
  if ((existing || []).length >= SELF_SERVICE_PORTFOLIO_LIMIT) {
    fail(`Portfolio images are limited to ${SELF_SERVICE_PORTFOLIO_LIMIT}.`, 409);
  }

  return adminAddPortfolioItem(cleanedId, item);
}

export async function selfRemovePortfolioItem(userId, portfolioItemId) {
  const cleanedItemId = cleanUuid(portfolioItemId, "Portfolio item");

  const { data: item, error: loadError } = await supabaseAdmin
    .from("photographer_portfolio")
    .select("id, photographer_id")
    .eq("id", cleanedItemId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!item) fail("Portfolio item not found.", 404);

  await requirePhotographerOwnership(userId, item.photographer_id);
  return adminRemovePortfolioItem(cleanedItemId);
}

// --- meet coverage + galleries (Phase Three) ---------------------------------
// "Who is photographing this meet" (before) and "where's the gallery"
// (after). Both reference the real meets table directly -- never invent
// or duplicate a meet record; the caller always supplies a real meet_id
// resolved from the existing public /api/meets/ list.
//
// Coverage is self-published immediately (public_visible defaults true,
// no approval status) -- "I plan to be at this meet" carries essentially
// no risk. Galleries carry a real approval workflow (status defaults to
// 'pending_review') -- an external URL posted under a real meet's name
// is a meaningfully different risk, so nothing is public until an admin
// looks at it. See install/15_PHOTOGRAPHER_MEET_COVERAGE.sql's header
// comment for the full reasoning.

const MEET_JOIN_FIELDS = "id, name, slug, meet_date, city, state, sport";

async function attachMeetInfo(rows, meetIdKey = "meet_id") {
  const meetIds = [...new Set(rows.map((r) => r[meetIdKey]).filter(Boolean))];
  if (meetIds.length === 0) return rows.map((r) => ({ ...r, meet: null }));

  const { data: meets, error } = await supabaseAdmin.from("meets").select(MEET_JOIN_FIELDS).in("id", meetIds);
  if (error) throw error;
  const meetsById = new Map((meets || []).map((m) => [m.id, m]));
  return rows.map((r) => ({ ...r, meet: r[meetIdKey] ? meetsById.get(r[meetIdKey]) || null : null }));
}

async function loadMeetCoverageForPhotographer(photographerId, { onlyPublic = false } = {}) {
  let query = supabaseAdmin
    .from("photographer_meet_coverage")
    .select("id, meet_id, coverage_status, public_notes, public_visible, updated_at")
    .eq("photographer_id", photographerId);
  if (onlyPublic) query = query.eq("public_visible", true);

  const { data, error } = await query;
  if (error) throw error;
  return attachMeetInfo(data || []);
}

async function loadGalleriesForPhotographer(photographerId, { onlyPublished = false } = {}) {
  let query = supabaseAdmin
    .from("photographer_galleries")
    .select("id, meet_id, title, gallery_url, status, published_at, public_visible, admin_notes, created_at")
    .eq("photographer_id", photographerId)
    .order("created_at", { ascending: false });
  if (onlyPublished) query = query.eq("status", "published").eq("public_visible", true);

  const { data, error } = await query;
  if (error) throw error;
  return attachMeetInfo(data || []);
}

export async function selfAddMeetCoverage(userId, photographerId, { meet_id, coverage_status, public_notes }) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);
  const cleanedMeetId = cleanUuid(meet_id, "Meet");

  const { data: meet, error: meetError } = await supabaseAdmin.from("meets").select("id").eq("id", cleanedMeetId).maybeSingle();
  if (meetError) throw meetError;
  if (!meet) fail("That meet could not be found.", 404);

  const cleanedStatus = ["planned", "confirmed", "completed", "cancelled"].includes(coverage_status) ? coverage_status : "planned";

  const { data, error } = await supabaseAdmin
    .from("photographer_meet_coverage")
    .upsert(
      { photographer_id: cleanedId, meet_id: cleanedMeetId, coverage_status: cleanedStatus, public_notes: cleanNullableText(public_notes, 300) },
      { onConflict: "photographer_id,meet_id" }
    )
    .select("id, meet_id, coverage_status, public_notes, public_visible")
    .single();
  if (error) throw error;
  return data;
}

export async function selfRemoveMeetCoverage(userId, coverageId) {
  const cleanedId = cleanUuid(coverageId, "Coverage entry");
  const { data: row, error: loadError } = await supabaseAdmin
    .from("photographer_meet_coverage")
    .select("id, photographer_id")
    .eq("id", cleanedId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row) fail("Coverage entry not found.", 404);

  await requirePhotographerOwnership(userId, row.photographer_id);
  const { error } = await supabaseAdmin.from("photographer_meet_coverage").delete().eq("id", cleanedId);
  if (error) throw error;
  return { removed: true };
}

export async function selfAddGallery(userId, photographerId, { meet_id, title, gallery_url }) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  const cleanedTitle = cleanText(title, 200);
  if (!cleanedTitle) fail("A gallery title is required.");
  const cleanedUrl = cleanNullableUrl(gallery_url, "Gallery URL");
  if (!cleanedUrl) fail("A gallery URL is required.");

  let cleanedMeetId = null;
  if (meet_id) {
    cleanedMeetId = cleanUuid(meet_id, "Meet");
    const { data: meet, error: meetError } = await supabaseAdmin.from("meets").select("id").eq("id", cleanedMeetId).maybeSingle();
    if (meetError) throw meetError;
    if (!meet) fail("That meet could not be found.", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("photographer_galleries")
    .insert({ photographer_id: cleanedId, meet_id: cleanedMeetId, title: cleanedTitle, gallery_url: cleanedUrl, status: "pending_review" })
    .select("id, meet_id, title, gallery_url, status, public_visible")
    .single();
  if (error) throw error;
  return data;
}

export async function selfRemoveGallery(userId, galleryId) {
  const cleanedId = cleanUuid(galleryId, "Gallery");
  const { data: row, error: loadError } = await supabaseAdmin
    .from("photographer_galleries")
    .select("id, photographer_id")
    .eq("id", cleanedId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row) fail("Gallery not found.", 404);

  await requirePhotographerOwnership(userId, row.photographer_id);
  const { error } = await supabaseAdmin.from("photographer_galleries").delete().eq("id", cleanedId);
  if (error) throw error;
  return { removed: true };
}

// Admin moderation: the only path from pending_review to
// published/rejected. published_at is stamped the moment it's
// approved, never backdated or editable.
export async function adminUpdateGalleryStatus(galleryId, { status, admin_notes }) {
  const cleanedId = cleanUuid(galleryId, "Gallery");
  if (!["pending_review", "published", "rejected"].includes(status)) fail("Invalid gallery status.");

  const updates = { status, admin_notes: cleanNullableText(admin_notes, 1000) };
  if (status === "published") updates.published_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("photographer_galleries")
    .update(updates)
    .eq("id", cleanedId)
    .select("id, meet_id, title, gallery_url, status, published_at, admin_notes")
    .single();
  if (error) throw error;
  return data;
}

export async function adminListPendingGalleries() {
  const { data, error } = await supabaseAdmin
    .from("photographer_galleries")
    .select("id, photographer_id, meet_id, title, gallery_url, status, created_at")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = await attachMeetInfo(data || []);
  const photographerIds = [...new Set(rows.map((r) => r.photographer_id))];
  if (photographerIds.length === 0) return rows;

  const { data: photographers, error: photographerError } = await supabaseAdmin
    .from("photographers")
    .select("id, business_name, slug")
    .in("id", photographerIds);
  if (photographerError) throw photographerError;
  const photographersById = new Map((photographers || []).map((p) => [p.id, p]));

  return rows.map((r) => ({ ...r, photographer: photographersById.get(r.photographer_id) || null }));
}

// Public: who's covering (or covered) a real Podium Watch meet. Only
// approved + public_visible photographers, only public_visible coverage
// rows, only published + public_visible galleries -- the same gates as
// everywhere else in this file.
export async function getMeetPhotographers(meetId) {
  const cleanedMeetId = cleanUuid(meetId, "Meet");

  const [{ data: coverageRows, error: coverageError }, { data: galleryRows, error: galleryError }] = await Promise.all([
    supabaseAdmin.from("photographer_meet_coverage").select("id, photographer_id, coverage_status, public_notes").eq("meet_id", cleanedMeetId).eq("public_visible", true),
    supabaseAdmin.from("photographer_galleries").select("id, photographer_id, title, gallery_url, published_at").eq("meet_id", cleanedMeetId).eq("status", "published").eq("public_visible", true)
  ]);
  if (coverageError) throw coverageError;
  if (galleryError) throw galleryError;

  const photographerIds = [...new Set([...(coverageRows || []).map((r) => r.photographer_id), ...(galleryRows || []).map((r) => r.photographer_id)])];
  if (photographerIds.length === 0) return { coverage: [], galleries: [] };

  const { data: photographers, error: photographerError } = await supabaseAdmin
    .from("photographers")
    .select("id, business_name, slug")
    .in("id", photographerIds)
    .eq("status", "approved")
    .eq("public_visible", true);
  if (photographerError) throw photographerError;
  const approvedIds = new Set((photographers || []).map((p) => p.id));
  const photographersById = new Map((photographers || []).map((p) => [p.id, p]));

  return {
    coverage: (coverageRows || [])
      .filter((r) => approvedIds.has(r.photographer_id))
      .map((r) => ({ ...r, photographer: photographersById.get(r.photographer_id) })),
    galleries: (galleryRows || [])
      .filter((r) => approvedIds.has(r.photographer_id))
      .map((r) => ({ ...r, photographer: photographersById.get(r.photographer_id) }))
  };
}

// --- billing entitlement layer -------------------------------------------------
// A real, live Stripe integration (lib/photographer_billing_service.mjs)
// is the only writer of status/billing_interval/current_period_*/
// cancel_at_period_end/canceled_at/payment_status/stripe_*id below --
// see install/18's design notes. Admins can separately grant
// complimentary access (adminSetComplimentaryAccess, below) as an
// explicitly distinct entitlement source that can never collide with
// real Stripe data because it lives in different columns.
//
// ONE membership, two billing intervals (see
// lib/photographer_membership_config.mjs for the real prices) -- there is
// no more per-tier feature gating. `photographers.plan_id` /
// `photographer_plans` still exist (never dropped) but are no longer read
// for entitlement anywhere in this file; billing_interval + status here
// are the only source of truth for what a photographer's membership
// grants.
//
// A subscription is "active" (entitled to membership perks) only when
// status = 'active' AND (current_period_end is null OR still in the
// future) -- an expired period_end with a stale 'active' status must
// never keep granting perks past its own end date. This is deliberately
// a DERIVED read, not a stored column -- see install/17's design notes
// for why storing it separately would just create a second, driftable
// source of truth.

const SUBSCRIPTION_FIELDS =
  "id, photographer_id, status, billing_interval, stripe_customer_id, stripe_subscription_id, stripe_price_id, " +
  "current_period_start, current_period_end, cancel_at_period_end, canceled_at, payment_status, " +
  "partnership_story_status, admin_notes, admin_complimentary_access, admin_complimentary_granted_at, " +
  "last_stripe_event_id, last_stripe_event_at, updated_at";

// Real, current Stripe entitlement ONLY -- does not consider
// admin_complimentary_access (see lib/photographer_billing_service.mjs's
// isMembershipActive, which combines both; that's the one most callers
// outside this file should use). Exported for lib/photographer_billing_service.mjs
// and for direct testing (scripts/test-photographer-billing.mjs).
export function isSubscriptionActive(subscription) {
  if (!subscription || subscription.status !== "active") return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function getSubscription(photographerId) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  const { data, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select(SUBSCRIPTION_FIELDS)
    .eq("photographer_id", cleanedId)
    .maybeSingle();
  if (error) throw error;
  return data || {
    status: "inactive", billing_interval: null, current_period_end: null, cancel_at_period_end: false,
    partnership_story_status: "not_eligible", admin_complimentary_access: false
  };
}

// Admin-only: an EXPLICIT complimentary-access grant, entirely separate
// from real Stripe entitlement -- see install/18's design notes for why
// this replaced the old Phase Four adminSetSubscription (which wrote
// directly into status/billing_interval/period fields, the same fields
// the real Stripe webhook sync now owns exclusively -- a stale admin
// form save could otherwise stomp a genuine, live Stripe subscription).
// This function NEVER touches status/billing_interval/current_period_*/
// cancel_at_period_end/canceled_at/payment_status/stripe_*id -- those
// are Stripe-webhook-only fields now, always. Membership entitlement is
// "real Stripe active OR admin_complimentary_access" (see
// lib/photographer_billing_service.mjs's isMembershipActive) -- either
// is independently sufficient, and neither write path can overwrite the
// other because they touch entirely different columns.
export async function adminSetComplimentaryAccess(photographerId, { admin_complimentary_access, admin_notes }) {
  const cleanedId = cleanUuid(photographerId, "Photographer");

  const { data: photographer, error: photographerError } = await supabaseAdmin.from("photographers").select("id").eq("id", cleanedId).maybeSingle();
  if (photographerError) throw photographerError;
  if (!photographer) fail("Photographer not found.", 404);

  const grantingNow = cleanBoolean(admin_complimentary_access);

  const fields = { admin_complimentary_access: grantingNow, admin_notes: cleanNullableText(admin_notes, 1000) };
  // Only stamp granted_at the moment it actually turns on -- upsertSubscriptionFields
  // leaves a key untouched when it's simply absent, so toggling it back
  // off, or re-saving while already on, never disturbs the original
  // grant timestamp.
  if (grantingNow) {
    const { data: existing } = await supabaseAdmin
      .from("photographer_subscriptions")
      .select("admin_complimentary_access")
      .eq("photographer_id", cleanedId)
      .maybeSingle();
    if (!existing?.admin_complimentary_access) fields.admin_complimentary_granted_at = new Date().toISOString();
  }

  return upsertSubscriptionFields(cleanedId, fields);
}

// Shared, low-level upsert -- no input validation or cleaning of its own
// (that's each caller's job; adminSetComplimentaryAccess above cleans
// admin-typed strings, lib/photographer_billing_service.mjs passes
// already-structured data straight from a verified Stripe event). Used
// by BOTH the admin-complimentary path and the real Stripe webhook path
// so the "grant partnership-story eligibility exactly once, never on a
// later save" guarantee lives in exactly one place, never duplicated
// between them. `fields` may include any real photographer_subscriptions
// column -- a key simply left out of `fields` is left untouched by the
// upsert, which is how adminSetComplimentaryAccess never touches
// status/billing_interval/stripe_*id/period fields (Stripe-webhook-only,
// see install/18) and how the webhook path never touches
// admin_complimentary_access/admin_notes or partnership_story_status
// except when actually granting eligibility.
export async function upsertSubscriptionFields(photographerId, fields) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select("partnership_story_status")
    .eq("photographer_id", photographerId)
    .maybeSingle();
  if (existingError) throw existingError;

  const updates = { photographer_id: photographerId, ...fields };
  if (shouldGrantPartnershipStoryEligibility(fields, existing?.partnership_story_status)) {
    updates.partnership_story_status = "eligible";
  }

  const { data, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .upsert(updates, { onConflict: "photographer_id" })
    .select(SUBSCRIPTION_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

// Pure decision logic, deliberately pulled out of upsertSubscriptionFields
// so it's directly unit-testable without touching Supabase (see
// scripts/test-photographer-billing.mjs) -- exactly the "clear internal
// function, easy to reason about and test" the eligibility rule needs.
// `existingPartnershipStoryStatus` is undefined for a brand-new
// subscription row (never yet granted, same as 'not_eligible').
export function shouldGrantPartnershipStoryEligibility(fields, existingPartnershipStoryStatus) {
  const willBeActive = fields.status === "active" && (!fields.current_period_end || new Date(fields.current_period_end).getTime() > Date.now());
  const alreadyGranted = existingPartnershipStoryStatus && existingPartnershipStoryStatus !== "not_eligible";
  return Boolean(willBeActive && fields.billing_interval === "annual" && !alreadyGranted);
}

// --- partnership announcement story (annual launch benefit) -------------------
// Annual members get ONE Podium Watch partnership announcement story,
// granted once (via upsertSubscriptionFields, as a side effect of a real
// Stripe subscription becoming active AND annual -- see
// lib/photographer_billing_service.mjs's syncPhotographerSubscriptionFromStripe;
// the admin-complimentary path never grants this) and never reset on
// renewal. This table holds only the raw submitted content and the
// admin's review state -- actual publication still goes through this
// project's normal editorial content pipeline (a real Markdown story,
// reviewed and committed like any other article). Nothing here ever
// auto-publishes anything.

const PARTNERSHIP_STORY_FIELDS =
  "id, photographer_id, business_name, photographer_name, city_or_area, biography, sports_covered, " +
  "areas_covered, how_started, services_offered, website_url, instagram_url, facebook_url, image_urls, " +
  "admin_notes, published_story_url, submitted_at, published_at, created_at, updated_at";

async function loadPartnershipStory(photographerId) {
  const { data, error } = await supabaseAdmin
    .from("photographer_partnership_stories")
    .select(PARTNERSHIP_STORY_FIELDS)
    .eq("photographer_id", photographerId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getMyPartnershipStory(userId, photographerId) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);
  const subscription = await getSubscription(cleanedId);
  const story = await loadPartnershipStory(cleanedId);
  return { status: subscription.partnership_story_status || "not_eligible", story };
}

const STORY_FIELD_CLEANERS = {
  business_name: (v) => cleanNullableText(v, 200),
  photographer_name: (v) => cleanNullableText(v, 200),
  city_or_area: (v) => cleanNullableText(v, 200),
  biography: (v) => cleanNullableText(v, 4000),
  sports_covered: (v) => cleanNullableText(v, 500),
  areas_covered: (v) => cleanNullableText(v, 500),
  how_started: (v) => cleanNullableText(v, 2000),
  services_offered: (v) => cleanNullableText(v, 2000),
  website_url: (v) => cleanNullableUrl(v, "Website"),
  instagram_url: (v) => cleanNullableUrl(v, "Instagram link"),
  facebook_url: (v) => cleanNullableUrl(v, "Facebook link")
};

// Self-service: an eligible or already-submitting annual member provides
// (or edits) the raw info Podium Watch's editorial team will use to write
// the real story. Never accepted once a story is already published --
// the benefit is consumed at that point, permanently.
export async function submitMyPartnershipStoryInfo(userId, photographerId, body) {
  const cleanedId = cleanUuid(photographerId, "Photographer");
  await requirePhotographerOwnership(userId, cleanedId);

  const subscription = await getSubscription(cleanedId);
  const currentStatus = subscription.partnership_story_status || "not_eligible";
  if (currentStatus === "not_eligible") fail("Your membership is not eligible for a partnership story.", 403);
  if (currentStatus === "published") fail("Your partnership story has already been published.", 409);

  const fields = {};
  for (const [key, cleaner] of Object.entries(STORY_FIELD_CLEANERS)) fields[key] = cleaner(body[key]);

  const imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.map((u) => cleanNullableUrl(u, "Image URL")).filter(Boolean).slice(0, 20)
    : [];

  const { data, error } = await supabaseAdmin
    .from("photographer_partnership_stories")
    .upsert(
      { photographer_id: cleanedId, ...fields, image_urls: imageUrls, submitted_at: new Date().toISOString() },
      { onConflict: "photographer_id" }
    )
    .select(PARTNERSHIP_STORY_FIELDS)
    .single();
  if (error) throw error;

  // Only the FIRST submission advances eligible -> info_submitted; a
  // later edit while still info_submitted/in_review updates content
  // without touching status, and nothing here ever moves status
  // backward or re-grants eligibility.
  let newStatus = currentStatus;
  if (currentStatus === "eligible") {
    newStatus = "info_submitted";
    const { error: statusError } = await supabaseAdmin
      .from("photographer_subscriptions")
      .update({ partnership_story_status: newStatus })
      .eq("photographer_id", cleanedId);
    if (statusError) throw statusError;
  }

  return { status: newStatus, story: data };
}

// Admin: everyone who has ever been granted eligibility (i.e. past
// 'not_eligible'), regardless of current status, so admins can see the
// full queue including already-published history.
export async function adminListPartnershipStories() {
  const { data: subscriptions, error } = await supabaseAdmin
    .from("photographer_subscriptions")
    .select("photographer_id, partnership_story_status, billing_interval, status, updated_at")
    .neq("partnership_story_status", "not_eligible")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!subscriptions || subscriptions.length === 0) return [];

  const photographerIds = subscriptions.map((s) => s.photographer_id);
  const [{ data: photographers, error: photographersError }, { data: stories, error: storiesError }] = await Promise.all([
    supabaseAdmin.from("photographers").select("id, business_name, slug").in("id", photographerIds),
    supabaseAdmin.from("photographer_partnership_stories").select(PARTNERSHIP_STORY_FIELDS).in("photographer_id", photographerIds)
  ]);
  if (photographersError) throw photographersError;
  if (storiesError) throw storiesError;

  const photographersById = new Map((photographers || []).map((p) => [p.id, p]));
  const storiesById = new Map((stories || []).map((s) => [s.photographer_id, s]));

  return subscriptions.map((s) => ({
    photographer_id: s.photographer_id,
    partnership_story_status: s.partnership_story_status,
    billing_interval: s.billing_interval,
    subscription_status: s.status,
    photographer: photographersById.get(s.photographer_id) || null,
    story: storiesById.get(s.photographer_id) || null
  }));
}

// Admin: move the review workflow forward (info_submitted -> in_review ->
// published), record review notes, and link the real published story URL
// once Podium Watch's editorial team has actually written and committed
// it. This never writes story content itself and never touches
// billing_interval/status -- purely the review/publication side.
export async function adminUpdatePartnershipStory(photographerId, { partnership_story_status, admin_notes, published_story_url }) {
  const cleanedId = cleanUuid(photographerId, "Photographer");

  if (partnership_story_status !== undefined) {
    if (!["eligible", "info_submitted", "in_review", "published"].includes(partnership_story_status)) {
      fail("Invalid partnership story status.");
    }
    const { error: statusError } = await supabaseAdmin
      .from("photographer_subscriptions")
      .update({ partnership_story_status })
      .eq("photographer_id", cleanedId);
    if (statusError) throw statusError;
  }

  const storyUpdates = {};
  if (admin_notes !== undefined) storyUpdates.admin_notes = cleanNullableText(admin_notes, 2000);
  if (published_story_url !== undefined) storyUpdates.published_story_url = cleanNullableUrl(published_story_url, "Published story URL");
  if (partnership_story_status === "published") storyUpdates.published_at = new Date().toISOString();

  if (Object.keys(storyUpdates).length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("photographer_partnership_stories")
      .upsert({ photographer_id: cleanedId, ...storyUpdates }, { onConflict: "photographer_id" });
    if (upsertError) throw upsertError;
  }

  const subscription = await getSubscription(cleanedId);
  const story = await loadPartnershipStory(cleanedId);
  return { status: subscription.partnership_story_status, story };
}
