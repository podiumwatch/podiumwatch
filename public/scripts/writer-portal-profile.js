(() => {
  const loadingBox = document.querySelector("[data-writer-profile-loading]");
  const root = document.querySelector("[data-writer-profile-root]");
  const form = document.querySelector("[data-writer-profile-form]");
  const message = document.querySelector("[data-writer-profile-message]");

  if (!loadingBox || !root || !form || !message) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  async function api(action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/me/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }

      const { profile } = await api("get_profile");
      form.elements.full_name.value = profile.full_name || "";
      form.elements.school.value = profile.school || "";
      form.elements.grade.value = profile.grade || "";
      form.elements.bio.value = profile.bio || "";

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>Writer Portal unavailable</h2><p>" +
        escapeHtml(error.message || "This page could not be loaded.") + "</p></div>";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage("Saving...");

    try {
      await api("update_profile", {
        full_name: form.elements.full_name.value,
        school: form.elements.school.value,
        grade: form.elements.grade.value,
        bio: form.elements.bio.value
      });
      showMessage("Saved.");
    } catch (error) {
      showMessage(error.message || "This could not be saved.", "error");
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
