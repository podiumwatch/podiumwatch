import { createHmac } from "node:crypto";

// "Partner with Podium Watch" (WO-26). Schema: install/86_PARTNER_PAGE.sql.
// Packages are fixed here; their prices and whether each is offered are
// set by Zachary at /admin/partner-page/, never hard-coded. Site audience
// numbers come from the page_view events every public page records, and
// are only shown once there are 30 full days of them, so a sponsor never
// sees a misleading partial month.

export const PARTNER_PACKAGES = [
  { id: "rankings", name: "Rankings presenting partner", description: "\"Presented by\" on the weekly rankings, every division, boys and girls." },
  { id: "leaders", name: "Top 10 and leaders partner", description: "Your name on Top 10 by class and the State Leaders lists." },
  { id: "meet-day", name: "Meet-day hub partner", description: "On the live meet page for one meet or a whole postseason, where families follow results." },
  { id: "school", name: "School page partner", description: "A local business on one school's team page for a full season." },
  { id: "newsletter", name: "Newsletter partner", description: "The one sponsor slot in The Podium Watch Weekly email." },
  { id: "awards", name: "Awards partner", description: "Presenting partner of the Athletes, Teams and Coaches of the Year." }
];

const MIN_DAYS_OF_DATA = 30;
// page-view.js only went on every page on 2026-11-09 (before that, 8 page
// types), so a 30-day window counts only from then: earlier totals would
// understate the real audience.
const SITEWIDE_PAGE_VIEWS_SINCE = "2026-11-09T15:00:00Z";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function db() {
  const { supabaseAdmin } = await import("./supabase-admin.mjs");
  return supabaseAdmin;
}

