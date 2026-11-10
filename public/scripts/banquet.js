// Banquet Pack page (WO-35): print button and coach tools. Coach tools load
// the sign-in library only when opened, then let a coach on this team's
// account hide athletes and add a note. Times can't be edited.
(() => {
  const print = document.querySelector("[data-bq-print]");
  if (print) print.addEventListener("click", () => window.print());

  const open = document.querySelector("[data-bq-coach-open]");
  const panel = document.querySelector("[data-bq-coach]");
  if (!open || !panel) return;
  const msg = panel.querySelector("[data-bq-coach-msg]");
  const form = panel.querySelector("[data-bq-coach-form]");
  const list = panel.querySelector("[data-bq-athletes]");
  const note = panel.querySelector("[data-bq-note]");
  const status = panel.querySelector("[data-bq-status]");
  const save = panel.querySelector("[data-bq-save]");
  const teamId = panel.dataset.teamId;
  const season = panel.dataset.season;

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("A script could not be loaded."));
    document.head.appendChild(s);
  });
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function token() {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0");
    await loadScript("/scripts/team-auth-client.js");
    return window.PodiumTeamAuth.getAccessToken();
  }

  async function call(method, body) {
    const access = await token();
    if (!access) { const e = new Error("signin"); e.signin = true; throw e; }
    const url = method === "GET" ? `/api/teams/banquet/?team_id=${encodeURIComponent(teamId)}&season=${encodeURIComponent(season)}` : "/api/teams/banquet/";
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  open.addEventListener("click", async () => {
    panel.hidden = false;
    open.hidden = true;
    msg.textContent = "Checking your coach sign-in...";
    try {
      const state = await call("GET");
      if (!state.available) { msg.textContent = "Coach tools aren't switched on yet. Check back soon."; return; }
      note.value = state.note || "";
      list.innerHTML = state.athletes.map((a) => `<label><input type="checkbox" value="${esc(a.id)}"${a.hidden ? "" : " checked"}> ${esc(a.name)} <small>${a.gender === "girls" ? "G" : "B"}${a.class_year ? ` &middot; ${esc(a.class_year)}` : ""}</small></label>`).join("");
      msg.textContent = "Hidden athletes come off every part of the pack: the page, the slides and the share image. Team scores and averages stay as posted.";
      form.hidden = false;
    } catch (error) {
      msg.innerHTML = error.signin ? 'Sign in to your team account at <a href="/team-login/">Team login</a>, then come back to this page.' : esc(error.message);
    }
  });

  save.addEventListener("click", async () => {
    status.textContent = "Saving...";
    save.disabled = true;
    try {
      const hidden = [...list.querySelectorAll("input[type=checkbox]")].filter((box) => !box.checked).map((box) => box.value);
      await call("POST", { team_id: teamId, season: Number(season), hidden_profile_ids: hidden, note: note.value });
      status.textContent = "Saved. Reloading...";
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      status.textContent = error.signin ? "Your sign-in ended. Sign in again at /team-login/." : error.message;
    } finally {
      save.disabled = false;
    }
  });
})();
