import crypto from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { extractDocument, parsePastedOrDelimitedText } from "./result_parsers.mjs";

export const RESULTS_ENGINE_VERSION = "results-v3.1.0";
const MAX_BYTES = 12 * 1024 * 1024;
const DEFAULTS = Object.freeze({ maxDepth: 5, maxPages: 50, timeoutMs: 12000, retries: 2, minLinkScore: 24, minResultScore: 52 });
const TRACKING = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const ALLOWED_ROOTS = ["baumspage.com", "ohsaa.org", "milesplit.com", "finishtiming.com", "trackscoreboard.com", "timingfirst.com", "athletic.net", "runsignup.com", "racingliveresults.com", "milesplit.live", "seotiming.com", "pierretiming.com", "tfmeetpro.com", "directathletics.com", "championshiptiming.org"];
const HANDOFF_ROOTS = ["runsignup.com", "athletic.net", "trackscoreboard.com", "racingliveresults.com", "milesplit.live", "timingfirst.com", "finishtiming.com", "seotiming.com", "pierretiming.com", "tfmeetpro.com", "directathletics.com", "championshiptiming.org"];

function error(message, status = 400, code = "INGESTION_ERROR") { const value = new Error(message); value.status = status; value.code = code; return value; }
function clean(value, max = 4000) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }
function hash(value) { return crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : String(value)).digest("hex"); }
function hostAllowed(host) { return ALLOWED_ROOTS.some((root) => host === root || host.endsWith(`.${root}`)); }
function htmlText(value) { return clean(String(value || "").replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'"), 500000); }

async function storeSourceDocument(jobId, bytes, documentType, contentType) {
  const extension = { html: "html", text: "txt", csv: "csv", pdf: "pdf", spreadsheet: "xlsx", json: "json" }[documentType] || "bin";
  const digest = hash(bytes); const storageKey = `${jobId}/${digest}.${extension}`;
  const { error: storageError } = await supabaseAdmin.storage.from("result-source-documents").upload(storageKey, bytes, { contentType: contentType || "application/octet-stream", upsert: true });
  if (storageError) throw error(`The source document could not be retained for audit: ${storageError.message || "storage error"}`, 500, "SOURCE_STORAGE_FAILED");
  return storageKey;
}

export function canonicalizeResultUrl(value, base) {
  const url = new URL(value, base);
  if (url.protocol === "http:" && hostAllowed(url.hostname.toLowerCase().replace(/\.$/, ""))) url.protocol = "https:";
  if (url.protocol !== "https:") throw error("Only public HTTPS result addresses are allowed.", 422, "UNSAFE_URL");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || isIP(host) || !hostAllowed(host)) throw error("The result address is outside the approved provider hosts.", 422, "UNAPPROVED_HOST");
  url.hostname = host;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}

function isPrivateAddress(address) {
  return /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(String(address || ""));
}
async function validatePublicDestination(url) {
  const parsed = new URL(url);
  const records = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw error("The result address resolves to a private or unsafe network.", 422, "PRIVATE_NETWORK");
}

export function recognizeProvider(value) {
  const host = new URL(value).hostname.toLowerCase();
  if (host.includes("baumspage")) return "baumspage";
  if (host.includes("milesplit")) return "milesplit_ohio";
  if (host.includes("athletic.net")) return "athletic_net";
  if (host.includes("finish") || host.includes("trackscoreboard")) return "finish_timing";
  if (host.includes("timingfirst")) return "timing_first";
  if (host.includes("championshiptiming")) return "championship_timing";
  if (host.includes("runsignup")) return "runsignup";
  return "other_public";
}

export function providerSeedVariants(value) {
  const canonical = canonicalizeResultUrl(value);
  const variants = [canonical];
  const parsed = new URL(canonical);
  if (recognizeProvider(canonical) === "milesplit_ohio" && /\/results\/\d+\/(?:formatted|auto)\/?$/i.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(/\/(?:formatted|auto)\/?$/i, "/raw");
    variants.push(canonicalizeResultUrl(parsed.href));
  }
  return [...new Set(variants)];
}

export function scoreResultLink({ anchor = "", surrounding = "", url = "", parentProvider = "" }) {
  const text = `${anchor} ${surrounding} ${url}`.toLowerCase();
  let score = 0; const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };
  if (/\b(results?|final|complete|official|live results?|download)\b/.test(text)) add(32, "RESULT_WORD");
  if (/\b(cross country|xc|track|boys|girls|division|race|heat|flight|timing)\b/.test(text)) add(14, "SPORT_WORD");
  if (/\.(pdf|csv|txt|res|xlsx?|html?)\b/.test(text)) add(24, "RESULT_FILE");
  if (/\b(20\d{2}|\d{1,2}[\/-]\d{1,2})\b/.test(text)) add(8, "DATE_CLUE");
  if (/baumspage\.com\/(?:cc\/ccevent|track\/trevent)\.php/i.test(url)) add(46, "BAUMSPAGE_EVENT_ROUTE");
  if (/baumspage\.com\/(?:cc\/ccframe|track\/trframe)\.php/i.test(url)) add(32, "BAUMSPAGE_RESULT_FRAME");
  if (/milesplit\.com\/meets\/\d+[^/]*\/results(?:\/\d+)?(?:\/formatted)?/i.test(url)) add(52, "MILESPLIT_RESULT_ROUTE");
  if (/athletic\.net\/(?:cross-country|track-and-field[^/]*)\/meet\/\d+\/results/i.test(url)) add(52, "ATHLETIC_NET_RESULT_ROUTE");
  if (HANDOFF_ROOTS.some((root) => text.includes(root))) add(20, "APPROVED_HANDOFF");
  if (parentProvider && recognizeProvider(url) === parentProvider) add(6, "SAME_PROVIDER");
  if (/\b(privacy|terms|login|account|register|advertis|facebook|instagram|twitter|contact|merchandise)\b/.test(text)) add(-55, "NAVIGATION_OR_ACCOUNT");
  if (/\b(athletes?|profiles?|rankings?|rosters?|teams?|videos?|photos?|news|articles?|calendar|stats?)\b/.test(text) && !/\/results(?:\/|\?|$)/.test(url)) add(-70, "NON_RESULT_PAGE");
  if (/\b(entries?|information|directions|map|photos?|schedule)\b/.test(text) && !/result/.test(text)) add(-18, "NON_RESULT_RESOURCE");
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function extractScoredLinks(html, baseUrl) {
  const links = []; const source = String(html || "");
  const pattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi; let match;
  while ((match = pattern.exec(source)) && links.length < 1200) {
    let url; try { url = canonicalizeResultUrl(match[2].replace(/&amp;/gi, "&"), baseUrl); } catch { continue; }
    const anchor = htmlText(match[4]);
    const surrounding = htmlText(source.slice(Math.max(0, match.index - 180), Math.min(source.length, pattern.lastIndex + 180)));
    const scored = scoreResultLink({ anchor, surrounding, url, parentProvider: recognizeProvider(baseUrl) });
    links.push({ url, anchor: clean(anchor, 300), surrounding: clean(surrounding, 500), ...scored });
  }
  return [...new Map(links.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()];
}

export function classifyDocument({ contentType = "", url = "", bytes = Buffer.alloc(0) }) {
  const head = bytes.subarray(0, 16).toString("latin1"); const path = new URL(url).pathname.toLowerCase();
  if (head.startsWith("%PDF") || /application\/pdf/i.test(contentType) || path.endsWith(".pdf")) return "pdf";
  if (/officedocument\.spreadsheetml/i.test(contentType) || path.endsWith(".xlsx")) return "spreadsheet";
  if (/text\/csv/i.test(contentType) || path.endsWith(".csv")) return "csv";
  if (/application\/json/i.test(contentType)) return "json";
  if (/text\/plain/i.test(contentType) || /\.(txt|res)$/.test(path)) return "text";
  if (/text\/html|application\/xhtml/i.test(contentType) || /<html|<table|<pre/i.test(head + bytes.subarray(0, 1000).toString("utf8"))) return "html";
  return "unknown";
}

export function verifyResultContent({ text = "", html = "", documentType = "text" }) {
  const body = html ? htmlText(html) : clean(text, 500000); const lower = body.toLowerCase();
  let score = 0; const evidence = []; const add = (n, code) => { score += n; evidence.push(code); };
  const timeCount = (body.match(/\b(?:\d{1,2}:)?\d{1,2}\.\d{1,2}\b/g) || []).length;
  const placeCount = (body.match(/(?:^|\s)(?:place|pl)?\s*\d{1,3}(?:\s|$)/gim) || []).length;
  const eventCount = (lower.match(/\b(?:5k|3200|1600|800|400|200|100|hurdles?|high jump|long jump|pole vault|shot put|discus|relay)\b/g) || []).length;
  if (/official results?|meet results?|complete results?|results by/.test(lower)) add(22, "OFFICIAL_RESULT_HEADING");
  if (timeCount >= 4) add(Math.min(28, 12 + timeCount), "REPEATED_MARKS");
  if (placeCount >= 3) add(15, "REPEATED_PLACES");
  if (eventCount >= 1) add(Math.min(18, 8 + eventCount), "EVENT_LABELS");
  if (/\b(team|school|athlete|runner|name|grade|points?)\b/.test(lower)) add(12, "RESULT_COLUMNS");
  if (/\b(dnf|dns|dq|scr|nm)\b/i.test(body)) add(5, "RESULT_STATUSES");
  if (documentType === "csv" && body.split(/\r?\n/).length >= 4) add(12, "TABULAR_DOCUMENT");
  return { score: Math.min(100, score), evidence, warningCodes: score < 52 ? ["INSUFFICIENT_RESULT_EVIDENCE"] : [] };
}

export function assessParsedResults(rows = [], rejectedRows = []) {
  const missing = ["ATHLETE_OR_RELAY_MISSING", "SCHOOL_MISSING", "EVENT_MISSING", "MARK_MISSING"];
  const complete = rows.filter((row) => row && !row.warningCodes?.some((code) => missing.includes(code)));
  return { complete, rejected: rejectedRows.length, valid: complete.length > 0, evidence: complete.length ? ["COMPLETE_RESULT_ROWS"] : [], warningCodes: rejectedRows.length ? ["INCOMPLETE_ROWS_REJECTED"] : [] };
}

function parseDelimited(text) {
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim()); if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const split = (line) => { const cells = []; let value = "", quoted = false; for (let i = 0; i < line.length; i += 1) { const c = line[i]; if (c === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; } else if (c === '"') quoted = !quoted; else if (c === delimiter && !quoted) { cells.push(clean(value)); value = ""; } else value += c; } cells.push(clean(value)); return cells; };
  const headers = split(lines[0]).map((v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return lines.slice(1).map((line, index) => Object.fromEntries(headers.map((header, i) => [header || `column_${i + 1}`, split(line)[i] || ""]).concat([["_row_number", index + 2]])));
}

function first(row, names) { for (const name of names) if (row[name]) return row[name]; return null; }
function integer(value) { const match = String(value || "").match(/\d+/); return match ? Number(match[0]) : null; }
function normalizeName(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function parseGenericRows({ text, documentType = "text", metadata = {} }) {
  const rows = documentType === "csv" ? parseDelimited(text) : [];
  return rows.map((row) => {
    const athlete = first(row, ["athlete_name","athlete","name","runner"]); const school = first(row, ["school_name","school","team"]); const event = first(row, ["event_name","event","race"]); const mark = first(row, ["mark_text","mark","time","result","performance"]);
    const raw = JSON.stringify(row); const warnings = [];
    if (!athlete && !first(row, ["relay_team","relay"])) warnings.push("ATHLETE_MISSING");
    if (!school) warnings.push("SCHOOL_MISSING"); if (!event) warnings.push("EVENT_MISSING"); if (!mark) warnings.push("MARK_MISSING");
    const identity = [metadata.meetName, metadata.meetDate, event, athlete, school, mark, first(row,["place","pl"])].map(normalizeName).join("|");
    return { rowNumber: row._row_number, meetName: metadata.meetName || first(row,["meet_name","meet"]), meetDate: metadata.meetDate || first(row,["meet_date","date"]), meetLocation: metadata.meetLocation || first(row,["meet_location","location"]), sport: metadata.sport || first(row,["sport"]), seasonYear: metadata.seasonYear || integer(first(row,["season_year","year"])), competitionLevel: first(row,["competition_level","level"]), gender: first(row,["gender","sex"]), division: first(row,["division"]), eventName: event, athleteName: athlete, athleteGrade: first(row,["athlete_grade","grade"]), schoolName: school, relayTeam: first(row,["relay_team","relay"]), place: integer(first(row,["place","pl","rank"])), markText: mark, points: Number(first(row,["points","pts"])) || null, windText: first(row,["wind","wind_text"]), resultStatus: first(row,["status"]), parserConfidence: Math.max(10, 100 - warnings.length * 22), warningCodes: warnings, rawRow: row, sourceFingerprint: hash(raw), resultFingerprint: hash(identity) };
  });
}

export async function fetchPage(url, options = DEFAULTS, fetchImpl = fetch, validateImpl = validatePublicDestination) {
  let last; for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      let current = canonicalizeResultUrl(url); const redirects = []; const visited = new Set([current]);
      for (let hop = 0; hop <= 6; hop += 1) {
        await validateImpl(current);
        const response = await fetchImpl(current, { signal: controller.signal, redirect: "manual", headers: { Accept: "text/html,application/pdf,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;q=0.9,*/*;q=0.2", "User-Agent": "PodiumWatchResultsResearch/2.0 (+https://podiumwatch.com)" } });
        if ([301,302,303,307,308].includes(response.status)) {
          const location = response.headers.get("location"); if (!location) throw error("Redirect response did not include a destination.", 422, "REDIRECT_WITHOUT_LOCATION");
          const next = canonicalizeResultUrl(location, current);
          if (response.body) await response.body.cancel();
          if (visited.has(next)) throw error("The source returned a redirect loop.", 422, "REDIRECT_LOOP");
          visited.add(next); current = next; redirects.push(current); continue;
        }
        if (!response.ok) { const failure = error(`HTTP ${response.status} from ${current}`, response.status === 429 ? 429 : 422, `HTTP_${response.status}`); failure.retryAfter = response.headers.get("retry-after"); throw failure; }
        const length = Number(response.headers.get("content-length") || 0); if (length > MAX_BYTES) throw error("Source document exceeds the 12 MB safety limit.", 413, "DOCUMENT_TOO_LARGE");
        const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > MAX_BYTES) throw error("Source document exceeds the 12 MB safety limit.", 413, "DOCUMENT_TOO_LARGE");
        return { response, bytes, finalUrl: current, redirects };
      }
      throw error("The source exceeded six safe redirects.", 422, "TOO_MANY_REDIRECTS");
    } catch (cause) { last = cause; if (attempt < options.retries) await new Promise((resolve) => setTimeout(resolve, cause?.retryAfter ? Math.min(5000, Number(cause.retryAfter) * 1000) : 350 * (attempt + 1))); } finally { clearTimeout(timer); }
  } throw last;
}

async function audit(jobId, action, details = {}) { await supabaseAdmin.from("result_ingestion_audit").insert({ job_id: jobId, action, details }); }
function stagingValue(jobId, documentId, row) {
  return { job_id: jobId, document_id: documentId, row_number: Number(String(row.rowNumber).split(".").pop()) || 1, meet_name: row.meetName, meet_date: /^\d{4}-\d{2}-\d{2}$/.test(row.meetDate || "") ? row.meetDate : null, meet_location: row.meetLocation, sport: row.sport, season_year: row.seasonYear, competition_level: row.competitionLevel, gender: row.gender, division: row.division, event_name: row.eventName, event_code: row.eventCode, distance_meters: row.distanceMeters, heat: row.heat, flight: row.flight, round: row.round, athlete_name: row.athleteName, athlete_grade: row.athleteGrade, school_name: row.schoolName, relay_team: row.relayTeam, relay_members: row.relayMembers || [], place: row.place, mark_text: row.markText, mark_value: row.markValue, points: row.points, wind_text: row.windText, result_status: row.resultStatus, parser_confidence: row.parserConfidence, match_confidence: row.matchConfidence || 0, warning_codes: row.warningCodes || [], raw_row: row.rawRow || {}, source_fingerprint: row.sourceFingerprint, result_fingerprint: row.resultFingerprint };
}

function performanceShape(row) {
  const key = String(row.event_code || "");
  if (/^(high_jump|pole_vault)$/.test(key)) return { measurement_type: "height", mark_unit: "meters", sort_direction: "desc" };
  if (/^(long_jump|triple_jump|shot_put|discus|weight_throw|hammer|javelin)$/.test(key)) return { measurement_type: "distance", mark_unit: "meters", sort_direction: "desc" };
  if (/^(pentathlon|heptathlon|decathlon)$/.test(key)) return { measurement_type: "points", mark_unit: "points", sort_direction: "desc" };
  return { measurement_type: "time", mark_unit: "seconds", sort_direction: "asc" };
}

export async function createContentIngestionJob(input) {
  const content = String(input.text || ""); if (!content.trim()) throw error("Paste result text or select at least one supported file.");
  if (Buffer.byteLength(content, input.encoding === "base64" ? "base64" : "utf8") > MAX_BYTES) throw error("The uploaded result document exceeds the 12 MB safety limit.", 413, "DOCUMENT_TOO_LARGE");
  const bytes = input.encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
  const safeName = clean(input.fileName || "pasted-results.txt", 180).replace(/[^a-zA-Z0-9._ ]/g, "_");
  const type = input.documentType || classifyDocument({ contentType: input.contentType || "text/plain", url: `https://baumspage.com/uploads/${encodeURIComponent(safeName)}`, bytes });
  if (!["html","text","csv","pdf","spreadsheet","json"].includes(type)) throw error("This file type is not supported. Use PDF, HTML, text, CSV, or XLSX. Save older XLS files as XLSX first.", 422, "UNSUPPORTED_FILE_TYPE");
  const { data: job, error: jobError } = await supabaseAdmin.from("result_ingestion_jobs").insert({ job_type: input.jobType || "paste", provider_key: input.providerKey || "manual_upload", sport: input.sport || null, season_year: input.seasonYear || null, seeds: [{ file_name: safeName }], options: { dryRun: input.dryRun !== false }, parser_version: RESULTS_ENGINE_VERSION, status: "running", progress: { queued: 0, visited: 0, documents: 1, rows: 0, errors: 0 } }).select("*").single(); if (jobError) throw jobError;
  const extracted = type === "text" && input.jobType === "paste" ? { text: content, rows: parsePastedOrDelimitedText(content, { sport: input.sport, seasonYear: input.seasonYear }), warnings: [] } : await extractDocument({ bytes, text: ["html","text","csv","json"].includes(type) ? bytes.toString("utf8") : "", documentType: type, metadata: { sport: input.sport, seasonYear: input.seasonYear } });
  const verification = verifyResultContent({ text: extracted.text, html: type === "html" ? extracted.text : "", documentType: type });
  const assessment = assessParsedResults(extracted.rows, extracted.rejectedRows || []);
  const storageKey = await storeSourceDocument(job.id, bytes, type, input.contentType);
  const { data: document, error: documentError } = await supabaseAdmin.from("result_source_documents").insert({ job_id: job.id, provider_key: input.providerKey || "manual_upload", source_url: null, source_chain: [{ upload: safeName }], document_type: type, storage_key: storageKey, content_sha256: hash(bytes), parser_version: RESULTS_ENGINE_VERSION, verification_score: assessment.valid ? Math.max(verification.score, 60) : Math.min(verification.score, 40), verification_evidence: [...verification.evidence, ...assessment.evidence], warning_codes: [...new Set([...(extracted.warnings || []), ...assessment.warningCodes])], raw_excerpt: clean(extracted.text, 12000), status: assessment.valid ? "parsed" : "rejected" }).select("*").single(); if (documentError) throw documentError;
  if (extracted.rows.length) { const { error: rowError } = await supabaseAdmin.from("result_staging_rows").upsert(extracted.rows.map((row) => stagingValue(job.id, document.id, row)), { onConflict: "job_id,result_fingerprint", ignoreDuplicates: true }); if (rowError) throw rowError; }
  const status = extracted.rows.length ? "completed" : "partial"; const progress = { queued: 0, visited: 0, documents: 1, rows: extracted.rows.length, errors: extracted.rows.length ? 0 : 1 };
  await supabaseAdmin.from("result_ingestion_jobs").update({ status, progress, error_summary: extracted.rows.length ? {} : { NO_RESULT_ROWS_PARSED: 1 }, completed_at: new Date().toISOString() }).eq("id", job.id); await audit(job.id, "content_parsed", { file_name: safeName, document_type: type, row_count: extracted.rows.length, warnings: extracted.warnings });
  return { ...job, status, progress };
}
export async function createIngestionJob(input) {
  const rawSeeds = Array.isArray(input.seeds) ? input.seeds : String(input.urls || "").split(/[\r\n]+/); const seeds = [...new Set(rawSeeds.map((v) => String(v).trim()).filter(Boolean).flatMap((v) => providerSeedVariants(v)))]; if (!seeds.length) throw error("Add at least one public result or catalog URL.");
  const options = { ...DEFAULTS, ...(input.options || {}) }; options.maxDepth = Math.min(8, Math.max(0, Number(options.maxDepth))); options.maxPages = Math.min(250, Math.max(1, Number(options.maxPages)));
  const { data, error: dbError } = await supabaseAdmin.from("result_ingestion_jobs").insert({ job_type: input.jobType || "urls", provider_key: input.providerKey || null, sport: input.sport || null, season_year: input.seasonYear || null, seeds, options, parser_version: RESULTS_ENGINE_VERSION, progress: { queued: seeds.length, visited: 0, documents: 0, rows: 0, errors: 0 } }).select("*").single(); if (dbError) throw dbError;
  const pages = seeds.map((url) => ({ job_id: data.id, url, canonical_url: url, depth: 0, provider_key: recognizeProvider(url), status: "queued", result_score: 100, reason_codes: ["SEED_URL"], source_chain: [url] })); const { error: pageError } = await supabaseAdmin.from("result_crawl_pages").insert(pages); if (pageError) throw pageError; await audit(data.id, "job_created", { seed_count: seeds.length, options }); return data;
}

export async function runIngestionJob(jobId, sliceLimit = 10) {
  const { data: job, error: jobError } = await supabaseAdmin.from("result_ingestion_jobs").select("*").eq("id", jobId).single(); if (jobError) throw jobError; if (job.cancel_requested) return cancelJob(jobId);
  const options = { ...DEFAULTS, ...(job.options || {}) };
  await supabaseAdmin.from("result_crawl_pages").update({ status: "queued", error_detail: { code: "STALE_SLICE_RECOVERED", message: "A prior request ended while this page was being processed." } }).eq("job_id", jobId).eq("status", "fetching");
  await supabaseAdmin.from("result_ingestion_jobs").update({ status: "running", cancel_requested: false, started_at: job.started_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId);
  const { data: queued, error: queueError } = await supabaseAdmin.from("result_crawl_pages").select("*").eq("job_id", jobId).eq("status", "queued").order("result_score", { ascending: false }).order("depth").limit(Math.min(25, Math.max(1, sliceLimit))); if (queueError) throw queueError;
  let visited = Number(job.progress?.visited || 0), documents = Number(job.progress?.documents || 0), rowsCount = Number(job.progress?.rows || 0), errors = Number(job.progress?.errors || 0);
  for (const page of queued || []) {
    if (visited >= options.maxPages) break; await supabaseAdmin.from("result_crawl_pages").update({ status: "fetching" }).eq("id", page.id);
    try {
      const loaded = await fetchPage(page.url, options); const type = classifyDocument({ contentType: loaded.response.headers.get("content-type") || "", url: loaded.finalUrl, bytes: loaded.bytes }); const body = ["html","text","csv","json"].includes(type) ? loaded.bytes.toString("utf8") : "";
      const extracted = await extractDocument({ bytes: loaded.bytes, text: body, documentType: type, metadata: { ...(page.page_context || {}), sport: job.sport, seasonYear: job.season_year } });
      const verification = verifyResultContent({ text: extracted.text || body, html: type === "html" ? body : "", documentType: type });
      const assessment = assessParsedResults(extracted.rows, extracted.rejectedRows || []);
      if (assessment.complete.length >= 3) { verification.score = Math.max(verification.score, Math.min(100, 55 + assessment.complete.length)); verification.evidence.push("COMPLETE_RESULT_ROWS"); }
      if (!assessment.valid) verification.score = Math.min(verification.score, 40);
      const chain = [...new Set([...(page.source_chain || [page.url]), ...(loaded.redirects || []), loaded.finalUrl])];
      const pageContext = { ...(page.page_context || {}), ...(extracted.metadata || {}), sport: job.sport, seasonYear: job.season_year };
      await supabaseAdmin.from("result_crawl_pages").update({ status: "fetched", url: loaded.finalUrl, http_status: loaded.response.status, content_type: loaded.response.headers.get("content-type"), content_length: loaded.bytes.length, content_sha256: hash(loaded.bytes), result_score: verification.score, result_evidence: verification.evidence, reason_codes: extracted.warnings, source_chain: chain, page_context: pageContext, fetched_at: new Date().toISOString() }).eq("id", page.id); visited += 1;
      if (assessment.valid && (verification.score >= options.minResultScore || ["pdf","spreadsheet","csv"].includes(type))) {
        const storageKey = await storeSourceDocument(jobId, loaded.bytes, type, loaded.response.headers.get("content-type"));
        const document = { job_id: jobId, page_id: page.id, provider_key: recognizeProvider(loaded.finalUrl), source_url: loaded.finalUrl, source_chain: chain, document_type: type, storage_key: storageKey, content_sha256: hash(loaded.bytes), parser_version: RESULTS_ENGINE_VERSION, verification_score: verification.score, verification_evidence: verification.evidence, warning_codes: [...new Set([...(verification.warningCodes || []), ...(extracted.warnings || [])])], raw_excerpt: clean(extracted.text || body, 12000), status: extracted.rows.length ? "parsed" : verification.score >= options.minResultScore ? "verified" : "needs_review" };
        const { data: saved, error: documentError } = await supabaseAdmin.from("result_source_documents").upsert(document, { onConflict: "job_id,content_sha256" }).select("*").single(); if (documentError) throw documentError; documents += 1;
        if (saved && extracted.rows.length) { const values = extracted.rows.map((row) => stagingValue(jobId, saved.id, row)); const { data: insertedRows, error: rowError } = await supabaseAdmin.from("result_staging_rows").upsert(values, { onConflict: "job_id,result_fingerprint", ignoreDuplicates: true }).select("id"); if (rowError) throw rowError; rowsCount += insertedRows?.length || 0; }
      }
      if (type === "html" && page.depth < options.maxDepth) { const { count: knownCount } = await supabaseAdmin.from("result_crawl_pages").select("id", { count: "exact", head: true }).eq("job_id", jobId); const capacity = Math.max(0, options.maxPages - Number(knownCount || 0)); const links = extractScoredLinks(body, loaded.finalUrl).filter((link) => link.score >= options.minLinkScore).slice(0, capacity); for (const link of links) { const next = { job_id: jobId, url: link.url, canonical_url: link.url, depth: page.depth + 1, provider_key: recognizeProvider(link.url), status: "queued", result_score: link.score, reason_codes: link.reasons, parent_page_id: page.id, source_chain: [...chain, link.url], page_context: pageContext }; const { data: nextPage } = await supabaseAdmin.from("result_crawl_pages").upsert(next, { onConflict: "job_id,canonical_url", ignoreDuplicates: true }).select("id").maybeSingle(); if (nextPage) await supabaseAdmin.from("result_crawl_edges").upsert({ job_id: jobId, from_page_id: page.id, to_page_id: nextPage.id, anchor_text: link.anchor, surrounding_text: link.surrounding, link_score: link.score, reason_codes: link.reasons }, { onConflict: "job_id,from_page_id,to_page_id", ignoreDuplicates: true }); } }
    } catch (cause) { errors += 1; const detail = { code: cause.code || "FETCH_FAILED", message: clean(cause.message || String(cause), 1000), provider: page.provider_key, url: page.url, stage: "fetch_parse", retry_state: "exhausted" }; await supabaseAdmin.from("result_crawl_pages").update({ status: ["UNAPPROVED_HOST","PRIVATE_NETWORK","UNSAFE_URL"].includes(cause.code) ? "blocked" : "failed", reason_codes: [detail.code], error_detail: detail }).eq("id", page.id); await audit(jobId, "page_failed", detail); }
  }
  const { count: remaining } = await supabaseAdmin.from("result_crawl_pages").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "queued"); const status = remaining > 0 && visited < options.maxPages ? "paused" : errors && !documents ? "partial" : "completed"; const progress = { queued: remaining || 0, visited, documents, rows: rowsCount, errors }; await supabaseAdmin.from("result_ingestion_jobs").update({ status, progress, checkpoint: { remaining: remaining || 0, last_slice_at: new Date().toISOString() }, completed_at: status === "completed" || status === "partial" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", jobId); await audit(jobId, "job_slice_completed", { status, progress }); return { id: jobId, status, progress };
}

export async function cancelJob(jobId) { await supabaseAdmin.from("result_ingestion_jobs").update({ status: "cancelled", cancel_requested: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId); await audit(jobId, "job_cancelled"); return { id: jobId, status: "cancelled" }; }
export async function pauseJob(jobId) { await supabaseAdmin.from("result_ingestion_jobs").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", jobId); await audit(jobId, "job_paused"); return { id: jobId, status: "paused" }; }
export async function retryFailedPages(jobId) { const { data, error: dbError } = await supabaseAdmin.from("result_crawl_pages").update({ status: "queued", error_detail: {}, updated_at: new Date().toISOString() }).eq("job_id", jobId).in("status", ["failed","blocked"]).select("id"); if (dbError) throw dbError; await supabaseAdmin.from("result_ingestion_jobs").update({ status: "paused", cancel_requested: false, updated_at: new Date().toISOString() }).eq("id", jobId); await audit(jobId, "failed_pages_retried", { count: data?.length || 0 }); return { id: jobId, status: "paused", retried: data?.length || 0 }; }
export async function listIngestionJobs() { const { data, error: dbError } = await supabaseAdmin.from("result_ingestion_jobs").select("*").order("created_at", { ascending: false }).limit(50); if (dbError) throw dbError; return data || []; }
export async function getIngestionJob(jobId) { const [job, pages, documents, rows, auditRows] = await Promise.all([supabaseAdmin.from("result_ingestion_jobs").select("*").eq("id", jobId).single(), supabaseAdmin.from("result_crawl_pages").select("*").eq("job_id", jobId).order("created_at").limit(1000), supabaseAdmin.from("result_source_documents").select("*").eq("job_id", jobId).order("created_at"), supabaseAdmin.from("result_staging_rows").select("*").eq("job_id", jobId).order("row_number").limit(5000), supabaseAdmin.from("result_ingestion_audit").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(200)]); for (const result of [job,pages,documents,rows,auditRows]) if (result.error) throw result.error; return { job: job.data, pages: pages.data || [], documents: documents.data || [], rows: rows.data || [], audit: auditRows.data || [] }; }
export async function reviewRows(jobId, rowIds, reviewStatus, note = "") { if (!['approved','rejected','pending'].includes(reviewStatus)) throw error("Invalid review status."); const { data, error: dbError } = await supabaseAdmin.from("result_staging_rows").update({ review_status: reviewStatus, review_note: clean(note, 2000), reviewed_at: reviewStatus === "pending" ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("job_id", jobId).in("id", rowIds).select("id"); if (dbError) throw dbError; await audit(jobId, "rows_reviewed", { status: reviewStatus, count: data?.length || 0 }); return { updated: data?.length || 0 }; }

function normalizeIdentity(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export async function resolveJobIdentities(jobId) {
  const { data: rows, error: rowError } = await supabaseAdmin.from("result_staging_rows").select("id,athlete_name,school_name,gender,athlete_grade,season_year,warning_codes").eq("job_id", jobId).in("review_status", ["pending","approved"]).limit(5000); if (rowError) throw rowError;
  const athleteNames = [...new Set((rows || []).map((row) => normalizeIdentity(row.athlete_name)).filter(Boolean))]; const schoolNames = [...new Set((rows || []).map((row) => normalizeIdentity(row.school_name)).filter(Boolean))];
  const [profiles, schools, aliases] = await Promise.all([supabaseAdmin.from("athlete_profiles").select("id,normalized_name,gender,graduation_year,current_school_id").in("normalized_name", athleteNames), supabaseAdmin.from("ohio_schools").select("id,normalized_name,school_name").in("normalized_name", schoolNames), supabaseAdmin.from("ohio_school_aliases").select("school_id,normalized_alias").in("normalized_alias", schoolNames)]);
  for (const result of [profiles,schools,aliases]) if (result.error) throw result.error;
  const schoolMap = new Map(); for (const school of schools.data || []) schoolMap.set(school.normalized_name, [school]); for (const alias of aliases.data || []) schoolMap.set(alias.normalized_alias, [...(schoolMap.get(alias.normalized_alias) || []), { id: alias.school_id }]);
  const profileMap = new Map(); for (const profile of profiles.data || []) profileMap.set(profile.normalized_name, [...(profileMap.get(profile.normalized_name) || []), profile]);
  let matched = 0, ambiguous = 0, unmatched = 0;
  for (const row of rows || []) {
    const schoolCandidates = [...new Map((schoolMap.get(normalizeIdentity(row.school_name)) || []).map((item) => [item.id,item])).values()]; const school = schoolCandidates.length === 1 ? schoolCandidates[0] : null;
    const expectedGraduation = row.season_year && row.athlete_grade ? Number(row.season_year) + (12 - Number(row.athlete_grade)) : null;
    const candidates = (profileMap.get(normalizeIdentity(row.athlete_name)) || []).filter((profile) => (!row.gender || !profile.gender || profile.gender === "unspecified" || profile.gender === row.gender) && (!school || !profile.current_school_id || profile.current_school_id === school.id) && (!expectedGraduation || !profile.graduation_year || profile.graduation_year === expectedGraduation));
    const exact = candidates.length === 1 && schoolCandidates.length === 1; const identityWarning = exact ? null : candidates.length > 1 || schoolCandidates.length > 1 ? "AMBIGUOUS_IDENTITY" : "IDENTITY_UNMATCHED";
    const warningCodes = [...new Set([...(row.warning_codes || []).filter((code) => !["AMBIGUOUS_IDENTITY","IDENTITY_UNMATCHED"].includes(code)), identityWarning].filter(Boolean))];
    if (exact) matched += 1; else if (identityWarning === "AMBIGUOUS_IDENTITY") ambiguous += 1; else unmatched += 1;
    const { error: updateError } = await supabaseAdmin.from("result_staging_rows").update({ matched_athlete_id: exact ? candidates[0].id : null, matched_school_id: school?.id || null, match_confidence: exact ? 100 : 0, warning_codes: warningCodes }).eq("id", row.id); if (updateError) throw updateError;
  }
  await audit(jobId, "identities_resolved", { matched, ambiguous, unmatched }); return { matched, ambiguous, unmatched };
}

export async function importApprovedRows(jobId) {
  const { data: job, error: jobError } = await supabaseAdmin.from("result_ingestion_jobs").select("*").eq("id", jobId).single(); if (jobError) throw jobError;
  const { data: rows, error: rowError } = await supabaseAdmin.from("result_staging_rows").select("*,result_source_documents(source_url,provider_key)").eq("job_id", jobId).eq("review_status", "approved").not("matched_athlete_id", "is", null).limit(5000); if (rowError) throw rowError;
  if (!rows?.length) throw error("No approved rows have an exact athlete and school match. Match identities and review the rows before importing.", 409, "NO_IMPORTABLE_ROWS");
  let imported = 0, duplicates = 0; const batchKey = `result-ingestion:${jobId}`;
  const { data: batch, error: batchError } = await supabaseAdmin.from("athlete_performance_import_batches").upsert({ import_key: batchKey, source_label: "Podium Watch Results Ingestion", source_type: "official", status: "started", requested_by: "Podium Watch Admin", options: { ingestion_job_id: jobId } }, { onConflict: "import_key" }).select("*").single(); if (batchError) throw batchError;
  for (const row of rows || []) {
    if (!row.event_code || !row.mark_text || !(row.sport || job.sport) || !(row.season_year || job.season_year)) throw error(`Approved row ${row.id} is missing an event, mark, sport, or season.`, 409, "INCOMPLETE_APPROVED_ROW");
    const sourceKey = `result:${row.result_fingerprint}`; const shape = performanceShape(row); const performance = { profile_id: row.matched_athlete_id, school_id: row.matched_school_id, sport: row.sport || job.sport, season_year: row.season_year || job.season_year, event_name: row.event_name, event_key: row.event_code, mark_text: row.mark_text, mark_value: row.mark_value, mark_sort_value: row.mark_value, mark_unit: shape.mark_unit, measurement_type: shape.measurement_type, sort_direction: shape.sort_direction, record_type: "race_result", meet_name: row.meet_name, meet_date: row.meet_date, place: row.place, grade: Number(row.athlete_grade) || null, wind_text: row.wind_text, source_key: sourceKey, source_label: "Official meet results", source_url: row.result_source_documents?.source_url || null, source_type: "official", verification_status: "source_linked", public_visible: false, import_batch_id: batch.id, result_status: "official_result", notes: `Imported from result ingestion job ${jobId}`, metadata: { ingestion_job_id: jobId, staging_row_id: row.id, provider: row.result_source_documents?.provider_key } };
    const { data: saved, error: saveError } = await supabaseAdmin.from("athlete_performances").upsert(performance, { onConflict: "source_key", ignoreDuplicates: true }).select("id").maybeSingle(); if (saveError) throw saveError;
    if (saved) { imported += 1; await supabaseAdmin.from("result_staging_rows").update({ review_status: "imported", imported_performance_id: saved.id, updated_at: new Date().toISOString() }).eq("id", row.id); } else duplicates += 1;
  }
  await supabaseAdmin.from("athlete_performance_import_batches").update({ status: "completed", completed_at: new Date().toISOString(), summary: { imported, duplicates } }).eq("id", batch.id); await supabaseAdmin.from("result_ingestion_jobs").update({ status: "imported", imported_at: new Date().toISOString(), import_batch_id: batch.id }).eq("id", jobId); await audit(jobId, "batch_imported", { imported, duplicates, batch_id: batch.id }); return { imported, duplicates, batch_id: batch.id };
}

export async function reverseImportedJob(jobId) {
  const { data: job, error: jobError } = await supabaseAdmin.from("result_ingestion_jobs").select("import_batch_id,status").eq("id", jobId).single(); if (jobError) throw jobError; if (!job.import_batch_id) throw error("This job has no imported batch to reverse.", 409, "NOT_IMPORTED");
  const reversedAt = new Date().toISOString(); const { data, error: performanceError } = await supabaseAdmin.from("athlete_performances").update({ archived_at: reversedAt, public_visible: false, notes: `Reversed from result ingestion job ${jobId}` }).eq("import_batch_id", job.import_batch_id).is("archived_at", null).select("id"); if (performanceError) throw performanceError;
  await supabaseAdmin.from("result_staging_rows").update({ review_status: "reversed", updated_at: reversedAt }).eq("job_id", jobId).eq("review_status", "imported"); await supabaseAdmin.from("result_ingestion_jobs").update({ status: "reversed", reversed_at: reversedAt }).eq("id", jobId); await audit(jobId, "batch_reversed", { performances_archived: data?.length || 0 }); return { reversed: data?.length || 0 };
}
