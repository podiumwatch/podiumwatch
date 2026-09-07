(() => {
  const loadingBox = document.querySelector("[data-writer-admin-loading]");
  const root = document.querySelector("[data-writer-admin-root]");
  const denied = document.querySelector("[data-writer-admin-denied]");
  const rows = document.querySelector("[data-writer-admin-rows]");

  if (!loadingBox || !root || !denied || !rows) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  async function meApi(action, extra = {}) {
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

  async function writersApi(action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/writers/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  function rowMarkup(writer) {
    const roleOptions = ["writer", "editor", "admin"].map((role) =>
      `<option value="${role}"${writer.role === role ? " selected" : ""}>${role[0].toUpperCase()}${role.slice(1)}</option>`
    ).join("");

    return `<tr>
      <td>${escapeHtml(writer.full_name || "(no name set)")}</td>
      <td><span class="writer-admin-role-badge">${escapeHtml(writer.role)}</span>
        <select class="writer-admin-role-select" data-writer-role-select="${escapeHtml(writer.id)}">${roleOptions}</select>
      </td>
      <td>${escapeHtml(writer.school || "—")}</td>
      <td>${escapeHtml(writer.grade || "—")}</td>
      <td>${escapeHtml(formatDate(writer.created_at))}</td>
    </tr>`;
  }

  async function loadWriters() {
    const { writers } = await writersApi("list");
    rows.innerHTML = writers.map(rowMarkup).join("");
  }

  rows.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-writer-role-select]");
    if (!select) return;

    const profileId = select.dataset.writerRoleSelect;
    const role = select.value;

    try {
      await writersApi("set_role", { profile_id: profileId, role });
      await loadWriters();
    } catch (error) {
      window.alert(error.message || "This role could not be changed.");
      await loadWriters();
    }
  });

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }

      const { profile } = await meApi("get_profile");

      if (!["editor", "admin"].includes(profile.role)) {
        loadingBox.hidden = true;
        denied.hidden = false;
        return;
      }

      await loadWriters();

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>Writer Portal unavailable</h2><p>" +
        escapeHtml(error.message || "This page could not be loaded.") + "</p></div>";
    }
  }

  load();
})();
