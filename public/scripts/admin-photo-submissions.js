// Admin photo submissions gallery. "Select" is the one action in this
// whole feature that turns a small preview into a permanently-kept
// compressed copy -- everything else browses previews only. See
// lib/photo_submissions_service.mjs and install/69_PHOTO_SUBMISSIONS.sql.
(() => {
  const root = document.querySelector("[data-photo-admin]");
  if (!root) return;

  const messageEl = root.querySelector("[data-photo-admin-message]");
  const listEl = root.querySelector("[data-photo-admin-list]");
  const statusFilter = root.querySelector("[data-photo-filter-status]");
  const itemStatusFilter = root.querySelector("[data-photo-filter-item-status]");
  const meetFilter = root.querySelector("[data-photo-filter-meet]");
  const schoolFilter = root.querySelector("[data-photo-filter-school]");
  const refreshButton = root.querySelector("[data-photo-refresh]");

  const KEPT_MAX_EDGE = 2400;
  const KEPT_QUALITY = 0.82;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function showMessage(text, tone = "success") {
    messageEl.textContent = text;
    messageEl.dataset.tone = tone;
    messageEl.hidden = false;
    if (tone === "success") setTimeout(() => { messageEl.hidden = true; }, 4000);
  }

  async function api(body) {
    const response = await fetch("/api/admin/photo-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The request failed.");
    return payload;
  }

  function resizeFileToBlob(file, maxEdge, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) return reject(new Error("This photo could not be processed."));
          resolve(blob);
        }, "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("This photo could not be read.")); };
      img.src = objectUrl;
    });
  }

  // Re-fetches an already-uploaded image (a pending-original this admin
  // is promoting) and recompresses it client-side to kept quality --
  // avoids needing any server-side image library.
  async function urlToBlob(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("That photo could not be loaded.");
    return response.blob();
  }

  let clientPromise = null;

  async function getClient() {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      const response = await fetch("/api/team/config/", { headers: { Accept: "application/json" } });
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.error || "Could not prepare the upload.");

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("Could not prepare the upload.");
      }

      return window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    })();

    return clientPromise;
  }

  async function uploadKeptBlob(blob, itemIdForKey) {
    const slot = await api({ action: "request_kept_upload", item_id: itemIdForKey || "" });
    const client = await getClient();
    const { error: uploadError } = await client.storage
      .from("photo-submissions")
      .uploadToSignedUrl(slot.storage_key, slot.token, blob);
    if (uploadError) throw new Error(uploadError.message || "The photo could not be uploaded.");
    return slot.storage_key;
  }

  let submissions = [];

  async function load() {
    listEl.innerHTML = '<p class="photo-admin-empty">Loading&hellip;</p>';
    try {
      const data = await api({
        action: "list",
        status: statusFilter.value,
        item_status: itemStatusFilter.value,
        meet_name: meetFilter.value.trim(),
        school_name: schoolFilter.value.trim()
      });
      submissions = data.submissions || [];
      render();
    } catch (error) {
      listEl.innerHTML = "";
      showMessage(error.message || "Could not load submissions.", "error");
    }
  }

  function itemCard(item) {
    const thumb = item.preview_url || item.kept_url || item.pending_original_url || "";
    const canAct = item.item_status === "pending";
    return `<div class="photo-admin-item" data-item-status="${escapeHtml(item.item_status)}" data-item-id="${escapeHtml(item.id)}">
      ${thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.original_filename || "Submitted photo")}" loading="lazy">` : ""}
      <div class="photo-admin-item-actions">
        ${canAct ? `<button type="button" data-photo-select data-item-id="${escapeHtml(item.id)}">Select</button>` : ""}
        ${canAct ? `<button type="button" data-photo-archive data-item-id="${escapeHtml(item.id)}">Skip</button>` : ""}
        ${!canAct ? `<span class="photo-admin-badge">${escapeHtml(item.item_status)}</span>` : ""}
      </div>
    </div>`;
  }

  function render() {
    if (!submissions.length) {
      listEl.innerHTML = '<p class="photo-admin-empty">No submissions match these filters.</p>';
      return;
    }

    listEl.innerHTML = submissions.map((submission) => {
      const items = submission.photo_submission_items || [];
      const isLink = submission.source_type === "link";
      return `<article class="photo-admin-submission" data-submission-id="${escapeHtml(submission.id)}">
        <div class="photo-admin-submission-head">
          <div>
            <h3>${escapeHtml(submission.meet_name)}${submission.meet_date ? " &middot; " + escapeHtml(submission.meet_date) : ""}</h3>
            <p class="photo-admin-meta">Credit: <span class="photo-admin-credit">${escapeHtml(submission.credit_name)}</span> &middot; ${escapeHtml(submission.submitter_name)} (${escapeHtml(submission.submitter_role)}) &middot; ${escapeHtml(submission.submitter_email)}</p>
            ${submission.school_name ? `<p class="photo-admin-meta">School: ${escapeHtml(submission.school_name)}</p>` : ""}
            ${submission.permission_note ? `<p class="photo-admin-meta">Note: ${escapeHtml(submission.permission_note)}</p>` : ""}
          </div>
          <div><span class="photo-admin-badge" data-tone="${isLink ? "link" : "upload"}">${isLink ? "Album link" : "Upload"}</span></div>
        </div>
        ${isLink
          ? `<div class="photo-admin-link-row">
              <a href="${escapeHtml(submission.album_url)}" target="_blank" rel="noopener">Open album &rarr;</a>
              <label class="button button-outline" style="cursor:pointer;">Save a photo from this album<input type="file" accept="image/*" data-photo-link-upload data-submission-id="${escapeHtml(submission.id)}" style="display:none;"></label>
            </div>`
          : ""}
        <div class="photo-admin-grid" style="margin-top:12px;">${items.map(itemCard).join("") || '<p class="photo-admin-empty">No photos yet.</p>'}</div>
      </article>`;
    }).join("");
  }

  async function handleSelect(itemId) {
    // Selecting always recompresses from the pending-original (the
    // higher-resolution source), never the tiny preview.
    const submission = submissions.find((s) => (s.photo_submission_items || []).some((i) => i.id === itemId));
    const item = submission?.photo_submission_items.find((i) => i.id === itemId);
    const sourceUrl = item?.pending_original_url || item?.preview_url;
    if (!sourceUrl) return showMessage("That photo could not be found.", "error");

    try {
      showMessage("Compressing and saving a kept copy&hellip;");
      const sourceBlob = await urlToBlob(sourceUrl);
      const keptBlob = await resizeFileToBlob(new File([sourceBlob], "photo.jpg", { type: "image/jpeg" }), KEPT_MAX_EDGE, KEPT_QUALITY);
      const keptKey = await uploadKeptBlob(keptBlob, itemId);
      await api({ action: "select", item_id: itemId, kept_storage_key: keptKey });
      showMessage("Photo selected and saved.");
      await load();
    } catch (error) {
      showMessage(error.message || "That photo could not be selected.", "error");
    }
  }

  async function handleArchive(itemId) {
    try {
      await api({ action: "archive", item_id: itemId });
      showMessage("Photo skipped.");
      await load();
    } catch (error) {
      showMessage(error.message || "That photo could not be skipped.", "error");
    }
  }

  async function handleLinkUpload(submissionId, file) {
    try {
      showMessage("Compressing and saving a kept copy&hellip;");
      const keptBlob = await resizeFileToBlob(file, KEPT_MAX_EDGE, KEPT_QUALITY);
      const keptKey = await uploadKeptBlob(keptBlob, "");
      await api({ action: "add_kept_for_link", submission_id: submissionId, kept_storage_key: keptKey, original_filename: file.name });
      showMessage("Photo saved from album link.");
      await load();
    } catch (error) {
      showMessage(error.message || "That photo could not be saved.", "error");
    }
  }

  listEl.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-photo-select]");
    if (selectButton) return handleSelect(selectButton.dataset.itemId);

    const archiveButton = event.target.closest("[data-photo-archive]");
    if (archiveButton) return handleArchive(archiveButton.dataset.itemId);
  });

  listEl.addEventListener("change", (event) => {
    const input = event.target.closest("[data-photo-link-upload]");
    if (!input || !input.files?.[0]) return;
    handleLinkUpload(input.dataset.submissionId, input.files[0]);
    input.value = "";
  });

  refreshButton.addEventListener("click", load);
  for (const el of [statusFilter, itemStatusFilter]) el.addEventListener("change", load);
  for (const el of [meetFilter, schoolFilter]) el.addEventListener("change", load);

  load();
})();
