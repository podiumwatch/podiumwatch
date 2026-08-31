(() => {
  const rowsEl = document.querySelector("[data-leaders-rows]");
  if (!rowsEl) return;

  const genderButtons = Array.from(document.querySelectorAll("[data-leaders-gender]"));
  const yearSelect = document.querySelector("[data-leaders-year]");
  const gradeSelect = document.querySelector("[data-leaders-grade]");
  const divisionSelect = document.querySelector("[data-leaders-division]");

  let gender = "boys";
  let filtersLoaded = false;
  let loading = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(isoDate) {
    if (!isoDate) return "Date unknown";
    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function gradeLabel(grade) {
    return grade ? `${grade}th` : "--";
  }

  async function api(body) {
    const response = await fetch("/api/rankings/leaders/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "State Leaders could not be loaded.");
    return payload;
  }

  function renderRows(entries) {
    if (!entries.length) {
      rowsEl.innerHTML = '<tr><td colspan="5" class="leaders-empty">No results match these filters yet. Try a different year, grade, or division.</td></tr>';
      return;
    }

    rowsEl.innerHTML = entries.map((entry) => `
      <tr data-leaders-rank="${entry.rank}">
        <td class="leaders-cell-rank">${entry.rank}</td>
        <td class="leaders-cell-athlete">
          ${entry.athlete_slug ? `<a href="/athletes/${escapeHtml(entry.athlete_slug)}/">${escapeHtml(entry.athlete_name)}</a>` : escapeHtml(entry.athlete_name)}
          <div class="leaders-cell-school">${escapeHtml(entry.school_name)}${entry.division ? ` &middot; ${escapeHtml(entry.division)}` : ""}</div>
        </td>
        <td>${escapeHtml(gradeLabel(entry.grade))}</td>
        <td>${escapeHtml(entry.meet_name || "Meet unknown")}<div class="leaders-cell-school">${escapeHtml(formatDate(entry.meet_date))}</div></td>
        <td class="leaders-cell-time">${escapeHtml(entry.mark_text)}</td>
      </tr>
    `).join("");
  }

  function populateYears(years, selectedYear) {
    if (filtersLoaded) return;
    filtersLoaded = true;
    yearSelect.innerHTML = (years || []).map((year) => `<option value="${year}">${year}</option>`).join("");
    if (selectedYear) yearSelect.value = String(selectedYear);
  }

  async function load() {
    if (loading) return;
    loading = true;
    rowsEl.innerHTML = '<tr><td colspan="5" class="leaders-loading">Loading State Leaders.</td></tr>';

    try {
      const data = await api({
        gender,
        season_year: yearSelect.value || undefined,
        grade: gradeSelect.value,
        division_number: divisionSelect.value
      });

      populateYears(data.filters?.years, data.season_year);
      renderRows(data.entries || []);
    } catch (error) {
      rowsEl.innerHTML = `<tr><td colspan="5" class="leaders-error">${escapeHtml(error.message)}</td></tr>`;
    } finally {
      loading = false;
    }
  }

  genderButtons.forEach((button) => button.addEventListener("click", () => {
    gender = button.dataset.leadersGender;
    genderButtons.forEach((item) => item.classList.toggle("active", item === button));
    load();
  }));

  yearSelect.addEventListener("change", load);
  gradeSelect.addEventListener("change", load);
  divisionSelect.addEventListener("change", load);

  load();
})();
