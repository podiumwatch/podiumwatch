// OATCCC Leadership pages: each "Email" button carries its person's
// addresses encoded (reversed, then base64; scripts/oatccc-leaders-import.mjs)
// so no plain address is in the page. On tap, decode and open one email to
// all of them. "Call" buttons carry the phone number the same way
// (data-ox-t, Matt approved 2026-11-19) and open the phone dialer on tap.
// Without JavaScript either button jumps to the Chair contact line.
(() => {
  const decode = (code) => {
    try { return [...new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)))].reverse().join(""); } catch { return ""; }
  };
  document.addEventListener("click", (event) => {
    const button = event.target.closest && event.target.closest("a[data-ox-e], a[data-ox-t]");
    if (!button) return;
    if (button.hasAttribute("data-ox-t")) {
      const digits = decode(button.getAttribute("data-ox-t")).replace(/\D/g, "");
      if (digits.length !== 10) return;
      event.preventDefault();
      window.location.href = "tel:+1" + digits;
      return;
    }
    const to = button.getAttribute("data-ox-e").split(/\s+/).map(decode).filter((a) => a.includes("@"));
    if (!to.length) return;
    event.preventDefault();
    window.location.href = "mailto:" + to.join(",");
  });
})();
