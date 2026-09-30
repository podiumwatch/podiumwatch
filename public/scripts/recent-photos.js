// Populates any [data-recent-photos-grid] container from the public
// /api/photos/recent endpoint. Used on the homepage (a small preview) and
// on /photos/ (the full gallery) -- same markup, different limit via
// data-photos-limit. The containing section (if it has
// [data-recent-photos-section]) starts hidden and is only revealed once
// real photos exist, so an empty feature never shows a bare, awkward
// section on the homepage.
(() => {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  }

  function photoCard(photo) {
    const caption = [photo.meet_name, formatDate(photo.meet_date)].filter(Boolean).join(" &middot; ");
    return `<figure class="photo-card">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.meet_name || "Meet photo")}" loading="lazy">
      <figcaption>
        ${caption ? `<span class="photo-card-meet">${caption}</span>` : ""}
        ${photo.credit_name ? `<span class="photo-card-credit">Photo: ${escapeHtml(photo.credit_name)}</span>` : ""}
      </figcaption>
    </figure>`;
  }

  document.querySelectorAll("[data-recent-photos-grid]").forEach(async (grid) => {
    const limit = grid.dataset.photosLimit || "12";
    const section = grid.closest("[data-recent-photos-section]");

    try {
      const response = await fetch(`/api/photos/recent/?limit=${encodeURIComponent(limit)}`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      const photos = response.ok ? (data.photos || []) : [];

      if (!photos.length) {
        if (section) section.hidden = true;
        else grid.innerHTML = '<p class="empty-state-inline">No photos have been shared yet. <a href="/submit-photos/">Be the first to send one.</a></p>';
        return;
      }

      grid.innerHTML = photos.map(photoCard).join("");
      if (section) section.hidden = false;
    } catch {
      if (section) section.hidden = true;
    }
  });
})();
