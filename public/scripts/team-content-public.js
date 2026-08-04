(() => {
  const featuredSection = document.querySelector("[data-team-content-featured-section]");
  const featuredList = document.querySelector("[data-team-content-featured-list]");
  const announcementsSection = document.querySelector("[data-team-content-announcements-section]");
  const announcementsList = document.querySelector("[data-team-content-announcements-list]");
  const resultsSection = document.querySelector("[data-team-content-results-section]");
  const resultsList = document.querySelector("[data-team-content-results-list]");
  const achievementsSection = document.querySelector("[data-team-content-achievements-section]");
  const achievementsList = document.querySelector("[data-team-content-achievements-list]");
  const coverageSection = document.querySelector("[data-team-content-coverage-section]");
  const coverageList = document.querySelector("[data-team-content-coverage-list]");
  const mediaSection = document.querySelector("[data-team-content-media-section]");
  const mediaList = document.querySelector("[data-team-content-media-list]");
  const recruitingSection = document.querySelector("[data-team-content-recruiting-section]");
  const recruitingList = document.querySelector("[data-team-content-recruiting-list]");

  const required = [
    featuredSection,
    featuredList,
    announcementsSection,
    announcementsList,
    resultsSection,
    resultsList,
    achievementsSection,
    achievementsList,
    coverageSection,
    coverageList,
    mediaSection,
    mediaList,
    recruitingSection,
    recruitingList
  ];

  if (required.some((element) => !element)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = String(params.get("slug") || "").trim();
  const previewMode = params.get("preview") === "1";
  const adminMode = params.get("admin") === "1";

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

  function safeUrl(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    try {
      const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
        ? cleaned
        : `https://${cleaned}`;
      const url = new URL(prepared);

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
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

  async function publicFetch() {
    const response = await fetch("/api/teams/content/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ slug })
    });

    return parseResponse(response, "Team content could not be loaded.");
  }

  async function securePreviewFetch() {
    const detailHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (!adminMode) {
      const token = await window.PodiumTeamAuth.getAccessToken();

      if (!token) {
        throw new Error("Team account sign in required.");
      }

      detailHeaders.Authorization = `Bearer ${token}`;
    }

    const detailResponse = await fetch("/api/team/detail/", {
      method: "POST",
      headers: detailHeaders,
      body: JSON.stringify({
        action: "get",
        slug
      })
    });

    const detailData = await parseResponse(
      detailResponse,
      "The private team preview could not be loaded."
    );

    const teamId = detailData.team?.id;

    if (!teamId) {
      throw new Error("Team page not found.");
    }

    const contentHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (!adminMode) {
      contentHeaders.Authorization = detailHeaders.Authorization;
    }

    const contentResponse = await fetch(
      adminMode ? "/api/admin/team-content/" : "/api/team/content/",
      {
        method: "POST",
        headers: contentHeaders,
        body: JSON.stringify({
          action: "get",
          team_id: teamId
        })
      }
    );

    const contentData = await parseResponse(
      contentResponse,
      "The private Team Content Hub preview could not be loaded."
    );

    return {
      ...contentData,
      team: contentData.team || detailData.team
    };
  }

  function formatDate(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    const date = new Date(`${cleaned}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return cleaned;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function programLabel(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value || "Boys and Girls";
  }

  function itemMeta(item) {
    return [
      formatDate(item.event_date),
      item.season_label,
      item.sport_scope && item.sport_scope !== "All" ? item.sport_scope : "",
      item.program_scope && item.program_scope !== "combined"
        ? programLabel(item.program_scope)
        : ""
    ]
      .filter(Boolean)
      .join(" • ");
  }

  function actionLink(item, fallbackLabel) {
    const url = safeUrl(item.url || item.video_url);

    if (!url) {
      return "";
    }

    return `<a class="button button-outline" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.cta_label || fallbackLabel)}</a>`;
  }

  function imageMarkup(item) {
    const imageUrl = safeUrl(item.image_url);

    if (!imageUrl) {
      return "";
    }

    return `<img class="team-content-public-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title || "Team media")}" loading="lazy">`;
  }

  function standardCard(item, fallbackLabel = "Open link") {
    const meta = itemMeta(item);
    const text = item.body_text || item.summary || "";

    return (
      '<article class="team-content-public-card">' +
        imageMarkup(item) +
        '<div class="team-content-public-card-body">' +
          (meta ? `<p class="team-content-public-meta">${escapeHtml(meta)}</p>` : "") +
          `<h3>${escapeHtml(item.title)}</h3>` +
          (item.summary && item.body_text
            ? `<p class="team-content-public-summary"><strong>${escapeHtml(item.summary)}</strong></p>`
            : "") +
          (text ? `<p class="team-content-public-copy">${escapeHtml(text)}</p>` : "") +
          (item.source_name ? `<p class="team-content-public-source">Source: ${escapeHtml(item.source_name)}</p>` : "") +
          actionLink(item, fallbackLabel) +
        '</div>' +
      '</article>'
    );
  }

  function resultCard(item) {
    const details = [
      item.meet_name,
      item.result_place,
      item.result_score
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      '<article class="team-content-public-card">' +
        '<div class="team-content-public-card-body">' +
          `<p class="team-content-public-meta">${escapeHtml(itemMeta(item))}</p>` +
          `<h3>${escapeHtml(item.title)}</h3>` +
          (details ? `<p class="team-content-public-result"><strong>${escapeHtml(details)}</strong></p>` : "") +
          (item.summary ? `<p class="team-content-public-copy">${escapeHtml(item.summary)}</p>` : "") +
          (item.body_text ? `<p class="team-content-public-copy">${escapeHtml(item.body_text)}</p>` : "") +
          actionLink(item, "View official results") +
        '</div>' +
      '</article>'
    );
  }

  function mediaCard(item) {
    const photographerUrl = safeUrl(item.photographer_url);
    const photographer = item.photographer_name
      ? photographerUrl
        ? `<a href="${escapeHtml(photographerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.photographer_name)}</a>`
        : escapeHtml(item.photographer_name)
      : "";

    return (
      '<article class="team-content-public-media-card">' +
        imageMarkup(item) +
        '<div class="team-content-public-card-body">' +
          `<h3>${escapeHtml(item.title)}</h3>` +
          (item.summary ? `<p class="team-content-public-copy">${escapeHtml(item.summary)}</p>` : "") +
          (photographer ? `<p class="team-content-public-source">Photo or media credit: ${photographer}</p>` : "") +
          actionLink(item, item.video_url ? "Watch video" : "Open gallery") +
        '</div>' +
      '</article>'
    );
  }

  function renderSection(section, container, items, renderer) {
    section.hidden = items.length === 0;
    container.innerHTML = items.map(renderer).join("");
  }

  function recruitingLinks(team) {
    const links = [];

    const addLink = (label, value, description) => {
      const url = safeUrl(value);

      if (!url) {
        return;
      }

      links.push(
        '<article class="team-content-public-recruiting-card">' +
          `<h3>${escapeHtml(label)}</h3>` +
          `<p>${escapeHtml(description)}</p>` +
          `<a class="button button-outline" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(label)}</a>` +
        '</article>'
      );
    };

    addLink(
      "Recruiting Questionnaire",
      team.recruiting_questionnaire_url,
      "Official information or questionnaire for prospective college programs and student athletes."
    );
    addLink(
      "Official Athletics Website",
      team.athletics_url,
      "School athletics information, schedules, results, and department contacts."
    );
    addLink(
      "Official Team Website",
      team.website_url,
      "Additional official information from the team or school."
    );
    addLink(
      "All Team Links",
      team.links_page_url,
      "The program's collection of official links."
    );
    addLink(
      "Team Store",
      team.team_store_url,
      "Official team apparel or merchandise."
    );
    addLink(
      "Support the Team",
      team.fundraiser_url,
      "Official fundraising or support information for the program."
    );

    const emails = [];

    if (team.recruiting_contact_email) {
      emails.push(
        `<a class="button button-primary" href="mailto:${escapeHtml(team.recruiting_contact_email)}">Email recruiting contact</a>`
      );
    }

    if (
      team.public_contact_email &&
      team.public_contact_email !== team.recruiting_contact_email
    ) {
      emails.push(
        `<a class="button button-outline" href="mailto:${escapeHtml(team.public_contact_email)}">Email team contact</a>`
      );
    }

    if (emails.length > 0) {
      links.unshift(
        '<article class="team-content-public-recruiting-card">' +
          '<h3>Contact the program</h3>' +
          '<p>Use the official team contacts for recruiting questions, program information, and media requests.</p>' +
          `<div class="team-profile-actions">${emails.join("")}</div>` +
        '</article>'
      );
    }

    return links;
  }

  function render(data) {
    const allItems = (Array.isArray(data.items) ? data.items : []).filter(
      (item) => item.status === "published" && item.suspended !== true
    );

    const featured = allItems
      .filter((item) => item.featured)
      .sort((a, b) => Number(a.featured_rank || 0) - Number(b.featured_rank || 0));
    const announcements = allItems.filter((item) => item.content_type === "announcement");
    const results = allItems.filter((item) => item.content_type === "result");
    const achievements = allItems.filter((item) => item.content_type === "achievement");
    const coverage = allItems.filter((item) => item.content_type === "coverage");
    const media = allItems.filter((item) => item.content_type === "media");

    renderSection(featuredSection, featuredList, featured, (item) => standardCard(item, "Open featured item"));
    renderSection(announcementsSection, announcementsList, announcements, (item) => standardCard(item, "More information"));
    renderSection(resultsSection, resultsList, results, resultCard);
    renderSection(achievementsSection, achievementsList, achievements, (item) => standardCard(item, "View achievement"));
    renderSection(coverageSection, coverageList, coverage, (item) => standardCard(item, "Read Podium Watch coverage"));
    renderSection(mediaSection, mediaList, media, mediaCard);

    const recruiting = recruitingLinks(data.team || {});
    recruitingSection.hidden = recruiting.length === 0;
    recruitingList.innerHTML = recruiting.join("");
  }

  async function load() {
    if (!slug) {
      return;
    }

    try {
      const data = previewMode
        ? await securePreviewFetch()
        : await publicFetch();

      if (data.redirected && data.redirect_slug) {
        window.location.replace(`/team/?slug=${encodeURIComponent(data.redirect_slug)}`);
        return;
      }

      render(data);
    } catch (error) {
      console.error("Unable to load Team Content Hub:", error);
    }
  }

  load();
})();
