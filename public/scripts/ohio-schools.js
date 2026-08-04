(() => {
  const root = document.querySelector(
    "[data-ohio-schools-page]"
  );

  if (!root) {
    return;
  }

  const form = root.querySelector(
    "[data-ohio-schools-form]"
  );
  const clearButton = root.querySelector(
    "[data-ohio-schools-clear]"
  );
  const message = root.querySelector(
    "[data-ohio-schools-message]"
  );
  const count = root.querySelector(
    "[data-ohio-schools-count]"
  );
  const tableBody = root.querySelector(
    "[data-ohio-schools-table-body]"
  );
  const mobileList = root.querySelector(
    "[data-ohio-schools-mobile-list]"
  );
  const empty = root.querySelector(
    "[data-ohio-schools-empty]"
  );
  const pagination = root.querySelector(
    "[data-ohio-schools-pagination]"
  );
  const previousButton = root.querySelector(
    "[data-ohio-schools-prev]"
  );
  const nextButton = root.querySelector(
    "[data-ohio-schools-next]"
  );
  const pageStatus = root.querySelector(
    "[data-ohio-schools-page-status]"
  );

  if (
    !form ||
    !clearButton ||
    !message ||
    !count ||
    !tableBody ||
    !mobileList ||
    !empty ||
    !pagination ||
    !previousButton ||
    !nextButton ||
    !pageStatus
  ) {
    return;
  }

  let busy = false;
  let currentPage = 1;
  const pageSize = 100;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function setBusy(value) {
    busy = value;

    form
      .querySelectorAll("button, input, select")
      .forEach((element) => {
        element.disabled = value;
      });

    clearButton.disabled = value;
    previousButton.disabled = value || previousButton.dataset.disabled === "true";
    nextButton.disabled = value || nextButton.dataset.disabled === "true";
  }

  function changedDivision(school) {
    return String(school.division || "") !==
      String(school.previous_division || "");
  }

  function teamLink(school) {
    if (school.team_slug) {
      return (
        '<a class="text-link" href="/team/?slug=' +
          encodeURIComponent(school.team_slug) +
        '">View team</a>'
      );
    }

    return (
      '<a class="text-link" href="/claim-your-team/?school=' +
        encodeURIComponent(school.school_name || "") +
      '">Claim team</a>'
    );
  }

  function divisionMarkup(school) {
    const changed = changedDivision(school);

    return (
      '<span class="ohio-school-badge' +
        (
          changed
            ? " ohio-school-badge-change"
            : ""
        ) +
      '">' +
        escapeHtml(school.division || "Not listed") +
      "</span>" +
      (
        changed
          ? '<div style="margin-top:6px;font-size:.78rem;font-weight:800;">Changed from ' +
              escapeHtml(school.previous_division || "Not listed") +
            "</div>"
          : ""
      )
    );
  }

  function rowMarkup(school) {
    return (
      "<tr>" +
        '<td><span class="ohio-school-name">' +
          escapeHtml(school.school_name) +
        "</span><br><small>OHSAA ID " +
          escapeHtml(school.ohsaa_school_id) +
        "</small></td>" +
        "<td>" + escapeHtml(school.city) + "</td>" +
        "<td>" + escapeHtml(school.athletic_district) + "</td>" +
        "<td>" + divisionMarkup(school) + "</td>" +
        "<td>" + escapeHtml(school.previous_division || "Not listed") + "</td>" +
        "<td>" + escapeHtml(school.base_enrollment ?? "Not listed") + "</td>" +
        "<td>" + teamLink(school) + "</td>" +
      "</tr>"
    );
  }

  function cardMarkup(school) {
    return (
      '<article class="ohio-school-card">' +
        "<div>" +
          "<h3>" + escapeHtml(school.school_name) + "</h3>" +
          "<p>" +
            escapeHtml(school.city) +
            " | OHSAA ID " +
            escapeHtml(school.ohsaa_school_id) +
          "</p>" +
        "</div>" +
        divisionMarkup(school) +
        '<div class="ohio-school-card-grid">' +
          "<div><span>District</span><strong>" +
            escapeHtml(school.athletic_district) +
          "</strong></div>" +
          "<div><span>Boys enrollment</span><strong>" +
            escapeHtml(school.base_enrollment ?? "Not listed") +
          "</strong></div>" +
        "</div>" +
        teamLink(school) +
      "</article>"
    );
  }

  function updateStats(summary) {
    const mapping = [
      ["[data-ohio-stat-schools]", summary.schoolCount],
      ["[data-ohio-stat-d1]", summary.divisions?.["Division I"]],
      ["[data-ohio-stat-d2]", summary.divisions?.["Division II"]],
      ["[data-ohio-stat-d3]", summary.divisions?.["Division III"]],
      ["[data-ohio-stat-d4]", summary.divisions?.["Division IV"]],
      ["[data-ohio-stat-moved]", summary.changedDivisionCount]
    ];

    mapping.forEach(([selector, value]) => {
      const element = root.querySelector(selector);

      if (element && Number.isFinite(Number(value))) {
        element.textContent = String(value);
      }
    });
  }

  function render(data) {
    const schools = Array.isArray(data.schools)
      ? data.schools
      : [];

    count.textContent = String(data.total ?? schools.length);
    tableBody.innerHTML = schools.map(rowMarkup).join("");
    mobileList.innerHTML = schools.map(cardMarkup).join("");
    empty.hidden = schools.length > 0;

    const total = Number(data.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    currentPage = Math.min(
      Math.max(1, Number(data.page || currentPage)),
      totalPages
    );
    pageStatus.textContent =
      "Page " + currentPage + " of " + totalPages;
    previousButton.dataset.disabled =
      currentPage <= 1 ? "true" : "false";
    nextButton.dataset.disabled =
      currentPage >= totalPages ? "true" : "false";
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
    pagination.hidden = total === 0;

    if (data.summary) {
      updateStats(data.summary);
    }

    const sourceMode = data.database_available
      ? "linked with current Podium Watch team pages"
      : "loaded from the bundled official source";

    setMessage(
      (data.total ?? schools.length) +
        " schools found. Data was " +
        sourceMode +
        "."
    );
  }

  async function loadSchools() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage("Loading official Ohio school data.");

    const values = new FormData(form);
    const payload = {
      search: String(values.get("search") || "").trim(),
      division: String(values.get("division") || "").trim(),
      athletic_district: String(
        values.get("athletic_district") || ""
      ).trim(),
      changed_only: String(
        values.get("changed_only") || "false"
      ),
      page: currentPage,
      limit: pageSize
    };

    const url = new URL(window.location.href);

    [
      "search",
      "division",
      "athletic_district",
      "changed_only",
      "page"
    ].forEach((name) => {
      const value = String(payload[name] || "");

      if (
        value &&
        !(name === "changed_only" && value === "false") &&
        !(name === "page" && value === "1")
      ) {
        url.searchParams.set(name, value);
      } else {
        url.searchParams.delete(name);
      }
    });

    window.history.replaceState(null, "", url);

    try {
      const response = await fetch(
        "/api/ohio-schools/",
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
          "The Ohio school directory could not be loaded."
        );
      }

      render(data);
    } catch (error) {
      tableBody.innerHTML = "";
      mobileList.innerHTML = "";
      empty.hidden = false;
      count.textContent = "0";
      setMessage(
        error.message ||
        "The Ohio school directory could not be loaded.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    loadSchools();
  });


  previousButton.addEventListener("click", () => {
    if (busy || currentPage <= 1) {
      return;
    }

    currentPage -= 1;
    loadSchools();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  nextButton.addEventListener("click", () => {
    if (busy || nextButton.dataset.disabled === "true") {
      return;
    }

    currentPage += 1;
    loadSchools();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  clearButton.addEventListener("click", () => {
    if (busy) {
      return;
    }

    form.reset();
    currentPage = 1;

    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url);

    loadSchools();
  });

  const initialParameters = new URLSearchParams(
    window.location.search
  );
  currentPage = Math.max(
    1,
    Number.parseInt(
      initialParameters.get("page") || "1",
      10
    ) || 1
  );

  const initialValues = {
    search: initialParameters.get("search") || "",
    division: initialParameters.get("division") || "",
    athletic_district:
      initialParameters.get("athletic_district") || "",
    changed_only:
      initialParameters.get("changed_only") || "false"
  };

  Object.entries(initialValues).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);

    if (field && value) {
      field.value = value;
    }
  });

  loadSchools();
})();
