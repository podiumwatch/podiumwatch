(() => {
  const loadingBox = document.querySelector("[data-writer-portal-loading]");
  const root = document.querySelector("[data-writer-portal-root]");
  const welcome = document.querySelector("[data-writer-welcome]");
  const adminLinks = document.querySelectorAll("[data-writer-admin-link]");
  const signOutButton = document.querySelector("[data-writer-sign-out]");
  const attentionBanner = document.querySelector("[data-writer-attention-banner]");
  const attentionText = document.querySelector("[data-writer-attention-text]");
  const attentionLink = document.querySelector("[data-writer-attention-link]");

  if (!loadingBox || !root || !welcome) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  async function api(action, extra = {}) {
    const token = await window.PodiumWriterAuth.getAccessToken();
    if (!token) throw new Error("Sign in required.");

    const response = await fetch("/api/portal/me/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not be completed.");
    return data;
  }

  function renderArticles(grouped) {
    for (const [status, list] of Object.entries(grouped)) {
      const group = root.querySelector(`[data-writer-status-group="${status}"]`);
      if (!group) continue;
      const listBox = group.querySelector("[data-writer-status-list]");
      listBox.innerHTML = list.length
        ? list.map((article) => {
            const viewsLabel = status === "published"
              ? `${formatNumber(article.view_count)} view${article.view_count === 1 ? "" : "s"} · `
              : "";
            return `<a class="writer-article-row" href="/writer-portal/write/?id=${encodeURIComponent(article.id)}"><strong>${escapeHtml(article.title || "(untitled)")}</strong><span>${viewsLabel}${escapeHtml(formatDate(article.updated_at))}</span></a>`;
          }).join("")
        : `<div class="writer-empty">Nothing here yet.</div>`;
    }
  }

  async function load() {
    try {
      const user = await window.PodiumWriterAuth.getUser();
      if (!user) {
        window.location.replace("/writer-login/");
        return;
      }

      const { profile } = await api("get_profile");
      welcome.textContent = profile.full_name ? `Welcome, ${profile.full_name}` : "Your articles";
      if (["editor", "admin"].includes(profile.role)) adminLinks.forEach((link) => { link.hidden = false; });

      const { articles } = await api("list_articles");
      renderArticles(articles);

      // No email yet (tracked separately) -- this is the one signal a
      // writer gets that something changed, so it has to be the first
      // thing visible on the page, not buried in a status group. Covers
      // every staff-initiated transition (writer_notified_at, install/52),
      // not just needs_revision -- a writer previously found out their
      // piece was approved or published only by noticing it had moved,
      // the same silent gap that used to apply to bad news too.
      const unseen = (status) => (articles[status] || []).filter((article) => !article.writer_notified_at);
      const unseenNeedsRevision = unseen("needs_revision");
      const unseenApproved = unseen("approved");
      const unseenPublished = unseen("published");

      if (attentionBanner) {
        if (unseenNeedsRevision.length) {
          attentionBanner.dataset.tone = "warning";
          attentionText.textContent = unseenNeedsRevision.length === 1
            ? `"${unseenNeedsRevision[0].title || "(untitled)"}" needs revision before it can move forward.`
            : `${unseenNeedsRevision.length} articles need revision before they can move forward.`;
          attentionLink.href = "/writer-portal/write/?id=" + encodeURIComponent(unseenNeedsRevision[0].id);
          attentionLink.textContent = "Fix it now";
          attentionBanner.hidden = false;
        } else if (unseenPublished.length || unseenApproved.length) {
          const first = unseenPublished[0] || unseenApproved[0];
          const parts = [];
          if (unseenPublished.length) parts.push(`${unseenPublished.length} article${unseenPublished.length === 1 ? "" : "s"} published`);
          if (unseenApproved.length) parts.push(`${unseenApproved.length} approved`);
          attentionBanner.dataset.tone = "success";
          attentionText.textContent = parts.join(", ") + ".";
          attentionLink.href = "/writer-portal/write/?id=" + encodeURIComponent(first.id);
          attentionLink.textContent = "Take a look";
          attentionBanner.hidden = false;
        }
      }

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = "<div class=\"info-card\"><h2>Writer Portal unavailable</h2><p>" +
        escapeHtml(error.message || "This page could not be loaded.") + "</p></div>";
    }
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      const client = await window.PodiumWriterAuth.getClient();
      await client.auth.signOut();
      window.location.replace("/writer-login/");
    });
  }

  load();
})();
