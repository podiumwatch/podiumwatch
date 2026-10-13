-- Athletic.net rankings import: external_id uniqueness guard.
--
-- athlete_profile_aliases (install/02) has alias_type='external_id' rows
-- since install/32, but its only uniqueness constraint is
-- (profile_id, normalized_alias) -- that stops the SAME profile claiming
-- one athlete_url twice, but says nothing about two DIFFERENT profiles
-- both claiming the same real Athletic.net athlete_url. The new Ohio XC
-- 2026 rankings importer (lib/athletic_net_rankings_service.mjs) treats an
-- exact athlete_url match as its strongest, first-checked identity signal
-- (stronger than name+gender+graduation_year+school) specifically because
-- Athletic.net guarantees it is unique per real athlete -- so this
-- constraint is what makes that guarantee hold at the database layer too,
-- not just in application code. Purely additive: a partial unique index,
-- no existing data touched, and harmless if no external_id rows exist yet.

create unique index if not exists athlete_profile_alias_external_id_unique
  on public.athlete_profile_aliases (normalized_alias)
  where alias_type = 'external_id';
