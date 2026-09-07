(() => {
  const loadingBox = document.querySelector("[data-writer-auth-loading]");
  const authShell = document.querySelector("[data-writer-auth-shell]");
  const messageBox = document.querySelector("[data-writer-auth-message]");
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const panelButtons = Array.from(document.querySelectorAll("[data-show-auth-panel]"));
  const signInForm = document.querySelector("[data-writer-signin-form]");
  const resetForm = document.querySelector("[data-writer-reset-form]");
  const updatePasswordForm = document.querySelector("[data-writer-update-password-form]");

  if (!loadingBox || !authShell || !messageBox || panels.length === 0 || !signInForm || !resetForm || !updatePasswordForm) {
    return;
  }

  let client = null;

  function showMessage(text) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
  }

  function showPanel(name) {
    panels.forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
    showMessage("");
  }

  function setFormBusy(form, busy) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = busy;
  }

  function redirectToDashboard() {
    window.location.replace("/writer-portal/");
  }

  panelButtons.forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.showAuthPanel));
  });

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormBusy(signInForm, true);
    const formData = new FormData(signInForm);
    showMessage("Signing in...");

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
      });

      if (error) throw error;
      if (!data.session) throw new Error("The account could not be signed in.");

      redirectToDashboard();
    } catch (error) {
      showMessage(error.message || "Sign in failed.");
    } finally {
      setFormBusy(signInForm, false);
    }
  });

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormBusy(resetForm, true);
    const formData = new FormData(resetForm);
    const email = String(formData.get("email") || "").trim();
    showMessage("Sending the reset link...");

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/writer-login/?mode=update-password"
      });

      if (error) throw error;

      resetForm.reset();
      showMessage("Check your email for the password reset link.");
    } catch (error) {
      showMessage(error.message || "The reset link could not be sent.");
    } finally {
      setFormBusy(resetForm, false);
    }
  });

  updatePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormBusy(updatePasswordForm, true);
    const formData = new FormData(updatePasswordForm);
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("confirm_password") || "");

    if (password.length < 8) {
      showMessage("Your password must contain at least eight characters.");
      setFormBusy(updatePasswordForm, false);
      return;
    }

    if (password !== confirmation) {
      showMessage("The passwords do not match.");
      setFormBusy(updatePasswordForm, false);
      return;
    }

    showMessage("Saving your new password...");

    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      redirectToDashboard();
    } catch (error) {
      showMessage(error.message || "The password could not be updated.");
    } finally {
      setFormBusy(updatePasswordForm, false);
    }
  });

  async function initialize() {
    try {
      client = await window.PodiumWriterAuth.getClient();

      client.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          authShell.hidden = false;
          loadingBox.hidden = true;
          showPanel("update");
        }
      });

      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error_description");
      if (urlError) showMessage(urlError);

      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (params.get("mode") === "update-password") {
        loadingBox.hidden = true;
        authShell.hidden = false;
        showPanel("update");
        return;
      }

      if (data.session) {
        redirectToDashboard();
        return;
      }

      loadingBox.hidden = true;
      authShell.hidden = false;
      showPanel("signin");
    } catch (error) {
      loadingBox.innerHTML = "<h2>Writer Portal unavailable</h2><p>" +
        String(error.message || "The Writer Portal account system could not be loaded.") + "</p>";
    }
  }

  initialize();
})();
