(() => {
  const form = document.querySelector("[data-submit-activity-form]");

  if (!form) return;

  const message = document.querySelector("[data-submit-activity-message]");
  const button = document.querySelector("[data-submit-activity-button]");

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    showMessage("Sending this for review.");

    try {
      const response = await fetch("/api/recruiting/submit-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          athlete_name: values.athlete_name,
          school_name: values.school_name,
          graduation_year: values.graduation_year,
          gender: values.gender,
          activity_type: values.activity_type,
          college_name: values.college_name,
          college_division: values.college_division,
          activity_date: values.activity_date,
          source_url: values.source_url,
          notes: values.notes,
          submitter_name: values.submitter_name,
          submitter_email: values.submitter_email,
          submitter_role: values.submitter_role,
          website: values.website
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "This could not be submitted. Please try again.");
      }

      form.reset();
      showMessage(result.message || "Thank you. Podium Watch received this for review.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
})();
