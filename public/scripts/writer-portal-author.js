(() => {
  const loadingBox = document.querySelector("[data-writer-author-loading]");
  const root = document.querySelector("[data-writer-author-root]");
  const missing = document.querySelector("[data-writer-author-missing]");
  const nameEl = document.querySelector("[data-writer-author-name]");
  const schoolEl = document.querySelector("[data-writer-author-school]");
  const bioEl = document.querySelector("[data-writer-author-bio]");
  const articlesEl = document.querySelector("[data-writer-author-articles]");
  const emptyEl = document.querySelector("[data-writer-author-empty]");

  if (!loadingBox || !root || !missing) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  async function load() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      loadingBox.hidden = true;
      missing.hidden = false;
      return;
    }

    try {
      const response = await fetch("/api/portal/public/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_author", profile_id: id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Not found.");

      const { profile, articles } = data;
      document.title = (profile.full_name || "Podium Watch Writer") + " | Podium Watch";
      nameEl.textContent = profile.full_name || "Podium Watch Writer";
      if (profile.school) schoolEl.textContent = profile.school;
      if (profile.bio) bioEl.textContent = profile.bio;

      articlesEl.innerHTML = articles.map((article) =>
        `<a class="writer-author-card" href="/writer-portal/articles/?slug=${encodeURIComponent(article.slug)}">
          <strong>${escapeHtml(article.title)}</strong>
          <p>${escapeHtml(article.dek || "")}${article.dek ? " — " : ""}${escapeHtml(formatDate(article.published_at))}</p>
        </a>`
      ).join("");
      emptyEl.hidden = articles.length > 0;

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.hidden = true;
      missing.hidden = false;
    }
  }

  load();
})();
