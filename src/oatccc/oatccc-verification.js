// OATCCC team verification pages (/oatccc/admin/ and /oatccc/verify/).
// Copied to dist/scripts/ only with OATCCC_VERIFICATION_LIVE. Talks to
// /api/oatccc/verification/ with the signed-in user's token; the database
// (row-level security) decides what each person can see and do.
(() => {
  const root = document.querySelector("[data-ox-ver]");
  if (!root) return;
  const mode = root.dataset.oxVer;
  const $ = (selector) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  const when = (iso) => iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "";
  const show = (el, on = true) => { if (el) el.hidden = !on; };

  let client = null;
  let me = null;
  let filter = "";
  let currentSchoolId = null;

  const EVENT_LABELS = { submitted: "Submitted", returned: "Returned for changes", resubmitted: "Resubmitted", approved: "Approved", commented: "Comment" };
  const ROLE_LABELS = { admin: "OATCCC", athletic_director: "Athletic director" };

  async function getClient() {
    if (client) return client;
    const response = await fetch("/api/team/config/", { headers: { Accept: "application/json" } });
    const config = await response.json();
    if (!response.ok || !window.supabase) throw new Error("Sign-in could not be loaded. Please refresh the page.");
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
    return client;
  }

  async function api(query, body) {
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw Object.assign(new Error("Please sign in."), { status: 401 });
    const response = await fetch(`/api/oatccc/verification/${query || ""}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(json.error || "Something went wrong."), { status: response.status });
    return json;
  }

  function statusBadge(status, isLate) {
    const label = me?.statusLabels?.[status] || status;
    return `<span class="ox-badge ox-s-${esc(status)}">${esc(label)}</span>${isLate ? ' <span class="ox-badge ox-late">Late</span>' : ""}`;
  }
  function schoolName(row) {
    const school = row.oatccc_schools || row;
    return `${esc(school.name)}${school.city ? `, ${esc(school.city)}` : ""}${school.is_test ? ' <span class="ox-badge ox-test">TEST</span>' : ""}`;
  }
  function answersHtml(answers) {
    return `<dl class="ox-answers">${me.form.fields.map((field) => {
      const value = answers?.[field.key];
      const shown = field.type === "checkbox" ? (value ? "Yes" : "No") : esc(value || "").replace(/\n/g, "<br>");
      return `<div><dt>${esc(field.label)}</dt><dd>${shown || "<em>Blank</em>"}</dd></div>`;
    }).join("")}</dl>`;
  }
  function commentsHtml(comments) {
    if (!comments?.length) return '<p class="sub">No comments yet.</p>';
    return `<ol class="ox-comments">${comments.map((c) => `<li><b>${esc(ROLE_LABELS[c.author_role] || c.author_role)}</b> <small>${esc(when(c.created_at))}</small><p>${esc(c.body).replace(/\n/g, "<br>")}</p></li>`).join("")}</ol>`;
  }
  function historyHtml(events) {
    if (!events?.length) return "";
    return `<ol class="ox-history">${events.map((e) => `<li><span>${esc(EVENT_LABELS[e.event] || e.event)}${e.event === "submitted" && e.is_late ? " (late)" : ""}</span> <small>${esc(ROLE_LABELS[e.actor_role] || "")} &middot; ${esc(when(e.created_at))}</small></li>`).join("")}</ol>`;
  }
  function formFields(answers = {}) {
    return me.form.fields.map((field) => {
      const name = `f_${field.key}`;
      if (field.type === "checkbox") return `<label class="ox-check"><input type="checkbox" name="${name}"${answers[field.key] ? " checked" : ""}${field.required ? " required" : ""}> <span>${esc(field.label)}</span></label>`;
      if (field.type === "textarea") return `<label>${esc(field.label)}<textarea name="${name}" rows="4"${field.required ? " required" : ""} maxlength="${field.max || 2000}">${esc(answers[field.key] || "")}</textarea></label>`;
      return `<label>${esc(field.label)}<input type="text" name="${name}" value="${esc(answers[field.key] || "")}"${field.required ? " required" : ""} maxlength="${field.max || 200}"></label>`;
    }).join("");
  }
  function readForm(form) {
    const answers = {};
    for (const field of me.form.fields) {
      const input = form.elements[`f_${field.key}`];
      answers[field.key] = field.type === "checkbox" ? Boolean(input?.checked) : String(input?.value || "");
    }
    return answers;
  }
  const placeholderNote = () => (me.form.placeholder ? '<p class="ox-note">These questions are placeholders until the OATCCC confirms the form.</p>' : "");

  // ---------------- Admin ----------------
  async function loadQueue() {
    const all = await api("?view=queue");
    const counts = { all: all.submissions.length };
    for (const row of all.submissions) counts[row.status] = (counts[row.status] || 0) + 1;
    $("[data-ox-stats]").innerHTML = ["submitted", "resubmitted", "returned", "approved"].map((s) => `<div><b>${counts[s] || 0}</b><span>${esc(me.statusLabels[s])}</span></div>`).join("") + `<div><b>${all.submissions.filter((r) => r.is_late).length}</b><span>Late</span></div>`;
    const chips = [["", `All (${counts.all})`], ["submitted", "Submitted"], ["resubmitted", "Resubmitted"], ["returned", "Returned"], ["approved", "Approved"]];
    $("[data-ox-filters]").innerHTML = chips.map(([value, label]) => `<button type="button" class="ox-chip" data-ox-filter="${value}" aria-pressed="${filter === value}">${esc(label)}</button>`).join("");
    const rows = filter ? all.submissions.filter((r) => r.status === filter) : all.submissions;
    $("[data-ox-queue]").innerHTML = rows.length
      ? `<ul class="ox-queue">${rows.map((r) => `<li><button type="button" data-ox-open="${esc(r.id)}"><span class="n">${schoolName(r)}</span><span class="m">${statusBadge(r.status, r.is_late)} <small>${esc(when(r.last_submitted_at))}</small></span></button></li>`).join("")}</ul>`
      : '<p class="sub">No forms here.</p>';
  }

  async function openSubmission(id) {
    const detail = $("[data-ox-detail]");
    detail.innerHTML = "<p>Loading.</p>";
    const { submission: s, comments, events } = await api(`?view=submission&id=${encodeURIComponent(id)}`);
    const canDecide = s.status === "submitted" || s.status === "resubmitted";
    detail.innerHTML = `
      <h2>${schoolName(s)}</h2>
      <p class="sub">${esc(s.oatccc_seasons?.name || "")} &middot; ${statusBadge(s.status, s.is_late)}</p>
      <p class="sub">First submitted ${esc(when(s.first_submitted_at))}${s.last_submitted_at !== s.first_submitted_at ? ` &middot; last submitted ${esc(when(s.last_submitted_at))}` : ""}</p>
      <h3>Answers</h3>${answersHtml(s.answers)}
      <h3>Comments</h3>${commentsHtml(comments)}
      ${canDecide ? `<form class="ox-vform" data-ox-decide>
        <label>Comment <small>(required to return; optional when approving)</small><textarea name="comment" rows="3" maxlength="5000"></textarea></label>
        <div class="ox-vactions"><button class="btn" type="submit" name="act" value="approve">Approve</button><button class="btn ghost" type="submit" name="act" value="return">Return with comment</button></div>
        <p class="ox-vmsg" role="status"></p></form>`
        : `<form class="ox-vform" data-ox-comment><label>Add a comment<textarea name="comment" rows="3" maxlength="5000" required></textarea></label><button class="btn ghost" type="submit">Add comment</button><p class="ox-vmsg" role="status"></p></form>`}
      <h3>History</h3>${historyHtml(events)}`;
    const decide = detail.querySelector("[data-ox-decide]");
    if (decide) decide.addEventListener("submit", async (event) => {
      event.preventDefault();
      const act = event.submitter?.value;
      const msg = decide.querySelector(".ox-vmsg");
      const comment = decide.elements.comment.value;
      if (act === "return" && !comment.trim()) { msg.textContent = "Say what needs to change before returning the form."; return; }
      try {
        await api("", { action: act, submission_id: s.id, comment });
        await loadQueue();
        await openSubmission(s.id);
      } catch (error) { msg.textContent = error.message; }
    });
    const add = detail.querySelector("[data-ox-comment]");
    if (add) add.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await api("", { action: "comment", submission_id: s.id, body: add.elements.comment.value }); await openSubmission(s.id); }
      catch (error) { add.querySelector(".ox-vmsg").textContent = error.message; }
    });
  }

  // ---------------- Athletic director ----------------
  async function loadSchool(schoolId) {
    currentSchoolId = schoolId;
    const box = $("[data-ox-school]");
    $("[data-ox-schools]").innerHTML = me.schools.length > 1 ? me.schools.map((school) => `<button type="button" class="ox-chip" data-ox-pick="${esc(school.id)}" aria-pressed="${school.id === schoolId}">${esc(school.name)}</button>`).join("") : "";
    box.innerHTML = '<section class="ox-vcard"><p>Loading.</p></section>';
    const data = await api(`?view=mine&school=${encodeURIComponent(schoolId)}`);
    const school = data.school;
    const season = school.season;
    if (!season) { box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p>No verification season is open for your school yet.</p></section>`; return; }
    const now = Date.now();
    const notOpen = now < Date.parse(season.opens_at);
    const late = now > Date.parse(season.due_at);
    const closed = now > Date.parse(season.late_closes_at);
    const deadlines = `<p class="sub">Due ${esc(when(season.due_at))}. Late forms (with the $100 fine) until ${esc(when(season.late_closes_at))}.</p>`;
    const s = data.submission;
    if (!s) {
      if (notOpen) { box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p>The form opens ${esc(when(season.opens_at))}.</p>${deadlines}</section>`; return; }
      if (closed) { box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p>The late window has closed. No forms are accepted.</p>${deadlines}</section>`; return; }
      box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p class="sub">${esc(season.name)}</p>${deadlines}
        ${late ? '<p class="ox-note">The deadline has passed. A form submitted now is marked late.</p>' : ""}
        ${placeholderNote()}
        <form class="ox-vform" data-ox-submit>${formFields()}<button class="btn" type="submit">Sign and submit</button><p class="ox-vmsg" role="status"></p></form></section>`;
    } else {
      const returned = s.status === "returned";
      box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2>
        <p class="sub">${esc(season.name)} &middot; ${statusBadge(s.status, s.is_late)}</p>
        ${returned ? '<p class="ox-note">The Chair returned your form. Read the comment below, fix the form and resubmit it.</p>' : ""}
        <h3>Comments</h3>${commentsHtml(data.comments)}
        ${returned
          ? `${placeholderNote()}<form class="ox-vform" data-ox-submit>${formFields(s.answers)}<button class="btn" type="submit">Resubmit</button><p class="ox-vmsg" role="status"></p></form>`
          : `<h3>Your answers</h3>${answersHtml(s.answers)}`}
        <h3>History</h3>${historyHtml(data.events)}</section>`;
    }
    const form = box.querySelector("[data-ox-submit]");
    if (form) form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const msg = form.querySelector(".ox-vmsg");
      msg.textContent = "Sending.";
      try {
        await api("", { action: "submit", season_id: season.id, school_id: school.id, answers: readForm(form) });
        await loadSchool(school.id);
      } catch (error) { msg.textContent = error.message; }
    });
  }

  // ---------------- Start ----------------
  async function start() {
    show($("[data-ox-loading]"), true);
    try {
      await getClient();
      const { data } = await client.auth.getSession();
      if (!data?.session) { show($("[data-ox-loading]"), false); show($("[data-ox-signin]"), true); return; }
      me = await api("?view=me");
      show($("[data-ox-loading]"), false);
      show($("[data-ox-signin]"), false);
      $("[data-ox-who-text]").textContent = `Signed in as ${me.email || "you"}.`;
      show($("[data-ox-who]"), true);
      const allowed = mode === "admin" ? me.isAdmin : me.schools.length > 0;
      if (!allowed) {
        $("[data-ox-denied-text]").textContent = mode === "admin" ? "This account is not an OATCCC admin." : "This account is not linked to a school yet. Contact the Indoor State Meet Chair.";
        show($("[data-ox-denied]"), true);
        return;
      }
      show($("[data-ox-app]"), true);
      if (mode === "admin") await loadQueue(); else await loadSchool(me.schools[0].id);
    } catch (error) {
      show($("[data-ox-loading]"), false);
      if (error.status === 401) { show($("[data-ox-signin]"), true); return; }
      $("[data-ox-denied-text]").textContent = error.message;
      show($("[data-ox-denied]"), true);
    }
  }

  root.addEventListener("click", async (event) => {
    const open = event.target.closest("[data-ox-open]");
    if (open) { openSubmission(open.dataset.oxOpen).catch((error) => { $("[data-ox-detail]").innerHTML = `<p>${esc(error.message)}</p>`; }); return; }
    const chip = event.target.closest("[data-ox-filter]");
    if (chip) { filter = chip.dataset.oxFilter; loadQueue().catch(() => {}); return; }
    const pick = event.target.closest("[data-ox-pick]");
    if (pick && pick.dataset.oxPick !== currentSchoolId) { loadSchool(pick.dataset.oxPick).catch(() => {}); return; }
    if (event.target.closest("[data-ox-signout]")) { await client?.auth.signOut(); window.location.reload(); }
  });

  const signin = $("[data-ox-signin-form]");
  signin?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = $("[data-ox-signin-msg]");
    msg.textContent = "Signing in.";
    try {
      await getClient();
      const { error } = await client.auth.signInWithPassword({ email: signin.elements.email.value.trim(), password: signin.elements.password.value });
      if (error) throw error;
      msg.textContent = "";
      await start();
    } catch (error) { msg.textContent = error.message || "Sign-in failed."; }
  });

  start();
})();
