import { createHmac } from "node:crypto";
import { categoryStatus, findNominee, loadYearlyAwardsPool } from "./yearly_awards_2026.mjs";

// 2026 Athlete, Team and Coach of the Year: database work. Pure logic
// (pool, status, schedule) is in lib/yearly_awards_2026.mjs; schema and
// identity model in install/76_YEARLY_AWARDS_2026.sql. The weekly
// aotw_/totw_ tables and lib/awards_service.mjs are not touched.

const CATEGORY_COLUMNS = "id, slug, award, gender, division, label, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at, voting_closed_early_at, results_published_at";

// A whole team or school can share one network, so this is a generous
// hourly ceiling per address across all categories, not a tight one.
export const NOMINATIONS_PER_ADDRESS_PER_HOUR = 60;
const PAGE_SIZE = 1000;

function error(message, status = 400, code = "YEARLY_AWARDS_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

async function db() {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  return supabaseAdmin;
}

function secret() {
  const value = process.env.VOTE_HASH_SECRET;
  if (!value || value.length < 32) throw error("VOTE_HASH_SECRET is missing or is not long enough.", 500, "VOTE_HASH_SECRET_MISSING");
  return value;
}

export function hashBrowserToken(rawToken) {
  const cleaned = String(rawToken ?? "").trim().slice(0, 200);
  if (cleaned.length < 16 || !/^[a-zA-Z0-9._-]+$/.test(cleaned)) throw error("Your browser could not be verified. Refresh the page and try again.", 400, "INVALID_BROWSER_TOKEN");
  return createHmac("sha256", secret()).update(`yearly-awards-2026:${cleaned}`).digest("hex");
}

export function hashAddress(address) {
  return createHmac("sha256", secret()).update(`yearly-awards-2026-ip:${String(address || "unknown")}`).digest("hex");
}

function cleanLine(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1);
}

// Pure: checks one nomination against the pool and the clock. Returns the
// row to insert (minus hashes). Unit tested.
export function validateNomination(pool, category, { nomineeId, reason, firstName, coachName }, { finalistCount = 0, now = new Date() } = {}) {
  if (!category) throw error("That award category doesn't exist.", 404, "UNKNOWN_CATEGORY");
  const status = categoryStatus(category, { finalistCount, now });
  if (status !== "nominations_open") throw error(status === "upcoming" ? "Nominations aren't open yet." : "Nominations for this category are closed.", 409, "NOMINATIONS_CLOSED");
  const nominee = findNominee(pool, category.slug, nomineeId);
  if (!nominee) throw error(category.award === "athlete" ? "Pick an athlete from this division's list." : category.award === "coach" ? "Pick a school from this division's list." : "Pick a team from this division's list.", 400, "NOT_IN_POOL");
  // Coach of the Year: the nominator types the coach's name (Podium Watch
  // doesn't have every coach). Required, plain text, 60 characters.
  let cleanCoach = null;
  if (category.award === "coach") {
    cleanCoach = cleanLine(coachName, 60);
    if (cleanCoach.length < 2) throw error("Enter the coach's name.", 400, "COACH_NAME_REQUIRED");
    if (cleanCoach.length > 60) throw error("Keep the coach's name to 60 characters or fewer.", 400, "COACH_NAME_TOO_LONG");
  }
  const cleanReason = cleanLine(reason, 300);
  if (cleanReason.length > 300) throw error("Keep the reason to 300 characters or fewer.", 400, "REASON_TOO_LONG");
  const cleanName = cleanLine(firstName, 40).split(" ")[0] || "";
  if (cleanName.length > 40) throw error("First name is too long.", 400, "NAME_TOO_LONG");
  return {
    nominee,
    row: {
      category_id: category.id,
      nominee_key: nominee.id,
      athletic_net_id: category.award === "athlete" ? nominee.id : null,
      school_id: category.award === "athlete" ? null : nominee.schoolId || null,
      ...(category.award === "coach" ? { coach_name: cleanCoach } : {}),
      reason: cleanReason || null,
      nominator_first_name: cleanName || null
    }
  };
}

async function finalistCounts(supabase) {
  const { data, error: finalistError } = await supabase.from("yearly_award_finalists").select("category_id");
  if (finalistError) throw finalistError;
  const counts = new Map();
  for (const row of data || []) counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1);
  return counts;
}

async function loadCategories(supabase) {
  const { data, error: categoryError } = await supabase.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("season", 2026).order("slug");
  if (categoryError) throw categoryError;
  return data || [];
}

// Public: every category's live status and schedule. No vote counts.
export async function listPublicCategories({ now = new Date() } = {}) {
  const supabase = await db();
  const [categories, counts] = await Promise.all([loadCategories(supabase), finalistCounts(supabase)]);
  return categories.map((category) => {
    const finalistCount = counts.get(category.id) || 0;
    return {
      slug: category.slug,
      label: category.label,
      status: categoryStatus(category, { finalistCount, now }),
      nominations_open_at: category.nominations_open_at,
      nominations_close_at: category.nominations_close_at,
      voting_open_at: category.voting_open_at,
      voting_close_at: category.voting_closed_early_at && category.voting_closed_early_at < category.voting_close_at ? category.voting_closed_early_at : category.voting_close_at,
      results_published_at: category.results_published_at,
      finalist_count: finalistCount
    };
  });
}

