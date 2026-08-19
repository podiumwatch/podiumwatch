import {
  layout,
  pageHero
} from "../lib/html.mjs";
import {
  MONTHLY_PRICE_CENTS,
  ANNUAL_PRICE_CENTS,
  ANNUAL_MONTHLY_EQUIVALENT_CENTS,
  ANNUAL_SAVINGS_CENTS,
  formatUsd
} from "../../lib/photographer_membership_config.mjs";

// The public Photographer Network membership pricing page. Fully static
// -- pricing is fixed business copy, not per-record data, so unlike
// photographers.mjs (a directory that fetches from Supabase) this page
// needs nothing at runtime and is baked entirely at build time, reading
// every dollar figure from lib/photographer_membership_config.mjs so the
// number is never duplicated across files. One membership, two billing
// intervals -- no free tier, no Basic/Featured/Pro tiers (retired, see
// install/17's design notes).
export function photographerMembershipPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Photographer Network",
    title: "One membership. Two ways to pay.",
    description: "Every Photographer Network member gets the same full listing, search visibility, and portfolio -- monthly or annual, paying more never buys extra features."
  })}

  <style>
    .photog-pricing-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
    .photog-pricing-card { padding: 30px; border-radius: 16px; border: 1px solid rgba(15, 23, 42, 0.14); background: #ffffff; display: grid; gap: 14px; align-content: start; }
    .photog-pricing-card[data-best-value] { border-color: #00bf63; box-shadow: 0 16px 40px rgba(0, 191, 99, 0.14); position: relative; }
    .photog-pricing-tag { display: inline-flex; align-self: start; padding: 4px 12px; border-radius: 999px; background: #00bf63; color: #fff; font-size: 0.74rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; }
    .photog-pricing-name { margin: 0; }
    .photog-pricing-price { font-size: 2.4rem; font-weight: 900; line-height: 1; }
    .photog-pricing-price span { font-size: 1rem; font-weight: 700; opacity: 0.7; }
    .photog-pricing-sub { opacity: 0.75; }
    .photog-pricing-list { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 10px; }
    .photog-pricing-list li { padding-left: 26px; position: relative; }
    .photog-pricing-list li::before { content: "\\2713"; position: absolute; left: 0; top: 0; font-weight: 900; color: #00bf63; }
    .photog-pricing-card .button { margin-top: 8px; }
    .photog-pricing-faq { display: grid; gap: 18px; margin-top: 10px; }
    .photog-pricing-faq h3 { margin-bottom: 6px; }
    @media (max-width: 760px) {
      .photog-pricing-grid { grid-template-columns: 1fr; }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="photog-pricing-grid">
        <article class="photog-pricing-card">
          <p class="eyebrow">Monthly</p>
          <h2 class="photog-pricing-name">Photographer Network Membership</h2>
          <p class="photog-pricing-price">${formatUsd(MONTHLY_PRICE_CENTS)}<span> / month</span></p>
          <p class="photog-pricing-sub">Billed monthly. Cancel anytime.</p>
          <ul class="photog-pricing-list">
            <li>Cancel anytime</li>
            <li>Full Photographer Network membership</li>
          </ul>
          <a class="button button-primary" href="/photographer-login/">Get started</a>
        </article>

        <article class="photog-pricing-card" data-best-value>
          <span class="photog-pricing-tag">Best value</span>
          <p class="eyebrow">Annual</p>
          <h2 class="photog-pricing-name">Photographer Network Membership</h2>
          <p class="photog-pricing-price">${formatUsd(ANNUAL_PRICE_CENTS)}<span> / year</span></p>
          <p class="photog-pricing-sub">Approximately ${formatUsd(ANNUAL_MONTHLY_EQUIVALENT_CENTS)} per month -- save ${formatUsd(ANNUAL_SAVINGS_CENTS)} compared with twelve monthly payments.</p>
          <ul class="photog-pricing-list">
            <li>Full Photographer Network membership</li>
            <li>Includes one Podium Watch photographer partnership announcement story</li>
          </ul>
          <a class="button button-primary" href="/photographer-login/">Get started</a>
        </article>
      </div>

      <section class="info-card photog-pricing-faq" style="margin-top:32px;">
        <div>
          <p class="eyebrow">How membership works</p>
          <h2>What every member gets, and what's different</h2>
        </div>
        <div>
          <h3>Both plans are identical, except one thing</h3>
          <p>Monthly and annual members get the exact same listing, the exact same search visibility across school, city, region, and sport searches, and the exact same meet coverage and gallery tools. Paying annually does not rank a photographer above a monthly member -- placement is never for sale here. The one difference: annual members receive one Podium Watch partnership announcement story, introducing their business and membership, included with their first qualifying annual membership. It's a one-time launch benefit, not something that repeats every year on renewal.</p>
        </div>
        <div>
          <h3>Membership renews automatically until canceled</h3>
          <p>Both the monthly and annual options are recurring subscriptions. They renew automatically at the price above until you cancel. If you cancel, your membership stays active through the end of the period you already paid for -- you're never cut off mid-period.</p>
        </div>
        <div>
          <h3>Getting a free directory listing is always separate from membership</h3>
          <p>Creating a listing and appearing in the Photographer Network directory has never required payment and still doesn't. Membership is a separate, optional way to support Podium Watch's coverage of Ohio high school sports.</p>
        </div>
        <div>
          <h3>Ready to join?</h3>
          <p>Create your free listing first, then reach out to Podium Watch to activate your membership while online billing is being finalized.</p>
          <a class="button button-dark" href="mailto:${site.contactEmail}?subject=Photographer%20Network%20Membership">Contact Podium Watch</a>
        </div>
      </section>
    </div>
  </section>`;

  return layout({
    site,
    title: "Photographer Network Membership",
    description: `Podium Watch Photographer Network membership pricing: ${formatUsd(MONTHLY_PRICE_CENTS)}/month or ${formatUsd(ANNUAL_PRICE_CENTS)}/year, both with full membership features.`,
    pathname: "/photographers/membership/",
    content
  });
}
