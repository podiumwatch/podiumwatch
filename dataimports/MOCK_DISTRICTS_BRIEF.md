# Mock District Meets 2026: brief for Claude in VS Code

Paste this whole file into Claude in VS Code and put `district_meets_2026.json` in the repo (suggested: `data/district_meets_2026.json`).

## Goal
Add a "Mock Districts" section to podiumwatch.site. It projects every 2026 Ohio district cross country race (Saturday, Oct 24, 2026) and shows who would advance to regionals (Oct 31). It should work like the existing mock state / Mock Meet Monday feature, but run once per district race instead of once per division.

## Ground rules (same as always)
1. Inspect before editing. Start with a read only audit: find the existing mock meet code (scoring, data source, pages, components) and report back how it works and what you plan to reuse. Do not write code until I approve the plan.
2. Do not invent data. Every school, race, time and qualifier number comes from `district_meets_2026.json` or the site's existing database. If a school can't be matched, list it; don't guess.
3. No `git add .`, no destructive git commands, never edit `dist/` as source.
4. Do not push, deploy, run SQL, or import data without my explicit OK.
5. Windows PowerShell: use `npm.cmd` / `npx.cmd`.
6. Label everything as a projection ("Mock" / "Projected"), never as official results. Keep official facts (sites, times, qualifier counts) visually separate from projections.

## What the data file contains (as of Oct 19, 2026)
- `sites` (12): key, name, region, regional site, athletic.net meet id and URL, and `entered_schools` (the athletic.net team list for that site, 697 total, with the full school name where an abbreviation was expanded).
- `races` (71): site, gender, division (2, 3, 4), optional race label (Hilliard Darby splits some divisions into Race 1 / Race 2), start time, `teams_advance` (N), `individuals_advance` (2N), athletic.net division id.
- `rule`, `regional_by_region`, `region_totals`, `northeast_note`.

## Qualifying rule (implement exactly)
For each race:
1. Score the race with standard XC scoring (top 5 score, 6th and 7th displace, incomplete teams are not scored; their runners still count as individuals).
2. Top N teams by team place advance. All 7 varsity runners on those teams advance.
3. Then walk the individual finish order and take the first 2N runners who are NOT on a qualifying team.
4. Ties at the team cut: use the standard sixth runner tiebreaker and flag it on the page.

Division I has no districts in 2026 (D1 goes straight to regionals), so there are no D1 races here.

Regionals by region: Central, East, Southeast go to Pickerington; Northeast to Boardman; Northwest to Tiffin; Southwest to Troy.

## Known gaps to handle
1. **Northeast numbers:** GlenOak, Lorain County CC and Madison have `teams_advance` / `individuals_advance` = null until OHSAA posts them Oct 20. Show those races with "Qualifier numbers announced Oct 20" and no cut line. I will send the numbers to update the JSON.
2. **Division per school:** `entered_schools` is per site, not per race. Assign each school to its race using the division already stored in our database. Report any school that doesn't match or whose division doesn't have a race at that site.
3. **Hilliard Darby:** some divisions have two separate races (Race 1, Race 2). Each race is its own qualifying pool. Use the athletic.net division id to keep them apart; the race assignment per school comes from athletic.net, so if we don't have it, flag those schools rather than splitting them ourselves.
4. **Owens CC D2 times:** the NW doc lists 11:10; athletic.net lists girls 11:40, boys 12:20. The JSON uses athletic.net.

## Projection method
Use the same athlete and time basis the existing mock state meet uses (season best on comparable courses, whatever the current code does). Each team's top 7 by that basis. Tell me in the audit exactly what basis that is and what date the data is current through, and show that as-of date on the page.

## Pages
1. `/mock-districts`: hub. Grouped by region, one card per site with race count, start of first race, and regional destination.
2. `/mock-districts/[site]`: one section per race in start-time order. Each race shows:
   - Header: gender, division, race label, start time, "N teams + 2N individuals advance".
   - Projected team scores with a REGIONAL CUT LINE after team N and the next 2 teams shown dimmed.
   - Projected individual top 32, with a TEAM or IND tag on anyone advancing.
   - Projected individual qualifiers list (2N names; can go past 32nd).
3. Filters: gender and division.
4. Brand: boys green #0FAF68, girls pink #EC4899, school colors and logos from our existing school records.

## After Saturday
Plan for an "Official" toggle per race: when real results are imported, the same page shows actual qualifiers using the same rule, and the projection stays viewable for comparison. Don't build the import yet; just keep the data model ready for it.

## First reply I want from you
A short audit: where mock meet logic lives, how it projects, what tables/files it reads, how schools map to divisions, and your file by file plan for this feature. No code changes yet.
