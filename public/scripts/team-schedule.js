(() => {
  const loadingBox = document.querySelector("[data-team-schedule-loading]");
  const scheduleRoot = document.querySelector("[data-team-schedule]");
  const teamName = document.querySelector("[data-team-schedule-name]");
  const accountText = document.querySelector("[data-team-schedule-account]");
  const profileLink = document.querySelector("[data-team-schedule-profile]");
  const signOutButton = document.querySelector("[data-team-schedule-signout]");
  const messageBox = document.querySelector("[data-team-schedule-message]");
  const upcomingList = document.querySelector("[data-team-schedule-upcoming]");
  const upcomingEmpty = document.querySelector("[data-team-schedule-upcoming-empty]");
  const completedList = document.querySelector("[data-team-schedule-completed]");
  const completedEmpty = document.querySelector("[data-team-schedule-completed-empty]");
  const searchForm = document.querySelector("[data-team-meet-search-form]");
  const searchResults = document.querySelector("[data-team-meet-search-results]");
  const requestForm = document.querySelector("[data-team-meet-request-form]");
  const requestList = document.querySelector("[data-team-meet-request-list]");
  const requestEmpty = document.querySelector("[data-team-meet-request-empty]");
  const importForm = document.querySelector("[data-team-schedule-import-form]");
  const templateButton = document.querySelector("[data-team-schedule-template]");
  const importClearButton = document.querySelector("[data-team-schedule-import-clear]");
  const importSection = document.querySelector("[data-team-schedule-import-section]");
  const importPreview = document.querySelector("[data-team-schedule-import-preview]");
  const importCommitButton = document.querySelector("[data-team-schedule-import-commit]");
  const importCounts = {
    total: document.querySelector("[data-import-total]"),
    matched: document.querySelector("[data-import-matched]"),
    review: document.querySelector("[data-import-review]"),
    request: document.querySelector("[data-import-request]"),
    error: document.querySelector("[data-import-error]")
  };

  if (
    !loadingBox ||
    !scheduleRoot ||
    !teamName ||
    !accountText ||
    !profileLink ||
    !signOutButton ||
    !messageBox ||
    !upcomingList ||
    !upcomingEmpty ||
    !completedList ||
    !completedEmpty ||
    !searchForm ||
    !searchResults ||
    !requestForm ||
    !requestList ||
    !requestEmpty ||
    !importForm ||
    !templateButton ||
    !importClearButton ||
    !importSection ||
    !importPreview ||
    !importCommitButton ||
    Object.values(importCounts).some((item) => !item)
  ) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();

  let client = null;
  let currentData = null;
  let currentImport = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    const cleaned = String(value ?? "").trim();

    if (!cleaned) {
      return "";
    }

    try {
      const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
        ? cleaned
        : "https://" + cleaned;
      const url = new URL(prepared);

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
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
    scheduleRoot.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });

    if (!value) {
      importCommitButton.disabled = !currentImport?.canCommit;
    }
  }

  function formatDate(value) {
    if (!value) {
      return "Date not listed";
    }

    const date = new Date(value + "T12:00:00");

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function formatTime(value) {
    const cleaned = String(value || "").trim();

    if (!/^\d{2}:\d{2}/.test(cleaned)) {
      return "";
    }

    const [hours, minutes] = cleaned.split(":").map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function todayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function apiFetch(payload) {
    const accessToken = await window.PodiumTeamAuth.getAccessToken();

    if (!accessToken) {
      window.location.replace("/team-login/");
      throw new Error("Team account sign in required.");
    }

    const response = await fetch("/api/team/schedule/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken
      },
      body: JSON.stringify({
        team_id: teamId,
        ...payload
      })
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      if (client) {
        await client.auth.signOut();
      }
      window.location.replace("/team-login/");
      throw new Error("Your team account session expired.");
    }

    if (!response.ok) {
      throw new Error(data.error || "The schedule request could not be completed.");
    }

    return data;
  }

  function resultLink(connection) {
    const meet = connection.meet || {};
    return safeUrl(connection.results_url_override) ||
      safeUrl(meet.results_url) ||
      safeUrl(meet.athleticnet_url) ||
      safeUrl(meet.milesplit_url);
  }

  function renderConnectionCard(connection) {
    const meet = connection.meet || {};
    const location = [meet.venue_name, meet.city, meet.state]
      .filter(Boolean)
      .join(" · ");
    const resultsUrl = resultLink(connection);
    const meetCenterUrl = meet.slug
      ? "/meetdetail/?slug=" + encodeURIComponent(meet.slug)
      : "";

    return (
      '<article class="team-schedule-card">' +
        '<div class="team-schedule-badges">' +
          '<span class="team-schedule-badge">' + escapeHtml(meet.sport || "Meet") + '</span>' +
          '<span class="team-schedule-badge team-schedule-badge-dark">' + escapeHtml(connection.program_scope === "boys" ? "Boys" : connection.program_scope === "girls" ? "Girls" : "Boys and Girls") + '</span>' +
          (connection.published ? "" : '<span class="team-schedule-badge team-schedule-badge-warning">Hidden from public profile</span>') +
        '</div>' +
        '<h3>' + escapeHtml(meet.name || "Meet") + '</h3>' +
        '<p><strong>' + escapeHtml(formatDate(meet.meet_date)) + '</strong>' +
          (meet.start_time ? " at " + escapeHtml(formatTime(meet.start_time)) : "") +
        '</p>' +
        (location ? '<p>' + escapeHtml(location) + '</p>' : "") +
        (connection.schedule_note ? '<p class="team-schedule-note">' + escapeHtml(connection.schedule_note) + '</p>' : "") +
        '<div class="team-schedule-card-actions">' +
          (meetCenterUrl ? '<a class="button button-primary" href="' + meetCenterUrl + '">Meet Center</a>' : "") +
          (resultsUrl ? '<a class="button button-outline" href="' + escapeHtml(resultsUrl) + '" target="_blank" rel="noopener noreferrer">Results</a>' : "") +
          '<button class="button button-outline" type="button" data-edit-connection="' + escapeHtml(connection.id) + '">Edit</button>' +
          '<button class="button button-outline" type="button" data-remove-connection="' + escapeHtml(connection.id) + '">Remove</button>' +
        '</div>' +
        '<form class="team-schedule-form" data-connection-form="' + escapeHtml(connection.id) + '" hidden>' +
          '<div class="team-schedule-fields">' +
            '<label><strong>Program</strong><select name="program_scope">' +
              '<option value="combined"' + (connection.program_scope === "combined" ? " selected" : "") + '>Boys and Girls</option>' +
              '<option value="boys"' + (connection.program_scope === "boys" ? " selected" : "") + '>Boys</option>' +
              '<option value="girls"' + (connection.program_scope === "girls" ? " selected" : "") + '>Girls</option>' +
            '</select></label>' +
            '<label><strong>Sport</strong><select name="sport_scope">' +
              '<option value="All"' + (connection.sport_scope === "All" ? " selected" : "") + '>All</option>' +
              '<option value="Cross Country"' + (connection.sport_scope === "Cross Country" ? " selected" : "") + '>Cross Country</option>' +
              '<option value="Track and Field"' + (connection.sport_scope === "Track and Field" ? " selected" : "") + '>Track and Field</option>' +
            '</select></label>' +
            '<label><strong>Results override</strong><input type="url" name="results_url_override" value="' + escapeHtml(connection.results_url_override || "") + '"></label>' +
            '<label><strong>Sort order</strong><input type="number" name="sort_order" min="-999" max="999" value="' + escapeHtml(connection.sort_order || 0) + '"></label>' +
          '</div>' +
          '<label><strong>Schedule note</strong><textarea name="schedule_note" rows="3">' + escapeHtml(connection.schedule_note || "") + '</textarea></label>' +
          '<label><input type="checkbox" name="published"' + (connection.published ? " checked" : "") + '> Show on the public team profile</label>' +
          '<button class="button button-primary" type="submit">Save schedule details</button>' +
        '</form>' +
      '</article>'
    );
  }

  function renderSchedule() {
    const connections = Array.isArray(currentData?.connections)
      ? currentData.connections
      : [];
    const today = todayDate();
    const sorted = [...connections].sort((a, b) => {
      return String(a.meet?.meet_date || "").localeCompare(String(b.meet?.meet_date || ""));
    });
    const upcoming = sorted.filter((item) => String(item.meet?.meet_date || "") >= today);
    const completed = sorted.filter((item) => String(item.meet?.meet_date || "") < today).reverse();

    upcomingList.innerHTML = upcoming.map(renderConnectionCard).join("");
    completedList.innerHTML = completed.map(renderConnectionCard).join("");
    upcomingEmpty.hidden = upcoming.length > 0;
    completedEmpty.hidden = completed.length > 0;
  }

  function renderRequests() {
    const requests = Array.isArray(currentData?.requests)
      ? currentData.requests
      : [];

    requestEmpty.hidden = requests.length > 0;
    requestList.innerHTML = requests.map((request) => {
      const canCancel = ["pending", "reviewing"].includes(request.status);
      const statusLabels = {
        pending: "Pending review",
        reviewing: "Under review",
        approved: "Approved",
        rejected: "Not approved",
        duplicate: "Duplicate",
        cancelled: "Cancelled"
      };

      return (
        '<article class="team-schedule-request-card">' +
          '<div class="team-schedule-badges">' +
            '<span class="team-schedule-badge ' + (["rejected", "cancelled"].includes(request.status) ? "team-schedule-badge-error" : request.status === "reviewing" ? "team-schedule-badge-warning" : "") + '">' +
              escapeHtml(statusLabels[request.status] || request.status) +
            '</span>' +
          '</div>' +
          '<h3>' + escapeHtml(request.meet_name) + '</h3>' +
          '<p><strong>' + escapeHtml(formatDate(request.meet_date)) + '</strong></p>' +
          (request.venue_name || request.city ? '<p>' + escapeHtml([request.venue_name, request.city, request.state].filter(Boolean).join(" · ")) + '</p>' : "") +
          (request.admin_notes ? '<p class="team-schedule-note"><strong>Podium Watch note:</strong> ' + escapeHtml(request.admin_notes) + '</p>' : "") +
          (canCancel ? '<button class="button button-outline" type="button" data-cancel-request="' + escapeHtml(request.id) + '">Cancel request</button>' : "") +
        '</article>'
      );
    }).join("");
  }

  function renderSearchResults(meets) {
    const rows = Array.isArray(meets) ? meets : [];

    if (rows.length === 0) {
      searchResults.innerHTML = '<div class="team-schedule-empty">No matching Meet Center pages were found.</div>';
      return;
    }

    const connectedMeetIds = new Set(
      (currentData?.connections || []).map((item) => item.meet_id)
    );

    searchResults.innerHTML = rows.map((meet) => {
      const connected = connectedMeetIds.has(meet.id);
      const location = [meet.venue_name, meet.city, meet.state].filter(Boolean).join(" · ");

      return (
        '<article class="team-schedule-search-card">' +
          '<div class="team-schedule-badges">' +
            '<span class="team-schedule-badge">' + escapeHtml(meet.sport || "Meet") + '</span>' +
            (meet.featured ? '<span class="team-schedule-badge team-schedule-badge-dark">Featured</span>' : "") +
          '</div>' +
          '<h3>' + escapeHtml(meet.name) + '</h3>' +
          '<p><strong>' + escapeHtml(formatDate(meet.meet_date)) + '</strong></p>' +
          (location ? '<p>' + escapeHtml(location) + '</p>' : "") +
          '<div class="team-schedule-card-actions">' +
            '<a class="button button-outline" href="/meetdetail/?slug=' + encodeURIComponent(meet.slug) + '">Open Meet Center</a>' +
            (connected
              ? '<span class="team-schedule-badge">Already connected</span>'
              : '<button class="button button-primary" type="button" data-connect-meet="' + escapeHtml(meet.id) + '">Add to schedule</button>') +
          '</div>' +
        '</article>'
      );
    }).join("");
  }

  function parseCsv(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      const next = input[index + 1];

      if (quoted) {
        if (character === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && next === "\n") {
          index += 1;
        }
        row.push(field);
        field = "";
        if (row.some((value) => String(value).trim())) {
          rows.push(row);
        }
        row = [];
      } else {
        field += character;
      }
    }

    if (quoted) {
      throw new Error("The CSV contains an unfinished quoted field.");
    }

    if (field || row.length) {
      row.push(field);
      if (row.some((value) => String(value).trim())) {
        rows.push(row);
      }
    }

    if (rows.length < 2) {
      throw new Error("The CSV needs a heading row and at least one meet.");
    }

    const headers = rows[0].map((item) => String(item).trim());

    return rows.slice(1).map((values) => {
      const result = {};
      headers.forEach((header, index) => {
        if (header) {
          result[header] = values[index] ?? "";
        }
      });
      return result;
    }).filter((item) => Object.values(item).some((value) => String(value).trim()));
  }

  function renderImport(data) {
    const summary = data.summary || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];

    Object.entries(importCounts).forEach(([key, element]) => {
      element.textContent = String(Number(summary[key]) || 0);
    });

    importPreview.innerHTML = rows.map((row) => {
      const labels = {
        matched: "Matched",
        review: "Needs review",
        request: "New request",
        error: "Error"
      };
      const badgeClass = row.status === "error"
        ? "team-schedule-badge-error"
        : row.status === "review"
          ? "team-schedule-badge-warning"
          : row.status === "matched"
            ? ""
            : "team-schedule-badge-dark";

      return (
        '<article class="team-schedule-import-row">' +
          '<div class="team-schedule-badges">' +
            '<span class="team-schedule-badge ' + badgeClass + '">' + escapeHtml(labels[row.status] || row.status) + '</span>' +
            '<span class="team-schedule-badge">CSV row ' + escapeHtml(row.row_number) + '</span>' +
          '</div>' +
          '<h3>' + escapeHtml(row.meet_name || "Unnamed meet") + '</h3>' +
          '<p>' + escapeHtml(formatDate(row.meet_date)) + '</p>' +
          (row.matched_meet_name ? '<p><strong>Best Meet Center match:</strong> ' + escapeHtml(row.matched_meet_name) + '</p>' : "") +
          ((row.errors || []).length ? '<p class="team-schedule-note">' + escapeHtml(row.errors.join(" ")) + '</p>' : "") +
        '</article>'
      );
    }).join("");

    importSection.hidden = false;
    importCommitButton.disabled = rows.length === 0 || Number(summary.error || 0) === rows.length;
  }

  async function loadSchedule() {
    currentData = await apiFetch({ action: "get" });
    teamName.textContent = currentData.team.school_name;
    accountText.textContent = currentData.membership.role === "owner"
      ? "You have owner access to this schedule."
      : "You have editor access to this schedule.";
    profileLink.href = "/team/?slug=" + encodeURIComponent(currentData.team.slug) + (currentData.team.published ? "" : "&preview=1");
    renderSchedule();
    renderRequests();
  }

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Team not selected</h2><p>Open the schedule from your team dashboard.</p>";
      return;
    }

    try {
      client = await window.PodiumTeamAuth.getClient();
      const user = await window.PodiumTeamAuth.getUser();

      if (!user) {
        window.location.replace("/team-login/");
        return;
      }

      await loadSchedule();
      loadingBox.hidden = true;
      scheduleRoot.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<h2>Schedule unavailable</h2><p>" + escapeHtml(error.message || "The team schedule could not be loaded.") + "</p>";
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(searchForm);

    try {
      setBusy(true);
      showMessage("Searching Meet Center.");
      const data = await apiFetch({
        action: "search_meets",
        query: formData.get("query"),
        meet_date: formData.get("meet_date"),
        sport: formData.get("sport")
      });
      renderSearchResults(data.meets);
      showMessage((data.meets || []).length + " Meet Center pages found.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  searchResults.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-connect-meet]");
    if (!button || busy) return;

    try {
      setBusy(true);
      await apiFetch({
        action: "connect",
        meet_id: button.dataset.connectMeet,
        published: true
      });
      await loadSchedule();
      button.replaceWith(Object.assign(document.createElement("span"), {
        className: "team-schedule-badge",
        textContent: "Already connected"
      }));
      showMessage("The meet was added to the team schedule.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  scheduleRoot.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-connection]");
    const removeButton = event.target.closest("[data-remove-connection]");
    const cancelButton = event.target.closest("[data-cancel-request]");

    if (editButton) {
      const form = scheduleRoot.querySelector('[data-connection-form="' + CSS.escape(editButton.dataset.editConnection) + '"]');
      if (form) {
        form.hidden = !form.hidden;
      }
      return;
    }

    if (removeButton && !busy) {
      if (!window.confirm("Remove this meet from the team schedule?")) return;
      try {
        setBusy(true);
        await apiFetch({
          action: "disconnect",
          connection_id: removeButton.dataset.removeConnection
        });
        await loadSchedule();
        showMessage("The meet was removed from the team schedule.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (cancelButton && !busy) {
      if (!window.confirm("Cancel this meet request?")) return;
      try {
        setBusy(true);
        await apiFetch({
          action: "cancel_request",
          request_id: cancelButton.dataset.cancelRequest
        });
        await loadSchedule();
        showMessage("The meet request was cancelled.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  scheduleRoot.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-connection-form]");
    if (!form) return;
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(form);

    try {
      setBusy(true);
      await apiFetch({
        action: "update_connection",
        connection_id: form.dataset.connectionForm,
        program_scope: formData.get("program_scope"),
        sport_scope: formData.get("sport_scope"),
        results_url_override: formData.get("results_url_override"),
        sort_order: formData.get("sort_order"),
        schedule_note: formData.get("schedule_note"),
        published: formData.get("published") === "on"
      });
      await loadSchedule();
      showMessage("Schedule details were saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const payload = Object.fromEntries(new FormData(requestForm).entries());

    try {
      setBusy(true);
      const data = await apiFetch({ action: "request_meet", ...payload });
      requestForm.reset();
      requestForm.elements.state.value = "Ohio";
      await loadSchedule();
      showMessage(data.duplicate
        ? "A matching request is already awaiting review."
        : "The meet was submitted to Podium Watch for review.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const file = importForm.elements.schedule_file?.files?.[0];
    if (!file) {
      showMessage("Choose a schedule CSV first.", "error");
      return;
    }

    try {
      setBusy(true);
      const rows = parseCsv(await file.text());
      currentImport = {
        rows,
        fileName: file.name,
        canCommit: false
      };
      const data = await apiFetch({
        action: "import_preview",
        rows
      });
      currentImport.canCommit =
        Number(data.summary?.matched || 0) +
        Number(data.summary?.review || 0) +
        Number(data.summary?.request || 0) > 0;
      renderImport(data);
      showMessage("Review the schedule matches before importing.");
    } catch (error) {
      currentImport = null;
      importSection.hidden = true;
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  importCommitButton.addEventListener("click", async () => {
    if (busy || !currentImport) return;
    if (!window.confirm("Connect matched meets and submit the remaining rows for review?")) return;

    try {
      setBusy(true);
      const data = await apiFetch({
        action: "import_commit",
        confirm: true,
        rows: currentImport.rows
      });
      currentImport = null;
      importSection.hidden = true;
      importForm.reset();
      await loadSchedule();
      showMessage(
        "Schedule import complete. " +
        Number(data.summary?.connected || 0) +
        " meets connected and " +
        Number(data.summary?.requested || 0) +
        " meets submitted for review."
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  importClearButton.addEventListener("click", () => {
    if (busy) return;
    currentImport = null;
    importForm.reset();
    importSection.hidden = true;
    importPreview.innerHTML = "";
    Object.values(importCounts).forEach((element) => {
      element.textContent = "0";
    });
    showMessage("");
  });

  templateButton.addEventListener("click", () => {
    const csv = [
      "Meet Name,Meet Date,Sport,Start Time,Venue Name,Address,City,State,Meet Website,Results URL,Notes",
      "Example Invitational,2026-09-05,Cross Country,09:00,Example Park,100 Main Street,Example City,Ohio,https://example.com,,"
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "podium-watch-team-schedule-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  signOutButton.addEventListener("click", async () => {
    if (client) {
      await client.auth.signOut();
    }
    window.location.replace("/team-login/");
  });

  initialize();
})();
