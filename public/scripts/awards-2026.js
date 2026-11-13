// 2026 Athlete/Team/Coach of the Year pages (src/pages/yearlyawards2026.mjs).
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

  // Athlete names as shown (same rule as src/lib/display_names.mjs):
  // no parenthetical nickname, Mc surnames and O' names capitalized, no ALL CAPS.
  function displayName(value) {
    let t = String(value == null ? "" : value).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (/[A-Z]{2}/.test(t) && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, s, c) => s + c.toUpperCase());
    return t.split(" ").map((w, i) => { w = w.replace(/^(O['’])([a-z])/, (m, p, c) => p + c.toUpperCase()); return i > 0 ? w.replace(/^Mc([a-z])/, (m, c) => "Mc" + c.toUpperCase()) : w; }).join(" ");
  }
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

  let turnstileKey = null;
  async function fetchStatus() {
    try {
      const response = await fetch("/api/awards-2026/status/", { headers: { accept: "application/json" } });
      if (!response.ok) return null;
      const body = await response.json();
      turnstileKey = body.turnstile_site_key || null;
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
    let latest = null;
    paint(null);
    fetchStatus().then((categories) => { if (categories) { latest = categories; paint(categories); } });
    // Repaint every 15 seconds so a hub left open flips to "Voting closed"
    // on time (site fixes A3, 2026-11-13). No extra requests.
    setInterval(() => paint(latest), 15000);
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

  // Voting: finalists, one vote per category per browser, no counts.
  const voteCard = root.querySelector("[data-yoy-vote]");
  const voteTitle = root.querySelector("[data-yoy-vote-title]");
  const voteHint = root.querySelector("[data-yoy-vote-hint]");
  const finalistList = root.querySelector("[data-yoy-finalists]");
  const castButton = root.querySelector("[data-yoy-cast]");
  const votedNote = root.querySelector("[data-yoy-voted]");
  const voteMessage = root.querySelector("[data-yoy-vote-message]");
  const turnstileBox = root.querySelector("[data-yoy-turnstile]");
  // One vote per category every hour: remember the last vote and when the
  // next one is allowed; the page re-enables voting once that time passes.
  const voteKey = `pw-yoty-2026-vote-${data.slug}`;
  let votedFor = null;
  let nextVoteAt = 0;
  try { const saved = JSON.parse(read(voteKey) || "null"); if (saved && saved.n > Date.now()) { votedFor = saved.f; nextVoteAt = saved.n; } } catch { /* ignore */ }
  const rememberVote = (finalist, nextIso) => {
    votedFor = finalist;
    nextVoteAt = nextIso ? Date.parse(nextIso) : Date.now() + 60 * 60 * 1000;
    write(voteKey, JSON.stringify({ f: votedFor, n: nextVoteAt }));
  };
  // Clears the vote once its hour is up, so the finalists become buttons again.
  const coolingDown = () => {
    if (votedFor && Date.now() >= nextVoteAt) { votedFor = null; nextVoteAt = 0; checkedMine = false; write(voteKey, ""); }
    return Boolean(votedFor);
  };
  const nextVoteTime = () => new Date(nextVoteAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  let pickedFinalist = null;
  let paintedVote = "";
  let checkedMine = false;
  let turnstileToken = "";
  let turnstileLoaded = false;

  function setVoteMessage(text, isError = false) {
    voteMessage.textContent = text;
    voteMessage.classList.toggle("is-error", isError);
  }

  // Each finalist's share link (2026-11-10): /awards/2026/<category>/<name>/,
  // or their nominee key when two finalists share a name (same rule as
  // lib/awards_share.mjs finalistSlugs). The link's preview is their own
  // card; it opens this page scrolled to them.
  const slugifyName = (value) => displayName(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  function finalistSlugs(finalists) {
    const counts = new Map();
    for (const item of finalists) { const s = slugifyName(item.name); counts.set(s, (counts.get(s) || 0) + 1); }
    return new Map(finalists.map((item) => { const s = slugifyName(item.name); return [item.id, s && counts.get(s) === 1 ? s : String(item.id).toLowerCase().replace(/[^a-z0-9-]/g, "")]; }));
  }
  const focusSlug = root.dataset.yoyFocus || "";
  let focused = false;
  async function copyFinalistLink(item, slug, button) {
    const url = `${window.location.origin}/awards/2026/${data.slug}/${slug}/`;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied";
      setVoteMessage(`Link copied. Send it so others can vote for ${displayName(item.name)}.`);
    } catch {
      button.textContent = "Share";
      setVoteMessage(`Copy this link: ${url}`);
    }
    window.setTimeout(() => { button.textContent = "Share"; }, 2500);
  }

  function finalistName(id) {
    const match = (category.finalists || []).find((item) => item.id === id);
    return match ? match.name : "";
  }

  function loadTurnstile() {
    if (!turnstileKey || turnstileLoaded || votedFor) return;
    turnstileLoaded = true;
    window.pwYotyTurnstile = () => {
      try {
        window.turnstile.render(turnstileBox, { sitekey: turnstileKey, callback: (token) => { turnstileToken = token; }, "expired-callback": () => { turnstileToken = ""; } });
      } catch { /* widget failed; the server will say so */ }
    };
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=pwYotyTurnstile&render=explicit";
    script.async = true;
    document.head.append(script);
  }

  async function checkMine() {
    if (checkedMine || votedFor) return;
    checkedMine = true;
    try {
      const response = await fetch("/api/awards-2026/vote/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mine", categories: [data.slug], browser_token: browserToken() }) });
      const body = await response.json().catch(() => ({}));
      const mine = body.votes && body.votes[data.slug];
      if (mine && mine.voted_for) { rememberVote(mine.voted_for, mine.next_vote_at); paintedVote = ""; paintVote(statusOf(category)); }
    } catch { /* offline: the vote endpoint still enforces one vote */ }
  }

  function paintVote(status) {
    const finalists = category.finalists || [];
    const show = finalists.length > 0 && ["selecting_finalists", "voting_open", "voting_closed", "published"].includes(status);
    voteCard.hidden = !show;
    // "Vote below" under the store card: only while voting is open.
    const voteBelow = root.querySelector("[data-yoy-vote-below]");
    if (voteBelow) voteBelow.hidden = !(show && status === "voting_open");
    if (!show) return;
    coolingDown();
    const signature = [status, votedFor, pickedFinalist, finalists.map((item) => `${item.id}:${item.name}:${item.note}:${item.winner}:${item.votes}`).join("|"), category.vote_total].join("#");
    if (signature === paintedVote) return;
    paintedVote = signature;
    const canVote = status === "voting_open" && !votedFor;
    voteTitle.textContent = status === "published" ? "Winner" : status === "voting_open" ? (votedFor ? "Thanks for voting" : "Vote for one finalist") : "Finalists";
    voteHint.textContent = {
      selecting_finalists: `Voting opens ${formatEt(category.voting_open_at)}.`,
      voting_open: votedFor ? "You can vote once an hour in each category. Vote counts update about every 30 seconds." : "Tap a finalist, then cast your vote. You can vote once an hour in each category.",
      voting_closed: "Voting is closed. Winners are announced Saturday morning, Nov. 14.",
      published: "Congratulations to the winner and every finalist."
    }[status] || "";
    const ordered = status === "published" ? [...finalists].sort((a, b) => Number(Boolean(b.winner)) - Number(Boolean(a.winner))) : finalists;
    const slugs = finalistSlugs(finalists);
    finalistList.replaceChildren();
    let focusItem = null;
    for (const item of ordered) {
      const li = document.createElement("li");
      li.className = "yoy-finalist-row";
      li.dataset.finalist = slugs.get(item.id);
      if (focusSlug && slugs.get(item.id) === focusSlug) { li.classList.add("is-focus"); focusItem = li; }
      const box = document.createElement(canVote ? "button" : "div");
      box.className = "yoy-finalist" + (status === "published" && item.winner ? " is-winner" : "");
      if (canVote) {
        box.type = "button";
        box.setAttribute("aria-pressed", String(pickedFinalist === item.id));
        box.addEventListener("click", () => { pickedFinalist = item.id; setVoteMessage(""); paintedVote = ""; paintVote(statusOf(category)); });
      } else if (votedFor === item.id && status !== "published") {
        box.setAttribute("aria-pressed", "true");
      }
      if (status === "published" && item.winner) {
        const tag = document.createElement("span");
        tag.className = "yoy-winner-tag";
        tag.textContent = "Winner";
        box.append(tag);
      }
      const name = document.createElement("b");
      name.textContent = displayName(item.name);
      box.append(name);
      if (item.school && item.school !== item.name) { const small = document.createElement("small"); small.textContent = item.school; box.append(small); }
      if (item.note) { const note = document.createElement("em"); note.textContent = item.note; box.append(note); }
      // Live vote count (about every 30 seconds).
      if (typeof item.votes === "number") { const count = document.createElement("span"); count.className = "yoy-votes"; count.textContent = `${item.votes.toLocaleString("en-US")} vote${item.votes === 1 ? "" : "s"}`; box.append(count); }
      li.append(box);
      const share = document.createElement("button");
      share.type = "button";
      share.className = "yoy-share-finalist";
      share.textContent = "Share";
      share.setAttribute("aria-label", `Copy ${displayName(item.name)}'s share link`);
      share.addEventListener("click", () => copyFinalistLink(item, slugs.get(item.id), share));
      li.append(share);
      // Their athlete or team page, shown only when it matches exactly one
      // page (public/scripts/name-links.js); hidden otherwise.
      const page = document.createElement("span");
      page.className = "yoy-page-link";
      if (data.award === "athlete") {
        if (item.school) { page.textContent = "Athlete page"; page.dataset.pwAthlete = item.name; page.dataset.pwAthleteSchool = item.school; li.append(page); }
      } else if (/^[0-9a-f-]{36}$/.test(String(item.id))) {
        page.textContent = "Team page";
        page.dataset.pwSchoolId = item.id;
        li.append(page);
      }
      finalistList.append(li);
    }
    if (typeof window.pwNameLinks === "function") window.pwNameLinks(finalistList);
    // Opened from a finalist's share link: scroll to them once.
    if (focusItem && !focused) {
      focused = true;
      window.requestAnimationFrame(() => focusItem.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    }
    if (typeof category.vote_total === "number") {
      const li = document.createElement("li");
      li.className = "yoy-total";
      li.textContent = `${category.vote_total.toLocaleString("en-US")} vote${category.vote_total === 1 ? "" : "s"} cast in this category`;
      finalistList.append(li);
    }
    castButton.hidden = !canVote;
    // Shop card below the finalists and the vote button (merch-card.js
    // sets it up once it shows).
    const ballotShop = root.querySelector("[data-yoy-ballot-shop]");
    if (ballotShop && ballotShop.hidden === canVote) { ballotShop.hidden = !canVote; if (canVote) document.dispatchEvent(new CustomEvent("pw:shop-shown")); }
    castButton.disabled = !pickedFinalist;
    castButton.textContent = pickedFinalist ? `Vote for ${finalistName(pickedFinalist)}` : "Pick a finalist";
    votedNote.hidden = !votedFor || status === "published";
    if (votedFor) votedNote.textContent = `${finalistName(votedFor) ? `You voted for ${finalistName(votedFor)}.` : "You voted in this category."} You can vote again at ${nextVoteTime()} ET.`;
    turnstileBox.hidden = !canVote;
    if (status === "voting_open") { loadTurnstile(); checkMine(); }
  }

  castButton.addEventListener("click", async () => {
    if (!pickedFinalist || votedFor) return;
    castButton.disabled = true;
    setVoteMessage("Sending your vote...");
    try {
      const response = await fetch("/api/awards-2026/vote/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: data.slug, finalist: pickedFinalist, browser_token: browserToken(), website: root.querySelector("[data-yoy-vote-trap]").value, turnstile_token: turnstileToken })
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        rememberVote(pickedFinalist, body.next_vote_at);
      } else if (body.voted_for) {
        rememberVote(body.voted_for, body.next_vote_at);
      } else {
        if (window.turnstile && turnstileToken) { try { window.turnstile.reset(turnstileBox); } catch { /* ignore */ } turnstileToken = ""; }
        throw new Error(body.error || "Voting is busy, try again in a minute.");
      }
      setVoteMessage(response.ok ? "Vote counted. Share this page so others can vote too." : body.error, !response.ok);
      // Podium Watch Store card in the confirmation (merch-card.js).
      if (response.ok) document.dispatchEvent(new CustomEvent("pw:voted", { detail: { category: data.slug } }));
      paintedVote = "";
      paintVote(statusOf(category));
    } catch (error) {
      setVoteMessage(error.message, true);
      castButton.disabled = false;
    }
  });

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
    const hasFinalists = (category.finalists || []).length > 0;
    nominateCard.hidden = !open;
    closedCard.hidden = open || status === "voting_open" || status === "published" || (hasFinalists && status === "selecting_finalists");
    paintVote(status);
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
  const refresh = () => fetchStatus().then((categories) => {
    const live = (categories || []).find((item) => item.slug === data.slug);
    if (live) { category = live; paintStatus(); }
  });
  refresh();
  setInterval(refresh, 30000);

  // Search and nominate.
  const isAthlete = data.award === "athlete";
  const isCoach = data.award === "coach";
  const pool = data.pool.map((row) => (isCoach ? { id: row[0], name: row[1], city: row[2] } : isAthlete
    ? { id: row[0], name: row[1], school: row[2], grade: row[3], seasonBest: row[4], place: row[5], regional: row[6] }
    : { id: row[0], name: row[1], place: row[2], score: row[3], regional: row[4] }));
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");
  const ordinal = (n) => { const v = Number(n); if (!Number.isFinite(v)) return ""; const t = v % 100; return v + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[v % 10] || "th"); };
  const detail = (item) => (isCoach ? (item.city && !normalize(item.name).startsWith(normalize(item.city)) ? item.city : "") : isAthlete
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
    const matches = pool.filter((item) => { const hay = normalize(`${item.name} ${item.school || ""} ${item.city || ""}`); return words.every((word) => hay.includes(word)); }).slice(0, 25);
    if (!matches.length) {
      const li = document.createElement("li");
      li.className = "yoy-hint";
      li.textContent = isCoach ? `No school in this division matches "${search.value.trim()}". It may be listed in another division.` : `No ${isAthlete ? "state qualifier" : "state-qualifying team"} in this division matches "${search.value.trim()}".`;
      results.append(li);
      return;
    }
    for (const item of matches) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("b");
      name.textContent = displayName(item.name) + (done.includes(item.id) ? "  (you nominated)" : "");
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
    name.textContent = displayName(item.name);
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
    if (!choice) { setMessage(`Search and pick ${isAthlete ? "an athlete" : isCoach ? "a school" : "a team"} first.`, true); search.focus(); return; }
    const coachInput = form.elements.coach_name;
    if (isCoach && coachInput.value.trim().length < 2) { setMessage("Enter the coach's name.", true); coachInput.focus(); return; }
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
          coach_name: isCoach ? form.elements.coach_name.value : undefined,
          browser_token: browserToken(),
          website: form.elements.website.value
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Your nomination could not be saved right now. Please try again.");
      if (!done.includes(choice.id)) { done.push(choice.id); write(doneKey, JSON.stringify(done)); }
      setMessage(isCoach ? `Thanks! ${form.elements.coach_name.value.trim()} (${choice.name}) is nominated. You can nominate another coach too.` : `Thanks! ${choice.name} is nominated. You can nominate someone else too.`);
      if (isCoach) form.elements.coach_name.value = "";
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
