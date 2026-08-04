(() => {
  const loadingBox = document.querySelector(
    "[data-team-auth-loading]"
  );

  const authShell = document.querySelector(
    "[data-team-auth-shell]"
  );

  const messageBox = document.querySelector(
    "[data-team-auth-message]"
  );

  const authTabs = document.querySelector(
    "[data-team-auth-tabs]"
  );

  const panels = Array.from(
    document.querySelectorAll(
      "[data-auth-panel]"
    )
  );

  const panelButtons = Array.from(
    document.querySelectorAll(
      "[data-show-auth-panel]"
    )
  );

  const signInForm = document.querySelector(
    "[data-team-signin-form]"
  );

  const signUpForm = document.querySelector(
    "[data-team-signup-form]"
  );

  const resetForm = document.querySelector(
    "[data-team-reset-form]"
  );

  const updatePasswordForm =
    document.querySelector(
      "[data-team-update-password-form]"
    );

  if (
    !loadingBox ||
    !authShell ||
    !messageBox ||
    !authTabs ||
    panels.length === 0 ||
    !signInForm ||
    !signUpForm ||
    !resetForm ||
    !updatePasswordForm
  ) {
    return;
  }

  let client = null;

  function getClaimSlug() {
    const params = new URLSearchParams(
      window.location.search
    );

    return String(
      params.get("claim") || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getDashboardUrl() {
    const claimSlug = getClaimSlug();

    return claimSlug
      ? "/team-dashboard/?claim=" +
          encodeURIComponent(claimSlug)
      : "/team-dashboard/";
  }

  function showMessage(text) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
  }

  function showPanel(name) {
    panels.forEach((panel) => {
      panel.hidden =
        panel.dataset.authPanel !== name;
    });

    authTabs.hidden =
      name === "reset" ||
      name === "update";

    panelButtons.forEach((button) => {
      const active =
        button.dataset.showAuthPanel ===
        name;

      button.className =
        active
          ? "button button-primary"
          : "button button-outline";
    });

    showMessage("");
  }

  function setFormBusy(
    form,
    busy
  ) {
    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled = busy;
    }
  }

  function redirectToDashboard() {
    window.location.replace(
      getDashboardUrl()
    );
  }

  panelButtons.forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        showPanel(
          button.dataset.showAuthPanel
        );
      }
    );
  });

  signInForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      setFormBusy(signInForm, true);

      const formData =
        new FormData(signInForm);

      showMessage("Signing in...");

      try {
        const {
          data,
          error
        } =
          await client.auth
            .signInWithPassword({
              email: String(
                formData.get("email") ||
                ""
              ).trim(),
              password: String(
                formData.get(
                  "password"
                ) || ""
              )
            });

        if (error) {
          throw error;
        }

        if (!data.session) {
          throw new Error(
            "The account could not be signed in."
          );
        }

        redirectToDashboard();
      } catch (error) {
        showMessage(
          error.message ||
          "Sign in failed."
        );
      } finally {
        setFormBusy(
          signInForm,
          false
        );
      }
    }
  );

  signUpForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      setFormBusy(signUpForm, true);

      const formData =
        new FormData(signUpForm);

      const displayName = String(
        formData.get(
          "display_name"
        ) || ""
      ).trim();

      const email = String(
        formData.get("email") || ""
      ).trim();

      const password = String(
        formData.get("password") || ""
      );

      const confirmation = String(
        formData.get(
          "confirm_password"
        ) || ""
      );

      if (password.length < 8) {
        showMessage(
          "Your password must contain at least eight characters."
        );

        setFormBusy(
          signUpForm,
          false
        );

        return;
      }

      if (password !== confirmation) {
        showMessage(
          "The passwords do not match."
        );

        setFormBusy(
          signUpForm,
          false
        );

        return;
      }

      showMessage(
        "Creating your team account..."
      );

      try {
        const {
          data,
          error
        } =
          await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo:
                window.location.origin +
                "/team-login/?confirmed=1" +
                (
                  getClaimSlug()
                    ? "&claim=" +
                      encodeURIComponent(
                        getClaimSlug()
                      )
                    : ""
                ),
              data: {
                display_name:
                  displayName
              }
            }
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          redirectToDashboard();
          return;
        }

        signUpForm.reset();

        showMessage(
          "Account created. Check your email and open the confirmation link before signing in."
        );
      } catch (error) {
        showMessage(
          error.message ||
          "The account could not be created."
        );
      } finally {
        setFormBusy(
          signUpForm,
          false
        );
      }
    }
  );

  resetForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      setFormBusy(resetForm, true);

      const formData =
        new FormData(resetForm);

      const email = String(
        formData.get("email") || ""
      ).trim();

      showMessage(
        "Sending the reset link..."
      );

      try {
        const {
          error
        } =
          await client.auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  window.location.origin +
                  "/team-login/?mode=update-password"
              }
            );

        if (error) {
          throw error;
        }

        resetForm.reset();

        showMessage(
          "Check your email for the password reset link."
        );
      } catch (error) {
        showMessage(
          error.message ||
          "The reset link could not be sent."
        );
      } finally {
        setFormBusy(
          resetForm,
          false
        );
      }
    }
  );

  updatePasswordForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setFormBusy(
        updatePasswordForm,
        true
      );

      const formData =
        new FormData(
          updatePasswordForm
        );

      const password = String(
        formData.get("password") || ""
      );

      const confirmation = String(
        formData.get(
          "confirm_password"
        ) || ""
      );

      if (password.length < 8) {
        showMessage(
          "Your password must contain at least eight characters."
        );

        setFormBusy(
          updatePasswordForm,
          false
        );

        return;
      }

      if (password !== confirmation) {
        showMessage(
          "The passwords do not match."
        );

        setFormBusy(
          updatePasswordForm,
          false
        );

        return;
      }

      showMessage(
        "Saving your new password..."
      );

      try {
        const {
          error
        } =
          await client.auth.updateUser({
            password
          });

        if (error) {
          throw error;
        }

        redirectToDashboard();
      } catch (error) {
        showMessage(
          error.message ||
          "The password could not be updated."
        );
      } finally {
        setFormBusy(
          updatePasswordForm,
          false
        );
      }
    }
  );

  async function initialize() {
    try {
      client =
        await window.PodiumTeamAuth
          .getClient();

      client.auth.onAuthStateChange(
        (event) => {
          if (
            event ===
            "PASSWORD_RECOVERY"
          ) {
            authShell.hidden = false;
            loadingBox.hidden = true;
            showPanel("update");
          }
        }
      );

      const params =
        new URLSearchParams(
          window.location.search
        );

      const urlError =
        params.get(
          "error_description"
        );

      if (urlError) {
        showMessage(urlError);
      }

      const {
        data,
        error
      } =
        await client.auth.getSession();

      if (error) {
        throw error;
      }

      if (
        params.get("mode") ===
        "update-password"
      ) {
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

      showPanel(
        params.get("view") ===
          "signup"
          ? "signup"
          : "signin"
      );

      if (
        params.get("confirmed") ===
        "1"
      ) {
        showMessage(
          "Your email is confirmed. You can now sign in."
        );
      }
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Team accounts unavailable</h2>" +
        "<p>" +
        String(
          error.message ||
          "The team account system could not be loaded."
        ) +
        "</p>";
    }
  }

  initialize();
})();