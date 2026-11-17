// OATCCC Hall of Fame list and award pages: search by name or school, and
// on the Hall of Fame, filter by year and Ed Barker recipients. Everything
// is in the HTML; this only hides what does not match. Copied to dist/ only
// with OATCCC_HOF_LIVE.
(() => {
  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[.'"“”’]/g, "").replace(/\s+/g, " ").trim();

  const list = document.querySelector("[data-ox-hof-list]");
  if (list) {
    const q = document.querySelector("[data-ox-hof-q]");
    const year = document.querySelector("[data-ox-hof-year]");
    const barker = document.querySelector("[data-ox-hof-barker]");
    const count = document.querySelector("[data-ox-hof-count]");
    const cards = [...list.children].map((el) => ({ el, name: norm(el.dataset.name), year: el.dataset.year, barker: el.dataset.barker === "1" }));
    const apply = () => {
      const text = norm(q.value);
      let shown = 0;
      for (const c of cards) {
        const ok = (!text || c.name.includes(text)) && (!year.value || c.year === year.value) && (!barker.checked || c.barker);
        c.el.hidden = !ok;
        if (ok) shown++;
      }
      count.textContent = `${shown} ${shown === 1 ? "inductee" : "inductees"}`;
    };
    [q, year, barker].forEach((el) => el.addEventListener("input", apply));
    barker.addEventListener("change", apply);
  }

  const table = document.querySelector("[data-ox-award-table]");
  if (table) {
    const q = document.querySelector("[data-ox-award-q]");
    const count = document.querySelector("[data-ox-award-count]");
    const rows = [...table.tBodies[0].rows].map((el) => ({ el, text: norm(`${el.dataset.name} ${el.cells[0].textContent}`) }));
    q.addEventListener("input", () => {
      const text = norm(q.value);
      let shown = 0;
      for (const r of rows) { const ok = !text || r.text.includes(text); r.el.hidden = !ok; if (ok) shown++; }
      count.textContent = `${shown} ${shown === 1 ? "recipient" : "recipients"}${text ? "" : ", newest first"}`;
    });
  }
})();
