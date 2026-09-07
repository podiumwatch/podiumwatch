(() => {
  const loadingBox = document.querySelector("[data-writer-admin-loading]");
  const root = document.querySelector("[data-writer-admin-root]");
  const denied = document.querySelector("[data-writer-admin-denied]");
  const rows = document.querySelector("[data-writer-admin-rows]");
  const inviteForm = document.querySelector("[data-writer-invite-form]");
  const inviteMessage = document.querySelector("[data-writer-invite-message]");

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
      <td class="admin-cell-primary">${escapeHtml(writer.full_name || "(no name set)")}</td>
      <td><span class="admin-cell-label">Role</span><span class="writer-admin-role-badge">${escapeHtml(writer.role)}</span>
        <select class="writer-admin-role-select" data-writer-role-select="${escapeHtml(writer.id)}">${roleOptions}</select>
      </td>
      <td><span class="admin-cell-label">School</span>${escapeHtml(writer.school || "—")}</td>
      <td><span class="admin-cell-label">Grade</span>${escapeHtml(writer.grade || "—")}</td>
      <td><span class="admin-cell-label">Joined</span>${escapeHtml(formatDate(writer.created_at))}</td>
      <td>
        <button class="button button-outline" type="button" data-writer-resend-link="${escapeHtml(writer.id)}">Resend setup link</button>
      </td>
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

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-writer-resend-link]");
    if (!button) return;

    const profileId = button.dataset.writerResendLink;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Sending...";

    try {
      await writersApi("resend_setup_link", { profile_id: profileId });
      button.textContent = "Sent!";
      setTimeout(() => { button.textContent = originalLabel; button.disabled = false; }, 3000);
    } catch (error) {
      window.alert(error.message || "This link could not be sent.");
      button.textContent = originalLabel;
      button.disabled = false;
    }
  });

  if (inviteForm) {
    inviteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = inviteForm.querySelector('button[type="submit"]');
      button.disabled = true;
      inviteMessage.hidden = true;

      try {
        const result = await writersApi("invite", {
          email: inviteForm.elements.email.value,
          full_name: inviteForm.elements.full_name.value
        });
        inviteForm.reset();
        inviteMessage.textContent = result.existing_account
          ? "Writer access granted -- they already had an account and can sign in at /writer-login/ right away."
          : "Invite sent. They'll get an email to set their password.";
        inviteMessage.dataset.tone = "success";
        inviteMessage.hidden = false;
        await loadWriters();
      } catch (error) {
        inviteMessage.textContent = error.message || "This invite could not be sent.";
        inviteMessage.dataset.tone = "error";
        inviteMessage.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
  }

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
