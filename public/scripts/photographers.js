(() => {
  const form = document.querySelector("[data-photog-search-form]");
  const clearButton = document.querySelector("[data-photog-clear]");
  const statusBox = document.querySelector("[data-photog-status]");
  const countEl = document.querySelector("[data-photog-count]");
  const resultsEl = document.querySelector("[data-photog-results]");
  const emptyBox = document.querySelector("[data-photog-empty]");
  const emptyMessage = document.querySelector("[data-photog-empty-message]");

  const requiredElements = [form, clearButton, statusBox, countEl, resultsEl, emptyBox, emptyMessage];
  if (requiredElements.some((el) => !el)) return;

  const SPORT_LABELS = Object.fromEntries(
    [...form.querySelectorAll('select[name="sport"] option')].map((o) => [o.value, o.textContent])
  );

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showStatus(text) {
    statusBox.textContent = text;
    statusBox.hidden = !text;
  }

  function badgeRow(p) {
    const badges = [];
    if (p.featured) badges.push('<span class="photog-badge photog-badge-featured">Featured Photographer</span>');
    if (p.founding_photographer) badges.push('<span class="photog-badge photog-badge-founding">Founding Photographer</span>');
    if (p.verification_status === "verified") badges.push('<span class="photog-badge photog-badge-verified">Verified Photographer</span>');
    return badges.length ? '<div class="photog-card-badges">' + badges.join("") + "</div>" : "";
  }

  function serviceAreaText(p) {
    if (p.statewide_travel) return "Statewide travel available";
    const areas = (p.service_areas || []).map((a) => a.area_value);
    return areas.length ? "Serving " + areas.join(", ") : "Service area not listed";
  }

  function renderCard(p) {
    const sportsTags = (p.sports || [])
      .map((s) => '<span class="photog-tag">' + escapeHtml(SPORT_LABELS[s] || s) + "</span>")
      .join("");
    const image = p.profile_image_url
      ? '<img class="photog-card-image" src="' + escapeHtml(p.profile_image_url) + '" alt="' + escapeHtml(p.business_name) + '" loading="lazy">'
      : "";

    return (
      '<article class="photog-card">' +
        image +
        badgeRow(p) +
        "<h3>" + escapeHtml(p.business_name) + "</h3>" +
        '<p class="photog-card-meta">' + escapeHtml(serviceAreaText(p)) + "</p>" +
        (sportsTags ? '<div class="photog-card-sports">' + sportsTags + "</div>" : "") +
        (p.short_description ? "<p>" + escapeHtml(p.short_description) + "</p>" : "") +
        '<div class="photog-card-links">' +
          '<a class="button button-primary" href="/photographers/profile/?slug=' + encodeURIComponent(p.slug) + '">View Profile</a>' +
        "</div>" +
      "</article>"
    );
  }

  async function search(params) {
    showStatus("Searching...");
    try {
      const response = await fetch("/api/photographers/", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The photographer search could not be completed.");

      const photographers = data.photographers || [];
      countEl.textContent = data.total ?? photographers.length;

      if (data.school_not_found) {
        resultsEl.innerHTML = "";
        emptyBox.hidden = false;
        emptyMessage.textContent = 'We could not find a school matching "' + params.school + '." Try just the school name, without "high school."';
      } else if (photographers.length === 0) {
        resultsEl.innerHTML = "";
        emptyBox.hidden = false;
        emptyMessage.textContent = data.resolved_school
          ? "No photographers currently serve " + data.resolved_school.school_name + ". Try expanding your search."
          : "Try a different school, city, region, or sport.";
      } else {
        emptyBox.hidden = true;
        resultsEl.innerHTML = photographers.map(renderCard).join("");
      }

      showStatus("");
    } catch (error) {
      showStatus(error.message || "The photographer search could not be completed.");
    }
  }

  function currentParams() {
    const formData = new FormData(form);
    return {
      school: String(formData.get("school") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      region: String(formData.get("region") || "").trim(),
      sport: String(formData.get("sport") || "").trim()
    };
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    search(currentParams());
  });

  clearButton.addEventListener("click", () => {
    form.reset();
    search({});
  });

  search({});
})();
