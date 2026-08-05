# Results Provider Matrix

Verified date: 2026 08 03

| Provider | Current public behavior | Direct route | Parser route | Bulk fallback | Status and limitation |
| --- | --- | --- | --- | --- | --- |
| Baumspage | Public catalogs lead through variable meet, year, document, and timer pages | Bounded recursive crawl on Baumspage with event route priority and approved timer handoffs | Generic HTML table with heading context, preformatted HTML, text, PDF, CSV, and spreadsheet parsers | Upload linked result files or paste copied official results | Cross country and track event structures were live inspected. Final authenticated crawler execution remains required locally |
| MileSplit Ohio | Public calendar, article hubs, meet pages, results routes, and MileSplit Live handoffs are visible without login on sampled pages | Public link discovery and approved MileSplit Live handoff | Generic HTML parser when rows are server rendered | Upload an authorized export or paste copied results | Public meet metadata and live result handoff verified. Some depth may be dynamic or account limited |
| Athletic.net | Public division and meet pages exist, but some result content is JavaScript rendered | Link discovery only, including AthleticLIVE handoffs | Generic HTML when content is present in the response | Upload an authorized timer export or paste copied results | Official help confirms result views, events, places, marks, grade, and wind. Import stays link only without permission |
| FinishTiming | Public TrackScoreboard result pages and historical layouts | Bounded recursive crawl | Generic HTML table and text parsers | Upload CSV, HTML, PDF, or pasted results | Implemented with review required |
| Timing First | Public meet list can hand off through AthleticLIVE | Bounded recursive crawl with handoffs | Generic HTML table and text parsers | Upload official timer export | Current sample redirected from live.athletic.net to Championship Timing |
| Championship Timing | Public meet pages reached from AthleticLIVE | Approved external handoff | Generic HTML table and text parsers | Upload official timer export | Added after live redirect evidence on 2026 08 03 |
| RunSignup | Public result pages can be reached through Baumspage | Approved external handoff | Generic HTML where server rendered | Upload the public CSV export or paste copied results | Fragment selection is browser state and may require the export fallback |
| SEO Timing and MileSplit Live | Public live result links appear on MileSplit meet pages | Approved external handoff | Generic HTML table and text parsers | Upload official export | Public handoff verified from a 2025 OHSAA state meet page |
| Direct documents | User supplied source or provider link | Direct safe download or private upload | PDF text, HTML, TXT, CSV, and XLSX | Paste copied result text | Text PDF supported. Legacy XLS must be saved as XLSX. Scanned PDF is detected and held for OCR review |

## Access policy

The crawler uses public HTTPS addresses only, validates DNS and every redirect, limits size, time, retries, depth, pages, and redirects, and never bypasses login, CAPTCHA, or access controls. Dynamic or restricted providers always have file upload and pasted text fallbacks.

## Evidence standard

Live public inspection, controlled integration fixtures, and database workflow tests are recorded separately. A page being publicly visible does not mean direct bulk extraction is permanently guaranteed.
