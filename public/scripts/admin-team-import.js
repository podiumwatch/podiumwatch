(() => {
  const authLoading = document.querySelector("[data-admin-team-auth-loading]");
  const adminContent = document.querySelector("[data-admin-team-content]");
  const importForm = document.querySelector("[data-admin-team-import-form]");
  const messageBox = document.querySelector("[data-admin-team-message]");
  const previewSection = document.querySelector("[data-admin-team-preview]");
  const previewRows = document.querySelector("[data-admin-team-preview-rows]");
  const commitButton = document.querySelector("[data-commit-team-import]");
  const clearButton = document.querySelector("[data-clear-team-import]");
  const templateButton = document.querySelector("[data-download-team-template]");
  const summaryElements = {
    total: document.querySelector("[data-summary-total]"),
    insert: document.querySelector("[data-summary-insert]"),
    update: document.querySelector("[data-summary-update]"),
    unchanged: document.querySelector("[data-summary-unchanged]"),
    error: document.querySelector("[data-summary-error]")
  };

  let currentImport = null;
  let busy = false;

  if (
    !authLoading ||
    !adminContent ||
    !importForm ||
    !messageBox ||
    !previewSection ||
    !previewRows ||
    !commitButton ||
    !clearButton ||
    !templateButton ||
    Object.values(summaryElements).some((element) => !element)
  ) {
    return;
  }

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

  function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.hidden = !message;
    messageBox.style.background = type === "error"
      ? "rgba(220, 38, 38, 0.12)"
      : "rgba(0, 191, 99, 0.1)";
    messageBox.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;

    importForm
      .querySelectorAll("button")
      .forEach((element) => {
        element.disabled = value;
      });

    clearButton.disabled = value;
    templateButton.disabled = value;
    commitButton.disabled =
      value ||
      !currentImport ||
      currentImport.validRowCount === 0;
  }

  function parseCsv(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      const nextCharacter = input[index + 1];

      if (insideQuotes) {
        if (character === '"' && nextCharacter === '"') {
          field += '"';
          index += 1;
          continue;
        }

        if (character === '"') {
          insideQuotes = false;
          continue;
        }

        field += character;
        continue;
      }

      if (character === '"') {
        insideQuotes = true;
        continue;
      }

      if (character === ",") {
        row.push(field);
        field = "";
        continue;
      }

      if (character === "\n" || character === "\r") {
        if (character === "\r" && nextCharacter === "\n") {
          index += 1;
        }

        row.push(field);
        field = "";

        if (row.some((value) => String(value).trim() !== "")) {
          rows.push(row);
        }

        row = [];
        continue;
      }

      field += character;
    }

    if (field !== "" || row.length > 0) {
      row.push(field);

      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }
    }

    if (insideQuotes) {
      throw new Error("The CSV contains an unfinished quoted field.");
    }

    if (rows.length < 2) {
      throw new Error("The CSV must contain a heading row and at least one team.");
    }

    const headers = rows[0].map((header) =>
      String(header).trim().replace(/^\uFEFF/, "")
    );

    if (headers.every((header) => !header)) {
      throw new Error("The CSV heading row is empty.");
    }

    return rows
      .slice(1)
      .map((values) => {
        const result = {};

        headers.forEach((header, index) => {
          if (header) {
            result[header] = values[index] ?? "";
          }
        });

        return result;
      })
      .filter((rowValue) =>
        Object.values(rowValue).some((value) => String(value).trim() !== "")
      );
  }

  async function requestImport(payload) {
    const response = await fetch("/api/admin/teams-import", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      throw new Error(
        "Your admin session has expired. Sign in again through the main admin page."
      );
    }

    if (!response.ok) {
      throw new Error(data.error || "The team import request failed.");
    }

    return data;
  }

  function formatStatus(status) {
    const labels = {
      insert: "New",
      update: "Update",
      unchanged: "No change",
      error: "Error",
      skip: "Skipped"
    };

    return labels[status] || status;
  }

  function formatField(field) {
    const labels = {
      school_name: "School name",
      mascot: "Mascot",
      city: "City",
      state: "State",
      zip_code: "ZIP code",
      conference: "Conference",
      region: "Region",
      program_level: "Program level",
      program_scope: "Program scope",
      cross_country_boys_division: "Boys XC division",
      cross_country_girls_division: "Girls XC division",
      track_boys_division: "Boys track division",
      track_girls_division: "Girls track division",
      athletics_url: "Athletics website",
      website_url: "School website",
      logo_url: "Logo"
    };

    return labels[field] || field;
  }

  function renderErrors(errors) {
    if (!Array.isArray(errors) || errors.length === 0) {
      return "";
    }

    return (
      '<ul class="admin-team-errors">' +
      errors.map((error) => "<li>" + escapeHtml(error) + "</li>").join("") +
      "</ul>"
    );
  }

  function renderPreview(data) {
    const summary = data.summary || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];

    Object.entries(summaryElements).forEach(([name, element]) => {
      element.textContent = String(Number(summary[name]) || 0);
    });

    previewRows.innerHTML = rows
      .map((row) => {
        const status = cleanText(row.status) || "error";
        const changedFields = Array.isArray(row.changed_fields)
          ? row.changed_fields.map(formatField).join(", ")
          : "";

        return (
          "<tr>" +
            "<td>" + escapeHtml(row.row_number) + "</td>" +
            "<td><span class=\"admin-team-status admin-team-status-" + escapeHtml(status) + "\">" + escapeHtml(formatStatus(status)) + "</span></td>" +
            "<td><strong>" + escapeHtml(row.school_name) + "</strong></td>" +
            "<td>" + escapeHtml(row.city) + "</td>" +
            "<td>" + escapeHtml(row.conference) + "</td>" +
            "<td>" + escapeHtml(row.region) + "</td>" +
            "<td>" + escapeHtml(changedFields || "None") + "</td>" +
            "<td>" + renderErrors(row.errors) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    const validRowCount = Number(summary.insert || 0) + Number(summary.update || 0);
    currentImport.validRowCount = validRowCount;
    commitButton.disabled = validRowCount === 0;
    commitButton.textContent = validRowCount === 1
      ? "Import 1 team change"
      : `Import ${validRowCount} team changes`;
    previewSection.hidden = false;
    previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getSelectedUpdateFields() {
    return [...importForm.querySelectorAll('input[name="update_fields"]:checked')]
      .map((input) => input.value);
  }

  function buildCurrentSettings() {
    const fileInput = importForm.elements.team_file;
    const sourceInput = importForm.elements.source_name;
    const publishInput = importForm.elements.publish_imported_profiles;
    const updateModeInput = importForm.elements.update_mode;
    const file = fileInput?.files?.[0];

    if (!file) {
      throw new Error("Choose a CSV file first.");
    }

    const updateFields = getSelectedUpdateFields();

    if (updateFields.length === 0) {
      throw new Error("Choose at least one field that existing teams may update.");
    }

    return {
      file,
      sourceName: cleanText(sourceInput?.value) || "Podium Watch Team Import",
      publishImportedProfiles: Boolean(publishInput?.checked),
      updateMode: cleanText(updateModeInput?.value) || "fill_missing",
      updateFields
    };
  }

  function clearImport() {
    importForm.reset();
    importForm.elements.source_name.value = "Podium Watch Ohio Team List";
    importForm.elements.publish_imported_profiles.checked = true;
    importForm.elements.update_mode.value = "fill_missing";
    importForm
      .querySelectorAll('input[name="update_fields"]')
      .forEach((input) => {
        input.checked = true;
      });
    currentImport = null;
    previewRows.innerHTML = "";
    previewSection.hidden = true;
    Object.values(summaryElements).forEach((element) => {
      element.textContent = "0";
    });
    commitButton.textContent = "Import teams";
    showMessage("");
  }

  function downloadTemplate() {
    const headers = [
      "School Name",
      "City",
      "State",
      "Mascot",
      "Conference",
      "Region",
      "Program Level",
      "Program Scope",
      "Cross Country Boys Division",
      "Cross Country Girls Division",
      "Track Boys Division",
      "Track Girls Division",
      "Athletics Website",
      "School Website",
      "Logo URL",
      "Source School ID"
    ];
    const example = [
      "Example High School",
      "Example City",
      "Ohio",
      "Eagles",
      "Example Conference",
      "Southwest",
      "High School",
      "Boys and Girls",
      "Division 1",
      "Division 1",
      "Division 1",
      "Division 1",
      "https://example.com/athletics",
      "https://example.com",
      "",
      "EXAMPLE001"
    ];

    const escapeCsvValue = (value) => {
      const text = String(value ?? "");

      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return '"' + text.replaceAll('"', '""') + '"';
      }

      return text;
    };

    const csv = [headers, example]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "podium-watch-team-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function checkAdminAccess() {
    try {
      const response = await fetch("/api/admin/teams-import", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (response.status === 405) {
        authLoading.hidden = true;
        adminContent.hidden = false;
        return;
      }

      if (response.status === 401) {
        authLoading.innerHTML =
          "<h2>Admin sign in required</h2>" +
          "<p>Sign in through the Podium Watch admin page before using the bulk importer.</p>" +
          '<p><a class="button button-primary" href="/admin/">Open admin sign in</a></p>';
        return;
      }

      throw new Error("Admin access could not be confirmed.");
    } catch (error) {
      authLoading.innerHTML =
        "<h2>Team importer unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "Admin access could not be confirmed.") + "</p>" +
        '<p><a class="button button-primary" href="/admin/">Return to admin</a></p>';
    }
  }

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    try {
      setBusy(true);
      showMessage("Reading and checking the team file.");
      const settings = buildCurrentSettings();
      const text = await settings.file.text();
      const rows = parseCsv(text);

      if (rows.length > 3000) {
        throw new Error("The CSV can contain no more than 3000 teams.");
      }

      currentImport = {
        rows,
        fileName: settings.file.name,
        sourceName: settings.sourceName,
        publishImportedProfiles: settings.publishImportedProfiles,
        updateMode: settings.updateMode,
        updateFields: settings.updateFields,
        validRowCount: 0
      };

      const data = await requestImport({
        action: "preview",
        rows: currentImport.rows,
        file_name: currentImport.fileName,
        source_name: currentImport.sourceName,
        publish_imported_profiles: currentImport.publishImportedProfiles,
        update_mode: currentImport.updateMode,
        update_fields: currentImport.updateFields
      });

      renderPreview(data);
      const summary = data.summary || {};
      const ready = Number(summary.insert || 0) + Number(summary.update || 0);
      const unchanged = Number(summary.unchanged || 0);
      const errors = Number(summary.error || 0);
      let message = `${ready} team change${ready === 1 ? " is" : "s are"} ready to import.`;

      if (unchanged > 0) {
        message += ` ${unchanged} existing team${unchanged === 1 ? " needs" : "s need"} no changes.`;
      }

      if (errors > 0) {
        message += ` ${errors} row${errors === 1 ? " has" : "s have"} errors and will not be imported.`;
      }

      showMessage(message);
    } catch (error) {
      currentImport = null;
      previewSection.hidden = true;
      showMessage(error.message || "The CSV could not be previewed.", "error");
    } finally {
      setBusy(false);
    }
  });

  commitButton.addEventListener("click", async () => {
    if (busy || !currentImport || currentImport.validRowCount === 0) {
      return;
    }

    const overwriteWarning = currentImport.updateMode === "overwrite_selected"
      ? " Selected fields on existing teams will be replaced with CSV values."
      : " Existing team fields will only be filled when they are blank.";

    if (!window.confirm("Import these team changes now?" + overwriteWarning)) {
      return;
    }

    try {
      setBusy(true);
      showMessage("Importing team profiles and recording the change history.");
      const data = await requestImport({
        action: "commit",
        confirm: true,
        rows: currentImport.rows,
        file_name: currentImport.fileName,
        source_name: currentImport.sourceName,
        publish_imported_profiles: currentImport.publishImportedProfiles,
        update_mode: currentImport.updateMode,
        update_fields: currentImport.updateFields
      });
      const summary = data.summary || {};
      const inserted = Number(summary.inserted || 0);
      const updated = Number(summary.updated || 0);
      const warnings = Array.isArray(data.warnings)
        ? data.warnings.filter(Boolean)
        : [];
      const completionMessage =
        `Import complete. ${inserted} new team${inserted === 1 ? " was" : "s were"} created and ${updated} existing team${updated === 1 ? " was" : "s were"} updated.`;

      showMessage(
        warnings.length > 0
          ? completionMessage + " " + warnings.join(" ")
          : completionMessage,
        warnings.length > 0 ? "error" : "success"
      );
      commitButton.textContent = "Import complete";
      currentImport = null;
    } catch (error) {
      showMessage(error.message || "The team import could not be completed.", "error");
    } finally {
      setBusy(false);
      commitButton.disabled = true;
    }
  });

  clearButton.addEventListener("click", () => {
    if (!busy) {
      clearImport();
    }
  });

  templateButton.addEventListener("click", () => {
    if (!busy) {
      downloadTemplate();
    }
  });

  checkAdminAccess();
})();
