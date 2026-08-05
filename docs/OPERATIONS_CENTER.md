# Podium Watch Operations Center

## Purpose

The Operations Center is the private daily command center for Podium Watch.

It combines the most important work from meets, teams, weekly awards, team content, engagement, notifications, analytics, and sponsors into one secure page.

## Route

```text
/admin/operations/
```

## Main sections

1. Overview
2. Meets
3. Teams
4. Content
5. System

## Overview

The Overview section shows:

1. Open tasks sorted by urgency
2. Meets happening during the next seven days
3. Athlete of the Week status
4. Team of the Week status
5. Static website content totals
6. Quick links to every major management tool

## Meet workflow

The Meet section identifies:

1. Recent published meets missing results
2. Upcoming meet pages missing useful visitor information
3. Draft meet pages
4. The next scheduled meets

A meet is considered to have results when it has an official results link, Athletic.net link, or MileSplit link.

## Team workflow

The Team section identifies:

1. Pending team claim requests
2. Open or reviewing team reports
3. Pending or reviewing schedule requests
4. Team profiles below 65 percent completion
5. Published, verified, claimed, unclaimed, and suspended profile totals

Team completion uses the same weighted profile fields as the Team Manager.

## Content workflow

The Content section shows:

1. Team content drafts
2. Published team content totals
3. Published story totals
4. Ranking file totals
5. Rankings older than the current 21 day freshness review window

The ranking freshness notice is an editorial reminder. It does not automatically change or remove a ranking.

## System workflow

The System section shows whether existing environment variables are configured without displaying their values.

It also shows whether each optional Supabase feature loaded successfully.

A missing optional table does not prevent the rest of the Operations Center from loading.

## Security

1. The page is private and marked noindex.
2. The API requires the signed Podium Watch admin session cookie.
3. Secret values are never returned.
4. The dashboard only reports whether required environment variables exist.
5. The Operations Center does not write to the database.

## Database changes

No new SQL migration is required.

The Operations Center reads the tables already used by the existing Podium Watch systems.

## Testing

Run:

```powershell
npm.cmd run build
npm.cmd run check
npx.cmd vercel dev
```

Then open:

```text
http://localhost:3000/admin/operations/
```

Manual review should cover:

1. Admin sign in
2. Refresh button
3. Seven, thirty, and ninety day analytics selections
4. Every tab
5. Empty states
6. Links to management tools
7. Mobile layout
8. Optional feature behavior when a table has not been installed
