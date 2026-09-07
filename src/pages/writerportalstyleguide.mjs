import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-guide-shell { display:grid; gap:20px; max-width: 760px; margin: 0 auto; }
    .writer-guide-top { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; }
    .writer-guide-content { line-height: 1.65; }
    .writer-guide-content h2, .writer-guide-content h3 { margin-top: 22px; }
    .writer-guide-content ul { padding-left: 22px; }
    .writer-guide-content blockquote { border-left: 4px solid var(--green); margin: 12px 0; padding: 4px 0 4px 16px; background: rgba(var(--green-rgb),.06); }
    .writer-editor-toolbar { display:flex; flex-wrap:wrap; gap:4px; padding:8px; border:1px solid rgba(var(--black-rgb),.22); border-bottom:0; border-radius:9px 9px 0 0; background:#f7f7f5; }
    .writer-editor-toolbar button { min-width:36px; padding:7px 10px; border:1px solid transparent; border-radius:6px; background:transparent; font:inherit; font-weight:800; cursor:pointer; }
    .writer-editor-toolbar button:hover { background:rgba(var(--black-rgb),.06); }
    .writer-editor-toolbar button[data-active="true"] { background: var(--green); border-color: var(--green); color: var(--black); }
    .writer-editor-body { min-height: 360px; padding: 16px; border: 1px solid rgba(var(--black-rgb),.22); border-radius: 0 0 9px 9px; background: var(--white); }
    .writer-editor-body .ProseMirror { outline: none; min-height: 340px; line-height: 1.6; }
    .writer-guide-message { padding:10px 14px; border-radius:9px; font-weight:700; }
    .writer-guide-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .writer-guide-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
`;

export function writerPortalStyleGuidePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Style guide.",
    description: "How Podium Watch pieces actually sound, and the standards every piece has to meet before it can be approved."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-guide-shell" data-writer-guide-loading>
      <div class="info-card"><h2>Loading</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-guide-shell" data-writer-guide-root hidden>
      <div class="writer-guide-top">
        <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
        <button class="button button-outline" type="button" data-writer-guide-edit hidden>Edit style guide</button>
      </div>

      <section class="info-card writer-guide-content" data-writer-guide-content></section>

      <section class="info-card" data-writer-guide-editor hidden>
        <div class="writer-editor-toolbar" data-writer-toolbar>
          <button type="button" data-command="bold" title="Bold"><b>B</b></button>
          <button type="button" data-command="italic" title="Italic"><i>I</i></button>
          <button type="button" data-command="heading-2" title="Heading">H2</button>
          <button type="button" data-command="heading-3" title="Subheading">H3</button>
          <button type="button" data-command="bulletList" title="Bulleted list">&bull; List</button>
          <button type="button" data-command="orderedList" title="Numbered list">1. List</button>
          <button type="button" data-command="blockquote" title="Quote">&ldquo;&rdquo;</button>
          <button type="button" data-command="undo" title="Undo">&#8630;</button>
          <button type="button" data-command="redo" title="Redo">&#8631;</button>
        </div>
        <div class="writer-editor-body" data-writer-guide-tiptap></div>

        <p class="writer-guide-message" data-writer-guide-message role="status" hidden></p>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="button button-primary" type="button" data-writer-guide-save>Save</button>
          <button class="button button-outline" type="button" data-writer-guide-cancel>Cancel</button>
        </div>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-render.js" defer></script>
  <script type="module" src="/scripts/writer-portal-style-guide.js"></script>`;

  return layout({
    site,
    title: "Style Guide",
    description: "Podium Watch Writer Portal style guide.",
    pathname: "/writer-portal/style-guide/",
    content
  });
}
