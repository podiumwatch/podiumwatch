(() => {
  const meetList = document.querySelector(
    "[data-admin-meet-list]"
  );

  const meetForm = document.querySelector(
    "[data-meet-form]"
  );

  const formTitle = document.querySelector(
    "[data-meet-form-title]"
  );

  const submitLabel = document.querySelector(
    "[data-meet-submit-label]"
  );

  const cancelEditButton = document.querySelector(
    "[data-cancel-edit]"
  );

  const createMessage = document.querySelector(
    "[data-create-message]"
  );

  if (
    !meetList ||
    !meetForm ||
    !formTitle ||
    !submitLabel ||
    !cancelEditButton ||
    !createMessage
  ) {
    return;
  }

  function getMeets() {
    return Array.isArray(
      window.podiumAdminMeets
    )
      ? window.podiumAdminMeets
      : [];
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function addExtraButtons() {
    const meets = getMeets();

    meetList
      .querySelectorAll(
        "[data-meet-card]"
      )
      .forEach((card) => {
        const id = card.dataset.meetId;

        const meet = meets.find(
          (item) => item.id === id
        );

        if (!meet) {
          return;
        }

        const deleteButton =
          card.querySelector(
            "[data-delete-meet]"
          );

        const buttonArea =
          deleteButton?.parentElement;

        if (!buttonArea) {
          return;
        }

        if (
          !buttonArea.querySelector(
            "[data-duplicate-meet]"
          )
        ) {
          const duplicateButton =
            document.createElement(
              "button"
            );

          duplicateButton.type = "button";
          duplicateButton.className =
            "button button-outline";

          duplicateButton.dataset
            .duplicateMeet = meet.id;

          duplicateButton.textContent =
            "Duplicate meet";

          buttonArea.insertBefore(
            duplicateButton,
            deleteButton
          );
        }

        if (
          !buttonArea.querySelector(
            "[data-preview-meet]"
          )
        ) {
          const previewLink =
            document.createElement("a");

          previewLink.className =
            "button button-dark";

          previewLink.dataset
            .previewMeet = meet.id;

          previewLink.href =
            "/meetdetail/?slug=" +
            encodeURIComponent(
              meet.slug
            ) +
            "&preview=1";

          previewLink.target = "_blank";
          previewLink.rel =
            "noopener noreferrer";

          previewLink.textContent =
            meet.published
              ? "Preview meet"
              : "Preview draft";

          buttonArea.insertBefore(
            previewLink,
            deleteButton
          );
        }
      });
  }

  function duplicateMeet(meet) {
    meetForm.reset();

    window.setTimeout(() => {
      for (
        const element
        of meetForm.elements
      ) {
        if (!element.name) {
          continue;
        }

        if (
          element.type === "submit" ||
          element.type === "reset" ||
          element.type === "button"
        ) {
          continue;
        }

        if (element.name === "id") {
          element.value = "";
          continue;
        }

        if (element.type === "checkbox") {
          element.checked = false;
          continue;
        }

        let value =
          meet[element.name] ?? "";

        if (
          element.name === "name"
        ) {
          value =
            meet.name + " Copy";
        }

        if (
          element.name === "slug"
        ) {
          value =
            slugify(
              meet.slug ||
              meet.name
            ) +
            "-copy";
        }

        if (
          element.name === "start_time" &&
          typeof value === "string"
        ) {
          value = value.slice(0, 5);
        }

        element.value = value;
      }

      const publishedInput =
        meetForm.querySelector(
          '[name="published"]'
        );

      const featuredInput =
        meetForm.querySelector(
          '[name="featured"]'
        );

      if (publishedInput) {
        publishedInput.checked = false;
      }

      if (featuredInput) {
        featuredInput.checked = false;
      }

      formTitle.textContent =
        "Duplicate " + meet.name;

      submitLabel.textContent =
        "Create duplicate";

      cancelEditButton.hidden = false;

      createMessage.textContent =
        "Review the copied information. Change the name, date, and page slug before creating the new draft.";

      meetForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  }

  meetList.addEventListener(
    "click",
    (event) => {
      const duplicateButton =
        event.target.closest(
          "[data-duplicate-meet]"
        );

      if (!duplicateButton) {
        return;
      }

      const meet = getMeets().find(
        (item) =>
          item.id ===
          duplicateButton.dataset
            .duplicateMeet
      );

      if (meet) {
        duplicateMeet(meet);
      }
    }
  );

  document.addEventListener(
    "podiumadminmeetsloaded",
    () => {
      window.setTimeout(
        addExtraButtons,
        0
      );
    }
  );

  window.setTimeout(
    addExtraButtons,
    0
  );
})();