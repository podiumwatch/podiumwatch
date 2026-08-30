-- Athlete Profiles and Team Hubs: reversible athlete merging.
--
-- athlete_merge_profiles_v1 (install/02) already merges two athlete
-- profiles and writes an audit row to athlete_profile_merges -- but that
-- audit row only ever stored row COUNTS ("performances: 12"), never which
-- rows, and some data is destroyed outright during a merge (a duplicate
-- performance/ranking/story-link on the source is DELETEd, not moved,
-- whenever the target already has a matching key). Counts alone cannot
-- reverse a merge. This migration is purely additive on the audit table
-- (five new nullable columns, nothing dropped) and replaces the merge
-- function with a version that captures everything an unmerge needs
-- before it mutates anything, then adds the unmerge function itself.
--
-- Known, honest limitation (stated here and in the plan, not hidden):
-- this only snapshots the SOURCE profile's pre-merge state. The TARGET
-- profile's own pre-merge state is not separately captured, so unmerging
-- restores the source profile and every row that was reassigned or
-- deleted, but cannot undo the OR'd boolean flags, unioned primary_events,
-- or merged metadata the TARGET picked up during the merge, nor remove
-- the alias the merge added to the target for the source's old name.
-- A merge performed before this migration ships has no snapshot at all
-- and can never be unmerged through this mechanism -- athlete_unmerge_profiles_v1
-- refuses any merge row with a null source_snapshot rather than guessing.

alter table public.athlete_profile_merges
  add column if not exists source_snapshot jsonb,
  add column if not exists reassigned_ids jsonb,
  add column if not exists deleted_duplicate_snapshot jsonb,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by text;

