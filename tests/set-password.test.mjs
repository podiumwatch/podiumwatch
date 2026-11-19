// /set-password/ (src/pages/setpassword.mjs) and the homepage forwarding
// of Supabase invite and recovery links (src/pages/home.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { setPasswordPage } from "../src/pages/setpassword.mjs";
import { homePageHtml } from "../src/pages/home.mjs";
import { site, NOINDEX_NOFOLLOW_PREFIXES } from "../src/config/site.mjs";

test("set-password page: private, staff address passed in, expired-link message", () => {
  const html = setPasswordPage(site, { staffUrl: "/oatccc/admin/" });
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(html, /data-staff-url="\/oatccc\/admin\/"/);
  assert.match(html, /This link has expired or was already used\./);
  assert.match(html, /\/scripts\/set-password\.js/);
  assert.match(setPasswordPage(site), /data-staff-url="\/"/, "default: homepage");
  assert.ok(NOINDEX_NOFOLLOW_PREFIXES.includes("/set-password/"));
});

function forwardsTo(hash, search = "") {
  const html = homePageHtml({ stories: [], site });
  const script = html.match(/<script>\(function\(\)\{var h=location\.hash[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, "");
  let target = null;
  vm.runInNewContext(script, { location: { hash, search, replace: (url) => { target = url; } } });
  return target;
}

test("homepage forwards invite and recovery links and expired-link errors only", () => {
  assert.equal(forwardsTo("#access_token=a&refresh_token=b&type=invite"), "/set-password/#access_token=a&refresh_token=b&type=invite");
  assert.equal(forwardsTo("#access_token=a&refresh_token=b&expires_in=3600&type=recovery"), "/set-password/#access_token=a&refresh_token=b&expires_in=3600&type=recovery");
  assert.equal(forwardsTo("#error=access_denied&error_code=otp_expired&error_description=x"), "/set-password/#error=access_denied&error_code=otp_expired&error_description=x");
  assert.equal(forwardsTo("", "?token_hash=abc&type=recovery"), "/set-password/?token_hash=abc&type=recovery");
  assert.equal(forwardsTo(""), null, "a normal visit stays");
  assert.equal(forwardsTo("#latest"), null);
  assert.equal(forwardsTo("#access_token=a&refresh_token=b&type=signup"), null, "sign-up confirmations are not password links");
});
