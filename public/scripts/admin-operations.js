(() => {
  const loading = document.querySelector(
    "[data-operations-loading]"
  );
  const loginForm = document.querySelector(
    "[data-operations-login]"
  );
  const loginMessage = document.querySelector(
    "[data-operations-login-message]"
  );
  const dashboard = document.querySelector(
    "[data-operations-dashboard]"
  );
  const message = document.querySelector(
    "[data-operations-message]"
  );
  const refreshButton = document.querySelector(
    "[data-operations-refresh]"
  );
  const logoutButton = document.querySelector(
    "[data-operations-logout]"
  );
  const daysSelect = document.querySelector(
    "[data-operations-days]"
  );
  const staticData =
    window.PODIUM_OPERATIONS_STATIC || {
      stories: {
        count: 0,
        latest: null
      },
      rankings: {
        count: 0,
        stale: [],
        staleAfterDays: 21,
        latestUpdatedDate: null
      }
    };

  let state = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(
      Number(value) || 0
    );
  }

  function formatDate(value, includeTime = false) {
    if (!value) {
      return "Not set";
    }

    const source = /^\d{4}-\d{2}-\d{2}$/.test(
      String(value)
    )
      ? `${value}T12:00:00`
      : value;
    const date = new Date(source);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      "en-US",
      includeTime
        ? {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
          }
        : {
            month: "short",
            day: "numeric",
            year: "numeric"
          }
    ).format(date);
  }

  function relativeTime(value) {
    const date = new Date(value || 0);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const seconds = Math.round(
      (date.getTime() - Date.now()) / 1000
    );
    const absoluteSeconds = Math.abs(seconds);
    let amount;
    let unit;

    if (absoluteSeconds < 60) {
      amount = seconds;
      unit = "second";
    } else if (absoluteSeconds < 3600) {
      amount = Math.round(seconds / 60);
      unit = "minute";
    } else if (absoluteSeconds < 86400) {
      amount = Math.round(seconds / 3600);
      unit = "hour";
    } else {
      amount = Math.round(seconds / 86400);
      unit = "day";
    }

    return new Intl.RelativeTimeFormat(
      "en",
      {
        numeric: "auto"
      }
    ).format(amount, unit);
  }

  function showMessage(text, tone = "success") {
    if (!message) {
      return;
    }

    message.textContent = text || "";
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function setBusy(value) {
    busy = Boolean(value);

    document
      .querySelectorAll(
        "[data-operations-dashboard] button, " +
        "[data-operations-dashboard] select"
      )
      .forEach((control) => {
        control.disabled = busy;
      });
  }

  async function requestJson(
    url,
    options = {}
  ) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data.error ||
        "The Operations Center request failed."
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function statusBadge(
    label,
    tone = "success"
  ) {
    const safeTone = [
      "success",
      "warning",
      "error",
      "neutral"
    ].includes(tone)
      ? tone
      : "neutral";
    const extraClass =
      safeTone === "success"
        ? ""
        : ` operations-status-${safeTone}`;

    return `<span class="operations-status${extraClass}">${escapeHtml(label)}</span>`;
  }

  function emptyState(
    title,
    detail
  ) {
    return `<div class="operations-empty">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>`;
  }

  function meetHref(meet) {
    return meet?.slug
      ? `/meetdetail/?slug=${encodeURIComponent(meet.slug)}`
      : "/meets/";
  }

  function teamHref(team) {
    return team?.slug
      ? `/team/?slug=${encodeURIComponent(team.slug)}`
      : "/teams/";
  }

  function pickRequestName(request) {
    return (
      request.requested_meet_name ||
      request.meet_name ||
      request.event_name ||
      request.name ||
      "Schedule request"
    );
  }

  function pickReportTitle(report) {
    return (
      report.report_type ||
      report.reason ||
      report.category ||
      report.subject ||
      "Team report"
    );
  }

  function awardPhaseLabel(phase) {
    return {
      not_scheduled: "Not scheduled",
      scheduled: "Scheduled",
      nominations_open: "Nominations open",
      voting_open: "Voting open",
      voting_closed: "Voting closed",
      winner_announced: "Winner announced"
    }[phase] || String(phase || "Unknown");
  }

  function awardTone(award) {
    if (
      !award ||
      award.phase === "not_scheduled"
    ) {
      return "warning";
    }

    if (
      award.phase === "voting_closed" &&
      !award.winner_count
    ) {
      return "error";
    }

    if (
      award.phase === "nominations_open" ||
      award.phase === "voting_open"
    ) {
      return "success";
    }

    return "neutral";
  }

  function renderTaskList() {
    const container = document.querySelector(
      "[data-task-list]"
    );
    const count = document.querySelector(
      "[data-task-count]"
    );
    const tasks = state.tasks || [];

    count.textContent = formatNumber(tasks.length);

    if (!tasks.length) {
      container.innerHTML = emptyState(
        "Nothing urgent is waiting",
        "The main operating queues are clear right now."
      );
      return;
    }

    container.innerHTML = tasks
      .map(
        (task) => `<article class="operations-row">
          <div>
            <span class="operations-priority operations-priority-${escapeHtml(task.priority)}">
              ${escapeHtml(task.priority)}
            </span>
            <h3>${escapeHtml(task.title)}</h3>
            <p>${escapeHtml(task.detail)}</p>
          </div>
          <div class="operations-row-actions">
            <a
              class="button button-outline"
              href="${escapeHtml(task.href || "/admin/")}"
            >
              ${escapeHtml(task.label || "Open")}
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderAwards() {
    const container = document.querySelector(
      "[data-awards-list]"
    );
    const awards = [
      {
        label: "Athlete of the Week",
        href: "/athlete-of-the-week/",
        adminHref: "/admin/",
        data: state.awards?.athlete
      },
      {
        label: "Team of the Week",
        href: "/team-of-the-week/",
        adminHref: "/admin/",
        data: state.awards?.team
      }
    ];

    container.innerHTML = awards
      .map(({ label, href, adminHref, data }) => {
        const week = data?.week;
        const dates = week
          ? `${formatDate(week.nomination_opens, true)} to ${formatDate(week.voting_closes || week.nomination_closes, true)}`
          : "No current cycle";

        return `<article class="operations-row">
          <div>
            ${statusBadge(
              awardPhaseLabel(data?.phase),
              awardTone(data)
            )}
            <h3>${escapeHtml(label)}</h3>
            <p>${escapeHtml(week?.title || "No cycle scheduled")}</p>
            <small>
              ${escapeHtml(dates)}
              · ${formatNumber(data?.nomination_count)} nominations
              · ${formatNumber(data?.finalist_count)} finalists
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="${href}">View public page</a>
            <a href="${adminHref}">Manage</a>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderUpcomingOverview() {
    const container = document.querySelector(
      "[data-upcoming-overview]"
    );
    const meets =
      state.meets?.upcoming_seven_days || [];

    if (!meets.length) {
      container.innerHTML = emptyState(
        "No meets in the next seven days",
        "Upcoming meets will appear here as their dates approach."
      );
      return;
    }

    container.innerHTML = meets
      .slice(0, 8)
      .map(
        (meet) => `<article class="operations-row">
          <div>
            <h3>
              <a href="${meetHref(meet)}">
                ${escapeHtml(meet.name)}
              </a>
            </h3>
            <p>
              ${escapeHtml(formatDate(meet.meet_date))}
              ${meet.start_time ? ` · ${escapeHtml(meet.start_time)}` : ""}
            </p>
            <small>
              ${escapeHtml(
                meet.venue_name ||
                meet.city ||
                meet.host_school ||
                "Location not set"
              )}
            </small>
          </div>
          <div>
            ${statusBadge(
              meet.published ? "Published" : "Draft",
              meet.published ? "success" : "warning"
            )}
          </div>
        </article>`
      )
      .join("");
  }

  function renderStaticOverview() {
    const container = document.querySelector(
      "[data-static-overview]"
    );
    const latestStory =
      staticData.stories?.latest;
    const staleCount =
      staticData.rankings?.stale?.length || 0;

    container.innerHTML = `
      <article class="operations-row">
        <div>
          <h3>Published stories</h3>
          <p>${formatNumber(staticData.stories?.count)} story pages</p>
          <small>
            ${
              latestStory
                ? `Latest: ${escapeHtml(latestStory.title)} on ${escapeHtml(formatDate(latestStory.date))}`
                : "No published stories were found."
            }
          </small>
        </div>
        <div class="operations-row-actions">
          <a href="/stories/">View stories</a>
        </div>
      </article>

      <article class="operations-row">
        <div>
          <h3>Ranking files</h3>
          <p>${formatNumber(staticData.rankings?.count)} published ranking files</p>
          <small>
            ${
              staleCount
                ? `${formatNumber(staleCount)} older than ${formatNumber(staticData.rankings?.staleAfterDays)} days`
                : "All ranking files are inside the current freshness window."
            }
          </small>
        </div>
        <div>
          ${statusBadge(
            staleCount ? "Review" : "Current",
            staleCount ? "warning" : "success"
          )}
        </div>
      </article>
    `;
  }

  function renderMissingResults() {
    const container = document.querySelector(
      "[data-missing-results]"
    );
    const count = document.querySelector(
      "[data-missing-results-count]"
    );
    const meets =
      state.meets?.missing_results || [];

    count.textContent = formatNumber(
      state.summary?.missing_results
    );

    if (!meets.length) {
      container.innerHTML = emptyState(
        "No recent results are missing",
        "Published meets in the review window have a results source."
      );
      return;
    }

    container.innerHTML = meets
      .map(
        (meet) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(meet.name)}</h3>
            <p>${escapeHtml(formatDate(meet.meet_date))}</p>
            <small>
              Add an official, Athletic.net, or MileSplit results link.
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="${meetHref(meet)}">View page</a>
            <a href="/admin/">Edit meet</a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderIncompleteMeets() {
    const container = document.querySelector(
      "[data-incomplete-meets]"
    );
    const count = document.querySelector(
      "[data-incomplete-meets-count]"
    );
    const meets =
      state.meets?.incomplete_upcoming || [];

    count.textContent = formatNumber(
      meets.length
    );

    if (!meets.length) {
      container.innerHTML = emptyState(
        "Upcoming meet pages are ready",
        "The reviewed pages include the main visitor information."
      );
      return;
    }

    container.innerHTML = meets
      .map(
        (meet) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(meet.name)}</h3>
            <p>
              ${escapeHtml(formatDate(meet.meet_date))}
              · ${formatNumber(meet.completeness?.score)} percent complete
            </p>
            <small>
              Missing:
              ${escapeHtml(
                (meet.completeness?.missing || [])
                  .join(", ") ||
                "review required"
              )}
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/">Edit meet</a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderUpcomingMeetsTable() {
    const body = document.querySelector(
      "[data-upcoming-meets-table]"
    );
    const meets =
      state.meets?.upcoming || [];

    body.innerHTML = meets.length
      ? meets
          .map(
            (meet) => `<tr>
              <td>
                <strong>${escapeHtml(meet.name)}</strong>
                <br>
                <small>${escapeHtml(meet.sport || "")}</small>
              </td>
              <td>${escapeHtml(formatDate(meet.meet_date))}</td>
              <td>
                ${escapeHtml(
                  meet.venue_name ||
                  meet.city ||
                  meet.host_school ||
                  "Not set"
                )}
              </td>
              <td>
                ${statusBadge(
                  meet.published ? "Published" : "Draft",
                  meet.published ? "success" : "warning"
                )}
              </td>
              <td>
                ${
                  meet.results_url ||
                  meet.athleticnet_url ||
                  meet.milesplit_url
                    ? statusBadge(
                        "Linked",
                        "success"
                      )
                    : statusBadge(
                        "Not added",
                        "neutral"
                      )
                }
              </td>
            </tr>`
          )
          .join("")
      : `<tr>
          <td colspan="5">
            No upcoming meets were found.
          </td>
        </tr>`;
  }

  function renderClaims() {
    const container = document.querySelector(
      "[data-claims-list]"
    );
    const count = document.querySelector(
      "[data-claims-count]"
    );
    const claims =
      state.teams?.claims || [];

    count.textContent = formatNumber(
      claims.length
    );

    if (!claims.length) {
      container.innerHTML = emptyState(
        "No pending claims",
        "There are no team access requests waiting for review."
      );
      return;
    }

    container.innerHTML = claims
      .map(
        (claim) => `<article class="operations-row">
          <div>
            <h3>
              ${escapeHtml(
                claim.team?.school_name ||
                claim.requested_school_name ||
                "Team profile"
              )}
            </h3>
            <p>
              ${escapeHtml(claim.requester_name || "Requester")}
              · ${escapeHtml(claim.requester_role || "Team representative")}
            </p>
            <small>
              Submitted ${escapeHtml(relativeTime(claim.created_at))}
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/team-manager/">
              Review claim
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderReports() {
    const container = document.querySelector(
      "[data-reports-list]"
    );
    const count = document.querySelector(
      "[data-reports-count]"
    );
    const reports =
      state.teams?.reports || [];

    count.textContent = formatNumber(
      reports.length
    );

    if (!reports.length) {
      container.innerHTML = emptyState(
        "No active reports",
        "No team profile corrections or concerns are waiting."
      );
      return;
    }

    container.innerHTML = reports
      .map(
        (report) => `<article class="operations-row">
          <div>
            ${statusBadge(
              report.status || "open",
              report.status === "reviewing"
                ? "warning"
                : "error"
            )}
            <h3>
              ${escapeHtml(
                report.team?.school_name ||
                "Team profile"
              )}
            </h3>
            <p>${escapeHtml(pickReportTitle(report))}</p>
            <small>
              Submitted ${escapeHtml(relativeTime(report.created_at))}
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/team-manager/">
              Review report
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderScheduleRequests() {
    const container = document.querySelector(
      "[data-schedule-requests]"
    );
    const count = document.querySelector(
      "[data-schedule-requests-count]"
    );
    const requests =
      state.teams?.schedule_requests || [];

    count.textContent = formatNumber(
      requests.length
    );

    if (!requests.length) {
      container.innerHTML = emptyState(
        "No schedule requests",
        "No team submitted meet requests are waiting."
      );
      return;
    }

    container.innerHTML = requests
      .map(
        (request) => `<article class="operations-row">
          <div>
            ${statusBadge(
              request.status || "pending",
              request.status === "reviewing"
                ? "warning"
                : "neutral"
            )}
            <h3>${escapeHtml(pickRequestName(request))}</h3>
            <p>
              ${escapeHtml(
                request.team?.school_name ||
                "Team profile"
              )}
            </p>
            <small>
              Submitted ${escapeHtml(relativeTime(request.created_at))}
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/team-schedules/">
              Review request
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderIncompleteTeams() {
    const container = document.querySelector(
      "[data-incomplete-teams]"
    );
    const teams =
      state.teams?.incomplete || [];

    if (!teams.length) {
      container.innerHTML = emptyState(
        "Team profiles are in good shape",
        "No active profile is below the current completion threshold."
      );
      return;
    }

    container.innerHTML = teams
      .slice(0, 12)
      .map(
        (team) => `<article class="operations-row">
          <div>
            <h3>
              <a href="${teamHref(team)}">
                ${escapeHtml(team.school_name)}
              </a>
            </h3>
            <p>
              ${formatNumber(team.completion_score)}
              percent complete
            </p>
            <div class="operations-progress">
              <span
                style="width:${Math.max(
                  0,
                  Math.min(
                    100,
                    Number(team.completion_score) || 0
                  )
                )}%"
              ></span>
            </div>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/team-manager/">
              Improve
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderTeamStats() {
    const container = document.querySelector(
      "[data-team-stats]"
    );
    const teams = state.teams || {};

    const values = [
      ["Total profiles", teams.total],
      ["Published", teams.published],
      ["Verified", teams.verified],
      ["Claimed", teams.claimed],
      ["Unclaimed", teams.unclaimed],
      ["Suspended", teams.suspended]
    ];

    container.innerHTML = values
      .map(
        ([label, value]) => `<article class="operations-stat">
          <strong>${formatNumber(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </article>`
      )
      .join("");
  }

  function renderAthleteFoundation() {
    const athletes = state.athletes || {};
    const statsContainer = document.querySelector(
      "[data-athlete-stats]"
    );
    const readinessContainer = document.querySelector(
      "[data-athlete-readiness]"
    );

    const stats = [
      ["Permanent profiles", athletes.profiles || 0],
      ["Public profiles", athletes.public_profiles || 0],
      ["Sourced performances", athletes.sourced_performances || 0],
      ["Published recruit ratings", athletes.published_recruit_ratings || 0],
      ["Draft recruit ratings", athletes.draft_recruit_ratings || 0],
      ["Open corrections", athletes.open_corrections || 0],
      ["Unlinked roster athletes", athletes.unlinked_roster_athletes || 0],
      ["Failed performance imports", athletes.failed_performance_imports || 0]
    ];

    statsContainer.innerHTML = stats
      .map(
        ([label, value]) => `<article class="operations-stat">
          <strong>${formatNumber(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </article>`
      )
      .join("");

    const rows = [
      {
        title: "Athlete database",
        detail: athletes.installed
          ? "The athlete profile migration is available."
          : "Run the athlete profile migration before importing.",
        ready: athletes.installed
      },
      {
        title: "Bundled ranking seed",
        detail: `${formatNumber(athletes.profiles || 0)} of 200 starting profiles are loaded.`,
        ready: Number(athletes.profiles || 0) >= 200
      },
      {
        title: "Correction queue",
        detail: athletes.open_corrections
          ? `${formatNumber(athletes.open_corrections)} corrections need review.`
          : "No athlete corrections are waiting.",
        ready: !athletes.open_corrections
      },
      {
        title: "Roster connections",
        detail: athletes.unlinked_roster_athletes
          ? `${formatNumber(athletes.unlinked_roster_athletes)} roster athletes need a permanent profile link.`
          : "Every roster athlete is connected or no roster records are available.",
        ready: !athletes.unlinked_roster_athletes
      },
      {
        title: "Recruit Ratings database",
        detail: athletes.recruiting_installed
          ? "Performance history, Recruit Ratings, and recruiting activity tables are available."
          : "Run migration 03 before using the Recruiting Center.",
        ready: athletes.recruiting_installed
      },
      {
        title: "Performance evidence",
        detail: athletes.sourced_performances
          ? `${formatNumber(athletes.sourced_performances)} source linked or verified performances are available.`
          : "Import sourced performances before publishing Recruit Ratings.",
        ready: Boolean(athletes.sourced_performances)
      },
      {
        title: "Published Recruit Ratings",
        detail: athletes.published_recruit_ratings
          ? `${formatNumber(athletes.published_recruit_ratings)} ratings are public.`
          : "No Recruit Ratings are public yet.",
        ready: Boolean(athletes.published_recruit_ratings)
      },
      {
        title: "Performance import queue",
        detail: athletes.failed_performance_imports
          ? `${formatNumber(athletes.failed_performance_imports)} failed imports need review.`
          : "No failed performance imports are waiting.",
        ready: !athletes.failed_performance_imports
      }
    ];

    readinessContainer.innerHTML = rows
      .map(
        (row) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(row.title)}</h3>
            <p>${escapeHtml(row.detail)}</p>
          </div>
          <div>
            ${statusBadge(
              row.ready ? "Ready" : "Needs review",
              row.ready ? "success" : "warning"
            )}
          </div>
        </article>`
      )
      .join("");
  }

  function renderDraftContent() {
    const container = document.querySelector(
      "[data-draft-content]"
    );
    const count = document.querySelector(
      "[data-draft-content-count]"
    );
    const drafts =
      state.content?.drafts || [];

    count.textContent = formatNumber(
      state.summary?.draft_content
    );

    if (!drafts.length) {
      container.innerHTML = emptyState(
        "No team drafts",
        "There are no current team content drafts waiting."
      );
      return;
    }

    container.innerHTML = drafts
      .map(
        (item) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(item.title || "Untitled draft")}</h3>
            <p>
              ${escapeHtml(
                item.team?.school_name ||
                "Team profile"
              )}
              · ${escapeHtml(item.content_type || "content")}
            </p>
            <small>
              Updated ${escapeHtml(relativeTime(item.updated_at || item.created_at))}
            </small>
          </div>
          <div class="operations-row-actions">
            <a href="/admin/team-content/">
              Review draft
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderRankingFreshness() {
    const container = document.querySelector(
      "[data-ranking-freshness]"
    );
    const stale =
      staticData.rankings?.stale || [];

    if (!stale.length) {
      container.innerHTML = emptyState(
        "Rankings are current",
        `All ranking files were updated within ${formatNumber(staticData.rankings?.staleAfterDays)} days of the latest build.`
      );
      return;
    }

    container.innerHTML = stale
      .map(
        (ranking) => `<article class="operations-row">
          <div>
            ${statusBadge(
              "Review",
              "warning"
            )}
            <h3>${escapeHtml(ranking.title)}</h3>
            <p>
              Last updated
              ${escapeHtml(formatDate(ranking.updatedDate))}
            </p>
          </div>
          <div class="operations-row-actions">
            <a href="${escapeHtml(ranking.href)}">
              View ranking
            </a>
          </div>
        </article>`
      )
      .join("");
  }

  function renderContentStats() {
    const container = document.querySelector(
      "[data-content-stats]"
    );
    const values = [
      [
        "Published stories",
        staticData.stories?.count
      ],
      [
        "Ranking files",
        staticData.rankings?.count
      ],
      [
        "Published team posts",
        state.content?.published_count
      ],
      [
        "Team drafts",
        state.summary?.draft_content
      ]
    ];

    container.innerHTML = values
      .map(
        ([label, value]) => `<article class="operations-stat">
          <strong>${formatNumber(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </article>`
      )
      .join("");
  }

  function configurationLabel(key) {
    return {
      supabase_url: "Supabase URL",
      supabase_secret_key: "Supabase secret key",
      admin_password: "Admin password",
      admin_session_secret: "Admin session secret",
      vote_hash_secret: "Voting hash secret",
      resend_api_key: "Resend API key",
      resend_from_email: "Resend sending address",
      cron_secret: "Vercel cron secret",
      site_url: "Public site URL"
    }[key] || key;
  }

  function renderConfiguration() {
    const container = document.querySelector(
      "[data-configuration]"
    );
    const configuration =
      state.configuration || {};

    container.innerHTML = Object.entries(
      configuration
    )
      .map(
        ([key, ready]) => `<article class="operations-config-item">
          <strong>${escapeHtml(configurationLabel(key))}</strong>
          ${
            ready
              ? statusBadge(
                  "Configured",
                  "success"
                )
              : statusBadge(
                  "Missing",
                  "warning"
                )
          }
        </article>`
      )
      .join("");
  }

  function subsystemLabel(key) {
    return {
      meets: "Meet Center",
      teams: "Team profiles",
      statewide_data: "Statewide school foundation",
      athlete_profiles: "Athlete profiles",
      athlete_corrections: "Athlete corrections",
      athlete_roster_links: "Athlete roster links",
      claims: "Team claims",
      reports: "Team reports",
      meet_requests: "Schedule requests",
      team_content: "Team content",
      notifications: "Notifications",
      analytics: "Analytics",
      sponsors: "Sponsors",
      athlete_of_the_week: "Athlete of the Week",
      team_of_the_week: "Team of the Week"
    }[key] || key;
  }

  function renderSubsystems() {
    const container = document.querySelector(
      "[data-subsystems]"
    );
    const subsystems =
      state.subsystems || {};

    container.innerHTML = Object.entries(
      subsystems
    )
      .map(
        ([key, ready]) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(subsystemLabel(key))}</h3>
          </div>
          <div>
            ${
              ready
                ? statusBadge(
                    "Available",
                    "success"
                  )
                : statusBadge(
                    "Unavailable",
                    "error"
                  )
            }
          </div>
        </article>`
      )
      .join("");
  }

  function renderNotificationHealth() {
    const container = document.querySelector(
      "[data-notification-health]"
    );
    const engagement =
      state.engagement || {};
    const settings =
      engagement.settings || {};

    const rows = [
      {
        title: "Notification mode",
        detail:
          settings.notification_mode ||
          "Not configured",
        tone:
          settings.notification_mode === "live"
            ? "success"
            : settings.notification_mode === "test"
              ? "warning"
              : "neutral"
      },
      {
        title: "Pending queue",
        detail:
          `${formatNumber(engagement.pending_events?.length)} events`,
        tone:
          engagement.pending_events?.length
            ? "warning"
            : "success"
      },
      {
        title: "Failed events",
        detail:
          `${formatNumber(engagement.failed_events?.length)} events`,
        tone:
          engagement.failed_events?.length
            ? "error"
            : "success"
      },
      {
        title: "Failed deliveries",
        detail:
          `${formatNumber(engagement.failed_deliveries?.length)} deliveries`,
        tone:
          engagement.failed_deliveries?.length
            ? "error"
            : "success"
      }
    ];

    container.innerHTML = rows
      .map(
        (row) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(row.title)}</h3>
            <p>${escapeHtml(row.detail)}</p>
          </div>
          <div>
            ${statusBadge(
              row.tone === "success"
                ? "Ready"
                : row.tone === "error"
                  ? "Needs review"
                  : "Check",
              row.tone
            )}
          </div>
        </article>`
      )
      .join("");
  }

  function renderSponsorHealth() {
    const container = document.querySelector(
      "[data-sponsor-health]"
    );
    const sponsors =
      state.sponsors || {};
    const rows = [
      [
        "Sponsor records",
        sponsors.total,
        sponsors.total ? "success" : "neutral"
      ],
      [
        "Active sponsors",
        sponsors.active,
        sponsors.active ? "success" : "neutral"
      ],
      [
        "Active placements",
        sponsors.active_placements,
        sponsors.active_placements
          ? "success"
          : "warning"
      ],
      [
        `Sponsor clicks in ${state.days} days`,
        state.summary?.sponsor_clicks,
        "neutral"
      ]
    ];

    container.innerHTML = rows
      .map(
        ([label, value, tone]) => `<article class="operations-row">
          <div>
            <h3>${escapeHtml(label)}</h3>
            <p>${formatNumber(value)}</p>
          </div>
          <div>
            ${statusBadge(
              tone === "success"
                ? "Active"
                : tone === "warning"
                  ? "Set up"
                  : "Tracked",
              tone
            )}
          </div>
        </article>`
      )
      .join("");
  }

  function renderSystemIssues() {
    const card = document.querySelector(
      "[data-system-issues-card]"
    );
    const container = document.querySelector(
      "[data-system-issues]"
    );
    const issues = state.issues || [];

    card.hidden = !issues.length;

    if (!issues.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = issues
      .map(
        (issue) => `<article class="operations-row">
          <div>
            ${statusBadge(
              "Unavailable",
              "error"
            )}
            <h3>${escapeHtml(issue.label || issue.key)}</h3>
            <p>${escapeHtml(issue.message)}</p>
          </div>
        </article>`
      )
      .join("");
  }

  function renderSummary() {
    const summary = state.summary || {};

    document.querySelector(
      "[data-stat-task-count]"
    ).textContent = formatNumber(
      summary.task_count
    );

    document.querySelector(
      "[data-stat-urgent-tasks]"
    ).textContent =
      summary.urgent_tasks
        ? `${formatNumber(summary.urgent_tasks)} urgent`
        : "No urgent items";

    document.querySelector(
      "[data-stat-upcoming-meets]"
    ).textContent = formatNumber(
      summary.upcoming_meets_7
    );

    document.querySelector(
      "[data-stat-upcoming-thirty]"
    ).textContent =
      `${formatNumber(summary.upcoming_meets_30)} in the next 30 days`;

    document.querySelector(
      "[data-stat-claims]"
    ).textContent = formatNumber(
      summary.pending_claims
    );

    document.querySelector(
      "[data-stat-reports]"
    ).textContent =
      `${formatNumber(summary.active_reports)} active reports`;

    document.querySelector(
      "[data-stat-views]"
    ).textContent = formatNumber(
      summary.profile_views
    );

    document.querySelector(
      "[data-stat-clicks]"
    ).textContent =
      `${formatNumber(
        Number(summary.link_clicks) +
        Number(summary.sponsor_clicks)
      )} tracked clicks`;

    document.querySelector(
      "[data-stat-failures]"
    ).textContent = formatNumber(
      summary.notification_failures
    );

    document.querySelector(
      "[data-stat-incomplete]"
    ).textContent = formatNumber(
      summary.incomplete_teams
    );

    document.querySelector(
      "[data-stat-athletes]"
    ).textContent = formatNumber(
      summary.public_athlete_profiles
    );

    document.querySelector(
      "[data-stat-athlete-corrections]"
    ).textContent =
      `${formatNumber(summary.athlete_corrections)} corrections waiting`;
  }

  function renderUpdatedTime() {
    const element = document.querySelector(
      "[data-operations-updated]"
    );

    element.textContent =
      `Updated ${formatDate(
        state.generated_at,
        true
      )} · Ohio date ${formatDate(state.ohio_date)}`;
  }

  function render() {
    renderSummary();
    renderUpdatedTime();
    renderTaskList();
    renderAwards();
    renderUpcomingOverview();
    renderStaticOverview();
    renderMissingResults();
    renderIncompleteMeets();
    renderUpcomingMeetsTable();
    renderClaims();
    renderReports();
    renderScheduleRequests();
    renderIncompleteTeams();
    renderTeamStats();
    renderAthleteFoundation();
    renderDraftContent();
    renderRankingFreshness();
    renderContentStats();
    renderConfiguration();
    renderSubsystems();
    renderNotificationHealth();
    renderSponsorHealth();
    renderSystemIssues();
  }

  async function loadDashboard({
    announce = false
  } = {}) {
    if (busy) {
      return;
    }

    setBusy(true);

    if (announce) {
      showMessage(
        "Refreshing the Operations Center."
      );
    }

    try {
      state = await requestJson(
        "/api/admin/operations",
        {
          method: "POST",
          body: JSON.stringify({
            action: "get_dashboard",
            days: Number(daysSelect.value)
          })
        }
      );

      render();
      loading.hidden = true;
      loginForm.hidden = true;
      dashboard.hidden = false;

      if (state.issues?.length) {
        showMessage(
          `${formatNumber(state.issues.length)} optional system area${state.issues.length === 1 ? " is" : "s are"} unavailable. Open the System tab for details.`,
          "warning"
        );
      } else if (announce) {
        showMessage(
          "The Operations Center is up to date."
        );
      } else {
        showMessage("");
      }
    } catch (error) {
      if (error.status === 401) {
        loading.hidden = true;
        dashboard.hidden = true;
        loginForm.hidden = false;
        loginMessage.textContent =
          "Sign in to open the Operations Center.";
        showMessage("");
      } else {
        loading.innerHTML = `
          <h2>Operations Center unavailable</h2>
          <p>${escapeHtml(error.message)}</p>
          <button
            class="button button-primary"
            type="button"
            data-operations-retry
          >
            Try again
          </button>
        `;
        loading.hidden = false;
        dashboard.hidden = true;

        loading
          .querySelector(
            "[data-operations-retry]"
          )
          ?.addEventListener(
            "click",
            () => loadDashboard()
          );
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkAuthentication() {
    try {
      const session = await requestJson(
        "/api/admin/auth"
      );

      if (session.authenticated) {
        await loadDashboard();
        return;
      }

      loading.hidden = true;
      loginForm.hidden = false;
    } catch (error) {
      loading.innerHTML = `
        <h2>Admin access unavailable</h2>
        <p>${escapeHtml(error.message)}</p>
        <a
          class="button button-primary"
          href="/admin/"
        >
          Return to admin
        </a>
      `;
    }
  }

  document
    .querySelectorAll(
      "[data-operations-tab]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              "[data-operations-tab]"
            )
            .forEach((item) => {
              item.setAttribute(
                "aria-selected",
                String(item === button)
              );
            });

          document
            .querySelectorAll(
              "[data-operations-panel]"
            )
            .forEach((panel) => {
              panel.hidden =
                panel.dataset.operationsPanel !==
                button.dataset.operationsTab;
            });
        }
      );
    });

  loginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (busy) {
        return;
      }

      const formData =
        new FormData(loginForm);
      const password =
        String(
          formData.get("password") || ""
        );

      loginMessage.textContent =
        "Signing in.";
      setBusy(true);

      try {
        await requestJson(
          "/api/admin/auth",
          {
            method: "POST",
            body: JSON.stringify({
              password
            })
          }
        );

        loginForm.reset();
        loginMessage.textContent = "";
        await loadDashboard();
      } catch (error) {
        loginMessage.textContent =
          error.message;
      } finally {
        setBusy(false);
      }
    }
  );

  refreshButton.addEventListener(
    "click",
    () => {
      loadDashboard({
        announce: true
      });
    }
  );

  daysSelect.addEventListener(
    "change",
    () => {
      loadDashboard({
        announce: true
      });
    }
  );

  logoutButton.addEventListener(
    "click",
    async () => {
      if (busy) {
        return;
      }

      setBusy(true);

      try {
        await requestJson(
          "/api/admin/auth",
          {
            method: "POST",
            body: JSON.stringify({})
          }
        );
      } catch {
      } finally {
        state = null;
        dashboard.hidden = true;
        loginForm.hidden = false;
        loginMessage.textContent =
          "You are signed out.";
        showMessage("");
        setBusy(false);
      }
    }
  );

  checkAuthentication();
})();
