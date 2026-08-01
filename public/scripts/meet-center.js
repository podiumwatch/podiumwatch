(() => {
  const searchInput = document.querySelector(
    "[data-public-meet-search]"
  );

  const sportFilter = document.querySelector(
    "[data-public-meet-sport]"
  );

  const yearFilter = document.querySelector(
    "[data-public-meet-year]"
  );

  const cityFilter = document.querySelector(
    "[data-public-meet-city]"
  );

  const divisionFilter = document.querySelector(
    "[data-public-meet-division]"
  );

  const typeFilter = document.querySelector(
    "[data-public-meet-type]"
  );

  const clearButton = document.querySelector(
    "[data-clear-public-meet-filters]"
  );

  const totalCount = document.querySelector(
    "[data-public-meet-count]"
  );

  const statusBox = document.querySelector(
    "[data-meet-center-status]"
  );

  const upcomingSection =
    document.querySelector(
      "[data-upcoming-meet-section]"
    );

  const upcomingCount =
    document.querySelector(
      "[data-upcoming-meet-count]"
    );

  const upcomingList =
    document.querySelector(
      "[data-upcoming-meet-list]"
    );

  const completedSection =
    document.querySelector(
      "[data-completed-meet-section]"
    );

  const completedCount =
    document.querySelector(
      "[data-completed-meet-count]"
    );

  const completedList =
    document.querySelector(
      "[data-completed-meet-list]"
    );

  if (
    !searchInput ||
    !sportFilter ||
    !yearFilter ||
    !cityFilter ||
    !divisionFilter ||
    !typeFilter ||
    !clearButton ||
    !totalCount ||
    !statusBox ||
    !upcomingSection ||
    !upcomingCount ||
    !upcomingList ||
    !completedSection ||
    !completedCount ||
    !completedList
  ) {
    return;
  }

  let meets = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function dateKey(value) {
    return String(value || "")
      .slice(0, 10);
  }

  function todayKey() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  }

  function isCompleted(meet) {
    const finalDate =
      dateKey(
        meet.end_date ||
        meet.meet_date
      );

    return Boolean(
      finalDate &&
      finalDate < todayKey()
    );
  }

  function formatDate(value) {
    if (!value) {
      return "Date not announced";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    ).format(
      new Date(
        value + "T12:00:00"
      )
    );
  }

  function formatDateRange(meet) {
    if (
      meet.end_date &&
      meet.end_date !== meet.meet_date
    ) {
      return (
        formatDate(meet.meet_date) +
        " through " +
        formatDate(meet.end_date)
      );
    }

    return formatDate(
      meet.meet_date
    );
  }

  function formatTime(value) {
    if (!value) {
      return "";
    }

    const parts = String(value)
      .slice(0, 5)
      .split(":")
      .map(Number);

    if (parts.length !== 2) {
      return value;
    }

    const date = new Date();

    date.setHours(
      parts[0],
      parts[1],
      0,
      0
    );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }

  function locationText(meet) {
    return [
      meet.venue_name,
      meet.city,
      meet.state
    ]
      .filter(Boolean)
      .join(", ");
  }

  function meetCard(meet, completed) {
    const badges = [];

    if (meet.featured) {
      badges.push(
        '<span class="meet-badge meet-badge-featured">' +
          "Featured" +
        "</span>"
      );
    }

    badges.push(
      '<span class="meet-badge">' +
        escapeHtml(
          meet.sport || "Meet"
        ) +
      "</span>"
    );

    if (meet.meet_type) {
      badges.push(
        '<span class="meet-badge">' +
          escapeHtml(
            meet.meet_type
          ) +
        "</span>"
      );
    }

    badges.push(
      '<span class="meet-badge meet-badge-dark">' +
        (
          completed
            ? "Completed"
            : "Upcoming"
        ) +
      "</span>"
    );

    const details = [
      '<p><strong>' +
        escapeHtml(
          formatDateRange(meet)
        ) +
      "</strong></p>"
    ];

    const time =
      formatTime(meet.start_time);

    if (time) {
      details.push(
        "<p>" +
          escapeHtml(time) +
        "</p>"
      );
    }

    const location =
      locationText(meet);

    if (location) {
      details.push(
        "<p>" +
          escapeHtml(location) +
        "</p>"
      );
    }

    if (meet.host_school) {
      details.push(
        "<p>Hosted by " +
          escapeHtml(
            meet.host_school
          ) +
        "</p>"
      );
    }

    if (meet.division) {
      details.push(
        "<p>" +
          escapeHtml(
            meet.division
          ) +
        "</p>"
      );
    }

    return (
      '<article class="story-card">' +
        '<div class="story-card-body">' +
          '<div class="meet-card-meta">' +
            badges.join("") +
          "</div>" +
          "<h3>" +
            escapeHtml(meet.name) +
          "</h3>" +
          (
            meet.description
              ? "<p>" +
                  escapeHtml(
                    meet.description
                  ) +
                "</p>"
              : ""
          ) +
          '<div class="meet-card-details">' +
            details.join("") +
          "</div>" +
          '<a class="button button-primary" href="/meetdetail/?slug=' +
            encodeURIComponent(
              meet.slug
            ) +
          '">' +
            (
              completed
                ? "View meet details"
                : "Open meet page"
            ) +
          "</a>" +
        "</div>" +
      "</article>"
    );
  }

  function emptyCard(message) {
    return (
      '<div class="info-card meet-empty">' +
        "<h3>" +
          escapeHtml(message) +
        "</h3>" +
        "<p>Try changing or clearing the filters.</p>" +
      "</div>"
    );
  }

  function populateFilter(
    element,
    values,
    defaultLabel
  ) {
    const currentValue =
      element.value;

    element.innerHTML = "";

    const defaultOption =
      document.createElement(
        "option"
      );

    defaultOption.value = "";
    defaultOption.textContent =
      defaultLabel;

    element.appendChild(
      defaultOption
    );

    values.forEach((value) => {
      const option =
        document.createElement(
          "option"
        );

      option.value = value;
      option.textContent = value;

      element.appendChild(
        option
      );
    });

    if (
      values.includes(
        currentValue
      )
    ) {
      element.value =
        currentValue;
    }
  }

  function populateFilters() {
    const years = [
      ...new Set(
        meets
          .map((meet) =>
            String(
              meet.year || ""
            )
          )
          .filter(Boolean)
      )
    ].sort(
      (first, second) =>
        Number(second) -
        Number(first)
    );

    const cities = [
      ...new Set(
        meets
          .map((meet) =>
            String(
              meet.city || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ].sort();

    const divisions = [
      ...new Set(
        meets
          .map((meet) =>
            String(
              meet.division || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ].sort();

    const types = [
      ...new Set(
        meets
          .map((meet) =>
            String(
              meet.meet_type || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ].sort();

    populateFilter(
      yearFilter,
      years,
      "All years"
    );

    populateFilter(
      cityFilter,
      cities,
      "All cities"
    );

    populateFilter(
      divisionFilter,
      divisions,
      "All divisions"
    );

    populateFilter(
      typeFilter,
      types,
      "All meet types"
    );
  }

  function filteredMeets() {
    const query = normalize(
      searchInput.value
    );

    return meets.filter((meet) => {
      const searchText = normalize(
        [
          meet.name,
          meet.host_school,
          meet.venue_name,
          meet.city,
          meet.state,
          meet.division,
          meet.meet_type,
          meet.sport
        ].join(" ")
      );

      const matchesSearch =
        !query ||
        searchText.includes(query);

      const matchesSport =
        !sportFilter.value ||
        meet.sport ===
          sportFilter.value;

      const matchesYear =
        !yearFilter.value ||
        String(meet.year) ===
          yearFilter.value;

      const matchesCity =
        !cityFilter.value ||
        meet.city ===
          cityFilter.value;

      const matchesDivision =
        !divisionFilter.value ||
        meet.division ===
          divisionFilter.value;

      const matchesType =
        !typeFilter.value ||
        meet.meet_type ===
          typeFilter.value;

      return (
        matchesSearch &&
        matchesSport &&
        matchesYear &&
        matchesCity &&
        matchesDivision &&
        matchesType
      );
    });
  }

  function render() {
    const shownMeets =
      filteredMeets();

    const upcoming =
      shownMeets
        .filter(
          (meet) =>
            !isCompleted(meet)
        )
        .sort(
          (first, second) =>
            dateKey(
              first.meet_date
            ).localeCompare(
              dateKey(
                second.meet_date
              )
            )
        );

    const completed =
      shownMeets
        .filter(isCompleted)
        .sort(
          (first, second) =>
            dateKey(
              second.meet_date
            ).localeCompare(
              dateKey(
                first.meet_date
              )
            )
        );

    totalCount.textContent =
      shownMeets.length +
      " of " +
      meets.length +
      (
        meets.length === 1
          ? " meet shown"
          : " meets shown"
      );

    upcomingCount.textContent =
      upcoming.length +
      (
        upcoming.length === 1
          ? " meet"
          : " meets"
      );

    completedCount.textContent =
      completed.length +
      (
        completed.length === 1
          ? " meet"
          : " meets"
      );

    upcomingList.innerHTML =
      upcoming.length > 0
        ? upcoming
            .map((meet) =>
              meetCard(
                meet,
                false
              )
            )
            .join("")
        : emptyCard(
            "No upcoming meets match."
          );

    completedList.innerHTML =
      completed.length > 0
        ? completed
            .map((meet) =>
              meetCard(
                meet,
                true
              )
            )
            .join("")
        : emptyCard(
            "No completed meets match."
          );

    statusBox.hidden = true;
    upcomingSection.hidden = false;
    completedSection.hidden = false;
  }

  function clearFilters() {
    searchInput.value = "";
    sportFilter.value = "";
    yearFilter.value = "";
    cityFilter.value = "";
    divisionFilter.value = "";
    typeFilter.value = "";

    render();
    searchInput.focus();
  }

  [
    searchInput,
    sportFilter,
    yearFilter,
    cityFilter,
    divisionFilter,
    typeFilter
  ].forEach((control) => {
    control.addEventListener(
      control === searchInput
        ? "input"
        : "change",
      render
    );
  });

  clearButton.addEventListener(
    "click",
    clearFilters
  );

  async function loadMeets() {
    try {
      const response = await fetch(
        "/api/meets/",
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "The Meet Center could not be loaded."
        );
      }

      meets =
        Array.isArray(data.meets)
          ? data.meets
          : [];

      populateFilters();
      render();
    } catch (error) {
      console.error(
        "Meet Center error:",
        error
      );

      totalCount.textContent =
        "Unable to load meets";

      statusBox.innerHTML =
        "<h2>Meet Center unavailable</h2>" +
        "<p>" +
          escapeHtml(
            error.message
          ) +
        "</p>" +
        "<button class=\"button button-primary\" type=\"button\" data-retry-meets>" +
          "Try again" +
        "</button>";

      const retryButton =
        statusBox.querySelector(
          "[data-retry-meets]"
        );

      retryButton?.addEventListener(
        "click",
        () => {
          statusBox.innerHTML =
            "<h2>Loading the Meet Center</h2>" +
            "<p>Please wait while the meet information loads.</p>";

          loadMeets();
        }
      );
    }
  }

  loadMeets();
})();