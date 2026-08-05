# Results Ingestion Status

## 2026 08 05, first real Baumspage crawl job run

### What was run

Confirmed the engine was already installed (`status` action returned `installed: true`; no migration re-run was needed). Ran the "Exact next action" from the version 3 entry below for real: created and ran a Baumspage provider job through the real admin API (`create_ingestion_job` / `run_ingestion_job`), first at 10 pages against the Baumspage cross country catalog, then seeded directly at one real event page once the catalog-level run showed why: with ~30+ sibling event pages all discovered at once from the catalog, a small page budget is consumed entirely on that one layer before any single event's actual result files ever get queued. This is a real characteristic of Baumspage's two-hop structure (catalog -> event page -> linked result files), not a bug, and is worth knowing when sizing future provider-wide jobs.

Seeded directly at one real event page (the 2025 Willard Early Bird Cross Country Invitational), the crawler correctly reached and parsed four real result PDFs end to end: fetched, classified as PDF, extracted, verified (score 73-97, evidence including `COMPLETE_RESULT_ROWS`), and staged as rows -- the first real, non-fixture proof that fetch -> classify -> extract -> verify -> stage works for a real Baumspage host.

### Two real bugs found and fixed

1. **PDF column drift.** `pdfText()` (in `lib/result_parsers.mjs`) joined PDF text items with exactly one space per item boundary rather than a pixel-proportional gap, so the number of spaces between reconstructed columns depended on how many separate text runs a PDF happened to split a field into, not on the real gap. The existing fixed-column parser then sliced data rows at character positions taken from the header line, which rarely lined up once place numbers and names of different lengths shifted everything after them. Real symptom: "Roberson, Jeremiah" / "Buckeye Central" parsed as athleteName "Rober" and schoolName "son, Jeremiah Buckeye Central". Fixed by padding each item out to the character column its real pixel x-coordinate corresponds to, so the same physical column lands at the same character column on every line.
2. **Team Scores leak.** The generic text-row parser had no notion of a HY-TEK Team Scores table, so summary rows like "1 Old Fort  21  1 2 5 6 7" satisfied the generic place/name/mark pattern and were staged as fake individual results. Fixed with the same "Team Scores" section boundary already used by the separate manual-paste importer (`lib/recruiting_service.mjs`).

Both fixed and verified: (a) via a permanent regression test using the actual PDF that exposed them, saved as a real fixture (`tests/fixtures/baumspage-boys-hs-results.pdf`), exercising the real `extractDocument()` pipeline directly, not a reimplementation; (b) live, end to end, through the real admin ingestion job API -- a fresh crawl of the same real meet now stages 39 correct rows per document with no column drift and no team-scores leak, down from 127 rows including corrupted names and 10 fake rows before the fix.

### Third bug found and fixed: catalog crawls never reached real results at all

A 10-page and then a 30-page job seeded at the bare catalog root (`https://www.baumspage.com/cc/`) both discovered only event-index pages and zero result documents. The real cause: `maxPages` capped how many pages could ever be *discovered* (queued), not just how many got fetched. Baumspage's catalog links to dozens of sibling event pages from one page, so that single page's fan-out alone exhausted the entire discovery budget before any individual event's own linked result files (PDFs, HTML result pages) were ever queued -- those children only become visible once their parent page is visited, by which point there was no discovery capacity left for them.

Fixed by decoupling discovery capacity from the visit budget: discovery is now capped much more generously (roughly 10x `maxPages`, floor 200, ceiling 2000) while `maxPages` continues to gate how many pages are actually fetched. Real result files already score far higher than navigation pages, so the existing score-first fetch order naturally prioritizes them once they exist in the queue -- they only needed the chance to be discovered.

**Verified live, seeded at nothing more than the bare catalog root URL:**
- 30-page budget: still 0 documents (the fix let discovery continue past the old artificial ceiling, but 30 fetches was not enough to also reach the now-discoverable real result files one hop further out -- confirmed by direct inspection: real, high-scoring result-file links existed in the queue, just not yet visited when the budget ran out).
- 100-page budget: **24 real documents, 3,098 rows staged, zero errors** -- fully autonomous, no manual per-event seeding required. Spot-checked several rows across three different real meets (including a large multi-division invitational): correct athlete names, schools, and marks, no column drift, no Team Scores leak.

**Practical page-budget guidance going forward:** seeding at a specific known event page (as in the first success above) reaches real results within 10-15 pages. Seeding at the bare provider catalog root needs a substantially larger budget (100 pages was sufficient in this real test; 30 was not) since it must first fan out across every currently-listed event before any single one's results become reachable.

### Honest current state

