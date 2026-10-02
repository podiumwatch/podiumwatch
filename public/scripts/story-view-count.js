// Fetches and displays the real view count for this article, reading the
// same slug story-view.js already writes to. Fails silently (element stays
// hidden) if the request errors -- a missing count is not worth showing an
// error state for on a public article page.
(() => {
  const el = document.querySelector("[data-story-view-count]");
  const shell = document.querySelector("[data-story-slug]");
  if (!el || !shell) return;
  const slug = shell.getAttribute("data-story-slug");
  if (!slug) return;

  fetch(`/api/stories/view-count/?slug=${encodeURIComponent(slug)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || typeof data.views !== "number") return;
      const label = data.views === 1 ? "view" : "views";
      el.textContent = `${data.views.toLocaleString()} ${label}`;
      el.hidden = false;
    })
    .catch(() => {});
})();
