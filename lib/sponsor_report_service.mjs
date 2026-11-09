import { loadSiteSponsors } from "./site_sponsors.mjs";
import { selectAll } from "./supabase_paging.mjs";

// Sponsor Report (WO-25): per sponsor placement, per month, impressions
// (page views of the pages carrying the placement, from the page_view
// events every public page records), clicks (site_sponsor_clicks),
// click rate and top pages. Bots are left out of clicks. Nothing is
// estimated: a month with no data shows zeros.

export function monthRange(month) {
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`, start: start.toISOString(), end: end.toISOString() };
}

// Pure: tally page views per path for one placement's path prefixes.
export function summarizePlacement(placement, viewRows, clickRows) {
  const byPath = new Map();
  for (const row of viewRows) {
    const path = String(row.content_id || "");
    if (!(placement.paths || []).some((prefix) => path.startsWith(prefix))) continue;
    byPath.set(path, (byPath.get(path) || 0) + 1);
  }
  const impressions = [...byPath.values()].reduce((sum, value) => sum + value, 0);
  const clicks = clickRows.filter((row) => row.placement_id === placement.id && row.device_class !== "bot").length;
  return {
    impressions,
    clicks,
    click_rate: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    top_pages: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, views]) => ({ path, views }))
  };
}

export async function sponsorReport({ month } = {}) {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  const range = monthRange(month);
  const sponsors = loadSiteSponsors();
  const prefixes = sponsors.flatMap((sponsor) => (sponsor.placements || []).flatMap((placement) => placement.paths || []));

  const views = [];
  for (const prefix of [...new Set(prefixes)]) {
    const { data, error } = await selectAll(() => supabaseAdmin
      .from("team_analytics_events")
      .select("id, content_id")
      .eq("event_type", "page_view")
      .like("content_id", `${prefix}%`)
      .gte("created_at", range.start)
      .lt("created_at", range.end), { maxRows: 500000 });
    if (error) throw error;
    views.push(...(data || []));
  }
  const uniqueViews = [...new Map(views.map((row) => [row.id, row])).values()];

  let clickRows = [];
  let clicksAvailable = true;
  const clicks = await selectAll(() => supabaseAdmin
    .from("site_sponsor_clicks")
    .select("id, sponsor_id, placement_id, page_path, device_class")
    .gte("clicked_at", range.start)
    .lt("clicked_at", range.end), { maxRows: 500000 });
  if (clicks.error) {
    if (!/site_sponsor_clicks/.test(String(clicks.error.message || ""))) throw clicks.error;
    clicksAvailable = false;
  } else {
    clickRows = clicks.data || [];
  }

  return {
    month: range.month,
    clicks_available: clicksAvailable,
    rows: sponsors.flatMap((sponsor) => (sponsor.placements || []).map((placement) => ({
      sponsor_id: sponsor.id,
      sponsor_name: sponsor.name,
      placement_id: placement.id,
      placement_label: placement.label,
      has_link: Boolean(sponsor.url),
      ...summarizePlacement(placement, uniqueViews, clickRows.filter((row) => row.sponsor_id === sponsor.id))
    })))
  };
}

export function sponsorReportCsv(report) {
  const cell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [["month", "sponsor", "placement", "impressions", "clicks", "click_rate_percent", "top_pages"].join(",")];
  for (const row of report.rows) {
    lines.push([report.month, row.sponsor_name, row.placement_label, row.impressions, row.has_link ? row.clicks : "no link", row.has_link ? row.click_rate : "", row.top_pages.map((page) => `${page.path} (${page.views})`).join(" | ")].map(cell).join(","));
  }
  return lines.join("\n") + "\n";
}
