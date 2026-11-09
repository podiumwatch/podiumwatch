// Admin: front page lead story (src/pages/adminfrontpage.mjs, WO-43).
(() => {
  const root = document.querySelector("[data-fpa]");
  if (!root) return;
  const stories = JSON.parse(root.querySelector("[data-fpa-stories]").textContent || "[]");
  const storyBySlug = new Map(stories.map((s) => [s.slug, s]));
  const loading = root.querySelector("[data-fpa-loading]");
  const dashboard = root.querySelector("[data-fpa-dashboard]");
  const form = root.querySelector("[data-fpa-form]");
  const message = root.querySelector("[data-fpa-message]");
  const note = root.querySelector("[data-fpa-story-note]");
  const picked = { athlete: new Map(), team: new Map() };

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const when = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const localInput = (date) => { const d = new Date(date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  async function api(body) {
    const response = await fetch("/api/admin/front-page/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "That request failed."); error.status = response.status; throw error; }
    return data;
  }
  const say = (text, isError = false) => { message.textContent = text; message.style.color = isError ? "#b42318" : ""; };

  const cardLinks = (lead) => `<a href="/api/og/front-page/?lead=${encodeURIComponent(lead.id)}&size=post&download=1">Download post (1080x1350)</a><a href="/api/og/front-page/?lead=${encodeURIComponent(lead.id)}&size=story&download=1">Download Story (1080x1920)</a>`;
  const featured = (lead) => [...(lead.linked_profiles || []).map((p) => p.display_name), ...(lead.linked_teams || []).map((t) => t.school_name)].join(", ");
  const card = (lead, { current = false, line = "", actions = "" } = {}) => `<article class="fpa-card${current ? " is-current" : ""}">
      <h3><a href="/stories/${esc(lead.story_slug)}/" target="_blank" rel="noopener">${esc(lead.title)}</a></h3>
      <p class="fpa-meta">${esc(line)}${lead.kicker ? ` &middot; ${esc(lead.kicker)}` : ""}${lead.image_url ? "" : " &middot; no photo (type-only lead)"}</p>
      ${featured(lead) ? `<p class="fpa-meta">Featured: ${esc(featured(lead))}</p>` : ""}
      <div class="fpa-actions">${cardLinks(lead)}${actions}</div>
    </article>`;

  function render(state) {
    const current = state.current;
    root.querySelector("[data-fpa-current]").innerHTML = current
      ? card(current, { current: true, line: `Since ${when(current.run?.starts_at || current.starts_at)}${current.ends_at ? `, until ${when(current.ends_at)}` : ", no end time"}`, actions: `<button type="button" data-fpa-end="${esc(current.id)}">End now</button>` })
      : "<p>No lead is set. The homepage leads with the newest published story.</p>";
    root.querySelector("[data-fpa-queue]").innerHTML = (state.queue || []).length
      ? state.queue.map((lead) => card(lead, { line: `Starts ${when(lead.starts_at)}${lead.ends_at ? `, ends ${when(lead.ends_at)}` : ""}`, actions: `<button type="button" data-fpa-end="${esc(lead.id)}">Cancel</button>` })).join("")
      : "<p>Nothing queued.</p>";
    root.querySelector("[data-fpa-history]").innerHTML = (state.history || []).filter((run) => !run.current).length
      ? state.history.filter((run) => !run.current).map((run) => card(run, { line: `Ran ${run.label}` })).join("")
      : "<p>No past leads yet.</p>";
    const titleById = new Map((state.leads || []).map((lead) => [lead.id, lead.title]));
    root.querySelector("[data-fpa-log]").innerHTML = (state.events || []).length
      ? state.events.map((event) => `<tr><td>${esc(when(event.created_at))}</td><td>${esc(event.action.replace("_", " "))}</td><td>${esc(titleById.get(event.lead_id) || "")}</td><td>${esc(event.actor || "")}</td></tr>`).join("")
      : '<tr><td colspan="4">No changes yet.</td></tr>';
  }

  async function refresh() {
    try {
      render(await api({ action: "state" }));
      loading.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      loading.innerHTML = error.status === 401 ? '<h2>Admin sign in required</h2><p><a href="/admin/">Sign in</a> first.</p>' : `<h2>Could not load</h2><p>${esc(error.message)}</p>`;
    }
  }

  // Story choice: show what will be copied, and warn about a missing photo.
  form.elements.slug.addEventListener("change", () => {
    const story = storyBySlug.get(form.elements.slug.value);
    if (!story) { note.hidden = true; return; }
    if (!form.elements.kicker.value) form.elements.kicker.value = story.kicker || "";
    const notes = [];
    if (!story.image_url) notes.push("No photo: it will lead as a type-only headline.");
    else if (!story.image_credit) notes.push("The photo has no credit in the story file; add imageCredit to the story to show one.");
    note.textContent = notes.join(" ");
    note.hidden = !notes.length;
  });

  // Featured athlete and team pickers.
  const drawPicked = (kind) => {
    root.querySelector(`[data-fpa-picked="${kind}"]`).innerHTML = [...picked[kind].entries()].map(([id, label]) => `<button type="button" data-fpa-unpick="${kind}" data-id="${esc(id)}" title="Remove">${esc(label)} &times;</button>`).join("");
  };
  let searchTimer = null;
  root.querySelectorAll("[data-fpa-search]").forEach((input) => input.addEventListener("input", () => {
    const kind = input.dataset.fpaSearch;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const box = root.querySelector(`[data-fpa-results="${kind}"]`);
      if (input.value.trim().length < 2) { box.innerHTML = ""; return; }
      try {
        const results = await api({ action: "search", kind, query: input.value });
        box.innerHTML = results.map((r) => `<button type="button" data-fpa-pick="${kind}" data-id="${esc(r.id)}" data-label="${esc(r.label)}">${esc(r.label)}</button>`).join("") || "<small>No matches.</small>";
      } catch (error) { box.textContent = error.message; }
    }, 250);
  }));
  root.addEventListener("click", async (event) => {
    const pick = event.target.closest("[data-fpa-pick]");
    if (pick) { picked[pick.dataset.fpaPick].set(pick.dataset.id, pick.dataset.label); drawPicked(pick.dataset.fpaPick); return; }
    const unpick = event.target.closest("[data-fpa-unpick]");
    if (unpick) { picked[unpick.dataset.fpaUnpick].delete(unpick.dataset.id); drawPicked(unpick.dataset.fpaUnpick); return; }
    const end = event.target.closest("[data-fpa-end]");
    if (end) {
      end.disabled = true;
      try {
        const result = await api({ action: "end", lead_id: end.dataset.fpaEnd });
        say(result.cancelled ? "Cancelled." : "Ended. The next lead (or the newest story) is on the front page now.");
        await refresh();
      } catch (error) { say(error.message, true); end.disabled = false; }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const story = storyBySlug.get(form.elements.slug.value);
    if (!story) { say("Choose a published story.", true); return; }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await api({
        action: "schedule",
        story,
        kicker: form.elements.kicker.value,
        starts_at: new Date(form.elements.starts_at.value).toISOString(),
        ends_at: form.elements.ends_at.value ? new Date(form.elements.ends_at.value).toISOString() : null,
        linked_profile_ids: [...picked.athlete.keys()],
        linked_team_ids: [...picked.team.keys()]
      });
      say("Saved. The homepage picks it up within a minute of its start time.");
      form.reset();
      picked.athlete.clear(); picked.team.clear(); drawPicked("athlete"); drawPicked("team");
      form.elements.starts_at.value = localInput(new Date());
      note.hidden = true;
      await refresh();
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; }
  });

  form.elements.starts_at.value = localInput(new Date());
  refresh();
})();
