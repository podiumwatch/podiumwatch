(() => {
  const loadingBox = document.querySelector("[data-writer-cal-loading]");
  const root = document.querySelector("[data-writer-cal-root]");
  const addButton = document.querySelector("[data-writer-cal-add]");
  const prevButton = document.querySelector("[data-writer-cal-prev]");
  const nextButton = document.querySelector("[data-writer-cal-next]");
  const monthLabel = document.querySelector("[data-writer-cal-month-label]");
  const grid = document.querySelector("[data-writer-cal-grid]");
  const unscheduledSection = document.querySelector("[data-writer-cal-unscheduled-section]");
  const unscheduledBox = document.querySelector("[data-writer-cal-unscheduled]");

  const formPanel = document.querySelector("[data-writer-cal-form-panel]");
  const formTitle = document.querySelector("[data-writer-cal-form-title]");
  const form = document.querySelector("[data-writer-cal-form]");
  const formMessage = document.querySelector("[data-writer-cal-form-message]");
  const assigneeSelect = document.querySelector("[data-writer-cal-assignee-select]");
  const deleteButton = document.querySelector("[data-writer-cal-delete]");
  const cancelButton = document.querySelector("[data-writer-cal-cancel]");

  const detailPanel = document.querySelector("[data-writer-cal-detail-panel]");
  const detailCategory = document.querySelector("[data-writer-cal-detail-category]");
  const detailTitle = document.querySelector("[data-writer-cal-detail-title]");
  const detailDescription = document.querySelector("[data-writer-cal-detail-description]");
  const detailMeta = document.querySelector("[data-writer-cal-detail-meta]");
  const detailMessage = document.querySelector("[data-writer-cal-detail-message]");
  const detailActions = document.querySelector("[data-writer-cal-detail-actions]");
  const detailClose = document.querySelector("[data-writer-cal-detail-close]");

  if (!loadingBox || !root || !grid) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async function callApi(path, action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  const calApi = (action, extra) => callApi("/api/portal/calendar/", action, extra);
  const meApi = (action, extra) => callApi("/api/portal/me/", action, extra);
  const writersApi = (action, extra) => callApi("/api/portal/writers/", action, extra);

  let viewerId = null;
  let isStaff = false;
  let current = new Date();
  current.setDate(1);
  let ideasById = new Map();

  function monthBounds(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const toIso = (d) => d.toISOString().slice(0, 10);
    return { start: toIso(start), end: toIso(end) };
  }

  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function chipMarkup(idea) {
    const mine = idea.assigned_to === viewerId;
    return `<button type="button" class="writer-cal-idea-chip" data-idea-chip="${escapeHtml(idea.id)}" data-mine="${mine}" title="${escapeHtml(idea.title)}">${escapeHtml(idea.title)}</button>`;
  }

  async function loadAndRender() {
    const { start, end } = monthBounds(current);
    const { ideas } = await calApi("list", { from: start, to: end });
    ideasById = new Map(ideas.map((idea) => [idea.id, idea]));

    // Unscheduled ideas (no target_date) don't fall in any from/to range
    // -- fetched separately so they're never silently invisible.
    const { ideas: unscheduled } = await calApi("list", {});
    for (const idea of unscheduled) {
      if (!idea.target_date) ideasById.set(idea.id, idea);
    }

    const byDate = new Map();
    const unscheduledList = [];
    for (const idea of ideasById.values()) {
      if (idea.target_date) {
        const list = byDate.get(idea.target_date) || [];
        list.push(idea);
        byDate.set(idea.target_date, list);
      } else {
        unscheduledList.push(idea);
      }
    }

    monthLabel.textContent = current.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const firstWeekday = current.getDay();
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const cells = [];
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (const label of weekdayLabels) cells.push(`<div class="writer-cal-weekday">${label}</div>`);

    for (let i = 0; i < firstWeekday; i += 1) cells.push(`<div class="writer-cal-day" data-outside="true"></div>`);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(current.getFullYear(), current.getMonth(), day);
      const key = dayKey(date);
      const dayIdeas = byDate.get(key) || [];
      cells.push(`<div class="writer-cal-day"><div class="writer-cal-day-number">${day}</div>${dayIdeas.map(chipMarkup).join("")}</div>`);
    }

    while (cells.length % 7 !== 0) cells.push(`<div class="writer-cal-day" data-outside="true"></div>`);

    grid.innerHTML = cells.join("");

    unscheduledSection.hidden = unscheduledList.length === 0;
    unscheduledBox.innerHTML = unscheduledList.map(chipMarkup).join("");
  }

  grid.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-idea-chip]");
    if (chip) openDetail(chip.dataset.ideaChip);
  });
  unscheduledBox.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-idea-chip]");
    if (chip) openDetail(chip.dataset.ideaChip);
  });

  prevButton.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    loadAndRender();
  });
  nextButton.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    loadAndRender();
  });

  // --- add/edit form (staff only) ---------------------------------------

  function showFormMessage(text, tone = "error") {
    formMessage.textContent = text;
    formMessage.dataset.tone = tone;
    formMessage.hidden = !text;
  }

  function openForm(idea) {
    form.reset();
    showFormMessage("");
    form.elements.idea_id.value = idea?.id || "";
    formTitle.textContent = idea ? "Edit story idea" : "Add story idea";
    deleteButton.hidden = !idea;
    if (idea) {
      form.elements.title.value = idea.title || "";
      form.elements.description.value = idea.description || "";
      form.elements.category.value = idea.category || "";
      form.elements.target_date.value = idea.target_date || "";
      form.elements.assigned_to.value = idea.assigned_to || "";
    }
    formPanel.hidden = false;
  }

  if (addButton) addButton.addEventListener("click", () => openForm(null));
  cancelButton.addEventListener("click", () => { formPanel.hidden = true; });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showFormMessage("");

    try {
      const ideaId = form.elements.idea_id.value;
      const payload = {
        title: form.elements.title.value,
        description: form.elements.description.value,
        category: form.elements.category.value,
        target_date: form.elements.target_date.value,
        assigned_to: form.elements.assigned_to.value
      };
      if (ideaId) await calApi("update", { idea_id: ideaId, ...payload });
      else await calApi("create", payload);

      formPanel.hidden = true;
      await loadAndRender();
    } catch (error) {
      showFormMessage(error.message || "This could not be saved.");
    } finally {
      button.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    const ideaId = form.elements.idea_id.value;
    if (!ideaId || !window.confirm("Delete this story idea?")) return;

    deleteButton.disabled = true;
    try {
      await calApi("delete", { idea_id: ideaId });
      formPanel.hidden = true;
      await loadAndRender();
    } catch (error) {
      showFormMessage(error.message || "This could not be deleted.");
    } finally {
      deleteButton.disabled = false;
    }
  });

  // --- detail panel ------------------------------------------------------

  function showDetailMessage(text, tone = "error") {
    detailMessage.textContent = text;
    detailMessage.dataset.tone = tone;
    detailMessage.hidden = !text;
  }

  function detailActionsMarkup(idea) {
    const buttons = [];
    if (isStaff) buttons.push(`<button class="button button-outline" type="button" data-detail-action="edit">Edit</button>`);
    if (idea.article_id) {
      buttons.push(`<a class="button button-primary" href="/writer-portal/write/?id=${encodeURIComponent(idea.article_id)}">Open draft</a>`);
    } else if (!idea.assigned_to) {
      buttons.push(`<button class="button button-primary" type="button" data-detail-action="claim">Claim this idea</button>`);
    } else if (idea.assigned_to === viewerId) {
      buttons.push(`<button class="button button-primary" type="button" data-detail-action="start">Start writing</button>`);
    }
    return buttons.join("");
  }

  function openDetail(ideaId) {
    const idea = ideasById.get(ideaId);
    if (!idea) return;

    detailCategory.textContent = idea.category ? titleCase(idea.category) : "Story idea";
    detailTitle.textContent = idea.title;
    detailDescription.textContent = idea.description || "";
    detailMeta.textContent = (idea.target_date ? "Target: " + idea.target_date : "No target date") +
      " • " + (idea.assigned_to_name ? "Assigned to " + idea.assigned_to_name : "Open") +
      " • Added by " + (idea.created_by_name || "staff");
    detailActions.innerHTML = detailActionsMarkup(idea);
    showDetailMessage("");
    detailPanel.hidden = false;
    detailPanel.dataset.ideaId = ideaId;
  }

  detailClose.addEventListener("click", () => { detailPanel.hidden = true; });

  detailActions.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-detail-action]");
    if (!button) return;
    const ideaId = detailPanel.dataset.ideaId;
    const action = button.dataset.detailAction;

    if (action === "edit") {
      detailPanel.hidden = true;
      openForm(ideasById.get(ideaId));
      return;
    }

    button.disabled = true;
    try {
      if (action === "claim") {
        await calApi("claim", { idea_id: ideaId });
        await loadAndRender();
        openDetail(ideaId);
      } else if (action === "start") {
        const { article } = await calApi("start_article", { idea_id: ideaId });
        window.location.href = "/writer-portal/write/?id=" + encodeURIComponent(article.id);
      }
    } catch (error) {
      showDetailMessage(error.message || "This could not be completed.");
      button.disabled = false;
    }
  });

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }
      viewerId = user.id;

      const { profile } = await meApi("get_profile");
      isStaff = ["editor", "admin"].includes(profile.role);

      if (isStaff) {
        addButton.hidden = false;
        const { writers } = await writersApi("list");
        assigneeSelect.innerHTML = '<option value="">Open (unassigned)</option>' +
          writers.map((writer) => `<option value="${escapeHtml(writer.id)}">${escapeHtml(writer.full_name || writer.id)}</option>`).join("");
      }

      await loadAndRender();

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>The calendar could not be loaded</h2><p>" +
        escapeHtml(error.message || "Something went wrong.") + "</p></div>";
    }
  }

  load();
})();
