// Server-rendered athlete page (lib/render/athlete_page.mjs, WO-09). The
// page content is already in the HTML; this only sends the correction form
// and copies the profile link.
(() => {
  const root = document.querySelector("[data-athlete-page]");
  if (!root) return;
  const slug = root.dataset.slug;
  const form = root.querySelector("[data-athlete-correction-form]");
  const message = root.querySelector("[data-athlete-message]");
  const share = root.querySelector("[data-athlete-share]");

  share?.addEventListener("click", () => {
    const url = window.location.origin + window.location.pathname;
    const done = () => { share.textContent = "Link copied"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt("Copy this link", url));
    else window.prompt("Copy this link", url);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    const values = Object.fromEntries(new FormData(form).entries());
    button.disabled = true;
    message.textContent = "Sending the correction for review.";
    try {
      const response = await fetch("/api/athletes/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...values, athlete_slug: slug })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The correction could not be sent.");
      form.reset();
      message.textContent = payload.message || "The correction was sent to Podium Watch.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
