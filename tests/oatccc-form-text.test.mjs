// The verification form text must stay word for word the OATCCC's
// (src/oatccc/verification_form_text.mjs). The waiver is legal text.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { FORM_WAIVER, formTextParagraphs, formTextHtml } from "../src/oatccc/verification_form_text.mjs";

// SHA-256 of the waiver paragraph exactly as the OATCCC sent it (Nov 17,
// 2026). If this test fails, the waiver was edited: put it back.
const WAIVER_SHA256 = "1969a6afc4b36eb2783b5f277f568c065465fb02a4a5263bd1911fe48d6ae5c3";

// The OATCCC's file. Never committed (the repo is public), so this check
// runs only on a machine that has it.
const SOURCE = new URL("../dataimports/OATCCC_VERIFICATION_FORM_TEXT.md", import.meta.url);

test("the waiver paragraph is unchanged", () => {
  assert.equal(createHash("sha256").update(FORM_WAIVER, "utf8").digest("hex"), WAIVER_SHA256);
});

test("every line matches the OATCCC's final text", { skip: !existsSync(SOURCE) && "OATCCC_VERIFICATION_FORM_TEXT.md is not on this machine" }, () => {
  const md = readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
  const body = md.split(/\n---\n/)[1];
  const lines = body.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[Signature pad]"))
    .map((line) => line.replace(/^\*\*(.*)\*\*$/, "$1").replace(/^\d+\.\s+/, ""));
  assert.deepEqual(formTextParagraphs(), lines);
});

test("HTML keeps the words: no text added or dropped", () => {
  const text = formTextHtml({ withTitle: true })
    .replace(/<[^>]+>/g, "\n")
    .replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&amp;/g, "&")
    .split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(text, formTextParagraphs().flatMap((p) => p.split("awhitman@oatccc.com").flatMap((part, i) => (i ? ["awhitman@oatccc.com", part] : [part]))).map((s) => s.trim()).filter(Boolean));
});
