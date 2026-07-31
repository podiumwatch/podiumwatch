import { layout } from "../lib/html.mjs";

export function meetDetailPage(site) {
  const content = `
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <p class="eyebrow" data-meet-sport>Podium Watch Meet Center</p>
        <h1 data-meet-name>Loading meet...</h1>
        <p class="hero-text" data-meet-description>
          Meet information is loading.
        </p>

        <div class="hero-actions" data-meet-actions></div>
      </div>

      <div class="hero-logo-panel">
        <img
          data-meet-logo
          src="${site.logo}"
          alt=""
          width="520"
          height="520"
        >
        <p data-meet-countdown>Loading meet date...</p>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container">
      <div class="content-grid">
        <div>
          <p class="eyebrow">Meet details</p>
          <h2 data-meet-date>Date to be announced</h2>
          <p data-meet-location></p>
          <p data-meet-host></p>
        </div>

        <div class="info-card">
          <h3>Quick information</h3>
          <p data-meet-type></p>
          <p data-meet-division></p>
          <p data-meet-time></p>
        </div>
      </div>

      <div
        class="content-grid"
        style="margin-top: 34px"
        data-information-grid
      >
        <article class="info-card" data-section="schedule" hidden>
          <p class="eyebrow">Schedule</p>
          <h2>Race schedule</h2>
          <p data-meet-schedule></p>
        </article>

        <article class="info-card" data-section="parking" hidden>
          <p class="eyebrow">Parking</p>
          <h2>Arrival information</h2>
          <p data-meet-parking></p>
        </article>

        <article class="info-card" data-section="admission" hidden>
          <p class="eyebrow">Admission</p>
          <h2>Spectator information</h2>
          <p data-meet-admission></p>
        </article>

        <article class="info-card" data-section="bus" hidden>
          <p class="eyebrow">Teams</p>
          <h2>Bus information</h2>
          <p data-meet-bus></p>
        </article>

        <article class="info-card" data-section="awards" hidden>
          <p class="eyebrow">Awards</p>
          <h2>Awards information</h2>
          <p data-meet-awards></p>
        </article>

        <article class="info-card" data-section="course" hidden>
          <p class="eyebrow">Course</p>
          <h2>Course information</h2>
          <p data-meet-course></p>
        </article>
      </div>

      <div
        class="empty-state"
        data-meet-error
        hidden
        style="margin-top: 34px"
      >
        <div class="empty-state-mark">PW</div>
        <h2>Meet information unavailable</h2>
        <p data-meet-error-message>
          This meet could not be loaded.
        </p>
        <a class="button button-dark" href="/meets/">
          Return to Meet Center
        </a>
      </div>
    </div>
  </section>

  <script>
    (() => {
      const pageParts = window.location.pathname
        .split("/")
        .filter(Boolean);

      const querySlug = new URLSearchParams(
        window.location.search
      ).get("slug");

      const slug = String(
        querySlug ||
        pageParts[pageParts.length - 1] ||
        ""
      ).trim();

      function escapeText(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function formatDate(value) {
        if (!value) {
          return "Date to be announced";
        }

        return new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(new Date(value + "T12:00:00"));
      }

      function formatTime(value) {
        if (!value) {
          return "";
        }

        const parts = String(value).split(":");
        const hour = Number(parts[0]);
        const minute = parts[1] || "00";
        const suffix = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;

        return displayHour + ":" + minute + " " + suffix;
      }

      function setText(selector, value) {
        const element = document.querySelector(selector);

        if (element) {
          element.textContent = value || "";
        }
      }

      function showSection(name, selector, value) {
        if (!value) {
          return;
        }

        const section = document.querySelector(
          '[data-section="' + name + '"]'
        );

        const content = document.querySelector(selector);

        if (section && content) {
          section.hidden = false;
          content.innerHTML = escapeText(value)
            .replaceAll("\\n", "<br>");
        }
      }

      function safeUrl(value) {
        if (!value) {
          return "";
        }

        try {
          const parsed = new URL(value, window.location.origin);

          if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
          ) {
            return parsed.href;
          }
        } catch {
          return "";
        }

        return "";
      }

      function addButton(container, label, value, primary = false) {
        const url = safeUrl(value);

        if (!url) {
          return;
        }

        const link = document.createElement("a");
        link.className = primary
          ? "button button-primary"
          : "button button-outline";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;

        container.appendChild(link);
      }

      function setCountdown(meet) {
        if (!meet.meet_date) {
          setText("[data-meet-countdown]", "Date to be announced");
          return;
        }

        const meetTime = meet.start_time || "00:00:00";
        const meetDate = new Date(
          meet.meet_date + "T" + meetTime
        );

        const difference = meetDate.getTime() - Date.now();
        const days = Math.ceil(
          difference / (1000 * 60 * 60 * 24)
        );

        if (days > 1) {
          setText(
            "[data-meet-countdown]",
            days + " days until race day"
          );
        } else if (days === 1) {
          setText(
            "[data-meet-countdown]",
            "Race day is tomorrow"
          );
        } else if (days === 0) {
          setText(
            "[data-meet-countdown]",
            "Race day is here"
          );
        } else {
          setText(
            "[data-meet-countdown]",
            "Meet complete"
          );
        }
      }

      async function loadMeet() {
        try {
          if (!slug || slug === "meetdetail") {
            throw new Error("Meet address is missing.");
          }

          const response = await fetch("/api/meets/");

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || "Meet could not be loaded."
            );
          }

          const meet = Array.isArray(data.meets)
            ? data.meets.find(
                (item) =>
                  String(item.slug || "").trim() === slug
              )
            : null;

          if (!meet) {
            throw new Error("Meet not found.");
          }

          document.title =
            meet.name + " | Podium Watch";

          setText(
            "[data-meet-sport]",
            meet.sport || "Podium Watch Meet Center"
          );

          setText("[data-meet-name]", meet.name);

          setText(
            "[data-meet-description]",
            meet.description ||
              "Complete meet information from Podium Watch."
          );

          setText(
            "[data-meet-date]",
            formatDate(meet.meet_date)
          );

          const location = [
            meet.venue_name,
            meet.address,
            meet.city,
            meet.state,
            meet.zip_code
          ]
            .filter(Boolean)
            .join(", ");

          setText("[data-meet-location]", location);

          setText(
            "[data-meet-host]",
            meet.host_school
              ? "Hosted by " + meet.host_school
              : ""
          );

          setText(
            "[data-meet-type]",
            meet.meet_type
              ? "Meet type: " + meet.meet_type
              : ""
          );

          setText(
            "[data-meet-division]",
            meet.division
              ? "Division: " + meet.division
              : ""
          );

          setText(
            "[data-meet-time]",
            meet.start_time
              ? "Starting time: " +
                  formatTime(meet.start_time)
              : ""
          );

          const logo = document.querySelector(
            "[data-meet-logo]"
          );

          if (logo && meet.logo_url) {
            logo.src = safeUrl(meet.logo_url);
            logo.alt = meet.name + " logo";
          }

          const actions = document.querySelector(
            "[data-meet-actions]"
          );

          addButton(
            actions,
            "View Results",
            meet.results_url,
            true
          );

          addButton(
            actions,
            "AthleticNet Results",
            meet.athleticnet_url
          );

          addButton(
            actions,
            "MileSplit Results",
            meet.milesplit_url
          );

          addButton(
            actions,
            "Directions",
            meet.google_maps_url
          );

          addButton(
            actions,
            "Course Map",
            meet.course_map_url
          );

          addButton(
            actions,
            "Parking Map",
            meet.parking_map_url
          );

          addButton(
            actions,
            "Meet Schedule",
            meet.schedule_pdf_url
          );

          addButton(
            actions,
            "Registration",
            meet.registration_url
          );

          showSection(
            "schedule",
            "[data-meet-schedule]",
            meet.schedule_text
          );

          showSection(
            "parking",
            "[data-meet-parking]",
            meet.parking_text
          );

          showSection(
            "admission",
            "[data-meet-admission]",
            meet.admission_text
          );

          showSection(
            "bus",
            "[data-meet-bus]",
            meet.bus_information
          );

          showSection(
            "awards",
            "[data-meet-awards]",
            meet.awards_text
          );

          showSection(
            "course",
            "[data-meet-course]",
            meet.course_description
          );

          setCountdown(meet);
        } catch (error) {
          console.error("Meet page error:", error);

          const errorBox = document.querySelector(
            "[data-meet-error]"
          );

          if (errorBox) {
            errorBox.hidden = false;
          }

          setText(
            "[data-meet-error-message]",
            error.message
          );

          setText(
            "[data-meet-name]",
            "Meet not found"
          );

          setText(
            "[data-meet-description]",
            "Return to the Meet Center to browse published meets."
          );
        }
      }

      loadMeet();
    })();
  </script>`;

  return layout({
    site,
    title: "Meet Details",
    description:
      "Podium Watch meet information for Ohio high school cross country and track and field.",
    pathname: "/meetdetail/",
    content
  });
}
