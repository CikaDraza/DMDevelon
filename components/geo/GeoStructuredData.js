// app/components/GeoStructuredData.jsx
import CompanyProfile from "@/models/CompanyProfile";
import { connectDB } from "@/lib/mongodb";

export default async function GeoStructuredData() {
  await connectDB();
  const profile = await CompanyProfile.findOne({}).lean();

  if (!profile) return null;

  const { name, geo, socialLinks, email, phone } = profile;
  const { address, city, country, postalCode, lat, lng } = geo || {};

  // Pravimo JSON-LD objekat za LocalBusiness
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: name || "DMDevelon",
    image: profile.logo || "",
    email: email,
    telephone: phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: address || "",
      addressLocality: city || "",
      postalCode: postalCode || "",
      addressCountry: country || "",
    },
    geo:
      lat && lng
        ? {
            "@type": "GeoCoordinates",
            latitude: lat,
            longitude: lng,
          }
        : undefined,
    sameAs: Object.values(socialLinks || {}).filter(Boolean), // svi socijalni linkovi
    url: process.env.NEXT_PUBLIC_APP_URL,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
