# Podium Watch security rules

## 1. Secrets

Never place secret values in:

1. Browser JavaScript
2. Static HTML
3. Git commits
4. Documentation
5. Screenshots
6. Terminal commands shared publicly

Keep secret values in Vercel environment variables.

## 2. Supabase

1. The publishable key may be used by approved browser authentication code.
2. The secret key must remain server side.
3. Row Level Security should remain enabled.
4. Public and authenticated database grants should stay limited.
5. Privileged actions should verify admin or team membership on the server.

## 3. User generated content

1. Sanitize text.
2. Validate URLs.
3. Limit lengths.
4. Rate limit sensitive actions.
5. Keep moderation controls.
6. Preserve audit history.
7. Require consent before publishing athlete social links.
8. Avoid exposing private follower email addresses to team managers.

## 4. Admin operations

1. Do not use a coach account to make admin changes.
2. Keep separate admin permissions.
3. Record ownership changes, suspensions, merges, and permanent removals.
4. Prefer archive and restore over immediate permanent deletion.