// Mock State "What if?" editor (2026-11-02).
//
// Lets a visitor change any runner's time in a mock State meet and see the
// re-scored team standings. Everything happens in this browser: edits are
// kept in localStorage for that visitor only and never change the site's
// own projection, which stays on the page untouched below the editor.
//
// The scoring here mirrors src/lib/mock_scoring.mjs scoreTeams() exactly,
// with the State rule used everywhere on the site: team scores and ranks
// come from a team-only pass (individual qualifiers do not take places
// from team runners); the overall finish place comes from the combined
// pass. Same-time ties share the average place, a team needs five
// runners to score, the top five score, and a team-score tie goes to the
// better sixth runner. tests/mock-whatif.test.mjs checks this file
// against the server's own State results for every division and basis.
//
// Each State section carries its field as
// <script type="application/json" data-whatif-field> (see
// stateWhatIfFieldJson in src/pages/mockpostseason.mjs).
(function (root) {
  "use strict";

  // ---- Pure helpers (also exercised by the Node test) ----

  // "15:44", "15:44.2", "15:44.25" -> centiseconds; null if not a time.
  function parseTime(value) {
    const m = /^\s*(\d{1,2}):([0-5]\d)(?:\.(\d{1,2}))?\s*$/.exec(String(value || ""));
    if (!m) return null;
    const frac = m[3] ? Number(m[3].padEnd(2, "0")) : 0;
    const cs = (Number(m[1]) * 60 + Number(m[2])) * 100 + frac;
    if (cs < 8 * 60 * 100 || cs > 45 * 60 * 100) return null;
    return cs;
  }

  function formatTime(cs) {
    const total = Math.round(cs);
    const minutes = Math.floor(total / 6000);
    const rest = total - minutes * 6000;
    const seconds = Math.floor(rest / 100);
    const hundredths = rest % 100;
    const frac = hundredths % 10 === 0 ? `.${hundredths / 10}` : `.${String(hundredths).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}${frac}`;
  }

  // Sorts entries by cs and gives each the average of the places it ties
  // over (two tied for 7th/8th both get 7.5). Returns Map(entry -> place).
  function placeEntries(entries) {
    const sorted = entries.slice().sort((a, b) => a.cs - b.cs);
    const places = new Map();
    let i = 0;
    let place = 1;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].cs === sorted[i].cs) j += 1;
      const count = j - i + 1;
      const avg = (place * 2 + count - 1) / 2;
      for (let k = i; k <= j; k += 1) places.set(sorted[k], avg);
      place += count;
      i = j + 1;
    }
    return places;
  }

  // field: { teams: [{ name, label, runners: [{ key, name, label, cs }] }],
  //          individuals: [{ key, name, label, school, schoolLabel, cs }] }
  // edits: { [runnerKey]: cs }
  function scoreField(field, edits) {
    const timeOf = (r) => (edits && Object.prototype.hasOwnProperty.call(edits, r.key) ? edits[r.key] : r.cs);

    // Team positions: each team's runners in time order (stable).
    const teamEntries = [];
    const teams = field.teams.map((team, teamIndex) => {
      const runners = team.runners.map((r) => ({ ...r, cs: timeOf(r), team: team.name }));
      runners.sort((a, b) => a.cs - b.cs);
      runners.forEach((r, i) => { r.pos = i + 1; teamEntries.push(r); });
      return { name: team.name, label: team.label, order: teamIndex, runners };
    });

    // Team-only pass: team scores and ranks.
    const teamPlaces = placeEntries(teamEntries);
    for (const t of teams) {
      t.runners.forEach((r) => { r.teamPlace = teamPlaces.get(r); });
      t.complete = t.runners.length >= 5;
      t.score = t.complete ? t.runners.filter((r) => r.pos <= 5).reduce((s, r) => s + r.teamPlace, 0) : null;
      const sixth = t.runners.find((r) => r.pos === 6);
      const seventh = t.runners.find((r) => r.pos === 7);
      t.sixth = sixth ? sixth.teamPlace : null;
      t.seventh = seventh ? seventh.teamPlace : null;
    }
    const ranked = teams.filter((t) => t.complete).sort((a, b) =>
      a.score !== b.score ? a.score - b.score : (a.sixth ?? Infinity) - (b.sixth ?? Infinity));
    ranked.forEach((t, i) => { t.rank = i + 1; });
    const incomplete = teams.filter((t) => !t.complete);
    incomplete.forEach((t) => { t.rank = null; });

    // Combined pass: overall finish place for every runner.
    const individuals = field.individuals.map((r) => ({ ...r, cs: timeOf(r) }));
    const all = [...teamEntries, ...individuals];
    const overall = placeEntries(all);
    all.forEach((r) => { r.place = overall.get(r); });

    return { teams: [...ranked, ...incomplete], individuals, runners: all };
  }

  const api = { parseTime, formatTime, scoreField };
  root.PWWhatIf = api;

  // ---- Browser UI ----
  if (typeof document === "undefined") return;

  const STORAGE_PREFIX = "pw-mock-whatif:v1:";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtPts = (n) => (n == null ? "--" : Number.isInteger(n) ? String(n) : n.toFixed(1));

  function storageKey(section) {
    return `${STORAGE_PREFIX}${location.pathname}:${section.id}:${section.dataset.basis || "default"}`;
  }
  function loadEdits(section) {
    try {
      const raw = localStorage.getItem(storageKey(section));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveEdits(section, edits) {
    try {
      if (Object.keys(edits).length) localStorage.setItem(storageKey(section), JSON.stringify(edits));
      else localStorage.removeItem(storageKey(section));
    } catch (e) { /* storage blocked: edits still work until the page closes */ }
  }
  function readField(section) {
    const el = section.querySelector("script[data-whatif-field]");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  const state = new WeakMap(); // section -> { field, edits, base }

  function refreshBadge(section) {
    const btn = section.querySelector("[data-whatif-open]");
    if (!btn) return;
    const count = Object.keys(loadEdits(section)).length;
    const badge = btn.querySelector("[data-whatif-count]");
    if (badge) badge.textContent = count ? `${count} edit${count === 1 ? "" : "s"} saved` : "";
    if (badge) badge.hidden = !count;
  }
  function refreshAllBadges() {
    document.querySelectorAll(".mp-section [data-whatif-open]").forEach((btn) => refreshBadge(btn.closest(".mp-section")));
  }

  function buildPanel(section) {
    const field = readField(section);
    if (!field) return null;
    const edits = loadEdits(section);
    // Drop saved edits for runners no longer in this field.
    const keys = new Set([...field.teams.flatMap((t) => t.runners.map((r) => r.key)), ...field.individuals.map((r) => r.key)]);
    Object.keys(edits).forEach((k) => { if (!keys.has(k)) delete edits[k]; });
    const base = scoreField(field, {});
    state.set(section, { field, edits, base });

    const runnerRow = (r, schoolLabel) => {
      const edited = Object.prototype.hasOwnProperty.call(edits, r.key);
      return `<div class="mp-wi-runner${edited ? " is-edited" : ""}" data-wi-row data-search="${esc(`${r.label} ${schoolLabel}`.toLowerCase())}">
        <span class="mp-wi-name">${esc(r.label)}</span>
        <span class="mp-wi-orig">${esc(formatTime(r.cs))}</span>
        <input class="mp-wi-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="What-if time for ${esc(r.label)}, ${esc(schoolLabel)} (now ${esc(formatTime(r.cs))})" placeholder="${esc(formatTime(r.cs))}" value="${edited ? esc(formatTime(edits[r.key])) : ""}" data-wi-key="${esc(r.key)}">
      </div>`;
    };
    const teamGroups = field.teams.map((t) => `<details class="mp-wi-team" data-wi-group data-search="${esc(t.label.toLowerCase())}">
        <summary>${esc(t.label)}</summary>
        ${t.runners.map((r) => runnerRow(r, t.label)).join("")}
      </details>`).join("");
    const indGroup = field.individuals.length ? `<details class="mp-wi-team" data-wi-group data-search="individual qualifiers">
        <summary>Individual qualifiers (${field.individuals.length})</summary>
        ${field.individuals.map((r) => runnerRow(r, r.schoolLabel)).join("")}
      </details>` : "";

    const panel = document.createElement("div");
    panel.className = "mp-whatif-panel";
    panel.innerHTML = `
      <p class="mp-wi-note"><strong>Your what-if.</strong> Only you see this. Edits are saved in this browser and never change Podium Watch's projection below.</p>
      <div class="mp-wi-results" data-wi-results aria-live="polite"></div>
      <label class="mp-wi-searchlabel">Find a runner or team
        <input class="mp-wi-search" type="search" placeholder="Type a name or school" data-wi-search>
      </label>
      <p class="mp-wi-help">Type a new time like 15:44 or 15:44.2 next to any runner. Leave it blank to use the projected time.</p>
      <div class="mp-wi-editor">${teamGroups}${indGroup}</div>
      <button type="button" class="mp-wi-reset" data-wi-reset>Reset my edits</button>`;
    return panel;
  }

  function renderResults(section) {
    const st = state.get(section);
    const box = section.querySelector("[data-wi-results]");
    if (!st || !box) return;
    const editKeys = Object.keys(st.edits);
    if (!editKeys.length) {
      box.innerHTML = `<p class="mp-wi-empty">Change a time below to see the new team scores.</p>`;
      return;
    }
    const now = scoreField(st.field, st.edits);
    const baseTeam = new Map(st.base.teams.map((t) => [t.name, t]));
    const baseRunner = new Map(st.base.runners.map((r) => [r.key, r]));
    const nowRunner = new Map(now.runners.map((r) => [r.key, r]));
    const allField = [...st.field.teams.flatMap((t) => t.runners.map((r) => ({ ...r, schoolLabel: t.label }))), ...st.field.individuals];
    const byKey = new Map(allField.map((r) => [r.key, r]));

    const changes = editKeys.filter((k) => byKey.has(k)).map((k) => {
      const r = byKey.get(k), b = baseRunner.get(k), n = nowRunner.get(k);
      return `<li><strong>${esc(r.label)}</strong> (${esc(r.schoolLabel)}): ${esc(formatTime(r.cs))} &rarr; ${esc(formatTime(st.edits[k]))}, overall place ${esc(fmtPts(b.place))} &rarr; ${esc(fmtPts(n.place))}</li>`;
    }).join("");

    const rowFor = (t) => {
      const b = baseTeam.get(t.name);
      const moved = b && b.rank && t.rank ? b.rank - t.rank : 0;
      const delta = b && b.score != null && t.score != null ? t.score - b.score : 0;
      const changed = moved !== 0 || delta !== 0;
      const moveHtml = moved > 0 ? `<span class="mp-wi-up">&#9650;${moved}</span>` : moved < 0 ? `<span class="mp-wi-down">&#9660;${-moved}</span>` : "";
      const deltaHtml = delta ? ` <span class="${delta < 0 ? "mp-wi-up" : "mp-wi-down"}">(${delta > 0 ? "+" : ""}${fmtPts(delta)})</span>` : "";
      return `<tr class="${moved ? "is-changed" : ""}"><td>${t.rank ?? "--"} ${moveHtml}</td><td>${esc(t.label)}</td><td>${esc(fmtPts(t.score))}${deltaHtml}</td><td>${esc(fmtPts(b ? b.score : null))}</td></tr>`;
    };
    // Short list first (top five plus every team whose place moved), so
    // the change is visible without scrolling past all 24 teams.
    const movedOrTop = (t) => {
      const b = baseTeam.get(t.name);
      return (t.rank && t.rank <= 5) || (b && b.rank !== t.rank);
    };
    const head = `<thead><tr><th>Rank</th><th>Team</th><th>What-if</th><th>Projected</th></tr></thead>`;
    const shortRows = now.teams.filter(movedOrTop).map(rowFor).join("");
    const allRows = now.teams.map(rowFor).join("");

    box.innerHTML = `<p class="mp-wi-label">Your changes</p><ul class="mp-wi-changes">${changes}</ul>
      <p class="mp-wi-label">What-if team scores <span class="mp-wi-sub">(top 5 and every team that moved)</span></p>
      <div class="mp-wi-tablewrap"><table class="mp-wi-table">${head}<tbody>${shortRows}</tbody></table></div>
      <details class="mp-wi-all"><summary>Show all ${now.teams.length} teams</summary><div class="mp-wi-tablewrap"><table class="mp-wi-table">${head}<tbody>${allRows}</tbody></table></div></details>`;
  }

  function openPanel(section) {
    const root = section.querySelector("[data-whatif-root]");
    if (!root) return;
    let panel = root.querySelector(".mp-whatif-panel");
    const btn = root.querySelector("[data-whatif-open]");
    if (!panel) {
      panel = buildPanel(section);
      if (!panel) return;
      root.appendChild(panel);
      renderResults(section);
    } else {
      panel.hidden = !panel.hidden;
    }
    btn.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-whatif-open]");
    if (open) { openPanel(open.closest(".mp-section")); return; }
    const reset = event.target.closest("[data-wi-reset]");
    if (reset) {
      const section = reset.closest(".mp-section");
      const st = state.get(section);
      if (!st) return;
      Object.keys(st.edits).forEach((k) => delete st.edits[k]);
      saveEdits(section, st.edits);
      section.querySelectorAll("[data-wi-key]").forEach((input) => { input.value = ""; input.classList.remove("is-invalid"); input.closest("[data-wi-row]").classList.remove("is-edited"); });
      renderResults(section);
      refreshBadge(section);
    }
  });

  document.addEventListener("input", (event) => {
    const input = event.target;
    const section = input.closest && input.closest(".mp-section");
    if (!section) return;
    if (input.matches("[data-wi-search]")) {
      const q = input.value.trim().toLowerCase();
      section.querySelectorAll("[data-wi-group]").forEach((group) => {
        const groupHit = !q || group.dataset.search.includes(q);
        let anyRow = false;
        group.querySelectorAll("[data-wi-row]").forEach((row) => {
          const hit = !q || groupHit || row.dataset.search.includes(q);
          row.hidden = !hit;
          if (hit) anyRow = true;
        });
        group.hidden = !anyRow;
        if (q && anyRow) group.open = true;
      });
      return;
    }
    if (!input.matches("[data-wi-key]")) return;
    const st = state.get(section);
    if (!st) return;
    const key = input.dataset.wiKey;
    const row = input.closest("[data-wi-row]");
    const text = input.value.trim();
    if (!text) {
      delete st.edits[key];
      input.classList.remove("is-invalid");
      row.classList.remove("is-edited");
    } else {
      const cs = parseTime(text);
      if (cs == null) { input.classList.add("is-invalid"); return; }
      input.classList.remove("is-invalid");
      st.edits[key] = cs;
      row.classList.add("is-edited");
    }
    saveEdits(section, st.edits);
    renderResults(section);
    refreshBadge(section);
  });

  // Sections swapped in by the State time-basis buttons arrive later.
  document.addEventListener("mp:section-swapped", refreshAllBadges);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshAllBadges);
  else refreshAllBadges();
})(typeof window !== "undefined" ? window : globalThis);
