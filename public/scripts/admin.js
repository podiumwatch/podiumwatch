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

  const bulkForm = document.querySelector(
    "[data-bulk-form]"
  );

  const bulkFileInput = bulkForm.querySelector(
    '[name="csv_file"]'
  );

  const bulkPublishInput = bulkForm.querySelector(
    '[name="publish_all"]'
  );

  const bulkMessage = document.querySelector(
    "[data-bulk-message]"
  );

  const bulkResults = document.querySelector(
    "[data-bulk-results]"
  );

  const downloadTemplateButton =
    document.querySelector(
      "[data-download-template]"
    );

  const deleteDialog = document.querySelector(
    "[data-delete-dialog]"
  );

  const deleteForm = document.querySelector(
    "[data-delete-form]"
  );

  const deleteName = document.querySelector(
    "[data-delete-name]"
  );

  const deleteConfirmation =
    document.querySelector(
      "[data-delete-confirmation]"
    );

  const deleteMessage = document.querySelector(
    "[data-delete-message]"
  );

  const cancelDeleteButton =
    document.querySelector(
      "[data-cancel-delete]"
    );

  let slugWasEdited = false;
  let meetsCache = [];
  let deleteTarget = null;

  const templateHeaders = [
    "name",
    "slug",
    "sport",
    "meet_date",
    "start_time",
    "end_date",
    "venue_name",
    "address",
    "city",
    "state",
    "zip_code",
    "google_maps_url",
    "meet_type",
    "division",
    "host_school",
    "description",
    "schedule_text",
    "admission_text",
    "parking_text",
    "bus_information",
    "awards_text",
    "course_description",
    "teams_text",
    "results_url",
    "athleticnet_url",
    "milesplit_url",
    "registration_url",
    "official_website_url",
    "course_map_url",
    "parking_map_url",
    "schedule_pdf_url",
    "logo_url",
    "banner_image_url",
    "preview_article_url",
    "recap_article_url",
    "instagram_url",
    "featured",
    "published"
  ];

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

    const baseSlug = slugify(
      nameInput.value
    );

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

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    ).format(
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
    formTitle.textContent =
      "Create a new meet";
    submitLabel.textContent =
      "Create meet";
    cancelEditButton.hidden = true;

    const stateInput = meetForm.querySelector(
      '[name="state"]'
    );

    if (stateInput) {
      stateInput.value = "Ohio";
    }
  }

  function populateMeetForm(meet) {
    for (
      const element
      of meetForm.elements
    ) {
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
        element.checked =
          meet[element.name] === true;

        continue;
      }

      let value =
        meet[element.name] ?? "";

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

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      const character = text[index];

      if (insideQuotes) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            insideQuotes = false;
          }
        } else {
          field += character;
        }

        continue;
      }

      if (character === '"') {
        insideQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (insideQuotes) {
      throw new Error(
        "The CSV contains an unfinished quoted value."
      );
    }

    if (
      field !== "" ||
      row.length > 0
    ) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(
      (currentRow) =>
        currentRow.some(
          (value) =>
            String(value).trim() !== ""
        )
    );
  }

  function normalizeHeader(value) {
    const normalized = String(value || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const aliases = {
      meet: "name",
      meet_name: "name",
      date: "meet_date",
      meetdate: "meet_date",
      time: "start_time",
      start: "start_time",
      venue: "venue_name",
      location: "venue_name",
      zip: "zip_code",
      zipcode: "zip_code",
      host: "host_school",
      athletic_net_url:
        "athleticnet_url",
      athleticnet:
        "athleticnet_url",
      milesplit:
        "milesplit_url",
      website:
        "official_website_url"
    };

    return aliases[normalized] ||
      normalized;
  }

  function normalizeDate(value) {
    const cleaned = String(value || "")
      .trim();

    if (!cleaned) {
      return "";
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        cleaned
      )
    ) {
      return cleaned;
    }

    const match = cleaned.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (!match) {
      return cleaned;
    }

    const month = match[1].padStart(
      2,
      "0"
    );

    const day = match[2].padStart(
      2,
      "0"
    );

    return (
      match[3] +
      "-" +
      month +
      "-" +
      day
    );
  }

  function normalizeSport(value) {
    const cleaned = String(value || "")
      .trim();

    const lower = cleaned.toLowerCase();

    if (
      lower === "xc" ||
      lower === "cross country"
    ) {
      return "Cross Country";
    }

    if (
      lower === "track" ||
      lower === "track and field" ||
      lower === "track & field"
    ) {
      return "Track and Field";
    }

    return cleaned;
  }

  function csvToMeetObjects(text) {
    const rows = parseCsv(text);

    if (rows.length < 2) {
      throw new Error(
        "The CSV must include a header row and at least one meet."
      );
    }

    const headers = rows[0].map(
      normalizeHeader
    );

    const requiredHeaders = [
      "name",
      "sport",
      "meet_date"
    ];

    const missingHeaders =
      requiredHeaders.filter(
        (header) =>
          !headers.includes(header)
      );

    if (missingHeaders.length > 0) {
      throw new Error(
        "Missing required columns: " +
        missingHeaders.join(", ")
      );
    }

    const meets = rows
      .slice(1)
      .map((values) => {
        const meet = {};

        headers.forEach(
          (header, index) => {
            if (!header) {
              return;
            }

            meet[header] =
              String(
                values[index] ?? ""
              ).trim();
          }
        );

        meet.meet_date =
          normalizeDate(
            meet.meet_date
          );

        meet.end_date =
          normalizeDate(
            meet.end_date
          );

        meet.sport =
          normalizeSport(
            meet.sport
          );

        if (!meet.state) {
          meet.state = "Ohio";
        }

        if (
          bulkPublishInput.checked &&
          !meet.published
        ) {
          meet.published = "true";
        }

        return meet;
      })
      .filter(
        (meet) =>
          Object.values(meet).some(
            (value) =>
              String(value).trim() !== ""
          )
      );

    if (meets.length === 0) {
      throw new Error(
        "No meet rows were found in the CSV."
      );
    }

    return meets;
  }

  function csvCell(value) {
    return (
      '"' +
      String(value ?? "")
        .replaceAll('"', '""') +
      '"'
    );
  }

  function downloadTemplate() {
    const sampleMeet = {
      name: "Example Invitational",
      slug:
        "example-invitational-2026",
      sport: "Cross Country",
      meet_date: "2026-09-05",
      start_time: "09:00",
      venue_name: "Example Park",
      city: "Example City",
      state: "Ohio",
      featured: "false",
      published: "false"
    };

    const headerLine =
      templateHeaders
        .map(csvCell)
        .join(",");

    const exampleLine =
      templateHeaders
        .map(
          (header) =>
            csvCell(
              sampleMeet[header] ?? ""
            )
        )
        .join(",");

    const blob = new Blob(
      [
        headerLine +
        "\r\n" +
        exampleLine +
        "\r\n"
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "podium-watch-meet-import-template.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function openDeleteDialog(meet) {
    deleteTarget = meet;
    deleteName.textContent = meet.name;
    deleteConfirmation.value = "";
    deleteMessage.textContent = "";

    if (
      typeof deleteDialog.showModal ===
      "function"
    ) {
      deleteDialog.showModal();
    } else {
      deleteDialog.setAttribute(
        "open",
        ""
      );
    }

    deleteConfirmation.focus();
  }

  function closeDeleteDialog() {
    deleteTarget = null;
    deleteConfirmation.value = "";
    deleteMessage.textContent = "";

    if (
      typeof deleteDialog.close ===
      "function"
    ) {
      deleteDialog.close();
    } else {
      deleteDialog.removeAttribute(
        "open"
      );
    }
  }

  function renderBulkErrors(errors) {
    if (
      !Array.isArray(errors) ||
      errors.length === 0
    ) {
      bulkResults.innerHTML = "";
      return;
    }

    bulkResults.innerHTML =
      '<div class="info-card">' +
        '<h3>Rows that were not imported</h3>' +
        '<ul>' +
          errors
            .map(
              (error) =>
                "<li>" +
                  "Row " +
                  escapeText(error.row) +
                  (
                    error.name
                      ? ": " +
                        escapeText(
                          error.name
                        )
                      : ""
                  ) +
                  ". " +
                  escapeText(
                    error.error
                  ) +
                "</li>"
            )
            .join("") +
        "</ul>" +
      "</div>";
  }

  async function loadMeets() {
    meetCount.textContent =
      "Loading meets...";

    try {
      const response = await fetch(
        "/api/admin/meets/",
        {
          credentials: "same-origin"
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load meets."
        );
      }

      meetsCache =
        Array.isArray(data.meets)
          ? data.meets
          : [];

      meetCount.textContent =
        meetsCache.length +
        (
          meetsCache.length === 1
            ? " meet"
            : " meets"
        );

      meetList.innerHTML =
        meetsCache
          .map((meet) => {
            const status =
              meet.published
                ? "Published"
                : "Draft";

            const featured =
              meet.featured
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
                    escapeText(
                      meet.name
                    ) +
                  '</h3>' +
                  '<p><strong>' +
                    escapeText(
                      formatDate(
                        meet.meet_date
                      )
                    ) +
                  '</strong></p>' +
                  '<p>' +
                    escapeText(status) +
                    (
                      featured
                        ? " · " +
                          escapeText(
                            featured
                          )
                        : ""
                    ) +
                  '</p>' +
                  (
                    meet.city
                      ? '<p>' +
                          escapeText(
                            meet.city
                          ) +
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
                      "Edit meet" +
                    "</button>" +
                    (
                      meet.published
                        ? '<a class="button button-dark" href="/meetdetail/?slug=' +
                            encodeURIComponent(
                              meet.slug
                            ) +
                          '" target="_blank" rel="noopener noreferrer">' +
                            "View page" +
                          "</a>"
                        : ""
                    ) +
                    '<button class="button button-outline" type="button" data-delete-meet="' +
                      escapeText(meet.id) +
                    '">' +
                      "Delete meet" +
                    "</button>" +
                  "</div>" +
                "</div>" +
              "</article>"
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
        "/api/admin/auth/",
        {
          credentials: "same-origin"
        }
      );

      const data =
        await response.json();

      if (
        data.authenticated === true
      ) {
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

      const formData =
        new FormData(loginForm);

      loginMessage.textContent =
        "Signing in...";

      submitButton.disabled = true;

      try {
        const response = await fetch(
          "/api/admin/auth/",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              password: String(
                formData.get(
                  "password"
                ) || ""
              )
            })
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Sign in failed."
          );
        }

        loginForm.reset();
        loginMessage.textContent = "";
        showDashboard();
      } catch (error) {
        loginMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled =
          false;
      }
    }
  );

  logoutButton.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;

      try {
        await fetch(
          "/api/admin/auth/",
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
      const editButton =
        event.target.closest(
          "[data-edit-meet]"
        );

      if (editButton) {
        const meet =
          meetsCache.find(
            (item) =>
              item.id ===
              editButton.dataset
                .editMeet
          );

        if (meet) {
          populateMeetForm(meet);
        }

        return;
      }

      const deleteButton =
        event.target.closest(
          "[data-delete-meet]"
        );

      if (deleteButton) {
        const meet =
          meetsCache.find(
            (item) =>
              item.id ===
              deleteButton.dataset
                .deleteMeet
          );

        if (meet) {
          openDeleteDialog(meet);
        }
      }
    }
  );

  cancelEditButton.addEventListener(
    "click",
    () => {
      meetForm.reset();
      finishFormReset();

      window.scrollTo({
        top:
          meetForm.offsetTop - 30,
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

      const formData =
        new FormData(meetForm);

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
        formData.get("featured") ===
        "on";

      payload.published =
        formData.get("published") ===
        "on";

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
            method:
              isEditing
                ? "PUT"
                : "POST",
            credentials:
              "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(payload)
          }
        );

        const data =
          await response.json();

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

        window.setTimeout(
          () => {
            finishFormReset();

            createMessage.textContent =
              isEditing
                ? "Meet changes saved."
                : (
                    data.meet.published
                      ? "Meet created and published."
                      : "Meet saved as a draft."
                  );
          },
          0
        );

        await loadMeets();
      } catch (error) {
        createMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled =
          false;
      }
    }
  );

  downloadTemplateButton.addEventListener(
    "click",
    downloadTemplate
  );

  bulkFileInput.addEventListener(
    "change",
    async () => {
      bulkResults.innerHTML = "";

      const file =
        bulkFileInput.files[0];

      if (!file) {
        bulkMessage.textContent = "";
        return;
      }

      try {
        const text =
          await file.text();

        const meets =
          csvToMeetObjects(text);

        bulkMessage.textContent =
          meets.length +
          (
            meets.length === 1
              ? " meet is ready to import."
              : " meets are ready to import."
          );
      } catch (error) {
        bulkMessage.textContent =
          error.message;
      }
    }
  );

  bulkForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const file =
        bulkFileInput.files[0];

      if (!file) {
        bulkMessage.textContent =
          "Choose a CSV file first.";

        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        bulkMessage.textContent =
          "The CSV file is too large.";

        return;
      }

      const submitButton =
        bulkForm.querySelector(
          'button[type="submit"]'
        );

      submitButton.disabled = true;
      bulkResults.innerHTML = "";
      bulkMessage.textContent =
        "Importing meets...";

      try {
        const text =
          await file.text();

        const meets =
          csvToMeetObjects(text);

        const response = await fetch(
          "/api/admin/meets/",
          {
            method: "POST",
            credentials:
              "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              meets
            })
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Unable to import the meets."
          );
        }

        bulkMessage.textContent =
          data.created_count +
          (
            data.created_count === 1
              ? " meet was created."
              : " meets were created."
          ) +
          (
            data.error_count > 0
              ? " " +
                data.error_count +
                (
                  data.error_count === 1
                    ? " row had an error."
                    : " rows had errors."
                )
              : ""
          );

        renderBulkErrors(
          data.errors
        );

        if (
          data.error_count === 0
        ) {
          bulkForm.reset();
        }

        await loadMeets();
      } catch (error) {
        bulkMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled =
          false;
      }
    }
  );

  cancelDeleteButton.addEventListener(
    "click",
    closeDeleteDialog
  );

  deleteForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!deleteTarget) {
        return;
      }

      const confirmation =
        deleteConfirmation.value
          .trim();

      if (
        confirmation !==
        deleteTarget.name
      ) {
        deleteMessage.textContent =
          "The meet name does not match.";

        return;
      }

      const submitButton =
        deleteForm.querySelector(
          'button[type="submit"]'
        );

      submitButton.disabled = true;
      deleteMessage.textContent =
        "Deleting meet...";

      try {
        const response = await fetch(
          "/api/admin/meets/",
          {
            method: "DELETE",
            credentials:
              "same-origin",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              id: deleteTarget.id,
              confirm_name:
                confirmation
            })
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Unable to delete the meet."
          );
        }

        if (
          meetIdInput.value ===
          deleteTarget.id
        ) {
          meetForm.reset();
          finishFormReset();
        }

        closeDeleteDialog();
        await loadMeets();
      } catch (error) {
        deleteMessage.textContent =
          error.message;
      } finally {
        submitButton.disabled =
          false;
      }
    }
  );

  checkSession();
})();