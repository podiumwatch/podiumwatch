(() => {
  const root = document.querySelector("[data-fan-poll-admin-manager]");
  if (!root) return;

  const loading = root.querySelector("[data-fan-poll-admin-loading]");
  const dashboard = root.querySelector("[data-fan-poll-admin-dashboard]");
  const message = root.querySelector("[data-fan-poll-admin-message]");
  const createForm = root.querySelector("[data-fan-poll-admin-create-form]");
  const rows = root.querySelector("[data-fan-poll-admin-rows]");
  let busy = false;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function setMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  }

  async function api(body) {
    const response = await fetch("/api/admin/fan-poll/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The fan poll admin request failed.");
    return payload;
  }

  function formatDate(value) {
    if (!value) return "Unknown";
    return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function statusLabel(status) {
    if (status === "voting_open") return "Voting open";
    if (status === "voting_closed") return "Voting closed";
    return "Scheduled";
  }

  function renderRows(weeks) {
    rows.innerHTML = (weeks || []).length
      ? weeks.map((week) => {
          const actionButton = week.status === "scheduled"
            ? `<button class="button button-primary" type="button" data-open-voting="${escapeHtml(week.id)}">Open voting</button>`
            : week.status === "voting_open"
              ? `<button class="button button-dark" type="button" data-close-voting="${escapeHtml(week.id)}">Close voting</button>`
              : "<span>—</span>";

          return `<tr>
            <td>${escapeHtml(week.title)}</td>
            <td>${escapeHtml(formatDate(week.voting_opens))} &rarr; ${escapeHtml(formatDate(week.voting_closes))}</td>
            <td><span class="fan-poll-admin-badge" data-status="${escapeHtml(week.status)}">${statusLabel(week.status)}</span></td>
            <td>${Number(week.ballot_count) || 0}</td>
            <td>${actionButton}</td>
          </tr>`;
        }).join("")
      : '<tr><td colspan="5">No fan poll weeks scheduled yet.</td></tr>';
  }

  async function loadWeeks() {
    if (busy) return;
    setBusy(true);

    try {
      const data = await api({ action: "list_weeks", limit: 100 });
      renderRows(data.weeks || []);
      setMessage(`${(data.weeks || []).length} week${(data.weeks || []).length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  rows.addEventListener("click", async (event) => {
    const openButton = event.target.closest("[data-open-voting]");
    const closeButton = event.target.closest("[data-close-voting]");

    if (openButton) {
      setBusy(true);
      setMessage("Opening voting.");
      try {
        await api({ action: "open_voting", week_id: openButton.dataset.openVoting });
        setMessage("Voting is now open for this week.");
        await loadWeeks();
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    } else if (closeButton) {
      if (!window.confirm("Close voting for this week? Results will still be visible, but no more ballots will be accepted.")) return;

      setBusy(true);
      setMessage("Closing voting.");
      try {
        await api({ action: "close_voting", week_id: closeButton.dataset.closeVoting });
        setMessage("Voting is now closed for this week.");
        await loadWeeks();
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
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
        sport: formData.get("sport"),
        gender: formData.get("gender"),
        division_number: formData.get("division_number"),
        season_year: formData.get("season_year"),
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
