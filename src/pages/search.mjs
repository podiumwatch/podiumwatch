import { layout, pageHero, icon } from "../lib/html.mjs";

export function searchPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch search",
    title: "Find it fast.",
    description: "Search rankings, stories, teams, meets, weekly awards, and Podium Watch resources from one place."
  })}
  <section class="section section-paper"><div class="container search-page" data-site-search-page>
    <form class="global-search-form" role="search" data-global-search-form>
      <label class="search-field search-field-large"><span class="visually-hidden">Search Podium Watch</span>${icon("search")}<input type="search" name="q" placeholder="Search athletes, schools, teams, meets, rankings, or stories" autocomplete="off" data-global-search-input></label>
      <button class="button button-primary" type="submit">Search</button>
    </form>
    <div class="search-suggestions" aria-label="Popular searches"><span>Try:</span><button type="button" data-search-suggestion="rankings">Rankings</button><button type="button" data-search-suggestion="team">Team pages</button><button type="button" data-search-suggestion="regional">Regional sites</button><button type="button" data-search-suggestion="athlete of the week">Athlete of the Week</button></div>
    <p class="results-summary" data-global-search-summary aria-live="polite">Enter at least two characters to search.</p>
    <div class="search-results" data-global-search-results></div>
    <div class="empty-state compact-empty" data-global-search-empty hidden><div class="empty-state-mark">PW</div><h2>No matches found</h2><p>Try a school name, athlete name, meet, division, event, or broader keyword.</p></div>
  </div></section>
  <script src="/scripts/site-search.js" defer></script>`;
  return layout({
    site,
    title: "Search",
    description: "Search Podium Watch rankings, stories, Ohio teams, meets, weekly awards, and tournament resources.",
    pathname: "/search/",
    content
  });
}
