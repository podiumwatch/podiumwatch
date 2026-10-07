(() => {
  const form = document.querySelector("[data-smc-form]");

  if (!form) return;

  const message = document.querySelector("[data-smc-message]");
  const button = document.querySelector("[data-smc-button]");
  const confirmation = document.querySelector("[data-smc-confirmation]");

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const URL_PATTERN = /^(https?:\/\/)?[^\s]+\.[^\s]{2,}$/i;

  let submitting = false;

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function fieldWrap(name) {
    const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
    return field ? field.closest("label, fieldset") : null;
  }

  function clearFieldError(name) {
    const wrap = fieldWrap(name);
    if (!wrap) return;
    wrap.classList.remove("smc-field-invalid");
    const errorEl = wrap.querySelector("[data-smc-error]");
    if (errorEl) errorEl.remove();
    const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (field) field.removeAttribute("aria-invalid");
  }

  function setFieldError(name, text) {
    const wrap = fieldWrap(name);
    if (!wrap) return;
    wrap.classList.add("smc-field-invalid");
    let errorEl = wrap.querySelector("[data-smc-error]");
    if (!errorEl) {
      errorEl = document.createElement("span");
      errorEl.className = "smc-error";
      errorEl.dataset.smcError = "true";
      errorEl.id = `smc-error-${name}`;
      wrap.appendChild(errorEl);
    }
    errorEl.textContent = text;
    const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", errorEl.id);
    }
  }

  function clearAllErrors() {
    form.querySelectorAll("[data-smc-error]").forEach((el) => el.remove());
    form.querySelectorAll(".smc-field-invalid").forEach((el) => el.classList.remove("smc-field-invalid"));
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  }

  function textValue(name) {
    return (form.querySelector(`[name="${CSS.escape(name)}"]`)?.value || "").trim();
  }

  function radioValue(name) {
    const checked = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
    return checked ? checked.value : "";
  }

  function validate() {
    clearAllErrors();
    let firstInvalid = null;
    const errors = [];

    function fail(name, text) {
      setFieldError(name, text);
      errors.push(name);
      if (!firstInvalid) firstInvalid = form.querySelector(`[name="${CSS.escape(name)}"]`);
    }

    if (!textValue("first_name")) fail("first_name", "First name is required.");
    if (!textValue("last_name")) fail("last_name", "Last name is required.");

    const email = textValue("email");
    if (!email) fail("email", "Email address is required.");
    else if (!EMAIL_PATTERN.test(email)) fail("email", "Enter a valid email address.");

    if (!textValue("phone")) fail("phone", "Phone number is required.");
    if (!textValue("college")) fail("college", "College or university is required.");
    if (!textValue("major")) fail("major", "Major or area of study is required.");
    if (!textValue("college_year")) fail("college_year", "Choose your current year in college.");

    if (!radioValue("is_18_or_older")) fail("is_18_or_older", "Please answer this question.");
    else if (radioValue("is_18_or_older") === "false") fail("is_18_or_older", "You must be at least 18 years old to apply for this role.");

    if (!radioValue("available_nov_7")) fail("available_nov_7", "Please answer this question.");
    else if (radioValue("available_nov_7") === "false") fail("available_nov_7", "This role requires availability on Saturday, November 7, 2026 at Fortress Obetz.");

    if (!radioValue("available_full_day")) fail("available_full_day", "Please answer this question.");
    else if (radioValue("available_full_day") === "false") fail("available_full_day", "This role requires availability for most or all of the event.");

    if (!textValue("interest_reason")) fail("interest_reason", "Please tell us why you're interested.");

    if (!radioValue("comfortable_interviewing")) fail("comfortable_interviewing", "Please answer this question.");
    if (!radioValue("comfortable_video")) fail("comfortable_video", "Please answer this question.");
    if (!textValue("xc_track_familiarity")) fail("xc_track_familiarity", "Choose a familiarity level.");

    ["portfolio_url", "linkedin_url", "video_url", "other_url"].forEach((name) => {
      const value = textValue(name);
      if (value && !URL_PATTERN.test(value)) fail(name, "Enter a valid URL.");
    });

    if (!form.querySelector('[name="credential_acknowledgement"]')?.checked) {
      fail("credential_acknowledgement", "You must check this box to submit the application.");
    }

    return { valid: errors.length === 0, firstInvalid };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitting) return;

    const { valid, firstInvalid } = validate();
    if (!valid) {
      showMessage("Please fix the highlighted fields and try again.", "error");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const data = new FormData(form);
    submitting = true;
    button.disabled = true;
    button.textContent = "Submitting...";
    showMessage("Sending your application.");

    try {
      const response = await fetch("/api/state-meet-correspondent/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          first_name: data.get("first_name"),
          last_name: data.get("last_name"),
          email: data.get("email"),
          phone: data.get("phone"),
          college: data.get("college"),
          major: data.get("major"),
          college_year: data.get("college_year"),
          is_18_or_older: data.get("is_18_or_older") === "true",
          available_nov_7: data.get("available_nov_7") === "true",
          available_full_day: data.get("available_full_day") === "true",
          interest_reason: data.get("interest_reason"),
          experience: data.get("experience"),
          comfortable_interviewing: data.get("comfortable_interviewing") === "true",
          comfortable_video: data.get("comfortable_video") === "true",
          xc_track_familiarity: data.get("xc_track_familiarity"),
          portfolio_url: data.get("portfolio_url"),
          linkedin_url: data.get("linkedin_url"),
          social_handle: data.get("social_handle"),
          video_url: data.get("video_url"),
          other_url: data.get("other_url"),
          additional_notes: data.get("additional_notes"),
          credential_acknowledgement: data.get("credential_acknowledgement") === "on",
          website: data.get("website")
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "This could not be submitted. Please try again.");
      }

      form.hidden = true;
      showMessage("");
      if (confirmation) confirmation.hidden = false;
    } catch (error) {
      showMessage(error.message, "error");
      submitting = false;
      button.disabled = false;
      button.textContent = "Submit Application";
    }
  });
})();
