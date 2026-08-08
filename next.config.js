/** @type {import('next').NextConfig} */

const nextConfig = {
  output: "standalone",

  turbopack: {},

  // Dev-only (ignored in production builds): since Next.js 15.2, the dev
  // server blocks HMR/asset requests from any origin other than localhost —
  // that's what breaks the invite/verify/reset links when they're opened via
  // the LAN IP (ws://192.168.1.x:3003/_next/webpack-hmr fails to connect,
  // and the page hangs). Add/replace this IP if it changes (e.g. after a
  // DHCP lease renewal) to keep testing those flows across devices.
  allowedDevOrigins: ["192.168.1.108"],

  serverExternalPackages: ["mongodb"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "tailwindcss.com",
      },
    ],
  },

  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' https: data:",
              "connect-src 'self'", // add your API domains if needed
              // Both would fall back to default-src 'self' and be allowed
              // anyway, but a PWA lives or dies on these two and an implicit
              // grant is easy to break later by tightening default-src.
              // Spelled out so registering /sw.js and fetching the manifest
              // never depend on a fallback chain nobody remembers.
              "worker-src 'self'",
              "manifest-src 'self'",
            ].join("; "),
          },
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.CORS_ORIGINS || "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Origin, X-Requested-With, Content-Type, Accept, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
