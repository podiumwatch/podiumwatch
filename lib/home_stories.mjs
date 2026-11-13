import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, parseFrontMatter, readingTime, slugify } from "../src/lib/content.mjs";
import { storyImageFocus } from "./story_image_focus.mjs";

// The stories the homepage lists, read straight from content/stories/ on
// the server (api/pages/home.js; vercel.json includes the files). Same
// rules as scripts/build.mjs: drafts are left out, as are
// "write-for-podium-watch" and stories that duplicate a ranking page
// (their URLs 301 to the ranking). Photo crop points come from
// src/data/image-focus.json, written by the build; a story's own
// featuredImagePosition wins. Newest first by date; same-date stories in a
// series keep their seriesOrder.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storiesDir = path.join(root, "content", "stories");
const rankingsDir = path.join(root, "content", "rankings");

const listMd = (dir, ext) => {
  try { return fs.readdirSync(dir).filter((name) => name.endsWith(ext)).sort().map((name) => path.join(dir, name)); } catch { return []; }
};

// Story slugs that are really ranking pages (scripts/build.mjs, loadRankings).
function rankingSlugs() {
  const slugs = new Set();
  for (const file of listMd(rankingsDir, ".csv")) {
    const rows = parseCsv(fs.readFileSync(file, "utf8"), path.relative(root, file));
    if (!rows.length) continue;
    rows.sort((a, b) => Number(a.rank) - Number(b.rank));
    if (rows[0].slug) slugs.add(slugify(rows[0].slug));
  }
  return slugs;
}

export function readHomeStories() {
  const skip = rankingSlugs();
  const stories = [];
  for (const file of listMd(storiesDir, ".md")) {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, "utf8"), path.relative(root, file));
    if (data.draft === true) continue;
    const slug = slugify(data.slug || path.basename(file, ".md"));
    if (slug === "write-for-podium-watch" || skip.has(slug)) continue;
    const story = {
      ...data,
      slug,
      tags: Array.isArray(data.tags) ? data.tags : [],
      readingMinutes: Number.isFinite(Number(data.readTime)) ? Number(data.readTime) : readingTime(body),
      seriesOrder: Number.isFinite(Number(data.seriesOrder)) ? Number(data.seriesOrder) : null
    };
    const image = story.featuredImage || story.heroImage;
    if (image && !story.featuredImagePosition && story.featuredImageFit !== "contain") {
      const focus = storyImageFocus(image);
      if (focus.position) story.featuredImagePosition = focus.position;
      if (focus.fit === "contain") story.featuredImageFit = "contain";
    }
    stories.push(story);
  }
  return stories.sort((a, b) => {
    const dateDiff = new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`);
    if (dateDiff !== 0) return dateDiff;
    if (a.seriesOrder !== null && b.seriesOrder !== null) return a.seriesOrder - b.seriesOrder;
    return 0;
  });
}

// Read once per server instance: the files only change with a deploy.
let cached = null;
export function homeStories() {
  if (!cached) cached = readHomeStories();
  return cached;
}
