import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      {
        source: "/servisni-centar",
        destination: "/povijest-servisa",
        permanent: true,
      },
      {
        source: "/servisni-centar/:path*",
        destination: "/povijest-servisa/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
