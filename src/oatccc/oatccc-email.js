// OATCCC contact buttons (leadership cards, the Vendors contact, Hall of Fame
// bios, the Middle School contact line). Addresses (data-ox-e) and phone
// numbers (data-ox-t) are stored encoded (reversed, then base64;
// scripts/oatccc-leaders-import.mjs and src/oatccc/email-protect.mjs), so
// nothing plain is in the page source.
//
// Clicking "Email" or "Phone Number" shows the details on the card, under the
// name (Zachary, 2026-11-19): each address as a mailto link, the number as
// (419) 555-1234 with a tel: link, each with a "Copy" button. Clicking the
// button again hides them. Without JavaScript the buttons jump to the Indoor
// State Meet Chair line.
(() => {
  const decode = (code) => {
    try { return [...new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)))].reverse().join(""); } catch { return ""; }
  };
  const formatPhone = (raw) => {
    const d = String(raw).replace(/\D/g, "");
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : "";
  };
  // What a button reveals: [{ text, href }].
  const linesFor = (button) => {
    if (button.hasAttribute("data-ox-t")) {
      const digits = decode(button.getAttribute("data-ox-t")).replace(/\D/g, "");
      const text = formatPhone(digits);
      return text ? [{ text, href: "tel:+1" + digits }] : [];
    }
    return button.getAttribute("data-ox-e").split(/\s+/).map(decode).filter((a) => a.includes("@")).map((a) => ({ text: a, href: "mailto:" + a }));
  };
  window.OxContact = { decode, formatPhone, linesFor };

  const copy = (text, btn) => {
    const done = () => { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = "Copy"; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text) && done());
    } else if (fallbackCopy(text)) done();
  };
  const fallbackCopy = (text) => {
    const area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  };

  const box = (lines, kind) => {
    const wrap = document.createElement("span");
    wrap.className = "ox-reveal ox-reveal-" + kind;
    wrap.setAttribute("role", "group");
    for (const line of lines) {
      const row = document.createElement("span");
      row.className = "ox-reveal-line";
      const link = document.createElement("a");
      link.href = line.href; link.textContent = line.text;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "ox-copy"; btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy " + line.text);
      btn.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); copy(line.text, btn); });
      row.append(link, btn);
      wrap.append(row);
    }
    return wrap;
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest && event.target.closest("a[data-ox-e], a[data-ox-t]");
    if (!button) return;
    const lines = linesFor(button);
    if (!lines.length) return;
    event.preventDefault();
    const kind = button.hasAttribute("data-ox-t") ? "t" : "e";
    const card = button.closest(".ox-leader");
    // Where the details go: under the name on a card, right after an inline link.
    const holder = card ? card.querySelector(".ox-leader-text") : null;
    const existing = holder ? holder.querySelector(".ox-reveal-" + kind) : (button.nextElementSibling && button.nextElementSibling.classList.contains("ox-reveal") ? button.nextElementSibling : null);
    if (existing) {
      existing.remove();
      button.setAttribute("aria-expanded", "false");
      return;
    }
    const shown = box(lines, kind);
    if (holder) {
      const name = holder.querySelector("strong");
      const other = holder.querySelector(".ox-reveal");
      // Email above Phone Number when both are open.
      if (other && kind === "e") other.before(shown);
      else if (other) other.after(shown);
      else if (name) name.after(shown);
      else holder.append(shown);
    } else {
      shown.classList.add("ox-reveal-inline");
      button.after(shown);
    }
    button.setAttribute("aria-expanded", "true");
  });
})();
