// Minimal, read-only Tiptap JSON -> HTML renderer, shared by the staff
// review detail page and the public article page. Covers exactly the
// node/mark types the editor (StarterKit + Image + Link) can actually
// produce -- not a general ProseMirror renderer.
(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function renderMarks(text, marks = []) {
    let html = escapeHtml(text);
    for (const mark of marks) {
      if (mark.type === "bold") html = `<strong>${html}</strong>`;
      else if (mark.type === "italic") html = `<em>${html}</em>`;
      else if (mark.type === "strike") html = `<s>${html}</s>`;
      else if (mark.type === "code") html = `<code>${html}</code>`;
      else if (mark.type === "link") html = `<a href="${escapeHtml(mark.attrs?.href || "#")}" target="_blank" rel="noopener">${html}</a>`;
    }
    return html;
  }

  function renderNode(node) {
    if (!node || typeof node !== "object") return "";
    const kids = () => (node.content || []).map(renderNode).join("");

    switch (node.type) {
      case "doc": return kids();
      case "paragraph": return `<p>${kids()}</p>`;
      case "text": return renderMarks(node.text || "", node.marks);
      case "heading": {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4);
        return `<h${level}>${kids()}</h${level}>`;
      }
      case "bulletList": return `<ul>${kids()}</ul>`;
      case "orderedList": return `<ol>${kids()}</ol>`;
      case "listItem": return `<li>${kids()}</li>`;
      case "blockquote": return `<blockquote>${kids()}</blockquote>`;
      case "codeBlock": return `<pre><code>${escapeHtml((node.content || []).map((n) => n.text || "").join(""))}</code></pre>`;
      case "image": return `<img src="${escapeHtml(node.attrs?.src || "")}" alt="${escapeHtml(node.attrs?.alt || "")}">`;
      case "hardBreak": return "<br>";
      case "horizontalRule": return "<hr>";
      default: return kids();
    }
  }

  window.PodiumWriterRender = {
    renderBody(body) {
      if (!body || typeof body !== "object") return "<p><em>No content.</em></p>";
      return renderNode(body) || "<p><em>No content.</em></p>";
    }
  };
})();
