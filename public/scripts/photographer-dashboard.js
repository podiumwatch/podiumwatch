(() => {
  const loadingBox = document.querySelector("[data-photog-dash-loading]");
  const root = document.querySelector("[data-photog-dash-root]");
  const accountEl = document.querySelector("[data-photog-dash-account]");
  const signOutButton = document.querySelector("[data-photog-dash-signout]");
  const messageBox = document.querySelector("[data-photog-dash-message]");
  const contentBox = document.querySelector("[data-photog-dash-content]");
  const statusBanner = document.querySelector("[data-photog-dash-status-banner]");
  const formTitle = document.querySelector("[data-photog-dash-form-title]");
  const coreForm = document.querySelector("[data-photog-dash-core-form]");
  const saveLabel = document.querySelector("[data-photog-dash-save-label]");
  const childrenSections = document.querySelectorAll("[data-photog-dash-children]");
  const sportsForm = document.querySelector("[data-photog-dash-sports-form]");
  const areasForm = document.querySelector("[data-photog-dash-areas-form]");
  const portfolioForm = document.querySelector("[data-photog-dash-portfolio-form]");
  const portfolioList = document.querySelector("[data-photog-dash-portfolio-list]");
  const submitButton = document.querySelector("[data-photog-dash-submit]");
  const viewProfileLink = document.querySelector("[data-photog-dash-view-profile]");

  const requiredElements = [
    loadingBox, root, accountEl, signOutButton, messageBox, contentBox, statusBanner,
    formTitle, coreForm, saveLabel, sportsForm, areasForm, portfolioForm, portfolioList,
    submitButton, viewProfileLink
  ];
  if (requiredElements.some((el) => !el) || childrenSections.length === 0) return;

  const STATUS_LABELS = {
    draft: "Draft -- not yet submitted", submitted: "Submitted -- waiting for review",
    pending_review: "Pending review", approved: "Approved and public",
    rejected: "Not approved -- edit and resubmit", suspended: "Suspended by Podium Watch"
  };

  let currentPhotographer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.dataset.tone = isError ? "error" : "";
  }

  async function apiFetch(endpoint, payload) {
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    if (!accessToken) {
      window.location.replace("/photographer-login/");
      throw new Error("Sign in required.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify(payload || {})
    });
    if (response.status === 401) window.location.replace("/photographer-login/");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  function fillForm(form, values) {
    for (const element of form.elements) {
      if (!element.name || !(element.name in values)) continue;
      const value = values[element.name];
      if (element.type === "checkbox") element.checked = Boolean(value);
      else element.value = value ?? "";
    }
  }

  function formPayload(form) {
    const data = new FormData(form);
    const payload = {};
    for (const [key, value] of data.entries()) payload[key] = value;
    for (const element of form.elements) {
      if (element.type === "checkbox") payload[element.name] = element.checked;
    }
    return payload;
  }

  function renderPortfolio(items) {
    portfolioList.innerHTML = (items || []).length
      ? items.map((item) => (
          '<div class="photog-dash-portfolio-row">' +
            '<img src="' + escapeHtml(item.image_url) + '" alt="">' +
            '<span style="flex:1;">' + escapeHtml(item.caption || "") + '</span>' +
            '<button class="button button-outline" type="button" data-photog-dash-remove-portfolio="' + escapeHtml(item.id) + '">Remove</button>' +
          '</div>'
        )).join("")
      : "<p>No portfolio images yet.</p>";
  }

  function renderListing(p) {
    currentPhotographer = p;
    formTitle.textContent = "Edit your listing";
    saveLabel.textContent = "Save changes";
    fillForm(coreForm, p);

    statusBanner.hidden = false;
    statusBanner.dataset.status = p.status;
    statusBanner.textContent = "Status: " + (STATUS_LABELS[p.status] || p.status);

    childrenSections.forEach((section) => { section.hidden = false; });

    for (const box of sportsForm.querySelectorAll('input[name="sports"]')) {
      box.checked = (p.sports || []).includes(box.value);
    }
    const regions = (p.service_areas || []).filter((a) => a.area_type === "region").map((a) => a.area_value);
    for (const box of areasForm.querySelectorAll('input[name="regions"]')) {
      box.checked = regions.includes(box.value);
    }
    areasForm.elements.counties.value = (p.service_areas || []).filter((a) => a.area_type === "county").map((a) => a.area_value).join(", ");
    areasForm.elements.cities.value = (p.service_areas || []).filter((a) => a.area_type === "city").map((a) => a.area_value).join(", ");

    renderPortfolio(p.portfolio);

    submitButton.disabled = !["draft", "rejected"].includes(p.status);
    submitButton.textContent = ["draft", "rejected"].includes(p.status) ? "Submit for review" : "Already submitted";

    if (p.status === "approved") {
      viewProfileLink.hidden = false;
      viewProfileLink.href = "/photographers/profile/?slug=" + encodeURIComponent(p.slug);
    } else {
      viewProfileLink.hidden = true;
    }
  }

  coreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(coreForm);
    try {
      let data;
      if (currentPhotographer) {
        data = await apiFetch("/api/photographer/profile/", { action: "update", id: currentPhotographer.id, ...payload });
      } else {
        data = await apiFetch("/api/photographer/create/", payload);
      }
      showMessage("Saved.");
      renderListing(data.photographer);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  sportsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    const sports = [...sportsForm.querySelectorAll('input[name="sports"]:checked')].map((el) => el.value);
    try {
      await apiFetch("/api/photographer/profile/", { action: "set_sports", id: currentPhotographer.id, sports });
      showMessage("Sports saved.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  areasForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    const regions = [...areasForm.querySelectorAll('input[name="regions"]:checked')].map((el) => ({ area_type: "region", area_value: el.value }));
    const counties = String(areasForm.elements.counties.value || "").split(",").map((v) => v.trim()).filter(Boolean).map((v) => ({ area_type: "county", area_value: v }));
    const cities = String(areasForm.elements.cities.value || "").split(",").map((v) => v.trim()).filter(Boolean).map((v) => ({ area_type: "city", area_value: v }));
    try {
      await apiFetch("/api/photographer/profile/", { action: "set_service_areas", id: currentPhotographer.id, service_areas: [...regions, ...counties, ...cities] });
      showMessage("Service areas saved.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  portfolioForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    const payload = formPayload(portfolioForm);
    try {
      await apiFetch("/api/photographer/profile/", { action: "add_portfolio_item", id: currentPhotographer.id, ...payload });
      portfolioForm.reset();
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderPortfolio(data.photographer.portfolio);
      showMessage("Portfolio image added.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  portfolioList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-photog-dash-remove-portfolio]");
    if (!button) return;
    try {
      await apiFetch("/api/photographer/profile/", { action: "remove_portfolio_item", portfolio_id: button.dataset.photogDashRemovePortfolio });
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderPortfolio(data.photographer.portfolio);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  submitButton.addEventListener("click", async () => {
    if (!currentPhotographer) return;
    try {
      const data = await apiFetch("/api/photographer/profile/", { action: "submit", id: currentPhotographer.id });
      showMessage("Submitted for review.");
      renderListing(data.photographer);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  signOutButton.addEventListener("click", async () => {
    const client = await window.PodiumTeamAuth.getClient();
    await client.auth.signOut();
    window.location.replace("/photographer-login/");
  });

  async function initialize() {
    try {
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) { window.location.replace("/photographer-login/"); return; }

      accountEl.textContent = user.email || "Photographer account";

      const me = await apiFetch("/api/photographer/me/", {});
      if (me.listings && me.listings.length > 0) {
        renderListing(me.listings[0]);
      }
      // No listing yet -- the create form is already showing, no
      // children sections needed until one exists.

      loadingBox.hidden = true;
      root.hidden = false;
      contentBox.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Your listing could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/photographer-login/">Back to sign in</a></p>';
    }
  }

  initialize();
})();
