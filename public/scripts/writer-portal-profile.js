(() => {
  const loadingBox = document.querySelector("[data-writer-profile-loading]");
  const root = document.querySelector("[data-writer-profile-root]");
  const form = document.querySelector("[data-writer-profile-form]");
  const message = document.querySelector("[data-writer-profile-message]");
  const avatarImg = document.querySelector("[data-writer-profile-avatar-img]");
  const avatarEmpty = document.querySelector("[data-writer-profile-avatar-empty]");
  const avatarButton = document.querySelector("[data-writer-profile-avatar-button]");
  const avatarInput = document.querySelector("[data-writer-profile-avatar-input]");

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

  let currentAvatarUrl = "";

  function renderAvatar(name) {
    if (currentAvatarUrl) {
      avatarImg.src = currentAvatarUrl;
      avatarImg.hidden = false;
      avatarEmpty.hidden = true;
    } else {
      avatarImg.hidden = true;
      avatarEmpty.hidden = false;
      avatarEmpty.textContent = (name || "?").trim().charAt(0) || "?";
    }
  }

  if (avatarButton) {
    avatarButton.addEventListener("click", () => avatarInput.click());
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files?.[0];
      avatarInput.value = "";
      if (!file) return;

      avatarButton.disabled = true;
      showMessage("Uploading picture...");
      try {
        const slot = await api("request_image_upload", { file_name: file.name });
        if (file.size > slot.max_file_bytes) {
          throw new Error(`That image is larger than ${Math.floor(slot.max_file_bytes / (1024 * 1024))} MB.`);
        }
        const client = await window.PodiumWriterAuth.getClient();
        const { error } = await client.storage.from("writer-portal-images").uploadToSignedUrl(slot.storage_key, slot.token, file);
        if (error) throw error;

        currentAvatarUrl = slot.public_url;
        renderAvatar(form.elements.full_name.value);
        await api("update_profile", {
          full_name: form.elements.full_name.value,
          school: form.elements.school.value,
          grade: form.elements.grade.value,
          bio: form.elements.bio.value,
          avatar_url: currentAvatarUrl
        });
        showMessage("Profile picture updated.");
      } catch (error) {
        showMessage(error.message || "This picture could not be uploaded.", "error");
      } finally {
        avatarButton.disabled = false;
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

      const { profile } = await api("get_profile");
      form.elements.full_name.value = profile.full_name || "";
      form.elements.school.value = profile.school || "";
      form.elements.grade.value = profile.grade || "";
      form.elements.bio.value = profile.bio || "";
      currentAvatarUrl = profile.avatar_url || "";
      renderAvatar(profile.full_name);

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
        bio: form.elements.bio.value,
        avatar_url: currentAvatarUrl
      });
      renderAvatar(form.elements.full_name.value);
      showMessage("Saved.");
    } catch (error) {
      showMessage(error.message || "This could not be saved.", "error");
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
