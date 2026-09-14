(() => {
  const loadingBox = document.querySelector("[data-board-loading]");
  const root = document.querySelector("[data-board-root]");
  const postsBox = document.querySelector("[data-board-posts]");
  const postForm = document.querySelector("[data-board-post-form]");
  const postMessage = document.querySelector("[data-board-post-message]");

  if (!loadingBox || !root || !postsBox) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  // Same formula already used in writer-portal-admin.js/guardian-home.js.
  function formatRelativeTime(isoString) {
    if (!isoString) return "";
    const then = Date.parse(isoString);
    if (Number.isNaN(then)) return "";

    const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSeconds < 45) return "just now";
    if (diffSeconds < 90) return "1 minute ago";

    const minutes = Math.round(diffSeconds / 60);
    if (minutes < 60) return minutes + " minutes ago";

    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

    const days = Math.round(hours / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");

    return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  async function callApi(path, action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  const boardApi = (action, extra) => callApi("/api/portal/board/", action, extra);
  const meApi = (action, extra) => callApi("/api/portal/me/", action, extra);

  let viewerId = null;
  let isStaff = false;

  function canRemove(authorId) {
    return isStaff || authorId === viewerId;
  }

  function replyMarkup(reply) {
    return `<div class="board-reply" data-reply-id="${escapeHtml(reply.id)}">
      <div><span class="board-reply-author">${escapeHtml(reply.author_name)}</span><span class="board-reply-time">${escapeHtml(formatRelativeTime(reply.created_at))}</span></div>
      <div class="board-reply-body">${escapeHtml(reply.body)}</div>
      ${canRemove(reply.author_id) ? `<div class="board-post-actions"><button type="button" data-delete-reply="${escapeHtml(reply.id)}">Remove</button></div>` : ""}
    </div>`;
  }

  function postMarkup(post) {
    return `<article class="board-post" data-post-id="${escapeHtml(post.id)}">
      <div class="board-post-head">
        <span class="board-post-author">${escapeHtml(post.author_name)}</span>
        <span class="board-post-time">${escapeHtml(formatRelativeTime(post.created_at))}</span>
      </div>
      <div class="board-post-body">${escapeHtml(post.body)}</div>
      ${canRemove(post.author_id) ? `<div class="board-post-actions"><button type="button" data-delete-post="${escapeHtml(post.id)}">Remove</button></div>` : ""}
      <div class="board-replies" data-replies>${post.replies.map(replyMarkup).join("")}</div>
      <form class="board-reply-form" data-reply-form="${escapeHtml(post.id)}">
        <textarea name="body" placeholder="Reply..." maxlength="4000" required></textarea>
        <button class="button button-outline" type="submit">Reply</button>
      </form>
    </article>`;
  }

  async function loadPosts() {
    const { posts } = await boardApi("list");
    postsBox.innerHTML = posts.length
      ? posts.map(postMarkup).join("")
      : `<div class="board-empty">No posts yet -- be the first to share something.</div>`;
  }

  function showPostMessage(text) {
    postMessage.textContent = text;
    postMessage.dataset.tone = "error";
    postMessage.hidden = !text;
  }

  postsBox.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-reply-form]");
    if (!form) return;
    event.preventDefault();
    const postId = form.dataset.replyForm;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await boardApi("create_reply", { post_id: postId, body: form.elements.body.value });
      await loadPosts();
    } catch (error) {
      window.alert(error.message || "This reply could not be posted.");
    } finally {
      button.disabled = false;
    }
  });

  postsBox.addEventListener("click", async (event) => {
    const deletePost = event.target.closest("[data-delete-post]");
    const deleteReply = event.target.closest("[data-delete-reply]");
    if (deletePost) {
      if (!window.confirm("Remove this post? This also removes every reply on it. This can't be undone.")) return;
      try {
        await boardApi("delete_post", { post_id: deletePost.dataset.deletePost });
        await loadPosts();
      } catch (error) {
        window.alert(error.message || "This post could not be removed.");
      }
    } else if (deleteReply) {
      if (!window.confirm("Remove this reply? This can't be undone.")) return;
      try {
        await boardApi("delete_reply", { reply_id: deleteReply.dataset.deleteReply });
        await loadPosts();
      } catch (error) {
        window.alert(error.message || "This reply could not be removed.");
      }
    }
  });

  if (postForm) {
    postForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = postForm.querySelector('button[type="submit"]');
      button.disabled = true;
      showPostMessage("");
      try {
        await boardApi("create_post", { body: postForm.elements.body.value });
        postForm.reset();
        await loadPosts();
      } catch (error) {
        showPostMessage(error.message || "This post could not be sent.");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }
      viewerId = user.id;

      const { profile } = await meApi("get_profile");
      isStaff = ["editor", "admin"].includes(profile.role);

      await loadPosts();

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = `<div class="info-card"><h2>Team Board unavailable</h2><p>${escapeHtml(error.message || "This page could not be loaded.")}</p></div>`;
    }
  }

  load();
})();
