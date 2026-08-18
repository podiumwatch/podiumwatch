// Podium Watch Photographer Network -- Phase One database service.
// Public search/detail (read-only, approved+visible listings only) plus
// the admin CRUD path (create/update/status workflow/sports/service
// areas/portfolio). No photographer-facing account system exists yet
// (Phase Two) -- every write in this file today is admin-only, matching
// api/admin/photographers.js's isAdminRequest() guard.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { SPORTS, REGIONS } from "./photographer_constants.mjs";

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

  const { data: portfolio, error: portfolioError } = await supabaseAdmin
    .from("photographer_portfolio")
    .select("id, image_url, caption, sport, sort_order")
    .eq("photographer_id", data.id)
    .eq("public_visible", true)
    .order("sort_order", { ascending: true });
  if (portfolioError) throw portfolioError;

  return { ...withChildren, portfolio: portfolio || [] };
}

// --- admin path ---------------------------------------------------------------

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
  const { data: portfolio, error: portfolioError } = await supabaseAdmin
    .from("photographer_portfolio")
    .select("id, image_url, caption, sport, sort_order, public_visible")
    .eq("photographer_id", cleanedId)
    .order("sort_order", { ascending: true });
  if (portfolioError) throw portfolioError;

  return { ...withChildren, portfolio: portfolio || [] };
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
