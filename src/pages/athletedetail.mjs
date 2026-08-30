import { escapeHtml } from "../lib/content.mjs";
import { breadcrumb, breadcrumbsJsonLd, layout, pageHero } from "../lib/html.mjs";

function jsonForScript(value) {
  return JSON.stringify(value || null).replaceAll("<", "\\u003c");
}

export function athleteDetailPage(site, { seed = null, pathname = "/athlete/" } = {}) {
  const title = seed?.display_name || "Athlete Profile";
  const schoolName = seed?.official_school_name || seed?.school_name || "Ohio high school";
  const description = seed
    ? `${seed.display_name} athlete profile for ${schoolName}. View Podium Watch ranking context, source labels, and available performance information.`
    : "View a Podium Watch Ohio high school athlete profile with school, rankings, source labels, performance history, stories, and recruiting information when approved.";
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Athletes", href: "/athletes/" },
    { label: title }
  ];
  const jsonLd = seed ? [
    breadcrumbsJsonLd(site, crumbs),
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: seed.display_name,
      affiliation: schoolName,
      url: new URL(pathname, site.siteUrl).toString(),
      description
    }
  ] : breadcrumbsJsonLd(site, crumbs);

  const content = `${pageHero({
    eyebrow: "Podium Watch athlete profile",
    title,
    description: seed
      ? `${schoolName} | Class of ${seed.graduation_year}`
      : "Rankings, verified performances, stories, team connections, and approved recruiting information.",
    compact: true
  })}

  <style>
    .athlete-profile-shell { display:grid; gap:24px; }
    .athlete-profile-message { margin:0; padding:14px 17px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:800; }
    .athlete-profile-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .athlete-profile-message[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.16); }
    .athlete-profile-top { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr); gap:22px; }
    .athlete-profile-identity { display:grid; grid-template-columns:auto minmax(0,1fr); gap:19px; align-items:start; }
    .athlete-profile-photo { width:112px; height:112px; border-radius:18px; object-fit:cover; background:#111827; }
    .athlete-profile-placeholder { display:grid; place-items:center; width:112px; height:112px; border-radius:18px; background:#111827; color:#fff; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:2.2rem; }
    .athlete-profile-identity h2, .athlete-profile-identity p { margin-bottom:0; }
    .athlete-profile-badges { display:flex; flex-wrap:wrap; gap:8px; margin-top:11px; }
    .athlete-profile-badge { display:inline-flex; padding:6px 10px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.76rem; font-weight:900; }
    .athlete-profile-badge[data-tone="editorial"] { color:#7c4a03; background:rgba(245,158,11,.18); }
    .athlete-profile-badge[data-tone="muted"] { color:#475569; background:#e2e8f0; }
    .athlete-profile-badge[data-tone="warning"] { color:#7c4a03; background:rgba(245,158,11,.18); }
    .athlete-profile-badge[data-tone="disputed"] { color:#991b1b; background:rgba(220,38,38,.14); }
    .athlete-profile-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; margin-top:18px; }
    .athlete-profile-fact { padding:12px; border-radius:11px; background:#f8fafc; }
    .athlete-profile-fact span { display:block; color:#64748b; font-size:.72rem; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
    .athlete-profile-fact strong { display:block; margin-top:4px; }
    .athlete-profile-source { border-left:6px solid #00bf63; }
    .athlete-profile-source h2, .athlete-profile-source p { margin-bottom:0; }
    .athlete-recruit-rating-panel { display:grid; gap:18px; border-top:7px solid #111; }
    .athlete-recruit-rating-top { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:18px; align-items:center; }
    .athlete-recruit-score { display:grid; place-items:center; width:86px; height:86px; border-radius:50%; background:#111; color:#fff; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:2.15rem; }
    .athlete-recruit-stars { color:#e6a700; font-size:1.35rem; letter-spacing:.04em; white-space:nowrap; }
    .athlete-recruit-stars span[data-empty="true"] { color:#d7dce3; }
    .athlete-recruit-ranks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .athlete-recruit-ranks div { padding:11px; border-radius:10px; background:#f8fafc; }
    .athlete-recruit-ranks span { display:block; color:#64748b; font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .athlete-recruit-ranks strong { display:block; margin-top:4px; }
    .athlete-recruit-warning { padding:12px; border-left:4px solid #e6a700; background:#fff8db; font-size:.9rem; }
    .athlete-profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px; }
    .athlete-profile-panel { display:grid; gap:15px; }
    .athlete-profile-panel h2, .athlete-profile-panel p { margin-bottom:0; }
    .athlete-profile-list { display:grid; gap:12px; }
    .athlete-profile-entry { display:grid; gap:7px; padding:15px; border:1px solid rgba(15,23,42,.1); border-radius:12px; background:#fff; }
    .athlete-profile-entry h3, .athlete-profile-entry p { margin:0; }
    .athlete-profile-entry-top { display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px; }
    .athlete-profile-entry-meta { color:#64748b; font-size:.88rem; font-weight:750; }
    .athlete-profile-empty { padding:20px; border:1px dashed rgba(15,23,42,.24); border-radius:12px; background:#fff; }
    .athlete-correction-form { display:grid; gap:14px; }
    .athlete-correction-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .athlete-correction-form label { display:grid; gap:7px; font-weight:850; }
    .athlete-correction-form input, .athlete-correction-form select, .athlete-correction-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .athlete-correction-form textarea { min-height:130px; resize:vertical; }
    .athlete-correction-wide { grid-column:1 / -1; }
    .athlete-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .athlete-path-panel { grid-column: 1 / -1; }
    .athlete-path-team { margin:0; font-weight:850; }
    .athlete-path-note { margin:0; padding:12px 14px; border-left:5px solid #e6a700; background:#fff8db; font-size:.9rem; font-weight:750; }
    .athlete-profile-wide { grid-column: 1 / -1; }
    .athlete-meet-card h3 { margin:0 0 6px; font-size:1.05rem; }
    .athlete-meet-card p { margin:0; color:var(--muted); }
    .athlete-sport-group { margin-top:22px; }
    .athlete-sport-group:first-child { margin-top:0; }
    .athlete-sport-group h3 { margin:0 0 4px; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.15rem; letter-spacing:.03em; text-transform:uppercase; }
    .athlete-season-group h4 { margin:14px 0 6px; color:var(--muted); font-size:.85rem; font-weight:800; text-transform:uppercase; letter-spacing:.03em; }
    @media (max-width:850px) { .athlete-profile-top, .athlete-profile-grid { grid-template-columns:1fr; } .athlete-recruit-rating-top { grid-template-columns:1fr; } .athlete-recruit-score { width:72px; height:72px; } }
    @media (max-width:600px) { .athlete-profile-identity { grid-template-columns:1fr; } .athlete-profile-facts, .athlete-correction-fields { grid-template-columns:1fr; } .athlete-correction-wide { grid-column:auto; } }
  </style>

  <section class="section section-paper">
    <div class="container athlete-profile-shell" data-athlete-profile data-athlete-slug="${escapeHtml(seed?.profile_slug || "")}">
      ${breadcrumb(crumbs)}
      <p class="athlete-profile-message" data-athlete-profile-message role="status">Loading athlete profile.</p>

      <div data-athlete-profile-content hidden>
        <div class="athlete-profile-top">
          <section class="info-card" data-athlete-identity></section>
          <aside class="info-card athlete-profile-source" data-athlete-source></aside>
        </div>

        <section class="info-card athlete-profile-panel" data-athlete-latest-upcoming-panel hidden>
          <div class="athlete-profile-grid">
            <div data-athlete-latest-result></div>
            <div data-athlete-upcoming-meet></div>
          </div>
        </section>

        <section class="info-card athlete-profile-panel" data-athlete-best-panel hidden>
          <div><p class="eyebrow">Personal records</p><h2>Best performances by sport</h2></div>
          <div data-athlete-best-performances></div>
        </section>

        <section class="info-card athlete-recruit-rating-panel" data-athlete-recruit-rating-panel hidden>
          <div><p class="eyebrow">Podium Watch Recruit Rating</p><h2>Recruiting evaluation</h2></div>
          <div data-athlete-recruit-rating></div>
        </section>

        <section class="info-card athlete-profile-panel" data-athlete-recruit-timeline-panel hidden>
          <div><p class="eyebrow">Recruiting timeline</p><h2>Interest, offers, visits, and commitments</h2></div>
          <div class="athlete-profile-list" data-athlete-recruit-timeline></div>
        </section>

        <div class="athlete-profile-grid">
          <section class="info-card athlete-profile-panel athlete-path-panel" data-athlete-path-panel hidden>
            <div><p class="eyebrow">OHSAA cross country tournament</p><h2>Path to State</h2></div>
            <p class="athlete-path-team" data-athlete-path-team></p>
            <ol class="path-to-state" data-athlete-path-roadmap></ol>
            <p class="athlete-path-note" data-athlete-path-note hidden></p>
            <p class="path-to-state-source" data-athlete-path-source></p>
          </section>
          <section class="info-card athlete-profile-panel"><div><p class="eyebrow">Podium Watch rankings</p><h2>Editorial ranking history</h2></div><div class="athlete-profile-list" data-athlete-rankings></div></section>
          <section class="info-card athlete-profile-panel athlete-profile-wide"><div><p class="eyebrow">Performances</p><h2>Complete results by sport and season</h2></div><div data-athlete-performances></div></section>
          <section class="info-card athlete-profile-panel athlete-profile-wide" data-athlete-progression-panel hidden><div><p class="eyebrow">Progression</p><h2>Progression by event and season</h2></div><div data-athlete-progression></div></section>
          <section class="info-card athlete-profile-panel"><div><p class="eyebrow">School history</p><h2>Team connections</h2></div><div class="athlete-profile-list" data-athlete-schools></div></section>
          <section class="info-card athlete-profile-panel"><div><p class="eyebrow">Podium Watch coverage</p><h2>Stories and recognition</h2></div><div class="athlete-profile-list" data-athlete-stories></div></section>
          <section class="info-card athlete-profile-panel" data-athlete-recruiting-panel hidden><div><p class="eyebrow">Approved recruiting information</p><h2>Recruiting profile</h2></div><div class="athlete-profile-list" data-athlete-recruiting></div></section>
          <section class="info-card athlete-profile-panel" data-athlete-social-panel hidden><div><p class="eyebrow">Approved links</p><h2>Athlete social links</h2></div><div class="athlete-profile-list" data-athlete-social></div></section>
          <section class="info-card athlete-profile-panel" data-athlete-media-panel hidden><div><p class="eyebrow">Media</p><h2>Photos, video, and articles</h2></div><div class="athlete-profile-list" data-athlete-media></div></section>
        </div>

        <section class="info-card athlete-profile-panel">
          <div><p class="eyebrow">Accuracy and privacy</p><h2>Submit a correction.</h2><p>Share an official result, a school correction, a duplicate profile, or a privacy concern. Podium Watch reviews every submission before changing a profile.</p></div>
          <form class="athlete-correction-form" data-athlete-correction-form>
            <div class="athlete-correction-fields">
              <label>Correction type<select name="correction_type" required><option value="">Choose a correction</option><option value="name">Name</option><option value="school">School</option><option value="graduation_year">Graduation year</option><option value="performance">Performance</option><option value="division">Division</option><option value="college_commitment">College commitment</option><option value="duplicate">Duplicate profile</option><option value="privacy">Privacy concern</option><option value="other">Other</option></select></label>
              <label>Official source link<input type="url" name="source_url" placeholder="https://"></label>
              <label>Your name<input type="text" name="submitter_name" maxlength="150"></label>
              <label>Email for follow up<input type="email" name="submitter_email" maxlength="320"></label>
              <label class="athlete-correction-wide">Correction details<textarea name="details" required maxlength="5000" placeholder="Explain exactly what should be reviewed and why."></textarea></label>
              <label class="athlete-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
            </div>
            <button class="button button-dark" type="submit">Send correction</button>
          </form>
        </section>
      </div>
    </div>
  </section>

  <script>window.PODIUM_ATHLETE_SEED = ${jsonForScript(seed)};</script>
  <script src="/scripts/path-to-state.js" defer></script>
  <script src="/scripts/athlete-profile.js" defer></script>`;

  return layout({
    site,
    title,
    description,
    pathname,
    content,
    jsonLd
  });
}
