import { supabaseAdmin } from "./supabase-admin.mjs";
import { ALSO_MAX, allFrontPageRuns, alsoRuns, currentAlso, currentLead, leadRuns, queuedLeads, runLabel } from "../src/lib/front_page_timeline.mjs";

// Front page lead story (WO-43). Reads and writes front_page_leads and
// front_page_lead_events (install/88). Every change is logged.
// install/92 adds slot ("lead" or "also") and position: stories an admin
// places under "Also on the front page" are rows with slot "also". They
// count as being on the front page: the story date line, /front-page/
// and the featured badges all include them.

const LEAD_COLUMNS = "id, created_at, story_slug, title, summary, kicker, image_url, image_alt, image_credit, byline, story_date, starts_at, ends_at, status, linked_profile_ids, linked_team_ids, created_by, cancelled_at, cancelled_by";
const SLOT_COLUMNS = `${LEAD_COLUMNS}, slot, position`;
const missingSlotColumn = (error) => String(error?.code || "") === "42703" || /column .*(slot|position)/i.test(String(error?.message || ""));
let slotsInstalled = true;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export const isMissingFrontPageTable = (error) => /front_page_lead/i.test(String(error?.message || "")) && /(does not exist|schema cache|Could not find)/i.test(String(error?.message || ""));

export async function loadAllLeads() {
  let { data, error } = await supabaseAdmin.from("front_page_leads").select(SLOT_COLUMNS).order("starts_at", { ascending: true });
  // Before install/92 runs: every row is a lead.
  if (error && missingSlotColumn(error)) {
    slotsInstalled = false;
    ({ data, error } = await supabaseAdmin.from("front_page_leads").select(LEAD_COLUMNS).order("starts_at", { ascending: true }));
  } else if (!error) slotsInstalled = true;
  if (error) {
    if (isMissingFrontPageTable(error)) return [];
    throw error;
  }
  return data || [];
}

// Public shape: story details only, never who set it.
export function publicLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    story_slug: lead.story_slug,
    href: `/stories/${lead.story_slug}/`,
    title: lead.title,
    summary: lead.summary,
    kicker: lead.kicker,
    image_url: lead.image_url,
    image_alt: lead.image_alt,
    image_credit: lead.image_credit,
    byline: lead.byline,
    story_date: lead.story_date,
    slot: lead.slot === "also" ? "also" : "lead"
  };
}

export async function getCurrentLead(now = new Date()) {
  return currentLead(await loadAllLeads(), now);
}

// Lead and hand-picked "Also on the front page" stories in one read.
export async function getFrontPageNow(now = new Date()) {
  const rows = await loadAllLeads();
  return { lead: currentLead(rows, now), also: currentAlso(rows, now) };
}

// Every run on the front page, newest first, for the archive.
export async function frontPageArchive(now = new Date()) {
  const runs = allFrontPageRuns(await loadAllLeads(), now);
  return runs.reverse().map((run) => ({ ...publicLead(run.lead), starts_at: run.startsAt, ends_at: run.endsAt, current: run.current, label: runLabel(run) }));
}

// The real dates one story ran as the lead (a story can lead twice).
export async function storyFrontPageRuns(slug, now = new Date()) {
  const runs = allFrontPageRuns(await loadAllLeads(), now).filter((run) => run.lead.story_slug === slug);
  return runs.map((run) => ({ lead_id: run.lead.id, slot: run.slot, starts_at: run.startsAt, ends_at: run.endsAt, current: run.current, label: runLabel(run) }));
}

// Lead stories that featured this athlete or team and actually ran.
export async function featuredRunsFor({ profileId = null, teamId = null }, now = new Date()) {
  if (!profileId && !teamId) return [];
  const runs = allFrontPageRuns(await loadAllLeads(), now).filter((run) => (profileId && (run.lead.linked_profile_ids || []).includes(profileId)) || (teamId && (run.lead.linked_team_ids || []).includes(teamId)));
  const bySlug = new Map();
  for (const run of runs) if (!bySlug.has(run.lead.story_slug)) bySlug.set(run.lead.story_slug, { story_slug: run.lead.story_slug, href: `/stories/${run.lead.story_slug}/`, title: run.lead.title, label: runLabel(run) });
  return [...bySlug.values()];
}

