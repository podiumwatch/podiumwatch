// Banquet Pack projector slides (WO-35): a 1920x1080 deck scaled to the
// screen. Arrow keys, space, Page Up/Down, click or tap to move; F for
// full screen. #3 in the address opens slide 3.
(() => {
  const deck = document.querySelector("[data-sl-deck]");
  if (!deck) return;
  const slides = [...deck.querySelectorAll(".sl")];
  let index = Math.min(Math.max(Number(location.hash.slice(1)) - 1 || 0, 0), slides.length - 1);

  function fit() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    deck.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  function show(next) {
    index = Math.min(Math.max(next, 0), slides.length - 1);
    slides.forEach((slide, i) => slide.classList.toggle("on", i === index));
    history.replaceState(null, "", `#${index + 1}`);
  }
  async function full() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* not available */ }
  }

  window.addEventListener("resize", fit);
  document.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) { event.preventDefault(); show(index + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); show(index - 1); }
    else if (event.key === "Home") show(0);
    else if (event.key === "End") show(slides.length - 1);
    else if (event.key === "f" || event.key === "F") full();
  });
  document.querySelector(".sl-stage").addEventListener("click", (event) => show(event.clientX < window.innerWidth / 3 ? index - 1 : index + 1));
  document.querySelector("[data-sl-prev]").addEventListener("click", () => show(index - 1));
  document.querySelector("[data-sl-next]").addEventListener("click", () => show(index + 1));
  document.querySelector("[data-sl-full]").addEventListener("click", full);
  fit();
  show(index);
})();
