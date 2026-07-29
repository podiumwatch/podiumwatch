# Podium Watch Project Structure

## Project tree

```text
podium_watch_website_final
  package.json
  package-lock.json
  vercel.json
  README.md
  CONTENT_GUIDE.md
  PROJECT_STRUCTURE.md

  content
    stories
      20260729_welcome_to_podium_watch.md
      20260729_d3_boys_top_25_returning.md
    rankings
      cross_country_d3_boys_2026.csv
      README.md
    athletes
      README.md
    interviews
      README.md
    pages
      about.md
    templates
      story_template.md
      ranking_template.csv
      athlete_template.md
      interview_template.md

  public
    images
      branding
      stories
      athletes
      interviews
      rankings
      sponsors
      social
    scripts
      site.js

  src
    config
      site.mjs
    data
      sponsors.json
    lib
      content.mjs
      html.mjs
      markdown.mjs
    styles
      main.css

  scripts
    build.mjs
    check.mjs
    serve.mjs

  dist
    Generated website files
```

## Root files

### package.json

Defines the npm commands and Node.js version.

### package-lock.json

Records the npm project state for consistent installation.

### vercel.json

Tells Vercel to run `npm run build` and publish the `dist` folder.

### README.md

Beginner instructions for local use, stories, rankings, GitHub, and Vercel.

### CONTENT_GUIDE.md

Detailed publishing guide for Markdown, CSV rankings, images, categories, tags, drafts, and featured stories.

### PROJECT_STRUCTURE.md

This file. It explains where everything belongs.

## content

The root publishing folder. Most regular website updates happen here.

### content/stories

The main weekly publishing folder. Every valid published Markdown file automatically creates:

1. A story page
2. A story card
3. Search data
4. Category placement
5. Sitemap entry
6. RSS entry
7. Related story eligibility

### content/rankings

CSV ranking files. Each valid CSV creates a ranking page and appears in the correct sport, gender, and division area.

### content/athletes

Prepared for future approved athlete profile content.

### content/interviews

Prepared for future approved Beyond the Podium interview content.

### content/pages

Editable long form page content, including the About page.

### content/templates

Copy and paste starter files for stories, rankings, athlete profiles, and interviews.

## public

Files copied directly into the finished website.

### public/images/branding

Dark and light Podium Watch logos, the supplied original logo files, favicon files, and the mobile home screen icon.

### public/images/stories

Story featured images and story fallback artwork.

### public/images/athletes

Future approved athlete images.

### public/images/interviews

Future approved interview artwork and images.

### public/images/rankings

Future ranking graphics and supporting images.

### public/images/sponsors

Approved sponsor logos.

### public/images/social

Default social sharing image.

### public/scripts/site.js

Small browser script for mobile navigation, story search, category filtering, copied links, image fallbacks, and the footer year.

## src

Reusable website configuration, content processing, markup, and styling.

### src/config/site.mjs

The main sitewide settings file. Edit the website address, social links, contact email, navigation, footer, logos, and default sharing image here.

### src/data/sponsors.json

Central sponsor data file. It begins empty so the website does not display fake sponsors.

### src/lib/content.mjs

File reading, front matter parsing, validation, CSV parsing, date formatting, escaping, and reading time utilities.

### src/lib/markdown.mjs

Converts approved Markdown into styled article HTML.

### src/lib/html.mjs

Reusable page layout, header, footer, metadata, structured data, story cards, ranking cards, breadcrumbs, and empty states.

### src/styles/main.css

The complete mobile first design system and responsive layout.

## scripts

Project commands run through npm.

### scripts/build.mjs

Loads content, validates it, generates every page, copies public assets, creates the sitemap, robots file, RSS feed, and site data.

### scripts/check.mjs

Checks generated pages, metadata, headings, placeholder links, internal destinations, local images, alternative text, sitemap, robots file, RSS feed, and the custom error page.

### scripts/serve.mjs

Runs the local development or production preview server.

## dist

The generated website output. Vercel publishes this folder.

Do not manually edit files inside `dist`. Edit source or content files, then run:

```bash
npm run build
```
