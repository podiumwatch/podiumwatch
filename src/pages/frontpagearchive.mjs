import { escapeHtml } from "../lib/content.mjs";
import { breadcrumb, layout, pageHero } from "../lib/html.mjs";

// /front-page/ (WO-43): every story that led the Podium Watch homepage,
// newest first, with the real dates it ran. Rendered on the server by
// api/pages/front-page.js.

const styles = `
  .fp-shell { display:grid; gap:18px; max-width:880px; margin:0 auto; }
  .fp-list { display:grid; gap:12px; margin:0; padding:0; list-style:none; }
  .fp-item { display:grid; grid-template-columns:200px 1fr; gap:16px; padding:12px; border:1px solid var(--line); background:var(--white); }
  .fp-item.is-current { border-left:5px solid var(--green); }
  .fp-item img, .fp-type { width:100%; aspect-ratio:16 / 10; object-fit:cover; display:block; }
  .fp-type { display:flex; align-items:center; padding:12px; background:var(--black, #090909); color:var(--white); font-family:Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; text-transform:uppercase; line-height:1.05; font-size:1rem; box-sizing:border-box; }
  .fp-item h2 { margin:4px 0; font-size:1.25rem; }
  .fp-item h2 a { color:inherit; }
  .fp-dates { margin:0; color:var(--green-dark); font-weight:850; font-size:.86rem; letter-spacing:.04em; text-transform:uppercase; }
  .fp-item p { margin:0; }
  .fp-note { color:var(--muted); font-weight:650; font-size:.88rem; }
  @media (max-width:560px) { .fp-item { grid-template-columns:1fr; } }
`;

export function frontPageArchivePage(site, entries) {
  const pathname = "/front-page/";
  const items = entries.length
    ? entries.map((entry) => `<li class="fp-item${entry.current ? " is-current" : ""}">
        <a href="${escapeHtml(entry.href)}" aria-hidden="true" tabindex="-1">${entry.image_url ? `<img src="${escapeHtml(entry.image_url)}" alt="" loading="lazy" width="400" height="250">` : `<span class="fp-type">${escapeHtml(entry.title)}</span>`}</a>
        <div>
          <p class="fp-dates">${entry.current ? "On the front page now &middot; since " : ""}${escapeHtml(entry.current ? entry.label.replace(/ to now$/, "") : entry.label)}</p>
          <h2><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a></h2>
          ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}
          ${entry.image_credit ? `<p class="fp-note">Photo: ${escapeHtml(entry.image_credit)}</p>` : ""}
        </div>
      </li>`).join("")
    : `<li class="fp-note">No lead stories yet. The homepage leads with the newest story until one is chosen.</li>`;
  const content = `<style>${styles}</style>
  ${pageHero({ eyebrow: "Podium Watch", title: "On the Front Page", description: "Every story that led the Podium Watch homepage, with the dates it ran." })}
  <section class="section section-paper"><div class="container fp-shell">
    ${breadcrumb([{ label: "Home", href: "/" }, { label: "On the Front Page" }])}
    <ol class="fp-list">${items}</ol>
    <p class="fp-note">Dates are Eastern time. <a href="/front">podiumwatch.org/front</a> always goes to today's lead story.</p>
  </div></section>`;
  return layout({ site, title: "On the Front Page: Podium Watch Lead Stories", description: "Every story that led the Podium Watch homepage, with the dates it ran on the front page.", pathname, content });
}
