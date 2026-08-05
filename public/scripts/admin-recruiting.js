(() => {
  const root = document.querySelector("[data-recruit-admin]");

  if (!root) return;

  const loading = root.querySelector("[data-recruit-admin-loading]");
  const dashboard = root.querySelector("[data-recruit-admin-dashboard]");
  const message = root.querySelector("[data-recruit-admin-message]");
  const searchForm = root.querySelector("[data-recruit-search-form]");
  const searchResults = root.querySelector("[data-recruit-search-results]");
  const athleteEditor = root.querySelector("[data-recruit-athlete-editor]");
  const athleteTitle = root.querySelector("[data-recruit-athlete-title]");
  const ratingForm = root.querySelector("[data-recruit-rating-form]");
  const activityForm = root.querySelector("[data-recruit-activity-form]");
  const ratingRows = root.querySelector("[data-recruit-rating-rows]");
  const activityRows = root.querySelector("[data-recruit-activity-rows]");
  const bestRows = root.querySelector("[data-recruit-best-rows]");
  const eventOptions = root.querySelector("[data-recruit-event-options]");
  const bestEventOptions = root.querySelector("[data-recruit-best-event-options]");
  const importForm = root.querySelector("[data-performance-import-form]");
  const importCommit = root.querySelector("[data-performance-import-commit]");
  const importSummary = root.querySelector("[data-performance-import-summary]");
  const importRows = root.querySelector("[data-performance-import-rows]");
  const resultsLinkButton = root.querySelector("[data-results-link-import]");
  const resultsFileInput = importForm?.querySelector('[name="results_file"]');
  const contentForm = root.querySelector("[data-recruit-content-form]");
  const contentRows = root.querySelector("[data-recruit-content-rows]");
  const previewButton = root.querySelector("[data-recruit-preview-button]");
  const previewPanel = root.querySelector("[data-recruit-preview-panel]");
  const previewBody = root.querySelector("[data-recruit-preview-body]");
  const comparisonButton = root.querySelector("[data-recruit-comparison-button]");
  const comparisonPanel = root.querySelector("[data-recruit-comparison-panel]");
  const comparisonRows = root.querySelector("[data-recruit-comparison-rows]");
  let statusData = null;
  let selected = null;
  let importPreview = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function setBusy(value) {
    busy = value;

    root.querySelectorAll("button").forEach((button) => {
      button.disabled = value ||
        (button === importCommit && !importPreview?.summary?.ready);
    });
  }

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  async function api(body) {
    const response = await fetch("/api/admin/recruiting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload.error || "The recruiting admin request failed."
      );
    }

    return payload;
  }

  function setStat(selector, value) {
    const element = root.querySelector(selector);

    if (element) element.textContent = String(value ?? 0);
  }

  function renderStatus() {
    const counts = statusData?.counts || {};
    setStat("[data-recruit-stat-performances]", counts.performances || 0);
    setStat("[data-recruit-stat-verified]", counts.verified_performances || 0);
    setStat("[data-recruit-stat-published]", counts.published_ratings || 0);
    setStat("[data-recruit-stat-drafts]", counts.draft_ratings || 0);
    setStat("[data-recruit-stat-activity]", counts.recruiting_activities || 0);
    setStat("[data-recruit-stat-failed]", counts.failed_imports || 0);

    const options = ['<option value="">Choose an event</option>']
      .concat((statusData.events || []).map((event) =>
        '<option value="' + escapeHtml(event.event_key) + '">' +
          escapeHtml(event.display_name) +
          " | " + escapeHtml(titleCase(event.event_group)) +
        "</option>"
      ))
      .join("");

    eventOptions.innerHTML = options;
    bestEventOptions.innerHTML = options;
  }

  function profileButton(profile) {
    const school = profile.school?.school_name ||
      profile.team?.school_name ||
      "School not linked";

    return '<button class="recruit-admin-profile-button" type="button" data-profile-id="' +
      escapeHtml(profile.id) +
      '"><strong>' + escapeHtml(profile.display_name) +
      '</strong><span>' +
      escapeHtml([
        school,
        profile.graduation_year,
        titleCase(profile.gender),
        profile.college_commitment || "Uncommitted"
      ].filter(Boolean).join(" | ")) +
      "</span></button>";
  }

  function fillForm(form, values) {
    for (const element of form.elements) {
      if (!element.name) continue;
      const value = values?.[element.name];

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else if (Array.isArray(value)) {
        element.value = value.join(", ");
      } else {
        element.value = value ?? "";
      }
    }
  }

  function formPayload(form) {
    const payload = {};

    for (const element of form.elements) {
      if (!element.name) continue;
      payload[element.name] = element.type === "checkbox"
        ? element.checked
        : element.value;
    }

    return payload;
  }

  function readResultsFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("The selected results file could not be read."));
      reader.readAsText(file);
    });
  }

  function stars(starCount) {
    const count = Number(starCount) || 0;
    return "★".repeat(count) + "☆".repeat(Math.max(0, 5 - count));
  }

  function renderSelected(context) {
    selected = context;
    const profile = context.profile || {};
    athleteEditor.hidden = false;
    athleteTitle.textContent =
      "Edit " + (profile.display_name || "athlete");
    ratingForm.elements.profile_id.value = profile.id || "";
    activityForm.elements.profile_id.value = profile.id || "";

    const currentRating = (context.ratings || []).find(
      (item) => item.status !== "archived"
    );

    ratingForm.reset();
    ratingForm.elements.profile_id.value = profile.id || "";

    if (currentRating) {
      fillForm(ratingForm, currentRating);
      ratingForm.elements.rating_id.value = currentRating.id || "";
      ratingForm.elements.based_on_verified_data.checked =
        Boolean(currentRating.based_on_verified_data);
    } else {
      ratingForm.elements.status.value = "draft";
      ratingForm.elements.confidence_level.value = "developing";
      ratingForm.elements.data_cutoff_date.value =
        new Date().toISOString().slice(0, 10);
    }

    activityForm.reset();
    activityForm.elements.profile_id.value = profile.id || "";

    contentForm.reset();
    contentForm.elements.profile_id.value = profile.id || "";
    previewPanel.hidden = true;
    previewBody.innerHTML = "";
    comparisonPanel.hidden = true;
    comparisonRows.innerHTML = "";

    const best = context.best_performances || [];
    bestRows.innerHTML = best.length
      ? best.map((item) =>
          "<tr><td>" + escapeHtml(item.event_name) +
          "</td><td>" + escapeHtml(item.mark_text) +
          "</td><td>" + escapeHtml(item.meet_name || "Not listed") +
          "</td><td>" +
          (item.source_url
            ? '<a href="' + escapeHtml(item.source_url) +
              '" target="_blank" rel="noopener">' +
              escapeHtml(item.source_label) + "</a>"
            : escapeHtml(item.source_label)) +
          "</td></tr>"
        ).join("")
      : '<tr><td colspan="4">No sourced best performances are available. Add or import performance evidence before publishing a rating.</td></tr>';

    ratingRows.innerHTML = (context.ratings || []).length
      ? context.ratings.map((item) =>
          "<tr><td>" + escapeHtml(titleCase(item.event_group)) +
          "</td><td>" + escapeHtml(item.rating_score ?? "Not rated") +
          "</td><td>" + escapeHtml(stars(item.star_rating)) +
          "</td><td>" + escapeHtml(titleCase(item.status)) +
          '</td><td><button class="button button-outline" type="button" data-rating-edit="' +
          escapeHtml(item.id) + '">Edit</button></td></tr>'
        ).join("")
      : '<tr><td colspan="5">No recruit ratings yet.</td></tr>';

    activityRows.innerHTML = (context.activities || []).length
      ? context.activities.map((item) =>
          "<tr><td>" + escapeHtml(titleCase(item.activity_type)) +
          "</td><td>" + escapeHtml(item.college_name) +
          "</td><td>" + escapeHtml(item.activity_date || "Not listed") +
          "</td><td>" + escapeHtml(titleCase(item.verification_status)) +
          "</td><td>" + (item.public_visible ? "Yes" : "No") +
          '</td><td><button class="button button-outline" type="button" data-activity-edit="' +
          escapeHtml(item.id) +
          '">Edit</button> <button class="button button-outline" type="button" data-activity-archive="' +
          escapeHtml(item.id) + '">Archive</button></td></tr>'
        ).join("")
      : '<tr><td colspan="6">No recruiting activity yet.</td></tr>';

    contentRows.innerHTML = (context.content_items || []).length
      ? context.content_items.map((item) =>
          "<tr><td>" + escapeHtml(titleCase(item.content_type)) +
          "</td><td>" + escapeHtml(item.title || "Untitled") +
          "</td><td>" + escapeHtml(titleCase(item.status)) +
          "</td><td>" + (item.featured ? "Yes" : "No") +
          '</td><td><button class="button button-outline" type="button" data-content-edit="' +
          escapeHtml(item.id) +
          '">Edit</button> <button class="button button-outline" type="button" data-content-archive="' +
          escapeHtml(item.id) + '">Archive</button></td></tr>'
        ).join("")
      : '<tr><td colspan="5">No media items yet.</td></tr>';

    athleteEditor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") {
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

    row.push(field);

    if (row.some((value) => String(value).trim())) {
      rows.push(row);
    }

    if (rows.length < 2) {
      throw new Error("Paste a header row and at least one performance row.");
    }

    const headers = rows[0].map((value) =>
      String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );

    return rows.slice(1).map((values) => {
      const item = {};
      headers.forEach((header, index) => {
        if (header) item[header] = String(values[index] ?? "").trim();
      });
      return item;
    });
  }

  function renderImportPreview(preview) {
    importPreview = preview;
    const summary = preview.summary || {};
    const summaryItems = [
      ["Total", summary.total],
      ["Ready", summary.ready],
      ["Duplicates", summary.duplicate],
      ["Unmatched", summary.unmatched],
      ["Ambiguous", summary.ambiguous],
      ["Invalid", summary.invalid]
    ];

    importSummary.innerHTML = summaryItems.map(([label, value]) =>
      "<div><strong>" + escapeHtml(value || 0) +
      "</strong><span>" + escapeHtml(label) + "</span></div>"
    ).join("");

    importRows.innerHTML = (preview.rows || []).map((item) =>
      "<tr><td>" + escapeHtml(item.row_number) +
      "</td><td>" + escapeHtml(item.athlete_name) +
      "<br><small>" + escapeHtml(item.school_name) +
      "</small></td><td>" + escapeHtml(item.event_name) +
      "</td><td>" + escapeHtml(item.mark_text) +
      "</td><td>" + escapeHtml(titleCase(item.row_status)) +
      "</td><td>" + escapeHtml((item.errors || []).join(" ") || "Ready") +
      "</td></tr>"
    ).join("");

    importCommit.disabled = !summary.ready;
  }

  async function loadStatus(force = false) {
    if (busy && !force) return;
    const managedBusyState = !busy;

    if (managedBusyState) {
      setBusy(true);
    }

    try {
      statusData = await api({ action: "status" });
      loading.hidden = true;
      dashboard.hidden = false;
      renderStatus();

      if (!statusData.installed) {
        showMessage(
          "Run install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql before using this page.",
          "warning"
        );
      } else {
        showMessage("Recruit Ratings and Performance Center loaded.");
      }
    } catch (error) {
      loading.innerHTML =
        "<h2>Admin access required</h2><p>" +
        escapeHtml(error.message) +
        '</p><a class="button button-primary" href="/admin/">Open admin sign in</a>';
    } finally {
      if (managedBusyState) {
        setBusy(false);
      }
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !statusData?.installed) return;
    setBusy(true);

    try {
      const data = await api({
        action: "search",
        search: new FormData(searchForm).get("search") || "",
        limit: 150
      });
      searchResults.innerHTML = data.profiles?.length
        ? data.profiles.map(profileButton).join("")
        : "<p>No athlete profiles matched.</p>";
      showMessage((data.profiles?.length || 0) + " athlete profiles loaded.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  searchResults.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-profile-id]");

    if (!button || busy) return;
    setBusy(true);

    try {
      renderSelected(await api({
        action: "get",
        profile_id: button.dataset.profileId
      }));
      showMessage("Athlete recruiting profile loaded.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  ratingRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rating-edit]");

    if (!button || !selected) return;
    const item = selected.ratings?.find(
      (rating) => rating.id === button.dataset.ratingEdit
    );

    if (item) {
      fillForm(ratingForm, item);
      ratingForm.elements.profile_id.value = selected.profile.id;
      ratingForm.elements.rating_id.value = item.id;
      ratingForm.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  ratingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) return;
    const payload = formPayload(ratingForm);

    if (
      payload.status === "published" &&
      !window.confirm(
        "Publish this Podium Watch recruit rating? Confirm that the sourced performances, score, evaluation, and data cutoff date have been reviewed."
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const result = await api({
        action: "save_rating",
        ...payload
      });
      renderSelected(result.context);
      showMessage(
        "Recruit rating saved. The star count was calculated from the numerical score."
      );
      await loadStatus(true);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  activityRows.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-activity-edit]");
    const archive = event.target.closest("[data-activity-archive]");

    if ((!edit && !archive) || !selected || busy) return;
    const id = edit?.dataset.activityEdit ||
      archive?.dataset.activityArchive;
    const item = selected.activities?.find(
      (activity) => activity.id === id
    );

    if (edit && item) {
      fillForm(activityForm, item);
      activityForm.elements.profile_id.value = selected.profile.id;
      activityForm.elements.activity_id.value = item.id;
      activityForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!window.confirm("Archive this recruiting activity?")) return;
    setBusy(true);

    try {
      renderSelected(await api({
        action: "archive_activity",
        profile_id: selected.profile.id,
        activity_id: id
      }));
      showMessage("Recruiting activity archived.");
      await loadStatus(true);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  activityForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) return;
    const payload = formPayload(activityForm);

    if (
      payload.public_visible &&
      !window.confirm(
        "Publish this recruiting activity? Confirm the source link and verification label are correct."
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const result = await api({
        action: "save_activity",
        ...payload
      });
      renderSelected(result.context);
      activityForm.reset();
      activityForm.elements.profile_id.value = result.context.profile.id;
      showMessage("Recruiting activity saved.");
      await loadStatus(true);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  contentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) return;
    const payload = formPayload(contentForm);

    if (
      payload.status === "published" &&
      !window.confirm("Publish this media item on the athlete's public profile?")
    ) {
      return;
    }

    setBusy(true);

    try {
      const result = await api({
        action: "save_content_item",
        ...payload
      });
      renderSelected(result.context);
      showMessage("Media item saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  contentRows.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-content-edit]");
    const archive = event.target.closest("[data-content-archive]");

    if ((!edit && !archive) || !selected || busy) return;
    const id = edit?.dataset.contentEdit || archive?.dataset.contentArchive;
    const item = selected.content_items?.find((row) => row.id === id);

    if (edit && item) {
      fillForm(contentForm, item);
      contentForm.elements.profile_id.value = selected.profile.id;
      contentForm.elements.content_item_id.value = item.id;
      contentForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!window.confirm("Archive this media item?")) return;
    setBusy(true);

    try {
      renderSelected(await api({
        action: "archive_content_item",
        profile_id: selected.profile.id,
        content_item_id: id
      }));
      showMessage("Media item archived.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  function renderPreview(data) {
    const profile = data.profile || {};
    const rows = (data.ratings || []).map((rating) =>
      "<tr><td>" + escapeHtml(titleCase(rating.event_group)) +
      "</td><td>" + escapeHtml(rating.rating_score ?? "Not rated") +
      "</td><td>" + escapeHtml(stars(rating.star_rating)) +
      "</td><td>" + escapeHtml(titleCase(rating.status)) +
      "</td><td>" + escapeHtml(
        rating.would_show_on_public_directory
          ? "Class No. " + (rating.state_class_rank ?? "—") + ", group No. " + (rating.event_group_rank ?? "—")
          : rating.rank_note
      ) + "</td></tr>"
    ).join("") || '<tr><td colspan="5">No ratings yet.</td></tr>';

    const activityRowsMarkup = (data.activities || []).map((activity) =>
      "<tr><td>" + escapeHtml(titleCase(activity.activity_type)) +
      "</td><td>" + escapeHtml(activity.college_name) +
      "</td><td>" + escapeHtml(activity.would_show_on_public_profile ? "Would be public" : "Stays private") +
      "</td></tr>"
    ).join("") || '<tr><td colspan="3">No recruiting activity yet.</td></tr>';

    const contentRowsMarkup = (data.content_items || []).map((item) =>
      "<tr><td>" + escapeHtml(titleCase(item.content_type)) +
      "</td><td>" + escapeHtml(item.title || "Untitled") +
      "</td><td>" + escapeHtml(item.would_show_on_public_profile ? "Would be public" : "Stays private") +
      "</td></tr>"
    ).join("") || '<tr><td colspan="3">No media items yet.</td></tr>';

    previewBody.innerHTML =
      "<p><strong>" + escapeHtml(profile.display_name) + "</strong> — " +
      escapeHtml(
        data.would_be_public
          ? "Recruiting information is enabled and consent confirmed, so published items would appear publicly."
          : "Recruiting is not enabled or consent is not confirmed, so nothing would appear publicly yet, even if published."
      ) + "</p>" +
      "<div class=\"recruit-admin-table-wrap\"><table class=\"recruit-admin-table\"><thead><tr><th>Group</th><th>Score</th><th>Stars</th><th>Status</th><th>Rank if published</th></tr></thead><tbody>" +
      rows + "</tbody></table></div>" +
      "<div class=\"recruit-admin-table-wrap\"><table class=\"recruit-admin-table\"><thead><tr><th>Activity</th><th>College</th><th>Public preview</th></tr></thead><tbody>" +
      activityRowsMarkup + "</tbody></table></div>" +
      "<div class=\"recruit-admin-table-wrap\"><table class=\"recruit-admin-table\"><thead><tr><th>Media</th><th>Title</th><th>Public preview</th></tr></thead><tbody>" +
      contentRowsMarkup + "</tbody></table></div>";
  }

  previewButton?.addEventListener("click", async () => {
    if (busy || !selected) return;
    setBusy(true);

    try {
      const data = await api({
        action: "preview_public_profile",
        profile_id: selected.profile.id
      });
      renderPreview(data);
      previewPanel.hidden = false;
      previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      showMessage("Public profile preview generated. Nothing was published.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  comparisonButton?.addEventListener("click", async () => {
    if (busy || !selected) return;
    const eventGroup = ratingForm.elements.event_group.value;
    const gender = selected.profile.gender;
    const graduationYear = selected.profile.graduation_year;

    if (!eventGroup) {
      showMessage("Choose an event group first.", "error");
      return;
    }

    if (!graduationYear || !gender || gender === "unspecified") {
      showMessage("This athlete needs a graduation year and gender before comparing.", "error");
      return;
    }

    setBusy(true);

    try {
      const data = await api({
        action: "load_rating_comparison",
        graduation_year: graduationYear,
        gender,
        event_group: eventGroup,
        exclude_profile_id: selected.profile.id
      });

      comparisonRows.innerHTML = (data.comparisons || []).length
        ? data.comparisons.map((item) =>
            "<tr><td>" + escapeHtml(item.display_name) +
            "</td><td>" + escapeHtml(item.mark_text || "Not listed") +
            "</td><td>" + escapeHtml(item.rating_score ?? "Not rated") +
            "</td><td>" + escapeHtml(stars(item.star_rating)) +
            "</td><td>No. " + escapeHtml(item.state_class_rank ?? "—") +
            "</td><td>No. " + escapeHtml(item.event_group_rank ?? "—") +
            "</td></tr>"
          ).join("")
        : '<tr><td colspan="6">No other published ratings exist yet in this class, gender, and event group.</td></tr>';

      comparisonPanel.hidden = false;
      comparisonPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      showMessage("Comparison loaded. This is reference context only -- it does not suggest a score.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  resultsLinkButton?.addEventListener("click", async () => {
    if (busy || !statusData?.installed) return;
    const sourceUrl = importForm.elements.source_url.value.trim();
    if (!sourceUrl) {
      showMessage("Enter an official results link first.", "error");
      return;
    }

    setBusy(true);
    try {
      const result = await api({ action: "load_results_link", source_url: sourceUrl });
      importForm.elements.csv_data.value = result.csv_data || "";
      importForm.elements.source_url.value = result.source_url || sourceUrl;
      importForm.elements.source_label.value = result.source_label || "Official meet results";
      showMessage("Official results loaded. Enter the meet details, then preview the results.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  resultsFileInput?.addEventListener("change", async () => {
    const file = resultsFileInput.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      resultsFileInput.value = "";
      showMessage("The results file must be smaller than 8 MB.", "error");
      return;
    }

    try {
      importForm.elements.csv_data.value = await readResultsFile(file);
      showMessage("Results file loaded. Enter the meet details, then preview the results.");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !statusData?.installed) return;
    setBusy(true);
    importPreview = null;
    importCommit.disabled = true;

    try {
      const payload = formPayload(importForm);
      const rows = parseCsv(payload.csv_data);
      const preview = await api({
        action: "preview_performance_import",
        ...payload,
        rows
      });
      preview.submitted_rows = rows;
      renderImportPreview(preview);
      showMessage(
        "Performance import preview completed. Only rows marked Ready can be imported."
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  importCommit.addEventListener("click", async () => {
    if (busy || !importPreview?.summary?.ready) return;

    if (
      !window.confirm(
        "Import the reviewed performance rows now? Only exact safe matches marked Ready will be saved."
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const payload = formPayload(importForm);
      const result = await api({
        action: "commit_performance_import",
        ...payload,
        rows: importPreview.submitted_rows,
        confirm: true
      });
      showMessage(
        (result.summary?.imported || 0) +
        " sourced performance records were imported."
      );
      importPreview = null;
      importCommit.disabled = true;
      importRows.innerHTML = "";
      importSummary.innerHTML = "";
      await loadStatus(true);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  loadStatus();
})();
