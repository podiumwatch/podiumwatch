(() => {
  const loadingBox = document.querySelector("[data-admin-roster-loading]");
  const root = document.querySelector("[data-admin-roster]");
  const messageBox = document.querySelector("[data-admin-roster-message]");
  const searchForm = document.querySelector("[data-admin-roster-search-form]");
  const results = document.querySelector("[data-admin-roster-results]");
  const empty = document.querySelector("[data-admin-roster-empty]");
  const count = document.querySelector("[data-admin-roster-count]");

  if (!loadingBox || !root || !messageBox || !searchForm || !results || !empty || !count) {
    return;
  }

  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, type = "success") {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = type === "error"
      ? "rgba(220,38,38,.12)"
      : "rgba(0,191,99,.1)";
    messageBox.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;
    searchForm.querySelectorAll("button, input").forEach((element) => {
      element.disabled = value;
    });
  }

  async function apiFetch(payload) {
    const response = await fetch("/api/admin/team-rosters/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      window.location.replace("/admin/");
      throw new Error("Podium Watch admin sign in required.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Team rosters could not be loaded.");
    }

    return data;
  }

  function renderTeams(data) {
    const teams = Array.isArray(data.teams) ? data.teams : [];
    count.textContent = String(Number(data.count) || teams.length);
    empty.hidden = teams.length > 0;
    results.hidden = teams.length === 0;

    results.innerHTML = teams.map((team) => {
      const location = [team.city, team.state].filter(Boolean).join(", ");
      const seasonCounts = team.season_counts || {};
      const restrictions = [];

      if (team.editing_locked) restrictions.push("Editing locked");
      if (team.suspended) restrictions.push("Suspended");
      if (team.archived_at) restrictions.push("Archived");

      return (
        '<article class="admin-roster-card">' +
          '<div>' +
            '<h3>' + escapeHtml(team.school_name) + '</h3>' +
            '<p>' + escapeHtml([team.mascot, location].filter(Boolean).join(" | ")) + '</p>' +
            '<div class="admin-roster-badges">' +
              '<span class="admin-roster-badge">' + escapeHtml(`${Number(seasonCounts.total) || 0} seasons`) + '</span>' +
              '<span class="admin-roster-badge">' + escapeHtml(`${Number(seasonCounts.published) || 0} published`) + '</span>' +
              '<span class="admin-roster-badge admin-roster-badge-dark">' + (team.published ? "Public team" : "Private team") + '</span>' +
              restrictions.map((label) => '<span class="admin-roster-badge admin-roster-badge-dark">' + escapeHtml(label) + '</span>').join("") +
            '</div>' +
          '</div>' +
          '<a class="button button-primary" href="/team-roster/?id=' + encodeURIComponent(team.id) + '&admin=1">Manage roster</a>' +
        '</article>'
      );
    }).join("");
  }

  async function loadTeams(search = "") {
    try {
      setBusy(true);
      showMessage("Loading team roster access.");
      const data = await apiFetch({
        action: "search_teams",
        search,
        limit: 150
      });
      renderTeams(data);
      showMessage(data.limited
        ? "Showing the first 150 matching teams. Search for a narrower result."
        : `${Number(data.count) || 0} team profiles found.`
      );
      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      if (!root.hidden) {
        showMessage(error.message, "error");
      } else {
        loadingBox.innerHTML =
          "<h2>Admin roster manager unavailable</h2>" +
          "<p>" + escapeHtml(error.message || "The roster manager could not be loaded.") + "</p>" +
          '<p><a class="button button-primary" href="/admin/">Open admin sign in</a></p>';
      }
    } finally {
      setBusy(false);
    }
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!busy) {
      loadTeams(searchForm.elements.search.value);
    }
  });

  loadTeams();
})();
