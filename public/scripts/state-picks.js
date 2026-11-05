// State Meet Picks (src/pages/statepicks.mjs): saves a reader's eight
// champion picks and, once the first race has started, shows everyone's.
(() => {
  const root = document.querySelector("[data-state-picks]");
  const fieldNode = document.getElementById("state-picks-field");
  if (!root || !fieldNode) return;

  const field = JSON.parse(fieldNode.textContent);
  const lockAt = new Date(field.lockAt).getTime();
  const form = root.querySelector("[data-spk-form]");
  const status = root.querySelector("[data-spk-status]");
  const countLine = root.querySelector("[data-spk-count]");
  const storageKey = "pw-state-picks-2026";

  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private window */ } };

  function voterToken() {
    let token = read("pw-state-picks-token");
    if (!token) {
      token = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, "");
      write("pw-state-picks-token", token);
    }
    return token;
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function showMine(saved) {
    if (!saved) return;
    const box = root.querySelector("[data-spk-mine]");
    root.querySelector("[data-spk-mine-name]").textContent = `Saved as ${saved.name}`;
    const list = root.querySelector("[data-spk-mine-list]");
    list.replaceChildren(...field.races.map((race) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${race.label}: `;
      li.append(label, document.createTextNode(saved.picks[race.key] || "--"));
      return li;
    }));
    box.hidden = false;
  }

  let saved = null;
  try { saved = JSON.parse(read(storageKey) || "null"); } catch { saved = null; }
  if (saved && form) {
    form.elements.name.value = saved.name || "";
    for (const race of field.races) if (saved.picks?.[race.key]) form.elements[race.key].value = saved.picks[race.key];
    showMine(saved);
  }

  function renderResults(data) {
    root.querySelector("[data-spk-open]").hidden = true;
    const results = root.querySelector("[data-spk-results]");
    root.querySelector("[data-spk-results-meta]").textContent = `${data.count} ${data.count === 1 ? "person" : "people"} made picks. Picks locked when the first race started.`;
    const tallies = root.querySelector("[data-spk-tallies]");
    tallies.replaceChildren(...data.tallies.map((race) => {
      const box = document.createElement("div");
      box.className = "spk-tally";
      const h = document.createElement("h3");
      h.textContent = race.label;
      const ol = document.createElement("ol");
      for (const row of race.teams) {
        const li = document.createElement("li");
        const b = document.createElement("b");
        b.textContent = ` ${row.count} (${Math.round((row.count / Math.max(data.count, 1)) * 100)}%)`;
        li.append(document.createTextNode(row.team), b);
        ol.append(li);
      }
      if (!race.teams.length) ol.append(Object.assign(document.createElement("li"), { textContent: "No picks" }));
      box.append(h, ol);
      return box;
    }));
    results.hidden = false;

    const rows = root.querySelector("[data-spk-rows]");
    const render = (filter) => {
      const needle = filter.trim().toLowerCase();
      rows.replaceChildren(...data.entries.filter((entry) => !needle || entry.name.toLowerCase().includes(needle)).map((entry) => {
        const tr = document.createElement("tr");
        for (const value of [entry.name, ...field.races.map((race) => entry.picks?.[race.key] || "--")]) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        }
        return tr;
      }));
    };
    render("");
    root.querySelector("[data-spk-filter]").addEventListener("input", (event) => render(event.target.value));
    root.querySelector("[data-spk-entries]").hidden = false;
  }

  async function load() {
    try {
      const response = await fetch("/api/state-picks/entries/", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("load failed");
      const data = await response.json();
      if (data.locked) return renderResults(data);
      countLine.textContent = `${data.count} ${data.count === 1 ? "person has" : "people have"} made picks so far.`;
      countLine.hidden = false;
    } catch {
      if (Date.now() >= lockAt) setStatus("Everyone's picks could not be loaded. Refresh to try again.", true);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (Date.now() >= lockAt) { setStatus("Picks are locked. The first race has started.", true); return load(); }
    const name = form.elements.name.value.trim();
    if (name.length < 2) { setStatus("Enter your name.", true); return form.elements.name.focus(); }
    const picks = {};
    for (const race of field.races) {
      const value = form.elements[race.key].value;
      if (!value) { setStatus(`Pick a champion for ${race.label}.`, true); return form.elements[race.key].focus(); }
      picks[race.key] = value;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setStatus("Saving your picks...");
    try {
      const response = await fetch("/api/state-picks/submit/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, picks, voter_token: voterToken(), website: form.elements.website.value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your picks could not be saved right now. Please try again.");
      const mine = { name: data.name || name, picks: data.picks || picks };
      write(storageKey, JSON.stringify(mine));
      showMine(mine);
      setStatus(data.updated ? "Your picks are updated." : "Your picks are in. Check back after the first race starts to see everyone's.");
      load();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  load();
  // Flip to everyone's picks on its own once the lock passes.
  const wait = lockAt - Date.now();
  if (wait > 0 && wait < 2 ** 31 - 1) setTimeout(() => setTimeout(load, 25000), wait);
})();