export async function adminFrontPageState(now = new Date()) {
  const leads = await loadAllLeads();
  const runs = leadRuns(leads, now);
  const ids = [...new Set(leads.flatMap((lead) => [...(lead.linked_profile_ids || [])]))];
  const teamIds = [...new Set(leads.flatMap((lead) => [...(lead.linked_team_ids || [])]))];
  const [profiles, teams, events] = await Promise.all([
    ids.length ? supabaseAdmin.from("athlete_profiles").select("id, slug, display_name").in("id", ids) : { data: [] },
    teamIds.length ? supabaseAdmin.from("team_pages").select("id, slug, school_name").in("id", teamIds) : { data: [] },
    supabaseAdmin.from("front_page_lead_events").select("id, created_at, lead_id, action, actor, details").order("created_at", { ascending: false }).limit(100)
  ]);
  const profileById = new Map((profiles.data || []).map((p) => [p.id, p]));
  const teamById = new Map((teams.data || []).map((t) => [t.id, t]));
  const withLinks = (lead) => ({ ...lead, linked_profiles: (lead.linked_profile_ids || []).map((id) => profileById.get(id)).filter(Boolean), linked_teams: (lead.linked_team_ids || []).map((id) => teamById.get(id)).filter(Boolean) });
  const current = currentLead(leads, now);
  const alsoNow = currentAlso(leads, now);
  return {
    installed: !(events.error && isMissingFrontPageTable(events.error)),
    slots_installed: slotsInstalled,
    also_max: ALSO_MAX,
    also_current: alsoNow.map(withLinks),
    also_history: alsoRuns(leads, now).filter((run) => !run.current).reverse().map((run) => ({ ...withLinks(run.lead), label: runLabel(run) })),
    current: current ? { ...withLinks(current), run: runs[runs.length - 1] ? { starts_at: runs[runs.length - 1].startsAt, label: runLabel(runs[runs.length - 1]) } : null } : null,
    queue: queuedLeads(leads, now).map(withLinks),
    history: [...runs].reverse().map((run) => ({ ...withLinks(run.lead), run_starts_at: run.startsAt, run_ends_at: run.endsAt, current: run.current, label: runLabel(run) })),
    events: events.error ? [] : events.data || [],
    leads: leads.map(withLinks)
  };
}

