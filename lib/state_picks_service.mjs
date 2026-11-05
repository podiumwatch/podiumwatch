import fs from "node:fs/promises";
import { createHmac } from "node:crypto";

// Podium Watch State Meet Picks (2026): readers pick the team champion of
// all eight state races and put a name on it. Picks lock at the start of
// the first race; after that every entry is public. Schema and identity
// model: install/75_STATE_PICKS_2026.sql. The race list and the only valid
// team names come from public/data/state-picks-2026.json (the real
// state-qualifying teams), read the same way lib/preseason_data.mjs reads
// its bundled file.
const dataUrl = new URL("../public/data/state-picks-2026.json", import.meta.url);

// One shared network often covers a whole team or school, so this is a
// generous ceiling on brand-new entries per address, not one per address.
export const MAX_ENTRIES_PER_ADDRESS = 60;

let fieldPromise = null;

export async function loadStatePicksField() {
  if (!fieldPromise) {
    fieldPromise = fs.readFile(dataUrl, "utf8").then((text) => JSON.parse(text));
  }
  return fieldPromise;
}

function error(message, status = 400, code = "STATE_PICKS_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

async function db() {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  return supabaseAdmin;
}

export function picksLocked(field, now = new Date()) {
  return now.getTime() >= new Date(field.lockAt).getTime();
}

// Pure validation, unit tested without a database. Returns the cleaned
// name and a picks object holding exactly one real team per race.
export function validateEntry(field, { name, picks }) {
  const displayName = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (displayName.length < 2 || displayName.length > 40) {
    throw error("Enter a name between 2 and 40 characters.", 400, "INVALID_NAME");
  }
  const input = picks && typeof picks === "object" ? picks : {};
  const cleanPicks = {};
  for (const race of field.races) {
    const team = String(input[race.key] ?? "").trim();
    if (!team) throw error(`Pick a champion for ${race.label}.`, 400, "MISSING_PICK");
    if (!race.teams.includes(team)) throw error(`${team} is not in the ${race.label} field.`, 400, "INVALID_PICK");
    cleanPicks[race.key] = team;
  }
  return { displayName, picks: cleanPicks };
}

export function hashVoterToken(rawToken) {
  const cleaned = String(rawToken ?? "").trim().slice(0, 200);
  if (cleaned.length < 16) throw error("A valid browser token is required.", 400, "INVALID_VOTER_TOKEN");
  const secret = process.env.VOTE_HASH_SECRET;
  if (!secret || secret.length < 32) throw error("VOTE_HASH_SECRET is missing or is not long enough.", 500, "VOTE_HASH_SECRET_MISSING");
  return createHmac("sha256", secret).update(`state-picks-2026:${cleaned}`).digest("hex");
}

// Pure reducer: how many entries picked each team, per race, most picked first.
export function tallyPicks(field, entries) {
  return field.races.map((race) => {
    const counts = new Map();
    for (const entry of entries) {
      const team = entry.picks?.[race.key];
      if (team) counts.set(team, (counts.get(team) || 0) + 1);
    }
    const teams = [...counts].map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
    return { key: race.key, label: race.label, teams };
  });
}

export async function submitEntry({ name, picks, voterToken, voterIpHash, now = new Date() }) {
  const field = await loadStatePicksField();
  if (picksLocked(field, now)) throw error("Picks are locked. The first race has started.", 409, "PICKS_LOCKED");
  const entry = validateEntry(field, { name, picks });
  const tokenHash = hashVoterToken(voterToken);
  const supabase = await db();

  const { data: existing, error: existingError } = await supabase
    .from("state_picks_2026").select("id").eq("voter_token_hash", tokenHash).maybeSingle();
  if (existingError) throw existingError;

  if (!existing && voterIpHash) {
    const { count, error: countError } = await supabase
      .from("state_picks_2026").select("id", { count: "exact", head: true }).eq("voter_ip_hash", voterIpHash);
    if (countError) throw countError;
    if ((count || 0) >= MAX_ENTRIES_PER_ADDRESS) throw error("Too many entries from this network. Try again from another connection.", 429, "TOO_MANY_ENTRIES");
  }

  const { error: upsertError } = await supabase.from("state_picks_2026").upsert({
    display_name: entry.displayName,
    picks: entry.picks,
    voter_token_hash: tokenHash,
    voter_ip_hash: voterIpHash || null,
    updated_at: now.toISOString()
  }, { onConflict: "voter_token_hash" });
  if (upsertError) throw upsertError;

  return { updated: Boolean(existing), name: entry.displayName, picks: entry.picks };
}

// Before the lock: only how many entries there are. After: every visible
// entry plus the per-race tally.
export async function listEntries({ now = new Date() } = {}) {
  const field = await loadStatePicksField();
  const supabase = await db();
  if (!picksLocked(field, now)) {
    const { count, error: countError } = await supabase
      .from("state_picks_2026").select("id", { count: "exact", head: true }).eq("hidden", false);
    if (countError) throw countError;
    return { locked: false, lockAt: field.lockAt, count: count || 0 };
  }
  const { data, error: listError } = await supabase
    .from("state_picks_2026").select("display_name, picks, created_at").eq("hidden", false).order("created_at", { ascending: true }).limit(5000);
  if (listError) throw listError;
  const entries = (data || []).map((row) => ({ name: row.display_name, picks: row.picks, submittedAt: row.created_at }));
  return { locked: true, lockAt: field.lockAt, count: entries.length, entries, tallies: tallyPicks(field, entries) };
}
