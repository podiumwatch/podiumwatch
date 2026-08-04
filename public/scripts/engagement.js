(() => {
  const teamFollowSection = document.querySelector("[data-team-follow-section]");
  const teamSponsorSection = document.querySelector("[data-team-sponsor-section]");
  const teamSponsorList = document.querySelector("[data-team-sponsor-list]");
  const directorySponsorSection = document.querySelector("[data-directory-sponsor-section]");
  const directorySponsorList = document.querySelector("[data-directory-sponsor-list]");

  if (!teamFollowSection && !teamSponsorSection && !directorySponsorSection) {
    return;
  }

  const pageType = window.location.pathname.startsWith("/teams") ? "directory" : "team";
  const slug = new URLSearchParams(window.location.search).get("slug") || "";
  let publicData = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getStoredId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return "";
    }
  }

  const visitorId = getStoredId(localStorage, "podium_visitor_id");
  const sessionId = getStoredId(sessionStorage, "podium_session_id");

  async function track(eventType, details = {}) {
    if (!publicData?.analytics_enabled) {
      return;
    }

    try {
      await fetch("/api/engagement/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          team_id: publicData.team?.id || null,
          visitor_id: visitorId,
          session_id: sessionId,
          path: window.location.pathname + window.location.search,
          referrer: document.referrer,
          ...details
        })
      });
    } catch {
      // Analytics must never interrupt the page.
    }
  }

  function sponsorCard(placement) {
    const sponsor = placement.sponsor || {};
    const image = placement.image_url || sponsor.logo_url || "";
    return `<article class="engagement-sponsor-card" data-sponsor-id="${escapeHtml(sponsor.id || "")}" data-placement-id="${escapeHtml(placement.id)}">
      <div class="engagement-sponsor-label">Sponsored</div>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(sponsor.name || "Sponsor")}" loading="lazy">` : ""}
      <div>
        <h3>${escapeHtml(placement.headline || sponsor.name || "Podium Watch Partner")}</h3>
        ${placement.body_text || sponsor.description ? `<p>${escapeHtml(placement.body_text || sponsor.description)}</p>` : ""}
        <a class="button button-outline" href="${escapeHtml(placement.destination_url)}" target="_blank" rel="noopener sponsored" data-sponsor-link>${escapeHtml(placement.button_label || "Learn more")}</a>
      </div>
    </article>`;
  }

  function renderSponsors(placements) {
    const list = pageType === "directory" ? directorySponsorList : teamSponsorList;
    const section = pageType === "directory" ? directorySponsorSection : teamSponsorSection;

    if (!list || !section || !placements.length) {
      if (section) section.hidden = true;
      return;
    }

    list.innerHTML = placements.map(sponsorCard).join("");
    section.hidden = false;

    list.querySelectorAll("[data-placement-id]").forEach((card) => {
      const impressionKey = `podium_sponsor_impression_${card.dataset.placementId}_${new Date().toISOString().slice(0, 10)}`;
      let shouldTrack = true;
      try {
        shouldTrack = !localStorage.getItem(impressionKey);
        if (shouldTrack) localStorage.setItem(impressionKey, "1");
      } catch {
        shouldTrack = true;
      }

      if (shouldTrack) {
        track("sponsor_impression", {
          sponsor_id: card.dataset.sponsorId || null,
          content_id: card.dataset.placementId,
          section: pageType
        });
      }

      card.querySelector("[data-sponsor-link]")?.addEventListener("click", (event) => {
        track("sponsor_click", {
          sponsor_id: card.dataset.sponsorId || null,
          content_id: card.dataset.placementId,
          section: pageType,
          target_url: event.currentTarget.href
        });
      });
    });
  }

  function renderFollow() {
    if (!teamFollowSection || !publicData?.team) {
      return;
    }

    const count = Number(publicData.follower_count) || 0;

    if (!publicData.following_enabled) {
      teamFollowSection.innerHTML = `<p class="eyebrow">Team alerts</p><h2>Follow this team</h2><p>Team alerts are being prepared. Check back after Podium Watch finishes notification testing.</p>`;
      teamFollowSection.hidden = false;
      return;
    }

    teamFollowSection.innerHTML = `
      <div class="engagement-follow-copy">
        <p class="eyebrow">Team alerts</p>
        <h2>Follow ${escapeHtml(publicData.team.school_name)}</h2>
        <p>Get schedule changes, results, announcements, roster updates, achievements, and Podium Watch coverage.</p>
        <p><strong>${escapeHtml(count)}</strong> ${count === 1 ? "person follows" : "people follow"} this team.</p>
      </div>
      <form class="engagement-follow-form" data-engagement-follow-form>
        <label><strong>Email address</strong><input type="email" name="email" required autocomplete="email"></label>
        <label><strong>Delivery</strong><select name="frequency"><option value="weekly">Weekly recap</option><option value="immediate">Immediate alerts</option></select></label>
        <label class="engagement-follow-check"><input type="checkbox" name="results" checked> Results and announcements</label>
        <label class="engagement-follow-check"><input type="checkbox" name="schedule" checked> Schedule and roster updates</label>
        <label class="engagement-follow-check"><input type="checkbox" name="coverage" checked> Podium Watch coverage</label>
        <label class="engagement-follow-honeypot" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <button class="button button-primary" type="submit">Follow team</button>
        <p class="engagement-follow-privacy">A confirmation email is required. You can unsubscribe at any time. See the <a href="/privacy/">privacy page</a>.</p>
        <p class="engagement-follow-message" data-engagement-follow-message hidden></p>
      </form>`;
    teamFollowSection.hidden = false;

    const form = teamFollowSection.querySelector("[data-engagement-follow-form]");
    const formMessage = teamFollowSection.querySelector("[data-engagement-follow-message]");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      button.disabled = true;
      formMessage.hidden = true;

      try {
        const response = await fetch("/api/followers/subscribe", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            team_id: publicData.team.id,
            email: formData.get("email"),
            frequency: formData.get("frequency"),
            website: formData.get("website"),
            preferences: {
              results: formData.get("results") === "on",
              announcements: formData.get("results") === "on",
              achievements: formData.get("results") === "on",
              schedule: formData.get("schedule") === "on",
              roster: formData.get("schedule") === "on",
              coverage: formData.get("coverage") === "on"
            }
          })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "The follow request could not be completed.");
        }

        form.reset();
        formMessage.textContent = data.already_following
          ? `Check your email for the secure link to manage ${data.team_name} alerts.`
          : `Check your email to confirm ${data.team_name} alerts.`;
        formMessage.hidden = false;
        track("follow_submit", { section: "follow_form" });
      } catch (error) {
        formMessage.textContent = error.message;
        formMessage.hidden = false;
        formMessage.style.color = "#991b1b";
      } finally {
        button.disabled = false;
      }
    });
  }

  function attachActivityTracking() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || !publicData?.team) return;

      if (link.matches(".team-profile-social-link")) {
        track("social_click", { section: "social", target_url: link.href });
      } else if (link.closest("[data-team-schedule-section]")) {
        track("schedule_view", { section: "schedule", target_url: link.href });
      } else if (link.closest("[data-team-roster-section]")) {
        track("roster_view", { section: "roster", target_url: link.href });
      } else if (link.closest("[data-team-content-recruiting-section]")) {
        track("recruiting_click", { section: "recruiting", target_url: link.href });
      } else if (link.closest("[data-team-content-featured-section], [data-team-content-announcements-section], [data-team-content-results-section], [data-team-content-achievements-section], [data-team-content-coverage-section], [data-team-content-media-section]")) {
        track("content_view", { section: "content", target_url: link.href });
      }
    });
  }

  async function load() {
    try {
      const response = await fetch("/api/engagement/public", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ slug, page: pageType })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Engagement features could not be loaded.");
      }

      publicData = data;
      renderSponsors(Array.isArray(data.placements) ? data.placements : []);
      renderFollow();
      attachActivityTracking();

      if (pageType === "team" && data.team) {
        const viewKey = `podium_team_view_${data.team.id}_${sessionId}`;
        let shouldTrack = true;
        try {
          shouldTrack = !sessionStorage.getItem(viewKey);
          if (shouldTrack) sessionStorage.setItem(viewKey, "1");
        } catch {
          shouldTrack = true;
        }
        if (shouldTrack) track("team_profile_view", { section: "profile" });
      } else if (pageType === "directory") {
        track("directory_view", { section: "directory" });
      }
    } catch {
      if (teamFollowSection) teamFollowSection.hidden = true;
      if (teamSponsorSection) teamSponsorSection.hidden = true;
      if (directorySponsorSection) directorySponsorSection.hidden = true;
    }
  }

  load();
})();
