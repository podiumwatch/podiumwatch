# Resend for Supabase Auth email (before Dec 1, 2026)

Why: about 800 athletic directors sign in to `/oatccc/verify/` with an emailed link. Supabase's built-in email sends only a couple of emails an hour and is not meant for real users. Supabase Auth will send through Resend's SMTP instead.

**This changes every Supabase Auth email on Podium Watch**, not only the OATCCC ones: sign-up confirmations and password resets for athletes, guardians, photographers, team accounts and writers all start coming from the new sender. That is an improvement (better delivery), but test one of them too (step 6).

Nothing here has been changed yet. Zachary does every step. No secret goes in git, in chat or in this file.

Checked against the Resend and Supabase docs on 2026-11-17. Their dashboards move things around; if a menu name below differs, look for the same setting nearby.

---

## 1. Pick the plan (Resend)

- Resend's Free plan is limited to **100 emails per day**. On Dec 1, hundreds of ADs may ask for a sign-in link the same day, and every link request is an email. Free is not enough for the form window.
- The Pro plan has no daily cap (listed at $20/month for 50,000 emails at the time of writing; check resend.com/pricing). Plan on Pro from late November through the late window (Feb 15, 2027), then decide whether to keep it.

## 2. Create the Resend account and add the domain

1. Sign up at resend.com with the Podium Watch account email.
2. **Domains > Add Domain.** Use a sending subdomain, not the bare domain, so these emails can't affect any other mail for podiumwatch.org:
   - Domain: `mail.podiumwatch.org`
   - Region: US East (closest to Supabase and Ohio).
3. Resend shows DNS records to add (usually an MX and a TXT for SPF on `send.mail.podiumwatch.org`, and a TXT for DKIM on `resend._domainkey.mail.podiumwatch.org`). Copy them **exactly** as Resend shows them.

## 3. Add the DNS records

1. Open the DNS settings wherever podiumwatch.org's DNS is managed (Vercel > Domains if the nameservers point to Vercel; otherwise the registrar).
2. Add each record Resend listed: same type, same name, same value. Many DNS panels add the domain automatically, so for the name enter only the part before `.podiumwatch.org` (for example `resend._domainkey.mail`).
3. Recommended: add a DMARC record if podiumwatch.org has none: type TXT, name `_dmarc`, value `v=DMARC1; p=none;`. (If one already exists, leave it.)
4. Back in Resend, click **Verify DNS Records**. It can take from minutes to a few hours. Wait until the domain shows **Verified**.

## 4. Create an API key for Supabase only

1. Resend > **API Keys > Create API Key**.
   - Name: `Supabase Auth SMTP`
   - Permission: **Sending access**
   - Domain: `mail.podiumwatch.org`
2. Copy the key once (it starts with `re_`). It is the SMTP password in the next step. Don't paste it anywhere else.

(This is a separate key from the RESEND_API_KEY the site itself still needs in Vercel for its own emails, which is another open item.)

## 5. Connect Supabase Auth to Resend

Supabase dashboard > the Podium Watch project > **Authentication > Emails > SMTP Settings** (older dashboards: Project Settings > Authentication > SMTP Settings).

1. Turn on **Enable Custom SMTP**.
2. Fill in:
   - Sender email: `noreply@mail.podiumwatch.org`
   - Sender name: `Podium Watch`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the `re_...` key from step 4
   - Minimum interval between emails (per user): leave the default (about 60 seconds). It only stops one person from asking for links back to back.
3. **Save.**
4. **Authentication > Rate Limits.** With custom SMTP, Supabase starts at **30 emails per hour** for the whole project. Raise "emails sent per hour" to **300** before Dec 1 (Resend Pro can take far more; this still stops runaway sending). Lower it again after Feb 15 if you like.

(Resend also offers a one-click "Connect Supabase" integration that fills in step 5 for you. The manual way above is easier to check and undo.)

## 6. Allow the sign-in link to return to the form

Supabase > **Authentication > URL Configuration > Redirect URLs > Add URL**:

- `https://www.podiumwatch.org/oatccc/verify/`

Keep every URL already in the list (other sign-in pages use them). Leave **Site URL** as it is.

The link in the email must come back to exactly this address, or Supabase sends the AD to the Site URL instead and they land on the wrong page.

## 7. Emails and sign-up settings

1. **Authentication > Sign In / Providers > Email:** "Allow new users to sign up" must stay **on**. The first time an AD asks for a link, Supabase creates their account. If sign-ups are off, new ADs can't get a link.
2. **Authentication > Emails > Templates:**
   - **Magic Link** is used only by the OATCCC page (checked in the code on 2026-11-17), so it can be OATCCC-specific. Suggested subject: `Your OATCCC verification sign-in link`. Suggested body (no em dashes, signed Podium Watch):

     ```
     <p>Use this link to sign in to the 2027 OATCCC Indoor State Meet verification form:</p>
     <p><a href="{{ .ConfirmationURL }}">Sign in to the verification form</a></p>
     <p>The link works once. If you did not ask for it, you can ignore this email.</p>
     <p>Podium Watch, powered by the OATCCC</p>
     ```
   - **Confirm signup** is shared with athletes, guardians, photographers and team accounts, and an AD's very first link may use it. Keep its wording general (no OATCCC-only text).

## 8. Test before Dec 1

Verification is still off on the live site (OATCCC_VERIFICATION_LIVE), so test from the Supabase side:

1. **Authentication > Users**: open the menu on a test user whose email you control and choose **Send magic link** (or use **Add user > Send invitation** to a new address you control). The email should arrive from `Podium Watch <noreply@mail.podiumwatch.org>` within a minute, not in spam.
2. Trigger a password reset on one existing Podium Watch sign-in page (for example a test athlete account) and check that email arrives too.
3. In Resend > **Emails**, both should show **Delivered**.
4. When migration 102 has run and OATCCC_VERIFICATION_LIVE is on (later, on your go), request a link at `/oatccc/verify/` with a test address and check that it brings you back to the form signed in.

## If something goes wrong

- **Emails stop sending:** Supabase > SMTP Settings: switch off Enable Custom SMTP to fall back to the built-in sender (very limited) while you check Resend > Emails for the error.
- **"Error sending magic link email":** usually the domain is not verified yet, the API key was copied wrong, or the hourly rate limit was hit.
- **AD lands on the home page instead of the form:** the redirect URL in step 6 is missing or has a typo (it needs the trailing slash).
