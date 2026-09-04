(() => {
  const form = document.querySelector("[data-apply-form]");

  if (!form) return;

  const message = document.querySelector("[data-apply-message]");
  const button = document.querySelector("[data-apply-button]");

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);

    button.disabled = true;
    showMessage("Sending your application.");

    try {
      const response = await fetch("/api/intern-applications/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          full_name: data.get("full_name"),
          email: data.get("email"),
          phone: data.get("phone"),
          school: data.get("school"),
          grade: data.get("grade"),
          parent_name: data.get("parent_name"),
          parent_email: data.get("parent_email"),
          parent_consent: data.get("parent_consent") === "on",
          coverage_interests: data.getAll("coverage_interests"),
          availability: data.get("availability"),
          why_interested: data.get("why_interested"),
          writing_sample: data.get("writing_sample"),
          portfolio_link: data.get("portfolio_link"),
          website: data.get("website")
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "This could not be submitted. Please try again.");
      }

      form.reset();
      showMessage(result.message || "Thanks for applying. Podium Watch received this for review.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
})();
