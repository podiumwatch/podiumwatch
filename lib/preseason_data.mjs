import fs from "node:fs/promises";

// Shared read-only access to the 2026 preseason cross country interactive
// data (Race Board, score progression, fifth runner factor, displacement
// report, tiebreaks, and reader-prediction poll definitions) for all eight
// classifications. Same cached-promise-over-a-bundled-JSON-file pattern as
// lib/ohio_foundation_service.mjs's loadBundledSchoolDataset -- one file on
// disk, read once per cold start, reused by both the build (scripts/build.mjs
// imports the same public/data file directly) and any server route that
// needs to validate a poll vote against the real poll/option ids rather than
// trusting whatever the client sends.
const dataUrl = new URL(
  "../public/data/podium-watch-2026-preseason-interactive-data.json",
  import.meta.url
);

let datasetPromise = null;

export async function loadPreseasonDataset() {
  if (!datasetPromise) {
    datasetPromise = fs.readFile(dataUrl, "utf8").then((text) => JSON.parse(text));
  }

  return datasetPromise;
}

export async function loadClassification(classificationKey) {
  const dataset = await loadPreseasonDataset();
  return dataset.classifications?.[classificationKey] || null;
}

// Reverse lookup: article slug -> classification key. Poll votes are keyed
// by article slug (what the client actually has on the page), but the poll
// definitions themselves live under the classification key -- this is the
// join between the two.
let slugIndexPromise = null;

export async function loadClassificationBySlug(articleSlug) {
  if (!slugIndexPromise) {
    slugIndexPromise = loadPreseasonDataset().then((dataset) => {
      const index = new Map();
      for (const [key, classification] of Object.entries(dataset.classifications || {})) {
        index.set(classification.articleSlug, { key, classification });
      }
      return index;
    });
  }

  const index = await slugIndexPromise;
  return index.get(articleSlug) || null;
}

// Validates that a poll id and option id are both real, supplied values for
// this article -- never trusts the client for anything beyond which of the
// real options it picked. Returns the matched poll/option (with the
// option's human label, useful for building a confirmation message) or null.
export function findPollOption(classification, pollId, optionId) {
  const poll = (classification?.polls || []).find((item) => item.id === pollId);
  if (!poll) return null;
  const option = (poll.options || []).find((item) => item.id === optionId);
  if (!option) return null;
  return { poll, option };
}
