import { layout, pageHero } from "../lib/html.mjs";

const CATEGORIES = [
  ["", "Choose a category"],
  ["race_recap", "Race Recap"],
  ["meet_preview", "Meet Preview"],
  ["feature", "Feature"],
  ["rankings_polls", "Rankings & Polls"],
  ["recruiting", "Recruiting"],
  ["other", "Other"]
];

const styles = `
    .writer-write-shell { display:grid; gap:20px; }
    .writer-write-top { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; }
    .writer-write-status { font-weight:800; color: var(--muted); }
    .writer-write-status[data-tone="error"] { color: #b91c1c; }
    .writer-write-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; margin-bottom: 16px; }
    .writer-write-fields label { display:grid; gap:7px; font-weight:850; }
    .writer-write-fields input, .writer-write-fields select { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .writer-write-wide { grid-column: 1 / -1; }
    .writer-write-title-input { font-size: 1.3rem; font-weight: 900; padding: 12px 14px !important; }
    .writer-editor-toolbar { display:flex; flex-wrap:wrap; gap:4px; padding:8px; border:1px solid rgba(var(--black-rgb),.22); border-bottom:0; border-radius:9px 9px 0 0; background:#f7f7f5; }
    .writer-editor-toolbar button { min-width:36px; padding:7px 10px; border:1px solid transparent; border-radius:6px; background:transparent; font:inherit; font-weight:800; cursor:pointer; }
    .writer-editor-toolbar button:hover { background:rgba(var(--black-rgb),.06); }
    .writer-editor-toolbar button[data-active="true"] { background: var(--green); border-color: var(--green); color: var(--black); }
    .writer-editor-body { min-height: 360px; padding: 16px; border: 1px solid rgba(var(--black-rgb),.22); border-radius: 0 0 9px 9px; background: var(--white); }
    .writer-editor-body .ProseMirror { outline: none; min-height: 340px; line-height: 1.6; }
    .writer-editor-body .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; color: rgba(var(--black-rgb),.35); pointer-events: none; }
    .writer-editor-body .ProseMirror img { max-width: 100%; border-radius: 8px; }
    .writer-editor-body .ProseMirror blockquote { border-left: 3px solid var(--green); margin: 0; padding-left: 14px; color: var(--muted); }
    .writer-write-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top: 18px; }
    .writer-write-wordcount { margin: 8px 0 0; font-size: .82rem; font-weight: 700; color: var(--muted); }
    .writer-write-notes { display:grid; gap:10px; padding:16px 18px; border-radius:10px; background:rgba(230,167,0,.14); border-left:4px solid #e6a700; }
    .writer-write-notes h3 { margin:0; font-size:.9rem; }
    .writer-write-note { padding:10px 12px; border-radius:8px; background:var(--white); }
    .writer-write-note-meta { font-size:.76rem; color:var(--muted); font-weight:800; margin-bottom:3px; }
`;

export function writerPortalWritePage(site) {
  const categoryOptions = CATEGORIES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Write.",
    description: "Autosaves as you go. Nothing is published until Podium Watch reviews and approves it."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-write-shell" data-writer-write-loading>
      <div class="info-card"><h2>Loading the editor</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-write-shell" data-writer-write-root hidden>
      <div class="writer-write-top">
        <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
        <span class="writer-write-status" data-writer-write-status role="status"></span>
      </div>

      <div class="writer-write-notes" data-writer-write-notes hidden></div>

      <section class="info-card">
        <div class="writer-write-fields">
          <label class="writer-write-wide">Headline<input class="writer-write-title-input" type="text" data-writer-field="title" maxlength="300" placeholder="Article headline"></label>
          <label class="writer-write-wide">Dek <span style="font-weight:500;color:var(--muted);">(one-sentence summary)</span><input type="text" data-writer-field="dek" maxlength="500" placeholder="What's this piece about?"></label>
          <label>Category<select data-writer-field="category">${categoryOptions}</select></label>
          <label>Tags <span style="font-weight:500;color:var(--muted);">(comma separated)</span><input type="text" data-writer-field="tags" placeholder="Division 2, Boys Cross Country"></label>
          <label class="writer-write-wide">Featured image
            <span style="display:flex;gap:8px;align-items:center;">
              <input type="url" data-writer-field="featured_image_url" placeholder="https://" style="flex:1;">
              <button class="button button-outline" type="button" data-writer-featured-upload style="flex-shrink:0;">Upload image</button>
            </span>
          </label>
          <label>Photo credit<input type="text" data-writer-field="photo_credit" maxlength="300"></label>
        </div>
        <input type="file" data-writer-image-file-input accept="image/jpeg,image/png,image/webp,image/gif" hidden>

        <div class="writer-editor-toolbar" data-writer-toolbar>
          <button type="button" data-command="bold" title="Bold"><b>B</b></button>
          <button type="button" data-command="italic" title="Italic"><i>I</i></button>
          <button type="button" data-command="heading-2" title="Heading">H2</button>
          <button type="button" data-command="heading-3" title="Subheading">H3</button>
          <button type="button" data-command="bulletList" title="Bulleted list">&bull; List</button>
          <button type="button" data-command="orderedList" title="Numbered list">1. List</button>
          <button type="button" data-command="blockquote" title="Quote">&ldquo;&rdquo;</button>
          <button type="button" data-command="link" title="Link">Link</button>
          <button type="button" data-command="image" title="Image">Image</button>
          <button type="button" data-command="undo" title="Undo">&#8630;</button>
          <button type="button" data-command="redo" title="Redo">&#8631;</button>
        </div>
        <div class="writer-editor-body" data-writer-editor></div>
        <p class="writer-write-wordcount" data-writer-wordcount></p>

        <div class="writer-write-actions">
          <button class="button button-primary" type="button" data-writer-submit>Submit for review</button>
          <button class="button button-outline" type="button" data-writer-delete>Delete draft</button>
        </div>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script type="module" src="/scripts/writer-portal-write.js"></script>`;

  return layout({
    site,
    title: "Write",
    description: "Podium Watch Writer Portal article editor.",
    pathname: "/writer-portal/write/",
    content
  });
}
