(() => {
  const form = document.querySelector("[data-submit-results-form]");

  if (!form) return;

  const message = document.querySelector("[data-submit-results-message]");
  const button = document.querySelector("[data-submit-results-button]");

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.results_file?.files?.[0] || null;
    const pastedText = String(values.text || "").trim();

    if (!file && !pastedText) {
      showMessage("Paste results text or choose a file to upload.", "error");
      return;
    }

    if (file && file.size > 12 * 1024 * 1024) {
      showMessage(`${file.name} is larger than 12 MB. Try a smaller export, or paste the text instead.`, "error");
      return;
    }

    button.disabled = true;
    showMessage("Sending the results for review.");

    try {
      const payload = {
        meet_name: values.meet_name,
        meet_date: values.meet_date,
        meet_location: values.meet_location,
        sport: values.sport,
        season_year: values.season_year,
        gender: values.gender,
        submitter_name: values.submitter_name,
        submitter_email: values.submitter_email,
        submitter_organization: values.submitter_organization,
        note: values.note,
        website: values.website
      };

      if (file) {
        payload.text = await fileAsBase64(file);
        payload.encoding = "base64";
        payload.file_name = file.name;
        payload.content_type = file.type;
      } else {
        payload.text = pastedText;
        payload.file_name = "pasted-results.txt";
        payload.content_type = "text/plain";
      }

      const response = await fetch("/api/results-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "The results could not be submitted. Please try again.");
      }

      form.reset();
      showMessage(result.message || "Thank you. Podium Watch received the results for review.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
})();
