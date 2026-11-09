-- Podium Watch: one-time cleanup of Finish Timing jobs stuck in "running"
-- Purpose:
--   Audit 2026-11-09 found 48 Finish Timing ingestion jobs showing
--   "Running" with no progress. Cause: the scan reused one job per day and
--   set it back to "running" at the end of every scan, so none ever
--   finished. Fixed in lib/finish_timing_ingestion_service.mjs (each scan
--   now ends its job as completed, partial or failed) and the 15-minute
--   cron now closes any Finish Timing job with no progress for 30 minutes.
--
--   Once that code is deployed, the next cron run closes these rows by
--   itself. This file does the same thing by hand, for running it right
--   away or if the cron stays off.
--
-- Status:
--   The jobs table only allows its existing statuses, so stuck jobs become
--   'failed' with error_summary.timed_out = true and a reason, rather than
--   a new 'timed_out' status.
--
-- Safety:
--   Only touches Finish Timing jobs still 'running' with no update for
--   30 minutes. No rows are deleted. Run the select first to see them.

-- Preview:
-- select id, status, created_at, updated_at, progress
-- from public.result_ingestion_jobs
-- where provider_key = 'finish_timing'
--   and status = 'running'
--   and updated_at < now() - interval '30 minutes'
-- order by created_at;

begin;

update public.result_ingestion_jobs
set status = 'failed',
    completed_at = now(),
    updated_at = now(),
    error_summary = coalesce(error_summary, '{}'::jsonb) || jsonb_build_object(
      'timed_out', true,
      'reason', 'Stuck in running with no progress; closed by the 2026-11-09 cleanup.'
    )
where provider_key = 'finish_timing'
  and status = 'running'
  and updated_at < now() - interval '30 minutes';

commit;
