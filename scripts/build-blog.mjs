import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "content", "blog");
const outputDir = path.join(root, "dist");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseFrontMatter(raw, fileName) {
  const normalized = raw.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${fileName} must begin with a front matter block.`);
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error(`${fileName} has an unclosed front matter block.`);
  const front = normalized.slice(4, end).split("\n");
  const body = normalized.slice(end + 5).trim();
  const data = {};
  for (const line of front) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  for (const required of ["title", "date", "description"]) {
    if (!data[required]) throw new Error(`${fileName} is missing ${required} in front matter.`);
  }
  return { data, body };
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => `<img src="${escapeHtml(normalizeMediaUrl(url))}" alt="${alt}">`);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => `<a href="${escapeHtml(url)}">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function normalizeMediaUrl(url) {
  const trimmed = String(url).trim();
  if (/^(https?:|data:|\/)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("images/")) return `/blog/${trimmed}`;
  return trimmed;
}

function markdownToHtml(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph(); closeList();
      if (!inCode) { inCode = true; codeLines = []; }
      else { html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`); inCode = false; }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); html.push("<hr>"); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); closeList(); html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`); continue; }
    const unordered = line.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`); continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`); continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph(); closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDateParts(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Date must use YYYY-MM-DD. Received: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateNumber(value) {
  const { year, month, day } = parseDateParts(value);
  return Date.UTC(year, month - 1, day);
}

function formatDate(value) {
  const { year, month, day } = parseDateParts(value);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function normalizeImage(value = "") {
  if (!value) return "";
  return normalizeMediaUrl(value);
}

function header(active = "") {
  return `<header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="/" aria-label="Podium Watch home"><img src="/assets/podium-watch-logo.png" alt="Podium Watch logo"><span>Podium Watch</span></a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><span class="sr-only">Open navigation</span></button>
      <nav id="site-nav" class="site-nav" aria-label="Main navigation">
        <a href="/#rankings">Rankings</a><a href="/#cross-country">Cross Country</a><a href="/#track">Track and Field</a><a href="/#spotlights">Athlete Spotlights</a><a href="/blog/"${active === "blog" ? ' aria-current="page"' : ""}>Stories</a><a href="/#about">About</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand"><img src="/assets/podium-watch-logo.png" alt="Podium Watch"><p>Ohio high school running, all in one place.</p></div>
      <div><strong>Coverage</strong><a href="/#rankings">Rankings</a><a href="/#cross-country">Cross country</a><a href="/#track">Track and field</a></div>
      <div><strong>Podium Watch</strong><a href="/blog/">Stories</a><a href="/#spotlights">Athlete spotlights</a><a href="/#about">About</a></div>
      <div><strong>Connect</strong><a href="#">Instagram</a><a href="#">YouTube</a><a href="mailto:hello@podiumwatch.com">Email</a></div>
    </div>
    <div class="container footer-bottom"><span>© <span id="year"></span> Podium Watch</span><span>Made for Ohio running.</span></div>
  </footer>`;
}

function pageDocument({ title, description, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)} | Podium Watch</title><link rel="stylesheet" href="/styles.css"></head>
<body>${header("blog")}${body}${footer()}<script src="/script.js"></script></body></html>`;
}

async function copyIfExists(source, destination) {
  try { await fs.cp(source, destination, { recursive: true }); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

async function build() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.copyFile(path.join(root, "index.html"), path.join(outputDir, "index.html"));
  await fs.copyFile(path.join(root, "styles.css"), path.join(outputDir, "styles.css"));
  await fs.copyFile(path.join(root, "script.js"), path.join(outputDir, "script.js"));
  await copyIfExists(path.join(root, "assets"), path.join(outputDir, "assets"));
  await fs.mkdir(path.join(outputDir, "blog"), { recursive: true });
  await copyIfExists(path.join(sourceDir, "images"), path.join(outputDir, "blog", "images"));

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

  const posts = [];
  for (const fileName of files) {
    const raw = await fs.readFile(path.join(sourceDir, fileName), "utf8");
    const { data, body } = parseFrontMatter(raw, fileName);
    const slug = slugify(data.slug || fileName.replace(/\.md$/i, ""));
    if (!slug) throw new Error(`Could not create a slug for ${fileName}.`);
    posts.push({
      title: data.title,
      date: data.date,
      description: data.description,
      category: data.category || "Podium Watch",
      author: data.author || "Podium Watch",
      image: normalizeImage(data.image),
      slug,
      html: markdownToHtml(body)
    });
  }

  posts.sort((a, b) => dateNumber(b.date) - dateNumber(a.date) || a.title.localeCompare(b.title));

  const cards = posts.length ? posts.map((post) => {
    const imageStyle = post.image ? ` style="background-image:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url('${escapeHtml(post.image)}')"` : "";
    return `<article class="blog-card">
      <a class="blog-card-image" href="/blog/${post.slug}/"${imageStyle}><span>${escapeHtml(post.category)}</span></a>
      <div class="blog-card-body">
        <div class="blog-card-meta"><span class="category">${escapeHtml(post.category)}</span><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></div>
        <h2><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.description)}</p>
        <a class="read-link" href="/blog/${post.slug}/">Read story →</a>
      </div>
    </article>`;
  }).join("\n") : `<div class="empty-blog"><h2>No stories yet</h2><p>Add a Markdown file to <code>content/blog</code>, run the build, and it will appear here.</p></div>`;

  const blogBody = `<main>
    <section class="blog-hero"><div class="container"><p class="eyebrow">Podium Watch stories</p><h1>Ohio running stories, all in one place.</h1><p>Rankings, athlete interviews, meet coverage, and the stories behind the performances.</p></div></section>
    <section class="blog-section"><div class="container"><div class="blog-toolbar"><div><p class="eyebrow">Latest stories</p><h2>From the newsroom</h2></div><div class="blog-count">${posts.length} ${posts.length === 1 ? "story" : "stories"}</div></div><div class="blog-grid">${cards}</div></div></section>
  </main>`;
  await fs.writeFile(path.join(outputDir, "blog", "index.html"), pageDocument({ title: "Latest Stories", description: "The latest Ohio high school running stories from Podium Watch.", body: blogBody }));

  for (const post of posts) {
    const postDir = path.join(outputDir, "blog", post.slug);
    await fs.mkdir(postDir, { recursive: true });
    const feature = post.image ? `<img class="post-feature-image" src="${escapeHtml(post.image)}" alt="">` : "";
    const postBody = `<main class="post-shell">
      <section class="post-hero"><div class="container post-hero-inner"><div class="post-meta"><span class="category">${escapeHtml(post.category)}</span><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time><span>By ${escapeHtml(post.author)}</span></div><h1>${escapeHtml(post.title)}</h1><p class="post-deck">${escapeHtml(post.description)}</p></div></section>
      ${feature}
      <section class="post-layout"><a class="post-back" href="/blog/">← All stories</a><article class="post-content">${post.html}</article><aside class="post-footer-card"><h3>Follow Podium Watch</h3><p>Ohio high school cross country and track and field rankings, stories, and meet coverage.</p><a class="button button-primary" href="/blog/">Read more stories</a></aside></section>
    </main>`;
    await fs.writeFile(path.join(postDir, "index.html"), pageDocument({ title: post.title, description: post.description, body: postBody }));
  }

  await fs.writeFile(path.join(outputDir, "blog", "posts.json"), JSON.stringify(posts.map(({ html, ...post }) => post), null, 2));
  console.log(`Built ${posts.length} blog post${posts.length === 1 ? "" : "s"} into dist.`);
}

build().catch((error) => { console.error(error.message); process.exit(1); });
