// Podium Play (Phase 1 + 2 + 3) -- a small arcade on the Athlete/Team of
// the Week pages, with all three launch games: Photo Finish (Phase 1),
// Starting Gun (Phase 2), and Hurdle Dash (Phase 3). Badges, streaks,
// daily challenges, sharing, the Instagram invite, a My Podium account
// bridge, and a leaderboard are deliberately deferred to later phases
// rather than shipped as placeholders.
//
// The games are available for the whole page visit -- a visitor does not
// have to vote first (explicit direction, 2026-09-01: "I want the games
// to pull up immediately even before someone votes"). A confirmed vote
// only ever ADDS a cooldown-status readout (confirmation message, live
// countdown, Vote Again) on top of the same already-visible panel; it
// never gates the games and never interrupts one already in progress
// (see showVoteConfirmation()'s own comment for why it deliberately does
// not call cancelCurrentAttempt()).
//
// This file NEVER touches vote counting, candidate totals, or the
// cooldown duration -- it only ever READS the real retry_after_seconds
// that public/scripts/weekly-awards.js already received from the server,
// via one small custom event that script dispatches on a confirmed
// success (see its own comment at the dispatch site). If this file fails
// to load, throws, or is blocked entirely, voting itself is completely
// unaffected -- it is a strictly additive panel, never a replacement for
// any existing vote-flow markup or logic.
//
// Plain classic script (not a module), matching every other file in this
// directory -- pure/testable pieces attach to window.PodiumPlay so
// scripts/test-podium-play.mjs can load this file directly in Node with a
// minimal window/localStorage/document stub, the same pattern already
// used for public/scripts/pace-splits.js.
(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Config: points, levels, Photo Finish scoring -- plain data, no logic
  // scattered as unexplained numbers elsewhere in this file.
  // ---------------------------------------------------------------------

  const PROFILE_STORAGE_KEY = "podiumWatch.podiumPlay.profile.v1";
  const PROFILE_VERSION = 1;

  // Personal progression only, never vote spamming -- see awardPoints()
  // below, which is what actually enforces this.
  const DAILY_POINT_CAP = 300;
  const FIRST_GAME_IN_COOLDOWN_POINTS = 5;
  const PERSONAL_RECORD_POINTS = 10;

  const LEVELS = [
    { name: "Rookie Runner", threshold: 0 },
    { name: "Junior Varsity", threshold: 100 },
    { name: "Varsity", threshold: 300 },
    { name: "Conference Champion", threshold: 700 },
    { name: "District Champion", threshold: 1200 },
    { name: "Regional Champion", threshold: 2000 },
    { name: "State Qualifier", threshold: 3000 },
    { name: "All Ohio", threshold: 4500 },
    { name: "State Champion", threshold: 6500 },
    { name: "Podium Legend", threshold: 10000 }
  ];

  const PHOTO_FINISH_TARGET_SECONDS = 15;
  const PHOTO_FINISH_HIDE_AT_SECONDS = 12;
  const PHOTO_FINISH_MIN_VALID_SECONDS = 1;

  // Bands keyed off hundredths-of-a-second as integers, not raw floats --
  // avoids real floating-point boundary bugs (0.01 doesn't store exactly
  // in binary) landing an attempt in the wrong band right at an edge.
  function photoFinishScoreBand(diffSeconds) {
    const diffHundredths = Math.round(Math.abs(diffSeconds) * 100);
    if (diffHundredths === 0) return 1000;
    if (diffHundredths <= 1) return 750;
    if (diffHundredths <= 5) return 500;
    if (diffHundredths <= 10) return 300;
    if (diffHundredths <= 25) return 150;
    if (diffHundredths <= 50) return 75;
    return 20;
  }

  const STARTING_GUN_MIN_DELAY_MS = 1500;
  const STARTING_GUN_MAX_DELAY_MS = 4000;
  const STARTING_GUN_ON_YOUR_MARKS_MS = 600;
  const STARTING_GUN_SET_MS = 600;

  function randomStartingGunDelayMs(randomFn = Math.random) {
    return STARTING_GUN_MIN_DELAY_MS + randomFn() * (STARTING_GUN_MAX_DELAY_MS - STARTING_GUN_MIN_DELAY_MS);
  }

  // Bands from the spec, in whole milliseconds. Under 150ms is real and
  // scoreable locally, but flagged `suspicious` -- there is no server
  // leaderboard in this phase, so nothing reads that flag yet, but the
  // data is captured now rather than needing a later migration of stored
  // records to add it retroactively.
  function startingGunScoreBand(reactionMs) {
    const ms = Math.round(reactionMs);
    if (ms < 150) return { score: 1000, suspicious: true };
    if (ms <= 199) return { score: 750, suspicious: false };
    if (ms <= 249) return { score: 500, suspicious: false };
    if (ms <= 299) return { score: 300, suspicious: false };
    if (ms <= 399) return { score: 150, suspicious: false };
    if (ms <= 599) return { score: 75, suspicious: false };
    return { score: 20, suspicious: false };
  }

  // --- Hurdle Dash: a fixed internal coordinate system (game units),
  // independent of the canvas element's actual on-screen pixel size. The
  // canvas is scaled to fit its container purely via CSS (see .pp-hurdle-
  // canvas), so every physics calculation below always happens in these
  // same fixed units regardless of screen size -- an orientation change
  // or window resize never has to touch game state at all, satisfying
  // the spec's "resize safely... do not reset an active run" requirement
  // by construction rather than by handling a resize event.
  const HURDLE_DASH_WIDTH = 800;
  const HURDLE_DASH_HEIGHT = 220;
  const HURDLE_DASH_GROUND_Y = 190;
  const HURDLE_DASH_RUNNER_X = 90;
  const HURDLE_DASH_RUNNER_WIDTH = 34;
  const HURDLE_DASH_RUNNER_HEIGHT = 52;
  const HURDLE_DASH_HURDLE_WIDTH = 22;
  const HURDLE_DASH_HURDLE_HEIGHT = 42;
  const HURDLE_DASH_TROPHY_SIZE = 26;
  const HURDLE_DASH_GRAVITY = 2600; // game units / s^2
  const HURDLE_DASH_JUMP_VELOCITY = 820; // game units / s, upward
  const HURDLE_DASH_JUMP_DURATION_SECONDS = (2 * HURDLE_DASH_JUMP_VELOCITY) / HURDLE_DASH_GRAVITY;
  const HURDLE_DASH_INITIAL_SPEED = 300; // game units / s
  const HURDLE_DASH_MAX_SPEED = 640;
  const HURDLE_DASH_SPEED_RAMP_PER_SECOND = 5;
  const HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS = 3.5; // a real head start before the first real obstacle -- see hurdleDashNextGap's comment for the real playtesting behind this number
  const HURDLE_DASH_DISTANCE_PER_SCORE_UNIT = 10;
  const HURDLE_DASH_HURDLE_CLEAR_POINTS = 25;
  const HURDLE_DASH_TROPHY_POINTS = 40;
  const HURDLE_DASH_RESUME_COUNTDOWN_SECONDS = 3;

  function hurdleDashSpeedAtElapsed(elapsedSeconds) {
    const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    return Math.min(HURDLE_DASH_MAX_SPEED, HURDLE_DASH_INITIAL_SPEED + safeElapsed * HURDLE_DASH_SPEED_RAMP_PER_SECOND);
  }

  // The runner's height above the ground (0 = grounded) at a given point
  // into a jump. Simple projectile motion -- gravity is constant, so this
  // is a closed-form parabola, not a per-frame numeric integration, which
  // means it produces the exact same arc regardless of frame rate.
  function hurdleDashJumpOffset(jumpElapsedSeconds) {
    if (!Number.isFinite(jumpElapsedSeconds) || jumpElapsedSeconds < 0 || jumpElapsedSeconds > HURDLE_DASH_JUMP_DURATION_SECONDS) {
      return 0;
    }
    const height = HURDLE_DASH_JUMP_VELOCITY * jumpElapsedSeconds - 0.5 * HURDLE_DASH_GRAVITY * jumpElapsedSeconds * jumpElapsedSeconds;
    return Math.max(0, height);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // Real playtesting (a headless-browser run against the live game
  // loop, not just reasoning about the numbers) found the first hurdle
  // landing around 4.2-4.8s into a run -- survivable for a deliberate,
  // watching-the-hurdle tap, but tighter than the spec's own "10-25
  // seconds for a normal first run" target once a first-time player's
  // real reaction time is accounted for. Widened alongside
  // HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS above.
  const HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER = 1.5;
  const HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER = 2.2;

  // A safe, never-impossible gap (in game units, i.e. distance the world
  // must scroll) before the next hurdle, given the CURRENT speed --
  // always leaves enough real time for one full jump-and-land cycle plus
  // a buffer, so a correctly-timed tap can always clear it. Randomized
  // within that safe range for real variety, never below it -- the test
  // suite asserts this gap converted back to time (gap / speed) is always
  // >= the real jump duration, at both minimum and maximum speed.
  function hurdleDashNextGap(currentSpeed, randomFn = Math.random) {
    const minSeconds = HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER;
    const maxSeconds = HURDLE_DASH_JUMP_DURATION_SECONDS * HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER;
    const seconds = minSeconds + randomFn() * (maxSeconds - minSeconds);
    return seconds * currentSpeed;
  }

  // Raw game score for one run -- distance converted to points, plus
  // fixed per-hurdle and per-trophy bonuses. Kept deliberately separate
  // from Podium Points (see awardPoints()), same as the other two games.
  function hurdleDashGameScore(distance, hurdlesCleared, trophiesCollected) {
    const distancePoints = Math.floor(Math.max(0, Number(distance) || 0) / HURDLE_DASH_DISTANCE_PER_SCORE_UNIT);
    const hurdlePoints = Math.max(0, Number(hurdlesCleared) || 0) * HURDLE_DASH_HURDLE_CLEAR_POINTS;
    const trophyPoints = Math.max(0, Number(trophiesCollected) || 0) * HURDLE_DASH_TROPHY_POINTS;
    return distancePoints + hurdlePoints + trophyPoints;
  }

  function levelForPoints(points) {
    const safePoints = Number.isFinite(points) ? Math.max(0, points) : 0;
    let current = LEVELS[0];
    for (const level of LEVELS) {
      if (safePoints >= level.threshold) current = level;
    }
    const index = LEVELS.indexOf(current);
    const next = LEVELS[index + 1] || null;
    return {
      name: current.name,
      threshold: current.threshold,
      next: next ? { name: next.name, threshold: next.threshold } : null,
      // 1 (full) once the visitor is at the top level -- there is no next
      // threshold to divide by.
      progress: next ? Math.min(1, Math.max(0, (safePoints - current.threshold) / (next.threshold - current.threshold))) : 1
    };
  }

  function todayLocalDateKey(date = new Date()) {
    // The visitor's own local calendar day. Daily challenges (a later
    // phase) specifically need America/New_York per the spec; this daily
    // point cap is just "don't let one sitting farm points forever" and
    // doesn't need that same precision.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // ---------------------------------------------------------------------
  // Guest profile: versioned, local-only, no account required. Personal
  // records, points, and level live here; nothing sensitive is stored.
  // ---------------------------------------------------------------------

  function defaultProfile() {
    return {
      version: PROFILE_VERSION,
      installId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      points: 0,
      pointsAwardedToday: { date: todayLocalDateKey(), amount: 0 },
      // Idempotency guard for one-time-per-key point awards (e.g. a given
      // day's first-game bonus) -- see awardPoints().
      awardedKeys: [],
      photoFinish: { personalRecord: null, attempts: 0 },
      startingGun: { personalRecord: null, attempts: 0, falseStarts: 0 },
      // Three independent bests, per spec ("store the longest distance,
      // highest hurdle count, and highest game score") -- each can come
      // from a different run; a run doesn't have to sweep all three to
      // set any one of them.
      hurdleDash: { bestDistance: null, bestHurdlesCleared: null, bestGameScore: null, attempts: 0 },
      lastActivityAt: null
    };
  }

  // No prior profile version has ever existed -- an unrecognized version
  // is a future shape this code doesn't understand, not something to
  // guess a migration for. Recovers with a fresh profile rather than
  // crashing the voting page on malformed/future data.
  function sanitizeProfile(raw) {
    try {
      if (!raw || typeof raw !== "object" || raw.version !== PROFILE_VERSION) {
        return defaultProfile();
      }
      const base = defaultProfile();
      const pr = raw.photoFinish && typeof raw.photoFinish === "object" ? raw.photoFinish : {};
      const validPr = pr.personalRecord && Number.isFinite(pr.personalRecord.diffSeconds) && Number.isFinite(pr.personalRecord.elapsedSeconds)
        ? { diffSeconds: pr.personalRecord.diffSeconds, elapsedSeconds: pr.personalRecord.elapsedSeconds }
        : null;
      const sg = raw.startingGun && typeof raw.startingGun === "object" ? raw.startingGun : {};
      const validSgPr = sg.personalRecord && Number.isFinite(sg.personalRecord.reactionMs)
        ? { reactionMs: sg.personalRecord.reactionMs, suspicious: sg.personalRecord.suspicious === true }
        : null;
      const hd = raw.hurdleDash && typeof raw.hurdleDash === "object" ? raw.hurdleDash : {};
      const safeNonNegative = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
      return {
        ...base,
        installId: typeof raw.installId === "string" && raw.installId ? raw.installId : base.installId,
        points: Number.isFinite(raw.points) ? Math.max(0, raw.points) : 0,
        pointsAwardedToday: raw.pointsAwardedToday && typeof raw.pointsAwardedToday.date === "string"
          ? { date: raw.pointsAwardedToday.date, amount: Math.max(0, Number(raw.pointsAwardedToday.amount) || 0) }
          : base.pointsAwardedToday,
        awardedKeys: Array.isArray(raw.awardedKeys) ? raw.awardedKeys.filter((key) => typeof key === "string").slice(-500) : [],
        photoFinish: { personalRecord: validPr, attempts: Number.isFinite(pr.attempts) ? Math.max(0, pr.attempts) : 0 },
        startingGun: {
          personalRecord: validSgPr,
          attempts: Number.isFinite(sg.attempts) ? Math.max(0, sg.attempts) : 0,
          falseStarts: Number.isFinite(sg.falseStarts) ? Math.max(0, sg.falseStarts) : 0
        },
        hurdleDash: {
          bestDistance: safeNonNegative(hd.bestDistance),
          bestHurdlesCleared: safeNonNegative(hd.bestHurdlesCleared),
          bestGameScore: safeNonNegative(hd.bestGameScore),
          attempts: Number.isFinite(hd.attempts) ? Math.max(0, hd.attempts) : 0
        },
        lastActivityAt: typeof raw.lastActivityAt === "string" ? raw.lastActivityAt : null
      };
    } catch {
      return defaultProfile();
    }
  }

  function loadProfile() {
    try {
      const raw = globalThis.localStorage?.getItem(PROFILE_STORAGE_KEY);
      return raw ? sanitizeProfile(JSON.parse(raw)) : defaultProfile();
    } catch {
      // Malformed JSON, storage disabled, or anything else -- recover
      // with a fresh in-memory profile rather than breaking the page.
      return defaultProfile();
    }
  }

  function saveProfile(profile) {
    try {
      globalThis.localStorage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage unavailable, full, or disabled -- Podium Play keeps
      // working for this page view from the in-memory profile; it just
      // won't persist across a reload. Never throws into the caller.
    }
  }

  // Grants `amount` points under a unique `key`, exactly once ever for
  // that key, respecting the daily cap. Returns the amount actually
  // granted (0 if already granted for this key, or the cap was already
  // reached today -- a repeat call for the same key is always free of
  // side effects beyond the first). Mutates `profile` in place; callers
  // are expected to saveProfile() afterward.
  function awardPoints(profile, key, amount) {
    const today = todayLocalDateKey();
    if (profile.pointsAwardedToday.date !== today) {
      profile.pointsAwardedToday = { date: today, amount: 0 };
    }
    if (profile.awardedKeys.includes(key)) return 0;

    profile.awardedKeys.push(key);
    const remaining = Math.max(0, DAILY_POINT_CAP - profile.pointsAwardedToday.amount);
    const granted = Math.max(0, Math.min(amount, remaining));
    if (granted > 0) {
      profile.points += granted;
      profile.pointsAwardedToday.amount += granted;
    }
    return granted;
  }

  // ---------------------------------------------------------------------
  // Expose the pure/testable pieces before any DOM wiring below runs, so
  // scripts/test-podium-play.mjs can load this file in Node (with a
  // window/localStorage stub) and never needs a real browser or document.
  // ---------------------------------------------------------------------

  const PodiumPlay = (window.PodiumPlay = window.PodiumPlay || {});
  Object.assign(PodiumPlay, {
    PROFILE_STORAGE_KEY,
    PROFILE_VERSION,
    DAILY_POINT_CAP,
    FIRST_GAME_IN_COOLDOWN_POINTS,
    PERSONAL_RECORD_POINTS,
    LEVELS,
    PHOTO_FINISH_TARGET_SECONDS,
    PHOTO_FINISH_HIDE_AT_SECONDS,
    PHOTO_FINISH_MIN_VALID_SECONDS,
    photoFinishScoreBand,
    STARTING_GUN_MIN_DELAY_MS,
    STARTING_GUN_MAX_DELAY_MS,
    STARTING_GUN_ON_YOUR_MARKS_MS,
    STARTING_GUN_SET_MS,
    randomStartingGunDelayMs,
    startingGunScoreBand,
    HURDLE_DASH_WIDTH,
    HURDLE_DASH_HEIGHT,
    HURDLE_DASH_GROUND_Y,
    HURDLE_DASH_RUNNER_X,
    HURDLE_DASH_RUNNER_WIDTH,
    HURDLE_DASH_RUNNER_HEIGHT,
    HURDLE_DASH_HURDLE_WIDTH,
    HURDLE_DASH_HURDLE_HEIGHT,
    HURDLE_DASH_TROPHY_SIZE,
    HURDLE_DASH_GRAVITY,
    HURDLE_DASH_JUMP_VELOCITY,
    HURDLE_DASH_JUMP_DURATION_SECONDS,
    HURDLE_DASH_INITIAL_SPEED,
    HURDLE_DASH_MAX_SPEED,
    HURDLE_DASH_SPEED_RAMP_PER_SECOND,
    HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS,
    HURDLE_DASH_SAFE_GAP_MIN_MULTIPLIER,
    HURDLE_DASH_SAFE_GAP_MAX_MULTIPLIER,
    HURDLE_DASH_RESUME_COUNTDOWN_SECONDS,
    hurdleDashSpeedAtElapsed,
    hurdleDashJumpOffset,
    rectsOverlap,
    hurdleDashNextGap,
    hurdleDashGameScore,
    levelForPoints,
    todayLocalDateKey,
    defaultProfile,
    sanitizeProfile,
    loadProfile,
    saveProfile,
    awardPoints
  });

  // A bare `document` check (rather than a full browser-feature check)
  // is the real signal this file is running in Node under the test
  // runner rather than a real page -- every DOM-dependent piece below is
  // deliberately skipped in that case so the pure exports above stay
  // importable with nothing more than a window/localStorage stub.
  if (typeof document === "undefined") return;

  // ---------------------------------------------------------------------
  // DOM wiring: the panel, the countdown, Photo Finish, analytics.
  // ---------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatSeconds2(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "--.--";
  }

  // Same podium_visitor_id/podium_session_id keys already used by
  // public/scripts/pace-calculator.js and page-view.js -- Podium Play
  // activity ties to the same visitor/session identity as the rest of
  // the site's engagement tracking, not a competing scheme.
  function getVisitorId() {
    try {
      let id = localStorage.getItem("podium_visitor_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem("podium_visitor_id", id);
      }
      return id;
    } catch {
      return "unknown";
    }
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem("podium_session_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("podium_session_id", id);
      }
      return id;
    } catch {
      return "unknown";
    }
  }

  // Analytics must never interrupt voting or play -- every call site
  // below fires this and ignores the outcome entirely. Events land in
  // the same team_analytics_events table as the rest of the site's
  // engagement tracking (see lib/engagement_service.mjs); this silently
  // no-ops (a real, expected 400) until
  // install/40_PODIUM_PLAY_ANALYTICS.sql is actually run.
  function track(eventType, extra = {}) {
    try {
      fetch("/api/engagement/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          visitor_id: getVisitorId(),
          session_id: getSessionId(),
          section: "podium_play",
          path: window.location.pathname,
          ...extra
        })
      }).catch(() => {});
    } catch {
      // Never let analytics break the arcade.
    }
  }

  function initPanel(root) {
    const panel = root.querySelector("[data-podium-play]");
    if (!panel) return;

    const otherContestHref = panel.dataset.otherContestHref || "";
    const otherContestLabel = panel.dataset.otherContestLabel || "";

    let profile = loadProfile();
    let cooldownTimer = null;
    let cooldownDeadline = 0;
    // Games are available for the whole page visit now, independent of
    // voting (see the file header) -- there is no longer a per-vote
    // "cooldown session" to scope the first-game bonus to, so this key
    // covers the whole time this page has been open instead, generated
    // once below rather than regenerated on every vote.
    const pageSessionKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let sessionAwardedFirstGame = false;
    // Whichever one game is currently in progress, if any -- only one can
    // ever be active at a time (starting a new attempt or opening a
    // different game always goes through cancelCurrentAttempt() first).
    // Photo Finish stores { startedAt, raf, cleanup, tabHidden }; Starting
    // Gun and Hurdle Dash both store { cleanup } (their own pending
    // timers/listeners/animation frame -- Hurdle Dash's own `raf` local
    // variable is cancelled from inside that cleanup closure, not read
    // off this shared object the way Photo Finish's is).
    let currentAttempt = null;

    function persist() {
      profile.lastActivityAt = new Date().toISOString();
      saveProfile(profile);
    }

    function renderProgress() {
      const level = levelForPoints(profile.points);
      const pointsEl = panel.querySelector("[data-pp-points]");
      const levelEl = panel.querySelector("[data-pp-level]");
      if (pointsEl) pointsEl.textContent = String(profile.points);
      if (levelEl) {
        levelEl.textContent = level.next
          ? `${level.name} · ${level.threshold + Math.round(level.progress * (level.next.threshold - level.threshold))}/${level.next.threshold} to ${level.next.name}`
          : `${level.name} · top level`;
      }
    }

    function announce(text) {
      const liveRegion = panel.querySelector("[data-pp-live]");
      if (liveRegion) liveRegion.textContent = text;
    }

    function tickCountdown() {
      const remaining = Math.max(0, Math.ceil((cooldownDeadline - Date.now()) / 1000));
      const countdownEl = panel.querySelector("[data-pp-countdown]");
      const ringEl = panel.querySelector("[data-pp-ring]");
      if (countdownEl) {
        countdownEl.textContent = remaining > 0 ? `Vote again in ${remaining} second${remaining === 1 ? "" : "s"}.` : "You can vote again now.";
      }
      if (ringEl) {
        const total = Number(panel.dataset.cooldownTotal) || 45;
        const pct = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
        ringEl.style.setProperty("--pp-progress", `${pct}%`);
      }
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        showVoteAgain();
      }
    }

    function showVoteAgain() {
      const button = panel.querySelector("[data-pp-vote-again]");
      if (button && button.hidden) {
        button.hidden = false;
        announce("You can vote again now.");
      }
    }

    function buildPanelMarkup() {
      panel.innerHTML = `
        <div class="pp-cooldown-status" data-pp-cooldown-status hidden>
          <div class="pp-header">
            <p class="pp-vote-confirmed" data-pp-confirmed></p>
            <div class="pp-cooldown-ring" data-pp-ring><span data-pp-countdown>Vote again in 45 seconds.</span></div>
          </div>
        </div>
        <p class="visually-hidden" role="status" aria-live="polite" data-pp-live></p>
        <div class="pp-progress-row">
          <span><strong data-pp-points>0</strong> Podium Points</span>
          <span data-pp-level>Rookie Runner</span>
        </div>
        <p class="eyebrow">Podium Play</p>
        <div class="pp-games" data-pp-games>
          <div class="pp-game-card" data-pp-game="photo-finish">
            <h3>Photo Finish</h3>
            <p>Stop the clock at exactly 15.00.</p>
            <button class="button button-primary" type="button" data-pp-play="photo-finish">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="starting-gun">
            <h3>Starting Gun</h3>
            <p>Wait for the gun. Tap as fast as you can.</p>
            <button class="button button-primary" type="button" data-pp-play="starting-gun">Play</button>
          </div>
          <div class="pp-game-card" data-pp-game="hurdle-dash">
            <h3>Hurdle Dash</h3>
            <p>Tap to jump. Clear as many hurdles as you can.</p>
            <button class="button button-primary" type="button" data-pp-play="hurdle-dash">Play</button>
          </div>
        </div>
        <div class="pp-game-stage" data-pp-stage hidden></div>
        ${otherContestHref ? `<p class="pp-other-contest"><a href="${escapeHtml(otherContestHref)}">Have you voted for ${escapeHtml(otherContestLabel)}?</a></p>` : ""}
        <button class="button button-primary pp-vote-again" type="button" data-pp-vote-again hidden>Vote again</button>
      `;
    }

    function openPhotoFinish() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "photo_finish" });
      renderPhotoFinishIdle(stage, games);
    }

    function closeGameStage(stage, games) {
      cancelCurrentAttempt();
      stage.hidden = true;
      stage.innerHTML = "";
      games.hidden = false;
    }

    // The single cleanup path for an in-progress attempt -- called both
    // when it finishes normally (Stop) and when the visitor abandons it
    // early (Back to games mid-attempt). Cancels the running animation
    // frame loop AND removes the visibilitychange listener every time, so
    // clicking Back mid-attempt can never leak a listener the way calling
    // only cancelAnimationFrame here previously did.
    function cancelCurrentAttempt() {
      if (currentAttempt?.raf) cancelAnimationFrame(currentAttempt.raf);
      currentAttempt?.cleanup?.();
      currentAttempt = null;
    }

    function renderPhotoFinishIdle(stage, games) {
      const pr = profile.photoFinish.personalRecord;
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Stop the clock at exactly 15.00.</p>
        ${pr ? `<p class="pp-pr">Personal record: ${formatSeconds2(pr.elapsedSeconds)} (${formatSeconds2(pr.diffSeconds)} away)</p>` : ""}
        <p class="pp-clock" data-pp-clock aria-hidden="true">00.00</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-start>Start</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-start]").addEventListener("click", () => startPhotoFinishAttempt(stage, games));
    }

    function startPhotoFinishAttempt(stage, games) {
      const clockEl = stage.querySelector("[data-pp-clock]");
      const startButton = stage.querySelector("[data-pp-start]");
      const startedAt = performance.now();
      let hiddenFromView = false;
      let tabHidden = false;

      const onVisibilityChange = () => {
        if (document.hidden) tabHidden = true;
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      startButton.textContent = "Stop";
      startButton.replaceWith(startButton.cloneNode(true)); // drop the Start listener cleanly
      const stopButton = stage.querySelector("[data-pp-start]");
      stopButton.addEventListener("click", () => finishPhotoFinishAttempt(stage, games, startedAt, tabHidden));

      currentAttempt = { startedAt, tabHidden: () => tabHidden };

      function frame() {
        const elapsed = (performance.now() - startedAt) / 1000;
        if (!hiddenFromView && elapsed >= PHOTO_FINISH_HIDE_AT_SECONDS) {
          hiddenFromView = true;
          clockEl.textContent = "Finish by feel.";
        } else if (!hiddenFromView) {
          clockEl.textContent = formatSeconds2(elapsed);
        }
        if (currentAttempt) currentAttempt.raf = requestAnimationFrame(frame);
      }
      currentAttempt.raf = requestAnimationFrame(frame);
      currentAttempt.cleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    function finishPhotoFinishAttempt(stage, games, startedAt, wasTabHidden) {
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      cancelCurrentAttempt();

      const invalid = elapsedSeconds < PHOTO_FINISH_MIN_VALID_SECONDS || wasTabHidden;
      profile.photoFinish.attempts += 1;

      if (invalid) {
        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p>That attempt didn't count. Try again.</p>
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPhotoFinishIdle(stage, games));
        persist();
        return;
      }

      const roundedElapsed = Math.round(elapsedSeconds * 100) / 100;
      const diff = Math.round(Math.abs(roundedElapsed - PHOTO_FINISH_TARGET_SECONDS) * 100) / 100;
      const gameScore = photoFinishScoreBand(diff);

      const priorPr = profile.photoFinish.personalRecord;
      const isNewPr = !priorPr || diff < priorPr.diffSeconds;
      if (isNewPr) {
        profile.photoFinish.personalRecord = { diffSeconds: diff, elapsedSeconds: roundedElapsed };
      }

      let pointsEarned = 0;
      if (!sessionAwardedFirstGame) {
        pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
        sessionAwardedFirstGame = true;
      }
      if (isNewPr) {
        // The "is this better than the stored record" gate above already
        // guarantees this branch runs at most once for this exact
        // attempt, so a fresh key per call is safe -- awardPoints() still
        // matters here for the one real thing it enforces on this path:
        // the daily point cap. The record itself is stored unconditionally
        // above regardless of the cap, matching the spec's "personal
        // records may still update after the cap is reached."
        pointsEarned += awardPoints(profile, `photo-finish-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
        track("podium_play_personal_record", { content_type: "game", content_id: "photo_finish" });
      }
      persist();
      renderProgress();
      track("podium_play_game_completed", { content_type: "game", content_id: "photo_finish", result_band: String(gameScore) });

      const resultLine = diff === 0
        ? `Perfect ${formatSeconds2(roundedElapsed)}. Exactly on target.`
        : diff <= 0.05
          ? `${formatSeconds2(roundedElapsed)}. Photo finish. Only ${formatSeconds2(diff)} away.`
          : `${formatSeconds2(roundedElapsed)}. Only ${formatSeconds2(diff)} away.`;
      const prLine = isNewPr ? "New personal record." : "Can you get closer?";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Photo Finish</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
        <p class="pp-pr">${escapeHtml(prLine)}</p>
        <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Play again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderPhotoFinishIdle(stage, games));
      announce(`${resultLine} ${prLine}`);
    }

    function openStartingGun() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "starting_gun" });
      renderStartingGunIdle(stage, games);
    }

    function renderStartingGunIdle(stage, games) {
      const pr = profile.startingGun.personalRecord;
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Wait for the gun. Tap as fast as you can.</p>
        ${pr ? `<p class="pp-pr">Personal record: ${Math.round(pr.reactionMs)}ms${pr.suspicious ? " (flagged for review)" : ""}</p>` : ""}
        ${profile.startingGun.falseStarts > 0 ? `<p class="pp-pr">False starts so far: ${profile.startingGun.falseStarts}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-ready>Ready</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-ready]").addEventListener("click", () => beginStartingGunSequence(stage, games));
    }

    // "On your marks" -> "Set" -> a real random 1.5-4.0s delay -> GO.
    // Any tap before GO is a false start; the single click listener below
    // (added once, not re-added per phase) just checks `phase`, avoiding
    // the churn of attaching/detaching a listener per state.
    function beginStartingGunSequence(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <button class="pp-tap-zone" type="button" data-pp-tap-zone aria-label="Tap when you see GO"><span data-pp-signal>On your marks.</span></button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const tapZone = stage.querySelector("[data-pp-tap-zone]");
      const signalEl = stage.querySelector("[data-pp-signal]");
      let phase = "waiting"; // "waiting": any tap is a false start. "go": timing a real reaction.
      let goAt = 0;
      let resolved = false; // guards against two click events (e.g. a fast double-tap) both resolving this one attempt.
      const timers = [];

      function schedule(fn, ms) {
        timers.push(setTimeout(fn, ms));
      }

      currentAttempt = { cleanup: () => { for (const id of timers) clearTimeout(id); } };

      schedule(() => {
        signalEl.textContent = "Set.";
        schedule(() => {
          schedule(() => {
            phase = "go";
            goAt = performance.now();
            tapZone.classList.add("pp-tap-zone-go");
            signalEl.textContent = "GO";
            // No sound, by explicit direction -- visual (color + text)
            // and vibration only. Color and text alone never reach a
            // screen reader (a live region is required, per this
            // project's own accessibility bar), so this announcement is
            // the one signal guaranteed to reach every visitor regardless
            // of device.
            announce("Go! Tap now.");
            navigator.vibrate?.(60);
          }, randomStartingGunDelayMs());
        }, STARTING_GUN_SET_MS);
      }, STARTING_GUN_ON_YOUR_MARKS_MS);

      tapZone.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        if (phase === "waiting") {
          handleFalseStart(stage, games);
          return;
        }
        handleStartingGunResult(stage, games, performance.now() - goAt);
      });
    }

    function handleFalseStart(stage, games) {
      cancelCurrentAttempt();
      profile.startingGun.falseStarts += 1;
      persist();
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result">False start.</p>
        <p class="pp-pr">Wait for the gun next time -- no points for this one.</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Try again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderStartingGunIdle(stage, games));
      announce("False start. Wait for the gun next time.");
    }

    function handleStartingGunResult(stage, games, reactionMs) {
      cancelCurrentAttempt();
      profile.startingGun.attempts += 1;

      const { score: gameScore, suspicious } = startingGunScoreBand(reactionMs);
      const priorPr = profile.startingGun.personalRecord;
      const isNewPr = !priorPr || reactionMs < priorPr.reactionMs;
      if (isNewPr) {
        profile.startingGun.personalRecord = { reactionMs, suspicious };
      }

      let pointsEarned = 0;
      if (!sessionAwardedFirstGame) {
        pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
        sessionAwardedFirstGame = true;
      }
      if (isNewPr) {
        // Same reasoning as Photo Finish's PR bonus: the "is this better"
        // gate above already limits this to at most once per attempt, so
        // a fresh key is safe -- awardPoints() still enforces the daily
        // cap here, which a direct profile.points += would have skipped.
        pointsEarned += awardPoints(profile, `starting-gun-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
        track("podium_play_personal_record", { content_type: "game", content_id: "starting_gun" });
      }
      persist();
      renderProgress();
      track("podium_play_game_completed", { content_type: "game", content_id: "starting_gun", result_band: String(gameScore) });

      const resultLine = `${Math.round(reactionMs)} milliseconds.`;
      const prLine = isNewPr ? "New personal record." : "Can you beat it?";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Starting Gun</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
        <p class="pp-pr">${escapeHtml(prLine)}${suspicious ? " (flagged for review before any public ranking)" : ""}</p>
        <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
        <button class="button button-primary pp-stage-action" type="button" data-pp-again>Try again</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-again]").addEventListener("click", () => renderStartingGunIdle(stage, games));
      announce(`${resultLine} ${prLine}`);
    }

    function openHurdleDash() {
      const stage = panel.querySelector("[data-pp-stage]");
      const games = panel.querySelector("[data-pp-games]");
      if (!stage) return;
      games.hidden = true;
      stage.hidden = false;
      track("podium_play_game_started", { content_type: "game", content_id: "hurdle_dash" });
      renderHurdleDashIdle(stage, games);
    }

    function renderHurdleDashIdle(stage, games) {
      const hd = profile.hurdleDash;
      const prParts = [];
      if (hd.bestDistance !== null) prParts.push(`Best distance: ${hd.bestDistance}`);
      if (hd.bestHurdlesCleared !== null) prParts.push(`Most hurdles cleared: ${hd.bestHurdlesCleared}`);
      if (hd.bestGameScore !== null) prParts.push(`Best score: ${hd.bestGameScore}`);
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <p>Tap to jump. Clear as many hurdles as you can.</p>
        ${prParts.length ? `<p class="pp-pr">${escapeHtml(prParts.join(" · "))}</p>` : ""}
        <button class="button button-primary pp-stage-action" type="button" data-pp-run>Start Running</button>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
      stage.querySelector("[data-pp-run]").addEventListener("click", () => startHurdleDashRun(stage, games));
    }

    // The one-touch endless runner. Real elapsed-time physics (never a
    // fixed-frame-rate assumption), a fixed internal coordinate system
    // (see the HURDLE_DASH_* config above) so an on-screen resize never
    // has to touch game state, and every cleanup path -- Back mid-run,
    // voting again mid-run, or the run ending naturally -- goes through
    // the exact same cancelCurrentAttempt() the other two games use.
    function startHurdleDashRun(stage, games) {
      stage.innerHTML = `
        <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
        <div class="pp-hd-stats" aria-hidden="true"><span data-pp-hd-distance>Distance: 0</span><span data-pp-hd-hurdles>Hurdles: 0</span></div>
        <div class="pp-hd-wrap">
          <canvas class="pp-hurdle-canvas" data-pp-hd-canvas width="${HURDLE_DASH_WIDTH}" height="${HURDLE_DASH_HEIGHT}" role="img" aria-label="Hurdle Dash game surface"></canvas>
          <div class="pp-hd-overlay" data-pp-hd-overlay hidden></div>
        </div>
        <p class="pp-hd-hint">Tap the track, or press Space or Enter, to jump.</p>
      `;
      stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));

      const canvas = stage.querySelector("[data-pp-hd-canvas]");
      const ctx = canvas.getContext("2d");
      const overlay = stage.querySelector("[data-pp-hd-overlay]");
      const distanceEl = stage.querySelector("[data-pp-hd-distance]");
      const hurdlesEl = stage.querySelector("[data-pp-hd-hurdles]");

      let raf = null;
      let resumeTimer = null;
      let lastFrameTime = null;
      let elapsedTotal = 0;
      let distance = 0;
      let hurdlesCleared = 0;
      let trophiesCollected = 0;
      let jumpStartedAt = null; // elapsedTotal value the current jump began at, or null when grounded
      let hurdles = [];
      let trophies = [];
      let distanceToNextHurdle = HURDLE_DASH_FIRST_HURDLE_DELAY_SECONDS * HURDLE_DASH_INITIAL_SPEED;
      let paused = false;
      let ended = false;

      function runnerRect() {
        const offset = jumpStartedAt === null ? 0 : hurdleDashJumpOffset(elapsedTotal - jumpStartedAt);
        return { x: HURDLE_DASH_RUNNER_X, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_RUNNER_HEIGHT - offset, width: HURDLE_DASH_RUNNER_WIDTH, height: HURDLE_DASH_RUNNER_HEIGHT };
      }

      function attemptJump() {
        if (ended || paused || jumpStartedAt !== null) return; // no double jump
        jumpStartedAt = elapsedTotal;
      }

      function draw() {
        ctx.clearRect(0, 0, HURDLE_DASH_WIDTH, HURDLE_DASH_HEIGHT);
        ctx.strokeStyle = "#dedede";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, HURDLE_DASH_GROUND_Y + 1);
        ctx.lineTo(HURDLE_DASH_WIDTH, HURDLE_DASH_GROUND_Y + 1);
        ctx.stroke();

        ctx.fillStyle = "#0faf68";
        for (const trophy of trophies) {
          ctx.beginPath();
          ctx.arc(trophy.x + HURDLE_DASH_TROPHY_SIZE / 2, trophy.y + HURDLE_DASH_TROPHY_SIZE / 2, HURDLE_DASH_TROPHY_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#a22b2b";
        for (const hurdle of hurdles) {
          const y = HURDLE_DASH_GROUND_Y - HURDLE_DASH_HURDLE_HEIGHT;
          ctx.fillRect(hurdle.x + HURDLE_DASH_HURDLE_WIDTH * 0.35, y, HURDLE_DASH_HURDLE_WIDTH * 0.3, HURDLE_DASH_HURDLE_HEIGHT);
          ctx.fillRect(hurdle.x, y, HURDLE_DASH_HURDLE_WIDTH, 6);
        }

        const r = runnerRect();
        ctx.fillStyle = "#090909";
        ctx.fillRect(r.x, r.y + 14, r.width, r.height - 14);
        ctx.beginPath();
        ctx.arc(r.x + r.width / 2, r.y + 9, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      function frame(now) {
        if (paused || ended) return;
        if (lastFrameTime === null) lastFrameTime = now;
        // Clamped so a delayed/backgrounded frame (or the instant after
        // the resume countdown ends) never causes a huge, unfair physics
        // jump -- distance and jump state advance as if no more than 50ms
        // ever passed in a single frame, however long it really took.
        const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
        lastFrameTime = now;
        elapsedTotal += dt;

        const speed = hurdleDashSpeedAtElapsed(elapsedTotal);
        const advance = speed * dt;
        distance += advance;
        distanceToNextHurdle -= advance;

        if (jumpStartedAt !== null && elapsedTotal - jumpStartedAt >= HURDLE_DASH_JUMP_DURATION_SECONDS) {
          jumpStartedAt = null;
        }

        for (const hurdle of hurdles) hurdle.x -= advance;
        for (const trophy of trophies) trophy.x -= advance;

        if (distanceToNextHurdle <= 0) {
          const gap = hurdleDashNextGap(speed);
          hurdles.push({ x: HURDLE_DASH_WIDTH, cleared: false });
          // A trophy roughly a third of the time, placed mid-gap so
          // collecting it is a bonus during the jump the player is
          // already making to clear the upcoming hurdle -- never a
          // separately-timed obstacle, and never requiring an otherwise
          // impossible jump.
          if (Math.random() < 0.35) {
            trophies.push({ x: HURDLE_DASH_WIDTH + gap / 2, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_RUNNER_HEIGHT - 6, collected: false });
          }
          distanceToNextHurdle = gap;
        }

        const runner = runnerRect();
        for (const hurdle of hurdles) {
          if (!hurdle.cleared && hurdle.x + HURDLE_DASH_HURDLE_WIDTH < runner.x) {
            hurdle.cleared = true;
            hurdlesCleared += 1;
          }
          const hurdleRect = { x: hurdle.x, y: HURDLE_DASH_GROUND_Y - HURDLE_DASH_HURDLE_HEIGHT, width: HURDLE_DASH_HURDLE_WIDTH, height: HURDLE_DASH_HURDLE_HEIGHT };
          if (rectsOverlap(runner, hurdleRect)) {
            endRun();
            return;
          }
        }
        for (const trophy of trophies) {
          if (trophy.collected) continue;
          const trophyRect = { x: trophy.x, y: trophy.y, width: HURDLE_DASH_TROPHY_SIZE, height: HURDLE_DASH_TROPHY_SIZE };
          if (rectsOverlap(runner, trophyRect)) {
            trophy.collected = true;
            trophiesCollected += 1;
          }
        }

        hurdles = hurdles.filter((h) => h.x + HURDLE_DASH_HURDLE_WIDTH > -20);
        trophies = trophies.filter((t) => !t.collected && t.x + HURDLE_DASH_TROPHY_SIZE > -20);

        distanceEl.textContent = `Distance: ${Math.round(distance)}`;
        hurdlesEl.textContent = `Hurdles: ${hurdlesCleared}`;

        draw();
        raf = requestAnimationFrame(frame);
      }

      function handlePointerDown(event) {
        event.preventDefault();
        attemptJump();
      }

      // A document-level listener (matching the spec's plain "Enter key
      // or Space key" requirement, not scoped to the canvas having focus)
      // -- but never hijacks Space/Enter while the visitor is actually
      // typing somewhere else on the page (the nomination form sits right
      // below this same panel).
      function handleKeydown(event) {
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        if (event.code === "Space" || event.key === "Enter") {
          event.preventDefault();
          attemptJump();
        }
      }

      function pauseRun() {
        if (paused || ended) return;
        paused = true;
        lastFrameTime = null; // so dt doesn't include the paused duration once resumed
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
        overlay.hidden = false;
        overlay.textContent = "Paused. Come back to this tab to continue.";
      }

      // A player must never return to the tab and be instantly hit by a
      // hurdle they had no chance to react to -- a real, visible 3-second
      // countdown always runs before play resumes.
      function beginResumeCountdown() {
        if (ended || !paused) return;
        let remaining = HURDLE_DASH_RESUME_COUNTDOWN_SECONDS;
        overlay.hidden = false;
        overlay.textContent = `Resuming in ${remaining}...`;
        resumeTimer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(resumeTimer);
            resumeTimer = null;
            overlay.hidden = true;
            paused = false;
            lastFrameTime = null;
            raf = requestAnimationFrame(frame);
          } else {
            overlay.textContent = `Resuming in ${remaining}...`;
          }
        }, 1000);
      }

      function handleVisibilityChange() {
        if (document.hidden) pauseRun();
        else if (paused) beginResumeCountdown();
      }

      canvas.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeydown);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // The single cleanup path, matching cancelCurrentAttempt()'s
      // contract -- called on Back mid-run, on voting again mid-run
      // (open() calls cancelCurrentAttempt() before rebuilding the
      // panel), and from endRun() below when the run ends naturally.
      currentAttempt = {
        cleanup: () => {
          ended = true;
          if (raf) cancelAnimationFrame(raf);
          if (resumeTimer) clearInterval(resumeTimer);
          canvas.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeydown);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      };

      function endRun() {
        cancelCurrentAttempt();
        profile.hurdleDash.attempts += 1;

        const roundedDistance = Math.round(distance);
        const gameScore = hurdleDashGameScore(roundedDistance, hurdlesCleared, trophiesCollected);
        const hd = profile.hurdleDash;
        const newDistancePr = hd.bestDistance === null || roundedDistance > hd.bestDistance;
        const newHurdlesPr = hd.bestHurdlesCleared === null || hurdlesCleared > hd.bestHurdlesCleared;
        const newScorePr = hd.bestGameScore === null || gameScore > hd.bestGameScore;
        if (newDistancePr) hd.bestDistance = roundedDistance;
        if (newHurdlesPr) hd.bestHurdlesCleared = hurdlesCleared;
        if (newScorePr) hd.bestGameScore = gameScore;
        const isNewPr = newDistancePr || newHurdlesPr || newScorePr;

        let pointsEarned = 0;
        if (!sessionAwardedFirstGame) {
          pointsEarned += awardPoints(profile, `first-game-${pageSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
          sessionAwardedFirstGame = true;
        }
        if (isNewPr) {
          pointsEarned += awardPoints(profile, `hurdle-dash-pr-${Date.now()}`, PERSONAL_RECORD_POINTS);
          track("podium_play_personal_record", { content_type: "game", content_id: "hurdle_dash" });
        }
        persist();
        renderProgress();
        track("podium_play_game_completed", { content_type: "game", content_id: "hurdle_dash", result_band: String(gameScore) });

        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const resultLine = `${roundedDistance} distance, ${hurdlesCleared} hurdle${hurdlesCleared === 1 ? "" : "s"} cleared${trophiesCollected > 0 ? `, ${trophiesCollected} troph${trophiesCollected === 1 ? "y" : "ies"}` : ""}.`;
        const prLine = isNewPr ? "New personal record." : "Can you beat it?";

        stage.innerHTML = `
          <div class="pp-stage-head"><h3>Hurdle Dash</h3><button class="pp-stage-close" type="button" data-pp-close aria-label="Back to games">Back</button></div>
          <p class="pp-result${isNewPr && !reduceMotion ? " pp-result-celebrate" : ""}">${escapeHtml(resultLine)}</p>
          <p class="pp-pr">${escapeHtml(prLine)}</p>
          <p class="pp-score">Score: ${gameScore}${pointsEarned > 0 ? ` &middot; +${pointsEarned} Podium Points` : ""}</p>
          <button class="button button-primary pp-stage-action" type="button" data-pp-again>Run again</button>
        `;
        stage.querySelector("[data-pp-close]").addEventListener("click", () => closeGameStage(stage, games));
        stage.querySelector("[data-pp-again]").addEventListener("click", () => renderHurdleDashIdle(stage, games));
        announce(`${resultLine} ${prLine}`);
      }

      draw();
      raf = requestAnimationFrame(frame);
    }

    // Renders the panel and wires everything ONCE, immediately -- games
    // are available for the whole page visit, not gated behind voting
    // (see the file header). A real vote succeeding later only ever
    // reveals/updates the cooldown-status sub-section (showVoteConfirmation
    // below); it never rebuilds this markup or touches an in-progress game.
    function renderPanel() {
      buildPanelMarkup();
      renderProgress();

      const voteAgainButton = panel.querySelector("[data-pp-vote-again]");
      voteAgainButton?.addEventListener("click", () => {
        track("podium_play_vote_again_clicked");
        panel.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
      });

      // Both games share this same try/catch shape -- a game failing to
      // open must never take voting down with it.
      function wireGameButton(gameId, openFn) {
        panel.querySelector(`[data-pp-play="${gameId}"]`)?.addEventListener("click", () => {
          try {
            openFn();
          } catch {
            const stage = panel.querySelector("[data-pp-stage]");
            if (stage) { stage.hidden = false; stage.innerHTML = "<p>This game had a problem loading. Voting still works as usual.</p>"; }
          }
        });
      }
      wireGameButton("photo-finish", openPhotoFinish);
      wireGameButton("starting-gun", openStartingGun);
      wireGameButton("hurdle-dash", openHurdleDash);

      track("podium_play_panel_viewed", { content_type: "award_type", content_id: root.dataset.awardType || "athlete" });
    }

    // Called on every confirmed vote (there can be more than one per page
    // visit, once each cooldown ends) -- reveals/updates the cooldown
    // status only. Deliberately does NOT call cancelCurrentAttempt(): a
    // game already in progress when a vote succeeds keeps running
    // uninterrupted, since games are no longer tied to the vote flow.
    function showVoteConfirmation(detail) {
      const { finalistName, retryAfterSeconds } = detail;

      const statusBlock = panel.querySelector("[data-pp-cooldown-status]");
      if (statusBlock) statusBlock.hidden = false;
      panel.dataset.cooldownTotal = String(retryAfterSeconds);

      const confirmedEl = panel.querySelector("[data-pp-confirmed]");
      if (confirmedEl) confirmedEl.textContent = finalistName ? `Your vote for ${finalistName} has been recorded.` : "Your vote has been recorded.";

      // A second vote (once an earlier cooldown already finished) must
      // re-hide Vote Again for the new cooldown -- showVoteAgain() below
      // only ever un-hides it, so this is the one place it's re-hidden.
      const voteAgainButton = panel.querySelector("[data-pp-vote-again]");
      if (voteAgainButton) voteAgainButton.hidden = true;

      cooldownDeadline = Date.now() + retryAfterSeconds * 1000;
      if (cooldownTimer) clearInterval(cooldownTimer);
      tickCountdown();
      cooldownTimer = setInterval(tickCountdown, 1000);
    }

    renderPanel();

    document.addEventListener("podiumwatch:vote-success", (event) => {
      try {
        showVoteConfirmation(event.detail || {});
      } catch {
        // The cooldown status failing to update must never affect the
        // vote that just succeeded, or the existing per-button cooldown
        // UI that weekly-awards.js already manages independently of this
        // file, or any game already in progress.
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-weekly-award]").forEach((root) => {
      try {
        initPanel(root);
      } catch {
        // Never let Podium Play's own init break the voting page.
      }
    });
  });
})();
