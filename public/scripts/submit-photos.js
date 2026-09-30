// Meet photo submission -- upload path resizes every photo TWICE in the
// browser before anything is sent anywhere: a tiny preview (480px) for
// browsing, and a larger "pending-original" (3600px) that becomes the
// source for whatever an admin later selects. Neither file is the raw
// camera-roll original -- that never leaves the device. Both uploads go
// straight to Supabase Storage via a short-lived signed URL, matching
// public/scripts/submit-timing-results.js's exact two-step pattern (a
// Vercel Function request body is capped at 4.5 MB, so no image bytes
// ever pass through one). See lib/photo_submissions_service.mjs.
(() => {
  const form = document.querySelector("[data-submit-photos-form]");
  if (!form) return;

  const message = document.querySelector("[data-submit-photos-message]");
  const button = document.querySelector("[data-submit-photos-button]");
  const previewsEl = document.querySelector("[data-photos-previews]");
  const sourceTypeInput = form.elements.source_type;
  const fileInput = form.elements.photos_file;
  const tabs = document.querySelectorAll("[data-photos-tab]");
  const uploadFields = document.querySelectorAll("[data-photos-upload-field]");
  const linkFields = document.querySelectorAll("[data-photos-link-field]");

  const PREVIEW_MAX_EDGE = 480;
  const PREVIEW_QUALITY = 0.7;
  const PENDING_MAX_EDGE = 3600;
  const PENDING_QUALITY = 0.88;
  const MAX_PHOTOS = 150;

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  }

  function setTab(name) {
    sourceTypeInput.value = name;
    for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.photosTab === name));
    for (const el of uploadFields) el.classList.toggle("submit-photos-hidden", name !== "upload");
    for (const el of linkFields) el.classList.toggle("submit-photos-hidden", name !== "link");
    form.elements.album_url.required = name === "link";
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => setTab(tab.dataset.photosTab));
  }
  setTab("upload");

  function resizeToBlob(file, maxEdge, quality) {
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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) return reject(new Error("This photo could not be processed."));
          resolve(blob);
        }, "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("This photo could not be read."));
      };
      img.src = objectUrl;
    });
  }

  fileInput.addEventListener("change", async () => {
    previewsEl.innerHTML = "";
    const files = Array.from(fileInput.files || []).slice(0, MAX_PHOTOS);
    for (const file of files) {
      try {
        const previewBlob = await resizeToBlob(file, PREVIEW_MAX_EDGE, PREVIEW_QUALITY);
        const img = document.createElement("img");
        img.src = URL.createObjectURL(previewBlob);
        img.alt = file.name;
        previewsEl.appendChild(img);
      } catch {
        // A single unreadable file shouldn't block previewing the rest.
      }
    }
  });

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

  async function uploadBlob(client, blob, fileName) {
    const slotResponse = await fetch("/api/photo-submissions/request-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ file_name: fileName })
    });
    const slot = await slotResponse.json().catch(() => ({}));
    if (!slotResponse.ok) throw new Error(slot.error || "Could not prepare the upload.");

    const { error: uploadError } = await client.storage
      .from("photo-submissions")
      .uploadToSignedUrl(slot.storage_key, slot.token, blob);
    if (uploadError) throw new Error(uploadError.message || "A photo could not be uploaded.");

    return slot.storage_key;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());
    const isUpload = sourceTypeInput.value === "upload";
    const files = isUpload ? Array.from(fileInput?.files || []).slice(0, MAX_PHOTOS) : [];

    if (isUpload && !files.length) {
      showMessage("Add at least one photo, or switch to sharing an album link.", "error");
      return;
    }
    if (!isUpload && !values.album_url) {
      showMessage("Paste your album link.", "error");
      return;
    }

    button.disabled = true;

    try {
      const items = [];

      if (isUpload) {
        const client = await getClient();
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          showMessage(`Preparing photo ${i + 1} of ${files.length}.`);

          const [previewBlob, pendingBlob] = await Promise.all([
            resizeToBlob(file, PREVIEW_MAX_EDGE, PREVIEW_QUALITY),
            resizeToBlob(file, PENDING_MAX_EDGE, PENDING_QUALITY)
          ]);

          showMessage(`Uploading photo ${i + 1} of ${files.length}. Please don't close this page.`);
          const [previewKey, pendingKey] = await Promise.all([
            uploadBlob(client, previewBlob, `preview-${file.name || "photo.jpg"}`),
            uploadBlob(client, pendingBlob, file.name || "photo.jpg")
          ]);

          items.push({
            previewStorageKey: previewKey,
            pendingOriginalStorageKey: pendingKey,
            originalFilename: file.name || null
          });
        }
      }

      showMessage("Finishing up.");

      const submitResponse = await fetch("/api/photo-submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          source_type: sourceTypeInput.value,
          submitter_name: values.submitter_name,
          submitter_email: values.submitter_email,
          submitter_role: values.submitter_role,
          credit_name: values.credit_name,
          permission_confirmed: values.permission_confirmed === "true",
          permission_note: values.permission_note,
          meet_name: values.meet_name,
          meet_date: values.meet_date,
          school_name: values.school_name,
          album_url: values.album_url,
          items,
          website: values.website
        })
      });
      const result = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok) throw new Error(result.error || "The submission could not be completed.");

      form.reset();
      previewsEl.innerHTML = "";
      setTab("upload");
      showMessage(result.message || "Thank you. Podium Watch received your photos for review.");
    } catch (error) {
      showMessage(error.message || "The submission could not be completed. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();
