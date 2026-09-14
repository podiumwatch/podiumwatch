// Team Board: a shared post-and-reply feed for the whole Writer Portal
// team (see install/58_WRITER_PORTAL_BOARD.sql). Built as the in-house
// alternative to a group chat -- the user considered GroupMe/Discord
// first, then asked to build this instead. Anyone signed in (writer or
// staff) can post or reply; only a post/reply's own author or staff can
// delete it -- enforced here, in application code, the same pattern
// every other Writer Portal table already uses through the service-role
// client.
import { supabaseAdmin } from "./supabase-admin.mjs";
import { cleanAthleteText } from "./athlete_foundation_service.mjs";
import { sendResendEmail, escapeHtml } from "./engagement_service.mjs";
import { isStaffRole } from "./writer_portal_service.mjs";

const MAX_BODY_LENGTH = 4000;
const STAFF_NOTIFICATION_EMAIL = "podiumwatchohio@gmail.com";
const BOARD_URL = "https://podiumwatch.site/writer-portal/board/";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function cleanBody(value) {
  return cleanAthleteText(value, MAX_BODY_LENGTH);
}

async function profileNames(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!uniqueIds.length) return map;

  const { data, error } = await supabaseAdmin.from("portal_profiles").select("id, full_name").in("id", uniqueIds);
  if (error) throw error;
  for (const row of data || []) map.set(row.id, row.full_name || "A writer");
  return map;
}

export async function listBoardPosts() {
  const { data: posts, error: postError } = await supabaseAdmin
    .from("portal_board_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (postError) throw postError;

  const { data: replies, error: replyError } = await supabaseAdmin
    .from("portal_board_replies")
    .select("*")
    .order("created_at", { ascending: true });
  if (replyError) throw replyError;

  const names = await profileNames([
    ...(posts || []).map((p) => p.author_id),
    ...(replies || []).map((r) => r.author_id)
  ]);

  const repliesByPost = new Map();
  for (const reply of replies || []) {
    if (!repliesByPost.has(reply.post_id)) repliesByPost.set(reply.post_id, []);
    repliesByPost.get(reply.post_id).push({ ...reply, author_name: names.get(reply.author_id) || "A writer" });
  }

  return (posts || []).map((post) => ({
    ...post,
    author_name: names.get(post.author_id) || "A writer",
    replies: repliesByPost.get(post.id) || []
  }));
}

function buildBoardNotificationEmail({ authorName, kind, body, postAuthorName }) {
  const safeBody = escapeHtml(body).replaceAll("\n", "<br>");
  const intro = kind === "post"
    ? `${escapeHtml(authorName)} posted on the Team Board:`
    : `${escapeHtml(authorName)} replied to ${escapeHtml(postAuthorName)}'s post on the Team Board:`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;">
<tr><td style="background:#090909;padding:22px 28px;text-align:center;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:.12em;color:#ffffff;">PODIUM <span style="color:#0faf68;">WATCH</span></div>
</td></tr>
<tr><td style="height:4px;background:#0faf68;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#171717;">${intro}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#171717;padding:14px 16px;background:#f6f4ee;border-left:3px solid #0faf68;">${safeBody}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0faf68;">
<a href="${BOARD_URL}" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Open the Team Board &rarr;</a>
</td></tr></table>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${kind === "post" ? `${authorName} posted on the Team Board:` : `${authorName} replied to ${postAuthorName}'s post on the Team Board:`}\n\n${body}\n\nOpen the Team Board: ${BOARD_URL}`;

  return { html, text };
}

// Best-effort, matching every other Writer Portal notification in this
// codebase -- a delivery hiccup here must never fail or roll back the
// actual post/reply, which is already safely saved by the time this
// runs. Only fires for a WRITER's own activity -- staff (who already
// use the board directly) don't need to be emailed about their own
// posts, or another staff member's.
async function notifyStaffOfBoardActivity({ authorId, authorName, authorRole, kind, body, postAuthorName }) {
  if (isStaffRole(authorRole)) return;
  try {
    const { html, text } = buildBoardNotificationEmail({ authorName, kind, body, postAuthorName });
    await sendResendEmail({
      to: STAFF_NOTIFICATION_EMAIL,
      subject: kind === "post" ? `Team Board: new post from ${authorName}` : `Team Board: new reply from ${authorName}`,
      html,
      text
    });
  } catch (error) {
    console.error("Team Board notification email failed:", error);
  }
}

export async function createBoardPost({ authorId, authorRole, body }) {
  const cleanedBody = cleanBody(body);
  if (!cleanedBody) fail("Write something before posting.");

  const { data, error } = await supabaseAdmin
    .from("portal_board_posts")
    .insert({ author_id: authorId, body: cleanedBody })
    .select("*")
    .single();
  if (error) throw error;

  const names = await profileNames([authorId]);
  await notifyStaffOfBoardActivity({ authorId, authorName: names.get(authorId) || "A writer", authorRole, kind: "post", body: cleanedBody });

  return { ...data, author_name: names.get(authorId) || "A writer", replies: [] };
}

export async function createBoardReply({ postId, authorId, authorRole, body }) {
  const cleanedPostId = cleanAthleteText(postId, 100);
  if (!cleanedPostId) fail("Choose a post to reply to.");
  const cleanedBody = cleanBody(body);
  if (!cleanedBody) fail("Write something before replying.");

  const { data: post, error: postError } = await supabaseAdmin
    .from("portal_board_posts")
    .select("id, author_id")
    .eq("id", cleanedPostId)
    .maybeSingle();
  if (postError) throw postError;
  if (!post) fail("That post could not be found.", 404);

  const { data, error } = await supabaseAdmin
    .from("portal_board_replies")
    .insert({ post_id: cleanedPostId, author_id: authorId, body: cleanedBody })
    .select("*")
    .single();
  if (error) throw error;

  const names = await profileNames([authorId, post.author_id]);
  await notifyStaffOfBoardActivity({
    authorId,
    authorName: names.get(authorId) || "A writer",
    authorRole,
    kind: "reply",
    body: cleanedBody,
    postAuthorName: names.get(post.author_id) || "their"
  });

  return { ...data, author_name: names.get(authorId) || "A writer" };
}

function requireOwnerOrStaff({ authorId, actorId, actorIsStaff }) {
  if (actorIsStaff) return;
  if (authorId !== actorId) fail("You can only remove your own post or reply.", 403);
}

export async function deleteBoardPost({ postId, actorId, actorIsStaff }) {
  const cleanedId = cleanAthleteText(postId, 100);
  if (!cleanedId) fail("Choose a post.");

  const { data: post, error: fetchError } = await supabaseAdmin
    .from("portal_board_posts")
    .select("id, author_id")
    .eq("id", cleanedId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!post) fail("That post could not be found.", 404);

  requireOwnerOrStaff({ authorId: post.author_id, actorId, actorIsStaff });

  const { error } = await supabaseAdmin.from("portal_board_posts").delete().eq("id", cleanedId);
  if (error) throw error;
}

export async function deleteBoardReply({ replyId, actorId, actorIsStaff }) {
  const cleanedId = cleanAthleteText(replyId, 100);
  if (!cleanedId) fail("Choose a reply.");

  const { data: reply, error: fetchError } = await supabaseAdmin
    .from("portal_board_replies")
    .select("id, author_id")
    .eq("id", cleanedId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!reply) fail("That reply could not be found.", 404);

  requireOwnerOrStaff({ authorId: reply.author_id, actorId, actorIsStaff });

  const { error } = await supabaseAdmin.from("portal_board_replies").delete().eq("id", cleanedId);
  if (error) throw error;
}
