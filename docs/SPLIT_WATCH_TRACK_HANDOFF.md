# Split Watch for Track: Build Handoff

Owner: Zachary Bell, Podium Watch (podiumwatch.org)
Written: November 12, 2026
Based on: the read only Split Watch audit completed November 12, 2026
Target: fully working for the spring 2027 outdoor track season, tested during the indoor season (January to March 2027)

## 1. How to use this document

You are Claude Code working in the Podium Watch repo. This file is the plan for making Split Watch work for track. Zachary is the owner and the only approver. He is not a professional developer, so explain things to him in plain language and give him exact steps when he has to do something himself.

Work one phase per session, in the order given. At the start of every session:

1. Read this file and `docs/SPLIT_WATCH_TRACK_PROGRESS.md` (create it in Phase 1 if it does not exist).
2. Run `git status` and report anything uncommitted before touching code. Do not assume the tree is clean.
3. Inspect the files the phase touches before editing. The file names and behaviors in section 3 come from the audit. Treat them as a map, and verify against the code, because the code wins when they disagree.

At the end of every session, stop and give Zachary the phase report described in section 8. Do not start the next phase until he says so.

## 2. Project rules

These apply to every session.

- Inspect before editing.
- Stage files by name. Never use `git add .` or `git add -A`.
- No destructive git commands (`reset --hard`, `clean`, force push, history rewrites).
- Never edit `dist/` as source.
- Never invent data. No made up athletes, times, schools, or results, including in seed files that could reach production. Test fixtures must be obviously fake and stay inside test scripts.
- You may commit locally at the end of a phase once its checks pass. Never run `git push`, never run a Vercel deploy command, never run SQL against Supabase, and never import data. Zachary does those himself after reviewing.
- Database changes are written as new numbered files in `install/` (check the highest existing number and continue from it). Migrations are additive only: new tables and new nullable or defaulted columns. Do not drop, rename, or repurpose anything that exists. Each file starts with a comment saying what it adds and how to undo it.
- Never create athlete profiles automatically. Entries link to existing rostered athletes or stay as typed names.
- Everything Split Watch shows publicly is labeled as unofficial hand timing. Official results are a separate thing and must never be overwritten or blended with hand splits.
- On Windows PowerShell use `npm.cmd` and `npx.cmd`.
- Cross country must keep working exactly as it does today. Every existing `scripts/test-*.mjs` test must still pass at the end of every phase.

## 3. What exists today (from the audit)

Split Watch is a coach's tool. A coach creates a race, adds their runners with goal times, and a small crew of helpers taps splits on their phones. Parents watch a public page.

**Pages:** hub (`splitwatch.mjs`, `split-watch-hub.js`), plan (`splitwatchplan.mjs`, `split-watch-plan.js`), live (`splitwatchlive.mjs`, `split-watch-live.js`, about 1,741 lines), review (`splitwatchreview.mjs`, `split-watch-review.js`), join (`splitwatchjoin.mjs`, `split-watch-join.js`), helper race list (`splitwatchraces.mjs`, `split-watch-races.js`), public (`racepublic.mjs`, `race-public.js`, `race-poll.js`).

**Shared browser code:** `race-timer.js` (clock), `race-local-store.js` (taps saved in IndexedDB), `race-math.js` (pace and targets).

**Server:** routes under `api/split-watch/` (`sessions.js`, `plan.js`, `sync.js`, `crew.js`, `join.js`, `review.js`), plus `api/team/race-day-code.js` and `api/race/public.js`. Core logic in `split_watch_service.mjs` (about 1,848 lines), `race_day_auth.mjs`, `timing_crew_service.mjs`, `race_viewer_service.mjs`, `rehearsal_service.mjs`.

**Tables:** `race_sessions`, `race_checkpoints`, `race_participants`, `race_goals`, `race_targets`, `race_splits`, `race_split_revisions`, `race_pack_captures`, `race_coach_notes`, `team_race_day_codes`, `race_day_sessions`, `race_day_code_attempts`, `race_positions`.

**What already works in our favor:**

- `race_sessions` already has a `sport` field that allows `track`, a distance, and a display unit that allows meters.
- Checkpoints are free form (label, distance, order, finish flag). Nothing is tied to mile markers except placeholder text in the hub.
- One split per runner per checkpoint, enforced by the database. Each tap has an ID made on the phone, so resending never duplicates. Corrections are kept in `race_split_revisions`.
- Taps are saved on the phone first, then synced every 8 seconds and on reconnect.
- One official start time per race on the server. A second phone pressing Start joins the first start.

