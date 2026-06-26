import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
// Windows can expose two casings for the same folder (Projects vs projects).
// Pin all bundler roots to the canonical on-disk path to avoid duplicate Next.js modules.
const projectRoot = fs.realpathSync.native(configDir);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  webpack: (config) => {
    config.context = projectRoot;
    config.resolve = config.resolve ?? {};
    config.resolve.symlinks = true;
    config.snapshot = {
      ...config.snapshot,
      immutablePaths: [],
      managedPaths: [path.join(projectRoot, "node_modules")],
    };

    return config;
  },
  // Prisma client is generated into gitignored `src/generated/prisma` during build.
  // Next.js file tracing skips gitignored files unless we include them explicitly.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
    "/api/**/*": ["./src/generated/prisma/**/*"],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      {
        source: "/dashboard/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/team-lead",
        destination: "/team-lead/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/dispatcher",
        destination: "/dispatcher/dashboard",
        permanent: false,
      },
      { source: "/auth/login", destination: "/", permanent: false },
      { source: "/teams", destination: "/admin/teams", permanent: false },
      {
        source: "/dispatchers",
        destination: "/admin/dispatchers",
        permanent: false,
      },
      { source: "/carriers", destination: "/admin/carriers", permanent: false },
      {
        source: "/activities",
        destination: "/admin/activities",
        permanent: false,
      },
      { source: "/rankings", destination: "/admin/rankings", permanent: false },
      { source: "/reports", destination: "/admin/reports", permanent: false },
      { source: "/settings", destination: "/admin/settings", permanent: false },
    ];
  },
};

export default nextConfig;
