import { createHmac } from "node:crypto";
import { categoryStatus, findNominee, loadYearlyAwardsPool } from "./yearly_awards_2026.mjs";

// 2026 Athlete, Team and Coach of the Year: database work. Pure logic
// (pool, status, schedule) is in lib/yearly_awards_2026.mjs; schema and
// identity model in install/76_YEARLY_AWARDS_2026.sql,
// 77_COACH_OF_THE_YEAR_2026.sql and 78_YEARLY_AWARDS_2026_VOTING.sql.
// Votes are on Redis (lib/yearly_awards_2026_votes.mjs). The weekly
// aotw_/totw_ tables and lib/awards_service.mjs are not touched.

const CATEGORY_COLUMNS = "id, slug, award, gender, division, label, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at, voting_closed_early_at, finalists_published_at, results_published_at";
const FINALIST_COLUMNS = "id, category_id, nominee_key, athletic_net_id, school_id, display_name, school, note, sort_order, winner";

// A whole team or school can share one network, so this is a generous
// hourly ceiling per address across all categories, not a tight one.
export const NOMINATIONS_PER_ADDRESS_PER_HOUR = 60;
// Votes from one network in one category above this are flagged in the
// admin (never blocked).
export const HEAVY_ADDRESS_VOTES = 25;
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

async function votes() {
  return import("./yearly_awards_2026_votes.mjs");
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

// Cloudflare Turnstile switches on by itself once both keys exist in the
// environment. Until then voting relies on the one-vote limit, the trap
// field and address flagging.
export function turnstileSiteKey() {
  return process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : null;
}

async function verifyTurnstile(token, address) {
  if (!turnstileSiteKey()) return;
  const cleaned = String(token || "").trim();
  if (!cleaned) throw error("Please finish the quick check above the vote buttons, then vote again.", 400, "TURNSTILE_REQUIRED");
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: cleaned.slice(0, 2048) });
  if (address) form.set("remoteip", address);
  let result = null;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    result = await response.json();
  } catch {
    throw error("We couldn't check your vote right now. Please try again.", 503, "TURNSTILE_UNAVAILABLE");
  }
  if (!result?.success) throw error("That check didn't go through. Please try again.", 400, "TURNSTILE_FAILED");
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

async function loadCategories(supabase) {
  const { data, error: categoryError } = await supabase.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("season", 2026).order("slug");
  if (categoryError) throw categoryError;
  return data || [];
}

async function loadCategory(supabase, slug) {
  const { data, error: categoryError } = await supabase.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("slug", String(slug || "").trim()).maybeSingle();
  if (categoryError) throw categoryError;
  if (!data) throw error("That award category doesn't exist.", 404, "UNKNOWN_CATEGORY");
  return data;
}

async function loadFinalists(supabase, categoryId = null) {
  let query = supabase.from("yearly_award_finalists").select(FINALIST_COLUMNS).order("sort_order").order("display_name");
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error: finalistError } = await query;
  if (finalistError) throw finalistError;
  return data || [];
}

function groupFinalists(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.category_id)) map.set(row.category_id, []);
    map.get(row.category_id).push(row);
  }
  return map;
}

// Finalists only count toward the public status once announced.
export function announcedCount(category, finalists) {
  return category.finalists_published_at ? finalists.length : 0;
}

function effectiveVotingClose(category) {
  return category.voting_closed_early_at && category.voting_closed_early_at < category.voting_close_at ? category.voting_closed_early_at : category.voting_close_at;
}

