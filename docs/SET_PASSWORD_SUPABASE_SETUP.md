# "Set your password" page: Supabase settings (2026-11-17)

New page: `/set-password/` (src/pages/setpassword.mjs, public/scripts/set-password.js). It sets the password from a Supabase invite or password-recovery link, then sends OATCCC staff to `/oatccc/admin/` (only once that page is switched on with OATCCC_VERIFICATION_LIVE; until then, staff go to the homepage like everyone else). Expired or used links get a clear message.

The homepage now forwards invite and recovery links (and Supabase's "expired link" errors) to `/set-password/`, so **links sent the way they are today already work once this is deployed**. The settings below make it sturdier. Change them yourself in the Supabase dashboard; nothing here was changed.

## 1. URL Configuration (Authentication > URL Configuration)

- **Site URL:** `https://www.podiumwatch.org` (leave it if it already is).
- **Redirect URLs > Add URL:** `https://www.podiumwatch.org/set-password/`
  Keep every URL already there (the athlete, guardian, photographer, team, writer and OATCCC sign-in pages use them).

## 2. Invite email template (Authentication > Emails > Templates > Invite user)

Replace the link in the template with:

```
<a href="{{ .SiteURL }}/set-password/?token_hash={{ .TokenHash }}&type=invite">Accept the invite and set your password</a>
```

Why: the default link is used up the moment anything opens it. School and district email systems often "pre-click" links to scan them, which burns the link before the person sees it (they then get "expired"). With this link, the page only uses the token when the person actually opens it in a browser. It also skips the trip through the homepage.

## 3. Reset password template: leave it as it is

Do **not** point the "Reset password" template at `/set-password/`. The site's own "Forgot password" buttons (athletes, guardians, photographers, team accounts, writers) send people back to their own sign-in pages, and the default template keeps doing that. A reset sent from the Supabase dashboard (Authentication > Users > Send password recovery) lands on the homepage, which now forwards it to `/set-password/`.

## 4. Password length (Authentication > Sign In / Providers > Email)

The page asks for at least 8 characters. Set **Minimum password length** to 8 so Supabase enforces the same rule everywhere.

## 5. Test after deploying

1. Authentication > Users > Invite user, to an address you control. Open the email, click the link: you should land on "Set your password", set one, and go to the homepage (or `/oatccc/admin/` if that account is an OATCCC admin and verification is on).
2. Click the same link again: "This link has expired or was already used."
3. Authentication > Users > a test user > Send password recovery: same flow.

Note: writers invited from the dashboard now also land on `/set-password/` and then the homepage (before, they landed on the homepage with no way to set a password). They sign in at `/writer-login/` afterwards.
