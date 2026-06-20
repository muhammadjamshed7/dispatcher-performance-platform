import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard/admin", destination: "/admin/dashboard", permanent: false },
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
      { source: "/teams", destination: "/admin/teams", permanent: false },
      { source: "/dispatchers", destination: "/admin/dispatchers", permanent: false },
      { source: "/carriers", destination: "/admin/carriers", permanent: false },
      { source: "/activities", destination: "/admin/activities", permanent: false },
      { source: "/rankings", destination: "/admin/rankings", permanent: false },
      { source: "/reports", destination: "/admin/reports", permanent: false },
      { source: "/settings", destination: "/admin/settings", permanent: false },
    ];
  },
};

export default nextConfig;
