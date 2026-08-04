import { layout, pageHero } from "../lib/html.mjs";

export function privacyPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch privacy",
    title: "Privacy and team alerts.",
    description:
      "How Podium Watch handles team alert subscriptions, site analytics, and sponsor measurement."
  })}

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Team alert subscriptions</p>
        <h2>Email choices stay under your control</h2>
      </div>

      <div class="prose">
        <p>When you follow a team, Podium Watch stores your email address, the teams you follow, your alert preferences, and delivery history. A confirmation email is required before a new subscription becomes active.</p>
        <p>Every alert includes a secure link where you can change your preferences, stop following one team, or unsubscribe from all team alerts.</p>
        <p>Podium Watch does not sell follower email addresses to advertisers or team managers.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Analytics</p>
        <h2>Measurement without personal profiles</h2>
      </div>

      <div class="prose">
        <p>Podium Watch may record team page views, section views, social link clicks, recruiting link clicks, sponsor impressions, and sponsor clicks. Browser generated visitor and session identifiers help avoid counting the same view repeatedly.</p>
        <p>The analytics system is designed to measure site activity. It does not ask visitors to provide names, addresses, phone numbers, student records, or athlete health information.</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Service providers</p>
        <h2>Tools used to operate the service</h2>
      </div>

      <div class="prose">
        <p>Podium Watch uses hosting, database, analytics, and email delivery providers to operate the website and send requested alerts. Those providers process information only as needed to provide their services.</p>
        <p>Team managers can see aggregate team analytics and follower totals. They cannot see follower email addresses through the team dashboard.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Questions and requests</p>
        <h2>Contact Podium Watch</h2>
      </div>

      <div class="prose">
        <p>Questions about team alerts, analytics, or stored information can be sent to <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>.</p>
        <p>This page may be updated as Podium Watch adds or changes website features.</p>
      </div>
    </div>
  </section>`;

  return layout({
    site,
    title: "Privacy",
    description:
      "Podium Watch privacy information for team alerts, analytics, and sponsor measurement.",
    pathname: "/privacy/",
    content
  });
}
