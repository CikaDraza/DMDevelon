/**
 * The site's canonical, absolute base URL — no trailing slash.
 *
 * robots.txt, sitemap.xml and canonical/OG tags all need the same absolute
 * origin, and each was deriving it slightly differently (or, in `app/page.js`,
 * interpolating `undefined` into the URL when the env var was missing, which
 * silently produced `undefined/`). One place, one answer.
 */
const FALLBACK = "https://dmdevelon.website";

export function siteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    // Vercel supplies this for preview deployments, where hardcoding the
    // production domain would make every canonical point at the wrong place.
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    FALLBACK;

  const withScheme = /^https?:\/\//.test(configured)
    ? configured
    : `https://${configured}`;
  return withScheme.replace(/\/+$/, "");
}

/** `siteUrl()` joined with a path, for canonical and OG URLs. */
export function absoluteUrl(path = "/") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${suffix === "/" ? "" : suffix}`;
}
