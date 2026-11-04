import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careersync/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
