(() => {
  const form = document.querySelector(
    "[data-team-directory-form]"
  );
  const clearButton = document.querySelector(
    "[data-team-directory-clear]"
  );
  const statusBox = document.querySelector(
    "[data-team-directory-status]"
  );
  const countBox = document.querySelector(
    "[data-team-directory-count]"
  );
  const results = document.querySelector(
    "[data-team-directory-results]"
  );
  const empty = document.querySelector(
    "[data-team-directory-empty]"
  );

  if (
    !form ||
    !clearButton ||
    !statusBox ||
    !countBox ||
    !results ||
    !empty
  ) {
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

  function safeUrl(value) {
    const cleaned = String(
      value ?? ""
    ).trim();

    if (!cleaned) {
      return "";
    }

    try {
      const url = new URL(cleaned);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function safeColor(value, fallback) {
    const cleaned = String(
      value ?? ""
    ).trim();

    return /^#[0-9a-f]{6}$/i.test(cleaned)
      ? cleaned
      : fallback;
  }

  function formatProgramLevel(value) {
    const labels = {
      high_school: "High School",
      middle_school: "Middle School",
      club: "Club"
    };

    return labels[value] || value || "";
  }

  function formatProgramScope(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value || "";
  }

  function initials(value) {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("") || "PW";
  }

  function setBusy(value) {
    busy = value;

    form
      .querySelectorAll("button")
      .forEach((element) => {
        element.disabled = value;
      });
  }

  function showStatus(message, error = false) {
    statusBox.textContent = message;
    statusBox.hidden = !message;
    statusBox.style.background = error
      ? "rgba(220, 38, 38, 0.12)"
      : "rgba(0, 191, 99, 0.1)";
    statusBox.style.color = error
      ? "#991b1b"
      : "";
  }

  function renderLogo(team) {
    const logoUrl = safeUrl(team.logo_url);

    if (!logoUrl) {
      return (
        '<div class="team-directory-logo-placeholder">' +
          escapeHtml(
            initials(team.school_name)
          ) +
        "</div>"
      );
    }

    return (
      '<img class="team-directory-logo" ' +
        'src="' + escapeHtml(logoUrl) + '" ' +
        'alt="' +
          escapeHtml(
            team.school_name + " logo"
          ) +
        '" data-team-directory-logo>'
    );
  }

  function renderBadges(team) {
    const items = [
      formatProgramLevel(
        team.program_level
      ),
      formatProgramScope(
        team.program_scope
      ),
      team.claimed
        ? "Claimed"
        : "Available to claim"
    ];

    if (team.cross_country_boys_division) {
      items.push(
        "Boys XC " +
        team.cross_country_boys_division
      );
    }

    if (team.verified) {
      items.push("Verified Team");
    }

    return items
      .filter(Boolean)
      .map((label, index) => (
        '<span class="team-directory-badge' +
          (
            label === "Verified Team"
              ? " team-directory-badge-dark"
              : ""
          ) +
        '">' +
          escapeHtml(label) +
        "</span>"
      ))
      .join("");
  }

  function renderSocials(team) {
    const platforms = Array.isArray(
      team.social_platforms
    )
      ? team.social_platforms
      : [];

    if (platforms.length === 0) {
      return "";
    }

    return (
      '<div class="team-directory-socials">' +
        platforms
          .slice(0, 6)
          .map((platform) => (
            '<span class="team-directory-social">' +
              escapeHtml(platform) +
            "</span>"
          ))
          .join("") +
      "</div>"
    );
  }

  function renderTeam(team) {
    const primary = safeColor(
      team.primary_color,
      "#00bf63"
    );
    const secondary = safeColor(
      team.secondary_color,
      "#111827"
    );
    const location = [
      team.city,
      team.state
    ]
      .filter(Boolean)
      .join(", ");
    const details = [
      team.mascot,
      team.conference,
      team.region
    ]
      .filter(Boolean)
      .join(" · ");
    const completion = Math.max(
      0,
      Math.min(
        100,
        Number(team.completion_score) || 0
      )
    );

    return (
      '<article class="team-directory-card" style="' +
        "--directory-team-primary:" +
        escapeHtml(primary) +
        ";--directory-team-secondary:" +
        escapeHtml(secondary) +
        ';">' +
        '<div class="team-directory-card-top"></div>' +
        '<div class="team-directory-card-body">' +
          '<div class="team-directory-card-identity">' +
            renderLogo(team) +
            "<div>" +
              "<h3>" +
                escapeHtml(
                  team.school_name
                ) +
              "</h3>" +
              '<p class="team-directory-card-location">' +
                escapeHtml(location) +
              "</p>" +
            "</div>" +
          "</div>" +
          '<div class="team-directory-badges">' +
            renderBadges(team) +
          "</div>" +
          (
            details
              ? "<p>" +
                  escapeHtml(details) +
                "</p>"
              : ""
          ) +
          '<div style="display:grid;gap:7px;">' +
            '<p style="margin:0;"><strong>' +
              escapeHtml(completion) +
              " percent complete</strong></p>" +
            '<div style="height:9px;overflow:hidden;border-radius:999px;background:rgba(15,23,42,.1);">' +
              '<span style="display:block;height:100%;width:' +
                escapeHtml(completion) +
                '%;background:var(--directory-team-primary);"></span>' +
            "</div>" +
          "</div>" +
          renderSocials(team) +
          '<div class="team-directory-card-actions">' +
            '<a class="button button-primary" href="/team/?slug=' +
              encodeURIComponent(team.slug) +
            '">View team profile</a>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function attachImageFallbacks() {
    results
      .querySelectorAll(
        "[data-team-directory-logo]"
      )
      .forEach((image) => {
        image.addEventListener(
          "error",
          () => {
            const card = image.closest(
              ".team-directory-card"
            );
            const heading = card?.querySelector(
              "h3"
            );
            const placeholder =
              document.createElement("div");
            placeholder.className =
              "team-directory-logo-placeholder";
            placeholder.textContent = initials(
              heading?.textContent || ""
            );
            image.replaceWith(placeholder);
          },
          { once: true }
        );
      });
  }

  function renderTeams(teams) {
    countBox.textContent =
      String(teams.length);
    empty.hidden = teams.length > 0;
    results.hidden = teams.length === 0;
    results.innerHTML = teams
      .map(renderTeam)
      .join("");
    attachImageFallbacks();
  }

  async function loadTeams() {
    if (busy) {
      return;
    }

    setBusy(true);
    showStatus("Loading team profiles.");

    const formData = new FormData(form);
    const payload = {
      search: String(
        formData.get("search") || ""
      ).trim(),
      region: String(
        formData.get("region") || ""
      ).trim(),
      program_level: String(
        formData.get("program_level") || ""
      ).trim(),
      program_scope: String(
        formData.get("program_scope") || ""
      ).trim(),
      cross_country_boys_division: String(
        formData.get("cross_country_boys_division") || ""
      ).trim()
    };

    try {
      const response = await fetch(
        "/api/teams/",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "The team directory could not be loaded."
        );
      }

      const teams = Array.isArray(data.teams)
        ? data.teams
        : [];
      renderTeams(teams);
      showStatus(
        teams.length === 1
          ? "1 team profile found."
          : teams.length +
            " team profiles found."
      );
    } catch (error) {
      renderTeams([]);
      showStatus(
        error.message ||
        "The team directory could not be loaded.",
        true
      );
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      loadTeams();
    }
  );

  clearButton.addEventListener(
    "click",
    () => {
      if (busy) {
        return;
      }

      form.reset();
      loadTeams();
    }
  );

  loadTeams();
})();
