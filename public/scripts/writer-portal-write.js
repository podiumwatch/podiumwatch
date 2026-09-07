import { Editor } from "https://cdn.jsdelivr.net/npm/@tiptap/core@3.31.3/+esm";
import StarterKit from "https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@3.31.3/+esm";
import Image from "https://cdn.jsdelivr.net/npm/@tiptap/extension-image@3.31.3/+esm";
import Link from "https://cdn.jsdelivr.net/npm/@tiptap/extension-link@3.31.3/+esm";
import Placeholder from "https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@3.31.3/+esm";

(async () => {
  const loadingBox = document.querySelector("[data-writer-write-loading]");
  const root = document.querySelector("[data-writer-write-root]");
  const statusEl = document.querySelector("[data-writer-write-status]");
  const editorBox = document.querySelector("[data-writer-editor]");
  const toolbar = document.querySelector("[data-writer-toolbar]");
  const submitButton = document.querySelector("[data-writer-submit]");
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
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  let articleId = new URLSearchParams(window.location.search).get("id") || "";
  let editable = true;
  let saveTimer = null;

  function tagsToText(tags) {
    return (Array.isArray(tags) ? tags : []).join(", ");
  }

  function textToTags(text) {
    return String(text || "").split(",").map((tag) => tag.trim()).filter(Boolean);
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

  function scheduleAutosave() {
    if (!editable) return;
    showStatus("Editing...");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1500);
  }

  let editorInstance = null;

  async function save() {
    if (!editable) return;
    showStatus("Saving...");

    try {
      await api("update_article", {
        article_id: articleId,
        title: fields.title.value,
        dek: fields.dek.value,
        category: fields.category.value,
        tags: textToTags(fields.tags.value),
        featured_image_url: fields.featured_image_url.value,
        photo_credit: fields.photo_credit.value,
        body: editorInstance.getJSON()
      });
      showStatus("Saved.");
    } catch (error) {
      showStatus(error.message || "This could not be saved.", "error");
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
      const url = window.prompt("Image URL");
      if (url) chain.setImage({ src: url }).run();
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
      await save();
      await api("submit_article", { article_id: articleId });
      window.location.replace("/writer-portal/");
    } catch (error) {
      showStatus(error.message || "This could not be submitted.", "error");
      submitButton.disabled = false;
    }
  });

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

      editorInstance = new Editor({
        element: editorBox,
        extensions: [
          StarterKit,
          Image,
          Link.configure({ openOnClick: false }),
          Placeholder.configure({ placeholder: "Start writing..." })
        ],
        content: article.body && Object.keys(article.body).length ? article.body : "",
        editable: ["draft", "needs_revision"].includes(article.status),
        onUpdate: () => {
          updateToolbarState(editorInstance);
          scheduleAutosave();
        },
        onSelectionUpdate: () => updateToolbarState(editorInstance),
        onTransaction: () => updateToolbarState(editorInstance)
      });

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
