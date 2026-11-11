// Links school and athlete names to their Podium Watch pages (2026-11-11).
// Loaded on every page; does nothing unless the page marks names:
//   <span data-pw-school="Mason">Mason</span>
//   <span data-pw-athlete="Ryne Reynolds" data-pw-athlete-school="Little Miami">Ryne Reynolds</span>
//   <span data-pw-school-id="{ohio school id}">Beavercreek</span>
// Story tables (recaps) are marked here: an "Athlete"/"Name" column with a
// "School"/"Team" column in the same table.
// /api/links/ answers only exact, unique matches (lib/name_links.mjs); any
// name without a page stays plain text. Pages that draw rows later call
// window.pwNameLinks(root).
(() => {
  const ATHLETE_HEADS = /^(athlete|name|runner)$/i;
  const SCHOOL_HEADS = /^(school|team)$/i;
  const MAX_URL = 6000;

  function markStoryTables(root) {
    root.querySelectorAll("[data-story-slug] table, .article-content table").forEach((table) => {
      if (table.dataset.pwMarked) return;
      table.dataset.pwMarked = "1";
      const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
      const a = heads.findIndex((h) => ATHLETE_HEADS.test(h));
      const s = heads.findIndex((h) => SCHOOL_HEADS.test(h));
      if (s < 0) return;
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const cells = tr.children;
        const school = cells[s]?.textContent.trim();
        if (!school) return;
        cells[s].dataset.pwSchool = school;
        if (a >= 0 && cells[a]?.textContent.trim()) {
          cells[a].dataset.pwAthlete = cells[a].textContent.trim();
          cells[a].dataset.pwAthleteSchool = school;
        }
      });
    });
  }

  // An element may hold one fallback link (data-pw-fallback, e.g. a directory
  // search); an exact page replaces its href. Any other link is left alone.
  const usable = (el) => !el.dataset.pwLinked && !el.querySelector("a:not([data-pw-fallback])") && !el.closest("a, button");

  function wrap(el, href) {
    el.dataset.pwLinked = "1";
    const fallback = el.querySelector("a[data-pw-fallback]");
    if (fallback) { fallback.href = href; fallback.removeAttribute("data-pw-fallback"); return; }
    const a = document.createElement("a");
    a.href = href;
    a.className = "pw-name-link";
    while (el.firstChild) a.append(el.firstChild);
    el.append(a);
  }

  const memo = new Map(); // same request again (lists that redraw) is answered from memory
  async function ask(params) {
    const url = `/api/links/?${params}`;
    if (!memo.has(url)) memo.set(url, fetch(url, { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : { schools: {}, athletes: {}, ids: {} })).catch(() => ({ schools: {}, athletes: {}, ids: {} })));
    return memo.get(url);
  }

  async function run(root = document) {
    try {
      markStoryTables(root);
      const schoolEls = [...root.querySelectorAll("[data-pw-school]")].filter(usable);
      const athleteEls = [...root.querySelectorAll("[data-pw-athlete][data-pw-athlete-school]")].filter(usable);
      const idEls = [...root.querySelectorAll("[data-pw-school-id]")].filter(usable);
      if (!schoolEls.length && !athleteEls.length && !idEls.length) return;
      const clean = (v) => String(v || "").replace(/[|~]/g, " ").trim();
      const s = [...new Set(schoolEls.map((el) => clean(el.dataset.pwSchool)))].filter(Boolean).sort();
      const a = [...new Set(athleteEls.map((el) => `${clean(el.dataset.pwAthlete)}~${clean(el.dataset.pwAthleteSchool)}`))].sort();
      const i = [...new Set(idEls.map((el) => el.dataset.pwSchoolId))].filter((v) => /^[0-9a-f-]{36}$/.test(v)).sort();
      // One request per page (sorted, so the CDN can answer it); split only if it gets long.
      const batches = [];
      let cur = { s: [], a: [], i: [] };
      const size = (b) => b.s.join("|").length + b.a.join("|").length + b.i.join("|").length;
      for (const [key, list] of [["i", i], ["s", s], ["a", a]]) for (const value of list) {
        if (size(cur) + value.length > MAX_URL) { batches.push(cur); cur = { s: [], a: [], i: [] }; }
        cur[key].push(value);
      }
      batches.push(cur);
      const results = await Promise.all(batches.map((b) => ask(new URLSearchParams(Object.fromEntries(Object.entries(b).filter(([, v]) => v.length).map(([k, v]) => [k, v.join("|")]))).toString())));
      const found = { schools: {}, athletes: {}, ids: {} };
      for (const r of results) for (const k of Object.keys(found)) Object.assign(found[k], r[k] || {});
      schoolEls.forEach((el) => { const href = found.schools[clean(el.dataset.pwSchool)]; if (href) wrap(el, href); });
      athleteEls.forEach((el) => { const href = found.athletes[`${clean(el.dataset.pwAthlete)}~${clean(el.dataset.pwAthleteSchool)}`]; if (href) wrap(el, href); });
      idEls.forEach((el) => { const href = found.ids[el.dataset.pwSchoolId]; if (href) wrap(el, href); });
    } catch {
      // Links are extra; the page works without them.
    }
  }

  window.pwNameLinks = run;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => run());
  else run();
})();
