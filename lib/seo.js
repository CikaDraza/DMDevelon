// src/lib/seo.ts

import CompanyProfile from "@/models/CompanyProfile";
import { connectDB } from "./mongodb";
import CMSPage from "@/models/CMSPage";

export async function getSeoMeta(route) {
  await connectDB();

  let seoData = null;
  let geoData = null;
  let socialLinks = {};

  if (route === "/" || route === "") {
    // 1. Logika za Home Page (CompanyProfile)
    const profile = await CompanyProfile.findOne({}).lean().exec();
    if (profile) {
      seoData = profile?.seo;
      geoData = profile?.geo;
      socialLinks = profile?.socialLinks || {};
    }
  } else {
    // 2. Logika za CMS stranice
    // Skidamo vodeći "/" ako postoji da bismo dobili slug
    const slug = route?.startsWith("/") ? route.slice(1) : route;
    const page = await CMSPage.findOne({ slug }).lean().exec();
    if (page) {
      seoData = page?.seo;
    }
  }

  return {
    // Fallbacks only apply when the CMS has nothing — but they are what a
    // crawler indexes on the day someone clears a field, so they say what the
    // business does rather than "Web Development", which describes half the
    // internet and ranks for none of it.
    title: seoData?.title ?? "DMDevelon | Booking, Search & Growth Systems",
    description:
      seoData?.description ??
      "DMDevelon builds booking, search and growth systems for service businesses — online appointment booking, client dashboards and the search work that fills them. Co-financed: no large up-front invoice, a monthly subscription from $49.",
    noIndex: seoData?.noIndex ?? false,
    keywords:
      seoData?.keywords ??
      "online booking system, appointment booking software, SEO for booking platforms, booking search growth, client automation, DMDevelon",
    socialLinks: socialLinks || {
      facebook: socialLinks?.facebook ?? "",
      twitter: socialLinks?.twitter ?? "",
      linkedin: socialLinks?.linkedin ?? "",
      instagram: socialLinks?.instagram ?? "",
      github: socialLinks?.github ?? "",
      tiktok: socialLinks?.tiktok ?? "",
    },
    ogImage: seoData?.ogImage ?? "",
    geo: {
      address: geoData?.address ?? "",
      city: geoData?.city ?? "",
      country: geoData?.country ?? "",
      postalCode: geoData?.postalCode ?? "",
      lat: geoData?.lat ?? "",
      lng: geoData?.lng ?? "",
    },
  };
}
