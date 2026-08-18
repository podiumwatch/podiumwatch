(() => {
  const loadingBox = document.querySelector("[data-photog-loading]");
  const messageBox = document.querySelector("[data-photog-message]");
  const root = document.querySelector("[data-photog-root]");
  const imageEl = document.querySelector("[data-photog-image]");
  const badgesEl = document.querySelector("[data-photog-badges]");
  const nameEl = document.querySelector("[data-photog-name]");
  const locationEl = document.querySelector("[data-photog-location]");
  const sportsEl = document.querySelector("[data-photog-sports]");
  const aboutSection = document.querySelector("[data-photog-about-section]");
  const aboutEl = document.querySelector("[data-photog-about]");
  const portfolioEl = document.querySelector("[data-photog-portfolio]");
  const portfolioEmpty = document.querySelector("[data-photog-portfolio-empty]");
  const linksEl = document.querySelector("[data-photog-links]");

  const requiredElements = [
    loadingBox, messageBox, root, imageEl, badgesEl, nameEl, locationEl,
    sportsEl, aboutSection, aboutEl, portfolioEl, portfolioEmpty, linksEl
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const slug = String(params.get("slug") || "").trim();

  const SPORT_LABELS = {
    cross_country: "Cross Country", track_and_field: "Track and Field", football: "Football",
    soccer: "Soccer", basketball: "Basketball", volleyball: "Volleyball", wrestling: "Wrestling",
    swimming: "Swimming", baseball: "Baseball", softball: "Softball", lacrosse: "Lacrosse",
    golf: "Golf", tennis: "Tennis", cheer: "Cheer", gymnastics: "Gymnastics", other: "Other"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text) {
    loadingBox.hidden = true;
    root.hidden = true;
    messageBox.hidden = !text;
    messageBox.innerHTML = text
      ? '<div class="info-card"><h2>Photographer not found</h2><p>' + escapeHtml(text) + '</p><p><a class="button button-primary" href="/photographers/">Back to Find a Photographer</a></p></div>'
      : "";
  }

  function render(p) {
    document.title = p.business_name + " | Podium Watch Photographer Network";

    if (p.profile_image_url) {
      imageEl.src = p.profile_image_url;
      imageEl.alt = p.business_name;
      imageEl.hidden = false;
    }

    const badges = [];
    if (p.featured) badges.push('<span class="photog-badge photog-badge-featured">Featured Photographer</span>');
    if (p.founding_photographer) badges.push('<span class="photog-badge photog-badge-founding">Founding Photographer</span>');
    if (p.verification_status === "verified") badges.push('<span class="photog-badge photog-badge-verified">Verified Photographer</span>');
    badgesEl.innerHTML = badges.join("");

    nameEl.textContent = p.photographer_name ? p.business_name + " -- " + p.photographer_name : p.business_name;

    const areas = p.statewide_travel
      ? "Statewide travel available"
      : (p.service_areas || []).map((a) => a.area_value).join(", ") || "";
    locationEl.textContent = [p.city, p.state].filter(Boolean).join(", ") + (areas ? " · " + areas : "");

    sportsEl.innerHTML = (p.sports || [])
      .map((s) => '<span class="photog-tag">' + escapeHtml(SPORT_LABELS[s] || s) + "</span>")
      .join("");

    if (p.about) {
      aboutSection.hidden = false;
      aboutEl.textContent = p.about;
    }

    const portfolio = p.portfolio || [];
    if (portfolio.length === 0) {
      portfolioEmpty.hidden = false;
    } else {
      portfolioEl.innerHTML = portfolio
        .map((item) => '<img src="' + escapeHtml(item.image_url) + '" alt="' + escapeHtml(item.caption || p.business_name + " portfolio image") + '" loading="lazy">')
        .join("");
    }

    const links = [];
    if (p.website_url) links.push('<a class="button button-outline" href="' + escapeHtml(p.website_url) + '" target="_blank" rel="noopener noreferrer">Website</a>');
    if (p.instagram_url) links.push('<a class="button button-outline" href="' + escapeHtml(p.instagram_url) + '" target="_blank" rel="noopener noreferrer">Instagram</a>');
    if (p.facebook_url) links.push('<a class="button button-outline" href="' + escapeHtml(p.facebook_url) + '" target="_blank" rel="noopener noreferrer">Facebook</a>');
    if (p.business_email) links.push('<a class="button button-outline" href="mailto:' + escapeHtml(p.business_email) + '">Email</a>');
    if (p.business_phone) links.push('<a class="button button-outline" href="tel:' + escapeHtml(p.business_phone) + '">' + escapeHtml(p.business_phone) + "</a>");
    linksEl.innerHTML = links.join("") || "<p>No public contact information listed yet.</p>";

    loadingBox.hidden = true;
    messageBox.hidden = true;
    root.hidden = false;
  }

  if (!slug) {
    showMessage("This link is missing a photographer address.");
    return;
  }

  fetch("/api/photographers/detail/", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ slug })
  })
    .then((response) => response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || "This photographer could not be loaded.");
      return data;
    }))
    .then((data) => render(data.photographer))
    .catch((error) => showMessage(error.message || "This photographer could not be loaded."));
})();
