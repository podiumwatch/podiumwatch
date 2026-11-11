// Podium Watch Shop card (src/lib/merch_card.mjs). Product tabs and color
// swatches swap the photo (150 ms fade), title, price line, color line and
// the card's tint without a reload. The photo, the button and a tap on the
// already-selected swatch open that color in the store (new tab) through
// /go/merch/{placement}/. The XC Crewneck tab shows first through
// Dec. 31, 2026 (Eastern), then the Track Crewneck.
// Analytics: merch_view (card half in view, once per page and placement),
// merch_swatch and merch_click {product, color, placement}; also sent to
// Google Analytics when it is on the page. The admin switch can turn
// every card off. A vote fires "pw:voted", which reveals the after-vote card.
(() => {
  const dataNode = document.querySelector("[data-pwm-data]");
  if (!dataNode) return;
  let data;
  try { data = JSON.parse(dataNode.textContent || "{}"); } catch { return; }
  const products = data.p || []; // { id, tab, t, line, b, c: [[name, image, bg, bg2, fg, hex, slug, note]] }
  if (!products.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_SWATCH_EVENTS = 12; // per page, to keep analytics writes small

  // --- Analytics ----------------------------------------------------------
  const ids = (() => {
    try {
      let visitor = localStorage.getItem("podium_visitor_id");
      if (!visitor) { visitor = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; localStorage.setItem("podium_visitor_id", visitor); }
      let session = sessionStorage.getItem("podium_session_id");
      if (!session) { session = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; sessionStorage.setItem("podium_session_id", session); }
      return { visitor, session };
    } catch { return { visitor: null, session: null }; }
  })();
  let swatchEvents = 0;
  function track(type, placement, product, color) {
    if (type === "merch_swatch" && ++swatchEvents > MAX_SWATCH_EVENTS) return;
    try {
      const body = JSON.stringify({ event_type: type, visitor_id: ids.visitor, session_id: ids.session, section: "merch", content_type: placement, content_id: product, path: location.pathname, metadata: { color } });
      const sent = navigator.sendBeacon && navigator.sendBeacon("/api/engagement/track", new Blob([body], { type: "application/json" }));
      if (!sent) fetch("/api/engagement/track", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body }).catch(() => {});
      if (typeof window.gtag === "function") window.gtag("event", type, { product, color, placement });
    } catch { /* analytics never breaks the card */ }
  }

  // XC Crewneck through Dec. 31 (Eastern), then the Track Crewneck.
  function defaultIndex() {
    const d = data.d || {};
    let today = "";
    try { today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); } catch { today = new Date().toISOString().slice(0, 10); }
    const id = today <= d.until ? d.before : d.after;
    return Math.max(0, products.findIndex((p) => p.id === id));
  }

  function setup(card) {
    if (card.dataset.pwmReady) return;
    card.dataset.pwmReady = "1";
    const placement = card.dataset.pwmPlacement || "vote-page";
    const from = card.dataset.pwmFrom || location.pathname;
    const large = card.classList.contains("pwm-large");
    const imgs = [...card.querySelectorAll("[data-pwm-img]")];
    const photo = card.querySelector(".pwm-photo");
    const head = card.querySelector("[data-pwm-head]");
    const title = card.querySelector("[data-pwm-title]");
    const line = card.querySelector("[data-pwm-line]");
    const colorLine = card.querySelector("[data-pwm-color]");
    const swatchRow = card.querySelector("[data-pwm-swatches]");
    const note = card.querySelector("[data-pwm-note]");
    const button = card.querySelector("[data-pwm-button]");
    const links = [...card.querySelectorAll("[data-pwm-link]")];
    const tabs = [...card.querySelectorAll("[data-pwm-tab]")];
    const chosen = products.map(() => 0);
    let p = defaultIndex();
    let front = 0;
    let preloaded = new Set();
    let inView = false;

    const color = () => products[p].c[chosen[p]];
    const goHref = () => `/go/merch/${encodeURIComponent(placement)}/?p=${encodeURIComponent(products[p].id)}&c=${encodeURIComponent(color()[6])}&from=${encodeURIComponent(from)}`;
    const preload = () => {
      if (!inView || preloaded.has(p)) return;
      preloaded.add(p);
      products[p].c.forEach((c) => { const img = new Image(); img.decoding = "async"; img.src = c[1]; });
    };

    function drawSwatches() {
      swatchRow.innerHTML = "";
      products[p].c.forEach((c, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pwm-swatch";
        b.style.setProperty("--sw", c[5]);
        b.dataset.pwmSwatch = String(i);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-label", c[0]);
        b.setAttribute("aria-checked", String(i === chosen[p]));
        b.tabIndex = i === chosen[p] ? 0 : -1;
        swatchRow.append(b);
      });
    }

    function paint({ fade = true } = {}) {
      const product = products[p];
      const [name, image, bg, bg2, fg, , , unavailable] = color();
      const back = imgs[1 - front];
      const swap = () => {
        back.alt = `${product.t} in ${name}`;
        back.removeAttribute("aria-hidden");
        imgs[front].alt = "";
        imgs[front].setAttribute("aria-hidden", "true");
        back.classList.add("is-on");
        imgs[front].classList.remove("is-on");
        front = 1 - front;
      };
      if (!fade || reduce) { imgs[front].src = image; imgs[front].alt = `${product.t} in ${name}`; }
      else if (back.getAttribute("src") === image && back.complete) swap();
      else { back.onload = () => { back.onload = null; swap(); }; back.src = image; }
      card.style.setProperty("--pwm-bg", bg);
      card.style.setProperty("--pwm-bg2", bg2);
      card.style.setProperty("--pwm-fg", fg);
      if (large) { if (title) title.textContent = product.t; } else head.textContent = product.t;
      line.textContent = product.line;
      colorLine.textContent = `Color: ${name}`;
      note.textContent = unavailable || "";
      note.hidden = !unavailable;
      button.textContent = product.b;
      links.forEach((a) => { a.href = goHref(); });
      photo.setAttribute("aria-label", `${product.t}, ${name}, at the Podium Watch Shop`);
      tabs.forEach((tab) => { const on = tab.dataset.pwmTab === product.id; tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1; });
      swatchRow.querySelectorAll("[data-pwm-swatch]").forEach((b, i) => { b.setAttribute("aria-checked", String(i === chosen[p])); b.tabIndex = i === chosen[p] ? 0 : -1; });
    }

    tabs.forEach((tab) => tab.addEventListener("click", () => {
      const next = products.findIndex((item) => item.id === tab.dataset.pwmTab);
      if (next < 0 || next === p) return;
      p = next;
      drawSwatches();
      paint();
      preload();
    }));
    // Arrow keys move between tabs, and between swatches (radio group).
    card.querySelector("[data-pwm-tabs], .pwm-tabs")?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const i = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
    swatchRow.addEventListener("click", (event) => {
      const b = event.target.closest("[data-pwm-swatch]");
      if (!b) return;
      const i = Number(b.dataset.pwmSwatch);
      if (i === chosen[p]) {
        // The selected swatch opens that color in the store.
        track("merch_click", placement, products[p].id, color()[6]);
        window.open(goHref(), "_blank", "noopener");
        return;
      }
      chosen[p] = i;
      paint();
      track("merch_swatch", placement, products[p].id, color()[6]);
    });
    swatchRow.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const n = products[p].c.length;
      chosen[p] = (chosen[p] + (event.key === "ArrowRight" ? 1 : n - 1)) % n;
      paint();
      swatchRow.querySelector(`[data-pwm-swatch="${chosen[p]}"]`)?.focus();
      track("merch_swatch", placement, products[p].id, color()[6]);
    });
    links.forEach((a) => a.addEventListener("click", () => track("merch_click", placement, products[p].id, color()[6])));

    // The server picked the tab by its build date; follow today's date.
    drawSwatches();
    paint({ fade: false });

    let viewed = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        card.classList.toggle("is-paused", !inView);
        if (inView) preload();
        if (entry.intersectionRatio >= 0.5 && !viewed) { viewed = true; track("merch_view", placement, products[p].id, color()[6]); }
      }, { threshold: [0, 0.5] }).observe(card);
    } else { inView = true; preload(); }
  }

  // Admin switch: remove every card when it is off.
  fetch("/api/merch/status/", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((status) => { if (status && status.enabled === false) document.querySelectorAll("[data-pwm], [data-pwm-after], .pwm-section").forEach((n) => n.remove()); })
    .catch(() => {});

  document.addEventListener("pw:voted", () => {
    // data-pw-alt-off: the support card has this turn (support-card.js).
    document.querySelectorAll("[data-pwm-after]").forEach((box) => { if (box.hasAttribute("data-pw-alt-off")) return; box.hidden = false; box.querySelectorAll("[data-pwm]").forEach(setup); });
  });
  // A card revealed later (the ballot card when the vote button shows).
  document.addEventListener("pw:shop-shown", () => document.querySelectorAll("[data-pwm]").forEach((card) => { if (!card.closest("[hidden]")) setup(card); }));
  document.querySelectorAll("[data-pwm]").forEach((card) => { if (!card.closest("[hidden]")) setup(card); });
})();
