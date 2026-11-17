// /set-password/ (src/pages/setpassword.mjs): sets the password from a
// Supabase invite or password-recovery link, then sends OATCCC staff to
// the verification admin page and everyone else to the homepage.
(() => {
  const root = document.querySelector("[data-sp]");
  if (!root) return;
  const msg = root.querySelector("[data-sp-msg]");
  const form = root.querySelector("[data-sp-form]");
  const who = root.querySelector("[data-sp-who]");
  const expiredBox = root.querySelector("[data-sp-expired]");
  const noLinkBox = root.querySelector("[data-sp-nolink]");
  const staffUrl = root.dataset.staffUrl || "/";
  const MIN = 8;

  const say = (text, isError = false) => {
    msg.textContent = text;
    msg.hidden = !text;
    msg.classList.toggle("is-error", isError);
  };
  const show = (box) => {
    for (const el of [form, expiredBox, noLinkBox]) el.hidden = el !== box;
  };
  const expired = () => { say(""); show(expiredBox); };

  // Everything the link carried: "#a=b&c=d" and "?a=b".
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const param = (name) => hash.get(name) || query.get(name) || "";
  const errorCode = param("error_code");
  const errorText = param("error_description").replace(/\+/g, " ");
  // Take the tokens out of the address bar right away.
  if (location.hash || location.search) history.replaceState(null, "", location.pathname);

  const looksExpired = (text) => /expired|invalid|already been used|not found|otp/i.test(String(text || ""));

  async function getClient() {
    const response = await fetch("/api/team/config/", { headers: { Accept: "application/json" } });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "Sign-in could not be loaded.");
    if (!window.supabase || typeof window.supabase.createClient !== "function") throw new Error("The secure account library could not be loaded.");
    return window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  async function start() {
    if (errorCode || param("error")) {
      if (errorCode === "otp_expired" || errorCode === "access_denied" || looksExpired(errorText)) return expired();
      say(errorText || "That link did not work. Ask for a new one.", true);
      return;
    }
    let client;
    try { client = await getClient(); } catch (error) { say(error.message, true); return; }

    const type = param("type");
    try {
      if (hash.get("access_token") && hash.get("refresh_token")) {
        // Default Supabase link: tokens in the address after "#".
        const { error } = await client.auth.setSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token") });
        if (error) throw error;
      } else if (query.get("token_hash") && (type === "invite" || type === "recovery")) {
        // Recommended email template: {{ .TokenHash }} and the type.
        const { error } = await client.auth.verifyOtp({ token_hash: query.get("token_hash"), type });
        if (error) throw error;
      } else if (query.get("code")) {
        // PKCE link (password reset started on this site, same browser).
        const { error } = await client.auth.exchangeCodeForSession(query.get("code"));
        if (error) throw error;
      }
    } catch (error) {
      if (looksExpired(error?.message) || error?.status === 403 || error?.code === "otp_expired") return expired();
      say(error?.message || "That link did not work. Ask for a new one.", true);
      return;
    }

    const { data } = await client.auth.getSession();
    const user = data?.session?.user;
    if (!user) { say(""); show(noLinkBox); return; }

    say("");
    who.textContent = user.email ? `Setting the password for ${user.email}.` : "";
    show(form);
    form.elements.password.focus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = form.elements.password.value;
      const confirm = form.elements.confirm.value;
      if (password.length < MIN) { say(`Use at least ${MIN} characters.`, true); form.elements.password.focus(); return; }
      if (password !== confirm) { say("The two passwords don't match.", true); form.elements.confirm.focus(); return; }
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      say("Saving your password…");
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        button.disabled = false;
        if (looksExpired(error.message) || error.status === 401) return expired();
        say(error.message || "Your password could not be saved. Please try again.", true);
        return;
      }
      // OATCCC staff (install/101: a signed-in user can read their own row).
      let next = "/";
      try {
        const { data: staff } = await client.from("oatccc_staff").select("role").eq("user_id", user.id).maybeSingle();
        if (staff?.role) next = staffUrl;
      } catch { /* not staff, or the table is not there: homepage */ }
      say(next === "/" ? "Password set. Taking you to the homepage…" : "Password set. Taking you to the OATCCC admin page…");
      setTimeout(() => location.replace(next), 900);
    });
  }

  start();
})();
