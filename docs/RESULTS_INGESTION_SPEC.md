# Podium Watch Results Ingestion Specification

## Goal

Provide a safe, resumable, auditable path from public result links, provider directories, uploaded documents, and pasted result text to reviewed Podium Watch performances.

## Safety boundaries

1. Crawl only public HTTPS addresses on approved hosts.
2. Never bypass authentication, CAPTCHA, robots controls, or provider access restrictions.
3. Treat Athletic.net as link only unless written permission exists.
4. Keep every extracted row staged until an administrator approves it.
5. Never silently merge uncertain meets, schools, or athletes.
6. Preserve raw evidence, parser version, source chain, warnings, and fingerprints.
7. Make repeated imports idempotent and approved batches reversible.

## Inputs

1. One URL or many URLs.
2. A provider catalog URL.
3. Provider and season discovery.
4. Uploaded PDF, HTML, text, CSV, or spreadsheet files.
5. Pasted result text.

## Completion contract

A job records its seed, pages, edges, documents, checkpoints, errors, and progress. A verified document is parsed into normalized staging rows. Rows are reviewed before import. Imported rows retain their batch and source identity. Reversal deactivates only records created by that batch and never deletes unrelated data.

## Supported result contract

The normalized contract includes meet identity, date and location, sport, level, gender, division, event, heat or section, athlete or relay, school, grade, place, mark, points, wind, status, raw row, confidence, match confidence, warnings, and source identifiers.
