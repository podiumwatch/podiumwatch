(() => {
  const meetList = document.querySelector(
    "[data-admin-meet-list]"
  );

  const searchInput = document.querySelector(
    "[data-meet-search]"
  );

  const sportFilter = document.querySelector(
    "[data-meet-sport-filter]"
  );

  const statusFilter = document.querySelector(
    "[data-meet-status-filter]"
  );

  const featuredFilter = document.querySelector(
    "[data-meet-featured-filter]"
  );

  const yearFilter = document.querySelector(
    "[data-meet-year-filter]"
  );

  const sortSelect = document.querySelector(
    "[data-meet-sort]"
  );

  const clearFiltersButton =
    document.querySelector(
      "[data-clear-meet-filters]"
    );

  const exportButton = document.querySelector(
    "[data-export-meets]"
  );

  const filteredCount = document.querySelector(
    "[data-filtered-meet-count]"
  );

  const emptyMessage = document.querySelector(
    "[data-meet-filter-empty]"
  );

  if (
    !meetList ||
    !searchInput ||
    !sportFilter ||
    !statusFilter ||
    !featuredFilter ||
    !yearFilter ||
    !sortSelect ||
    !clearFiltersButton ||
    !exportButton ||
    !filteredCount ||
    !emptyMessage
  ) {
    return;
  }

  let meets = [];

  const exportHeaders = [
    "id",
    "created_at",
    "name",
    "slug",
    "year",
    "sport",
    "meet_date",
    "start_time",
    "end_date",
    "venue_name",
    "address",
    "city",
    "state",
    "zip_code",
    "google_maps_url",
    "meet_type",
    "division",
    "host_school",
    "description",
    "schedule_text",
    "admission_text",
    "parking_text",
    "bus_information",
    "awards_text",
    "course_description",
    "teams_text",
    "results_url",
    "athleticnet_url",
    "milesplit_url",
    "registration_url",
    "official_website_url",
    "course_map_url",
    "parking_map_url",
    "schedule_pdf_url",
    "logo_url",
    "banner_image_url",
    "preview_article_url",
    "recap_article_url",
    "instagram_url",
    "featured",
    "published",
    "updated_at"
  ];

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function compareText(first, second) {
    return String(first || "")
      .localeCompare(
        String(second || ""),
        "en",
        {
          sensitivity: "base"
        }
      );
  }

  function getMeetCards() {
    return Array.from(
      meetList.querySelectorAll(
        "[data-meet-card]"
      )
    );
  }

  function getSortValue(card, field) {
    return card.dataset[field] || "";
  }

  function sortCards(cards) {
    const sortValue = sortSelect.value;

    cards.sort((first, second) => {
      if (
        sortValue ===
        "date-descending"
      ) {
        return compareText(
          getSortValue(
            second,
            "meetDate"
          ),
          getSortValue(
            first,
            "meetDate"
          )
        );
      }

      if (
        sortValue ===
        "name-ascending"
      ) {
        return compareText(
          getSortValue(
            first,
            "meetName"
          ),
          getSortValue(
            second,
            "meetName"
          )
        );
      }

      if (
        sortValue ===
        "city-ascending"
      ) {
        const cityResult = compareText(
          getSortValue(
            first,
            "meetCity"
          ),
          getSortValue(
            second,
            "meetCity"
          )
        );

        if (cityResult !== 0) {
          return cityResult;
        }

        return compareText(
          getSortValue(
            first,
            "meetName"
          ),
          getSortValue(
            second,
            "meetName"
          )
        );
      }

      return compareText(
        getSortValue(
          first,
          "meetDate"
        ),
        getSortValue(
          second,
          "meetDate"
        )
      );
    });

    cards.forEach((card) => {
      meetList.appendChild(card);
    });
  }

  function getVisibleMeetIds() {
    return getMeetCards()
      .filter((card) => !card.hidden)
      .map((card) => card.dataset.meetId)
      .filter(Boolean);
  }

  function applyFilters() {
    const query = normalize(
      searchInput.value
    );

    const selectedSport =
      sportFilter.value;

    const selectedStatus =
      statusFilter.value;

    const selectedFeatured =
      featuredFilter.value;

    const selectedYear =
      yearFilter.value;

    const cards = getMeetCards();

    cards.forEach((card) => {
      const searchText = normalize(
        [
          card.dataset.meetName,
          card.dataset.meetCity,
          card.dataset.meetHost,
          card.dataset.meetVenue
        ].join(" ")
      );

      const matchesSearch =
        !query ||
        searchText.includes(query);

      const matchesSport =
        !selectedSport ||
        card.dataset.meetSport ===
          selectedSport;

      const matchesStatus =
        !selectedStatus ||
        card.dataset.meetStatus ===
          selectedStatus;

      const matchesFeatured =
        !selectedFeatured ||
        card.dataset.meetFeatured ===
          selectedFeatured;

      const matchesYear =
        !selectedYear ||
        card.dataset.meetYear ===
          selectedYear;

      card.hidden = !(
        matchesSearch &&
        matchesSport &&
        matchesStatus &&
        matchesFeatured &&
        matchesYear
      );
    });

    sortCards(cards);

    const visibleTotal =
      cards.filter(
        (card) => !card.hidden
      ).length;

    filteredCount.textContent =
      visibleTotal +
      " of " +
      cards.length +
      (
        cards.length === 1
          ? " meet shown"
          : " meets shown"
      );

    emptyMessage.hidden =
      visibleTotal !== 0;

    exportButton.disabled =
      visibleTotal === 0;
  }

  function populateYearFilter() {
    const selectedValue =
      yearFilter.value;

    const years = [
      ...new Set(
        meets
          .map((meet) =>
            String(meet.year || "")
          )
          .filter(Boolean)
      )
    ].sort(
      (first, second) =>
        Number(second) -
        Number(first)
    );

    yearFilter.innerHTML = "";

    const allYearsOption =
      document.createElement("option");

    allYearsOption.value = "";
    allYearsOption.textContent =
      "All years";

    yearFilter.appendChild(
      allYearsOption
    );

    years.forEach((year) => {
      const option =
        document.createElement(
          "option"
        );

      option.value = year;
      option.textContent = year;

      yearFilter.appendChild(option);
    });

    if (
      years.includes(selectedValue)
    ) {
      yearFilter.value =
        selectedValue;
    }
  }

  function csvCell(value) {
    return (
      '"' +
      String(value ?? "")
        .replaceAll('"', '""') +
      '"'
    );
  }

  function exportShownMeets() {
    const visibleIds =
      new Set(
        getVisibleMeetIds()
      );

    const meetsToExport =
      meets.filter(
        (meet) =>
          visibleIds.has(meet.id)
      );

    if (
      meetsToExport.length === 0
    ) {
      return;
    }

    const lines = [
      exportHeaders
        .map(csvCell)
        .join(",")
    ];

    meetsToExport.forEach((meet) => {
      lines.push(
        exportHeaders
          .map((header) =>
            csvCell(meet[header])
          )
          .join(",")
      );
    });

    const blob = new Blob(
      [
        lines.join("\r\n") +
        "\r\n"
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    const currentDate =
      new Date()
        .toISOString()
        .slice(0, 10);

    link.href = url;
    link.download =
      "podium-watch-meets-" +
      currentDate +
      ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    searchInput.value = "";
    sportFilter.value = "";
    statusFilter.value = "";
    featuredFilter.value = "";
    yearFilter.value = "";
    sortSelect.value =
      "date-ascending";

    applyFilters();
    searchInput.focus();
  }

  [
    searchInput,
    sportFilter,
    statusFilter,
    featuredFilter,
    yearFilter,
    sortSelect
  ].forEach((control) => {
    control.addEventListener(
      control === searchInput
        ? "input"
        : "change",
      applyFilters
    );
  });

  clearFiltersButton.addEventListener(
    "click",
    clearFilters
  );

  exportButton.addEventListener(
    "click",
    exportShownMeets
  );

  document.addEventListener(
    "podiumadminmeetsloaded",
    (event) => {
      meets =
        Array.isArray(
          event.detail?.meets
        )
          ? event.detail.meets
          : [];

      populateYearFilter();

      window.setTimeout(
        applyFilters,
        0
      );
    }
  );

  if (
    Array.isArray(
      window.podiumAdminMeets
    )
  ) {
    meets =
      window.podiumAdminMeets;

    populateYearFilter();
    applyFilters();
  }
})();