// Converts a Writer Portal article's Tiptap JSON body into this
// project's own Markdown dialect (src/lib/markdown.mjs's renderMarkdown()
// -- NOT standard CommonMark; see that file for the exact grammar this
// targets), so a published article can be committed as a real Story
// file and round-trip correctly through the site's own build.
//
// A sibling to public/scripts/writer-portal-render.js (the existing
// Tiptap-JSON-to-HTML renderer used by the review/public article
// pages) -- same node/mark coverage (paragraph, text with bold/italic/
// strike/code/link marks, heading h2-h4, bulletList, orderedList,
// listItem, blockquote, codeBlock, image, hardBreak, horizontalRule),
// because that's the exact set the editor (StarterKit + Image + Link)
// can actually produce -- not a general ProseMirror-to-Markdown
// converter.

// renderMarkdown()'s own regexes have no backslash-escape support at
// all (confirmed directly by reading them, and confirmed live: a
// backslash inserted before a special character shows up as a literal
// backslash in the final output instead of suppressing the syntax --
// caught this against a real writer's actual article, which used a
// literal "*" as a footnote marker). Since there is no real escape
// mechanism to lean on, a literal "*"/"_"/"~"/"`"/"["/"]" typed as
// plain text is swapped for a full-width Unicode lookalike instead
// (e.g. U+FF0A "＊" for "*") -- visually near-identical, but not the
// literal ASCII character renderMarkdown()'s regexes match on, so it
// can never be misread as formatting syntax. Applied only to plain
// text content, never inside a URL.
const MARKDOWN_SPECIAL_LOOKALIKES = {
  "*": "＊",
  "_": "＿",
  "~": "～",
  "`": "｀",
  "[": "［",
  "]": "］"
};

function escapeMarkdownText(value) {
  return String(value ?? "").replace(/[*_~`[\]]/g, (char) => MARKDOWN_SPECIAL_LOOKALIKES[char]);
}

// Deliberately not the "\$1" escape above -- renderMarkdown() has no
// escape handling, so a literal backslash would just show up in the
// output. The safest thing a URL can do is drop characters that would
// prematurely close the ]( ) syntax; genuine URLs from this editor
// (Supabase Storage links, or whatever a writer pasted into the Link
// toolbar button) never legitimately contain a raw space or paren.
function sanitizeUrl(value) {
  return String(value ?? "").replace(/[\s()]/g, "");
}

function renderMarks(text, marks = []) {
  const marksByType = new Map((marks || []).map((mark) => [mark.type, mark]));

  // Inline code is treated as exclusive of other formatting -- a real
  // ProseMirror doc can technically carry both, but this editor's own
  // toolbar never lets a writer combine them, and a code span is
  // conceptually literal content, not something that should also carry
  // bold/italic styling.
  if (marksByType.has("code")) {
    return "`" + String(text ?? "").replaceAll("`", "'") + "`";
  }

  let result = escapeMarkdownText(text);

  const hasBold = marksByType.has("bold");
  const hasItalic = marksByType.has("italic");

  if (marksByType.has("strike")) result = `~~${result}~~`;
  if (hasItalic) result = `*${result}*`;
  // renderMarkdown() processes **bold** before __bold__ before *italic*
  // (in that fixed order) -- when both bold and italic apply to the
  // same run, using ** here would nest inside the italic *...* wrapper
  // and both regexes use a same-character exclusion class ([^*]+),
  // which can't match through the other pair. __ has no such conflict
  // with the asterisk-based italic syntax, so it's the only nesting
  // order that survives that dialect's own regex order correctly.
  if (hasBold) result = hasItalic ? `__${result}__` : `**${result}**`;

  const link = marksByType.get("link");
  if (link?.attrs?.href) result = `[${result}](${sanitizeUrl(link.attrs.href)})`;

  return result;
}

function renderInline(nodes) {
  return (nodes || []).map((node) => {
    if (node.type === "text") return renderMarks(node.text, node.marks);
    if (node.type === "hardBreak") return " ";
    return "";
  }).join("");
}

function renderBlocks(nodes) {
  return (nodes || []).map(renderBlock).filter(Boolean).join("\n\n");
}

function renderBlock(node) {
  if (!node || typeof node !== "object") return "";

  switch (node.type) {
    case "paragraph":
      return renderInline(node.content);
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4);
      return `${"#".repeat(level)} ${renderInline(node.content)}`;
    }
    case "bulletList":
      return (node.content || [])
        .map((item) => `- ${renderInline(listItemInline(item))}`)
        .join("\n");
    case "orderedList":
      return (node.content || [])
        .map((item, index) => `${index + 1}. ${renderInline(listItemInline(item))}`)
        .join("\n");
    case "blockquote":
      return renderBlocks(node.content).split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
    case "codeBlock": {
      const code = (node.content || []).map((textNode) => textNode.text || "").join("\n");
      return "```\n" + code + "\n```";
    }
    case "image":
      return `![${escapeMarkdownText(node.attrs?.alt || "")}](${sanitizeUrl(node.attrs?.src || "")})`;
    case "horizontalRule":
      return "---";
    default:
      return node.content ? renderBlocks(node.content) : "";
  }
}

// A listItem's own content is itself a list of block nodes (almost
// always just one paragraph in practice, since this editor's toolbar
// has no way to put a second block inside a single list item) --
// flattened back into one inline run here since renderMarkdown()'s own
// list handling is a single-line-per-item regex with no multi-block
// item support.
function listItemInline(listItem) {
  const firstBlock = (listItem.content || [])[0];
  return firstBlock?.content || [];
}

export function articleBodyToMarkdown(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.content)) return "";
  return renderBlocks(body.content);
}
