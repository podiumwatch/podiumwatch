// Loaded from esm.sh, not this project's usual jsdelivr +esm convention --
// confirmed live (real browser, production) that jsdelivr's own +esm
// bundler for @tiptap/starter-kit@3.31.3 throws 'Adding different
// instances of a keyed plugin (plugin$)' the instant an Editor is
// constructed, reproducibly, even with StarterKit completely alone and
// nothing else on the page. The identical version through esm.sh does
// not have this problem; it's a jsdelivr bundling defect, not a Tiptap
// bug (every dependency URL, including prosemirror-state, still lines
// up when inspected directly). Every other CDN import on this site
// should stay on jsdelivr as usual -- this is a deliberate, narrow
// exception for this one library.
import { Editor } from "https://esm.sh/@tiptap/core@3.31.3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3.31.3";
import Image from "https://esm.sh/@tiptap/extension-image@3.31.3";
import Link from "https://esm.sh/@tiptap/extension-link@3.31.3";
import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@3.31.3";

(async () => {
  const loadingBox = document.querySelector("[data-writer-write-loading]");
  const root = document.querySelector("[data-writer-write-root]");
  const statusEl = document.querySelector("[data-writer-write-status]");
  const editorBox = document.querySelector("[data-writer-editor]");
  const toolbar = document.querySelector("[data-writer-toolbar]");
  const submitButton = document.querySelector("[data-writer-submit]");
  const deleteButton = document.querySelector("[data-writer-delete]");
  const featuredUploadButton = document.querySelector("[data-writer-featured-upload]");
  const imageFileInput = document.querySelector("[data-writer-image-file-input]");
  const notesBox = document.querySelector("[data-writer-write-notes]");
  const wordCountEl = document.querySelector("[data-writer-wordcount]");
  const fields = {
    title: document.querySelector('[data-writer-field="title"]'),
    dek: document.querySelector('[data-writer-field="dek"]'),
    category: document.querySelector('[data-writer-field="category"]'),
    tags: document.querySelector('[data-writer-field="tags"]'),
    featured_image_url: document.querySelector('[data-writer-field="featured_image_url"]'),
    photo_credit: document.querySelector('[data-writer-field="photo_credit"]')
  };

  if (!loadingBox || !root || !statusEl || !editorBox || !toolbar || !submitButton) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showStatus(text, tone = "") {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  async function api(action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/me/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "This request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  let articleId = new URLSearchParams(window.location.search).get("id") || "";
  let editable = true;
  let saveTimer = null;

  // Direct-to-Supabase-Storage, same signed-upload-URL pattern already
  // used for timing-submissions -- the file's bytes never pass through
  // this Vercel Function's own body-size limit. imageFileTarget tracks
  // which control (the toolbar or the featured-image button) triggered
  // the hidden file input, since both share one <input type="file">.
  let imageFileTarget = null;

  async function uploadImage(file) {
    const slot = await api("request_image_upload", { file_name: file.name });

    if (file.size > slot.max_file_bytes) {
      throw new Error(`That image is larger than ${Math.floor(slot.max_file_bytes / (1024 * 1024))} MB.`);
    }

    const client = await window.PodiumWriterAuth.getClient();
    const { error } = await client.storage.from("writer-portal-images").uploadToSignedUrl(slot.storage_key, slot.token, file);
    if (error) throw error;

    return slot.public_url;
  }

  if (imageFileInput) {
    imageFileInput.addEventListener("change", async () => {
      const file = imageFileInput.files?.[0];
      const target = imageFileTarget;
      imageFileInput.value = "";
      if (!file || !target) return;

      // Alt text only makes sense for an image embedded in the body --
      // the featured image already uses the article's own title as its
      // alt text on the public page. Asked before the upload starts, not
      // after, so there's only one interruption, not two.
      let altText = "";
      if (target === "toolbar") {
        altText = window.prompt("Describe this image, for readers who can't see it (leave blank to skip):") || "";
      }

      showStatus("Uploading image...");
      try {
        const publicUrl = await uploadImage(file);
        if (target === "toolbar" && editorInstance) {
          editorInstance.chain().focus().setImage({ src: publicUrl, alt: altText }).run();
          scheduleAutosave();
        } else if (target === "featured") {
          fields.featured_image_url.value = publicUrl;
          scheduleAutosave();
        }
        showStatus("Image uploaded.");
      } catch (error) {
        showStatus(error.message || "This image could not be uploaded.", "error");
      }
    });
  }

  if (featuredUploadButton) {
    featuredUploadButton.addEventListener("click", () => {
      imageFileTarget = "featured";
      imageFileInput.click();
    });
  }

  function tagsToText(tags) {
    return (Array.isArray(tags) ? tags : []).join(", ");
  }

  function textToTags(text) {
    return String(text || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function renderNotes(article) {
    if (!notesBox) return;
    const notes = article.notes || [];
    if (!notes.length) {
      notesBox.hidden = true;
      return;
    }
    notesBox.innerHTML = "<h3>Editor feedback</h3>" + notes.map((note) =>
      `<div class="writer-write-note"><div class="writer-write-note-meta">${escapeHtml(note.editor_name)} &middot; ${escapeHtml(formatDate(note.created_at))}</div>` +
      (note.anchor_text ? `<p style="margin:0 0 6px;font-style:italic;opacity:.8;">On: "${escapeHtml(note.anchor_text)}"</p>` : "") +
      `${escapeHtml(note.note)}</div>`
    ).join("");
    notesBox.hidden = false;
  }

  // Same 220 words/minute, round-up, minimum-1-minute formula
  // src/lib/content.mjs's readingTime() uses for every published story --
  // this is a browser script, so it's a small reimplementation rather
  // than a shared import, but the numbers match what the piece will
  // actually show once published.
  function updateWordCount() {
    if (!wordCountEl || !editorInstance) return;
    const text = editorInstance.getText().trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(wordCount / 220));
    wordCountEl.textContent = `${wordCount.toLocaleString("en-US")} word${wordCount === 1 ? "" : "s"} · ~${minutes} min read`;
  }

  function fillFields(article) {
    fields.title.value = article.title || "";
    fields.dek.value = article.dek || "";
    fields.category.value = article.category || "";
    fields.tags.value = tagsToText(article.tags);
    fields.featured_image_url.value = article.featured_image_url || "";
    fields.photo_credit.value = article.photo_credit || "";
  }

  function setEditable(isEditable, reason) {
    editable = isEditable;
    Object.values(fields).forEach((field) => { field.disabled = !isEditable; });
    submitButton.hidden = !isEditable;
    if (deleteButton) deleteButton.hidden = !isEditable;
    if (!isEditable && reason) showStatus(reason);
  }

  // Tiptap toolbar: headless by design, so every button below is hand-
  // wired to a real editor.chain() command -- there's no built-in UI to
  // reuse.
  function updateToolbarState(editor) {
    toolbar.querySelectorAll("[data-command]").forEach((button) => {
      const command = button.dataset.command;
      const activeMap = {
        bold: () => editor.isActive("bold"),
        italic: () => editor.isActive("italic"),
        "heading-2": () => editor.isActive("heading", { level: 2 }),
        "heading-3": () => editor.isActive("heading", { level: 3 }),
        bulletList: () => editor.isActive("bulletList"),
        orderedList: () => editor.isActive("orderedList"),
        blockquote: () => editor.isActive("blockquote"),
        link: () => editor.isActive("link")
      };
      button.dataset.active = String(Boolean(activeMap[command]?.()));
    });
  }

  // True the instant something changes, false only once a save actually
  // completes -- the beforeunload guard below reads this, not the save
  // timer, so a change that hasn't autosaved yet (still inside its 1.5s
  // debounce window) is never silently lost to an accidental navigation.
  let hasUnsavedChanges = false;

  function scheduleAutosave() {
    if (!editable) return;
    hasUnsavedChanges = true;
    showStatus("Editing...");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1500);
  }

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

  let editorInstance = null;
  // Captured on load, updated after every successful save -- passed back
  // as expected_updated_at so the server can tell a save apart from a
  // save landing on top of a change from another tab/device in between
  // (updateOwnArticle, lib/writer_portal_service.mjs) instead of quietly
  // overwriting it.
  let currentUpdatedAt = null;

  // Returns true/false rather than throwing -- scheduleAutosave's timer
  // fires it with nothing awaiting the result (a rejection there would
  // just be an unhandled promise rejection), while the Submit button
  // below explicitly checks the return value so it never proceeds to
  // submit_article on top of a save that didn't actually happen.
  async function save() {
    if (!editable) return false;
    showStatus("Saving...");

    try {
      const { article: saved } = await api("update_article", {
        article_id: articleId,
        title: fields.title.value,
        dek: fields.dek.value,
        category: fields.category.value,
        tags: textToTags(fields.tags.value),
        featured_image_url: fields.featured_image_url.value,
        photo_credit: fields.photo_credit.value,
        body: editorInstance.getJSON(),
        expected_updated_at: currentUpdatedAt
      });
      currentUpdatedAt = saved.updated_at;
      hasUnsavedChanges = false;
      showStatus("Saved.");
      return true;
    } catch (error) {
      if (error.status === 409 && /changed elsewhere/.test(error.message || "")) {
        // Retrying would just fail again with the same stale timestamp --
        // stop autosaving rather than spam the same conflict every 1.5s,
        // and make the fix (reload) explicit rather than a generic error.
        editable = false;
        showStatus(error.message + " Reload now to avoid losing your latest changes.", "error");
        return false;
      }
      showStatus(error.message || "This could not be saved.", "error");
      return false;
    }
  }

  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (!button || !editorInstance) return;

    const chain = editorInstance.chain().focus();
    const command = button.dataset.command;

    if (command === "bold") chain.toggleBold().run();
    else if (command === "italic") chain.toggleItalic().run();
    else if (command === "heading-2") chain.toggleHeading({ level: 2 }).run();
    else if (command === "heading-3") chain.toggleHeading({ level: 3 }).run();
    else if (command === "bulletList") chain.toggleBulletList().run();
    else if (command === "orderedList") chain.toggleOrderedList().run();
    else if (command === "blockquote") chain.toggleBlockquote().run();
    else if (command === "undo") chain.undo().run();
    else if (command === "redo") chain.redo().run();
    else if (command === "link") {
      const url = window.prompt("Link URL");
      if (url) chain.extendMarkRange("link").setLink({ href: url }).run();
      else chain.unsetLink().run();
    } else if (command === "image") {
      imageFileTarget = "toolbar";
      imageFileInput.click();
    }
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", scheduleAutosave);
    field.addEventListener("change", scheduleAutosave);
  });

  submitButton.addEventListener("click", async () => {
    submitButton.disabled = true;
    clearTimeout(saveTimer);

    try {
      const saved = await save();
      if (!saved) {
        // save() has already shown the real reason (a conflict, or
        // whatever else failed) -- submitting on top of that would
        // either send stale content or fail again anyway.
        submitButton.disabled = false;
        return;
      }
      await api("submit_article", { article_id: articleId });
      window.location.replace("/writer-portal/");
    } catch (error) {
      showStatus(error.message || "This could not be submitted.", "error");
      submitButton.disabled = false;
    }
  });

  if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
      const hasNotes = notesBox && !notesBox.hidden;
      const warning = hasNotes
        ? "Delete this draft? This also deletes the editor feedback attached to it. This can't be undone."
        : "Delete this draft? This can't be undone.";
      if (!window.confirm(warning)) return;

      deleteButton.disabled = true;
      clearTimeout(saveTimer);

      try {
        await api("delete_article", { article_id: articleId });
        hasUnsavedChanges = false;
        window.location.replace("/writer-portal/");
      } catch (error) {
        showStatus(error.message || "This could not be deleted.", "error");
        deleteButton.disabled = false;
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

      let article;
      if (articleId) {
        ({ article } = await api("get_article", { article_id: articleId }));
      } else {
        ({ article } = await api("create_article"));
        articleId = article.id;
        const url = new URL(window.location.href);
        url.searchParams.set("id", articleId);
        window.history.replaceState({}, "", url);
      }

      fillFields(article);
      renderNotes(article);
      currentUpdatedAt = article.updated_at;

      editorInstance = new Editor({
        element: editorBox,
        extensions: [
          // Tiptap v3's StarterKit already bundles a Link extension by
          // default -- adding our own differently-configured Link
          // instance on top of it (needed for openOnClick:false) without
          // disabling StarterKit's copy registers the same keyed
          // ProseMirror plugin twice and throws "Adding different
          // instances of a keyed plugin (plugin$)" the moment the editor
          // is constructed. link:false here is what actually disables it.
          StarterKit.configure({ link: false }),
          Image,
          Link.configure({ openOnClick: false }),
          Placeholder.configure({ placeholder: "Start writing..." })
        ],
        content: article.body && Object.keys(article.body).length ? article.body : "",
        editable: ["draft", "needs_revision"].includes(article.status),
        onUpdate: () => {
          updateToolbarState(editorInstance);
          updateWordCount();
          scheduleAutosave();
        },
        onSelectionUpdate: () => updateToolbarState(editorInstance),
        onTransaction: () => updateToolbarState(editorInstance)
      });
      updateWordCount();

      if (!["draft", "needs_revision"].includes(article.status)) {
        setEditable(false, "This article has already been submitted and can no longer be edited.");
      } else {
        showStatus(article.title ? "Loaded." : "");
      }

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>The editor could not be loaded</h2><p>" +
        escapeHtml(error.message || "Something went wrong.") + "</p></div>";
    }
  }

  load();
})();
