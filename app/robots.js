import { siteUrl } from "@/lib/site-url";

/**
 * Real robots.txt.
 *
 * Until this file existed, `/robots.txt` fell through to the `[...slug]`
 * catch-all route and was answered with the CMS page component: HTTP 200,
 * `content-type: text/html`, an HTML document. Search Console reported the
 * site as "Blocked by robots.txt" because what it fetched was not a robots
 * file at all. Same story for `/sitemap.xml` (see sitemap.js).
 *
 * A file-convention route like this one is matched BEFORE the catch-all, so
 * adding it is the whole fix — no change to `[...slug]` needed.
 */
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces. None of these should ever appear in an index, and
        // several are behind auth anyway — keeping them out of the crawl
        // budget is the point, not secrecy (robots.txt is public and is not a
        // security control).
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/invite",
          "/verify-email",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