1. The crawler, PDF/HTML/text extraction, verification scoring, and staging pipeline are now confirmed working end to end against multiple real Baumspage meets, for the first time with real evidence rather than fixture-only testing -- both seeded at one specific event page and seeded at the bare provider catalog root.
2. Identity resolution (`resolveJobIdentities`) was exercised live against a real job: school-level matching succeeded correctly (an "Old Fort" row resolved to its real `ohio_schools` row), and athlete-level matching correctly reported every row `IDENTITY_UNMATCHED` rather than guessing, since none of these particular small local schools' runners have existing profiles yet. The import safety refusal was also confirmed live: manually marking unmatched rows "approved" and attempting `import_ingestion_job` correctly returned a 409 `NO_IMPORTABLE_ROWS` rather than importing anything without a real identity match.
3. A full successful review-approve-import round trip (a row that both matches a real existing profile and gets imported into `athlete_performances`) has still not been exercised, since no real crawl this session happened to include an athlete already in the database. This will naturally get proven the first time a real production crawl includes a previously-known athlete.
4. No SQL was run directly against Supabase for any of this; every check and job action went through the real admin API, exactly as the deployed product exposes it.
5. A background `vercel dev` process crashed mid-session from an unrelated Node.js/undici internal assertion error (`assert(!this.paused)` in the HTTP parser), most likely triggered by the sustained volume of real outbound requests during the bigger catalog crawl. Restarted cleanly; not a code bug in this project.

## 2026 08 03, version 3 verification update

### Repairs made after the Version 2 audit

1. Corrected normalized event keys so imported results connect to the permanent Podium Watch event catalog.
2. Preserved meet metadata through intermediate crawl pages and result provider handoffs.
3. Added human date normalization instead of discarding every non ISO date.
4. Added heading aware HTML table parsing for event, gender, and competition context.
5. Added correct metric normalization for common feet and inches field marks.
6. Added safe recovery of pages left in a fetching state after an interrupted server request.
7. Preserved parser warnings when athlete and school identity matching runs.
8. Prevented empty or incomplete approved batches from being marked as successfully imported.
9. Corrected duplicate progress counting to count newly staged rows only.
10. Added Baumspage event route priority so small catalog jobs reach actual meet pages before old archives.
11. Added private source document retention for exact audit and future reparsing.
12. Replaced the vulnerable spreadsheet dependency. The final production dependency audit reports zero known vulnerabilities.
13. Expanded the suite from 24 to 31 tests, including controlled redirect integration, unsafe redirect rejection, provider route priority, metadata propagation cases, project event keys, field mark conversion, and compound headers.

### Final local verification

1. Thirty one result tests passed.
2. The 25 meet and 1,000 row fixture passed twice with stable fingerprints.
3. The full 264 page production build passed.
4. The checker verified 284 HTML pages, 149 JavaScript files, 11,643 internal links, and 623 images.
5. The production dependency audit found zero known vulnerabilities.

### Required authenticated verification

The final database, private storage, import, page display, and rollback smoke test must run in Zachary's authenticated local Supabase environment. No success claim in this document treats fixture tests as proof of that live database workflow.

## 2026 08 03, version 2

### Completed locally

1. Replaced the narrow Phase One path in the dashboard with the resumable Phase Two crawler for provider discovery.
2. Added URL, provider catalog, multi URL, file upload, and pasted text jobs.
3. Added safe manual redirect traversal, DNS private address rejection, host allowlists, loop prevention, canonical URLs, limits, retries, cancellation, pause, resume, and retry controls.
4. Preserved complete source chains, page edges, document hashes, raw excerpts, raw rows, parser versions, reason codes, and structured errors.
5. Added HTML tables, preformatted HTML, plain text, CSV, XLSX, and text PDF extraction. Legacy XLS files must be saved as XLSX before upload.
6. Added scanned PDF detection with a safe OCR required review state.
7. Added normalized cross country, running, field, relay, DQ, DNF, DNS, scratch, and no mark handling.
8. Added exact only school and athlete matching. Ambiguous and unmatched identities remain staged.
9. Added private approved imports into athlete performance history, stable source keys, duplicate skipping, and recoverable batch reversal by archiving.
10. Added source chain inspection, raw warnings, selectable review, identity matching, private import confirmation, rollback, and downloadable review CSV controls.
11. Fixed empty API errors with request identifiers and structured stage details.
12. Pinned Node 24.x after the complete ingestion suite, production build, site checker, and dependency audit passed on Node 24.
13. Passed 24 result tests, including a 25 meet and 1,000 row load run twice with stable fingerprints.
14. Passed the complete build and checker for 264 pages, 149 JavaScript files, 284 HTML files, 11,643 internal links, and 623 images.

### Live public evidence

1. Baumspage public catalog access was visible on 2026 08 03.
2. A 2025 MileSplit state meet page exposed meet identity, date, location, timer, and a MileSplit Live handoff while logged out.
3. Athletic.net public help documents event result views containing place, athlete, school, mark, grade, wind, heat, and overall views.
4. An AthleticLIVE sample redirected to results.championshiptiming.org, which was added as an approved timing handoff.

### Requires Zachary's local environment

1. Rerun migration 05 because version 2 adds columns, adapters, and an import batch relationship.
2. Install the package and use Node 24.
3. Run authenticated Supabase smoke tests. This workspace does not contain Zachary's service credentials and must not request them.
4. Run live crawler jobs from the local Vercel environment, because this build workspace cannot directly reach arbitrary provider hosts.

### Honest limitations

1. OCR is detected but not executed inside the Vercel request. Scanned PDFs are held for manual OCR or pasted text.
2. Dynamic content behind provider login or licensing is not bypassed. Upload and pasted text are the supported bulk routes.
3. Newly observed timing hosts remain blocked until intentionally reviewed and added to the provider policy.

### Exact next action

Install Version 6, rerun migration 05, start the site with Node 24, open the Results Source Manager, run one ten page Baumspage provider job, and open Review. The page will show the exact chain and failure for every checked address.
