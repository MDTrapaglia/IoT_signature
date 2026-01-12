import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/iot",
  assetPrefix: "/iot",
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
