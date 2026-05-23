// Cache-Control policies applied to asset responses by path.
// Since filenames are not content-hashed, we use modest TTLs with
// stale-while-revalidate so updates propagate within a day without
// blocking page loads.
const CACHE_RULES = [
  {
    // Timetable data: schedules rarely change. Cache fresh for 24h, then
    // serve stale for up to a week while revalidating in the background.
    test: (pathname) => pathname === "/data/timetable.json",
    value:
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  },
  {
    // HTML entrypoints: always revalidate so users pick up new asset URLs.
    test: (pathname) =>
      pathname === "/" || pathname.endsWith("/") || pathname.endsWith(".html"),
    value: "public, max-age=0, must-revalidate",
  },
  {
    // Static assets (JS, CSS, fonts, images, icons): cache for an hour in
    // the browser, a day at the edge, and serve stale while revalidating.
    test: (pathname) =>
      /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico)$/i.test(
        pathname,
      ),
    value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
  },
];

function cacheControlFor(pathname) {
  for (const rule of CACHE_RULES) {
    if (rule.test(pathname)) return rule.value;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    // Only rewrite headers on successful responses we can cache.
    if (response.status !== 200) return response;

    const { pathname } = new URL(request.url);
    const cacheControl = cacheControlFor(pathname);
    if (!cacheControl) return response;

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", cacheControl);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
