// Shared "Path to State" roadmap renderer -- loaded by both the team page
// (public/scripts/team-profile.js) and the athlete page
// (public/scripts/athlete-profile.js), matching the same window.PodiumX
// namespacing pattern public/scripts/pace-splits.js and
// public/scripts/team-auth-client.js already use, since nothing in
// public/scripts/ uses ES module import/export.
//
// Deliberately pure markup-building, no business logic: every field this
// renders (date_label, qualifying_text, status_label, status_tone,
// summary, source_note) is already fully computed server-side by
// lib/path_to_state_service.mjs's buildPathToState() -- this file's only
// job is turning that already-correct data into HTML, which is also what
// lets scripts/test-path-to-state.mjs exercise it directly from Node with
// only a minimal window stub (see public/scripts/pace-splits.js's header
// comment for the same pattern).
(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Builds the <li> list markup for one path (one gender). Returns an
  // empty string when the path isn't available -- callers should hide
  // the whole section/panel in that case, never render an empty list.
  function roadmapMarkup(path) {
    if (!path || !path.available || !Array.isArray(path.nodes) || !path.nodes.length) {
      return "";
    }

    return path.nodes.map((node) => {
      const ruleHtml = node.qualifying_text
        ? `<p class="path-to-state-rule">${escapeHtml(node.qualifying_text)}</p>`
        : `<p class="path-to-state-rule" data-unpublished="true">Qualifying counts are not published for this round yet.</p>`;

      const dateHtml = node.date_label
        ? `<p class="path-to-state-date">${escapeHtml(node.date_label)}</p>`
        : "";

      // An admin-entered note (e.g. "Won by 3 points over Perrysburg") is
      // free text -- always escaped, never trusted as markup.
      const noteHtml = node.note
        ? `<p class="path-to-state-note-text">${escapeHtml(node.note)}</p>`
        : "";

      return `<li class="path-to-state-node" data-status="${escapeHtml(node.status)}" data-reached="${node.reached ? "true" : "false"}" data-stage="${escapeHtml(node.key)}">
        <span class="path-to-state-dot" aria-hidden="true">${escapeHtml(node.order)}</span>
        <h3 class="path-to-state-stage">${escapeHtml(node.label)}</h3>
        ${dateHtml}
        ${ruleHtml}
        <span class="path-to-state-status" data-tone="${escapeHtml(node.status_tone)}">${escapeHtml(node.status_label)}</span>
        ${noteHtml}
      </li>`;
    }).join("");
  }

  // Renders into a container element (an <ol class="path-to-state">).
  // Returns true if anything was rendered, false if the section should be
  // hidden instead.
  function renderRoadmap(container, path) {
    if (!container) return false;
    const markup = roadmapMarkup(path);
    container.innerHTML = markup;
    return markup.length > 0;
  }

  window.PodiumPathToState = {
    escapeHtml,
    roadmapMarkup,
    renderRoadmap
  };
})();
