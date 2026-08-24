import { escapeHtml, slugify } from "./content.mjs";

function inlineMarkdown(input) {
  let text = escapeHtml(input);
  const codeTokens = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const token = `%%CODE${codeTokens.length}%%`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });
  text = text
    .replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) => {
      const caption = title ? `<figcaption>${title}</figcaption>` : "";
      return `<figure><img src="${src}" alt="${alt}" loading="lazy" decoding="async">${caption}</figure>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const external = /^https?:\/\//.test(href);
      return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  codeTokens.forEach((value, index) => { text = text.replace(`%%CODE${index}%%`, value); });
  return text;
}

function isTableSeparator(line) {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

export function renderMarkdown(markdown = "") {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  const headingIds = new Map();
  let index = 0;

  function uniqueHeadingId(text) {
    const base = slugify(text) || "section";
    const count = headingIds.get(base) || 0;
    headingIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  }

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      output.push(`<h${level} id="${uniqueHeadingId(text)}">${inlineMarkdown(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\[youtube:[A-Za-z0-9_-]+\]$/.test(line.trim())) {
      const videoId = line.trim().slice(9, -1);
      output.push(`<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video" loading="lazy" allowfullscreen></iframe></div>`);
      index += 1;
      continue;
    }

    // Podium Watch interactive-article component marker, e.g.
    // "[[PODIUM_WATCH_COMPONENT: RACE_BOARD]]" -- lifted verbatim from the
    // supplied article copy rather than translated into raw HTML in the
    // source Markdown (this parser has no raw-HTML passthrough at all, by
    // design -- every other block form here is a purpose-built case just
    // like this one). Emits an empty, typed placeholder div that
    // public/scripts/preseason-article.js hydrates client-side from the
    // embedded classification JSON; a reader with JavaScript disabled sees
    // nothing here but still has the full supplied data table immediately
    // below it in the article text, since every component placement in
    // these articles sits directly above its own fallback table. The fixed
    // id per component type (rather than relying on an auto-generated
    // heading id, which would break if a future article's heading wording
    // ever drifted) is what the sticky article nav in storyPage() links to.
    const componentMarker = line.trim().match(/^\[\[PODIUM_WATCH_COMPONENT:\s*([A-Z_]+)\]\]$/);
    if (componentMarker) {
      const anchorIds = {
        RACE_BOARD: "race-board",
        SCORE_PROGRESSION: "race-build",
        FIFTH_RUNNER_FACTOR: "fifth-runner",
        DISPLACEMENT_REPORT: "depth",
        READER_PREDICTIONS: "reader-picks"
      };
      const type = componentMarker[1];
      const anchorId = anchorIds[type] || slugify(type);
      output.push(`<div class="pw-component" id="${anchorId}" data-pw-component="${escapeHtml(type)}"></div>`);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      // data-label carries the plain-text column header onto every cell so
      // the mobile layout (main.css, table-scroll stacks to cards below
      // 700px) can show "Column: value" per row without JS -- the table
      // stays a real <table> (still fully readable/scrollable above that
      // breakpoint) rather than needing a second markup shape.
      output.push(`<div class="table-scroll" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header, cellIndex) => `<td data-label="${escapeHtml(header)}">${inlineMarkdown(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item)}</p>`).join("")}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items = [];
      const pattern = orderedList ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      while (index < lines.length) {
        const match = lines[index].match(pattern);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const tag = orderedList ? "ol" : "ul";
      output.push(`<${tag}>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const standaloneImage = line.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)$/);
    if (standaloneImage) {
      const [, alt, src, caption] = standaloneImage;
      output.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`);
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index];
      if (/^(#{1,6})\s+/.test(next) || /^\s*[-+*]\s+/.test(next) || /^\s*\d+\.\s+/.test(next) || /^>\s?/.test(next) || next.trim().startsWith("```") || /^\[youtube:/.test(next.trim())) break;
      if (index + 1 < lines.length && next.includes("|") && isTableSeparator(lines[index + 1])) break;
      paragraph.push(next.trim());
      index += 1;
    }
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return output.join("\n");
}
