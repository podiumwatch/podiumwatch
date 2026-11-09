// Story page (WO-43): "On the Podium Watch front page, Nov 9 to Nov 11,
// 2026" with the real dates the story led the homepage, and the
// "ON THE FRONT PAGE" share cards to download. Hidden unless it led.
(() => {
  const box = document.querySelector("[data-front-page-runs]");
  if (!box) return;
  const slug = box.getAttribute("data-slug");
  fetch(`/api/front-page/story/?slug=${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const runs = data?.runs || [];
      if (!runs.length) return;
      const text = (run) => (run.current ? `${run.label.replace(/ to now$/, "")} to today` : run.label);
      const latest = runs[runs.length - 1];
      const line = document.createElement("p");
      line.className = "sp-front-page-line";
      const link = document.createElement("a");
      link.href = "/front-page/";
      link.textContent = `On the Podium Watch front page, ${runs.map(text).join("; ")}`;
      line.append(link);
      const cards = document.createElement("p");
      cards.className = "sp-front-page-cards";
      for (const [size, label] of [["post", "Download post (1080x1350)"], ["story", "Download Story (1080x1920)"]]) {
        const a = document.createElement("a");
        a.href = `/api/og/front-page/?lead=${encodeURIComponent(latest.lead_id)}&size=${size}&download=1`;
        a.setAttribute("download", "");
        a.textContent = label;
        cards.append(a);
      }
      box.replaceChildren(line, cards);
      box.hidden = false;
    })
    .catch(() => {});
})();
