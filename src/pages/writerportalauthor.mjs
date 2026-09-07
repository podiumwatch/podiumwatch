import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-author-shell { display:grid; gap:20px; max-width: 760px; margin: 0 auto; }
    .writer-author-bio { color: var(--muted); }
    .writer-author-list { display:grid; gap:12px; }
    .writer-author-card { display:block; padding: 16px; border: 1px solid rgba(var(--black-rgb),.12); border-radius: 10px; color: inherit; text-decoration: none; }
    .writer-author-card:hover { border-color: var(--green); background: rgba(var(--green-rgb),.06); }
    .writer-author-card p { margin: 4px 0 0; color: var(--muted); }
`;

// Generic shell, data-driven by ?id= -- same pattern as
// writerportalarticle.mjs.
export function writerPortalAuthorPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer",
    title: "Loading author...",
    description: ""
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-author-shell" data-writer-author-loading>
      <div class="info-card"><h2>Loading</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-author-shell" data-writer-author-root hidden>
      <section class="info-card">
        <h1 data-writer-author-name></h1>
        <p class="writer-author-bio" data-writer-author-school></p>
        <p class="writer-author-bio" data-writer-author-bio></p>
      </section>

      <div>
        <h2>Published articles</h2>
        <div class="writer-author-list" data-writer-author-articles></div>
        <p data-writer-author-empty hidden>No published articles yet.</p>
      </div>
    </div>

    <div class="container writer-author-shell" data-writer-author-missing hidden>
      <div class="info-card"><h2>Author not found</h2></div>
    </div>
  </section>

  <script src="/scripts/writer-portal-author.js" defer></script>`;

  return layout({
    site,
    title: "Writer",
    description: "A Podium Watch Writer Portal author page.",
    pathname: "/writer-portal/authors/",
    content
  });
}
