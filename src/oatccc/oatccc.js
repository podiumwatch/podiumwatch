// OATCCC indoor pages (src/oatccc/indoor.mjs): the side menu folds on
// phones and stays open on wide screens; on Eligibility & Verification,
// "Open all three parts" and "Print this page". Copied to dist/scripts/
// only when OATCCC_LIVE=1.
(() => {
  const secnav = document.querySelector(".ox-secnav");
  if (secnav) {
    const wide = window.matchMedia("(min-width: 940px)");
    const sync = () => { secnav.open = wide.matches; };
    sync();
    wide.addEventListener("change", sync);
  }

  const parts = () => [...document.querySelectorAll(".ox details.part")];
  const openAll = document.querySelector("[data-ox-open-all]");
  if (openAll) {
    const label = () => {
      openAll.textContent = parts().every((part) => part.open) ? "Close all three parts" : "Open all three parts";
    };
    openAll.addEventListener("click", () => {
      const allOpen = parts().every((part) => part.open);
      parts().forEach((part) => { part.open = !allOpen; });
      label();
    });
    parts().forEach((part) => part.addEventListener("toggle", label));
    label();
  }
  const print = document.querySelector("[data-ox-print]");
  if (print) {
    print.addEventListener("click", () => {
      parts().forEach((part) => { part.open = true; });
      window.print();
    });
  }
})();
