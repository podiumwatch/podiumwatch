# Podium Watch Website

This is the complete Podium Watch website project. It is a fast, mobile first static website built with Node.js, Markdown, CSV files, local images, reusable templates, and a custom zero dependency site generator.

The project works with Visual Studio Code, npm, GitHub, and Vercel. You do not need a database or a paid service to publish stories and rankings.

## What is included

1. A complete mobile first homepage
2. A stories page with search and category filtering
3. Automatic story pages created from Markdown files
4. Cross country and track ranking navigation
5. CSV powered ranking pages
6. Athlete spotlight and interview sections prepared for future content
7. About, sponsors, contact, and custom error pages
8. A mobile navigation menu with keyboard support
9. Open Graph metadata, structured data, a sitemap, robots rules, and an RSS feed
10. Beginner documentation for publishing and deployment

## Software you need

Install these programs before beginning:

1. Visual Studio Code
2. Node.js version 20 or newer
3. Git
4. A GitHub account
5. A Vercel account connected to GitHub

To check Node.js, open Command Prompt or the Visual Studio Code terminal and type:

```bash
node -v
npm -v
```

The Node version should begin with 20 or a larger number.

## Open the project in Visual Studio Code

1. Extract the ZIP file.
2. Open Visual Studio Code.
3. Choose File, then Open Folder.
4. Select the extracted `podium_watch_website_final` folder.
5. Confirm that `package.json`, `content`, `public`, `scripts`, and `src` are visible in the left sidebar.

## Open the terminal

In Visual Studio Code:

1. Choose Terminal from the top menu.
2. Choose New Terminal.
3. Confirm the terminal path ends with the project folder name.

All commands in this guide should be typed in that terminal while the project folder is open.

## Install the project

Run:

```bash
npm install
```

This project has no third party runtime dependencies. The command still creates the local npm project information and confirms that npm is working correctly.

## Start the website locally

Run:

```bash
npm run dev
```

Open this address in your browser:

```text
http://localhost:4173
```

The local server rebuilds the website when a project file changes.

## Stop the local server

Click the terminal and press:

```text
Ctrl and C
```

## Run a production build

Run:

```bash
npm run build
```

The finished website is created inside the `dist` folder.

## Check the finished website

Run:

```bash
npm run check
```

This checks the generated pages, metadata, links, local images, sitemap, RSS feed, robots file, and custom error page.

For the full local production preview, run:

```bash
npm run preview
```

Then open:

```text
http://localhost:4173
```

## Add a new Markdown story

1. Open `content/templates/story_template.md`.
2. Copy the entire file.
3. Create a new file inside `content/stories`.
4. Name it with the date first, followed by a clear title.

Example:

```text
20260815_d4_boys_season_preview.md
```

5. Paste the template into the new file.
6. Replace the example front matter with the story information.
7. Write the article below the second `---` line.
8. Change `draft: true` to `draft: false` when the story is ready.
9. Save the file.
10. Run `npm run build` or keep `npm run dev` running.

The website will automatically create the story page and story card. You do not edit HTML, JavaScript, or TypeScript to publish a story.

## Where to place a story image

Place story images inside:

```text
public/images/stories
```

Use a simple file name with lowercase letters and underscores.

Example:

```text
public/images/stories/d4_boys_preview.jpg
```

Then use this path in the story front matter:

```yaml
featuredImage: "/images/stories/d4_boys_preview.jpg"
featuredImageAlt: "Runners competing during an Ohio high school cross country race"
```

Recommended story image size:

```text
1600 by 900 pixels
```

Compress large photos before adding them. A file smaller than 500 KB is a useful target for most web images.

## Story front matter

Every story requires these fields:

```yaml
---
title: "Story title"
date: "2026-08-15"
description: "A short description for cards and search results."
category: "Cross Country"
author: "Podium Watch"
---
```

Optional fields include:

```yaml
featuredImage: "/images/stories/example.jpg"
featuredImageAlt: "Clear description of the image"
tags:
  - "Division 4"
  - "Boys Cross Country"
featured: false
draft: false
sponsor: "sponsor_id"
updatedDate: "2026-08-16"
canonicalUrl: "https://example.com/original-story"
```

A missing required field causes the build to stop with a message naming the file and missing field.

## How stories are sorted

Published stories are sorted by the `date` field. The newest date appears first.

Draft stories are hidden from:

1. The homepage
2. The stories page
3. Category pages
4. The sitemap
5. The RSS feed

## Mark a story as featured

Use:

```yaml
featured: true
```

The homepage and stories page use the newest story marked as featured. When no story is marked as featured, the newest published story is used automatically.

Only one current story should normally use `featured: true`.

## Save a story as a draft

Use:

```yaml
draft: true
```

The Markdown file stays in the project, but it will not appear on the public website.

## Update a story

1. Open the story file in `content/stories`.
2. Edit the article.
3. Add or update this optional field:

```yaml
updatedDate: "2026-08-16"
```

4. Save the file.
5. Rebuild and deploy the website.

## Delete a story

Delete its Markdown file from `content/stories`, then rebuild the site.

