# Podium Watch Content Guide

This guide explains how stories, rankings, images, future athlete features, interviews, and sponsors are organized.

## Root content folder

The project uses this content structure:

```text
content
  stories
  rankings
  athletes
  interviews
  pages
  templates
```

The main weekly publishing folder is:

```text
content/stories
```

## Story naming convention

Use the date followed by a short descriptive file name.

Example:

```text
20260815_d4_boys_season_preview.md
```

Use:

1. Four digit year
2. Two digit month
3. Two digit day
4. An underscore
5. Lowercase words separated by underscores
6. The `.md` file extension

The public story address is based on the `slug` field when one is supplied. Otherwise, it is based on the file name.

## Complete story front matter

Copy this template:

```yaml
---
title: "Story title"
date: "2026-08-15"
description: "A short description that appears on story cards and in search results."
category: "Cross Country"
author: "Podium Watch"
featuredImage: "/images/stories/example.jpg"
featuredImageAlt: "Clear description of the image"
tags:
  - "Division 3"
  - "Boys Cross Country"
featured: false
draft: false
sponsor: "approved_sponsor_id"
updatedDate: "2026-08-16"
canonicalUrl: "https://example.com/original-story"
slug: "custom-readable-address"
---

Story content begins here.
```

## Required story fields

Every published story must contain:

1. `title`
2. `date`
3. `description`
4. `category`
5. `author`

The build stops and names the incorrect file when a required field is missing.

## Optional story fields

### featuredImage

Local path to the main story image.

Example:

```yaml
featuredImage: "/images/stories/state_meet_finish.jpg"
```

### featuredImageAlt

A clear description of the meaningful content in the image.

Example:

```yaml
featuredImageAlt: "Three runners approaching the finish at the Ohio state cross country meet"
```

### tags

Tags support search and related story selection.

Example:

```yaml
tags:
  - "Division 3"
  - "Boys Cross Country"
  - "2026 Preview"
```

### featured

Use `true` for the main featured story.

```yaml
featured: true
```

### draft

Use `true` to keep the story unpublished.

```yaml
draft: true
```

### sponsor

Use the sponsor ID from `src/data/sponsors.json`.

```yaml
sponsor: "example_sponsor"
```

### updatedDate

Use this when an already published story receives a meaningful update.

```yaml
updatedDate: "2026-08-16"
```

### canonicalUrl

Use this only when the same story was originally published at another approved web address. The supplied address becomes the canonical page address.

```yaml
canonicalUrl: "https://example.com/original-story"
```

### slug

Use this to control the readable page address.

```yaml
slug: "2026-d3-boys-cross-country-top-25"
```

The resulting page address will be:

```text
/stories/2026-d3-boys-cross-country-top-25/
```

## Featured images

Store story images in:

```text
public/images/stories
```

Recommended dimensions:

1. Main landscape image: 1600 by 900 pixels
2. Minimum useful width: 1200 pixels
3. Recommended ratio: 16 to 9
4. Recommended file size: below 500 KB when practical
5. Recommended format: JPG for photographs, PNG for graphics, SVG for simple vector artwork

When a story does not provide an image, the website uses the Podium Watch fallback artwork.

When a supplied image cannot load in the browser, the fallback artwork replaces it.

## Categories

Use consistent category names. Suggested current categories are:

1. Cross Country
2. Track and Field
3. Athlete Spotlight
4. Beyond the Podium
5. Meet Coverage
6. Podium Watch

The stories page automatically creates category filtering options from published content.

Category pages are generated automatically.

Do not create slightly different versions of the same category. For example, use `Cross Country` consistently rather than alternating between `XC`, `Cross country`, and `Cross Country Rankings`.

## Tags

Tags are more specific than categories.

Useful tags include:

1. Division 1
2. Division 2
3. Division 3
4. Division 4
5. Division 5
6. Boys Cross Country
7. Girls Cross Country
8. Boys Track and Field
9. Girls Track and Field
10. Athlete name
11. School name
12. State Meet
13. Regional Meet

Tags improve story search and help choose related stories.

## Draft behavior

A story with `draft: true` is not included in public pages, search, the sitemap, or RSS.

