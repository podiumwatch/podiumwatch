// /teams/instagram/ (src/pages/teaminstagram.mjs, WO-44): search a school,
// pick the account label, enter the handle, optional private email.
// Submissions go to /api/team-instagram/ and wait for review.
(() => {
  const root = document.querySelector("[data-tig]");
  if (!root) return;
  const form = root.querySelector("[data-tig-form]");
  const search = root.querySelector("[data-tig-search]");
  const results = root.querySelector("[data-tig-results]");
  const picked = root.querySelector("[data-tig-picked]");
  const pickedName = root.querySelector("[data-tig-picked-name]");
  const message = root.querySelector("[data-tig-message]");
  const submit = root.querySelector("[data-tig-submit]");
  let team = null;
  let timer = null;

  const say = (text, tone) => { message.textContent = text; message.dataset.tone = tone || ""; message.hidden = !text; };
  const label = (item) => `${item.school_name}${item.city ? ` (${item.city})` : ""}`;

  function choose(item) {
    team = item;
    pickedName.textContent = label(item);
    picked.hidden = false;
    search.closest("label").hidden = true;
    results.replaceChildren();
  }
  root.querySelector("[data-tig-change]").addEventListener("click", () => {
    team = null;
    picked.hidden = true;
    search.closest("label").hidden = false;
    search.value = "";
    search.focus();
  });

  search.addEventListener("input", () => {
    clearTimeout(timer);
    const q = search.value.trim();
    if (q.length < 2) { results.replaceChildren(); return; }
    timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/teams/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ search: q }) });
        const data = await response.json().catch(() => ({}));
        const teams = (data.teams || []).slice(0, 8);
        results.replaceChildren(...teams.map((item) => {
          const li = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = item.school_name;
          if (item.city) { const small = document.createElement("small"); small.textContent = item.city; button.append(small); }
          button.addEventListener("click", () => choose(item));
          li.append(button);
          return li;
        }));
        if (!teams.length) { const li = document.createElement("li"); li.textContent = "No team page found. Try the town name."; results.append(li); }
      } catch { /* the search just stays empty */ }
    }, 250);
  });

  // ?team=<slug> fills in the school (the button on team pages links here).
  const slug = new URLSearchParams(window.location.search).get("team");
  if (slug) {
    fetch("/api/teams/detail/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && data.team && data.team.id) choose(data.team); })
      .catch(() => {});
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!team) { say("Search for your school and pick it first.", "error"); search.focus(); return; }
    if (!form.elements.label.value) { say("Choose which account this is.", "error"); return; }
    if (!form.elements.handle.value.trim()) { say("Enter the Instagram handle.", "error"); return; }
    submit.disabled = true;
    say("Sending...", "");
    try {
      const response = await fetch("/api/team-instagram/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ team_id: team.id, label: form.elements.label.value, handle: form.elements.handle.value, email: form.elements.email.value, pw_hp_field: form.elements.pw_hp_field.value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That didn't go through. Please try again.");
      const handle = data.handle ? `@${data.handle}` : "That account";
      say(data.status === "already_listed" ? `${handle} is already on ${team.school_name}'s page.` : `Thanks! ${handle} (${form.elements.label.value}) is waiting for a quick check, then it shows on ${team.school_name}'s page. Have another account? Submit it too.`, "success");
      form.elements.handle.value = "";
      form.elements.label.value = "";
    } catch (error) {
      say(error.message, "error");
    } finally {
      submit.disabled = false;
    }
  });
})();
