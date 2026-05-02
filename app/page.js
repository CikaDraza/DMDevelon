// app/page.js
import HomeClient from "@/components/pages/HomeClient";
import { getSeoMeta } from "@/lib/seo";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const URL = process.env.NEXT_PUBLIC_APP_URL;

async function getServices() {
  const res = await fetch(`${URL}/api/services`, {
    cache: "no-store", // ili revalidate: 60 za ISR
  });
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

export async function generateMetadata() {
  const seo = await getSeoMeta("/");

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    robots: seo.noIndex ? "noindex, nofollow" : "index, follow",
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${URL}/`,
      type: "website",
      ogImage: seo?.ogImage,
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
