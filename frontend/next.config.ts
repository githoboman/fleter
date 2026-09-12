import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  serverExternalPackages: ['ws'],
};

export default nextConfig;
