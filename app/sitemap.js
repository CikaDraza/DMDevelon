import { connectDB } from "@/lib/mongodb";
import CMSPage from "@/models/CMSPage";
import Project from "@/models/Project";
import { absoluteUrl } from "@/lib/site-url";

// Regenerate hourly rather than on every crawl: the page and portfolio sets
// change rarely, and a sitemap that hits the database on each request is a
// free denial-of-service vector for anyone who feels like refreshing it.
export const revalidate = 3600;

/**
 * sitemap.xml, built from what is actually publishable.
 *
 * Like robots.js, this exists partly because the `[...slug]` catch-all was
 * answering `/sitemap.xml` with an HTML page — so Google had neither a robots
 * file nor a sitemap, and was left to discover pages by crawling a homepage
 * whose content only appears after JavaScript runs.
 *
 * Everything is best-effort: a database that is briefly unavailable should
 * degrade to "just the homepage", never to a 500 that makes Search Console
 * record the sitemap as broken.
 */
export default async function sitemap() {
  const now = new Date();
  const entries = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    await connectDB();

    // CMS pages, minus any the operator marked noIndex — listing a page in the
    // sitemap while telling robots not to index it is a contradiction Search
    // Console reports as an error.
    const pages = await CMSPage.find({ "seo.noIndex": { $ne: true } })
      .select("slug updatedAt")
      .lean();
    for (const page of pages) {
      if (!page?.slug) continue;
      entries.push({
        url: absoluteUrl(`/${page.slug}`),
        lastModified: page.updatedAt || now,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }

    const projects = await Project.find({ slug: { $nin: [null, ""] } })
      .select("slug updatedAt")
      .lean();
    for (const project of projects) {
      entries.push({
        url: absoluteUrl(`/projects/${project.slug}`),
        lastModified: project.updatedAt || now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error(
      "sitemap: database unavailable, serving homepage only",
      error,
    );
  }

  return entries;
}
