import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function meetsIndexPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Meet Center",
    title: "Find your next meet.",
    description: "Browse upcoming and past Ohio high school cross country and track and field meets."
  })}

  <section class="section section-paper">
    <div class="container">
      <div class="story-toolbar">
        <label class="search-field">
          <span class="visually-hidden">Search meets</span>
          <input
            type="search"
            placeholder="Search by meet, city, venue, or school"
            data-meet-search
          >
        </label>

        <label>
          <span class="visually-hidden">Filter by sport</span>
          <select class="category-filter" data-meet-sport>
            <option value="all">All sports</option>
            <option value="cross country">Cross Country</option>
            <option value="track and field">Track and Field</option>
          </select>
        </label>
      </div>

      <div class="results-summary" aria-live="polite">
        <span data-meet-count>Loading meets...</span>
      </div>

      <div class="stories-grid" data-meet-list></div>

      <div class="empty-state no-results" data-meet-empty hidden>
        <div class="empty-state-mark">PW</div>
        <h2>No meets found</h2>
        <p>Try a different meet name, city, venue, school, or sport.</p>
      </div>
    </div>
  </section>

  <script>
    (() => {
      const meetList = document.querySelector("[data-meet-list]");
      const meetCount = document.querySelector("[data-meet-count]");
      const meetEmpty = document.querySelector("[data-meet-empty]");
      const searchInput = document.querySelector("[data-meet-search]");
      const sportSelect = document.querySelector("[data-meet-sport]");

      let meets = [];

      function escapeText(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function formatMeetDate(value) {
        if (!value) return "Date to be announced";

        const date = new Date(value + "T12:00:00");

        return new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(date);
      }

      function renderMeets() {
        const searchValue = searchInput.value.trim().toLowerCase();
        const sportValue = sportSelect.value.toLowerCase();

        const filtered = meets.filter((meet) => {
          const searchable = [
            meet.name,
            meet.city,
            meet.state,
            meet.venue_name,
            meet.host_school,
            meet.meet_type
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !searchValue || searchable.includes(searchValue);

          const matchesSport =
            sportValue === "all" ||
            String(meet.sport ?? "").toLowerCase() === sportValue;

          return matchesSearch && matchesSport;
        });

        meetCount.textContent =
          filtered.length +
          (filtered.length === 1 ? " meet" : " meets");

        meetEmpty.hidden = filtered.length !== 0;

        meetList.innerHTML = filtered
          .map((meet) => {
            const location = [
              meet.venue_name,
              meet.city,
              meet.state
            ]
              .filter(Boolean)
              .join(", ");

            return \`
              <article class="story-card">
                \${
                  meet.banner_image_url
                    ? \`
                      <img
                        class="story-card-image"
                        src="\${escapeText(meet.banner_image_url)}"
                        alt=""
                        width="800"
                        height="450"
                      >
                    \`
                    : ""
                }

                <div class="story-card-body">
                  <p class="eyebrow">
                    \${escapeText(meet.sport || "Ohio Meet")}
                  </p>

                  <h2>
                    <a href="/meetdetail/?slug=\${encodeURIComponent(meet.slug)}">
                      \${escapeText(meet.name)}
                    </a>
                  </h2>

                  <p>
                    <strong>\${escapeText(formatMeetDate(meet.meet_date))}</strong>
                  </p>

                  \${
                    location
                      ? \`<p>\${escapeText(location)}</p>\`
                      : ""
                  }

                  \${
                    meet.description
                      ? \`<p>\${escapeText(meet.description)}</p>\`
                      : ""
                  }

                  <a
                    class="button button-dark"
                    href="/meetdetail/?slug=\${encodeURIComponent(meet.slug)}"
                  >
                    View meet page
                  </a>
                </div>
              </article>
            \`;
          })
          .join("");
      }

      async function loadMeets() {
        try {
          const response = await fetch("/api/meets");

          if (!response.ok) {
            throw new Error("Meet request failed.");
          }

          const data = await response.json();
          meets = Array.isArray(data.meets) ? data.meets : [];
          renderMeets();
        } catch (error) {
          console.error("Meet directory error:", error);
          meetCount.textContent = "Unable to load meets right now.";
          meetEmpty.hidden = false;
        }
      }

      searchInput.addEventListener("input", renderMeets);
      sportSelect.addEventListener("change", renderMeets);

      loadMeets();
    })();
  </script>`;

  return layout({
    site,
    title: "Meet Center",
    description:
      "Browse upcoming and past Ohio high school cross country and track and field meets.",
    pathname: "/meets/",
    content
  });
}
