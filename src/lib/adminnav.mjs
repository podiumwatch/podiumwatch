// The single source of truth for every Podium Watch admin tool: what it's
// called, where it lives, and which group it belongs to in the persistent
// admin sidebar (see src/lib/adminshell.mjs). Mirrors the existing
// PODIUM_TOOLS pattern in src/lib/tools.mjs -- one shared list rendered in
// several places instead of every page hand-maintaining its own copy of
// "related tool" links (the exact duplication this file replaces: before
// this, each admin page hand-picked 2-3 back-links to other tools, a
// different, inconsistent set per file).
//
// Zero imports on purpose: this file is read at build time by
// src/pages/*.mjs and scripts/build.mjs, AND its data is mirrored to the
// browser (adminNavClientPayload(), embedded by adminshell.mjs) for the
// quick-jump search and badge rendering -- keeping it import-free avoids
// any risk of pulling server-only code into that client payload.
//
// `mark` is a 2-letter Impact-font square, the same visual primitive as
// the existing .empty-state-mark "PW" badge (src/lib/html.mjs
// emptyState(), src/styles/main.css .empty-state-mark) at a smaller
// size -- not an emoji (the site has none, anywhere) and not a bespoke
// SVG per tool (16 hand-drawn icons is real design effort for tools an
// admin already recognizes by name).
export const ADMIN_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/admin/", mark: "PW", description: "Sign in, needs-attention tasks, and stats.", keywords: "home landing needs attention tasks summary" },
      { id: "operations", label: "Operations Center", href: "/admin/operations/", mark: "OC", description: "Full task list, meets, teams, content, athletes, awards.", keywords: "tasks queue todo checklist priority" }
    ]
  },
  {
    id: "meets",
    label: "Meets & Tournament",
    items: [
      { id: "meets", label: "Meet Manager", href: "/admin/meets/", mark: "MM", description: "Create, edit, and bulk-import meets.", keywords: "create edit meets calendar csv import bulk" },
      { id: "results-sources", label: "Results Source Manager", href: "/admin/results-sources/", mark: "RS", description: "Discovered result documents and import sources.", keywords: "baumspage crawler results source import" },
      { id: "path-to-state", label: "Path to State", href: "/admin/path-to-state/", mark: "PS", description: "OHSAA tournament advancement per team.", keywords: "ohsaa tournament district regional state advancement" }
    ]
  },
  {
    id: "teams",
    label: "Teams",
    items: [
      { id: "team-manager", label: "Team Manager", href: "/admin/team-manager/", mark: "TM", description: "Claims, reports, and team page settings.", keywords: "claims reports coach access members" },
      { id: "team-rosters", label: "Team Rosters", href: "/admin/team-rosters/", mark: "TR", description: "Season archives, athlete links, roster imports.", keywords: "roster season archive import athlete link" },
      { id: "team-schedules", label: "Team Schedules", href: "/admin/team-schedules/", mark: "TS", description: "Meet-to-team schedule connections and requests.", keywords: "schedule connect meet request" },
      { id: "team-content", label: "Team Content", href: "/admin/team-content/", mark: "TC", description: "Team page draft content review.", keywords: "content draft review publish team page" },
      { id: "team-instagram", label: "Team Instagram Changes", href: "/admin/team-instagram/", mark: "IG", description: "Submitted Instagram handle changes.", keywords: "instagram handle social submission" },
      { id: "teams-import", label: "Bulk Team Import", href: "/admin/teams/", mark: "BI", description: "Bulk-create or update team pages.", keywords: "bulk import teams csv create" }
    ]
  },
  {
    id: "athletes",
    label: "Athletes",
    items: [
      { id: "athletes", label: "Athlete Data Center", href: "/admin/athletes/", mark: "AD", description: "Athlete profiles, performances, corrections.", keywords: "athlete profile performance correction foundation" },
      { id: "recruiting", label: "Recruit Ratings", href: "/admin/recruiting/", mark: "RR", description: "Recruit Ratings and performance imports.", keywords: "recruiting rating star import performance" }
    ]
  },
  {
    id: "statewide",
    label: "Statewide Data",
    items: [
      { id: "statewide-data", label: "Statewide Data Center", href: "/admin/statewide-data/", mark: "SW", description: "The official Ohio school foundation dataset.", keywords: "ohio schools foundation division statewide official" }
    ]
  },
  {
    id: "audience",
    label: "Audience",
    items: [
      { id: "fan-poll", label: "Fan Poll", href: "/admin/fan-poll/", mark: "FP", description: "Weekly fan poll weeks and ballots.", keywords: "fan poll vote ballot week division" },
      { id: "engagement", label: "Engagement Center", href: "/admin/engagement/", mark: "EC", description: "Follows, notifications, sponsor performance.", keywords: "engagement notifications sponsors subscribers analytics" },
      { id: "photographers", label: "Photographer Network", href: "/admin/photographers/", mark: "PN", description: "Review, approve, and manage photographer listings.", keywords: "photographer network directory listing approve sports service area portfolio" }
    ]
  }
];

export function adminNavItems() {
  return ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label, groupId: group.id })));
}

// Exact match first (the common case -- every admin page's own pathname is
// one of these hrefs exactly), then longest-prefix match as a fallback for
// any future sub-route (e.g. a detail page nested under a tool).
export function findAdminNavItem(pathname) {
  const items = adminNavItems();
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;

  return items
    .filter((item) => pathname.startsWith(item.href))
    .sort((first, second) => second.href.length - first.href.length)[0] || null;
}

// What actually gets embedded into the page for the browser (quick-jump
// search + badge rendering). Same shape as ADMIN_NAV_GROUPS today, but
// kept as its own function rather than exporting the constant directly so
// a build-only field could be added later without a client-payload audit.
export function adminNavClientPayload() {
  return { groups: ADMIN_NAV_GROUPS };
}
