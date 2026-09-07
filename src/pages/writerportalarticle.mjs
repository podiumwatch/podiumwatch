import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-article-shell { display:grid; gap:20px; max-width: 760px; margin: 0 auto; }
    .writer-article-meta { color: var(--muted); font-weight: 700; }
    .writer-article-image { width: 100%; border-radius: 12px; }
    .writer-article-credit { font-size: .78rem; color: var(--muted); }
    .writer-article-body { line-height: 1.7; font-size: 1.05rem; }
    .writer-article-body img { max-width: 100%; border-radius: 8px; }
    .writer-article-body blockquote { border-left: 3px solid var(--green); margin: 0; padding-left: 16px; color: var(--muted); }
    .writer-article-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .writer-article-tag { padding: 4px 10px; border-radius: 999px; background: rgba(var(--green-rgb),.14); font-size: .76rem; font-weight: 800; }
    .writer-article-byline { display:flex; align-items:center; gap:10px; padding: 14px; border: 1px solid rgba(var(--black-rgb),.12); border-radius: 10px; }
`;

// Generic, data-driven shell (like /athlete/, /recruiting/top-250/*) --
// one static page, the actual published article fetched client-side by
// ?slug=, so a new publish is visible immediately with no rebuild.
export function writerPortalArticlePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch",
    title: "Loading article...",
    description: ""
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-article-shell" data-writer-article-loading>
      <div class="info-card"><h2>Loading</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-article-shell" data-writer-article-root hidden>
      <p class="eyebrow" data-writer-article-category></p>
      <h1 data-writer-article-title></h1>
      <p class="writer-article-meta" data-writer-article-meta></p>
      <img class="writer-article-image" data-writer-article-image alt="" hidden>
      <p class="writer-article-credit" data-writer-article-credit hidden></p>
      <div class="writer-article-body" data-writer-article-body></div>
      <div class="writer-article-tags" data-writer-article-tags></div>
      <a class="writer-article-byline" data-writer-article-byline href="/writer-portal/authors/"></a>
    </div>

    <div class="container writer-article-shell" data-writer-article-missing hidden>
      <div class="info-card"><h2>Article not found</h2><p>This article may have been unpublished or the link is incorrect.</p></div>
    </div>
  </section>

  <script src="/scripts/writer-portal-render.js" defer></script>
  <script src="/scripts/writer-portal-article.js" defer></script>`;

  return layout({
    site,
    title: "Article",
    description: "A Podium Watch Writer Portal article.",
    pathname: "/writer-portal/articles/",
    content
  });
}