The generated page disappears from the next deployment.

## Update rankings

Ranking data is stored in:

```text
content/rankings
```

Use this template:

```text
content/templates/ranking_template.csv
```

The required CSV columns are documented in `content/rankings/README.md` and `CONTENT_GUIDE.md`.

### Export a Google Sheet as CSV

1. Open the ranking in Google Sheets.
2. Make sure the first row uses the required column names.
3. Choose File.
4. Choose Download.
5. Choose Comma Separated Values.
6. Move the downloaded CSV file into `content/rankings`.
7. Give it a clear lowercase file name.
8. Run `npm run build`.
9. Run `npm run check`.

To replace an existing ranking, keep the same CSV file name and replace its contents.

## Replace the logos

Branding images are stored in:

```text
public/images/branding
```

The main files are:

```text
podium_watch_logo_dark.png
podium_watch_logo_light.png
favicon.png
favicon.ico
apple_touch_icon.png
pw_black_on_white_original.png
pw_white_on_black_original.png
```

The dark logo is used on light backgrounds. The light logo is used on dark backgrounds. Keep the same file names when replacing them so the website updates without code changes.

## Edit navigation, social links, email, and website address

Open:

```text
src/config/site.mjs
```

This is the main site settings file. It contains:

1. Site name
2. Site description
3. Website address
4. Instagram address
5. YouTube address
6. Contact email
7. Logo paths
8. Navigation links
9. Footer links
10. Default social sharing image

Replace the values inside quotation marks, save the file, and rebuild the website.

Before launch, confirm these settings:

1. `siteUrl`
2. `youtubeUrl`
3. `contactEmail`

## Add a sponsor

Open:

```text
src/data/sponsors.json
```

The file begins as an empty list:

```json
[]
```

Add a sponsor using this structure:

```json
[
  {
    "id": "example_sponsor",
    "name": "Sponsor Name",
    "url": "https://example.com",
    "logo": "/images/sponsors/example_sponsor.png",
    "description": "A short approved sponsor description.",
    "placement": "homepage"
  }
]
```

Place approved sponsor logos inside:

```text
public/images/sponsors
```

Do not add a sponsor until the relationship and logo use are approved.

A story can reference a sponsor by adding this field to its front matter:

```yaml
sponsor: "example_sponsor"
```

## Update homepage text

Most homepage structure and text is in:

```text
scripts/build.mjs
```

Sitewide details should be changed in `src/config/site.mjs` rather than repeated inside the build file.

The newest stories and published ranking cards update automatically from the content folders.

## Common errors

### Node is not recognized

Install the current Node.js LTS version, close Visual Studio Code, reopen it, and run:

```bash
node -v
```

### The terminal is in the wrong folder

Use the Visual Studio Code File menu and open the project folder again. The terminal path should end with `podium_watch_website_final`.

### A story build says a field is missing

Open the file named in the error. Compare its front matter with `content/templates/story_template.md`.

### A story image is missing

Confirm the image is inside `public/images/stories` and the path begins with `/images/stories/`.

### A ranking CSV fails validation

Compare the first row with `content/templates/ranking_template.csv`. Column names must match exactly.

### A page link is broken

Run:

```bash
npm run check
```

The report identifies the page and missing destination.

### Port 4173 is already in use

Stop the other local server with Ctrl and C, then run the command again.

## Create a GitHub repository

1. Sign in to GitHub.
2. Choose New repository.
3. Name it `podium_watch_website`.
4. Keep it private or public based on your preference.
5. Do not add a README because this project already includes one.
6. Create the repository.
7. Return to the Visual Studio Code terminal.

Run these commands one at a time:

```bash
git init
git add .
git commit -m "Create Podium Watch website"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_ADDRESS
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_ADDRESS` with the address GitHub shows for the new repository.

## Connect GitHub to Vercel

1. Sign in to Vercel using GitHub.
2. Choose Add New Project.
3. Select the Podium Watch repository.
4. Vercel should detect the settings from `vercel.json`.
5. Confirm the build command is:

```text
npm run build
```

6. Confirm the output directory is:

```text
dist
```

7. Choose Deploy.

No environment variables are required for the current version.

## Publish future updates

After changing a story, ranking, image, or setting, run:

```bash
npm run build
npm run check
git add .
git commit -m "Publish Podium Watch update"
git push
```

Vercel will automatically build and publish the new version after the push reaches GitHub.

## Connect a custom domain

1. Open the project in Vercel.
2. Open Settings.
3. Open Domains.
4. Add the domain you own.
5. Follow the DNS instructions shown by Vercel.
6. After the domain works, update `siteUrl` in `src/config/site.mjs`.
7. Rebuild and push the change.

The `siteUrl` setting controls canonical addresses, structured data, the sitemap, RSS links, and social sharing links.

## Environment variables

The current website does not require secrets or environment variables.

An `.env.example` file is included for future services. Never commit passwords, secret keys, or private tokens to GitHub.

## Important folders

See `PROJECT_STRUCTURE.md` for the complete project map and `CONTENT_GUIDE.md` for the detailed publishing system.
