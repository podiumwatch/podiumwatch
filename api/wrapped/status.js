import { wrappedIsLive, wrappedLaunch } from "../../lib/wrapped_service.mjs";

// Public: is Podium Watch Wrapped out yet? { live, launch_at }
export default async function handler(request, response) {
  try {
    const [live, launchAt] = await Promise.all([wrappedIsLive(), wrappedLaunch()]);
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json({ live, launch_at: launchAt });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ live: false, launch_at: null });
  }
}
