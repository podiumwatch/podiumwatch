(() => {
  const statusBox = document.querySelector(
    "[data-meet-detail-status]"
  );

  const detailRoot = document.querySelector(
    "[data-meet-detail]"
  );

  const previewBanner =
    document.querySelector(
      "[data-meet-preview-banner]"
    );

  const bannerImage =
    document.querySelector(
      "[data-meet-banner]"
    );

  const logoImage = document.querySelector(
    "[data-meet-logo]"
  );

  const badgeContainer =
    document.querySelector(
      "[data-meet-badges]"
    );

  const nameElement =
    document.querySelector(
      "[data-meet-name]"
    );

  const descriptionElement =
    document.querySelector(
      "[data-meet-description]"
    );

  const countdownElement =
    document.querySelector(
      "[data-meet-countdown]"
    );

  const factContainer =
    document.querySelector(
      "[data-meet-facts]"
    );

  const primaryActions =
    document.querySelector(
      "[data-primary-meet-actions]"
    );

  const calendarActions =
    document.querySelector(
      "[data-calendar-actions]"
    );

  const shareMessage =
    document.querySelector(
      "[data-share-message]"
    );

  const informationContainer =
    document.querySelector(
      "[data-meet-information]"
    );

  const resultActions =
    document.querySelector(
      "[data-result-actions]"
    );

  const resultEmpty =
    document.querySelector(
      "[data-result-empty]"
    );

  if (
    !statusBox ||
    !detailRoot ||
    !previewBanner ||
    !bannerImage ||
    !logoImage ||
    !badgeContainer ||
    !nameElement ||
    !descriptionElement ||
    !countdownElement ||
    !factContainer ||
    !primaryActions ||
    !calendarActions ||
    !shareMessage ||
    !informationContainer ||
    !resultActions ||
    !resultEmpty
  ) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const slug = String(
    params.get("slug") || ""
  ).trim();

  const previewMode =
    params.get("preview") === "1";

  let currentMeet = null;

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
      const url = new URL(
        cleaned,
        window.location.origin
      );

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

  function formatDate(value) {
    if (!value) {
      return "Not announced";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
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
      return "Not announced";
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

  function meetLocation(meet) {
    return [
      meet.venue_name,
      meet.address,
      meet.city,
      meet.state,
      meet.zip_code
    ]
      .filter(Boolean)
      .join(", ");
  }

  function countdownText(meet) {
    if (!meet.meet_date) {
      return "";
    }

    const time =
      String(
        meet.start_time || "12:00"
      ).slice(0, 5);

    const target = new Date(
      meet.meet_date +
      "T" +
      time +
      ":00"
    );

    if (
      Number.isNaN(
        target.getTime()
      )
    ) {
      return "";
    }

    const difference =
      target.getTime() -
      Date.now();

    const days =
      Math.ceil(
        difference /
        86400000
      );

    if (difference < 0) {
      return "This meet has taken place.";
    }

    if (days <= 1) {
      return "This meet is coming up next.";
    }

    return (
      days +
      (
        days === 1
          ? " day away."
          : " days away."
      )
    );
  }

  function createBadge(
    text,
    dark = false
  ) {
    const span =
      document.createElement("span");

    span.className =
      dark
        ? "meet-detail-badge meet-detail-badge-dark"
        : "meet-detail-badge";

    span.textContent = text;

    return span;
  }

  function createFact(
    label,
    value
  ) {
    const box =
      document.createElement("div");

    box.className =
      "meet-detail-fact";

    const labelElement =
      document.createElement("strong");

    labelElement.textContent =
      label;

    const valueElement =
      document.createElement("p");

    valueElement.textContent =
      value || "Not announced";

    box.append(
      labelElement,
      valueElement
    );

    return box;
  }

  function createLinkButton(
    label,
    url,
    className =
      "button button-outline"
  ) {
    const safe = safeUrl(url);

    if (!safe) {
      return null;
    }

    const link =
      document.createElement("a");

    link.className = className;
    link.href = safe;
    link.target = "_blank";
    link.rel =
      "noopener noreferrer";

    link.textContent = label;

    return link;
  }

  function appendButton(
    container,
    button
  ) {
    if (button) {
      container.appendChild(
        button
      );
    }
  }

  function informationSection(
    title,
    text
  ) {
    if (!text) {
      return null;
    }

    const section =
      document.createElement(
        "section"
      );

    section.className =
      "meet-detail-section";

    const heading =
      document.createElement("h2");

    heading.textContent = title;

    const copy =
      document.createElement("div");

    copy.className =
      "meet-detail-copy";

    copy.textContent = text;

    section.append(
      heading,
      copy
    );

    return section;
  }

  function canonicalMeetUrl() {
    return (
      window.location.origin +
      "/meetdetail/?slug=" +
      encodeURIComponent(
        currentMeet.slug
      )
    );
  }

  function dateStamp(value) {
    return String(value || "")
      .replaceAll("-", "");
  }

  function timeStamp(value) {
    const time = String(
      value || ""
    )
      .slice(0, 5)
      .replace(":", "");

    return time
      ? time + "00"
      : "";
  }

  function nextDate(value) {
    const date = new Date(
      value + "T12:00:00"
    );

    date.setDate(
      date.getDate() + 1
    );

    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  }

  function googleCalendarUrl(meet) {
    const url = new URL(
      "https://calendar.google.com/calendar/render"
    );

    url.searchParams.set(
      "action",
      "TEMPLATE"
    );

    url.searchParams.set(
      "text",
      meet.name
    );

    let dates = "";

    if (meet.start_time) {
      const start =
        dateStamp(
          meet.meet_date
        ) +
        "T" +
        timeStamp(
          meet.start_time
        );

      const startDate =
        new Date(
          meet.meet_date +
          "T" +
          String(
            meet.start_time
          ).slice(0, 5) +
          ":00"
        );

      startDate.setHours(
        startDate.getHours() + 2
      );

      const endYear =
        startDate.getFullYear();

      const endMonth = String(
        startDate.getMonth() + 1
      ).padStart(2, "0");

      const endDay = String(
        startDate.getDate()
      ).padStart(2, "0");

      const endHour = String(
        startDate.getHours()
      ).padStart(2, "0");

      const endMinute = String(
        startDate.getMinutes()
      ).padStart(2, "0");

      const end =
        endYear +
        endMonth +
        endDay +
        "T" +
        endHour +
        endMinute +
        "00";

      dates =
        start +
        "/" +
        end;
    } else {
      const start =
        dateStamp(
          meet.meet_date
        );

      const end =
        dateStamp(
          nextDate(
            meet.end_date ||
            meet.meet_date
          )
        );

      dates =
        start +
        "/" +
        end;
    }

    url.searchParams.set(
      "dates",
      dates
    );

    const location =
      meetLocation(meet);

    if (location) {
      url.searchParams.set(
        "location",
        location
      );
    }

    const details = [
      meet.description,
      canonicalMeetUrl()
    ]
      .filter(Boolean)
      .join("\n\n");

    url.searchParams.set(
      "details",
      details
    );

    return url.href;
  }

  function icsEscape(value) {
    return String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replaceAll("\r\n", "\\n")
      .replaceAll("\n", "\\n");
  }

  function downloadCalendar() {
    const meet = currentMeet;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Podium Watch//Meet Center//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" +
        icsEscape(
          meet.id ||
          meet.slug
        ) +
        "@podiumwatch",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replaceAll("-", "")
          .replaceAll(":", "")
          .replace(/\.\d{3}Z$/, "Z"),
      "SUMMARY:" +
        icsEscape(meet.name)
    ];

    if (meet.start_time) {
      lines.push(
        "DTSTART:" +
        dateStamp(
          meet.meet_date
        ) +
        "T" +
        timeStamp(
          meet.start_time
        )
      );

      const startDate =
        new Date(
          meet.meet_date +
          "T" +
          String(
            meet.start_time
          ).slice(0, 5) +
          ":00"
        );

      startDate.setHours(
        startDate.getHours() + 2
      );

      const end =
        String(
          startDate.getFullYear()
        ) +
        String(
          startDate.getMonth() + 1
        ).padStart(2, "0") +
        String(
          startDate.getDate()
        ).padStart(2, "0") +
        "T" +
        String(
          startDate.getHours()
        ).padStart(2, "0") +
        String(
          startDate.getMinutes()
        ).padStart(2, "0") +
        "00";

      lines.push(
        "DTEND:" + end
      );
    } else {
      lines.push(
        "DTSTART;VALUE=DATE:" +
        dateStamp(
          meet.meet_date
        )
      );

      lines.push(
        "DTEND;VALUE=DATE:" +
        dateStamp(
          nextDate(
            meet.end_date ||
            meet.meet_date
          )
        )
      );
    }

    const location =
      meetLocation(meet);

    if (location) {
      lines.push(
        "LOCATION:" +
        icsEscape(location)
      );
    }

    lines.push(
      "DESCRIPTION:" +
      icsEscape(
        [
          meet.description,
          canonicalMeetUrl()
        ]
          .filter(Boolean)
          .join("\n\n")
      )
    );

    lines.push(
      "URL:" +
      icsEscape(
        canonicalMeetUrl()
      ),
      "END:VEVENT",
      "END:VCALENDAR"
    );

    const blob = new Blob(
      [
        lines.join("\r\n") +
        "\r\n"
      ],
      {
        type:
          "text/calendar;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      currentMeet.slug +
      ".ics";

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  async function copyMeetLink() {
    try {
      await navigator.clipboard.writeText(
        canonicalMeetUrl()
      );

      shareMessage.textContent =
        "Meet link copied.";
    } catch {
      shareMessage.textContent =
        "Copy this address: " +
        canonicalMeetUrl();
    }
  }

  async function shareMeet() {
    if (!navigator.share) {
      await copyMeetLink();
      return;
    }

    try {
      await navigator.share({
        title: currentMeet.name,
        text:
          "View the meet information on Podium Watch.",
        url: canonicalMeetUrl()
      });

      shareMessage.textContent =
        "Meet shared.";
    } catch (error) {
      if (
        error.name !==
        "AbortError"
      ) {
        shareMessage.textContent =
          "The meet could not be shared.";
      }
    }
  }

  function buttonElement(
    label,
    handler,
    className =
      "button button-outline"
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type = "button";
    button.className = className;
    button.textContent = label;

    button.addEventListener(
      "click",
      handler
    );

    return button;
  }

  function renderMeet(meet) {
    currentMeet = meet;

    document.title =
      meet.name +
      " | Podium Watch";

    statusBox.hidden = true;
    detailRoot.hidden = false;

    previewBanner.hidden =
      !(
        previewMode &&
        !meet.published
      );

    const banner =
      safeUrl(
        meet.banner_image_url
      );

    if (banner) {
      bannerImage.src = banner;
      bannerImage.alt =
        meet.name + " banner";
      bannerImage.hidden = false;
    }

    const logo =
      safeUrl(meet.logo_url);

    if (logo) {
      logoImage.src = logo;
      logoImage.alt =
        meet.name + " logo";
      logoImage.hidden = false;
    }

    badgeContainer.innerHTML = "";

    badgeContainer.appendChild(
      createBadge(
        meet.sport || "Meet"
      )
    );

    if (meet.meet_type) {
      badgeContainer.appendChild(
        createBadge(
          meet.meet_type
        )
      );
    }

    if (meet.featured) {
      badgeContainer.appendChild(
        createBadge(
          "Featured",
          true
        )
      );
    }

    if (!meet.published) {
      badgeContainer.appendChild(
        createBadge(
          "Draft",
          true
        )
      );
    }

    nameElement.textContent =
      meet.name;

    if (meet.description) {
      descriptionElement.textContent =
        meet.description;

      descriptionElement.hidden =
        false;
    }

    countdownElement.textContent =
      countdownText(meet);

    factContainer.innerHTML = "";

    factContainer.append(
      createFact(
        "Date",
        formatDateRange(meet)
      ),
      createFact(
        "Start time",
        formatTime(
          meet.start_time
        )
      ),
      createFact(
        "Location",
        meetLocation(meet)
      ),
      createFact(
        "Host",
        meet.host_school
      ),
      createFact(
        "Division",
        meet.division
      ),
      createFact(
        "Meet type",
        meet.meet_type
      )
    );

    primaryActions.innerHTML = "";

    appendButton(
      primaryActions,
      createLinkButton(
        "Directions",
        meet.google_maps_url,
        "button button-primary"
      )
    );

    appendButton(
      primaryActions,
      createLinkButton(
        "Registration",
        meet.registration_url
      )
    );

    appendButton(
      primaryActions,
      createLinkButton(
        "Official website",
        meet.official_website_url
      )
    );

    appendButton(
      primaryActions,
      createLinkButton(
        "Course map",
        meet.course_map_url
      )
    );

    appendButton(
      primaryActions,
      createLinkButton(
        "Parking map",
        meet.parking_map_url
      )
    );

    appendButton(
      primaryActions,
      createLinkButton(
        "Schedule PDF",
        meet.schedule_pdf_url
      )
    );

    calendarActions.innerHTML = "";

    appendButton(
      calendarActions,
      createLinkButton(
        "Add to Google Calendar",
        googleCalendarUrl(meet),
        "button button-primary"
      )
    );

    calendarActions.appendChild(
      buttonElement(
        "Download calendar",
        downloadCalendar
      )
    );

    if (meet.published) {
      calendarActions.appendChild(
        buttonElement(
          "Copy meet link",
          copyMeetLink
        )
      );

      calendarActions.appendChild(
        buttonElement(
          "Share meet",
          shareMeet,
          "button button-dark"
        )
      );
    } else {
      const note =
        document.createElement("p");

      note.textContent =
        "Sharing is available after this meet is published.";

      calendarActions.appendChild(
        note
      );
    }

    informationContainer.innerHTML = "";

    [
      [
        "Race schedule",
        meet.schedule_text
      ],
      [
        "Parking information",
        meet.parking_text
      ],
      [
        "Admission information",
        meet.admission_text
      ],
      [
        "Bus information",
        meet.bus_information
      ],
      [
        "Awards information",
        meet.awards_text
      ],
      [
        "Course information",
        meet.course_description
      ],
      [
        "Teams attending",
        meet.teams_text
      ]
    ].forEach(
      ([title, text]) => {
        const section =
          informationSection(
            title,
            text
          );

        if (section) {
          informationContainer.appendChild(
            section
          );
        }
      }
    );

    resultActions.innerHTML = "";

    [
      [
        "Official results",
        meet.results_url
      ],
      [
        "AthleticNet",
        meet.athleticnet_url
      ],
      [
        "MileSplit",
        meet.milesplit_url
      ],
      [
        "Podium Watch preview",
        meet.preview_article_url
      ],
      [
        "Podium Watch recap",
        meet.recap_article_url
      ],
      [
        "Instagram",
        meet.instagram_url
      ]
    ].forEach(
      ([label, url]) => {
        appendButton(
          resultActions,
          createLinkButton(
            label,
            url
          )
        );
      }
    );

    resultEmpty.hidden =
      resultActions.children.length > 0;
  }

  function showError(
    title,
    message,
    includeAdminLink = false
  ) {
    statusBox.innerHTML = "";

    const heading =
      document.createElement("h2");

    heading.textContent = title;

    const paragraph =
      document.createElement("p");

    paragraph.textContent = message;

    statusBox.append(
      heading,
      paragraph
    );

    if (includeAdminLink) {
      const link =
        document.createElement("a");

      link.className =
        "button button-primary";

      link.href = "/admin/";
      link.textContent =
        "Open admin sign in";

      statusBox.appendChild(link);
    }
  }

  async function loadMeet() {
    if (!slug) {
      showError(
        "Meet not found",
        "This meet link does not include a page slug."
      );

      return;
    }

    const apiUrl =
      previewMode
        ? "/api/admin/meets/"
        : "/api/meets/";

    try {
      const response = await fetch(
        apiUrl,
        {
          credentials:
            previewMode
              ? "same-origin"
              : "omit",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

      const data =
        await response.json();

      if (
        response.status === 401 &&
        previewMode
      ) {
        showError(
          "Admin sign in required",
          "Sign in to the Podium Watch admin area before opening a draft preview.",
          true
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "The meet could not be loaded."
        );
      }

      const meet =
        Array.isArray(data.meets)
          ? data.meets.find(
              (item) =>
                item.slug === slug
            )
          : null;

      if (!meet) {
        showError(
          "Meet not found",
          previewMode
            ? "This draft may have been deleted or renamed."
            : "This meet is not published or the link is no longer active."
        );

        return;
      }

      renderMeet(meet);
    } catch (error) {
      console.error(
        "Meet detail error:",
        error
      );

      showError(
        "Meet page unavailable",
        error.message
      );
    }
  }

  loadMeet();
})();