(() => {
  const shell = document.querySelector("[data-swj-shell]");
  const message = document.querySelector("[data-swj-message]");
  const form = document.querySelector("[data-swj-form]");
  const codeInput = document.querySelector("[data-swj-code-input]");
  const submitButton = document.querySelector("[data-swj-submit]");

  const requiredElements = [shell, message, form, codeInput, submitButton];
  if (requiredElements.some((el) => !el)) return;

  // Rehearsal Mode (Project 1) gap fix (2026-08-27): a helper who opens
  // a SPECIFIC race link cold (no code entered yet on this device) --
  // most importantly a coach's own "share this rehearsal" link, since a
  // rehearsal never appears in the smart-routing every OTHER helper
  // entry point uses -- used to always land on the generic race list
  // after entering the code, losing the specific race they were sent
  // to. ?next=<path> (set by the page that bounced them here, e.g.
  // split-watch-live.js) sends them back to that exact page instead.
  // Restricted to a same-app relative path so this can never become an
  // open redirect to an arbitrary URL.
  function safeNextPath() {
    const raw = new URLSearchParams(window.location.search).get("next") || "";
    return /^\/split-watch\/[a-zA-Z0-9/_-]*(\?[^\s"']*)?$/.test(raw) ? raw : "";
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.style.padding = text ? "12px 14px" : "0";
    message.style.borderRadius = "10px";
    message.style.marginBottom = text ? "16px" : "0";
    message.style.color = isError ? "#991b1b" : "#065f46";
    message.style.background = isError ? "rgba(220,38,38,0.12)" : "rgba(0,191,99,0.12)";
  }

  codeInput.addEventListener("input", () => {
    // Digits only, matching the 4-digit numeric code coaches now
    // generate -- strips anything else a phone's autocorrect/autofill
    // might slip in, rather than rejecting the whole submission later.
    const cursor = codeInput.selectionStart;
    const cleaned = codeInput.value.replace(/[^0-9]/g, "").slice(0, 4);
    if (cleaned !== codeInput.value) {
      codeInput.value = cleaned;
      codeInput.setSelectionRange(cursor, cursor);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = codeInput.value.trim();
    if (!code) {
      showMessage("Enter your team's race day code.", true);
      return;
    }

    submitButton.disabled = true;
    showMessage("");

    try {
      const response = await fetch("/api/split-watch/join/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That code could not be verified.");

      showMessage("Code accepted. Taking you to " + data.team.school_name + "...");
      const next = safeNextPath();
      // A specific race (most importantly a coach's own shared
      // rehearsal link) wins over the default -- otherwise lands on the
      // scoped race-selection page, never the full coach hub -- see
      // splitwatchraces.mjs's header comment.
      window.location.href = next || "/split-watch/races/?id=" + encodeURIComponent(data.team.id);
    } catch (error) {
      showMessage(error.message || "That code could not be verified.", true);
      submitButton.disabled = false;
    }
  });
})();
