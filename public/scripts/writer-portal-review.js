(() => {
  const loadingBox = document.querySelector("[data-writer-review-loading]");
  const denied = document.querySelector("[data-writer-review-denied]");
  const listRoot = document.querySelector("[data-writer-review-list-root]");
  const detailRoot = document.querySelector("[data-writer-review-detail-root]");
  const statusFilter = document.querySelector("[data-writer-review-status-filter]");
  const categoryFilter = document.querySelector("[data-writer-review-category-filter]");
  const rows = document.querySelector("[data-writer-review-rows]");

  if (!loadingBox || !denied || !listRoot || !detailRoot || !rows) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  async function api(action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/review/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  async function meApi(action) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/me/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  function rowMarkup(article) {
    return `<tr data-review-row="${escapeHtml(article.id)}">
      <td>${escapeHtml(article.title || "(untitled)")}</td>
      <td>${escapeHtml(article.author_name || "")}</td>
      <td>${escapeHtml(article.category ? titleCase(article.category) : "—")}</td>
      <td><span class="writer-review-status-pill">${escapeHtml(titleCase(article.status))}</span></td>
      <td>${escapeHtml(formatDate(article.updated_at))}</td>
    </tr>`;
  }

  async function loadList() {
    const { articles } = await api("list", {
      status: statusFilter.value,
      category: categoryFilter.value
    });
    rows.innerHTML = articles.length
      ? articles.map(rowMarkup).join("")
      : `<tr><td colspan="5">Nothing here.</td></tr>`;
  }

  rows.addEventListener("click", (event) => {
    const row = event.target.closest("[data-review-row]");
    if (!row) return;
    window.location.href = "/writer-portal/admin/review/?id=" + encodeURIComponent(row.dataset.reviewRow);
  });

  if (statusFilter) statusFilter.addEventListener("change", loadList);
  if (categoryFilter) categoryFilter.addEventListener("change", loadList);

  // --- detail view -----------------------------------------------------

  const detailCategory = document.querySelector("[data-writer-review-detail-category]");
  const detailTitle = document.querySelector("[data-writer-review-detail-title]");
  const detailMeta = document.querySelector("[data-writer-review-detail-meta]");
  const detailStatus = document.querySelector("[data-writer-review-detail-status]");
  const detailBody = document.querySelector("[data-writer-review-detail-body]");
  const message = document.querySelector("[data-writer-review-message]");
  const actions = document.querySelector("[data-writer-review-actions]");
  const notesList = document.querySelector("[data-writer-review-notes-list]");
  const noteForm = document.querySelector("[data-writer-review-note-form]");

  function showMessage(text, tone = "success") {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function actionMarkup(status) {
    if (status === "submitted") {
      return `<button class="button button-primary" type="button" data-review-action="approve">Approve</button>` +
        `<button class="button button-outline" type="button" data-review-action="request_revision">Request revision (uses the note below)</button>`;
    }
    if (status === "approved") {
      return `<button class="button button-primary" type="button" data-review-action="publish">Publish</button>`;
    }
    if (status === "published") {
      return `<button class="button button-outline" type="button" data-review-action="archive">Archive</button>`;
    }
    return "";
  }

  async function loadDetail(articleId) {
    const { article } = await api("get", { article_id: articleId });

    detailCategory.textContent = article.category ? titleCase(article.category) : "Uncategorized";
    detailTitle.textContent = article.title || "(untitled)";
    detailMeta.textContent = `By ${article.author?.full_name || "unknown"}` +
      (article.author?.school ? ` • ${article.author.school}` : "") +
      (article.submitted_at ? ` • Submitted ${formatDate(article.submitted_at)}` : "");
    detailStatus.textContent = titleCase(article.status);
    detailBody.innerHTML = window.PodiumWriterRender.renderBody(article.body);
    actions.innerHTML = actionMarkup(article.status);

    notesList.innerHTML = article.notes.length
      ? article.notes.map((note) =>
          `<div class="writer-review-note"><div class="writer-review-note-meta">${escapeHtml(note.editor_name || "Staff")} • ${escapeHtml(formatDate(note.created_at))}</div>${escapeHtml(note.note)}</div>`
        ).join("")
      : `<p style="color:var(--muted);">No notes yet.</p>`;

    showMessage("");
    return article;
  }

  if (actions) {
    actions.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-review-action]");
      if (!button) return;
      const action = button.dataset.reviewAction;
      const params = new URLSearchParams(window.location.search);
      const articleId = params.get("id");

      if (action === "request_revision" && !noteForm.elements.note.value.trim()) {
        showMessage("Add a note explaining what needs to change before requesting a revision.", "error");
        return;
      }
      if (action === "archive" && !window.confirm("Archive this article? It will be pulled from the public site.")) return;

      button.disabled = true;
      try {
        await api(action, { article_id: articleId, note: noteForm.elements.note.value });
        noteForm.reset();
        await loadDetail(articleId);
        showMessage(titleCase(action.replace("_", " ")) + " complete.");
      } catch (error) {
        showMessage(error.message || "This could not be completed.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (noteForm) {
    noteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const params = new URLSearchParams(window.location.search);
      const articleId = params.get("id");
      const note = noteForm.elements.note.value.trim();
      if (!note) return;

      const button = noteForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await api("add_note", { article_id: articleId, note });
        noteForm.reset();
        await loadDetail(articleId);
        showMessage("Note added.");
      } catch (error) {
        showMessage(error.message || "This note could not be added.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }

      const { profile } = await meApi("get_profile");
      if (!["editor", "admin"].includes(profile.role)) {
        loadingBox.hidden = true;
        denied.hidden = false;
        return;
      }

      const articleId = new URLSearchParams(window.location.search).get("id");

      if (articleId) {
        await loadDetail(articleId);
        loadingBox.hidden = true;
        detailRoot.hidden = false;
      } else {
        await loadList();
        loadingBox.hidden = true;
        listRoot.hidden = false;
      }
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>The review queue could not be loaded</h2><p>" +
        escapeHtml(error.message || "Something went wrong.") + "</p></div>";
    }
  }

  load();
})();
