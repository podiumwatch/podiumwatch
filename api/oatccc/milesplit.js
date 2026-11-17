import { timingSafeEqual } from "node:crypto";
import { oatcccFlags } from "../../src/oatccc/config.mjs";
import { anonClient } from "../../lib/oatccc_verification.mjs";
import { selectAll } from "../../lib/supabase_paging.mjs";

// Private, unlisted CSV for MileSplit: the current verified schools for the
// Indoor State Meet, with tournament name, HyTek code and boys/girls
// division (Anjanette shares a live sheet with MileSplit today; this
// replaces it). Always current: every request reads the database.
//
// Address (vercel.json rewrite):
//   /oatccc/milesplit/<token>/verified-schools.csv
// <token> must equal the server setting OATCCC_MILESPLIT_CSV_TOKEN (at
// least 32 characters; Zachary sets it in Vercel when MileSplit confirms
// the format). Anything else is a 404, as is everything while
// OATCCC_VERIFICATION_LIVE is off or the token is not set.
//
// Never indexed (X-Robots-Tag), never cached by the CDN, no referrer.
// Reads the view oatccc_milesplit_export (install/102): approved, real
// (non-TEST) schools in the newest real season.
export const CSV_COLUMNS = ["School", "HyTek Code", "Boys Division", "Girls Division", "Boys Team", "Girls Team", "Verified"];

function notFound(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  return response.status(404).send("Not found.");
}

export function tokenMatches(given, expected) {
  if (!expected || expected.length < 32 || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// One CSV cell. Quotes when needed; a leading = + - @ is prefixed with '
// so a spreadsheet never runs it as a formula.
export function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) : "");

export function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push([
      row.tournament_name,
      row.hytek_code,
      row.boys_division,
      row.girls_division,
      row.has_boys_team ? "Yes" : "No",
      row.has_girls_team ? "Yes" : "No",
      day(row.verified_at)
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export default async function handler(request, response) {
  if (!oatcccFlags().verification) return notFound(response);
  if (!tokenMatches(String(request.query?.token || ""), String(process.env.OATCCC_MILESPLIT_CSV_TOKEN || "").trim())) return notFound(response);
  if (request.method !== "GET" && request.method !== "HEAD") return notFound(response);
  try {
    const client = anonClient();
    // Tournament names are unique (install/102), so that order is stable.
    const { data, error } = await selectAll(
      () => client.from("oatccc_milesplit_export").select("tournament_name, hytek_code, boys_division, girls_division, has_boys_team, has_girls_team, verified_at").order("tournament_name"),
      { orderColumn: null, maxRows: 5000 }
    );
    if (error) throw error;
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'inline; filename="oatccc-verified-schools.csv"');
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.setHeader("Referrer-Policy", "no-referrer");
    return response.status(200).send(toCsv(data || []));
  } catch {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    return response.status(500).send("The list could not be loaded. Please try again.");
  }
}
