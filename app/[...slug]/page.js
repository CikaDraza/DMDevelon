import { getSeoMeta } from "@/lib/seo";
import CMSPageClient from "./CMSPageClient"; // Putanja do tvoje klijentske komponente

export async function generateMetadata({ params }) {
  // Kod [...slug] rute, slug je niz, npr. ["privacy"] ili ["docs", "setup"]
  const resolvedParams = await params;
  const slugPath = Array.isArray(resolvedParams.slug)
    ? resolvedParams.slug.join("/")
    : resolvedParams.slug;

  const seo = await getSeoMeta(slugPath);

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    robots: seo.noIndex ? "noindex, nofollow" : "index, follow",
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "article",
    },
  };
}

export default async function Page({ params }) {
  const resolvedParams = await params;
  const slugPath = Array.isArray(resolvedParams.slug)
    ? resolvedParams.slug.join("/")
    : resolvedParams.slug;

  // Prosleđujemo slug direktno klijentskoj komponenti
  return <CMSPageClient initialSlug={slugPath} />;
}
