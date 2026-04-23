import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

// export default withSentryConfig(nextConfig, {
//   org: "alvaropito",
//   project: "inventory-app",
//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   reactComponentAnnotation: { enabled: true },
//   tunnelRoute: "/monitoring",
//   disableLogger: true,
//   automaticVercelMonitors: true,
// });
