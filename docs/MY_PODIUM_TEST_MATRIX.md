# My Podium Test Matrix

Every row below was actually exercised for this build, against a local harness serving the real built site plus the real `api/*.js` handlers against real production Supabase data (never mocked), unless marked otherwise. See the session's final report for the true pass/fail record and exactly which rows were also re-verified against the live production site after deploy — this file is the checklist, not the result log.

## Responsive widths

Tested at: 360×800, 390×844, 430×932, 768×1024, 1366×768. Portrait only (this is a content/dashboard site, not a game — landscape phone use is rare for this audience and was spot-checked, not exhaustively matrixed).

| # | Check | 360 | 390 | 430 | 768 | 1366 |
|---|---|---|---|---|---|---|
| 1 | No horizontal overflow anywhere on `/my-podium/` | | | | | |
| 2 | Bottom dock alignment (5 equal columns, no clipping) | | | | | n/a (desktop) |
| 3 | Bottom safe-area padding respected | | | | | n/a |
| 4 | Page content padding above the dock (nothing hidden behind it) | | | | | n/a |
| 5 | All five dock labels fit without clipping/wrapping | | | | | n/a |
| 6 | Active dock item reflects the current route | | | | | n/a |
| 7 | Direct load of `/my-podium/` (not navigated-to) | | | | | |
| 8 | Full page refresh preserves preferences | | | | | |
| 9 | Browser back/forward through onboarding steps | | | | | |
| 10 | Mobile side menu opens | | | | | n/a |
| 11 | Mobile side menu closes (overlay click, Escape, link click) | | | | | n/a |
| 12 | Side menu scrolls to every item, including Split Watch | | | | | n/a |
| 13 | Bottom dock hides while the side menu is open | | | | | n/a |
| 14 | Split Watch access from the mobile menu | | | | | |
| 15 | Coach Sign In clearly visible and first in the Split Watch panel | | | | | |
| 16 | Enter Race Day Code clearly visible and second | | | | | |
| 17 | Onboarding: search → select → sport/gender → review → finish | | | | | |
| 18 | Preferences persist after finishing onboarding | | | | | |
| 19 | Editing preferences from the dashboard | | | | | |
| 20 | Clearing preferences (with confirmation) | | | | | |
| 21 | Corrupted `localStorage` value recovers to unpersonalized mode | | | | | |
| 22 | `localStorage` unavailable (simulated) falls back gracefully | | | | | |
| 23 | Loading state for each card (skeleton, no layout shift) | | | | | |
| 24 | Empty state for each card when data is genuinely absent | | | | | |
| 25 | Partial data error (one card's fetch fails) doesn't break the rest | | | | | |
| 26 | Full data error (network down) leaves the page usable | | | | | |
| 27 | Long school name doesn't break the personal context card | | | | | |
| 28 | Long meet name doesn't break the Next Meet card | | | | | |
| 29 | No followed athletes → athlete section hidden, not empty-boxed | | | | | |
| 30 | No upcoming meets for the followed team → honest empty state | | | | | |
| 31 | No recent results for the followed team → honest empty state | | | | | |
| 32 | No ranking-movement data → current rank shown, no arrow/delta | | | | | |
| 33 | Ohio date/time correctness (`America/New_York`, not device TZ) | | | | | |
| 34 | Meet-scheduled state renders correctly | | | | | |
| 35 | Results-pending state renders correctly | | | | | |
| 36 | Results-available state renders correctly | | | | | |
| 37 | No verified-live state exists to test against real data today — confirmed the UI never emits "Live" from a date match alone (code-level check, not a live-data scenario) | | | | | |
| 38 | Keyboard-only navigation through onboarding and dashboard | | | | | |
| 39 | Screen reader labels on icon-only controls and progress steps | | | | | |
| 40 | `prefers-reduced-motion` respected (no skeleton shimmer/animation) | | | | | |
| 41 | Touch targets ≥44px (dock items, onboarding buttons, card actions) | | | | | |
| 42 | Desktop layout unaffected outside the one new nav entry + homepage card | | | | | |

## Functional

- New visitor sees the onboarding intro, not an empty dashboard.
- "Explore without setting up" reaches a genuinely useful unpersonalized dashboard (generic latest results/rankings/poll), not a dead end.
- Team search returns real teams via `/api/teams/`, debounced, stale responses ignored (a fast second keystroke doesn't let a slow first response overwrite it).
- Athlete search (optional step) returns real athletes via the fixed `/api/athletes/`.
- Division is never shown as a form field — confirmed it only ever appears as read-only, derived text.
- Skipping the athlete step is possible and doesn't block completion.
- Completion routes directly to the personalized dashboard.
- Homepage: new-visitor promo card is dismissible, dismissal persists, never reappears on that device.
- Homepage: returning-visitor preview shows the same team/next-meet/result the full dashboard would show (same data adapter, not a second implementation).
- Analytics events fire (`my_podium_opened`, `onboarding_started`, `onboarding_completed`, `preference_added`, `preference_removed`, `my_podium_card_opened`, `my_podium_return_visit`) with only generic category payloads — verified no athlete name, school selection, or free text is present in any `window.va(...)` call.

## Privacy checks

- Confirmed by reading `my-podium-store.js`'s full schema: no field exists for email, phone, address, precise location, birth date, age, password, or training notes.
- Confirmed the analytics call sites individually: every `window.va('event', ...)` payload is a static string or count, never a value read from the preference store or a form input.
- Confirmed My Podium adds no new authentication, comments, messaging, or public-facing follower-count surface.
