// Team page (lib/render/team_page.mjs, WO-11): Boys/Girls tabs and the
// "Wrong logo? Tell us" report (goes to the existing team report queue).
(() => {
  const tabs = document.querySelectorAll("[data-tp-tab]");
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((other) => other.setAttribute("aria-selected", String(other === tab)));
    document.querySelectorAll("[data-tp-panel]").forEach((panel) => { panel.hidden = panel.dataset.tpPanel !== tab.dataset.tpTab; });
  }));
  const form = document.querySelector("[data-tp-report]");
  if (form) form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-tp-report-message]");
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch("/api/teams/report/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ team_id: form.dataset.teamId, reason: "wrong_information", details: form.elements.details.value, reporter_email: form.elements.reporter_email.value, website: form.elements.website.value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That didn't go through. Please try again.");
      message.textContent = "Thanks. Podium Watch will check the logo.";
      form.elements.details.disabled = true;
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
})();
