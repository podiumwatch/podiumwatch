import test from "node:test";
import assert from "node:assert/strict";
import { PARTNER_PACKAGES, publicPackages, validateInquiry } from "../lib/partner_page_service.mjs";

test("six packages; prices only from admin settings, never hard-coded", () => {
  assert.equal(PARTNER_PACKAGES.length, 6);
  const all = publicPackages({});
  assert.equal(all.length, 6);
  assert.ok(all.every((item) => item.price === null));
  const set = publicPackages({ rankings: { price: "$300 a season" }, school: { offered: false } });
  assert.equal(set.length, 5);
  assert.equal(set.find((item) => item.id === "rankings").price, "$300 a season");
  assert.ok(!set.some((item) => item.id === "school"));
});

test("inquiries need a name and a real email; unknown packages are dropped", () => {
  assert.throws(() => validateInquiry({ email: "a@b.co" }), /name/);
  assert.throws(() => validateInquiry({ name: "Pat", email: "not-an-email" }), /email/);
  const row = validateInquiry({ name: " Pat  Smith ", email: "Pat@Example.com", package: "rankings", message: "<b>hi</b>" });
  assert.equal(row.name, "Pat Smith");
  assert.equal(row.email, "pat@example.com");
  assert.equal(row.package, "Rankings presenting partner");
  assert.doesNotMatch(row.message, /[<>]/);
  assert.equal(validateInquiry({ name: "Pat", email: "p@x.io", package: "bogus" }).package, null);
  assert.equal(validateInquiry({ name: "Pat", email: "p@x.io", package: "other" }).package, "Something else");
});
