import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .source-shell{display:grid;gap:20px}.source-message{margin:0;padding:14px 16px;border-radius:10px;background:rgba(0,191,99,.12);font-weight:850}.source-message[data-tone="error"]{color:#991b1b;background:rgba(220,38,38,.12)}.source-message[data-tone="warning"]{color:#7c4a03;background:rgba(245,158,11,.16)}.source-stats{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:12px}.source-stat{padding:16px;border:1px solid rgba(15,23,42,.12);border-radius:12px;background:#fff}.source-stat strong{display:block;font-size:2rem;line-height:1}.source-stat span{display:block;margin-top:7px;font-weight:850}.source-panel{display:grid;gap:14px}.source-fields{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.source-fields label,.source-panel>label{display:grid;gap:6px;font-weight:850}.source-fields input,.source-fields select,.source-panel textarea,.source-panel input,.source-panel select{width:100%;padding:10px;border:1px solid rgba(15,23,42,.22);border-radius:8px;background:#fff;font:inherit}.source-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center}.source-table-wrap{overflow:auto;border:1px solid rgba(15,23,42,.12);border-radius:10px}.source-table{width:100%;min-width:1080px;border-collapse:collapse;background:#fff}.source-table th,.source-table td{padding:10px;border-bottom:1px solid rgba(15,23,42,.09);text-align:left;vertical-align:top}.source-table th{background:#111;color:#fff;font-size:.74rem;text-transform:uppercase}.source-badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#e2e8f0;font-size:.75rem;font-weight:900}.source-badge[data-status="ready"],.source-badge[data-status="approved"],.source-badge[data-status="completed"],.source-badge[data-status="imported"]{background:rgba(0,191,99,.15);color:#075f34}.source-badge[data-status="needs_review"],.source-badge[data-status="partial"],.source-badge[data-status="paused"]{background:#fef3c7;color:#7c4a03}.source-links{display:grid;gap:5px;max-width:320px}.source-links a{font-weight:800}.source-check{width:18px;height:18px}.source-help{padding:14px;border-radius:10px;background:#f8fafc}.source-runs{display:grid;gap:8px}.source-run{display:grid;grid-template-columns:1.2fr .6fr .8fr 1.4fr;gap:10px;padding:12px;border-bottom:1px solid rgba(15,23,42,.09)}.source-tabs{display:flex;gap:8px;flex-wrap:wrap}.source-detail{display:grid;gap:14px;padding:16px;border:1px solid rgba(15,23,42,.14);border-radius:12px;background:#f8fafc}.source-detail[hidden]{display:none}.source-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.source-detail-grid>div{padding:10px;background:#fff;border-radius:8px}.source-small-table{min-width:760px}.source-file-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .ft-stats{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:10px}.ft-stat{padding:12px;border-radius:9px;background:#f8fafc}.ft-stat strong{display:block;font-size:1.4rem;line-height:1}.ft-stat span{display:block;margin-top:5px;font-size:.78rem;font-weight:850;color:#475569}.ft-settings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;align-items:end}.ft-settings label{display:grid;gap:6px;font-weight:850}.ft-settings input,.ft-settings select{width:100%;padding:9px;border:1px solid rgba(15,23,42,.22);border-radius:8px;font:inherit}.ft-badge{display:inline-block;padding:4px 9px;border-radius:999px;background:#e2e8f0;font-size:.75rem;font-weight:900}.ft-badge[data-tone="active"]{background:rgba(0,191,99,.15);color:#075f34}.ft-badge[data-tone="paused"]{background:#fef3c7;color:#7c4a03}.ft-badge[data-tone="failed"]{background:rgba(220,38,38,.13);color:#991b1b}
    @media(max-width:900px){.ft-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.ft-settings{grid-template-columns:1fr 1fr}}@media(max-width:560px){.ft-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ft-settings{grid-template-columns:1fr}}
    @media(max-width:900px){.source-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.source-fields{grid-template-columns:1fr 1fr}.source-actions{display:grid;grid-template-columns:1fr}.source-actions .button{width:100%;justify-content:center}}@media(max-width:560px){.source-fields{grid-template-columns:1fr}.source-run{grid-template-columns:1fr 1fr}}
`;

export function adminResultsSourcesPage(site) {
  const content = `<div class="source-shell" data-source-manager>
    <section class="info-card" data-source-loading><h2>Checking Phase One</h2><p>Please wait while the meet catalog loads.</p></section>
    <div data-source-dashboard hidden class="source-shell">
      <p class="source-message" data-source-message role="status">Loading the Results Source Manager.</p>
      <div class="source-stats">
        <article class="source-stat"><strong data-stat-total>0</strong><span>Meets found</span></article><article class="source-stat"><strong data-stat-sources>0</strong><span>Source links</span></article><article class="source-stat"><strong data-stat-ready>0</strong><span>Ready</span></article><article class="source-stat"><strong data-stat-review>0</strong><span>Need review</span></article><article class="source-stat"><strong data-stat-approved>0</strong><span>Approved</span></article>
      </div>
      <section class="info-card source-panel" data-ft-panel>
        <div><p class="eyebrow">Automated provider</p><h2>Finish Timing automation</h2><p class="source-help">Runs every 15 minutes on its own, with no button needed, once turned on. Discovers new Ohio meets, matches athletes and schools, and (only once auto-publish is turned on below) publishes safe high school results automatically. Junior high results are always kept private, never published as high school results.</p></div>
        <div class="ft-stats">
          <article class="ft-stat"><strong class="ft-badge" data-ft-status>--</strong><span>Status</span></article>
          <article class="ft-stat"><strong data-ft-autopublish>--</strong><span>Auto-publish</span></article>
          <article class="ft-stat"><strong data-ft-last-scan>--</strong><span>Last scan</span></article>
          <article class="ft-stat"><strong data-ft-meets>0</strong><span>Meets discovered</span></article>
          <article class="ft-stat"><strong data-ft-team-rows>0</strong><span>Team score rows</span></article>
          <article class="ft-stat"><strong data-ft-exceptions>0</strong><span>Open exceptions</span></article>
        </div>
        <form data-ft-settings-form class="ft-settings">
          <label><input type="checkbox" name="active"> Provider enabled (unpaused)</label>
          <label><input type="checkbox" name="auto_publish_enabled"> Automatic publishing enabled</label>
          <label>Correction lookback (days)<input type="number" name="lookback_days" min="0" max="365" value="3"></label>
          <label>&nbsp;<button class="button button-primary" type="submit">Save settings</button></label>
        </form>
        <div class="source-actions">
          <button class="button button-dark" type="button" data-ft-run-now>Run scan now</button>
          <label>Rescan one meet<input type="text" data-ft-meet-id placeholder="Finish Timing meet id"></label>
          <button class="button button-outline" type="button" data-ft-rescan>Rescan</button>
        </div>
        <div class="source-actions">
          <label>Backfill from<input type="date" data-ft-backfill-from></label>
          <label>to<input type="date" data-ft-backfill-to></label>
          <button class="button button-outline" type="button" data-ft-backfill>Request historical backfill</button>
        </div>
        <div class="source-table-wrap"><table class="source-table source-small-table"><thead><tr><th>Athlete</th><th>School</th><th>Meet</th><th>Held because</th></tr></thead><tbody data-ft-exception-rows><tr><td colspan="4">No open exceptions.</td></tr></tbody></table></div>
      </section>
      <section class="info-card source-panel">
        <div><p class="eyebrow">Phase One</p><h2>Discover Ohio meets</h2><p class="source-help">This starts the same robust, resumable crawler used in Phase Two. It discovers sources and stages results privately. Nothing is published automatically.</p></div>
        <form data-discovery-form class="source-fields">
          <label>Sport<select name="sport"><option value="cross_country">Cross Country</option><option value="outdoor_track">Outdoor Track</option></select></label>
          <label>Season year<input name="season_year" type="number" min="2000" max="2200" value="2025" required></label>
          <label>Provider<select name="provider_key"><option value="baumspage">Baumspage</option><option value="milesplit_ohio">MileSplit Ohio</option><option value="athletic_net">Athletic.net</option><option value="ohsaa">OHSAA</option><option value="timing_first">Timing First</option><option value="finish_timing">FinishTiming</option></select></label>
          <label>Batch size<select name="limit"><option value="25">25 links</option><option value="50" selected>50 links</option><option value="100">100 links</option></select></label>
          <label>&nbsp;<button class="button button-primary" type="submit">Start discovery</button></label>
        </form>
      </section>
      <section class="info-card source-panel">
        <div><p class="eyebrow">Phase Two</p><h2>Robust result crawler</h2><p class="source-help">Paste one result address, several addresses, or a provider catalog. The crawler follows promising links through multiple levels, preserves every source step, verifies result evidence, and pauses safely between batches.</p></div>
        <form data-ingestion-form class="source-panel">
          <label><strong>Result or catalog URLs, one per line</strong><textarea name="urls" rows="6" required placeholder="https://www.baumspage.com/..."></textarea></label>
          <div class="source-fields">
            <label>Provider<select name="provider_key"><option value="">Auto detect</option><option value="baumspage">Baumspage</option><option value="milesplit_ohio">MileSplit Ohio</option><option value="athletic_net">Athletic.net</option><option value="finish_timing">FinishTiming</option><option value="timing_first">Timing First</option></select></label>
            <label>Sport<select name="sport"><option value="cross_country">Cross Country</option><option value="outdoor_track">Outdoor Track</option><option value="indoor_track">Indoor Track</option></select></label>
            <label>Season year<input name="season_year" type="number" min="2000" max="2200" value="2025"></label>
            <label>Maximum depth<select name="max_depth"><option value="3">3 levels</option><option value="5" selected>5 levels</option><option value="7">7 levels</option></select></label>
            <label>Page limit<select name="max_pages"><option value="10">10 pages</option><option value="50" selected>50 pages</option><option value="100">100 pages</option><option value="250">250 pages</option></select></label>
            <label>Start date<input name="date_from" type="date"></label><label>End date<input name="date_to" type="date"></label>
          </div>
          <div class="source-actions"><label><input name="dry_run" type="checkbox" checked> Dry run, review before import</label><button class="button button-primary" type="submit">Create and run job</button></div>
        </form>
        <form data-content-form class="source-panel">
          <div><h3>Upload files or paste results</h3><p>Supported files are PDF, HTML, TXT, CSV, and XLSX. Save an older XLS file as XLSX first. Files are staged privately for review.</p></div>
          <div class="source-file-row"><label><strong>Result files</strong><input name="files" type="file" multiple accept=".pdf,.html,.htm,.txt,.csv,.xlsx"></label><label><strong>Input type</strong><select name="job_type"><option value="upload">Uploaded files</option><option value="paste">Pasted result text</option></select></label></div>
          <label><strong>Copied result text</strong><textarea name="pasted_text" rows="8" placeholder="Paste complete copied results here"></textarea></label>
          <div class="source-fields"><label>Sport<select name="sport"><option value="cross_country">Cross Country</option><option value="outdoor_track">Outdoor Track</option><option value="indoor_track">Indoor Track</option></select></label><label>Season year<input name="season_year" type="number" min="2000" max="2200" value="2025"></label><label>&nbsp;<button class="button button-primary" type="submit">Parse into review</button></label></div>
        </form>
        <div class="source-runs" data-ingestion-jobs><p>No Phase Two jobs loaded.</p></div>
        <section class="source-detail" data-ingestion-detail hidden></section>
      </section>
      <section class="info-card source-panel">
        <div><p class="eyebrow">Meet catalog</p><h2>Review and approve sources</h2></div>
        <form data-filter-form class="source-fields">
          <label>Sport<select name="sport"><option value="">All sports</option><option value="cross_country">Cross Country</option><option value="outdoor_track">Outdoor Track</option></select></label>
          <label>Season<input name="season_year" type="number" min="2000" max="2200" placeholder="2025"></label>
          <label>Status<select name="status"><option value="">All statuses</option><option value="ready">Ready</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="ignored">Ignored</option></select></label>
          <label>Provider<select name="provider_key"><option value="">All providers</option></select></label>
          <label>Search<input name="search" type="search" placeholder="Meet name"></label>
        </form>
        <div class="source-actions"><button class="button button-dark" type="button" data-apply-filters>Apply filters</button><button class="button button-primary" type="button" data-bulk-status="approved">Approve selected</button><button class="button button-outline" type="button" data-bulk-status="needs_review">Mark for review</button><button class="button button-outline" type="button" data-bulk-status="ignored">Ignore selected</button></div>
        <div class="source-table-wrap"><table class="source-table"><thead><tr><th><input class="source-check" type="checkbox" data-select-all aria-label="Select all visible meets"></th><th>Meet</th><th>Date</th><th>Sport</th><th>Best sources</th><th>Confidence</th><th>Status</th><th>Review note</th></tr></thead><tbody data-source-rows></tbody></table></div>
      </section>
      <section class="info-card source-panel"><div><p class="eyebrow">Discovery log</p><h2>Recent batches</h2></div><div class="source-runs" data-source-runs></div></section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/results-sources/",
    title: "Results Source Manager",
    description: "Private Podium Watch bulk meet discovery and original source matching.",
    heading: "Results Source Manager",
    intro: "Discover Ohio meets in bulk, identify the best original result source, and approve a dependable catalog before importing performances.",
    styles,
    content,
    scripts: ["/scripts/admin-results-sources.js"]
  });
}
