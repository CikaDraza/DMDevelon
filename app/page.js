// app/page.js
import HomeClient from "@/components/pages/HomeClient";
import { getSeoMeta } from "@/lib/seo";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import { connectDB } from "@/lib/mongodb";
import Service from "@/models/Service";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Re-rendered at most every 5 minutes rather than on every request. The
// services list changes rarely, and a cached HTML document is both faster for
// visitors and steadier for crawlers than one rebuilt per hit.
export const revalidate = 300;

// Read the database directly instead of the page fetching its own HTTP API.
// The round trip was pure overhead — an extra network hop, TLS and a second
// serverless invocation to reach data this process can already query — and it
// forced the page to be dynamic, so nothing could ever be cached. It also
// failed outright at build time, since the deployed origin isn't reachable
// from the builder.
//
// Still wrapped: a database blip must not take down the page a crawler is
// reading. The client hook backfills on hydration either way.
async function getServices() {
  try {
    await connectDB();
    const services = await Service.find().sort({ displayOrder: 1 }).lean();
    return JSON.parse(JSON.stringify(services));
  } catch (error) {
    console.error("home: services unavailable, rendering without them", error);
    return [];
  }
}

export async function generateMetadata() {
  const seo = await getSeoMeta("/");
  const canonical = absoluteUrl("/");
  const ogImage = seo?.ogImage
    ? seo.ogImage.startsWith("http")
      ? seo.ogImage
      : absoluteUrl(seo.ogImage)
    : absoluteUrl("/images/ogimage.png");

  return {
    metadataBase: new global.URL(siteUrl()),
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    robots: seo.noIndex ? "noindex, nofollow" : "index, follow",
    // `alternates.canonical` is the field Next actually renders as
    // <link rel="canonical">; the old top-level `canonical` key in layout.js
    // is not part of the Metadata API and emitted nothing at all.
    alternates: { canonical },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: "DMDevelon",
      type: "website",
      // `ogImage` is not a valid OpenGraph field — it was silently dropped, so
      // every share of this page has been previewing without an image.
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [ogImage],
    },
  };
}

export default async function Page() {
  const services = await getServices();
  return (
    <Suspense fallback={<Skeleton />}>
      <HomeClient initialServices={services} />
    </Suspense>
  );
}
