(() => {
  const loadingBox = document.querySelector("[data-admin-content-loading]");
  const root = document.querySelector("[data-admin-content]");
  const messageBox = document.querySelector("[data-admin-content-message]");
  const searchForm = document.querySelector("[data-admin-content-search-form]");
  const teamList = document.querySelector("[data-admin-content-team-list]");
  const teamEmpty = document.querySelector("[data-admin-content-team-empty]");
  const recentList = document.querySelector("[data-admin-content-recent-list]");
  const recentEmpty = document.querySelector("[data-admin-content-recent-empty]");

  const summaryElements = {
    total: document.querySelector("[data-admin-content-total]"),
    published: document.querySelector("[data-admin-content-published]"),
    draft: document.querySelector("[data-admin-content-draft]"),
    featured: document.querySelector("[data-admin-content-featured]"),
    suspended: document.querySelector("[data-admin-content-suspended]"),
    locked: document.querySelector("[data-admin-content-locked]")
  };

  const required = [
    loadingBox,
    root,
    messageBox,
    searchForm,
    teamList,
    teamEmpty,
    recentList,
    recentEmpty,
    ...Object.values(summaryElements)
  ];

  if (required.some((element) => !element)) {
    return;
  }

  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function showMessage(text, type = "success") {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background =
      type === "error"
        ? "rgba(220,38,38,.12)"
        : "rgba(0,191,99,.1)";
    messageBox.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });
  }

  function parseResponse(response, fallback) {
    return response
      .json()
      .catch(() => ({}))
      .then((data) => {
        if (!response.ok) {
          throw new Error(data.error || fallback);
        }

        return data;
      });
  }

  async function apiFetch(payload) {
    const response = await fetch("/api/admin/team-content/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      window.location.replace("/admin/");
      throw new Error("Your Podium Watch admin session has expired.");
    }

    return parseResponse(
      response,
      "The Team Content Manager request could not be completed."
    );
  }

  function typeLabel(value) {
    const labels = {
      announcement: "Announcement",
      achievement: "Achievement",
      result: "Team result",
      coverage: "Podium Watch coverage",
      media: "Media"
    };

    return labels[value] || value || "Content";
  }

  function formatDate(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    const date = new Date(cleaned.length === 10 ? `${cleaned}T12:00:00` : cleaned);

    if (Number.isNaN(date.getTime())) {
      return cleaned;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function renderSummary(summary) {
    Object.entries(summaryElements).forEach(([key, element]) => {
      element.textContent = String(Number(summary?.[key]) || 0);
    });
  }

  function teamBadges(team) {
    const counts = team.content_counts || {};
    const badges = [
      `<span class="admin-content-badge">${escapeHtml(Number(counts.total) || 0)} total</span>`,
      `<span class="admin-content-badge">${escapeHtml(Number(counts.published) || 0)} published</span>`,
      `<span class="admin-content-badge">${escapeHtml(Number(counts.draft) || 0)} drafts</span>`
    ];

    if (counts.featured) {
      badges.push(`<span class="admin-content-badge admin-content-badge-dark">${escapeHtml(counts.featured)} featured</span>`);
    }

    if (counts.suspended) {
      badges.push(`<span class="admin-content-badge admin-content-badge-danger">${escapeHtml(counts.suspended)} hidden</span>`);
    }

    if (team.suspended) {
      badges.push('<span class="admin-content-badge admin-content-badge-danger">Team suspended</span>');
    }

    if (team.editing_locked) {
      badges.push('<span class="admin-content-badge admin-content-badge-dark">Team editing locked</span>');
    }

    return badges.join("");
  }

  function renderTeams(teams) {
    teamEmpty.hidden = teams.length > 0;
    teamList.hidden = teams.length === 0;

    teamList.innerHTML = teams
      .map((team) => {
        const location = [team.city, team.state].filter(Boolean).join(", ");
        const details = [team.mascot, team.conference, location].filter(Boolean).join(" • ");

        return (
          '<article class="admin-content-team-card">' +
            '<div>' +
              `<h3>${escapeHtml(team.school_name)}</h3>` +
              (details ? `<p>${escapeHtml(details)}</p>` : "") +
              `<div class="admin-content-badges" style="margin-top:12px;">${teamBadges(team)}</div>` +
            '</div>' +
            '<div class="admin-content-actions">' +
              `<a class="button button-primary" href="/team-content/?id=${encodeURIComponent(team.id)}&admin=1">Manage content</a>` +
              (team.slug
                ? `<a class="button button-outline" href="/team/?slug=${encodeURIComponent(team.slug)}&preview=1&admin=1" target="_blank" rel="noopener noreferrer">Preview profile</a>`
                : "") +
            '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderRecent(items) {
    recentEmpty.hidden = items.length > 0;
    recentList.hidden = items.length === 0;

    recentList.innerHTML = items
      .map((item) => {
        const team = item.team || {};
        const badges = [
          `<span class="admin-content-badge">${escapeHtml(typeLabel(item.content_type))}</span>`,
          `<span class="admin-content-badge">${escapeHtml(item.status || "draft")}</span>`
        ];

        if (item.featured) {
          badges.push('<span class="admin-content-badge admin-content-badge-dark">Featured</span>');
        }

        if (item.suspended) {
          badges.push('<span class="admin-content-badge admin-content-badge-danger">Hidden</span>');
        }

        if (item.admin_locked) {
          badges.push('<span class="admin-content-badge admin-content-badge-dark">Locked</span>');
        }

        return (
          '<article class="admin-content-recent-card">' +
            '<div>' +
              `<div class="admin-content-badges">${badges.join("")}</div>` +
              `<h3 style="margin-top:12px;">${escapeHtml(item.title)}</h3>` +
              `<p>${escapeHtml(team.school_name || "Team profile")} • Updated ${escapeHtml(formatDate(item.updated_at) || "recently")}</p>` +
            '</div>' +
            '<div class="admin-content-actions">' +
              (item.team_id
                ? `<a class="button button-primary" href="/team-content/?id=${encodeURIComponent(item.team_id)}&admin=1">Review item</a>`
                : "") +
              (team.slug
                ? `<a class="button button-outline" href="/team/?slug=${encodeURIComponent(team.slug)}&preview=1&admin=1" target="_blank" rel="noopener noreferrer">Preview team</a>`
                : "") +
            '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  async function loadOverview() {
    const data = await apiFetch({ action: "overview" });
    renderSummary(data.summary || {});
    renderRecent(Array.isArray(data.recent) ? data.recent : []);
  }

  async function searchTeams(search = "") {
    const data = await apiFetch({
      action: "search_teams",
      search,
      limit: 100
    });
    renderTeams(Array.isArray(data.teams) ? data.teams : []);
  }

  async function initialize() {
    try {
      await Promise.all([
        loadOverview(),
        searchTeams("")
      ]);
      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML = `
        <h2>Team Content Manager unavailable</h2>
        <p>${escapeHtml(error.message || "The Team Content Manager could not be loaded.")}</p>
        <p><a class="button button-primary" href="/admin/">Return to admin</a></p>
      `;
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    try {
      setBusy(true);
      const search = cleanText(new FormData(searchForm).get("search"));
      await searchTeams(search);
      showMessage(search ? "Team search complete." : "Showing all team profiles.");
    } catch (error) {
      showMessage(error.message || "The team search failed.", "error");
    } finally {
      setBusy(false);
    }
  });

  initialize();
})();
