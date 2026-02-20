import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["lingo.dev"],
  allowedDevOrigins: ["192.168.1.105:3000", "localhost:3000"],
};

export default nextConfig;