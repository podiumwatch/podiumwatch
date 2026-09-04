// Timing company results submission -- a two-step upload, not a single
// form post, because Vercel Functions cap request bodies at 4.5 MB (well
// under this feature's real 25 MB file cap): the file goes straight from
// this page to Supabase Storage using a short-lived signed URL, and only
// plain metadata (never the file's bytes) ever reaches an API route.
// See api/timing-submissions/request-upload.js (step 1) and
// api/timing-submissions/submit.js (step 2).
(() => {
  const form = document.querySelector("[data-submit-timing-form]");
  if (!form) return;

  const message = document.querySelector("[data-submit-timing-message]");
  const button = document.querySelector("[data-submit-timing-button]");
  const fileInput = form.elements.results_file;

  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());
    const file = fileInput?.files?.[0] || null;

    if (!file) {
      showMessage("Choose a results file to upload.", "error");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      showMessage(`${file.name} is larger than 25 MB. Please contact Podium Watch directly for very large exports.`, "error");
      return;
    }

    button.disabled = true;

    try {
      showMessage("Preparing your upload.");

      const slotResponse = await fetch("/api/timing-submissions/request-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ file_name: file.name })
      });
      const slot = await slotResponse.json().catch(() => ({}));
      if (!slotResponse.ok) throw new Error(slot.error || "Could not prepare the upload.");

      showMessage("Uploading your file. This may take a moment for larger files -- please don't close this page.");

      const client = await getClient();
      const { error: uploadError } = await client.storage
        .from("timing-submissions")
        .uploadToSignedUrl(slot.storage_key, slot.token, file);
      if (uploadError) throw new Error(uploadError.message || "The file could not be uploaded.");

      showMessage("Finishing up.");

      const submitResponse = await fetch("/api/timing-submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          meet_name: values.meet_name,
          meet_date: values.meet_date,
          division_level: values.division_level,
          timing_company_name: values.timing_company_name,
          submitter_email: values.submitter_email,
          storage_key: slot.storage_key,
          file_name: file.name,
          content_type: file.type || "",
          file_size_bytes: file.size,
          website: values.website
        })
      });
      const result = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok) throw new Error(result.error || "The submission could not be completed.");

      form.reset();
      showMessage(result.message || "Thank you. Podium Watch received your results file for review.");
    } catch (error) {
      showMessage(error.message || "The submission could not be completed. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();
