(() => {
  const root = document.querySelector("[data-awards-manager]");
  if (!root) return;

  const loading = root.querySelector("[data-awards-loading]");
  const dashboard = root.querySelector("[data-awards-dashboard]");
  const message = root.querySelector("[data-awards-message]");
  const typeTabs = root.querySelector("[data-awards-type-tabs]");
  const weekSelect = root.querySelector("[data-awards-week-select]");
  const phaseBadge = root.querySelector("[data-awards-phase-badge]");
  const stats = root.querySelector("[data-awards-stats]");
  const weekActions = root.querySelector("[data-awards-week-actions]");
  const nominationRows = root.querySelector("[data-awards-nomination-rows]");
  const finalistList = root.querySelector("[data-awards-finalist-list]");
  const winnerActions = root.querySelector("[data-awards-winner-actions]");
  const createForm = root.querySelector("[data-awards-create-form]");
  const nominateForm = root.querySelector("[data-awards-nominate-form]");

  let busy = false;
  let currentType = "aotw";
  let currentWeekId = null;
  let currentDetail = null;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function setMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button, select, input").forEach((element) => { element.disabled = value; });
  }

  async function api(body) {
    const response = await fetch("/api/admin/awards/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ type: currentType, ...body })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The weekly awards request failed.");
    return payload;
  }

  function formatDate(value) {
    if (!value) return "Unknown";
    return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function phaseLabel(phase) {
    return {
      scheduled: "Scheduled",
      nominations_open: "Nominations open",
      nominations_closed: "Nominations closed",
      voting_open: "Voting open",
      voting_closed: "Voting closed",
      winner_announced: "Winner announced",
      not_scheduled: "Not scheduled"
    }[phase] || phase;
  }

  // Client-side preview only -- mirrors lib/awards_service.mjs's
  // defaultsFromNomination() so the promote form starts pre-filled with
  // something sensible, but the server (not this) is the authority on
  // what actually gets saved; the admin can edit any of these first.
  function defaultAchievement(nomination) {
    if (currentType === "totw") return nomination.achievement || "";
    const performanceLine = [nomination.performance, nomination.event_name].filter(Boolean).join(" in the ");
    return `${performanceLine}${nomination.meet_name ? ` at ${nomination.meet_name}` : ""}`.trim();
  }

  function renderStats(detail) {
    const nominations = detail.nominations || [];
    const finalists = detail.finalists || [];
    const items = [
      ["Nominations", nominations.length],
      ["Unreviewed", nominations.filter((row) => !row.reviewed).length],
      ["Selected", nominations.filter((row) => row.selected).length],
      ["Finalists", finalists.length],
      ["Winners set", finalists.filter((row) => row.winner).length]
    ];
    stats.innerHTML = items.map(([label, value]) => `<div class="awards-stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`).join("");
  }

  function renderWeekActions(week) {
    const buttons = [];
    if (week.phase === "scheduled") buttons.push(`<button class="button button-primary" type="button" data-week-action="open_nominations">Open nominations</button>`);
    else if (week.phase === "nominations_open") buttons.push(`<button class="button button-dark" type="button" data-week-action="close_nominations">Close nominations</button>`);
    else if (week.phase === "nominations_closed") buttons.push(`<button class="button button-primary" type="button" data-week-action="open_voting">Open voting</button>`);
    else if (week.phase === "voting_open") buttons.push(`<button class="button button-dark" type="button" data-week-action="close_voting">Close voting</button>`);
    else if (week.phase === "voting_closed") buttons.push(`<span>Select winner(s) below, then confirm.</span>`);
    else if (week.phase === "winner_announced") buttons.push(`<span>Winner announced for this week.</span>`);
    weekActions.innerHTML = buttons.join(" ");
  }

  function nominationDetailsHtml(nomination) {
    if (currentType === "totw") {
      return `${escapeHtml(nomination.category === "girls" ? "Girls" : "Boys")} &middot; ${escapeHtml(nomination.sport)}${nomination.division ? ` &middot; ${escapeHtml(nomination.division)}` : ""}<br>${escapeHtml(nomination.achievement)}${nomination.meet_name ? `<br>${escapeHtml(nomination.meet_name)}` : ""}${nomination.performance_date ? ` (${escapeHtml(nomination.performance_date)})` : ""}`;
    }
    return `${escapeHtml(nomination.grade)}${nomination.gender ? ` &middot; ${escapeHtml(nomination.gender)}` : ""}<br>${escapeHtml(nomination.event_name)}: ${escapeHtml(nomination.performance)}${nomination.meet_name ? `<br>${escapeHtml(nomination.meet_name)}` : ""}${nomination.performance_date ? ` (${escapeHtml(nomination.performance_date)})` : ""}`;
  }

  function nominationNameHtml(nomination) {
    const name = currentType === "totw" ? nomination.team_name : nomination.athlete_name;
    return `<b>${escapeHtml(name)}</b><br>${escapeHtml(nomination.school)}`;
  }

  function promoteFormHtml(nomination) {
    return `<div class="awards-inline-form" data-promote-form="${escapeHtml(nomination.id)}">
      <label>Photo URL<input type="text" data-field="image_url" value="${escapeHtml(nomination.photo_url || "")}"></label>
      <label>Achievement (short)<input type="text" data-field="achievement" value="${escapeHtml(defaultAchievement(nomination))}"></label>
      <label>Description (longer)<textarea data-field="description">${escapeHtml(nomination.reason || "")}</textarea></label>
      <label>Sort order<input type="number" data-field="sort_order" value="0"></label>
      <div class="awards-actions">
        <button class="button button-primary" type="button" data-confirm-promote="${escapeHtml(nomination.id)}">Create finalist</button>
        <button class="button button-outline" type="button" data-cancel-promote="${escapeHtml(nomination.id)}">Cancel</button>
      </div>
    </div>`;
  }

  function renderNominations(detail) {
    const nominations = detail.nominations || [];
    if (!nominations.length) {
      nominationRows.innerHTML = '<tr><td colspan="6">No nominations for this week yet.</td></tr>';
      return;
    }

    nominationRows.innerHTML = nominations.map((nomination) => {
      const promoteCell = nomination.promoted_finalist_id
        ? '<span class="awards-badge" data-phase="winner_announced">Promoted</span>'
        : `<button class="button button-outline" type="button" data-open-promote="${escapeHtml(nomination.id)}">Promote</button>`;

      return `<tr data-nomination-row="${escapeHtml(nomination.id)}">
        <td>${nominationNameHtml(nomination)}</td>
        <td>${nominationDetailsHtml(nomination)}</td>
        <td class="awards-reason">${escapeHtml(nomination.reason)}${nomination.result_url ? `<br><a href="${escapeHtml(nomination.result_url)}" target="_blank" rel="noopener">Result link</a>` : ""}</td>
        <td>${escapeHtml(nomination.nominator_name)}<br><span style="color:#64748b;font-size:.8rem;">${escapeHtml(nomination.nominator_email)}</span></td>
        <td><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" data-review-toggle="${escapeHtml(nomination.id)}" ${nomination.reviewed ? "checked" : ""}> Reviewed</label>
        <label style="display:flex;gap:6px;align-items:center;margin-top:4px;"><input type="checkbox" data-select-toggle="${escapeHtml(nomination.id)}" ${nomination.selected ? "checked" : ""}> Selected</label></td>
        <td>${promoteCell}<div data-promote-slot="${escapeHtml(nomination.id)}"></div></td>
      </tr>`;
    }).join("");
  }

  function finalistEditFormHtml(finalist) {
    return `<div class="awards-inline-form" data-edit-form="${escapeHtml(finalist.id)}">
      <label>Photo URL<input type="text" data-field="image_url" value="${escapeHtml(finalist.image_url || "")}"></label>
      <label>Achievement<input type="text" data-field="achievement" value="${escapeHtml(finalist.achievement || "")}"></label>
      <label>Description<textarea data-field="description">${escapeHtml(finalist.description || "")}</textarea></label>
      <label>Sort order<input type="number" data-field="sort_order" value="${Number(finalist.sort_order) || 0}"></label>
      <div class="awards-actions">
        <button class="button button-primary" type="button" data-confirm-edit="${escapeHtml(finalist.id)}">Save</button>
        <button class="button button-outline" type="button" data-cancel-edit="${escapeHtml(finalist.id)}">Cancel</button>
      </div>
    </div>`;
  }

  function renderFinalists(detail) {
    const finalists = detail.finalists || [];
    const showWinnerPicker = detail.week.phase === "voting_closed";

    if (!finalists.length) {
      finalistList.innerHTML = "<p>No finalists yet. Promote a nomination above once you have chosen who to feature.</p>";
      winnerActions.innerHTML = "";
      return;
    }

    finalistList.innerHTML = finalists.map((finalist) => {
      const name = currentType === "totw" ? finalist.team_name : finalist.athlete_name;
      const meta = currentType === "totw"
        ? `${escapeHtml(finalist.school)} &middot; ${escapeHtml(finalist.category === "girls" ? "Girls" : "Boys")} &middot; ${escapeHtml(finalist.sport || "")}`
        : `${escapeHtml(finalist.school)}${finalist.grade ? ` &middot; ${escapeHtml(finalist.grade)}` : ""}`;
      const photo = finalist.image_url
        ? `<img src="${escapeHtml(finalist.image_url)}" alt="">`
        : '<div class="awards-finalist-photo-empty">No photo</div>';
      const winnerPill = finalist.winner ? '<span class="awards-winner-pill">Winner</span>' : "";
      const radioName = currentType === "totw" ? `winner-${finalist.category}` : "winner";
      const winnerPicker = showWinnerPicker
        ? `<label style="display:flex;gap:6px;align-items:center;font-weight:800;"><input type="radio" name="${escapeHtml(radioName)}" value="${escapeHtml(finalist.id)}" ${finalist.winner ? "checked" : ""}> Set as winner</label>`
        : "";

      return `<div class="awards-finalist-card" data-finalist-card="${escapeHtml(finalist.id)}">
        ${photo}
        <div>
          <div><b>${escapeHtml(name)}</b> ${winnerPill}</div>
          <div class="awards-finalist-meta">${meta}</div>
          <div style="margin-top:6px;"><b>${escapeHtml(finalist.achievement)}</b></div>
          <div class="awards-finalist-meta">${escapeHtml(finalist.description || "")}</div>
          <div class="awards-finalist-meta" style="margin-top:6px;">Votes: <b>${Number(finalist.vote_count) || 0}</b> &middot; Sort order ${Number(finalist.sort_order) || 0}</div>
          ${winnerPicker}
          <div data-edit-slot="${escapeHtml(finalist.id)}"></div>
        </div>
        <div class="awards-finalist-actions">
          <button class="button button-outline" type="button" data-open-edit="${escapeHtml(finalist.id)}">Edit</button>
          <button class="button button-outline" type="button" data-remove-finalist="${escapeHtml(finalist.id)}">Remove</button>
        </div>
      </div>`;
    }).join("");

    winnerActions.innerHTML = showWinnerPicker
      ? `<button class="button button-primary" type="button" data-confirm-winner>Confirm winner(s)</button>`
      : "";
  }

  function renderWeek(detail) {
    currentDetail = detail;
    phaseBadge.textContent = phaseLabel(detail.week.phase);
    phaseBadge.dataset.phase = detail.week.phase;
    renderStats(detail);
    renderWeekActions(detail.week);
    renderNominations(detail);
    renderFinalists(detail);
  }

  function pickDefaultWeek(weeks) {
    const active = weeks.find((week) => ["nominations_open", "nominations_closed", "voting_open", "voting_closed"].includes(week.phase));
    if (active) return active;
    const now = Date.now();
    const upcoming = [...weeks].filter((week) => new Date(week.nomination_opens).getTime() >= now).sort((first, second) => new Date(first.nomination_opens) - new Date(second.nomination_opens))[0];
    return upcoming || weeks[0] || null;
  }

  async function selectWeek(weekId) {
    if (!weekId) return;
    currentWeekId = weekId;
    weekSelect.value = weekId;
    setBusy(true);
    try {
      const data = await api({ action: "get_week", week_id: weekId });
      renderWeek(data);
      setMessage(`Loaded ${escapeHtml(data.week.title)}.`);
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadWeeks() {
    setBusy(true);
    try {
      const data = await api({ action: "list_weeks", limit: 60 });
      const weeks = data.weeks || [];
      weekSelect.innerHTML = weeks.map((week) => `<option value="${escapeHtml(week.id)}">${escapeHtml(week.title)} (${escapeHtml(new Date(week.nomination_opens).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}) &mdash; ${escapeHtml(phaseLabel(week.phase))}</option>`).join("");
      const defaultWeek = pickDefaultWeek(weeks);
      if (defaultWeek) {
        await selectWeek(defaultWeek.id);
      } else {
        setMessage("No weeks scheduled yet -- create one below.");
      }
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  typeTabs.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-awards-type]");
    if (!button || busy) return;
    currentType = button.dataset.awardsType;
    root.dataset.activeType = currentType;
    typeTabs.querySelectorAll("button").forEach((tab) => tab.setAttribute("aria-pressed", String(tab === button)));
    await loadWeeks();
  });

  weekSelect.addEventListener("change", () => selectWeek(weekSelect.value));

  weekActions.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-week-action]");
    if (!button) return;
    const action = button.dataset.weekAction;
    if (action === "close_nominations" && !window.confirm("Close nominations for this week? The public form will stop accepting new nominations.")) return;
    if (action === "close_voting" && !window.confirm("Close voting for this week? No more votes will be accepted.")) return;

    setBusy(true);
    setMessage("Updating week status.");
    try {
      await api({ action, week_id: currentWeekId });
      setMessage("Week status updated.");
      await selectWeek(currentWeekId);
      await loadWeeks();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  nominationRows.addEventListener("change", async (event) => {
    const reviewToggle = event.target.closest("[data-review-toggle]");
    const selectToggle = event.target.closest("[data-select-toggle]");
    if (!reviewToggle && !selectToggle) return;

    setBusy(true);
    try {
      if (reviewToggle) {
        await api({ action: "review_nomination", nomination_id: reviewToggle.dataset.reviewToggle, reviewed: reviewToggle.checked });
      } else if (selectToggle) {
        await api({ action: "select_nomination", nomination_id: selectToggle.dataset.selectToggle, selected: selectToggle.checked });
      }
      setMessage("Saved.");
      currentDetail && renderStats(currentDetail);
    } catch (error) {
      setMessage(error.message, "error");
      await selectWeek(currentWeekId);
    } finally {
      setBusy(false);
    }
  });

  nominationRows.addEventListener("click", async (event) => {
    const openButton = event.target.closest("[data-open-promote]");
    const cancelButton = event.target.closest("[data-cancel-promote]");
    const confirmButton = event.target.closest("[data-confirm-promote]");

    if (openButton) {
      const id = openButton.dataset.openPromote;
      const nomination = (currentDetail.nominations || []).find((row) => row.id === id);
      if (!nomination) return;
      const slot = nominationRows.querySelector(`[data-promote-slot="${CSS.escape(id)}"]`);
      slot.innerHTML = promoteFormHtml(nomination);
      return;
    }

    if (cancelButton) {
      const slot = nominationRows.querySelector(`[data-promote-slot="${CSS.escape(cancelButton.dataset.cancelPromote)}"]`);
      slot.innerHTML = "";
      return;
    }

    if (confirmButton) {
      const id = confirmButton.dataset.confirmPromote;
      const form = nominationRows.querySelector(`[data-promote-form="${CSS.escape(id)}"]`);
      const getValue = (field) => form.querySelector(`[data-field="${field}"]`).value;

      setBusy(true);
      setMessage("Creating finalist.");
      try {
        await api({
          action: "promote_nomination",
          nomination_id: id,
          image_url: getValue("image_url"),
          achievement: getValue("achievement"),
          description: getValue("description"),
          sort_order: Number(getValue("sort_order")) || 0
        });
        setMessage("Finalist created.");
        await selectWeek(currentWeekId);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  finalistList.addEventListener("click", async (event) => {
    const openEdit = event.target.closest("[data-open-edit]");
    const cancelEdit = event.target.closest("[data-cancel-edit]");
    const confirmEdit = event.target.closest("[data-confirm-edit]");
    const removeButton = event.target.closest("[data-remove-finalist]");

    if (openEdit) {
      const id = openEdit.dataset.openEdit;
      const finalist = (currentDetail.finalists || []).find((row) => row.id === id);
      if (!finalist) return;
      const slot = finalistList.querySelector(`[data-edit-slot="${CSS.escape(id)}"]`);
      slot.innerHTML = finalistEditFormHtml(finalist);
      return;
    }

    if (cancelEdit) {
      const slot = finalistList.querySelector(`[data-edit-slot="${CSS.escape(cancelEdit.dataset.cancelEdit)}"]`);
      slot.innerHTML = "";
      return;
    }

    if (confirmEdit) {
      const id = confirmEdit.dataset.confirmEdit;
      const form = finalistList.querySelector(`[data-edit-form="${CSS.escape(id)}"]`);
      const getValue = (field) => form.querySelector(`[data-field="${field}"]`).value;

      setBusy(true);
      setMessage("Saving finalist.");
      try {
        await api({
          action: "update_finalist",
          finalist_id: id,
          image_url: getValue("image_url"),
          achievement: getValue("achievement"),
          description: getValue("description"),
          sort_order: Number(getValue("sort_order")) || 0
        });
        setMessage("Finalist updated.");
        await selectWeek(currentWeekId);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (removeButton) {
      if (!window.confirm("Remove this finalist? This does not delete the original nomination, and votes already cast for it are removed from view.")) return;
      setBusy(true);
      setMessage("Removing finalist.");
      try {
        await api({ action: "remove_finalist", finalist_id: removeButton.dataset.removeFinalist });
        setMessage("Finalist removed.");
        await selectWeek(currentWeekId);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  winnerActions.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-confirm-winner]")) return;

    const checked = [...finalistList.querySelectorAll('input[type="radio"]:checked')].map((input) => input.value);
    if (!checked.length) {
      setMessage("Choose at least one winner first.", "error");
      return;
    }

    if (!window.confirm("Announce this winner? This closes the week and makes the winner visible on the public site.")) return;

    setBusy(true);
    setMessage("Announcing winner.");
    try {
      await api({ action: "announce_winner", week_id: currentWeekId, finalist_ids: checked });
      setMessage("Winner announced.");
      await selectWeek(currentWeekId);
      await loadWeeks();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("Scheduling week.");

    const formData = new FormData(createForm);
    try {
      await api({
        action: "create_week",
        nomination_opens: new Date(formData.get("nomination_opens")).toISOString(),
        nomination_closes: new Date(formData.get("nomination_closes")).toISOString(),
        voting_opens: new Date(formData.get("voting_opens")).toISOString(),
        voting_closes: new Date(formData.get("voting_closes")).toISOString()
      });
      setMessage("Week scheduled.");
      createForm.reset();
      await loadWeeks();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  nominateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentWeekId) {
      setMessage("Choose a week first.", "error");
      return;
    }

    setBusy(true);
    setMessage("Adding nomination.");

    const formData = new FormData(nominateForm);
    const get = (field) => (formData.get(field) || "").toString();

    try {
      await api({
        action: "create_nomination",
        week_id: currentWeekId,
        school: get("school"),
        reason: get("reason"),
        result_url: get("result_url"),
        photo_url: get("photo_url"),
        meet_name: get("meet_name"),
        performance_date: get("performance_date"),
        nominator_name: get("nominator_name"),
        nominator_email: get("nominator_email"),
        category: get("category"),
        team_name: get("team_name"),
        sport: get("sport"),
        division: get("division"),
        achievement: get("achievement"),
        athlete_name: get("athlete_name"),
        grade: get("grade"),
        gender: get("gender"),
        event_name: get("event_name"),
        performance: get("performance")
      });
      setMessage("Nomination added.");
      nominateForm.reset();
      await selectWeek(currentWeekId);
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  async function start() {
    try {
      await api({ action: "list_weeks", limit: 1 });
      loading.hidden = true;
      dashboard.hidden = false;
      await loadWeeks();
    } catch (error) {
      loading.innerHTML =
        "<h2>Admin access required</h2><p>" +
        escapeHtml(error.message) +
        '</p><a class="button button-primary" href="/admin/">Open admin sign in</a>';
    }
  }

  start();
})();
