import focus from "../src/data/image-focus.json" with { type: "json" };

// The crop a story photo gets in wide frames (scripts/image-focus.mjs):
// { position: "50% 20%", width, height } or { fit: "contain" }, or {}
// (center crop). Used where story details come from the database (front
// page leads and picks, their share cards, the /front-page/ archive).
const SAFE = /^[a-z0-9%. ]{1,40}$/i;
export function storyImageFocus(imageUrl) {
  const path = String(imageUrl || "").replace(/^https?:\/\/[^/]+/, "");
  const hit = focus.final?.[path];
  if (!hit) return {};
  if (hit.fit === "contain") return { fit: "contain" };
  return { ...(SAFE.test(String(hit.position || "")) ? { position: hit.position } : {}), ...(hit.width && hit.height ? { width: hit.width, height: hit.height } : {}) };
}

// "center 25%" / "50% 20%" -> [x, y] fractions (0..1).
export function positionFractions(position) {
  const words = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
  const parts = String(position || "").trim().split(/\s+/).map((p) => (p in words ? words[p] : parseFloat(p)));
  const [x, y] = [parts[0], parts[1] ?? 50].map((v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 0.5));
  return [x, y];
}

// Cover-crop by hand: the size and offset to draw a width x height photo
// inside a frameW x frameH box so the crop lands on its position.
export function coverBox({ width, height, position }, frameW, frameH) {
  if (!width || !height) return null;
  const scale = Math.max(frameW / width, frameH / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const [fx, fy] = positionFractions(position);
  return { width: w, height: h, left: -Math.round((w - frameW) * fx) || 0, top: -Math.round((h - frameH) * fy) || 0 };
}
