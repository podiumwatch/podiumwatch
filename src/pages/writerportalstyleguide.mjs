import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-guide-shell { display:grid; gap:20px; max-width: 760px; margin: 0 auto; }
    .writer-guide-shell h2 { margin-top: 6px; }
    .writer-guide-shell h3 { margin-top: 18px; }
    .writer-guide-example { padding:12px 16px; border-radius:9px; margin: 10px 0; }
    .writer-guide-example[data-good="true"] { background: rgba(var(--green-rgb),.1); border-left: 4px solid var(--green); }
    .writer-guide-example[data-good="false"] { background: rgba(220,38,38,.08); border-left: 4px solid #dc2626; }
    .writer-guide-example strong { display:block; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
    .writer-guide-draft-note { padding:12px 16px; border-radius:9px; background: rgba(230,167,0,.14); font-weight: 700; }
`;

// A drafted starting point, not dictated content -- explicitly asked for
// as "draft something reasonable based on the voice already visible in
// published Podium Watch stories, for the user to edit." Grounded in
// real, observed patterns from content/stories/*.md (the "Write for
// Podium Watch" and "Welcome to Podium Watch" pieces specifically), not
// generic journalism advice.
export function writerPortalStyleGuidePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Style guide.",
    description: "How Podium Watch pieces actually sound, and the standards every piece has to meet before it can be approved."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-guide-shell" data-writer-guide-loading>
      <div class="info-card"><h2>Loading</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-guide-shell" data-writer-guide-root hidden>
      <p class="writer-guide-draft-note">This is a first draft, written from how existing Podium Watch pieces actually read. Podium Watch will edit this to reflect the real standard.</p>

      <section class="info-card">
        <h2>Voice</h2>
        <p>Write like you're explaining something you actually care about to someone who runs, not like you're filling column inches. Specific beats impressive. A real time, a real place, a real name does more work than an adjective.</p>

        <div class="writer-guide-example" data-good="true">
          <strong>Do this</strong>
          A sophomore ran a personal best at a Tuesday dual meet that nobody outside her own team will ever hear about.
        </div>
        <div class="writer-guide-example" data-good="false">
          <strong>Not this</strong>
          An incredible performance took place at a recent meet, showcasing tremendous talent.
        </div>

        <p>Contractions are fine. Short paragraphs are fine -- most of what you write will be read on a phone. Say the honest version of things, including the parts that aren't flattering (an athlete's rough race, a team's tough loss). Don't oversell. If a piece is good, the details carry it.</p>
      </section>

      <section class="info-card">
        <h3>Structure</h3>
        <p>Lead with the single most specific, most concrete thing in the piece -- a moment, a number, a scene. Save the broader context for after you've earned the reader's attention. Every piece needs a real headline and a one-sentence dek that tells someone exactly what they're about to read, not a teaser.</p>
      </section>

      <section class="info-card">
        <h3>Sourcing and verification -- non-negotiable</h3>
        <p>Podium Watch's whole reputation is built on "no pay to play, verified data, editorial projections kept clearly separate from fact." That standard applies to writing too:</p>
        <ul>
          <li>A time, a place, a mark, a score -- if you're stating it as fact, you need a real source (official results, a meet program, a screenshot, a direct quote). If you can't verify it, say so, or leave it out.</li>
          <li>Never guess at a name's spelling, a school's name, or a grade level. Check it.</li>
          <li>Quotes are real quotes. Don't invent dialogue or paraphrase as if it were a direct quote.</li>
          <li>An opinion (this team looks primed for a big finish; this athlete's range makes them a real state-meet threat) is fine and welcome -- just make sure it reads as your read on it, not as a stated fact.</li>
        </ul>
      </section>

      <section class="info-card">
        <h3>The five categories</h3>
        <p>Every piece needs one. What they actually mean:</p>
        <ul>
          <li><strong>Race Recap</strong> -- what happened at a specific meet, told through the people who ran it.</li>
          <li><strong>Feature</strong> -- the story behind a performance, a season, or a program. The "why," not just the "what."</li>
          <li><strong>Rankings &amp; Polls</strong> -- analysis of where teams or athletes actually stand, and why, in the style of the Podium Report.</li>
          <li><strong>Recruiting</strong> -- offers, visits, commitments, signings -- always sourced, never speculation dressed up as news.</li>
          <li><strong>Other</strong> -- doesn't fit the above but is still worth Podium Watch's name on it. Ask if you're not sure.</li>
        </ul>
      </section>

      <section class="info-card">
        <h3>Before you submit</h3>
        <ul>
          <li>Read it once out loud. If a sentence is hard to say, it's hard to read.</li>
          <li>Every name, school, and time double-checked against a real source.</li>
          <li>A headline and dek that actually describe what's in the piece.</li>
          <li>A featured image and photo credit, if you have one worth using.</li>
        </ul>
        <p>Once you submit, an editor reads it, and either approves it, publishes it, or sends it back with notes on exactly what to fix. That's normal -- it's how every piece gets better before it goes live.</p>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-style-guide.js" defer></script>`;

  return layout({
    site,
    title: "Style Guide",
    description: "Podium Watch Writer Portal style guide.",
    pathname: "/writer-portal/style-guide/",
    content
  });
}
