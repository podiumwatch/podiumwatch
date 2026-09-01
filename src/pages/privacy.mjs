import { layout, pageHero } from "../lib/html.mjs";

export function privacyPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch privacy",
    title: "Privacy and team alerts.",
    description:
      "How Podium Watch handles team alert subscriptions, site analytics, cookies, and advertising."
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
        <p>Podium Watch may record team page views, section views, social link clicks, recruiting link clicks, sponsor impressions, and sponsor clicks through its own first-party analytics system. Browser generated visitor and session identifiers help avoid counting the same view repeatedly.</p>
        <p>Podium Watch also uses Google Analytics (GA4) to measure overall site traffic, such as which pages are visited, how visitors found the site, and general device and location information. Google Analytics uses cookies and similar technologies to do this. You can read Google's own privacy policy at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>, and you can opt out of Google Analytics tracking across all websites using the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Browser Add-on</a>.</p>
        <p>None of Podium Watch's analytics tools ask visitors to provide names, addresses, phone numbers, student records, or athlete health information.</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Cookies and advertising</p>
        <h2>How ads may use your information</h2>
      </div>

      <div class="prose">
        <p>Podium Watch works with, or is in the process of applying to, third-party advertising partners, including Google AdSense and Mediavine. Once active, these partners and their own vendors may use cookies and similar technologies to serve ads based on your prior visits to this and other websites.</p>
        <p>You can review how Google uses information from sites that use its services at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">policies.google.com/technologies/partner-sites</a>, and you can manage or opt out of personalized advertising from Google at <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>. You can also opt out of interest-based advertising from many companies at once through the Digital Advertising Alliance at <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">optout.aboutads.info</a>.</p>
        <p>Most browsers let you block or delete cookies in their settings. Blocking cookies may affect how parts of this site or its ads display, but it will not prevent you from reading Podium Watch's own coverage.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Service providers</p>
        <h2>Tools used to operate the service</h2>
      </div>

      <div class="prose">
        <p>Podium Watch uses hosting, database, analytics, email delivery, and (once active) advertising providers to operate the website and send requested alerts. Those providers process information only as needed to provide their services.</p>
        <p>Team managers can see aggregate team analytics and follower totals. They cannot see follower email addresses through the team dashboard.</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Children's privacy</p>
        <h2>Not directed at children</h2>
      </div>

      <div class="prose">
        <p>Podium Watch covers Ohio high school athletics, but the website itself is not directed at children under 13 and does not knowingly collect personal information from anyone under 13. Team alert subscriptions and My Podium accounts are intended for coaches, parents, athletes, and fans old enough to manage their own email and account preferences.</p>
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
        <p>Questions about team alerts, analytics, advertising, or stored information can be sent to <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>.</p>
        <p>This page may be updated as Podium Watch adds or changes website features, including as new advertising partners are added.</p>
      </div>
    </div>
  </section>`;

  return layout({
    site,
    title: "Privacy",
    description:
      "Podium Watch privacy information for team alerts, analytics, cookies, and advertising.",
    pathname: "/privacy/",
    content
  });
}
