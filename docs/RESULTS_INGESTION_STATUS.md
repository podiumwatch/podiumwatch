# Results Ingestion Status

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