export async function submitNomination({ slug, nomineeId, reason, firstName, coachName, browserToken, address, now = new Date() }) {
  const supabase = await db();
  const pool = await loadYearlyAwardsPool();
  const { data: category, error: categoryError } = await supabase.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("slug", String(slug || "").trim()).maybeSingle();
  if (categoryError) throw categoryError;
  const { nominee, row } = validateNomination(pool, category, { nomineeId, reason, firstName, coachName }, { now });
  const tokenHash = hashBrowserToken(browserToken);
  const ipHash = hashAddress(address);

  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase.from("yearly_award_nominations").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if (countError) throw countError;
  if ((count || 0) >= NOMINATIONS_PER_ADDRESS_PER_HOUR) throw error("Too many nominations from this network. Try again in an hour.", 429, "TOO_MANY_NOMINATIONS");

  const { error: insertError } = await supabase.from("yearly_award_nominations").insert({ ...row, browser_token_hash: tokenHash, ip_hash: ipHash });
  if (insertError) {
    if (insertError.code === "23505") throw error(category.award === "coach" ? `You already nominated the ${nominee.name} coach in this category from this device.` : `You already nominated ${nominee.name} in this category from this device.`, 409, "ALREADY_NOMINATED");
    throw insertError;
  }
  return { nominee: { id: nominee.id, name: nominee.name, school: nominee.school || null, coach_name: row.coach_name || null }, category: category.label };
}

async function allNominations(supabase) {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error: listError } = await supabase.from("yearly_award_nominations").select("id, created_at, category_id, nominee_key, coach_name, reason, nominator_first_name, ip_hash").order("created_at", { ascending: true }).range(start, start + PAGE_SIZE - 1);
    if (listError) throw listError;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Admin: every category with its nominees ranked by nomination count.
export async function adminSummary({ now = new Date() } = {}) {
  const supabase = await db();
  const pool = await loadYearlyAwardsPool();
  const [categories, counts, nominations] = await Promise.all([loadCategories(supabase), finalistCounts(supabase), allNominations(supabase)]);
  return categories.map((category) => {
    const byNominee = new Map();
    for (const row of nominations) {
      if (row.category_id !== category.id) continue;
      if (!byNominee.has(row.nominee_key)) {
        const nominee = findNominee(pool, category.slug, row.nominee_key);
        byNominee.set(row.nominee_key, { nominee_key: row.nominee_key, name: nominee?.name || row.nominee_key, school: nominee?.school || nominee?.city || null, detail: nominee || null, count: 0, coach_names: [], nominations: [] });
      }
      const entry = byNominee.get(row.nominee_key);
      entry.count += 1;
      if (row.coach_name && !entry.coach_names.some((name) => name.toLowerCase() === row.coach_name.toLowerCase())) entry.coach_names.push(row.coach_name);
      entry.nominations.push({ id: row.id, created_at: row.created_at, coach_name: row.coach_name || null, reason: row.reason, first_name: row.nominator_first_name, ip: row.ip_hash ? row.ip_hash.slice(0, 8) : null });
    }
    const nominees = [...byNominee.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      slug: category.slug,
      label: category.label,
      award: category.award,
      status: categoryStatus(category, { finalistCount: counts.get(category.id) || 0, now }),
      nomination_count: nominees.reduce((sum, item) => sum + item.count, 0),
      nominees
    };
  });
}

export async function deleteNomination(id) {
  const cleanId = String(id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(cleanId)) throw error("Choose a nomination to delete.", 400, "MISSING_NOMINATION");
  const supabase = await db();
  const { data, error: deleteError } = await supabase.from("yearly_award_nominations").delete().eq("id", cleanId).select("id");
  if (deleteError) throw deleteError;
  if (!data?.length) throw error("That nomination was already deleted.", 404, "NOT_FOUND");
  return { deleted: cleanId };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function nominationsCsv() {
  const summary = await adminSummary();
  const lines = [["category", "rank", "nominee", "school", "coach_names", "nominee_key", "nominations", "reasons"].join(",")];
  for (const category of summary) {
    category.nominees.forEach((nominee, index) => {
      const reasons = nominee.nominations.map((item) => [item.reason, item.first_name ? `(${item.first_name})` : ""].filter(Boolean).join(" ")).filter(Boolean).join(" | ");
      lines.push([category.label, index + 1, nominee.name, nominee.school, nominee.coach_names.join(" | "), nominee.nominee_key, nominee.count, reasons].map(csvCell).join(","));
    });
  }
  return lines.join("\n") + "\n";
}
