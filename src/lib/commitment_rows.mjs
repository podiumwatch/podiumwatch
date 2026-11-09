// One commitment row, shared by the server render (src/pages/commitments.mjs)
// and the browser filter (public/scripts/commitments.js loads the same
// markup through the JSON embedded in the page), so both always match.

export const COMMITMENT_CLASSES = [2027, 2028, 2029];
export const LEVEL_ORDER = ["NCAA I", "NCAA II", "NCAA III", "NAIA", "NJCAA", "Other", "Level not listed"];

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function eventLabel(value) {
  return ({ cross_country: "Cross country", track_and_field: "Track and field", distance: "Distance", sprints: "Sprints", jumps: "Jumps", throws: "Throws" })[value] || String(value || "").replace(/_/g, " ");
}

function shortDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function commitmentRowHtml(row) {
  return `<li class="cm-row${row.gender === "girls" ? " is-girls" : ""}" data-id="${escapeHtml(row.id)}" data-level="${escapeHtml(row.level)}" data-event="${escapeHtml(row.event_group || "")}">
      <div><b><a href="/athletes/${encodeURIComponent(row.athlete_slug)}/">${escapeHtml(row.athlete_name)}</a></b><br><small>${escapeHtml(row.school_name || "")}</small></div>
      <div class="cm-college">${row.type === "signing" ? "Signed with" : "Committed to"} ${escapeHtml(row.college)}</div>
      <div class="cm-meta"><span>${escapeHtml(row.level)}</span>${row.event_group ? `<span>${escapeHtml(eventLabel(row.event_group))}</span>` : ""}${row.announced_on ? `<span>${escapeHtml(shortDate(row.announced_on))}</span>` : ""}<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener noreferrer">Source: ${escapeHtml(row.source_label || "announcement")}</a><span data-cm-admin hidden></span></div>
    </li>`;
}

export function filterOptionsHtml(rows) {
  const levels = LEVEL_ORDER.filter((level) => rows.some((row) => row.level === level));
  const events = [...new Set(rows.map((row) => row.event_group).filter(Boolean))];
  return {
    levels: `<option value="">All levels</option>${levels.map((level) => `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`).join("")}`,
    events: `<option value="">All</option>${events.map((event) => `<option value="${escapeHtml(event)}">${escapeHtml(eventLabel(event))}</option>`).join("")}`
  };
}
