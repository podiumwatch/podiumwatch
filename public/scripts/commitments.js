// College commitment tracker (src/pages/commitments.mjs, WO-38).
(() => {
  const root = document.querySelector("[data-commitments]");
  if (!root) return;
  const classYear = root.dataset.classYear;
  const list = root.querySelector("[data-cm-list]");
  const levelSelect = root.querySelector("[data-cm-level]");
  const eventSelect = root.querySelector("[data-cm-event]");
  const count = root.querySelector("[data-cm-count]");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eventLabel = (value) => ({ cross_country: "Cross country", track_and_field: "Track and field", distance: "Distance", sprints: "Sprints", jumps: "Jumps", throws: "Throws" }[value] || String(value || "").replace(/_/g, " "));
  const formatDate = (iso) => {
    if (!iso) return "";
    const date = new Date(`${iso}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  let rows = [];
  // A signed-in admin also gets each row's 1080x1350 share card (WO-38).
  let isAdmin = false;
  fetch("/api/admin/auth/", { credentials: "same-origin" }).then((r) => r.json()).then((d) => { isAdmin = Boolean(d.authenticated); if (isAdmin && rows.length) render(); }).catch(() => {});

  function render() {
    const level = levelSelect.value;
    const event = eventSelect.value;
    const shown = rows.filter((row) => (!level || row.level === level) && (!event || row.event_group === event));
    count.textContent = `${shown.length} commitment${shown.length === 1 ? "" : "s"}`;
    list.innerHTML = shown.length ? shown.map((row) => `<li class="cm-row${row.gender === "girls" ? " is-girls" : ""}">
      <div><b><a href="/athlete/?slug=${encodeURIComponent(row.athlete_slug)}">${escapeHtml(row.athlete_name)}</a></b><br><small>${escapeHtml(row.school_name || "")}</small></div>
      <div class="cm-college">${row.type === "signing" ? "Signed with" : "Committed to"} ${escapeHtml(row.college)}</div>
      <div class="cm-meta"><span>${escapeHtml(row.level)}</span>${row.event_group ? `<span>${escapeHtml(eventLabel(row.event_group))}</span>` : ""}${row.announced_on ? `<span>${escapeHtml(formatDate(row.announced_on))}</span>` : ""}<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener noreferrer">Source: ${escapeHtml(row.source_label || "announcement")}</a>${isAdmin ? `<a href="/api/admin/commitment-card/?class=${encodeURIComponent(classYear)}&id=${encodeURIComponent(row.id)}">Download share card</a>` : ""}</div>
    </li>`).join("") : `<li class="cm-empty">No ${level || event ? "matching " : ""}commitments listed for the class of ${escapeHtml(classYear)} yet.</li>`;
  }

  function fillSelect(select, values, label) {
    select.innerHTML = `<option value="">${select === levelSelect ? "All levels" : "All"}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(label(value))}</option>`).join("");
  }

  fetch(`/api/commitments/?class=${encodeURIComponent(classYear)}`, { headers: { Accept: "application/json" } })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || "Commitments could not be loaded right now.");
      rows = data.commitments || [];
      const order = ["NCAA I", "NCAA II", "NCAA III", "NAIA", "NJCAA", "Other", "Level not listed"];
      fillSelect(levelSelect, order.filter((level) => rows.some((row) => row.level === level)), (value) => value);
      fillSelect(eventSelect, [...new Set(rows.map((row) => row.event_group).filter(Boolean))], eventLabel);
      render();
    })
    .catch((error) => { list.innerHTML = `<li class="cm-empty">${escapeHtml(error.message)}</li>`; });

  levelSelect.addEventListener("change", render);
  eventSelect.addEventListener("change", render);
})();
