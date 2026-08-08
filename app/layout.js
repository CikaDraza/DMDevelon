// app/layout.js
import { getSeoMeta } from "@/lib/seo";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "react-hot-toast";
import GeoStructuredData from "@/components/geo/GeoStructuredData";

export const viewport = {
  themeColor: "#0f0f10",
  // Without this, Chrome on Android leaves `100dvh` at its full height when
  // the on-screen keyboard opens and simply slides the page up — so the chat
  // composer someone is typing into ends up under the keyboard. `resizes-content`
  // makes the viewport (and therefore dvh) actually shrink, which is what the
  // chat's flex column needs to keep the input on screen.
  interactiveWidget: "resizes-content",
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const seo = await getSeoMeta(slug);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    title: seo.title,
    description: seo.description,
    manifest: "/manifest.json",
    icons: {
      apple: "/icons/dmdevelon_logo-notifications.png",
    },
    appleWebApp: {
      capable: true,
      title: "DMDevelon",
      statusBarStyle: "black-translucent",
    },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <GeoStructuredData />
      </head>
      <body suppressHydrationWarning>
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
