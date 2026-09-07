(() => {
  const loadingBox = document.querySelector("[data-writer-guide-loading]");
  const root = document.querySelector("[data-writer-guide-root]");

  if (!loadingBox || !root) return;

  async function load() {
    const user = await window.PodiumWriterAuth.getUser();
    if (!user) {
      window.location.replace("/writer-login/");
      return;
    }

    loadingBox.hidden = true;
    root.hidden = false;
  }

  load();
})();
