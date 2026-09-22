// Site-wide "who's here right now" heartbeat, for the admin Engagement
// Center's "Live now" tab -- a real-time companion to page-view.js's
// historical, once-per-session counting. Included on every page (see
// src/lib/html.mjs's layout(), alongside site.js) rather than only
// mock-meets pages, since the point is seeing current activity anywhere
// on the site, not just one section.
//
// Reuses page-view.js's exact visitor_id/session_id storage keys so the
// same browser tab has one consistent identity across both systems.
(function () {
  "use strict";

  const PING_INTERVAL_MS = 20000;

  try {
    let visitorId = localStorage.getItem("podium_visitor_id");
    if (!visitorId) {
      visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem("podium_visitor_id", visitorId);
    }

    let sessionId = sessionStorage.getItem("podium_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem("podium_session_id", sessionId);
    }

    function ping() {
      // A backgrounded tab isn't really "here" -- skipping it keeps the
      // live count matching what a person would actually call current
      // activity, not every stale tab someone forgot to close.
      if (document.visibilityState !== "visible") return;

      fetch("/api/presence/ping", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          session_id: sessionId,
          path: window.location.pathname
        })
      }).catch(() => {});
    }

    ping();
    setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ping();
    });
  } catch {
    // Presence must never interrupt the page.
  }
})();
