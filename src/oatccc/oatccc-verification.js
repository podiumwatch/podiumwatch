// OATCCC team verification pages (/oatccc/admin/ and /oatccc/verify/).
// Copied to dist/scripts/ only with OATCCC_VERIFICATION_LIVE. Talks to
// /api/oatccc/verification/ with the signed-in user's token; the database
// (row-level security) decides what each person can see and do.
//
// The AD form (2026-11-17): school dropdown, boys' and girls' head coaches,
// athletic director, the agreement text (built into the page), then the
// signature pad, typed name and date. The server checks everything again.
(() => {
  const root = document.querySelector("[data-ox-ver]");
  if (!root) return;
  const mode = root.dataset.oxVer;
  const $ = (selector) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  const when = (iso) => iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "";
  const today = () => new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });
  const show = (el, on = true) => { if (el) el.hidden = !on; };
  const template = (name) => document.querySelector(`template[data-ox-${name}]`)?.innerHTML || "";

  let client = null;
  let me = null;
  let filter = "";
  let currentSchoolId = null;
  let pickable = null;

  const EVENT_LABELS = { submitted: "Submitted", returned: "Returned for changes", resubmitted: "Resubmitted", approved: "Approved", commented: "Comment" };
  const ROLE_LABELS = { admin: "OATCCC", athletic_director: "Athletic director" };

  async function getClient() {
    if (client) return client;
    const response = await fetch("/api/team/config/", { headers: { Accept: "application/json" } });
    const config = await response.json();
    if (!response.ok || !window.supabase) throw new Error("Sign-in could not be loaded. Please refresh the page.");
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
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
  // install/104: false = the AD who submitted is not in the OHSAA directory.
  const dirBadge = (s) => (s.ad_email_in_directory === false ? ' <span class="ox-badge ox-late">AD email not in directory</span>' : "");
  function schoolName(row) {
    const school = row.oatccc_schools || row;
    return `${esc(school.name)}${school.city ? `, ${esc(school.city)}` : ""}${school.is_test ? ' <span class="ox-badge ox-test">TEST</span>' : ""}`;
  }

  // ---------------- Answers (read only) ----------------
  function personHtml(person) {
    if (!person) return "<em>Not given</em>";
    const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
    return `${esc(name)}<br>${esc(person.cell_phone || "")}${person.email ? `<br><a href="mailto:${esc(person.email)}">${esc(person.email)}</a>` : ""}`;
  }
  function answersHtml(answers = {}) {
    if (!("ad" in answers)) {
      // A submission from before the final form (TEST data only).
      return `<dl class="ox-answers">${Object.entries(answers).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd></div>`).join("")}</dl>`;
    }
    const teams = [answers.has_boys ? "Boys" : "", answers.has_girls ? "Girls" : ""].filter(Boolean).join(" and ") || "None";
    const rows = [["Teams", esc(teams)]];
    for (const who of me.form.people) {
      if (who.team && !answers[who.team]) continue;
      rows.push([who.label, personHtml(answers[who.key])]);
    }
    return `<dl class="ox-answers">${rows.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join("")}</dl>`;
  }
  function signaturesHtml(signatures) {
    if (!signatures?.length) return '<p class="sub">No signature on file.</p>';
    return `<ol class="ox-sigs">${signatures.map((s) => `<li><img src="${esc(s.signature_png)}" alt="Signature of ${esc(s.typed_name)}" width="300" height="90"><span><b>${esc(s.typed_name)}</b> <small>Signed ${esc(when(s.signed_at))}</small></span></li>`).join("")}</ol>`;
  }
  function commentsHtml(comments) {
    if (!comments?.length) return '<p class="sub">No comments yet.</p>';
    return `<ol class="ox-comments">${comments.map((c) => `<li><b>${esc(ROLE_LABELS[c.author_role] || c.author_role)}</b> <small>${esc(when(c.created_at))}</small><p>${esc(c.body).replace(/\n/g, "<br>")}</p></li>`).join("")}</ol>`;
  }
  function historyHtml(events) {
    if (!events?.length) return "";
    return `<ol class="ox-history">${events.map((e) => `<li><span>${esc(EVENT_LABELS[e.event] || e.event)}${e.event === "submitted" && e.is_late ? " (late)" : ""}</span> <small>${esc(ROLE_LABELS[e.actor_role] || "")} &middot; ${esc(when(e.created_at))}</small></li>`).join("")}</ol>`;
  }

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
      ? `<ul class="ox-queue">${rows.map((r) => `<li><button type="button" data-ox-open="${esc(r.id)}"><span class="n">${schoolName(r)}</span><span class="m">${statusBadge(r.status, r.is_late)}${dirBadge(r)} <small>${esc(when(r.last_submitted_at))}</small></span></button></li>`).join("")}</ul>`
      : '<p class="sub">No forms here.</p>';
  }

  async function openSubmission(id) {
    const detail = $("[data-ox-detail]");
    detail.innerHTML = "<p>Loading.</p>";
    const { submission: s, comments, events, signatures } = await api(`?view=submission&id=${encodeURIComponent(id)}`);
    const canDecide = s.status === "submitted" || s.status === "resubmitted";
    detail.innerHTML = `
      <h2>${schoolName(s)}</h2>
      <p class="sub">${esc(s.oatccc_seasons?.name || "")} &middot; ${statusBadge(s.status, s.is_late)}${dirBadge(s)}</p>
      <p class="sub">First submitted ${esc(when(s.first_submitted_at))}${s.last_submitted_at !== s.first_submitted_at ? ` &middot; last submitted ${esc(when(s.last_submitted_at))}` : ""}</p>
      <h3>Answers</h3>${answersHtml(s.answers)}
      <h3>Signatures</h3>${signaturesHtml(signatures)}
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

  // ---------------- The form ----------------
  // Same rules as lib/oatccc_verification.mjs (the server checks again).
  const cleanPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null;
  };
  const okEmail = (value) => /^[^\s@<>()",;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(String(value || "").trim());

  function personFieldset(who, person = {}, enabled = true) {
    const id = (field) => `f-${who.key}-${field.key}`;
    const inputs = me.form.personFields.map((field) => `<label for="${id(field)}">${esc(field.label)}
        <input id="${id(field)}" name="${who.key}.${field.key}" type="${field.type}" autocomplete="off" maxlength="${field.max}" value="${esc(person?.[field.key] || "")}" required${field.type === "tel" ? ' inputmode="tel" placeholder="(614) 555-0100"' : ""}></label>`).join("");
    const team = who.team ? `<label class="ox-check ox-team"><input type="checkbox" name="${who.team}" data-ox-team="${who.key}"${enabled ? " checked" : ""}> <span>${esc(who.teamLabel)}</span></label>` : "";
    return `<section class="ox-person" aria-labelledby="h-${who.key}">
      <h3 id="h-${who.key}">${esc(who.label)}</h3>${team}
      <fieldset class="ox-people" data-ox-person="${who.key}"${enabled ? "" : " disabled hidden"}><legend class="sr">${esc(who.label)}</legend>${inputs}</fieldset>
    </section>`;
  }

  function formHtml({ answers = null, schoolPick = true, submitLabel }) {
    const has = (team) => (answers ? Boolean(answers[team]) : true);
    const people = me.form.people.map((who) => personFieldset(who, answers?.[who.key], who.team ? has(who.team) : true)).join("");
    const school = schoolPick
      ? `<section class="ox-person"><h3><label for="f-school">Name of school</label></h3>
          <select id="f-school" name="school" required data-ox-school-select><option value="">Loading the school list&hellip;</option></select>
          <p class="sub" data-ox-season-note></p></section>`
      : "";
    return `<form class="ox-vform ox-adform" data-ox-submit novalidate>
      ${template("formhead")}
      ${school}
      ${people}
      <section class="ox-person" aria-labelledby="h-agree"><h3 id="h-agree">Verification agreement</h3>
        <p class="sub">Read the agreement, then sign below.</p>
        ${template("formtext")}
      </section>
      <section class="ox-person ox-sign" aria-labelledby="h-sign"><h3 id="h-sign">Signature</h3>
        <p class="sub" id="sig-help">Sign with your finger or mouse in the box.</p>
        <div class="ox-sigpad"><canvas width="600" height="180" data-ox-sigpad aria-label="Signature box" aria-describedby="sig-help" role="img"></canvas>
          <button class="btn ghost small" type="button" data-ox-sigclear>Clear signature</button></div>
        <label for="f-typed">Type your name<input id="f-typed" name="typed_name" type="text" autocomplete="name" maxlength="120" required></label>
        <p class="ox-sigdate"><b>Date</b> <span>${esc(today())}</span></p>
      </section>
      <button class="btn" type="submit">${esc(submitLabel)}</button>
      <p class="ox-vmsg" role="status" aria-live="polite"></p>
    </form>`;
  }

  // Signature pad: draws with a finger, pen or mouse.
  function signaturePad(canvas) {
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let ink = 0;
    let last = null;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const reset = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ink = 0; };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    canvas.addEventListener("pointerdown", (event) => { drawing = true; last = point(event); canvas.setPointerCapture(event.pointerId); event.preventDefault(); });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      const p = point(event);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ink += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    });
    const stop = () => { drawing = false; };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    return { reset, signed: () => ink > 40, png: () => canvas.toDataURL("image/png") };
  }

  function readPeople(form) {
    const answers = {};
    for (const who of me.form.people) {
      if (who.team) answers[who.team] = Boolean(form.elements[who.team]?.checked);
      if (who.team && !answers[who.team]) { answers[who.key] = null; continue; }
      answers[who.key] = Object.fromEntries(me.form.personFields.map((field) => [field.key, String(form.elements[`${who.key}.${field.key}`]?.value || "").trim()]));
    }
    return answers;
  }

  function checkForm(form, answers, pad, needSchool) {
    if (needSchool && !form.elements.school.value) return [form.elements.school, "Pick your school from the list."];
    if (!answers.has_boys && !answers.has_girls) return [form.elements.has_boys, "Check at least one team: boys or girls."];
    for (const who of me.form.people) {
      const person = answers[who.key];
      if (!person) continue;
      for (const field of me.form.personFields) {
        const input = form.elements[`${who.key}.${field.key}`];
        if (!person[field.key]) return [input, `${who.label}: enter the ${field.label.toLowerCase()}.`];
        if (field.key === "cell_phone" && !cleanPhone(person[field.key])) return [input, `${who.label}: enter a 10-digit cell phone number.`];
        if (field.key === "email" && !okEmail(person[field.key])) return [input, `${who.label}: enter a valid email address.`];
      }
    }
    if (!pad.signed()) return [form.querySelector("[data-ox-sigpad]"), "Sign in the signature box."];
    if (String(form.elements.typed_name.value).trim().length < 2) return [form.elements.typed_name, "Type your name to sign."];
    return null;
  }

  function seasonNote(season) {
    if (!season) return "No verification season is open for this school yet.";
    const now = Date.now();
    if (now < Date.parse(season.opens_at)) return `The form opens ${when(season.opens_at)}.`;
    if (now > Date.parse(season.late_closes_at)) return "The late window has closed. No forms are accepted.";
    if (now > Date.parse(season.due_at)) return `The deadline has passed. A form submitted now is late ($100 fine) and must be in by ${when(season.late_closes_at)}.`;
    return `Due ${when(season.due_at)}.`;
  }

  function wireForm(form, { schoolId = null, seasonId = null, onDone }) {
    const pad = signaturePad(form.querySelector("[data-ox-sigpad]"));
    form.querySelector("[data-ox-sigclear]").addEventListener("click", pad.reset);
    form.addEventListener("change", (event) => {
      const team = event.target.closest("[data-ox-team]");
      if (team) { const set = form.querySelector(`[data-ox-person="${team.dataset.oxTeam}"]`); set.disabled = !team.checked; set.hidden = !team.checked; }
    });
    const select = form.querySelector("[data-ox-school-select]");
    if (select) {
      const note = form.querySelector("[data-ox-season-note]");
      // The OHSAA directory (install/104): if this email is a school's AD
      // email, only that school can be picked (locked when there is one).
      // null = no directory check yet (104 not run).
      const mine = Array.isArray(me.directorySchools) ? me.directorySchools : null;
      const dirNote = document.createElement("p");
      dirNote.className = "sub";
      select.after(dirNote);
      const describe = () => {
        const school = pickable?.find((s) => s.id === select.value);
        note.textContent = school ? seasonNote(me.seasons.find((x) => x.id === school.season_id)) : "";
      };
      const fill = (list) => {
        let options = list;
        if (mine && mine.length) {
          const ids = new Set(mine.map((s) => s.id));
          const own = list.filter((s) => ids.has(s.id));
          if (own.length) options = [...own, ...list.filter((s) => s.is_test)];
        }
        select.innerHTML = `<option value="">Choose your school</option>${options.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.is_test ? " (TEST)" : ""}</option>`).join("")}`;
        if (mine && mine.length === 1 && options.some((s) => s.id === mine[0].id)) {
          select.value = mine[0].id;
          select.disabled = true;
          dirNote.textContent = "Your email is listed as this school's athletic director in the OHSAA directory.";
        } else if (mine && mine.length > 1) {
          dirNote.textContent = "Your email is listed as the athletic director of these schools in the OHSAA directory.";
        } else if (mine) {
          dirNote.textContent = "Your email is not listed as a school's athletic director in the OHSAA directory. Pick your school; the Indoor State Meet Chair will check it.";
        }
        describe();
      };
      (pickable ? Promise.resolve(pickable) : api("?view=schools").then((data) => (pickable = data.schools)))
        .then(fill)
        .catch((error) => { select.innerHTML = `<option value="">${esc(error.message)}</option>`; });
      select.addEventListener("change", describe);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const msg = form.querySelector(".ox-vmsg");
      const answers = readPeople(form);
      for (const who of me.form.people) {
        const person = answers[who.key];
        if (person?.cell_phone) { const phone = cleanPhone(person.cell_phone); if (phone) { person.cell_phone = phone; form.elements[`${who.key}.cell_phone`].value = phone; } }
      }
      const problem = checkForm(form, answers, pad, Boolean(select));
      if (problem) { msg.textContent = problem[1]; problem[0]?.focus?.(); return; }
      const school = select ? pickable.find((s) => s.id === select.value) : null;
      const season = select ? school?.season_id : seasonId;
      if (!season) { msg.textContent = "No verification season is open for this school yet."; return; }
      msg.textContent = "Sending.";
      try {
        await api("", {
          action: "submit",
          season_id: season,
          school_id: select ? school.id : schoolId,
          answers,
          signature: { typed_name: form.elements.typed_name.value.trim(), png: pad.png() }
        });
        await onDone(select ? school.id : schoolId);
      } catch (error) { msg.textContent = error.message; }
    });
  }

  // ---------------- Athletic director ----------------
  function schoolChips(activeId) {
    const chips = me.schools.map((school) => `<button type="button" class="ox-chip" data-ox-pick="${esc(school.id)}" aria-pressed="${school.id === activeId}">${esc(school.name)}</button>`);
    if (me.choice === "pick" && me.schools.length) chips.push(`<button type="button" class="ox-chip" data-ox-pick="new" aria-pressed="${activeId === "new"}">Another school</button>`);
    $("[data-ox-schools]").innerHTML = chips.length > 1 ? chips.join("") : "";
  }

  async function refreshMe() {
    me = await api("?view=me");
  }

  function newForm() {
    currentSchoolId = "new";
    schoolChips("new");
    const box = $("[data-ox-school]");
    box.innerHTML = `<section class="ox-vcard">${formHtml({ submitLabel: "Sign and submit" })}</section>`;
    wireForm(box.querySelector("[data-ox-submit]"), { onDone: async (schoolId) => { await refreshMe(); await loadSchool(schoolId); } });
  }

  async function loadSchool(schoolId) {
    currentSchoolId = schoolId;
    schoolChips(schoolId);
    const box = $("[data-ox-school]");
    box.innerHTML = '<section class="ox-vcard"><p>Loading.</p></section>';
    const data = await api(`?view=mine&school=${encodeURIComponent(schoolId)}`);
    const school = data.school;
    const season = school.season;
    if (!season) { box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p>No verification season is open for your school yet.</p></section>`; return; }
    const s = data.submission;
    if (!s) {
      box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2><p class="sub">${esc(seasonNote(season))}</p>${formHtml({ schoolPick: false, submitLabel: "Sign and submit" })}</section>`;
    } else {
      const returned = s.status === "returned";
      box.innerHTML = `<section class="ox-vcard"><h2>${schoolName(school)}</h2>
        <p class="sub">${esc(season.name)} &middot; ${statusBadge(s.status, s.is_late)}</p>
        ${returned ? '<p class="ox-note">The Chair returned your form. Read the comment below, fix the form, sign it again and resubmit it.</p>' : ""}
        <h3>Comments</h3>${commentsHtml(data.comments)}
        ${returned
          ? formHtml({ answers: s.answers, schoolPick: false, submitLabel: "Sign and resubmit" })
          : `<h3>Your answers</h3>${answersHtml(s.answers)}<h3>Signature</h3>${signaturesHtml(data.signatures)}`}
        <h3>History</h3>${historyHtml(data.events)}</section>`;
    }
    const form = box.querySelector("[data-ox-submit]");
    if (form) wireForm(form, { schoolId: school.id, seasonId: season.id, onDone: (id) => loadSchool(id) });
  }

  // ---------------- Start ----------------
  async function start() {
    show($("[data-ox-loading]"), true);
    try {
      await getClient();
      const { data } = await client.auth.getSession();
      if (!data?.session) { show($("[data-ox-loading]"), false); show($("[data-ox-signin]"), true); return; }
      await refreshMe();
      show($("[data-ox-loading]"), false);
      show($("[data-ox-signin]"), false);
      $("[data-ox-who-text]").textContent = `Signed in as ${me.email || "you"}.`;
      show($("[data-ox-who]"), true);
      const allowed = mode === "admin" ? me.isAdmin : (me.schools.length > 0 || me.choice === "pick");
      if (!allowed) {
        $("[data-ox-denied-text]").textContent = mode === "admin"
          ? (me.role ? "Your OATCCC role does not include the Indoor State Meet." : "This account is not an OATCCC admin.")
          : "This account is not linked to a school yet. Contact the Indoor State Meet Chairperson.";
        show($("[data-ox-denied]"), true);
        return;
      }
      show($("[data-ox-app]"), true);
      if (mode === "admin") await loadQueue();
      else if (me.schools.length) await loadSchool(me.schools[0].id);
      else newForm();
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
    if (pick && pick.dataset.oxPick !== currentSchoolId) {
      if (pick.dataset.oxPick === "new") newForm(); else loadSchool(pick.dataset.oxPick).catch(() => {});
      return;
    }
    if (event.target.closest("[data-ox-signout]")) { await client?.auth.signOut(); window.location.reload(); }
  });

  // Sign-in. Athletic directors: a sign-in link sent to their email
  // (Supabase Auth sends it). Admins: email and password.
  const signin = $("[data-ox-signin-form]");
  signin?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = $("[data-ox-signin-msg]");
    const email = signin.elements.email.value.trim();
    try {
      await getClient();
      if (signin.dataset.oxSigninForm === "link") {
        msg.textContent = "Sending.";
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: true } });
        if (error) throw error;
        msg.textContent = "Check your email for the sign-in link. It works once; open it on this device.";
        return;
      }
      msg.textContent = "Signing in.";
      const { error } = await client.auth.signInWithPassword({ email, password: signin.elements.password.value });
      if (error) throw error;
      msg.textContent = "";
      await start();
    } catch (error) { msg.textContent = error.message || "Sign-in failed."; }
  });

  start();
})();
