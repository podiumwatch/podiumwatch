import { isIP } from "node:net";
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";

export const DISCOVERY_PROVIDERS = Object.freeze({
  baumspage: {
    label: "Baumspage",
    roots: {
      cross_country: "https://www.baumspage.com/cc/",
      outdoor_track: "https://www.baumspage.com/track/"
    },
    hosts: ["baumspage.com"],
    priority: 20,
    permission: "review_required"
  },
  ohsaa: {
    label: "OHSAA",
    roots: {
      cross_country: "https://www.ohsaa.org/sports/cc",
      outdoor_track: "https://www.ohsaa.org/sports/track/tournament-info"
    },
    hosts: ["ohsaa.org"],
    priority: 10,
    permission: "official"
  },
  timing_first: {
    label: "Timing First",
    roots: {
      cross_country: "https://results.timingfirst.com/meet-list",
      outdoor_track: "https://results.timingfirst.com/meet-list"
    },
    hosts: ["timingfirst.com", "live.athletic.net"],
    priority: 10,
    permission: "review_required"
  },
  finish_timing: {
    label: "FinishTiming",
    roots: {
      cross_country: "https://finishtiming.trackscoreboard.com/",
      outdoor_track: "https://finishtiming.trackscoreboard.com/"
    },
    hosts: ["finishtiming.trackscoreboard.com"],
    priority: 10,
    permission: "review_required"
  }
});

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function normalizeMeetName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/\b(results?|live|official|entries|information|info)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanText(value, max = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value) {
  return cleanText(decodeEntities(String(value || "").replace(/<[^>]+>/g, " ")));
}

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  return url.href.replace(/\/$/, "");
}

function safeArchiveUrl(value, provider) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || isIP(host) || host === "localhost") {
    fail("The discovery source is not a public HTTPS address.");
  }
  if (!provider.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    fail("The discovery source is outside this provider's approved hosts.");
  }
  return url;
}

function seasonDateRange(sport, year) {
  if (sport === "cross_country") return [`${year}-07-01`, `${year}-12-15`];
  if (sport === "indoor_track") return [`${year - 1}-11-01`, `${year}-04-15`];
  return [`${year}-02-01`, `${year}-07-15`];
}

function parseDate(text, seasonYear) {
  const value = cleanText(text, 500);
  const iso = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const md = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!md) return null;
  let year = md[3] ? Number(md[3]) : Number(seasonYear);
  if (year < 100) year += 2000;
  return `${year}-${String(md[1]).padStart(2, "0")}-${String(md[2]).padStart(2, "0")}`;
}

