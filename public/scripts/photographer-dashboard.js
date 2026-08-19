(() => {
  const loadingBox = document.querySelector("[data-photog-dash-loading]");
  const root = document.querySelector("[data-photog-dash-root]");
  const accountEl = document.querySelector("[data-photog-dash-account]");
  const signOutButton = document.querySelector("[data-photog-dash-signout]");
  const messageBox = document.querySelector("[data-photog-dash-message]");
  const contentBox = document.querySelector("[data-photog-dash-content]");
  const statusBanner = document.querySelector("[data-photog-dash-status-banner]");
  const membershipStatus = document.querySelector("[data-photog-dash-membership-status]");
  const startCheckoutButtons = document.querySelectorAll("[data-photog-dash-start-checkout]");
  const manageMembershipButton = document.querySelector("[data-photog-dash-manage-membership]");
  const storySection = document.querySelector("[data-photog-dash-story-section]");
  const storyTitle = document.querySelector("[data-photog-dash-story-title]");
  const storyIntro = document.querySelector("[data-photog-dash-story-intro]");
  const storyForm = document.querySelector("[data-photog-dash-story-form]");
  const storyRecap = document.querySelector("[data-photog-dash-story-recap]");
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
  const meetSearchInput = document.querySelector("[data-photog-dash-meet-search]");
  const meetResultsBox = document.querySelector("[data-photog-dash-meet-results]");
  const coverageForm = document.querySelector("[data-photog-dash-coverage-form]");
  const coverageList = document.querySelector("[data-photog-dash-coverage-list]");
  const galleryForm = document.querySelector("[data-photog-dash-gallery-form]");
  const galleryList = document.querySelector("[data-photog-dash-gallery-list]");

  const requiredElements = [
    loadingBox, root, accountEl, signOutButton, messageBox, contentBox, statusBanner,
    membershipStatus, manageMembershipButton, storySection, storyTitle, storyIntro, storyForm, storyRecap,
    formTitle, coreForm, saveLabel, sportsForm, areasForm, portfolioForm, portfolioList,
    submitButton, viewProfileLink, meetSearchInput, meetResultsBox, coverageForm,
    coverageList, galleryForm, galleryList
  ];
  if (requiredElements.some((el) => !el) || childrenSections.length === 0 || startCheckoutButtons.length === 0) return;

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

  let allMeets = [];

  function formatMeetDate(dateText) {
    const cleaned = String(dateText || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const date = new Date(`${cleaned}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return cleaned;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateOnly(isoText) {
    const cleaned = String(isoText || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const date = new Date(cleaned + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return cleaned;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Real, current Stripe entitlement only -- a subscription genuinely
  // active AND not past its own period end. Deliberately does NOT
  // consider admin_complimentary_access (a separate entitlement source,
  // see install/18) -- this is used specifically to decide whether a
  // photographer already has a real Stripe subscription that a second
  // Checkout Session would duplicate, matching the server-side
  // duplicate-prevention check in lib/photographer_billing_service.mjs
  // exactly (complimentary access has no Stripe subscription to
  // duplicate, so it's irrelevant to that specific decision).
  function isStripeMembershipActive(subscription) {
    if (!subscription || subscription.status !== "active") return false;
    if (!subscription.current_period_end) return true;
    return new Date(subscription.current_period_end).getTime() > Date.now();
  }

  function renderMembershipActions(subscription) {
    const active = isStripeMembershipActive(subscription);
    for (const button of startCheckoutButtons) button.hidden = active;
    manageMembershipButton.hidden = !subscription.stripe_customer_id;
  }

  function renderMembershipStatus(subscription) {
    renderMembershipActions(subscription);

    if (subscription.admin_complimentary_access) {
      membershipStatus.textContent = "Complimentary membership granted by Podium Watch -- full access, no billing.";
      return;
    }

    const intervalLabel = subscription.billing_interval === "annual" ? "Annual" : subscription.billing_interval === "monthly" ? "Monthly" : null;

    if (!intervalLabel || subscription.status === "inactive") {
      membershipStatus.textContent = "No active membership yet. Choose monthly or annual above, then use \"Manage membership\" to get started.";
      return;
    }
    if (isStripeMembershipActive(subscription)) {
      let text = intervalLabel + " membership -- Active";
      if (subscription.cancel_at_period_end && subscription.current_period_end) {
        text += ". Canceled -- your access continues through " + formatDateOnly(subscription.current_period_end) + ".";
      } else if (subscription.current_period_end) {
        text += ", renews " + formatDateOnly(subscription.current_period_end) + ".";
      } else {
        text += ".";
      }
      membershipStatus.textContent = text;
      return;
    }
    if (subscription.status === "past_due") {
      membershipStatus.textContent = intervalLabel + " membership -- payment past due" +
        (subscription.payment_status === "failed" ? " (last payment failed)" : "") +
        ". Contact Podium Watch to update your payment method.";
      return;
    }
    if (subscription.status === "canceled" || (subscription.current_period_end && new Date(subscription.current_period_end).getTime() <= Date.now())) {
      membershipStatus.textContent = intervalLabel + " membership -- no longer active" +
        (subscription.current_period_end ? " as of " + formatDateOnly(subscription.current_period_end) : "") +
        ". Renew any time -- your listing and history are kept.";
      return;
    }
    membershipStatus.textContent = intervalLabel + " membership -- not yet active.";
  }

  const STORY_STATUS_COPY = {
    eligible: "You're eligible for a free Podium Watch partnership announcement story! Tell us about your business below.",
    info_submitted: "Thanks -- your info is submitted and waiting for Podium Watch's review. You can still update it below until review begins.",
    in_review: "Podium Watch is reviewing your submitted info.",
    published: "Your partnership announcement story has been published!"
  };

  async function renderStorySection(photographerId, subscription) {
    const status = subscription.partnership_story_status || "not_eligible";
    if (status === "not_eligible") { storySection.hidden = true; return; }

    storySection.hidden = false;
    storyIntro.textContent = STORY_STATUS_COPY[status] || "";
    const editable = status === "eligible" || status === "info_submitted";
    storyForm.hidden = !editable;
    storyRecap.hidden = editable;

    try {
      const data = await apiFetch("/api/photographer/profile/", { action: "get_partnership_story", id: photographerId });
      const story = data.story || {};
      if (editable) {
        fillForm(storyForm, story);
        storyForm.elements.image_urls.value = (story.image_urls || []).join("\n");
      } else {
        storyRecap.innerHTML =
          "<p><strong>" + escapeHtml(story.business_name || "") + "</strong> -- " + escapeHtml(story.city_or_area || "") + "</p>" +
          (story.biography ? "<p>" + escapeHtml(story.biography) + "</p>" : "") +
          (status === "published" && story.published_story_url
            ? '<p><a class="button button-primary" href="' + escapeHtml(story.published_story_url) + '" target="_blank" rel="noopener">Read your story</a></p>'
            : "");
      }
    } catch (error) {
      storyIntro.textContent = STORY_STATUS_COPY[status] || "";
    }
  }

  storyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    const payload = formPayload(storyForm);
    payload.image_urls = String(storyForm.elements.image_urls.value || "").split("\n").map((v) => v.trim()).filter(Boolean);
    try {
      await apiFetch("/api/photographer/profile/", { action: "submit_partnership_story", id: currentPhotographer.id, ...payload });
      showMessage("Story info submitted. Podium Watch will follow up.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  for (const button of startCheckoutButtons) {
    button.addEventListener("click", async () => {
      if (!currentPhotographer) return;
      const billingInterval = button.dataset.photogDashStartCheckout;
      button.disabled = true;
      try {
        const data = await apiFetch("/api/photographer/checkout/", { id: currentPhotographer.id, billing_interval: billingInterval });
        window.location.href = data.url;
      } catch (error) {
        showMessage(error.message, true);
        button.disabled = false;
      }
    });
  }

  manageMembershipButton.addEventListener("click", async () => {
    if (!currentPhotographer) return;
    manageMembershipButton.disabled = true;
    try {
      const data = await apiFetch("/api/photographer/billing-portal/", { id: currentPhotographer.id });
      window.location.href = data.url;
    } catch (error) {
      showMessage(error.message, true);
      manageMembershipButton.disabled = false;
    }
  });

  function selectMeet(meet) {
    const label = meet.name + " (" + formatMeetDate(meet.meet_date) + ")";
    coverageForm.elements.meet_id.value = meet.id;
    coverageForm.elements.meet_label.value = label;
    galleryForm.elements.meet_id.value = meet.id;
    galleryForm.elements.meet_label.value = label;
    meetResultsBox.innerHTML = "";
    meetSearchInput.value = "";
  }

  meetSearchInput.addEventListener("input", () => {
    const term = meetSearchInput.value.trim().toLowerCase();
    if (term.length < 2) { meetResultsBox.innerHTML = ""; return; }

    const matches = allMeets
      .filter((m) =>
        (m.name || "").toLowerCase().includes(term) ||
        (m.host_school || "").toLowerCase().includes(term) ||
        (m.city || "").toLowerCase().includes(term)
      )
      .slice(0, 8);

    meetResultsBox.innerHTML = matches.length
      ? matches.map((m) => (
          '<button class="photog-dash-meet-result" type="button" data-photog-dash-meet-id="' + escapeHtml(m.id) + '">' +
            "<strong>" + escapeHtml(m.name) + "</strong><br><span>" + escapeHtml(formatMeetDate(m.meet_date)) + (m.city ? " · " + escapeHtml(m.city) : "") + "</span>" +
          "</button>"
        )).join("")
      : "<p>No meets found.</p>";
  });

  meetResultsBox.addEventListener("click", (event) => {
    const button = event.target.closest("[data-photog-dash-meet-id]");
    if (!button) return;
    const meet = allMeets.find((m) => m.id === button.dataset.photogDashMeetId);
    if (meet) selectMeet(meet);
  });

  function renderCoverage(rows) {
    coverageList.innerHTML = (rows || []).length
      ? rows.map((c) => (
          '<div class="photog-dash-list-row"><div><strong>' + escapeHtml(c.meet ? c.meet.name : "Unknown meet") + "</strong>" +
          '<span class="photog-dash-status-tag">' + escapeHtml(c.coverage_status) + "</span></div>" +
          '<button class="button button-outline" type="button" data-photog-dash-remove-coverage="' + escapeHtml(c.id) + '">Remove</button></div>'
        )).join("")
      : "<p>No meet coverage marked yet.</p>";
  }

  function renderGalleries(rows) {
    galleryList.innerHTML = (rows || []).length
      ? rows.map((g) => (
          '<div class="photog-dash-list-row"><div><strong>' + escapeHtml(g.title) + "</strong>" +
          '<span class="photog-dash-status-tag" data-status="' + escapeHtml(g.status) + '">' + escapeHtml(g.status.replace("_", " ")) + "</span>" +
          (g.meet ? " <span>" + escapeHtml(g.meet.name) + "</span>" : "") + "</div>" +
          '<button class="button button-outline" type="button" data-photog-dash-remove-gallery="' + escapeHtml(g.id) + '">Remove</button></div>'
        )).join("")
      : "<p>No galleries added yet.</p>";
  }

  function renderListing(p) {
    currentPhotographer = p;
    formTitle.textContent = "Edit your listing";
    saveLabel.textContent = "Save changes";
    fillForm(coreForm, p);

    statusBanner.hidden = false;
    statusBanner.dataset.status = p.status;
    statusBanner.textContent = "Status: " + (STATUS_LABELS[p.status] || p.status);

    const subscription = p.subscription || { status: "inactive", billing_interval: null, partnership_story_status: "not_eligible" };

    childrenSections.forEach((section) => { section.hidden = false; });
    renderMembershipStatus(subscription);
    renderStorySection(p.id, subscription);

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
    renderCoverage(p.meet_coverage);
    renderGalleries(p.galleries);

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

  coverageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    if (!coverageForm.elements.meet_id.value) {
      showMessage("Search and pick a real meet first.", true);
      return;
    }
    const payload = formPayload(coverageForm);
    try {
      await apiFetch("/api/photographer/profile/", { action: "add_meet_coverage", id: currentPhotographer.id, ...payload });
      coverageForm.reset();
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderCoverage(data.photographer.meet_coverage);
      showMessage("Coverage added.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  coverageList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-photog-dash-remove-coverage]");
    if (!button) return;
    try {
      await apiFetch("/api/photographer/profile/", { action: "remove_meet_coverage", coverage_id: button.dataset.photogDashRemoveCoverage });
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderCoverage(data.photographer.meet_coverage);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  galleryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPhotographer) return;
    const payload = formPayload(galleryForm);
    try {
      await apiFetch("/api/photographer/profile/", { action: "add_gallery", id: currentPhotographer.id, ...payload });
      galleryForm.reset();
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderGalleries(data.photographer.galleries);
      showMessage("Gallery submitted for review.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  galleryList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-photog-dash-remove-gallery]");
    if (!button) return;
    try {
      await apiFetch("/api/photographer/profile/", { action: "remove_gallery", gallery_id: button.dataset.photogDashRemoveGallery });
      const data = await apiFetch("/api/photographer/profile/", { action: "detail", id: currentPhotographer.id });
      renderGalleries(data.photographer.galleries);
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

      fetch("/api/meets/", { headers: { Accept: "application/json" } })
        .then((response) => response.json())
        .then((data) => { allMeets = Array.isArray(data.meets) ? data.meets : []; })
        .catch(() => { allMeets = []; });

      const me = await apiFetch("/api/photographer/me/", {});
      if (me.listings && me.listings.length > 0) {
        renderListing(me.listings[0]);
      }
      // No listing yet -- the create form is already showing, no
      // children sections needed until one exists.

      // Purely a friendly note while the real webhook-driven sync
      // catches up -- never itself the source of truth. The membership
      // status shown above is always from the real re-fetch above, not
      // from this redirect param.
      const checkoutParam = new URLSearchParams(window.location.search).get("checkout");
      if (checkoutParam === "success") {
        showMessage("Thanks! Finishing up your membership -- this usually takes just a few seconds. Refresh if it doesn't update shortly.");
      }

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
