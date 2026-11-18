// OATCCC Leadership pages: each "Email" button carries its person's
// addresses encoded (reversed, then base64; scripts/oatccc-leaders-import.mjs)
// so no plain address is in the page. On tap, decode and open one email to
// all of them. Without JavaScript the button jumps to the Chair contact line.
(() => {
  const decode = (code) => {
    try { return [...new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)))].reverse().join(""); } catch { return ""; }
  };
  document.addEventListener("click", (event) => {
    const button = event.target.closest && event.target.closest("a[data-ox-e]");
    if (!button) return;
    const to = button.getAttribute("data-ox-e").split(/\s+/).map(decode).filter((a) => a.includes("@"));
    if (!to.length) return;
    event.preventDefault();
    window.location.href = "mailto:" + to.join(",");
  });
})();
