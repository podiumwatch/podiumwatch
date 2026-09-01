// Podium Play (Phase 1) -- a small arcade shown after a confirmed
// successful Athlete/Team of the Week vote, to give a visitor something
// to do during the real 45-second cooldown. Phase 1 ships the shell,
// guest persistence, points/levels, and one real game (Photo Finish).
// Starting Gun, Hurdle Dash, badges, streaks, daily challenges, sharing,
// the Instagram invite, and any server-side leaderboard are deliberately
// deferred to later phases rather than shipped as placeholders.
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
      soundEnabled: false,
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
      return {
        ...base,
        installId: typeof raw.installId === "string" && raw.installId ? raw.installId : base.installId,
        points: Number.isFinite(raw.points) ? Math.max(0, raw.points) : 0,
        pointsAwardedToday: raw.pointsAwardedToday && typeof raw.pointsAwardedToday.date === "string"
          ? { date: raw.pointsAwardedToday.date, amount: Math.max(0, Number(raw.pointsAwardedToday.amount) || 0) }
          : base.pointsAwardedToday,
        awardedKeys: Array.isArray(raw.awardedKeys) ? raw.awardedKeys.filter((key) => typeof key === "string").slice(-500) : [],
        photoFinish: { personalRecord: validPr, attempts: Number.isFinite(pr.attempts) ? Math.max(0, pr.attempts) : 0 },
        soundEnabled: raw.soundEnabled === true,
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
    let sessionAwardedFirstGame = false; // per-cooldown-session only, not persisted -- see file header.
    let currentAttempt = null; // { startedAt, raf, invalid }
    let panelShown = false;

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
        <div class="pp-header">
          <p class="pp-vote-confirmed" data-pp-confirmed></p>
          <div class="pp-cooldown-ring" data-pp-ring><span data-pp-countdown>Vote again in 45 seconds.</span></div>
        </div>
        <p class="visually-hidden" role="status" aria-live="polite" data-pp-live></p>
        <div class="pp-progress-row">
          <span><strong data-pp-points>0</strong> Podium Points</span>
          <span data-pp-level>Rookie Runner</span>
        </div>
        <p class="eyebrow">Play while you wait</p>
        <div class="pp-games" data-pp-games>
          <div class="pp-game-card" data-pp-game="photo-finish">
            <h3>Photo Finish</h3>
            <p>Stop the clock at exactly 15.00.</p>
            <button class="button button-primary" type="button" data-pp-play="photo-finish">Play</button>
          </div>
          <div class="pp-game-card pp-game-card-soon" aria-disabled="true">
            <h3>Starting Gun</h3>
            <p>Coming soon.</p>
          </div>
          <div class="pp-game-card pp-game-card-soon" aria-disabled="true">
            <h3>Hurdle Dash</h3>
            <p>Coming soon.</p>
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
        pointsEarned += awardPoints(profile, `first-game-${cooldownSessionKey}`, FIRST_GAME_IN_COOLDOWN_POINTS);
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

    let cooldownSessionKey = "";

    function open(detail) {
      const { finalistName, retryAfterSeconds } = detail;
      // A visitor can vote again (a new confirmed success, and so a new
      // vote-success event) while a Photo Finish attempt from the
      // previous cooldown is still actively running -- without this, the
      // old animation-frame loop and visibilitychange listener would
      // outlive the panel markup they were driving, which buildPanelMarkup
      // is about to replace out from under them.
      cancelCurrentAttempt();
      buildPanelMarkup();
      panel.hidden = false;
      panel.dataset.cooldownTotal = String(retryAfterSeconds);
      cooldownSessionKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionAwardedFirstGame = false;

      const confirmedEl = panel.querySelector("[data-pp-confirmed]");
      if (confirmedEl) confirmedEl.textContent = finalistName ? `Your vote for ${finalistName} has been recorded.` : "Your vote has been recorded.";

      renderProgress();

      cooldownDeadline = Date.now() + retryAfterSeconds * 1000;
      if (cooldownTimer) clearInterval(cooldownTimer);
      tickCountdown();
      cooldownTimer = setInterval(tickCountdown, 1000);

      const voteAgainButton = panel.querySelector("[data-pp-vote-again]");
      voteAgainButton?.addEventListener("click", () => {
        track("podium_play_vote_again_clicked");
        panel.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
      });

      const playButton = panel.querySelector('[data-pp-play="photo-finish"]');
      playButton?.addEventListener("click", () => {
        try {
          openPhotoFinish();
        } catch {
          // A game failing must never take voting down with it.
          const stage = panel.querySelector("[data-pp-stage]");
          if (stage) { stage.hidden = false; stage.innerHTML = "<p>This game had a problem loading. Voting still works as usual.</p>"; }
        }
      });

      if (!panelShown) {
        panelShown = true;
        track("podium_play_panel_viewed", { content_type: "award_type", content_id: root.dataset.awardType || "athlete" });
      }
    }

    document.addEventListener("podiumwatch:vote-success", (event) => {
      try {
        open(event.detail || {});
      } catch {
        // The panel failing to open must never affect the vote that just
        // succeeded, or the existing per-button cooldown UI that
        // weekly-awards.js already manages independently of this file.
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
