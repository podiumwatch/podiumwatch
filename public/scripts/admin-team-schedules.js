(() => {
  const loadingBox = document.querySelector("[data-admin-schedule-loading]");
  const root = document.querySelector("[data-admin-schedule]");
  const messageBox = document.querySelector("[data-admin-schedule-message]");
  const refreshButton = document.querySelector("[data-admin-schedule-refresh]");
  const requestStatus = document.querySelector("[data-admin-request-status]");
  const requestList = document.querySelector("[data-admin-request-list]");
  const requestEmpty = document.querySelector("[data-admin-request-empty]");
  const teamSearchForm = document.querySelector("[data-admin-team-search-form]");
  const teamResults = document.querySelector("[data-admin-team-results]");
  const meetSearchForm = document.querySelector("[data-admin-meet-search-form]");
  const meetResults = document.querySelector("[data-admin-meet-results]");
  const connectForm = document.querySelector("[data-admin-connect-form]");
  const selectionSummary = document.querySelector("[data-admin-selection-summary]");
  const connectionList = document.querySelector("[data-admin-connection-list]");
  const connectionEmpty = document.querySelector("[data-admin-connection-empty]");
  const countPending = document.querySelector("[data-admin-count-pending]");
  const countReviewing = document.querySelector("[data-admin-count-reviewing]");
  const countConnections = document.querySelector("[data-admin-count-connections]");

  if (
    !loadingBox ||
    !root ||
    !messageBox ||
    !refreshButton ||
    !requestStatus ||
    !requestList ||
    !requestEmpty ||
    !teamSearchForm ||
    !teamResults ||
    !meetSearchForm ||
    !meetResults ||
    !connectForm ||
    !selectionSummary ||
    !connectionList ||
    !connectionEmpty ||
    !countPending ||
    !countReviewing ||
    !countConnections
  ) {
    return;
  }

  let currentData = null;
  let selectedTeams = new Map();
  let selectedMeet = null;
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

    if (!cleaned) return "";

    try {
      const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
        ? cleaned
        : "https://" + cleaned;
      const url = new URL(prepared);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
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
    root.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });
  }

  function formatDate(value) {
    if (!value) return "Date not listed";
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  async function api(payload) {
    const response = await fetch("/api/admin/team-schedules/", {
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
      throw new Error("Your Podium Watch admin session has expired. Sign in again through the main admin page.");
    }

    if (!response.ok) {
      throw new Error(data.error || "The Team Schedule Manager request failed.");
    }

    return data;
  }

  function statusBadge(status) {
    const labels = {
      pending: "Pending",
      reviewing: "Reviewing",
      approved: "Approved",
      rejected: "Rejected",
      duplicate: "Duplicate",
      cancelled: "Cancelled"
    };
    const className = status === "reviewing"
      ? "admin-schedule-badge-warning"
      : ["rejected", "cancelled"].includes(status)
        ? "admin-schedule-badge-error"
        : status === "approved"
          ? ""
          : status === "duplicate"
            ? "admin-schedule-badge-dark"
            : "";

    return '<span class="admin-schedule-badge ' + className + '">' +
      escapeHtml(labels[status] || status) +
    '</span>';
  }

  function requestCard(request) {
    const team = request.team || {};
    const active = ["pending", "reviewing"].includes(request.status);
    const location = [request.venue_name, request.city, request.state]
      .filter(Boolean)
      .join(" · ");

    return (
      '<article class="admin-schedule-card" data-request-card="' + escapeHtml(request.id) + '">' +
        '<div class="admin-schedule-badges">' +
          statusBadge(request.status) +
          '<span class="admin-schedule-badge admin-schedule-badge-dark">' + escapeHtml(request.sport || "Meet") + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(request.meet_name) + '</h3>' +
        '<p><strong>' + escapeHtml(formatDate(request.meet_date)) + '</strong></p>' +
        '<p><strong>Team:</strong> ' + escapeHtml(team.school_name || "Unknown team") + '</p>' +
        (location ? '<p>' + escapeHtml(location) + '</p>' : "") +
        (request.submitted_by_email ? '<p><strong>Submitted by:</strong> ' + escapeHtml([request.submitted_by_name, request.submitted_by_email].filter(Boolean).join(" · ")) + '</p>' : "") +
        (request.notes ? '<p class="admin-schedule-note">' + escapeHtml(request.notes) + '</p>' : "") +
        (request.admin_notes ? '<p class="admin-schedule-note"><strong>Admin note:</strong> ' + escapeHtml(request.admin_notes) + '</p>' : "") +
        (request.website_url ? '<p><a href="' + escapeHtml(safeUrl(request.website_url)) + '" target="_blank" rel="noopener noreferrer">Submitted website</a></p>' : "") +
        (active
          ? '<div class="admin-schedule-card-actions">' +
              '<button class="button button-outline" type="button" data-request-reviewing="' + escapeHtml(request.id) + '">Mark reviewing</button>' +
              '<button class="button button-primary" type="button" data-request-create="' + escapeHtml(request.id) + '" data-publish="false">Create draft and connect</button>' +
              '<button class="button button-primary" type="button" data-request-create="' + escapeHtml(request.id) + '" data-publish="true">Create, publish, and connect</button>' +
              '<button class="button button-outline" type="button" data-request-reject="' + escapeHtml(request.id) + '">Reject</button>' +
            '</div>' +
            '<form class="admin-schedule-form" data-request-match-form="' + escapeHtml(request.id) + '">' +
              '<div class="admin-schedule-fields">' +
                '<label><strong>Find an existing Meet Center page</strong><input type="search" name="query" value="' + escapeHtml(request.meet_name) + '"></label>' +
                '<label><strong>Date</strong><input type="date" name="meet_date" value="' + escapeHtml(request.meet_date) + '"></label>' +
              '</div>' +
              '<button class="button button-outline" type="submit">Search existing meets</button>' +
            '</form>' +
            '<div class="admin-schedule-match-results" data-request-match-results="' + escapeHtml(request.id) + '"></div>'
          : "") +
      '</article>'
    );
  }

  function renderRequests() {
    const requests = Array.isArray(currentData?.requests) ? currentData.requests : [];
    requestList.innerHTML = requests.map(requestCard).join("");
    requestEmpty.hidden = requests.length > 0;
    countPending.textContent = String(requests.filter((item) => item.status === "pending").length);
    countReviewing.textContent = String(requests.filter((item) => item.status === "reviewing").length);
  }

  function connectionCard(connection) {
    const team = connection.team || {};
    const meet = connection.meet || {};
    const location = [meet.venue_name, meet.city, meet.state].filter(Boolean).join(" · ");

    return (
      '<article class="admin-schedule-card">' +
        '<div class="admin-schedule-badges">' +
          '<span class="admin-schedule-badge">' + escapeHtml(connection.program_scope === "boys" ? "Boys" : connection.program_scope === "girls" ? "Girls" : "Boys and Girls") + '</span>' +
          '<span class="admin-schedule-badge admin-schedule-badge-dark">' + escapeHtml(connection.source || "admin") + '</span>' +
          (connection.published ? "" : '<span class="admin-schedule-badge admin-schedule-badge-warning">Hidden</span>') +
        '</div>' +
        '<h3>' + escapeHtml(meet.name) + '</h3>' +
        '<p><strong>' + escapeHtml(team.school_name) + '</strong></p>' +
        '<p>' + escapeHtml(formatDate(meet.meet_date)) + (location ? " · " + escapeHtml(location) : "") + '</p>' +
        (connection.schedule_note ? '<p class="admin-schedule-note">' + escapeHtml(connection.schedule_note) + '</p>' : "") +
        '<div class="admin-schedule-card-actions">' +
          '<a class="button button-outline" href="/team/?slug=' + encodeURIComponent(team.slug) + '" target="_blank" rel="noopener noreferrer">Team profile</a>' +
          '<a class="button button-outline" href="/meetdetail/?slug=' + encodeURIComponent(meet.slug) + '" target="_blank" rel="noopener noreferrer">Meet Center</a>' +
          '<button class="button button-outline" type="button" data-admin-remove-connection="' + escapeHtml(connection.id) + '">Remove connection</button>' +
        '</div>' +
      '</article>'
    );
  }

  function renderConnections() {
    const connections = Array.isArray(currentData?.connections) ? currentData.connections : [];
    connectionList.innerHTML = connections.map(connectionCard).join("");
    connectionEmpty.hidden = connections.length > 0;
    countConnections.textContent = String(connections.length);
  }

  function renderTeamResults(teams) {
    const rows = Array.isArray(teams) ? teams : [];

    teamResults.innerHTML = rows.length
      ? rows.map((team) => (
          '<div class="admin-schedule-team-choice">' +
            '<input type="checkbox" value="' + escapeHtml(team.id) + '" data-team-choice' + (selectedTeams.has(team.id) ? " checked" : "") + '>' +
            '<span>' +
              '<strong>' + escapeHtml(team.school_name) + '</strong><br>' +
              escapeHtml([team.city, team.state, team.mascot].filter(Boolean).join(" · ")) +
              '<br><button class="button button-outline" type="button" data-view-team-schedule="' + escapeHtml(team.id) + '" data-team-name="' + escapeHtml(team.school_name) + '" style="margin-top:9px;">View full schedule</button>' +
            '</span>' +
          '</div>'
        )).join("")
      : '<div class="admin-schedule-empty">No teams found.</div>';
  }

  function renderMeetResults(meets) {
    const rows = Array.isArray(meets) ? meets : [];

    meetResults.innerHTML = rows.length
      ? rows.map((meet) => (
          '<label class="admin-schedule-meet-choice">' +
            '<input type="radio" name="admin_meet_choice" value="' + escapeHtml(meet.id) + '" data-meet-choice' + (selectedMeet?.id === meet.id ? " checked" : "") + '>' +
            '<span><strong>' + escapeHtml(meet.name) + '</strong><br>' + escapeHtml(formatDate(meet.meet_date)) + ' · ' + escapeHtml([meet.venue_name, meet.city, meet.state].filter(Boolean).join(" · ")) + (meet.published ? "" : " · Draft") + '</span>' +
          '</label>'
        )).join("")
      : '<div class="admin-schedule-empty">No meets found.</div>';
  }

  function updateSelectionSummary() {
    const teamCount = selectedTeams.size;
    const meetText = selectedMeet ? selectedMeet.name : "no meet selected";
    selectionSummary.textContent = `${teamCount} ${teamCount === 1 ? "team" : "teams"} selected and ${meetText}.`;
  }

  async function loadOverview() {
    currentData = await api({
      action: "list",
      status: requestStatus.value,
      request_limit: 250,
      connection_limit: 200
    });
    renderRequests();
    renderConnections();
  }

  async function initialize() {
    try {
      await loadOverview();
      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = '<h2>Team Schedule Manager unavailable</h2><p>' + escapeHtml(error.message) + '</p><p><a class="button button-primary" href="/admin/">Return to admin</a></p>';
    }
  }

  refreshButton.addEventListener("click", async () => {
    if (busy) return;
    try {
      setBusy(true);
      await loadOverview();
      showMessage("Team schedule information refreshed.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  requestStatus.addEventListener("change", async () => {
    if (busy) return;
    try {
      setBusy(true);
      await loadOverview();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  teamSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(teamSearchForm);

    try {
      setBusy(true);
      const data = await api({ action: "search_teams", query: formData.get("query") });
      renderTeamResults(data.teams);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  meetSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(meetSearchForm);

    try {
      setBusy(true);
      const data = await api({
        action: "search_meets",
        query: formData.get("query"),
        meet_date: formData.get("meet_date"),
        include_drafts: true
      });
      renderMeetResults(data.meets);
      meetResults.dataset.meets = JSON.stringify(data.meets || []);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  teamResults.addEventListener("change", (event) => {
    const input = event.target.closest("[data-team-choice]");
    if (!input) return;
    const container = input.closest(".admin-schedule-team-choice");
    const name = container?.querySelector("strong")?.textContent || "Team";
    if (input.checked) {
      selectedTeams.set(input.value, name);
    } else {
      selectedTeams.delete(input.value);
    }
    updateSelectionSummary();
  });

  teamResults.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-view-team-schedule]");

    if (!button || busy) {
      return;
    }

    try {
      setBusy(true);
      const data = await api({
        action: "get_team_schedule",
        team_id: button.dataset.viewTeamSchedule
      });

      currentData = {
        ...(currentData || {}),
        connections: data.connections || []
      };

      renderConnections();
      showMessage(
        "Showing the full schedule for " +
        (data.team?.school_name || button.dataset.teamName || "the selected team") +
        "."
      );
      connectionList.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  meetResults.addEventListener("change", (event) => {
    const input = event.target.closest("[data-meet-choice]");
    if (!input) return;
    let rows = [];
    try {
      rows = JSON.parse(meetResults.dataset.meets || "[]");
    } catch {
      rows = [];
    }
    selectedMeet = rows.find((meet) => meet.id === input.value) || {
      id: input.value,
      name: input.closest("label")?.querySelector("strong")?.textContent || "Selected meet"
    };
    updateSelectionSummary();
  });

  connectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (selectedTeams.size === 0 || !selectedMeet) {
      showMessage("Select at least one team and one Meet Center page.", "error");
      return;
    }

    const formData = new FormData(connectForm);

    try {
      setBusy(true);
      const data = await api({
        action: "connect",
        team_ids: [...selectedTeams.keys()],
        meet_id: selectedMeet.id,
        program_scope: formData.get("program_scope"),
        sport_scope: formData.get("sport_scope"),
        results_url_override: formData.get("results_url_override"),
        sort_order: formData.get("sort_order"),
        schedule_note: formData.get("schedule_note"),
        published: formData.get("published") === "on"
      });
      await loadOverview();
      showMessage(`${data.connected_count || 0} team schedule connections were saved.`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  requestList.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-request-match-form]");
    if (!form) return;
    event.preventDefault();
    if (busy) return;
    const requestId = form.dataset.requestMatchForm;
    const resultContainer = requestList.querySelector('[data-request-match-results="' + CSS.escape(requestId) + '"]');
    const formData = new FormData(form);

    try {
      setBusy(true);
      const data = await api({
        action: "search_meets",
        query: formData.get("query"),
        meet_date: formData.get("meet_date"),
        include_drafts: true
      });
      const meets = data.meets || [];
      resultContainer.innerHTML = meets.length
        ? meets.map((meet) => (
            '<article class="admin-schedule-result">' +
              '<h3>' + escapeHtml(meet.name) + '</h3>' +
              '<p>' + escapeHtml(formatDate(meet.meet_date)) + ' · ' + escapeHtml([meet.venue_name, meet.city, meet.state].filter(Boolean).join(" · ")) + (meet.published ? "" : " · Draft") + '</p>' +
              '<div class="admin-schedule-card-actions">' +
                '<button class="button button-primary" type="button" data-request-approve-existing="' + escapeHtml(requestId) + '" data-meet-id="' + escapeHtml(meet.id) + '">Approve and connect</button>' +
                '<button class="button button-outline" type="button" data-request-duplicate="' + escapeHtml(requestId) + '" data-meet-id="' + escapeHtml(meet.id) + '">Mark duplicate</button>' +
                '<a class="button button-outline" href="/meetdetail/?slug=' + encodeURIComponent(meet.slug) + '" target="_blank" rel="noopener noreferrer">Open meet</a>' +
              '</div>' +
            '</article>'
          )).join("")
        : '<div class="admin-schedule-empty">No matching Meet Center pages were found.</div>';
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  requestList.addEventListener("click", async (event) => {
    if (busy) return;
    const reviewing = event.target.closest("[data-request-reviewing]");
    const reject = event.target.closest("[data-request-reject]");
    const create = event.target.closest("[data-request-create]");
    const approve = event.target.closest("[data-request-approve-existing]");
    const duplicate = event.target.closest("[data-request-duplicate]");

    let payload = null;
    let success = "Request updated.";

    if (reviewing) {
      payload = {
        action: "review_request",
        request_id: reviewing.dataset.requestReviewing,
        decision: "reviewing",
        admin_notes: window.prompt("Optional review note:", "Podium Watch is reviewing this meet request.") || ""
      };
      success = "The request is now marked reviewing.";
    } else if (reject) {
      if (!window.confirm("Reject this meet request?")) return;
      payload = {
        action: "review_request",
        request_id: reject.dataset.requestReject,
        decision: "rejected",
        admin_notes: window.prompt("Reason for rejection:", "The submitted meet could not be approved.") || ""
      };
      success = "The request was rejected.";
    } else if (create) {
      const publish = create.dataset.publish === "true";
      const label = publish ? "create and publish" : "create as a draft";
      if (!window.confirm(`Create this Meet Center page, ${label}, and connect it to the team?`)) return;
      payload = {
        action: "review_request",
        request_id: create.dataset.requestCreate,
        decision: "create_meet",
        publish_meet: publish,
        admin_notes: publish
          ? "Podium Watch created and published the Meet Center page."
          : "Podium Watch created a draft Meet Center page."
      };
      success = publish
        ? "The meet was created, published, and connected."
        : "The draft meet was created and connected. It will appear publicly after the meet is published.";
    } else if (approve) {
      payload = {
        action: "review_request",
        request_id: approve.dataset.requestApproveExisting,
        decision: "approve_existing",
        meet_id: approve.dataset.meetId,
        admin_notes: "Connected to an existing Meet Center page."
      };
      success = "The request was approved and connected.";
    } else if (duplicate) {
      if (!window.confirm("Mark this request as a duplicate of the selected Meet Center page?")) return;
      payload = {
        action: "review_request",
        request_id: duplicate.dataset.requestDuplicate,
        decision: "duplicate",
        meet_id: duplicate.dataset.meetId,
        admin_notes: "This request duplicates an existing Meet Center page."
      };
      success = "The request was marked as a duplicate.";
    }

    if (!payload) return;

    try {
      setBusy(true);
      await api(payload);
      await loadOverview();
      showMessage(success);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  connectionList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-admin-remove-connection]");
    if (!button || busy) return;
    if (!window.confirm("Remove this schedule connection?")) return;

    try {
      setBusy(true);
      await api({
        action: "disconnect",
        connection_id: button.dataset.adminRemoveConnection
      });
      await loadOverview();
      showMessage("The schedule connection was removed.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  initialize();
})();