A story with `draft: false` is published during the next build.

## Featured story behavior

The homepage uses the newest published story with:

```yaml
featured: true
```

When no story is featured, the newest published story becomes the featured story automatically.

## Related stories

Related stories are selected from:

1. The same category
2. Shared tags
3. Newest publication order

The current story is excluded.

## Reading time

Reading time is calculated from the Markdown body using a standard reading pace. It updates automatically when the article changes.

## Page address generation

The page address uses this priority:

1. The optional `slug` front matter value
2. The Markdown file name

Dates and repeated punctuation are cleaned into a readable lowercase address.

## Markdown writing examples

### Heading

```markdown
## How the rankings were built
```

### Bold text

```markdown
**State championship performance received the most weight.**
```

### Link

```markdown
[Read more Podium Watch stories](/stories/)
```

### Quote

```markdown
> The best performances are worth celebrating. The people behind them are worth knowing.
```

### Numbered list

```markdown
1. First item
2. Second item
3. Third item
```

### Table

```markdown
| Rank | Athlete | School | Time |
| --- | --- | --- | --- |
| 1 | Athlete Name | School Name | 15:30.00 |
```

Article tables automatically use a horizontally scrollable container on narrow phones.

## Copy and paste story template

```markdown
---
title: "Story title"
date: "2026-08-15"
description: "A short description for story cards and search results."
category: "Cross Country"
author: "Podium Watch"
featuredImage: "/images/stories/example.jpg"
featuredImageAlt: "Clear description of the image"
tags:
  - "Division 3"
  - "Boys Cross Country"
featured: false
draft: true
---

Write a clear opening paragraph here.

## First section

Write the first section here.

## Second section

Write the next section here.
```

## Ranking files

Ranking data is stored in:

```text
content/rankings
```

Start with:

```text
content/templates/ranking_template.csv
```

The supported columns are:

1. `title`
2. `slug`
3. `sport`
4. `gender`
5. `division`
6. `season`
7. `event`
8. `updatedDate`
9. `rank`
10. `previousRank`
11. `athlete`
12. `school`
13. `grade`
14. `timeOrMark`
15. `rankingExplanation`
16. `athleteImage`
17. `schoolLogo`

The build currently requires these columns:

1. `title`
2. `slug`
3. `sport`
4. `gender`
5. `division`
6. `season`
7. `updatedDate`
8. `rank`
9. `athlete`
10. `school`
11. `timeOrMark`

Optional cells may remain empty.

Repeat the shared page values on every row when exporting from Google Sheets. This keeps CSV files easy to validate and replace.

## Google Sheets ranking workflow

1. Copy `content/templates/ranking_template.csv` into Google Sheets.
2. Keep the header row unchanged.
3. Fill one athlete or team per row.
4. Repeat the title, slug, sport, gender, division, season, event, and updated date on every row.
5. Sort rows by the intended ranking order.
6. Export the sheet as CSV.
7. Place the file in `content/rankings`.
8. Run `npm run build`.
9. Run `npm run check`.
10. Open the local page and review every name, school, rank, and time.

## Athlete content folder

Future athlete files belong in:

```text
content/athletes
```

Use:

```text
content/templates/athlete_template.md
```

The current public athlete spotlight page intentionally shows an honest empty state until approved profiles are added. No fake athlete profiles are included.

## Interview content folder

Future interview files belong in:

```text
content/interviews
```

Use:

```text
content/templates/interview_template.md
```

The current public interview page intentionally shows an honest empty state until approved interviews are published.

## Sponsors

Sponsor records are stored in:

```text
src/data/sponsors.json
```

Sponsor images belong in:

```text
public/images/sponsors
```

Only add approved sponsors, descriptions, logos, and addresses.

## Check the website before publishing

Run these commands:

```bash
npm run build
npm run check
npm run preview
```

Review:

1. Homepage
2. Stories page
3. New story page
4. Story image and alternative text
5. Ranking page
6. Navigation
7. Mobile menu
8. Footer
9. Instagram and YouTube links
10. Contact email
11. Page title and description
12. Search and category filtering

Then commit and push the update to GitHub.