**What blocks track:**

- No lap mode. A tap records at whichever checkpoint the phone has selected, not at that runner's own next lap. A lapped runner gets recorded on the wrong lap, and tapping again overwrites.
- No relays. Entries are single runners with no team, legs, or exchanges.
- A helper's session is tied to one race and one checkpoint, so a finish line timer has to confirm again for every race and cannot cover every lap.
- The race day code is 4 digits, one per team, and the code alone identifies the team.
- Code entry (`split-watch-join.js`) and position confirmation (`split-watch-races.js`, around line 179) have no request timeout. Neither do plan, review, public, meet center, or guardian pages. The August 31 fix (commit `86c6de08`) only covered the live page, race list, and hub.
- The live page cannot load without a network, even though the race is saved on the phone. There is no service worker. Starting a race needs a network.
- The public endpoint is not cached, so every viewer poll hits the database.

## 4. What we are building

### Events

Presets are generated from the track's lap length (400 m outdoor by default, 200 m for most indoor tracks). The coach picks an event and the checkpoints are built automatically. A custom option stays available.

| Event | Entry type | Default checkpoints on a 400 m track | Where taps happen |
|---|---|---|---|
| 3200 | Individuals | Every 400 (8) | Finish line |
| 1600 | Individuals | Every 400 (4) | Finish line |
| 800 | Individuals | 400 and finish. Optional 200 and 600 | Finish line. 200 m mark if a helper is there |
| 4x800 | Relay teams | Every 400 (8). Exchanges at 800, 1600, 2400 | Finish line |
| 4x400 | Relay teams | Every 400 (4). Exchanges at 400, 800, 1200 | Finish line |
| 4x200 | Relay teams | 400 (second exchange) and finish. Optional 200 and 600 exchanges | Finish line. 200 m mark optional, shown as approximate because of the stagger |
| 4x100 | Relay teams | Finish only | Finish line |
| Custom relay | Relay teams | Per leg distances entered by the coach (covers DMR and SMR) | Depends on the legs |

On a 200 m track the same events generate a checkpoint every lap, all at the finish line.

### Core ideas

1. **A relay team is an entry that runs laps.** Model the team as one entry so the existing rule of one split per entry per checkpoint keeps working. Legs are a layer on top: leg order, who runs it, leg distance. A checkpoint can be flagged as an exchange. Leg split equals the exchange time minus the previous exchange time (or the start for leg 1).
2. **In lap mode a tap belongs to the runner, not to a selected checkpoint.** Tapping an entry records that entry's next open checkpoint among the ones this phone's position covers.
3. **A crew position is a place on the track, for the whole meet.** "Finish line" and "200 m mark" carry from race to race. A position covers every checkpoint at its location.
4. **The phone never waits on the network to record a tap, open a race it has already loaded, or start a race.**
5. **Each heat or section is its own `race_session`**, grouped under a Split Watch meet with a schedule order.

### Scale to design for

The normal case is a coach timing 1 to 6 of their own entries per race with 1 to 3 phones. The stress case, which must also work, is 24 entries in a 3200 (192 taps) across 3 phones with a bad connection.

## 5. Phases

Each phase lists the goal, the work, and the checks that prove it is done. Write or extend a `scripts/test-*.mjs` test for every check that can be automated, following the pattern of the existing tests.

### Phase 1: Close the hang paths and the offline reload gap

No database changes. This is safe to ship on its own and fixes real problems for cross country too.

- Create one shared request helper with a timeout (15 seconds, matching the August 31 fix) and a consistent error result. Move every Split Watch request onto it: join, position confirmation, plan, review, public race page, meet center, guardian page, plus the three already fixed.
- Every screen that waits on a request gets a visible failure state with a Try again button. No button may stay greyed out forever. No spinner or "Checking..." text may outlive the timeout.
- When the live page cannot reach the server, open it from the copy of the race saved on the phone, show a clear "Working offline" banner, and keep recording. Sync resumes on reconnect.
- Warn before leaving or closing the live page while taps are still waiting to send.
- Create `docs/SPLIT_WATCH_TRACK_PROGRESS.md`.

Checks:
- With the network blocked or stalled, each of the screens above reaches a retry state within 16 seconds.
- A phone that has loaded a live race, then loses signal and reloads, gets back into the race and can tap. Its taps sync after reconnect with no duplicates.
- Existing tests pass, including `test-split-watch-load-timeout.mjs`.

### Phase 2: Lap mode for the 3200, 1600, and 800

