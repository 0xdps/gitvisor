import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

function plexRoot() {
  try {
    return path.dirname(require.resolve("@ibm/plex/package.json"));
  } catch {
    return path.join(here, "node_modules/@ibm/plex");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript source — Next.js must transpile them.
  transpilePackages: ["@gitvisor/ui", "@gitvisor/shared"],
  webpack: (config) => {
    const plex = plexRoot();
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "~@ibm/plex": plex,
      "@ibm/plex": plex,
    };
    return config;
  },
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
