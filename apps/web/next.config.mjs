/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript source — Next.js must transpile them.
  transpilePackages: ["@gitvisor/ui", "@gitvisor/shared"],
};

export default nextConfig;