- Migration: add lap fields to `race_sessions` (lap length in meters, an event key such as `3200` or `4x800`, a tap mode with values for the current checkpoint behavior and the new lap behavior). Add a location field to `race_checkpoints` (finish line, 200 m mark) and an exchange flag for later use. Existing rows default to current behavior.
- Hub: when the sport is track, the coach picks an event and lap length and the checkpoints are generated. Remove the "Mile 1" placeholder for track.
- Live page lap mode:
  - One large button per entry showing name, laps done out of total, last lap time, and running total.
  - Tap records the next open checkpoint for that entry. The finish records on the last one, and further taps on a finished entry are refused.
  - Double tap guard: a second tap on the same entry inside a short window is ignored (suggested 15 seconds for 400 m laps, 8 seconds for 200 m laps, kept as constants in one place).
  - Undo last tap for an entry, written through the existing revision history so nothing is silently lost.
  - Order the buttons by who is expected to pass next (last pass time plus last lap time), so a lapped runner sorts naturally. Keep the order stable enough that buttons do not jump under a thumb: reorder only after a tap settles.
  - Mark an entry as did not start, did not finish, or disqualified so it drops out of the order. Check first whether `race_participants` already has a status for this.
  - Check what `race_pack_captures` does today. If it supports "tap now, assign after", make it work in lap mode so a pack crossing together can be captured as timestamps and then assigned to entries.
- Two phones on the same entry: this is the case that will produce wrong laps if handled carelessly. Phone B may not yet know that phone A recorded lap 3, so on the next pass phone B sends a tap it believes is lap 3. Resolve it on the server by time, not by the lap number the phone guessed: if the incoming tap is within the double tap window of an existing split for that entry, it is the same pass and the first saved wins (current behavior). If it is later than the latest recorded split by more than the window, record it on the next open checkpoint and tell the phone which checkpoint it landed on. Write a test for exactly this sequence.
- Live and review show lap splits and cumulative times. Display to the tenth of a second. Store full precision.

Checks:
- A simulated 3200 with 24 entries, including runners lapped once and twice, produces the correct lap for every tap.
- The two phone stale lap sequence above lands on the right checkpoints.
- Double taps are ignored, undo restores the previous state and keeps a revision, and a finished entry cannot be tapped past the finish.
- A cross country race created before this phase behaves exactly as before.

### Phase 3: Relays

- Migration: relay team and leg tables (or an entry type on `race_participants` plus a legs table, whichever fits the existing code better). A leg has an order, a distance, and either a rostered athlete, a typed name, or "TBD". Legs can be edited up to and during the race, since coaches change orders late.
- Plan page: build relay teams (A team, B team), set the leg order by picking rostered athletes.
- Presets for 4x800, 4x400, 4x200, 4x100, and custom relays with per leg distances.
- Live page: a relay button shows the team, the current leg's runner, and laps done. A tap at an exchange checkpoint closes that leg and hands off to the next one. Show the leg split the moment it closes.
- Review: leg splits with athlete names, 400 splits inside 800 legs, team total.
- 4x200 exchanges at the 200 m mark are optional and labeled approximate. 4x100 is finish only by default.

Checks:
- Simulated 4x800 and 4x400 with two teams each: leg splits sum to the team total, and the right athlete is attached to each leg.
- Changing the leg order mid race reassigns names without changing any recorded time.
- A custom relay with unequal legs (1200, 400, 800, 1600) generates correct exchanges and leg splits.

### Phase 4: Meet wide crews and stronger codes

- Migration: a Split Watch meet table (team, name, date, lap length, optional link to an existing meet), a link from `race_sessions` to it with event, heat number, and schedule order, meet level positions (label plus track location), and helper sessions that can be tied to a meet and a meet position instead of a single race and checkpoint.
- A helper joins once for the meet, picks a position once, and moves from race to race without confirming again. The helper sees the meet schedule and the current race.
- A position covers every checkpoint at its location in every race of the meet.
- The old flow (one race, one checkpoint) keeps working for cross country.
- Codes: move to a 6 character code using letters and digits with lookalikes removed (no 0, O, 1, I, L). Scope a code to a meet when one exists, expiring the day after the meet. Keep the per network attempt limit and add a limit that does not depend on the network. Existing sessions stay valid.
- The audit found the code is also stored in plain text so coaches can view it again. Do not change that silently. Lay out the options for Zachary in the phase report (keep as is with the longer code, or store it encrypted) with a recommendation.
- Coach controls: a meet schedule view with "start next race", and a one tap way to move the whole crew to the next race.

