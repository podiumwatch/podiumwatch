// /wrapped/ search (WO-36). Before launch: a "coming soon" note instead.
(() => {
  const soon = document.querySelector("[data-wrs-soon]");
  const box = document.querySelector("[data-wrs-search]");
  const input = document.querySelector("[data-wrs-q]");
  const list = document.querySelector("[data-wrs-list]");
  const msg = document.querySelector("[data-wrs-msg]");
  if (!box || !input) return;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  fetch("/api/wrapped/status/", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : { live: false }))
    .catch(() => ({ live: false }))
    .then((status) => {
      if (status.live) { box.hidden = false; input.focus({ preventScroll: true }); return; }
      const when = status.launch_at ? new Date(status.launch_at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }) : null;
      soon.textContent = when ? `Podium Watch Wrapped is coming ${when}.` : "Podium Watch Wrapped is coming soon.";
      soon.hidden = false;
    });
  let timer = null;
  let seq = 0;
  async function run() {
    const q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ""; msg.textContent = "Type at least 2 letters."; return; }
    const mine = ++seq;
    msg.textContent = "Searching...";
    try {
      const res = await fetch(`/api/athletes/?q=${encodeURIComponent(q)}&page_size=25`, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (mine !== seq) return;
      const athletes = data.athletes || [];
      list.innerHTML = athletes.map((a) => `<li><a href="/wrapped/2026/${encodeURIComponent(a.slug)}/">${esc(a.display_name)} <small>${esc(a.school?.school_name || a.team?.school_name || "")}${a.graduation_year ? ` &middot; ${esc(a.graduation_year)}` : ""}</small></a></li>`).join("");
      msg.textContent = athletes.length ? "Runners need at least 3 races on Podium Watch for a card." : "No runner found. Try the last name or the school.";
    } catch {
      if (mine === seq) msg.textContent = "Search isn't working right now. Try again in a moment.";
    }
  }
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
})();
