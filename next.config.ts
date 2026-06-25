import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma 7 `prisma-client` generator with the edge-light runtime ships a
  // WebAssembly query compiler. Next's webpack build rejects .wasm modules
  // unless async WebAssembly is explicitly enabled.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
