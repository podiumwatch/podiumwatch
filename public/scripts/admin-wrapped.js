// Admin: Podium Watch Wrapped launch (src/pages/adminwrapped.mjs).
(() => {
  const root = document.querySelector("[data-wra]");
  if (!root) return;
  const form = root.querySelector("[data-wra-form]");
  const state = root.querySelector("[data-wra-state]");
  const message = root.querySelector("[data-wra-message]");
  async function api(body) {
    const res = await fetch("/api/admin/wrapped/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || "That request failed."); e.status = res.status; throw e; }
    return data;
  }
  const when = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const paint = (s) => { state.textContent = s.live ? `Live since ${when(s.launch_at)}.` : s.launch_at ? `Launches ${when(s.launch_at)}. Not public yet.` : "No launch date set. Not public."; };
  const run = async (body, text) => { try { paint(await api(body)); message.textContent = text; } catch (error) { message.textContent = error.message; } };
  api({ action: "state" }).then((s) => { paint(s); root.querySelector("[data-wra-loading]").hidden = true; root.querySelector("[data-wra-dashboard]").hidden = false; })
    .catch((error) => { root.querySelector("[data-wra-loading]").innerHTML = error.status === 401 ? '<h2>Admin sign in required</h2><p><a href="/admin/">Sign in</a> first.</p>' : `<h2>Could not load</h2><p>${error.message}</p>`; });
  form.addEventListener("submit", (event) => { event.preventDefault(); run({ action: "set", launch_at: new Date(form.elements.launch_at.value).toISOString() }, "Saved."); });
  root.querySelector("[data-wra-now]").addEventListener("click", () => run({ action: "set", launch_at: new Date().toISOString() }, "Wrapped is live."));
  root.querySelector("[data-wra-clear]").addEventListener("click", () => run({ action: "set", launch_at: null }, "Taken down. The public sees coming soon."));
  root.querySelector("[data-wra-preview]").addEventListener("submit", (event) => {
    event.preventDefault();
    const slug = event.target.elements.slug.value.trim().toLowerCase();
    // ?preview= keeps the CDN from serving the public "coming soon" copy.
    window.open(`/wrapped/2026/${encodeURIComponent(slug)}/?preview=${Date.now()}`, "_blank", "noopener");
  });
})();