const clean = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};
const cleanTime = (value, label, { required = false } = {}) => {
  if (!value) { if (required) fail(`${label} is required.`); return null; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) fail(`${label} is not a valid date and time.`);
  return d.toISOString();
};
const cleanIds = (value) => [...new Set((Array.isArray(value) ? value : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 40);

async function logEvent(leadId, action, actor, details = {}) {
  const { error } = await supabaseAdmin.from("front_page_lead_events").insert({ lead_id: leadId, action, actor, details });
  if (error) throw error;
}

// The story details come from the admin page, which is built from the
// published story files; the slug must be one of them (checked by caller).
export async function scheduleLead({ story, startsAt, endsAt, kicker, linkedProfileIds, linkedTeamIds, actor, slot = "lead", position = null }) {
  const slug = clean(story?.slug, 200);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail("Choose a published story.");
  const starts = cleanTime(startsAt, "Start time", { required: true });
  const ends = cleanTime(endsAt, "End time");
  if (ends && new Date(ends) <= new Date(starts)) fail("The end time must be after the start time.");
  const record = {
    story_slug: slug,
    title: clean(story.title, 300) || fail("The story has no title."),
    summary: clean(story.summary, 500),
    kicker: clean(kicker, 40)?.toUpperCase() || null,
    image_url: clean(story.image_url, 600),
    image_alt: clean(story.image_alt, 400),
    image_credit: clean(story.image_credit, 200),
    byline: clean(story.byline, 200),
    story_date: /^\d{4}-\d{2}-\d{2}$/.test(String(story.date || "")) ? story.date : null,
    starts_at: starts,
    ends_at: ends,
    linked_profile_ids: cleanIds(linkedProfileIds),
    linked_team_ids: cleanIds(linkedTeamIds),
    created_by: actor,
    ...(slot === "also" ? { slot: "also", position } : {})
  };
  const { data, error } = await supabaseAdmin.from("front_page_leads").insert(record).select(LEAD_COLUMNS).single();
  if (error) throw error;
  await logEvent(data.id, "scheduled", actor, { story_slug: slug, slot, position, starts_at: starts, ends_at: ends, linked_profile_ids: record.linked_profile_ids, linked_team_ids: record.linked_team_ids });
  await linkFeaturedAthletes(data, actor);
  return data;
}

// Featured athletes also get a real story link on their profile.
async function linkFeaturedAthletes(lead, actor) {
  if (!lead.linked_profile_ids?.length) return;
  const rows = lead.linked_profile_ids.map((profileId) => ({ profile_id: profileId, story_slug: lead.story_slug, story_title: lead.title, story_href: `/stories/${lead.story_slug}/`, story_date: lead.story_date, relationship: "featured", source: "admin", public_visible: true, metadata: { from: "front page lead", set_by: actor } }));
  const { error } = await supabaseAdmin.from("athlete_story_links").upsert(rows, { onConflict: "profile_id,story_slug,relationship", ignoreDuplicates: true });
  if (error) throw error;
}

export async function editLead({ leadId, startsAt, endsAt, kicker, linkedProfileIds, linkedTeamIds, actor }) {
  const { data: lead, error } = await supabaseAdmin.from("front_page_leads").select(LEAD_COLUMNS).eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead || lead.status === "cancelled") fail("That lead was not found.", 404);
  const changes = {};
  if (startsAt !== undefined) {
    if (new Date(lead.starts_at) <= new Date()) fail("This lead has already started; end it early instead of moving its start.");
    changes.starts_at = cleanTime(startsAt, "Start time", { required: true });
  }
  if (endsAt !== undefined) changes.ends_at = cleanTime(endsAt, "End time");
  if (kicker !== undefined) changes.kicker = clean(kicker, 40)?.toUpperCase() || null;
  if (linkedProfileIds !== undefined) changes.linked_profile_ids = cleanIds(linkedProfileIds);
  if (linkedTeamIds !== undefined) changes.linked_team_ids = cleanIds(linkedTeamIds);
  const starts = changes.starts_at || lead.starts_at;
  const ends = changes.ends_at === undefined ? lead.ends_at : changes.ends_at;
  if (ends && new Date(ends) <= new Date(starts)) fail("The end time must be after the start time.");
  const { data, error: updateError } = await supabaseAdmin.from("front_page_leads").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", leadId).select(LEAD_COLUMNS).single();
  if (updateError) throw updateError;
  await logEvent(leadId, "edited", actor, { before: Object.fromEntries(Object.keys(changes).map((k) => [k, lead[k]])), after: changes });
  await linkFeaturedAthletes(data, actor);
  return data;
}

// A running lead ends now; a future one is cancelled.
export async function endOrCancelLead({ leadId, actor }) {
  const { data: lead, error } = await supabaseAdmin.from("front_page_leads").select(LEAD_COLUMNS).eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead || lead.status === "cancelled") fail("That lead was not found.", 404);
  const now = new Date();
  if (new Date(lead.starts_at) > now) {
    const { error: e } = await supabaseAdmin.from("front_page_leads").update({ status: "cancelled", cancelled_at: now.toISOString(), cancelled_by: actor, updated_at: now.toISOString() }).eq("id", leadId);
    if (e) throw e;
    await logEvent(leadId, "cancelled", actor, { starts_at: lead.starts_at });
    return { cancelled: true };
  }
  if (lead.ends_at && new Date(lead.ends_at) <= now) fail("That lead has already ended.");
  const { error: e } = await supabaseAdmin.from("front_page_leads").update({ ends_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", leadId);
  if (e) throw e;
  await logEvent(leadId, "ended_early", actor, { planned_end: lead.ends_at, ended_at: now.toISOString() });
  return { ended: true };
}

// Admin pickers.
export async function searchFeatured({ kind, query }) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  if (kind === "team") {
    const { data, error } = await supabaseAdmin.from("team_pages").select("id, slug, school_name").ilike("school_name", `%${q}%`).is("merged_into_team_id", null).limit(12);
    if (error) throw error;
    return (data || []).map((t) => ({ id: t.id, label: t.school_name, slug: t.slug }));
  }
  const { data, error } = await supabaseAdmin.from("athlete_profiles").select("id, slug, display_name, graduation_year").ilike("display_name", `%${q}%`).is("merged_into_profile_id", null).is("archived_at", null).limit(12);
  if (error) throw error;
  return (data || []).map((p) => ({ id: p.id, label: `${p.display_name}${p.graduation_year ? ` (${p.graduation_year})` : ""}`, slug: p.slug }));
}

// "Also on the front page" by hand: replaces whatever picks are up now with
// these stories (1 to ALSO_MAX), in this order. Each item:
// { story, linked_profile_ids, linked_team_ids }.
export async function setAlsoStories({ items, startsAt, endsAt, actor, now = new Date() }) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item?.story?.slug);
  if (!list.length) fail("Pick at least one story, or use the automatic rule.");
  if (list.length > ALSO_MAX) fail(`Pick at most ${ALSO_MAX} stories.`);
  if (new Set(list.map((item) => item.story.slug)).size !== list.length) fail("Each story can be picked once.");
  const rows = await loadAllLeads();
  if (!slotsInstalled) fail("Run install/92_FRONT_PAGE_ALSO_PICKS.sql first.", 409);
  const lead = currentLead(rows, now);
  if (lead && list.some((item) => item.story.slug === lead.story_slug)) fail("That story is the lead right now; pick a different one.");
  await clearAlsoStories({ actor, now, rows });
  const starts = startsAt || now.toISOString();
  const saved = [];
  for (const [index, item] of list.entries()) {
    saved.push(await scheduleLead({ story: item.story, startsAt: starts, endsAt, kicker: item.kicker ?? item.story.kicker, linkedProfileIds: item.linked_profile_ids, linkedTeamIds: item.linked_team_ids, actor, slot: "also", position: index + 1 }));
  }
  return { also: saved };
}

// Ends every pick that is up now; the homepage goes back to the automatic rule.
export async function clearAlsoStories({ actor, now = new Date(), rows = null }) {
  const current = currentAlso(rows || (await loadAllLeads()), now);
  for (const row of current) await endOrCancelLead({ leadId: row.id, actor });
  return { ended: current.length };
}