create or replace function public.athlete_merge_profiles_v1(
  p_source_profile_id uuid,
  p_target_profile_id uuid,
  p_actor text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.athlete_profiles%rowtype;
  v_target public.athlete_profiles%rowtype;
  v_team_links integer := 0;
  v_performances integer := 0;
  v_rankings integer := 0;
  v_stories integer := 0;
  v_history integer := 0;
  v_source_snapshot jsonb;
  v_team_athletes_ids jsonb;
  v_history_ids jsonb;
  v_performance_ids jsonb;
  v_ranking_ids jsonb;
  v_story_ids jsonb;
  v_deleted_history jsonb;
  v_deleted_performances jsonb;
  v_deleted_rankings jsonb;
  v_deleted_stories jsonb;
begin
  if p_source_profile_id = p_target_profile_id then
    raise exception 'ATHLETE_MERGE_TARGET_MUST_DIFFER';
  end if;

  select * into v_source
  from public.athlete_profiles
  where id = p_source_profile_id
  for update;

  select * into v_target
  from public.athlete_profiles
  where id = p_target_profile_id
  for update;

  if v_source.id is null or v_target.id is null then
    raise exception 'ATHLETE_MERGE_PROFILE_NOT_FOUND';
  end if;

  if v_source.merged_into_profile_id is not null then
    raise exception 'ATHLETE_MERGE_SOURCE_ALREADY_MERGED';
  end if;

  -- Snapshot the source's full pre-merge row, the id of every row about to
  -- be reassigned, and the full content of every row about to be deleted
  -- as a duplicate -- all captured before any mutation below, so an
  -- unmerge later has everything it needs to put the source profile back
  -- exactly as it was.
  v_source_snapshot := to_jsonb(v_source);

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_team_athletes_ids
  from public.team_athletes
  where athlete_profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(distinct to_jsonb(source_row)), '[]'::jsonb) into v_deleted_history
  from public.athlete_school_history source_row
  join public.athlete_school_history target_row
    on target_row.profile_id = p_target_profile_id
   and coalesce(source_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid) =
       coalesce(target_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid)
   and coalesce(source_row.season_start_year, 0) = coalesce(target_row.season_start_year, 0)
   and coalesce(source_row.season_end_year, 0) = coalesce(target_row.season_end_year, 0)
  where source_row.profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_history_ids
  from public.athlete_school_history
  where profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(distinct to_jsonb(source_row)), '[]'::jsonb) into v_deleted_performances
  from public.athlete_performances source_row
  join public.athlete_performances target_row
    on target_row.profile_id = p_target_profile_id
   and source_row.source_key is not null
   and source_row.source_key = target_row.source_key
  where source_row.profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_performance_ids
  from public.athlete_performances
  where profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(distinct to_jsonb(source_row)), '[]'::jsonb) into v_deleted_rankings
  from public.athlete_ranking_entries source_row
  join public.athlete_ranking_entries target_row
    on target_row.profile_id = p_target_profile_id
   and source_row.ranking_entry_key = target_row.ranking_entry_key
  where source_row.profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ranking_ids
  from public.athlete_ranking_entries
  where profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(distinct to_jsonb(source_row)), '[]'::jsonb) into v_deleted_stories
  from public.athlete_story_links source_row
  join public.athlete_story_links target_row
    on target_row.profile_id = p_target_profile_id
   and source_row.story_slug = target_row.story_slug
   and source_row.relationship = target_row.relationship
  where source_row.profile_id = p_source_profile_id;

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_story_ids
  from public.athlete_story_links
  where profile_id = p_source_profile_id;

  update public.team_athletes
  set athlete_profile_id = p_target_profile_id
  where athlete_profile_id = p_source_profile_id;
  get diagnostics v_team_links = row_count;

  delete from public.athlete_school_history source_row
  using public.athlete_school_history target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and coalesce(source_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(target_row.school_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(source_row.season_start_year, 0) = coalesce(target_row.season_start_year, 0)
    and coalesce(source_row.season_end_year, 0) = coalesce(target_row.season_end_year, 0);

  update public.athlete_school_history
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_history = row_count;

  delete from public.athlete_performances source_row
  using public.athlete_performances target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.source_key is not null
    and source_row.source_key = target_row.source_key;

  update public.athlete_performances
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_performances = row_count;

  delete from public.athlete_ranking_entries source_row
  using public.athlete_ranking_entries target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.ranking_entry_key = target_row.ranking_entry_key;

  update public.athlete_ranking_entries
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_rankings = row_count;

  delete from public.athlete_story_links source_row
  using public.athlete_story_links target_row
  where source_row.profile_id = p_source_profile_id
    and target_row.profile_id = p_target_profile_id
    and source_row.story_slug = target_row.story_slug
    and source_row.relationship = target_row.relationship;

  update public.athlete_story_links
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;
  get diagnostics v_stories = row_count;

  update public.athlete_profile_corrections
  set profile_id = p_target_profile_id
  where profile_id = p_source_profile_id;

  insert into public.athlete_profile_aliases (
    profile_id,
    alias,
    normalized_alias,
    notes
  ) values (
    p_target_profile_id,
    v_source.display_name,
    v_source.normalized_name,
    'Alias preserved from a merged athlete profile.'
  )
  on conflict (profile_id, normalized_alias) do nothing;

  update public.athlete_profiles
  set
    preferred_name = coalesce(preferred_name, v_source.preferred_name),
    bio = coalesce(bio, v_source.bio),
    photo_url = coalesce(photo_url, v_source.photo_url),
    hometown = coalesce(hometown, v_source.hometown),
    college_commitment = coalesce(college_commitment, v_source.college_commitment),
    college_commitment_verified = college_commitment_verified or v_source.college_commitment_verified,
    current_school_id = coalesce(current_school_id, v_source.current_school_id),
    current_team_id = coalesce(current_team_id, v_source.current_team_id),
    public_visible = public_visible or v_source.public_visible,
    verified = verified or v_source.verified,
    recruiting_enabled = recruiting_enabled or v_source.recruiting_enabled,
    primary_events = array(
      select distinct value
      from unnest(primary_events || v_source.primary_events) as value
      where value is not null and btrim(value) <> ''
    ),
    updated_by = p_actor,
    metadata = metadata || jsonb_build_object(
      'merged_profile_id', p_source_profile_id,
      'merged_at', now()
    )
  where id = p_target_profile_id;

  update public.athlete_profiles
  set
    merged_into_profile_id = p_target_profile_id,
    public_visible = false,
    archived_at = coalesce(archived_at, now()),
    updated_by = p_actor,
    metadata = metadata || jsonb_build_object(
      'merge_reason', p_reason,
      'merged_at', now()
    )
  where id = p_source_profile_id;

  insert into public.athlete_profile_merges (
    source_profile_id,
    target_profile_id,
    merged_by,
    reason,
    summary,
    source_snapshot,
    reassigned_ids,
    deleted_duplicate_snapshot
  ) values (
    p_source_profile_id,
    p_target_profile_id,
    p_actor,
    p_reason,
    jsonb_build_object(
      'team_links', v_team_links,
      'school_history', v_history,
      'performances', v_performances,
      'rankings', v_rankings,
      'stories', v_stories
    ),
    v_source_snapshot,
    jsonb_build_object(
      'team_athletes', v_team_athletes_ids,
      'athlete_school_history', v_history_ids,
      'athlete_performances', v_performance_ids,
      'athlete_ranking_entries', v_ranking_ids,
      'athlete_story_links', v_story_ids
    ),
    jsonb_build_object(
      'athlete_school_history', v_deleted_history,
      'athlete_performances', v_deleted_performances,
      'athlete_ranking_entries', v_deleted_rankings,
      'athlete_story_links', v_deleted_stories
    )
  );

  return jsonb_build_object(
    'source_profile_id', p_source_profile_id,
    'target_profile_id', p_target_profile_id,
    'team_links', v_team_links,
    'school_history', v_history,
    'performances', v_performances,
    'rankings', v_rankings,
    'stories', v_stories
  );
end;
$$;

create or replace function public.athlete_unmerge_profiles_v1(
  p_merge_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merge public.athlete_profile_merges%rowtype;
  v_source public.athlete_profiles%rowtype;
  v_target public.athlete_profiles%rowtype;
  v_restored_team_links integer := 0;
  v_restored_history integer := 0;
  v_restored_performances integer := 0;
  v_restored_rankings integer := 0;
  v_restored_stories integer := 0;
  v_readded_history integer := 0;
  v_readded_performances integer := 0;
  v_readded_rankings integer := 0;
  v_readded_stories integer := 0;
begin
  select * into v_merge
  from public.athlete_profile_merges
  where id = p_merge_id
  for update;

  if v_merge.id is null then
    raise exception 'ATHLETE_UNMERGE_MERGE_NOT_FOUND';
  end if;

  if v_merge.reversed_at is not null then
    raise exception 'ATHLETE_UNMERGE_ALREADY_REVERSED';
  end if;

  if v_merge.source_snapshot is null then
    raise exception 'ATHLETE_UNMERGE_NO_SNAPSHOT';
  end if;

  select * into v_source
  from public.athlete_profiles
  where id = v_merge.source_profile_id
  for update;

  if v_source.id is null then
    raise exception 'ATHLETE_UNMERGE_SOURCE_PROFILE_MISSING';
  end if;

  if v_source.merged_into_profile_id is distinct from v_merge.target_profile_id then
    raise exception 'ATHLETE_UNMERGE_SOURCE_STATE_CHANGED';
  end if;

  select * into v_target
  from public.athlete_profiles
  where id = v_merge.target_profile_id
  for update;

  if v_target.id is null then
    raise exception 'ATHLETE_UNMERGE_TARGET_PROFILE_MISSING';
  end if;

  -- A target that has since been merged into a third profile would need
  -- chain-aware handling this pass does not attempt -- refuse rather than
  -- reassign rows out from under whatever now owns them.
  if v_target.merged_into_profile_id is not null then
    raise exception 'ATHLETE_UNMERGE_TARGET_SINCE_MERGED';
  end if;

  -- Restore the source profile's own pre-merge row exactly as captured.
  -- This does not attempt to undo whatever the TARGET picked up during the
  -- merge (OR'd flags, unioned primary_events, merged metadata, or the
  -- alias added for the source's old name) -- only the source's pre-merge
  -- state was ever snapshotted. See the migration header for why.
  update public.athlete_profiles as target
  set
    first_name = restored.first_name,
    last_name = restored.last_name,
    preferred_name = restored.preferred_name,
    display_name = restored.display_name,
    normalized_name = restored.normalized_name,
    gender = restored.gender,
    graduation_year = restored.graduation_year,
    graduation_year_source = restored.graduation_year_source,
    current_school_id = restored.current_school_id,
    current_team_id = restored.current_team_id,
    athlete_status = restored.athlete_status,
    bio = restored.bio,
    photo_url = restored.photo_url,
    hometown = restored.hometown,
    college_commitment = restored.college_commitment,
    college_commitment_verified = restored.college_commitment_verified,
    public_visible = restored.public_visible,
    verified = restored.verified,
    verification_status = restored.verification_status,
    suspended = restored.suspended,
    admin_locked = restored.admin_locked,
    recruiting_enabled = restored.recruiting_enabled,
    recruiting_headline = restored.recruiting_headline,
    primary_events = restored.primary_events,
    college_interests = restored.college_interests,
    recruiting_contact_route = restored.recruiting_contact_route,
    recruiting_consent_confirmed = restored.recruiting_consent_confirmed,
    recruiting_consent_recorded_at = restored.recruiting_consent_recorded_at,
    source_id = restored.source_id,
    last_source_reviewed_at = restored.last_source_reviewed_at,
    published_at = restored.published_at,
    merged_into_profile_id = null,
    archived_at = restored.archived_at,
    metadata = restored.metadata,
    updated_by = p_actor
  from jsonb_populate_record(null::public.athlete_profiles, v_merge.source_snapshot) as restored
  where target.id = v_merge.source_profile_id;

  update public.team_athletes
  set athlete_profile_id = v_merge.source_profile_id
  where id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_merge.reassigned_ids->'team_athletes', '[]'::jsonb)) as value
  );
  get diagnostics v_restored_team_links = row_count;

  update public.athlete_school_history
  set profile_id = v_merge.source_profile_id
  where id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_merge.reassigned_ids->'athlete_school_history', '[]'::jsonb)) as value
  );
  get diagnostics v_restored_history = row_count;

  update public.athlete_performances
  set profile_id = v_merge.source_profile_id
  where id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_merge.reassigned_ids->'athlete_performances', '[]'::jsonb)) as value
  );
  get diagnostics v_restored_performances = row_count;

  update public.athlete_ranking_entries
  set profile_id = v_merge.source_profile_id
  where id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_merge.reassigned_ids->'athlete_ranking_entries', '[]'::jsonb)) as value
  );
  get diagnostics v_restored_rankings = row_count;

  update public.athlete_story_links
  set profile_id = v_merge.source_profile_id
  where id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_merge.reassigned_ids->'athlete_story_links', '[]'::jsonb)) as value
  );
  get diagnostics v_restored_stories = row_count;

  -- Re-add every duplicate row that was deleted (not moved) during the
  -- merge, using its full pre-delete content -- on conflict (id) do
  -- nothing makes this safe to run even if a row somehow already exists.
  insert into public.athlete_school_history
  select * from jsonb_populate_recordset(
    null::public.athlete_school_history,
    coalesce(v_merge.deleted_duplicate_snapshot->'athlete_school_history', '[]'::jsonb)
  )
  on conflict (id) do nothing;
  get diagnostics v_readded_history = row_count;

  insert into public.athlete_performances
  select * from jsonb_populate_recordset(
    null::public.athlete_performances,
    coalesce(v_merge.deleted_duplicate_snapshot->'athlete_performances', '[]'::jsonb)
  )
  on conflict (id) do nothing;
  get diagnostics v_readded_performances = row_count;

  insert into public.athlete_ranking_entries
  select * from jsonb_populate_recordset(
    null::public.athlete_ranking_entries,
    coalesce(v_merge.deleted_duplicate_snapshot->'athlete_ranking_entries', '[]'::jsonb)
  )
  on conflict (id) do nothing;
  get diagnostics v_readded_rankings = row_count;

  insert into public.athlete_story_links
  select * from jsonb_populate_recordset(
    null::public.athlete_story_links,
    coalesce(v_merge.deleted_duplicate_snapshot->'athlete_story_links', '[]'::jsonb)
  )
  on conflict (id) do nothing;
  get diagnostics v_readded_stories = row_count;

  update public.athlete_profile_merges
  set reversed_at = now(), reversed_by = p_actor
  where id = p_merge_id;

  return jsonb_build_object(
    'merge_id', p_merge_id,
    'source_profile_id', v_merge.source_profile_id,
    'target_profile_id', v_merge.target_profile_id,
    'restored_team_links', v_restored_team_links,
    'restored_school_history', v_restored_history,
    'restored_performances', v_restored_performances,
    'restored_rankings', v_restored_rankings,
    'restored_stories', v_restored_stories,
    'readded_school_history', v_readded_history,
    'readded_performances', v_readded_performances,
    'readded_rankings', v_readded_rankings,
    'readded_stories', v_readded_stories
  );
end;
$$;

revoke all on function public.athlete_unmerge_profiles_v1(uuid, text) from anon, authenticated;
grant execute on function public.athlete_unmerge_profiles_v1(uuid, text) to service_role;
