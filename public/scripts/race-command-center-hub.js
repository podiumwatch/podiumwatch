(() => {
  const loadingBox = document.querySelector("[data-rcc-loading]");
  const root = document.querySelector("[data-rcc-root]");
  const teamNameEl = document.querySelector("[data-rcc-team-name]");
  const accountEl = document.querySelector("[data-rcc-account]");
  const teamLink = document.querySelector("[data-rcc-team-link]");
  const messageBox = document.querySelector("[data-rcc-message]");
  const raceList = document.querySelector("[data-rcc-race-list]");
  const raceEmpty = document.querySelector("[data-rcc-race-empty]");
  const createForm = document.querySelector("[data-rcc-create-form]");
  const checkpointRows = document.querySelector("[data-rcc-checkpoint-rows]");
  const addCheckpointButton = document.querySelector("[data-rcc-add-checkpoint]");

  const requiredElements = [
    loadingBox, root, teamNameEl, accountEl, teamLink, messageBox,
    raceList, raceEmpty, createForm, checkpointRows, addCheckpointButton
  ];

  if (requiredElements.some((el) => !el)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = isError ? "rgba(220, 38, 38, 0.12)" : "rgba(0, 191, 99, 0.1)";
  }

  function parseResponse(response, fallback) {
    return response.json()
      .catch(() => ({}))
      .then((data) => {
        if (!response.ok) {
          throw new Error(data.error || fallback);
        }
        return data;
      });
  }

  async function apiFetch(endpoint, payload) {
    const accessToken = await window.PodiumTeamAuth.getAccessToken();

    if (!accessToken) {
      window.location.replace("/team-login/");
      throw new Error("Team account sign in required.");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken
      },
      body: JSON.stringify({ team_id: teamId, ...payload })
    });

    if (response.status === 401) {
      window.location.replace("/team-login/");
    }

    return parseResponse(response, "The request could not be completed.");
  }

  function addCheckpointRow(label, value) {
    const row = document.createElement("div");
    row.className = "rcc-checkpoint-row";
    row.innerHTML =
      '<label><strong>Label</strong><input type="text" class="rcc-cp-label" placeholder="Mile 1" value="' + escapeHtml(label || "") + '"></label>' +
      '<label><strong>Distance</strong><input type="number" step="0.01" min="0.01" class="rcc-cp-distance" value="' + escapeHtml(value || "") + '"></label>' +
      '<button type="button" class="button button-outline rcc-cp-remove">Remove</button>';
    row.querySelector(".rcc-cp-remove").addEventListener("click", () => row.remove());
    checkpointRows.appendChild(row);
  }

  addCheckpointButton.addEventListener("click", () => addCheckpointRow("", ""));

  const STATUS_LABELS = {
    draft: "Draft",
    scheduled: "Scheduled",
    live: "Live",
    finished: "Finished",
    reviewed: "Reviewed",
    cancelled: "Cancelled"
  };

  function statusBadgeClass(status) {
    if (status === "live") return "rcc-badge rcc-badge-live";
    if (status === "finished" || status === "reviewed") return "rcc-badge rcc-badge-finished";
    return "rcc-badge";
  }

  function actionLinkFor(session) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(session.id);
    if (session.status === "live") {
      return { href: "/race-command-center/live/" + idPart, label: "Open live timing" };
    }
    if (session.status === "finished" || session.status === "reviewed") {
      return { href: "/race-command-center/review/" + idPart, label: "View review" };
    }
    return { href: "/race-command-center/plan/" + idPart, label: "Open plan" };
  }

  function spectatorLinkFor(session) {
    return window.location.origin + "/race/?race=" + encodeURIComponent(session.id);
  }

  function renderRaces(sessions) {
    if (!sessions.length) {
      raceList.innerHTML = "";
      raceEmpty.hidden = false;
      return;
    }

    raceEmpty.hidden = true;
    raceList.innerHTML = sessions.map((session) => {
      const action = actionLinkFor(session);
      const checked = session.spectator_visible ? " checked" : "";
      return (
        '<div class="rcc-race-card" data-rcc-session-id="' + escapeHtml(session.id) + '">' +
          '<div class="rcc-header">' +
            '<h3>' + escapeHtml(session.name) + '</h3>' +
            '<span class="' + statusBadgeClass(session.status) + '">' + escapeHtml(STATUS_LABELS[session.status] || session.status) + '</span>' +
          '</div>' +
          '<p>' + escapeHtml(session.race_date) + ' &middot; ' + escapeHtml(String(session.distance_meters)) + 'm' + (session.race_type ? ' &middot; ' + escapeHtml(session.race_type) : '') + '</p>' +
          '<div class="rcc-actions">' +
            '<a class="button button-primary" href="' + action.href + '">' + action.label + '</a>' +
          '</div>' +
          '<div class="rcc-spectator-row">' +
            '<label><input type="checkbox" class="rcc-spectator-toggle"' + checked + '> Let parents watch this race live</label>' +
            '<div class="rcc-spectator-link"' + (session.spectator_visible ? '' : ' hidden') + '>' +
              '<input type="text" readonly value="' + escapeHtml(spectatorLinkFor(session)) + '">' +
              '<button type="button" class="button button-outline rcc-spectator-copy">Copy link</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    raceList.querySelectorAll(".rcc-spectator-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", async () => {
        const card = checkbox.closest("[data-rcc-session-id]");
        const sessionId = card.getAttribute("data-rcc-session-id");
        const linkRow = card.querySelector(".rcc-spectator-link");
        const wantVisible = checkbox.checked;
        checkbox.disabled = true;
        try {
          await apiFetch("/api/race-command-center/sessions/", {
            action: "update",
            session_id: sessionId,
            spectator_visible: wantVisible
          });
          linkRow.hidden = !wantVisible;
        } catch (error) {
          checkbox.checked = !wantVisible;
          showMessage(error.message || "That could not be saved.", true);
        } finally {
          checkbox.disabled = false;
        }
      });
    });

    raceList.querySelectorAll(".rcc-spectator-copy").forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.previousElementSibling;
        input.select();
        navigator.clipboard?.writeText(input.value).then(
          () => showMessage("Link copied."),
          () => {}
        );
      });
    });
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const formData = new FormData(createForm);
    const distanceValue = Number(formData.get("distance_value"));
    const unit = String(formData.get("distance_unit_display") || "miles");
    const unitMeters = unit === "miles" ? 1609.344 : (unit === "km" ? 1000 : 1);
    const distanceMeters = distanceValue * unitMeters;

    const checkpoints = [...checkpointRows.querySelectorAll(".rcc-checkpoint-row")].map((row) => {
      const label = row.querySelector(".rcc-cp-label").value;
      const distance = Number(row.querySelector(".rcc-cp-distance").value) * unitMeters;
      return { label, distanceMeters: distance };
    }).filter((c) => c.label && c.distanceMeters > 0);

    try {
      const data = await apiFetch("/api/race-command-center/sessions/", {
        action: "create",
        name: formData.get("name"),
        race_date: formData.get("race_date"),
        sport: formData.get("sport"),
        distance_meters: distanceMeters,
        distance_unit_display: unit,
        checkpoints
      });

      window.location.href = "/race-command-center/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(data.session.id);
    } catch (error) {
      showMessage(error.message || "The race could not be created.", true);
    }
  });

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Race Command Center not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      const user = await window.PodiumTeamAuth.getUser();

      if (!user) {
        window.location.replace("/team-login/");
        return;
      }

      accountEl.textContent = user.email || "Team account";

      const data = await apiFetch("/api/race-command-center/sessions/", { action: "list" });
      teamNameEl.textContent = data.team.school_name;
      teamLink.href = "/team/?slug=" + encodeURIComponent(data.team.slug);
      renderRaces(data.sessions);

      addCheckpointRow("Mile 1", "");
      addCheckpointRow("Mile 2", "");

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Race Command Center unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "Races could not be loaded.") + "</p>" +
        '<p><a class="button button-primary" href="/team-dashboard/">Return to dashboard</a></p>';
    }
  }

  initialize();
})();
