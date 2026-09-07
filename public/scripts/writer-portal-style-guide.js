// esm.sh, not jsdelivr -- see the matching comment in
// writer-portal-write.js. jsdelivr's own +esm bundle of
// @tiptap/starter-kit@3.31.3 reproducibly throws 'Adding different
// instances of a keyed plugin (plugin$)' the instant an Editor is
// constructed, confirmed live even with StarterKit completely alone.
import { Editor } from "https://esm.sh/@tiptap/core@3.31.3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3.31.3";

(async () => {
  const loadingBox = document.querySelector("[data-writer-guide-loading]");
  const root = document.querySelector("[data-writer-guide-root]");
  const contentBox = document.querySelector("[data-writer-guide-content]");
  const editButton = document.querySelector("[data-writer-guide-edit]");
  const editorSection = document.querySelector("[data-writer-guide-editor]");
  const tiptapBox = document.querySelector("[data-writer-guide-tiptap]");
  const toolbar = document.querySelector("[data-writer-toolbar]");
  const saveButton = document.querySelector("[data-writer-guide-save]");
  const cancelButton = document.querySelector("[data-writer-guide-cancel]");
  const message = document.querySelector("[data-writer-guide-message]");

  if (!loadingBox || !root || !contentBox) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text, tone = "success") {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  async function api(path, action, extra = {}) {
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

  const guideApi = (action, extra) => api("/api/portal/style-guide/", action, extra);
  const meApi = (action) => api("/api/portal/me/", action);

  let editorInstance = null;
  let currentBody = {};

  function updateToolbarState() {
    if (!editorInstance || !toolbar) return;
    toolbar.querySelectorAll("[data-command]").forEach((button) => {
      const command = button.dataset.command;
      const activeMap = {
        bold: () => editorInstance.isActive("bold"),
        italic: () => editorInstance.isActive("italic"),
        "heading-2": () => editorInstance.isActive("heading", { level: 2 }),
        "heading-3": () => editorInstance.isActive("heading", { level: 3 }),
        bulletList: () => editorInstance.isActive("bulletList"),
        orderedList: () => editorInstance.isActive("orderedList"),
        blockquote: () => editorInstance.isActive("blockquote")
      };
      button.dataset.active = String(Boolean(activeMap[command]?.()));
    });
  }

  if (toolbar) {
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
    });
  }

  function renderView() {
    contentBox.innerHTML = window.PodiumWriterRender.renderBody(currentBody);
  }

  function enterEditMode() {
    contentBox.hidden = true;
    editButton.hidden = true;
    editorSection.hidden = false;
    showMessage("");

    if (!editorInstance) {
      editorInstance = new Editor({
        element: tiptapBox,
        extensions: [StarterKit],
        content: currentBody && Object.keys(currentBody).length ? currentBody : "",
        onUpdate: updateToolbarState,
        onSelectionUpdate: updateToolbarState,
        onTransaction: updateToolbarState
      });
      updateToolbarState();
    }
  }

  function exitEditMode() {
    contentBox.hidden = false;
    editButton.hidden = false;
    editorSection.hidden = true;
  }

  if (editButton) editButton.addEventListener("click", enterEditMode);
  if (cancelButton) cancelButton.addEventListener("click", exitEditMode);

  if (saveButton) {
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      showMessage("Saving...");
      try {
        const { style_guide: updated } = await guideApi("update", { body: editorInstance.getJSON() });
        currentBody = updated.body;
        renderView();
        exitEditMode();
        showMessage("Style guide saved.", "success");
      } catch (error) {
        showMessage(error.message || "This could not be saved.", "error");
      } finally {
        saveButton.disabled = false;
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

      const [{ style_guide: guide }, { profile }] = await Promise.all([
        guideApi("get"),
        meApi("get_profile")
      ]);

      currentBody = guide.body || {};
      renderView();

      if (editButton && ["editor", "admin"].includes(profile.role)) {
        editButton.hidden = false;
      }

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>The style guide could not be loaded</h2><p>" +
        escapeHtml(error.message || "Something went wrong.") + "</p></div>";
    }
  }

  load();
})();
