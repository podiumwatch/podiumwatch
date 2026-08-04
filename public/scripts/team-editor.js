(() => {
  const loadingBox = document.querySelector(
    "[data-team-editor-loading]"
  );

  const editor = document.querySelector(
    "[data-team-editor]"
  );

  const teamName = document.querySelector(
    "[data-editor-team-name]"
  );

  const teamBadges = document.querySelector(
    "[data-editor-team-badges]"
  );

  const messageBox = document.querySelector(
    "[data-team-editor-message]"
  );

  const previewLink = document.querySelector(
    "[data-team-preview-link]"
  );

  const signOutButton = document.querySelector(
    "[data-team-editor-signout]"
  );

  const profileForm = document.querySelector(
    "[data-team-profile-form]"
  );

  const socialList = document.querySelector(
    "[data-team-social-list]"
  );

  const socialEmpty = document.querySelector(
    "[data-team-social-empty]"
  );

  const socialForm = document.querySelector(
    "[data-team-social-form]"
  );

  const socialSubmitLabel = document.querySelector(
    "[data-social-submit-label]"
  );

  const cancelSocialEdit = document.querySelector(
    "[data-cancel-social-edit]"
  );

  const logoPreview = document.querySelector(
    "[data-team-logo-preview]"
  );

  const bannerPreview = document.querySelector(
    "[data-team-banner-preview]"
  );

  const imagePreview = document.querySelector(
    "[data-team-image-preview]"
  );

  const headCoachSetup =
    profileForm.querySelector(
      '[name="head_coach_setup"]'
    );

  const combinedHeadCoachField =
    document.querySelector(
      "[data-combined-head-coach]"
    );

  const boysHeadCoachField =
    document.querySelector(
      "[data-boys-head-coach]"
    );

  const girlsHeadCoachField =
    document.querySelector(
      "[data-girls-head-coach]"
    );

  if (
    !loadingBox ||
    !editor ||
    !teamName ||
    !teamBadges ||
    !messageBox ||
    !previewLink ||
    !signOutButton ||
    !profileForm ||
    !socialList ||
    !socialEmpty ||
    !socialForm ||
    !socialSubmitLabel ||
    !cancelSocialEdit ||
    !logoPreview ||
    !bannerPreview ||
    !imagePreview ||
    !headCoachSetup ||
    !combinedHeadCoachField ||
    !boysHeadCoachField ||
    !girlsHeadCoachField
  ) {
    return;
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const teamId = String(
    params.get("id") || ""
  ).trim();

  const adminMode =
    params.get("admin") === "1";

  let client = null;
  let currentTeam = null;
  let socialLinks = [];
  let editorLocked = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    const cleaned = String(
      value ?? ""
    ).trim();

    if (!cleaned) {
      return "";
    }

    try {
      const prepared =
        /^[a-z][a-z0-9+.-]*:\/\//i.test(
          cleaned
        )
          ? cleaned
          : "https://" + cleaned;

      const url = new URL(prepared);

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

  function setFormBusy(form, busy) {
    const button = form.querySelector(
      'button[type="submit"]'
    );

    if (button) {
      button.disabled =
        busy || editorLocked;
    }
  }

  function getEditorRestriction(team) {
    if (adminMode) {
      return "";
    }

    if (team.merged_into_team_id) {
      return "This duplicate profile has been merged into another team page and can no longer be edited.";
    }

    if (team.archived_at) {
      return team.archived_reason ||
        "This team profile is archived and cannot be edited.";
    }

    if (team.suspended) {
      return "This team profile is suspended and cannot be edited.";
    }

    if (team.editing_locked) {
      return team.editing_lock_reason ||
        "Podium Watch has temporarily locked editing for this team page.";
    }

    return "";
  }

  function setEditorRestriction(team) {
    const restriction =
      getEditorRestriction(team);

    editorLocked = Boolean(restriction);

    [profileForm, socialForm]
      .forEach((form) => {
        Array.from(form.elements)
          .forEach((element) => {
            element.disabled = editorLocked;
          });
      });

    socialList
      .querySelectorAll("button")
      .forEach((button) => {
        button.disabled = editorLocked;
      });

    if (restriction) {
      showMessage(restriction);
    }
  }

  async function apiFetch(payload) {
    let accessToken = "";

    if (!adminMode) {
      accessToken =
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
    }

    const headers = {
      Accept: "application/json",
      "Content-Type":
        "application/json"
    };

    if (accessToken) {
      headers.Authorization =
        "Bearer " + accessToken;
    }

    const response = await fetch(
      "/api/team/detail/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      if (adminMode) {
        window.location.replace(
          "/admin/"
        );
      } else {
        if (client) {
          await client.auth.signOut();
        }

        window.location.replace(
          "/team-login/"
        );
      }

      throw new Error(
        "Your session expired."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        "The team request could not be completed."
      );
    }

    return data;
  }

  function updateHeadCoachFields() {
    const setup =
      headCoachSetup.value ||
      "combined";

    combinedHeadCoachField.hidden =
      setup !== "combined";

    boysHeadCoachField.hidden =
      ![
        "separate",
        "boys_only"
      ].includes(setup);

    girlsHeadCoachField.hidden =
      ![
        "separate",
        "girls_only"
      ].includes(setup);
  }

  function populateProfileForm(team) {
    for (
      const element
      of profileForm.elements
    ) {
      if (!element.name) {
        continue;
      }

      if (
        element.type === "submit" ||
        element.type === "button"
      ) {
        continue;
      }

      if (element.type === "checkbox") {
        element.checked =
          team[element.name] === true;

        continue;
      }

      element.value =
        team[element.name] ?? "";
    }

    updateHeadCoachFields();
    updateImagePreviews();
  }

  function updateStatus() {
    teamName.textContent =
      currentTeam.school_name;

    const statusBadges = [
      currentTeam.published
        ? "Published"
        : "Private draft",
      currentTeam.verified
        ? "Verified"
        : "Community managed"
    ];

    if (currentTeam.editing_locked) {
      statusBadges.push("Editing locked");
    }

    if (currentTeam.suspended) {
      statusBadges.push("Suspended");
    }

    if (currentTeam.archived_at) {
      statusBadges.push("Archived");
    }

    if (currentTeam.merged_into_team_id) {
      statusBadges.push("Merged duplicate");
    }

    teamBadges.innerHTML =
      statusBadges
        .map((label, index) => (
          '<span class="team-editor-badge' +
            (index > 0
              ? " team-editor-badge-dark"
              : "") +
          '">' +
            escapeHtml(label) +
          "</span>"
        ))
        .join("");

    previewLink.href =
      "/team/?slug=" +
      encodeURIComponent(
        currentTeam.slug
      ) +
      "&preview=1" +
      (adminMode
        ? "&admin=1"
        : "");

    previewLink.hidden = false;

    previewLink.textContent =
      currentTeam.published
        ? "Preview team page"
        : "Preview private draft";
  }

  function formatSocialScope(link) {
    const parts = [];

    if (
      link.sport_scope &&
      link.sport_scope !== "All"
    ) {
      parts.push(link.sport_scope);
    }

    if (
      link.program_scope === "boys"
    ) {
      parts.push("Boys");
    }

    if (
      link.program_scope === "girls"
    ) {
      parts.push("Girls");
    }

    if (parts.length === 0) {
      return "Entire program";
    }

    return parts.join(" · ");
  }

  function renderSocialLinks() {
    socialEmpty.hidden =
      socialLinks.length > 0;

    socialList.innerHTML =
      socialLinks
        .map((link) => {
          const openUrl =
            safeUrl(link.url);

          const openButton =
            openUrl
              ? (
                  '<a class="button button-outline" href="' +
                    escapeHtml(openUrl) +
                  '" target="_blank" rel="noopener noreferrer">' +
                    "Open link" +
                  "</a>"
                )
              : "";

          return (
            '<article class="team-social-item">' +
              '<div class="team-social-item-main">' +
                "<h3>" +
                  escapeHtml(
                    link.label ||
                    link.platform
                  ) +
                "</h3>" +
                "<p>" +
                  escapeHtml(
                    link.platform +
                    " · " +
                    formatSocialScope(link)
                  ) +
                "</p>" +
                "<p>" +
                  escapeHtml(
                    link.published
                      ? "Displayed publicly"
                      : "Hidden from the public page"
                  ) +
                "</p>" +
              "</div>" +
              '<div class="team-editor-actions">' +
                openButton +
                '<button class="button button-primary" type="button" data-edit-social="' +
                  escapeHtml(link.id) +
                '">' +
                  "Edit" +
                "</button>" +
                '<button class="button button-outline" type="button" data-delete-social="' +
                  escapeHtml(link.id) +
                '">' +
                  "Delete" +
                "</button>" +
              "</div>" +
            "</article>"
          );
        })
        .join("");
  }

  function resetSocialForm() {
    socialForm.reset();

    socialForm.querySelector(
      '[name="social_id"]'
    ).value = "";

    socialForm.querySelector(
      '[name="published"]'
    ).checked = true;

    socialForm.querySelector(
      '[name="sort_order"]'
    ).value = "0";

    socialSubmitLabel.textContent =
      "Add social account";

    cancelSocialEdit.hidden = true;
  }

  function editSocialLink(link) {
    socialForm.querySelector(
      '[name="social_id"]'
    ).value = link.id;

    socialForm.querySelector(
      '[name="platform"]'
    ).value = link.platform;

    socialForm.querySelector(
      '[name="label"]'
    ).value = link.label || "";

    socialForm.querySelector(
      '[name="url"]'
    ).value = link.url || "";

    socialForm.querySelector(
      '[name="sport_scope"]'
    ).value =
      link.sport_scope || "All";

    socialForm.querySelector(
      '[name="program_scope"]'
    ).value =
      link.program_scope ||
      "combined";

    socialForm.querySelector(
      '[name="sort_order"]'
    ).value = String(
      link.sort_order || 0
    );

    socialForm.querySelector(
      '[name="published"]'
    ).checked =
      link.published === true;

    socialSubmitLabel.textContent =
      "Save social account";

    cancelSocialEdit.hidden = false;

    socialForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function updateImagePreviews() {
    const logoInput =
      profileForm.querySelector(
        '[name="logo_url"]'
      );

    const bannerInput =
      profileForm.querySelector(
        '[name="banner_image_url"]'
      );

    const logoUrl = safeUrl(
      logoInput.value
    );

    const bannerUrl = safeUrl(
      bannerInput.value
    );

    logoPreview.hidden = !logoUrl;
    bannerPreview.hidden = !bannerUrl;

    imagePreview.hidden =
      !logoUrl && !bannerUrl;

    if (logoUrl) {
      logoPreview.src = logoUrl;
    } else {
      logoPreview.removeAttribute(
        "src"
      );
    }

    if (bannerUrl) {
      bannerPreview.src = bannerUrl;
    } else {
      bannerPreview.removeAttribute(
        "src"
      );
    }
  }

  async function loadTeam() {
    const data = await apiFetch({
      action: "get",
      team_id: teamId
    });

    currentTeam = data.team;

    socialLinks =
      Array.isArray(
        data.social_links
      )
        ? data.social_links
        : [];

    populateProfileForm(
      currentTeam
    );

    updateStatus();
    renderSocialLinks();
    setEditorRestriction(currentTeam);
  }

  profileForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setFormBusy(
        profileForm,
        true
      );

      showMessage(
        "Saving the team profile..."
      );

      const formData =
        new FormData(profileForm);

      const payload =
        Object.fromEntries(
          formData.entries()
        );

      payload.action = "save";
      payload.team_id = teamId;

      payload.published =
        formData.get("published") ===
        "on";

      try {
        const data =
          await apiFetch(payload);

        currentTeam = data.team;

        populateProfileForm(
          currentTeam
        );

        updateStatus();

        showMessage(
          currentTeam.published
            ? "Team profile saved and published."
            : "Team profile saved as a private draft."
        );
      } catch (error) {
        showMessage(error.message);
      } finally {
        setFormBusy(
          profileForm,
          false
        );
      }
    }
  );

  socialForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setFormBusy(
        socialForm,
        true
      );

      showMessage(
        "Saving the social account..."
      );

      const formData =
        new FormData(socialForm);

      const payload =
        Object.fromEntries(
          formData.entries()
        );

      payload.action =
        "save_social";

      payload.team_id = teamId;

      payload.published =
        formData.get("published") ===
        "on";

      try {
        await apiFetch(payload);

        resetSocialForm();
        await loadTeam();

        showMessage(
          "Social account saved."
        );
      } catch (error) {
        showMessage(error.message);
      } finally {
        setFormBusy(
          socialForm,
          false
        );
      }
    }
  );

  socialList.addEventListener(
    "click",
    async (event) => {
      if (editorLocked) {
        return;
      }

      const editButton =
        event.target.closest(
          "[data-edit-social]"
        );

      if (editButton) {
        const link =
          socialLinks.find(
            (item) =>
              item.id ===
              editButton.dataset
                .editSocial
          );

        if (link) {
          editSocialLink(link);
        }

        return;
      }

      const deleteButton =
        event.target.closest(
          "[data-delete-social]"
        );

      if (!deleteButton) {
        return;
      }

      const link =
        socialLinks.find(
          (item) =>
            item.id ===
            deleteButton.dataset
              .deleteSocial
        );

      if (!link) {
        return;
      }

      const confirmed =
        window.confirm(
          "Delete " +
          (
            link.label ||
            link.platform
          ) +
          " from this team page?"
        );

      if (!confirmed) {
        return;
      }

      showMessage(
        "Deleting the social account..."
      );

      try {
        await apiFetch({
          action: "delete_social",
          team_id: teamId,
          social_id: link.id
        });

        await loadTeam();

        showMessage(
          "Social account deleted."
        );
      } catch (error) {
        showMessage(error.message);
      }
    }
  );

  cancelSocialEdit.addEventListener(
    "click",
    resetSocialForm
  );

  headCoachSetup.addEventListener(
    "change",
    updateHeadCoachFields
  );

  profileForm
    .querySelector(
      '[name="logo_url"]'
    )
    .addEventListener(
      "input",
      updateImagePreviews
    );

  profileForm
    .querySelector(
      '[name="banner_image_url"]'
    )
    .addEventListener(
      "input",
      updateImagePreviews
    );

  signOutButton.addEventListener(
    "click",
    async () => {
      signOutButton.disabled = true;

      if (adminMode) {
        window.location.replace(
          "/admin/team-manager/"
        );

        return;
      }

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
    const returnHref = adminMode
      ? "/admin/team-manager/"
      : "/team-dashboard/";

    const returnLabel = adminMode
      ? "Return to Team Manager"
      : "Return to team dashboard";

    if (!teamId) {
      loadingBox.innerHTML =
        "<h2>Team not selected</h2>" +
        "<p>Return to the team list and choose a team page.</p>" +
        '<a class="button button-primary" href="' +
          returnHref +
        '">' +
          returnLabel +
        "</a>";

      return;
    }

    try {
      if (adminMode) {
        signOutButton.textContent =
          "Return to Team Manager";
      } else {
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
      }

      await loadTeam();

      loadingBox.hidden = true;
      editor.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Unable to open the team editor</h2>" +
        "<p>" +
          escapeHtml(
            error.message ||
            "The team editor could not be loaded."
          ) +
        "</p>" +
        '<a class="button button-primary" href="' +
          returnHref +
        '">' +
          returnLabel +
        "</a>";
    }
  }

  initialize();
})();