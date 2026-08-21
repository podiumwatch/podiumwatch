// Small reusable live-race poller (Team Workspace Phase Three). Used by
// the public /race/ page and (as of the live-tracking UX audit,
// docs/LIVE_TRACKING_UX_AUDIT.md) the guardian home page, for the same
// "watch a race update itself" behavior. Not a websocket/push system --
// "live" here means polling on a short interval while a race is
// actually in progress, backing off on error, and going quiet the
// moment the tab isn't visible or the race is over. See
// docs/DECISIONS.md, 2026-08-16.
window.PodiumRacePoll = (() => {
  const LIVE_INTERVAL_MS = 10000;
  const IDLE_INTERVAL_MS = 30000;
  const MAX_BACKOFF_MS = 60000;
  const DONE_STATUSES = new Set(["finished", "reviewed", "cancelled"]);

  // Defaults to the single-race shape the public /race/ page already
  // used (data.session.status). A caller whose response is shaped
  // differently -- guardian home's response is a whole LIST of races,
  // each with its own session -- supplies its own getStatus(data)
  // instead, returning "live" (poll fast), a DONE_STATUSES value (stop
  // outright -- rarely right for a multi-race dashboard that keeps
  // gaining new races over time), or anything else (poll at the idle
  // interval, never stopping).
  function watch({ fetchOnce, onData, onError, getStatus = (data) => data?.session?.status }) {
    let stopped = false;
    let timer = null;
    let backoffMs = 0;

    function scheduleNext(delayMs) {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(tick, delayMs);
    }

    async function tick() {
      if (stopped) return;

      if (document.hidden) {
        // Don't burn a request while nobody's looking -- just check
        // again shortly in case the tab becomes visible.
        scheduleNext(2000);
        return;
      }

      try {
        const data = await fetchOnce();
        backoffMs = 0;
        if (stopped) return;
        onData(data);

        const status = getStatus(data);

        if (DONE_STATUSES.has(status)) {
          stop();
          return;
        }

        const interval = status === "live" ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
        scheduleNext(interval);
      } catch (error) {
        if (stopped) return;
        onError(error);
        backoffMs = Math.min(backoffMs ? backoffMs * 2 : 3000, MAX_BACKOFF_MS);
        scheduleNext(backoffMs);
      }
    }

    function onVisibilityChange() {
      if (!document.hidden && !stopped) {
        // Coming back into view -- refresh right away rather than
        // waiting out whatever was left of the last interval.
        tick();
      }
    }

    function stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    tick();

    return { stop };
  }

  return { watch };
})();
