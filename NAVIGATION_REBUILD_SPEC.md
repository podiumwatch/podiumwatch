# Podium Watch — site header & navigation rebuild

## Goal
Replace the current two-row header (main nav + Explore bar) with a single consolidated nav built on dropdowns, prioritizing mobile usability. This collapses ~20 flat links down to 7 grouped dropdowns on the left plus a 5-item utility cluster on the right, and eliminates the second row entirely.

## Current state (before)
- **Row 1 (ticker):** LIVE badge, "Ohio XC season", "Practice underway statewide", "First meets August 22", "View calendar →"
- **Row 2 (main nav):** Home, Rankings, Meets, Teams, Race Command Center (existing dropdown: Coach Sign In, Enter Race Day Code), Ohio Schools, Fan Poll, Athletes, Recruiting, Pace Calculator, Stories, Search, Watch, Instagram
- **Row 3 (Explore bar):** Boys XC, Girls XC, Track and Field, Fan Poll, Tournament Hub, Athlete of the Week, Team of the Week, About

**Known bug to fix regardless of the rebuild:** Fan Poll currently appears in both Row 2 and Row 3.

## New information architecture

### Left content nav (7 groups, single row)
1. **Home** — direct link, no dropdown
2. **Rankings ▾**
   - Cross Country
   - Indoor Track
   - Outdoor Track
3. **Meets ▾**
   - Meet Calendar (was: Meets)
   - Tournament Hub
4. **Teams & Schools ▾**
   - Teams
   - Ohio Schools
5. **Athletes ▾**
   - Athletes
   - Recruiting
6. **Voting ▾**
   - Team of the Week
   - Athlete of the Week
   - Fan Poll
7. **More ▾**
   - Stories
   - About

### Right utility cluster (5 elements — styled distinctly from the content nav, since these are tools/actions, not browsing)
- **Search** — icon, opens existing search overlay/page, behavior unchanged
- **Pace Calculator** — direct link to `/pace-calculator`, outline-style button with calculator icon, no dropdown
- **Race Command Center ▾** — existing dropdown, do not rebuild its logic, only restyle/reposition. Accent green button. Contains: Coach Sign In, Enter Race Day Code
- **Watch** — outline-style button, link unchanged
- **Instagram** — icon link, unchanged

## Interaction behavior

### Desktop (≥768px — confirm actual breakpoint against existing CSS)
- Dropdowns toggle on click (not hover-only, for keyboard/accessibility support); hover-to-preview is fine as a progressive enhancement on top of click
- Only one dropdown open at a time — opening a new one closes any other
- Each trigger needs `aria-expanded="true/false"` and `aria-haspopup="true"`
- Dropdown closes on outside click, Escape, or link selection
- Ticker bar (Row 1) is unchanged at this width

### Mobile (<768px)
- Row 2 and Row 3 both disappear — replaced entirely by a hamburger icon
- Mobile header shows only: logo | search icon | hamburger icon
- Ticker bar truncates to a single line (e.g. "Ohio XC season · Practice underway statewide", ellipsis on overflow); the whole line links to the calendar, dropping the separate "View calendar" link at this width to save space
- Hamburger opens a full-height slide-in drawer
- Drawer content, top to bottom:
  1. Home — flat link
  2. Rankings, Meets, Teams & Schools, Athletes, Voting, More — each an accordion row, tap to expand sub-links in place
  3. Only one accordion section open at a time
  4. Divider
  5. Race Command Center — pinned below the accordion (not part of it), green accent block, itself expands on tap to show Coach Sign In / Enter Race Day Code
  6. Pace Calculator — pinned directly below Race Command Center, outline-style row, direct link
  7. Watch / Instagram — pinned at the bottom as a two-up row
- Drawer closes on: X tap, outside tap, or Escape
- Focus trap while open; focus returns to the hamburger button on close
- Minimum tap target height: 44px per row (48px preferred)

## Visual styling
Use existing brand tokens from `src/styles/main.css` — no new colors.
- Background: `BLACK #090909`
- Text: `CREAM #f6f4ee`; muted text: `MUTED #626262`
- Accent (Race Command Center button, active-page underline, dropdown carets): `GREEN #0faf68`, hover `GREEN_DARK #08784a`, text-on-green `GREEN_INK #063d28`
- This is gender-neutral site chrome — keep it green throughout even on girls-section pages; the pink ramp stays scoped to girls content, not the header
- Nav fonts: check current CSS and keep whatever's already in use for nav labels — this task is layout/behavior, not a type change

## Technical notes
- Windows/PowerShell environment — use `npm.cmd` / `npx.cmd` for any package commands
- Static site generator on Vercel via GitHub auto-deploy — this is a header/nav component + CSS + a small amount of vanilla JS for dropdown/accordion state, no routing changes needed
- `git push` and any `vercel` commands require explicit approval per `.claude/settings.json` — do not push without asking first
- Locate the existing header/nav component before writing anything new — search the repo for the current markup (likely a `Header`/`Nav` component or template)
- Preserve the existing Race Command Center dropdown logic as-is — only restyle and reposition it
- Fix the Fan Poll duplication as part of this pass — it should exist exactly once, under Voting

## Acceptance checklist
- [x] Fan Poll appears exactly once (under Voting)
- [x] All 7 left-nav dropdowns open/close correctly on desktop via click, and close on outside click / Escape
- [x] Pace Calculator and Race Command Center are visible in the right utility cluster on desktop, not nested in a dropdown
- [x] On mobile, main nav + Explore bar are fully replaced by hamburger + drawer
- [x] Mobile drawer accordions allow only one section open at a time
- [x] Race Command Center and Pace Calculator are pinned and visible in the drawer without expanding any accordion
- [x] All interactive elements have correct aria attributes and are keyboard-navigable
- [x] Tap targets are at least 44px tall on mobile
- [x] No regressions to the ticker bar's live/season info on desktop
- [x] Tested at 375px, 768px, and 1280px+ breakpoints

**Implementation notes (2026-08-21):** Two deliberate deviations from this spec, both explicitly invited by the spec's own text -- see docs/DECISIONS.md's "Full navigation rebuild" entry for the full reasoning:
1. Breakpoint is 1320px throughout (not 768px), matching the breakpoint this codebase already used everywhere else. The spec itself said "confirm actual breakpoint against existing CSS" -- this is that confirmation. At 1280px specifically, mobile/hamburger behavior correctly applies as a result (confirmed directly), which is expected given this choice.
2. Rankings' dropdown items are "Cross Country" / "Track and Field," not "Cross Country / Indoor Track / Outdoor Track" -- confirmed directly against scripts/build.mjs that no indoor/outdoor ranking split exists anywhere on this site; only two ranking pages are real.

## Suggested Claude Code kickoff prompt
```
Read NAVIGATION_REBUILD_SPEC.md in this repo. Find the current header/nav
component first and show me what it looks like before changing anything.
Then implement the new IA and mobile drawer behavior exactly as specified,
using the existing brand CSS variables. Don't touch the Race Command
Center dropdown's internal logic — only its position and styling. Don't
run git push or any vercel command without asking me first.
```
