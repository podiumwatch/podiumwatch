(() => {
  const loadingBox = document.querySelector("[data-writer-review-loading]");
  const denied = document.querySelector("[data-writer-review-denied]");
  const listRoot = document.querySelector("[data-writer-review-list-root]");
  const detailRoot = document.querySelector("[data-writer-review-detail-root]");
  const statusFilter = document.querySelector("[data-writer-review-status-filter]");
  const categoryFilter = document.querySelector("[data-writer-review-category-filter]");
  const rows = document.querySelector("[data-writer-review-rows]");
  const statsBox = document.querySelector("[data-writer-review-stats]");
  const oldestBox = document.querySelector("[data-writer-review-oldest]");

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

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  async function loadStats() {
    if (!statsBox) return;
    const stats = await api("get_stats");

    const cards = [
      ["Submitted", stats.by_status.submitted],
      ["Needs revision", stats.by_status.needs_revision],
      ["Approved", stats.by_status.approved],
      ["Published", stats.by_status.published],
      ["Total writers", stats.total_writers],
      ["Total views", stats.total_views]
    ];
    statsBox.innerHTML = cards.map(([label, value]) =>
      `<div class="writer-review-stat"><strong>${formatNumber(value)}</strong><span>${escapeHtml(label)}</span></div>`
    ).join("");

    if (stats.oldest_submitted) {
      oldestBox.textContent = `Oldest waiting for review: "${stats.oldest_submitted.title || "(untitled)"}" -- submitted ${formatDate(stats.oldest_submitted.submitted_at)}`;
      oldestBox.hidden = false;
    } else {
      oldestBox.hidden = true;
    }
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
  const commentSelectionButton = document.querySelector("[data-writer-review-comment-selection]");

  function showMessage(text, tone = "success") {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  // Wraps the first not-yet-highlighted occurrence of each inline
  // comment's anchor_text in a real DOM <mark>, walking actual text
  // nodes (not a raw string/innerHTML replace, which could just as
  // easily match text inside an existing tag or attribute and corrupt
  // the markup). A note whose anchor text no longer appears verbatim
  // (the writer edited that passage) is simply not highlighted --
  // still fully visible in the notes list below, just not anchored
  // in the body anymore. That's the deliberate tradeoff of storing a
  // plain-text anchor instead of a mark inside the article's own saved
  // body (see install/50's header comment).
  function highlightAnchors(container, notes) {
    const inlineNotes = notes.filter((note) => note.anchor_text);
    for (const note of inlineNotes) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let target = null;
      let index = -1;
      let node;
      while ((node = walker.nextNode())) {
        index = node.nodeValue.indexOf(note.anchor_text);
        if (index !== -1) { target = node; break; }
      }
      if (!target) continue;

      const range = document.createRange();
      range.setStart(target, index);
      range.setEnd(target, index + note.anchor_text.length);

      const mark = document.createElement("mark");
      mark.dataset.noteId = note.id;
      try {
        range.surroundContents(mark);
      } catch {
        // A selection spanning more than one element (e.g. across a
        // paragraph break) can't be wrapped this simply -- skip it
        // rather than throw the whole render away.
      }
    }
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
    highlightAnchors(detailBody, article.notes);

    notesList.innerHTML = article.notes.length
      ? article.notes.map((note) =>
          `<div class="writer-review-note" data-note-row="${escapeHtml(note.id)}">` +
            `<div class="writer-review-note-meta">${escapeHtml(note.editor_name || "Staff")} • ${escapeHtml(formatDate(note.created_at))}</div>` +
            (note.anchor_text ? `<p style="margin:0 0 6px;font-style:italic;color:var(--muted);">On: "${escapeHtml(note.anchor_text)}"</p>` : "") +
            escapeHtml(note.note) +
          `</div>`
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
      if (action === "publish" && !window.confirm("Publish this article? It goes live on the public site immediately.")) return;

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

  // Clicking a highlighted inline-comment span jumps to and briefly
  // flashes its matching note in the list below, rather than opening a
  // separate tooltip UI -- reuses the notes list that already exists
  // instead of building a second place to show the same text.
  if (detailBody) {
    detailBody.addEventListener("click", (event) => {
      const mark = event.target.closest("mark[data-note-id]");
      if (!mark) return;
      const noteRow = notesList.querySelector(`[data-note-row="${CSS.escape(mark.dataset.noteId)}"]`);
      if (!noteRow) return;
      noteRow.scrollIntoView({ behavior: "smooth", block: "center" });
      noteRow.style.background = "rgba(230,167,0,.35)";
      setTimeout(() => { noteRow.style.background = ""; }, 1500);
    });
  }

  let pendingSelectionText = "";

  if (detailBody && commentSelectionButton) {
    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      const text = selection && selection.rangeCount ? selection.toString().trim() : "";
      const withinBody = text && detailBody.contains(selection.anchorNode);
      pendingSelectionText = withinBody ? text : "";
      commentSelectionButton.disabled = !pendingSelectionText;
    });

    commentSelectionButton.addEventListener("click", async () => {
      const anchorText = pendingSelectionText.slice(0, 500);
      if (!anchorText) return;

      const note = window.prompt(`Comment on: "${anchorText.length > 80 ? anchorText.slice(0, 80) + "..." : anchorText}"`);
      if (!note || !note.trim()) return;

      const articleId = new URLSearchParams(window.location.search).get("id");
      commentSelectionButton.disabled = true;
      try {
        await api("add_note", { article_id: articleId, note: note.trim(), anchor_text: anchorText });
        await loadDetail(articleId);
        showMessage("Inline comment added.");
      } catch (error) {
        showMessage(error.message || "This comment could not be added.", "error");
      } finally {
        commentSelectionButton.disabled = true;
        pendingSelectionText = "";
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
        await loadStats();
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
