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
  let index = 0;

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
      output.push(`<h${level} id="${slugify(text)}">${inlineMarkdown(text)}</h${level}>`);
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

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      output.push(`<div class="table-scroll" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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
