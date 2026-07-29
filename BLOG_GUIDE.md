# Podium Watch Blog Guide

## One time setup

Open this complete folder in VS Code.

Run:

```text
npm run build
```

To preview the site on your computer, run:

```text
npm run preview
```

Then open:

```text
http://localhost:3000
```

## Add a new story each week

1. Open `content/blog`.
2. Copy `_template.md`.
3. Rename the copy using the date and title, such as `2026-08-05-d4-boys-team-rankings.md`.
4. Fill in the information at the top of the file.
5. Write the story below the second `---` line.
6. Put story images inside `content/blog/images`.
7. Run `npm run build` to test it.
8. Push the update to GitHub or deploy it to Vercel.

The build script scans every Markdown file in `content/blog`, sorts the stories by the `date` field, puts the newest story first, creates the story cards, and builds a separate page for every story.

Files beginning with `_` are ignored, so `_template.md` will never appear on the website.

## Required information at the top of every story

```text
---
title: "Your Story Title"
date: 2026-08-05
description: "A short card description."
category: "Rankings"
author: "Podium Watch"
image: "images/photo.jpg"
---
```

Only `title`, `date`, and `description` are required. The image line can be removed when the story does not have a photo.

## Vercel

The included `vercel.json` tells Vercel to run `npm run build` and publish the `dist` folder. Once the GitHub repository is connected, pushing a new story will rebuild and publish the site automatically.
