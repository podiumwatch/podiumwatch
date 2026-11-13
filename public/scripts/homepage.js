// Homepage-only behavior (site redesign step 7, 2026-11-13): Latest
// results and Upcoming meets in the "Right now" panel, and the OATCCC poll
// buttons. Each module is guarded on its own so one failing never takes
// the others down.
//
// Latest results and Upcoming meets reuse the same /api/meets/ data and
// PodiumOhioToday.computeOhioToday() as /meets/ and the ticker, so they
// can never disagree about what counts as completed or upcoming. Each
// block stays hidden until it has at least one meet: an empty block does
// not render, and it comes back by itself once meets are listed.
//
// The My Podium "follow your school" panel left the homepage in the
// redesign; My Podium is in the Tools row and the phone bottom bar.
(() => {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function dateChip(value) {
    if (!value) return "TBD";
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return "TBD";
    const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/New_York" }).format(date).toUpperCase();
    return `${month} ${date.getDate()}`;
  }

  function meetRow(meet, dateValue) {
    const location = [meet.venue_name, meet.city].filter(Boolean).join(", ");
    return `<li><a href="/meetdetail/?slug=${encodeURIComponent(meet.slug)}"><span class="pw-meet-d">${escapeHtml(dateChip(dateValue))}</span><span><b>${escapeHtml(meet.name)}</b>${location ? `<small>${escapeHtml(location)}</small>` : ""}</span></a></li>`;
  }

  function fill(panelSelector, listSelector, meets, dateOf) {
    const panel = document.querySelector(panelSelector);
    const list = document.querySelector(listSelector);
    if (!panel || !list) return;
    if (!meets.length) { panel.hidden = true; return; }
    list.innerHTML = meets.map((meet) => meetRow(meet, dateOf(meet))).join("");
    panel.hidden = false;
    const rail = panel.closest("[data-rail-empty]");
    if (rail) rail.removeAttribute("data-rail-empty");
  }

  if (window.PodiumOhioToday && document.querySelector("[data-latest-results-panel], [data-upcoming-meets-panel]")) {
    window.PodiumOhioToday.computeOhioToday().then((today) => {
      fill("[data-latest-results-panel]", "[data-latest-results-list]", (today.newestCompleted || []).slice(0, 3), (meet) => meet.end_date || meet.meet_date);
      fill("[data-upcoming-meets-panel]", "[data-upcoming-meets-list]", (today.upcoming || []).slice(0, 3), (meet) => meet.meet_date);
    }).catch(() => {
      // The links to /meets/ in the header and footer still work; an
      // unreachable calendar just leaves these blocks hidden.
    });
  }

  // ---- OATCCC Coaches Poll: Boys/Girls and D1 to D4 buttons -------------
  const poll = document.querySelector("[data-home-poll]");
  if (poll) {
    try {
      const data = JSON.parse(poll.querySelector("[data-poll-data]").textContent);
      const list = poll.querySelector("[data-poll-list]");
      let gender = "boys";
      let division = "1";
      const draw = () => {
        const rows = (data[gender] && data[gender][division]) || [];
        list.innerHTML = rows.map(([team, points], i) => `<li><span class="pw-poll-n">${i + 1}</span><b>${escapeHtml(team)}</b><span>${escapeHtml(points)}</span></li>`).join("");
        poll.querySelectorAll("[data-poll-gender]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pollGender === gender)));
        poll.querySelectorAll("[data-poll-division]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pollDivision === division)));
      };
      poll.querySelectorAll("[data-poll-gender]").forEach((b) => b.addEventListener("click", () => { gender = b.dataset.pollGender; draw(); }));
      poll.querySelectorAll("[data-poll-division]").forEach((b) => b.addEventListener("click", () => { division = b.dataset.pollDivision; draw(); }));
    } catch {
      // The built list (Boys D1) stays, and "See the full poll" still works.
    }
  }
})();
