// Support Podium Watch card: takes turns with the Podium Watch Shop card
// on the awards hub and after a vote, never both at once (2026-11-11).
// Load BEFORE /scripts/merch-card.js so the choice is made before the shop
// card sets itself up (and counts a view).
//
// Markup: <div data-pw-alt="merch">shop card</div><div data-pw-alt="support" hidden>support card</div>
// After-vote: <div data-pwm-after hidden> (shop) and <div data-pws-after hidden> (support).
// A per-browser counter picks whose turn it is; every page load and every
// vote moves it on. Without storage, it picks at random.
(function () {
  "use strict";

  const KEY = "podium_card_turn";
  function nextIsSupport() {
    try {
      const turn = (Number(localStorage.getItem(KEY)) || 0) + 1;
      localStorage.setItem(KEY, String(turn));
      return turn % 2 === 0;
    } catch {
      return Math.random() < 0.5;
    }
  }

  // Awards hub (and any page with an alternating pair).
  const shopBox = document.querySelector('[data-pw-alt="merch"]');
  const supportBox = document.querySelector('[data-pw-alt="support"]');
  if (supportBox) {
    const hasShop = Boolean(shopBox && shopBox.querySelector("[data-pwm]"));
    const support = !hasShop || nextIsSupport();
    supportBox.hidden = !support;
    if (shopBox) shopBox.hidden = support;
  }

  // After a vote. Runs before merch-card.js's own pw:voted listener, and
  // marks the shop box so that listener leaves it hidden.
  // After-vote support panel (2026-11-11): the first vote in this browser
  // shows the panel under "Vote counted" instead of a card; it has a close
  // button and never shows again. Later votes take turns as below.
  const PANEL_KEY = "podium_support_panel_seen";
  const panel = document.querySelector("[data-pws-panel]");
  panel?.querySelector("[data-pws-panel-close]")?.addEventListener("click", () => {
    panel.hidden = true;
    const message = document.querySelector("[data-yoy-vote-message]");
    if (message) { message.tabIndex = -1; message.focus({ preventScroll: true }); }
  });
  function panelTurn() {
    if (!panel) return false;
    try {
      if (localStorage.getItem(PANEL_KEY)) return false;
      localStorage.setItem(PANEL_KEY, "1");
      return true;
    } catch {
      return false; // no storage: no way to keep it to once, so skip it
    }
  }

  document.addEventListener("pw:voted", () => {
    const shopAfter = document.querySelector("[data-pwm-after]");
    const supportAfter = document.querySelector("[data-pws-after]");
    if (panelTurn()) {
      panel.hidden = false;
      if (supportAfter) supportAfter.hidden = true;
      if (shopAfter) { shopAfter.setAttribute("data-pw-alt-off", ""); shopAfter.hidden = true; }
      return;
    }
    if (panel) panel.hidden = true;
    if (!supportAfter) return;
    const support = !(shopAfter && shopAfter.querySelector("[data-pwm]")) || nextIsSupport();
    supportAfter.hidden = !support;
    if (shopAfter) {
      if (support) { shopAfter.setAttribute("data-pw-alt-off", ""); shopAfter.hidden = true; }
      else shopAfter.removeAttribute("data-pw-alt-off");
    }
  });
})();
