(() => {
  const root = document.querySelector("[data-source-manager]");
  if (!root) return;
  const loading = root.querySelector("[data-source-loading]");
  const dashboard = root.querySelector("[data-source-dashboard]");
  const message = root.querySelector("[data-source-message]");
  const discoveryForm = root.querySelector("[data-discovery-form]");
  const filterForm = root.querySelector("[data-filter-form]");
  const rows = root.querySelector("[data-source-rows]");
  const runs = root.querySelector("[data-source-runs]");
  const ingestionForm = root.querySelector("[data-ingestion-form]");
  const contentForm = root.querySelector("[data-content-form]");
  const ingestionJobs = root.querySelector("[data-ingestion-jobs]");
  const ingestionDetail = root.querySelector("[data-ingestion-detail]");
  let statusData = null;
  let busy = false;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  function setMessage(text, tone = "success") { message.textContent = text; message.dataset.tone = tone; }
  function setBusy(value) { busy = value; root.querySelectorAll("button").forEach((button) => { button.disabled = value; }); }
  async function api(body) {
    const response = await fetch("/api/admin/results-sources", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const parts = [payload.error || "The Results Source Manager request failed.", payload.code && `Code ${payload.code}`, payload.stage && `Stage ${payload.stage}`, payload.provider && `Provider ${payload.provider}`, payload.url, payload.request_id && `Request ${payload.request_id}`].filter(Boolean); throw new Error(parts.join(" | ")); }
    return payload;
  }
  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }
  function stat(selector, value) { const element = root.querySelector(selector); if (element) element.textContent = String(value || 0); }
  function renderStatus() {
    const counts = statusData.counts || {};
    stat("[data-stat-total]", counts.total); stat("[data-stat-sources]", counts.sources); stat("[data-stat-ready]", counts.ready); stat("[data-stat-review]", counts.needs_review); stat("[data-stat-approved]", counts.approved);
    const providerSelect = filterForm.elements.provider_key;
    providerSelect.innerHTML = '<option value="">All providers</option>' + (statusData.providers || []).map((provider) => `<option value="${escapeHtml(provider.provider_key)}">${escapeHtml(provider.provider_name)}</option>`).join("");
    runs.innerHTML = (statusData.recent_runs || []).length ? statusData.recent_runs.map((run) => `<div class="source-run"><strong>${escapeHtml(titleCase(run.provider_key || "All providers"))}</strong><span>${escapeHtml(titleCase(run.status))}</span><span>${escapeHtml(run.meets_found || 0)} found</span><span>${escapeHtml(new Date(run.started_at).toLocaleString())}</span></div>`).join("") : "<p>No discovery batches have run yet.</p>";
  }
  function renderIngestionJobs(jobs = []) {
    if (!ingestionJobs) return;
    ingestionJobs.innerHTML = jobs.length ? jobs.map((job) => {
      const progress = job.progress || {};
      const resumable = ["queued", "paused", "partial"].includes(job.status);
      return `<article class="source-run"><div><strong>${escapeHtml(titleCase(job.provider_key || job.job_type))}</strong><br><small>${escapeHtml(job.id)}</small></div><div><span class="source-badge" data-status="${escapeHtml(job.status)}">${escapeHtml(titleCase(job.status))}</span></div><div>${escapeHtml(progress.visited || 0)} pages<br>${escapeHtml(progress.documents || 0)} documents<br>${escapeHtml(progress.rows || 0)} rows<br>${escapeHtml(progress.errors || 0)} errors</div><div class="source-actions"><button class="button button-outline" type="button" data-view-job="${escapeHtml(job.id)}">Review</button>${resumable ? `<button class="button button-primary" type="button" data-run-job="${escapeHtml(job.id)}">Resume</button>` : ""}${job.status === "running" ? `<button class="button button-outline" type="button" data-pause-job="${escapeHtml(job.id)}">Pause</button>` : ""}${progress.errors ? `<button class="button button-outline" type="button" data-retry-job="${escapeHtml(job.id)}">Retry failures</button>` : ""}${job.status === "imported" ? `<button class="button button-outline" type="button" data-reverse-job="${escapeHtml(job.id)}">Reverse batch</button>` : ""}${!["completed","cancelled","imported","reversed"].includes(job.status) ? `<button class="button button-outline" type="button" data-cancel-job="${escapeHtml(job.id)}">Cancel</button>` : ""}</div></article>`;
    }).join("") : "<p>No Phase Two ingestion jobs yet.</p>";
  }
  function sourceLinks(meet) {
    const sources = meet.discovered_meet_sources || [];
    if (!sources.length) return "No source link";
    return `<div class="source-links">${sources.slice(0, 3).map((source) => { const provider = source.results_source_providers?.provider_name || "Source"; return `<a href="${escapeHtml(source.source_url)}" target="_blank" rel="noopener">${escapeHtml(provider)}</a><small>${escapeHtml(titleCase(source.source_role))}, ${escapeHtml(titleCase(source.permission_status))}</small>`; }).join("")}</div>`;
  }
  function renderMeets(meets) {
    rows.innerHTML = meets.length ? meets.map((meet) => `<tr><td><input class="source-check" type="checkbox" value="${escapeHtml(meet.id)}" data-meet-select aria-label="Select ${escapeHtml(meet.meet_name)}"></td><td><strong>${escapeHtml(meet.meet_name)}</strong><br><small>${escapeHtml([meet.host_name, meet.location_name, meet.city].filter(Boolean).join(" | ") || "Location not found")}</small></td><td>${escapeHtml(meet.meet_date || "Needs review")}</td><td>${escapeHtml(titleCase(meet.sport))}<br><small>${escapeHtml(meet.season_year)}</small></td><td>${sourceLinks(meet)}</td><td>${escapeHtml(meet.confidence)}%</td><td><span class="source-badge" data-status="${escapeHtml(meet.discovery_status)}">${escapeHtml(titleCase(meet.discovery_status))}</span></td><td>${escapeHtml(meet.review_note || "Ready for source review")}</td></tr>`).join("") : '<tr><td colspan="8">No meets match these filters. Start a discovery batch above.</td></tr>';
  }
  async function loadCatalog() {
    const values = formValues(filterForm);
    const data = await api({ action: "list", ...values, limit: 300 });
    renderMeets(data.meets || []);
  }
  discoveryForm.addEventListener("change", () => {
    const sport = discoveryForm.elements.sport.value;
    if (sport === "cross_country" && discoveryForm.elements.season_year.value === "2026") discoveryForm.elements.season_year.value = "2025";
    if (sport === "outdoor_track" && discoveryForm.elements.season_year.value === "2025") discoveryForm.elements.season_year.value = "2026";
  });
  discoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("Starting a resumable provider discovery job.", "warning");
    try {
      const values = formValues(discoveryForm); const roots = { baumspage: { cross_country: "https://www.baumspage.com/cc/", outdoor_track: "https://www.baumspage.com/track/" }, milesplit_ohio: { cross_country: `https://oh.milesplit.com/results/ohio-meet-results?page=1&season=cc&year=${values.season_year}`, outdoor_track: `https://oh.milesplit.com/results/ohio-meet-results?page=1&season=outdoor&year=${values.season_year}` }, athletic_net: { cross_country: "https://www.athletic.net/cross-country/division/81413", outdoor_track: "https://www.athletic.net/track-and-field-outdoor/division/170050" }, ohsaa: { cross_country: "https://www.ohsaa.org/sports/cc", outdoor_track: "https://www.ohsaa.org/sports/track/tournament-info" }, timing_first: { cross_country: "https://results.timingfirst.com/meet-list", outdoor_track: "https://results.timingfirst.com/meet-list" }, finish_timing: { cross_country: "https://finishtiming.trackscoreboard.com/", outdoor_track: "https://finishtiming.trackscoreboard.com/" } };
      const rootUrl = roots[values.provider_key]?.[values.sport]; if (!rootUrl) throw new Error("This provider does not have a configured catalog for that sport.");
      const job = await api({ action: "create_ingestion_job", job_type: "provider", urls: rootUrl, provider_key: values.provider_key, sport: values.sport, season_year: values.season_year, options: { maxDepth: 7, maxPages: Number(values.limit), dryRun: true } }); const result = await api({ action: "run_ingestion_job", job_id: job.id, slice_limit: 10 });
      setMessage(`${titleCase(values.provider_key)} discovery started. ${result.progress.visited} pages checked, ${result.progress.documents} documents found, ${result.progress.rows} rows staged, and ${result.progress.errors} errors recorded. Use Resume until the job is complete, then open Review.`); await start(); await showJob(job.id);
    }
    catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  });
  ingestionForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("Creating the ingestion job and running its first safe slice.", "warning");
    try {
      const values = formValues(ingestionForm);
      const job = await api({ action: "create_ingestion_job", job_type: "urls", urls: values.urls, provider_key: values.provider_key, sport: values.sport, season_year: values.season_year, options: { maxDepth: Number(values.max_depth), maxPages: Number(values.max_pages), dateFrom: values.date_from || null, dateTo: values.date_to || null, dryRun: values.dry_run === "on" } });
      const result = await api({ action: "run_ingestion_job", job_id: job.id, slice_limit: 10 });
      setMessage(`Phase Two job created. ${result.progress.visited} pages checked, ${result.progress.documents} result documents found, and ${result.progress.rows} rows staged. Status: ${titleCase(result.status)}.`);
      await start();
    } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  });
  function fileAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "").split(",")[1] || ""); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); }
  contentForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); if (busy) return; const values = formValues(contentForm); const files = [...(contentForm.elements.files.files || [])]; const pasted = String(values.pasted_text || "").trim();
    if (!files.length && !pasted) { setMessage("Select at least one file or paste result text.", "warning"); return; }
    setBusy(true); setMessage("Reading and staging result documents.", "warning");
    try {
      let latest = null;
      for (const file of files) { if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} is larger than 12 MB.`); latest = await api({ action: "create_content_job", job_type: "upload", text: await fileAsBase64(file), encoding: "base64", file_name: file.name, content_type: file.type, sport: values.sport, season_year: values.season_year, dry_run: true }); }
      if (pasted) latest = await api({ action: "create_content_job", job_type: "paste", text: pasted, file_name: "pasted-results.txt", content_type: "text/plain", sport: values.sport, season_year: values.season_year, dry_run: true });
      setMessage(`${files.length + (pasted ? 1 : 0)} result input${files.length + (pasted ? 1 : 0) === 1 ? "" : "s"} processed. The newest job staged ${latest?.progress?.rows || 0} rows for review.`); contentForm.reset(); await start(); if (latest?.id) await showJob(latest.id);
    } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  });
  function csvCell(value) { const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); return `"${text.replaceAll('"','""')}"`; }
  function downloadRows(job) { const headers = ["id","meet_name","meet_date","sport","gender","division","event_name","athlete_name","school_name","place","mark_text","parser_confidence","match_confidence","review_status","warning_codes"]; const csv = [headers.join(","), ...(job.rows || []).map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `podium-watch-results-review-${job.job.id}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  async function showJob(id) {
    const data = await api({ action: "get_ingestion_job", job_id: id }); const job = data.job; const rowsData = data.rows || []; const pages = data.pages || []; const documents = data.documents || [];
    ingestionDetail.hidden = false; ingestionDetail.dataset.jobId = id;
    ingestionDetail.innerHTML = `<div><p class="eyebrow">Job review</p><h3>${escapeHtml(titleCase(job.provider_key || job.job_type))}</h3><p>${escapeHtml(id)}</p></div><div class="source-detail-grid"><div><strong>${pages.filter((page) => page.status === "fetched").length}</strong><br>Checked pages</div><div><strong>${pages.filter((page) => page.status === "queued").length}</strong><br>Queued pages</div><div><strong>${documents.filter((document) => document.status === "parsed").length}</strong><br>Valid documents</div><div><strong>${rowsData.length}</strong><br>Complete rows</div><div><strong>${pages.filter((page) => page.status === "failed" || page.status === "blocked").length}</strong><br>Failures</div></div><div class="source-actions"><button class="button button-outline" data-download-review type="button">Download review CSV</button><button class="button button-outline" data-resolve-identities type="button">Match identities</button><button class="button button-primary" data-approve-ready type="button">Approve selected</button><button class="button button-outline" data-reject-ready type="button">Reject selected</button><button class="button button-dark" data-import-approved type="button">Import approved rows</button></div><details><summary><strong>Source chain and failures</strong></summary><div class="source-table-wrap"><table class="source-table source-small-table"><thead><tr><th>Stage</th><th>Address</th><th>Score</th><th>Status</th><th>Reason</th></tr></thead><tbody>${pages.map((page) => `<tr><td>${escapeHtml(page.depth)}</td><td><a href="${escapeHtml(page.url)}" target="_blank" rel="noopener">${escapeHtml(page.url)}</a><br><small>${escapeHtml((page.source_chain || []).join(" to "))}</small></td><td>${escapeHtml(page.result_score)}</td><td>${escapeHtml(page.status)}</td><td>${escapeHtml((page.reason_codes || []).join(", "))}${page.error_detail?.message ? `<br>${escapeHtml(page.error_detail.message)}` : ""}</td></tr>`).join("") || '<tr><td colspan="5">No crawled pages for an uploaded input.</td></tr>'}</tbody></table></div></details><div class="source-table-wrap"><table class="source-table source-small-table"><thead><tr><th>Select</th><th>Athlete or relay</th><th>School</th><th>Event</th><th>Mark</th><th>Confidence</th><th>Status</th><th>Warnings</th></tr></thead><tbody>${rowsData.map((row) => `<tr><td><input type="checkbox" data-review-row value="${escapeHtml(row.id)}" ${row.review_status === "pending" ? "checked" : ""}></td><td>${escapeHtml(row.athlete_name || row.relay_team || "Missing")}</td><td>${escapeHtml(row.school_name || "Missing")}</td><td>${escapeHtml(row.event_name || "Missing")}</td><td>${escapeHtml(row.mark_text || "Missing")}</td><td>${escapeHtml(row.parser_confidence)} parse<br>${escapeHtml(row.match_confidence)} match</td><td>${escapeHtml(titleCase(row.review_status))}</td><td>${escapeHtml((row.warning_codes || []).join(", ") || "None")}</td></tr>`).join("") || '<tr><td colspan="8">No complete result rows were staged. Inspect the source chain and document warnings.</td></tr>'}</tbody></table></div>`;
    ingestionDetail.querySelector("[data-download-review]")?.addEventListener("click", () => downloadRows(data));
  }
  ingestionJobs?.addEventListener("click", async (event) => {
    const run = event.target.closest("[data-run-job]"); const cancel = event.target.closest("[data-cancel-job]"); const view = event.target.closest("[data-view-job]"); const pause = event.target.closest("[data-pause-job]"); const retry = event.target.closest("[data-retry-job]"); const reverse = event.target.closest("[data-reverse-job]"); if ((!run && !cancel && !view && !pause && !retry && !reverse) || busy) return;
    setBusy(true);
    try { if (view) { await showJob(view.dataset.viewJob); setMessage("Job review loaded."); } else { const result = run ? await api({ action: "resume_ingestion_job", job_id: run.dataset.runJob, slice_limit: 10 }) : pause ? await api({ action: "pause_ingestion_job", job_id: pause.dataset.pauseJob }) : retry ? await api({ action: "retry_ingestion_job", job_id: retry.dataset.retryJob }) : reverse ? await api({ action: "reverse_ingestion_job", job_id: reverse.dataset.reverseJob }) : await api({ action: "cancel_ingestion_job", job_id: cancel.dataset.cancelJob }); setMessage(`Ingestion job is ${titleCase(result.status || "updated")}.`); await start(); } } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  });
  ingestionDetail?.addEventListener("click", async (event) => {
    const approve = event.target.closest("[data-approve-ready]"); const reject = event.target.closest("[data-reject-ready]"); const resolve = event.target.closest("[data-resolve-identities]"); const commit = event.target.closest("[data-import-approved]"); if ((!approve && !reject && !resolve && !commit) || busy) return;
    const jobId = ingestionDetail.dataset.jobId; const rowIds = [...ingestionDetail.querySelectorAll("[data-review-row]:checked")].map((box) => box.value); if ((approve || reject) && !rowIds.length) { setMessage("Select at least one result row.", "warning"); return; }
    if (commit && !window.confirm("Import the approved and exactly matched rows? Imported performances remain private until separately published.")) return;
    setBusy(true); try { const result = resolve ? await api({ action: "resolve_ingestion_identities", job_id: jobId }) : commit ? await api({ action: "import_ingestion_job", job_id: jobId }) : await api({ action: "review_ingestion_rows", job_id: jobId, row_ids: rowIds, review_status: approve ? "approved" : "rejected" }); setMessage(resolve ? `${result.matched} matched, ${result.ambiguous} ambiguous, and ${result.unmatched} unmatched.` : commit ? `${result.imported} performances imported privately. ${result.duplicates} duplicates skipped.` : `${result.updated} rows updated.`); await showJob(jobId); await start(); } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  });
  root.querySelector("[data-apply-filters]").addEventListener("click", async () => { if (busy) return; setBusy(true); try { await loadCatalog(); setMessage("Filters applied."); } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); } });
  root.querySelector("[data-select-all]").addEventListener("change", (event) => { root.querySelectorAll("[data-meet-select]").forEach((box) => { box.checked = event.target.checked; }); });
  root.querySelectorAll("[data-bulk-status]").forEach((button) => button.addEventListener("click", async () => {
    if (busy) return; const meetIds = [...root.querySelectorAll("[data-meet-select]:checked")].map((box) => box.value); if (!meetIds.length) { setMessage("Select at least one meet first.", "warning"); return; }
    setBusy(true); try { const result = await api({ action: "set_status", meet_ids: meetIds, status: button.dataset.bulkStatus }); setMessage(`${result.updated} meets updated.`); await start(); } catch (error) { setMessage(error.message, "error"); } finally { setBusy(false); }
  }));
  async function start() {
    statusData = await api({ action: "status" }); renderStatus(); renderIngestionJobs(statusData.ingestion_jobs || []); await loadCatalog(); loading.hidden = true; dashboard.hidden = false;
  }
  start().catch((error) => { loading.innerHTML = `<h2>Phase One needs attention</h2><p>${escapeHtml(error.message)}</p><p>Run <code>install/04_RESULTS_SOURCE_MANAGER.sql</code> in Supabase, then refresh this page.</p>`; });
})();
