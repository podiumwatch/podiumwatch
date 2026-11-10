// Admin for the 2026 Athlete, Team and Coach of the Year
// (src/pages/adminawards2026.mjs). Nominations, finalists, live vote
// counts, flagged networks, voiding, closing early and publishing.
// Destructive buttons need a second tap instead of a browser dialog.
(() => {
  const root = document.querySelector("[data-yoya]");
  if (!root) return;

  const loading = root.querySelector("[data-yoya-loading]");
  const dashboard = root.querySelector("[data-yoya-dashboard]");
  const list = root.querySelector("[data-yoya-list]");
  const filter = root.querySelector("[data-yoya-filter]");
  const message = root.querySelector("[data-yoya-message]");
  let categories = [];
  let pool = null;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const STATUS = { upcoming: "Upcoming", nominations_open: "Nominations open", selecting_finalists: "Picking finalists", finalists_coming_soon: "Voting window, finalists not announced", voting_open: "Voting open", voting_closed: "Voting closed", published: "Published" };
  const et = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "");

  async function api(body) {
    const response = await fetch("/api/admin/awards-2026/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "That request failed.");
      error.tied = data.tied;
      throw error;
    }
    return data;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#b42318" : "";
  }

  async function loadPool() {
    if (pool) return pool;
    try {
      const response = await fetch("/data/yearly-awards-2026-pool.json");
      pool = await response.json();
    } catch {
      pool = null;
    }
    return pool;
  }

  function poolFor(category) {
    if (!pool) return [];
    if (category.award === "coach") return pool.coaches?.[category.slug] || [];
    return (category.award === "athlete" ? pool.athletes : pool.teams)?.[category.slug] || [];
  }

  function finalistRow(category, finalist, index) {
    const showVotes = Boolean(category.finalists_published_at);
    return `<li class="yoya-finalist${finalist.winner ? " is-winner" : ""}" data-finalist="${escapeHtml(finalist.id)}">
      <div class="yoya-finalist-head"><b>${index + 1}.</b>
        <input data-field="display_name" value="${escapeHtml(finalist.display_name)}" maxlength="80" aria-label="Name">
        <input data-field="school" value="${escapeHtml(finalist.school || "")}" maxlength="80" placeholder="School" aria-label="School">
        ${showVotes ? `<span class="yoya-votes">${finalist.votes} vote${finalist.votes === 1 ? "" : "s"}</span>` : ""}
        ${finalist.winner ? '<span class="yoya-winner">Winner</span>' : ""}
      </div>
      <input data-field="note" value="${escapeHtml(finalist.note || "")}" maxlength="160" placeholder="One-line note shown under the name (optional, 160 max)" aria-label="Note">
      <div class="yoya-actions">
        <button type="button" data-act="save_finalist">Save</button>
        <button type="button" data-act="move_up" ${index === 0 ? "disabled" : ""}>Up</button>
        <button type="button" data-act="move_down" ${index === category.finalists.length - 1 ? "disabled" : ""}>Down</button>
        <button type="button" class="is-danger" data-act="remove_finalist" data-confirm-text="Tap again to remove">Remove</button>
      </div>
    </li>`;
  }

  function votesPanel(category) {
    if (!category.votes) return "";
    const v = category.votes;
    return `<div class="yoya-votebox">
      <p><b>${v.total} vote${v.total === 1 ? "" : "s"} counted</b>${v.voided ? ` &middot; ${v.voided} voided` : ""}${v.error ? ` &middot; <span class="is-error">${escapeHtml(v.error)}</span>` : ""}</p>
      ${v.heavy.length ? `<p class="is-error"><b>Flagged networks (${v.heavy.length})</b>: 25 or more votes from one network. Could be a school's wifi, could be spam.</p>` : ""}
      ${v.top_networks.length ? `<ul class="yoya-networks">${v.top_networks.map((item) => `<li${item.count >= 25 ? ' class="is-flagged"' : ""}><code>${escapeHtml(item.ip)}</code> ${item.count} vote${item.count === 1 ? "" : "s"} <button type="button" class="is-danger" data-act="void_ip" data-ip="${escapeHtml(item.ip)}" data-confirm-text="Tap again to void ${item.count}">Void these votes</button></li>`).join("")}</ul>` : ""}
      <div class="yoya-void"><input data-void-prefix placeholder="Browser or network ID (first 8+ characters)"><button type="button" class="is-danger" data-act="void_prefix" data-confirm-text="Tap again to void">Void</button></div>
    </div>`;
  }

  function controls(category) {
    const n = category.finalists.length;
    const buttons = [];
    if (!category.results_published_at) {
      if (category.finalists_published_at) buttons.push('<button type="button" data-act="unannounce" data-confirm-text="Tap again to hide finalists">Hide finalists</button>');
      else buttons.push(`<button type="button" class="is-primary" data-act="announce" ${n < 2 ? "disabled" : ""}>Announce finalists${category.status === "selecting_finalists" ? " (voting opens on schedule)" : ""}</button>`);
      if (category.status === "voting_open") buttons.push('<button type="button" class="is-danger" data-act="close_early" data-confirm-text="Tap again to close voting">Close voting now</button>');
      if (category.voting_closed_early_at) buttons.push('<button type="button" data-act="reopen">Reopen voting</button>');
      if (category.status === "voting_closed") buttons.push('<button type="button" class="is-primary" data-act="publish" data-confirm-text="Tap again to publish">Publish winner</button>');
    } else {
      buttons.push('<button type="button" class="is-danger" data-act="unpublish" data-confirm-text="Tap again to unpublish">Unpublish</button>');
    }
    return `<div class="yoya-actions">${buttons.join("")}</div>`;
  }

  function nomineeList(category) {
    if (!category.nominees.length) return '<p class="yoya-empty">No nominations yet.</p>';
    const finalistKeys = new Set(category.finalists.map((item) => item.nominee_key));
    return category.nominees.map((nominee, index) => `<details class="yoya-nominee">
        <summary><b>${index + 1}. ${escapeHtml(nominee.name)}</b><small>${escapeHtml(nominee.school || "")}</small>${nominee.coach_names && nominee.coach_names.length ? `<small>Coach: ${escapeHtml(nominee.coach_names.join(" / "))}</small>` : ""}<b>${nominee.count} nomination${nominee.count === 1 ? "" : "s"}</b>
          ${finalistKeys.has(nominee.nominee_key) ? '<span class="yoya-tag">Finalist</span>' : category.results_published_at ? "" : `<button type="button" data-act="add_finalist" data-key="${escapeHtml(nominee.nominee_key)}" data-name="${escapeHtml(category.award === "coach" ? nominee.coach_names[0] || "" : "")}">Make finalist</button>`}</summary>
        <ul class="yoya-reasons">${nominee.nominations.map((item) => `<li><span>${item.coach_name ? `<b>${escapeHtml(item.coach_name)}:</b> ` : ""}${item.reason ? escapeHtml(item.reason) : "<em>No reason given</em>"}${item.first_name ? ` <small>(${escapeHtml(item.first_name)})</small>` : ""} <small>${escapeHtml(new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }))} ET${item.ip ? ` &middot; net ${escapeHtml(item.ip)}` : ""}</small></span><button type="button" class="is-danger" data-delete="${escapeHtml(item.id)}">Delete</button></li>`).join("")}</ul>
      </details>`).join("");
  }

  function render() {
    const only = filter.value;
    list.innerHTML = categories.filter((category) => !only || category.slug === only).map((category) => {
      const n = category.finalists.length;
      return `<section class="yoya-cat" data-category="${escapeHtml(category.slug)}">
      <h2>${escapeHtml(category.label)}</h2>
      <p class="yoya-meta">${escapeHtml(STATUS[category.status] || category.status)} &middot; ${category.nomination_count} nomination${category.nomination_count === 1 ? "" : "s"} &middot; ${n} finalist${n === 1 ? "" : "s"}${category.finalists_published_at ? ` &middot; announced ${escapeHtml(et(category.finalists_published_at))}` : ""} &middot; voting closes ${escapeHtml(et(category.voting_close_at))} &middot; <a href="/awards/2026/${escapeHtml(category.slug)}/" target="_blank" rel="noopener">public page</a></p>
      ${n < 2 && !category.results_published_at ? `<p class="yoya-warn">${n === 0 ? "No finalists yet." : "Only 1 finalist."} Add at least 2 to announce this category.</p>` : ""}
      ${controls(category)}
      <h3>Finalists</h3>
      ${n ? `<ol class="yoya-finalists">${category.finalists.map((finalist, index) => finalistRow(category, finalist, index)).join("")}</ol>` : '<p class="yoya-empty">Use "Make finalist" on a nominee below, or add anyone from the full list.</p>'}
      ${category.results_published_at ? "" : `<div class="yoya-add"><input data-pool-search placeholder="Add a finalist from the full ${category.award === "coach" ? "school" : category.award} list" autocomplete="off"><ul class="yoya-pool" data-pool-results></ul></div>`}
      ${votesPanel(category)}
      <h3>Nominees</h3>
      ${nomineeList(category)}
    </section>`;
    }).join("");
  }

  async function load(note) {
    const data = await api({ action: "summary" });
    categories = data.categories || [];
    const current = filter.value;
    filter.innerHTML = `<option value="">All ${categories.length} categories</option>` + categories.map((category) => `<option value="${escapeHtml(category.slug)}">${escapeHtml(category.label)} (${category.finalists.length} finalists, ${category.nomination_count} noms)</option>`).join("");
    filter.value = current;
    render();
    setMessage(note || `Loaded ${categories.reduce((sum, category) => sum + category.nomination_count, 0)} nominations at ${new Date().toLocaleTimeString()}.`);
  }

  // Two-tap confirm for anything destructive.
  function confirmed(button) {
    if (!button.dataset.confirmText) return true;
    if (button.dataset.armed === "yes") return true;
    button.dataset.armed = "yes";
    button.dataset.label = button.textContent;
    button.textContent = button.dataset.confirmText;
    setTimeout(() => { if (button.isConnected && button.dataset.armed === "yes") { button.dataset.armed = ""; button.textContent = button.dataset.label; } }, 5000);
    return false;
  }

  async function run(button, body, done) {
    button.disabled = true;
    try {
      const result = await api(body);
      await load(typeof done === "function" ? done(result) : done);
    } catch (error) {
      setMessage(error.message, true);
      button.disabled = false;
      if (error.tied && body.action === "publish") showTie(button, body.category, error.tied);
    }
  }

  function showTie(button, slug, tied) {
    const category = categories.find((item) => item.slug === slug);
    const box = document.createElement("div");
    box.className = "yoya-actions";
    box.innerHTML = "<b>Tie. Pick the winner:</b> " + tied.map((key) => {
      const finalist = category.finalists.find((item) => item.nominee_key === key);
      return `<button type="button" class="is-primary" data-act="publish_with" data-key="${escapeHtml(key)}">${escapeHtml(finalist ? finalist.display_name : key)}</button>`;
    }).join("");
    button.closest(".yoya-actions").after(box);
  }

  function resetArmed(button) {
    button.dataset.armed = "";
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = false;
  }

  filter.addEventListener("change", render);
  root.querySelector("[data-yoya-csv]").addEventListener("click", () => { window.location.href = "/api/admin/awards-2026/?format=csv"; });
  root.querySelector("[data-yoya-finalists-csv]").addEventListener("click", () => { window.location.href = "/api/admin/awards-2026/?format=finalists"; });
  root.querySelector("[data-yoya-refresh]").addEventListener("click", () => load().catch((error) => setMessage(error.message, true)));
  root.querySelector("[data-yoya-announce-all]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (!confirmed(button)) return;
    run(button, { action: "announce_all" }, (result) => `Announced ${result.announced.length}: ${result.announced.join(", ") || "none"}. ${result.skipped.length ? `Skipped: ${result.skipped.join(", ")}.` : ""}`).finally(() => resetArmed(button));
  });
  root.querySelector("[data-yoya-publish-all]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (!confirmed(button)) return;
    run(button, { action: "publish_all" }, (result) => `Published ${result.published.length}: ${result.published.join("; ") || "none"}. ${result.skipped.length ? `Skipped: ${result.skipped.join("; ")}.` : ""}`).finally(() => resetArmed(button));
  });

  list.addEventListener("input", async (event) => {
    const input = event.target.closest("[data-pool-search]");
    if (!input) return;
    const section = input.closest("[data-category]");
    const category = categories.find((item) => item.slug === section.dataset.category);
    const results = section.querySelector("[data-pool-results]");
    await loadPool();
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.innerHTML = ""; return; }
    const taken = new Set(category.finalists.map((item) => item.nominee_key));
    const matches = poolFor(category).filter((item) => `${item.name} ${item.school || ""} ${item.city || ""}`.toLowerCase().includes(q)).slice(0, 12);
    results.innerHTML = matches.map((item) => `<li>${escapeHtml(item.name)} <small>${escapeHtml(item.school || item.city || "")}</small> ${taken.has(item.id) ? '<span class="yoya-tag">Finalist</span>' : `<button type="button" data-act="add_finalist" data-key="${escapeHtml(item.id)}" data-name="">Add</button>`}</li>`).join("") || "<li>No match.</li>";
  });

  list.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) {
      if (deleteButton.dataset.armed !== "yes") { deleteButton.dataset.armed = "yes"; deleteButton.textContent = "Tap again to delete"; return; }
      run(deleteButton, { action: "delete_nomination", nomination_id: deleteButton.dataset.delete }, "Nomination deleted.");
      return;
    }
    const button = event.target.closest("[data-act]");
    if (!button) return;
    if (event.target.closest("summary")) event.preventDefault();
    const section = button.closest("[data-category]");
    const slug = section.dataset.category;
    const category = categories.find((item) => item.slug === slug);
    const row = button.closest("[data-finalist]");
    const act = button.dataset.act;
    if (!confirmed(button)) return;

    if (act === "add_finalist") {
      let name = button.dataset.name;
      if (category.award === "coach" && !name) {
        const typed = button.parentElement.querySelector("[data-coach-name]");
        name = typed ? typed.value.trim() : "";
        if (!name) {
          if (!typed) {
            const input = document.createElement("input");
            input.setAttribute("data-coach-name", "");
            input.placeholder = "Coach's name";
            input.maxLength = 80;
            button.before(input, " ");
            button.textContent = "Add with this name";
            input.focus();
          } else {
            setMessage("Type the coach's name first.", true);
          }
          return;
        }
      }
      run(button, { action: "add_finalist", category: slug, nominee_key: button.dataset.key, display_name: name || undefined }, "Finalist added.");
    } else if (act === "save_finalist") {
      const field = (name) => row.querySelector(`[data-field="${name}"]`).value;
      run(button, { action: "update_finalist", finalist_id: row.dataset.finalist, display_name: field("display_name"), school: field("school"), note: field("note") }, "Finalist saved.");
    } else if (act === "move_up" || act === "move_down") {
      run(button, { action: "move_finalist", finalist_id: row.dataset.finalist, direction: act === "move_up" ? "up" : "down" }, "Order saved.");
    } else if (act === "remove_finalist") {
      run(button, { action: "remove_finalist", finalist_id: row.dataset.finalist }, "Finalist removed.");
    } else if (act === "announce") {
      run(button, { action: "announce_finalists", category: slug }, `${category.label} finalists announced.`);
    } else if (act === "unannounce") {
      run(button, { action: "announce_finalists", category: slug, undo: true }, `${category.label} finalists hidden.`);
    } else if (act === "close_early") {
      run(button, { action: "close_early", category: slug }, `${category.label} voting closed.`);
    } else if (act === "reopen") {
      run(button, { action: "close_early", category: slug, undo: true }, `${category.label} voting reopened (closes on schedule).`);
    } else if (act === "publish") {
      run(button, { action: "publish", category: slug }, (result) => `${result.published} published. Winner: ${result.winner}.`);
    } else if (act === "publish_with") {
      run(button, { action: "publish", category: slug, winner_key: button.dataset.key }, (result) => `${result.published} published. Winner: ${result.winner}.`);
    } else if (act === "unpublish") {
      run(button, { action: "unpublish", category: slug }, `${category.label} unpublished.`);
    } else if (act === "void_ip") {
      run(button, { action: "void_votes", category: slug, ip_prefix: button.dataset.ip, reason: "flagged network" }, (result) => `Voided ${result.voided} vote${result.voided === 1 ? "" : "s"}.`);
    } else if (act === "void_prefix") {
      const prefix = section.querySelector("[data-void-prefix]").value.trim().toLowerCase();
      run(button, { action: "void_votes", category: slug, token_prefix: prefix, ip_prefix: prefix, reason: "manual" }, (result) => `Voided ${result.voided} vote${result.voided === 1 ? "" : "s"}.`);
    }
  });

  (async () => {
    try {
      await load();
      loading.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      loading.innerHTML = `<h2>Admin access required</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/admin/">Open admin sign in</a>`;
    }
  })();

  // Vote activity: votes per hour per finalist and network bursts.
  const activityButton = root.querySelector("[data-yoya-activity]");
  const activityOut = root.querySelector("[data-yoya-activity-out]");
  const hourEt = (hour) => new Date(`${hour}:00:00Z`).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric" });
  if (activityButton && activityOut) activityButton.addEventListener("click", async () => {
    activityButton.disabled = true;
    activityOut.textContent = "Loading...";
    try {
      const data = await api({ action: "vote_activity" });
      const list = data.categories || [];
      activityOut.innerHTML = list.length ? list.map((category) => {
        const header = category.finalists.map((f) => `<th>${escapeHtml(f.name)}</th>`).join("");
        const rows = category.hours.map((h) => `<tr><td>${escapeHtml(hourEt(h.hour))}</td>${category.finalists.map((f) => `<td>${h.by_finalist[f.key] || 0}</td>`).join("")}<td><b>${h.total}</b></td></tr>`).join("");
        const bursts = category.bursts.length
          ? `<p style="color:#b42318;font-weight:800">Bursts: ${category.bursts.map((b) => `${escapeHtml(hourEt(b.hour))}: network ${escapeHtml(b.ip)} cast ${b.count} (${b.share}% of that hour)`).join("; ")}</p>`
          : "<p>No bursts.</p>";
        return `<div><h3 style="margin:0 0 6px">${escapeHtml(category.label)}</h3>${bursts}${rows ? `<div style="overflow-x:auto"><table class="yoya-table" style="border-collapse:collapse;font-size:.85rem"><thead><tr><th>Hour (ET)</th>${header}<th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>` : "<p>No votes yet.</p>"}</div>`;
      }).join("") : "<p>No category has finalists yet.</p>";
    } catch (error) {
      activityOut.textContent = error.message;
    } finally {
      activityButton.disabled = false;
    }
  });
})();
