import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal"
]);

const SUPPORTED_HOSTS = [
  "ohsaa.org",
  "milesplit.com",
  "baumspage.com",
  "finishtiming.com"
];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
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

function textFromHtml(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function largestHtmlTableToCsv(html) {
  const tables = String(html).match(/<table\b[\s\S]*?<\/table>/gi) || [];
  const candidates = tables.map((table) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    return { rows, size: rows.length };
  }).sort((a, b) => b.size - a.size);

  if (!candidates[0] || candidates[0].size < 2) {
    fail("This page did not expose a readable results table. Upload the official file or save the results page as HTML and upload it.", 422);
  }

  return candidates[0].rows.map((row) => {
    const cells = row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) || [];
    return cells.map((cell) => csvCell(textFromHtml(cell))).join(",");
  }).filter(Boolean).join("\n");
}

function validatePublicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") fail("Official results links must use HTTPS.");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || isIP(host)) {
    fail("That results address is not allowed.");
  }
  if (host === "athletic.net" || host.endsWith(".athletic.net")) {
    fail("Direct Athletic.net importing is disabled. Use the original timing company file or link, or obtain written permission from Athletic.net.", 422);
  }
  if (!SUPPORTED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    fail("That source is not supported yet. Upload its official CSV, TXT, or saved HTML file instead.", 422);
  }
  return url;
}

async function fetchWithSafeRedirects(initialUrl, options) {
  let url = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, { ...options, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) fail("The results source returned an invalid redirect.", 422);
    url = validatePublicUrl(new URL(location, url).href);
  }
  fail("The results source redirected too many times.", 422);
}

export async function loadOfficialResultsLink(value) {
  const url = validatePublicUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/csv,text/plain;q=0.9",
        "User-Agent": "PodiumWatchResultsImporter/1.0"
      }
    });
    if (!response.ok) {
      fail(`The official source returned ${response.status}. Upload its results file instead.`, 422);
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > 8 * 1024 * 1024) fail("That results page is larger than 8 MB.", 413);
    const text = await response.text();
    if (text.length > 8 * 1024 * 1024) fail("That results page is larger than 8 MB.", 413);

    const type = response.headers.get("content-type") || "";
    const csvData = /text\/(?:csv|plain)/i.test(type)
      ? text
      : largestHtmlTableToCsv(text);

    return {
      csv_data: csvData,
      source_url: url.href,
      source_label: `Official results from ${url.hostname}`
    };
  } catch (error) {
    if (error?.status) throw error;
    fail("Podium Watch could not read that results link. Upload the official CSV, TXT, or saved HTML file instead.", 422);
  } finally {
    clearTimeout(timer);
  }
}
