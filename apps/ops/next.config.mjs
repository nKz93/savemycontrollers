/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@smc/ui", "@smc/api-client"],
};
export default nextConfig;
