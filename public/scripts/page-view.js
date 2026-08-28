// Fires one "page_view" analytics event per browser session per page, for
// standalone public utility pages that are neither a team page nor an
// article (see install/30_ANALYTICS_PAGE_VIEW.sql). Self-contained rather
// than importing engagement.js, matching story-view.js's own reasoning:
// that script's activation is gated on team-page-specific state that
// doesn't apply here. Include with <script src="/scripts/page-view.js" defer></script>
// on any page that should count toward the admin Engagement Center's
// "Top pages" panel -- no other wiring needed, content_id is just
// whatever window.location.pathname already is.
(function () {
  "use strict";

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

    const path = window.location.pathname;

    // Once per browser tab session per page -- reloading or revisiting
    // the same page repeatedly in one sitting counts as one view, not
    // many, matching story_view's own dedupe rule.
    const viewKey = `podium_page_view_${path}_${sessionId}`;
    if (sessionStorage.getItem(viewKey)) return;
    sessionStorage.setItem(viewKey, "1");

    fetch("/api/engagement/track", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "page_view",
        visitor_id: visitorId,
        session_id: sessionId,
        section: "pages",
        content_type: "page",
        content_id: path,
        path
      })
    }).catch(() => {});
  } catch {
    // Analytics must never interrupt the page.
  }
})();
