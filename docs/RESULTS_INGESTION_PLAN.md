# Podium Watch Results Ingestion Plan

## Milestones

1. Audit Phase One and freeze requirements, complete.
2. Add durable job, crawl, document, staging, and audit schema, complete in migration 05.
3. Add bounded crawler with scoring, safe redirects, retries, rate response handling, loop protection, source chains, and checkpoints, complete.
4. Add HTML table, preformatted HTML, plain text, CSV, XLS, XLSX, and text PDF extraction, complete.
5. Add multiple file upload and pasted text transport with private staging, complete.
6. Add admin job creation, progress, pause, resume, retry, cancellation, source inspection, review, approval, import, and reversal routes, complete.
7. Add strict school and athlete matching with ambiguous review, complete.
8. Connect approved imports privately to athlete performance history and existing profile views, complete.
9. Add provider policies, generic adapters, approved timing handoffs, and guaranteed upload or paste fallbacks, complete for the named providers.
10. Run authenticated local database and live provider smoke tests after installation, requires the project owner's configured local environment.

## Validation

Run `npm.cmd run build`, `npm.cmd run check`, and `npm.cmd run test:results` before installation. Rerun additive migration 05 in Supabase, then use the Results Source Manager with a ten page provider job before expanding limits.
