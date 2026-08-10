# Podium Watch — Feature Roadmap

*Five phases to layer retention-focused features onto the site, sequenced by technical dependency and payoff — not just by which ideas sound best.*

> **Status note (2026-08-10, added when this doc was filed into `docs/`):** Phase 2 below — the five Supabase migrations plus the Results Source Manager/Baumspage crawl — is already complete and live in production, not a future dependency. All six migrations (`install/01` through `install/06`) are run, the Baumspage crawler has completed real, successful crawls with real result data staged, Recruit Ratings is live with rated athletes, and the statewide school/team foundation covers 602 real Ohio schools (556 boys and 468 girls cross country programs, the last 46 created from official OHSAA data directly). **Phase 3 can start now** — its dependency is already satisfied. Everything else below (the phase goals, the tool ideas, the technical notes) is left exactly as originally written; only this note and the two status markers further down were added.

## Where This Picks Up

Phase Zero (import validation safety, hidden-until-approved imports, no auto profile creation, mobile nav) is complete and deployed. The five Supabase migrations to activate athlete profiles, school foundation, Recruit Ratings, and results ingestion are next, followed by the Results Source Manager (Baumspage crawl).

This roadmap builds on top of that sequence — it doesn't compete with it. Phase 1 is deliberately independent of the migrations so it can ship in parallel. Phase 2 *is* that migration/Baumspage work landing. Everything after it assumes that data is flowing.

## At a Glance

| Phase | Theme | Depends On | Effort |
|---|---|---|---|
| 1 | Quick-win utility tools | Nothing new — ships now | Light, per tool |
| 2 | Data foundation live | **Complete** — 5 migrations run, Baumspage crawl proven, Recruit Ratings live | Done |
| 3 | Recruiting depth & records | Phase 2 (complete) — ready to start | Medium |
| 4 | Content cadence & the follow loop | Phase 3 (needs real content to notify about) | Medium–Heavy |
| 5 | Coach depth & engagement polish | A season+ of accumulated results | Light–Medium |

---

## Phase 1 — Quick-Win Utility Tools

**Goal:** add more tools with the same "come back and use this weekly" DNA as the existing pace calculator, without waiting on any backend work.

- **Training pace calculator** — one recent race time in, easy/tempo/threshold/interval paces out. Same underlying "convert a time into useful numbers" engine as the pace calculator.
- **Equivalent performance calculator** — project a time from one event to another (5K → 1600m, 800m → 400m, etc.).
- **Goal-pace splits builder** — goal time + distance in, mile or 400m splits out.
- **Recruiting standards checker (v1, static)** — event + time + gender in, a rough read on what level of program (P4/D1/D2/D3/NAIA) that's competitive for, using a hand-curated reference table rather than live data.
- **Dual/invitational scoring calculator** — finish order in, team score out.

**Technical note:** none of this touches the athlete/school/results schema — it's reference tables, formulas, and forms. A good set to build alongside the migration work rather than after it, so there's something new shipping while the deeper plumbing is underway.

---

## Phase 2 — Data Foundation Live

**Status: complete.** See the status note at the top of this document — this section is left below as a record of what the phase covered and how it was originally scoped.

**Goal:** this phase *is* your existing plan — the athlete profile, school foundation, Recruit Ratings, and results ingestion migrations, plus the Baumspage crawl through the Results Source Manager. Everything in Phases 3–5 depends on it. Once it's live, a few Phase-1-style tools get meaningfully better:

- **Auto-generated psych sheet** — now pulls real seed times from the results database instead of manual entry.
- **Grade-adjusted comparison** — now shows "how good is this for a freshman" against real profile data instead of just a formula.
- **Course-adjusted time converter (v1)** — starts here. It needs historical results at recurring courses to calibrate a difficulty index, so accuracy will be thin at first and improve as Baumspage results accumulate. Worth shipping early with a "beta / limited course coverage" label rather than waiting for it to be complete — coverage fills in as more meets get crawled.

**Technical note:** no new scope from this roadmap here — just flagging that this phase gates everything downstream, so it's worth protecting the timeline on it rather than adding to it.

---

## Phase 3 — Recruiting Depth & Living Records

**Goal:** turn the athlete profiles and results data from Phase 2 into things athletes, parents, and programs actively check.

- **Shareable recruiting card** — auto-generated one-pager (PR history, course-adjusted times, progression chart) an athlete can send straight to a college coach.
- **"Athletes like you" comparison** — who at your school/region ran similar times in the last several years, and where they signed.
- **Living school record book** — all-time top performances by school and event, auto-updating as results roll in.

**Technical note:** mostly new views and light aggregation over data that already exists by this point — no major new data-collection surface, which keeps this phase lower-risk than it sounds.

---

## Phase 4 — Content Cadence & the Follow Loop

**Goal:** this is the phase most directly responsible for "coaches and athletes come back regularly" — it closes the loop instead of adding another one-time-use tool.

- **Weekly power rankings** — state + regional, updated on a visible schedule.
- **Performance-of-the-week spotlight** — short spotlight format that plugs directly into the student journalist contributor program already on your roadmap.
- **Follow an athlete or team** — lightweight; could start as just an email capture rather than a full account system.
- **Weekly digest email** — "here's what happened with who you follow this week."
- **Result/PR alerts** — notify a follower the moment someone they follow posts a new result.

**Technical note:** the follow/notify pieces need auth-lite plus an email-sending setup (e.g., Resend) — new infrastructure for the project, and the heaviest lift in this phase. Landing rankings and spotlights first, then wiring follow/notify onto them, lets you validate the content cadence before investing in the notification plumbing.

---

## Phase 5 — Coach Depth & Engagement Polish

**Goal:** deepen the tools coaches use most and add light game-like hooks, once there's enough accumulated data and an established audience to make them worthwhile.

- **Opponent scouting snapshot** — auto-pull an upcoming opponent's season results before a dual meet. Needs a season or more of results depth to actually be useful, which is why it sits here rather than earlier.
- **Season log / roster dashboard** — private, lightweight view for a coach of their whole team's progression.
- **Milestone badges** — first sub-20 5K, school record broken, PR streaks.
- **State-series prediction contest** — pick winners by region/division during championship week, leaderboard for bragging rights. Cheap to build, and it lands exactly when traffic already peaks.

---

## How This Fits Your Other Plans

- **Student journalist program** feeds Phase 4's spotlight content directly — same contributor pipeline, just a second, more data-driven format.
- **Instagram handle feature / team IG crowdsourcing** run independently of this roadmap and can ship whenever they're ready — no sequencing conflict.
- **Site health checks (Playwright)** are worth running against each phase as it ships, rather than treating as a separate phase — cheapest to catch regressions right after a new tool goes live.
- **Sponsorship outreach** benefits from Phase 4 landing — weekly rankings plus a follow/digest loop produce exactly the kind of engagement numbers (return visits, email opens) that strengthen a pitch alongside the existing Instagram stats.

---

*Good candidate to drop into `docs/` alongside `PROJECT_CONTEXT.md` and the others. Each phase is sized to hand to a Claude Code session on its own once you're ready to build it.*