Checks:
- One helper session records taps in three consecutive races of a meet without rejoining.
- A finish line position can record every finish line checkpoint in a 3200. A 200 m mark position can record only the 200 m mark checkpoints.
- Old 4 digit team codes that are still active keep working until they expire. Rate limits hold under a scripted guessing run.

### Phase 5: Full offline

- A service worker scoped to the Split Watch and public race pages only. It lets pages and scripts load with no signal. Requirements: versioned cache that updates on every deploy, network first when online with a short timeout before falling back to cache, no caching of private API responses (race data on the phone continues to live in the existing IndexedDB store), and a simple way to switch the service worker off if it misbehaves.
- Starting a race with no signal: the phone records a provisional start locally and begins timing. On reconnect it sends the start. The server keeps its existing rule (the first accepted start is official) and the phone's times are shifted to the official start using the existing adjustment path.
- A sync health indicator a coach can read at a glance: taps waiting, last successful sync, online or offline.

Checks:
- With the phone in airplane mode from before the race: open the live page, start, record a full 1600, reconnect, and every split arrives once with correct times.
- After a new deploy, a phone that had the old version cached picks up the new scripts on its next online load.

### Phase 6: Public viewer for track

- Lap table per entry: each lap split, cumulative time, current lap. Relays show each leg with the athlete's name and the leg split.
- Label the page "Unofficial hand splits".
- Cache `api/race/public.js` at the edge for a few seconds so many viewers share one database read. Keep polling (it is simpler and sturdier than push here). With the cache in place, the live poll can drop from 10 seconds to about 5.
- Make sure nothing private (goals, coach notes, codes) is in the cached public response.

Checks:
- 500 simulated viewers polling one live race produce a small, flat number of database reads.
- Public page renders a finished 3200 and a finished 4x800 correctly on a phone screen.

### Phase 7: Rehearsal mode and a dress rehearsal

- Extend the existing rehearsal feature (`rehearsal_service.mjs`) so a coach or Zachary can run a fake track meet end to end: a 3200 with lapping, an 800, a 4x800, and a 4x400, with fake entries that are clearly marked as rehearsal and never appear publicly.
- A scripted simulator for load and chaos: 24 entries, 3 phones, random dropped connections, duplicate sends, stale lap taps.
- A one page race day checklist for coaches and helpers in `docs/`.

Checks:
- The full simulator run finishes with zero lost taps, zero duplicates, and zero wrong laps.
- Zachary completes a rehearsal meet on real phones.

## 6. Order and timing

| When | Phases |
|---|---|
| November | 1 |
| December | 2 and 3 |
| Early January | 4 |
| January to March (indoor season, real tests) | 5, 6, 7, plus fixes from live use |
| Late March | Outdoor launch |

Indoor meets are the test bed. Start with the 1600 and 3200, add the 800 and 4x800, then the 4x400.

## 7. Decisions already made, and ones still open

Made (Zachary can overrule any of these):

- 4x100 has no leg splits by default. Hand timing an 11 second leg through an exchange zone is not meaningful.
- Polling plus edge caching for the public page, not push updates.
- Each heat is its own race.
- Displayed splits are to the tenth of a second.

Open, raise in the relevant phase report:

- Plain text storage of race day codes (Phase 4).
- Whether finished Split Watch splits should later show on athlete profile pages, and how they sit next to official results. Out of scope for this build. Do not start it without a separate plan.

## 8. Phase report format

End every session with this, in plain language:

1. **What changed:** files touched, one line each.
2. **Database:** the exact `install/` file Zachary needs to run in the Supabase SQL editor, or "none". If there is one, remind him to run it before pushing the code.
3. **Tests:** which tests ran and their results, including the existing cross country tests.
4. **How to check it yourself:** numbered steps Zachary can follow on his phone.
5. **Commits:** the local commit hashes and messages. Confirm nothing was pushed or deployed.
6. **Open questions and anything surprising** found in the code.
7. **Update** `docs/SPLIT_WATCH_TRACK_PROGRESS.md` with the phase status and date.

## 9. Definition of done

Split Watch is ready for outdoor season when all of these are true on real phones at a real meet:

- A coach sets up a meet with a 4x800, 3200, 1600, 800, 4x400, 4x200, and 4x100 in under ten minutes.
- A helper joins once and times every race from one position.
- Lapped runners land on the right lap without anyone thinking about it.
- Relay leg splits appear with the right names as each exchange happens.
- Losing signal at any moment loses nothing, and no screen ever hangs without a retry.
- Parents see live lap and leg splits, labeled unofficial, and the site stays fast.
- Cross country works exactly as it did.