function cleanLine(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function loadSettings(supabase) {
  const { data, error } = await supabase.from("partner_page_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { packages: {} };
}

// Pure: the public view of each package (offered ones only, with price
// text when set).
export function publicPackages(settingsPackages = {}) {
  return PARTNER_PACKAGES
    .map((item) => ({ ...item, offered: settingsPackages[item.id]?.offered !== false, price: cleanLine(settingsPackages[item.id]?.price, 80) || null }))
    .filter((item) => item.offered);
}

export async function audienceNumbers({ now = new Date() } = {}) {
  const supabase = await db();
  const { selectAll } = await import("./supabase_paging.mjs");
  const { data: first, error: firstError } = await supabase.from("team_analytics_events").select("created_at").eq("event_type", "page_view").order("created_at", { ascending: true }).limit(1);
  if (firstError) throw firstError;
  const since = new Date(now.getTime() - MIN_DAYS_OF_DATA * 86400000);
  const countingFrom = first?.length ? new Date(Math.max(new Date(first[0].created_at).getTime(), new Date(SITEWIDE_PAGE_VIEWS_SINCE).getTime())) : null;
  if (!countingFrom || countingFrom > since) {
    return { available: false, days_of_data: countingFrom ? Math.max(0, Math.floor((now.getTime() - countingFrom.getTime()) / 86400000)) : 0 };
  }
  const { data, error } = await selectAll(() => supabase.from("team_analytics_events").select("id, visitor_id").eq("event_type", "page_view").gte("created_at", since.toISOString()), { maxRows: 2000000 });
  if (error) throw error;
  const visitors = new Set((data || []).map((row) => row.visitor_id).filter(Boolean)).size;
  return { available: true, window_days: MIN_DAYS_OF_DATA, page_views: (data || []).length, visitors };
}

export async function publicPartnerData() {
  const supabase = await db();
  const settings = await loadSettings(supabase);
  return {
    instagram: settings.instagram_followers || settings.instagram_monthly_reach
      ? { followers: settings.instagram_followers || null, monthly_reach: settings.instagram_monthly_reach || null, as_of: settings.instagram_as_of || null }
      : null,
    audience: await audienceNumbers(),
    packages: publicPackages(settings.packages)
  };
}

export async function adminPartnerData() {
  const supabase = await db();
  const settings = await loadSettings(supabase);
  const { data: inquiries, error } = await supabase.from("partner_inquiries").select("id, created_at, name, organization, email, package, message, status").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return { settings, packages: PARTNER_PACKAGES, inquiries: inquiries || [] };
}

export async function savePartnerSettings(body) {
  const supabase = await db();
  const whole = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(String(value).replace(/,/g, ""));
    if (!Number.isInteger(n) || n < 0) throw fail("Instagram numbers must be whole numbers.");
    return n;
  };
  const packages = {};
  for (const item of PARTNER_PACKAGES) {
    const input = body.packages?.[item.id] || {};
    packages[item.id] = { offered: input.offered !== false, price: cleanLine(input.price, 80) || null };
  }
  const asOf = cleanLine(body.instagram_as_of, 10);
  if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw fail("Use a real date for the Instagram numbers.");
  const { data, error } = await supabase.from("partner_page_settings").upsert({
    id: 1,
    updated_at: new Date().toISOString(),
    instagram_followers: whole(body.instagram_followers),
    instagram_monthly_reach: whole(body.instagram_monthly_reach),
    instagram_as_of: asOf || null,
    packages
  }).select("*").single();
  if (error) throw error;
  return { settings: data };
}

export async function setInquiryStatus({ id, status }) {
  if (!["new", "replied", "closed"].includes(status)) throw fail("Choose a status.");
  const supabase = await db();
  const { error } = await supabase.from("partner_inquiries").update({ status }).eq("id", String(id || ""));
  if (error) throw error;
  return { id, status };
}

// Pure: validates one inquiry. Unit tested.
export function validateInquiry(body) {
  const name = cleanLine(body.name, 120);
  const email = cleanLine(body.email, 254).toLowerCase();
  if (!name) throw fail("Enter your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail("Enter a real email address so we can reply.");
  const packageId = cleanLine(body.package, 80);
  const known = PARTNER_PACKAGES.find((item) => item.id === packageId);
  return {
    name,
    email,
    organization: cleanLine(body.organization, 160) || null,
    package: known ? known.name : packageId === "other" ? "Something else" : null,
    message: cleanLine(body.message, 2000) || null
  };
}

export async function submitInquiry({ body, address, siteUrl, contactEmail }) {
  const row = validateInquiry(body);
  const secret = process.env.VOTE_HASH_SECRET || "partner-inquiries";
  const ipHash = createHmac("sha256", secret).update(`partner:${address || "unknown"}`).digest("hex");
  const supabase = await db();
  const since = new Date(Date.now() - 3600000).toISOString();
  const { count, error: countError } = await supabase.from("partner_inquiries").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if (countError) throw countError;
  if ((count || 0) >= 3) throw fail("Thanks, we already have your message. Email us directly if it's urgent.", 429);
  const { error } = await supabase.from("partner_inquiries").insert({ ...row, ip_hash: ipHash });
  if (error) throw error;

  let emailed = false;
  try {
    const { sendResendEmail, escapeHtml } = await import("./engagement_service.mjs");
    const lines = [`Name: ${row.name}`, `Organization: ${row.organization || ""}`, `Email: ${row.email}`, `Package: ${row.package || "Not chosen"}`, "", row.message || ""];
    await sendResendEmail({
      to: contactEmail,
      subject: `Partner inquiry: ${row.organization || row.name}`,
      text: `${lines.join("\n")}\n\n${siteUrl}/admin/partner-page/`,
      html: `<div style="font-family:Arial,sans-serif">${lines.map((line) => `<p style="margin:4px 0">${escapeHtml(line)}</p>`).join("")}<p><a href="${escapeHtml(siteUrl)}/admin/partner-page/">Open in admin</a></p></div>`
    });
    emailed = true;
  } catch (emailError) {
    console.error("Partner inquiry email failed:", emailError);
  }
  return { received: true, emailed };
}
