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

export function leadRuns(leads, now = new Date()) {
  const nowMs = time(now);
  const active = (leads || []).filter((lead) => lead.status !== "cancelled").sort((a, b) => time(a.starts_at) - time(b.starts_at));
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
  return (leads || []).filter((lead) => lead.status !== "cancelled" && time(lead.starts_at) > nowMs).sort((a, b) => time(a.starts_at) - time(b.starts_at));
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
