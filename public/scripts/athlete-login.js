// Reuses public/scripts/team-auth-client.js (window.PodiumTeamAuth) as-is
// -- despite the name, it's a generic Supabase session-management
// wrapper with nothing team-specific in it (it just fetches the shared
// Supabase project config from /api/team/config/ and exposes
// getClient/getAccessToken/getUser). Creating a byte-for-byte duplicate
// file for an "athlete" name would be pure duplication for zero
// functional difference.
(() => {
  const loadingBox = document.querySelector("[data-athlete-auth-loading]");
  const authShell = document.querySelector("[data-athlete-auth-shell]");
  const messageBox = document.querySelector("[data-athlete-auth-message]");
  const inviteBanner = document.querySelector("[data-athlete-invite-banner]");
  const authTabs = document.querySelector("[data-athlete-auth-tabs]");
  const signupTab = document.querySelector("[data-athlete-signup-tab]");
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const panelButtons = Array.from(document.querySelectorAll("[data-show-auth-panel]"));
  const signInForm = document.querySelector("[data-athlete-signin-form]");
  const signUpForm = document.querySelector("[data-athlete-signup-form]");
  const resetForm = document.querySelector("[data-athlete-reset-form]");
  const updatePasswordForm = document.querySelector("[data-athlete-update-password-form]");

  if (
    !loadingBox || !authShell || !messageBox || !inviteBanner || !authTabs || !signupTab ||
    panels.length === 0 || !signInForm || !signUpForm || !resetForm || !updatePasswordForm
  ) return;

  let client = null;
  let inviteToken = "";
  let inviteInfo = null;

  function getInviteToken() {
    return new URLSearchParams(window.location.search).get("invite") || "";
  }

  function showMessage(text) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
  }

  function showPanel(name) {
    panels.forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
    authTabs.hidden = name === "reset" || name === "update";
    panelButtons.forEach((button) => {
      const active = button.dataset.showAuthPanel === name;
      button.className = active ? "button button-primary" : "button button-outline";
    });
    showMessage("");
  }

  function setFormBusy(form, busy) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = busy;
  }

  function redirectToAthleteHome() {
    window.location.replace("/athlete-home/");
  }

  async function apiFetch(endpoint, payload, accessToken) {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function redeemInviteIfPresent() {
    if (!inviteToken) return;
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    await apiFetch("/api/athlete/invite/", { action: "redeem", token: inviteToken }, accessToken);
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

      if (inviteToken) {
        showMessage("Connecting your invite...");
        await redeemInviteIfPresent();
      }
      redirectToAthleteHome();
    } catch (error) {
      showMessage(error.message || "Sign in failed.");
    } finally {
      setFormBusy(signInForm, false);
    }
  });

  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormBusy(signUpForm, true);
    const formData = new FormData(signUpForm);

    const displayName = String(formData.get("display_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("confirm_password") || "");
    const consent = formData.get("consent") === "on";

    if (!inviteToken) {
      showMessage("An invite link is required to create an account.");
      setFormBusy(signUpForm, false);
      return;
    }
    if (password.length < 8) {
      showMessage("Your password must contain at least eight characters.");
      setFormBusy(signUpForm, false);
      return;
    }
    if (password !== confirmation) {
      showMessage("The passwords do not match.");
      setFormBusy(signUpForm, false);
      return;
    }
    if (!consent) {
      showMessage("Confirm the consent statement to continue.");
      setFormBusy(signUpForm, false);
      return;
    }

    showMessage("Creating your account...");

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/athlete-login/?confirmed=1&invite=" + encodeURIComponent(inviteToken),
          data: { display_name: displayName }
        }
      });
      if (error) throw error;

      if (data.session) {
        showMessage("Connecting your invite...");
        await redeemInviteIfPresent();
        redirectToAthleteHome();
        return;
      }

      signUpForm.reset();
      showMessage("Account created. Check your email and open the confirmation link -- your invite will connect automatically once you sign in.");
    } catch (error) {
      showMessage(error.message || "The account could not be created.");
    } finally {
      setFormBusy(signUpForm, false);
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
        redirectTo: window.location.origin + "/athlete-login/?mode=update-password"
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
      redirectToAthleteHome();
    } catch (error) {
      showMessage(error.message || "The password could not be updated.");
    } finally {
      setFormBusy(updatePasswordForm, false);
    }
  });

  async function initialize() {
    try {
      inviteToken = getInviteToken();
      client = await window.PodiumTeamAuth.getClient();

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

      if (inviteToken) {
        try {
          inviteInfo = await apiFetch("/api/athlete/invite/", { action: "validate_token", token: inviteToken });
          signupTab.hidden = false;
          inviteBanner.hidden = false;
          inviteBanner.textContent = inviteInfo.team_name + " invited " + inviteInfo.invited_name + " to Podium Watch. Create an account below to connect.";
        } catch (inviteError) {
          inviteBanner.hidden = false;
          inviteBanner.textContent = inviteError.message || "This invite link is invalid.";
        }
      }

      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (params.get("mode") === "update-password") {
        loadingBox.hidden = true;
        authShell.hidden = false;
        showPanel("update");
        return;
      }

      if (data.session) {
        if (inviteToken) {
          await redeemInviteIfPresent().catch(() => {});
        }
        redirectToAthleteHome();
        return;
      }

      loadingBox.hidden = true;
      authShell.hidden = false;
      showPanel(inviteToken && inviteInfo ? "signup" : "signin");

      if (params.get("confirmed") === "1") {
        showMessage("Your email is confirmed. You can now sign in.");
      }
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Athlete accounts unavailable</h2><p>" +
        String(error.message || "The account system could not be loaded.") +
        "</p>";
    }
  }

  initialize();
})();
