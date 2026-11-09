// "Partner with Podium Watch" (/sponsors/, WO-26). The page itself is
// rendered on the server (src/pages/sponsors.mjs); this only sends the
// inquiry form.
(() => {
  const root = document.querySelector("[data-partner-page]");
  if (!root) return;
  const form = root.querySelector("[data-partner-form]");
  const message = root.querySelector("[data-partner-message]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    const values = Object.fromEntries(new FormData(form).entries());
    if (!String(values.name || "").trim() || !String(values.email || "").includes("@")) {
      message.textContent = "Add your name and email so we can reply.";
      return;
    }
    button.disabled = true;
    message.textContent = "Sending.";
    try {
      const response = await fetch("/api/partner/inquiry/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your message could not be sent right now.");
      form.reset();
      message.textContent = "Thanks. We'll reply by email soon.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
