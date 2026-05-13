/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript source — Next.js must transpile them.
  transpilePackages: ["@gitvisor/ui", "@gitvisor/shared"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevents the OAuth code (and other sensitive query params) leaking
          // via the Referer header to third-party resources loaded by the page.
          { key: "Referrer-Policy", value: "no-referrer" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Disallow embedding in iframes (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
