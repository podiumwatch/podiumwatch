// Podium Watch Store card (src/lib/merch_card.mjs). Cycles products and
// their colors every 4 seconds with a crossfade; each product shows its
// next color every time it comes round, and the background follows the
// color. Tapping a color dot shows that color and pauses the cycle for a
// few seconds. Pauses off-screen and in a hidden tab; never cycles with
// reduced motion (the dots still work). The admin switch can turn the card
// off. A vote fires "pw:voted", which reveals the larger card.
(() => {
  const dataNode = document.querySelector("[data-pwm-data]");
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent || "{}");
  const products = data.p || []; // { id, n: name, c: [[name, image, bg, bg2, fg, hex]] }
  if (!products.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CYCLE_MS = data.ms || 4000;
  const DOT_PAUSE_MS = 8000;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function setup(card) {
    if (card.dataset.pwmReady) return;
    card.dataset.pwmReady = "1";
    const placement = card.dataset.pwmPlacement;
    const from = card.dataset.pwmFrom || location.pathname;
    const imgs = [...card.querySelectorAll("[data-pwm-img]")];
    const photo = card.querySelector(".pwm-photo");
    const now = card.querySelector("[data-pwm-now]");
    const dots = card.querySelector("[data-pwm-dots]");
    const links = [...card.querySelectorAll("[data-pwm-link]")];
    const colorAt = products.map(() => 0);
    const seen = products.map((_, i) => i === 0);
    let p = 0;
    let front = 0;
    let timer = null;
    let holdUntil = 0;
    let visible = false;

    const goHref = (id) => `/go/merch/${encodeURIComponent(placement)}/?p=${encodeURIComponent(id)}&from=${encodeURIComponent(from)}`;
    const drawDots = () => {
      dots.innerHTML = products[p].c.map((c, i) => `<button type="button" class="pwm-dot${i === colorAt[p] ? " is-on" : ""}" style="--dot:${esc(c[5])}" data-pwm-dot="${i}" aria-label="${esc(c[0])}" aria-pressed="${i === colorAt[p]}"></button>`).join("");
      keepDotInView();
    };
    // Scroll only the dot row (never the page) so the active dot shows.
    const keepDotInView = () => {
      const dot = dots.querySelector(".is-on");
      if (!dot) return;
      const left = dot.getBoundingClientRect().left - dots.getBoundingClientRect().left + dots.scrollLeft;
      if (left < dots.scrollLeft || left + dot.offsetWidth > dots.scrollLeft + dots.clientWidth) dots.scrollLeft = Math.max(0, left - 8);
    };
    const markDot = () => dots.querySelectorAll(".pwm-dot").forEach((dot, i) => { dot.classList.toggle("is-on", i === colorAt[p]); dot.setAttribute("aria-pressed", String(i === colorAt[p])); }) || keepDotInView();

    function show(nextP, nextC) {
      const productChanged = nextP !== p;
      p = nextP;
      colorAt[p] = nextC;
      const [name, image, bg, bg2, fg] = products[p].c[nextC];
      const back = imgs[1 - front];
      const swap = () => {
        back.alt = `${products[p].n}, ${name}`;
        back.removeAttribute("aria-hidden");
        imgs[front].alt = "";
        imgs[front].setAttribute("aria-hidden", "true");
        back.classList.add("is-on");
        imgs[front].classList.remove("is-on");
        front = 1 - front;
      };
      // Fade in once the new photo has loaded, so it never flashes empty.
      if (back.getAttribute("src") === image && back.complete) swap();
      else { back.onload = () => { back.onload = null; swap(); }; back.src = image; }
      card.style.setProperty("--pwm-bg", bg);
      card.style.setProperty("--pwm-bg2", bg2);
      card.style.setProperty("--pwm-fg", fg);
      now.textContent = `${products[p].n} · ${name}`;
      links.forEach((a) => { a.href = goHref(products[p].id); });
      photo?.setAttribute("aria-label", `${products[p].n} at the Podium Watch Store`);
      if (productChanged) drawDots(); else markDot();
    }

    function tick() {
      clearTimeout(timer);
      const paused = reduce || !visible || document.hidden;
      card.classList.toggle("is-paused", paused);
      if (paused) return;
      timer = setTimeout(() => {
        const nextP = (p + 1) % products.length;
        const nextC = seen[nextP] ? (colorAt[nextP] + 1) % products[nextP].c.length : colorAt[nextP];
        seen[nextP] = true;
        show(nextP, nextC);
        tick();
      }, Math.max(CYCLE_MS, holdUntil - Date.now()));
    }

    dots.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-pwm-dot]");
      if (!dot) return;
      show(p, Number(dot.dataset.pwmDot));
      holdUntil = Date.now() + DOT_PAUSE_MS;
      tick();
    });
    if (reduce) card.classList.add("is-static");
    drawDots();
    if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; tick(); }, { threshold: 0.3 }).observe(card);
    else { visible = true; tick(); }
    document.addEventListener("visibilitychange", tick);
  }

  // Admin switch: remove every card when it is off.
  fetch("/api/merch/status/", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((status) => { if (status && status.enabled === false) document.querySelectorAll("[data-pwm], [data-pwm-after]").forEach((n) => n.remove()); })
    .catch(() => {});

  document.addEventListener("pw:voted", () => {
    document.querySelectorAll("[data-pwm-after]").forEach((box) => { box.hidden = false; box.querySelectorAll("[data-pwm]").forEach(setup); });
  });
  document.querySelectorAll("[data-pwm]").forEach((card) => { if (!card.closest("[hidden]")) setup(card); });
})();
