import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // garde le type-checking TS actif:
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;