(() => {
  const root = document.querySelector("[data-athlete-admin]");

  if (!root) {
    return;
  }

  const loading = root.querySelector("[data-athlete-admin-loading]");
  const dashboard = root.querySelector("[data-athlete-admin-dashboard]");
  const message = root.querySelector("[data-athlete-admin-message]");
  const previewButton = root.querySelector("[data-athlete-preview]");
  const commitButton = root.querySelector("[data-athlete-commit]");
  const refreshButton = root.querySelector("[data-athlete-refresh]");
  const publishInput = root.querySelector("[data-athlete-publish]");
  const rosterInput = root.querySelector("[data-athlete-link-rosters]");
  const installStatus = root.querySelector("[data-athlete-install-status]");
  const previewSummary = root.querySelector("[data-athlete-preview-summary]");
  const searchForm = root.querySelector("[data-athlete-admin-search-form]");
  const searchResults = root.querySelector("[data-athlete-admin-results]");
  const editorPanel = root.querySelector("[data-athlete-editor-panel]");
  const editorTitle = root.querySelector("[data-athlete-editor-title]");
  const profileForm = root.querySelector("[data-athlete-profile-form]");
  const performanceForm = root.querySelector("[data-athlete-performance-form]");
  const publicLink = root.querySelector("[data-athlete-public-link]");
  const rankingRows = root.querySelector("[data-athlete-ranking-rows]");
  const rosterRows = root.querySelector("[data-athlete-roster-rows]");
  const performanceRows = root.querySelector("[data-athlete-performance-rows]");
  const correctionRows = root.querySelector("[data-athlete-correction-rows]");
  const duplicateGroups = root.querySelector("[data-athlete-duplicate-groups]");
  const mergeForm = root.querySelector("[data-athlete-merge-form]");
  const mergeRows = root.querySelector("[data-athlete-merge-rows]");
  const aliasRows = root.querySelector("[data-athlete-alias-rows]");
  const aliasForm = root.querySelector("[data-athlete-alias-form]");
  let busy = false;
  let state = null;
  let preview = null;
  let selected = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "Not listed";
    }

    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setText(selector, value) {
    const element = root.querySelector(selector);

    if (element) {
      element.textContent = String(value ?? 0);
    }
  }

  function setBusy(value) {
    busy = value;

    root.querySelectorAll("button").forEach((button) => {
      button.disabled = value;
    });

    refreshButton.disabled = value;
    previewButton.disabled = value || !state?.installed;
    commitButton.disabled =
      value ||
      !preview ||
      !state?.installed ||
      Number(preview?.summary?.duplicate_conflicts || 0) > 0;
  }

  async function api(body) {
    const response = await fetch("/api/admin/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "The athlete admin request failed.");
    }

    return payload;
  }

  function summaryRow(label, value, warning = false) {
    return '<div class="athlete-admin-row"><span>' + escapeHtml(label) + '</span><strong class="athlete-admin-badge" data-tone="' + (warning ? "warning" : "success") + '">' + escapeHtml(value) + "</strong></div>";
  }

  function renderStatus() {
    const counts = state.counts || {};
    setText("[data-athlete-count-profiles]", counts.profiles || 0);
    setText("[data-athlete-count-public]", counts.public_profiles || 0);
    setText("[data-athlete-count-verified]", counts.verified_profiles || 0);
    setText("[data-athlete-count-performance]", counts.performances || 0);
    setText("[data-athlete-count-corrections]", counts.open_corrections || 0);
    setText("[data-athlete-count-unlinked]", counts.unlinked_roster_athletes || 0);

    if (state.installed) {
      installStatus.innerHTML = '<span class="athlete-admin-badge">Database ready</span><p>The athlete migration is installed. Preview the bundled seed before importing.</p>';
      previewButton.disabled = false;
    } else {
      installStatus.innerHTML = '<span class="athlete-admin-badge" data-tone="warning">Migration required</span><p>Run <code>' + escapeHtml(state.migration_path) + "</code> in Supabase first.</p>";
      previewButton.disabled = true;
    }

    renderCorrections(state.corrections || []);
    renderDuplicates(state.duplicates || []);
    renderRecentMerges(state.recent_merges || []);
  }

  function renderPreview(data) {
    preview = data;
    const summary = data.summary || {};
    previewSummary.innerHTML = [
      summaryRow("New profiles", summary.profile_inserts || 0),
      summaryRow("Profile updates", summary.profile_updates || 0),
      summaryRow("New ranking links", summary.ranking_inserts || 0),
      summaryRow("Ranking updates", summary.ranking_updates || 0),
      summaryRow("Official school links", summary.official_school_links || 0),
      summaryRow("Team page links", summary.team_links || 0),
      summaryRow("Safe roster links", summary.roster_links || 0),
      summaryRow("Possible duplicate conflicts", summary.duplicate_conflicts || 0, (summary.duplicate_conflicts || 0) > 0),
      summaryRow("Unmatched official schools", summary.unmatched_official_schools || 0, (summary.unmatched_official_schools || 0) > 0)
    ].join("");
    commitButton.disabled = !state?.installed || (summary.duplicate_conflicts || 0) > 0;
  }

  function renderCorrections(items) {
    correctionRows.innerHTML = items.length
      ? items.map((item) => (
          "<tr>" +
            "<td>" + escapeHtml(item.athlete_slug || "Unknown profile") + "</td>" +
            "<td>" + escapeHtml(titleCase(item.correction_type)) + "</td>" +
            "<td>" + escapeHtml(item.details) + "<br><small>" + escapeHtml(formatDate(item.created_at)) + "</small></td>" +
            "<td>" + (item.source_url ? '<a href="' + escapeHtml(item.source_url) + '" target="_blank" rel="noopener noreferrer">Open source</a>' : "None") + "</td>" +
            '<td><div class="athlete-admin-actions"><button class="button button-outline" type="button" data-correction-id="' + escapeHtml(item.id) + '" data-correction-status="resolved">Resolve</button><button class="button button-outline" type="button" data-correction-id="' + escapeHtml(item.id) + '" data-correction-status="rejected">Reject</button></div></td>' +
          "</tr>"
        )).join("")
      : '<tr><td colspan="5">No open athlete corrections.</td></tr>';
  }

  // Click-to-populate: each candidate gets two small buttons that fill the
  // existing merge form below and scroll it into view, rather than an
  // admin retyping two UUIDs by hand. Reuses the merge form's existing
  // submit handler unchanged -- an admin still reviews both profiles and
  // confirms before anything is merged.
  function renderDuplicates(groups) {
    duplicateGroups.innerHTML = groups.length
      ? groups.map((group) => (
          '<article class="athlete-profile-entry" style="margin-bottom:10px"><strong>' + escapeHtml(group.profiles?.[0]?.display_name || "Possible duplicate") + "</strong>" +
          (group.profiles || []).map((profile) => (
            '<p><code>' + escapeHtml(profile.id) + "</code> | " + escapeHtml(profile.slug) + " | " + escapeHtml(profile.graduation_year || "Class unknown") +
            ' <button class="button button-outline" type="button" data-merge-role="source" data-merge-profile-id="' + escapeHtml(profile.id) + '">Set as source</button>' +
            ' <button class="button button-outline" type="button" data-merge-role="target" data-merge-profile-id="' + escapeHtml(profile.id) + '">Set as target</button>' +
            "</p>"
          )).join("") +
          "</article>"
        )).join("")
      : "<p>No duplicate profile groups were detected.</p>";
  }

  function renderRecentMerges(merges) {
    mergeRows.innerHTML = merges.length
      ? merges.map((merge) => (
          "<tr>" +
            "<td>" + escapeHtml(merge.source?.display_name || "Unknown profile") + "<br><small><code>" + escapeHtml(merge.source?.id || "") + "</code></small></td>" +
            "<td>" + escapeHtml(merge.target?.display_name || "Unknown profile") + "<br><small><code>" + escapeHtml(merge.target?.id || "") + "</code></small></td>" +
            "<td>" + escapeHtml(merge.reason || "No reason given") + "</td>" +
            "<td>" + escapeHtml(formatDate(merge.created_at)) + "<br><small>" + escapeHtml(merge.merged_by || "") + "</small></td>" +
            "<td>" + (merge.reversed_at
              ? '<span class="athlete-admin-badge">Undone ' + escapeHtml(formatDate(merge.reversed_at)) + "</span>"
              : (merge.can_unmerge
                  ? '<span class="athlete-admin-badge">Active</span>'
                  : '<span class="athlete-admin-badge" data-tone="warning">No undo snapshot</span>')) + "</td>" +
            '<td>' + (merge.can_unmerge ? '<button class="button button-outline" type="button" data-unmerge-id="' + escapeHtml(merge.id) + '">Undo this merge</button>' : "") + "</td>" +
          "</tr>"
        )).join("")
      : '<tr><td colspan="6">No merges yet.</td></tr>';
  }

  function profileButton(profile) {
    const school = profile.school?.school_name || profile.team?.school_name || "School not linked";
    return '<button class="athlete-admin-profile-button" type="button" data-profile-id="' + escapeHtml(profile.id) + '"><strong>' + escapeHtml(profile.display_name) + '</strong><span>' + escapeHtml([school, profile.graduation_year, titleCase(profile.verification_status)].filter(Boolean).join(" | ")) + "</span></button>";
  }

  function fillForm(form, values) {
    for (const element of form.elements) {
      if (!element.name) {
        continue;
      }

      const value = values[element.name];

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else if (Array.isArray(value)) {
        element.value = value.join(", ");
      } else {
        element.value = value ?? "";
      }
    }
  }

  function formPayload(form) {
    const payload = {};

    for (const element of form.elements) {
      if (!element.name) {
        continue;
      }

      payload[element.name] = element.type === "checkbox"
        ? element.checked
        : element.value;
    }

    return payload;
  }

  function renderAliases(items) {
    aliasRows.innerHTML = (items || []).length
      ? items.map((item) => (
          "<tr><td>" + escapeHtml(item.alias) + "</td><td>" + escapeHtml(titleCase(item.alias_type || "name")) + "</td><td>" + escapeHtml(item.external_source || "None") + "</td>" +
          "<td><button class=\"button button-outline\" type=\"button\" data-alias-delete=\"" + escapeHtml(item.id) + "\">Delete</button></td></tr>"
        )).join("")
      : '<tr><td colspan="4">No known aliases yet.</td></tr>';
  }

  function renderSelected(data) {
    selected = data;
    const profile = data.profile || {};
    editorPanel.hidden = false;
    editorTitle.textContent = `Edit ${profile.display_name || "athlete"}`;
    fillForm(profileForm, profile);
    performanceForm.elements.profile_id.value = profile.id || "";
    aliasForm.elements.profile_id.value = profile.id || "";
    publicLink.href = "/athlete/?slug=" + encodeURIComponent(profile.slug || "");
    renderAliases(data.aliases);

    rankingRows.innerHTML = (data.rankings || []).length
      ? data.rankings.map((item) => "<tr><td><a href=\"" + escapeHtml(item.ranking_href) + "\">" + escapeHtml(item.ranking_title) + "</a></td><td>" + escapeHtml(item.rank) + "</td><td>" + escapeHtml(item.mark_snapshot || "None") + "</td><td>" + escapeHtml(formatDate(item.updated_date)) + "</td></tr>").join("")
      : '<tr><td colspan="4">No ranking links.</td></tr>';

    rosterRows.innerHTML = (data.roster_links || []).length
      ? data.roster_links.map((item) => "<tr><td>" + escapeHtml(item.display_name) + "</td><td>" + escapeHtml(titleCase(item.gender)) + "</td><td>" + escapeHtml(item.graduation_year || "Unknown") + "</td><td>" + (item.public_visible ? "Yes" : "No") + "</td></tr>").join("")
      : '<tr><td colspan="4">No roster links.</td></tr>';

    performanceRows.innerHTML = (data.performances || []).length
      ? data.performances.map((item) => "<tr><td>" + escapeHtml(item.event_name) + "</td><td>" + escapeHtml(item.mark_text) + "</td><td>" + escapeHtml(item.meet_name || "Not listed") + "</td><td>" + escapeHtml(item.source_label) + "</td><td>" + escapeHtml(titleCase(item.verification_status)) + "</td><td><button class=\"button button-outline\" type=\"button\" data-performance-edit=\"" + escapeHtml(item.id) + "\">Edit</button> <button class=\"button button-outline\" type=\"button\" data-performance-archive=\"" + escapeHtml(item.id) + "\">Archive</button></td></tr>").join("")
      : '<tr><td colspan="6">No performance records.</td></tr>';

    editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadStatus() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      state = await api({ action: "status" });
      loading.hidden = true;
      dashboard.hidden = false;
      renderStatus();
      showMessage(state.installed ? "Athlete Data Center loaded." : "Run the athlete database migration before importing.", state.installed ? "success" : "warning");
    } catch (error) {
      loading.innerHTML = '<h2>Admin access required</h2><p>' + escapeHtml(error.message) + '</p><a class="button button-primary" href="/admin/">Open admin sign in</a>';
    } finally {
      setBusy(false);
    }
  }

  previewButton.addEventListener("click", async () => {
    if (busy || !state?.installed) return;
    setBusy(true);
    showMessage("Comparing the ranking seed with current athlete and roster data.");
    try {
      renderPreview(await api({ action: "preview_seed" }));
      showMessage("Athlete import preview is ready.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  commitButton.addEventListener("click", async () => {
    if (busy || !preview) return;
    if (!window.confirm("Import the reviewed athlete seed now? Ranking marks remain editorial snapshots and are not imported as verified personal bests.")) return;
    setBusy(true);
    showMessage("Importing athlete identities, school links, ranking links, and safe roster matches.");
    try {
      const result = await api({ action: "commit_seed", publish_profiles: publishInput.checked, link_rosters: rosterInput.checked });
      preview = null;
      previewSummary.innerHTML = "<p>Import completed. " + escapeHtml(result.summary?.inserted_profiles || 0) + " profiles were inserted and " + escapeHtml(result.summary?.updated_profiles || 0) + " were updated.</p>";
      showMessage("Athlete seed import completed.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  refreshButton.addEventListener("click", loadStatus);

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api({ action: "search", search: new FormData(searchForm).get("search") || "", limit: 150 });
      searchResults.innerHTML = data.profiles?.length ? data.profiles.map(profileButton).join("") : "<p>No athlete profiles matched.</p>";
      showMessage(`${data.profiles?.length || 0} athlete profiles loaded.`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  searchResults.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-profile-id]");
    if (!button || busy) return;
    setBusy(true);
    try {
      renderSelected(await api({ action: "get", profile_id: button.dataset.profileId }));
      showMessage("Athlete profile loaded for editing.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = await api({ action: "save_profile", ...formPayload(profileForm) });
      renderSelected(data);
      showMessage("Athlete profile saved.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  performanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await api({ action: "save_performance", ...formPayload(performanceForm) });
      renderSelected(result.context);
      performanceForm.reset();
      performanceForm.elements.profile_id.value = result.context.profile.id;
      performanceForm.elements.public_visible.checked = true;
      showMessage("Sourced performance saved.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  performanceRows.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-performance-edit]");
    const archive = event.target.closest("[data-performance-archive]");
    if ((!edit && !archive) || busy || !selected) return;
    const id = edit?.dataset.performanceEdit || archive?.dataset.performanceArchive;
    const item = selected.performances?.find((row) => row.id === id);

    if (edit && item) {
      fillForm(performanceForm, item);
      performanceForm.elements.profile_id.value = selected.profile.id;
      performanceForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!window.confirm("Archive this performance record?")) return;
    setBusy(true);
    try {
      renderSelected(await api({ action: "archive_performance", profile_id: selected.profile.id, performance_id: id }));
      showMessage("Performance archived.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  correctionRows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-correction-id]");
    if (!button || busy) return;
    const note = window.prompt("Optional resolution note:", "Reviewed by Podium Watch") ?? "";
    setBusy(true);
    try {
      await api({ action: "resolve_correction", correction_id: button.dataset.correctionId, status: button.dataset.correctionStatus, resolution_note: note });
      showMessage("Correction status saved.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  duplicateGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-merge-role]");
    if (!button) return;
    const field = button.dataset.mergeRole === "source" ? "source_profile_id" : "target_profile_id";
    mergeForm.elements[field].value = button.dataset.mergeProfileId;
    mergeForm.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  mergeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const payload = formPayload(mergeForm);
    if (!window.confirm("Merge the source athlete profile into the target profile? This can usually be undone afterward from \"Recent merges\" below, but changes made to the target profile during the merge are not reversed.")) return;
    setBusy(true);
    try {
      const result = await api({ action: "merge_profiles", ...payload });
      renderSelected(result.target);
      mergeForm.reset();
      showMessage("Athlete profiles merged.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  mergeRows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-unmerge-id]");
    if (!button || busy) return;
    if (!window.confirm("Undo this merge? The source profile and every row that moved or was removed will be restored. Changes the merge made to the target profile are not reversed.")) return;
    setBusy(true);
    try {
      await api({ action: "unmerge_profile", merge_id: button.dataset.unmergeId, confirm: true });
      showMessage("Merge undone. The source profile has been restored.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  aliasForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true);
    try {
      const result = await api({ action: "save_alias", ...formPayload(aliasForm) });
      renderSelected(result.context);
      aliasForm.reset();
      aliasForm.elements.profile_id.value = result.context.profile.id;
      showMessage("Alias saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  aliasRows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-alias-delete]");
    if (!button || busy || !selected) return;
    if (!window.confirm("Delete this alias? Search and import matching will no longer recognize this spelling.")) return;
    setBusy(true);
    try {
      renderSelected(await api({ action: "delete_alias", profile_id: selected.profile.id, alias_id: button.dataset.aliasDelete }));
      showMessage("Alias deleted.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  loadStatus();
})();
