// "Divisions by school" on the OATCCC Divisions page. Copied to dist/ only
// with OATCCC_LIVE=1 and OATCCC_DIVISION_LIST_LIVE=1.
(() => {
  const root = document.querySelector("[data-ox-divisions]");
  if (!root) return;
  const input = root.querySelector("[data-ox-divisions-q]");
  const status = root.querySelector("[data-ox-divisions-status]");
  const table = root.querySelector("[data-ox-divisions-table]");
  const body = table.querySelector("tbody");
  const MAX = 60;
  let schools = [];

  const norm = (value) => String(value || "").toLowerCase().replace(/[.']/g, "").replace(/\s+/g, " ").trim();
  const cell = (text, label) => {
    const td = document.createElement("td");
    td.textContent = text || "None";
    if (!text) td.className = "none";
    td.dataset.l = label;
    return td;
  };

  function render() {
    const q = norm(input.value);
    const hits = q ? schools.filter((s) => s.key.includes(q)) : schools;
    body.replaceChildren(...hits.slice(0, MAX).map((s) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = s.name;
      tr.append(th, cell(s.city, "City"), cell(s.boys, "Boys"), cell(s.girls, "Girls"));
      return tr;
    }));
    table.hidden = hits.length === 0;
    if (!hits.length) status.textContent = `No school matches "${input.value.trim()}". Try the town name, or the name your school uses with the OHSAA.`;
    else if (hits.length > MAX) status.textContent = `${hits.length} schools. Showing the first ${MAX}; type more to narrow it down.`;
    else status.textContent = `${hits.length} ${hits.length === 1 ? "school" : "schools"}.`;
  }

  fetch("/api/oatccc/divisions", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => {
      schools = (data.schools || []).map((s) => ({ ...s, key: norm(`${s.name} ${s.city}`) }));
      input.addEventListener("input", render);
      render();
    })
    .catch(() => { status.textContent = "The division list could not be loaded. Please try again later."; });
})();
