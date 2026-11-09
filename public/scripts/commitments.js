// College commitment tracker (WO-38). The rows are rendered on the server
// (src/pages/commitments.mjs); this only filters them and, for a signed-in
// admin, adds each row's share card link.
(() => {
  const root = document.querySelector("[data-commitments]");
  if (!root) return;
  const classYear = root.dataset.classYear;
  const rows = [...root.querySelectorAll(".cm-row")];
  const levelSelect = root.querySelector("[data-cm-level]");
  const eventSelect = root.querySelector("[data-cm-event]");
  const count = root.querySelector("[data-cm-count]");

  function apply() {
    const level = levelSelect.value;
    const event = eventSelect.value;
    let shown = 0;
    for (const row of rows) {
      const visible = (!level || row.dataset.level === level) && (!event || row.dataset.event === event);
      row.hidden = !visible;
      if (visible) shown += 1;
    }
    count.textContent = `${shown} commitment${shown === 1 ? "" : "s"}`;
  }

  levelSelect.addEventListener("change", apply);
  eventSelect.addEventListener("change", apply);

  fetch("/api/admin/auth/", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((data) => {
      if (!data.authenticated) return;
      for (const row of rows) {
        const slot = row.querySelector("[data-cm-admin]");
        const id = row.dataset.id;
        if (!slot || !id) continue;
        slot.innerHTML = `<a href="/api/admin/commitment-card/?class=${encodeURIComponent(classYear)}&id=${encodeURIComponent(id)}">Download share card</a>`;
        slot.hidden = false;
      }
    })
    .catch(() => {});
})();
