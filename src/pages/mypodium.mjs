import { layout, pageHero, storyFallbackImage } from "../lib/html.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// The one place My Podium personalizes stories without a fetch -- the
// same real content/stories/*.md data every other page already uses,
// just serialized as a small JSON payload instead of pre-rendered HTML
// cards. public/scripts/my-podium-data.js reads this and picks by
// category (a real, structured field); nothing here is a second story
// dataset, it's the same one in a different shape. See
// docs/MY_PODIUM_MASTER_BUILD_PLAN.md, Project 3.
function storiesDataScript(stories) {
  const payload = stories.slice(0, 12).map((story) => ({
    slug: story.slug,
    title: story.title,
    description: story.description,
    category: story.category,
    date: story.date,
    image: story.featuredImage || storyFallbackImage(story.category)
  }));
  return `<script type="application/json" data-my-podium-stories>${JSON.stringify(payload).replaceAll("<", "\\u003c")}</script>`;
}

export function myPodiumPage(site, stories) {
  const content = `${pageHero({
    eyebrow: "Podium Watch",
    title: "My Podium",
    description: "Your Ohio running world, all in one place.",
    compact: true
  })}

  <style>
    .mp-shell { display:grid; gap:22px; max-width:820px; margin:0 auto; }
    .mp-intro { display:grid; gap:14px; padding:26px 22px; border:1px solid var(--line); border-radius:var(--radius-card); background:linear-gradient(135deg,#090909,#171c19 70%,#073b27); color:#fff; }
    .mp-intro h2 { margin:0; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.7rem; text-transform:none; }
    .mp-intro p { margin:0; color:#cfd6d1; max-width:520px; }
    .mp-intro-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:4px; }

    .mp-steps { display:flex; gap:8px; list-style:none; margin:0; padding:0; }
    .mp-steps li { flex:1; min-height:6px; border-radius:4px; background:var(--line); }
    .mp-steps li[data-mp-step-state="done"], .mp-steps li[data-mp-step-state="active"] { background:var(--green); }

    .mp-panel { display:grid; gap:16px; padding:22px; border:1px solid var(--line); border-radius:var(--radius-card); background:#fff; }
    .mp-panel h2 { margin:0; font-size:1.2rem; }
    .mp-panel p { margin:0; color:var(--muted); }
    .mp-search-input { display:block; width:100%; padding:12px 14px; border:1px solid var(--line); border-radius:10px; font:inherit; font-size:.95rem; }
    .mp-results { display:grid; gap:6px; max-height:280px; overflow-y:auto; }
    .mp-result-button { display:block; width:100%; padding:11px 13px; text-align:left; border:1px solid var(--line); border-radius:10px; background:#fafbfa; font:inherit; font-size:.85rem; font-weight:700; cursor:pointer; }
    .mp-result-button:hover, .mp-result-button:focus-visible { border-color:var(--green); background:var(--pale-green); }

    .mp-choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .mp-choice { min-height:52px; display:flex; align-items:center; justify-content:center; padding:10px; border:2px solid var(--line); border-radius:10px; background:#fff; font-weight:800; cursor:pointer; }
    .mp-choice[aria-pressed="true"] { border-color:var(--green); background:var(--pale-green); color:var(--green-ink); }

    .mp-step-actions { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; }
    .mp-review-row { display:flex; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); }
    .mp-review-row:last-child { border-bottom:0; }

    .mp-header { display:grid; gap:4px; }
    .mp-header .eyebrow { margin:0; }
    .mp-header h1 { margin:0; font-size:1.7rem; }
    .mp-header-meta { display:flex; flex-wrap:wrap; gap:10px; align-items:center; color:var(--muted); font-size:.88rem; }
    .mp-header-meta a { color:var(--green-dark); font-weight:800; }

    .mp-card { padding:20px; border:1px solid var(--line); border-radius:var(--radius-card); background:#fff; }
    .mp-card-pale { background:var(--pale-green); border-color:#bfe6d4; }
    .mp-card-dark { color:#fff; background:#111714; border-color:#111714; }
    .mp-card h3 { margin:0 0 8px; font-size:1.02rem; }
    .mp-card p { margin:0 0 6px; }
    .mp-card-empty { color:var(--muted); font-size:.9rem; }
    .mp-card-action { display:inline-flex; margin-top:8px; }
    .mp-skeleton { height:18px; border-radius:6px; background:linear-gradient(90deg,#eee,#f6f6f6,#eee); background-size:200% 100%; }
    @media (prefers-reduced-motion: no-preference) { .mp-skeleton { animation:mp-shimmer 1.3s ease infinite; } }
    @keyframes mp-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
    @media (prefers-reduced-motion: reduce) { .mp-skeleton { background:#eee; } }

    .mp-caught-up { padding:26px; text-align:center; border:1px dashed var(--line); border-radius:var(--radius-card); color:var(--muted); }
    .mp-caught-up-actions { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:12px; }

    @media (max-width:600px) {
      .mp-choice-grid { grid-template-columns:1fr; }
      .mp-intro { padding:20px 18px; }
    }
  </style>

  <section class="section section-paper">
    <div class="container mp-shell" data-mp-shell>
      <div class="mp-panel" data-mp-loading>
        <p>Loading My Podium&hellip;</p>
      </div>

      <!-- Onboarding: intro + 3 steps, all hidden until JS decides which to show -->
      <div data-mp-onboarding hidden>
        <div class="mp-intro" data-mp-intro hidden>
          <p class="eyebrow" style="color:#7be8ac;">My Podium</p>
          <h2>Your Ohio running world, all in one place.</h2>
          <p>Follow your school, athletes, division, and events to see what matters to you first. My Podium will show what's next and what changed.</p>
          <div class="mp-intro-actions">
            <button class="button button-primary" type="button" data-mp-start>Build My Podium</button>
            <button class="button button-outline" type="button" style="color:#fff;border-color:rgba(255,255,255,.5)" data-mp-explore>Explore without setting up</button>
          </div>
        </div>

        <ol class="mp-steps" data-mp-steps hidden aria-hidden="true">
          <li data-mp-step-indicator="team"></li>
          <li data-mp-step-indicator="preferences"></li>
          <li data-mp-step-indicator="review"></li>
        </ol>

        <div class="mp-panel" data-mp-step="team" hidden>
          <h2>Choose your school or team</h2>
          <p>Search for the school you follow.</p>
          <label><span class="visually-hidden">Search for a school or team</span><input class="mp-search-input" type="search" placeholder="Search for your school" data-mp-team-input autocomplete="off"></label>
          <div class="mp-results" data-mp-team-results role="listbox" aria-label="School search results"></div>
        </div>

        <div class="mp-panel" data-mp-step="preferences" hidden>
          <h2>Choose what you follow</h2>
          <p data-mp-preferences-team-name></p>
          <div>
            <p style="font-weight:800;margin-bottom:8px;">Sport</p>
            <div class="mp-choice-grid" role="group" aria-label="Sport">
              <button class="mp-choice" type="button" aria-pressed="false" data-mp-sport="cross_country">Cross Country</button>
              <button class="mp-choice" type="button" aria-pressed="false" data-mp-sport="track_and_field">Track and Field</button>
            </div>
          </div>
          <div>
            <p style="font-weight:800;margin:6px 0 8px;">Gender</p>
            <div class="mp-choice-grid" role="group" aria-label="Gender">
              <button class="mp-choice" type="button" aria-pressed="false" data-mp-gender="boys">Boys</button>
              <button class="mp-choice" type="button" aria-pressed="false" data-mp-gender="girls">Girls</button>
            </div>
          </div>
          <div>
            <p style="font-weight:800;margin:6px 0 8px;">Follow an athlete (optional)</p>
            <label><span class="visually-hidden">Search for an athlete</span><input class="mp-search-input" type="search" placeholder="Search for an athlete" data-mp-athlete-input autocomplete="off"></label>
            <div class="mp-results" data-mp-athlete-results role="listbox" aria-label="Athlete search results"></div>
            <div data-mp-athlete-selected></div>
          </div>
          <div class="mp-step-actions">
            <button class="button button-outline" type="button" data-mp-back="team">Back</button>
            <button class="button button-primary" type="button" data-mp-next="review">Continue</button>
          </div>
        </div>

        <div class="mp-panel" data-mp-step="review" hidden>
          <h2>Review and finish</h2>
          <div data-mp-review-body></div>
          <p style="font-size:.82rem;color:var(--muted);">Preferences are saved on this device only. No account, email, or personal information is required. You can edit or clear them any time.</p>
          <div class="mp-step-actions">
            <button class="button button-outline" type="button" data-mp-back="preferences">Back</button>
            <button class="button button-primary" type="button" data-mp-finish>Go to My Podium</button>
          </div>
        </div>
      </div>

      <!-- Dashboard -->
      <div data-mp-dashboard hidden>
        <div class="mp-header">
          <p class="eyebrow">My Podium</p>
          <h1>My Podium</h1>
          <div class="mp-header-meta">
            <span data-mp-date></span>
            <span data-mp-summary></span>
            <button class="text-link" type="button" style="background:none;border:0;cursor:pointer;padding:0;" data-mp-edit>Edit preferences</button>
            <button class="text-link" type="button" style="background:none;border:0;cursor:pointer;padding:0;" data-mp-clear>Clear all</button>
          </div>
        </div>

        <div class="mp-card" data-mp-context-card hidden></div>
        <div class="mp-card mp-card-dark" data-mp-race-day-card hidden></div>
        <div class="mp-card mp-card-pale" data-mp-poll-card hidden></div>
        <div class="mp-card" data-mp-ranking-card hidden></div>
        <div class="mp-card" data-mp-next-meet-card hidden></div>
        <div class="mp-card" data-mp-latest-result-card hidden></div>
        <div data-mp-athlete-cards></div>
        <div class="mp-card" data-mp-story-card hidden></div>

        <div class="mp-caught-up" data-mp-feed>
          <h3>You are caught up.</h3>
          <p data-mp-feed-detail>There's nothing new since your last visit.</p>
          <div class="mp-caught-up-actions">
            <a class="button button-outline" href="/meets/?view=results">View all results</a>
            <a class="button button-outline" href="/meets/?view=upcoming">Browse upcoming meets</a>
            <a class="button button-outline" href="/rankings/">Check rankings</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  ${storiesDataScript(stories)}
  <script src="/scripts/my-podium-store.js" defer></script>
  <script src="/scripts/my-podium-data.js" defer></script>
  <script src="/scripts/my-podium.js" defer></script>`;

  return layout({
    site,
    title: "My Podium",
    description: "Follow your school, athletes, division, and events to see what matters to you first on Podium Watch.",
    pathname: "/my-podium/",
    content
  });
}