// Public: every category's live status, schedule and announced finalists.
// Never any vote counts. The winner flag only appears once published.
export async function listPublicCategories({ now = new Date() } = {}) {
  const supabase = await db();
  const [categories, finalistRows] = await Promise.all([loadCategories(supabase), loadFinalists(supabase)]);
  const byCategory = groupFinalists(finalistRows);
  return categories.map((category) => {
    const finalists = byCategory.get(category.id) || [];
    const count = announcedCount(category, finalists);
    const status = categoryStatus(category, { finalistCount: count, now });
    const published = status === "published";
    return {
      slug: category.slug,
      label: category.label,
      status,
      nominations_open_at: category.nominations_open_at,
      nominations_close_at: category.nominations_close_at,
      voting_open_at: category.voting_open_at,
      voting_close_at: effectiveVotingClose(category),
      results_published_at: category.results_published_at,
      finalist_count: count,
      finalists: count ? finalists.map((item) => ({ id: item.nominee_key, name: item.display_name, school: item.school || null, note: item.note || null, ...(published ? { winner: Boolean(item.winner) } : {}) })) : []
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

// Category + finalists for the vote endpoint, cached for a few seconds per
// server instance so a crowd voting at once doesn't each read Supabase.
const voteCache = new Map();
const VOTE_CACHE_MS = 10_000;

async function categoryForVoting(slug) {
  const hit = voteCache.get(slug);
  if (hit && Date.now() - hit.at < VOTE_CACHE_MS) return hit.value;
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  const finalists = await loadFinalists(supabase, category.id);
  const value = { category, finalists };
  voteCache.set(slug, { at: Date.now(), value });
  return value;
}

// Pure: is this vote allowed right now? Unit tested.
export function validateVote(category, finalists, finalistKey, { now = new Date() } = {}) {
  const status = categoryStatus(category, { finalistCount: announcedCount(category, finalists), now });
  if (status !== "voting_open") {
    const message = {
      upcoming: "Voting hasn't opened yet.",
      nominations_open: "Voting hasn't opened yet. Nominations are still open.",
      selecting_finalists: "Voting hasn't opened yet.",
      finalists_coming_soon: "The finalists haven't been announced yet.",
      voting_closed: "Voting for this category is closed.",
      published: "Voting for this category is closed."
    }[status];
    throw error(message || "Voting isn't open.", 409, "VOTING_CLOSED");
  }
  const finalist = finalists.find((item) => item.nominee_key === String(finalistKey ?? "").trim());
  if (!finalist) throw error("Pick one of the finalists.", 400, "NOT_A_FINALIST");
  return finalist;
}

export async function castVote({ slug, finalistKey, browserToken, turnstileToken, address, now = new Date() }) {
  const { category, finalists } = await categoryForVoting(String(slug || "").trim());
  const finalist = validateVote(category, finalists, finalistKey, { now });
  const tokenHash = hashBrowserToken(browserToken);
  await verifyTurnstile(turnstileToken, address);
  const { castYearlyVote } = await votes();
  const result = await castYearlyVote({ slug: category.slug, finalistKey: finalist.nominee_key, tokenHash, ipHash: hashAddress(address), now });
  if (result.rateLimited) throw error("Lots of votes are coming from your network right now. Wait a minute and try again.", 429, "RATE_LIMITED");
  if (!result.accepted) {
    const previous = finalists.find((item) => item.nominee_key === result.votedFor);
    const value = error(previous ? `You already voted for ${previous.display_name} in this category. Votes can't be changed.` : "You already voted in this category. Votes can't be changed.", 409, "ALREADY_VOTED");
    value.votedFor = result.votedFor;
    throw value;
  }
  return { voted_for: finalist.nominee_key, name: finalist.display_name, category: category.label };
}

// Which finalist this browser voted for in each category, so the page can
// show "You voted for ..." after a refresh or on another visit.
export async function myVotes({ browserToken, slugs }) {
  const tokenHash = hashBrowserToken(browserToken);
  const { existingYearlyVote } = await votes();
  const list = [...new Set((slugs || []).map((slug) => String(slug || "").trim()).filter((slug) => /^[a-z]+-(boys|girls)-d[1-4]$/.test(slug)))].slice(0, 24);
  const entries = await Promise.all(list.map(async (slug) => [slug, await existingYearlyVote({ slug, tokenHash })]));
  return Object.fromEntries(entries.filter(([, value]) => value));
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

// Live tallies are cached for 30 seconds per server instance, so admin
// refreshes during heavy voting don't re-read every vote each time.
const tallyCache = new Map();
const TALLY_CACHE_MS = 30_000;
async function safeTally(slug) {
  try {
    const hit = tallyCache.get(slug);
    if (hit && Date.now() - hit.at < TALLY_CACHE_MS) return hit.value;
    const { yearlyVoteTally } = await votes();
    const value = await yearlyVoteTally(slug);
    tallyCache.set(slug, { at: Date.now(), value });
    return value;
  } catch (tallyError) {
    console.error("Yearly awards tally error:", tallyError);
    return { counts: {}, total: 0, voided: 0, addresses: [], error: "Live vote counts could not be loaded." };
  }
}

// Admin: every category with its nominees ranked by nomination count,
// its finalists with live vote counts, and heavy networks flagged.
export async function adminSummary({ now = new Date() } = {}) {
  const supabase = await db();
  const pool = await loadYearlyAwardsPool();
  const [categories, finalistRows, nominations] = await Promise.all([loadCategories(supabase), loadFinalists(supabase), allNominations(supabase)]);
  const byCategory = groupFinalists(finalistRows);
  const tallies = await Promise.all(categories.map((category) => ((byCategory.get(category.id) || []).length && category.finalists_published_at ? safeTally(category.slug) : null)));
  return categories.map((category, categoryIndex) => {
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
    const finalists = byCategory.get(category.id) || [];
    const tally = tallies[categoryIndex];
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      award: category.award,
      status: categoryStatus(category, { finalistCount: announcedCount(category, finalists), now }),
      voting_open_at: category.voting_open_at,
      voting_close_at: effectiveVotingClose(category),
      voting_closed_early_at: category.voting_closed_early_at,
      finalists_published_at: category.finalists_published_at,
      results_published_at: category.results_published_at,
      nomination_count: nominees.reduce((sum, item) => sum + item.count, 0),
      nominees,
      finalists: finalists.map((item) => ({ ...item, votes: tally ? tally.counts[item.nominee_key] || 0 : 0 })),
      votes: tally ? { total: tally.total, voided: tally.voided, error: tally.error || null, heavy: tally.addresses.filter((item) => item.count >= HEAVY_ADDRESS_VOTES).slice(0, 20).map((item) => ({ ip: item.ip.slice(0, 12), count: item.count })), top_networks: tally.addresses.slice(0, 5).map((item) => ({ ip: item.ip.slice(0, 12), count: item.count })) } : null
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

// ---- Admin: finalists ----

function assertNotPublished(category) {
  if (category.results_published_at) throw error("Results for this category are published. Unpublish first to change finalists.", 409, "PUBLISHED");
}

export async function addFinalist({ slug, nomineeKey, displayName, school, note }) {
  const supabase = await db();
  const pool = await loadYearlyAwardsPool();
  const category = await loadCategory(supabase, slug);
  assertNotPublished(category);
  const nominee = findNominee(pool, category.slug, nomineeKey);
  if (!nominee) throw error("That nominee isn't in this category's list.", 400, "NOT_IN_POOL");
  const existing = await loadFinalists(supabase, category.id);
  if (existing.some((item) => item.nominee_key === nominee.id)) throw error(`${nominee.name} is already a finalist.`, 409, "ALREADY_FINALIST");
  const name = cleanLine(displayName, 80) || (category.award === "coach" ? "" : nominee.name);
  if (!name) throw error("Enter the coach's name for this finalist.", 400, "NAME_REQUIRED");
  const cleanNote = cleanLine(note, 160);
  if (cleanNote.length > 160) throw error("Keep the note to 160 characters or fewer.", 400, "NOTE_TOO_LONG");
  const row = {
    category_id: category.id,
    nominee_key: nominee.id,
    athletic_net_id: category.award === "athlete" ? nominee.id : null,
    school_id: category.award === "athlete" ? null : nominee.schoolId || null,
    display_name: name.slice(0, 80),
    school: cleanLine(school, 80).slice(0, 80) || (category.award === "athlete" ? nominee.school || null : category.award === "coach" ? nominee.name : null),
    note: cleanNote || null,
    sort_order: existing.length ? Math.max(...existing.map((item) => item.sort_order)) + 1 : 0
  };
  const { data, error: insertError } = await supabase.from("yearly_award_finalists").insert(row).select(FINALIST_COLUMNS).single();
  if (insertError) throw insertError;
  voteCache.delete(category.slug);
  return { finalist: data };
}

async function loadFinalistWithCategory(supabase, id) {
  const cleanId = String(id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(cleanId)) throw error("Choose a finalist.", 400, "MISSING_FINALIST");
  const { data: finalist, error: finalistError } = await supabase.from("yearly_award_finalists").select(FINALIST_COLUMNS).eq("id", cleanId).maybeSingle();
  if (finalistError) throw finalistError;
  if (!finalist) throw error("That finalist was already removed.", 404, "NOT_FOUND");
  const { data: category, error: categoryError } = await supabase.from("yearly_award_categories").select(CATEGORY_COLUMNS).eq("id", finalist.category_id).single();
  if (categoryError) throw categoryError;
  return { finalist, category };
}

export async function updateFinalist({ id, displayName, school, note }) {
  const supabase = await db();
  const { finalist, category } = await loadFinalistWithCategory(supabase, id);
  assertNotPublished(category);
  const patch = {};
  if (displayName !== undefined) {
    const name = cleanLine(displayName, 80);
    if (!name) throw error("The finalist needs a name.", 400, "NAME_REQUIRED");
    patch.display_name = name.slice(0, 80);
  }
  if (school !== undefined) patch.school = cleanLine(school, 80).slice(0, 80) || null;
  if (note !== undefined) {
    const cleanNote = cleanLine(note, 160);
    if (cleanNote.length > 160) throw error("Keep the note to 160 characters or fewer.", 400, "NOTE_TOO_LONG");
    patch.note = cleanNote || null;
  }
  const { data, error: updateError } = await supabase.from("yearly_award_finalists").update(patch).eq("id", finalist.id).select(FINALIST_COLUMNS).single();
  if (updateError) throw updateError;
  voteCache.delete(category.slug);
  return { finalist: data };
}

export async function moveFinalist({ id, direction }) {
  const supabase = await db();
  const { finalist, category } = await loadFinalistWithCategory(supabase, id);
  const list = await loadFinalists(supabase, category.id);
  const index = list.findIndex((item) => item.id === finalist.id);
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= list.length) return { moved: false };
  [list[index], list[swap]] = [list[swap], list[index]];
  for (const [order, item] of list.entries()) {
    const { error: updateError } = await supabase.from("yearly_award_finalists").update({ sort_order: order }).eq("id", item.id);
    if (updateError) throw updateError;
  }
  voteCache.delete(category.slug);
  return { moved: true };
}

export async function removeFinalist({ id }) {
  const supabase = await db();
  const { finalist, category } = await loadFinalistWithCategory(supabase, id);
  assertNotPublished(category);
  const { error: deleteError } = await supabase.from("yearly_award_finalists").delete().eq("id", finalist.id);
  if (deleteError) throw deleteError;
  voteCache.delete(category.slug);
  return { removed: finalist.id };
}

// ---- Admin: category state ----

async function setCategory(slug, patch) {
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  const { data, error: updateError } = await supabase.from("yearly_award_categories").update(patch).eq("id", category.id).select(CATEGORY_COLUMNS).single();
  if (updateError) throw updateError;
  voteCache.delete(category.slug);
  return data;
}

export async function announceFinalists({ slug, undo = false }) {
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  if (undo) return { category: await setCategory(slug, { finalists_published_at: null }) };
  const finalists = await loadFinalists(supabase, category.id);
  if (finalists.length < 2) throw error(`${category.label} has ${finalists.length} finalist${finalists.length === 1 ? "" : "s"}. Add at least 2 before announcing.`, 409, "TOO_FEW_FINALISTS");
  return { category: await setCategory(slug, { finalists_published_at: new Date().toISOString() }) };
}

export async function announceAllReady() {
  const supabase = await db();
  const [categories, finalistRows] = await Promise.all([loadCategories(supabase), loadFinalists(supabase)]);
  const byCategory = groupFinalists(finalistRows);
  const announced = [];
  const skipped = [];
  for (const category of categories) {
    if (category.finalists_published_at) continue;
    const count = (byCategory.get(category.id) || []).length;
    if (count < 2) { skipped.push(`${category.label} (${count} finalist${count === 1 ? "" : "s"})`); continue; }
    await setCategory(category.slug, { finalists_published_at: new Date().toISOString() });
    announced.push(category.label);
  }
  return { announced, skipped };
}

export async function closeVotingEarly({ slug, undo = false }) {
  return { category: await setCategory(slug, { voting_closed_early_at: undo ? null : new Date().toISOString() }) };
}

export async function voidVotes({ slug, tokenPrefix, ipPrefix, reason }) {
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  if (category.results_published_at) throw error("Results for this category are published. Unpublish first.", 409, "PUBLISHED");
  const { voidYearlyVotes } = await votes();
  return voidYearlyVotes({ slug: category.slug, tokenPrefix, ipPrefix, reason });
}

// Pure: the winner from live counts, or a tie that needs the admin.
// Unit tested.
export function pickWinner(finalists, counts, winnerKey = null) {
  if (!finalists.length) throw error("This category has no finalists.", 409, "NO_FINALISTS");
  if (winnerKey) {
    const chosen = finalists.find((item) => item.nominee_key === String(winnerKey));
    if (!chosen) throw error("Pick the winner from this category's finalists.", 400, "NOT_A_FINALIST");
    return chosen;
  }
  const ranked = finalists.map((item) => ({ item, votes: counts[item.nominee_key] || 0 })).sort((a, b) => b.votes - a.votes);
  const top = ranked.filter((entry) => entry.votes === ranked[0].votes);
  if (top.length > 1) {
    const value = error(`Tie at ${ranked[0].votes} vote${ranked[0].votes === 1 ? "" : "s"} between ${top.map((entry) => entry.item.display_name).join(" and ")}. Pick the winner to publish.`, 409, "TIE");
    value.tied = top.map((entry) => entry.item.nominee_key);
    throw value;
  }
  return ranked[0].item;
}

export async function publishResults({ slug, winnerKey = null, now = new Date() }) {
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  const finalists = await loadFinalists(supabase, category.id);
  const status = categoryStatus(category, { finalistCount: announcedCount(category, finalists), now });
  if (status !== "voting_closed") throw error(status === "published" ? `${category.label} is already published.` : `Voting for ${category.label} hasn't closed yet. Close it early first if you need to.`, 409, "NOT_CLOSED");
  const { yearlyVoteTally } = await votes();
  const tally = await yearlyVoteTally(category.slug);
  const winner = pickWinner(finalists, tally.counts, winnerKey);
  const { error: clearError } = await supabase.from("yearly_award_finalists").update({ winner: false }).eq("category_id", category.id);
  if (clearError) throw clearError;
  const { error: winnerError } = await supabase.from("yearly_award_finalists").update({ winner: true }).eq("id", winner.id);
  if (winnerError) throw winnerError;
  await setCategory(category.slug, { results_published_at: now.toISOString() });
  return { published: category.label, winner: winner.display_name };
}

export async function publishAll() {
  const supabase = await db();
  const [categories, finalistRows] = await Promise.all([loadCategories(supabase), loadFinalists(supabase)]);
  const byCategory = groupFinalists(finalistRows);
  const published = [];
  const skipped = [];
  for (const category of categories) {
    const status = categoryStatus(category, { finalistCount: announcedCount(category, byCategory.get(category.id) || []) });
    if (status === "published") continue;
    if (status !== "voting_closed") { skipped.push(`${category.label} (voting not closed)`); continue; }
    try {
      const result = await publishResults({ slug: category.slug });
      published.push(`${result.published}: ${result.winner}`);
    } catch (publishError) {
      skipped.push(`${category.label} (${publishError.message})`);
    }
  }
  return { published, skipped };
}

export async function unpublishResults({ slug }) {
  const supabase = await db();
  const category = await loadCategory(supabase, slug);
  const { error: clearError } = await supabase.from("yearly_award_finalists").update({ winner: false }).eq("category_id", category.id);
  if (clearError) throw clearError;
  return { category: await setCategory(slug, { results_published_at: null }) };
}

// ---- CSV ----

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

export async function finalistsCsv() {
  const summary = await adminSummary();
  const lines = [["category", "status", "order", "finalist", "school", "note", "votes", "category_total_votes", "voided_votes", "winner"].join(",")];
  for (const category of summary) {
    category.finalists.forEach((finalist, index) => {
      lines.push([category.label, category.status, index + 1, finalist.display_name, finalist.school, finalist.note, finalist.votes, category.votes?.total ?? 0, category.votes?.voided ?? 0, finalist.winner ? "yes" : ""].map(csvCell).join(","));
    });
  }
  return lines.join("\n") + "\n";
}

// Admin: hourly votes per finalist and network bursts, every category
// that has finalists (for checking vote stuffing before the announcement).
export async function voteActivity() {
  const supabase = await db();
  const [categories, finalistRows] = await Promise.all([loadCategories(supabase), loadFinalists(supabase)]);
  const byCategory = groupFinalists(finalistRows);
  const { yearlyVoteActivity } = await votes();
  const out = [];
  for (const category of categories) {
    const finalists = byCategory.get(category.id) || [];
    if (!finalists.length) continue;
    const activity = await yearlyVoteActivity(category.slug);
    out.push({ slug: category.slug, label: category.label, finalists: finalists.map((item) => ({ key: item.nominee_key, name: item.display_name })), ...activity });
  }
  return out;
}
