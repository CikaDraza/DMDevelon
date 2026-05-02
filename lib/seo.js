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
    title: seoData?.title ?? "DMDevelon",
    description: seoData?.description ?? "Web Development",
    noIndex: seoData?.noIndex ?? false,
    keywords:
      seoData?.keywords ??
      "businesses increase sales, client automation, DMDevelon",
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
