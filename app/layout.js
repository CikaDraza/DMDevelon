// app/layout.js
import { getSeoMeta } from "@/lib/seo";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "react-hot-toast";
import GeoStructuredData from "@/components/geo/GeoStructuredData";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const seo = await getSeoMeta(slug);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    title: seo.title,
    description: seo.description,
    robots: seo.noIndex ? "noindex, nofollow" : "index, follow",
    canonical: `${baseUrl}/${slug === "/" ? "" : slug}`,
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${baseUrl}/${slug === "/" ? "" : slug}`,
      type: "website",
      images: seo.ogImage
        ? [
            {
              url: seo.ogImage.startsWith("http")
                ? seo.ogImage
                : `${baseUrl}/images/ogimage.png`,
            },
          ]
        : [],
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <GeoStructuredData />
      </head>
      <body>
        <QueryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#2C2C2C",
                color: "#fff",
                border: "1px solid rgba(255, 182, 51, 0.3)",
              },
              success: {
                iconTheme: {
                  primary: "#FFB633",
                  secondary: "#0f0f10",
                },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
