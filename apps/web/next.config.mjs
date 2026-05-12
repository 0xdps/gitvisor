/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript source — Next.js must transpile them.
  transpilePackages: ["@gitvisor/ui", "@gitvisor/shared"],

  // Proxy /api/* → internal API service (same as old server-start.mjs).
  // In dev this hits localhost:3002; in Docker API_INTERNAL_URL=http://api:3002.
  async rewrites() {
    const apiBase =
      process.env["API_INTERNAL_URL"] ?? "http://localhost:3002";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
