import { escapeHtml } from "../../src/lib/content.mjs";
import { breadcrumb, layout } from "../../src/lib/html.mjs";
import { WRAPPED_MIN_RACES, ordinal } from "../../src/lib/wrapped.mjs";
import { merchCardHtml, merchEnabled, merchScripts, merchStyles } from "../../src/lib/merch_card.mjs";

// /wrapped/2026/{slug}/ (WO-36): the runner's Wrapped card, the Story and
// post images to download, every fact as text, a "Missing races?" link,
// and the Podium Watch Store card (clicks at /go/merch/wrapped/).

const e = escapeHtml;
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "OHSAA ").replace(/\s*\(HS\)\s*$/, "");
const dateLabel = (iso) => { const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
export const wrappedPath = (slug) => `/wrapped/2026/${slug}/`;
const missingHref = (w) => `/submit-results/?${new URLSearchParams({ ...(w.school ? { team: w.school } : {}), sport: "cross_country", season: "2026" }).toString()}`;

const styles = `<style>
  .wr { --wr-accent:#0faf68; background:var(--paper); padding-block:24px 48px; }
  .wr.is-girls { --wr-accent:#ec4899; }
  .wr-grid { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:24px; align-items:start; }
  .wr-preview img { width:100%; height:auto; aspect-ratio:1080 / 1350; display:block; border-radius:14px; background:#090909; }
  .wr-side { display:grid; gap:16px; }
  .wr-pill { justify-self:start; background:var(--wr-accent); color:#fff; font-weight:900; font-size:.75rem; letter-spacing:1.5px; padding:5px 12px; border-radius:999px; }
  .wr h1 { margin:0; font-size:clamp(2rem, 7vw, 3.2rem); line-height:.95; }
  .wr-school { margin:0; color:var(--muted); font-weight:750; }
  .wr-facts { margin:0; display:grid; gap:0; background:#fff; border:1px solid var(--line); border-radius:14px; }
  .wr-facts div { display:grid; grid-template-columns:minmax(0, 40%) minmax(0, 1fr); gap:10px; padding:10px 14px; border-bottom:1px solid var(--line); }
  .wr-facts div:last-child { border-bottom:0; }
  .wr-facts dt { font-weight:850; font-size:.84rem; color:var(--muted); }
  .wr-facts dd { margin:0; font-weight:700; font-variant-numeric:tabular-nums; }
  .wr-note { font-size:.82rem; color:var(--muted); margin:0; }
  .wr-actions { display:flex; flex-wrap:wrap; gap:10px; }
  .wr-actions .button { flex:1 1 auto; justify-content:center; }
  .wr-share { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:.85rem; }
  .wr-share code { background:#fff; border:1px solid var(--line); padding:6px 8px; border-radius:8px; overflow-wrap:anywhere; }
  .wr-share button { padding:6px 12px; border:1px solid var(--line); border-radius:999px; background:#fff; font:inherit; font-weight:800; cursor:pointer; }
  .wr-empty { background:#fff; border:1px solid var(--line); border-radius:14px; padding:24px; text-align:center; display:grid; gap:12px; justify-items:center; }
  .wr-store { margin-top:24px; }
  @media (max-width:760px) { .wr-grid { grid-template-columns:1fr; } }
  ${merchStyles}
</style>`;

function factsList(w) {
  const rows = [["Races run", `${w.races} in 2026`]];
  if (w.best) rows.push(["Season best", `${w.best.mark}, ${meetShort(w.best.meet)}${w.best.date ? ` (${dateLabel(w.best.date)})` : ""}`]);
  if (w.drop_text) rows.push(["First race on Podium Watch to season best", `${w.first.mark} (${meetShort(w.first.meet)}) to ${w.best.mark}: ${w.drop_text} faster. Different courses.`]);
  else if (w.first_is_best) rows.push(["First race on Podium Watch", "The season best came in the first race on Podium Watch."]);
  if (w.best_place) rows.push(["Best place", `${w.best_place.place_text}, ${meetShort(w.best_place.meet)}`]);
  if (w.postseason?.length) rows.push(["Postseason", w.postseason.map((p) => `${p.label} ${p.place ? ordinal(p.place) : "ran"}${p.mark ? ` (${p.mark})` : ""}`).join(", ") + (w.postseason.at(-1).division ? `, ${w.postseason.at(-1).division}` : "")]);
  if (w.all_ohio) rows.push(["All-Ohio", w.all_ohio]);
  if (w.rank_division) rows.push(["Division rank", w.rank_division.text]);
  if (w.rank_grade) rows.push(["Class rank", w.rank_grade.text]);
  return `<dl class="wr-facts">${rows.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl>`;
}

export function wrappedPageHtml(site, w, { preview = false, launchAt = null } = {}) {
  const pathname = wrappedPath(w.slug);
  const crumbs = breadcrumb([{ label: "Home", href: "/" }, { label: "Wrapped", href: "/wrapped/" }, { label: w.name }]);
  const img = (size) => `/api/og/wrapped/?slug=${encodeURIComponent(w.slug)}&size=${size}`;
  let body;
  if (!w.eligible) {
    body = `<div class="wr-empty"><span class="wr-pill">Podium Watch Wrapped 2026</span><h1>${e(w.name)}</h1>${w.school ? `<p class="wr-school">${e(w.school)}</p>` : ""}
      <p>Wrapped needs at least ${WRAPPED_MIN_RACES} public 2026 cross country results. Podium Watch has ${w.races} for ${e(w.name)}.</p>
      <a class="button button-primary" href="${e(missingHref(w))}">Missing races? Send the results</a></div>`;
  } else {
    body = `<div class="wr-grid">
      <div class="wr-preview"><img src="${img("post")}" alt="${e(`${w.name}'s 2026 Podium Watch Wrapped card`)}" width="1080" height="1350" fetchpriority="high"></div>
      <div class="wr-side">
        <span class="wr-pill">Podium Watch Wrapped 2026</span>
        <h1>${e(w.name)}</h1>
        ${w.school ? `<p class="wr-school">${e(w.school)}</p>` : ""}
        <div class="wr-actions"><a class="button button-primary" href="${img("story")}&amp;download=1" download>Download Story (1080x1920)</a><a class="button button-outline" href="${img("post")}&amp;download=1" download>Download post (1080x1350)</a></div>
        ${factsList(w)}
        <p class="wr-note">From official results on Podium Watch. Ranks are from the State Leaders list (each runner's fastest 5K). Courses differ from meet to meet.</p>
        <p><a href="${e(missingHref(w))}">Missing races? Send the results</a> &middot; <a href="/athletes/${e(w.slug)}/">Full profile</a></p>
        <div class="wr-share"><span>Share:</span><code data-wr-url>${e(`${site.siteUrl}${pathname}`)}</code><button type="button" data-wr-copy>Copy link</button></div>
      </div>
    </div>`;
  }
  const store = merchEnabled() ? `<div class="wr-store">${merchCardHtml({ placement: "wrapped", from: pathname })}</div>
  ${merchScripts()}` : "";
  const banner = preview ? `<p class="wr-note" style="background:#fff3cd;padding:8px 12px;border-radius:8px">Admin preview. Wrapped is not public yet${launchAt ? `; it launches ${e(new Date(launchAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }))} ET` : "; no launch date is set"}.</p>` : "";
  const content = `${styles}<div class="wr${w.gender === "girls" ? " is-girls" : ""}"><div class="container">${crumbs}${banner}${body}${store}</div></div>
  <script>(() => { const b = document.querySelector("[data-wr-copy]"); if (!b) return; b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(document.querySelector("[data-wr-url]").textContent); b.textContent = "Copied"; } catch { b.textContent = "Copy failed"; } }); })();</script>`;
  return layout({
    site,
    title: `${w.name} 2026 Wrapped`,
    description: `${w.name}'s 2026 Ohio cross country season on Podium Watch: races, season best, postseason and ranks.`,
    pathname,
    content,
    robots: "noindex, follow",
    image: w.eligible ? `${site.siteUrl}${img("post")}` : undefined,
    imageWidth: 1080,
    imageHeight: 1350
  });
}

// Before the launch date (visitors who aren't admins).
export function wrappedSoonHtml(site, { pathname = "/wrapped/", launchAt = null } = {}) {
  const when = launchAt ? new Date(launchAt).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }) : null;
  const content = `${styles}<div class="wr"><div class="container"><div class="wr-empty"><span class="wr-pill">Podium Watch Wrapped 2026</span><h1>Your 2026 season, wrapped</h1><p>${when ? `Coming ${e(when)}.` : "Coming soon."} Every Ohio cross country runner with at least ${WRAPPED_MIN_RACES} races on Podium Watch gets a free share card.</p><a class="button button-primary" href="/submit-results/">Missing races? Send the results</a></div></div></div>`;
  return layout({ site, title: "Podium Watch Wrapped 2026", description: "Free 2026 season share cards for Ohio cross country runners.", pathname, content, robots: "noindex, follow" });
}
