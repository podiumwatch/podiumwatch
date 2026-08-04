(() => {
  const loadingBox = document.querySelector(
    "[data-team-dashboard-loading]"
  );

  const dashboard = document.querySelector(
    "[data-team-dashboard]"
  );

  const userName = document.querySelector(
    "[data-team-user-name]"
  );

  const userEmail = document.querySelector(
    "[data-team-user-email]"
  );

  const signOutButton =
    document.querySelector(
      "[data-team-signout]"
    );

  const messageBox = document.querySelector(
    "[data-team-dashboard-message]"
  );

  const ownedTeamList =
    document.querySelector(
      "[data-owned-team-list]"
    );

  const ownedTeamEmpty =
    document.querySelector(
      "[data-owned-team-empty]"
    );

  const searchForm = document.querySelector(
    "[data-team-search-form]"
  );

  const searchResults =
    document.querySelector(
      "[data-team-search-results]"
    );

  const claimPanel = document.querySelector(
    "[data-team-claim-panel]"
  );

  const claimTeamName =
    document.querySelector(
      "[data-claim-team-name]"
    );

  const claimForm = document.querySelector(
    "[data-team-claim-form]"
  );

  const cancelClaimButton =
    document.querySelector(
      "[data-cancel-team-claim]"
    );

  const createTeamForm =
    document.querySelector(
      "[data-create-team-form]"
    );

  const claimsSection =
    document.querySelector(
      "[data-team-claims-section]"
    );

  const claimsList =
    document.querySelector(
      "[data-team-claims-list]"
    );

  const ownerAccessSection =
    document.querySelector(
      "[data-team-owner-access]"
    );

  const ownerAccessList =
    document.querySelector(
      "[data-team-owner-access-list]"
    );

  if (
    !loadingBox ||
    !dashboard ||
    !userName ||
    !userEmail ||
    !signOutButton ||
    !messageBox ||
    !ownedTeamList ||
    !ownedTeamEmpty ||
    !searchForm ||
    !searchResults ||
    !claimPanel ||
    !claimTeamName ||
    !claimForm ||
    !cancelClaimButton ||
    !createTeamForm ||
    !claimsSection ||
    !claimsList ||
    !ownerAccessSection ||
    !ownerAccessList
  ) {
    return;
  }

  let client = null;
  let accountData = null;
  let teamSearchResults = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(
        String(value || "")
      );

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function showMessage(text) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
  }

  function setBusy(form, busy) {
    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    if (button) {
      button.disabled = busy;
    }
  }

  async function apiFetch(
    url,
    options = {}
  ) {
    const accessToken =
      await window.PodiumTeamAuth
        .getAccessToken();

    if (!accessToken) {
      window.location.replace(
        "/team-login/"
      );

      throw new Error(
        "Team account sign in required."
      );
    }

    const response = await fetch(
      url,
      {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization:
            "Bearer " +
            accessToken,
          ...(options.body
            ? {
                "Content-Type":
                  "application/json"
              }
            : {}),
          ...(options.headers || {})
        }
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      await client.auth.signOut();

      window.location.replace(
        "/team-login/"
      );

      throw new Error(
        "Your session expired."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        "The request could not be completed."
      );
    }

    return data;
  }

  function formatProgramLevel(value) {
    const labels = {
      high_school: "High School",
      middle_school: "Middle School",
      club: "Club"
    };

    return labels[value] || value;
  }

  function formatProgramScope(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value;
  }

  function renderSocialLinks(team) {
    const links = [
      ...(Array.isArray(
        team.social_links
      )
        ? team.social_links
        : []),
      {
        platform: "Website",
        label: "Team Website",
        url: team.website_url
      },
      {
        platform: "Website",
        label: "Athletics Website",
        url: team.athletics_url
      }
    ];

    const uniqueUrls = new Set();

    const buttons = links
      .map((link) => {
        const url = safeUrl(link.url);

        if (
          !url ||
          uniqueUrls.has(url)
        ) {
          return "";
        }

        uniqueUrls.add(url);

        return (
          '<a href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(
            link.label ||
            link.platform
          ) +
          "</a>"
        );
      })
      .filter(Boolean)
      .join("");

    return buttons
      ? '<div class="team-social-buttons">' +
          buttons +
        "</div>"
      : "";
  }

  function renderOwnedTeams(teams) {
    ownedTeamEmpty.hidden =
      teams.length > 0;

    ownedTeamList.innerHTML =
      teams
        .map((team) => {
          const status =
            team.published
              ? "Published"
              : "Private draft";

          const verification =
            team.verified
              ? "Verified"
              : "Community managed";

          const completion = Math.max(
            0,
            Math.min(
              100,
              Number(
                team.completion_score
              ) || 0
            )
          );

          const restrictions = [];

          if (team.editing_locked) {
            restrictions.push(
              "Editing locked"
            );
          }

          if (team.suspended) {
            restrictions.push(
              "Suspended"
            );
          }

          if (team.archived_at) {
            restrictions.push(
              "Archived"
            );
          }

          if (team.merged_into_team_id) {
            restrictions.push(
              "Merged duplicate"
            );
          }

          return (
            '<article class="story-card">' +
              '<div class="story-card-body">' +
                '<p class="eyebrow">' +
                  escapeHtml(
                    formatProgramLevel(
                      team.program_level
                    )
                  ) +
                '</p>' +
                '<h3>' +
                  escapeHtml(
                    team.school_name
                  ) +
                '</h3>' +
                '<p>' +
                  escapeHtml(
                    [
                      team.city,
                      team.state
                    ]
                      .filter(Boolean)
                      .join(", ")
                  ) +
                '</p>' +
                '<div class="team-page-card-status">' +
                  '<span class="team-page-badge">' +
                    escapeHtml(status) +
                  '</span>' +
                  '<span class="team-page-badge team-page-badge-dark">' +
                    escapeHtml(
                      verification
                    ) +
                  '</span>' +
                  '<span class="team-page-badge">' +
                    escapeHtml(
                      team.membership
                        ?.role ===
                        "owner"
                        ? "Owner"
                        : "Editor"
                    ) +
                  '</span>' +
                  restrictions
                    .map((label) => (
                      '<span class="team-page-badge team-page-badge-dark">' +
                        escapeHtml(label) +
                      '</span>'
                    ))
                    .join("") +
                '</div>' +
                '<div style="margin:16px 0;">' +
                  '<p style="margin:0 0 7px;"><strong>Profile completion: ' +
                    escapeHtml(completion) +
                  ' percent</strong></p>' +
                  '<div style="height:10px;overflow:hidden;border-radius:999px;background:rgba(15,23,42,.1);">' +
                    '<span style="display:block;height:100%;width:' +
                      escapeHtml(completion) +
                    '%;background:#00bf63;"></span>' +
                  '</div>' +
                '</div>' +
                renderSocialLinks(team) +
                '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                  '<a class="button button-primary" href="/team-editor/?id=' +
                    encodeURIComponent(team.id) +
                  '">' +
                    "Open team editor" +
                  '</a>' +
                  '<a class="button button-outline" href="/team-schedule/?id=' +
                    encodeURIComponent(team.id) +
                  '">' +
                    "Manage schedule" +
                  '</a>' +
                  '<a class="button button-outline" href="/team-roster/?id=' +
                    encodeURIComponent(team.id) +
                  '">' +
                    "Manage roster" +
                  '</a>' +
                  '<a class="button button-outline" href="/team-content/?id=' +
                    encodeURIComponent(team.id) +
                  '">' +
                    "Manage content" +
                  '</a>' +
                  '<a class="button button-outline" href="/team-insights/?id=' +
                    encodeURIComponent(team.id) +
                  '">' +
                    "View insights" +
                  '</a>' +
                '</div>' +
              '</div>' +
            '</article>'
          );
        })
        .join("");
  }

  function renderClaims(claims) {
    claimsSection.hidden =
      claims.length === 0;

    claimsList.innerHTML =
      claims
        .map((claim) => {
          return (
            '<article class="story-card">' +
              '<div class="story-card-body">' +
                '<p class="eyebrow">' +
                  escapeHtml(
                    claim.status
                  ) +
                '</p>' +
                '<h3>' +
                  escapeHtml(
                    claim.requested_school_name
                  ) +
                '</h3>' +
                '<p>' +
                  escapeHtml(
                    claim.requested_city ||
                    ""
                  ) +
                '</p>' +
                '<p>' +
                  escapeHtml(
                    claim.requester_role
                  ) +
                '</p>' +
              '</div>' +
            '</article>'
          );
        })
        .join("");
  }

  function renderOwnerAccess(groups) {
    const accessGroups = Array.isArray(groups)
      ? groups
      : [];

    ownerAccessSection.hidden =
      accessGroups.length === 0;

    ownerAccessList.innerHTML =
      accessGroups
        .map((group) => {
          const pendingClaims = Array.isArray(
            group.pending_claims
          )
            ? group.pending_claims
            : [];
          const members = Array.isArray(
            group.members
          )
            ? group.members
            : [];

          const claimMarkup =
            pendingClaims.length > 0
              ? pendingClaims
                  .map((claim) => (
                    '<div class="team-access-row">' +
                      '<div>' +
                        '<strong>' +
                          escapeHtml(
                            claim.requester_name ||
                            claim.requester_email ||
                            "Team account"
                          ) +
                        '</strong>' +
                        '<p class="team-access-note">' +
                          escapeHtml(
                            [
                              claim.requester_email,
                              claim.requester_role
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          ) +
                        '</p>' +
                        (
                          claim.message
                            ? '<p class="team-access-note">' +
                                escapeHtml(claim.message) +
                              '</p>'
                            : ""
                        ) +
                      '</div>' +
                      '<div class="team-access-actions">' +
                        '<select data-owner-claim-role="' +
                          escapeHtml(claim.id) +
                        '">' +
                          '<option value="editor">Editor</option>' +
                          '<option value="owner">Owner</option>' +
                        '</select>' +
                        '<button class="button button-primary" type="button" data-owner-approve-claim="' +
                          escapeHtml(claim.id) +
                        '" data-team-id="' +
                          escapeHtml(group.team_id) +
                        '">Approve</button>' +
                        '<button class="button button-outline" type="button" data-owner-reject-claim="' +
                          escapeHtml(claim.id) +
                        '" data-team-id="' +
                          escapeHtml(group.team_id) +
                        '">Reject</button>' +
                      '</div>' +
                    '</div>'
                  ))
                  .join("")
              : '<p class="team-access-note">No pending access requests.</p>';

          const memberMarkup =
            members.length > 0
              ? members
                  .map((member) => {
                    const isCurrentUser =
                      member.user_id ===
                      accountData?.user?.id;
                    const name =
                      member.display_name ||
                      member.account_display_name ||
                      member.email ||
                      "Team manager";

                    return (
                      '<div class="team-access-row">' +
                        '<div>' +
                          '<strong>' +
                            escapeHtml(name) +
                            (
                              isCurrentUser
                                ? " (You)"
                                : ""
                            ) +
                          '</strong>' +
                          '<p class="team-access-note">' +
                            escapeHtml(member.email || "Confirmed team account") +
                          '</p>' +
                        '</div>' +
                        '<div class="team-access-actions">' +
                          '<select data-owner-member-role="' +
                            escapeHtml(member.id) +
                          '"' +
                            (isCurrentUser ? " disabled" : "") +
                          '>' +
                            '<option value="editor"' +
                              (member.role === "editor" ? " selected" : "") +
                            '>Editor</option>' +
                            '<option value="owner"' +
                              (member.role === "owner" ? " selected" : "") +
                            '>Owner</option>' +
                          '</select>' +
                          (
                            isCurrentUser
                              ? '<span class="team-page-badge">Current account</span>'
                              : (
                                  '<button class="button button-outline" type="button" data-owner-update-member="' +
                                    escapeHtml(member.id) +
                                  '" data-team-id="' +
                                    escapeHtml(group.team_id) +
                                  '">Save role</button>' +
                                  '<button class="button button-outline" type="button" data-owner-remove-member="' +
                                    escapeHtml(member.id) +
                                  '" data-team-id="' +
                                    escapeHtml(group.team_id) +
                                  '">Remove</button>'
                                )
                          ) +
                        '</div>' +
                      '</div>'
                    );
                  })
                  .join("")
              : '<p class="team-access-note">No active team managers.</p>';

          return (
            '<article class="team-access-card">' +
              '<div>' +
                '<p class="eyebrow">Team owner controls</p>' +
                '<h3>' +
                  escapeHtml(group.school_name) +
                '</h3>' +
              '</div>' +
              '<div>' +
                '<h4>Pending requests</h4>' +
                '<div class="team-access-list" style="margin-top:10px;">' +
                  claimMarkup +
                '</div>' +
              '</div>' +
              '<div>' +
                '<h4>Current managers</h4>' +
                '<div class="team-access-list" style="margin-top:10px;">' +
                  memberMarkup +
                '</div>' +
              '</div>' +
            '</article>'
          );
        })
        .join("");
  }

  async function loadAccount() {
    accountData =
      await apiFetch(
        "/api/team/me/"
      );

    userName.textContent =
      accountData.user
        .display_name ||
      "Coach";

    userEmail.textContent =
      accountData.user.email;

    const requesterNameInput =
      claimForm.querySelector(
        '[name="requester_name"]'
      );

    if (
      requesterNameInput &&
      !requesterNameInput.value
    ) {
      requesterNameInput.value =
        accountData.user
          .display_name || "";
    }

    renderOwnedTeams(
      accountData.teams || []
    );

    renderClaims(
      accountData.claims || []
    );

    renderOwnerAccess(
      accountData.team_access || []
    );
  }

  function openClaimPanel(team) {
    claimForm.reset();

    claimForm.querySelector(
      '[name="team_id"]'
    ).value = team.id;

    claimForm.querySelector(
      '[name="requester_name"]'
    ).value =
      accountData?.user
        ?.display_name || "";

    claimTeamName.textContent =
      team.school_name;

    claimPanel.hidden = false;

    claimPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeClaimPanel() {
    claimPanel.hidden = true;
    claimForm.reset();
  }

  async function openRequestedClaim() {
    const params = new URLSearchParams(
      window.location.search
    );
    const claimSlug = String(
      params.get("claim") || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!claimSlug) {
      return;
    }

    const managedTeam =
      (accountData?.teams || [])
        .find((team) =>
          team.slug === claimSlug
        );

    if (managedTeam) {
      showMessage(
        "This team is already connected to your account."
      );
      return;
    }

    const data = await apiFetch(
      "/api/team/schools/",
      {
        method: "POST",
        body: JSON.stringify({
          query: claimSlug
        })
      }
    );

    const requestedTeam =
      (data.teams || [])
        .find((team) =>
          team.slug === claimSlug
        );

    if (!requestedTeam) {
      showMessage(
        "The requested team page could not be found. Search for the school below."
      );
      return;
    }

    teamSearchResults = [requestedTeam];
    openClaimPanel(requestedTeam);
    showMessage(
      requestedTeam.claimed
        ? "This page already has a manager. Submit a request to receive access."
        : "Confirm your role to claim this team page."
    );
  }

  ownerAccessList.addEventListener(
    "click",
    async (event) => {
      const approveButton = event.target.closest(
        "[data-owner-approve-claim]"
      );
      const rejectButton = event.target.closest(
        "[data-owner-reject-claim]"
      );
      const updateButton = event.target.closest(
        "[data-owner-update-member]"
      );
      const removeButton = event.target.closest(
        "[data-owner-remove-member]"
      );
      const actionButton =
        approveButton ||
        rejectButton ||
        updateButton ||
        removeButton;

      if (!actionButton || actionButton.disabled) {
        return;
      }

      const teamId = String(
        actionButton.dataset.teamId || ""
      );
      let payload = null;
      let successMessage = "Team access updated.";

      if (approveButton) {
        const claimId =
          approveButton.dataset.ownerApproveClaim;
        const roleSelect = ownerAccessList.querySelector(
          '[data-owner-claim-role="' +
          CSS.escape(claimId) +
          '"]'
        );

        payload = {
          action: "approve_claim",
          team_id: teamId,
          claim_id: claimId,
          role: roleSelect?.value || "editor"
        };
        successMessage =
          "The team access request was approved.";
      }

      if (rejectButton) {
        const approved = window.confirm(
          "Reject this team access request?"
        );

        if (!approved) {
          return;
        }

        payload = {
          action: "reject_claim",
          team_id: teamId,
          claim_id:
            rejectButton.dataset.ownerRejectClaim
        };
        successMessage =
          "The team access request was rejected.";
      }

      if (updateButton) {
        const memberId =
          updateButton.dataset.ownerUpdateMember;
        const roleSelect = ownerAccessList.querySelector(
          '[data-owner-member-role="' +
          CSS.escape(memberId) +
          '"]'
        );

        payload = {
          action: "update_member",
          team_id: teamId,
          member_id: memberId,
          role: roleSelect?.value || "editor"
        };
        successMessage =
          "The team manager role was updated.";
      }

      if (removeButton) {
        const approved = window.confirm(
          "Remove this person from the team page?"
        );

        if (!approved) {
          return;
        }

        payload = {
          action: "remove_member",
          team_id: teamId,
          member_id:
            removeButton.dataset.ownerRemoveMember
        };
        successMessage =
          "The team manager was removed.";
      }

      if (!payload) {
        return;
      }

      try {
        actionButton.disabled = true;
        showMessage("Updating team access...");
        await apiFetch(
          "/api/team/access/",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
        await loadAccount();
        showMessage(successMessage);
      } catch (error) {
        showMessage(
          error.message ||
          "Team access could not be updated."
        );
      } finally {
        actionButton.disabled = false;
      }
    }
  );

  searchForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const formData =
        new FormData(searchForm);

      const query = String(
        formData.get("query") ||
        ""
      ).trim();

      if (!query) {
        return;
      }

      setBusy(searchForm, true);

      showMessage(
        "Searching team pages..."
      );

      try {
        const data = await apiFetch(
          "/api/team/schools/",
          {
            method: "POST",
            body: JSON.stringify({
              query
            })
          }
        );

        teamSearchResults =
          Array.isArray(data.teams)
            ? data.teams
            : [];

        const managedIds = new Set(
          (accountData?.teams || []).map(
            (team) => team.id
          )
        );

        searchResults.innerHTML =
          teamSearchResults.length > 0
            ? teamSearchResults
                .map((team) => {
                  const alreadyManaged =
                    managedIds.has(
                      team.id
                    );

                  return (
                    '<article class="team-school-result">' +
                      '<div>' +
                        '<h3>' +
                          escapeHtml(
                            team.school_name
                          ) +
                        '</h3>' +
                        '<p>' +
                          escapeHtml(
                            [
                              team.city,
                              team.state,
                              team.mascot
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          ) +
                        '</p>' +
                        '<p>' +
                          escapeHtml(
                            alreadyManaged
                              ? "You already manage this page."
                              : (
                                  team.claimed
                                    ? "This page already has a team owner."
                                    : "This page does not have an active owner yet."
                                )
                          ) +
                        '</p>' +
                      '</div>' +
                      '<button class="button button-primary" type="button" data-request-team="' +
                        escapeHtml(
                          team.id
                        ) +
                      '"' +
                      (
                        alreadyManaged
                          ? " disabled"
                          : ""
                      ) +
                      '>' +
                        (
                          alreadyManaged
                            ? "Already yours"
                            : (
                                team.claimed
                                  ? "Request access"
                                  : "Claim this team"
                              )
                        ) +
                      '</button>' +
                    '</article>'
                  );
                })
                .join("")
            : (
                '<div class="team-school-result">' +
                  '<div>' +
                    '<h3>No team page found</h3>' +
                    '<p>Create the first private page for this school using the form below.</p>' +
                  '</div>' +
                '</div>'
              );

        showMessage(
          teamSearchResults.length > 0
            ? teamSearchResults.length +
              (
                teamSearchResults.length === 1
                  ? " team page found."
                  : " team pages found."
              )
            : "No existing team page was found."
        );
      } catch (error) {
        showMessage(error.message);
      } finally {
        setBusy(searchForm, false);
      }
    }
  );

  searchResults.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-request-team]"
        );

      if (
        !button ||
        button.disabled
      ) {
        return;
      }

      const team =
        teamSearchResults.find(
          (item) =>
            item.id ===
            button.dataset.requestTeam
        );

      if (team) {
        openClaimPanel(team);
      }
    }
  );

  cancelClaimButton.addEventListener(
    "click",
    closeClaimPanel
  );

  claimForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setBusy(claimForm, true);

      showMessage(
        "Connecting your team account..."
      );

      const formData =
        new FormData(claimForm);

      const payload =
        Object.fromEntries(
          formData.entries()
        );

      try {
        const claimResult =
          await apiFetch(
            "/api/team/claim/",
            {
              method: "POST",
              body:
                JSON.stringify(payload)
            }
          );

        closeClaimPanel();
        await loadAccount();

        showMessage(
          claimResult.access_granted
            ? "This team is now connected to your account."
            : "Your team access request was submitted."
        );
      } catch (error) {
        showMessage(error.message);
      } finally {
        setBusy(claimForm, false);
      }
    }
  );

  createTeamForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const confirmed =
        window.confirm(
          "Did you search first to make sure this team page does not already exist?"
        );

      if (!confirmed) {
        return;
      }

      setBusy(
        createTeamForm,
        true
      );

      showMessage(
        "Creating your private team page..."
      );

      const formData =
        new FormData(
          createTeamForm
        );

      const payload =
        Object.fromEntries(
          formData.entries()
        );

      try {
        const data =
          await apiFetch(
            "/api/team/create/",
            {
              method: "POST",
              body:
                JSON.stringify(
                  payload
                )
            }
          );

        createTeamForm.reset();

        const stateInput =
          createTeamForm.querySelector(
            '[name="state"]'
          );

        if (stateInput) {
          stateInput.value = "Ohio";
        }

        await loadAccount();

        showMessage(
          data.team.school_name +
          " was created as a private draft."
        );

        ownedTeamList.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      } catch (error) {
        showMessage(error.message);
      } finally {
        setBusy(
          createTeamForm,
          false
        );
      }
    }
  );

  signOutButton.addEventListener(
    "click",
    async () => {
      signOutButton.disabled = true;

      try {
        await client.auth.signOut();
      } finally {
        window.location.replace(
          "/team-login/"
        );
      }
    }
  );

  async function initialize() {
    try {
      client =
        await window.PodiumTeamAuth
          .getClient();

      const {
        data,
        error
      } =
        await client.auth.getUser();

      if (
        error ||
        !data.user
      ) {
        window.location.replace(
          "/team-login/"
        );

        return;
      }

      await loadAccount();

      loadingBox.hidden = true;
      dashboard.hidden = false;

      await openRequestedClaim();
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Unable to load your team account</h2>" +
        "<p>" +
        escapeHtml(
          error.message ||
          "Please return to the team sign in page."
        ) +
        "</p>" +
        '<a class="button button-primary" href="/team-login/">' +
          "Return to sign in" +
        "</a>";
    }
  }

  initialize();
})();