// Small reusable live-race poller (Team Workspace Phase Three). Used by
// the public /race/ page today; written generically enough for the
// guardian home page to reuse later for the same "watch a race update
// itself" behavior. Not a websocket/push system -- "live" here means
// polling on a short interval while a race is actually in progress,
// backing off on error, and going quiet the moment the tab isn't
// visible or the race is over. See docs/DECISIONS.md, 2026-08-16.
window.PodiumRacePoll = (() => {
  const LIVE_INTERVAL_MS = 10000;
  const IDLE_INTERVAL_MS = 30000;
  const MAX_BACKOFF_MS = 60000;
  const DONE_STATUSES = new Set(["finished", "reviewed", "cancelled"]);

  function watch({ fetchOnce, onData, onError }) {
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

        if (DONE_STATUSES.has(data?.session?.status)) {
          stop();
          return;
        }

        const interval = data?.session?.status === "live" ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
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
