// Fires one "story_view" analytics event per browser session per article,
// from every /stories/{slug}/ page (added unconditionally in storyPage(),
// scripts/build.mjs -- not just the preseason articles). Self-contained
// rather than importing engagement.js, matching pace-calculator.js's own
// tracking block: that script's activation and its /api/engagement/public
// call are both gated on team-page-specific state that doesn't apply here.
(function () {
  "use strict";

  const article = document.querySelector("[data-story-slug]");
  if (!article) return;
  const slug = article.getAttribute("data-story-slug");
  if (!slug) return;

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

    // Once per browser tab session per article -- rereading or reloading
    // the same story repeatedly in one sitting counts as one view, not
    // many, matching how pace_calculator_use and team_profile_view dedupe.
    const viewKey = `podium_story_view_${slug}_${sessionId}`;
    if (sessionStorage.getItem(viewKey)) return;
    sessionStorage.setItem(viewKey, "1");

    fetch("/api/engagement/track", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "story_view",
        visitor_id: visitorId,
        session_id: sessionId,
        section: "stories",
        content_type: "story",
        content_id: slug,
        path: window.location.pathname
      })
    }).catch(() => {});
  } catch {
    // Analytics must never interrupt the article.
  }
})();
