(() => {
  const loadingBox = document.querySelector("[data-team-manager-loading]");
  const content = document.querySelector("[data-team-manager-content]");
  const messageBox = document.querySelector("[data-team-manager-message]");
  const form = document.querySelector("[data-team-manager-form]");
  const clearButton = document.querySelector("[data-team-manager-clear]");
  const refreshButton = document.querySelector("[data-team-manager-refresh]");
  const teamCount = document.querySelector("[data-team-manager-count]");
  const pendingCount = document.querySelector("[data-team-manager-pending-count]");
  const reportCount = document.querySelector("[data-team-manager-report-count]");
  const rows = document.querySelector("[data-team-manager-rows]");
  const empty = document.querySelector("[data-team-manager-empty]");
  const claimsRefresh = document.querySelector("[data-team-claims-refresh]");
  const claimList = document.querySelector("[data-team-claim-list]");
  const claimEmpty = document.querySelector("[data-team-claim-empty]");
  const reportsRefresh = document.querySelector("[data-team-reports-refresh]");
  const reportList = document.querySelector("[data-team-report-list]");
  const reportEmpty = document.querySelector("[data-team-report-empty]");
  const detailPanel = document.querySelector("[data-team-detail-panel]");
  const detailClose = document.querySelector("[data-team-detail-close]");
  const detailTitle = document.querySelector("[data-team-detail-title]");
  const detailSubtitle = document.querySelector("[data-team-detail-subtitle]");
  const detailMessage = document.querySelector("[data-team-detail-message]");
  const detailCompletion = document.querySelector("[data-team-detail-completion]");
  const detailProgress = document.querySelector("[data-team-detail-progress]");
  const detailUpdated = document.querySelector("[data-team-detail-updated]");
  const detailBadges = document.querySelector("[data-team-detail-badges]");
  const detailStatusActions = document.querySelector("[data-team-detail-status-actions]");
  const detailOpenActions = document.querySelector("[data-team-detail-open-actions]");
  const detailMembers = document.querySelector("[data-team-detail-members]");
  const detailMembersEmpty = document.querySelector("[data-team-detail-members-empty]");
  const memberAddForm = document.querySelector("[data-team-member-add-form]");
  const mergeForm = document.querySelector("[data-team-merge-form]");
  const mergeTarget = document.querySelector("[data-team-merge-target]");
  const detailArchiveActions = document.querySelector("[data-team-detail-archive-actions]");
  const detailClaims = document.querySelector("[data-team-detail-claims]");
  const detailClaimsEmpty = document.querySelector("[data-team-detail-claims-empty]");
  const detailReports = document.querySelector("[data-team-detail-reports]");
  const detailReportsEmpty = document.querySelector("[data-team-detail-reports-empty]");
  const detailHistory = document.querySelector("[data-team-detail-history]");
  const detailHistoryEmpty = document.querySelector("[data-team-detail-history-empty]");

  const required = [
    loadingBox,
    content,
    messageBox,
    form,
    clearButton,
    refreshButton,
    teamCount,
    pendingCount,
    reportCount,
    rows,
    empty,
    claimsRefresh,
    claimList,
    claimEmpty,
    reportsRefresh,
    reportList,
    reportEmpty,
    detailPanel,
    detailClose,
    detailTitle,
    detailSubtitle,
    detailMessage,
    detailCompletion,
    detailProgress,
    detailUpdated,
    detailBadges,
    detailStatusActions,
    detailOpenActions,
    detailMembers,
    detailMembersEmpty,
    memberAddForm,
    mergeForm,
    mergeTarget,
    detailArchiveActions,
    detailClaims,
    detailClaimsEmpty,
    detailReports,
    detailReportsEmpty,
    detailHistory,
    detailHistoryEmpty
  ];

  if (required.some((element) => !element)) {
    return;
  }

  let busy = false;
  let teams = [];
  let currentTeamId = "";
  let currentDetails = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(message, type = "success", target = messageBox) {
    target.textContent = message;
    target.hidden = !message;
    target.style.background = type === "error"
      ? "rgba(220, 38, 38, 0.12)"
      : "rgba(0, 191, 99, 0.1)";
    target.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;

    document
      .querySelectorAll(
        "[data-team-manager-content] button, [data-team-detail-panel] button"
      )
      .forEach((element) => {
        element.disabled = value;
      });
  }

  async function request(payload) {
    const response = await fetch("/api/admin/teams/", {
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
      throw new Error("Your admin session expired.");
    }

    if (!response.ok) {
      throw new Error(data.error || "The Team Manager request failed.");
    }

    return data;
  }

  function formatDate(value, includeTime = false) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(includeTime
        ? {
            hour: "numeric",
            minute: "2-digit"
          }
        : {})
    }).format(date);
  }

  function formatOrigin(value) {
    const labels = {
      admin_import: "Admin import",
      admin_created: "Admin created",
      coach_created: "Coach created"
    };

    return labels[value] || "Unknown";
  }

  function formatReason(value) {
    const labels = {
      wrong_information: "Wrong information",
      fake_ownership: "Ownership concern",
      inappropriate_content: "Inappropriate content",
      duplicate_team: "Duplicate team",
      outdated_link: "Outdated link",
      other: "Other"
    };

    return labels[value] || value || "Report";
  }

  function badge(label, className = "") {
    return (
      '<span class="team-manager-badge ' +
      escapeHtml(className) +
      '">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  function renderTeamBadges(team) {
    const badges = [];

    if (team.merged_into_team_id) {
      badges.push(badge("Merged duplicate", "team-manager-badge-warning"));
    } else if (team.archived_at) {
      badges.push(badge("Archived", "team-manager-badge-warning"));
    } else if (team.suspended) {
      badges.push(badge("Suspended", "team-manager-badge-warning"));
    } else if (team.published) {
      badges.push(badge("Published"));
    } else {
      badges.push(badge("Private draft"));
    }

    if (team.editing_locked) {
      badges.push(badge("Editing locked", "team-manager-badge-warning"));
    }

    if (team.verified) {
      badges.push(badge("Verified", "team-manager-badge-dark"));
    }

    if (!team.claimed_at) {
      badges.push(badge("Unclaimed", "team-manager-badge-blue"));
    }

    return badges.join("");
  }

  function renderTeams(data) {
    teams = Array.isArray(data.teams) ? data.teams : [];
    teamCount.textContent = String(Number(data.count) || teams.length);

    rows.innerHTML = teams
      .map((team) => {
        const location = [team.city, team.state].filter(Boolean).join(", ");
        const locationDetails = [team.conference, team.region].filter(Boolean).join(" · ");
        const sourceDetails = [formatOrigin(team.profile_origin), team.source_name]
          .filter(Boolean)
          .join(" · ");
        const managerText = team.active_member_count === 0
          ? "Unclaimed"
          : `${team.active_member_count} active manager${team.active_member_count === 1 ? "" : "s"}`;
        const ownerText = team.owner_count > 0
          ? `${team.owner_count} owner${team.owner_count === 1 ? "" : "s"}`
          : "No owner";
        const reportText = Number(team.open_report_count) > 0
          ? badge(
              `${team.open_report_count} open`,
              "team-manager-badge-warning"
            )
          : badge("None");

        return (
          "<tr>" +
            "<td><strong>" + escapeHtml(team.school_name) + "</strong>" +
              (team.mascot ? "<div>" + escapeHtml(team.mascot) + "</div>" : "") +
              "<div class=\"team-manager-muted\">/" + escapeHtml(team.slug) + "/</div>" +
            "</td>" +
            "<td>" + escapeHtml(location) +
              (locationDetails ? "<div>" + escapeHtml(locationDetails) + "</div>" : "") +
            "</td>" +
            "<td>" + escapeHtml(sourceDetails) +
              (team.imported_at
                ? "<div class=\"team-manager-muted\">Imported " + escapeHtml(formatDate(team.imported_at)) + "</div>"
                : "") +
            "</td>" +
            "<td>" + escapeHtml(managerText) +
              "<div class=\"team-manager-muted\">" + escapeHtml(ownerText) + "</div>" +
            "</td>" +
            "<td><strong>" + escapeHtml(team.completion_score) + "%</strong></td>" +
            '<td><div class="team-manager-badges">' + renderTeamBadges(team) + "</div></td>" +
            '<td><div class="team-manager-badges">' + reportText + "</div></td>" +
            '<td><div class="team-manager-actions">' +
              '<button class="button button-primary" type="button" data-open-team-detail="' + escapeHtml(team.id) + '">Control center</button>' +
              '<a class="button button-outline" href="/team-editor/?id=' + encodeURIComponent(team.id) + '&admin=1">Edit profile</a>' +
              (team.published && !team.suspended && !team.archived_at
                ? '<a class="button button-outline" href="/team/?slug=' + encodeURIComponent(team.slug) + '" target="_blank" rel="noopener noreferrer">Public page</a>'
                : "") +
            "</div></td>" +
          "</tr>"
        );
      })
      .join("");

    empty.hidden = teams.length > 0;

    if (data.limited) {
      showMessage("More teams matched than can be displayed at once. Use filters to narrow the list.");
    }
  }

  function renderClaims(claims) {
    const list = Array.isArray(claims) ? claims : [];
    pendingCount.textContent = String(list.length);
    claimEmpty.hidden = list.length > 0;

    claimList.innerHTML = list
      .map((claim) => {
        const teamName = claim.team?.school_name || claim.requested_school_name || "Unknown team";
        const location = [claim.team?.city || claim.requested_city, claim.team?.state]
          .filter(Boolean)
          .join(", ");

        return (
          '<article class="team-manager-claim-card" data-claim-card="' + escapeHtml(claim.id) + '">' +
            "<div>" +
              "<h3>" + escapeHtml(teamName) + "</h3>" +
              (location ? "<p>" + escapeHtml(location) + "</p>" : "") +
              "<p><strong>Requester:</strong> " + escapeHtml(claim.requester_name || "Unknown") + "</p>" +
              "<p><strong>Email:</strong> " + escapeHtml(claim.requester_email || "Not provided") + "</p>" +
              "<p><strong>Team role:</strong> " + escapeHtml(claim.requester_role || "Not provided") + "</p>" +
              (claim.message ? "<p><strong>Message:</strong> " + escapeHtml(claim.message) + "</p>" : "") +
              "<p class=\"team-manager-muted\">Submitted " + escapeHtml(formatDate(claim.created_at, true)) + "</p>" +
            "</div>" +
            "<div>" +
              "<label><strong>Access level</strong>" +
                '<select data-claim-role><option value="editor">Editor</option><option value="owner">Owner</option></select>' +
              "</label>" +
              '<div class="team-manager-actions" style="margin-top:14px;">' +
                '<button class="button button-primary" type="button" data-approve-claim="' + escapeHtml(claim.id) + '">Approve</button>' +
                '<button class="button button-outline" type="button" data-reject-claim="' + escapeHtml(claim.id) + '">Reject</button>' +
              "</div>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function reportCard(report, detailed = false) {
    const teamName = report.team?.school_name || currentDetails?.team?.school_name || "Team page";

    return (
      '<article class="team-manager-report-card" data-report-card="' + escapeHtml(report.id) + '">' +
        "<div>" +
          "<h3>" + escapeHtml(formatReason(report.reason)) + "</h3>" +
          (detailed ? "" : "<p><strong>Team:</strong> " + escapeHtml(teamName) + "</p>") +
          "<p>" + escapeHtml(report.details) + "</p>" +
          "<p><strong>Reporter:</strong> " + escapeHtml(report.reporter_name || "Anonymous") +
            (report.reporter_email ? " · " + escapeHtml(report.reporter_email) : "") +
          "</p>" +
          "<p class=\"team-manager-muted\">Submitted " + escapeHtml(formatDate(report.created_at, true)) + " · Status: " + escapeHtml(report.status) + "</p>" +
          (report.admin_notes ? "<p><strong>Admin notes:</strong> " + escapeHtml(report.admin_notes) + "</p>" : "") +
        "</div>" +
        '<form class="team-manager-report-form" data-report-update-form="' + escapeHtml(report.id) + '">' +
          "<label><strong>Status</strong>" +
            '<select name="status">' +
              '<option value="open"' + (report.status === "open" ? " selected" : "") + ">Open</option>" +
              '<option value="reviewing"' + (report.status === "reviewing" ? " selected" : "") + ">Reviewing</option>" +
              '<option value="resolved"' + (report.status === "resolved" ? " selected" : "") + ">Resolved</option>" +
              '<option value="dismissed"' + (report.status === "dismissed" ? " selected" : "") + ">Dismissed</option>" +
            "</select></label>" +
          "<label><strong>Admin notes</strong><textarea name=\"admin_notes\" rows=\"3\">" + escapeHtml(report.admin_notes || "") + "</textarea></label>" +
          '<button class="button button-primary" type="submit">Save report</button>' +
        "</form>" +
      "</article>"
    );
  }

  function renderReports(reports) {
    const list = Array.isArray(reports) ? reports : [];
    reportCount.textContent = String(list.length);
    reportEmpty.hidden = list.length > 0;
    reportList.innerHTML = list.map((report) => reportCard(report)).join("");
  }

  async function loadTeams() {
    const formData = new FormData(form);
    const data = await request({
      action: "list",
      search: String(formData.get("search") || "").trim(),
      status: String(formData.get("status") || "").trim(),
      origin: String(formData.get("origin") || "").trim(),
      claim_status: String(formData.get("claim_status") || "").trim()
    });

    renderTeams(data);
  }

  async function loadClaims() {
    const data = await request({ action: "claims", status: "pending" });
    renderClaims(data.claims);
  }

  async function loadReports() {
    const data = await request({ action: "reports", status: "active" });
    renderReports(data.reports);
  }

  function renderMember(member) {
    const display = member.display_name || member.account_display_name || member.email || "Team manager";

    return (
      '<article class="team-manager-member-card" data-member-card="' + escapeHtml(member.id) + '">' +
        "<div>" +
          "<h3>" + escapeHtml(display) + "</h3>" +
          "<p>" + escapeHtml(member.email || "Email unavailable") + "</p>" +
          "<p class=\"team-manager-muted\">Account " + escapeHtml(member.confirmed ? "confirmed" : "not confirmed") + " · Status: " + escapeHtml(member.status) + "</p>" +
        "</div>" +
        '<div class="team-manager-member-actions">' +
          '<select data-member-role="' + escapeHtml(member.id) + '">' +
            '<option value="editor"' + (member.role === "editor" ? " selected" : "") + ">Editor</option>" +
            '<option value="owner"' + (member.role === "owner" ? " selected" : "") + ">Owner</option>" +
          "</select>" +
          '<button class="button button-primary" type="button" data-update-member="' + escapeHtml(member.id) + '">Save access</button>' +
          '<button class="button button-outline" type="button" data-remove-member="' + escapeHtml(member.id) + '">Remove</button>' +
        "</div>" +
      "</article>"
    );
  }

  function renderClaimHistory(claims) {
    const list = Array.isArray(claims) ? claims : [];
    detailClaimsEmpty.hidden = list.length > 0;
    detailClaims.innerHTML = list
      .map((claim) => (
        '<article class="team-manager-history-card">' +
          "<h3>" + escapeHtml(claim.requester_name || claim.requester_email || "Access request") + "</h3>" +
          "<p><strong>Status:</strong> " + escapeHtml(claim.status) + " · <strong>Requested role:</strong> " + escapeHtml(claim.requester_role || "Not provided") + "</p>" +
          (claim.message ? "<p>" + escapeHtml(claim.message) + "</p>" : "") +
          (claim.review_notes ? "<p><strong>Review notes:</strong> " + escapeHtml(claim.review_notes) + "</p>" : "") +
          "<p class=\"team-manager-muted\">Submitted " + escapeHtml(formatDate(claim.created_at, true)) +
            (claim.reviewed_at ? " · Reviewed " + escapeHtml(formatDate(claim.reviewed_at, true)) : "") +
          "</p>" +
        "</article>"
      ))
      .join("");
  }

  function renderHistory(history) {
    const list = Array.isArray(history) ? history : [];
    detailHistoryEmpty.hidden = list.length > 0;
    detailHistory.innerHTML = list
      .map((entry) => {
        const fields = Array.isArray(entry.changed_fields) && entry.changed_fields.length > 0
          ? entry.changed_fields.join(", ")
          : "";

        return (
          '<article class="team-manager-history-card">' +
            "<h3>" + escapeHtml(entry.summary || entry.action) + "</h3>" +
            "<p><strong>Action:</strong> " + escapeHtml(entry.action) + "</p>" +
            (fields ? "<p><strong>Fields:</strong> " + escapeHtml(fields) + "</p>" : "") +
            "<p class=\"team-manager-muted\">" + escapeHtml(formatDate(entry.created_at, true)) + " · " + escapeHtml(entry.actor_type) +
              (entry.actor_id ? " · " + escapeHtml(entry.actor_id) : "") +
            "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function statusButton(field, value, label, reasonPrompt = "") {
    return (
      '<button class="button button-outline" type="button" data-set-status-field="' +
      escapeHtml(field) +
      '" data-set-status-value="' +
      String(value) +
      '" data-status-reason-prompt="' +
      escapeHtml(reasonPrompt) +
      '">' +
      escapeHtml(label) +
      "</button>"
    );
  }

  function renderDetails(data) {
    currentDetails = data;
    const team = data.team;
    currentTeamId = team.id;
    detailTitle.textContent = team.school_name;
    detailSubtitle.textContent = [team.city, team.state, team.conference]
      .filter(Boolean)
      .join(" · ");
    detailCompletion.textContent = `${team.completion_score || 0} percent complete`;
    detailProgress.style.width = `${team.completion_score || 0}%`;
    detailUpdated.textContent = team.updated_at
      ? `Last updated ${formatDate(team.updated_at, true)}`
      : "No update date available";
    detailBadges.innerHTML = renderTeamBadges(team);

    const statusActions = [];

    if (!team.archived_at && !team.merged_into_team_id) {
      statusActions.push(
        team.published
          ? statusButton("published", false, "Unpublish")
          : statusButton("published", true, "Publish")
      );
      statusActions.push(
        team.verified
          ? statusButton("verified", false, "Remove verification")
          : statusButton("verified", true, "Verify team")
      );
      statusActions.push(
        team.suspended
          ? statusButton("suspended", false, "Restore suspension")
          : statusButton("suspended", true, "Suspend page", "Why is this page being suspended?")
      );
      statusActions.push(
        team.editing_locked
          ? statusButton("editing_locked", false, "Unlock editing")
          : statusButton("editing_locked", true, "Lock editing", "Why should team editing be locked?")
      );
    }

    detailStatusActions.innerHTML = statusActions.join("");
    detailOpenActions.innerHTML =
      '<a class="button button-primary" href="/team-editor/?id=' + encodeURIComponent(team.id) + '&admin=1">Open full editor</a>' +
      '<a class="button button-outline" href="/team-schedule/?id=' + encodeURIComponent(team.id) + '&admin=1">Manage schedule</a>' +
      '<a class="button button-outline" href="/team-roster/?id=' + encodeURIComponent(team.id) + '&admin=1">Manage roster</a>' +
      '<a class="button button-outline" href="/team-content/?id=' + encodeURIComponent(team.id) + '&admin=1">Manage content</a>' +
      '<a class="button button-outline" href="/team/?slug=' + encodeURIComponent(team.slug) + '&preview=1&admin=1" target="_blank" rel="noopener noreferrer">Preview profile</a>';

    const members = Array.isArray(data.members)
      ? data.members.filter((member) => member.status === "active")
      : [];
    detailMembersEmpty.hidden = members.length > 0;
    detailMembers.innerHTML = members.map(renderMember).join("");

    mergeTarget.innerHTML = '<option value="">Choose the profile to keep</option>' +
      teams
        .filter((candidate) =>
          candidate.id !== team.id &&
          !candidate.archived_at &&
          !candidate.merged_into_team_id
        )
        .map((candidate) => (
          '<option value="' + escapeHtml(candidate.id) + '">' +
            escapeHtml(candidate.school_name + " · " + [candidate.city, candidate.state].filter(Boolean).join(", ")) +
          "</option>"
        ))
        .join("");

    if (team.merged_into_team_id) {
      detailArchiveActions.innerHTML = '<p class="team-manager-warning">This profile was merged into another team and cannot be restored separately.</p>';
      mergeForm.hidden = true;
    } else if (team.archived_at) {
      detailArchiveActions.innerHTML = '<button class="button button-primary" type="button" data-restore-team>Restore archived profile</button>';
      mergeForm.hidden = true;
    } else {
      detailArchiveActions.innerHTML = '<button class="button button-outline" type="button" data-archive-team>Archive this profile</button>';
      mergeForm.hidden = false;
    }

    renderClaimHistory(data.claims);

    const reports = Array.isArray(data.reports) ? data.reports : [];
    detailReportsEmpty.hidden = reports.length > 0;
    detailReports.innerHTML = reports.map((report) => reportCard(report, true)).join("");
    renderHistory(data.history);
    detailPanel.hidden = false;
    document.body.style.overflow = "hidden";
    showMessage("", "success", detailMessage);
  }

  async function openDetails(teamId) {
    showMessage("Loading team control center.");
    const data = await request({ action: "team_details", team_id: teamId });
    renderDetails(data);
    showMessage("Team control center loaded.");
  }

  function closeDetails() {
    detailPanel.hidden = true;
    document.body.style.overflow = "";
    currentTeamId = "";
    currentDetails = null;
    memberAddForm.reset();
    mergeForm.reset();
  }

  async function refreshDetails() {
    if (!currentTeamId) {
      return;
    }

    const data = await request({ action: "team_details", team_id: currentTeamId });
    renderDetails(data);
  }

  async function refreshAll(options = {}) {
    if (busy && !options.ignoreBusy) {
      return;
    }

    try {
      setBusy(true);
      showMessage(options.message || "Loading team system.");
      await Promise.all([loadTeams(), loadClaims(), loadReports()]);

      if (currentTeamId && !detailPanel.hidden) {
        await refreshDetails();
      }

      showMessage("Team Manager is up to date.");
    } catch (error) {
      showMessage(error.message || "The Team Manager could not be loaded.", "error");

      if (options.throwOnError) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  async function runAction(payload, successMessage, options = {}) {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      showMessage(options.loadingMessage || "Updating the team system.");
      showMessage(options.loadingMessage || "Updating the team system.", "success", detailMessage);
      const result = await request(payload);
      await Promise.all([loadTeams(), loadClaims(), loadReports()]);

      if (options.closeDetails) {
        closeDetails();
      } else if (currentTeamId && !detailPanel.hidden) {
        await refreshDetails();
      }

      showMessage(successMessage);
      if (!detailPanel.hidden) {
        showMessage(successMessage, "success", detailMessage);
      }
      return result;
    } catch (error) {
      showMessage(error.message, "error");
      if (!detailPanel.hidden) {
        showMessage(error.message, "error", detailMessage);
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    try {
      setBusy(true);
      showMessage("Searching team profiles.");
      await loadTeams();
      showMessage("Team search complete.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  clearButton.addEventListener("click", () => {
    if (busy) {
      return;
    }

    form.reset();
    refreshAll();
  });

  refreshButton.addEventListener("click", () => refreshAll());
  claimsRefresh.addEventListener("click", () => refreshAll());
  reportsRefresh.addEventListener("click", () => refreshAll());
  detailClose.addEventListener("click", closeDetails);

  detailPanel.addEventListener("click", (event) => {
    if (event.target === detailPanel && !busy) {
      closeDetails();
    }
  });

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-open-team-detail]");

    if (!button || busy) {
      return;
    }

    try {
      setBusy(true);
      await openDetails(button.dataset.openTeamDetail);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  claimList.addEventListener("click", async (event) => {
    if (busy) {
      return;
    }

    const approveButton = event.target.closest("[data-approve-claim]");
    const rejectButton = event.target.closest("[data-reject-claim]");

    if (!approveButton && !rejectButton) {
      return;
    }

    const claimId = approveButton?.dataset.approveClaim || rejectButton?.dataset.rejectClaim;
    const card = event.target.closest("[data-claim-card]");
    const role = card?.querySelector("[data-claim-role]")?.value || "editor";

    if (rejectButton && !window.confirm("Reject this team access request?")) {
      return;
    }

    await runAction(
      {
        action: approveButton ? "approve_claim" : "reject_claim",
        claim_id: claimId,
        role
      },
      approveButton ? "Team access approved." : "Team access rejected."
    );
  });

  detailStatusActions.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-set-status-field]");

    if (!button || busy || !currentTeamId) {
      return;
    }

    const field = button.dataset.setStatusField;
    const value = button.dataset.setStatusValue === "true";
    const reasonPrompt = button.dataset.statusReasonPrompt || "";
    let reason = "";

    if (reasonPrompt && value) {
      reason = window.prompt(reasonPrompt, "") || "";

      if (!reason.trim()) {
        return;
      }
    }

    if (
      field === "suspended" &&
      value &&
      !window.confirm("Suspend this team page? It will be unpublished and editing will be locked.")
    ) {
      return;
    }

    await runAction(
      {
        action: "set_status",
        team_id: currentTeamId,
        field,
        value,
        reason
      },
      "Team status updated."
    );
  });

  memberAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !currentTeamId) {
      return;
    }

    const data = new FormData(memberAddForm);
    const result = await runAction(
      {
        action: "add_member",
        team_id: currentTeamId,
        email: String(data.get("email") || "").trim(),
        role: String(data.get("role") || "editor"),
        display_name: String(data.get("display_name") || "").trim()
      },
      "Team manager added."
    );

    if (result) {
      memberAddForm.reset();
    }
  });

  detailMembers.addEventListener("click", async (event) => {
    if (busy || !currentTeamId) {
      return;
    }

    const updateButton = event.target.closest("[data-update-member]");
    const removeButton = event.target.closest("[data-remove-member]");

    if (!updateButton && !removeButton) {
      return;
    }

    const memberId = updateButton?.dataset.updateMember || removeButton?.dataset.removeMember;
    const card = event.target.closest("[data-member-card]");
    const role = card?.querySelector("[data-member-role]")?.value || "editor";

    if (removeButton && !window.confirm("Remove this person from the team page?")) {
      return;
    }

    await runAction(
      {
        action: removeButton ? "remove_member" : "update_member",
        team_id: currentTeamId,
        member_id: memberId,
        role
      },
      removeButton ? "Team manager removed." : "Team manager access updated."
    );
  });

  mergeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !currentTeamId) {
      return;
    }

    const data = new FormData(mergeForm);
    const targetTeamId = String(data.get("target_team_id") || "").trim();
    const reason = String(data.get("reason") || "").trim();

    if (!targetTeamId) {
      showMessage("Choose the primary profile to keep.", "error", detailMessage);
      return;
    }

    const targetTeam = teams.find((team) => team.id === targetTeamId);
    const sourceName = currentDetails?.team?.school_name || "this duplicate";
    const targetName = targetTeam?.school_name || "the selected primary profile";

    if (!window.confirm(`Merge ${sourceName} into ${targetName}? This moves connected records and archives the duplicate.`)) {
      return;
    }

    await runAction(
      {
        action: "merge_teams",
        source_team_id: currentTeamId,
        target_team_id: targetTeamId,
        reason
      },
      "Duplicate team profile merged.",
      { closeDetails: true }
    );
  });

  detailArchiveActions.addEventListener("click", async (event) => {
    if (busy || !currentTeamId) {
      return;
    }

    const archiveButton = event.target.closest("[data-archive-team]");
    const restoreButton = event.target.closest("[data-restore-team]");

    if (!archiveButton && !restoreButton) {
      return;
    }

    if (archiveButton) {
      const reason = window.prompt("Why are you archiving this team profile?", "No longer active or needed.") || "";

      if (!reason.trim()) {
        return;
      }

      if (!window.confirm("Archive this profile? It will disappear publicly and team editing will be locked.")) {
        return;
      }

      await runAction(
        {
          action: "archive_team",
          team_id: currentTeamId,
          reason
        },
        "Team profile archived."
      );
      return;
    }

    await runAction(
      {
        action: "restore_team",
        team_id: currentTeamId
      },
      "Team profile restored as a private draft."
    );
  });

  async function handleReportSubmit(event) {
    const reportForm = event.target.closest("[data-report-update-form]");

    if (!reportForm || busy) {
      return;
    }

    event.preventDefault();
    const data = new FormData(reportForm);

    await runAction(
      {
        action: "update_report",
        report_id: reportForm.dataset.reportUpdateForm,
        status: String(data.get("status") || "open"),
        admin_notes: String(data.get("admin_notes") || "").trim()
      },
      "Team report updated."
    );
  }

  reportList.addEventListener("submit", handleReportSubmit);
  detailReports.addEventListener("submit", handleReportSubmit);

  async function initialize() {
    try {
      await refreshAll({
        ignoreBusy: true,
        throwOnError: true
      });
      loadingBox.hidden = true;
      content.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Admin sign in required</h2>" +
        "<p>Open the main admin page and sign in before using Team Manager.</p>" +
        '<a class="button button-primary" href="/admin/">Open admin</a>';
    }
  }

  initialize();
})();
