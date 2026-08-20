(() => {
  const messageBox = document.querySelector("[data-photog-admin-message]");
  const searchForm = document.querySelector("[data-photog-search-form]");
  const newButton = document.querySelector("[data-photog-new]");
  const listEl = document.querySelector("[data-photog-list]");
  const editorTitle = document.querySelector("[data-photog-editor-title]");
  const coreForm = document.querySelector("[data-photog-core-form]");
  const childrenSection = document.querySelector("[data-photog-children-section]");
  const sportsForm = document.querySelector("[data-photog-sports-form]");
  const areasForm = document.querySelector("[data-photog-areas-form]");
  const portfolioForm = document.querySelector("[data-photog-portfolio-form]");
  const portfolioList = document.querySelector("[data-photog-portfolio-list]");
  const pendingGalleriesList = document.querySelector("[data-photog-pending-galleries]");
  const coverageList = document.querySelector("[data-photog-coverage-list]");
  const galleryList = document.querySelector("[data-photog-gallery-list]");
  const billingReadout = document.querySelector("[data-photog-billing-readout]");
  const complimentaryForm = document.querySelector("[data-photog-complimentary-form]");
  const complimentaryGrantedAt = document.querySelector("[data-photog-complimentary-granted-at]");
  const storyQueue = document.querySelector("[data-photog-story-queue]");

  const requiredElements = [
    messageBox, searchForm, newButton, listEl, editorTitle, coreForm,
    childrenSection, sportsForm, areasForm, portfolioForm, portfolioList,
    pendingGalleriesList, coverageList, galleryList, billingReadout, complimentaryForm,
    complimentaryGrantedAt, storyQueue
  ];
  if (requiredElements.some((el) => !el)) return;

  const STATUS_LABELS = {
    draft: "Draft", submitted: "Submitted", pending_review: "Pending review",
    approved: "Approved", rejected: "Rejected", suspended: "Suspended"
  };

  let currentId = null;

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

  async function api(body) {
    const response = await fetch("/api/admin/photographers/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    if (response.status === 401) {
      showMessage("Admin sign in required. Return to /admin/ to sign in.", true);
      throw new Error("Admin sign in required.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
    return payload;
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

  async function renderList() {
    const params = formPayload(searchForm);
    listEl.innerHTML = "<p>Loading...</p>";
    try {
      const data = await api({ action: "list", search: params.search, status: params.status });
      const photographers = data.photographers || [];
      listEl.innerHTML = photographers.length
        ? photographers.map((p) => (
            '<button class="photog-admin-list-item" type="button" data-photog-select="' + escapeHtml(p.id) + '">' +
              '<span class="photog-admin-badge" data-status="' + escapeHtml(p.status) + '">' + escapeHtml(STATUS_LABELS[p.status] || p.status) + '</span>' +
              '<strong>' + escapeHtml(p.business_name) + '</strong>' +
              '<span>' + escapeHtml([p.city, p.state].filter(Boolean).join(", ") || "No city set") + '</span>' +
            '</button>'
          )).join("")
        : "<p>No photographers match this search.</p>";
    } catch (error) {
      listEl.innerHTML = "";
      showMessage(error.message, true);
    }
  }

  function renderPortfolio(items) {
    portfolioList.innerHTML = (items || []).length
      ? items.map((item) => (
          '<div class="photog-admin-portfolio-row">' +
            '<img src="' + escapeHtml(item.image_url) + '" alt="">' +
            '<span style="flex:1;">' + escapeHtml(item.caption || "") + '</span>' +
            '<button class="button button-outline" type="button" data-photog-remove-portfolio="' + escapeHtml(item.id) + '">Remove</button>' +
          '</div>'
        )).join("")
      : "<p>No portfolio images yet.</p>";
  }

  function renderCoverage(rows) {
    coverageList.innerHTML = (rows || []).length
      ? rows.map((c) => (
          '<div class="photog-admin-list-item" style="cursor:default;"><strong>' + escapeHtml(c.meet ? c.meet.name : "Unknown meet") + '</strong>' +
          '<span>' + escapeHtml(c.coverage_status) + (c.public_notes ? " -- " + escapeHtml(c.public_notes) : "") + '</span></div>'
        )).join("")
      : "<p>No meet coverage marked.</p>";
  }

  function renderGalleries(rows) {
    galleryList.innerHTML = (rows || []).length
      ? rows.map((g) => (
          '<div class="photog-admin-list-item" style="cursor:default;">' +
          '<span class="photog-admin-badge" data-status="' + escapeHtml(g.status) + '">' + escapeHtml(g.status) + '</span>' +
          '<strong>' + escapeHtml(g.title) + '</strong>' +
          '<span>' + (g.meet ? escapeHtml(g.meet.name) + " -- " : "") + '<a href="' + escapeHtml(g.gallery_url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(g.gallery_url) + '</a></span>' +
          '</div>'
        )).join("")
      : "<p>No galleries.</p>";
  }

  async function renderPendingGalleries() {
    try {
      const data = await api({ action: "list_pending_galleries" });
      const galleries = data.galleries || [];
      pendingGalleriesList.innerHTML = galleries.length
        ? galleries.map((g) => (
            '<div class="photog-admin-list-item" style="cursor:default;">' +
              '<strong>' + escapeHtml(g.title) + '</strong>' +
              '<span>' + escapeHtml(g.photographer ? g.photographer.business_name : "Unknown photographer") + (g.meet ? " -- " + escapeHtml(g.meet.name) : "") + '</span>' +
              '<span><a href="' + escapeHtml(g.gallery_url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(g.gallery_url) + '</a></span>' +
              '<div class="photog-admin-actions" style="margin-top:8px;">' +
                '<button class="button button-primary" type="button" data-photog-approve-gallery="' + escapeHtml(g.id) + '">Approve</button>' +
                '<button class="button button-outline" type="button" data-photog-reject-gallery="' + escapeHtml(g.id) + '">Reject</button>' +
              '</div>' +
            '</div>'
          )).join("")
        : "<p>No galleries waiting for review.</p>";
    } catch (error) {
      pendingGalleriesList.innerHTML = "<p>" + escapeHtml(error.message) + "</p>";
    }
  }

  pendingGalleriesList.addEventListener("click", async (event) => {
    const approveButton = event.target.closest("[data-photog-approve-gallery]");
    const rejectButton = event.target.closest("[data-photog-reject-gallery]");
    if (!approveButton && !rejectButton) return;
    const galleryId = approveButton ? approveButton.dataset.photogApproveGallery : rejectButton.dataset.photogRejectGallery;
    const status = approveButton ? "published" : "rejected";
    try {
      await api({ action: "update_gallery_status", gallery_id: galleryId, status });
      await renderPendingGalleries();
      showMessage("Gallery " + (approveButton ? "approved." : "rejected."));
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  async function openPhotographer(id) {
    try {
      const data = await api({ action: "detail", id });
      const p = data.photographer;
      currentId = p.id;

      editorTitle.textContent = "Edit " + p.business_name;
      fillForm(coreForm, p);
      coreForm.elements.id.value = p.id;

      childrenSection.hidden = false;
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

      renderBillingReadout(p.subscription || { status: "inactive" });
      complimentaryForm.elements.admin_complimentary_access.checked = Boolean((p.subscription || {}).admin_complimentary_access);
      complimentaryForm.elements.admin_notes.value = (p.subscription || {}).admin_notes || "";
      complimentaryGrantedAt.textContent = (p.subscription || {}).admin_complimentary_granted_at
        ? "Granted " + formatDateShort((p.subscription || {}).admin_complimentary_granted_at)
        : "";

      showMessage("");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function formatDateShort(isoText) {
    const cleaned = String(isoText || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return "--";
    const date = new Date(cleaned + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const BILLING_STATUS_LABELS = {
    inactive: "Inactive", active: "Active", trialing: "Trialing", past_due: "Past due", canceled: "Canceled"
  };
  const BILLING_INTERVAL_LABELS = { monthly: "Monthly ($7.99/mo)", annual: "Annual ($39.99/yr)" };
  const PAYMENT_STATUS_LABELS = { succeeded: "Succeeded", failed: "Failed", pending: "Pending" };

  // Shortened, not hidden -- these are opaque Stripe object ids
  // (cus_.../sub_...), not secret values, but the full id is rarely
  // useful to read at a glance in this list.
  function shortenStripeId(id) {
    if (!id) return "--";
    return id.length > 14 ? id.slice(0, 10) + "..." + id.slice(-4) : id;
  }

  function renderBillingReadout(subscription) {
    const fields = {
      billing_interval: BILLING_INTERVAL_LABELS[subscription.billing_interval] || "Not set",
      status: BILLING_STATUS_LABELS[subscription.status] || subscription.status || "Inactive",
      current_period_start: subscription.current_period_start ? formatDateShort(subscription.current_period_start) : "--",
      current_period_end: subscription.current_period_end ? formatDateShort(subscription.current_period_end) : "--",
      cancel_at_period_end: subscription.cancel_at_period_end ? "Yes" : "No",
      canceled_at: subscription.canceled_at ? formatDateShort(subscription.canceled_at) : "--",
      payment_status: PAYMENT_STATUS_LABELS[subscription.payment_status] || "Unknown",
      stripe_customer_id: shortenStripeId(subscription.stripe_customer_id),
      stripe_subscription_id: shortenStripeId(subscription.stripe_subscription_id)
    };
    for (const [key, value] of Object.entries(fields)) {
      const el = billingReadout.querySelector('[data-field="' + key + '"]');
      if (el) el.textContent = value;
    }
  }

  function resetEditor() {
    currentId = null;
    editorTitle.textContent = "Add a photographer";
    coreForm.reset();
    coreForm.elements.state.value = "OH";
    coreForm.elements.public_visible.checked = true;
    childrenSection.hidden = true;
    for (const box of sportsForm.querySelectorAll("input")) box.checked = false;
    for (const box of areasForm.querySelectorAll("input[type=checkbox]")) box.checked = false;
    areasForm.reset();
    portfolioList.innerHTML = "";
    coverageList.innerHTML = "";
    galleryList.innerHTML = "";
    renderBillingReadout({ status: "inactive" });
    complimentaryForm.reset();
    complimentaryGrantedAt.textContent = "";
  }

  const STORY_STATUS_LABELS = {
    eligible: "Eligible -- awaiting info", info_submitted: "Info submitted -- ready to review",
    in_review: "In review", published: "Published"
  };

  function renderStoryCard(row) {
    const story = row.story || {};
    const photographer = row.photographer || {};
    const images = Array.isArray(story.image_urls) ? story.image_urls : [];
    return (
      '<div class="photog-admin-list-item" style="cursor:default;">' +
        '<span class="photog-admin-badge" data-status="' + (row.partnership_story_status === "published" ? "approved" : "pending_review") + '">' +
          escapeHtml(STORY_STATUS_LABELS[row.partnership_story_status] || row.partnership_story_status) +
        '</span>' +
        '<strong>' + escapeHtml(photographer.business_name || "Unknown photographer") + '</strong>' +
        '<span>Annual member -- ' + images.length + ' image' + (images.length === 1 ? "" : "s") + ' submitted</span>' +
        (story.city_or_area ? '<span>' + escapeHtml(story.city_or_area) + '</span>' : "") +
        (story.biography ? '<span>' + escapeHtml(story.biography.slice(0, 220)) + (story.biography.length > 220 ? "..." : "") + '</span>' : "<span>No info submitted yet.</span>") +
        (story.website_url || story.instagram_url || story.facebook_url
          ? '<span>' + [story.website_url, story.instagram_url, story.facebook_url].filter(Boolean).map((u) => escapeHtml(u)).join(" -- ") + '</span>'
          : "") +
        '<form class="photog-admin-form photog-story-review-form" data-photog-story-review="' + escapeHtml(row.photographer_id) + '" style="margin-top:10px;">' +
          '<div class="photog-admin-fields">' +
            '<label>Status<select name="partnership_story_status">' +
              ['eligible', 'info_submitted', 'in_review', 'published'].map((s) =>
                '<option value="' + s + '"' + (row.partnership_story_status === s ? " selected" : "") + '>' + escapeHtml(STORY_STATUS_LABELS[s]) + '</option>'
              ).join("") +
            '</select></label>' +
            '<label>Published story URL<input type="url" name="published_story_url" value="' + escapeHtml(story.published_story_url || "") + '" placeholder="https://"></label>' +
            '<label class="photog-admin-wide">Admin notes<textarea name="admin_notes">' + escapeHtml(story.admin_notes || "") + '</textarea></label>' +
          '</div>' +
          '<button class="button button-dark" type="submit">Save story status</button>' +
        '</form>' +
      '</div>'
    );
  }

  async function renderStoryQueue() {
    try {
      const data = await api({ action: "list_partnership_stories" });
      const rows = data.stories || [];
      storyQueue.innerHTML = rows.length ? rows.map(renderStoryCard).join("") : "<p>No annual members have become eligible yet.</p>";
    } catch (error) {
      storyQueue.innerHTML = "<p>" + escapeHtml(error.message) + "</p>";
    }
  }

  storyQueue.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-photog-story-review]");
    if (!form) return;
    event.preventDefault();
    const photographerId = form.dataset.photogStoryReview;
    const payload = formPayload(form);
    try {
      await api({ action: "update_partnership_story", id: photographerId, ...payload });
      showMessage("Partnership story updated.");
      await renderStoryQueue();
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  complimentaryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentId) return showMessage("Save the listing before setting complimentary access.", true);
    const payload = formPayload(complimentaryForm);
    try {
      const data = await api({ action: "set_complimentary_access", id: currentId, ...payload });
      complimentaryGrantedAt.textContent = data.subscription.admin_complimentary_granted_at
        ? "Granted " + formatDateShort(data.subscription.admin_complimentary_granted_at)
        : "";
      showMessage("Complimentary access saved.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderList();
  });

  newButton.addEventListener("click", resetEditor);

  listEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-photog-select]");
    if (button) openPhotographer(button.dataset.photogSelect);
  });

  coreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(coreForm);
    try {
      const action = currentId ? "update" : "create";
      const data = await api({ action, id: currentId, ...payload });
      currentId = data.photographer.id;
      showMessage("Listing saved.");
      await renderList();
      await openPhotographer(currentId);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  sportsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentId) return showMessage("Save the listing before setting sports.", true);
    const sports = [...sportsForm.querySelectorAll('input[name="sports"]:checked')].map((el) => el.value);
    try {
      await api({ action: "set_sports", id: currentId, sports });
      showMessage("Sports saved.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  areasForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentId) return showMessage("Save the listing before setting service areas.", true);
    const regions = [...areasForm.querySelectorAll('input[name="regions"]:checked')].map((el) => ({ area_type: "region", area_value: el.value }));
    const counties = String(areasForm.elements.counties.value || "").split(",").map((v) => v.trim()).filter(Boolean).map((v) => ({ area_type: "county", area_value: v }));
    const cities = String(areasForm.elements.cities.value || "").split(",").map((v) => v.trim()).filter(Boolean).map((v) => ({ area_type: "city", area_value: v }));
    try {
      await api({ action: "set_service_areas", id: currentId, service_areas: [...regions, ...counties, ...cities] });
      showMessage("Service areas saved.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  portfolioForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentId) return showMessage("Save the listing before adding portfolio images.", true);
    const payload = formPayload(portfolioForm);
    try {
      await api({ action: "add_portfolio_item", id: currentId, ...payload });
      portfolioForm.reset();
      const data = await api({ action: "detail", id: currentId });
      renderPortfolio(data.photographer.portfolio);
      showMessage("Portfolio image added.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  portfolioList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-photog-remove-portfolio]");
    if (!button) return;
    try {
      await api({ action: "remove_portfolio_item", portfolio_id: button.dataset.photogRemovePortfolio });
      const data = await api({ action: "detail", id: currentId });
      renderPortfolio(data.photographer.portfolio);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  resetEditor();
  renderList();
  renderPendingGalleries();
  renderStoryQueue();
})();
