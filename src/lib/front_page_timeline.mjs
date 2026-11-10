// Front page lead timeline (WO-43). Pure, so the homepage API, the
// archive, story date lines and tests all agree on what ran when.
//
// Rule: one lead at a time. At any moment the lead is the scheduled
// (not cancelled) lead with the latest start that has started and has
// not ended. A lead's real run is therefore its start until the earliest
// of: its own end, the start of the next lead (a later start takes over),
// or now if it is still running. A lead that never got to run (a later
// lead started first and outlasted it) has no run.

const time = (value) => (value ? new Date(value).getTime() : null);
// slot: "lead" (default; rows from before install/92 have none) or "also"
// (a story an admin placed under "Also on the front page").
export const ALSO_MAX = 4;
const slotOf = (row) => (row?.slot === "also" ? "also" : "lead");

export function leadRuns(leads, now = new Date()) {
  const nowMs = time(now);
  const active = (leads || []).filter((lead) => lead.status !== "cancelled" && slotOf(lead) === "lead").sort((a, b) => time(a.starts_at) - time(b.starts_at));
  const runs = [];
  // Walk forward through time: at each change point, find who leads.
  const points = [...new Set(active.flatMap((lead) => [time(lead.starts_at), time(lead.ends_at)]).filter((t) => t !== null && t <= nowMs))].sort((a, b) => a - b);
  const leaderAt = (t) => active.filter((lead) => time(lead.starts_at) <= t && (lead.ends_at === null || lead.ends_at === undefined || time(lead.ends_at) > t)).sort((a, b) => time(b.starts_at) - time(a.starts_at))[0] || null;
  let current = null;
  for (let i = 0; i < points.length; i += 1) {
    const leader = leaderAt(points[i]);
    if (current && (!leader || leader.id !== current.lead.id)) { current.end = points[i]; runs.push(current); current = null; }
    if (leader && !current) current = { lead: leader, start: points[i], end: null };
  }
  if (current) { current.end = null; runs.push(current); } // still running
  return runs.map((run) => ({ lead: run.lead, startsAt: new Date(run.start).toISOString(), endsAt: run.end === null ? null : new Date(run.end).toISOString(), current: run.end === null }));
}

export function currentLead(leads, now = new Date()) {
  const runs = leadRuns(leads, now);
  const last = runs[runs.length - 1];
  return last && last.current ? last.lead : null;
}

// Scheduled leads that have not started yet, soonest first.
export function queuedLeads(leads, now = new Date()) {
  const nowMs = time(now);
  return (leads || []).filter((lead) => lead.status !== "cancelled" && slotOf(lead) === "lead" && time(lead.starts_at) > nowMs).sort((a, b) => time(a.starts_at) - time(b.starts_at));
}

// "Also on the front page" picks run side by side (no takeover): each runs
// from its start to its end, or to now while it is still up.
export function alsoRuns(leads, now = new Date()) {
  const nowMs = time(now);
  return (leads || [])
    .filter((row) => row.status !== "cancelled" && slotOf(row) === "also" && time(row.starts_at) <= nowMs)
    .map((row) => {
      const ended = row.ends_at && time(row.ends_at) <= nowMs;
      return { lead: row, startsAt: new Date(time(row.starts_at)).toISOString(), endsAt: ended ? new Date(time(row.ends_at)).toISOString() : null, current: !ended };
    })
    .sort((a, b) => time(a.startsAt) - time(b.startsAt));
}

// The picks up now, in their set order (at most ALSO_MAX). Empty means the
// homepage uses its automatic rule.
export function currentAlso(leads, now = new Date()) {
  return alsoRuns(leads, now).filter((run) => run.current).map((run) => run.lead)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || time(a.starts_at) - time(b.starts_at))
    .slice(0, ALSO_MAX);
}

// Every time any story was on the front page (lead or "also"), oldest first.
export function allFrontPageRuns(leads, now = new Date()) {
  return [...leadRuns(leads, now).map((run) => ({ ...run, slot: "lead" })), ...alsoRuns(leads, now).map((run) => ({ ...run, slot: "also" }))]
    .sort((a, b) => time(a.startsAt) - time(b.startsAt));
}

// "Nov 9 to Nov 11, 2026", "Nov 9, 2026" (one day), "Nov 9, 2026 to now".
// Dates are Eastern, since that is when Ohio readers saw the page.
const dayParts = (iso) => {
  const d = new Date(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).formatToParts(d).map((p) => [p.type, p.value]));
  return { month: parts.month, day: parts.day, year: parts.year };
};
export function runLabel(run) {
  const a = dayParts(run.startsAt);
  if (!run.endsAt) return `${a.month} ${a.day}, ${a.year} to now`;
  const b = dayParts(run.endsAt);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return `${a.month} ${a.day}, ${a.year}`;
  if (a.year === b.year) return `${a.month} ${a.day} to ${b.month} ${b.day}, ${b.year}`;
  return `${a.month} ${a.day}, ${a.year} to ${b.month} ${b.day}, ${b.year}`;
}