function parseUsDate(text) {
  const match = String(text || "").match(/\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/);
  if (!match) return null;
  return `${match[3]}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
}

function formatForUrl(url) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (path.endsWith(".csv")) return "csv";
  if (path.endsWith(".txt") || path.endsWith(".res")) return "txt";
  if (/live|meet|result/.test(path)) return "live_results";
  return "html";
}

function looksLikeMeet(title, url, year, sport) {
  const text = `${title} ${url}`.toLowerCase();
  if (!text.includes(String(year)) && !/results?|meet|invitational|championship|district|regional|state|classic|relays|dual|tri/.test(text)) return false;
  if (/privacy|terms|contact|login|register|calendar|schedule without results/.test(text)) return false;
  if (sport === "cross_country" && /track and field|indoor track/.test(text)) return false;
  return /results?|meet|invitational|championship|district|regional|state|classic|relays|dual|tri|xc|cross country|track/.test(text);
}

function extractCandidates(html, baseUrl, provider, sport, seasonYear) {
  const links = [];
  const pattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || ""))) && links.length < 600) {
    let href;
    try { href = new URL(decodeEntities(match[2]), baseUrl).href; } catch { continue; }
    const host = new URL(href).hostname.toLowerCase();
    const allowed = provider.hosts.some((item) => host === item || host.endsWith(`.${item}`));
    if (!allowed) continue;
    const title = stripHtml(match[4]) || cleanText(new URL(href).pathname.split("/").filter(Boolean).at(-1), 200);
    if (!title || !looksLikeMeet(title, href, seasonYear, sport)) continue;
    links.push({ title, url: canonicalUrl(href), date: parseDate(`${title} ${href}`, seasonYear) });
  }
  const unique = new Map();
  for (const link of links) unique.set(link.url, link);
  return [...unique.values()];
}

function extractLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    try {
      links.push({
        title: stripHtml(match[4]),
        url: canonicalUrl(new URL(decodeEntities(match[2]), baseUrl).href)
      });
    } catch {}
  }
  return links;
}

export function extractBaumspageCatalog(html, baseUrl, sport, seasonYear) {
  const candidates = [];
  const rowPattern = /<tr\b[^>]*>[\s\S]*?<a\b[^>]*href\s*=\s*["']([^"']*ccevent\.php\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?\((\d{1,2})\/(\d{1,2})\/(\d{2,4})\)[\s\S]*?<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(String(html || "")))) {
    let year = Number(match[5]);
    if (year < 100) year += 2000;
    if (year !== Number(seasonYear)) continue;
    const title = stripHtml(match[2]);
    if (!title || /sample event/i.test(title)) continue;
    const date = `${year}-${String(match[3]).padStart(2, "0")}-${String(match[4]).padStart(2, "0")}`;
    let url;
    try { url = canonicalUrl(new URL(decodeEntities(match[1]), baseUrl).href); } catch { continue; }
    if (sport === "cross_country" && !new URL(url).pathname.startsWith("/cc/")) continue;
    if (sport === "outdoor_track" && !new URL(url).pathname.startsWith("/track/")) continue;
    candidates.push({ title, url, date });
  }
  const unique = new Map();
  for (const candidate of candidates) unique.set(candidate.url, candidate);
  return [...unique.values()];
}

export function extractBaumspageEventIdentity(html) {
  const source = String(html || "");
  const headings = [...source.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((title) => title && !/^Baum(?:'|&apos;|&#39;)?s Page Event$/i.test(title));
  const title = headings[0];
  if (!title) return null;
  const readable = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:h[1-6]|p|div|li|tr|td|th|br|section|article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decodeEntities(readable)
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
  const titleLineIndex = lines.findIndex((line) => line === title);
  const searchStart = Math.max(0, titleLineIndex);
  const dateLineIndex = lines.findIndex((line, index) => index > searchStart && index <= searchStart + 12 && parseUsDate(line));
  if (titleLineIndex < 0 || dateLineIndex <= titleLineIndex) return null;
  const locationLines = lines.slice(titleLineIndex + 1, dateLineIndex)
    .filter((line) => !/^(looking for|note:|current year:|event files|files posted|click link)/i.test(line));
  return {
    title,
    location: locationLines.length ? locationLines.join(" | ") : null,
    date: parseUsDate(lines[dateLineIndex])
  };
}

export function resultLinkForSeason(html, baseUrl, seasonYear) {
  return extractLinks(html, baseUrl).find((link) => {
    return new RegExp(`^${seasonYear}\\s+Results$`, "i").test(link.title);
  }) || null;
}

export function hasActualResults(html, baseUrl) {
  const links = extractLinks(html, baseUrl);
  return links.some((link) => {
    const text = `${link.title} ${link.url}`.toLowerCase();
    if (/map|information|info|assignment|entry|contact|flyer|schedule/.test(text)) return false;
    return /live results?|results?|boys|girls|overall|team|\.pdf$|\.txt$|\.csv$|\.html?$/.test(text);
  });
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      try { results[index] = await worker(items[index]); }
      catch { results[index] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function verifyBaumspageCandidates(candidates, provider, seasonYear) {
  const checked = await mapWithConcurrency(candidates, 4, async (candidate) => {
    try {
      const eventHtml = await fetchArchive(candidate.url, provider);
      const identity = extractBaumspageEventIdentity(eventHtml);
      if (!identity) return { rejected: "event_identity_missing", candidate };
      if (identity.date !== candidate.date) return { rejected: "event_date_mismatch", candidate };
      if (!identity.title) return { rejected: "event_title_missing", candidate };
      const seasonLink = resultLinkForSeason(eventHtml, candidate.url, seasonYear);
      if (!seasonLink) return { rejected: "season_results_link_missing", candidate };
      const resultsHtml = await fetchArchive(seasonLink.url, provider);
      if (!hasActualResults(resultsHtml, seasonLink.url)) return { rejected: "result_files_missing", candidate };
      return { verified: {
        title: identity.title,
        url: seasonLink.url,
        date: identity.date,
        location: identity.location,
        catalogUrl: candidate.url
      } };
    } catch (error) {
      return { rejected: error?.name === "AbortError" ? "request_timeout" : "request_failed", candidate };
    }
  });
  const verified = checked.map((item) => item?.verified).filter(Boolean);
  const reasons = {};
  for (const item of checked) {
    if (!item?.rejected) continue;
    reasons[item.rejected] = (reasons[item.rejected] || 0) + 1;
  }
  return { verified, reasons };
}

function meetKey({ sport, seasonYear, normalizedName, meetDate }) {
  return crypto.createHash("sha256")
    .update([sport, seasonYear, normalizedName, meetDate || "unknown"].join("|"))
    .digest("hex");
}

async function fetchArchive(url, provider) {
  safeArchiveUrl(url, provider);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "PodiumWatchMeetDiscovery/1.0" }
    });
    if (!response.ok) fail(`The provider returned ${response.status}.`, 422);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 5 * 1024 * 1024) fail("The provider page is larger than 5 MB.", 413);
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) fail("The provider page is larger than 5 MB.", 413);
    return text;
  } finally { clearTimeout(timer); }
}

async function providerId(providerKey) {
  const { data, error } = await supabaseAdmin.from("results_source_providers").select("id").eq("provider_key", providerKey).single();
  if (error) throw error;
  return data.id;
}

async function clearUnapprovedProviderCatalog({ providerKey, sport, seasonYear }) {
  const providerUuid = await providerId(providerKey);
  const { data: rows, error } = await supabaseAdmin
    .from("discovered_meet_sources")
    .select("id,meet_id,metadata,discovered_meets!inner(id,sport,season_year,discovery_status)")
    .eq("provider_id", providerUuid)
    .eq("discovered_meets.sport", sport)
    .eq("discovered_meets.season_year", Number(seasonYear))
    .neq("discovered_meets.discovery_status", "approved");
  if (error) throw error;
  const legacyRows = (rows || []).filter((row) => Number(row.metadata?.parser_version || 0) < 2);
  const verifiedCatalogUrls = new Set((rows || [])
    .filter((row) => Number(row.metadata?.parser_version || 0) >= 2)
    .map((row) => row.metadata?.catalog_url)
    .filter(Boolean));
  const sourceIds = legacyRows.map((row) => row.id);
  const meetIds = [...new Set(legacyRows.map((row) => row.meet_id))];
  if (sourceIds.length) {
    const result = await supabaseAdmin.from("discovered_meet_sources").delete().in("id", sourceIds);
    if (result.error) throw result.error;
  }
  let removed = 0;
  for (const meetId of meetIds) {
    const remaining = await supabaseAdmin.from("discovered_meet_sources").select("id", { count: "exact", head: true }).eq("meet_id", meetId);
    if (remaining.error) throw remaining.error;
    if (!remaining.count) {
      const result = await supabaseAdmin.from("discovered_meets").delete().eq("id", meetId).neq("discovery_status", "approved").select("id");
      if (result.error) throw result.error;
      removed += result.data?.length || 0;
    }
  }
  return { removed, verifiedCatalogUrls };
}

export async function discoverMeetBatch({ providerKey, sport, seasonYear, limit = 100 }) {
  const provider = DISCOVERY_PROVIDERS[providerKey];
  if (!provider) fail("Choose a supported discovery provider.");
  if (!provider.roots[sport]) fail("That provider does not support the selected sport yet.");
  const year = Number(seasonYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) fail("Choose a valid season year.");
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 10), 200);
  const runInsert = await supabaseAdmin.from("results_discovery_runs").insert({ sport, season_year: year, provider_key: providerKey }).select("*").single();
  if (runInsert.error) throw runInsert.error;
  const run = runInsert.data;
  try {
    const rootUrl = provider.roots[sport];
    const html = await fetchArchive(rootUrl, provider);
    const cleanup = await clearUnapprovedProviderCatalog({ providerKey, sport, seasonYear: year });
    const cleared = cleanup.removed;
    const catalogCandidates = providerKey === "baumspage"
      ? extractBaumspageCatalog(html, rootUrl, sport, year).filter((candidate) => !cleanup.verifiedCatalogUrls.has(candidate.url)).slice(0, safeLimit)
      : extractCandidates(html, rootUrl, provider, sport, year).filter((candidate) => candidate.date).slice(0, safeLimit);
    const verification = providerKey === "baumspage"
      ? await verifyBaumspageCandidates(catalogCandidates, provider, year)
      : { verified: catalogCandidates, reasons: {} };
    const candidates = verification.verified;
    const providerUuid = await providerId(providerKey);
    let meetsCreated = 0;
    let sourcesCreated = 0;
    for (const candidate of candidates) {
      const normalizedName = normalizeMeetName(candidate.title);
      if (!normalizedName) continue;
      const [fromDate, toDate] = seasonDateRange(sport, year);
      const dateInSeason = candidate.date && candidate.date >= fromDate && candidate.date <= toDate;
      if (!dateInSeason) continue;
      const confidence = providerKey === "baumspage" ? 98 : 90;
      const status = confidence >= 80 ? "ready" : "needs_review";
      const key = meetKey({ sport, seasonYear: year, normalizedName, meetDate: candidate.date });
      const meetResult = await supabaseAdmin.from("discovered_meets").upsert({
        meet_key: key, meet_name: candidate.title, normalized_name: normalizedName,
        meet_date: candidate.date, season_year: year, sport, location_name: candidate.location || null,
        discovery_status: status, confidence,
        review_note: providerKey === "baumspage" ? "Verified event identity, season date, and season results page." : null,
        last_discovered_at: new Date().toISOString()
      }, { onConflict: "meet_key", ignoreDuplicates: false }).select("id,created_at,updated_at").single();
      if (meetResult.error) throw meetResult.error;
      if (meetResult.data.created_at === meetResult.data.updated_at) meetsCreated += 1;
      const sourceResult = await supabaseAdmin.from("discovered_meet_sources").upsert({
        meet_id: meetResult.data.id, provider_id: providerUuid, source_url: candidate.url,
        canonical_url: candidate.url, source_role: providerKey === "ohsaa" ? "official" : "candidate",
        file_format: formatForUrl(candidate.url), permission_status: provider.permission,
        source_priority: provider.priority, is_preferred: true, source_title: candidate.title,
        last_checked_at: new Date().toISOString(), metadata: {
          discovery_root: rootUrl,
          catalog_url: candidate.catalogUrl || null,
          parser_version: providerKey === "baumspage" ? 2 : 1,
          verified_results_page: providerKey === "baumspage"
        }
      }, { onConflict: "meet_id,canonical_url", ignoreDuplicates: true }).select("id");
      if (sourceResult.error) throw sourceResult.error;
      if (sourceResult.data?.length) sourcesCreated += 1;
    }
    await supabaseAdmin.from("results_discovery_runs").update({
      status: "completed", pages_checked: providerKey === "baumspage" ? (catalogCandidates.length * 2) + 1 : 1,
      links_checked: catalogCandidates.length,
      meets_found: candidates.length, meets_created: meetsCreated, sources_created: sourcesCreated,
      error_message: Object.keys(verification.reasons).length ? JSON.stringify(verification.reasons) : null,
      completed_at: new Date().toISOString()
    }).eq("id", run.id);
    return { run_id: run.id, provider: provider.label, candidates: catalogCandidates.length, verified: candidates.length, cleared, meets_created: meetsCreated, sources_created: sourcesCreated, rejection_summary: verification.reasons };
  } catch (error) {
    await supabaseAdmin.from("results_discovery_runs").update({ status: "failed", error_message: cleanText(error.message, 500), completed_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}

export async function listMeetCatalog({ sport, seasonYear, providerKey, status, search, limit = 200 }) {
  let query = supabaseAdmin.from("discovered_meets").select(`*, discovered_meet_sources(*, results_source_providers(provider_key,provider_name,provider_type,import_policy))`).order("meet_date", { ascending: false, nullsFirst: false }).limit(Math.min(Math.max(Number(limit) || 200, 1), 500));
  if (sport) query = query.eq("sport", sport);
  if (seasonYear) query = query.eq("season_year", Number(seasonYear));
  if (status) query = query.eq("discovery_status", status);
  if (search) query = query.ilike("meet_name", `%${cleanText(search, 100).replaceAll("%", "")}%`);
  const { data, error } = await query;
  if (error) throw error;
  let meets = data || [];
  if (providerKey) meets = meets.filter((meet) => meet.discovered_meet_sources?.some((source) => source.results_source_providers?.provider_key === providerKey));
  return meets.map((meet) => ({ ...meet, discovered_meet_sources: [...(meet.discovered_meet_sources || [])].sort((a, b) => a.source_priority - b.source_priority) }));
}

export async function updateMeetStatuses({ meetIds, status }) {
  const allowed = new Set(["ready", "needs_review", "approved", "ignored"]);
  if (!allowed.has(status)) fail("Choose a valid meet status.");
  const ids = [...new Set((Array.isArray(meetIds) ? meetIds : []).map(String))].slice(0, 250);
  if (!ids.length) fail("Select at least one meet.");
  const values = { discovery_status: status, updated_at: new Date().toISOString() };
  if (status === "approved") Object.assign(values, { approved_at: new Date().toISOString(), approved_by: "Podium Watch Admin" });
  const { data, error } = await supabaseAdmin.from("discovered_meets").update(values).in("id", ids).select("id");
  if (error) throw error;
  return { updated: data?.length || 0, status };
}

export async function discoveryStatus() {
  const [providerResult, meetResult, sourceResult, runResult] = await Promise.all([
    supabaseAdmin.from("results_source_providers").select("*").eq("active", true).order("source_priority"),
    supabaseAdmin.from("discovered_meets").select("id,discovery_status", { count: "exact" }),
    supabaseAdmin.from("discovered_meet_sources").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("results_discovery_runs").select("*").order("started_at", { ascending: false }).limit(15)
  ]);
  for (const result of [providerResult, meetResult, sourceResult, runResult]) if (result.error) throw result.error;
  const counts = { total: meetResult.count || 0, sources: sourceResult.count || 0, ready: 0, needs_review: 0, approved: 0 };
  for (const row of meetResult.data || []) if (row.discovery_status in counts) counts[row.discovery_status] += 1;
  return { installed: true, providers: providerResult.data || [], counts, recent_runs: runResult.data || [] };
}
