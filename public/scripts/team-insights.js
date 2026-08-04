(() => {
  const loading = document.querySelector("[data-team-insights-loading]");
  const dashboard = document.querySelector("[data-team-insights]");
  const message = document.querySelector("[data-team-insights-message]");
  const name = document.querySelector("[data-team-insights-name]");
  const daysSelect = document.querySelector("[data-team-insights-days]");
  const followers = document.querySelector("[data-insight-followers]");
  const views = document.querySelector("[data-insight-views]");
  const visitors = document.querySelector("[data-insight-visitors]");
  const clicks = document.querySelector("[data-insight-clicks]");
  const emails = document.querySelector("[data-insight-emails]");
  const activity = document.querySelector("[data-insight-activity]");
  const sections = document.querySelector("[data-insight-sections]");
  const events = document.querySelector("[data-insight-events]");

  if (!loading || !dashboard || !message || !name || !daysSelect || !followers || !views || !visitors || !clicks || !emails || !activity || !sections || !events) {
    return;
  }

  const teamId = new URLSearchParams(window.location.search).get("id") || "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.hidden = !text;
    message.style.background = type === "error" ? "rgba(220,38,38,.12)" : "rgba(0,191,99,.12)";
    message.style.color = type === "error" ? "#991b1b" : "";
  }

  async function load() {
    if (!teamId) {
      loading.innerHTML = `<h2>Choose a team</h2><p>Open Team Insights from your team dashboard.</p><a class="button button-primary" href="/team-dashboard/">Team dashboard</a>`;
      return;
    }

    try {
      const token = await window.PodiumTeamAuth.getAccessToken();

      if (!token) {
        window.location.replace("/team-login/");
        return;
      }

      const response = await fetch("/api/team/insights", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          team_id: teamId,
          days: Number(daysSelect.value)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Team insights could not be loaded.");
      }

      const counts = data.analytics?.counts || {};
      const clickCount = ["social_click", "recruiting_click", "sponsor_click"].reduce((total, key) => total + Number(counts[key] || 0), 0);
      name.textContent = `${data.team.school_name} insights`;
      followers.textContent = String(data.follower_count || 0);
      views.textContent = String(counts.team_profile_view || 0);
      visitors.textContent = String(data.analytics?.unique_visitors || 0);
      clicks.textContent = String(clickCount);
      emails.textContent = String(data.delivery_summary?.sent || 0);

      const activityLabels = {
        team_profile_view: "Team profile views",
        schedule_view: "Schedule activity",
        roster_view: "Roster activity",
        content_view: "Content activity",
        social_click: "Social link clicks",
        recruiting_click: "Recruiting link clicks",
        sponsor_click: "Sponsor clicks",
        follow_submit: "Follow requests"
      };

      activity.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([key, count]) => `<div class="insights-row"><span>${escapeHtml(activityLabels[key] || key)}</span><strong>${escapeHtml(count)}</strong></div>`)
        .join("") || "<p>No tracked activity yet.</p>";

      sections.innerHTML = (data.analytics?.top_sections || [])
        .map((row) => `<div class="insights-row"><span>${escapeHtml(row.name)}</span><strong>${escapeHtml(row.count)}</strong></div>`)
        .join("") || "<p>No section activity yet.</p>";

      events.innerHTML = (data.notification_events || [])
        .map((event) => `<div class="insights-row"><span><strong>${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.category)} · ${new Date(event.created_at).toLocaleDateString()}</small></span><strong>${escapeHtml(event.status)}</strong></div>`)
        .join("") || "<p>No team alerts have been queued yet.</p>";

      loading.hidden = true;
      dashboard.hidden = false;
      showMessage("");
    } catch (error) {
      loading.hidden = true;
      dashboard.hidden = false;
      showMessage(error.message || "Team insights could not be loaded.");
    }
  }

  daysSelect.addEventListener("change", load);

  window.addEventListener("load", () => {
    window.PodiumTeamAuth.ready().then(load).catch((error) => {
      showMessage(error.message || "Team account could not be loaded.");
    });
  });
})();
