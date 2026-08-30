-- Athlete Profiles and Team Hubs: alias table extension.
--
-- athlete_profile_aliases already exists (install/02) and already has a
-- unique (profile_id, normalized_alias) constraint, but every row has always
-- meant the same thing: "this athlete is also known by this name." This
-- migration is purely additive -- two nullable/defaulted columns on the
-- existing table, no data touched -- and lets the same table also carry
-- external-provider identity mappings (Athletic.net/MileSplit-style ids),
-- per the identity requirement for external source identity mapping.
--
-- alias_type = 'name'        -- a name variant/misspelling/shortened form.
--                               Search and import matching only ever
--                               consider these rows.
-- alias_type = 'external_id' -- an external provider's athlete id, entered
--                               by an admin when known. Informational and
--                               display-only in this pass -- never fetched
--                               live, never used for matching.
--
-- Every existing row is a name alias by definition, so backfilling
-- alias_type = 'name' as the default for pre-existing rows (via the column
-- default applying to existing rows on add) is correct, not a guess.

alter table public.athlete_profile_aliases
  add column if not exists alias_type text not null default 'name'
    check (alias_type in ('name', 'external_id')),
  add column if not exists external_source text;

create index if not exists athlete_profile_alias_type_index
  on public.athlete_profile_aliases (alias_type);
