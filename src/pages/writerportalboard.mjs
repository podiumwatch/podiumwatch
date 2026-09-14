import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .board-shell { display:grid; gap:24px; }
    .board-composer { display:grid; gap:10px; }
    .board-composer textarea { padding:12px 14px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; min-height:90px; resize:vertical; }
    .board-composer-row { display:flex; justify-content:flex-end; }
    .board-post { border:1px solid rgba(var(--black-rgb),.12); border-radius:10px; padding:18px 20px; background:var(--white); }
    .board-post-head { display:flex; justify-content:space-between; align-items:baseline; gap:10px; flex-wrap:wrap; }
    .board-post-author { font-weight:900; }
    .board-post-time { color:var(--muted); font-size:.82rem; }
    .board-post-body { margin-top:10px; white-space:pre-wrap; line-height:1.6; }
    .board-post-actions { margin-top:10px; display:flex; gap:14px; }
    .board-post-actions button { background:none; border:0; padding:0; color:var(--muted); font-weight:700; font-size:.82rem; cursor:pointer; }
    .board-post-actions button:hover { color:var(--danger); }
    .board-replies { margin-top:14px; padding-left:18px; border-left:2px solid rgba(var(--black-rgb),.1); display:grid; gap:12px; }
    .board-reply-author { font-weight:800; font-size:.92rem; }
    .board-reply-time { color:var(--muted); font-size:.78rem; margin-left:8px; }
    .board-reply-body { margin-top:4px; white-space:pre-wrap; line-height:1.55; font-size:.94rem; }
    .board-reply-form { margin-top:14px; display:flex; gap:8px; }
    .board-reply-form textarea { flex:1; padding:8px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:7px; font:inherit; min-height:44px; resize:vertical; }
    .board-empty { color:var(--muted); font-weight:700; padding:20px; text-align:center; }
    .board-message { padding:10px 14px; border-radius:9px; font-weight:700; }
    .board-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
`;

// Team Board: a shared post-and-reply feed for the whole Writer Portal
// team (writers and staff alike), built as the in-house alternative to a
// group chat. Normal site chrome (layout(), not adminShell()) -- every
// signed-in writer uses this, same as the Editorial Calendar.
export function writerPortalBoardPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Team Board.",
    description: "Post updates, ask questions, and reply to your teammates -- everyone on the Writer Portal sees this."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container board-shell" data-board-loading>
      <div class="info-card"><h2>Loading the Team Board</h2><p>Please wait.</p></div>
    </div>

    <div class="container board-shell" data-board-root hidden>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
      </div>

      <section class="info-card">
        <p class="eyebrow">New post</p>
        <form class="board-composer" data-board-post-form>
          <textarea name="body" placeholder="Share an update, ask a question..." maxlength="4000" required></textarea>
          <div class="board-composer-row">
            <button class="button button-primary" type="submit">Post</button>
          </div>
        </form>
        <p class="board-message" data-board-post-message role="status" hidden></p>
      </section>

      <div data-board-posts></div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-board.js" defer></script>`;

  return layout({
    site,
    title: "Team Board",
    description: "Podium Watch Writer Portal Team Board.",
    pathname: "/writer-portal/board/",
    content
  });
}
