// /teams/ "Load more teams" and the A to Z bar (site redesign step 2).
// The first rows come rendered from the server (src/pages/teamsdirectory.mjs);
// the rest of the filtered list is in the page as data. Row markup matches
// teamRowHtml() there.
(() => {
  const list = document.querySelector("[data-teams-list]");
  const restEl = document.querySelector("[data-teams-rest]");
  if (!list) return;
  const PAGE = 28;
  let rest = [];
  try { rest = restEl ? JSON.parse(restEl.textContent) : []; } catch { rest = []; }
  const more = document.querySelector("[data-teams-more]");
  const shownEl = document.querySelector("[data-teams-shown]");
  const rangeEl = document.querySelector("[data-teams-range]");
  const total = list.querySelectorAll(".pw-team-row").length + rest.length;
  const firstLetter = list.querySelector("[data-letter]")?.dataset.letter || "";

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (name) => String(name || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const letterOf = (name) => { const c = String(name || "").trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  const logo = (row) => row.l
    ? `<span class="pw-logo pw-logo-sm"><img src="${esc(row.l)}" alt="${esc(row.n)} logo" loading="lazy" decoding="async"></span>`
    : `<span class="pw-logo pw-logo-sm pw-logo-initials" aria-hidden="true">${esc(initials(row.n))}</span>`;
  const rowHtml = (row) => `<a class="pw-team-row" href="/teams/${esc(row.s)}/"${row.c ? ` style="--pw-edge:${esc(row.c)}"` : ""}>${logo(row)}<span class="pw-team-main"><b>${esc(row.n)}</b>${row.p ? `<span>${esc(row.p)}</span>` : ""}</span>${row.t ? `<span class="pw-pill">${esc(row.t)}</span>` : ""}<span class="pw-chev" aria-hidden="true">&rsaquo;</span></a>`;

  function append(rows) {
    for (const row of rows) {
      const l = letterOf(row.n);
      let group = list.querySelector(`[data-letter="${l}"] .pw-team-grid`);
      if (!group) {
        list.insertAdjacentHTML("beforeend", `<section class="pw-letter" id="letter-${l}" data-letter="${l}"><h2>${l}</h2><div class="pw-team-grid"></div></section>`);
        group = list.querySelector(`[data-letter="${l}"] .pw-team-grid`);
      }
      group.insertAdjacentHTML("beforeend", rowHtml(row));
    }
    const shown = list.querySelectorAll(".pw-team-row").length;
    if (shownEl) shownEl.textContent = `${shown} of ${total} shown`;
    const groups = list.querySelectorAll("[data-letter]");
    const last = groups[groups.length - 1]?.dataset.letter || "";
    if (rangeEl && firstLetter) rangeEl.textContent = firstLetter === last ? `Showing ${firstLetter}` : `Showing ${firstLetter} to ${last}`;
    if (more) more.hidden = rest.length === 0;
  }

  function loadMore() {
    append(rest.splice(0, PAGE));
  }
  more?.addEventListener("click", loadMore);

  // A to Z: load up to (and including) that letter, then jump to it.
  document.querySelectorAll("[data-az]").forEach((a) => {
    a.addEventListener("click", (event) => {
      const l = a.dataset.az;
      if (!document.getElementById(`letter-${l}`)) {
        const until = rest.findIndex((row) => letterOf(row.n) > l);
        append(rest.splice(0, until === -1 ? rest.length : until));
      }
      const target = document.getElementById(`letter-${l}`);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: "start", behavior: "instant" });
      history.replaceState(null, "", `#letter-${l}`);
      document.querySelectorAll("[data-az]").forEach((x) => x.removeAttribute("aria-current"));
      a.setAttribute("aria-current", "true");
    });
  });

  // Arriving with #letter-X: load and jump.
  const hash = (location.hash.match(/^#letter-([A-Z])$/) || [])[1];
  if (hash) document.querySelector(`[data-az="${hash}"]`)?.click();
})();
