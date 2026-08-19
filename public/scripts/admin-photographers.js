(() => {
  const messageBox = document.querySelector("[data-photog-admin-message]");
  const searchForm = document.querySelector("[data-photog-search-form]");
  const newButton = document.querySelector("[data-photog-new]");
  const listEl = document.querySelector("[data-photog-list]");
  const editorTitle = document.querySelector("[data-photog-editor-title]");
  const coreForm = document.querySelector("[data-photog-core-form]");
  const viewProfileLink = document.querySelector("[data-photog-view-profile]");
  const childrenSection = document.querySelector("[data-photog-children-section]");
  const sportsForm = document.querySelector("[data-photog-sports-form]");
  const areasForm = document.querySelector("[data-photog-areas-form]");
  const portfolioForm = document.querySelector("[data-photog-portfolio-form]");
  const portfolioList = document.querySelector("[data-photog-portfolio-list]");
  const pendingGalleriesList = document.querySelector("[data-photog-pending-galleries]");
  const coverageList = document.querySelector("[data-photog-coverage-list]");
  const galleryList = document.querySelector("[data-photog-gallery-list]");
  const planSelect = document.querySelector("[data-photog-plan-select]");
  const billingForm = document.querySelector("[data-photog-billing-form]");

  const requiredElements = [
    messageBox, searchForm, newButton, listEl, editorTitle, coreForm, viewProfileLink,
    childrenSection, sportsForm, areasForm, portfolioForm, portfolioList,
    pendingGalleriesList, coverageList, galleryList, planSelect, billingForm
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

      viewProfileLink.hidden = false;
      viewProfileLink.href = "/photographers/profile/?slug=" + encodeURIComponent(p.slug);

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

      const subscription = p.subscription || { status: "inactive" };
      billingForm.elements.status.value = subscription.status || "inactive";
      billingForm.elements.current_period_end.value = subscription.current_period_end ? subscription.current_period_end.slice(0, 10) : "";
      billingForm.elements.cancel_at_period_end.checked = Boolean(subscription.cancel_at_period_end);
      billingForm.elements.admin_notes.value = subscription.admin_notes || "";

      showMessage("");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function resetEditor() {
    currentId = null;
    editorTitle.textContent = "Add a photographer";
    coreForm.reset();
    coreForm.elements.state.value = "OH";
    coreForm.elements.public_visible.checked = true;
    viewProfileLink.hidden = true;
    childrenSection.hidden = true;
    for (const box of sportsForm.querySelectorAll("input")) box.checked = false;
    for (const box of areasForm.querySelectorAll("input[type=checkbox]")) box.checked = false;
    areasForm.reset();
    portfolioList.innerHTML = "";
    coverageList.innerHTML = "";
    galleryList.innerHTML = "";
    billingForm.reset();
  }

  async function loadPlans() {
    try {
      const data = await api({ action: "list_plans" });
      const plans = data.plans || [];
      planSelect.innerHTML = '<option value="">No plan</option>' + plans
        .map((plan) => '<option value="' + escapeHtml(plan.id) + '">' + escapeHtml(plan.name) + (plan.active ? "" : " (inactive)") + "</option>")
        .join("");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  billingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentId) return showMessage("Save the listing before setting billing status.", true);
    const payload = formPayload(billingForm);
    try {
      await api({ action: "set_subscription", id: currentId, ...payload });
      showMessage("Billing status saved.");
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
  loadPlans();
  renderList();
  renderPendingGalleries();
})();
