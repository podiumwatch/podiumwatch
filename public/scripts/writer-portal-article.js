(() => {
  const loadingBox = document.querySelector("[data-writer-article-loading]");
  const root = document.querySelector("[data-writer-article-root]");
  const missing = document.querySelector("[data-writer-article-missing]");
  const categoryEl = document.querySelector("[data-writer-article-category]");
  const titleEl = document.querySelector("[data-writer-article-title]");
  const metaEl = document.querySelector("[data-writer-article-meta]");
  const imageEl = document.querySelector("[data-writer-article-image]");
  const creditEl = document.querySelector("[data-writer-article-credit]");
  const bodyEl = document.querySelector("[data-writer-article-body]");
  const tagsEl = document.querySelector("[data-writer-article-tags]");
  const bylineEl = document.querySelector("[data-writer-article-byline]");
  const storyLinkEl = document.querySelector("[data-writer-article-story-link]");

  if (!loadingBox || !root || !missing) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  async function load() {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      loadingBox.hidden = true;
      missing.hidden = false;
      return;
    }

    try {
      const response = await fetch("/api/portal/public/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_article", slug })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Not found.");

      const article = data.article;
      document.title = article.title + " | Podium Watch";
      categoryEl.textContent = article.category ? titleCase(article.category) : "Podium Watch";
      titleEl.textContent = article.title;
      metaEl.textContent = (article.dek ? article.dek + " — " : "") + "Published " + formatDate(article.published_at);

      // Once a publish successfully syncs to a real Story
      // (lib/writer_portal_service.mjs's publishArticle()), that's the
      // canonical version -- same content, but it also shows up on the
      // homepage, category pages, and search, which this standalone
      // page never will. Points there without hard-redirecting away, so
      // a link someone already has to this exact URL keeps working.
      if (article.synced_story_path) {
        storyLinkEl.innerHTML = `This piece is also live on the homepage: <a href="${escapeHtml(article.synced_story_path)}">Read the full story &rarr;</a>`;
        storyLinkEl.hidden = false;

        const canonical = document.createElement("link");
        canonical.rel = "canonical";
        canonical.href = new URL(article.synced_story_path, window.location.origin).href;
        document.head.appendChild(canonical);
      }

      if (article.featured_image_url) {
        imageEl.src = article.featured_image_url;
        imageEl.alt = article.title;
        imageEl.hidden = false;
      }
      if (article.photo_credit) {
        creditEl.textContent = "Photo: " + article.photo_credit;
        creditEl.hidden = false;
      }

      bodyEl.innerHTML = window.PodiumWriterRender.renderBody(article.body);

      tagsEl.innerHTML = (article.tags || []).map((tag) =>
        `<span class="writer-article-tag">${escapeHtml(tag)}</span>`
      ).join("");

      if (article.author) {
        bylineEl.href = "/writer-portal/authors/?id=" + encodeURIComponent(article.author.id);
        bylineEl.innerHTML = `<strong>${escapeHtml(article.author.full_name || "Podium Watch Writer")}</strong>` +
          (article.author.school ? ` &middot; ${escapeHtml(article.author.school)}` : "");
      } else {
        bylineEl.hidden = true;
      }

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.hidden = true;
      missing.hidden = false;
    }
  }

  load();
})();
