import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@maya/types", "@maya/utils", "@maya/api-client"],
  // Point to monorepo root so Next.js finds the correct lockfile
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
