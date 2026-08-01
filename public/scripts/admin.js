(() => {
  const loadingBox = document.querySelector(
    "[data-admin-loading]"
  );

  const loginForm = document.querySelector(
    "[data-admin-login]"
  );

  const dashboard = document.querySelector(
    "[data-admin-dashboard]"
  );

  const loginMessage = document.querySelector(
    "[data-admin-message]"
  );

  const logoutButton = document.querySelector(
    "[data-admin-logout]"
  );

  const meetForm = document.querySelector(
    "[data-meet-form]"
  );

  const createMessage = document.querySelector(
    "[data-create-message]"
  );

  const meetList = document.querySelector(
    "[data-admin-meet-list]"
  );

  const meetCount = document.querySelector(
    "[data-meet-count]"
  );

  const nameInput = meetForm.querySelector(
    '[name="name"]'
  );

  const slugInput = meetForm.querySelector(
    '[name="slug"]'
  );

  const dateInput = meetForm.querySelector(
    '[name="meet_date"]'
  );

  const meetIdInput = meetForm.querySelector(
    '[name="id"]'
  );

  const formTitle = document.querySelector(
    "[data-meet-form-title]"
  );

  const submitLabel = document.querySelector(
    "[data-meet-submit-label]"
  );

  const cancelEditButton = document.querySelector(
    "[data-cancel-edit]"
  );

  let slugWasEdited = false;
  let meetsCache = [];

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function updateSuggestedSlug() {
    if (slugWasEdited) {
      return;
    }

    const year = dateInput.value
      ? dateInput.value.slice(0, 4)
      : "";

    const baseSlug = slugify(nameInput.value);

    slugInput.value = [
      baseSlug,
      year
    ]
      .filter(Boolean)
      .join("-");
  }

  function showLogin() {
    loadingBox.hidden = true;
    dashboard.hidden = true;
    loginForm.hidden = false;
  }

  function showDashboard() {
    loadingBox.hidden = true;
    loginForm.hidden = true;
    dashboard.hidden = false;
    loadMeets();
  }

  function formatDate(value) {
    if (!value) {
      return "Date not set";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(
      new Date(value + "T12:00:00")
    );
  }

  function escapeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function finishFormReset() {
    meetIdInput.value = "";
    slugWasEdited = false;
    formTitle.textContent = "Create a new meet";
    submitLabel.textContent = "Create meet";
    cancelEditButton.hidden = true;
    createMessage.textContent = "";

    const stateInput = meetForm.querySelector(
      '[name="state"]'
    );

    if (stateInput) {
      stateInput.value = "Ohio";
    }
  }

  function populateMeetForm(meet) {
    for (const element of meetForm.elements) {
      if (!element.name) {
        continue;
      }

      if (
        element.type === "submit" ||
        element.type === "reset" ||
        element.type === "button"
      ) {
        continue;
      }

      if (element.type === "checkbox") {
        element.checked = meet[element.name] === true;
        continue;
      }

      let value = meet[element.name] ?? "";

      if (
        element.name === "start_time" &&
        typeof value === "string"
      ) {
        value = value.slice(0, 5);
      }

      element.value = value;
    }

    meetIdInput.value = meet.id;
    slugWasEdited = true;

    formTitle.textContent =
      "Edit " + meet.name;

    submitLabel.textContent =
      "Save changes";

    cancelEditButton.hidden = false;

    createMessage.textContent =
      "Editing " + meet.name + ".";

    meetForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function loadMeets() {
    meetCount.textContent = "Loading meets...";

    try {
      const response = await fetch(
        "/api/admin/meets/",
        {
          credentials: "same-origin"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load meets."
        );
      }

      meetsCache = Array.isArray(data.meets)
        ? data.meets
        : [];

      meetCount.textContent =
        meetsCache.length +
        (
          meetsCache.length === 1
            ? " meet"
            : " meets"
        );

      meetList.innerHTML = meetsCache
        .map((meet) => {
          const status = meet.published
            ? "Published"
            : "Draft";

          const featured = meet.featured
            ? "Featured"
            : "";

          return (
            '<article class="story-card">' +
              '<div class="story-card-body">' +
                '<p class="eyebrow">' +
                  escapeText(
                    meet.sport || "Meet"
                  ) +
                '</p>' +
                '<h3>' +
                  escapeText(meet.name) +
                '</h3>' +
                '<p><strong>' +
                  escapeText(
                    formatDate(meet.meet_date)
                  ) +
                '</strong></p>' +
                '<p>' +
                  escapeText(status) +
                  (
                    featured
                      ? " · " +
                        escapeText(featured)
                      : ""
                  ) +
                '</p>' +
                (
                  meet.city
                    ? '<p>' +
                        escapeText(meet.city) +
                        (
                          meet.state
                            ? ", " +
                              escapeText(
                                meet.state
                              )
                            : ""
                        ) +
                      '</p>'
                    : ""
                ) +
                '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;">' +
                  '<button class="button button-primary" type="button" data-edit-meet="' +
                    escapeText(meet.id) +
                  '">' +
                    'Edit meet' +
                  '</button>' +
                  (
                    meet.published
                      ? '<a class="button button-dark" href="/meetdetail/?slug=' +
                          encodeURIComponent(
                            meet.slug
                          ) +
                        '" target="_blank" rel="noopener noreferrer">' +
                          'View page' +
                        '</a>'
                      : ""
                  ) +
                '</div>' +
              '</div>' +
            '</article>'
          );
        })
        .join("");
    } catch (error) {
      console.error(
        "Admin meet list error:",
        error
      );

      meetCount.textContent =
        "Unable to load meets.";
    }
  }

  async function checkSession() {
    try {
      const response = await fetch(
        "/api/admin/session/",
        {
          credentials: "same-origin"
        }
      );

      const data = await response.json();

      if (data.authenticated === true) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (error) {
      console.error(
        "Admin session check error:",
        error
      );

      showLogin();

      loginMessage.textContent =
        "Unable to check your session.";
    }
  }

  loginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const submitButton =
        loginForm.querySelector(
          'button[type="submit"]'
        );

      const formData = new FormData(loginForm);

      loginMessage.textContent =
        "Signing in...";

      submitButton.disabled = true;

      try {
        const response = await fetch(
          "/api/admin/login/",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              password: String(
                formData.get("password") || ""
              )
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Sign in failed."
          );
        }

        loginForm.reset();
        loginMessage.textContent = "";
        showDashboard();
      } catch (error) {
        loginMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled = false;
      }
    }
  );

  logoutButton.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;

      try {
        await fetch(
          "/api/admin/logout/",
          {
            method: "POST",
            credentials: "same-origin"
          }
        );
      } finally {
        logoutButton.disabled = false;
        showLogin();
      }
    }
  );

  meetList.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest(
        "[data-edit-meet]"
      );

      if (!editButton) {
        return;
      }

      const meet = meetsCache.find(
        (item) =>
          item.id ===
          editButton.dataset.editMeet
      );

      if (meet) {
        populateMeetForm(meet);
      }
    }
  );

  cancelEditButton.addEventListener(
    "click",
    () => {
      meetForm.reset();
      finishFormReset();
      window.scrollTo({
        top: meetForm.offsetTop - 30,
        behavior: "smooth"
      });
    }
  );

  slugInput.addEventListener(
    "input",
    () => {
      slugWasEdited =
        slugInput.value.trim() !== "";
    }
  );

  nameInput.addEventListener(
    "input",
    updateSuggestedSlug
  );

  dateInput.addEventListener(
    "change",
    updateSuggestedSlug
  );

  meetForm.addEventListener(
    "reset",
    () => {
      window.setTimeout(
        finishFormReset,
        0
      );
    }
  );

  meetForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const submitButton =
        meetForm.querySelector(
          'button[type="submit"]'
        );

      const formData = new FormData(meetForm);
      const payload = {};

      for (
        const [key, value]
        of formData.entries()
      ) {
        payload[key] =
          typeof value === "string"
            ? value.trim()
            : value;
      }

      payload.featured =
        formData.get("featured") === "on";

      payload.published =
        formData.get("published") === "on";

      const isEditing =
        Boolean(payload.id);

      createMessage.textContent =
        isEditing
          ? "Saving changes..."
          : "Creating meet...";

      submitButton.disabled = true;

      try {
        const response = await fetch(
          "/api/admin/meets/",
          {
            method: isEditing
              ? "PUT"
              : "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify(payload)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            (
              isEditing
                ? "Unable to update the meet."
                : "Unable to create the meet."
            )
          );
        }

        meetForm.reset();
        finishFormReset();

        createMessage.textContent =
          isEditing
            ? "Meet changes saved."
            : (
                data.meet.published
                  ? "Meet created and published."
                  : "Meet saved as a draft."
              );

        await loadMeets();
      } catch (error) {
        createMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled = false;
      }
    }
  );

  checkSession();
})();