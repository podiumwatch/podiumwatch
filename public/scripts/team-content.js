(() => {
  const loadingBox = document.querySelector("[data-team-content-loading]");
  const root = document.querySelector("[data-team-content]");
  const adminNotice = document.querySelector("[data-team-content-admin-notice]");
  const teamName = document.querySelector("[data-team-content-name]");
  const accountText = document.querySelector("[data-team-content-account]");
  const profileLink = document.querySelector("[data-team-content-profile]");
  const returnLink = document.querySelector("[data-team-content-return]");
  const signOutButton = document.querySelector("[data-team-content-signout]");
  const messageBox = document.querySelector("[data-team-content-message]");
  const addButton = document.querySelector("[data-team-content-add]");
  const list = document.querySelector("[data-team-content-list]");
  const emptyState = document.querySelector("[data-team-content-empty]");
  const searchInput = document.querySelector("[data-content-search]");
  const typeFilter = document.querySelector("[data-content-type-filter]");
  const statusFilter = document.querySelector("[data-content-status-filter]");
  const clearFiltersButton = document.querySelector("[data-content-clear-filters]");
  const dialog = document.querySelector("[data-team-content-dialog]");
  const dialogTitle = document.querySelector("[data-team-content-dialog-title]");
  const closeDialogButton = document.querySelector("[data-team-content-dialog-close]");
  const form = document.querySelector("[data-team-content-form]");
  const deleteButton = document.querySelector("[data-team-content-delete]");
  const moderationBox = document.querySelector("[data-team-content-moderation]");
  const resultFields = [...document.querySelectorAll("[data-content-result-field]")];
  const mediaFields = [...document.querySelectorAll("[data-content-media-field]")];

  const summaryElements = {
    total: document.querySelector("[data-content-total]"),
    published: document.querySelector("[data-content-published]"),
    draft: document.querySelector("[data-content-draft]"),
    featured: document.querySelector("[data-content-featured]"),
    archived: document.querySelector("[data-content-archived]")
  };

  const required = [
    loadingBox,
    root,
    adminNotice,
    teamName,
    accountText,
    profileLink,
    returnLink,
    signOutButton,
    messageBox,
    addButton,
    list,
    emptyState,
    searchInput,
    typeFilter,
    statusFilter,
    clearFiltersButton,
    dialog,
    dialogTitle,
    closeDialogButton,
    form,
    deleteButton,
    moderationBox,
    ...Object.values(summaryElements)
  ];

  if (required.some((element) => !element)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const adminMode = params.get("admin") === "1";

  let currentData = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function safeUrl(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    try {
      const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
        ? cleaned
        : `https://${cleaned}`;
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
    messageBox.style.background =
      type === "error"
        ? "rgba(220,38,38,.12)"
        : "rgba(0,191,99,.1)";
    messageBox.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });
    dialog.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });
  }

  function parseResponse(response, fallback) {
    return response
      .json()
      .catch(() => ({}))
      .then((data) => {
        if (!response.ok) {
          throw new Error(data.error || fallback);
        }

        return data;
      });
  }

  async function apiFetch(payload) {
    const endpoint = adminMode
      ? "/api/admin/team-content/"
      : "/api/team/content/";
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (!adminMode) {
      const token = await window.PodiumTeamAuth.getAccessToken();

      if (!token) {
        window.location.replace("/team-login/");
        throw new Error("Team account sign in required.");
      }

      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        team_id: teamId
      })
    });

    if (response.status === 401) {
      window.location.replace(adminMode ? "/admin/" : "/team-login/");
      throw new Error(
        adminMode
          ? "Your Podium Watch admin session has expired."
          : "Your team account session has expired."
      );
    }

    return parseResponse(
      response,
      "The Team Content Hub request could not be completed."
    );
  }

  function typeLabel(value) {
    const labels = {
      announcement: "Announcement",
      achievement: "Achievement",
      result: "Team result",
      coverage: "Podium Watch coverage",
      media: "Media"
    };

    return labels[value] || value || "Content";
  }

  function statusLabel(value) {
    const labels = {
      draft: "Private draft",
      published: "Published",
      archived: "Archived"
    };

    return labels[value] || value || "Draft";
  }

  function programLabel(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value || "Boys and Girls";
  }

  function formatDate(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    const date = new Date(`${cleaned}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return cleaned;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function renderSummary(summary) {
    Object.entries(summaryElements).forEach(([key, element]) => {
      element.textContent = String(Number(summary?.[key]) || 0);
    });
  }

  function itemSearchText(item) {
    return [
      item.title,
      item.summary,
      item.body_text,
      item.meet_name,
      item.season_label,
      item.source_name,
      item.sport_scope,
      item.program_scope
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function filteredItems() {
    const search = cleanText(searchInput.value).toLowerCase();
    const type = cleanText(typeFilter.value);
    const status = cleanText(statusFilter.value);

    return (currentData?.items || []).filter((item) => {
      if (search && !itemSearchText(item).includes(search)) {
        return false;
      }

      if (type && item.content_type !== type) {
        return false;
      }

      if (status === "featured" && !item.featured) {
        return false;
      }

      if (status === "suspended" && !item.suspended) {
        return false;
      }

      if (status === "locked" && !item.admin_locked) {
        return false;
      }

      if (
        status &&
        !["featured", "suspended", "locked"].includes(status) &&
        item.status !== status
      ) {
        return false;
      }

      return true;
    });
  }

  function renderBadges(item) {
    const badges = [
      `<span class="team-content-badge">${escapeHtml(typeLabel(item.content_type))}</span>`,
      `<span class="team-content-badge">${escapeHtml(statusLabel(item.status))}</span>`,
      `<span class="team-content-badge">${escapeHtml(item.sport_scope || "All sports")}</span>`,
      `<span class="team-content-badge">${escapeHtml(programLabel(item.program_scope))}</span>`
    ];

    if (item.featured) {
      badges.push('<span class="team-content-badge team-content-badge-dark">Featured</span>');
    }

    if (item.suspended) {
      badges.push('<span class="team-content-badge team-content-badge-danger">Hidden by Podium Watch</span>');
    }

    if (item.admin_locked) {
      badges.push('<span class="team-content-badge team-content-badge-warning">Admin locked</span>');
    }

    return badges.join("");
  }

  function renderActions(item) {
    const buttons = [];

    if (!item.admin_locked || adminMode) {
      buttons.push(
        `<button class="button button-outline" type="button" data-content-action="edit" data-content-id="${escapeHtml(item.id)}">Edit</button>`
      );
      if (item.status === "draft") {
        buttons.push(
          `<button class="button button-primary" type="button" data-content-action="status" data-content-status="published" data-content-id="${escapeHtml(item.id)}">Publish</button>`
        );
      }

      if (item.status === "published") {
        buttons.push(
          `<button class="button button-outline" type="button" data-content-action="status" data-content-status="draft" data-content-id="${escapeHtml(item.id)}">Make private</button>`,
          `<button class="button button-outline" type="button" data-content-action="feature" data-content-featured="${item.featured ? "false" : "true"}" data-content-id="${escapeHtml(item.id)}">${item.featured ? "Remove feature" : "Feature"}</button>`,
          `<button class="button button-outline" type="button" data-content-action="status" data-content-status="archived" data-content-id="${escapeHtml(item.id)}">Archive</button>`
        );
      }

      if (item.status === "archived") {
        buttons.push(
          `<button class="button button-outline" type="button" data-content-action="status" data-content-status="draft" data-content-id="${escapeHtml(item.id)}">Restore as draft</button>`
        );
      }
    }

    return buttons.join("");
  }

  function renderItems() {
    const items = filteredItems();
    emptyState.hidden = items.length > 0;
    list.hidden = items.length === 0;

    list.innerHTML = items
      .map((item) => {
        const date = formatDate(item.event_date);
        const details = [
          date,
          item.season_label,
          item.meet_name,
          item.result_place,
          item.result_score
        ]
          .filter(Boolean)
          .join(" • ");
        const description = item.summary || item.body_text || "No description added.";

        return (
          '<article class="team-content-card">' +
            '<div>' +
              `<div class="team-content-badges">${renderBadges(item)}</div>` +
              `<h3 style="margin-top:14px;">${escapeHtml(item.title)}</h3>` +
              (details ? `<p><strong>${escapeHtml(details)}</strong></p>` : "") +
              `<p>${escapeHtml(description.length > 420 ? `${description.slice(0, 417)}...` : description)}</p>` +
              (item.moderation_note && adminMode
                ? `<p style="color:#92400e;"><strong>Moderation note:</strong> ${escapeHtml(item.moderation_note)}</p>`
                : "") +
            '</div>' +
            `<div class="team-content-card-actions">${renderActions(item)}</div>` +
          '</article>'
        );
      })
      .join("");
  }

  function renderData(data) {
    currentData = data;
    teamName.textContent = data.team?.school_name || "Team Content Hub";
    accountText.textContent = adminMode
      ? "Managing this team's content with Podium Watch admin access."
      : "Create and publish official team updates from this page.";
    adminNotice.hidden = !adminMode;
    signOutButton.hidden = adminMode;
    returnLink.href = adminMode ? "/admin/team-content/" : "/team-dashboard/";
    returnLink.textContent = adminMode ? "Return to Content Manager" : "Return to dashboard";
    profileLink.href = `/team/?slug=${encodeURIComponent(data.team?.slug || "")}&preview=1${adminMode ? "&admin=1" : ""}`;
    renderSummary(data.summary || {});
    renderItems();
    loadingBox.hidden = true;
    root.hidden = false;
  }

  function setField(name, value) {
    const element = form.elements[name];

    if (!element) {
      return;
    }

    if (element.type === "checkbox") {
      element.checked = Boolean(value);
    } else {
      element.value = value ?? "";
    }
  }

  function updateTypeFields() {
    const type = cleanText(form.elements.content_type?.value);
    resultFields.forEach((field) => {
      field.hidden = type !== "result";
    });
    mediaFields.forEach((field) => {
      field.hidden = type !== "media";
    });
  }

  function openEditor(item = null) {
    form.reset();
    setField("item_id", item?.id || "");
    setField("content_type", item?.content_type || "announcement");
    setField("status", item?.status || "draft");
    setField("event_date", item?.event_date || "");
    setField("season_label", item?.season_label || "");
    setField("title", item?.title || "");
    setField("summary", item?.summary || "");
    setField("body_text", item?.body_text || "");
    setField("sport_scope", item?.sport_scope || "All");
    setField("program_scope", item?.program_scope || "combined");
    setField("meet_name", item?.meet_name || "");
    setField("result_place", item?.result_place || "");
    setField("result_score", item?.result_score || "");
    setField("url", item?.url || "");
    setField("cta_label", item?.cta_label || "");
    setField("image_url", item?.image_url || "");
    setField("video_url", item?.video_url || "");
    setField("media_kind", item?.media_kind || "photo");
    setField("source_name", item?.source_name || "");
    setField("photographer_name", item?.photographer_name || "");
    setField("photographer_url", item?.photographer_url || "");
    setField("featured", item?.featured || false);
    setField("notify_followers", item?.notify_followers ?? true);
    setField("featured_rank", item?.featured_rank || 0);
    setField("sort_order", item?.sort_order || 0);
    setField("suspended", item?.suspended || false);
    setField("admin_locked", item?.admin_locked || false);
    setField("moderation_note", item?.moderation_note || "");

    dialogTitle.textContent = item ? `Edit ${typeLabel(item.content_type)}` : "Add team content";
    moderationBox.hidden = !adminMode;
    deleteButton.hidden = !item || (!adminMode && item.status === "published");
    updateTypeFields();
    dialog.showModal();
  }

  function closeEditor() {
    if (dialog.open) {
      dialog.close();
    }
  }

  function payloadFromForm() {
    const data = new FormData(form);
    const payload = {};

    for (const [key, value] of data.entries()) {
      payload[key] = typeof value === "string" ? value.trim() : value;
    }

    payload.featured = Boolean(form.elements.featured?.checked);
    payload.notify_followers = Boolean(form.elements.notify_followers?.checked);

    if (adminMode) {
      payload.suspended = Boolean(form.elements.suspended?.checked);
      payload.admin_locked = Boolean(form.elements.admin_locked?.checked);
    }

    return payload;
  }

  async function load() {
    if (!teamId) {
      loadingBox.innerHTML = `
        <h2>Choose a team</h2>
        <p>Open the Content Hub from your Team Dashboard or the Podium Watch admin area.</p>
        <p><a class="button button-primary" href="${adminMode ? "/admin/team-content/" : "/team-dashboard/"}">Return</a></p>
      `;
      return;
    }

    try {
      const data = await apiFetch({ action: "get" });
      renderData(data);
    } catch (error) {
      loadingBox.innerHTML = `
        <h2>Content Hub unavailable</h2>
        <p>${escapeHtml(error.message || "The Team Content Hub could not be loaded.")}</p>
        <p><a class="button button-primary" href="${adminMode ? "/admin/team-content/" : "/team-dashboard/"}">Return</a></p>
      `;
    }
  }

  addButton.addEventListener("click", () => {
    if (!busy) {
      openEditor();
    }
  });

  closeDialogButton.addEventListener("click", closeEditor);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeEditor();
    }
  });

  form.elements.content_type?.addEventListener("change", updateTypeFields);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    try {
      setBusy(true);
      showMessage("Saving team content.");
      const payload = payloadFromForm();
      const data = await apiFetch({
        action: "save_item",
        ...payload
      });
      renderData(data);
      closeEditor();
      showMessage("Team content saved.");
    } catch (error) {
      showMessage(error.message || "The content could not be saved.", "error");
    } finally {
      setBusy(false);
    }
  });

  deleteButton.addEventListener("click", async () => {
    const itemId = cleanText(form.elements.item_id?.value);

    if (!itemId || busy) {
      return;
    }

    if (!window.confirm("Permanently delete this content item? This cannot be undone.")) {
      return;
    }

    try {
      setBusy(true);
      const data = await apiFetch({
        action: "delete_item",
        item_id: itemId
      });
      renderData(data);
      closeEditor();
      showMessage("Content item deleted.");
    } catch (error) {
      showMessage(error.message || "The content could not be deleted.", "error");
    } finally {
      setBusy(false);
    }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-content-action]");

    if (!button || busy) {
      return;
    }

    const itemId = cleanText(button.dataset.contentId);
    const item = (currentData?.items || []).find((entry) => entry.id === itemId);

    if (!item) {
      return;
    }

    const action = cleanText(button.dataset.contentAction);

    if (action === "edit") {
      openEditor(item);
      return;
    }

    try {
      setBusy(true);
      let data;

      if (action === "status") {
        const status = cleanText(button.dataset.contentStatus);
        data = await apiFetch({
          action: "change_status",
          item_id: itemId,
          status
        });
        showMessage(`Content changed to ${statusLabel(status).toLowerCase()}.`);
      }

      if (action === "feature") {
        const featured = button.dataset.contentFeatured === "true";
        data = await apiFetch({
          action: "toggle_featured",
          item_id: itemId,
          featured,
          featured_rank: item.featured_rank || 0
        });
        showMessage(featured ? "Content featured." : "Content removed from featured items.");
      }

      if (data) {
        renderData(data);
      }
    } catch (error) {
      showMessage(error.message || "The content could not be updated.", "error");
    } finally {
      setBusy(false);
    }
  });

  [searchInput, typeFilter, statusFilter].forEach((element) => {
    element.addEventListener(element.tagName === "INPUT" ? "input" : "change", renderItems);
  });

  clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    statusFilter.value = "";
    renderItems();
  });

  signOutButton.addEventListener("click", async () => {
    if (adminMode) {
      return;
    }

    try {
      const client = await window.PodiumTeamAuth.getClient();
      await client.auth.signOut();
    } finally {
      window.location.replace("/team-login/");
    }
  });

  load();
})();
