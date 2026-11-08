// 2026 Athlete/Team of the Year pages (src/pages/yearlyawards2026.mjs).
// Works out each category's status from the clock (same rules as
// categoryStatus in lib/yearly_awards_2026.mjs), refreshes the schedule
// from /api/awards-2026/status/, and runs the nomination search and form.
// Kept to plain DOM APIs for the Instagram in-app browser.
(() => {
  const dataNode = document.getElementById("yoy-data");
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);

  const STATUS_LABELS = {
    upcoming: "Nominations open soon",
    nominations_open: "Nominations open",
    selecting_finalists: "Nominations closed",
    finalists_coming_soon: "Finalists coming soon",
    voting_open: "Voting open",
    voting_closed: "Voting closed",
    published: "Winners announced"
  };

  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private window */ } };

  function browserToken() {
    let token = read("pw-yoty-2026-token");
    if (!token) {
      const random = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      token = random.replace(/[^a-zA-Z0-9-]/g, "");
      write("pw-yoty-2026-token", token);
    }
    return token;
  }

  function statusOf(category, now = Date.now()) {
    const at = (value) => (value ? new Date(value).getTime() : null);
    if (category.results_published_at && at(category.results_published_at) <= now) return "published";
    if (now < at(category.nominations_open_at)) return "upcoming";
    if (now < at(category.nominations_close_at)) return "nominations_open";
    if (now < at(category.voting_open_at)) return "selecting_finalists";
    if (now < at(category.voting_close_at)) return (category.finalist_count || 0) > 0 ? "voting_open" : "finalists_coming_soon";
    return "voting_closed";
  }

  function formatEt(iso) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(new Date(iso));
      const get = (type) => (parts.find((part) => part.type === type) || {}).value || "";
      return `${get("weekday")}, ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
    } catch {
      return new Date(iso).toLocaleString();
    }
  }

  function countdown(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  }

  async function fetchStatus() {
    try {
      const response = await fetch("/api/awards-2026/status/", { headers: { accept: "application/json" } });
      if (!response.ok) return null;
      const body = await response.json();
      return Array.isArray(body.categories) ? body.categories : null;
    } catch {
      return null;
    }
  }

  // Hub: one status chip per category.
  if (data.hub) {
    const fallback = { ...data.schedule, finalist_count: 0 };
    const paint = (categories) => {
      document.querySelectorAll("[data-yoy-chip]").forEach((chip) => {
        const category = (categories || []).find((item) => item.slug === chip.dataset.yoyChip) || fallback;
        chip.textContent = STATUS_LABELS[statusOf(category)];
      });
    };
    paint(null);
    fetchStatus().then((categories) => { if (categories) paint(categories); });
    return;
  }

  const root = document.querySelector("[data-yoy-category]");
  if (!root) return;
  let category = { slug: data.slug, ...data.schedule, finalist_count: 0 };

  const statusEl = root.querySelector("[data-yoy-status]");
  const countdownEl = root.querySelector("[data-yoy-countdown]");
  const whenEl = root.querySelector("[data-yoy-when]");
  const nominateCard = root.querySelector("[data-yoy-nominate]");
  const closedCard = root.querySelector("[data-yoy-closed]");
  const closedTitle = root.querySelector("[data-yoy-closed-title]");
  const closedText = root.querySelector("[data-yoy-closed-text]");

  function paintStatus() {
    const status = statusOf(category);
    statusEl.textContent = STATUS_LABELS[status];
    const target = {
      upcoming: ["Nominations open", category.nominations_open_at],
      nominations_open: ["Nominations close", category.nominations_close_at],
      selecting_finalists: ["Voting opens", category.voting_open_at],
      finalists_coming_soon: ["Voting closes", category.voting_close_at],
      voting_open: ["Voting closes", category.voting_close_at]
    }[status];
    if (target) {
      const left = countdown(target[1]);
      countdownEl.textContent = left ? `${target[0]} in ${left}` : "";
      whenEl.textContent = `${target[0]} ${formatEt(target[1])}.`;
    } else {
      countdownEl.textContent = "";
      whenEl.textContent = status === "published" ? "The winner has been announced." : "Winners are announced Saturday morning, Nov. 14.";
    }
    root.querySelectorAll("[data-step]").forEach((step) => {
      const current = { upcoming: "nominations", nominations_open: "nominations", selecting_finalists: "voting", finalists_coming_soon: "voting", voting_open: "voting" }[status] || "winners";
      if (step.dataset.step === current) step.setAttribute("data-current", ""); else step.removeAttribute("data-current");
    });

    const open = status === "nominations_open";
    nominateCard.hidden = !open;
    closedCard.hidden = open;
    if (!open) {
      closedTitle.textContent = status === "upcoming" ? "Nominations open soon" : status === "selecting_finalists" ? "Nominations are closed" : STATUS_LABELS[status];
      closedText.textContent = {
        upcoming: `Nominations open ${formatEt(category.nominations_open_at)}.`,
        selecting_finalists: `Thanks for every nomination. Podium Watch is picking the finalists. Voting opens ${formatEt(category.voting_open_at)}.`,
        finalists_coming_soon: "The finalists for this category will be posted here soon.",
        voting_open: "Voting is open.",
        voting_closed: "Voting is closed. Winners are announced Saturday morning, Nov. 14.",
        published: "The winner has been announced."
      }[status] || "";
    }
  }

  paintStatus();
  setInterval(paintStatus, 1000);
  fetchStatus().then((categories) => {
    const live = (categories || []).find((item) => item.slug === data.slug);
    if (live) { category = live; paintStatus(); }
  });

  // Search and nominate.
  const isAthlete = data.award === "athlete";
  const pool = data.pool.map((row) => (isAthlete
    ? { id: row[0], name: row[1], school: row[2], grade: row[3], seasonBest: row[4], place: row[5], regional: row[6] }
    : { id: row[0], name: row[1], place: row[2], score: row[3], regional: row[4] }));
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");
  const ordinal = (n) => { const v = Number(n); if (!Number.isFinite(v)) return ""; const t = v % 100; return v + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[v % 10] || "th"); };
  const detail = (item) => (isAthlete
    ? [item.school, item.grade ? `Grade ${item.grade}` : "", item.seasonBest ? `SB ${item.seasonBest}` : "", item.place ? `${ordinal(item.place)} at ${item.regional} regional` : ""].filter(Boolean).join(" · ")
    : [item.place ? `${ordinal(item.place)} at ${item.regional} regional` : "", item.score != null ? `${item.score} points` : ""].filter(Boolean).join(" · "));

  const form = root.querySelector("[data-yoy-form]");
  const search = root.querySelector("[data-yoy-search]");
  const results = root.querySelector("[data-yoy-results]");
  const picked = root.querySelector("[data-yoy-picked]");
  const message = root.querySelector("[data-yoy-message]");
  const reasonCount = root.querySelector("[data-yoy-reason-count]");
  const doneKey = `pw-yoty-2026-nominated-${data.slug}`;
  let done = [];
  try { done = JSON.parse(read(doneKey) || "[]"); } catch { done = []; }
  let choice = null;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
  }

  function renderResults() {
    const q = normalize(search.value).trim();
    results.replaceChildren();
    if (!q) return;
    const words = q.split(/\s+/);
    const matches = pool.filter((item) => { const hay = normalize(`${item.name} ${item.school || ""}`); return words.every((word) => hay.includes(word)); }).slice(0, 25);
    if (!matches.length) {
      const li = document.createElement("li");
      li.className = "yoy-hint";
      li.textContent = `No ${isAthlete ? "state qualifier" : "state-qualifying team"} in this division matches "${search.value.trim()}".`;
      results.append(li);
      return;
    }
    for (const item of matches) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("b");
      name.textContent = item.name + (done.includes(item.id) ? "  (you nominated)" : "");
      const small = document.createElement("small");
      small.textContent = detail(item);
      button.append(name, small);
      button.addEventListener("click", () => choose(item));
      li.append(button);
      results.append(li);
    }
  }

  function choose(item) {
    choice = item;
    results.replaceChildren();
    search.value = "";
    picked.replaceChildren();
    const box = document.createElement("div");
    box.className = "yoy-pick";
    const row = document.createElement("div");
    row.className = "yoy-pick-row";
    const name = document.createElement("b");
    name.textContent = item.name;
    const change = document.createElement("button");
    change.type = "button";
    change.className = "yoy-link-button";
    change.textContent = "Change";
    change.addEventListener("click", () => { choice = null; picked.hidden = true; search.focus(); });
    row.append(name, change);
    const small = document.createElement("small");
    small.textContent = detail(item);
    box.append(row, small);
    picked.append(box);
    picked.hidden = false;
    setMessage("");
  }

  search.addEventListener("input", renderResults);
  form.elements.reason.addEventListener("input", () => {
    reasonCount.textContent = `${form.elements.reason.value.length}/300`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (statusOf(category) !== "nominations_open") { setMessage("Nominations for this category are closed.", true); return; }
    if (!choice) { setMessage(`Search and pick ${isAthlete ? "an athlete" : "a team"} first.`, true); search.focus(); return; }
    const button = form.querySelector(".yoy-submit");
    button.disabled = true;
    setMessage("Sending your nomination...");
    try {
      const response = await fetch("/api/awards-2026/nominate/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: data.slug,
          nominee_id: choice.id,
          reason: form.elements.reason.value,
          first_name: form.elements.first_name.value,
          browser_token: browserToken(),
          website: form.elements.website.value
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Your nomination could not be saved right now. Please try again.");
      if (!done.includes(choice.id)) { done.push(choice.id); write(doneKey, JSON.stringify(done)); }
      setMessage(`Thanks! ${choice.name} is nominated. You can nominate someone else too.`);
      choice = null;
      picked.hidden = true;
      form.elements.reason.value = "";
      reasonCount.textContent = "Optional, 300 characters max";
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  // Copy the share link (the in-app browser may refuse the clipboard).
  const copy = root.querySelector("[data-yoy-copy]");
  const shareUrl = root.querySelector("[data-yoy-share-url]");
  copy.addEventListener("click", () => {
    const text = shareUrl.textContent;
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents(shareUrl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copy.textContent = "Selected. Copy it";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { copy.textContent = "Copied"; }, fallback);
    } else {
      fallback();
    }
  });
})();
