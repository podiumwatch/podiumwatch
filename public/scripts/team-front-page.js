// Team page (WO-43): "Featured on the Podium Watch front page" for each
// lead story an admin marked as featuring this team. Its own container,
// so the team profile's own badge rendering never clears it.
(() => {
  const box = document.querySelector("[data-team-front-page]");
  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!box || !slug) return;
  fetch(`/api/front-page/featured/?team=${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const stories = data?.stories || [];
      if (!stories.length) return;
      box.replaceChildren(...stories.map((story) => {
        const a = document.createElement("a");
        a.className = "team-profile-badge team-profile-badge-light";
        a.href = story.href;
        a.title = `${story.title} (${story.label})`;
        a.textContent = "Featured on the Podium Watch front page";
        return a;
      }));
      box.hidden = false;
    })
    .catch(() => {});
})();
