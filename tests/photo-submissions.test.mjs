import test from "node:test";
import assert from "node:assert/strict";
import { createPhotoSubmission } from "../lib/photo_submissions_service.mjs";

// Every case below fails validation before touching Supabase, so these run
// safely against the placeholder env vars scripts/test-photo-submissions.mjs
// sets -- same convention as tests/results-ingestion.test.mjs.

function validUploadInput(overrides = {}) {
  return {
    sourceType: "upload",
    submitterName: "Jamie Rivera",
    submitterEmail: "jamie@example.com",
    submitterRole: "parent",
    creditName: "Jamie Rivera",
    permissionConfirmed: true,
    meetName: "Springfield Invitational",
    items: [{ previewStorageKey: "2026-09-30/a.jpg", pendingOriginalStorageKey: "2026-09-30/b.jpg" }],
    ...overrides
  };
}

test("the honeypot field silently accepts without validating or touching the database", async () => {
  // A real bot fills in "website"; a real person never sees the field at
  // all (it's visually hidden). Reporting fake success here, with no
  // further validation, matches createPublicResultsSubmission and
  // submitTimingResults's exact convention -- a bot gets no signal it was
  // caught.
  const result = await createPhotoSubmission({ website: "http://spam.example" });
  assert.deepEqual(result, { accepted: true, submission_id: null });
});

test("a missing submitter name is rejected", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ submitterName: "" })),
    /name is required/i
  );
});

test("an invalid email is rejected", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ submitterEmail: "not-an-email" })),
    /valid contact email/i
  );
});

test("a missing credit name is rejected -- credit is never optional", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ creditName: "" })),
    /credit name is required/i
  );
});

test("permission must be explicitly confirmed -- a falsy or missing value is rejected, never assumed", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ permissionConfirmed: false })),
    /confirm you have permission/i
  );
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ permissionConfirmed: undefined })),
    /confirm you have permission/i
  );
});

test("a truthy but non-boolean permission value is rejected -- must be the real boolean true, not \"yes\" or 1", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ permissionConfirmed: "yes" })),
    /confirm you have permission/i
  );
});

test("a missing meet name is rejected", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ meetName: "" })),
    /meet name is required/i
  );
});

test("a link submission requires an album URL", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ sourceType: "link", items: [], albumUrl: "" })),
    /paste your album link/i
  );
});

test("a link submission with an album URL and no items passes this stage of validation (items are only required for the upload path)", async () => {
  // Real Storage/DB calls happen after this point, which this pure
  // validation test never reaches -- confirmed by NOT asserting a
  // rejection here, only that it gets past the field checks. A network
  // error from the placeholder Supabase URL is the expected next failure,
  // not a validation error.
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ sourceType: "link", items: [], albumUrl: "https://photos.example/album/123" })),
    (error) => !/is required|confirm you have permission|paste your album link/i.test(error.message)
  );
});

test("an upload submission with zero photos is rejected", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ items: [] })),
    /add at least one photo/i
  );
});

test("an upload submission over the per-batch photo limit is rejected", async () => {
  const items = Array.from({ length: 151 }, (_, i) => ({
    previewStorageKey: `2026-09-30/preview-${i}.jpg`,
    pendingOriginalStorageKey: `2026-09-30/pending-${i}.jpg`
  }));
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ items })),
    /at most 150 photos/i
  );
});

test("an upload item missing its pending-original key is rejected -- both the preview and the pending-original must have actually uploaded", async () => {
  await assert.rejects(
    () => createPhotoSubmission(validUploadInput({ items: [{ previewStorageKey: "2026-09-30/a.jpg", pendingOriginalStorageKey: "" }] })),
    /did not finish uploading/i
  );
});

test("more than one missing required field reports the first failure, never a silent partial acceptance", async () => {
  await assert.rejects(
    () => createPhotoSubmission({ sourceType: "upload", items: [] }),
    /name is required/i
  );
});
