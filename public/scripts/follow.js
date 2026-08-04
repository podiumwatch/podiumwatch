(() => {
  const loading = document.querySelector("[data-follow-loading]");
  const content = document.querySelector("[data-follow-content]");
  const message = document.querySelector("[data-follow-message]");
  const emailHeading = document.querySelector("[data-follow-email]");
  const list = document.querySelector("[data-follow-list]");
  const empty = document.querySelector("[data-follow-empty]");
  const unsubscribeAll = document.querySelector("[data-follow-unsubscribe-all]");

  if (!loading || !content || !message || !emailHeading || !list || !empty || !unsubscribeAll) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const status = params.get("status") || "";
  const statusMessage = params.get("message") || "";
  let currentData = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.hidden = !text;
    message.style.background = type === "error"
      ? "rgba(220,38,38,.12)"
      : "rgba(0,191,99,.12)";
    message.style.color = type === "error" ? "#991b1b" : "";
  }

  async function api(body) {
    const response = await fetch("/api/followers/manage", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token, ...body })
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || "Notification settings could not be updated.");
    }

    return data;
  }

  function option(name, label, checked) {
    return `<label class="follow-option"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
  }

  function render(data) {
    currentData = data;
    const follows = Array.isArray(data.follows) ? data.follows : [];
    emailHeading.textContent = data.subscriber?.email || "Your followed teams";
    list.innerHTML = follows.map((follow) => {
      const team = follow.team || {};
      return `<form class="follow-card" data-follow-id="${escapeHtml(follow.id)}">
        <div>
          <p class="eyebrow">Team alerts</p>
          <h2>${escapeHtml(team.school_name || "Team")}</h2>
          <p>${escapeHtml([team.mascot, team.city, team.state].filter(Boolean).join(" · "))}</p>
        </div>
        <div class="follow-grid">
          <label><strong>Delivery</strong><select name="frequency" style="display:block;width:100%;margin-top:7px;padding:11px;border-radius:9px;font:inherit;"><option value="weekly" ${follow.frequency === "weekly" ? "selected" : ""}>Weekly recap</option><option value="immediate" ${follow.frequency === "immediate" ? "selected" : ""}>Immediate alerts</option></select></label>
          ${option("alert_schedule", "Schedule changes", follow.alert_schedule)}
          ${option("alert_roster", "Roster updates", follow.alert_roster)}
          ${option("alert_results", "Results", follow.alert_results)}
          ${option("alert_announcements", "Announcements", follow.alert_announcements)}
          ${option("alert_achievements", "Achievements", follow.alert_achievements)}
          ${option("alert_coverage", "Podium Watch coverage", follow.alert_coverage)}
          ${option("alert_media", "Photos and video", follow.alert_media)}
          ${option("alert_recruiting", "Recruiting updates", follow.alert_recruiting)}
          ${option("active", "Following this team", follow.active)}
        </div>
        <div class="follow-actions">
          <button class="button button-primary" type="submit">Save settings</button>
          <a class="button button-outline" href="/team/?slug=${encodeURIComponent(team.slug || "")}">Open team page</a>
        </div>
      </form>`;
    }).join("");

    empty.hidden = follows.length > 0;
    list.hidden = follows.length === 0;
    unsubscribeAll.hidden = follows.length === 0;

    list.querySelectorAll("form[data-follow-id]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        button.disabled = true;

        try {
          const updated = await api({
            action: "save_follow",
            follow_id: form.dataset.followId,
            frequency: formData.get("frequency"),
            active: formData.get("active") === "on",
            alert_schedule: formData.get("alert_schedule") === "on",
            alert_roster: formData.get("alert_roster") === "on",
            alert_results: formData.get("alert_results") === "on",
            alert_announcements: formData.get("alert_announcements") === "on",
            alert_achievements: formData.get("alert_achievements") === "on",
            alert_coverage: formData.get("alert_coverage") === "on",
            alert_media: formData.get("alert_media") === "on",
            alert_recruiting: formData.get("alert_recruiting") === "on"
          });
          render(updated);
          showMessage("Your notification settings were saved.");
        } catch (error) {
          showMessage(error.message, "error");
          button.disabled = false;
        }
      });
    });
  }

  unsubscribeAll.addEventListener("click", async () => {
    if (!window.confirm("Stop all Podium Watch team alerts for this email?")) {
      return;
    }

    unsubscribeAll.disabled = true;

    try {
      await api({ action: "unsubscribe_all" });
      currentData = null;
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      unsubscribeAll.hidden = true;
      showMessage("All team alerts have been stopped.");
    } catch (error) {
      showMessage(error.message, "error");
      unsubscribeAll.disabled = false;
    }
  });

  async function load() {
    if (status === "verified") {
      showMessage("Your email is confirmed. Team alerts are active.");
    } else if (status === "error") {
      showMessage(statusMessage || "The notification link is invalid.", "error");
    }

    if (!token) {
      loading.innerHTML = `<h2>Open your secure notification link</h2><p>Use the manage notifications link from a Podium Watch email. That link keeps follower settings private.</p><a class="button button-primary" href="/teams/">Browse teams</a>`;
      return;
    }

    try {
      const data = await api({ action: "get" });
      render(data);
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.innerHTML = `<h2>Notification link unavailable</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/teams/">Browse teams</a>`;
    }
  }

  load();
})();
