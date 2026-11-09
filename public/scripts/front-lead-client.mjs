import { frontAlsoHtml, frontLeadHtml } from "./front-lead.mjs";

// Homepage (WO-43): the page is built with the newest story as the lead.
// If an admin set a different lead, swap it in and keep "Also on the
// front page" and the Latest Stories rail free of repeats. Failure is
// silent: the built lead is a real story either way.

const root = document.querySelector("[data-front-page]");
const candidatesNode = document.querySelector("[data-front-candidates]");
if (root && candidatesNode) {
  const candidates = JSON.parse(candidatesNode.textContent || "[]");
  const builtSlug = root.querySelector("[data-front-lead-slug]")?.getAttribute("data-front-lead-slug");
  fetch("/api/front-page/current/", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const lead = data?.lead;
      if (!lead) return;
      const story = { ...lead, slug: lead.story_slug };
      // Always draw the admin lead: even for the same story, its photo,
      // kicker and credit can differ from the built-in version.
      root.querySelector("[data-front-lead]").innerHTML = frontLeadHtml(story);
      if (lead.story_slug === builtSlug) return;
      // Same rule as the build: only stories published after the event they
      // cover. When the build filled the slot with the state champions, it
      // stays that way.
      const also = candidates.filter((s) => s.also_ok && s.slug !== story.slug).slice(0, 3);
      const alsoNode = root.querySelector("[data-front-also]");
      if (alsoNode && !alsoNode.hasAttribute("data-front-also-champions") && also.length) alsoNode.innerHTML = frontAlsoHtml(also);
      const shown = new Set([story.slug, ...also.map((s) => s.slug)]);
      document.querySelectorAll("[data-story-rail] a[href^='/stories/']").forEach((link) => {
        const slug = link.getAttribute("href").split("/")[2];
        const card = link.closest(".story-card");
        if (card && shown.has(slug)) card.hidden = true;
      });
    })
    .catch(() => {});
}
