// /teams/banquet/ team search (WO-35): search team pages, link each result
// to its 2026 Banquet Pack.
(() => {
  const input = document.querySelector("[data-tbq-search]");
  const list = document.querySelector("[data-tbq-list]");
  const msg = document.querySelector("[data-tbq-msg]");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let timer = null, seq = 0;
  async function run() {
    const q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ""; msg.textContent = "Type at least 2 letters."; return; }
    const mine = ++seq;
    msg.textContent = "Searching...";
    try {
      const res = await fetch("/api/teams/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: q }) });
      const data = await res.json();
      if (mine !== seq) return;
      const teams = (data.teams || []).filter((t) => !t.program_level || t.program_level === "high_school").slice(0, 25);
      list.innerHTML = teams.map((t) => '<li><a href="/teams/' + encodeURIComponent(t.slug) + '/season/2026/banquet/">' + esc(t.school_name) + ' <small>' + esc(t.city || "") + '</small></a></li>').join("");
      msg.textContent = teams.length ? "" : "No team found. Try the school's name without its mascot.";
    } catch {
      if (mine === seq) msg.textContent = "Search isn't working right now. Try again in a moment.";
    }
  }
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
})();
