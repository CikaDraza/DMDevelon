// app/layout.js
import { getSeoMeta } from "@/lib/seo";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "react-hot-toast";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const seo = await getSeoMeta(slug);

  return {
    title: seo.title,
    description: seo.description,
    robots: seo.noIndex ? "noindex, nofollow" : "index, follow",
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
      type: "website",
      ogImage: seo.logo,
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
