(() => {
  const loadingBox = document.querySelector("[data-race-public-loading]");
  const messageBox = document.querySelector("[data-race-public-message]");
  const root = document.querySelector("[data-race-public-root]");
  const teamEl = document.querySelector("[data-race-public-team]");
  const nameEl = document.querySelector("[data-race-public-name]");
  const statusEl = document.querySelector("[data-race-public-status]");
  const updatedEl = document.querySelector("[data-race-public-updated]");
  const rowsEl = document.querySelector("[data-race-public-rows]");

  const requiredElements = [loadingBox, messageBox, root, teamEl, nameEl, statusEl, updatedEl, rowsEl];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = String(params.get("race") || "").trim();

  const ENDPOINT = "/api/race/public/";

  const STATUS_LABELS = {
    draft: "Not started",
    scheduled: "Not started",
    live: "Live",
    finished: "Finished",
    reviewed: "Finished",
    cancelled: "Cancelled"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(seconds < 600 ? 1 : 0);
    return m + ":" + String(s).padStart(seconds < 600 ? 4 : 2, "0");
  }

  function showMessage(text) {
    loadingBox.hidden = true;
    root.hidden = true;
    messageBox.hidden = !text;
    messageBox.innerHTML = text
      ? '<div class="info-card"><h2>Can\'t watch this race</h2><p>' + escapeHtml(text) + '</p></div>'
      : "";
  }

  function bestRowFor(participant) {
    const withTimes = participant.splits.filter((s) => s.elapsed_seconds != null && !s.is_dns && !s.is_dnf);
    if (withTimes.length === 0) return null;
    return withTimes.reduce((latest, split) => {
      const checkpoint = checkpointsById.get(split.race_checkpoint_id);
      const latestCheckpoint = latest ? checkpointsById.get(latest.race_checkpoint_id) : null;
      if (!latest || (checkpoint && latestCheckpoint && checkpoint.sort_order > latestCheckpoint.sort_order)) {
        return split;
      }
      return latest;
    }, null);
  }

  let checkpointsById = new Map();

  function sortKey(participant) {
    if (participant.status === "dns") return [3, 0];
    if (participant.status === "dnf") return [2, 0];
    const best = bestRowFor(participant);
    if (!best) return [1, 0];
    const checkpoint = checkpointsById.get(best.race_checkpoint_id);
    const isFinish = checkpoint?.is_finish ? 0 : 1;
    // Finishers first (sorted by finish time), then in-progress runners
    // by furthest checkpoint reached (sorted by their time at it).
    return [isFinish, -(checkpoint?.sort_order || 0), best.elapsed_seconds];
  }

  function compareParticipants(a, b) {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  }

  function renderRow(participant, rank) {
    const best = bestRowFor(participant);
    const checkpointLabel = best ? checkpointsById.get(best.race_checkpoint_id)?.label || "--" : "--";
    const time = best ? formatClock(best.elapsed_seconds) : "--";
    const tag = participant.status === "dns" ? "DNS" : (participant.status === "dnf" ? "DNF" : "");

    return (
      '<tr>' +
        '<td class="race-public-rank">' + (tag ? "--" : rank) + '</td>' +
        '<td>' + escapeHtml(participant.display_name) + '</td>' +
        '<td>' + escapeHtml(participant.race_group || "") + '</td>' +
        '<td>' + escapeHtml(checkpointLabel) + '</td>' +
        '<td>' + escapeHtml(time) + '</td>' +
        '<td>' + (tag ? '<span class="race-public-tag">' + tag + '</span>' : '') + '</td>' +
      '</tr>'
    );
  }

  function render(data) {
    checkpointsById = new Map((data.checkpoints || []).map((c) => [c.id, c]));

    teamEl.textContent = data.team ? data.team.school_name : "Podium Watch";
    nameEl.textContent = data.session.name;
    statusEl.textContent = STATUS_LABELS[data.session.status] || data.session.status;
    statusEl.className = "race-public-status race-public-status-" + data.session.status;
    updatedEl.textContent = "Updated " + new Date().toLocaleTimeString();

    const sorted = [...(data.participants || [])].sort(compareParticipants);
    let rank = 0;
    rowsEl.innerHTML = sorted.map((participant) => {
      const best = bestRowFor(participant);
      if (best && participant.status !== "dns" && participant.status !== "dnf") rank += 1;
      return renderRow(participant, rank);
    }).join("") || '<tr><td colspan="6">No runners entered yet.</td></tr>';

    loadingBox.hidden = true;
    messageBox.hidden = true;
    root.hidden = false;
  }

  if (!sessionId) {
    showMessage("This link is missing a race ID.");
    return;
  }

  window.PodiumRacePoll.watch({
    fetchOnce: () =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      }).then((response) =>
        response.json().catch(() => ({})).then((data) => {
          if (!response.ok) throw new Error(data.error || "This race could not be loaded.");
          return data;
        })
      ),
    onData: render,
    onError: (error) => showMessage(error.message || "This race could not be loaded.")
  });
})();
