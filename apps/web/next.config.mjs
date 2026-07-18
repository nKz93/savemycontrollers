/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@smc/ui", "@smc/api-client", "@smc/i18n"],
};
export default nextConfig;
