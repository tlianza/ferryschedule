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

// Dynamic endpoint: live service alerts for Golden Gate Ferry. Unlike the
// timetable (baked in at deploy), alerts are time-sensitive, so we proxy the
// 511 GTFS-Realtime Service Alerts feed live and cache it briefly.
const ALERTS_PATH = "/data/alerts.json";
const ALERTS_URL = "https://api.511.org/transit/servicealerts";

function pickText(field) {
  const translations = field?.Translations;
  if (!Array.isArray(translations) || translations.length === 0) return "";
  const en = translations.find((t) => t.Language === "en");
  return (en?.Text ?? translations[0].Text ?? "").trim();
}

function normalizeAlert(entity) {
  const alert = entity?.Alert;
  if (!alert) return null;
  return {
    id: entity.Id ?? null,
    // Headers sometimes arrive prefixed with "- "; trim that for display.
    header: pickText(alert.HeaderText).replace(/^[-\s]+/, ""),
    description: pickText(alert.DescriptionText),
    url: pickText(alert.Url) || null,
    activePeriods: (alert.ActivePeriods ?? []).map((p) => ({
      start: p.Start ?? null,
      end: p.End ?? null,
    })),
    // Kept so we can filter to this schedule's stops later.
    informedEntities: (alert.InformedEntities ?? []).map((e) => ({
      agency: e.AgencyId ?? null,
      route: e.RouteId || null,
      stop: e.StopId ?? null,
    })),
  };
}

function alertsResponse(body, { sMaxAge = 300 } = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=60, s-maxage=${sMaxAge}, stale-while-revalidate=600`,
    },
  });
}

async function handleAlerts(env) {
  const apiKey = env.API_511_KEY;
  if (!apiKey) {
    // Fail soft: the page should still render without alerts.
    return alertsResponse({ alerts: [], error: "missing_api_key" }, { sMaxAge: 60 });
  }

  const url = new URL(ALERTS_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("agency", "GF");
  url.searchParams.set("format", "json");

  let upstream;
  try {
    // cacheEverything caches the upstream JSON at the edge so we don't hit
    // 511's rate limit on every request. (No-op under local `wrangler dev`.)
    upstream = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  } catch {
    return alertsResponse({ alerts: [], error: "fetch_failed" }, { sMaxAge: 60 });
  }
  if (!upstream.ok) {
    return alertsResponse({ alerts: [], error: `upstream_${upstream.status}` }, { sMaxAge: 60 });
  }

  let data;
  try {
    // The feed is gzip JSON with a UTF-8 BOM; the runtime decompresses, we
    // strip the BOM before parsing.
    const text = (await upstream.text()).replace(/^﻿/, "");
    data = JSON.parse(text);
  } catch {
    return alertsResponse({ alerts: [], error: "parse_failed" }, { sMaxAge: 60 });
  }

  const alerts = (data.Entities ?? []).map(normalizeAlert).filter(Boolean);
  return alertsResponse({ alerts, feedTimestamp: data.Header?.Timestamp ?? null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === ALERTS_PATH) {
      return handleAlerts(env);
    }

    const response = await env.ASSETS.fetch(request);

    // Only rewrite headers on successful responses we can cache.
    if (response.status !== 200) return response;

    const cacheControl = cacheControlFor(url.pathname);
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
